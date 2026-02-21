export interface AppSettings {
  apiKey: string;
  pin: string;
  myNit: string;
  myNrc: string;
  useAutoDetection: boolean; // Modo empresa: auto-detecta ventas/compras basado en NIT/NRC
  aiProvider?: string;
  aiModel?: string;

  // --- Gestión de Licencias (solo lectura, controlado remotamente) ---
  // NOTA: Este valor es ahora controlado por variables de entorno del servidor
  // licensingEnabled: boolean; // Eliminado - ahora es remoto

  // --- Inventario simplificado (avanzado) ---
  inventoryCostingMethod?: 'UEPS' | 'PEPS' | 'PROMEDIO';
  inventoryShowLotProvider?: boolean; // por defecto OFF
  inventoryFallbackByDescription?: boolean; // por defecto ON
  inventoryAutoMatchThreshold?: number; // 0..1
  inventoryAskMatchThreshold?: number; // 0..1
}

const SETTINGS_KEY = 'dte_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  pin: '', // PIN configurable - se debe establecer en primer uso
  myNit: '',
  myNrc: '',
  useAutoDetection: false,
  inventoryCostingMethod: 'UEPS',
  inventoryShowLotProvider: false,
  inventoryFallbackByDescription: true,
  inventoryAutoMatchThreshold: 0.9,
  inventoryAskMatchThreshold: 0.75
  // licensingEnabled eliminado - ahora es controlado remotamente
};

export const loadSettings = (): AppSettings => {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error parsing settings', e);
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
