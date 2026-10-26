import { BookingScreen } from '../frontend/screens/customerScreens';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function BookingRoute() {
  return <BookingScreen navigation={useCompatNavigation()} />;
}
