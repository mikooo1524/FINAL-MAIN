import { CustomerHomeScreen } from '../../frontend/screens/customerScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';

export default function CustomerHomeRoute() {
  return <CustomerHomeScreen navigation={useCompatNavigation()} />;
}
