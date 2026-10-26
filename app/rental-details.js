import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../frontend/context/AppContext';
import { RentalDetailsScreen } from '../frontend/screens/customerScreens';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function RentalDetailsRoute() {
  const params = useLocalSearchParams();
  const navigation = useCompatNavigation();
  const { customer, canAccessAdmin, canAccessCustomer } = useApp();
  if (!customer) return <Redirect href="/customer-auth" />;
  if (params.viewer === 'management' && !canAccessAdmin) return <Redirect href="/role-selection" />;
  if (params.viewer !== 'management' && !canAccessCustomer) return <Redirect href="/role-selection" />;
  return <RentalDetailsScreen navigation={navigation} route={{ params }} />;
}
