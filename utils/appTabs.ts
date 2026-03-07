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
  factura: 'Facturar',
  historial: 'Historial',
  simple: 'Test DTE',
  poscf: 'POS CF',
  micuenta: 'Mi Cuenta',
  products: 'Productos'
};
