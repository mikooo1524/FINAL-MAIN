import { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../frontend/context/AppContext';
import { Field } from '../frontend/components/components';
import { colors } from '../frontend/styles/theme';

export default function CustomerAuthScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const administratorSignIn = params.mode === 'administrator' || params.setup === 'administrator';
  const { customer, signIn, register } = useApp();
  const [creating, setCreating] = useState(!administratorSignIn && params.mode === 'signup');
  const [form, setForm] = useState({ name: '', contact: '', email: '', username: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function field(key, value) {
    if (key === 'contact') value = value.replace(/[^0-9]/g, '');
    if (creating && (key === 'password' || key === 'confirmPassword')) value = value.replace(/[^A-Za-z0-9]/g, '');
    setForm(current => ({ ...current, [key]: value }));
  }
  function switchMode(value) {
    setCreating(value); setError(''); field('password', ''); field('confirmPassword', '');
  }
  function close() {
    if (busy) return;
    if (router.canGoBack()) router.back();
    else router.replace('/role-selection');
  }
  async function submit() {
    if (busy) return;
    setError('');
    if (creating && !administratorSignIn && form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (creating) await register(form);
      else await signIn(administratorSignIn ? form.username : form.email, form.password);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  if (customer) return <Redirect href={customer.role === 'supplier' ? '/(supplier)' : customer.role === 'admin' ? '/(admin)' : '/(customer)'} />;
  return <KeyboardAvoidingView style={[styles.overlay, { paddingTop: Math.max(20, insets.top), paddingBottom: Math.max(20, insets.bottom) }]}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss customer sign in" disabled={busy} onPress={close} style={styles.backdrop} />
    <View style={styles.popup} accessibilityViewIsModal role="dialog" aria-modal accessibilityLabel={administratorSignIn ? 'Sign in as Administrator' : creating ? 'Create customer account' : 'Customer sign in'}>
    <ScrollView contentContainerStyle={styles.content} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Text style={styles.title}>{administratorSignIn ? 'Sign in as Administrator' : creating ? 'Create your account' : 'Welcome back'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close customer sign in" disabled={busy} hitSlop={8} onPress={close} style={styles.close}>
        <View pointerEvents="none" style={{ width: 12, height: 12 }}>
          <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
        </View>
      </Pressable>
    </View>
    <Text style={styles.lead}>{administratorSignIn ? 'Sign in with your administrator username and password.' : creating ? 'Create your account. New accounts start as customers.' : 'Sign in to your account.'}</Text>
      {creating && !administratorSignIn && <>
        <Field label="Full name" value={form.name} onChangeText={value => field('name', value)} autoComplete="name" editable={!busy} />
        <Field label="Contact number" value={form.contact} onChangeText={value => field('contact', value)} keyboardType="number-pad" inputMode="numeric" autoComplete="tel" editable={!busy} />
      </>}
      {administratorSignIn
        ? <Field label="Username" value={form.username} onChangeText={value => field('username', value)} autoCapitalize="none" autoCorrect={false} autoComplete="username" editable={!busy} maxLength={64} />
        : <Field label={creating ? 'Email' : 'Email or username'} value={form.email} onChangeText={value => field('email', value)} keyboardType={creating ? 'email-address' : 'default'} autoCapitalize="none" autoCorrect={false} autoComplete={creating ? 'email' : 'username'} editable={!busy} />}
      <Field label="Password" value={form.password} onChangeText={value => field('password', value)} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={creating ? 'new-password' : 'current-password'} editable={!busy} maxLength={128} />
      {creating && !administratorSignIn && <Field label="Confirm password" value={form.confirmPassword} onChangeText={value => field('confirmPassword', value)} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={128} />}
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <View style={[styles.actions, creating && { flexDirection: 'column-reverse' }]}>
        {!administratorSignIn && <Pressable accessibilityRole="button" disabled={busy} onPress={() => creating ? switchMode(false) : submit()}
          style={({ pressed }) => [styles.authButton, styles.signInButton, pressed && styles.pressed, busy && styles.disabled]}>
          {busy && !creating ? <ActivityIndicator color="#2FAFA4" /> : <Text style={styles.signInText}>Sign in</Text>}
        </Pressable>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => administratorSignIn || creating ? submit() : switchMode(true)}
          style={({ pressed }) => [styles.authButton, styles.createAccountButton, pressed && styles.pressed, busy && styles.disabled]}>
          {busy && (administratorSignIn || creating) ? <ActivityIndicator color="#FFFFFF" /> : <>
            <Text style={styles.createAccountButtonText}>{administratorSignIn ? 'Sign In' : 'Create an account'}</Text>
          </>}
        </Pressable>
      </View>
    </ScrollView>
    </View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 31, 58, 0.5)' },
  popup: { width: '100%', maxWidth: 440, maxHeight: '100%', backgroundColor: colors.surface, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  content: { padding: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  title: { flex: 1, fontSize: 25, fontWeight: '900', color: colors.navy },
  close: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
  closeLine: { position: 'absolute', top: 5, left: 0, width: 12, height: 2, borderRadius: 1, backgroundColor: colors.tealDark },
  lead: { color: colors.muted, lineHeight: 21, marginBottom: 22 },
  error: { color: colors.danger, marginBottom: 14, lineHeight: 20 },
  actions: { gap: 12, marginTop: 4 },
  authButton: { width: '100%', minHeight: 50, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  signInButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C6D2DE' },
  signInText: { color: '#2FAFA4', fontSize: 16, fontWeight: '700' },
  createAccountButton: { backgroundColor: '#2FAFA4' },
  createAccountButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
