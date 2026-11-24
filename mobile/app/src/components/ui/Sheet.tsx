/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect, react-hooks/refs, react-hooks/exhaustive-deps -- Reanimated shared values и синхронизация sheet с visible/keyboard требуют императивных присваиваний */
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";

interface SheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

const PEEK_HEIGHT = 96; // px видимой части в свёрнутом состоянии
const SNAP_THRESHOLD = 60; // px свайпа для переключения состояния

export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const panStart = useRef(0);

  const maxHeight = 800 - insets.top - 24;
  const collapsedOffset = Math.max(0, sheetHeight - PEEK_HEIGHT);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
    onPanResponderGrant: () => {
      panStart.current = translateY.value;
    },
    onPanResponderMove: (_, gs) => {
      const next = panStart.current + gs.dy;
      translateY.value = Math.max(0, Math.min(next, collapsedOffset || maxHeight));
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy < -SNAP_THRESHOLD) {
        translateY.value = withSpring(0);
        runOnJS(setExpanded)(true);
      } else if (gs.dy > SNAP_THRESHOLD) {
        translateY.value = withSpring(collapsedOffset);
        runOnJS(setExpanded)(false);
      } else {
        translateY.value = withSpring(expanded ? 0 : collapsedOffset);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const toggleExpanded = () => {
    if (expanded) {
      translateY.value = withSpring(collapsedOffset);
      setExpanded(false);
    } else {
      translateY.value = withSpring(0);
      setExpanded(true);
    }
  };

  const handleLayout = (e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    setSheetHeight(h);
    // Если шторка свёрнута — удерживаем её на peek-позиции после пересчёта высоты
    const offset = Math.max(0, h - PEEK_HEIGHT);
    if (!expanded) translateY.value = offset;
  };

  // Сброс при открытии/закрытии
  useEffect(() => {
    if (visible) {
      setExpanded(false);
      setSheetHeight(0);
      translateY.value = withSpring(0);
    } else {
      translateY.value = withSpring(maxHeight);
    }
  }, [visible]);

  // Поднимаем sheet при открытии клавиатуры
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      translateY.value = withSpring(0);
      setExpanded(true);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      translateY.value = withSpring(collapsedOffset);
      setExpanded(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
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
          onLayout={handleLayout}
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
            style={{ flexGrow: 0 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
