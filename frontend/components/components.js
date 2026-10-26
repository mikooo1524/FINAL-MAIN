import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, shadow } from '../styles/theme';
import { isEquipmentPhoto } from '../utils/equipmentPhoto';

const equipmentImages = {
  'Folding Tables': require('../../assets/equipment images/Tables.png'),
  'LED Party Lights': require('../../assets/equipment images/Stage Lights.png'),
  'Monobloc Chairs': require('../../assets/equipment images/Chairs.png'),
  'Pop-up Canopy Tent': require('../../assets/equipment images/Tent.png'),
  'Portable Projector': require('../../assets/equipment images/Projector.png'),
  'Premium Sound System': require('../../assets/equipment images/Sound System.png'),
};

// Uploaded photos take priority; bundled photos keep the starter catalog intact.
export function EquipmentImage({ item, style, fallbackStyle }) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  const photo = isEquipmentPhoto(item.image_ref) ? item.image_ref : null;
  const source = photo && failedPhoto !== photo ? { uri: photo } : equipmentImages[item.name];
  if (!source) {
    return <Text style={fallbackStyle}>{photo ? '📦' : item.image_ref || '🎪'}</Text>;
  }
  return <Image source={source} accessibilityLabel={item.name} resizeMode="contain" style={[styles.equipmentImage, style]}
    onError={() => { if (photo) setFailedPhoto(photo); }} />;
}

export function Money({ value, style }) {
  return (
    <Text style={[styles.money, style]}>
      ₱{Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
    </Text>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading, variant = 'primary', style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.teal : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// Props let every form reuse the same labelled input and validation styling.
export function Field({ label, error, multiline, style, containerStyle, secureTextEntry, ...props }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const input = <TextInput
    accessibilityLabel={label}
    placeholderTextColor="#93A0B2"
    multiline={multiline}
    {...props}
    secureTextEntry={!!secureTextEntry && !passwordVisible}
    style={[styles.input, multiline && styles.multiline, error && styles.inputError, style, secureTextEntry && { paddingRight: 52 }]}
  />;
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      {secureTextEntry ? <View>
        {input}
        <Pressable accessibilityRole="button" accessibilityLabel={`${passwordVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          accessibilityState={{ disabled: props.editable === false }} disabled={props.editable === false}
          onPress={() => setPasswordVisible(visible => !visible)}
          style={({ pressed }) => [styles.passwordToggle, pressed && { opacity: 0.6 }]}>
          <View style={styles.eye} pointerEvents="none" accessible={false}>
            <View style={styles.eyePupil} />
            {!passwordVisible && <View style={styles.eyeSlash} />}
          </View>
        </Pressable>
      </View> : input}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EquipmentCard({ item, onPress, compact = false }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.emojiBox, compact && styles.emojiBoxCompact]}>
        <EquipmentImage item={item} fallbackStyle={compact ? styles.emojiCompact : styles.emoji} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.category}>{item.category}</Text>
        <Text numberOfLines={2} style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Money value={item.daily_rate} />
          <Text style={styles.perDay}> / day</Text>
        </View>
        <InventoryStatus item={item} />
      </View>
    </Pressable>
  );
}

export function InventoryStatus({ item }) {
  return <View>
    <Text style={styles.stock}>{item.inventory_status || 'In stock'}</Text>
    <Text style={styles.stock}>{item.available_quantity ?? item.total_quantity} available · {item.reserved_quantity ?? 0} reserved · {item.total_quantity} total</Text>
  </View>;
}

export function StatusPill({ status }) {
  const normalized = status || 'pending';
  return (
    <View style={[styles.pill, styles[`pill_${normalized}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${normalized}`]]}>
        {normalized.toUpperCase()}
      </Text>
    </View>
  );
}

export function EmptyState({ icon = '📦', title, message, action, onAction }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {!!action && <PrimaryButton title={action} onPress={onAction} style={{ marginTop: 18 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  passwordToggle: { position: 'absolute', right: 2, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 22, height: 14, borderWidth: 1.7, borderColor: colors.muted, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyePupil: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  eyeSlash: { position: 'absolute', width: 26, height: 2, backgroundColor: colors.muted, transform: [{ rotate: '-45deg' }] },
  button: {
    minHeight: 50,
    borderRadius: radius.medium,
    backgroundColor: colors.teal,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: { backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.teal },
  dangerButton: { backgroundColor: colors.danger },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryButtonText: { color: colors.tealDark },
  fieldWrap: { marginBottom: 16 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    minHeight: 50,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 94, paddingTop: 13, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, marginTop: 5, fontSize: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 21, color: colors.text, fontWeight: '900' },
  sectionAction: { color: colors.tealDark, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
    ...shadow,
  },
  emojiBox: { width: 104, height: 120, flexShrink: 0, overflow: 'hidden', borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  emojiBoxCompact: { width: 104, height: 112 },
  emoji: { fontSize: 47 },
  equipmentImage: { width: '100%', height: '100%' },
  emojiCompact: { fontSize: 36 },
  cardBody: { flex: 1, paddingLeft: 14, justifyContent: 'center' },
  category: { color: colors.tealDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  money: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  perDay: { color: colors.muted, fontSize: 12 },
  stock: { color: colors.muted, fontSize: 12, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  pill_pending: { backgroundColor: '#FFF3D6' },
  pill_confirmed: { backgroundColor: '#DDF6F2' },
  pill_completed: { backgroundColor: '#E5EEF9' },
  pill_cancelled: { backgroundColor: '#FCE4E4' },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  pillText_pending: { color: '#936300' },
  pillText_confirmed: { color: colors.success },
  pillText_completed: { color: colors.navySoft },
  pillText_cancelled: { color: colors.danger },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 35, paddingVertical: 70 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
});
