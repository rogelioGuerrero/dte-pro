// Sistema de captura de datos de cliente via QR
// Genera un ID unico para cada sesion de captura y almacena los datos recibidos
// Usa Netlify Function para sincronizacion entre dispositivos

import { ClientData } from './clientDb';

const STORAGE_KEY = 'dte_pending_clients';
const SESSION_KEY = 'dte_vendor_session';
const API_ENDPOINT = '/api/pending-clients';

export interface PendingClient {
  id: string;
  data: Partial<ClientData>;
  receivedAt: string;
  status: 'pending' | 'imported' | 'dismissed';
}

// Generar ID de sesion unico para el vendedor
export const getOrCreateVendorSession = (): string => {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

// Generar ID corto y legible
const generateSessionId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generar URL para el formulario del cliente
export const generateClientFormUrl = (baseUrl?: string): string => {
  const sessionId = getOrCreateVendorSession();
  const base = baseUrl || window.location.origin;
  return `${base}/cliente?v=${sessionId}`;
};

// Guardar cliente pendiente (llamado cuando el cliente envia sus datos)
export const savePendingClient = (clientData: Partial<ClientData>): string => {
  const pending = getPendingClients();
  const id = `pc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const newClient: PendingClient = {
    id,
    data: clientData,
    receivedAt: new Date().toISOString(),
    status: 'pending',
  };
  
  pending.push(newClient);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  
  return id;
};

// Obtener clientes pendientes
export const getPendingClients = (): PendingClient[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.error('Error loading pending clients');
  }
  return [];
};

// Obtener solo clientes pendientes sin importar
export const getUnimportedClients = (): PendingClient[] => {
  return getPendingClients().filter(c => c.status === 'pending');
};

// Marcar cliente como importado
export const markClientImported = (id: string): void => {
  const pending = getPendingClients();
  const updated = pending.map(c => 
    c.id === id ? { ...c, status: 'imported' as const } : c
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

// Descartar cliente pendiente
export const dismissPendingClient = (id: string): void => {
  const pending = getPendingClients();
  const updated = pending.map(c => 
    c.id === id ? { ...c, status: 'dismissed' as const } : c
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

// Limpiar clientes antiguos (mas de 24 horas)
export const cleanOldPendingClients = (): void => {
  const pending = getPendingClients();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  
  const filtered = pending.filter(c => {
    const receivedTime = new Date(c.receivedAt).getTime();
    return receivedTime > oneDayAgo || c.status === 'pending';
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

// Exportar datos de cliente como JSON para WhatsApp
export const exportClientAsJson = (client: Partial<ClientData>): string => {
  return JSON.stringify({
    type: 'dte_client_data',
    version: '1.0',
    data: client,
    exportedAt: new Date().toISOString(),
  }, null, 2);
};

// Importar datos de cliente desde JSON
export const importClientFromJson = (jsonString: string): Partial<ClientData> | null => {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.type === 'dte_client_data' && parsed.data) {
      return parsed.data;
    }
    // Intentar parsear como datos directos
    if (parsed.name || parsed.nit) {
      return parsed;
    }
  } catch {
    console.error('Error parsing client JSON');
  }
  return null;
};

// ============================================
// API Functions (Netlify Function backend)
// ============================================

// Guardar cliente pendiente via API (llamado desde el formulario del cliente)
export const savePendingClientApi = async (
  vendorId: string,
  clientData: Partial<ClientData>
): Promise<{ id: string } | null> => {
  try {
    const res = await fetch(`${API_ENDPOINT}?v=${encodeURIComponent(vendorId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', data: clientData }),
    });
    if (!res.ok) {
      console.error('API error saving client:', res.status);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('API error saving client: unexpected content-type:', contentType);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Network error saving client:', err);
    return null;
  }
};

// Obtener clientes pendientes via API (llamado por el emisor)
export const getUnimportedClientsApi = async (
  vendorId: string
): Promise<PendingClient[] | null> => {
  try {
    const res = await fetch(`${API_ENDPOINT}?v=${encodeURIComponent(vendorId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('API error fetching clients:', res.status);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('API error fetching clients: unexpected content-type:', contentType);
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Network error fetching clients:', err);
    return null;
  }
};

// Marcar cliente como importado via API
export const markClientImportedApi = async (
  vendorId: string,
  clientId: string
): Promise<boolean> => {
  try {
    const res = await fetch(`${API_ENDPOINT}?v=${encodeURIComponent(vendorId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setStatus', id: clientId, status: 'imported' }),
    });
    return res.ok;
  } catch (err) {
    console.error('Network error marking client imported:', err);
    return false;
  }
};

// Descartar cliente pendiente via API
export const dismissPendingClientApi = async (
  vendorId: string,
  clientId: string
): Promise<boolean> => {
  try {
    const res = await fetch(`${API_ENDPOINT}?v=${encodeURIComponent(vendorId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setStatus', id: clientId, status: 'dismissed' }),
    });
    return res.ok;
  } catch (err) {
    console.error('Network error dismissing client:', err);
    return false;
  }
};
