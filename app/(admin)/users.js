import { AdminUsersScreen } from '../../frontend/screens/adminScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';
export default function Screen() { return <AdminUsersScreen navigation={useCompatNavigation()} />; }
