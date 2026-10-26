import { useMemo } from 'react';
import { router, useNavigation } from 'expo-router';

// Map existing screen names to Expo Router paths (powered by React Navigation).
function targetFor(name, params = {}) {
  if (['users', 'reservations', 'reports'].includes(name)) return `/(admin)/${name}`;
  if (name === 'Admin') return '/(admin)';
  if (name === 'CustomerAuth') return { pathname: '/customer-auth', params };
  if (name === 'Equipment') return '/(customer)/equipment';
  if (name === 'Manage Equipment') return '/(supplier)/manage-equipment';
  if (name === 'Reservations') return '/(supplier)/reservations';
  if (name === 'CustomerTabs') {
    const child = params?.screen;
    return child === 'Cart'
      ? '/(customer)/cart'
      : child === 'My Rentals'
        ? '/(customer)/my-rentals'
        : child === 'Equipment'
          ? '/(customer)/equipment'
          : '/(customer)';
  }
  if (name === 'SupplierTabs') {
    const child = params?.screen;
    return child === 'Reservations'
      ? '/(supplier)/reservations'
      : child === 'Manage Equipment'
        ? '/(supplier)/manage-equipment'
        : '/(supplier)';
  }
  if (name === 'EquipmentDetails') {
    return { pathname: '/equipment-details', params };
  }
  if (name === 'RentalDetails') {
    return { pathname: '/rental-details', params };
  }
  if (name === 'EquipmentForm') {
    return { pathname: '/equipment-form', params };
  }
  if (name === 'Booking') return '/booking';
  if (name === 'Checkout') return '/checkout';
  if (name === 'Payment') return '/payment';
  return '/';
}

export function useCompatNavigation() {
  const navigation = useNavigation();

  return useMemo(() => {
    const compat = {
      navigate(name, params) {
        router.navigate(targetFor(name, params));
      },
      replace(name, params) {
        router.replace(targetFor(name, params));
      },
      goBack() {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
      setOptions(options) {
        navigation.setOptions(options);
      },
      getParent() {
        return compat;
      },
    };
    return compat;
  }, [navigation]);
}
