export type MuscleGroup =
  | "klatka"
  | "plecy"
  | "nogi"
  | "barki"
  | "biceps"
  | "triceps"
  | "core"
  | "inne";

export type UserRole = "athlete" | "coach";

export type DifficultyLevel = "latwo" | "normalnie" | "ciezko";

export type PlannedSetBlockType = "warmup" | "working";
export type ExerciseProgressionType = "same_weight" | "progressive";
export type ProgressionUnit = "kg" | "percent";
export type SetProgressionType = "same_weight" | "progressive_kg" | "progressive_percent";

export type PlannedSetBlock = {
  id: string;
  type: PlannedSetBlockType;
  setsCount: number;
  reps: number;
  weightKg?: number;
  percentOfTarget?: number;
  progressionType?: SetProgressionType;
  progressionStepKg?: number;
  progressionStepPercent?: number;
};

export type User = {
  id: string;
  name: string;
  role: UserRole;
  trainingGroupId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingGroup = {
  id: string;
  name: string;
  coachId: string;
  athleteIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Exercise = {
  id: string;
  trainingGroupId?: string;
  name: string;
  muscleGroup: MuscleGroup;
  techniqueDescription?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutPlan = {
  id: string;
  trainingGroupId?: string;
  name: string;
  coachId?: string;
  weekIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type WorkoutWeek = {
  id: string;
  planId: string;
  weekNumber: number;
  dayIds: string[];
};

export type WorkoutDay = {
  id: string;
  weekId: string;
  dayNumber: number;
  name: string;
  plannedExerciseIds: string[];
};

export type PlannedExercise = {
  id: string;
  workoutDayId: string;
  exerciseId: string;
  order: number;
  suggestedWeightKg?: number;
  suggestedWeightLabel?: string;
  suggestedSets: number;
  suggestedReps?: number;
  suggestedRepsLabel?: string;
  setBlocks?: PlannedSetBlock[];
  progressionStepKg?: number;
  progressionType?: ExerciseProgressionType;
  progressionUnit?: ProgressionUnit;
  progressionStepPercent?: number;
  deloadStepsOnFail?: number;
  rampToTopSet?: boolean;
  topSetNumber?: number;
  rampStartPercent?: number;
  coachNote?: string;
  updatedByCoachId?: string;
  updatedAt: string;
};

export type WorkoutSession = {
  id: string;
  trainingGroupId?: string;
  userId: string;
  workoutDayId?: string;
  date: string;
  sets: ExerciseSet[];
  createdAt: string;
  updatedAt: string;
};

export type ExerciseSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  plannedExerciseId?: string;
  plannedSetBlockId?: string;
  setNumber: number;
  weightKg?: number;
  weightLabel?: string;
  reps: number;
  difficulty: DifficultyLevel;
  note?: string;
  achieved?: boolean;
  targetWeightKg?: number;
  targetReps?: number;
  createdAt: string;
};

export type CoachSuggestion = {
  id: string;
  trainingGroupId?: string;
  coachId?: string;
  userId?: string;
  exerciseId?: string;
  message: string;
  suggestedWeightKg?: number;
  createdAt: string;
  isDone?: boolean;
};

export type PainNote = {
  id: string;
  trainingGroupId?: string;
  userId: string;
  exerciseId?: string;
  bodyPart: string;
  note: string;
  severity?: "lekki" | "sredni" | "mocny";
  date: string;
  createdAt: string;
};
