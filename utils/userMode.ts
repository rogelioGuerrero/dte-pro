export type UserMode = 'profesional' | 'negocio';

export interface UserModeConfig {
  mode: UserMode;
  allowedTabs: string[];
  features: {
    librosIVA: boolean;
    facturacion: boolean;
    inventario: boolean;
    clientes: boolean;
    productos: boolean;
    historial: boolean;
    fiscal: boolean;
  };
}

export const USER_MODE_CONFIGS: Record<UserMode, UserModeConfig> = {
  profesional: {
    mode: 'profesional',
    allowedTabs: ['batch', 'fiscal', 'clients', 'factura', 'historial'],
    features: {
      librosIVA: true,
      facturacion: true,
      inventario: false,
      clientes: true,
      productos: false,
      historial: true,
      fiscal: true
    }
  },
  negocio: {
    mode: 'negocio',
    allowedTabs: ['batch', 'fiscal', 'clients', 'products', 'inventory', 'factura', 'historial'],
    features: {
      librosIVA: true,
      facturacion: true,
      inventario: true,
      clientes: true,
      productos: true,
      historial: true,
      fiscal: true
    }
  }
};

export function getUserModeConfig(): UserModeConfig {
  const stored = localStorage.getItem('dte_user_mode');
  if (stored && USER_MODE_CONFIGS[stored as UserMode]) {
    return USER_MODE_CONFIGS[stored as UserMode];
  }
  
  // Por defecto, modo profesional
  return USER_MODE_CONFIGS.profesional;
}

export function setUserMode(mode: UserMode): void {
  localStorage.setItem('dte_user_mode', mode);
}

export function isTabAllowed(tabName: string): boolean {
  const config = getUserModeConfig();
  return config.allowedTabs.includes(tabName);
}

export function hasFeature(feature: keyof UserModeConfig['features']): boolean {
  const config = getUserModeConfig();
  return config.features[feature];
}
