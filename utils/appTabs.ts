export type AppTab =
  | 'batch'
  | 'clients'
  | 'products'
  | 'inventory'
  | 'factura'
  | 'historial'
  | 'fiscal'
  | 'micuenta'
  | 'fe01'
  | 'insights';

export type ManagedAppTab = Exclude<AppTab, 'micuenta' | 'products' | 'insights'>;

export const MANAGED_APP_TABS: ManagedAppTab[] = [
  'batch',
  'fiscal',
  'clients',
  'inventory',
  'factura',
  'fe01',
  'historial'
];

export const APP_TAB_LABELS: Record<AppTab, string> = {
  batch: 'Libros IVA',
  fiscal: 'Impuestos',
  clients: 'Clientes',
  inventory: 'Inventario',
  factura: 'Crédito Fiscal',
  historial: 'Historial',
  fe01: 'Factura 01',
  insights: 'Insights IA',
  micuenta: 'Mi Cuenta',
  products: 'Productos'
};
