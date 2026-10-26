import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { colors } from '../../frontend/styles/theme';
import { OverviewGlyph } from '../../frontend/components/OverviewIcon';
import SignOutButton from '../../frontend/components/SignOutButton';
const icons = { index: 'home', users: 'users', equipments: 'cube', reservations: 'clipboard', reports: 'chart' };
export default function AdminTabsLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerStyle: { backgroundColor: colors.navy }, headerTintColor: '#FFFFFF',
    headerLeft: () => <Image source={require('../../assets/icon.png')} accessibilityLabel="EventGear" resizeMode="contain" style={{ width: 36, height: 36, marginLeft: 12, borderRadius: 8 }} />,
    headerRight: () => <SignOutButton style={{ marginRight: 12 }} />,
    tabBarActiveTintColor: colors.tealDark, tabBarInactiveTintColor: '#8490A1',
    tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: '#FFFFFF' },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    tabBarIcon: ({ color }) => <OverviewGlyph name={icons[route.name]} size={23} color={color} /> })}>
    <Tabs.Screen name="index" options={{ title: 'Dashboard', headerTitle: '' }} />
    <Tabs.Screen name="users" options={{ title: 'Users', headerTitle: '' }} />
    <Tabs.Screen name="equipments" options={{ title: 'Equipments', headerTitle: '' }} />
    <Tabs.Screen name="reservations" options={{ title: 'Bookings', headerTitle: '' }} /><Tabs.Screen name="reports" options={{ title: 'Reports', headerTitle: '' }} />
  </Tabs>;
}
