import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';
import { ellipseForScreen } from '../../constants/faceGuide';
import { STRINGS } from '../../constants/strings';
import type { LightLevel } from '../../hooks/useLuminanceGate';

type Props = {
  lightLevel: LightLevel;
};

export function FaceGuideOverlay({ lightLevel }: Props) {
  const { width, height } = useWindowDimensions();
  // 타원 파라미터는 constants/faceGuide 단일 소스 - 크롭(lib/faceCrop)과 공유
  const { cx, cy, rx, ry } = ellipseForScreen(width, height);
  const strokeColor = lightLevel === 'good' ? '#4ADE80' : '#D1D5DB';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="faceHole">
            <Rect width={width} height={height} fill="#ffffff" />
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000000" />
          </Mask>
        </Defs>
        <Rect
          width={width}
          height={height}
          fill="rgba(0,0,0,0.45)"
          mask="url(#faceHole)"
        />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={strokeColor}
          strokeWidth={3}
          strokeDasharray="10 8"
          fill="none"
        />
      </Svg>
      <View style={[styles.textWrap, { top: cy + ry + 16 }]}>
        <Text style={styles.guide}>{STRINGS.captureGuide}</Text>
        {lightLevel === 'low' && (
          <Text style={styles.lowLight}>{STRINGS.lowLight}</Text>
        )}
        {lightLevel === 'unknown' && (
          <Text style={styles.checking}>{STRINGS.lightChecking}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  guide: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  lowLight: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  checking: {
    color: '#D1D5DB',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
