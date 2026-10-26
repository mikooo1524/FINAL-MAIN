import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { Alert } from '../components/feedback';
import { deleteEquipment, getEquipmentById, saveEquipment, updateEquipmentQuantity } from '../../backend/data/database';
import { EmptyState, EquipmentCard, EquipmentImage, Field, PrimaryButton } from '../components/components';
import { equipmentPhotoFromAsset, isEquipmentPhoto } from '../utils/equipmentPhoto';
import { colors, radius } from '../styles/theme';

export function AdminEquipmentScreen({ navigation }) {
  const { equipment, db, customer, refreshEquipment } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refreshEquipment().catch(error => Alert.alert('Could not refresh', error.message)); }, [refreshEquipment]));

  function askDelete(item) {
    Alert.alert('Remove equipment?', `${item.name} will be deleted if it has no active or future bookings.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await deleteEquipment(db, item.equipment_id, customer);
            await refreshEquipment();
            Alert.alert('Equipment removed', 'The listing was removed from the catalog. Historical bookings are preserved.');
          } catch (error) {
            Alert.alert('Cannot remove equipment', error.message);
          }
        },
      },
    ]);
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.listContent}
      data={equipment}
      keyExtractor={(item) => String(item.equipment_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshEquipment(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Pressable accessibilityRole="button" onPress={() => navigation.getParent()?.navigate('EquipmentForm')} style={styles.addButton}><Text style={styles.addButtonText}>+ Add Equipments</Text></Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.manageCard}>
          <EquipmentCard item={item} compact onPress={() => navigation.getParent()?.navigate('EquipmentForm', { equipmentId: item.equipment_id })} />
          <InventoryEditor item={item} />
          <View style={styles.manageActions}>
            <Pressable onPress={() => navigation.getParent()?.navigate('EquipmentForm', { equipmentId: item.equipment_id })} style={styles.editAction}><Text style={styles.editActionText}>Edit listing</Text></Pressable>
            <Pressable onPress={() => askDelete(item)} style={styles.deleteAction}><Text style={styles.deleteActionText}>Delete</Text></Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState title="No equipment" message="Add the first equipment listing." action="Add equipment" onAction={() => navigation.getParent()?.navigate('EquipmentForm')} />}
    />
  );
}

function InventoryEditor({ item }) {
  const { db, customer, refreshEquipment } = useApp();
  const [draftQuantity, setQuantity] = useState(null);
  const quantity = draftQuantity ?? String(item.total_quantity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await updateEquipmentQuantity(db, item.equipment_id, quantity, customer);
      await refreshEquipment();
      setQuantity(null);
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  return <View style={{ padding: 12 }}>
    <Field label={`Total units owned — ${item.name}`} value={quantity} onChangeText={setQuantity}
      keyboardType="number-pad" error={error} editable={!saving} />
    <PrimaryButton title="Update stock" onPress={save} loading={saving} disabled={quantity === String(item.total_quantity)} />
  </View>;
}

// One controlled form supports both CREATE and UPDATE by equipment ID.
export function AdminEquipmentFormScreen({ navigation, route }) {
  const { db, customer, refreshEquipment } = useApp();
  const equipmentId = route.params?.equipmentId;
  const [form, setForm] = useState({ name: '', category: '', description: '', dailyRate: '', totalQuantity: '', imageRef: '🎪' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: equipmentId ? 'Edit Equipment' : 'Add Equipment' });
    if (equipmentId) {
      getEquipmentById(db, equipmentId).then((item) => {
        if (item) setForm({ name: item.name, category: item.category, description: item.description, dailyRate: String(item.daily_rate), totalQuantity: String(item.total_quantity), imageRef: item.image_ref || '🎪' });
      }).catch(error => Alert.alert('Could not load listing', error.message));
    }
  }, [db, equipmentId, navigation]);

  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function choosePhoto() {
    if (saving || pickingPhoto) return;
    setPickingPhoto(true);
    try {
      // Launch directly from the tap on web so browsers allow the file dialog.
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photo access needed', 'Allow photo library access in Settings to choose a product photo.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'web', quality: 0.7, base64: true });
      if (result.canceled) return;
      setField('imageRef', equipmentPhotoFromAsset(result.assets[0]));
    } catch (error) { Alert.alert('Could not add photo', error.message); }
    finally { setPickingPhoto(false); }
  }

  async function submit() {
    if (saving || pickingPhoto) return;
    const next = {};
    if (!form.name.trim()) next.name = 'Equipment name is required.';
    if (!form.category.trim()) next.category = 'Category is required.';
    if (!form.description.trim()) next.description = 'Description is required.';
    if (!form.dailyRate.trim() || !Number.isFinite(Number(form.dailyRate)) || Number(form.dailyRate) < 0) next.dailyRate = 'Enter a valid daily rate.';
    if (!form.totalQuantity || Number(form.totalQuantity) < 0 || !Number.isInteger(Number(form.totalQuantity))) next.totalQuantity = 'Enter a whole-number quantity.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await saveEquipment(db, form, equipmentId, customer);
      await refreshEquipment();
      Alert.alert('Saved', equipmentId ? 'Equipment listing updated.' : 'Equipment listing created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Could not save', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.pageTitle}>{equipmentId ? 'Update listing' : 'Create a listing'}</Text>
      <Text style={styles.pageLead}>Keep your equipment details and stock up to date.</Text>
      <Text style={styles.photoLabel}>Product photo</Text>
      <View style={styles.photoPreview}>
        <EquipmentImage item={{ name: form.name, image_ref: form.imageRef }} fallbackStyle={{ fontSize: 48 }} />
      </View>
      <PrimaryButton title={isEquipmentPhoto(form.imageRef) ? 'Change photo' : '+ Add photo'} variant="secondary" onPress={choosePhoto} disabled={saving} loading={pickingPhoto} style={{ marginBottom: 12 }} />
      {isEquipmentPhoto(form.imageRef) && <Pressable accessibilityRole="button" disabled={saving} onPress={() => setField('imageRef', '🎪')} style={{ alignSelf: 'center', padding: 10, marginBottom: 12 }}>
        <Text style={styles.deleteActionText}>Remove photo</Text>
      </Pressable>}
      <Field label="Equipment name" value={form.name} onChangeText={(value) => setField('name', value)} error={errors.name} />
      <Field label="Category" value={form.category} onChangeText={(value) => setField('category', value)} error={errors.category} placeholder="Example: Audio" />
      <Field label="Description" value={form.description} onChangeText={(value) => setField('description', value)} error={errors.description} multiline />
      <Field label="Daily rate (PHP)" value={form.dailyRate} onChangeText={(value) => setField('dailyRate', value)} error={errors.dailyRate} keyboardType="decimal-pad" />
      <Field label="Total quantity" value={form.totalQuantity} onChangeText={(value) => setField('totalQuantity', value)} error={errors.totalQuantity} keyboardType="number-pad" />
      <PrimaryButton title={equipmentId ? 'Save changes' : 'Create equipment'} onPress={submit} loading={saving} disabled={pickingPhoto} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photoLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  photoPreview: { height: 190, backgroundColor: colors.mint, borderRadius: 16, overflow: 'hidden', marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, backgroundColor: colors.background },
  listContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  formContent: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  listHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 16 },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  pageLead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
  addButton: { backgroundColor: colors.teal, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900' },
  manageCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 0, marginBottom: 13 },
  manageActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 9, paddingBottom: 10 },
  editAction: { flex: 1, backgroundColor: colors.mint, borderRadius: 10, padding: 10, alignItems: 'center' },
  editActionText: { color: colors.tealDark, fontWeight: '800', fontSize: 12 },
  deleteAction: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FCE8E8' },
  deleteActionText: { color: colors.danger, fontWeight: '800', fontSize: 12 }
});
