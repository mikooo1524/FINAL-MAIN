import { EquipmentListScreen } from '../../frontend/screens/customerScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';

export default function EquipmentRoute() {
  return <EquipmentListScreen navigation={useCompatNavigation()} />;
}
