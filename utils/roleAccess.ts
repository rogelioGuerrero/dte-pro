export type Role = 'owner' | 'admin' | 'operator' | 'viewer' | 'guest' | null;

export function normalizeRole(value: unknown): Role {
  return value === 'owner' || value === 'admin' || value === 'operator' || value === 'viewer' || value === 'guest' ? value : null;
}

// Tabs disponibles por rol. micuenta se maneja como excepción en navegación.
const ROLE_TABS: Record<Exclude<Role, null>, string[]> = {
  owner: ['batch', 'fiscal', 'clients', 'inventory', 'factura', 'historial', 'simple', 'fe01', 'fe01v2', 'ccftester', 'micuenta'],
  admin: ['batch', 'fiscal', 'clients', 'inventory', 'factura', 'historial', 'simple', 'fe01', 'fe01v2', 'ccftester', 'micuenta'],
  operator: ['batch', 'fiscal', 'clients', 'inventory', 'factura', 'historial', 'simple', 'fe01', 'fe01v2', 'ccftester', 'micuenta'],
  viewer: ['historial', 'micuenta'],
  guest: ['simple', 'micuenta'],
};

export function isTabAllowedForRole(tab: string, role: Role): boolean {
  if (!role) return true; // sin rol: no restringir para evitar bloqueos accidentales
  if (role === 'owner' || role === 'admin') return true; // dueños/admin pueden todo
  const allowed = ROLE_TABS[role];
  return allowed.includes(tab);
}

export function firstAllowedTab(role: Role, fallback: string, candidates: string[]): string {
  if (!role) return fallback;
  const allowed = ROLE_TABS[role];
  const found = candidates.find((t) => allowed.includes(t));
  return found || fallback;
}
