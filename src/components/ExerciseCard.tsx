import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import type { Exercise } from "../types/training";

type ExerciseCardProps = {
  exercise: Exercise;
  lastResult?: string;
  suggestedResult?: string;
  subtitle?: string;
  onPress?: () => void;
};

export function ExerciseCard({
  exercise,
  lastResult,
  suggestedResult,
  subtitle,
  onPress
}: ExerciseCardProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.muscle}>{subtitle ?? exercise.muscleGroup}</Text>
        </View>
        {suggestedResult ? (
          <View style={styles.suggestionBadge}>
            <Text style={styles.suggestionLabel}>Dzisiaj</Text>
            <Text style={styles.suggestionValue}>{suggestedResult}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Ostatnio</Text>
        <Text style={styles.metaValue}>{lastResult ?? "brak wpisow"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 14
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  metaValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  muscle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
    textTransform: "capitalize"
  },
  pressed: {
    opacity: 0.88
  },
  suggestionBadge: {
    alignItems: "flex-end",
    backgroundColor: "rgba(245, 200, 76, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  suggestionLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800"
  },
  titleWrap: {
    flex: 1
  }
});
