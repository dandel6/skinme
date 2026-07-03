import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { LightSensor } from 'expo-sensors';
import { CAPTURE } from '../constants/capture';

export type LightLevel = 'unknown' | 'good' | 'low';

// 히스테리시스: good 상태는 block 미만으로 떨어질 때만 해제,
// 그 외 상태는 pass 이상일 때만 good으로 승격
function nextLevel(
  current: LightLevel,
  value: number,
  pass: number,
  block: number,
): LightLevel {
  if (current === 'good') return value < block ? 'low' : 'good';
  return value >= pass ? 'good' : 'low';
}

/**
 * 사전 조도 게이트 - 극단적 암흑만 차단하는 안전핀.
 * 얼굴이 프레임을 채우면 평균 휘도가 급락하므로 임계값은 매우 낮게 유지하고,
 * 실제 품질 판정은 촬영 후 lib/photoQuality의 중앙 휘도 측정이 담당한다.
 * 1차: Android 하드웨어 조도 센서(카메라 무관, CPU 비용 ≈ 0)
 * 2차: sampleSnapshot 폴백 - 저빈도 초저해상도 스냅샷 평균 휘도(0-255)
 * paused=true면 샘플링을 완전히 중단한다(플래시 촬영 중·리뷰 화면).
 *
 * ⚠️ iOS는 조도 센서 API가 없어 항상 2차 폴백(2초 주기 무음 스냅샷)으로 동작:
 * - 스냅샷마다 프리뷰 미세 끊김 가능성 (W1 알려진 갭 - 실기기 확인 필요)
 * - shutterSound 옵션이 iOS에서 무시되므로 지역 강제 셔터음 기기에서는
 *   2초마다 셔터음이 날 수 있음 → 그 경우 폴백 주기/방식 재설계 필요.
 * - 거슬리면 W3에서 vision-camera frame processor 전환 검토(dev build 전제).
 */
export type GateReading = { source: 'sensor' | 'fallback'; value: number };

export function useLuminanceGate(
  paused: boolean,
  sampleSnapshot: () => Promise<number | null>,
  readingRef?: { current: GateReading | null }, // 최신 사전게이트 측정치 노출(진단·B트랙)
): LightLevel {
  const [level, setLevel] = useState<LightLevel>('unknown');
  const levelRef = useRef<LightLevel>('unknown');
  const sampleRef = useRef(sampleSnapshot);
  sampleRef.current = sampleSnapshot;

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let sampling = false;

    const apply = (source: 'sensor' | 'fallback', value: number, pass: number, block: number) => {
      if (readingRef) readingRef.current = { source, value }; // 최신 측정치 기록
      // 진단 로그 - 어떤 경로가 어떤 값으로 게이트를 판정하는지
      console.log(
        `[gate] source=${source}, value=${Math.round(value * 10) / 10}, threshold=${pass}/${block}`,
      );
      const next = nextLevel(levelRef.current, value, pass, block);
      if (next !== levelRef.current) {
        console.log(`[gate] level: ${levelRef.current} → ${next}`);
        levelRef.current = next;
        setLevel(next);
      }
    };

    (async () => {
      let hasSensor = false;
      if (Platform.OS === 'android') {
        try {
          hasSensor = await LightSensor.isAvailableAsync();
        } catch (error) {
          // 조용히 폴백으로 빠지던 지점 - 이제 명시 로그
          console.log(
            '[gate] LightSensor.isAvailableAsync FAILED → fallback:',
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      if (cancelled) return;
      console.log(`[gate] path=${hasSensor ? 'sensor(lux)' : 'fallback(center-crop luma)'}`);

      if (hasSensor) {
        LightSensor.setUpdateInterval(CAPTURE.preGate.sensorIntervalMs);
        subscription = LightSensor.addListener(({ illuminance }) => {
          apply('sensor', illuminance, CAPTURE.preGate.luxPass, CAPTURE.preGate.luxBlock);
        });
      } else {
        timer = setInterval(() => {
          if (sampling) return; // 이전 샘플이 끝나기 전 중복 시작 금지
          sampling = true;
          sampleRef
            .current()
            .then((luma) => {
              if (!cancelled && luma !== null) {
                apply('fallback', luma, CAPTURE.preGate.lumaPass, CAPTURE.preGate.lumaBlock);
              }
            })
            .catch((error) => {
              console.log('[luminance] snapshot sampling failed', error);
            })
            .finally(() => {
              sampling = false;
            });
        }, CAPTURE.preGate.snapshotIntervalMs);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (timer) clearInterval(timer);
    };
  }, [paused]);

  return level;
}
