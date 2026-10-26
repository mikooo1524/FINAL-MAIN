import { AdminReportsScreen } from '../../frontend/screens/adminScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';
export default function Screen() { return <AdminReportsScreen navigation={useCompatNavigation()} />; }
