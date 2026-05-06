import type {
  CoachSuggestion,
  Exercise,
  TrainingGroup,
  User,
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
  WorkoutWeek,
  PlannedExercise
} from "../types/training";

const now = new Date().toISOString();

export const mockUsers: User[] = [
  {
    id: "user-athlete-1",
    name: "Pawel",
    role: "athlete",
    trainingGroupId: "group-main",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "user-athlete-2",
    name: "Kolega",
    role: "athlete",
    trainingGroupId: "group-main",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "user-coach-1",
    name: "Trener",
    role: "coach",
    trainingGroupId: "group-main",
    createdAt: now,
    updatedAt: now
  }
];

export const currentUserId = "user-athlete-1";
export const currentTrainingGroupId = "group-main";

export const mockTrainingGroups: TrainingGroup[] = [
  {
    id: currentTrainingGroupId,
    name: "Gym Bro Team",
    coachId: "user-coach-1",
    athleteIds: ["user-athlete-1", "user-athlete-2"],
    createdAt: now,
    updatedAt: now
  }
];

export const mockExercises: Exercise[] = [
  {
    id: "exercise-bench-press",
    trainingGroupId: currentTrainingGroupId,
    name: "Wyciskanie na lawce",
    muscleGroup: "klatka",
    techniqueDescription: "Stabilne lopatki, kontrolowane zejscie, mocne nogi.",
    createdByUserId: "user-coach-1",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exercise-squat",
    trainingGroupId: currentTrainingGroupId,
    name: "Przysiad",
    muscleGroup: "nogi",
    techniqueDescription: "Pelna kontrola, kolana prowadzone nad stopami.",
    createdByUserId: "user-coach-1",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exercise-deadlift",
    trainingGroupId: currentTrainingGroupId,
    name: "Martwy ciag",
    muscleGroup: "plecy",
    techniqueDescription: "Napiety brzuch, sztanga blisko nog.",
    createdByUserId: "user-coach-1",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exercise-overhead-press",
    trainingGroupId: currentTrainingGroupId,
    name: "Wyciskanie zolnierskie",
    muscleGroup: "barki",
    createdByUserId: "user-coach-1",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exercise-pull-up",
    trainingGroupId: currentTrainingGroupId,
    name: "Podciaganie",
    muscleGroup: "plecy",
    createdByUserId: "user-coach-1",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exercise-row",
    trainingGroupId: currentTrainingGroupId,
    name: "Wioslowanie",
    muscleGroup: "plecy",
    createdByUserId: "user-coach-1",
    createdAt: now,
    updatedAt: now
  }
];

export const mockWorkoutPlan: WorkoutPlan = {
  id: "plan-1",
  trainingGroupId: currentTrainingGroupId,
  name: "Plan startowy",
  coachId: "user-coach-1",
  weekIds: ["week-1"],
  createdAt: now,
  updatedAt: now
};

export const mockWorkoutWeeks: WorkoutWeek[] = [
  {
    id: "week-1",
    planId: "plan-1",
    weekNumber: 1,
    dayIds: ["day-1-1", "day-1-2"]
  }
];

export const mockWorkoutDays: WorkoutDay[] = [
  {
    id: "day-1-1",
    weekId: "week-1",
    dayNumber: 1,
    name: "Dzien 1",
    plannedExerciseIds: ["planned-bench-1", "planned-squat-1", "planned-deadlift-1"]
  },
  {
    id: "day-1-2",
    weekId: "week-1",
    dayNumber: 2,
    name: "Dzien 2",
    plannedExerciseIds: ["planned-ohp-1", "planned-pull-up-1", "planned-row-1"]
  }
];

export const mockPlannedExercises: PlannedExercise[] = [
  {
    id: "planned-bench-1",
    workoutDayId: "day-1-1",
    exerciseId: "exercise-bench-press",
    order: 1,
    suggestedWeightKg: 60,
    suggestedSets: 3,
    suggestedReps: 8,
    setBlocks: [
      {
        id: "block-bench-warmup-1",
        type: "warmup",
        setsCount: 1,
        reps: 5,
        percentOfTarget: 60
      },
      {
        id: "block-bench-warmup-2",
        type: "warmup",
        setsCount: 1,
        reps: 5,
        percentOfTarget: 80
      },
      {
        id: "block-bench-working",
        type: "working",
        setsCount: 3,
        reps: 8,
        weightKg: 60
      }
    ],
    progressionStepKg: 2.5,
    deloadStepsOnFail: 2,
    rampToTopSet: true,
    topSetNumber: 3,
    rampStartPercent: 80,
    updatedByCoachId: "user-coach-1",
    updatedAt: now
  },
  {
    id: "planned-squat-1",
    workoutDayId: "day-1-1",
    exerciseId: "exercise-squat",
    order: 2,
    suggestedWeightKg: 80,
    suggestedSets: 3,
    suggestedReps: 8,
    setBlocks: [
      {
        id: "block-squat-warmup-1",
        type: "warmup",
        setsCount: 1,
        reps: 5,
        percentOfTarget: 60
      },
      {
        id: "block-squat-warmup-2",
        type: "warmup",
        setsCount: 1,
        reps: 5,
        percentOfTarget: 80
      },
      {
        id: "block-squat-working",
        type: "working",
        setsCount: 3,
        reps: 8,
        weightKg: 80
      }
    ],
    progressionStepKg: 5,
    deloadStepsOnFail: 2,
    rampToTopSet: true,
    topSetNumber: 3,
    rampStartPercent: 80,
    updatedByCoachId: "user-coach-1",
    updatedAt: now
  },
  {
    id: "planned-deadlift-1",
    workoutDayId: "day-1-1",
    exerciseId: "exercise-deadlift",
    order: 3,
    suggestedWeightKg: 100,
    suggestedSets: 3,
    suggestedReps: 5,
    setBlocks: [
      {
        id: "block-deadlift-warmup-1",
        type: "warmup",
        setsCount: 1,
        reps: 5,
        percentOfTarget: 60
      },
      {
        id: "block-deadlift-working",
        type: "working",
        setsCount: 3,
        reps: 5,
        weightKg: 100
      }
    ],
    progressionStepKg: 5,
    deloadStepsOnFail: 2,
    rampToTopSet: true,
    topSetNumber: 3,
    rampStartPercent: 80,
    updatedByCoachId: "user-coach-1",
    updatedAt: now
  },
  {
    id: "planned-ohp-1",
    workoutDayId: "day-1-2",
    exerciseId: "exercise-overhead-press",
    order: 1,
    suggestedWeightKg: 40,
    suggestedSets: 3,
    suggestedReps: 8,
    setBlocks: [
      {
        id: "block-ohp-working",
        type: "working",
        setsCount: 3,
        reps: 8,
        weightKg: 40
      }
    ],
    progressionStepKg: 2.5,
    deloadStepsOnFail: 2,
    rampToTopSet: false,
    updatedByCoachId: "user-coach-1",
    updatedAt: now
  },
  {
    id: "planned-pull-up-1",
    workoutDayId: "day-1-2",
    exerciseId: "exercise-pull-up",
    order: 2,
    suggestedWeightLabel: "masa ciala",
    suggestedSets: 3,
    suggestedRepsLabel: "max",
    setBlocks: [
      {
        id: "block-pull-up-working",
        type: "working",
        setsCount: 3,
        reps: 8
      }
    ],
    progressionStepKg: 0,
    deloadStepsOnFail: 1,
    rampToTopSet: false,
    updatedByCoachId: "user-coach-1",
    updatedAt: now
  },
  {
    id: "planned-row-1",
    workoutDayId: "day-1-2",
    exerciseId: "exercise-row",
    order: 3,
    suggestedWeightKg: 60,
    suggestedSets: 3,
    suggestedReps: 10,
    setBlocks: [
      {
        id: "block-row-working",
        type: "working",
        setsCount: 3,
        reps: 10,
        weightKg: 60
      }
    ],
    progressionStepKg: 2.5,
    deloadStepsOnFail: 2,
    rampToTopSet: false,
    updatedByCoachId: "user-coach-1",
    updatedAt: now
  }
];

export const mockWorkoutSessions: WorkoutSession[] = [
  {
    id: "session-sample-1",
    trainingGroupId: currentTrainingGroupId,
    userId: currentUserId,
    workoutDayId: "day-1-1",
    date: "2026-05-01",
    createdAt: "2026-05-01T18:00:00.000Z",
    updatedAt: "2026-05-01T18:00:00.000Z",
    sets: [
      {
        id: "set-sample-bench-1",
        sessionId: "session-sample-1",
        exerciseId: "exercise-bench-press",
        plannedExerciseId: "planned-bench-1",
        setNumber: 1,
        weightKg: 60,
        reps: 8,
        difficulty: "normalnie",
        note: "dobry start",
        createdAt: "2026-05-01T18:02:00.000Z"
      },
      {
        id: "set-sample-squat-1",
        sessionId: "session-sample-1",
        exerciseId: "exercise-squat",
        plannedExerciseId: "planned-squat-1",
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        difficulty: "ciezko",
        note: "pilnowac techniki",
        createdAt: "2026-05-01T18:20:00.000Z"
      }
    ]
  }
];

export const mockCoachSuggestions: CoachSuggestion[] = [
  {
    id: "suggestion-1",
    trainingGroupId: currentTrainingGroupId,
    coachId: "user-coach-1",
    userId: currentUserId,
    exerciseId: "exercise-bench-press",
    message: "Nastepnym razem sprobuj 62.5 kg na wyciskaniu.",
    suggestedWeightKg: 62.5,
    createdAt: now
  },
  {
    id: "suggestion-2",
    trainingGroupId: currentTrainingGroupId,
    coachId: "user-coach-1",
    userId: currentUserId,
    exerciseId: "exercise-bench-press",
    message: "Jesli bark dalej boli, zamien wyciskanie na maszyne.",
    createdAt: now
  },
  {
    id: "suggestion-3",
    trainingGroupId: currentTrainingGroupId,
    coachId: "user-coach-1",
    userId: currentUserId,
    exerciseId: "exercise-squat",
    message: "Przysiad zostaw na 80 kg, technika wazniejsza niz progres.",
    suggestedWeightKg: 80,
    createdAt: now
  }
];
