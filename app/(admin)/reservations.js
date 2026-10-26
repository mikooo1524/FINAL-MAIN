import { AdminBookingsScreen } from '../../frontend/screens/AdminBookingsScreen';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';
export default function Screen() { return <AdminBookingsScreen navigation={useCompatNavigation()} />; }
