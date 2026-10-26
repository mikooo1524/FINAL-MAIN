import { useLocalSearchParams } from 'expo-router';
import { EquipmentDetailsScreen } from '../frontend/screens/customerScreens';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function EquipmentDetailsRoute() {
  const params = useLocalSearchParams();
  return <EquipmentDetailsScreen navigation={useCompatNavigation()} route={{ params }} />;
}
