import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getExercises,
  getPlannedExercises,
  getWorkoutDays
} from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import { type as t } from "../theme/typography";
import type { Exercise, PlannedExercise, WorkoutDay } from "../types/training";
import { summarizeSetBlocks } from "../utils/workout";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutPlan">;

function formatPlannedExercise(planned: PlannedExercise) {
  const weight = planned.suggestedWeightKg
    ? `${planned.suggestedWeightKg} kg`
    : planned.suggestedWeightLabel ?? "bez kg";
  const progression = planned.progressionStepKg
    ? `, +${planned.progressionStepKg} kg gdy zaliczone`
    : "";
  const bwGoal =
    planned.targetReps != null ? ` · cel BW ${planned.targetReps} powt.` : "";

  return `${summarizeSetBlocks(planned)} · cel ${weight}${progression}${bwGoal}`;
}

export function WorkoutPlanScreen({ navigation }: Props) {
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [loadedDays, loadedPlannedExercises, loadedExercises] =
          await Promise.all([getWorkoutDays(), getPlannedExercises(), getExercises()]);

        if (isActive) {
          setWorkoutDays(loadedDays);
          setPlannedExercises(loadedPlannedExercises);
          setExercises(loadedExercises);
        }
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Edycja</Text>
        <Text style={styles.title}>Moje treningi</Text>
        <Text style={styles.subtitle}>
          Dodaj trening lub edytuj cwiczenia — na koniec wybierasz dzien na ekranie glownym.
        </Text>
      </View>

      <PrimaryButton
        onPress={() => navigation.navigate("WorkoutEditor", {})}
        title="Dodaj nowy trening"
      />

      <View style={styles.list}>
        {workoutDays.map((day) => {
          const plannedForDay = plannedExercises
            .filter((planned) => planned.workoutDayId === day.id)
            .sort((a, b) => a.order - b.order);

          return (
            <View key={day.id} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderText}>
                  <Text style={styles.dayTitle} numberOfLines={2}>
                    {day.name}
                  </Text>
                  <Text style={styles.dayMeta}>
                    {plannedForDay.length} cwiczenia w kolejnosci
                  </Text>
                </View>
                <PrimaryButton
                  onPress={() =>
                    navigation.navigate("WorkoutEditor", { workoutDayId: day.id })
                  }
                  title="Edytuj"
                  variant="secondary"
                  style={styles.editButton}
                />
              </View>

              {plannedForDay.map((planned) => {
                const exercise = exercises.find(
                  (item) => item.id === planned.exerciseId
                );

                return (
                  <View key={planned.id} style={styles.exerciseRow}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderText}>{planned.order}</Text>
                    </View>
                    <View style={styles.exerciseTextWrap}>
                      <Text style={styles.exerciseName}>
                        {exercise?.name ?? "Cwiczenie"}
                      </Text>
                      <Text style={styles.exercisePlan} numberOfLines={3}>
                        {formatPlannedExercise(planned)}
                      </Text>
                    </View>
                    <PrimaryButton
                      onPress={() =>
                        navigation.navigate("ExerciseDetails", {
                          exerciseId: planned.exerciseId,
                          workoutDayId: day.id
                        })
                      }
                      title="Historia"
                      variant="secondary"
                      style={styles.historyButton}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: 16,
    padding: 18,
    paddingBottom: 32
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  dayHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  dayHeaderText: {
    flex: 1,
    minWidth: 0
  },
  dayMeta: {
    color: colors.muted,
    fontSize: t.body,
    marginTop: 4
  },
  dayTitle: {
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "900"
  },
  editButton: {
    minHeight: 42,
    paddingHorizontal: 14
  },
  exerciseName: {
    color: colors.text,
    fontSize: t.body,
    fontWeight: "900"
  },
  exercisePlan: {
    color: colors.muted,
    fontSize: t.caption,
    lineHeight: t.lineCaption,
    marginTop: 3
  },
  exerciseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  exerciseTextWrap: {
    flex: 1,
    minWidth: 0
  },
  historyButton: {
    flexShrink: 0,
    minHeight: 38,
    paddingHorizontal: 12
  },
  eyebrow: {
    color: colors.primary,
    fontSize: t.caption,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20
  },
  list: {
    gap: 12
  },
  orderBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  orderText: {
    color: colors.primary,
    fontSize: t.caption,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontSize: t.body,
    lineHeight: t.lineCaption,
    marginTop: 8
  },
  title: {
    color: colors.text,
    fontSize: t.display,
    fontWeight: "900",
    marginTop: 4
  }
});
