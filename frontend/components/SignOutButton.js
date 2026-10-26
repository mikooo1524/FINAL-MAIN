import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { colors } from '../styles/theme';

function ExitIcon({ color = '#FFFFFF', size = 18 }) {
  return <View style={{ width: size, height: size }} accessible={false} pointerEvents="none">
    <View style={{ position: 'absolute', left: 1, top: 1, width: size * 0.65, height: size - 2, borderWidth: 1.6, borderColor: color, borderRightWidth: 0, borderRadius: 3 }} />
    <View style={{ position: 'absolute', left: size * 0.4, top: size / 2 - 0.8, width: size * 0.55, height: 1.6, backgroundColor: color }} />
    <View style={{ position: 'absolute', right: 1, top: size / 2 - 3, width: 6, height: 6, borderTopWidth: 1.6, borderRightWidth: 1.6, borderColor: color, transform: [{ rotate: '45deg' }] }} />
  </View>;
}

export default function SignOutButton({ style }) {
  const { signOut } = useApp();
  const [visible, setVisible] = useState(false);
  function confirm() {
    setVisible(false);
    signOut();
    router.replace('/role-selection');
  }
  return <View style={style}>
    <Pressable accessibilityRole="button" accessibilityLabel="Sign out" hitSlop={5} onPress={() => setVisible(true)} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
      <ExitIcon /><Text style={styles.triggerText}>Sign out</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss sign out confirmation" onPress={() => setVisible(false)} />
        <View style={styles.card} accessibilityViewIsModal role="dialog" aria-modal accessibilityLabel="Sign out confirmation">
          <View style={styles.iconCircle}><ExitIcon color="#E5322B" size={24} /></View>
          <Text style={styles.title}>Sign out?</Text>
          <Text style={styles.message}>Are you sure you want to sign out{ '\n' }of your account?</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={({ pressed }) => [styles.action, styles.cancel, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirm} style={({ pressed }) => [styles.action, styles.confirm, pressed && styles.pressed]}>
              <ExitIcon size={16} /><Text style={styles.confirmText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#3B5065', borderRadius: 9, paddingHorizontal: 12, minHeight: 36 },
  triggerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(8, 23, 40, 0.65)', padding: 24, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 350, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  iconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FDEDEE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.navy },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  action: { flex: 1, minHeight: 44, borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  cancel: { borderWidth: 1, borderColor: '#C8D1DC', backgroundColor: '#FFFFFF' },
  confirm: { backgroundColor: '#E5322B' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
});
