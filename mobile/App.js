import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PlanProvider } from './src/context/PlanContext';
import { COLORS } from './src/theme/colors';

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.bg,
    card: COLORS.card,
    text: COLORS.textPrimary,
    border: COLORS.border,
    primary: COLORS.primaryLight,
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PlanProvider>
          <NavigationContainer theme={CustomDarkTheme}>
            <StatusBar style="light" />
            <AppNavigator />
          </NavigationContainer>
        </PlanProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

