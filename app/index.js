import RoleSelectionScreen from '../frontend/screens/RoleSelectionScreen';
import { useCompatNavigation } from '../frontend/navigation/navigationCompat';

export default function RoleRoute() {
  return <RoleSelectionScreen navigation={useCompatNavigation()} />;
}
