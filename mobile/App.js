import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PlanProvider } from './src/context/PlanContext';
import { DisclaimerBanner, DisclaimerModal } from './src/components/Disclaimer';
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
          {/* Üst güvenli alan burada uygulanır; ekranlar yalnızca sol/sağ payı kullanır */}
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <DisclaimerBanner />
            <NavigationContainer theme={CustomDarkTheme}>
              <StatusBar style="light" />
              <AppNavigator />
            </NavigationContainer>
          </SafeAreaView>
          <DisclaimerModal />
        </PlanProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

