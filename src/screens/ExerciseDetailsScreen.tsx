import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { currentUserId } from "../data/mockData";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getExercises,
  getWorkoutDays,
  getWorkoutSessions
} from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import type {
  Exercise,
  ExerciseSet,
  WorkoutDay,
  WorkoutSession
} from "../types/training";

type Props = Readonly<
  NativeStackScreenProps<RootStackParamList, "ExerciseDetails">
>;

type HistoryItem = ExerciseSet & {
  date: string;
  workoutDayId?: string;
};

function formatWeight(set: ExerciseSet) {
  return set.weightKg ? `${set.weightKg} kg` : set.weightLabel ?? "masa ciala";
}

function formatResult(set?: ExerciseSet) {
  if (!set) {
    return "brak";
  }

  return `${formatWeight(set)} x ${set.reps}`;
}

export function ExerciseDetailsScreen({ route }: Props) {
  const [exercise, setExercise] = useState<Exercise>();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [loadedExercises, loadedSessions, loadedWorkoutDays] = await Promise.all([
          getExercises(),
          getWorkoutSessions(),
          getWorkoutDays()
        ]);

        if (isActive) {
          setExercise(
            loadedExercises.find((item) => item.id === route.params.exerciseId)
          );
          setSessions(
            loadedSessions.filter((session) => session.userId === currentUserId)
          );
          setWorkoutDays(loadedWorkoutDays);
        }
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [route.params.exerciseId])
  );

  const history = useMemo<HistoryItem[]>(
    () =>
      sessions
        .flatMap((session) =>
          session.sets
            .filter((set) => set.exerciseId === route.params.exerciseId)
            .map((set) => ({
              ...set,
              date: session.date,
              workoutDayId: session.workoutDayId
            }))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [route.params.exerciseId, sessions]
  );

  const lastSet = history[0];
  const bestSet = [...history].sort((a, b) => {
    const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
    if (weightDiff === 0) {
      return b.reps - a.reps;
    }

    return weightDiff;
  })[0];
  const sessionsWithExercise = useMemo(
    () =>
      sessions
        .filter((session) =>
          session.sets.some((set) => set.exerciseId === route.params.exerciseId)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [route.params.exerciseId, sessions]
  );
  const chartData = useMemo(
    () =>
      sessionsWithExercise
        .slice()
        .reverse()
        .map((session) => {
          const bestWeight = Math.max(
            ...session.sets
              .filter((set) => set.exerciseId === route.params.exerciseId)
              .map((set) => set.weightKg ?? 0)
          );

          return {
            date: session.date,
            weight: bestWeight
          };
        })
        .filter((item) => item.weight > 0)
        .slice(-8),
    [route.params.exerciseId, sessionsWithExercise]
  );
  const maxChartWeight = Math.max(...chartData.map((item) => item.weight), 1);

  function getWorkoutName(workoutDayId?: string) {
    return (
      workoutDays.find((workoutDay) => workoutDay.id === workoutDayId)?.name ??
      "Trening"
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{exercise?.name ?? "Cwiczenie"}</Text>
        <Text style={styles.subtitle}>{exercise?.muscleGroup}</Text>
        {exercise?.techniqueDescription ? (
          <Text style={styles.description}>{exercise.techniqueDescription}</Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Ostatni wynik</Text>
          <Text style={styles.statValue}>{formatResult(lastSet)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Najlepszy wynik</Text>
          <Text style={styles.statValue}>{formatResult(bestSet)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Progres</Text>
      <View style={styles.chartCard}>
        {chartData.length === 0 ? (
          <Text style={styles.emptyText}>Brak danych do wykresu.</Text>
        ) : (
          <View style={styles.chartRow}>
            {chartData.map((item) => (
              <View key={`${item.date}-${item.weight}`} style={styles.chartItem}>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: `${Math.max(12, (item.weight / maxChartWeight) * 100)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.chartValue}>{item.weight}</Text>
                <Text style={styles.chartDate}>{item.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Treningi</Text>
      <View style={styles.list}>
        {sessionsWithExercise.map((session) => {
          const sets = session.sets.filter(
            (set) => set.exerciseId === route.params.exerciseId
          );

          return (
            <View key={session.id} style={styles.historyCard}>
              <Text style={styles.historyDate}>
                Data: {session.date} · Trening: {getWorkoutName(session.workoutDayId)}
              </Text>
              <Text style={styles.historyMain}>
                {sets.length} serii · najlepsza {formatResult(
                  [...sets].sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0]
                )}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Historia</Text>
      <View style={styles.list}>
        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Brak zapisanych serii dla tego cwiczenia.</Text>
          </View>
        ) : (
          history.map((set) => (
            <View key={set.id} style={styles.historyCard}>
              <View>
                <Text style={styles.historyDate}>{set.date}</Text>
                <Text style={styles.historyMain}>
                  Seria {set.setNumber}: {formatWeight(set)} x {set.reps}
                </Text>
              </View>
              <Text style={styles.difficulty}>{set.difficulty}</Text>
              {set.note ? <Text style={styles.note}>{set.note}</Text> : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: 18,
    padding: 18,
    paddingBottom: 32
  },
  chartBar: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    width: "100%"
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16
  },
  chartDate: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4
  },
  chartItem: {
    alignItems: "center",
    flex: 1
  },
  chartRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    height: 132
  },
  chartTrack: {
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    height: 86,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: 16
  },
  chartValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 6
  },
  description: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10
  },
  difficulty: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18
  },
  emptyText: {
    color: colors.muted,
    fontSize: 16
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16
  },
  historyDate: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  historyMain: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4
  },
  list: {
    gap: 10
  },
  note: {
    color: colors.muted,
    fontSize: 15
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    flex: 1,
    padding: 16
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6
  },
  statsRow: {
    flexDirection: "row",
    gap: 10
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginTop: 4,
    textTransform: "capitalize"
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  }
});
