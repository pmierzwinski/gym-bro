import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { LineChart } from "react-native-chart-kit";
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
import { type as t } from "../theme/typography";
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

type SessionPoint = {
  date: string;
  label: string;
  maxKg: number;
  maxReps: number;
  volumeLoad: number;
  setsCount: number;
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

function aggregateSessionForExercise(
  session: WorkoutSession,
  exerciseId: string
): Omit<SessionPoint, "date" | "label"> {
  const sets = session.sets.filter((set) => set.exerciseId === exerciseId);
  const maxKg = sets.length ? Math.max(...sets.map((set) => set.weightKg ?? 0)) : 0;
  const maxReps = sets.length ? Math.max(...sets.map((set) => set.reps)) : 0;
  const volumeLoad = sets.reduce(
    (sum, set) => sum + (set.weightKg ?? 0) * set.reps,
    0
  );

  return {
    maxKg,
    maxReps,
    volumeLoad,
    setsCount: sets.length
  };
}

export function ExerciseDetailsScreen({ route }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [exercise, setExercise] = useState<Exercise>();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);

  const workoutDayId = route.params.workoutDayId;
  const exerciseId = route.params.exerciseId;

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
          setExercise(loadedExercises.find((item) => item.id === exerciseId));
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
    }, [exerciseId])
  );

  const sessionsInScope = useMemo(
    () =>
      workoutDayId
        ? sessions.filter((session) => session.workoutDayId === workoutDayId)
        : sessions,
    [sessions, workoutDayId]
  );

  const workoutDayName = workoutDayId
    ? workoutDays.find((day) => day.id === workoutDayId)?.name
    : undefined;

  const history = useMemo<HistoryItem[]>(
    () =>
      sessionsInScope
        .flatMap((session) =>
          session.sets
            .filter((set) => set.exerciseId === exerciseId)
            .map((set) => ({
              ...set,
              date: session.date,
              workoutDayId: session.workoutDayId
            }))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [exerciseId, sessionsInScope]
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
      sessionsInScope
        .filter((session) =>
          session.sets.some((set) => set.exerciseId === exerciseId)
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [exerciseId, sessionsInScope]
  );

  const chartPoints = useMemo<SessionPoint[]>(() => {
    return sessionsWithExercise.map((session) => {
      const agg = aggregateSessionForExercise(session, exerciseId);

      return {
        date: session.date,
        label: session.date.slice(5),
        ...agg
      };
    });
  }, [exerciseId, sessionsWithExercise]);

  const useKgMetric = chartPoints.some((point) => point.maxKg > 0);

  const chartDataset = useMemo(() => {
    if (chartPoints.length === 0) {
      return { labels: [] as string[], data: [] as number[], legend: "" };
    }

    let labels = chartPoints.map((point) => point.label);
    let data = chartPoints.map((point) =>
      useKgMetric ? point.maxKg : point.maxReps
    );

    if (data.length === 1) {
      const singleLabel = labels[0] ?? "";
      const singleVal = data[0] ?? 0;
      labels = [singleLabel, singleLabel];
      data = [singleVal, singleVal];
    }

    const legend = useKgMetric
      ? "Najwyzszy ciezar w sesji (kg)"
      : "Najwiecej powtorzen w serii (bez obciazenia)";

    return { labels, data, legend };
  }, [chartPoints, useKgMetric]);

  const chartWidth = Math.min(Math.max(windowWidth - 36, 260), 560);
  const lastSession = sessionsWithExercise.at(-1);
  const lastVolume = lastSession
    ? aggregateSessionForExercise(lastSession, exerciseId).volumeLoad
    : 0;

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surfaceHigh,
    decimalPlaces: useKgMetric ? 1 : 0,
    color: (opacity = 1) => `rgba(245, 200, 76, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(154, 164, 178, ${opacity})`,
    propsForDots: {
      r: "5",
      strokeWidth: "2",
      stroke: colors.primaryDark
    },
    propsForBackgroundLines: {
      stroke: colors.border,
      strokeDasharray: ""
    }
  };

  function getWorkoutName(id?: string) {
    return workoutDays.find((workoutDay) => workoutDay.id === id)?.name ?? "Trening";
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{exercise?.name ?? "Cwiczenie"}</Text>
        <Text style={styles.subtitle}>{exercise?.muscleGroup}</Text>
        {workoutDayName ? (
          <Text style={styles.scopeHint} numberOfLines={3}>
            Zakres: trening „{workoutDayName}” — wykres i lista tylko z tego slotu.
          </Text>
        ) : null}
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

      <Text style={styles.sectionTitle}>Progres w czasie</Text>
      <View style={styles.chartCard}>
        {chartDataset.data.length === 0 ? (
          <Text style={styles.emptyText}>Brak sesji z tym cwiczeniem w wybranym zakresie.</Text>
        ) : (
          <>
            <Text style={styles.chartLegend}>{chartDataset.legend}</Text>
            <LineChart
              data={{
                labels: chartDataset.labels,
                datasets: [{ data: chartDataset.data }]
              }}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.lineChart}
              withInnerLines
              withOuterLines
              withVerticalLabels
              withHorizontalLabels
              fromZero={!useKgMetric}
            />
            {sessionsWithExercise.length > 0 ? (
              <View style={styles.chartMetaRow}>
                <View style={styles.chartMetaItem}>
                  <Text style={styles.chartMetaLabel}>Sesje na wykresie</Text>
                  <Text style={styles.chartMetaValue}>{chartPoints.length}</Text>
                </View>
                <View style={styles.chartMetaItem}>
                  <Text style={styles.chartMetaLabel}>Ostatni volumen (kg × powt.)</Text>
                  <Text style={styles.chartMetaValue}>
                    {lastVolume > 0 ? Math.round(lastVolume) : "—"}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Sesje treningowe</Text>
      <View style={styles.list}>
        {sessionsWithExercise.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Brak zapisanych sesji.</Text>
          </View>
        ) : (
          [...sessionsWithExercise]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((session) => {
              const sets = session.sets.filter(
                (set) => set.exerciseId === exerciseId
              );
              const agg = aggregateSessionForExercise(session, exerciseId);

              return (
                <View key={session.id} style={styles.historyCard}>
                  <Text style={styles.historyDate}>
                    {session.date} · {getWorkoutName(session.workoutDayId)}
                  </Text>
                  <Text style={styles.historyMain}>
                    {sets.length} serii · szczyt{" "}
                    {useKgMetric ? `${agg.maxKg} kg` : `${agg.maxReps} powt.`} · volumen{" "}
                    {agg.volumeLoad > 0 ? `${Math.round(agg.volumeLoad)}` : "—"}
                  </Text>
                  <Text style={styles.historySub}>
                    Najlepsza seria:{" "}
                    {formatResult(
                      [...sets].sort(
                        (a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0)
                      )[0]
                    )}
                  </Text>
                </View>
              );
            })
        )}
      </View>

      <Text style={styles.sectionTitle}>Historia serii</Text>
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
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    padding: 14
  },
  chartLegend: {
    color: colors.muted,
    fontSize: t.body,
    fontWeight: "700",
    lineHeight: t.lineCaption
  },
  chartMetaItem: {
    flex: 1
  },
  chartMetaLabel: {
    color: colors.muted,
    fontSize: t.chartLabel,
    fontWeight: "700"
  },
  chartMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  chartMetaValue: {
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "900",
    marginTop: 4
  },
  container: {
    backgroundColor: colors.background,
    gap: 18,
    padding: 18,
    paddingBottom: 32
  },
  description: {
    color: colors.muted,
    fontSize: t.body,
    lineHeight: t.lineCaption,
    marginTop: 10
  },
  difficulty: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    color: colors.primary,
    fontSize: t.caption,
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
    fontSize: t.body
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
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
    fontSize: t.body,
    fontWeight: "700"
  },
  historyMain: {
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "800",
    marginTop: 4
  },
  historySub: {
    color: colors.muted,
    fontSize: t.body,
    fontWeight: "600",
    marginTop: 2
  },
  lineChart: {
    borderRadius: 14,
    marginHorizontal: -4,
    paddingRight: 0
  },
  list: {
    gap: 10
  },
  note: {
    color: colors.muted,
    fontSize: t.body
  },
  scopeHint: {
    color: colors.blue,
    fontSize: t.body,
    fontWeight: "700",
    marginTop: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: t.title,
    fontWeight: "900"
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 16
  },
  statLabel: {
    color: colors.muted,
    fontSize: t.caption,
    fontWeight: "800"
  },
  statValue: {
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "900",
    marginTop: 6
  },
  statsRow: {
    flexDirection: "row",
    gap: 10
  },
  subtitle: {
    color: colors.muted,
    fontSize: t.body,
    marginTop: 4,
    textTransform: "capitalize"
  },
  title: {
    color: colors.text,
    fontSize: t.display,
    fontWeight: "900"
  }
});
