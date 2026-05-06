import { useCallback, useState } from "react";
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
import { currentTrainingGroupId, currentUserId } from "../data/mockData";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  deleteWorkoutDay,
  getExercises,
  getPlannedExercises,
  getWorkoutDays,
  saveExercise,
  savePlannedExercises,
  saveWorkoutDay
} from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import type {
  Exercise,
  PlannedExercise,
  PlannedSetBlock,
  WorkoutDay
} from "../types/training";
import { summarizeSetBlocks } from "../utils/workout";

type Props = Readonly<NativeStackScreenProps<RootStackParamList, "WorkoutEditor">>;
type EditablePlannedExercise = PlannedExercise & { localKey: string };
type InputBoxProps = Readonly<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}>;

function toNumber(value: string, fallback: number) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDefaultBlock(type: PlannedSetBlock["type"] = "working"): PlannedSetBlock {
  return {
    id: `block-${Date.now()}-${Math.random()}`,
    type,
    setsCount: 1,
    reps: 5,
    progressionType: "same_weight",
    progressionStepPercent: 10
  };
}

function updateBlockList(
  blocks: PlannedSetBlock[],
  blockId: string,
  patch: Partial<PlannedSetBlock>
) {
  return blocks.map((block) =>
    block.id === blockId ? { ...block, ...patch } : block
  );
}

function removeBlockFromList(blocks: PlannedSetBlock[], blockId: string) {
  return blocks.filter((block) => block.id !== blockId);
}

export function WorkoutEditorScreen({ navigation, route }: Props) {
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [allPlannedExercises, setAllPlannedExercises] = useState<PlannedExercise[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState("Nowy trening");
  const [items, setItems] = useState<EditablePlannedExercise[]>([]);
  const [expandedItemKey, setExpandedItemKey] = useState<string>();
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newTechnique, setNewTechnique] = useState("");
  const [draftProgressionStepKg, setDraftProgressionStepKg] = useState("2.5");
  const [draftDeloadSteps, setDraftDeloadSteps] = useState("");
  const [draftBlocks, setDraftBlocks] = useState<PlannedSetBlock[]>([
    createDefaultBlock()
  ]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [loadedDays, loadedPlanned, loadedExercises] = await Promise.all([
          getWorkoutDays(),
          getPlannedExercises(),
          getExercises()
        ]);
        const editedDay = loadedDays.find(
          (day) => day.id === route.params?.workoutDayId
        );

        if (isActive) {
          setWorkoutDays(loadedDays);
          setAllPlannedExercises(loadedPlanned);
          setExercises(loadedExercises);
          setName(editedDay?.name ?? "Nowy trening");
          setItems(
            loadedPlanned
              .filter((planned) => planned.workoutDayId === editedDay?.id)
              .sort((a, b) => a.order - b.order)
              .map((planned) => ({
                ...planned,
                progressionType: planned.progressionType ?? "progressive",
                progressionUnit: planned.progressionUnit ?? "kg",
                localKey: planned.id
              }))
          );
        }
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [route.params?.workoutDayId])
  );

  function getBlocks(item: EditablePlannedExercise) {
    return item.setBlocks?.length ? item.setBlocks : [createDefaultBlock()];
  }

  function createPlannedExercise(exercise: Exercise): EditablePlannedExercise {
    const workoutDayId = route.params?.workoutDayId ?? `day-${Date.now()}`;

    return {
      id: `planned-${Date.now()}-${exercise.id}`,
      localKey: `local-${Date.now()}-${exercise.id}`,
      workoutDayId,
      exerciseId: exercise.id,
      order: items.length + 1,
      suggestedSets: draftBlocks.reduce((sum, block) => sum + block.setsCount, 0),
      suggestedReps: draftBlocks.find((block) => block.type === "working")?.reps ?? 5,
      setBlocks: draftBlocks.map((block) => ({
        ...block,
        id: `block-${Date.now()}-${Math.random()}`
      })),
      progressionType: "progressive",
      progressionUnit: "kg",
      progressionStepKg: toNumber(draftProgressionStepKg, 2.5),
      deloadStepsOnFail: draftDeloadSteps
        ? Math.max(1, Math.round(toNumber(draftDeloadSteps, 2)))
        : undefined,
      updatedAt: new Date().toISOString()
    };
  }

  function addExerciseToWorkout(exercise: Exercise) {
    const newItem = createPlannedExercise(exercise);
    setItems((current) => [...current, newItem]);
    setExpandedItemKey(undefined);
  }

  async function createAndAddExercise() {
    if (!newExerciseName.trim()) {
      Alert.alert("Brakuje nazwy", "Wpisz nazwe cwiczenia.");
      return;
    }

    const now = new Date().toISOString();
    const exercise: Exercise = {
      id: `exercise-${Date.now()}`,
      trainingGroupId: currentTrainingGroupId,
      name: newExerciseName.trim(),
      muscleGroup: "inne",
      techniqueDescription: newTechnique.trim() || undefined,
      createdByUserId: currentUserId,
      createdAt: now,
      updatedAt: now
    };

    await saveExercise(exercise);
    setExercises(await getExercises());
    addExerciseToWorkout(exercise);
    setNewExerciseName("");
    setNewTechnique("");
  }

  function updateItem(localKey: string, patch: Partial<EditablePlannedExercise>) {
    setItems((current) =>
      current.map((item) => (item.localKey === localKey ? { ...item, ...patch } : item))
    );
  }

  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(newExerciseName.trim().toLowerCase())
  );

  function updateDraftBlock(blockId: string, patch: Partial<PlannedSetBlock>) {
    setDraftBlocks((current) => updateBlockList(current, blockId, patch));
  }

  function addDraftBlock(type: PlannedSetBlock["type"]) {
    setDraftBlocks((current) => [...current, createDefaultBlock(type)]);
  }

  function removeDraftBlock(blockId: string) {
    setDraftBlocks((current) => {
      const nextBlocks = removeBlockFromList(current, blockId);
      return nextBlocks.length ? nextBlocks : [createDefaultBlock()];
    });
  }

  function moveItem(localKey: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.localKey === localKey);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);

      return next.map((item, orderIndex) => ({ ...item, order: orderIndex + 1 }));
    });
  }

  function removeItem(localKey: string) {
    setItems((current) =>
      current
        .filter((item) => item.localKey !== localKey)
        .map((item, index) => ({ ...item, order: index + 1 }))
    );
  }

  function addSetBlock(localKey: string, type: PlannedSetBlock["type"]) {
    setItems((current) =>
      current.map((item) =>
        item.localKey === localKey
          ? { ...item, setBlocks: [...getBlocks(item), createDefaultBlock(type)] }
          : item
      )
    );
  }

  function updateSetBlock(
    localKey: string,
    blockId: string,
    patch: Partial<PlannedSetBlock>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.localKey === localKey
          ? {
              ...item,
              setBlocks: updateBlockList(getBlocks(item), blockId, patch)
            }
          : item
      )
    );
  }

  function removeSetBlock(localKey: string, blockId: string) {
    setItems((current) =>
      current.map((item) =>
        item.localKey === localKey
          ? {
              ...item,
              setBlocks: removeBlockFromList(getBlocks(item), blockId)
            }
          : item
      )
    );
  }

  async function saveWorkout() {
    if (!name.trim()) {
      Alert.alert("Brakuje nazwy", "Nazwij trening.");
      return;
    }

    if (!items.length) {
      Alert.alert("Brakuje cwiczen", "Dodaj przynajmniej jedno cwiczenie.");
      return;
    }

    const now = new Date().toISOString();
    const workoutDayId = route.params?.workoutDayId ?? `day-${Date.now()}`;
    const normalizedItems: PlannedExercise[] = items.map((item, index) => {
      const blocks = getBlocks(item);
      const workingBlocks = blocks.filter((block) => block.type === "working");
      const lastBlock = workingBlocks.at(-1) ?? blocks.at(-1);

      return {
        ...item,
        workoutDayId,
        order: index + 1,
        setBlocks: blocks,
        suggestedSets: blocks.reduce((sum, block) => sum + block.setsCount, 0),
        suggestedReps: lastBlock?.reps ?? 1,
        progressionStepKg: item.progressionStepKg ?? 2.5,
        progressionStepPercent: item.progressionStepPercent ?? 10,
        deloadStepsOnFail: item.deloadStepsOnFail,
        updatedAt: now
      };
    });
    const day: WorkoutDay = {
      id: workoutDayId,
      weekId: "week-local",
      dayNumber:
        workoutDays.find((workoutDay) => workoutDay.id === workoutDayId)?.dayNumber ??
        workoutDays.length + 1,
      name: name.trim(),
      plannedExerciseIds: normalizedItems.map((item) => item.id)
    };

    await saveWorkoutDay(day);
    await savePlannedExercises([
      ...allPlannedExercises.filter((planned) => planned.workoutDayId !== workoutDayId),
      ...normalizedItems
    ]);
    navigation.goBack();
  }

  async function handleDeleteWorkout() {
    const workoutDayId = route.params?.workoutDayId;

    if (!workoutDayId) {
      navigation.goBack();
      return;
    }

    await deleteWorkoutDay(workoutDayId);
    navigation.navigate("Home");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Edytor treningu</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Nazwa treningu"
          placeholderTextColor={colors.muted}
          style={styles.titleInput}
          value={name}
        />
      </View>

      <Text style={styles.sectionTitle}>Cwiczenia w treningu</Text>
      <View style={styles.list}>
        {items.map((item, index) => {
          const exercise = exercises.find((entry) => entry.id === item.exerciseId);
          const isExpanded = expandedItemKey === item.localKey;

          return (
            <View key={item.localKey} style={styles.card}>
              <Pressable
                onPress={() =>
                  setExpandedItemKey(isExpanded ? undefined : item.localKey)
                }
                style={styles.cardHeader}
              >
                <View style={styles.exerciseText}>
                  <Text style={styles.exerciseTitle}>
                    {index + 1}. {exercise?.name ?? "Cwiczenie"}
                  </Text>
                  <Text style={styles.summaryText}>{summarizeSetBlocks(item)}</Text>
                </View>
                <View style={styles.moveRow}>
                  <PrimaryButton
                    onPress={() => moveItem(item.localKey, -1)}
                    title="↑"
                    variant="secondary"
                    style={styles.moveButton}
                  />
                  <PrimaryButton
                    onPress={() => moveItem(item.localKey, 1)}
                    title="↓"
                    variant="secondary"
                    style={styles.moveButton}
                  />
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.details}>
                  <View style={styles.grid}>
                    <InputBox
                      label="Progres kg co trening"
                      value={String(item.progressionStepKg ?? "")}
                      onChangeText={(value) =>
                        updateItem(item.localKey, {
                          progressionStepKg: value ? toNumber(value, 2.5) : undefined
                        })
                      }
                    />
                    <InputBox
                      label="Skok cofniecia treningu"
                      value={String(item.deloadStepsOnFail ?? "")}
                      onChangeText={(value) =>
                        updateItem(item.localKey, {
                          deloadStepsOnFail: value
                            ? Math.max(1, Math.round(toNumber(value, 2)))
                            : undefined
                        })
                      }
                    />
                  </View>

                  <Text style={styles.blockTitle}>Serie</Text>
                  <View style={styles.blockList}>
                    {getBlocks(item).map((block) => (
                      <View key={block.id} style={styles.blockCard}>
                        <View style={styles.blockHeader}>
                          <Text style={styles.blockKind}>
                            {block.type === "warmup" ? "Rozgrzewka" : "Seria docelowa"}
                          </Text>
                          <PrimaryButton
                            onPress={() => removeSetBlock(item.localKey, block.id)}
                            title="Usun"
                            variant="danger"
                            style={styles.removeBlockButton}
                          />
                        </View>
                        <View style={styles.inlineActions}>
                          <PrimaryButton
                            onPress={() =>
                              updateSetBlock(item.localKey, block.id, {
                                progressionType: "same_weight"
                              })
                            }
                            title="Jeden ciezar"
                            variant={
                              block.progressionType === "same_weight" ||
                              !block.progressionType
                                ? "primary"
                                : "secondary"
                            }
                            style={styles.inlineButton}
                          />
                          <PrimaryButton
                            onPress={() =>
                              updateSetBlock(item.localKey, block.id, {
                                progressionType: "progressive_kg"
                              })
                            }
                            title="Progres kg"
                            variant={
                              block.progressionType === "progressive_kg"
                                ? "primary"
                                : "secondary"
                            }
                            style={styles.inlineButton}
                          />
                          <PrimaryButton
                            onPress={() =>
                              updateSetBlock(item.localKey, block.id, {
                                progressionType: "progressive_percent"
                              })
                            }
                            title="Progres %"
                            variant={
                              block.progressionType === "progressive_percent"
                                ? "primary"
                                : "secondary"
                            }
                            style={styles.inlineButton}
                          />
                        </View>
                        <View style={styles.grid}>
                          <InputBox
                            label="Ile serii"
                            value={String(block.setsCount)}
                            onChangeText={(value) =>
                              updateSetBlock(item.localKey, block.id, {
                                setsCount: Math.max(1, Math.round(toNumber(value, 1)))
                              })
                            }
                          />
                          <InputBox
                            label="Powt."
                            value={String(block.reps)}
                            onChangeText={(value) =>
                              updateSetBlock(item.localKey, block.id, {
                                reps: Math.max(1, Math.round(toNumber(value, 1)))
                              })
                            }
                          />
                          <InputBox
                            label="Docelowe kg"
                            value={String(block.weightKg ?? "")}
                            onChangeText={(value) =>
                              updateSetBlock(item.localKey, block.id, {
                                weightKg: value ? toNumber(value, 0) : undefined
                              })
                            }
                          />
                          {block.progressionType === "progressive_kg" ? (
                            <InputBox
                              label="Przyrost kg"
                              value={String(block.progressionStepKg ?? 2.5)}
                              onChangeText={(value) =>
                                updateSetBlock(item.localKey, block.id, {
                                  progressionStepKg: toNumber(value, 2.5)
                                })
                              }
                            />
                          ) : null}
                          {block.progressionType === "progressive_percent" ? (
                            <InputBox
                              label="Przyrost %"
                              value={String(block.progressionStepPercent ?? 10)}
                              onChangeText={(value) =>
                                updateSetBlock(item.localKey, block.id, {
                                  progressionStepPercent: toNumber(value, 10)
                                })
                              }
                            />
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      onPress={() => addSetBlock(item.localKey, "warmup")}
                      title="+ rozgrzewka"
                      variant="secondary"
                      style={styles.inlineButton}
                    />
                  </View>

                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      onPress={() => setExpandedItemKey(undefined)}
                      title="Zapisz i zwin"
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      onPress={() => removeItem(item.localKey)}
                      title="Usun"
                      variant="danger"
                      style={styles.inlineButton}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <PrimaryButton
        onPress={() => setIsAddPanelOpen((current) => !current)}
        title={isAddPanelOpen ? "Zamknij dodawanie" : "Dodaj cwiczenie"}
        variant="secondary"
      />

      {isAddPanelOpen ? (
        <View style={styles.addPanel}>
          <Text style={styles.blockTitle}>Dodaj cwiczenie</Text>
          <TextInput
            onChangeText={setNewExerciseName}
            placeholder="Zacznij pisac albo wybierz z listy"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={newExerciseName}
          />
          <View style={styles.suggestionsBox}>
            {filteredExercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                onPress={() => addExerciseToWorkout(exercise)}
                style={styles.suggestionRow}
              >
                <Text style={styles.suggestionName}>{exercise.name}</Text>
                <Text style={styles.suggestionMeta}>
                  {exercise.techniqueDescription ?? "Dodaj do treningu"}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            multiline
            onChangeText={setNewTechnique}
            placeholder="Opis techniki opcjonalnie"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textArea]}
            value={newTechnique}
          />
          <Text style={styles.blockTitle}>Konfiguracja po dodaniu</Text>
          <View style={styles.grid}>
            <InputBox
              label="Progres kg co trening"
              value={draftProgressionStepKg}
              onChangeText={setDraftProgressionStepKg}
            />
            <InputBox
              label="Skok cofniecia treningu"
              value={draftDeloadSteps}
              onChangeText={setDraftDeloadSteps}
            />
          </View>

          <Text style={styles.blockTitle}>Serie</Text>
          <View style={styles.blockList}>
            {draftBlocks.map((block) => (
              <View key={block.id} style={styles.blockCard}>
                <View style={styles.blockHeader}>
                  <Text style={styles.blockKind}>
                    {block.type === "warmup" ? "Rozgrzewka" : "Seria docelowa"}
                  </Text>
                  <PrimaryButton
                    onPress={() => removeDraftBlock(block.id)}
                    title="Usun"
                    variant="danger"
                    style={styles.removeBlockButton}
                  />
                </View>

                <View style={styles.inlineActions}>
                  <PrimaryButton
                    onPress={() =>
                      updateDraftBlock(block.id, {
                        progressionType: "same_weight"
                      })
                    }
                    title="Jeden ciezar"
                    variant={
                      block.progressionType === "same_weight" ||
                      !block.progressionType
                        ? "primary"
                        : "secondary"
                    }
                    style={styles.inlineButton}
                  />
                  <PrimaryButton
                    onPress={() =>
                      updateDraftBlock(block.id, {
                        progressionType: "progressive_kg"
                      })
                    }
                    title="Progres kg"
                    variant={
                      block.progressionType === "progressive_kg"
                        ? "primary"
                        : "secondary"
                    }
                    style={styles.inlineButton}
                  />
                  <PrimaryButton
                    onPress={() =>
                      updateDraftBlock(block.id, {
                        progressionType: "progressive_percent"
                      })
                    }
                    title="Progres %"
                    variant={
                      block.progressionType === "progressive_percent"
                        ? "primary"
                        : "secondary"
                    }
                    style={styles.inlineButton}
                  />
                </View>

                <View style={styles.grid}>
                  <InputBox
                    label="Ile serii"
                    value={String(block.setsCount)}
                    onChangeText={(value) =>
                      updateDraftBlock(block.id, {
                        setsCount: Math.max(1, Math.round(toNumber(value, 1)))
                      })
                    }
                  />
                  <InputBox
                    label="Powt."
                    value={String(block.reps)}
                    onChangeText={(value) =>
                      updateDraftBlock(block.id, {
                        reps: Math.max(1, Math.round(toNumber(value, 1)))
                      })
                    }
                  />
                  <InputBox
                    label="Docelowe kg"
                    value={String(block.weightKg ?? "")}
                    onChangeText={(value) =>
                      updateDraftBlock(block.id, {
                        weightKg: value ? toNumber(value, 0) : undefined
                      })
                    }
                  />
                  {block.progressionType === "progressive_kg" ? (
                    <InputBox
                      label="Przyrost kg"
                      value={String(block.progressionStepKg ?? 2.5)}
                      onChangeText={(value) =>
                        updateDraftBlock(block.id, {
                          progressionStepKg: toNumber(value, 2.5)
                        })
                      }
                    />
                  ) : null}
                  {block.progressionType === "progressive_percent" ? (
                    <InputBox
                      label="Przyrost %"
                      value={String(block.progressionStepPercent ?? 10)}
                      onChangeText={(value) =>
                        updateDraftBlock(block.id, {
                          progressionStepPercent: toNumber(value, 10)
                        })
                      }
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.inlineActions}>
            <PrimaryButton
              onPress={() => addDraftBlock("warmup")}
              title="+ rozgrzewka"
              variant="secondary"
              style={styles.inlineButton}
            />
          </View>
          <PrimaryButton onPress={createAndAddExercise} title="Dodaj" />
        </View>
      ) : null}

      <PrimaryButton onPress={saveWorkout} title="Zapisz trening" />
      <PrimaryButton
        onPress={handleDeleteWorkout}
        title="Usun trening"
        variant="danger"
      />
    </ScrollView>
  );
}

function InputBox({ label, value, onChangeText }: InputBoxProps) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  addPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  blockCard: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 12
  },
  blockHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  blockKind: {
    color: colors.primary,
    flex: 1,
    fontSize: 15,
    fontWeight: "900"
  },
  blockList: {
    gap: 10
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  blockTypeButton: {
    flex: 1,
    minHeight: 42
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  container: {
    backgroundColor: colors.background,
    gap: 16,
    padding: 18,
    paddingBottom: 32
  },
  details: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 12
  },
  exerciseButton: {
    minHeight: 44
  },
  exercisePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  exerciseText: {
    flex: 1
  },
  exerciseTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10
  },
  inlineButton: {
    flex: 1,
    minHeight: 44
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    minHeight: 50,
    paddingHorizontal: 12
  },
  inputBox: {
    flexBasis: "45%",
    flexGrow: 1
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase"
  },
  list: {
    gap: 12
  },
  moveButton: {
    minHeight: 40,
    paddingHorizontal: 12
  },
  moveRow: {
    flexDirection: "row",
    gap: 8
  },
  removeBlockButton: {
    minHeight: 42,
    paddingHorizontal: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  },
  summaryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 4
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  suggestionName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  suggestionRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 10
  },
  suggestionsBox: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 220,
    paddingHorizontal: 12
  },
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  titleInput: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
    padding: 0
  }
});
