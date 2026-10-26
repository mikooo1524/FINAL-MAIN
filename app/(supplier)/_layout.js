import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { colors } from '../../frontend/styles/theme';
import { OverviewGlyph } from '../../frontend/components/OverviewIcon';
import SignOutButton from '../../frontend/components/SignOutButton';
import SwitchRoleButton from '../../frontend/components/SwitchRoleButton';

const icons = { index: 'home', 'manage-equipment': 'cube', reservations: 'clipboard' };

export default function SupplierTabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800' },
        headerLeft: () => <Image source={require('../../assets/icon.png')} accessibilityLabel="EventGear" resizeMode="contain" style={{ width: 36, height: 36, marginLeft: 12, borderRadius: 8 }} />,
        headerRight: () => <SignOutButton style={{ marginRight: 12 }} />,
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: '#8490A1',
        tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color }) => <OverviewGlyph name={icons[route.name]} size={23} color={color} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', headerTitle: '', headerLeft: () => <SwitchRoleButton targetRole="admin" /> }} />
      <Tabs.Screen name="manage-equipment" options={{ title: 'Equipment', headerTitle: '' }} />
      <Tabs.Screen name="reservations" options={{ title: 'Reservations', headerTitle: '' }} />
    </Tabs>
  );
}
