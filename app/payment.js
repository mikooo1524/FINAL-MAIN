import { PaymentScreen } from '../frontend/screens/customerScreens';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function PaymentRoute() {
  return <PaymentScreen navigation={useCompatNavigation()} />;
}
