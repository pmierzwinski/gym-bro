import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  mockCoachSuggestions,
  mockExercises,
  mockPlannedExercises,
  mockWorkoutDays,
  mockWorkoutSessions
} from "../data/mockData";
import type {
  CoachSuggestion,
  Exercise,
  PlannedExercise,
  WorkoutDay,
  WorkoutSession
} from "../types/training";

const STORAGE_KEYS = {
  exercises: "gym-bro:exercises",
  workoutDays: "gym-bro:workout-days",
  plannedExercises: "gym-bro:planned-exercises",
  workoutSessions: "gym-bro:workout-sessions",
  coachSuggestions: "gym-bro:coach-suggestions",
  lastWorkoutDayId: "gym-bro:last-workout-day-id"
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    await AsyncStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  return JSON.parse(rawValue) as T;
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getExercises(): Promise<Exercise[]> {
  return readJson<Exercise[]>(STORAGE_KEYS.exercises, mockExercises);
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  const exercises = await getExercises();
  const existingIndex = exercises.findIndex((item) => item.id === exercise.id);
  const nextExercises =
    existingIndex >= 0
      ? exercises.map((item) => (item.id === exercise.id ? exercise : item))
      : [...exercises, exercise];

  await writeJson(STORAGE_KEYS.exercises, nextExercises);
}

export async function getWorkoutDays(): Promise<WorkoutDay[]> {
  return readJson<WorkoutDay[]>(STORAGE_KEYS.workoutDays, mockWorkoutDays);
}

export async function saveWorkoutDay(day: WorkoutDay): Promise<void> {
  const days = await getWorkoutDays();
  const nextDays = days.some((item) => item.id === day.id)
    ? days.map((item) => (item.id === day.id ? day : item))
    : [...days, day];

  await writeJson(STORAGE_KEYS.workoutDays, nextDays);
}

export async function deleteWorkoutDay(workoutDayId: string): Promise<void> {
  const [days, plannedExercises, lastWorkoutDayId] = await Promise.all([
    getWorkoutDays(),
    getPlannedExercises(),
    getLastWorkoutDayId()
  ]);

  await writeJson(
    STORAGE_KEYS.workoutDays,
    days.filter((day) => day.id !== workoutDayId)
  );
  await writeJson(
    STORAGE_KEYS.plannedExercises,
    plannedExercises.filter((planned) => planned.workoutDayId !== workoutDayId)
  );

  if (lastWorkoutDayId === workoutDayId) {
    await AsyncStorage.removeItem(STORAGE_KEYS.lastWorkoutDayId);
  }
}

export async function getPlannedExercises(): Promise<PlannedExercise[]> {
  return readJson<PlannedExercise[]>(
    STORAGE_KEYS.plannedExercises,
    mockPlannedExercises
  );
}

export async function savePlannedExercises(
  plannedExercises: PlannedExercise[]
): Promise<void> {
  await writeJson(STORAGE_KEYS.plannedExercises, plannedExercises);
}

export async function getLastWorkoutDayId(): Promise<string | undefined> {
  const lastWorkoutDayId = await AsyncStorage.getItem(STORAGE_KEYS.lastWorkoutDayId);
  return lastWorkoutDayId ?? undefined;
}

export async function saveLastWorkoutDayId(workoutDayId: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.lastWorkoutDayId, workoutDayId);
}

export async function getWorkoutSessions(): Promise<WorkoutSession[]> {
  return readJson<WorkoutSession[]>(STORAGE_KEYS.workoutSessions, mockWorkoutSessions);
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
  const sessions = await getWorkoutSessions();
  const existingIndex = sessions.findIndex((item) => item.id === session.id);
  const nextSessions =
    existingIndex >= 0
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [...sessions, session];

  await writeJson(STORAGE_KEYS.workoutSessions, nextSessions);
}

export async function getCoachSuggestions(): Promise<CoachSuggestion[]> {
  return readJson<CoachSuggestion[]>(
    STORAGE_KEYS.coachSuggestions,
    mockCoachSuggestions
  );
}

export async function saveCoachSuggestion(
  suggestion: CoachSuggestion
): Promise<void> {
  const suggestions = await getCoachSuggestions();
  const existingIndex = suggestions.findIndex((item) => item.id === suggestion.id);
  const nextSuggestions =
    existingIndex >= 0
      ? suggestions.map((item) => (item.id === suggestion.id ? suggestion : item))
      : [...suggestions, suggestion];

  await writeJson(STORAGE_KEYS.coachSuggestions, nextSuggestions);
}
