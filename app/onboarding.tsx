import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { STRINGS } from '../constants/strings';
import { track } from '../lib/analytics';
import {
  recordFunnel,
  setConsentAcknowledged,
  setOnboardingChoice,
  setOnboardingDone,
  type OnboardingChoice,
} from '../lib/onboarding';
import { COLORS, pressedStyle } from '../lib/ui';

// 첫 실행 온보딩 3장 - 설득 중심(수집 제로). 응답은 로컬 저장만.
// 완료/스킵 시 플래그 기록 → 재표시 없음. 코어 루프(촬영) 우선이라 언제든 건너뛰기 가능.
export default function OnboardingScreen() {
  const router = useRouter();
  // mode=consent: 촬영 진입 가드가 띄운 단독 고지 - ③만 보여주고 확인 시 원래 화면으로 복귀.
  // (딥링크·동의 도입 이전 기존 유저 등 온보딩을 안 거친 경로용)
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const consentOnly = mode === 'consent';
  const [step, setStep] = useState(consentOnly ? 2 : 0);
  const [consented, setConsented] = useState(false); // 사진 처리 고지 확인 여부 - 미확인 시 종료 불가

  useEffect(() => {
    const view =
      step === 0 ? 'step1_view' : step === 1 ? 'step2_view' : step === 2 ? 'consent_view' : 'step3_view';
    recordFunnel(view);
  }, [step]);

  const finishToday = async () => {
    await setOnboardingDone();
    // 촬영 유도는 today 빈 상태의 중앙 셔터가 담당(back 스택 안전). 진입 즉시 카메라 강제 안 함.
    router.replace('/today');
  };

  const choose = async (choice: OnboardingChoice) => {
    await recordFunnel(choice === 'a' ? 'choice_a' : 'choice_b');
    await setOnboardingChoice(choice); // b는 today의 첫 스캔 SampleReportCard 강조에 참고(로컬)
    await finishToday();
  };

  const skip = async () => {
    // 사진 처리 고지(③)는 우회 불가 - 미확인 상태의 건너뛰기는 종료가 아니라 고지 스텝으로 유도.
    if (!consented) {
      setStep(2);
      return;
    }
    await recordFunnel('skip');
    await finishToday();
  };

  return (
    <View style={styles.screen}>
      {step !== 2 && (
        <Pressable style={pressedStyle(styles.skip)} hitSlop={12} onPress={skip}>
          <Text style={styles.skipText}>{STRINGS.onboardingSkip}</Text>
        </Pressable>
      )}

      <View style={styles.body}>
        {step === 0 && (
          <>
            <Text style={styles.title}>{STRINGS.onboarding1Title}</Text>
            <Text style={styles.desc}>{STRINGS.onboarding1Body}</Text>
          </>
        )}
        {step === 1 && (
          <>
            <Svg width={150} height={190} style={styles.visual}>
              <Ellipse
                cx={75}
                cy={95}
                rx={60}
                ry={85}
                stroke={COLORS.accent}
                strokeWidth={3}
                strokeDasharray="10 8"
                fill="none"
              />
            </Svg>
            <Text style={styles.title}>{STRINGS.onboarding2Title}</Text>
            <Text style={styles.desc}>{STRINGS.onboarding2Body}</Text>
            <Text style={styles.privacy}>{STRINGS.onboarding2Privacy}</Text>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.title}>{STRINGS.consentTitle}</Text>
            <Text style={styles.desc}>{STRINGS.consentBody}</Text>
            <Pressable
              style={pressedStyle(styles.consentButton)}
              onPress={async () => {
                track('consent_acknowledged');
                await setConsentAcknowledged(); // 플래그 커밋 후 복귀 - 재포커스 가드의 재-push 레이스 차단
                setConsented(true);
                if (consentOnly) {
                  router.back(); // 촬영 화면으로 복귀 - 가드가 플래그 재확인 후 진행
                  return;
                }
                setStep(3);
              }}
            >
              <Text style={styles.consentButtonText}>{STRINGS.consentAccept}</Text>
            </Pressable>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.title}>{STRINGS.onboarding3Title}</Text>
            <View style={styles.options}>
              <Pressable style={pressedStyle(styles.option)} onPress={() => choose('a')}>
                <Text style={styles.optionText}>{STRINGS.onboarding3OptionA}</Text>
              </Pressable>
              <Pressable style={pressedStyle(styles.option)} onPress={() => choose('b')}>
                <Text style={styles.optionText}>{STRINGS.onboarding3OptionB}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {!consentOnly && (
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
        )}
        {step < 2 && (
          <Pressable style={pressedStyle(styles.next)} onPress={() => setStep((s) => s + 1)}>
            <Text style={styles.nextText}>{STRINGS.onboardingNext}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 40,
  },
  skip: {
    position: 'absolute',
    top: 56,
    right: 20,
    padding: 8,
  },
  skipText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  visual: {
    marginBottom: 12,
  },
  title: {
    color: '#111111',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
  },
  desc: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  privacy: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  options: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 12,
  },
  option: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  consentButton: {
    marginTop: 20,
    height: 52,
    paddingHorizontal: 40,
    borderRadius: 26,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 20,
  },
  next: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
