import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { currentTrainingGroupId, currentUserId } from "../data/mockData";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getExercises,
  getPlannedExercises,
  getWorkoutDays,
  getWorkoutSessions,
  saveLastWorkoutDayId,
  saveWorkoutSession
} from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import type {
  DifficultyLevel,
  Exercise,
  PlannedExercise,
  WorkoutDay,
  WorkoutSession
} from "../types/training";
import {
  expandSetBlocks,
  getSuggestedTopWeight,
  summarizeSetBlocks
} from "../utils/workout";

type Props = Readonly<NativeStackScreenProps<RootStackParamList, "TodayWorkout">>;
type SeriesValue = { weightKg: string; reps: string; done: boolean };
type SeriesValues = Record<string, SeriesValue>;

function getSeriesKey(plannedId: string, setNumber: number) {
  return `${plannedId}:${setNumber}`;
}

function getExerciseStatus(planned: PlannedExercise, values: SeriesValues) {
  const sets = expandSetBlocks(planned);
  const filled = sets.filter(
    (set) => values[getSeriesKey(planned.id, set.setNumber)]?.done
  ).length;

  if (filled === 0) {
    return "empty";
  }

  return filled === sets.length ? "done" : "partial";
}

export function TodayWorkoutScreen({ navigation, route }: Props) {
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedPlannedId, setSelectedPlannedId] = useState<string>();
  const [seriesValues, setSeriesValues] = useState<SeriesValues>({});

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [loadedWorkoutDays, loadedPlannedExercises, loadedExercises, loadedSessions] =
          await Promise.all([
            getWorkoutDays(),
            getPlannedExercises(),
            getExercises(),
            getWorkoutSessions()
          ]);

        if (isActive) {
          setWorkoutDays(loadedWorkoutDays);
          setPlannedExercises(loadedPlannedExercises);
          setExercises(loadedExercises);
          setSessions(loadedSessions);
        }
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const workoutDayId = route.params?.workoutDayId ?? workoutDays[0]?.id;
  const workoutDay = workoutDays.find((day) => day.id === workoutDayId);
  const plannedForWorkout = useMemo(
    () =>
      plannedExercises
        .filter((planned) => planned.workoutDayId === workoutDayId)
        .sort((a, b) => a.order - b.order),
    [plannedExercises, workoutDayId]
  );

  function getExercise(exerciseId: string) {
    return exercises.find((exercise) => exercise.id === exerciseId);
  }

  function getInitialSeriesValue(planned: PlannedExercise, setNumber: number) {
    const topWeight = getSuggestedTopWeight(planned, sessions);
    const plannedSet = expandSetBlocks(planned, topWeight).find(
      (set) => set.setNumber === setNumber
    );

    return {
      weightKg: plannedSet?.weightKg ? String(plannedSet.weightKg) : "",
      reps: plannedSet?.reps ? String(plannedSet.reps) : "",
      done: false
    };
  }

  function getValue(planned: PlannedExercise, setNumber: number) {
    return (
      seriesValues[getSeriesKey(planned.id, setNumber)] ??
      getInitialSeriesValue(planned, setNumber)
    );
  }

  function updateValue(
    planned: PlannedExercise,
    setNumber: number,
    patch: Partial<SeriesValue>
  ) {
    const key = getSeriesKey(planned.id, setNumber);
    setSeriesValues((current) => ({
      ...current,
      [key]: {
        ...getValue(planned, setNumber),
        ...current[key],
        ...patch
      }
    }));
  }

  async function saveSingleSet(
    planned: PlannedExercise,
    plannedSet: ReturnType<typeof expandSetBlocks>[number],
    value: SeriesValue
  ) {
    const now = new Date().toISOString();
    const sessionId = `session-${Date.now()}-${workoutDayId}`;
    const exercise = getExercise(planned.exerciseId);
    const weightKg = value.weightKg ? Number(value.weightKg.replace(",", ".")) : undefined;
    const reps = Number(value.reps);

    if (!workoutDayId || !reps) {
      Alert.alert("Brak danych", "Wpisz liczbe powtorzen przed zapisem serii.");
      return;
    }

    const targetWeight = plannedSet.weightKg;
    const achieved =
      (!targetWeight || (weightKg ?? 0) >= targetWeight) && reps >= plannedSet.reps;
    const difficulty: DifficultyLevel = achieved ? "normalnie" : "ciezko";

    await saveWorkoutSession({
      id: sessionId,
      trainingGroupId: currentTrainingGroupId,
      userId: currentUserId,
      workoutDayId,
      date: now.slice(0, 10),
      sets: [
        {
          id: `set-${Date.now()}-${planned.id}-${plannedSet.setNumber}`,
          sessionId,
          exerciseId: exercise?.id ?? planned.exerciseId,
          plannedExerciseId: planned.id,
          plannedSetBlockId: plannedSet.block.id,
          setNumber: plannedSet.setNumber,
          weightKg,
          weightLabel: weightKg ? undefined : planned.suggestedWeightLabel,
          reps,
          difficulty,
          note: achieved ? undefined : `Nieosiagniete w serii ${plannedSet.setNumber}.`,
          achieved,
          targetWeightKg: targetWeight,
          targetReps: plannedSet.reps,
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    });
    await saveLastWorkoutDayId(workoutDayId);
    setSessions(await getWorkoutSessions());
    updateValue(planned, plannedSet.setNumber, { done: true });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Rozpocznij trening</Text>
        <Text style={styles.title}>{workoutDay?.name ?? "Trening"}</Text>
        <Text style={styles.subtitle}>
          Kliknij cwiczenie, uzupelnij kazda serie i zaznacz zrobione. Status
          cwiczenia zmieni kolor.
        </Text>
      </View>

      <View style={styles.list}>
        {plannedForWorkout.map((planned) => {
          const exercise = getExercise(planned.exerciseId);
          const isSelected = selectedPlannedId === planned.id;
          const status = getExerciseStatus(planned, seriesValues);
          const topWeight = getSuggestedTopWeight(planned, sessions);
          const expandedSets = expandSetBlocks(planned, topWeight);

          return (
            <View
              key={planned.id}
              style={[
                styles.exerciseCard,
                status === "partial" && styles.partialCard,
                status === "done" && styles.doneCard,
                isSelected && styles.selectedCard
              ]}
            >
              <Pressable
                onPress={() => setSelectedPlannedId(isSelected ? undefined : planned.id)}
                style={styles.exerciseTop}
              >
                <View style={styles.orderBadge}>
                  <Text style={styles.orderText}>{planned.order}</Text>
                </View>
                <View style={styles.exerciseText}>
                  <Text style={styles.exerciseName}>
                    {exercise?.name ?? "Cwiczenie"}
                  </Text>
                  <Text style={styles.exercisePlan}>
                    {summarizeSetBlocks(planned)}
                  </Text>
                </View>
                <Text style={styles.weightBadge}>
                  {topWeight ? `${topWeight} kg` : planned.suggestedWeightLabel}
                </Text>
              </Pressable>

              {isSelected ? (
                <View style={styles.seriesPanel}>
                  {expandedSets.map((plannedSet) => {
                    const value = getValue(planned, plannedSet.setNumber);

                    return (
                      <View key={plannedSet.setNumber} style={styles.seriesRow}>
                        <View style={styles.seriesHeader}>
                          <Text style={styles.seriesTitle}>
                            Seria {plannedSet.setNumber}
                          </Text>
                          <Text style={styles.seriesMeta}>
                            {plannedSet.block.type === "warmup"
                              ? "rozgrzewka"
                              : "docelowa"}
                          </Text>
                        </View>

                        <View style={styles.inputRow}>
                          <View style={styles.inputBox}>
                            <Text style={styles.label}>Kg</Text>
                            <TextInput
                              keyboardType="decimal-pad"
                              onChangeText={(weightKg) =>
                                updateValue(planned, plannedSet.setNumber, {
                                  weightKg,
                                  done: false
                                })
                              }
                              style={styles.input}
                              value={value.weightKg}
                            />
                          </View>
                          <View style={styles.inputBox}>
                            <Text style={styles.label}>Powt.</Text>
                            <TextInput
                              keyboardType="number-pad"
                              onChangeText={(reps) =>
                                updateValue(planned, plannedSet.setNumber, {
                                  reps,
                                  done: false
                                })
                              }
                              style={styles.input}
                              value={value.reps}
                            />
                          </View>
                          <PrimaryButton
                            onPress={() => {
                              if (value.done) {
                                updateValue(planned, plannedSet.setNumber, {
                                  done: false
                                });
                                return;
                              }

                              saveSingleSet(planned, plannedSet, value);
                            }}
                            title={value.done ? "OK" : "Zrobione"}
                            variant={value.done ? "primary" : "secondary"}
                            style={styles.doneButton}
                          />
                        </View>
                      </View>
                    );
                  })}

                  <PrimaryButton
                    onPress={() =>
                      exercise &&
                      navigation.navigate("ExerciseDetails", {
                        exerciseId: exercise.id
                      })
                    }
                    title="Historia"
                    variant="secondary"
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <PrimaryButton onPress={() => navigation.navigate("Home")} title="Koniec" />
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
  doneButton: {
    alignSelf: "flex-end",
    minHeight: 52,
    minWidth: 76
  },
  doneCard: {
    borderColor: colors.success,
    backgroundColor: "rgba(74, 222, 128, 0.1)"
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14
  },
  exerciseName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  exercisePlan: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3
  },
  exerciseText: {
    flex: 1
  },
  exerciseTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
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
  input: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    minHeight: 52,
    paddingHorizontal: 12
  },
  inputBox: {
    flex: 1
  },
  inputRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
    textTransform: "uppercase"
  },
  list: {
    gap: 10
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
  partialCard: {
    borderColor: colors.blue,
    backgroundColor: "rgba(96, 165, 250, 0.1)"
  },
  selectedCard: {
    borderColor: colors.primary
  },
  seriesHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  seriesMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  seriesPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    marginTop: 14,
    paddingTop: 14
  },
  seriesRow: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  seriesTitle: {
    color: colors.text,
    fontSize: 15,
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
  },
  weightBadge: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  }
});
