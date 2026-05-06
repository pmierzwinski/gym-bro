import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../theme/colors";
import type { DifficultyLevel } from "../types/training";
import { PrimaryButton } from "./PrimaryButton";

type SetFormValues = {
  weightKg?: number;
  reps: number;
  setNumber: number;
  difficulty: DifficultyLevel;
  note?: string;
};

type SetFormProps = {
  defaultSetNumber?: number;
  suggestedWeightKg?: number;
  suggestedReps?: number;
  onSubmit: (values: SetFormValues) => Promise<void> | void;
};

const difficultyOptions: Array<{ value: DifficultyLevel; label: string }> = [
  { value: "latwo", label: "Latwo" },
  { value: "normalnie", label: "Normalnie" },
  { value: "ciezko", label: "Ciezko" }
];

export function SetForm({
  defaultSetNumber = 1,
  suggestedWeightKg,
  suggestedReps,
  onSubmit
}: SetFormProps) {
  const [weightKg, setWeightKg] = useState(
    suggestedWeightKg ? String(suggestedWeightKg) : ""
  );
  const [reps, setReps] = useState(suggestedReps ? String(suggestedReps) : "");
  const [setNumber, setSetNumber] = useState(String(defaultSetNumber));
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("normalnie");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canSave = Number(reps) > 0 && Number(setNumber) > 0;

  async function handleSubmit() {
    if (!canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    await onSubmit({
      weightKg: weightKg.trim() ? Number(weightKg.replace(",", ".")) : undefined,
      reps: Number(reps),
      setNumber: Number(setNumber),
      difficulty,
      note: note.trim() || undefined
    });
    setIsSaving(false);
    setNote("");
    setSetNumber(String(Number(setNumber) + 1));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dodaj serie</Text>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Kg</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setWeightKg}
            placeholder="60"
            style={styles.input}
            value={weightKg}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Powt.</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setReps}
            placeholder="8"
            style={styles.input}
            value={reps}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Seria</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setSetNumber}
            placeholder="1"
            style={styles.input}
            value={setNumber}
          />
        </View>
      </View>

      <View style={styles.quickRow}>
        <PrimaryButton
          onPress={() =>
            setWeightKg(String(Math.max(0, Number(weightKg || 0) - 2.5)))
          }
          title="-2.5 kg"
          variant="secondary"
          style={styles.quickButton}
        />
        <PrimaryButton
          onPress={() => setWeightKg(String(Number(weightKg || 0) + 2.5))}
          title="+2.5 kg"
          variant="secondary"
          style={styles.quickButton}
        />
        <PrimaryButton
          onPress={() => setReps(String(Math.max(1, Number(reps || 1) - 1)))}
          title="-1 powt."
          variant="secondary"
          style={styles.quickButton}
        />
        <PrimaryButton
          onPress={() => setReps(String(Number(reps || 0) + 1))}
          title="+1 powt."
          variant="secondary"
          style={styles.quickButton}
        />
      </View>

      <Text style={styles.label}>Poziom trudnosci</Text>
      <View style={styles.difficultyRow}>
        {difficultyOptions.map((option) => (
          <PrimaryButton
            key={option.value}
            onPress={() => setDifficulty(option.value)}
            title={option.label}
            variant={difficulty === option.value ? "primary" : "secondary"}
            style={styles.difficultyButton}
          />
        ))}
      </View>

      <Text style={styles.label}>Notatka opcjonalna</Text>
      <TextInput
        multiline
        onChangeText={setNote}
        placeholder="np. bol barku, latwo, za ciezko"
        style={[styles.input, styles.noteInput]}
        value={note}
      />

      <PrimaryButton
        disabled={!canSave || isSaving}
        onPress={handleSubmit}
        title={isSaving ? "Zapisywanie..." : "Zapisz serie"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  difficultyButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 8
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8
  },
  field: {
    flex: 1
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: 14
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  noteInput: {
    minHeight: 86,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  quickButton: {
    minHeight: 42,
    paddingHorizontal: 8
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  }
});
