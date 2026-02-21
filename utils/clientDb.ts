import { openDB } from 'idb';

export interface ClientData {
  id?: number;
  nit: string;
  name: string;
  nrc: string;
  nombreComercial: string;
  actividadEconomica: string;
  descActividad?: string;
  departamento: string;
  municipio: string;
  direccion: string;
  email: string;
  telefono: string;
  timestamp: number;
}

const normalizeId = (value: string): string => {
  if (!value) return '';
  return value.replace(/[-\s]/g, '').trim();
};

const DB_NAME = 'dte-clients-db';
const DB_VERSION = 1;
const STORE_NAME = 'clients';

export const openClientsDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('nit', 'nit', { unique: false }); // Allow multiple entries? Maybe unique is better but let's be flexible
      }
    },
  });
};

export const addClient = async (client: Omit<ClientData, 'id'>): Promise<void> => {
  const db = await openClientsDb();
  await db.add(STORE_NAME, client);
};

// Guardar cliente y retornar con ID
export const saveClient = async (client: Omit<ClientData, 'id' | 'timestamp'>): Promise<ClientData> => {
  const db = await openClientsDb();
  const clientWithTimestamp = { ...client, timestamp: Date.now() };
  const id = await db.add(STORE_NAME, clientWithTimestamp);
  return { ...clientWithTimestamp, id: id as number };
};

export const getClients = async (): Promise<ClientData[]> => {
  const db = await openClientsDb();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteClient = async (id: number): Promise<void> => {
  const db = await openClientsDb();
  await db.delete(STORE_NAME, id);
};

export const clearClients = async (): Promise<void> => {
  const db = await openClientsDb();
  await db.clear(STORE_NAME);
};

export const updateClient = async (client: ClientData): Promise<void> => {
  const db = await openClientsDb();
  await db.put(STORE_NAME, client);
};

export const getClientByNit = async (nit: string): Promise<ClientData | undefined> => {
  const db = await openClientsDb();
  const all = await db.getAll(STORE_NAME);
  return all.find((c) => c.nit === nit);
};

export const getClientByNitOrNrc = async (nit: string, nrc: string): Promise<ClientData | undefined> => {
  const db = await openClientsDb();
  const all = await db.getAll(STORE_NAME);

  const nitKey = normalizeId(nit);
  const nrcKey = normalizeId(nrc);

  return all.find((c) => {
    const existingNitKey = normalizeId(c.nit);
    const existingNrcKey = normalizeId(c.nrc);

    if (nitKey && existingNitKey && nitKey === existingNitKey) return true;
    if (nrcKey && existingNrcKey && nrcKey === existingNrcKey) return true;
    return false;
  });
};

// Exportar todos los clientes a JSON
export const exportClients = async (): Promise<string> => {
  const clients = await getClients();
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    clients: clients.map(({ id, ...rest }) => rest), // Excluir IDs locales
  };
  return JSON.stringify(exportData, null, 2);
};

// Importar clientes desde JSON
export const importClients = async (jsonString: string): Promise<{ imported: number; skipped: number }> => {
  const data = JSON.parse(jsonString);
  
  if (!data.clients || !Array.isArray(data.clients)) {
    throw new Error('Formato de archivo inválido');
  }

  let imported = 0;
  let skipped = 0;

  for (const client of data.clients) {
    // Verificar si ya existe por NIT o NRC
    const existing = await getClientByNitOrNrc(client.nit, client.nrc);
    if (existing) {
      skipped++;
      continue;
    }

    await addClient({
      nit: client.nit || '',
      name: client.name || '',
      nrc: client.nrc || '',
      nombreComercial: client.nombreComercial || '',
      actividadEconomica: client.actividadEconomica || '',
      descActividad: client.descActividad || '',
      departamento: client.departamento || '',
      municipio: client.municipio || '',
      direccion: client.direccion || '',
      email: client.email || '',
      telefono: client.telefono || '',
      timestamp: Date.now(),
    });
    imported++;
  }

  return { imported, skipped };
};

type ImportMode = 'ventas' | 'compras';

export const importClientsFromDTE = async (
  jsonString: string,
  mode: ImportMode
): Promise<{ imported: number; skipped: number }> => {
  const parsed = JSON.parse(jsonString);

  const dtes = Array.isArray(parsed) ? parsed : [parsed];
  let imported = 0;
  let skipped = 0;

  for (const dte of dtes) {
    const party = mode === 'ventas' ? dte?.receptor : dte?.emisor;
    if (!party) continue;

    const nit = party?.nit || '';
    const nrc = party?.nrc || '';
    const name = party?.nombre || '';

    if (!name && !nit && !nrc) continue;

    const existing = await getClientByNitOrNrc(nit, nrc);
    if (existing) {
      skipped++;
      continue;
    }

    await addClient({
      nit,
      name,
      nrc,
      nombreComercial: '',
      actividadEconomica: '',
      descActividad: '',
      departamento: '',
      municipio: '',
      direccion: '',
      email: '',
      telefono: '',
      timestamp: Date.now(),
    });
    imported++;
  }

  return { imported, skipped };
};
