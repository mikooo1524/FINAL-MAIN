import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

// React Native's native Alert is unavailable on web. One accessible modal
// handles success, validation, and destructive confirmations on every platform.
let listener;
const pending = [];
export const Alert = { alert(title, message, buttons = [{ text: 'OK' }]) {
  pending.push({ title, message, buttons }); listener?.();
} };
export function FeedbackHost() {
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    listener = () => setDialog(current => current || pending.shift() || null);
    listener();
    return () => { listener = undefined; };
  }, []);
  function close(button) {
    setDialog(pending.shift() || null);
    Promise.resolve().then(() => button?.onPress?.()).catch(error => Alert.alert('Action failed', error.message));
  }
  return <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close()}>
    <View style={styles.overlay}><View style={styles.card} accessibilityViewIsModal>
      <Text style={styles.title}>{dialog?.title}</Text><Text style={styles.message}>{dialog?.message}</Text>
      <ScrollView>{dialog?.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button"
        onPress={() => close(button)} style={[styles.button, button.style === 'destructive' && styles.danger]}>
        <Text style={styles.label}>{button.text}</Text>
      </Pressable>)}</ScrollView>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#102137AA', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: colors.surface, padding: 24, borderRadius: 24 },
  title: { fontSize: 22, fontWeight: '900', color: colors.navy },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22, marginVertical: 16 },
  button: { padding: 14, backgroundColor: colors.teal, borderRadius: 12, marginTop: 8, alignItems: 'center' },
  danger: { backgroundColor: colors.danger }, label: { color: '#FFFFFF', fontWeight: '800' },
});
