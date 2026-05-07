import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { colors } from "../theme/colors";
import { type as t } from "../theme/typography";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
};

export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
  style
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondaryButton,
        variant === "danger" && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          variant === "secondary" && styles.secondaryText,
          variant === "danger" && styles.dangerText,
          disabled && styles.disabledText
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  disabledButton: {
    backgroundColor: "#2b3344"
  },
  disabledText: {
    color: colors.muted
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }]
  },
  dangerButton: {
    backgroundColor: "rgba(255, 107, 107, 0.16)",
    borderColor: colors.danger,
    borderWidth: 1
  },
  dangerText: {
    color: colors.danger
  },
  secondaryButton: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderWidth: 1
  },
  secondaryText: {
    color: colors.text
  },
  text: {
    color: "#111827",
    fontSize: t.button,
    fontWeight: "700"
  }
});
