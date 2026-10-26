import { SupplierReservationsScreen } from '../../frontend/screens/supplierScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';
export default function Screen() { return <SupplierReservationsScreen admin navigation={useCompatNavigation()} />; }
