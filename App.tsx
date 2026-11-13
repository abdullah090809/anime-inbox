import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getState, hydrate, reloadPending, useStore } from './src/store';
import { applyToastSetting, ensureDirs } from './src/services/files';
import { processQueue, scanInbox } from './src/services/inbox';
import { syncBackgroundRegistration } from './src/services/background';
import { initNotifications } from './src/services/notify';
import { useColors } from './src/theme';
import type { RootStackParamList } from './src/navigation';

import InboxScreen from './src/screens/InboxScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import ListsScreen from './src/screens/ListsScreen';
import ListDetailScreen from './src/screens/ListDetailScreen';
import ExportScreen from './src/screens/ExportScreen';
import WatchedScreen from './src/screens/WatchedScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const c = useColors();
  const pending = useStore((s) => s.pending);
  const waiting = useMemo(() => pending.filter((p) => p.status !== 'queued' && p.status !== 'processing').length, [pending]);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.accentText,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, minHeight: 64 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const name =
            route.name === 'Inbox'
              ? focused ? 'file-tray-full' : 'file-tray-full-outline'
              : route.name === 'Lists'
                ? focused ? 'albums' : 'albums-outline'
                : focused ? 'settings' : 'settings-outline';
          return <Ionicons name={name as any} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarBadgeStyle: { backgroundColor: c.accent, color: c.onAccent },
          tabBarAccessibilityLabel: waiting > 0 ? 'Inbox, ' + waiting + ' to review' : 'Inbox',
        }}
      />
      <Tab.Screen name="Lists" component={ListsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const c = useColors();
  const hydrated = useStore((s) => s.hydrated);
  const busy = useRef(false);

  async function pickUp() {
    if (busy.current) return;
    busy.current = true;
    try {
      await reloadPending();
      await scanInbox();
      await processQueue();
    } catch {
      // problems show on the cards
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    (async () => {
      initNotifications();
      await hydrate();
      await ensureDirs();
      const s = getState().settings;
      await applyToastSetting(s.toastOnShare);
      await syncBackgroundRegistration(s.backgroundProcessing);
      await pickUp();
    })();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && getState().hydrated) void pickUp();
    });
    return () => sub.remove();
  }, []);

  const navTheme = useMemo(() => {
    const base = c.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.accentText },
    };
  }, [c]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accentText} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={c.isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Review" component={ReviewScreen} />
          <Stack.Screen name="ListDetail" component={ListDetailScreen} />
          <Stack.Screen name="Export" component={ExportScreen} />
          <Stack.Screen name="Watched" component={WatchedScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
