import { BACKEND_CONFIG, buildBackendHeaders, getBackendAuthToken } from './backendConfig';
import { APP_TAB_LABELS, AppTab, ManagedAppTab, MANAGED_APP_TABS } from './appTabs';
import { getPreferredDefaultTab, isTabAllowed } from './userMode';

const STORAGE_PREFIX = 'dte_business_settings';

export interface BusinessFeatureFlags {
  batch: boolean;
  fiscal: boolean;
  clients: boolean;
  inventory: boolean;
  factura: boolean;
  historial: boolean;
  simple: boolean;
  poscf: boolean;
  ccftester: boolean;
}

function sanitizeBackendFeatures(input?: Record<string, boolean> | null): BusinessFeatureFlags {
  return sanitizeFeatures({
    batch: input?.batch,
    fiscal: input?.fiscal,
    clients: input?.clients,
    inventory: input?.inventory,
    factura: input?.factura,
    historial: input?.historial,
    simple: input?.simple,
    poscf: input?.poscf,
    ccftester: input?.ccftester,
  });
}

export interface BusinessCapabilities {
  pushEnabled: boolean;
  fingerprintEnabled: boolean;
  advancedConfigEnabled: boolean;
}

export interface BusinessSettings {
  businessId: string | null;
  defaultTab: ManagedAppTab;
  features: BusinessFeatureFlags;
  capabilities: BusinessCapabilities;
  planCode: string;
  planLabel: string;
  source: 'default' | 'local' | 'remote';
  updatedAt: string | null;
}

export interface BackendBusinessSettingsRecord {
  business_id: string;
  default_tab: string | null;
  features: Record<string, boolean> | null;
  push_enabled: boolean | null;
  fingerprint_enabled: boolean | null;
  advanced_config_enabled: boolean | null;
  plan_code: string | null;
  plan_label: string | null;
  updated_at: string | null;
}

export interface BackendBusinessSettingsResponse {
  success: boolean;
  settings: BackendBusinessSettingsRecord;
}

const DEFAULT_FEATURES: BusinessFeatureFlags = {
  batch: true,
  fiscal: false,
  clients: false,
  inventory: false,
  factura: true,
  historial: true,
  simple: false,
  poscf: false,
  ccftester: true,
};

const DEFAULT_CAPABILITIES: BusinessCapabilities = {
  pushEnabled: false,
  fingerprintEnabled: false,
  advancedConfigEnabled: true,
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessId: null,
  defaultTab: 'factura',
  features: DEFAULT_FEATURES,
  capabilities: DEFAULT_CAPABILITIES,
  planCode: 'free',
  planLabel: 'Gratis',
  source: 'default',
  updatedAt: null,
};

function getStorageKey(businessId: string | null): string {
  return `${STORAGE_PREFIX}:${businessId || 'anonymous'}`;
}

function normalizeDefaultTab(value: string | undefined, features: BusinessFeatureFlags): ManagedAppTab {
  if (value && MANAGED_APP_TABS.includes(value as ManagedAppTab) && features[value as ManagedAppTab]) {
    return value as ManagedAppTab;
  }

  const firstEnabled = MANAGED_APP_TABS.find((tab) => features[tab]);
  return firstEnabled || 'factura';
}

function sanitizeFeatures(input?: Partial<BusinessFeatureFlags> | null): BusinessFeatureFlags {
  return {
    batch: input?.batch ?? DEFAULT_FEATURES.batch,
    fiscal: input?.fiscal ?? DEFAULT_FEATURES.fiscal,
    clients: input?.clients ?? DEFAULT_FEATURES.clients,
    inventory: input?.inventory ?? DEFAULT_FEATURES.inventory,
    factura: input?.factura ?? DEFAULT_FEATURES.factura,
    historial: input?.historial ?? DEFAULT_FEATURES.historial,
    simple: input?.simple ?? DEFAULT_FEATURES.simple,
    poscf: input?.poscf ?? DEFAULT_FEATURES.poscf,
    ccftester: input?.ccftester ?? DEFAULT_FEATURES.ccftester,
  };
}

function sanitizeCapabilities(input?: Partial<BusinessCapabilities> | null): BusinessCapabilities {
  return {
    pushEnabled: input?.pushEnabled ?? DEFAULT_CAPABILITIES.pushEnabled,
    fingerprintEnabled: input?.fingerprintEnabled ?? DEFAULT_CAPABILITIES.fingerprintEnabled,
    advancedConfigEnabled: input?.advancedConfigEnabled ?? DEFAULT_CAPABILITIES.advancedConfigEnabled,
  };
}

export function normalizeBusinessSettings(raw?: Partial<BusinessSettings> | null): BusinessSettings {
  const features = sanitizeFeatures(raw?.features);
  const capabilities = sanitizeCapabilities(raw?.capabilities);

  return {
    businessId: raw?.businessId ?? null,
    defaultTab: normalizeDefaultTab(raw?.defaultTab, features),
    features,
    capabilities,
    planCode: raw?.planCode || DEFAULT_BUSINESS_SETTINGS.planCode,
    planLabel: raw?.planLabel || DEFAULT_BUSINESS_SETTINGS.planLabel,
    source: raw?.source || 'default',
    updatedAt: raw?.updatedAt || null,
  };
}

export function loadBusinessSettingsFromStorage(businessId: string | null): BusinessSettings {
  const stored = localStorage.getItem(getStorageKey(businessId));
  if (!stored) {
    return normalizeBusinessSettings({
      ...DEFAULT_BUSINESS_SETTINGS,
      businessId,
    });
  }

  try {
    const parsed = JSON.parse(stored) as Partial<BusinessSettings>;
    return normalizeBusinessSettings({
      ...parsed,
      businessId,
      source: 'local',
    });
  } catch (error) {
    console.error('Error parsing business settings', error);
    return normalizeBusinessSettings({
      ...DEFAULT_BUSINESS_SETTINGS,
      businessId,
    });
  }
}

export function saveBusinessSettingsToStorage(settings: BusinessSettings): void {
  localStorage.setItem(
    getStorageKey(settings.businessId),
    JSON.stringify({
      ...settings,
      source: 'local',
      updatedAt: new Date().toISOString(),
    })
  );
}

function mapBackendRecordToBusinessSettings(record: BackendBusinessSettingsRecord, businessId: string): BusinessSettings {
  return normalizeBusinessSettings({
    businessId: record.business_id || businessId,
    defaultTab: record.default_tab as ManagedAppTab | undefined,
    features: sanitizeBackendFeatures(record.features),
    capabilities: sanitizeCapabilities({
      pushEnabled: record.push_enabled ?? undefined,
      fingerprintEnabled: record.fingerprint_enabled ?? undefined,
      advancedConfigEnabled: record.advanced_config_enabled ?? undefined,
    }),
    planCode: record.plan_code || DEFAULT_BUSINESS_SETTINGS.planCode,
    planLabel: record.plan_label || DEFAULT_BUSINESS_SETTINGS.planLabel,
    source: 'remote',
    updatedAt: record.updated_at,
  });
}

function mapBusinessSettingsToBackendPayload(settings: BusinessSettings) {
  return {
    default_tab: settings.defaultTab,
    features: {
      batch: settings.features.batch,
      fiscal: settings.features.fiscal,
      clients: settings.features.clients,
      inventory: settings.features.inventory,
      factura: settings.features.factura,
      historial: settings.features.historial,
      simple: settings.features.simple,
      poscf: settings.features.poscf,
      ccftester: settings.features.ccftester,
    },
    push_enabled: settings.capabilities.pushEnabled,
    fingerprint_enabled: settings.capabilities.fingerprintEnabled,
    advanced_config_enabled: settings.capabilities.advancedConfigEnabled,
    plan_code: settings.planCode || null,
    plan_label: settings.planLabel || null,
  };
}

async function backendBusinessSettingsRequest<T>(businessId: string, init?: RequestInit): Promise<T> {
  const token = getBackendAuthToken();
  if (!token) {
    throw new Error('No hay token Bearer configurado para consultar business settings.');
  }

  const response = await fetch(`${BACKEND_CONFIG.URL}/api/business/settings/${businessId}`, {
    ...init,
    headers: {
      ...buildBackendHeaders({ token }),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error ${response.status} cargando business settings`);
  }

  return response.json() as Promise<T>;
}

export async function fetchBusinessSettingsFromBackend(businessId: string): Promise<BusinessSettings> {
  const response = await backendBusinessSettingsRequest<BackendBusinessSettingsResponse>(businessId, {
    method: 'GET',
  });

  return mapBackendRecordToBusinessSettings(response.settings, businessId);
}

export async function saveBusinessSettingsToBackend(settings: BusinessSettings): Promise<BusinessSettings> {
  if (!settings.businessId) {
    throw new Error('No hay businessId para guardar business settings.');
  }

  const response = await backendBusinessSettingsRequest<BackendBusinessSettingsResponse>(settings.businessId, {
    method: 'PUT',
    body: JSON.stringify(mapBusinessSettingsToBackendPayload(settings)),
  });

  const mapped = mapBackendRecordToBusinessSettings(response.settings, settings.businessId);
  saveBusinessSettingsToStorage(mapped);
  return mapped;
}

export async function resolveBusinessSettings(businessId: string | null): Promise<BusinessSettings> {
  const localSettings = loadBusinessSettingsFromStorage(businessId);

  if (!businessId) {
    return localSettings;
  }

  try {
    const remoteSettings = await fetchBusinessSettingsFromBackend(businessId);
    saveBusinessSettingsToStorage(remoteSettings);
    return remoteSettings;
  } catch (error) {
    console.warn('No se pudieron cargar business settings remotos; usando fallback local.', error);
    return localSettings;
  }
}

export function getVisibleManagedTabs(settings: BusinessSettings): ManagedAppTab[] {
  return MANAGED_APP_TABS.filter((tab) => settings.features[tab]);
}

export function isManagedTabEnabled(settings: BusinessSettings, tab: AppTab): boolean {
  if (tab === 'micuenta') return true;
  if (tab === 'products') return false;
  return settings.features[tab as ManagedAppTab];
}

export function getDefaultActiveTab(settings: BusinessSettings): AppTab {
  const preferred = getPreferredDefaultTab();

  if (
    preferred &&
    MANAGED_APP_TABS.includes(preferred as ManagedAppTab) &&
    settings.features[preferred as ManagedAppTab] &&
    isTabAllowed(preferred)
  ) {
    return preferred as AppTab;
  }

  const normalized = normalizeDefaultTab(settings.defaultTab, settings.features);
  if (isTabAllowed(normalized)) {
    return normalized;
  }

  const firstVisible = MANAGED_APP_TABS.find((tab) => settings.features[tab] && isTabAllowed(tab));
  return (firstVisible || 'factura') as AppTab;
}

export function buildFeatureSummary(settings: BusinessSettings): string[] {
  return getVisibleManagedTabs(settings).map((tab) => APP_TAB_LABELS[tab]);
}
