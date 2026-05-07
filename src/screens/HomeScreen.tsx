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
import { currentUserId } from "../data/mockData";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getExercises,
  getLastWorkoutDayId,
  getPlannedExercises,
  getWorkoutDays,
  getWorkoutFailurePrompt,
  getWorkoutSessions,
  savePlannedExercises,
  setWorkoutFailurePrompt
} from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import { type as t } from "../theme/typography";
import type {
  Exercise,
  PlannedExercise,
  WorkoutDay,
  WorkoutSession
} from "../types/training";
import { applyPlannedDeloadForNextSession } from "../utils/workout";

type Props = Readonly<NativeStackScreenProps<RootStackParamList, "Home">>;

export function HomeScreen({ navigation }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [lastWorkoutDayId, setLastWorkoutDayId] = useState<string>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedWorkoutDayId, setSelectedWorkoutDayId] = useState<string>();
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [
          loadedExercises,
          loadedWorkoutDays,
          loadedPlannedExercises,
          loadedSessions,
          loadedLastWorkoutDayId
        ] = await Promise.all([
          getExercises(),
          getWorkoutDays(),
          getPlannedExercises(),
          getWorkoutSessions(),
          getLastWorkoutDayId()
        ]);

        if (isActive) {
          setExercises(loadedExercises);
          setWorkoutDays(loadedWorkoutDays);
          setPlannedExercises(loadedPlannedExercises);
          setSessions(
            loadedSessions.filter((session) => session.userId === currentUserId)
          );
          setLastWorkoutDayId(loadedLastWorkoutDayId);
        }

        const prompt = await getWorkoutFailurePrompt();

        if (!isActive || !prompt) {
          return;
        }

        Alert.alert(
          "Trening",
          `Nie udalo sie zrobic cwiczen: ${prompt.exerciseNames.join(", ")}. Czy chcesz cofnac sie w treningach?`,
          [
            {
              text: "Zostaw plan",
              onPress: () => {
                void setWorkoutFailurePrompt(undefined);
              }
            },
            {
              text: "Cofnij obciazenia",
              onPress: async () => {
                const planned = await getPlannedExercises();
                const next = planned.map((entry) =>
                  prompt.plannedIds.includes(entry.id)
                    ? applyPlannedDeloadForNextSession(entry)
                    : entry
                );
                await savePlannedExercises(next);
                await setWorkoutFailurePrompt(undefined);
                setPlannedExercises(await getPlannedExercises());
              }
            }
          ]
        );
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const lastSession = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.workoutDayId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [sessions]
  );
  const actualLastWorkoutDayId = lastWorkoutDayId ?? lastSession?.workoutDayId;
  const lastWorkout = workoutDays.find((day) => day.id === actualLastWorkoutDayId);
  const recencyByWorkoutId = useMemo(() => {
    const map = new Map<string, string>();

    sessions.forEach((session) => {
      if (!session.workoutDayId) {
        return;
      }

      const current = map.get(session.workoutDayId);
      if (!current || session.createdAt > current) {
        map.set(session.workoutDayId, session.createdAt);
      }
    });

    return map;
  }, [sessions]);
  const sortedWorkoutDays = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...workoutDays]
      .filter((day) => day.name.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => {
        const aDate = recencyByWorkoutId.get(a.id) ?? "";
        const bDate = recencyByWorkoutId.get(b.id) ?? "";

        if (aDate !== bDate) {
          return bDate.localeCompare(aDate);
        }

        return a.dayNumber - b.dayNumber;
      });
  }, [recencyByWorkoutId, search, workoutDays]);
  const nextWorkout = useMemo(() => {
    if (!workoutDays.length) {
      return undefined;
    }

    const lastIndex = workoutDays.findIndex(
      (day) => day.id === actualLastWorkoutDayId
    );

    return workoutDays[(lastIndex + 1 + workoutDays.length) % workoutDays.length];
  }, [actualLastWorkoutDayId, workoutDays]);
  function getWorkoutSummary(day: WorkoutDay) {
    const plannedForDay = plannedExercises
      .filter((planned) => planned.workoutDayId === day.id)
      .sort((a, b) => a.order - b.order);

    return plannedForDay
      .slice(0, 3)
      .map((planned) => {
        const exercise = exercises.find((item) => item.id === planned.exerciseId);
        const blocks = planned.setBlocks?.length
          ? planned.setBlocks
              .map((block) => `${block.setsCount}x${block.reps}`)
              .join("+")
          : `${planned.suggestedSets}x${planned.suggestedReps ?? planned.suggestedRepsLabel ?? "?"}`;
        return `${exercise?.name ?? "Cwiczenie"} ${blocks}`;
      })
      .join(" · ");
  }

  function getBadgeLabel(day: WorkoutDay, index: number) {
    if (index === 0 && day.id === lastWorkout?.id) {
      return "ostatni";
    }

    if (day.id === nextWorkout?.id) {
      return "sugerowany";
    }

    return undefined;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroTitles}>
            <Text style={styles.eyebrow}>Gym Bro</Text>
            <Text style={styles.title}>Wybierz trening</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityLabel="Dodaj trening"
              onPress={() => navigation.navigate("WorkoutEditor", {})}
              style={({ pressed }) => [
                styles.addWorkoutTiny,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.addWorkoutTinyText}>+</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsMenuOpen((current) => !current)}
              style={styles.menuButton}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.description}>
          Startujesz od treningu. W srodku poprawiasz kg/powtorzenia i zatwierdzasz seriami.
        </Text>
      </View>

      {isMenuOpen ? (
        <View style={styles.menuPanel}>
          <PrimaryButton
            onPress={() => navigation.navigate("WorkoutPlan")}
            title="Moje treningi"
            variant="secondary"
          />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Moje treningi</Text>
      <TextInput
        onChangeText={setSearch}
        placeholder="Szukaj treningu..."
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        value={search}
      />
      <View style={styles.list}>
        {sortedWorkoutDays.map((day, index) => {
          const plannedForDay = plannedExercises
            .filter((planned) => planned.workoutDayId === day.id)
            .sort((a, b) => a.order - b.order);
          const isSelected = selectedWorkoutDayId === day.id;
          const badgeLabel = getBadgeLabel(day, index);

          return (
          <Pressable
            key={day.id}
            onPress={() => setSelectedWorkoutDayId(isSelected ? undefined : day.id)}
            style={({ pressed }) => [
              styles.workoutCard,
              isSelected && styles.selectedWorkoutCard,
              pressed && styles.pressed
            ]}
          >
            <View style={styles.workoutHeader}>
              <View>
                <Text style={styles.workoutName}>{day.name}</Text>
                <Text style={styles.workoutMeta}>
                  {plannedForDay.length} cwiczenia
                  {day.id === lastWorkout?.id ? " · ostatnio robiony" : ""}
                </Text>
              </View>
              {badgeLabel ? (
                <Text style={styles.badge}>{badgeLabel}</Text>
              ) : null}
            </View>
            <Text style={styles.workoutSummary} numberOfLines={4}>
              {getWorkoutSummary(day)}
            </Text>

            {isSelected ? (
              <View style={styles.previewPanel}>
                {plannedForDay.map((planned) => {
                  const exercise = exercises.find(
                    (item) => item.id === planned.exerciseId
                  );

                  return (
                    <View key={planned.id} style={styles.previewRow}>
                      <Text style={styles.previewName}>
                        {planned.order}. {exercise?.name ?? "Cwiczenie"}
                      </Text>
                      <Text style={styles.previewMeta}>
                        {planned.suggestedWeightKg
                          ? `${planned.suggestedWeightKg} kg`
                          : planned.suggestedWeightLabel ?? ""}
                      </Text>
                    </View>
                  );
                })}
                <PrimaryButton
                  onPress={() =>
                    navigation.navigate("TodayWorkout", { workoutDayId: day.id })
                  }
                  title="Rozpocznij"
                />
              </View>
            ) : null}
          </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12
  },
  addWorkoutTiny: {
    alignItems: "center",
    backgroundColor: "rgba(245, 200, 76, 0.12)",
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  addWorkoutTinyText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: -2
  },
  badge: {
    backgroundColor: "rgba(245, 200, 76, 0.14)",
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primary,
    fontSize: t.caption,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: "uppercase"
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12
  },
  cardButton: {
    flex: 1,
    minHeight: 46
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
    lineHeight: t.lineBody,
    marginTop: 8
  },
  eyebrow: {
    color: colors.primary,
    fontSize: t.caption,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20
  },
  heroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  heroTitles: {
    flex: 1,
    minWidth: 0
  },
  heroActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 8
  },
  list: {
    gap: 12
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  menuIcon: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  menuPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 12
  },
  secondaryActionButton: {
    flex: 1
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: t.title,
    fontWeight: "800"
  },
  title: {
    color: colors.text,
    fontSize: t.display,
    fontWeight: "900",
    marginTop: 4
  },
  pressed: {
    opacity: 0.9
  },
  previewMeta: {
    color: colors.primary,
    fontSize: t.caption,
    fontWeight: "900"
  },
  previewName: {
    color: colors.text,
    flex: 1,
    fontSize: t.body,
    fontWeight: "800"
  },
  previewPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    marginTop: 14,
    paddingTop: 14
  },
  previewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  searchInput: {
    backgroundColor: "rgba(23, 29, 43, 0.45)",
    borderColor: "rgba(38, 48, 68, 0.55)",
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: t.body,
    minHeight: 40,
    opacity: 0.72,
    paddingHorizontal: 14
  },
  selectedWorkoutCard: {
    borderColor: colors.primary
  },
  workoutCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16
  },
  workoutHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  workoutMeta: {
    color: colors.muted,
    fontSize: t.body,
    marginTop: 4
  },
  workoutName: {
    color: colors.text,
    fontSize: t.subtitle,
    fontWeight: "900"
  },
  workoutSummary: {
    color: colors.muted,
    fontSize: t.body,
    lineHeight: t.lineCaption,
    marginTop: 12
  }
});
