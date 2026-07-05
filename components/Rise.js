// =====================================================================
//  Rise — fade in and drift up gently after `delay` ms. Used to stagger
//  cards onto the Home screen (and anywhere else that should arrive
//  softly rather than snap into place).
// =====================================================================

import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

export default function Rise({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1, duration: 550, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}
