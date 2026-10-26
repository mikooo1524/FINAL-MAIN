import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../frontend/context/AppContext';
import { FeedbackHost } from '../frontend/components/feedback';
import DatabaseGate from '../frontend/components/DatabaseGate';
import { initializeDatabase } from '../backend/data/database';
import { colors } from '../frontend/styles/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.teal,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <View style={styles.loadingLogo}><Text style={styles.loadingEmoji}>🎉</Text></View>
      <Text style={styles.loadingTitle}>Preparing EventGear</Text>
      <ActivityIndicator color={colors.teal} size="large" style={{ marginTop: 16 }} />
    </View>
  );
}

function Navigation() {
  const { canAccessCustomer, canAccessAdmin } = useApp();
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="role-selection" options={{ headerShown: false }} />
        <Stack.Screen name="customer-auth" options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Protected guard={canAccessCustomer}>
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="equipment-details" options={{ title: 'Equipment Details' }} />
        <Stack.Screen name="booking" options={{ title: 'Booking' }} />
        <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
        <Stack.Screen name="payment" options={{ title: 'Demo Payment' }} />
        </Stack.Protected>
        <Stack.Protected guard={canAccessAdmin}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="equipment-form" options={{ title: 'Equipment' }} />
        </Stack.Protected>
        <Stack.Screen name="rental-details" options={{ title: 'Rental Details' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseGate>
        <Suspense fallback={<LoadingScreen />}>
          <SQLiteProvider databaseName="eventgear.db" onInit={initializeDatabase} useSuspense>
            <AppProvider>
              <Navigation />
              <FeedbackHost />
            </AppProvider>
          </SQLiteProvider>
        </Suspense>
      </DatabaseGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  loadingLogo: { width: 80, height: 80, borderRadius: 22, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  loadingEmoji: { fontSize: 40 },
  loadingTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 18 },
});
