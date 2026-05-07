import { Platform } from "react-native";
import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync
} from "expo-file-system/legacy";

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
  lastWorkoutDayId: "gym-bro:last-workout-day-id",
  workoutFailurePrompt: "gym-bro:workout-failure-prompt"
};

const NATIVE_STORE_FILE = "gym-bro-persist.json";

let nativeLock = Promise.resolve();

function withNativeLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = nativeLock.then(fn);
  nativeLock = next.then(() => {}).catch(() => {});
  return next;
}

function getNativeStoreUri(): string {
  const dir = documentDirectory;
  if (!dir) {
    throw new Error("expo-file-system: brak documentDirectory");
  }

  return `${dir}${NATIVE_STORE_FILE}`;
}

async function readNativeStore(): Promise<Record<string, string>> {
  const uri = getNativeStoreUri();
  const info = await getInfoAsync(uri);

  if (!info.exists) {
    return {};
  }

  const raw = await readAsStringAsync(uri);

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeNativeStore(store: Record<string, string>): Promise<void> {
  await writeAsStringAsync(getNativeStoreUri(), JSON.stringify(store));
}

let migrationFromAsyncAttempted = false;

async function migrateFromAsyncStorageIfNeededLocked(): Promise<void> {
  if (Platform.OS === "web" || migrationFromAsyncAttempted) {
    return;
  }

  migrationFromAsyncAttempted = true;

  const existing = await readNativeStore();
  if (Object.keys(existing).length > 0) {
    return;
  }

  try {
    const mod = await import("@react-native-async-storage/async-storage");
    const AS = mod.default;
    const merged: Record<string, string> = { ...existing };

    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        const value = await AS.getItem(key);
        if (value != null) {
          merged[key] = value;
        }
      } catch {
        /* pojedynczy klucz — ignoruj */
      }
    }

    await writeNativeStore(merged);
  } catch {
    /* natywny AsyncStorage niedostepny — zostaje pusty plik, readJson uzupelni mockami */
  }
}

async function storageGetItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof globalThis.localStorage !== "undefined"
        ? globalThis.localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  }

  return withNativeLock(async () => {
    await migrateFromAsyncStorageIfNeededLocked();
    const store = await readNativeStore();

    return store[key] ?? null;
  });
}

async function storageSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.setItem(key, value);
      }
    } catch {
      /* ignore */
    }

    return;
  }

  return withNativeLock(async () => {
    await migrateFromAsyncStorageIfNeededLocked();
    const store = await readNativeStore();
    store[key] = value;
    await writeNativeStore(store);
  });
}

async function storageRemoveItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }

    return;
  }

  return withNativeLock(async () => {
    await migrateFromAsyncStorageIfNeededLocked();
    const store = await readNativeStore();
    delete store[key];
    await writeNativeStore(store);
  });
}

export type WorkoutFailurePromptState = {
  plannedIds: string[];
  exerciseNames: string[];
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await storageGetItem(key);

  if (!rawValue) {
    await storageSetItem(key, JSON.stringify(fallback));
    return fallback;
  }

  return JSON.parse(rawValue) as T;
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await storageSetItem(key, JSON.stringify(value));
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
    await storageRemoveItem(STORAGE_KEYS.lastWorkoutDayId);
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
  const lastWorkoutDayId = await storageGetItem(STORAGE_KEYS.lastWorkoutDayId);

  return lastWorkoutDayId ?? undefined;
}

export async function saveLastWorkoutDayId(workoutDayId: string): Promise<void> {
  await storageSetItem(STORAGE_KEYS.lastWorkoutDayId, workoutDayId);
}

export async function getWorkoutFailurePrompt(): Promise<
  WorkoutFailurePromptState | undefined
> {
  const raw = await storageGetItem(STORAGE_KEYS.workoutFailurePrompt);

  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw) as WorkoutFailurePromptState;
}

export async function setWorkoutFailurePrompt(
  value: WorkoutFailurePromptState | undefined
): Promise<void> {
  if (!value) {
    await storageRemoveItem(STORAGE_KEYS.workoutFailurePrompt);

    return;
  }

  await storageSetItem(STORAGE_KEYS.workoutFailurePrompt, JSON.stringify(value));
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
