import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { getCoachSuggestions, getExercises } from "../storage/trainingStorage";
import { colors } from "../theme/colors";
import type { CoachSuggestion, Exercise } from "../types/training";

export function CoachSuggestionsScreen() {
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [loadedSuggestions, loadedExercises] = await Promise.all([
          getCoachSuggestions(),
          getExercises()
        ]);

        if (isActive) {
          setSuggestions(loadedSuggestions);
          setExercises(loadedExercises);
        }
      }

      loadData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sugestie trenera</Text>
        <Text style={styles.subtitle}>
          Na razie to lokalne mocki. Model danych ma juz pola pod trenera,
          grupe i konkretnego zawodnika.
        </Text>
      </View>

      <View style={styles.list}>
        {suggestions.map((suggestion) => {
          const exercise = exercises.find(
            (item) => item.id === suggestion.exerciseId
          );

          return (
            <View key={suggestion.id} style={styles.card}>
              <Text style={styles.exerciseName}>
                {exercise?.name ?? "Sugestia ogolna"}
              </Text>
              <Text style={styles.message}>{suggestion.message}</Text>
              <Text style={styles.date}>
                Dodano: {suggestion.createdAt.slice(0, 10)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16
  },
  container: {
    backgroundColor: colors.background,
    gap: 16,
    padding: 18,
    paddingBottom: 32
  },
  date: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  exerciseName: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20
  },
  list: {
    gap: 12
  },
  message: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  }
});
