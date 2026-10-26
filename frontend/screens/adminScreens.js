import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { deleteUser, getAdminOverview, getAdminReportSummary, getAdminCustomers } from '../../backend/data/database';
import { Alert } from '../components/feedback';
import { EmptyState, EquipmentImage, Money, PrimaryButton, SectionTitle, StatusPill } from '../components/components';
import { colors } from '../styles/theme';
import OverviewIcon, { OverviewGlyph, overviewAccent } from '../components/OverviewIcon';
import { formatCompactNumber } from '../utils/numberFormatting';

// Focus refresh keeps administrator totals synchronized with equipment and booking changes.
function useOverview(period = null) {
  const { db, customer } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError('');
    try {
      const [overview, summary] = await Promise.all([getAdminOverview(db, customer), period ? getAdminReportSummary(db, customer, period) : Promise.resolve(null)]);
      if (id === request.current) setData({ ...overview, summary });
    }
    catch (reason) { if (id === request.current) setError(reason.message); }
    finally { if (id === request.current) setLoading(false); }
  }, [db, customer, period]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { data, loading, error, load };
}
function OverviewFallback({ loading, error, load }) {
  return <EmptyState title={loading ? 'Loading overview…' : 'Could not load overview'} message={error || 'Reading saved records.'} action={error ? 'Retry' : undefined} onAction={load} />;
}
export function AdminDashboardScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const state = useOverview();
  if (!state.data) return <OverviewFallback {...state} />;
  const { stats } = state.data;
  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, width < 480 && styles.dashboardMobileContent]}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.load} />}>
    <TodayOverview data={state.data} navigation={navigation} />
    <View style={styles.card}><Text style={styles.heading}>Confirmed rental value</Text><Money value={stats.value} style={{ fontSize: 28, marginTop: 8 }} />
      <Text style={styles.muted}>Confirmed and completed bookings. This is rental value, not collected payments.</Text></View>
    <SectionTitle title="Management" />
    {[['equipments', 'Equipment management', 'Add listings, edit details and update inventory.'], ['users', '👥 User directory', 'View and remove customer accounts.'], ['reservations', '📋 Reservations', 'Review customer bookings and update progress.'], ['reports', '📊 Reports & activity', 'Review status totals and recent database actions.']].map(([route, title, text]) =>
      <Pressable key={route} style={styles.card} onPress={() => navigation.navigate(route)}><Text style={styles.heading}>{title} ›</Text><Text style={styles.muted}>{text}</Text></Pressable>)}
    </ScrollView>;
}

function TodayOverview({ data, navigation }) {
  const { width } = useWindowDimensions();
  const [panelWidth, setPanelWidth] = useState(Math.min(width - 20, 864));
  const cardWidth = (panelWidth - 32 - 10) / 2;
  const iconSize = Math.min(52, cardWidth * 0.29);
  const labelSize = Math.min(16, cardWidth * 0.083);
  const labels = {
    'Today’s bookings': 'Today’s\nbookings',
    'Pending approvals': 'Pending\napprovals',
    'Confirmed rentals': 'Confirmed\nrentals',
  };
  const { todayStats, stats, statuses } = data;
  return <View style={styles.todayPanel} onLayout={event => setPanelWidth(event.nativeEvent.layout.width)}>
    <View style={styles.todayIntro}>
      <View style={styles.todayCopy}>
        <Text style={styles.todayEyebrow}>TODAY’S OVERVIEW</Text>
        <Text style={styles.todayTitle}>Here’s what’s{`\n`}happening today.</Text>
        <Text style={styles.todayDescription}>Check today’s bookings and upcoming rentals at a glance.</Text>
      </View>
      <View style={styles.calendarArt} accessible={false}>
        <View style={styles.calendarTop}><View style={styles.calendarRing} /><View style={styles.calendarRing} /></View>
        <View style={styles.calendarDays}>{Array.from({ length: 12 }, (_, index) => <View key={index} style={styles.calendarDay} />)}</View>
        <View style={styles.calendarCheck}><OverviewGlyph name="tick" color="#FFFFFF" size={20} /></View>
      </View>
    </View>
    <View style={styles.todayGrid}>{[
      ['Customers', stats.users, 'users', 'users'],
      ['Equipment', stats.equipment, 'cube', 'equipments'],
      ['Today’s bookings', todayStats.bookings, 'calendar', 'reservations'],
      ['Pending approvals', todayStats.pending, 'clock', 'reservations'],
      ['Confirmed rentals', statuses.find(row => row.status === 'confirmed')?.count || 0, 'check', 'reservations'],
      ['Cancelled', statuses.find(row => row.status === 'cancelled')?.count || 0, 'cancel', 'reservations'],
    ].map(([label, value, icon, route]) => <Pressable key={label} accessibilityRole={route ? 'button' : 'text'} disabled={!route}
      accessibilityLabel={`${label}: ${value}`} onPress={route ? () => navigation.navigate(route) : undefined}
      style={({ pressed }) => [styles.todayMetric, { padding: Math.min(14, cardWidth * 0.055), gap: Math.min(12, cardWidth * 0.055), minHeight: Math.max(84, cardWidth * 0.55) }, pressed && { opacity: 0.75 }]}>
      <OverviewIcon icon={icon} size={iconSize} />
      <View style={styles.overviewMetricCopy}>
        <Text style={[styles.overviewLabel, { fontSize: labelSize, lineHeight: labelSize * 1.35 }]}>{labels[label] || label}</Text>
        <Text style={[styles.overviewValue, { fontSize: Math.min(38, cardWidth * 0.18), lineHeight: Math.min(44, cardWidth * 0.21) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{formatCompactNumber(value)}</Text>
      </View>
    </Pressable>)}</View>
  </View>;
}
export function AdminUsersScreen() {
  const { db, customer, signOut } = useApp();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const savedUsers = await getAdminCustomers(db, customer);
      setUsers(savedUsers);
    } catch (error) { Alert.alert('Could not load users', error.message); }
    finally { setRefreshing(false); }
  }, [db, customer]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  function remove(user) {
    Alert.alert('Delete user?', `Remove ${user.name}? This action cannot be undone.`, [{ text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteUser(db, user.user_id, customer); }
        catch (error) { Alert.alert('Could not delete user', error.message); return; }
        if (customer?.user_id === user.user_id) signOut();
        await load(); Alert.alert('User deleted', 'The user record was removed.');
      } }]);
  }
  return <FlatList style={styles.page} contentContainerStyle={styles.content} data={users}
    keyExtractor={item => String(item.user_id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    ListHeaderComponent={<SectionTitle title={`Users (${users.length})`} />}
    renderItem={({ item }) => <View style={styles.card}><Text style={styles.heading}>{item.name}</Text><Text style={styles.muted}>{item.contact} • {item.role}</Text>
      {!!item.email && <Text style={styles.muted}>Email: {item.email}</Text>}
      <View style={styles.roles}><PrimaryButton title="Delete" variant="danger" onPress={() => remove(item)} /></View></View>} />;
}
export function AdminReportsScreen() {
  const [period, setPeriod] = useState('Day');
  const state = useOverview(period);
  if (!state.data) return <OverviewFallback {...state} />;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.load} />}>
    <ReportSummary summary={state.data.summary} period={period} onPeriodChange={setPeriod} />
    {['confirmed', 'cancelled', 'completed'].map(status => {
      const row = state.data.statuses.find(item => item.status === status);
      const count = row?.count || 0;
      const percent = state.data.stats.reservations ? Math.round(count / state.data.stats.reservations * 100) : 0;
      return <View key={status} style={styles.card}>
        <StatusPill status={status} />
        <Text style={[styles.statValue, { marginTop: 10 }]}>{count} booking{count === 1 ? '' : 's'}</Text>
        <Text style={styles.muted}>{percent}% of all bookings</Text>
        <View style={styles.barTrack} accessibilityLabel={`${status}: ${percent}% of all bookings`}>
          <View style={{ width: `${percent}%`, height: 10, backgroundColor: { confirmed: colors.success, cancelled: colors.danger, completed: colors.navySoft }[status], borderRadius: 8 }} />
        </View>
        <Text style={styles.heading}>{status[0].toUpperCase() + status.slice(1)} booking value</Text>
        <Money value={row?.total || 0} />
        {status === 'cancelled' && <Text style={styles.small}>Value of cancelled bookings; excluded from rental revenue totals.</Text>}
      </View>;
    })}
    <SectionTitle title="Reservation summary" />
    {state.data.statuses.length === 0 && <EmptyState title="No bookings yet" message="Complete a customer reservation to populate reports." />}
    {state.data.statuses.map(row => <View key={row.status} style={styles.card}><StatusPill status={row.status} /><Text style={styles.heading}>{row.count} booking(s)</Text><Money value={row.total} /></View>)}
  </ScrollView>;
}

function ReportSummary({ summary, period, onPeriodChange }) {
  const [showAll, setShowAll] = useState(false);
  const gear = summary?.gear || [];
  const maxRentals = Math.max(1, ...gear.map(item => item.rentals));
  return <View>
    <View style={styles.periodTabs}>{['Day', 'Month', 'Year'].map(value => <Pressable key={value}
      accessibilityRole="button" accessibilityState={{ selected: period === value }}
      onPress={() => onPeriodChange(value)} style={[styles.periodTab, period === value && styles.active]}>
      <Text style={[styles.periodText, period === value && { color: '#FFFFFF' }]}>{value}</Text>
    </Pressable>)}</View>
    <View style={styles.reportMetrics}>
      <View style={styles.reportMetric}>
        <View style={styles.metricIcon}><Text style={styles.metricSymbol}>₱</Text></View>
        <View style={styles.metricCopy}><Text style={styles.metricLabel}>Total revenue</Text>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}
            accessibilityLabel={`Total revenue: ${Number(summary?.revenue || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}`}>
            {formatCompactNumber(summary?.revenue, true)}
          </Text>
        </View>
      </View>
      <View style={styles.reportMetric}>
        <View style={styles.metricIcon}><Text style={styles.metricSymbol}>▦</Text></View>
        <View style={styles.metricCopy}><Text style={styles.metricLabel}>Total bookings</Text>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}
            accessibilityLabel={`${summary?.bookings || 0} total bookings`}>{formatCompactNumber(summary?.bookings)}</Text>
        </View>
      </View>
    </View>
    <View style={styles.card}>
      <View style={styles.topGearHeader}><Text style={styles.heading}>Top rented gear</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(value => !value)} style={styles.viewAll}>
          <Text style={styles.viewAllText}>{showAll ? 'Show less' : 'View all ›'}</Text>
        </Pressable>
      </View>
      {gear.length === 0 && <Text style={styles.muted}>No confirmed or completed rentals this {period.toLowerCase()}.</Text>}
      {(showAll ? gear : gear.slice(0, 3)).map(item => <View key={item.equipment_id} style={styles.topGearRow}>
        <View style={styles.gearImage}><EquipmentImage item={item} fallbackStyle={{ fontSize: 25 }} /></View>
        <View style={styles.gearCopy}><Text style={styles.gearName}>{item.name}</Text>
          <View style={styles.gearBarTrack}><View style={[styles.gearBar, { width: `${item.rentals / maxRentals * 100}%` }]} /></View>
        </View>
        <View style={styles.rentalCount}><Text style={styles.rentalValue}>{item.rentals}</Text><Text style={styles.metricLabel}>rentals</Text></View>
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  dashboardMobileContent: { paddingHorizontal: 10, paddingTop: 10 },
  todayPanel: { backgroundColor: '#EFFAFA', borderWidth: 1, borderColor: '#D7EFF0', borderRadius: 24, padding: 16, marginBottom: 16 },
  todayIntro: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  todayCopy: { flex: 1 },
  todayEyebrow: { color: '#526680', fontSize: 11, fontWeight: '900', marginBottom: 10 },
  todayTitle: { color: '#06152D', fontSize: 24, lineHeight: 29, fontWeight: '900', marginBottom: 10 },
  todayDescription: { color: '#526680', fontSize: 13, lineHeight: 20 },
  calendarArt: { width: 80, height: 84, backgroundColor: '#FFFFFF', borderRadius: 12, marginRight: 6 },
  calendarTop: { height: 19, backgroundColor: overviewAccent, borderTopLeftRadius: 12, borderTopRightRadius: 12, flexDirection: 'row', justifyContent: 'space-around' },
  calendarRing: { height: 14, width: 5, borderRadius: 3, backgroundColor: '#8DDFD7', marginTop: -5 },
  calendarDays: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 8 },
  calendarDay: { width: 13, height: 12, backgroundColor: 'rgba(8, 126, 128, 0.20)', borderRadius: 2 },
  calendarCheck: { position: 'absolute', right: -5, bottom: -2, width: 34, height: 34, borderRadius: 17, backgroundColor: overviewAccent, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  todayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  todayMetric: { flexGrow: 1, flexBasis: '46%', minWidth: 0, minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 18, backgroundColor: 'rgba(8, 126, 128, 0.07)' },
  overviewMetricCopy: { flex: 1, minWidth: 0 },
  overviewValue: { color: '#06152D', fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  overviewLabel: { color: '#526680', fontSize: 13, lineHeight: 18 },
  periodTabs: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 },
  periodTab: { flex: 1, borderRadius: 12, backgroundColor: colors.mint, padding: 12, alignItems: 'center' },
  periodText: { color: colors.tealDark, fontWeight: '800', fontSize: 15 },
  reportMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 16 },
  reportMetric: { flex: 1, minWidth: 145, flexDirection: 'row', gap: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 12, minHeight: 100, alignItems: 'center' },
  metricIcon: { width: 40, height: 44, flexShrink: 0, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  metricSymbol: { color: colors.tealDark, fontSize: 26, fontWeight: '800' },
  metricCopy: { flex: 1, minWidth: 0 },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricValue: { color: colors.navy, fontSize: 23, fontWeight: '900', marginTop: 4 },
  topGearHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 },
  viewAll: { backgroundColor: colors.mint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  viewAllText: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  topGearRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  gearImage: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#EDF6F7', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  gearCopy: { flex: 1 },
  gearName: { color: colors.navy, fontSize: 13, marginBottom: 8 },
  gearBarTrack: { height: 10, borderRadius: 8, backgroundColor: '#EAF3F5', overflow: 'hidden' },
  gearBar: { height: 10, borderRadius: 8, backgroundColor: colors.teal },
  rentalCount: { minWidth: 36 },
  rentalValue: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  barTrack: { height: 10, borderRadius: 8, backgroundColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  page: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  statValue: { fontSize: 28, fontWeight: '900', color: colors.navy }, card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  heading: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 }, small: { color: colors.muted, fontSize: 11, marginTop: 6 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, active: { backgroundColor: colors.teal },
});
