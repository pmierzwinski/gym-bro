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

  return `${summarizeSetBlocks(planned)} · cel ${weight}${progression}`;
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
        <Text style={styles.eyebrow}>Plan</Text>
        <Text style={styles.title}>Moje treningi</Text>
        <Text style={styles.subtitle}>
          Tu edytujesz treningi, ktore pozniej wybierasz z ekranu glownego.
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
                <View>
                  <Text style={styles.dayTitle}>{day.name}</Text>
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
                      <Text style={styles.exercisePlan}>
                        {formatPlannedExercise(planned)}
                      </Text>
                    </View>
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
  dayMeta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4
  },
  dayTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  editButton: {
    minHeight: 42,
    paddingHorizontal: 14
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  exercisePlan: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3
  },
  exerciseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  exerciseTextWrap: {
    flex: 1
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
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
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4
  }
});
