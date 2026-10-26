import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';

export default function SwitchRoleButton({ targetRole = 'supplier' }) {
  const { canSwitchRoles } = useApp();
  if (!canSwitchRoles) return null;
  const label = targetRole === 'admin' ? 'Admin' : 'Supplier';
  const destination = targetRole === 'admin' ? '/(admin)' : '/(supplier)';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${label}`} onPress={() => router.replace(destination)}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Text style={styles.label}>{'⇄ '}{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: '#3B5065',
    borderWidth: 1,
    borderColor: '#52677C',
    borderRadius: 9,
  },
  label: { color: '#FFFFFF', fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
