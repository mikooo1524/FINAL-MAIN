import { useCallback, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { Alert } from '../components/feedback';
import { getAdminReservations, getAdminEquipmentFilters, updateReservationStatus, nextStatuses } from '../../backend/data/database';
import { EmptyState, Money, StatusPill } from '../components/components';
import { colors, radius, shadow } from '../styles/theme';

export function AdminBookingsScreen({ navigation }) {
  const { db, customer, refreshEquipment, refreshRentals } = useApp();
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
        getAdminReservations(db, customer, statusFilter, equipmentFilter),
        getAdminEquipmentFilters(db, customer),
      ]);
      if (id === request.current) { setItems(bookings); setGearOptions(gear); }
    } catch (error) { if (id === request.current) Alert.alert('Could not load reservations', error.message); }
    finally { if (id === request.current) setRefreshing(false); }
  }, [db, customer, statusFilter, equipmentFilter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setStatus(reservationId, status) {
    setBusy(reservationId);
    try {
      await updateReservationStatus(db, reservationId, status, customer);
      await Promise.all([load(), refreshEquipment(), refreshRentals()]);
      Alert.alert('Status updated', `Reservation is now ${status}.`);
    } catch (error) { Alert.alert('Could not update status', error.message); }
    finally { setBusy(null); }
  }

  function chooseStatus(item) {
    Alert.alert(`Update ${item.booking_code}`, 'Choose the next reservation status.', [
      ...nextStatuses(item.status).map(status => ({ text: status[0].toUpperCase() + status.slice(1),
        style: status === 'cancelled' ? 'destructive' : 'default', onPress: () => setStatus(item.reservation_id, status) })),
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={[styles.listContent, styles.adminBookingsContent]}
      data={items}
      keyExtractor={(item) => String(item.reservation_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListHeaderComponent={<>
          <BookingFilters label="Booking status" options={['All', 'pending', 'confirmed', 'cancelled', 'completed'].map(value => ({ value, label: value === 'All' ? 'All statuses' : value[0].toUpperCase() + value.slice(1) }))}
            selected={statusFilter} onSelect={setStatusFilter} />
          <GearBookingFilter options={gearOptions} selected={equipmentFilter} onSelect={setEquipmentFilter} />
          <Text style={styles.matchingBookings} accessibilityLiveRegion="polite">{refreshing ? 'Loading bookings…' : `${items.length} matching booking${items.length === 1 ? '' : 's'}`}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setStatusFilter('All'); setEquipmentFilter(null); }}
            style={({ pressed }) => [styles.clearFilters, pressed && { opacity: 0.75 }]}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </Pressable>
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
            <Pressable disabled={busy === item.reservation_id || !nextStatuses(item.status).length} onPress={() => chooseStatus(item)} style={styles.statusButton}><Text style={styles.statusButtonText}>{busy === item.reservation_id ? 'Saving…' : nextStatuses(item.status).length ? 'Update status' : 'Closed'}</Text></Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="📋" title={refreshing ? 'Loading bookings…' : 'No matching bookings'} message="Try a different status or gear filter. New customer bookings will appear here." />}
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
  listContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  editActionText: { color: colors.tealDark, fontWeight: '800', fontSize: 12 },
  reservationCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 17, borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow },
  reservationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { color: colors.navy, fontWeight: '900' },
  customer: { color: colors.text, fontWeight: '900', fontSize: 17, marginTop: 14 },
  itemNames: { color: colors.muted, lineHeight: 20, marginTop: 5 },
  dates: { color: colors.muted, fontSize: 12, marginTop: 7 },
  reservationBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 13 },
  statusButton: { backgroundColor: colors.navy, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  statusButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 }
});
