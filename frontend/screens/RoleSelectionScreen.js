import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../styles/theme';
import { useApp } from '../context/AppContext';
import { OverviewGlyph } from '../components/OverviewIcon';
import SignOutButton from '../components/SignOutButton';

const roles = [
  { key: 'CustomerTabs', icon: 'users', title: 'Continue as Customer', description: 'Browse equipment and manage your rentals.' },
  { key: 'SupplierTabs', icon: 'cube', title: 'Continue as Supplier', description: 'Manage equipment and view reservations.' },
  { key: 'Admin', icon: 'chart', title: 'Administrator', description: 'Manage users, bookings, and reports.' },
];

function EventTent() {
  return <View style={styles.tent} accessible={false} pointerEvents="none">
    <View style={styles.tentGround} /><View style={styles.tentRoof} /><View style={styles.tentRoofCenter} /><View style={styles.tentTrim} />
    {[38, 53, 147, 162].map(left => <View key={left} style={[styles.tentPole, { left }]} />)}
    <View style={styles.lightString} />
    {[58, 80, 102, 124, 146].map((left, index) => <View key={left} style={[styles.tentLight, { left, top: 83 + (2 - Math.abs(2 - index)) * 4 }]} />)}
  </View>;
}

function ChairIcon() {
  return <View style={styles.chair} accessible={false}>
    <View style={styles.chairBack} /><View style={styles.chairSeat} />
    <View style={[styles.chairLeg, { left: 8, transform: [{ rotate: '8deg' }] }]} />
    <View style={[styles.chairLeg, { right: 8, transform: [{ rotate: '-8deg' }] }]} />
  </View>;
}

export default function RoleSelectionScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const { customer, canAccessCustomer, canAccessSupplier, canAccessAdmin } = useApp();
  const availableRoles = roles.filter(role => role.key === 'CustomerTabs' ? canAccessCustomer : role.key === 'SupplierTabs' ? canAccessSupplier : canAccessAdmin);
  const openAuth = mode => navigation.navigate('CustomerAuth', { mode });
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.page}>
        <View style={[styles.hero, width < 360 && styles.heroCompact]}>
          {!!customer && <SignOutButton style={styles.signOut} />}
          <View style={styles.heroGlow} /><EventTent />
          <Text style={[styles.logo, width < 360 && { fontSize: 43 }]}>Event<Text style={styles.logoAccent}>Gear</Text></Text>
          <Text style={styles.tagline}>Book event equipment with ease.</Text>
          {!customer && <Pressable accessibilityRole="button" onPress={() => openAuth('administrator')}
            style={({ pressed }) => [styles.adminSignIn, pressed && styles.pressed]}>
            <Text style={styles.adminSignInText}>Sign in as Administrator</Text>
          </Pressable>}
        </View>
        <View style={styles.panel}>
          <View style={styles.features}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}><ChairIcon /></View>
              <Text style={styles.featureTitle}>Wide Selection</Text>
              <Text style={styles.featureDescription}>{'Everything you need\nfor any event.'}</Text>
            </View>
            <View style={styles.feature}>
              <View style={styles.featureIcon}><OverviewGlyph name="calendar" color="#193B50" size={40} /></View>
              <Text style={styles.featureTitle}>Easy Booking</Text>
              <Text style={styles.featureDescription}>{'Reserve in just\na few taps.'}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            {!customer && <>
              <Pressable accessibilityRole="button" onPress={() => openAuth('signup')} style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Create an account</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => openAuth('signin')} style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Sign in</Text>
              </Pressable>
            </>}
            {!!customer && availableRoles.map(role => <Pressable key={role.key} accessibilityRole="button" onPress={() => navigation.navigate(role.key)} style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}>
              <View style={styles.roleIcon}><OverviewGlyph name={role.icon} size={28} /></View>
              <View style={styles.roleCopy}><Text style={styles.roleTitle}>{role.title}</Text><Text style={styles.roleDescription}>{role.description}</Text></View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>)}
          </View>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#172F48' },
  scroll: { flexGrow: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', flexGrow: 1, backgroundColor: '#172F48' },
  hero: { alignItems: 'center', justifyContent: 'center', paddingTop: 56, paddingBottom: 64, paddingHorizontal: 20, overflow: 'hidden' },
  heroCompact: { paddingTop: 50, paddingBottom: 54 },
  signOut: { position: 'absolute', top: 8, right: 16, zIndex: 1 },
  adminSignIn: { position: 'absolute', top: 8, right: 16, zIndex: 1, minHeight: 36, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#64D6C8', backgroundColor: '#1C3953', alignItems: 'center', justifyContent: 'center' },
  adminSignInText: { fontSize: 12, fontWeight: '600', color: '#97EEE0' },
  heroGlow: { position: 'absolute', width: 360, height: 360, borderRadius: 180, backgroundColor: '#1C3953', top: -110, right: -130, opacity: 0.65 },
  logo: { fontSize: 50, fontWeight: '900', letterSpacing: -1.8, color: '#FFFFFF', marginTop: 12 },
  logoAccent: { color: '#64D6C8' },
  tagline: { color: '#BBC9D8', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 23 },
  panel: { flexGrow: 1, backgroundColor: colors.background, borderTopLeftRadius: 44, borderTopRightRadius: 44, marginTop: -20, paddingHorizontal: 24, paddingTop: 34, paddingBottom: 42, minHeight: 390 },
  features: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  feature: { flex: 1, alignItems: 'center' },
  featureIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#E2F5F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  featureTitle: { color: colors.navy, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  featureDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  actions: { marginTop: 36, gap: 14, width: '100%', maxWidth: 490, alignSelf: 'center' },
  button: { minHeight: 56, borderRadius: 32, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: '#2FAFA4', shadowColor: '#2FAFA4', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  secondaryButton: { borderWidth: 1.5, borderColor: '#BECAD8' },
  primaryText: { fontSize: 19, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  secondaryText: { fontSize: 19, fontWeight: '700', color: '#2FAFA4' },
  roleCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, gap: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  roleIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  roleCopy: { flex: 1 },
  roleTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  roleDescription: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  chevron: { fontSize: 28, color: colors.tealDark },
  pressed: { opacity: 0.8 },
  tent: { width: 210, height: 140 },
  tentGround: { position: 'absolute', left: 5, right: 5, bottom: 0, height: 3, backgroundColor: '#397680', borderRadius: 2 },
  tentRoof: { position: 'absolute', top: 0, left: 33, width: 0, height: 0, borderLeftWidth: 72, borderRightWidth: 72, borderBottomWidth: 66, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#64D6C8' },
  tentRoofCenter: { position: 'absolute', top: 0, left: 76, width: 0, height: 0, borderLeftWidth: 29, borderRightWidth: 29, borderBottomWidth: 66, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#2FAFA4' },
  tentTrim: { position: 'absolute', top: 63, left: 33, width: 144, height: 10, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, borderWidth: 2, borderColor: '#97EEE0', backgroundColor: '#43BDB2' },
  tentPole: { position: 'absolute', top: 72, bottom: 2, width: 4, borderRadius: 2, backgroundColor: '#EDFDFC' },
  lightString: { position: 'absolute', left: 53, top: 70, width: 98, height: 22, borderBottomWidth: 2, borderColor: '#EDFDFC', borderBottomLeftRadius: 50, borderBottomRightRadius: 50 },
  tentLight: { position: 'absolute', width: 7, height: 8, borderRadius: 4, backgroundColor: '#85E6DA' },
  chair: { width: 44, height: 48 },
  chairBack: { position: 'absolute', top: 0, left: 11, width: 23, height: 29, borderWidth: 2.5, borderColor: '#193B50', borderRadius: 7 },
  chairSeat: { position: 'absolute', top: 26, left: 7, width: 31, height: 9, borderWidth: 2.5, borderColor: '#193B50', borderRadius: 5, backgroundColor: '#E2F5F2' },
  chairLeg: { position: 'absolute', top: 34, height: 14, width: 2.5, backgroundColor: '#193B50', borderRadius: 2 },
});
