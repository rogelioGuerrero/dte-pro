export type AppTab = 'batch' | 'clients' | 'products' | 'inventory' | 'factura' | 'historial' | 'fiscal' | 'micuenta' | 'simple' | 'poscf';

export type ManagedAppTab = Exclude<AppTab, 'micuenta' | 'products'>;

export const MANAGED_APP_TABS: ManagedAppTab[] = [
  'batch',
  'fiscal',
  'clients',
  'inventory',
  'factura',
  'historial',
  'simple',
  'poscf'
];

export const APP_TAB_LABELS: Record<AppTab, string> = {
  batch: 'Libros IVA',
  fiscal: 'Impuestos',
  clients: 'Clientes',
  inventory: 'Inventario',
  factura: 'Crédito Fiscal',
  historial: 'Historial',
  simple: 'Test DTE',
  poscf: 'Facturas',
  micuenta: 'Mi Cuenta',
  products: 'Productos'
};
