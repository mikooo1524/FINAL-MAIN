import { Redirect, useLocalSearchParams } from 'expo-router';
import { AdminEquipmentFormScreen } from '../frontend/screens/adminEquipmentScreens';
import { useApp } from '../frontend/context/AppContext';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function EquipmentFormRoute() {
  const params = useLocalSearchParams();
  const navigation = useCompatNavigation();
  const { canAccessAdmin } = useApp();
  if (!canAccessAdmin) return <Redirect href="/role-selection" />;
  return <AdminEquipmentFormScreen navigation={navigation} route={{ params }} />;
}
