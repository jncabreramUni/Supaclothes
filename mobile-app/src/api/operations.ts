import type {
  AuthLoginRequest, AuthResponse, Customer, CustomerRequest, DailySummary, Dashboard, InventoryEntryRequest,
  InventoryMovement, InventoryMovementResponse, InventoryReport, LocalDate, Product, ProductRequest, ProductUpdateRequest,
  ProductVariantRequest, Range, ReturnRequest, ReturnResponse, Sale, SaleHistoryFilters, SaleReceiptResponse, SaleRequest,
  SaleSummary, SalesReport, UserCreateRequest,
  UserResponse,
} from '../types/api';
import { request, type ApiRequest, type WorkbookDownload } from './client';

export const logIn = (body: AuthLoginRequest, admin: boolean) =>
  request<AuthResponse>(admin ? '/auth/admin/login' : '/auth/login', { method: 'POST', body });

export const getProducts = (api: ApiRequest, signal?: AbortSignal) => api<Product[]>('/products', { signal });
export const createProduct = (api: ApiRequest, body: ProductRequest) =>
  api<Product>('/products', { method: 'POST', body });
export const updateProduct = (api: ApiRequest, id: number, body: ProductUpdateRequest) =>
  api<Product>(`/products/${id}`, { method: 'PUT', body });
export const createVariant = (api: ApiRequest, productId: number, body: ProductVariantRequest) =>
  api<Product>(`/products/${productId}/variants`, { method: 'POST', body });
export const updateVariant = (api: ApiRequest, productId: number, variantId: number, body: ProductVariantRequest) =>
  api<Product>(`/products/${productId}/variants/${variantId}`, { method: 'PUT', body });
export const setProductActive = (api: ApiRequest, id: number, active: boolean) =>
  api<Product>(`/products/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' });
export const setVariantActive = (api: ApiRequest, productId: number, variantId: number, active: boolean) =>
  api<Product>(`/products/${productId}/variants/${variantId}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' });
export const getInventory = (api: ApiRequest, signal?: AbortSignal) => api<Product[]>('/inventory', { signal });
export const getMovements = (api: ApiRequest, signal?: AbortSignal) =>
  api<InventoryMovementResponse[]>('/inventory/movements', { signal });
export const createEntry = (api: ApiRequest, body: InventoryEntryRequest) =>
  api<InventoryMovement>('/inventory/entries', { method: 'POST', body });

export const lookupCustomers = (api: ApiRequest, query: string, signal?: AbortSignal) =>
  api<Customer[]>(`/customers?q=${encodeURIComponent(query.trim())}`, { signal });
export const createCustomer = (api: ApiRequest, body: CustomerRequest) =>
  api<Customer>('/customers', { method: 'POST', body });
export const createSale = (api: ApiRequest, body: SaleRequest) =>
  api<Sale>('/sales', { method: 'POST', body });
function withFilters(path: string, filters: SaleHistoryFilters) {
  const query = new URLSearchParams();
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.receipt) query.set('receipt', filters.receipt);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
export const getHistory = (api: ApiRequest, filters: SaleHistoryFilters, signal?: AbortSignal) =>
  api<SaleSummary[]>(withFilters('/sales', filters), { signal });
export const getReceipt = (api: ApiRequest, number: string, signal?: AbortSignal) =>
  api<SaleReceiptResponse>(`/sales/${encodeURIComponent(number)}`, { signal });
export const getSaleReturn = (api: ApiRequest, number: string, signal?: AbortSignal) =>
  api<ReturnResponse>(`/sales/${encodeURIComponent(number)}/return`, { signal });
export const createSaleReturn = (api: ApiRequest, number: string, body: ReturnRequest) =>
  api<ReturnResponse>(`/sales/${encodeURIComponent(number)}/return`, { method: 'POST', body });
export const getDailySummary = (api: ApiRequest, date?: LocalDate, signal?: AbortSignal) =>
  api<DailySummary>(date ? `/sales/daily-summary?date=${encodeURIComponent(date)}` : '/sales/daily-summary', { signal });

export const getDashboard = (api: ApiRequest, filters: Partial<Range>, signal?: AbortSignal) =>
  api<Dashboard>(withFilters('/reports/dashboard', filters), { signal });
export const getSalesReport = (api: ApiRequest, filters: Partial<Range>, signal?: AbortSignal) =>
  api<SalesReport>(withFilters('/reports/sales', filters), { signal });
export const getInventoryReport = (api: ApiRequest, signal?: AbortSignal) =>
  api<InventoryReport>('/reports/inventory', { signal });
export const downloadSalesReport = (api: ApiRequest, filters: Range) =>
  api<WorkbookDownload>(withFilters('/reports/sales/export', filters), { responseType: 'xlsx' });
export const downloadInventoryReport = (api: ApiRequest) =>
  api<WorkbookDownload>('/reports/inventory/export', { responseType: 'xlsx' });
export const getUsers = (api: ApiRequest, signal?: AbortSignal) => api<UserResponse[]>('/users', { signal });
export const createUser = (api: ApiRequest, body: UserCreateRequest) =>
  api<UserResponse>('/users', { method: 'POST', body });
export const deactivateUser = (api: ApiRequest, id: number) =>
  api<void>(`/users/${id}/deactivate`, { method: 'PATCH' });
