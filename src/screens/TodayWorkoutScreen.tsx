import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect, CommonActions } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { currentTrainingGroupId, currentUserId } from "../data/mockData";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getPlannedExercises,
  getExercises,
  getWorkoutDays,
  getWorkoutSessions,
  saveLastWorkoutDayId,
  savePlannedExercises,
  saveWorkoutSession,
  setWorkoutFailurePrompt
} from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import { type as t } from "../theme/typography";
import type {
  DifficultyLevel,
  Exercise,
  ExerciseSet,
  PlannedExercise,
  WorkoutDay,
  WorkoutSession
} from "../types/training";
import {
  applyPlannedDeloadForNextSession,
  applyPlannedProgressForNextSession,
  expandSetBlocks,
  flattenSetsFromIncompleteSessionsToday,
  getExerciseSessionOutcome,
  getSuggestedTopWeight,
  sessionsForBaselineWeight,
  summarizeSetBlocks
} from "../utils/workout";

type Props = Readonly<NativeStackScreenProps<RootStackParamList, "TodayWorkout">>;
type SeriesValue = { weightKg: string; reps: string; done: boolean };
type SeriesValues = Record<string, SeriesValue>;

type FailureSummary = Readonly<{
  planned: PlannedExercise;
  name: string;
}>;

function getSeriesKey(plannedId: string, setNumber: number) {
  return `${plannedId}:${setNumber}`;
}

function collectFailureSummaries(
  plannedForWorkout: PlannedExercise[],
  allSessions: WorkoutSession[],
  workoutDayId: string,
  sessionDate: string,
  userId: string,
  resolveExercise: (exerciseId: string) => Exercise | undefined
): FailureSummary[] {
  const todaySets = flattenSetsFromIncompleteSessionsToday(
    allSessions,
    workoutDayId,
    sessionDate,
    userId
  );
  const failures: FailureSummary[] = [];

  for (const planned of plannedForWorkout) {
    const sets = todaySets.filter((set) => set.plannedExerciseId === planned.id);
    const outcome = getExerciseSessionOutcome(planned, sets);
    if (outcome === "failure" || outcome === "none") {
      failures.push({
        planned,
        name: resolveExercise(planned.exerciseId)?.name ?? "Cwiczenie"
      });
    }
  }

  return failures;
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

function failurePromptBody(names: string) {
  return `Nie udalo sie poprawnie zrobic: ${names}. Czy chcesz cofnac sie w treningach?`;
}

type EndWorkoutFailureModalState = Readonly<{
  failures: FailureSummary[];
  plannedAll: PlannedExercise[];
  names: string;
}>;

function resetNavigationToHome(navigation: Props["navigation"]) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Home" }]
    })
  );
}

export function TodayWorkoutScreen({ navigation, route }: Props) {
  const [workoutSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedPlannedId, setSelectedPlannedId] = useState<string>();
  const [seriesValues, setSeriesValues] = useState<SeriesValues>({});
  const suppressExitGuardRef = useRef(false);
  const [endWorkoutFailureModal, setEndWorkoutFailureModal] =
    useState<EndWorkoutFailureModalState | null>(null);

  useFocusEffect(
    useCallback(() => {
      suppressExitGuardRef.current = false;
      let isActive = true;

      async function loadData() {
        const [loadedWorkoutDays, loadedPlannedExercises, loadedExercises, loadedSessions] =
          await Promise.all([
            getWorkoutDays(),
            getPlannedExercises(),
            getExercises(),
            getWorkoutSessions()
          ]);

        if (!isActive) {
          return;
        }

        setWorkoutDays(loadedWorkoutDays);
        setPlannedExercises(loadedPlannedExercises);
        setExercises(loadedExercises);
        setSessions(loadedSessions);

        const dayId =
          route.params?.workoutDayId ?? loadedWorkoutDays[0]?.id;

        if (!dayId) {
          setSeriesValues({});
          return;
        }

        const plannedList = loadedPlannedExercises
          .filter((planned) => planned.workoutDayId === dayId)
          .sort((a, b) => a.order - b.order);

        const userSess = loadedSessions.filter(
          (session) => session.userId === currentUserId
        );
        const baseline = sessionsForBaselineWeight(
          userSess,
          dayId,
          workoutSessionDate,
          currentUserId
        );
        const todaySets = flattenSetsFromIncompleteSessionsToday(
          loadedSessions,
          dayId,
          workoutSessionDate,
          currentUserId
        );

        const restored: SeriesValues = {};

        for (const planned of plannedList) {
          const topWeight = getSuggestedTopWeight(planned, baseline);
          const expanded = expandSetBlocks(planned, topWeight);

          for (const plannedSet of expanded) {
            const saved = todaySets.find(
              (set) =>
                set.plannedExerciseId === planned.id &&
                set.setNumber === plannedSet.setNumber
            );

            if (saved) {
              restored[getSeriesKey(planned.id, plannedSet.setNumber)] = {
                weightKg:
                  saved.weightKg !== undefined && saved.weightKg !== null
                    ? String(saved.weightKg)
                    : "",
                reps: String(saved.reps),
                done: true
              };
            }
          }
        }

        setSeriesValues(restored);
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [route.params?.workoutDayId, workoutSessionDate])
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

  const userSessions = useMemo(
    () => sessions.filter((session) => session.userId === currentUserId),
    [sessions]
  );

  const baselineSessions = useMemo(
    () =>
      sessionsForBaselineWeight(
        userSessions,
        workoutDayId,
        workoutSessionDate,
        currentUserId
      ),
    [userSessions, workoutDayId, workoutSessionDate]
  );

  function getExercise(exerciseId: string) {
    return exercises.find((exercise) => exercise.id === exerciseId);
  }

  function getInitialSeriesValue(planned: PlannedExercise, setNumber: number) {
    const topWeight = getSuggestedTopWeight(planned, baselineSessions);
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

    const allSessions = await getWorkoutSessions();
    const existingSession = allSessions.find(
      (session) =>
        session.userId === currentUserId &&
        session.workoutDayId === workoutDayId &&
        session.date === workoutSessionDate &&
        session.completed !== true
    );
    const sessionIdToUse =
      existingSession?.id ??
      `session-${workoutDayId}-${workoutSessionDate}-${Date.now()}`;

    const baseSession: WorkoutSession =
      existingSession ?? {
        id: sessionIdToUse,
        trainingGroupId: currentTrainingGroupId,
        userId: currentUserId,
        workoutDayId,
        date: workoutSessionDate,
        sets: [],
        completed: false,
        createdAt: now,
        updatedAt: now
      };

    const newSet: ExerciseSet = {
      id: `set-${Date.now()}-${planned.id}-${plannedSet.setNumber}`,
      sessionId: sessionIdToUse,
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
    };

    const mergedSets = [
      ...baseSession.sets.filter(
        (set) =>
          !(
            set.plannedExerciseId === planned.id &&
            set.setNumber === plannedSet.setNumber
          )
      ),
      newSet
    ];

    await saveWorkoutSession({
      ...baseSession,
      sets: mergedSets,
      completed: baseSession.completed ?? false,
      updatedAt: now
    });
    await saveLastWorkoutDayId(workoutDayId);
    setSessions(await getWorkoutSessions());
    updateValue(planned, plannedSet.setNumber, { done: true });
  }

  async function saveAllSetsForExercise(
    planned: PlannedExercise,
    expandedSets: ReturnType<typeof expandSetBlocks>
  ) {
    for (const plannedSet of expandedSets) {
      const value = getValue(planned, plannedSet.setNumber);
      if (value.done) {
        continue;
      }

      let repsStr = value.reps?.trim() ?? "";
      if (!repsStr && plannedSet.reps != null) {
        repsStr = String(plannedSet.reps);
      }
      const weightStr =
        value.weightKg?.trim() ||
        (plannedSet.weightKg != null ? String(plannedSet.weightKg) : "");

      const merged: SeriesValue = {
        weightKg: weightStr,
        reps: repsStr,
        done: false
      };

      if (!Number(repsStr)) {
        Alert.alert(
          "Brak danych",
          `Uzupelnij liczbe powtorzen dla serii ${plannedSet.setNumber}.`
        );
        return;
      }

      await saveSingleSet(planned, plannedSet, merged);
    }
  }

  async function markTodaySessionCompleted() {
    if (!workoutDayId) {
      return;
    }

    const now = new Date().toISOString();
    const allSessions = await getWorkoutSessions();
    const session = allSessions.find(
      (entry) =>
        entry.userId === currentUserId &&
        entry.workoutDayId === workoutDayId &&
        entry.date === workoutSessionDate &&
        entry.completed !== true
    );

    if (!session) {
      return;
    }

    await saveWorkoutSession({
      ...session,
      completed: true,
      updatedAt: now
    });
    setSessions(await getWorkoutSessions());
  }

  async function leaveWorkoutAfterKoniec() {
    setEndWorkoutFailureModal(null);
    suppressExitGuardRef.current = true;
    await markTodaySessionCompleted();
    setSeriesValues({});
    resetNavigationToHome(navigation);
  }

  async function confirmEndWorkoutDeload(modal: EndWorkoutFailureModalState) {
    try {
      const next = modal.plannedAll.map((planned) =>
        modal.failures.some((failure) => failure.planned.id === planned.id)
          ? applyPlannedDeloadForNextSession(planned)
          : planned
      );
      await savePlannedExercises(next);
      await setWorkoutFailurePrompt(undefined);
      const [refreshedPlanned, refreshedSessions] = await Promise.all([
        getPlannedExercises(),
        getWorkoutSessions()
      ]);
      setPlannedExercises(refreshedPlanned);
      setSessions(refreshedSessions);
      await leaveWorkoutAfterKoniec();
    } catch (error) {
      console.error(error);
      Alert.alert("Blad", "Nie udalo sie zapisac deload i zamknac treningu.");
    }
  }

  async function confirmEndWorkoutKeepPlan(modal: EndWorkoutFailureModalState) {
    try {
      await savePlannedExercises(modal.plannedAll);
      await setWorkoutFailurePrompt({
        plannedIds: modal.failures.map((item) => item.planned.id),
        exerciseNames: modal.failures.map((item) => item.name)
      });
      const [refreshedPlanned, refreshedSessions] = await Promise.all([
        getPlannedExercises(),
        getWorkoutSessions()
      ]);
      setPlannedExercises(refreshedPlanned);
      setSessions(refreshedSessions);
      await leaveWorkoutAfterKoniec();
    } catch (error) {
      console.error(error);
      Alert.alert("Blad", "Nie udalo sie zapisac planu i zamknac treningu.");
    }
  }

  async function handleWorkoutKoniec() {
    try {
      if (!workoutDayId) {
        suppressExitGuardRef.current = true;
        resetNavigationToHome(navigation);
        return;
      }

      const allSessions = await getWorkoutSessions();
      const failures = collectFailureSummaries(
        plannedForWorkout,
        allSessions,
        workoutDayId,
        workoutSessionDate,
        currentUserId,
        getExercise
      );

      let plannedAll = await getPlannedExercises();
      const todaySets = flattenSetsFromIncompleteSessionsToday(
        allSessions,
        workoutDayId,
        workoutSessionDate,
        currentUserId
      );

      const successIds = new Set<string>();
      for (const planned of plannedForWorkout) {
        const sets = todaySets.filter((set) => set.plannedExerciseId === planned.id);
        if (getExerciseSessionOutcome(planned, sets) === "success") {
          successIds.add(planned.id);
        }
      }

      plannedAll = plannedAll.map((planned) =>
        successIds.has(planned.id)
          ? applyPlannedProgressForNextSession(planned)
          : planned
      );

      if (failures.length === 0) {
        await savePlannedExercises(plannedAll);
        await setWorkoutFailurePrompt(undefined);
        const [refreshedPlanned, refreshedSessions] = await Promise.all([
          getPlannedExercises(),
          getWorkoutSessions()
        ]);
        setPlannedExercises(refreshedPlanned);
        setSessions(refreshedSessions);
        await leaveWorkoutAfterKoniec();
        return;
      }

      const names = failures.map((item) => item.name).join(", ");

      setEndWorkoutFailureModal({
        failures,
        plannedAll,
        names
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Blad", "Nie udalo sie zakonczyc treningu. Sprobuj ponownie.");
    }
  }

  useEffect(() => {
    if (Platform.OS === "web") {
      return undefined;
    }

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (suppressExitGuardRef.current) {
        return;
      }

      if (!workoutDayId) {
        return;
      }

      const failures = collectFailureSummaries(
        plannedForWorkout,
        sessions,
        workoutDayId,
        workoutSessionDate,
        currentUserId,
        (exerciseId) => exercises.find((exercise) => exercise.id === exerciseId)
      );

      if (failures.length === 0) {
        return;
      }

      event.preventDefault();

      const action = event.data.action;
      const names = failures.map((item) => item.name).join(", ");

      Alert.alert("Trening", failurePromptBody(names), [
        { text: "Zostan", style: "cancel" },
        {
          text: "Wyjdz",
          onPress: () => {
            void (async () => {
              await setWorkoutFailurePrompt({
                plannedIds: failures.map((item) => item.planned.id),
                exerciseNames: failures.map((item) => item.name)
              });
              suppressExitGuardRef.current = true;
              navigation.dispatch(action);
            })();
          }
        },
        {
          text: "Cofnij i wyjdz",
          onPress: () => {
            void (async () => {
              let plannedAll = await getPlannedExercises();
              plannedAll = plannedAll.map((planned) =>
                failures.some((failure) => failure.planned.id === planned.id)
                  ? applyPlannedDeloadForNextSession(planned)
                  : planned
              );
              await savePlannedExercises(plannedAll);
              await setWorkoutFailurePrompt(undefined);
              suppressExitGuardRef.current = true;
              navigation.dispatch(action);
            })();
          }
        }
      ]);
    });

    return unsubscribe;
  }, [
    navigation,
    workoutDayId,
    workoutSessionDate,
    plannedForWorkout,
    sessions,
    exercises
  ]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Rozpocznij trening</Text>
          <Text style={styles.title}>{workoutDay?.name ?? "Trening"}</Text>
          <Text style={styles.subtitle}>
            Cele kg docelowe w sesji bez zmian. Po Koniec plan aktualizuje nastepny raz.
            Rozgrzewki — niebieski kafelek.
          </Text>
        </View>

        <View style={styles.list}>
          {plannedForWorkout.map((planned) => {
            const exercise = getExercise(planned.exerciseId);
            const isSelected = selectedPlannedId === planned.id;
            const status = getExerciseStatus(planned, seriesValues);
            const topWeight = getSuggestedTopWeight(planned, baselineSessions);
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
                  onPress={() =>
                    setSelectedPlannedId(isSelected ? undefined : planned.id)
                  }
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
                    <PrimaryButton
                      onPress={() => void saveAllSetsForExercise(planned, expandedSets)}
                      title="Zrobione — całe ćwiczenie"
                      variant="secondary"
                      style={styles.exerciseDoneAllButton}
                    />

                    {expandedSets.map((plannedSet) => {
                      const value = getValue(planned, plannedSet.setNumber);

                      return (
                        <View
                          key={plannedSet.setNumber}
                          style={[
                            styles.seriesRow,
                            plannedSet.block.type === "warmup" &&
                              styles.seriesRowWarmup
                          ]}
                        >
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
                          exerciseId: exercise.id,
                          ...(workoutDayId ? { workoutDayId } : {})
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
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton onPress={() => void handleWorkoutKoniec()} title="Koniec" />
      </View>

      {endWorkoutFailureModal ? (
        <Modal
          animationType="fade"
          onRequestClose={() => setEndWorkoutFailureModal(null)}
          transparent
          visible
        >
          <View style={styles.modalRoot}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEndWorkoutFailureModal(null)}
              style={styles.modalBackdrop}
            />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Trening</Text>
              <Text style={styles.modalBody}>
                {failurePromptBody(endWorkoutFailureModal.names)}
              </Text>
              <View style={styles.modalActions}>
                <PrimaryButton
                  onPress={() => setEndWorkoutFailureModal(null)}
                  title="Anuluj"
                  variant="secondary"
                />
                <PrimaryButton
                  onPress={() =>
                    void confirmEndWorkoutKeepPlan(endWorkoutFailureModal)
                  }
                  title="Nie"
                  variant="secondary"
                />
                <PrimaryButton
                  onPress={() =>
                    void confirmEndWorkoutDeload(endWorkoutFailureModal)
                  }
                  title="Tak, cofnij"
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    elevation: 8,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 12,
    zIndex: 10
  },
  modalActions: {
    gap: 10,
    marginTop: 4
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 10, 18, 0.82)"
  },
  modalBody: {
    color: colors.muted,
    fontSize: t.body,
    lineHeight: t.lineCaption
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: "92%",
    zIndex: 2
  },
  modalRoot: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  modalTitle: {
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "900"
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    gap: 16,
    padding: 18,
    paddingBottom: 16
  },
  doneButton: {
    alignSelf: "flex-end",
    minHeight: 46,
    minWidth: 72
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
    fontSize: t.subtitle,
    fontWeight: "900"
  },
  exercisePlan: {
    color: colors.muted,
    fontSize: t.caption,
    lineHeight: t.lineCaption,
    marginTop: 3
  },
  exerciseText: {
    flex: 1,
    minWidth: 0
  },
  exerciseTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
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
  input: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "900",
    minHeight: 46,
    paddingHorizontal: 10
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
    fontSize: t.chartLabel,
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
    fontSize: t.caption,
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
    fontSize: t.chartLabel,
    fontWeight: "800"
  },
  seriesPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    marginTop: 14,
    paddingTop: 14
  },
  exerciseDoneAllButton: {
    alignSelf: "stretch"
  },
  seriesRow: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  seriesRowWarmup: {
    backgroundColor: "rgba(96, 165, 250, 0.14)",
    borderColor: colors.blue
  },
  seriesTitle: {
    color: colors.text,
    fontSize: t.body,
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
  },
  weightBadge: {
    color: colors.primary,
    flexShrink: 0,
    fontSize: t.body,
    fontWeight: "900",
    maxWidth: "42%",
    textAlign: "right"
  }
});
