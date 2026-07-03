import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { STRINGS } from '../../constants/strings';
import { ensureSignedIn, supabase, supabaseConfigError } from '../supabase';
import { skinAnalysisSchema, type SkinAnalysis } from './schema';

export type AnalysisStage = 'uploading' | 'analyzing' | 'saving' | 'done';

/**
 * 크롭본 → base64 인코딩 → analyze-skin edge function 호출(서버가 zod 검증
 * + scans insert까지 수행) → 클라이언트에서도 동일 스키마 재검증.
 * 미검증 JSON은 절대 result로 노출하지 않는다 (CLAUDE.md 규칙).
 */
export function useSkinAnalysis() {
  const [stage, setStage] = useState<AnalysisStage>('uploading');
  const [result, setResult] = useState<SkinAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const analyze = useCallback(async (
    croppedUri: string,
    gateContext?: {
      gate_source: string | null;
      gate_value: number | null;
      post_luma: number | null;
      post_luma_error: string | null;
      forced_capture: boolean;
      precheck_metrics: Record<string, number> | null;
    },
  ): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setResult(null);
    try {
      setStage('uploading');
      if (supabaseConfigError) {
        console.log('[analysis] blocked: supabase config missing');
        setError(supabaseConfigError);
        return;
      }
      const authError = await ensureSignedIn(); // 내부에서 user id/실패 사유 로깅
      if (authError) {
        setError(authError); // "연결 실패 - 네트워크를 확인해주세요"
        return;
      }
      let imageBase64 = await FileSystem.readAsStringAsync(croppedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('[analysis] image encoded, length:', imageBase64.length); // base64 본문은 로그 금지
      setStage('analyzing');
      console.log('[analysis] invoking analyze-skin');
      // 무한 대기 방지: 60초 내 응답 없으면 타임아웃 → 에러 화면(강제종료 대신 재촬영 유도).
      // 캡처 컨텍스트(B-트랙): 기기·앱버전만 자동 수집(유저 질문 없음). 엔진/프롬프트 버전은 서버가 추가.
      const clientContext = {
        device_model:
          Platform.OS === 'android'
            ? ((Platform.constants as { Model?: string }).Model ?? null)
            : null,
        os_name: Platform.OS,
        os_version: String(Platform.Version),
        app_version: Constants.expoConfig?.version ?? null,
        gate_source: gateContext?.gate_source ?? null,
        gate_value: gateContext?.gate_value ?? null,
        post_luma: gateContext?.post_luma ?? null,
        post_luma_error: gateContext?.post_luma_error ?? null,
        forced_capture: gateContext?.forced_capture ?? false,
        precheck_metrics: gateContext?.precheck_metrics ?? null,
      };
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const invocation = supabase.functions.invoke('analyze-skin', {
        body: { image_base64: imageBase64, client_context: clientContext },
      });
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('analysis_timeout')), 60000);
      });
      timeout.catch(() => {}); // 경쟁에서 진 타임아웃의 rejection 미소비 방지
      const { data, error: fnError } = await Promise.race([invocation, timeout]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        // 전송 후 이 클로저의 base64 지역 참조를 비운다 - 성공·타임아웃·실패 전 경로. (best-effort 해제)
        // 주의: 이건 "저장 안 함"이 아니라 메모리 상주 최소화. 분석 자체는 외부(서버→AI)로 전송된다.
        imageBase64 = '';
      });
      if (fnError) {
        const status = (fnError as { context?: { status?: number } }).context?.status;
        console.log(
          '[analysis] invoke ERROR:',
          fnError.name,
          fnError.message,
          'status:',
          status ?? 'n/a',
        );
        if (status === 429) {
          setError(STRINGS.rateLimited); // 시간당 상한 초과
          return;
        }
        throw fnError;
      }
      console.log('[analysis] invoke response:', JSON.stringify(data));
      setStage('saving');
      const parsed = skinAnalysisSchema.safeParse(data?.result);
      if (!parsed.success) {
        console.log(
          '[analysis] client validation failed:',
          JSON.stringify(parsed.error.issues.slice(0, 3)),
        );
        throw new Error('client_validation_failed');
      }
      setResult(parsed.data);
      setStage('done');
    } catch (caught) {
      // 사용자 문구와 콘솔 로그 분리. base64는 로그에 출력 금지.
      console.log(
        '[analysis] failed:',
        caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught),
      );
      setError(STRINGS.analysisFailed);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setStage('uploading');
    setResult(null);
    setError(null);
  }, []);

  return { stage, result, error, analyze, reset };
}
