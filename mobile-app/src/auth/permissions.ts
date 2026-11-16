import type { Role } from '../types/api';

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administración',
  VENDEDOR: 'Ventas',
  BODEGA: 'Bodega',
};

export const canSell = (role?: Role) => role === 'ADMIN' || role === 'VENDEDOR';
export const canRegisterEntry = (role?: Role) => role === 'ADMIN' || role === 'BODEGA';
