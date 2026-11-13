import { useEffect, useState } from "react";
import { Animated, View } from "react-native";

import { useTheme } from "../../theme/useTheme";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: object;
}) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={className}
      style={[
        { backgroundColor: colors.surfaceSubtle, borderRadius: 8 },
        style,
        { opacity },
      ]}
    />
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="gap-2 rounded-xl p-3"
          style={{ backgroundColor: "transparent" }}
        >
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </View>
      ))}
    </View>
  );
}
