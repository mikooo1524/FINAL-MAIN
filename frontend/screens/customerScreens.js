import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../components/feedback';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../context/AppContext';
import {
  createReservation,
  getAvailableQuantity,
  getEquipment,
  getEquipmentById,
  getRentalDetails,
  rentalDays,
  validDate,
  localToday,
  updateReservationContact,
  updateReservationStatus,
} from '../../backend/data/database';
import {
  EmptyState,
  EquipmentCard,
  EquipmentImage,
  InventoryStatus,
  Field,
  Money,
  PrimaryButton,
  SectionTitle,
  StatusPill,
} from '../components/components';
import { colors, radius, shadow } from '../styles/theme';

const bookingToday = Date.now();
const DEFAULT_START_DATE = new Date(bookingToday + 86400000).toISOString().slice(0, 10);
const DEFAULT_END_DATE = new Date(bookingToday + 172800000).toISOString().slice(0, 10);

function screenTitle(navigation, title) {
  navigation.setOptions({ title });
}

export function CustomerHomeScreen({ navigation }) {
  const { equipment, rentals, refreshEquipment, refreshRentals, customer } = useApp();
  useFocusEffect(useCallback(() => { Promise.all([refreshEquipment(), refreshRentals()]).catch(error => Alert.alert('Could not refresh', error.message)); }, [refreshEquipment, refreshRentals]));
  const active = rentals.filter((r) => ['pending', 'confirmed'].includes(r.status));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>WELCOME, {customer?.name?.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>Plan the event.{`\n`}Rent the gear.</Text>
          </View>
          <Text style={styles.heroEmoji}>🎊</Text>
        </View>
        <Text style={styles.heroText}>Reserve trusted event equipment in a few simple steps.</Text>
        <PrimaryButton title="Browse equipment" onPress={() => navigation.navigate('Equipment')} style={styles.heroButton} />
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}><Text style={styles.statNumber}>{equipment.length}</Text><Text style={styles.statLabel}>Available items</Text></View>
        <View style={styles.statCard}><Text style={styles.statNumber}>{active.length}</Text><Text style={styles.statLabel}>Active rentals</Text></View>
      </View>

      <SectionTitle title="Featured equipment" action="See all" onAction={() => navigation.navigate('Equipment')} />
      {equipment.slice(0, 3).map((item) => (
        <EquipmentCard key={item.equipment_id} item={item} compact onPress={() => navigation.navigate('EquipmentDetails', { equipmentId: item.equipment_id })} />
      ))}
    </ScrollView>
  );
}

export function EquipmentListScreen({ navigation }) {
  const { db } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const categories = ['All', 'Audio', 'Lighting', 'Furniture', 'Tents', 'Visual'];

  const load = useCallback(async () => {
    try { setItems(await getEquipment(db, search, category)); } catch (error) { Alert.alert('Could not load equipment', error.message); }
  }, [db, search, category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.page}>
      <FlatList
        testID="equipment-catalog"
        data={items}
        keyExtractor={(item) => String(item.equipment_id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search equipment" placeholderTextColor="#8793A5" style={styles.searchInput} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map((name) => (
                <Pressable key={name} onPress={() => setCategory(name)} style={[styles.chip, category === name && styles.chipActive]}>
                  <Text style={[styles.chipText, category === name && styles.chipTextActive]}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.resultCount}>{items.length} result{items.length === 1 ? '' : 's'}</Text>
            <Text style={styles.resultCount}>Available stock reflects the busiest booked dates. Choose rental dates to check exact availability.</Text>
          </>
        }
        renderItem={({ item }) => <EquipmentCard item={item} onPress={() => navigation.navigate('EquipmentDetails', { equipmentId: item.equipment_id })} />}
        ListEmptyComponent={<EmptyState icon="🔎" title="No equipment found" message="Try another search term or category." />}
      />
    </SafeAreaView>
  );
}

export function EquipmentDetailsScreen({ navigation, route }) {
  const { db, addToCart, cartReady } = useApp();
  const [item, setItem] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [quantityText, setQuantityText] = useState('1');

  useFocusEffect(useCallback(() => {
    let active = true;
    getEquipmentById(db, route.params.equipmentId).then((row) => {
      if (!active) return;
      setItem(row);
      if (row) screenTitle(navigation, row.name);
    }).catch(error => Alert.alert('Could not load equipment', error.message)).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [db, navigation, route.params.equipmentId]));

  if (!item) return <EmptyState title={loaded ? 'Equipment not found' : 'Loading equipment…'} message={loaded ? 'This listing may have been removed.' : 'Please wait.'} action={loaded ? 'Go back' : undefined} onAction={() => navigation.goBack()} />;
  const maxQuantity = Math.max(1, item.total_quantity);
  const quantity = Math.max(1, Math.min(Number(quantityText) || 1, maxQuantity));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.detailsContent}>
      <View style={styles.detailsVisual}><EquipmentImage item={item} fallbackStyle={styles.detailsEmoji} /></View>
      <Text style={styles.detailsCategory}>{item.category}</Text>
      <Text style={styles.detailsTitle}>{item.name}</Text>
      <View style={styles.priceLine}><Money value={item.daily_rate} style={{ fontSize: 24 }} /><Text style={styles.perDayLarge}> per day</Text></View>
      <Text style={styles.description}>{item.description}</Text>
      <InventoryStatus item={item} />

      <View style={styles.infoBox}>
        <View><Text style={styles.infoLabel}>Total units owned</Text><Text style={styles.infoValue}>{item.total_quantity} units</Text></View>
        <View style={styles.infoDivider} />
        <View><Text style={styles.infoLabel}>Availability</Text><Text style={styles.infoValue}>Checked at booking</Text></View>
      </View>

      <Text style={styles.fieldHeading}>Quantity</Text>
      <View style={styles.quantityRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" disabled={quantity <= 1}
          onPress={() => setQuantityText(String(Math.max(1, quantity - 1)))} style={styles.qtyButton}><Text style={styles.qtyButtonText}>−</Text></Pressable>
        <TextInput accessibilityLabel="Quantity" style={styles.qtyValue} value={quantityText}
          keyboardType="number-pad" inputMode="numeric" selectTextOnFocus
          onChangeText={text => {
            const digits = text.replace(/[^0-9]/g, '');
            setQuantityText(digits === '' ? '' : String(Math.min(Number(digits), maxQuantity)));
          }}
          onBlur={() => setQuantityText(String(quantity))}
          onSubmitEditing={() => setQuantityText(String(quantity))} />
        <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" disabled={quantity >= maxQuantity}
          onPress={() => setQuantityText(String(Math.min(maxQuantity, quantity + 1)))} style={styles.qtyButton}><Text style={styles.qtyButtonText}>+</Text></Pressable>
      </View>

      <PrimaryButton
        title={`Add ${quantity} to cart`}
        disabled={!cartReady || !item.is_active || item.total_quantity < 1}
        onPress={() => {
          try { addToCart(item, quantity); } catch (error) { Alert.alert('Cannot add item', error.message); return; }
          Alert.alert('Added to cart', `${quantity} × ${item.name} added to your cart.`, [
            { text: 'Keep browsing' },
            { text: 'View cart', onPress: () => navigation.navigate('CustomerTabs', { screen: 'Cart' }) },
          ]);
        }}
        style={{ marginTop: 28 }}
      />
    </ScrollView>
  );
}

export function CartScreen({ navigation }) {
  const { cart, cartReady, updateCartQuantity, removeFromCart } = useApp();
  const dailySubtotal = cart.reduce((sum, item) => sum + item.daily_rate * item.quantity, 0);

  if (!cartReady) return <EmptyState title="Loading your cart…" message="Please wait." />;
  if (!cart.length) {
    return (
      <View style={styles.page}>
        <EmptyState icon="🛒" title="Your cart is empty" message="Choose equipment first, then select dates during booking." action="Browse equipment" onAction={() => navigation.navigate('Equipment')} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <Text style={styles.pageHeading}>Review your equipment</Text>
      <Text style={styles.pageLead}>Rental dates and availability are checked on the next step.</Text>

      {cart.map((item) => (
        <View key={item.equipment_id} style={styles.cartCard}>
          <View style={styles.cartEmoji}><EquipmentImage item={item} fallbackStyle={{ fontSize: 31 }} /></View>
          <View style={styles.cartBody}>
            <Text style={styles.cartName}>{item.name}</Text>
            <Money value={item.daily_rate} />
            <View style={styles.inlineQty}>
              <CartQuantityControl item={item} onChange={quantity => updateCartQuantity(item.equipment_id, quantity)} />
              <Pressable onPress={() => Alert.alert('Remove from cart?', item.name, [{ text: 'Keep', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { removeFromCart(item.equipment_id); Alert.alert('Removed', 'The item was removed from your cart.'); } }])}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Daily subtotal</Text>
        <Money value={dailySubtotal} style={{ fontSize: 22 }} />
        <Text style={styles.totalNote}>Final total = daily subtotal x inclusive rental days</Text>
      </View>
      <PrimaryButton title="Continue to booking" onPress={() => navigation.getParent()?.navigate('Booking')} />
    </ScrollView>
  );
}

function CartQuantityControl({ item, onChange }) {
  const [draft, setDraft] = useState(null);
  const maximum = Math.max(1, item.total_quantity);
  function change(value) {
    setDraft(null);
    onChange(Math.max(1, Math.min(value, maximum)));
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${item.name} quantity`}
      disabled={item.quantity <= 1} onPress={() => change(item.quantity - 1)} style={styles.smallQty}><Text>−</Text></Pressable>
    <TextInput accessibilityLabel={`${item.name} quantity`} style={styles.inlineQtyValue}
      value={draft ?? String(item.quantity)} keyboardType="number-pad" inputMode="numeric" selectTextOnFocus
      onChangeText={text => {
        const digits = text.replace(/[^0-9]/g, '');
        if (digits === '') setDraft('');
        else change(Number(digits));
      }}
      onBlur={() => { if (draft !== null) change(Number(draft) || 1); }}
      onSubmitEditing={() => { if (draft !== null) change(Number(draft) || 1); }} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${item.name} quantity`}
      disabled={item.quantity >= maximum} onPress={() => change(item.quantity + 1)} style={styles.smallQty}><Text>+</Text></Pressable>
  </>;
}

// Validate user input first; check SQLite stock before building the checkout draft.
export function BookingScreen({ navigation }) {
  const { db, cart, setBookingDraft, customer } = useApp();
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [contact, setContact] = useState(customer?.contact || '');
  const [note, setNote] = useState('Birthday event - venue details to follow');
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState({});

  async function continueToCheckout() {
    const nextErrors = {};
    if (!cart.length) { Alert.alert('Empty cart', 'Add equipment before booking.'); return; }
    const days = rentalDays(startDate, endDate);
    if (!validDate(startDate) || startDate < localToday()) nextErrors.startDate = 'Enter a real date, today or later (YYYY-MM-DD).';
    if (!validDate(endDate) || !Number.isFinite(days) || days < 1) nextErrors.endDate = 'End date must be on or after the start date.';
    if (!contact.trim()) nextErrors.contact = 'Contact information is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setChecking(true);
    try {
      for (const item of cart) {
        const available = await getAvailableQuantity(db, item.equipment_id, startDate, endDate);
        if (item.quantity > available) throw new Error(`${item.name}: only ${available} available for these dates.`);
      }
      setBookingDraft({ startDate, endDate, contact: contact.trim(), note: note.trim(), items: cart });
      navigation.navigate('Checkout');
    } catch (error) {
      Alert.alert('Availability issue', error.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.pageHeading}>Booking schedule</Text>
      <Text style={styles.pageLead}>Use the YYYY-MM-DD format. Stock is checked against pending and confirmed bookings.</Text>
      <View style={styles.twoFields}>
        <Field label="Start date" value={startDate} onChangeText={setStartDate} error={errors.startDate} autoCapitalize="none" containerStyle={styles.halfField} />
        <Field label="End date" value={endDate} onChangeText={setEndDate} error={errors.endDate} autoCapitalize="none" containerStyle={styles.halfField} />
      </View>
      <Field label="Customer contact" value={contact} onChangeText={setContact} error={errors.contact} keyboardType="phone-pad" />
      <Field label="Event or delivery note" value={note} onChangeText={setNote} multiline />
      <View style={styles.notice}><Text style={styles.noticeIcon}>✓</Text><Text style={styles.noticeText}>Cancelled reservations do not reserve stock.</Text></View>
      <PrimaryButton title="Check availability" onPress={continueToCheckout} loading={checking} />
    </ScrollView>
  );
}

export function CheckoutScreen({ navigation }) {
  const { bookingDraft } = useApp();
  if (!bookingDraft) return <EmptyState title="No booking details" message="Return to your cart and complete the schedule first." />;
  const days = rentalDays(bookingDraft.startDate, bookingDraft.endDate);
  const total = bookingDraft.items.reduce((sum, item) => sum + item.daily_rate * item.quantity * days, 0);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <Text style={styles.pageHeading}>Confirm booking details</Text>
      <View style={styles.summaryCard}>
        <SummaryRow label="Rental dates" value={`${bookingDraft.startDate} to ${bookingDraft.endDate}`} />
        <SummaryRow label="Rental duration" value={`${days} day${days === 1 ? '' : 's'}`} />
        <SummaryRow label="Contact" value={bookingDraft.contact} />
        <SummaryRow label="Event note" value={bookingDraft.note || 'None'} last />
      </View>

      <SectionTitle title="Equipment" />
      {bookingDraft.items.map((item) => (
        <View key={item.equipment_id} style={styles.lineItem}>
          <Text style={styles.lineItemName}>{item.name} x{item.quantity}</Text>
          <Money value={item.daily_rate * item.quantity * days} />
        </View>
      ))}
      <View style={styles.grandTotal}><Text style={styles.grandTotalLabel}>Total rental cost</Text><Money value={total} style={{ fontSize: 26, color: colors.tealDark }} /></View>
      <PrimaryButton title="Continue to demo payment" onPress={() => navigation.navigate('Payment')} />
      <Text style={styles.disclaimer}>No actual online charge will be processed.</Text>
    </ScrollView>
  );
}

function SummaryRow({ label, value, last }) {
  return <View style={[styles.summaryRow, last && { borderBottomWidth: 0 }]}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

// Demonstration payment records a selected method, never an actual charge.
export function PaymentScreen({ navigation }) {
  const { db, bookingDraft, clearCart, refreshRentals, refreshEquipment, setBookingDraft, customer } = useApp();
  const [method, setMethod] = useState('Cash on pickup');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const methods = ['Cash on pickup', 'GCash demonstration', 'Bank transfer demonstration'];

  async function confirmBooking() {
    if (!bookingDraft || saving || !customer) return;
    setSaving(true);
    try {
      const result = await createReservation(db, { ...bookingDraft, paymentMethod: method }, customer.user_id);
      setConfirmation(result);
      clearCart();
      setBookingDraft(null);
      await Promise.all([refreshRentals(), refreshEquipment()]);
    } catch (error) {
      Alert.alert('Could not create reservation', error.message);
    } finally {
      setSaving(false);
    }
  }

  if (confirmation) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.successContent}>
        <View style={styles.successCircle}><Text style={styles.successCheck}>✓</Text></View>
        <Text style={styles.successTitle}>Reservation created!</Text>
        <Text style={styles.successText}>Your equipment is pending admin confirmation.</Text>
        <View style={styles.bookingCodeBox}><Text style={styles.bookingCodeLabel}>BOOKING ID</Text><Text style={styles.bookingCode}>{confirmation.bookingCode}</Text></View>
        <Money value={confirmation.total} style={{ fontSize: 28, marginVertical: 20 }} />
        <StatusPill status="pending" />
        <PrimaryButton title="View My Rentals" onPress={() => navigation.navigate('CustomerTabs', { screen: 'My Rentals' })} style={{ alignSelf: 'stretch', marginTop: 30 }} />
        <PrimaryButton variant="secondary" title="Return home" onPress={() => navigation.navigate('CustomerTabs', { screen: 'Home' })} style={{ alignSelf: 'stretch', marginTop: 10 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <Text style={styles.pageHeading}>Demo payment</Text>
      <Text style={styles.pageLead}>Choose a method to record for the classroom transaction. This screen does not charge money.</Text>
      {methods.map((option) => (
        <Pressable key={option} onPress={() => setMethod(option)} style={[styles.paymentOption, method === option && styles.paymentOptionActive]}>
          <View style={[styles.radio, method === option && styles.radioActive]}>{method === option && <View style={styles.radioDot} />}</View>
          <Text style={styles.paymentText}>{option}</Text>
        </Pressable>
      ))}
      <View style={styles.warningBox}><Text style={styles.warningTitle}>Demonstration only</Text><Text style={styles.warningText}>No card, GCash account, bank account, or payment gateway is connected.</Text></View>
      <PrimaryButton title="Confirm reservation" onPress={confirmBooking} loading={saving} disabled={!bookingDraft} />
    </ScrollView>
  );
}

export function MyRentalsScreen({ navigation }) {
  const { rentals, refreshRentals } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refreshRentals(); }, [refreshRentals]));

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.listContent}
      data={rentals}
      keyExtractor={(item) => String(item.reservation_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshRentals(); setRefreshing(false); }} />}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.getParent()?.navigate('RentalDetails', { reservationId: item.reservation_id })} style={styles.rentalCard}>
          <View style={styles.rentalTop}><Text style={styles.bookingSmall}>{item.booking_code}</Text><StatusPill status={item.status} /></View>
          <Text style={styles.rentalItems} numberOfLines={2}>{item.item_names}</Text>
          <Text style={styles.rentalDates}>{item.start_date} → {item.end_date}</Text>
          <View style={styles.rentalBottom}><Text style={styles.itemCount}>{item.item_count} item type{item.item_count === 1 ? '' : 's'}</Text><Money value={item.total_amount} /></View>
        </Pressable>
      )}
      ListEmptyComponent={<EmptyState icon="📋" title="No rentals yet" message="Your completed booking transactions will appear here." action="Browse equipment" onAction={() => navigation.navigate('Equipment')} />}
    />
  );
}

export function RentalDetailsScreen({ navigation, route }) {
  const { db, refreshRentals, refreshEquipment, customer } = useApp();
  const customerId = customer?.user_id || -1;
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const loadDetails = useCallback(async () => {
    try {
      const next = await getRentalDetails(db, route.params.reservationId, customer);
      setData(next); setContact(next.reservation?.booking_contact || ''); setNote(next.reservation?.event_note || '');
      setStartDate(next.reservation?.start_date || ''); setEndDate(next.reservation?.end_date || '');
    } catch (error) { Alert.alert('Could not load rental', error.message); }
    finally { setLoaded(true); }
  }, [db, route.params.reservationId, customer]);
  useFocusEffect(useCallback(() => { loadDetails(); }, [loadDetails]));
  async function changeBooking(cancel = false) {
    if (busy) return;
    if (!cancel) {
      const next = {};
      if (!validDate(startDate) || startDate < localToday()) next.startDate = 'Enter a real date, today or later (YYYY-MM-DD).';
      if (!validDate(endDate) || !(rentalDays(startDate, endDate) >= 1)) next.endDate = 'End date must be on or after the start date.';
      if (!contact.trim()) next.contact = 'Contact information is required.';
      setErrors(next);
      if (Object.keys(next).length) return;
    }
    setBusy(true);
    try {
      if (cancel) await updateReservationStatus(db, route.params.reservationId, 'cancelled', customer);
      else await updateReservationContact(db, route.params.reservationId, contact, note, startDate, endDate, customerId);
      await Promise.all([loadDetails(), refreshRentals(), refreshEquipment()]);
      Alert.alert(cancel ? 'Reservation cancelled' : 'Details saved',
        cancel ? 'Reserved stock has been released.' : 'Your dates, contact, and event note have been updated. The total reflects your rental dates.',
        [{ text: 'OK', onPress: cancel ? undefined : () => navigation.replace('CustomerTabs', { screen: 'Home' }) }]);
    } catch (error) { Alert.alert('Could not update booking', error.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (data?.reservation) screenTitle(navigation, data.reservation.booking_code); }, [data, navigation]);
  if (!data?.reservation) return <EmptyState title={loaded ? 'Rental not found' : 'Loading rental…'} message={loaded ? 'The reservation is unavailable.' : 'Please wait.'} action={loaded ? 'Go back' : undefined} onAction={() => navigation.goBack()} />;
  const { reservation, items } = data;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.rentalDetailHeader}>
        <StatusPill status={reservation.status} />
        <Text style={styles.rentalDetailCode}>{reservation.booking_code}</Text>
        <Text style={styles.rentalDetailDate}>Created {reservation.created_at}</Text>
      </View>
      <View style={styles.summaryCard}>
        <SummaryRow label="Dates" value={`${reservation.start_date} to ${reservation.end_date}`} />
        <SummaryRow label="Contact" value={reservation.booking_contact} />
        <SummaryRow label="Payment record" value={`${reservation.demo_payment_method} (${reservation.demo_payment_status})`} />
        <SummaryRow label="Event note" value={reservation.event_note || 'None'} last />
      </View>
      <SectionTitle title="Reserved equipment" />
      {items.map((item) => (
        <View key={item.item_id} style={styles.lineItem}>
          <EquipmentImage item={item} style={{ width: 36, height: 36, marginRight: 8 }} fallbackStyle={{ fontSize: 24, marginRight: 8 }} />
          <Text style={styles.lineItemName}>{item.name} x{item.quantity}</Text>
          <Money value={item.line_total} />
        </View>
      ))}
      <View style={styles.grandTotal}><Text style={styles.grandTotalLabel}>Total</Text><Money value={reservation.total_amount} style={{ fontSize: 26 }} /></View>
      {route.params?.viewer !== 'management' && reservation.status === 'pending' && <>
        <SectionTitle title="Edit booking details" />
        <Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} error={errors.startDate} editable={!busy} />
        <Field label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} error={errors.endDate} editable={!busy} />
        <Text style={styles.pageLead}>Changing dates checks stock availability and recalculates the total using your booked daily rates.</Text>
        <Field label="Contact" value={contact} onChangeText={setContact} error={errors.contact} editable={!busy} />
        <Field label="Event note" value={note} onChangeText={setNote} multiline editable={!busy} />
        <PrimaryButton title="Save details" loading={busy} onPress={() => changeBooking()} />
      </>}
      {route.params?.viewer !== 'management' && ['pending', 'confirmed'].includes(reservation.status) && <PrimaryButton title="Cancel reservation" variant="danger" disabled={busy} style={{ marginTop: 12 }}
        onPress={() => Alert.alert('Cancel reservation?', 'This will release all reserved equipment.', [{ text: 'Keep booking', style: 'cancel' }, { text: 'Cancel reservation', style: 'destructive', onPress: () => changeBooking(true) }])} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  pageContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 38 },
  listContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 38 },
  formContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.large, padding: 22, marginBottom: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  heroEyebrow: { color: '#8DDFD7', fontWeight: '900', letterSpacing: 1, fontSize: 10 },
  heroTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', lineHeight: 34, marginTop: 8 },
  heroEmoji: { fontSize: 32, marginLeft: 4, flexShrink: 1 },
  heroText: { color: '#C8D6E5', fontSize: 14, lineHeight: 20, marginTop: 12, marginBottom: 18 },
  heroButton: { alignSelf: 'flex-start', minWidth: 170 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 16, borderWidth: 1, borderColor: colors.border },
  statNumber: { color: colors.navy, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.muted, marginTop: 3, fontSize: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 52 },
  searchIcon: { color: colors.muted, fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 16 },
  chips: { paddingVertical: 14, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#FFFFFF' },
  resultCount: { color: colors.muted, fontSize: 12, marginBottom: 10 },
  detailsContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  detailsVisual: { height: 250, overflow: 'hidden', borderRadius: radius.large, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  detailsEmoji: { fontSize: 100 },
  detailsCategory: { color: colors.tealDark, fontWeight: '900', letterSpacing: 1, fontSize: 11, marginTop: 22, textTransform: 'uppercase' },
  detailsTitle: { color: colors.text, fontWeight: '900', fontSize: 28, marginTop: 4 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', marginTop: 9 },
  perDayLarge: { color: colors.muted, fontSize: 14 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 17 },
  infoBox: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.medium, padding: 16, marginTop: 20, borderWidth: 1, borderColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 11 },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  infoDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 30 },
  fieldHeading: { color: colors.text, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  quantityRow: { flexDirection: 'row', alignItems: 'center' },
  qtyButton: { width: 46, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  qtyButtonText: { color: colors.navy, fontSize: 23, fontWeight: '700' },
  qtyValue: { minWidth: 58, maxWidth: 110, height: 44, marginHorizontal: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 0, textAlign: 'center', color: colors.text, fontSize: 19, fontWeight: '900' },
  pageHeading: { color: colors.text, fontSize: 25, fontWeight: '900', marginBottom: 5 },
  pageLead: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  cartCard: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, padding: 13, marginBottom: 12 },
  cartEmoji: { width: 72, height: 86, flexShrink: 0, overflow: 'hidden', borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  cartBody: { flex: 1, paddingLeft: 13 },
  cartName: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 5 },
  inlineQty: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  smallQty: { width: 30, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  inlineQtyValue: { width: 44, height: 28, marginHorizontal: 4, paddingHorizontal: 4, paddingVertical: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: '#FFFFFF', textAlign: 'center', color: colors.text, fontSize: 14, fontWeight: '800' },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 12, marginLeft: 8 },
  totalBox: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 18, marginVertical: 10, borderWidth: 1, borderColor: colors.border },
  totalLabel: { color: colors.muted, marginBottom: 5 },
  totalNote: { color: colors.muted, fontSize: 11, marginTop: 7 },
  twoFields: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  notice: { flexDirection: 'row', backgroundColor: colors.mint, borderRadius: 12, padding: 13, marginBottom: 20 },
  noticeIcon: { color: colors.success, fontWeight: '900', marginRight: 8 },
  noticeText: { flex: 1, color: colors.tealDark, fontSize: 12 },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border, ...shadow },
  summaryRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { color: colors.muted, fontSize: 11, marginBottom: 4 },
  summaryValue: { color: colors.text, fontWeight: '700', lineHeight: 20 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineItemName: { flex: 1, color: colors.text, fontWeight: '700' },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 24 },
  grandTotalLabel: { color: colors.text, fontWeight: '900', fontSize: 17 },
  disclaimer: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 10 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: radius.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 11 },
  paymentOptionActive: { borderColor: colors.teal, backgroundColor: colors.mint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  radioActive: { borderColor: colors.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
  paymentText: { color: colors.text, fontWeight: '700' },
  warningBox: { backgroundColor: '#FFF6DE', borderRadius: radius.medium, padding: 16, marginVertical: 10, marginBottom: 20 },
  warningTitle: { color: '#875C00', fontWeight: '900' },
  warningText: { color: '#875C00', lineHeight: 19, fontSize: 12, marginTop: 5 },
  successContent: { width: '100%', maxWidth: 900, alignSelf: 'center', flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  successCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  successCheck: { color: colors.success, fontSize: 41, fontWeight: '900' },
  successTitle: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 20 },
  successText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  bookingCodeBox: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 35, paddingVertical: 16, marginTop: 24 },
  bookingCodeLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1 },
  bookingCode: { color: colors.navy, fontSize: 22, fontWeight: '900', marginTop: 4 },
  rentalCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 17, borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow },
  rentalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingSmall: { color: colors.navy, fontWeight: '900' },
  rentalItems: { color: colors.text, fontWeight: '700', lineHeight: 20, marginTop: 14 },
  rentalDates: { color: colors.muted, fontSize: 12, marginTop: 6 },
  rentalBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 13 },
  itemCount: { color: colors.muted, fontSize: 11 },
  rentalDetailHeader: { alignItems: 'center', paddingVertical: 15, marginBottom: 18 },
  rentalDetailCode: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 13 },
  rentalDetailDate: { color: colors.muted, fontSize: 11, marginTop: 5 },
});
