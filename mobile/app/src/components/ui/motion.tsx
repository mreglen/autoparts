import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { DURATION, EASING, PRESS, staggerDelay } from "../../theme/motion";

const easingBezier = (curve: readonly number[]) =>
  Easing.bezier(curve[0], curve[1], curve[2], curve[3]);

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Pressable с пружинящим масштабированием при нажатии (motion-токены). */
export function PressableScale({
  children,
  onPressIn,
  onPressOut,
  disabled,
  style,
  ...rest
}: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const animate = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: PRESS.duration,
      easing: easingBezier(EASING.standard),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(e) => {
          if (!disabled) animate(PRESS.scale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animate(1);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

interface FadeSlideInProps {
  children: ReactNode;
  /** Индекс в списке — даёт stagger-задержку через motion-токены. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Появление контентного блока: fade + лёгкий сдвиг вверх. */
export function FadeSlideIn({ children, index = 0, style }: FadeSlideInProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const delay = staggerDelay(index);
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION.base,
        easing: easingBezier(EASING.enter),
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [index, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
