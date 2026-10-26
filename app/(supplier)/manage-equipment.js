import { ManageEquipmentScreen } from '../../frontend/screens/supplierScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';

export default function ManageEquipmentRoute() {
  return <ManageEquipmentScreen navigation={useCompatNavigation()} />;
}
