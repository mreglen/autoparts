import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

import { useTheme } from "../../theme/useTheme";

interface SheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

const COLLAPSED_HEIGHT = 150; // px, минимальная высота свернутого состояния
const SNAP_THRESHOLD = 80; // px, порог для переключения между состояниями

export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);

  const maxHeight = 800 - insets.top - 32; // максимальная высота с отступом от верха

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Пан только вниз если уже в расширенном состоянии
      if (expanded && gestureState.dy > 0) return true;
      // Пан только вверх если в свернутом состоянии
      if (!expanded && gestureState.dy < 0) return true;
      return false;
    },
    onPanResponderMove: (_, gestureState) => {
      let newY = gestureState.dy;
      if (expanded) {
        // От расширенного (0) до свернутого
        newY = Math.max(0, Math.min(newY, maxHeight - COLLAPSED_HEIGHT));
      } else {
        // От свернутого (maxHeight - COLLAPSED_HEIGHT) до расширенного
        newY = (maxHeight - COLLAPSED_HEIGHT) + gestureState.dy;
        newY = Math.max(0, Math.min(newY, maxHeight - COLLAPSED_HEIGHT));
      }
      translateY.value = newY;
    },
    onPanResponderRelease: (_, gestureState) => {
      const threshold = SNAP_THRESHOLD;
      if (expanded) {
        // Из расширенного: пан вниз > threshold → свернуть
        if (gestureState.dy > threshold) {
          translateY.value = withSpring(maxHeight - COLLAPSED_HEIGHT);
          runOnJS(setExpanded)(false);
        } else {
          translateY.value = withSpring(0);
        }
      } else {
        // Из свернутого: пан вверх > threshold → расширить
        if (gestureState.dy < -threshold) {
          translateY.value = withSpring(0);
          runOnJS(setExpanded)(true);
        } else {
          translateY.value = withSpring(maxHeight - COLLAPSED_HEIGHT);
        }
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const toggleExpanded = () => {
    if (expanded) {
      // eslint-disable-next-line react-hooks/immutability -- shared value Reanimated
      translateY.value = withSpring(maxHeight - COLLAPSED_HEIGHT);
      setExpanded(false);
    } else {
      translateY.value = withSpring(0);
      setExpanded(true);
    }
  };

  // Сброс при открытии/закрытии
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/immutability -- shared value Reanimated
      translateY.value = withSpring(maxHeight - COLLAPSED_HEIGHT);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация sheet с visible
      setExpanded(false);
    } else {
      translateY.value = withSpring(maxHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- maxHeight/translateY стабильны
  }, [visible]);

  // Поднимаем sheet при открытии клавиатуры
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      translateY.value = withSpring(0);
      setExpanded(true);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      translateY.value = withSpring(maxHeight - COLLAPSED_HEIGHT);
      setExpanded(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- слушатели вешаются один раз
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <KeyboardAvoidingView
        className="absolute bottom-0 left-0 right-0"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
              maxHeight,
            },
            animatedStyle,
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable onPress={toggleExpanded}>
            <View
              className="mb-3 h-1 w-10 self-center rounded-full"
              style={{ backgroundColor: colors.lineStrong }}
            />
          </Pressable>
          {title ? (
            <Text
              className="mb-3 text-lg font-semibold"
              style={{ color: colors.ink }}
            >
              {title}
            </Text>
          ) : null}
          <ScrollView
            style={{ maxHeight: expanded ? maxHeight - COLLAPSED_HEIGHT : "auto" }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
