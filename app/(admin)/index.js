import { AdminDashboardScreen } from '../../frontend/screens/adminScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';
export default function Screen() { return <AdminDashboardScreen navigation={useCompatNavigation()} />; }
