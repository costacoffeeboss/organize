// =====================================================================
//  ProgressRing — the completion ring from the landing page mock.
//  Animates smoothly to its new percentage whenever it changes.
//
//  Props:
//    percent  — 0..100
//    size     — outer diameter (default 86)
//    stroke   — ring thickness (default 9)
//    children — centred content (usually the % label)
// =====================================================================

import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({ percent, size = 86, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const anim = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent, duration: 700,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* track */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(59,44,30,0.1)" strokeWidth={stroke} fill="none"
        />
        {/* progress — starts at 12 o'clock, sweeps clockwise */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={COLORS.espressoLight} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={anim.interpolate({
            inputRange: [0, 100],
            outputRange: [c, 0],
          })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
});
