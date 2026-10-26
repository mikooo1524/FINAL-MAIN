import { View } from 'react-native';

export const overviewAccent = 'rgb(8, 126, 128)';

function Line({ points: [x1, y1, x2, y2], color }) {
  const width = Math.hypot(x2 - x1, y2 - y1);
  return <View style={{ position: 'absolute', height: 2, width, borderRadius: 1, backgroundColor: color,
    left: (x1 + x2 - width) / 2, top: (y1 + y2) / 2 - 1,
    transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />;
}

export function OverviewGlyph({ name, color = overviewAccent, size = 26 }) {
  const circle = { position: 'absolute', borderWidth: 2, borderColor: color, borderRadius: 12 };
  const paths = {
    home: [[3, 10, 12, 2], [12, 2, 21, 10], [21, 10, 21, 22], [21, 22, 3, 22], [3, 22, 3, 10]],
    cart: [[2, 3, 5, 3], [5, 3, 8, 16], [8, 16, 20, 16], [6, 6, 22, 6], [22, 6, 20, 12], [20, 12, 7, 12]],
    clipboard: [[7, 10, 17, 10], [7, 14, 17, 14], [7, 18, 14, 18]],
    chart: [[3, 3, 3, 21], [3, 21, 22, 21], [7, 17, 7, 12], [12, 17, 12, 6], [17, 17, 17, 9]],
    calendar: [[4, 7, 20, 7], [8, 2, 8, 5], [16, 2, 16, 5]],
    clock: [[12, 6, 12, 12], [12, 12, 16, 14]],
    cube: [[12, 2, 21, 7], [21, 7, 21, 17], [21, 17, 12, 22], [12, 22, 3, 17], [3, 17, 3, 7], [3, 7, 12, 2], [3, 7, 12, 12], [21, 7, 12, 12], [12, 12, 12, 22]],
    check: [[7, 12, 10, 15], [10, 15, 17, 8]],
    tick: [[5, 12, 10, 17], [10, 17, 20, 6]],
    cancel: [[8, 8, 16, 16], [16, 8, 8, 16]],
  };
  return <View style={{ width: size, height: size }} accessible={false} pointerEvents="none">
    <View style={{ width: 24, height: 24, transformOrigin: 'top left', transform: [{ scale: size / 24 }] }}>
      {['clock', 'check', 'cancel'].includes(name) && <View style={[circle, { left: 2, top: 2, width: 20, height: 20 }]} />}
      {name === 'cart' && [9, 18].map(left => <View key={left} style={[circle, { left, top: 19, width: 4, height: 4, borderWidth: 1.5 }]} />)}
      {name === 'calendar' && <>
        <View style={{ position: 'absolute', left: 3, top: 4, width: 18, height: 18, borderRadius: 3, borderWidth: 2, borderColor: color }} />
        {[9, 14].flatMap(top => [7, 12, 17].map(left => <View key={`${top}-${left}`} style={{ position: 'absolute', left, top, width: 2, height: 2, backgroundColor: color }} />))}
      </>}
      {name === 'clipboard' && <>
        <View style={{ position: 'absolute', left: 3, top: 4, width: 18, height: 19, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
        <View style={{ position: 'absolute', left: 8, top: 1, width: 8, height: 6, borderWidth: 2, borderColor: color, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
      </>}
      {name === 'users' && <>
        <View style={[circle, { left: 5, top: 3, width: 7, height: 7 }]} />
        <View style={[circle, { left: 15, top: 4, width: 6, height: 6 }]} />
        <View style={{ position: 'absolute', left: 2, top: 13, width: 13, height: 8, borderWidth: 2, borderColor: color, borderTopLeftRadius: 7, borderTopRightRadius: 7 }} />
        <View style={{ position: 'absolute', left: 17, top: 13, width: 6, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderColor: color, borderTopRightRadius: 6 }} />
      </>}
      {(paths[name] || []).map((points, index) => <Line key={index} points={points} color={color} />)}
    </View>
  </View>;
}

export default function OverviewIcon({ icon, size = 40 }) {
  return <View style={{ width: size, height: size, flexShrink: 0, borderRadius: 12, backgroundColor: 'rgba(8, 126, 128, 0.10)', alignItems: 'center', justifyContent: 'center' }}>
    <OverviewGlyph name={icon} size={size * 0.65} />
  </View>;
}
