import { SupplierDashboardScreen } from '../../frontend/screens/supplierScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';

export default function SupplierDashboardRoute() {
  return <SupplierDashboardScreen navigation={useCompatNavigation()} />;
}
