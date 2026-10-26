import { CheckoutScreen } from '../frontend/screens/customerScreens';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function CheckoutRoute() {
  return <CheckoutScreen navigation={useCompatNavigation()} />;
}
