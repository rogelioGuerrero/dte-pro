// Base de datos de cache temporal de DTEs
// Almacena temporalmente DTEs para offline capability y cache rápido (30 días)
// La fuente de verdad es el backend (Supabase)

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

export interface DTECacheRecord {
  id?: number;
  codigoGeneracion: string;
  numeroControl: string;
  tipoDte: string;
  fechaEmision: string;
  horaEmision: string;
  
  // Estado del DTE en cache
  status: 'pending' | 'completed' | 'failed' | 'contingency';
  createdAt: string; // Cuando se creó en cache
  updatedAt: string; // Última actualización
  
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
  
  // Estado de transmisión
  estado: 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE' | 'CONTINGENCIA';
  selloRecepcion?: string;
  
  // Datos completos
  dteJson: DTEArchivado;
  respuestaMH?: TransmisionResult;
  
  // Metadatos
  fechaTransmision?: string;
  ambiente: '00' | '01';
  
  // Campos para manejo de estados
  retryCount?: number;
  contingencyReason?: string;
  validationErrors?: string[];
  
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
    if (!registro?.id) return { ok: false, message: 'DTE no encontrado en cache' };

    const updated: DTECacheRecord = {
      ...registro,
      anulacionLocal: params.anulada
        ? {
            at: new Date().toISOString(),
            motivo: (params.motivo || '').trim() || undefined,
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    await db.put(STORE_NAME, updated);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'No se pudo actualizar el cache' };
  }
};

export interface DTECacheFilter {
  fechaDesde?: string;
  fechaHasta?: string;
  tipoDte?: string;
  estado?: string;
  status?: 'pending' | 'completed' | 'failed' | 'contingency';
  busqueda?: string;
  limite?: number;
  offset?: number;
}

export interface DTECacheStats {
  totalEmitidos: number;
  totalAceptados: number;
  totalRechazados: number;
  totalPendientes: number;
  totalContingencia: number;
  montoTotalEmitido: number;
  montoTotalIva: number;
  porTipo: Record<string, number>;
  porMes: Record<string, { cantidad: number; monto: number }>;
  porStatus: Record<string, number>;
}

const DB_NAME = 'dte-cache-db';
const DB_VERSION = 2; // Incrementar versión para nueva estructura
const STORE_NAME = 'dteCache';

let dbInstance: IDBPDatabase | null = null;

export const openCacheDb = async (): Promise<IDBPDatabase> => {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Eliminar store anterior si existe (migración)
      if (db.objectStoreNames.contains('dteHistory')) {
        db.deleteObjectStore('dteHistory');
      }
      
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
        store.createIndex('status', 'status', { unique: false }); // Nuevo índice
        store.createIndex('emisorNit', 'emisorNit', { unique: false });
        store.createIndex('receptorDocumento', 'receptorDocumento', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false }); // Nuevo índice
      }
    },
  });
  
  return dbInstance;
};

// Mantener compatibilidad temporal
export const openHistoryDb = openCacheDb;

// Guardar DTE en cache temporal
export const guardarDTEEnCache = async (
  dte: DTEJSON,
  respuestaMH?: TransmisionResult,
  ambiente: '00' | '01' = '00',
  firmaElectronica?: string,
  status: 'pending' | 'completed' | 'failed' | 'contingency' = 'completed'
): Promise<void> => {
  const db = await openCacheDb();
  
  // Verificar si ya existe
  const existente = await db.getFromIndex(
    STORE_NAME,
    'codigoGeneracion',
    dte.identificacion.codigoGeneracion
  );
  
  const now = new Date().toISOString();
  
  const record: Omit<DTECacheRecord, 'id'> = {
    codigoGeneracion: dte.identificacion.codigoGeneracion,
    numeroControl: dte.identificacion.numeroControl,
    tipoDte: dte.identificacion.tipoDte,
    fechaEmision: dte.identificacion.fecEmi,
    horaEmision: dte.identificacion.horEmi,
    
    // Estado del DTE en cache
    status,
    createdAt: existente?.createdAt || now,
    updatedAt: now,
    
    emisorNit: dte.emisor.nit,
    emisorNombre: dte.emisor.nombre,
    
    receptorNombre: dte.receptor.nombre,
    receptorDocumento: dte.receptor.numDocumento || '',
    
    montoTotal: dte.resumen.totalPagar,
    montoGravado: dte.resumen.totalGravada,
    montoIva: dte.resumen.tributos?.[0]?.valor || 0,
    
    estado: respuestaMH?.estado === 'CONTINGENCIA' 
      ? 'CONTINGENCIA' 
      : (respuestaMH?.success ? 'ACEPTADO' : 'RECHAZADO'),
    selloRecepcion: respuestaMH?.selloRecepcion,
    
    dteJson: construirDTEArchivado(dte, respuestaMH, firmaElectronica),
    respuestaMH,
    
    fechaTransmision: respuestaMH ? now : undefined,
    ambiente,
    
    // Campos para manejo de estados
    retryCount: status === 'contingency' ? 1 : undefined,
    contingencyReason: status === 'contingency' ? 'Error de comunicación con MH' : undefined,
    validationErrors: status === 'failed' ? ['Error en validación'] : undefined,
    
    // Texto para búsqueda
    searchText: [
      dte.identificacion.codigoGeneracion,
      dte.identificacion.numeroControl,
      dte.emisor.nombre,
      dte.emisor.nit,
      dte.receptor.nombre,
      dte.receptor.numDocumento || '',
      respuestaMH?.selloRecepcion || ''
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

// Mantener compatibilidad temporal
export const guardarDTEEnHistorial = guardarDTEEnCache;

// Obtener cache con filtros
export const obtenerCacheDTE = async (
  filtros: DTECacheFilter = {}
): Promise<{ registros: DTECacheRecord[]; total: number }> => {
  const db = await openCacheDb();
  
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
  
  if (filtros.status) {
    registros = registros.filter(r => r.status === filtros.status);
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

// Mantener compatibilidad temporal
export const obtenerHistorialDTE = obtenerCacheDTE;

// Obtener un DTE específico
export const obtenerDTEPorCodigo = async (
  codigoGeneracion: string
): Promise<DTECacheRecord | null> => {
  const db = await openCacheDb();
  const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', codigoGeneracion);
  return registro || null;
};

// Obtener estadísticas
export const obtenerEstadisticasDTE = async (
  filtros: { fechaDesde?: string; fechaHasta?: string } = {}
): Promise<DTECacheStats> => {
  const { registros } = await obtenerCacheDTE(filtros);
  
  const stats: DTECacheStats = {
    totalEmitidos: registros.length,
    totalAceptados: 0,
    totalRechazados: 0,
    totalPendientes: 0,
    totalContingencia: 0,
    montoTotalEmitido: 0,
    montoTotalIva: 0,
    porTipo: {},
    porMes: {},
    porStatus: {}
  };
  
  for (const r of registros) {
    // Conteo por estado
    if (r.estado === 'ACEPTADO') stats.totalAceptados++;
    else if (r.estado === 'RECHAZADO') stats.totalRechazados++;
    else if (r.estado === 'PENDIENTE') stats.totalPendientes++;
    else if (r.estado === 'CONTINGENCIA') stats.totalContingencia++;
    
    // Conteo por status
    stats.porStatus[r.status] = (stats.porStatus[r.status] || 0) + 1;
    
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

// Eliminar DTE del cache
export const eliminarDTEDelCache = async (codigoGeneracion: string): Promise<boolean> => {
  const db = await openCacheDb();
  const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', codigoGeneracion);
  
  if (registro?.id) {
    await db.delete(STORE_NAME, registro.id);
    return true;
  }
  return false;
};

// Mantener compatibilidad temporal
export const eliminarDTEDelHistorial = eliminarDTEDelCache;

// Exportar cache a JSON
export const exportarCacheJSON = async (
  filtros: DTECacheFilter = {}
): Promise<string> => {
  const { registros } = await obtenerCacheDTE(filtros);
  
  const exportData = {
    version: '2.0',
    tipo: 'cache-temporal',
    fechaExportacion: new Date().toISOString(),
    totalRegistros: registros.length,
    registros: registros.map(r => ({
      codigoGeneracion: r.codigoGeneracion,
      numeroControl: r.numeroControl,
      tipoDte: r.tipoDte,
      fechaEmision: r.fechaEmision,
      status: r.status,
      estado: r.estado,
      emisor: r.emisorNombre,
      receptor: r.receptorNombre,
      montoTotal: r.montoTotal,
      selloRecepcion: r.selloRecepcion,
      dteCompleto: r.dteJson
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
};

// Mantener compatibilidad temporal
export const exportarHistorialJSON = exportarCacheJSON;

// Obtener tipos de DTE para filtros
export const getTiposDTEEnCache = async (): Promise<string[]> => {
  const db = await openCacheDb();
  const registros = await db.getAll(STORE_NAME);
  const tipos = new Set(registros.map(r => r.tipoDte));
  return Array.from(tipos).sort();
};

// Mantener compatibilidad temporal
export const getTiposDTEEnHistorial = getTiposDTEEnCache;

// Limpiar cache antiguo (más de X días)
export const limpiarCacheAntiguo = async (diasAntiguedad: number = 30): Promise<number> => {
  const db = await openCacheDb();
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

// Mantener compatibilidad temporal
export const limpiarHistorialAntiguo = limpiarCacheAntiguo;

// ===== NUEVAS FUNCIONES DE SINCRONIZACIÓN =====

// Sincronizar cache con backend (traer últimos 30 días)
export const sincronizarCacheConBackend = async (): Promise<{
  sincronizados: number;
  errores: string[];
}> => {
  const errores: string[] = [];
  let sincronizados = 0;
  
  try {
    // TODO: Implementar llamada al backend para obtener DTEs recientes
    // const response = await fetch('/api/dtes/recent?days=30');
    // const dtesBackend = await response.json();
    
    // Por ahora, solo limpiamos cache viejo
    const eliminados = await limpiarCacheAntiguo(30);
    console.log(`Cache limpiado: ${eliminados} registros antiguos eliminados`);
    
    sincronizados = eliminados;
  } catch (error) {
    errores.push(`Error en sincronización: ${error}`);
  }
  
  return { sincronizados, errores };
};

// Guardar DTE como pendiente (antes de enviar)
export const guardarDTEComoPending = async (
  dte: DTEJSON,
  _firmaElectronica?: string // Parámetro opcional para compatibilidad, con _ para ignorar linting
): Promise<void> => {
  await guardarDTEEnCache(dte, undefined, '00', undefined, 'pending');
};

// Actualizar DTE con respuesta del backend
export const actualizarDTEConRespuesta = async (
  codigoGeneracion: string,
  respuestaMH: TransmisionResult,
  _firmaElectronica?: string // Parámetro opcional para compatibilidad, con _ para ignorar linting
): Promise<void> => {
  const db = await openCacheDb();
  const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', codigoGeneracion);
  
  if (!registro) {
    console.warn(`DTE ${codigoGeneracion} no encontrado en cache para actualizar`);
    return;
  }
  
  const status = respuestaMH.estado === 'CONTINGENCIA' ? 'contingency' : 
                  respuestaMH.success ? 'completed' : 'failed';
  
  const updated: DTECacheRecord = {
    ...registro,
    status,
    estado: respuestaMH.estado === 'CONTINGENCIA' 
      ? 'CONTINGENCIA' 
      : (respuestaMH.success ? 'ACEPTADO' : 'RECHAZADO'),
    selloRecepcion: respuestaMH.selloRecepcion,
    respuestaMH,
    fechaTransmision: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retryCount: status === 'contingency' ? (registro.retryCount || 0) + 1 : undefined,
    contingencyReason: status === 'contingency' ? 'Error de comunicación con MH' : undefined,
    validationErrors: status === 'failed' ? ['Error en transmisión'] : undefined,
  };
  
  await db.put(STORE_NAME, updated);
};

// Obtener DTEs pendientes para reintentar
export const obtenerDTEsPendientes = async (): Promise<DTECacheRecord[]> => {
  const { registros } = await obtenerCacheDTE({ status: 'pending' });
  return registros;
};

// Obtener DTEs en contingencia para reintentar
export const obtenerDTEsEnContingencia = async (): Promise<DTECacheRecord[]> => {
  const { registros } = await obtenerCacheDTE({ status: 'contingency' });
  return registros;
};

// Marcar DTE como fallido permanentemente
export const marcarDTEComoFallido = async (
  codigoGeneracion: string,
  errores: string[]
): Promise<void> => {
  const db = await openCacheDb();
  const registro = await db.getFromIndex(STORE_NAME, 'codigoGeneracion', codigoGeneracion);
  
  if (!registro) return;
  
  const updated: DTECacheRecord = {
    ...registro,
    status: 'failed',
    estado: 'RECHAZADO',
    updatedAt: new Date().toISOString(),
    validationErrors: errores,
  };
  
  await db.put(STORE_NAME, updated);
};
