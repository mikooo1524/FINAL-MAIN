import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';
import { waitForWebDatabaseLock } from '../../backend/data/webDatabaseLock';

function DatabaseMessage({ title, message, retry = false, onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {retry ? (
        <Pressable accessibilityRole="button" onPress={onRetry || (() => window.location.reload())} style={styles.button}>
          <Text style={styles.buttonText}>Reload EventGear</Text>
        </Pressable>
      ) : <ActivityIndicator color={colors.teal} size="large" />}
    </View>
  );
}

class DatabaseErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      const locked = /NoModificationAllowedError|createSyncAccessHandle|Access Handle/i.test(String(error));
      return (
        <DatabaseMessage
          title={locked ? 'EventGear is open elsewhere' : 'Unable to open EventGear'}
          message={locked
            ? 'Close other EventGear tabs or windows, then reload this page. Your saved data will be kept.'
            : `Please reload and try again. ${error.message || String(error)}`}
          retry
          onRetry={() => { if (Platform.OS === 'web') window.location.reload(); else this.setState({ error: null }); }}
        />
      );
    }
    return this.props.children;
  }
}

function WebDatabaseGate({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    waitForWebDatabaseLock().then(
      () => { if (active) setReady(true); },
      (reason) => { if (active) setError(reason); }
    );
    return () => { active = false; };
  }, []);

  if (error) throw error;
  if (!ready) {
    return <DatabaseMessage title="Waiting to open EventGear" message="If EventGear is open in another tab or window, close it to continue here automatically." />;
  }
  return children;
}

export default function DatabaseGate({ children }) {
  if (Platform.OS !== 'web') return <DatabaseErrorBoundary>{children}</DatabaseErrorBoundary>;
  return (
    <DatabaseErrorBoundary>
      <WebDatabaseGate>{children}</WebDatabaseGate>
    </DatabaseErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  message: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', maxWidth: 440, marginVertical: 20 },
  button: { backgroundColor: colors.teal, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
