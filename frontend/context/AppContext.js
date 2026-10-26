import { Alert } from '../components/feedback';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { getCart, persistCart, getCustomerRentals, getEquipment, registerCustomer, signInCustomer } from '../../backend/data/database';

// Context shares SQLite-backed lists and cart state across nested screens.
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const db = useSQLiteContext();
  const [equipment, setEquipment] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [cartState, setCartState] = useState({ owner: null, items: [] });
  const customerId = customer?.role === 'customer' ? customer.user_id : null;
  const canSwitchRoles = customer?.role === 'admin';
  const canAccessCustomer = customer?.role === 'customer';
  const canAccessSupplier = !!customer && (canSwitchRoles || customer.role === 'supplier');
  const canAccessAdmin = !!customer && (customer.role === 'admin');
  const canAccessManagement = canAccessSupplier || canAccessAdmin;
  const currentCustomer = useRef(null);
  const cart = useMemo(() => cartState.owner === customerId ? cartState.items : [], [cartState, customerId]);
  const cartReady = customerId !== null && cartState.owner === customerId;
  const setCart = useCallback(update => {
    setCartState(current => {
      if (!customerId || current.owner !== customerId) return current;
      return { owner: customerId, items: typeof update === 'function' ? update(current.items) : update };
    });
  }, [customerId]);
  const [bookingDraft, setBookingDraft] = useState(null);

  const refreshEquipment = useCallback(async () => {
    try { setEquipment(await getEquipment(db)); } catch (error) { Alert.alert('Could not refresh equipment', error.message); }
  }, [db]);

  const refreshRentals = useCallback(async () => {
    if (!customerId) return;
    try {
      const next = await getCustomerRentals(db, customerId);
      if (currentCustomer.current === customerId) setRentals(next);
    } catch (error) { Alert.alert('Could not refresh rentals', error.message); }
  }, [db, customerId]);

  useEffect(() => {
    let active = true;
    Promise.all([getEquipment(db), customerId ? getCustomerRentals(db, customerId) : [], customerId ? getCart(db, customerId) : []]).then(([nextEquipment, nextRentals, savedCart]) => {
      if (!active) return;
      setEquipment(nextEquipment);
      setRentals(nextRentals);
      setCartState({ owner: customerId, items: savedCart });
    }).catch(error => Alert.alert('Could not load data', error.message));
    return () => { active = false; };
  }, [db, customerId]);

  // Save cart changes to SQLite after initial hydration, so a restart retains them.
  useEffect(() => {
    if (cartReady) persistCart(db, cartState.items, customerId).catch(error => Alert.alert('Could not save cart', error.message));
  }, [db, cartState, cartReady, customerId]);

  const acceptCustomer = useCallback(profile => {
    currentCustomer.current = profile.user_id;
    setCartState({ owner: null, items: [] }); setRentals([]); setBookingDraft(null);
    setCustomer(profile);
    return profile;
  }, []);
  const signIn = useCallback(async (email, password) => acceptCustomer(await signInCustomer(db, email, password, Crypto.getRandomBytesAsync)), [db, acceptCustomer]);
  const register = useCallback(async (form, setupAdministrator = false) => acceptCustomer(await registerCustomer(db, form, Crypto.getRandomBytesAsync, setupAdministrator)), [db, acceptCustomer]);
  const signOut = useCallback(() => {
    currentCustomer.current = null;
    setCustomer(null); setCartState({ owner: null, items: [] }); setRentals([]); setBookingDraft(null);
  }, []);
  const addToCart = useCallback((item, quantity = 1) => {
    if (!cartReady) throw new Error('Please wait for your cart to load.');
    if (!item.is_active || item.total_quantity < 1) throw new Error('This equipment is out of stock.');
    const inCart = cart.find(row => row.equipment_id === item.equipment_id)?.quantity || 0;
    if (inCart + quantity > item.total_quantity) throw new Error(`Only ${item.total_quantity} units are in stock; ${inCart} are already in your cart.`);
    setCart((current) => {
      const existing = current.find((row) => row.equipment_id === item.equipment_id);
      if (existing) {
        return current.map((row) =>
          row.equipment_id === item.equipment_id
            ? { ...row, quantity: Math.min(row.quantity + quantity, item.total_quantity) }
            : row
        );
      }
      return [...current, { ...item, quantity }];
    });
  }, [cart, cartReady, setCart]);

  const updateCartQuantity = useCallback((equipmentId, quantity) => {
    setCart((current) =>
      current.map((item) =>
        item.equipment_id === equipmentId
          ? { ...item, quantity: Math.max(1, Math.min(quantity, item.total_quantity)) }
          : item
      )
    );
  }, [setCart]);

  const removeFromCart = useCallback((equipmentId) => {
    setCart((current) => current.filter((item) => item.equipment_id !== equipmentId));
  }, [setCart]);

  const value = useMemo(
    () => ({
      db,
      customer, signIn, register, signOut, cartReady, canSwitchRoles, canAccessManagement, canAccessCustomer, canAccessSupplier, canAccessAdmin,
      equipment,
      rentals,
      cart,
      bookingDraft,
      setBookingDraft,
      refreshEquipment,
      refreshRentals,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart: () => setCart([]),
    }),
    [
      db,
      customer, signIn, register, signOut, cartReady, setCart, canSwitchRoles, canAccessManagement, canAccessCustomer, canAccessSupplier, canAccessAdmin,
      equipment,
      rentals,
      cart,
      bookingDraft,
      refreshEquipment,
      refreshRentals,
      addToCart,
      updateCartQuantity,
      removeFromCart,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
