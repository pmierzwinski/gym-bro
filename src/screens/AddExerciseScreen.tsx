import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { currentTrainingGroupId, currentUserId } from "../data/mockData";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { saveExercise } from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import type { Exercise, MuscleGroup } from "../types/training";

type Props = NativeStackScreenProps<RootStackParamList, "AddExercise">;

const muscleGroups: MuscleGroup[] = [
  "klatka",
  "plecy",
  "nogi",
  "barki",
  "biceps",
  "triceps",
  "core",
  "inne"
];

export function AddExerciseScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("klatka");
  const [techniqueDescription, setTechniqueDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Brakuje nazwy", "Wpisz nazwe cwiczenia.");
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString();
    const exercise: Exercise = {
      id: `exercise-${Date.now()}`,
      trainingGroupId: currentTrainingGroupId,
      name: name.trim(),
      muscleGroup,
      techniqueDescription: techniqueDescription.trim() || undefined,
      createdByUserId: currentUserId,
      createdAt: now,
      updatedAt: now
    };

    await saveExercise(exercise);
    setIsSaving(false);
    navigation.goBack();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dodaj cwiczenie</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nazwa cwiczenia</Text>
        <TextInput
          onChangeText={setName}
          placeholder="np. Wyciskanie hantli"
          style={styles.input}
          value={name}
        />

        <Text style={styles.label}>Grupa miesniowa</Text>
        <View style={styles.chips}>
          {muscleGroups.map((group) => (
            <PrimaryButton
              key={group}
              onPress={() => setMuscleGroup(group)}
              title={group}
              variant={muscleGroup === group ? "primary" : "secondary"}
              style={styles.chip}
            />
          ))}
        </View>

        <Text style={styles.label}>Opis techniki opcjonalnie</Text>
        <TextInput
          multiline
          onChangeText={setTechniqueDescription}
          placeholder="np. lopatki sciagniete, kontroluj zejscie"
          style={[styles.input, styles.textArea]}
          value={techniqueDescription}
        />

        <PrimaryButton
          disabled={isSaving}
          onPress={handleSave}
          title={isSaving ? "Zapisywanie..." : "Zapisz cwiczenie"}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    gap: 12,
    padding: 16
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  container: {
    backgroundColor: colors.background,
    gap: 18,
    padding: 18,
    paddingBottom: 32
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
    fontWeight: "800"
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  }
});
