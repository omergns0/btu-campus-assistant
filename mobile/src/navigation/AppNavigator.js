import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyClassroomsScreen from '../screens/EmptyClassroomsScreen';
import TimetableScreen from '../screens/TimetableScreen';
import InstructorScreen from '../screens/InstructorScreen';
import PlannerScreen from '../screens/PlannerScreen';
import ExamsScreen from '../screens/ExamsScreen';
import AiAssistantScreen from '../screens/AiAssistantScreen';
import AccountScreen from '../screens/AccountScreen';
import { COLORS } from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  // Android'de kenardan kenara (edge-to-edge) ekranda sistem gezinme çubuğuyla çakışmaması için
  // alt boşluk sabit değer yerine güvenli alan payından hesaplanır.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.textDark,
        tabBarStyle: {
          backgroundColor: '#0a0f1d',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Derslik') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'Program') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Hoca') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Taslak') {
            iconName = focused ? 'extension-puzzle' : 'extension-puzzle-outline';
          } else if (route.name === 'Sınav') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Asistan') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Hesap') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Derslik"
        component={EmptyClassroomsScreen}
        options={{ tabBarLabel: 'Boş Derslik' }}
      />
      <Tab.Screen
        name="Program"
        component={TimetableScreen}
        options={{ tabBarLabel: 'Program' }}
      />
      <Tab.Screen
        name="Hoca"
        component={InstructorScreen}
        options={{ tabBarLabel: 'Hoca' }}
      />
      <Tab.Screen
        name="Taslak"
        component={PlannerScreen}
        options={{ tabBarLabel: 'Taslak' }}
      />
      <Tab.Screen
        name="Sınav"
        component={ExamsScreen}
        options={{ tabBarLabel: 'Sınavlar' }}
      />
      <Tab.Screen
        name="Asistan"
        component={AiAssistantScreen}
        options={{ tabBarLabel: 'AI Asistan' }}
      />
      <Tab.Screen
        name="Hesap"
        component={AccountScreen}
        options={{ tabBarLabel: 'Hesap' }}
      />
    </Tab.Navigator>
  );
}
