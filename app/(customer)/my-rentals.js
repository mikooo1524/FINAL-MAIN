import { MyRentalsScreen } from '../../frontend/screens/customerScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';

export default function RentalsRoute() {
  return <MyRentalsScreen navigation={useCompatNavigation()} />;
}
