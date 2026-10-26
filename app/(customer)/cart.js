import { CartScreen } from '../../frontend/screens/customerScreens';
import { useCompatNavigation } from '../../frontend/navigation/navigationCompat';

export default function CartRoute() {
  return <CartScreen navigation={useCompatNavigation()} />;
}
