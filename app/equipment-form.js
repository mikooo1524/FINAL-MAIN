import { useLocalSearchParams } from 'expo-router';
import { EquipmentFormScreen } from '../frontend/screens/supplierScreens';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function EquipmentFormRoute() {
  const params = useLocalSearchParams();
  return <EquipmentFormScreen navigation={useCompatNavigation()} route={{ params }} />;
}
