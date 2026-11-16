// Java LocalDate and LocalDateTime are serialized without a time zone.
export type LocalDate = string;
export type LocalDateTime = string;
export type Role = 'ADMIN' | 'VENDEDOR' | 'BODEGA';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  role: Role;
  fullName: string;
}

export interface ProductVariantRequest {
  sku: string;
  size: string;
  color: string;
  price: number;
  taxRate: number;
  minStock: number;
}

export interface ProductUpdateRequest {
  name: string;
  category: string;
  description: string | null;
}

export interface ProductRequest extends ProductUpdateRequest {
  variants: ProductVariantRequest[];
}

export interface ProductVariant extends ProductVariantRequest {
  id: number;
  currentStock: number;
  active: boolean;
  createdAt: LocalDateTime;
  updatedAt: LocalDateTime;
}

export interface Product extends ProductUpdateRequest {
  id: number;
  active: boolean;
  variants: ProductVariant[];
  createdAt: LocalDateTime;
  updatedAt: LocalDateTime;
}

export interface InventoryEntryRequest {
  sku: string;
  quantity: number;
  reference: string;
}

export interface InventoryMovementResponse {
  id: number;
  sku: string;
  type: string;
  quantity: number;
  previousStock: number;
  resultingStock: number;
  username: string;
  reference: string | null;
  createdAt: LocalDateTime;
}

export interface InventoryMovement extends Omit<InventoryMovementResponse, 'sku' | 'username'> {
  variantId: number;
  skuAtMovement: string | null;
  userId: number;
  saleId: number | null;
}

export interface Customer {
  id: number;
  documentType: string | null;
  documentNumber: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: LocalDateTime;
}

export interface CustomerRequest {
  documentType: string;
  documentNumber: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface SaleItemRequest {
  sku: string;
  quantity: number;
}

export interface SaleRequest {
  customerId: number | null;
  items: SaleItemRequest[];
  paymentMethod: PaymentMethod;
  amountReceived: number;
  discountPercent: number | null;
  idempotencyKey: string | null;
}

export interface SaleItem {
  id: number;
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountValue: number;
  taxValue: number;
  lineTotal: number;
  skuAtSale: string | null;
  productNameAtSale: string | null;
  sizeAtSale: string | null;
  colorAtSale: string | null;
}

export interface SaleSummary {
  receiptNumber: string;
  createdAt: LocalDateTime;
  customerId: number | null;
  total: number;
  status: string;
}

export interface SaleHistoryFilters {
  from?: LocalDate;
  to?: LocalDate;
  receipt?: string;
}

export interface Sale extends SaleSummary {
  id: number;
  idempotencyKey: string | null;
  sellerId: number;
  customerNameAtSale: string | null;
  subtotal: number;
  taxTotal: number;
  discountPercent: number;
  discountValue: number;
  discountBeforeTax: boolean;
  discountUserId: number | null;
  items: SaleItem[];
}

export interface DailySummary {
  date: LocalDate;
  count: number;
  total: number;
  grossSales: number;
  refunds: number;
}

export interface SaleReceiptItem {
  sku: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  taxValue: number;
  lineTotal: number;
}

export interface SaleReceiptResponse {
  receiptNumber: string;
  createdAt: LocalDateTime;
  sellerName: string;
  customerName: string;
  items: SaleReceiptItem[];
  subtotal: number;
  taxTotal: number;
  discountPercent: number;
  discountValue: number;
  discountBeforeTax: boolean;
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeGiven: number;
}

export interface ReturnRequest {
  reason: string;
}

export interface ReturnResponse {
  id: number;
  saleId: number;
  receiptNumber: string;
  reason: string;
  refundTotal: number;
  createdAt: LocalDateTime;
  userId: number;
}

export interface UserCreateDTO extends AuthLoginRequest {
  fullName: string;
  role: Role;
}

export interface UserCreateRequest extends AuthLoginRequest {
  fullName: string;
  roleName: Role;
}

export interface UserResponse {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
}

export interface Range {
  from: LocalDate;
  to: LocalDate;
}

export interface SalesRow {
  receiptNumber: string;
  createdAt: LocalDateTime;
  status: string;
  total: number;
  refundedTotal: number;
  netTotal: number;
}

export interface SalesReport extends Range {
  rows: SalesRow[];
  grossSales: number;
  refunds: number;
  netSales: number;
}

export interface InventoryRow {
  sku: string;
  productName: string;
  size: string;
  color: string;
  stock: number;
  minStock: number;
  price: number;
  active: boolean;
  lowStock: boolean;
}

export interface InventoryReport {
  rows: InventoryRow[];
  stockUnits: number;
  lowStockCount: number;
}

export interface Day {
  date: LocalDate;
  sales: number;
  refunds: number;
  net: number;
}

export interface Dashboard extends Range {
  salesCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
  stockUnits: number;
  lowStockCount: number;
  daily: Day[];
}
