export type AppTab =
  | 'batch'
  | 'clients'
  | 'products'
  | 'inventory'
  | 'factura'
  | 'historial'
  | 'fiscal'
  | 'micuenta'
  | 'simple'
  | 'fe01'
  | 'fe01v2'
  | 'ccftester';

export type ManagedAppTab = Exclude<AppTab, 'micuenta' | 'products'>;

export const MANAGED_APP_TABS: ManagedAppTab[] = [
  'batch',
  'fiscal',
  'clients',
  'inventory',
  'factura',
  'historial',
  'simple',
  'fe01',
  'fe01v2',
  'ccftester'
];

export const APP_TAB_LABELS: Record<AppTab, string> = {
  batch: 'Libros IVA',
  fiscal: 'Impuestos',
  clients: 'Clientes',
  inventory: 'Inventario',
  factura: 'Crédito Fiscal',
  historial: 'Historial',
  simple: 'Test DTE',
  fe01: 'Factura 01',
  fe01v2: 'Factura 01 V2',
  micuenta: 'Mi Cuenta',
  products: 'Productos',
  ccftester: 'CCF Tester'
};
