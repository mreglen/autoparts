import { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";

import {
  explicitFontFamily,
  fontFamilyForWeight,
  styleFontWeight,
} from "../../theme/fonts";

export type AppTextProps = TextProps;

function resolveFontFamily(
  style: unknown,
  className?: string,
): string | undefined {
  return (
    explicitFontFamily(style) ??
    fontFamilyForWeight(styleFontWeight(style), className) ??
    undefined
  );
}

/** Text с фирменным шрифтом Golos Text: вес берётся из style.fontWeight
 *  или className-утилит font-* (NativeWind). */
export const AppText = forwardRef<
  React.ComponentRef<typeof RNText>,
  AppTextProps
>(function AppText({ style, className, ...rest }, ref) {
  const fontFamily = resolveFontFamily(style, className);
  return (
    <RNText
      ref={ref}
      className={className}
      style={fontFamily ? [style, { fontFamily }] : style}
      {...rest}
    />
  );
});

export type AppTextInputProps = TextInputProps;

export const AppTextInput = forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  AppTextInputProps
>(function AppTextInput({ style, className, ...rest }, ref) {
  const fontFamily = resolveFontFamily(style, className);
  return (
    <RNTextInput
      ref={ref}
      className={className}
      style={fontFamily ? [style, { fontFamily }] : style}
      {...rest}
    />
  );
});
