import type {
  ExerciseSet,
  PlannedExercise,
  PlannedSetBlock,
  WorkoutSession
} from "../types/training";

export type ExpandedPlannedSet = {
  block: PlannedSetBlock;
  setNumber: number;
  reps: number;
  weightKg?: number;
};

/**
 * Sesje użyte do wyliczenia sugerowanego ciężaru: pomija aktywną (nieukończoną) sesję z tego dnia
 * i planu — żeby cele nie skakały w trakcie treningu. Sesje oznaczone completed liczą się normalnie.
 */
export function sessionsForBaselineWeight(
  sessions: WorkoutSession[],
  workoutDayId: string | undefined,
  sessionDate: string,
  userId: string
): WorkoutSession[] {
  if (!workoutDayId) {
    return sessions;
  }

  return sessions.filter((session) => {
    const sameSlot =
      session.userId === userId &&
      session.workoutDayId === workoutDayId &&
      session.date === sessionDate;

    if (!sameSlot) {
      return true;
    }

    return session.completed === true;
  });
}

export function flattenSetsForWorkoutDayDate(
  sessions: WorkoutSession[],
  workoutDayId: string,
  sessionDate: string,
  userId: string
): ExerciseSet[] {
  return sessions
    .filter(
      (session) =>
        session.userId === userId &&
        session.workoutDayId === workoutDayId &&
        session.date === sessionDate
    )
    .flatMap((session) => session.sets);
}

/** Wpisane serie z aktywnego treningu (bez sesji zamknietych przyciskiem Koniec). */
export function flattenSetsFromIncompleteSessionsToday(
  sessions: WorkoutSession[],
  workoutDayId: string,
  sessionDate: string,
  userId: string
): ExerciseSet[] {
  return sessions
    .filter(
      (session) =>
        session.userId === userId &&
        session.workoutDayId === workoutDayId &&
        session.date === sessionDate &&
        session.completed !== true
    )
    .flatMap((session) => session.sets);
}

export function getWorkingBlockIds(planned: PlannedExercise): Set<string> {
  return new Set(
    getSetBlocks(planned)
      .filter((block) => block.type === "working")
      .map((block) => block.id)
  );
}

export function countExpectedWorkingSets(planned: PlannedExercise): number {
  return getSetBlocks(planned)
    .filter((block) => block.type === "working")
    .reduce((sum, block) => sum + block.setsCount, 0);
}

export type ExerciseSessionOutcome = "none" | "success" | "failure";

export function getExerciseSessionOutcome(
  planned: PlannedExercise,
  setsForExercise: ExerciseSet[]
): ExerciseSessionOutcome {
  const workingIds = getWorkingBlockIds(planned);
  const workingSets = setsForExercise.filter((set) => {
    if (!set.plannedSetBlockId) {
      return true;
    }

    return workingIds.has(set.plannedSetBlockId);
  });

  if (workingSets.length === 0) {
    return "none";
  }

  const expected = countExpectedWorkingSets(planned);
  const allAchieved = workingSets.every((set) => set.achieved === true);

  if (workingSets.length >= expected && allAchieved) {
    return "success";
  }

  return "failure";
}

export function isRepBasedPlan(planned: PlannedExercise): boolean {
  const base = getBaseTargetWeight(planned);
  if (base !== undefined && base > 0) {
    return false;
  }

  return !getSetBlocks(planned).some(
    (block) =>
      block.type === "working" &&
      block.weightKg !== undefined &&
      block.weightKg > 0
  );
}

function getRepProgressionCeiling(planned: PlannedExercise): number {
  const working = getSetBlocks(planned).filter((block) => block.type === "working");
  const maxBlockReps =
    working.length > 0
      ? Math.max(...working.map((block) => Math.max(1, block.reps)))
      : 1;

  if (planned.targetReps != undefined && planned.targetReps > 0) {
    return Math.max(planned.targetReps, maxBlockReps);
  }

  return Math.max(maxBlockReps, planned.suggestedReps ?? 1, 1);
}

function applyRepProgressForNextSession(planned: PlannedExercise): PlannedExercise {
  const now = new Date().toISOString();
  const ceiling = getRepProgressionCeiling(planned);
  const blocks = getSetBlocks(planned);

  if (!planned.setBlocks?.length) {
    const current = planned.suggestedReps ?? 1;

    return {
      ...planned,
      suggestedReps: Math.min(current + 1, ceiling),
      updatedAt: now
    };
  }

  const nextBlocks = blocks.map((block) =>
    block.type === "working"
      ? { ...block, reps: Math.min(block.reps + 1, ceiling) }
      : block
  );
  const workingBlocks = nextBlocks.filter((block) => block.type === "working");
  const lastWorking = workingBlocks.at(-1);

  return {
    ...planned,
    setBlocks: nextBlocks,
    suggestedReps: lastWorking?.reps ?? planned.suggestedReps,
    updatedAt: now
  };
}

function applyRepDeloadForNextSession(planned: PlannedExercise): PlannedExercise {
  const now = new Date().toISOString();
  const steps = roundDeloadTrainingSteps(planned);
  const blocks = getSetBlocks(planned);

  if (!planned.setBlocks?.length) {
    const current = planned.suggestedReps ?? 1;

    return {
      ...planned,
      suggestedReps: Math.max(1, current - steps),
      updatedAt: now
    };
  }

  const nextBlocks = blocks.map((block) =>
    block.type === "working"
      ? { ...block, reps: Math.max(1, block.reps - steps) }
      : block
  );
  const workingBlocks = nextBlocks.filter((block) => block.type === "working");
  const lastWorking = workingBlocks.at(-1);

  return {
    ...planned,
    setBlocks: nextBlocks,
    suggestedReps: lastWorking?.reps ?? planned.suggestedReps,
    updatedAt: now
  };
}

export function applyPlannedProgressForNextSession(
  planned: PlannedExercise
): PlannedExercise {
  const now = new Date().toISOString();

  if (planned.progressionType === "same_weight") {
    return { ...planned, updatedAt: now };
  }

  if (isRepBasedPlan(planned)) {
    return applyRepProgressForNextSession(planned);
  }

  const stepKg = planned.progressionStepKg ?? 2.5;
  const blocks = getSetBlocks(planned);
  const workingWithWeights = blocks.filter(
    (block) => block.type === "working" && (block.weightKg ?? 0) > 0
  );
  let maxWeight = 0;
  let topBlockId: string | undefined;

  for (const block of workingWithWeights) {
    const w = block.weightKg ?? 0;
    if (w >= maxWeight) {
      maxWeight = w;
      topBlockId = block.id;
    }
  }

  if (topBlockId) {
    const nextBlocks = blocks.map((block) =>
      block.id === topBlockId
        ? {
            ...block,
            weightKg: roundToNearest((block.weightKg ?? 0) + stepKg, 2.5)
          }
        : block
    );

    return { ...planned, setBlocks: nextBlocks, updatedAt: now };
  }

  if (planned.suggestedWeightKg) {
    return {
      ...planned,
      suggestedWeightKg: roundToNearest(planned.suggestedWeightKg + stepKg, 2.5),
      updatedAt: now
    };
  }

  return { ...planned, updatedAt: now };
}

function roundDeloadTrainingSteps(planned: PlannedExercise): number {
  const raw = planned.deloadStepsOnFail;
  const steps =
    raw !== undefined && raw !== null && Number.isFinite(raw)
      ? Math.round(Number(raw))
      : 5;

  return Math.max(1, steps);
}

export function applyPlannedDeloadForNextSession(
  planned: PlannedExercise
): PlannedExercise {
  if (isRepBasedPlan(planned)) {
    return applyRepDeloadForNextSession(planned);
  }

  const now = new Date().toISOString();
  const stepKg = planned.progressionStepKg ?? 2.5;
  const deloadSteps = roundDeloadTrainingSteps(planned);
  const delta = stepKg * deloadSteps;
  const blocks = getSetBlocks(planned);
  const workingWithWeights = blocks.filter(
    (block) => block.type === "working" && (block.weightKg ?? 0) > 0
  );
  let maxWeight = 0;
  let topBlockId: string | undefined;

  for (const block of workingWithWeights) {
    const w = block.weightKg ?? 0;
    if (w >= maxWeight) {
      maxWeight = w;
      topBlockId = block.id;
    }
  }

  if (topBlockId) {
    const nextBlocks = blocks.map((block) =>
      block.id === topBlockId
        ? {
            ...block,
            weightKg: Math.max(
              stepKg,
              roundToNearest(Math.max(0, (block.weightKg ?? 0) - delta), 2.5)
            )
          }
        : block
    );

    return { ...planned, setBlocks: nextBlocks, updatedAt: now };
  }

  if (planned.suggestedWeightKg) {
    return {
      ...planned,
      suggestedWeightKg: Math.max(
        stepKg,
        roundToNearest(planned.suggestedWeightKg - delta, 2.5)
      ),
      updatedAt: now
    };
  }

  return { ...planned, updatedAt: now };
}

export function getSuggestedTopWeight(
  planned: PlannedExercise,
  sessions: WorkoutSession[]
) {
  const baseTargetWeight = getBaseTargetWeight(planned);
  const workingBlockIds = new Set(
    getSetBlocks(planned)
      .filter((block) => block.type === "working")
      .map((block) => block.id)
  );
  const lastSet = sessions
    .flatMap((session) => session.sets)
    .filter(
      (set) =>
        set.plannedExerciseId === planned.id &&
        set.weightKg &&
        (!set.plannedSetBlockId || workingBlockIds.has(set.plannedSetBlockId))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!lastSet && !baseTargetWeight) {
    return undefined;
  }

  if (!lastSet) {
    return baseTargetWeight;
  }

  const step =
    planned.progressionUnit === "percent"
      ? (baseTargetWeight ?? lastSet.weightKg ?? 0) *
        ((planned.progressionStepPercent ?? 10) / 100)
      : planned.progressionStepKg ?? 2.5;
  const deloadSteps = roundDeloadTrainingSteps(planned);
  const targetReps = getTargetReps(planned);
  const targetWeight = baseTargetWeight ?? lastSet.weightKg ?? 0;
  const achieved =
    (lastSet.weightKg ?? 0) >= targetWeight && lastSet.reps >= targetReps;

  if (planned.progressionType === "same_weight") {
    return lastSet.weightKg ?? baseTargetWeight;
  }

  return achieved
    ? (lastSet.weightKg ?? targetWeight) + step
    : Math.max(step, targetWeight - step * deloadSteps);
}

export function getSetBlocks(planned: PlannedExercise): PlannedSetBlock[] {
  if (planned.setBlocks?.length) {
    return [...planned.setBlocks].sort((a, b) => {
      if (a.type === b.type) {
        return 0;
      }

      return a.type === "warmup" ? -1 : 1;
    });
  }

  return [
    {
      id: `${planned.id}-legacy-working`,
      type: "working",
      setsCount: planned.suggestedSets,
      reps: planned.suggestedReps ?? 1,
      weightKg: planned.suggestedWeightKg,
      percentOfTarget: planned.suggestedWeightKg ? 100 : undefined,
      progressionStepPercent: 10
    }
  ];
}

export function getTargetReps(planned: PlannedExercise) {
  const workingBlocks = getSetBlocks(planned).filter(
    (block) => block.type === "working"
  );
  const workingBlock = workingBlocks.at(-1);

  return workingBlock?.reps ?? planned.suggestedReps ?? 1;
}

export function expandSetBlocks(
  planned: PlannedExercise,
  topWeightKg?: number
): ExpandedPlannedSet[] {
  const baseTargetWeight = getBaseTargetWeight(planned);
  const baseTopWeight = topWeightKg ?? baseTargetWeight;
  const progressionDelta =
    baseTopWeight && baseTargetWeight
      ? baseTopWeight - baseTargetWeight
      : 0;
  let setNumber = 0;

  return getSetBlocks(planned).flatMap((block) =>
    Array.from({ length: block.setsCount }, (_, blockSetIndex) => {
      setNumber += 1;
      const rawWeight = getBlockWeight(
        block,
        baseTopWeight,
        progressionDelta,
        blockSetIndex,
        block.setsCount
      );

      return {
        block,
        setNumber,
        reps: block.reps,
        weightKg: rawWeight ? roundToNearest(rawWeight, 2.5) : undefined
      };
    })
  );
}

export function summarizeSetBlocks(planned: PlannedExercise) {
  return getSetBlocks(planned)
    .map((block) => {
      const weight = block.weightKg ? ` @ ${block.weightKg} kg` : "";
      const label = block.type === "warmup" ? "rozgrz." : "docel.";
      const progression = getProgressionLabel(block);

      return `${block.setsCount}x${block.reps} ${label}${weight}${progression}`;
    })
    .join(" + ");
}

function getBlockWeight(
  block: PlannedSetBlock,
  topWeightKg: number | undefined,
  progressionDelta: number,
  blockSetIndex: number,
  setsCount: number
) {
  if (block.percentOfTarget && topWeightKg) {
    return topWeightKg * (block.percentOfTarget / 100);
  }

  if (block.weightKg) {
    const baseWeight = block.weightKg + progressionDelta;

    if (block.progressionType === "progressive_kg") {
      const remainingSteps = setsCount - 1 - blockSetIndex;
      return Math.max(0, baseWeight - remainingSteps * (block.progressionStepKg ?? 2.5));
    }

    if (block.progressionType === "progressive_percent") {
      const remainingSteps = setsCount - 1 - blockSetIndex;
      return Math.max(
        0,
        baseWeight * (1 - remainingSteps * ((block.progressionStepPercent ?? 10) / 100))
      );
    }

    return baseWeight;
  }

  if (block.type === "working") {
    return topWeightKg;
  }

  return undefined;
}

function getBaseTargetWeight(planned: PlannedExercise) {
  if (planned.suggestedWeightKg) {
    return planned.suggestedWeightKg;
  }

  const workingBlocks = getSetBlocks(planned).filter(
    (block) => block.type === "working" && block.weightKg
  );
  return workingBlocks.at(-1)?.weightKg;
}

function getProgressionLabel(block: PlannedSetBlock) {
  if (block.progressionType === "progressive_kg") {
    return ` +${block.progressionStepKg ?? 2.5}kg`;
  }

  if (block.progressionType === "progressive_percent") {
    return ` +${block.progressionStepPercent ?? 10}%`;
  }

  return "";
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}
