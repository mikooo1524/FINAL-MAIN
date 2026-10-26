import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { useApp } from '../../frontend/context/AppContext';
import { colors } from '../../frontend/styles/theme';
import { OverviewGlyph } from '../../frontend/components/OverviewIcon';
import SignOutButton from '../../frontend/components/SignOutButton';

const icons = { index: 'home', equipment: 'cube', cart: 'cart', 'my-rentals': 'clipboard' };

export default function CustomerTabsLayout() {
  const { cart } = useApp();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800' },
        headerLeft: () => <Image source={require('../../assets/icon.png')} accessibilityLabel="EventGear" resizeMode="contain" style={{ width: 36, height: 36, marginLeft: 12, marginRight: 8, borderRadius: 8 }} />,
        headerRight: () => <SignOutButton style={{ marginRight: 12 }} />,
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: '#8490A1',
        tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ color }) => <OverviewGlyph name={icons[route.name]} size={23} color={color} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'EventGear' }} />
      <Tabs.Screen name="equipment" options={{ title: 'Equipment' }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarBadge: count || undefined, tabBarBadgeStyle: { backgroundColor: colors.teal } }} />
      <Tabs.Screen name="my-rentals" options={{ title: 'My Rentals' }} />
    </Tabs>
  );
}
