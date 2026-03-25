import { openDB } from 'idb';
import { formatEmailInput, formatMultilineTextInput, formatTextInput, normalizeIdDigits } from './validators';

export interface EmisorData {
  id?: number;
  nit: string;
  nrc: string;
  nombre: string;
  nombreComercial: string;
  actividadEconomica: string;
  descActividad: string;
  tipoEstablecimiento: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  correo: string;
  codEstableMH: string | null;
  codPuntoVentaMH: string | null;
  logo?: string; // Base64 encoded image
}

const DB_NAME = 'dte-emisor-db';
const DB_VERSION = 1;
const STORE_NAME = 'emisor';

const normalizeEmisorRecord = (emisor: EmisorData): EmisorData => ({
  ...emisor,
  nit: normalizeIdDigits(emisor.nit),
  nrc: normalizeIdDigits(emisor.nrc),
  nombre: formatTextInput(emisor.nombre),
  nombreComercial: formatTextInput(emisor.nombreComercial || ''),
  actividadEconomica: (emisor.actividadEconomica || '').trim(),
  descActividad: formatTextInput(emisor.descActividad || '').trim(),
  tipoEstablecimiento: (emisor.tipoEstablecimiento || '').trim(),
  departamento: (emisor.departamento || '').trim(),
  municipio: (emisor.municipio || '').trim(),
  direccion: formatMultilineTextInput(emisor.direccion || '').trim(),
  telefono: normalizeIdDigits(emisor.telefono),
  correo: formatEmailInput(emisor.correo),
  codEstableMH: emisor.codEstableMH ? String(emisor.codEstableMH).trim() : null,
  codPuntoVentaMH: emisor.codPuntoVentaMH ? String(emisor.codPuntoVentaMH).trim() : null,
});

export const openEmisorDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });
};

export const getEmisor = async (): Promise<EmisorData | null> => {
  const db = await openEmisorDb();
  const all = await db.getAll(STORE_NAME);
  return all[0] ? normalizeEmisorRecord(all[0] as EmisorData) : null;
};

export const saveEmisor = async (emisor: Omit<EmisorData, 'id'>): Promise<void> => {
  const db = await openEmisorDb();
  const existing = await getEmisor();
  const normalized = normalizeEmisorRecord(emisor as EmisorData);
  if (existing?.id) {
    await db.put(STORE_NAME, { ...normalized, id: existing.id });
  } else {
    await db.add(STORE_NAME, normalized);
  }
};

export const exportEmisor = async (): Promise<string> => {
  const emisor = await getEmisor();
  return JSON.stringify({ version: '1.0', emisor }, null, 2);
};

export const importEmisor = async (jsonString: string): Promise<boolean> => {
  const data = JSON.parse(jsonString);
  if (!data.emisor) throw new Error('Formato inválido');
  await saveEmisor(data.emisor);
  return true;
};
