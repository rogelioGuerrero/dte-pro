// Base de datos de historial de DTEs emitidos
// Almacena localmente todos los DTEs transmitidos para backup y consulta

import { openDB, IDBPDatabase } from 'idb';
import { DTEJSON } from './dteGenerator';
import { TransmisionResult } from './dteSignature';

export type DTEArchivado = DTEJSON & {
  firmaElectronica?: string;
  selloRecibido?: string;
  fechaHoraProcesamiento?: string;
};

export const construirDTEArchivado = (
  dte: DTEJSON,
  respuestaMH?: TransmisionResult,
  firmaElectronica?: string
): DTEArchivado => {
  const base = dte as DTEArchivado;
  return {
    ...base,
    firmaElectronica: firmaElectronica ?? base.firmaElectronica,
    selloRecibido: respuestaMH?.selloRecepcion ?? base.selloRecibido,
    fechaHoraProcesamiento: respuestaMH?.fechaHoraProcesamiento ?? base.fechaHoraProcesamiento,
  };
};

export interface DTEHistoryRecord {
  id?: number;
  codigoGeneracion: string;
  numeroControl: string;
  tipoDte: string;
  fechaEmision: string;
  horaEmision: string;
  
  // Datos del emisor
  emisorNit: string;
  emisorNombre: string;
  
  // Datos del receptor
  receptorNombre: string;
  receptorDocumento: string;
  
  // Montos
  montoTotal: number;
  montoGravado: number;
  montoIva: number;
  descuentos?: number;
  
  // Estado
  estado: 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE' | 'CONTINGENCIA';
  selloRecepcion?: string;
  
  // Datos completos
  dteJson: DTEArchivado;
  respuestaMH?: TransmisionResult;
  
  // Metadatos
  fechaTransmision: string;
  ambiente: '00' | '01';

  // Anulación local (cuando aún no existe integración real con MH)
  anulacionLocal?: {
    at: string; // ISO
    motivo?: string;
  };
  
  // Para búsqueda
  searchText: string; // Concatenación de campos para búsqueda rápida
}

export const marcarAnulacionLocal = async (params: {
  codigoGeneracion: string;
  motivo?: string;
  anulada: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  try {
    const db = await openHistoryDb();
    const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', params.codigoGeneracion);
    if (!registro?.id) return { ok: false, message: 'DTE no encontrado en historial' };

    const updated: DTEHistoryRecord = {
      ...registro,
      anulacionLocal: params.anulada
        ? {
            at: new Date().toISOString(),
            motivo: (params.motivo || '').trim() || undefined,
          }
        : undefined,
    };

    await db.put(STORE_NAME, updated);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'No se pudo actualizar el historial' };
  }
};

export interface DTEHistoryFilter {
  fechaDesde?: string;
  fechaHasta?: string;
  tipoDte?: string;
  estado?: string;
  busqueda?: string;
  limite?: number;
  offset?: number;
}

export interface DTEHistoryStats {
  totalEmitidos: number;
  totalAceptados: number;
  totalRechazados: number;
  totalPendientes: number;
  montoTotalEmitido: number;
  montoTotalIva: number;
  porTipo: Record<string, number>;
  porMes: Record<string, { cantidad: number; monto: number }>;
}

const DB_NAME = 'dte-history-db';
const DB_VERSION = 1;
const STORE_NAME = 'dteHistory';

let dbInstance: IDBPDatabase | null = null;

export const openHistoryDb = async (): Promise<IDBPDatabase> => {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        
        // Índices para búsqueda eficiente
        store.createIndex('codigoGeneracion', 'codigoGeneracion', { unique: true });
        store.createIndex('numeroControl', 'numeroControl', { unique: false });
        store.createIndex('fechaEmision', 'fechaEmision', { unique: false });
        store.createIndex('tipoDte', 'tipoDte', { unique: false });
        store.createIndex('estado', 'estado', { unique: false });
        store.createIndex('emisorNit', 'emisorNit', { unique: false });
        store.createIndex('receptorDocumento', 'receptorDocumento', { unique: false });
      }
    },
  });
  
  return dbInstance;
};

// Guardar DTE transmitido
export const guardarDTEEnHistorial = async (
  dte: DTEJSON,
  respuestaMH: TransmisionResult,
  ambiente: '00' | '01' = '00',
  firmaElectronica?: string
): Promise<void> => {
  const db = await openHistoryDb();
  
  // Verificar si ya existe
  const existente = await db.getFromIndex(
    STORE_NAME,
    'codigoGeneracion',
    dte.identificacion.codigoGeneracion
  );
  
  const record: Omit<DTEHistoryRecord, 'id'> = {
    codigoGeneracion: dte.identificacion.codigoGeneracion,
    numeroControl: dte.identificacion.numeroControl,
    tipoDte: dte.identificacion.tipoDte,
    fechaEmision: dte.identificacion.fecEmi,
    horaEmision: dte.identificacion.horEmi,
    
    emisorNit: dte.emisor.nit,
    emisorNombre: dte.emisor.nombre,
    
    receptorNombre: dte.receptor.nombre,
    receptorDocumento: dte.receptor.numDocumento || '',
    
    montoTotal: dte.resumen.totalPagar,
    montoGravado: dte.resumen.totalGravada,
    montoIva: dte.resumen.tributos?.[0]?.valor || 0,
    
    estado: respuestaMH.estado === 'CONTINGENCIA' 
      ? 'CONTINGENCIA' 
      : (respuestaMH.success ? 'ACEPTADO' : 'RECHAZADO'),
    selloRecepcion: respuestaMH.selloRecepcion,
    
    dteJson: construirDTEArchivado(dte, respuestaMH, firmaElectronica),
    respuestaMH,
    
    fechaTransmision: new Date().toISOString(),
    ambiente,
    
    // Texto para búsqueda
    searchText: [
      dte.identificacion.codigoGeneracion,
      dte.identificacion.numeroControl,
      dte.emisor.nombre,
      dte.emisor.nit,
      dte.receptor.nombre,
      dte.receptor.numDocumento || '',
      respuestaMH.selloRecepcion || ''
    ].join(' ').toLowerCase()
  };
  
  if (existente) {
    // Actualizar registro existente
    await db.put(STORE_NAME, { ...record, id: existente.id });
  } else {
    // Crear nuevo registro
    await db.add(STORE_NAME, record);
  }
};

// Obtener historial con filtros
export const obtenerHistorialDTE = async (
  filtros: DTEHistoryFilter = {}
): Promise<{ registros: DTEHistoryRecord[]; total: number }> => {
  const db = await openHistoryDb();
  
  let registros = await db.getAll(STORE_NAME);
  
  // Aplicar filtros
  if (filtros.fechaDesde) {
    registros = registros.filter(r => r.fechaEmision >= filtros.fechaDesde!);
  }
  
  if (filtros.fechaHasta) {
    registros = registros.filter(r => r.fechaEmision <= filtros.fechaHasta!);
  }
  
  if (filtros.tipoDte) {
    registros = registros.filter(r => r.tipoDte === filtros.tipoDte);
  }
  
  if (filtros.estado) {
    registros = registros.filter(r => r.estado === filtros.estado);
  }
  
  if (filtros.busqueda) {
    const busqueda = filtros.busqueda.toLowerCase();
    registros = registros.filter(r => r.searchText.includes(busqueda));
  }
  
  // Ordenar por fecha descendente
  registros.sort((a, b) => {
    const fechaA = `${a.fechaEmision} ${a.horaEmision}`;
    const fechaB = `${b.fechaEmision} ${b.horaEmision}`;
    return fechaB.localeCompare(fechaA);
  });
  
  const total = registros.length;
  
  // Aplicar paginación
  if (filtros.offset !== undefined) {
    registros = registros.slice(filtros.offset);
  }
  
  if (filtros.limite !== undefined) {
    registros = registros.slice(0, filtros.limite);
  }
  
  return { registros, total };
};

// Obtener un DTE específico
export const obtenerDTEPorCodigo = async (
  codigoGeneracion: string
): Promise<DTEHistoryRecord | null> => {
  const db = await openHistoryDb();
  const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', codigoGeneracion);
  return registro || null;
};

// Obtener estadísticas
export const obtenerEstadisticasDTE = async (
  filtros: { fechaDesde?: string; fechaHasta?: string } = {}
): Promise<DTEHistoryStats> => {
  const { registros } = await obtenerHistorialDTE(filtros);
  
  const stats: DTEHistoryStats = {
    totalEmitidos: registros.length,
    totalAceptados: 0,
    totalRechazados: 0,
    totalPendientes: 0,
    montoTotalEmitido: 0,
    montoTotalIva: 0,
    porTipo: {},
    porMes: {}
  };
  
  for (const r of registros) {
    // Conteo por estado
    if (r.estado === 'ACEPTADO') stats.totalAceptados++;
    else if (r.estado === 'RECHAZADO') stats.totalRechazados++;
    else stats.totalPendientes++;
    
    // Montos (solo aceptados)
    if (r.estado === 'ACEPTADO') {
      stats.montoTotalEmitido += r.montoTotal;
      stats.montoTotalIva += r.montoIva;
    }
    
    // Por tipo
    stats.porTipo[r.tipoDte] = (stats.porTipo[r.tipoDte] || 0) + 1;
    
    // Por mes
    const mes = r.fechaEmision.substring(0, 7); // YYYY-MM
    if (!stats.porMes[mes]) {
      stats.porMes[mes] = { cantidad: 0, monto: 0 };
    }
    stats.porMes[mes].cantidad++;
    if (r.estado === 'ACEPTADO') {
      stats.porMes[mes].monto += r.montoTotal;
    }
  }
  
  return stats;
};

// Eliminar DTE del historial
export const eliminarDTEDelHistorial = async (codigoGeneracion: string): Promise<boolean> => {
  const db = await openHistoryDb();
  const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', codigoGeneracion);
  
  if (registro?.id) {
    await db.delete(STORE_NAME, registro.id);
    return true;
  }
  return false;
};

// Exportar historial a JSON
export const exportarHistorialJSON = async (
  filtros: DTEHistoryFilter = {}
): Promise<string> => {
  const { registros } = await obtenerHistorialDTE(filtros);
  
  const exportData = {
    version: '1.0',
    fechaExportacion: new Date().toISOString(),
    totalRegistros: registros.length,
    registros: registros.map(r => ({
      codigoGeneracion: r.codigoGeneracion,
      numeroControl: r.numeroControl,
      tipoDte: r.tipoDte,
      fechaEmision: r.fechaEmision,
      emisor: r.emisorNombre,
      receptor: r.receptorNombre,
      montoTotal: r.montoTotal,
      estado: r.estado,
      selloRecepcion: r.selloRecepcion,
      dteCompleto: r.dteJson
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
};

// Obtener tipos de DTE para filtros
export const getTiposDTEEnHistorial = async (): Promise<string[]> => {
  const db = await openHistoryDb();
  const registros = await db.getAll(STORE_NAME);
  const tipos = new Set(registros.map(r => r.tipoDte));
  return Array.from(tipos).sort();
};

// Limpiar historial antiguo (más de X días)
export const limpiarHistorialAntiguo = async (diasAntiguedad: number = 365): Promise<number> => {
  const db = await openHistoryDb();
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);
  const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];
  
  const registros = await db.getAll(STORE_NAME);
  let eliminados = 0;
  
  for (const r of registros) {
    if (r.fechaEmision < fechaLimiteStr && r.id) {
      await db.delete(STORE_NAME, r.id);
      eliminados++;
    }
  }
  
  return eliminados;
};
