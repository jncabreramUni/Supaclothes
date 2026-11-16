import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductVariant, SaleRequest } from '../types/api';

export interface CartLine {
  name: string;
  variant: ProductVariant;
  quantity: number;
}

export function estimateSaleCents(cart: CartLine[], discountBasisPoints: number) {
  // Spring rounds each line's discount before applying and rounding the tax.
  return cart.reduce((totals, { variant, quantity }) => {
    const subtotal = BigInt(Math.round(variant.price * 100)) * BigInt(quantity);
    const discount = (subtotal * BigInt(discountBasisPoints) + 5000n) / 10000n;
    const taxable = subtotal - discount;
    const taxRate = BigInt(Math.round(variant.taxRate * 100));
    const tax = (taxable * taxRate + 50n) / 100n;
    return {
      subtotal: totals.subtotal + subtotal,
      discount: totals.discount + discount,
      tax: totals.tax + tax,
      total: totals.total + taxable + tax,
    };
  }, { subtotal: 0n, discount: 0n, tax: 0n, total: 0n });
}

export function readAmountCents(input: string) {
  const value = input.trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function saleDraftKey(origin: string, username: string) {
  return `supaclothes.pending-sale/${encodeURIComponent(origin)}/${encodeURIComponent(username)}`;
}

export async function readPendingSale(key: string): Promise<SaleRequest | null> {
  const stored = await AsyncStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

export function savePendingSale(key: string, sale: SaleRequest) {
  return AsyncStorage.setItem(key, JSON.stringify(sale));
}

export function clearPendingSale(key: string) {
  return AsyncStorage.removeItem(key);
}
