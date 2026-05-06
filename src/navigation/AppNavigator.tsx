import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

import { AddExerciseScreen } from "../screens/AddExerciseScreen";
import { CoachSuggestionsScreen } from "../screens/CoachSuggestionsScreen";
import { ExerciseDetailsScreen } from "../screens/ExerciseDetailsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { TodayWorkoutScreen } from "../screens/TodayWorkoutScreen";
import { WorkoutEditorScreen } from "../screens/WorkoutEditorScreen";
import { WorkoutPlanScreen } from "../screens/WorkoutPlanScreen";

export type RootStackParamList = {
  Home: undefined;
  AddExercise: undefined;
  TodayWorkout: { workoutDayId?: string } | undefined;
  ExerciseDetails: { exerciseId: string };
  WorkoutPlan: undefined;
  WorkoutEditor: { workoutDayId?: string };
  CoachSuggestions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          contentStyle: { backgroundColor: "#070a12" },
          headerLargeTitle: Platform.OS === "ios",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#070a12" },
          headerTintColor: "#f8fafc",
          headerTitleStyle: { color: "#f8fafc", fontWeight: "800" }
        }}
      >
        <Stack.Screen
          component={HomeScreen}
          name="Home"
          options={{ title: "Gym Bro" }}
        />
        <Stack.Screen
          component={AddExerciseScreen}
          name="AddExercise"
          options={{ title: "Dodaj cwiczenie" }}
        />
        <Stack.Screen
          component={TodayWorkoutScreen}
          name="TodayWorkout"
          options={{ title: "Dzisiejszy trening" }}
        />
        <Stack.Screen
          component={ExerciseDetailsScreen}
          name="ExerciseDetails"
          options={{ title: "Historia cwiczenia" }}
        />
        <Stack.Screen
          component={WorkoutPlanScreen}
          name="WorkoutPlan"
          options={{ title: "Plan treningowy" }}
        />
        <Stack.Screen
          component={WorkoutEditorScreen}
          name="WorkoutEditor"
          options={{ title: "Edytor treningu" }}
        />
        <Stack.Screen
          component={CoachSuggestionsScreen}
          name="CoachSuggestions"
          options={{ title: "Sugestie" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
