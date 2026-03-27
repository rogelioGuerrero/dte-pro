export type Role = 'owner' | 'admin' | 'operator' | null;

export function normalizeRole(value: unknown): Role {
  return value === 'owner' || value === 'admin' || value === 'operator' ? value : null;
}

// Tabs disponibles por rol. micuenta se maneja como excepción en navegación.
const ROLE_TABS: Record<Exclude<Role, null>, string[]> = {
  owner: ['batch', 'fiscal', 'clients', 'inventory', 'factura', 'historial', 'simple', 'fe01', 'products'],
  admin: ['batch', 'fiscal', 'clients', 'inventory', 'factura', 'historial', 'simple', 'fe01', 'products'],
  operator: ['factura', 'historial', 'simple', 'fe01'],
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
