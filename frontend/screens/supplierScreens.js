import { Alert } from '../components/feedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import {
  deleteEquipment,
  getEquipmentById,
  getSupplierReservations,
  getAdminReservations,
  getAdminEquipmentFilters,
  saveEquipment,
  updateEquipmentQuantity,
  updateReservationStatus,
  nextStatuses,
} from '../../backend/data/database';
import { EmptyState, EquipmentCard, EquipmentImage, Field, Money, PrimaryButton, StatusPill } from '../components/components';
import { equipmentPhotoFromAsset, isEquipmentPhoto } from '../utils/equipmentPhoto';
import { colors, radius, shadow } from '../styles/theme';
import { formatCompactNumber } from '../utils/numberFormatting';

export function SupplierDashboardScreen({ navigation }) {
  const { equipment, db, refreshEquipment } = useApp();
  const [reservations, setReservations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [bookings] = await Promise.all([getSupplierReservations(db), refreshEquipment()]);
      setReservations(bookings);
    } catch (error) { Alert.alert('Could not load dashboard', error.message); }
    finally { setRefreshing(false); }
  }, [db, refreshEquipment]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pending = reservations.filter((r) => r.status === 'pending').length;
  const confirmed = reservations.filter((r) => r.status === 'confirmed').length;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
      <View style={styles.supplierHero}>
        <Text style={styles.heroEyebrow}>TODAY’S OVERVIEW</Text>
        <Text style={styles.heroTitle}>Manage your{`\n`}equipment and{`\n`}reservations.</Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat value={equipment.length} label="Equipment" />
        <Stat value={pending} label="Pending" />
        <Stat value={confirmed} label="Confirmed" />
      </View>

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Manage Equipment')} style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.75 }]}>
        <View style={styles.actionIcon}><Text style={styles.actionEmoji}>📦</Text></View>
        <View style={styles.actionCopy}><Text style={styles.actionTitle}>Manage equipment</Text><Text style={styles.actionText}>Add, update, or remove your equipment.</Text></View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Reservations')} style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.75 }]}>
        <View style={styles.actionIcon}><Text style={styles.actionEmoji}>📋</Text></View>
        <View style={styles.actionCopy}><Text style={styles.actionTitle}>Review reservations</Text><Text style={styles.actionText}>View booking schedules and customer details.</Text></View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }) {
  return <View style={styles.stat}><Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCompactNumber(value)}</Text><Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text></View>;
}

export function ManageEquipmentScreen({ navigation }) {
  const { equipment, db, refreshEquipment } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refreshEquipment().catch(error => Alert.alert('Could not refresh', error.message)); }, [refreshEquipment]));

  function askDelete(item) {
    Alert.alert('Remove equipment?', `${item.name} will be deleted if it has no active or future bookings.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await deleteEquipment(db, item.equipment_id);
            await refreshEquipment();
            Alert.alert('Equipment removed', 'The listing was removed from the catalog. Historical bookings are preserved.');
          } catch (error) {
            Alert.alert('Cannot remove equipment', error.message);
          }
        },
      },
    ]);
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.listContent}
      data={equipment}
      keyExtractor={(item) => String(item.equipment_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshEquipment(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Pressable accessibilityRole="button" onPress={() => navigation.getParent()?.navigate('EquipmentForm')} style={styles.addButton}><Text style={styles.addButtonText}>+ Add Equipments</Text></Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.manageCard}>
          <EquipmentCard item={item} compact onPress={() => navigation.getParent()?.navigate('EquipmentForm', { equipmentId: item.equipment_id })} />
          <InventoryEditor item={item} />
          <View style={styles.manageActions}>
            <Pressable onPress={() => navigation.getParent()?.navigate('EquipmentForm', { equipmentId: item.equipment_id })} style={styles.editAction}><Text style={styles.editActionText}>Edit listing</Text></Pressable>
            <Pressable onPress={() => askDelete(item)} style={styles.deleteAction}><Text style={styles.deleteActionText}>Delete</Text></Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState title="No equipment" message="Add the supplier's first equipment listing." action="Add equipment" onAction={() => navigation.getParent()?.navigate('EquipmentForm')} />}
    />
  );
}

function InventoryEditor({ item }) {
  const { db, refreshEquipment } = useApp();
  const [draftQuantity, setQuantity] = useState(null);
  const quantity = draftQuantity ?? String(item.total_quantity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await updateEquipmentQuantity(db, item.equipment_id, quantity);
      await refreshEquipment();
      setQuantity(null);
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  return <View style={{ padding: 12 }}>
    <Field label={`Total units owned — ${item.name}`} value={quantity} onChangeText={setQuantity}
      keyboardType="number-pad" error={error} editable={!saving} />
    <PrimaryButton title="Update stock" onPress={save} loading={saving} disabled={quantity === String(item.total_quantity)} />
  </View>;
}

// One controlled form supports both CREATE and UPDATE by equipment ID.
export function EquipmentFormScreen({ navigation, route }) {
  const { db, customer, refreshEquipment } = useApp();
  const equipmentId = route.params?.equipmentId;
  const [form, setForm] = useState({ name: '', category: '', description: '', dailyRate: '', totalQuantity: '', imageRef: '🎪' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: equipmentId ? 'Edit Equipment' : 'Add Equipment' });
    if (equipmentId) {
      getEquipmentById(db, equipmentId).then((item) => {
        if (item) setForm({ name: item.name, category: item.category, description: item.description, dailyRate: String(item.daily_rate), totalQuantity: String(item.total_quantity), imageRef: item.image_ref || '🎪' });
      }).catch(error => Alert.alert('Could not load listing', error.message));
    }
  }, [db, equipmentId, navigation]);

  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function choosePhoto() {
    if (saving || pickingPhoto) return;
    setPickingPhoto(true);
    try {
      // Launch directly from the tap on web so browsers allow the file dialog.
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photo access needed', 'Allow photo library access in Settings to choose a product photo.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'web', quality: 0.7, base64: true });
      if (result.canceled) return;
      setField('imageRef', equipmentPhotoFromAsset(result.assets[0]));
    } catch (error) { Alert.alert('Could not add photo', error.message); }
    finally { setPickingPhoto(false); }
  }

  async function submit() {
    if (saving || pickingPhoto) return;
    const next = {};
    if (!form.name.trim()) next.name = 'Equipment name is required.';
    if (!form.category.trim()) next.category = 'Category is required.';
    if (!form.description.trim()) next.description = 'Description is required.';
    if (!form.dailyRate.trim() || !Number.isFinite(Number(form.dailyRate)) || Number(form.dailyRate) < 0) next.dailyRate = 'Enter a valid daily rate.';
    if (!form.totalQuantity || Number(form.totalQuantity) < 0 || !Number.isInteger(Number(form.totalQuantity))) next.totalQuantity = 'Enter a whole-number quantity.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await saveEquipment(db, form, equipmentId, customer?.user_id);
      await refreshEquipment();
      Alert.alert('Saved', equipmentId ? 'Equipment listing updated.' : 'Equipment listing created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Could not save', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.pageTitle}>{equipmentId ? 'Update listing' : 'Create a listing'}</Text>
      <Text style={styles.pageLead}>Keep your equipment details and stock up to date.</Text>
      <Text style={styles.photoLabel}>Product photo</Text>
      <View style={styles.photoPreview}>
        <EquipmentImage item={{ name: form.name, image_ref: form.imageRef }} fallbackStyle={{ fontSize: 48 }} />
      </View>
      <PrimaryButton title={isEquipmentPhoto(form.imageRef) ? 'Change photo' : '+ Add photo'} variant="secondary" onPress={choosePhoto} disabled={saving} loading={pickingPhoto} style={{ marginBottom: 12 }} />
      {isEquipmentPhoto(form.imageRef) && <Pressable accessibilityRole="button" disabled={saving} onPress={() => setField('imageRef', '🎪')} style={{ alignSelf: 'center', padding: 10, marginBottom: 12 }}>
        <Text style={styles.deleteActionText}>Remove photo</Text>
      </Pressable>}
      <Field label="Equipment name" value={form.name} onChangeText={(value) => setField('name', value)} error={errors.name} />
      <Field label="Category" value={form.category} onChangeText={(value) => setField('category', value)} error={errors.category} placeholder="Example: Audio" />
      <Field label="Description" value={form.description} onChangeText={(value) => setField('description', value)} error={errors.description} multiline />
      <Field label="Daily rate (PHP)" value={form.dailyRate} onChangeText={(value) => setField('dailyRate', value)} error={errors.dailyRate} keyboardType="decimal-pad" />
      <Field label="Total quantity" value={form.totalQuantity} onChangeText={(value) => setField('totalQuantity', value)} error={errors.totalQuantity} keyboardType="number-pad" />
      <PrimaryButton title={equipmentId ? 'Save changes' : 'Create equipment'} onPress={submit} loading={saving} disabled={pickingPhoto} />
    </ScrollView>
  );
}

export function SupplierReservationsScreen({ navigation, admin = false }) {
  const { db, refreshEquipment, refreshRentals } = useApp();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [equipmentFilter, setEquipmentFilter] = useState(null);
  const [gearOptions, setGearOptions] = useState([]);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setRefreshing(true);
    try {
      const [bookings, gear] = await Promise.all([
        admin ? getAdminReservations(db, statusFilter, equipmentFilter) : getSupplierReservations(db),
        admin ? getAdminEquipmentFilters(db) : Promise.resolve([]),
      ]);
      if (id === request.current) { setItems(bookings); setGearOptions(gear); }
    } catch (error) { if (id === request.current) Alert.alert('Could not load reservations', error.message); }
    finally { if (id === request.current) setRefreshing(false); }
  }, [db, admin, statusFilter, equipmentFilter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setStatus(reservationId, status) {
    if (!admin) return;
    setBusy(reservationId);
    try {
      await updateReservationStatus(db, reservationId, status);
      await Promise.all([load(), refreshEquipment(), refreshRentals()]);
      Alert.alert('Status updated', `Reservation is now ${status}.`);
    } catch (error) { Alert.alert('Could not update status', error.message); }
    finally { setBusy(null); }
  }

  function chooseStatus(item) {
    if (!admin) return;
    Alert.alert(`Update ${item.booking_code}`, 'Choose the next reservation status.', [
      ...nextStatuses(item.status).map(status => ({ text: status[0].toUpperCase() + status.slice(1),
        style: status === 'cancelled' ? 'destructive' : 'default', onPress: () => setStatus(item.reservation_id, status) })),
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={[styles.listContent, admin && styles.adminBookingsContent]}
      data={items}
      keyExtractor={(item) => String(item.reservation_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListHeaderComponent={<>
        {admin && <>
          <BookingFilters label="Booking status" options={['All', 'pending', 'confirmed', 'cancelled', 'completed'].map(value => ({ value, label: value === 'All' ? 'All statuses' : value[0].toUpperCase() + value.slice(1) }))}
            selected={statusFilter} onSelect={setStatusFilter} />
          <GearBookingFilter options={gearOptions} selected={equipmentFilter} onSelect={setEquipmentFilter} />
          <Text style={styles.matchingBookings} accessibilityLiveRegion="polite">{refreshing ? 'Loading bookings…' : `${items.length} matching booking${items.length === 1 ? '' : 's'}`}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setStatusFilter('All'); setEquipmentFilter(null); }}
            style={({ pressed }) => [styles.clearFilters, pressed && { opacity: 0.75 }]}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </Pressable>
        </>}
      </>}
      renderItem={({ item }) => (
        <View style={styles.reservationCard}>
          <View style={styles.reservationTop}><Text style={styles.code}>{item.booking_code}</Text><StatusPill status={item.status} /></View>
          <Text style={styles.customer}>{item.customer_name}</Text>
          <Text style={styles.itemNames}>{item.item_names}</Text>
          <Text style={styles.dates}>Contact: {item.booking_contact}</Text>
          {!!item.event_note && <Text style={styles.dates}>{item.event_note}</Text>}
          <Pressable onPress={() => navigation?.navigate('RentalDetails', { reservationId: item.reservation_id, viewer: 'management' })}><Text style={styles.editActionText}>View booking details ›</Text></Pressable>
          <Text style={styles.dates}>{item.start_date} → {item.end_date}</Text>
          <View style={styles.reservationBottom}>
            <Money value={item.total_amount} />
            {admin && <Pressable disabled={busy === item.reservation_id || !nextStatuses(item.status).length} onPress={() => chooseStatus(item)} style={styles.statusButton}><Text style={styles.statusButtonText}>{busy === item.reservation_id ? 'Saving…' : nextStatuses(item.status).length ? 'Update status' : 'Closed'}</Text></Pressable>}
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="📋" title={refreshing ? 'Loading bookings…' : admin ? 'No matching bookings' : 'No reservations yet'} message={admin ? 'Try a different status or gear filter. New customer bookings will appear here.' : 'Create a customer booking first, then return here as the supplier.'} />}
    />
  );
}

function BookingFilters({ label, options, selected, onSelect }) {
  return <View style={styles.filterSection}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.filterRows}>{[options.slice(0, 2), options.slice(2)].map((row, index) => <View key={index} style={styles.filterOptions}>{row.map(option => <Pressable key={String(option.value)}
      accessibilityRole="button" accessibilityState={{ selected: selected === option.value }}
      onPress={() => onSelect(option.value)} style={({ pressed }) => [styles.filterChip, selected === option.value && styles.filterActive, pressed && { opacity: 0.75 }]}>
      <Text style={[styles.filterText, styles.statusFilterText, selected === option.value && styles.filterTextActive]}>{option.label}</Text>
    </Pressable>)}</View>)}</View>
  </View>;
}

function GearBookingFilter({ options, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const selectedName = options.find(gear => gear.equipment_id === selected)?.name;
  function choose(value) { onSelect(value); setOpen(false); }
  return <View style={styles.filterSection}>
    <Text style={styles.fieldLabel}>Gear booked</Text>
    <View style={styles.gearButtons}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === null }} onPress={() => choose(null)}
        style={({ pressed }) => [styles.gearButton, selected === null && styles.filterActive, pressed && { opacity: 0.75 }]}>
        <BookingFilterIcon color={selected === null ? '#FFFFFF' : colors.tealDark} />
        <Text style={[styles.filterText, selected === null && styles.filterTextActive]}>All gear</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={selectedName ? `Filter gear: ${selectedName}` : 'Filter gear'}
        accessibilityState={{ expanded: open, selected: selected !== null }} onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.gearButton, styles.gearFilterButton, selected !== null && styles.filterActive, pressed && { opacity: 0.75 }]}>
        <BookingFilterIcon funnel color={selected !== null ? '#FFFFFF' : colors.tealDark} />
        <Text style={[styles.filterText, selected !== null && styles.filterTextActive]}>{selectedName || 'Filter gear'}</Text>
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.pickerOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close gear filter" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.pickerPanel} accessibilityViewIsModal>
          <View style={styles.pickerHeader}>
            <Text style={styles.fieldLabel}>Filter gear</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close gear filter" onPress={() => setOpen(false)} hitSlop={10}
              style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' }}>
              <View pointerEvents="none" style={{ width: 12, height: 12 }}>
                <View style={{ position: 'absolute', top: 5, left: 0, width: 12, height: 2, borderRadius: 1, backgroundColor: colors.tealDark, transform: [{ rotate: '45deg' }] }} />
                <View style={{ position: 'absolute', top: 5, left: 0, width: 12, height: 2, borderRadius: 1, backgroundColor: colors.tealDark, transform: [{ rotate: '-45deg' }] }} />
              </View>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {[{ equipment_id: null, name: 'All gear' }, ...options].map(gear => <Pressable key={String(gear.equipment_id)}
              accessibilityRole="radio" accessibilityState={{ checked: selected === gear.equipment_id }}
              onPress={() => choose(gear.equipment_id)} style={[styles.pickerOption, selected === gear.equipment_id && styles.filterActive]}>
              <Text style={[styles.filterText, selected === gear.equipment_id && styles.filterTextActive]}>{gear.name}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

// Draw small outline icons with native views so they work on mobile and web.
function BookingFilterIcon({ funnel = false, color }) {
  const segments = funnel
    ? [[3, 4, 21, 4], [3, 4, 10, 12], [21, 4, 14, 12], [10, 12, 10, 20], [14, 12, 14, 22], [10, 20, 14, 22]]
    : [[12, 2, 21, 7], [21, 7, 21, 17], [21, 17, 12, 22], [12, 22, 3, 17], [3, 17, 3, 7], [3, 7, 12, 2], [3, 7, 12, 12], [21, 7, 12, 12], [12, 12, 12, 22]];
  return <View style={{ width: 24, height: 24 }} accessible={false} pointerEvents="none">
    {segments.map(([x1, y1, x2, y2], index) => {
      const width = Math.hypot(x2 - x1, y2 - y1);
      return <View key={index} style={{ position: 'absolute', height: 1.8, width, backgroundColor: color,
        left: (x1 + x2 - width) / 2, top: (y1 + y2) / 2 - 0.9,
        transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />;
    })}
  </View>;
}

const styles = StyleSheet.create({
  photoLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  photoPreview: { height: 190, backgroundColor: colors.mint, borderRadius: 16, overflow: 'hidden', marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  adminBookingsContent: { padding: 20, paddingTop: 24 },
  filterSection: { marginBottom: 24 },
  fieldLabel: { color: colors.navy, fontSize: 17, fontWeight: '900', marginBottom: 12 },
  filterRows: { gap: 10 },
  filterOptions: { flexDirection: 'row', gap: 8 },
  filterChip: { flex: 1, minWidth: 0, backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.tealDark, paddingHorizontal: 6, paddingVertical: 14, borderRadius: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  statusFilterText: { fontSize: 14, textAlign: 'center' },
  filterActive: { backgroundColor: colors.tealDark },
  filterText: { color: colors.tealDark, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  filterTextActive: { color: '#FFFFFF' },
  gearButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gearButton: { flexGrow: 1, flexBasis: 125, minHeight: 54, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 17,
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  gearFilterButton: { borderWidth: 1, borderColor: colors.tealDark, backgroundColor: 'transparent' },
  matchingBookings: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 },
  clearFilters: { borderWidth: 1, borderColor: colors.tealDark, borderRadius: 18, minHeight: 60, backgroundColor: colors.mint,
    alignItems: 'center', justifyContent: 'center', padding: 16, marginBottom: 24 },
  clearFiltersText: { color: colors.tealDark, fontSize: 19, fontWeight: '900' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(11,31,58,0.45)', padding: 20, justifyContent: 'center', alignItems: 'center' },
  pickerPanel: { width: '100%', maxWidth: 480, maxHeight: '80%', padding: 22, backgroundColor: colors.surface, borderRadius: 22 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  pickerOption: { padding: 16, borderRadius: 14, backgroundColor: colors.mint },
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  listContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  formContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  supplierHero: { backgroundColor: '#E1F4F4', borderRadius: 22, padding: 22, paddingVertical: 24 },
  heroEyebrow: { color: colors.tealDark, fontSize: 12, fontWeight: '500', letterSpacing: 0.4 },
  heroTitle: { color: colors.navy, fontSize: 28, lineHeight: 33, fontWeight: '900', marginTop: 10 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 24 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 16, minHeight: 80, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.navy, fontWeight: '900', fontSize: 28, lineHeight: 34 },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.navy, fontWeight: '900', fontSize: 23, marginBottom: 14 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, minHeight: 92, marginBottom: 14, ...shadow },
  actionIcon: { width: 56, height: 56, flexShrink: 0, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  actionEmoji: { fontSize: 32 },
  actionCopy: { flex: 1, minWidth: 0, paddingHorizontal: 14 },
  actionTitle: { color: colors.navy, fontWeight: '900', fontSize: 16, lineHeight: 21 },
  actionText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  arrow: { color: colors.tealDark, fontSize: 30 },
  listHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 16 },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  pageLead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
  addButton: { backgroundColor: colors.teal, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900' },
  manageCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 0, marginBottom: 13 },
  manageActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 9, paddingBottom: 10 },
  editAction: { flex: 1, backgroundColor: colors.mint, borderRadius: 10, padding: 10, alignItems: 'center' },
  editActionText: { color: colors.tealDark, fontWeight: '800', fontSize: 12 },
  deleteAction: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FCE8E8' },
  deleteActionText: { color: colors.danger, fontWeight: '800', fontSize: 12 },
  reservationCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 17, borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow },
  reservationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { color: colors.navy, fontWeight: '900' },
  customer: { color: colors.text, fontWeight: '900', fontSize: 17, marginTop: 14 },
  itemNames: { color: colors.muted, lineHeight: 20, marginTop: 5 },
  dates: { color: colors.muted, fontSize: 12, marginTop: 7 },
  reservationBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 13 },
  statusButton: { backgroundColor: colors.navy, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  statusButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
});
