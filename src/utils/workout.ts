import type { PlannedExercise, PlannedSetBlock, WorkoutSession } from "../types/training";

export type ExpandedPlannedSet = {
  block: PlannedSetBlock;
  setNumber: number;
  reps: number;
  weightKg?: number;
};

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
  const deloadSteps = planned.deloadStepsOnFail ?? 2;
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
