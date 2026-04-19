// Dominio de chat para Historial de DTEs.

import { getDTEHistory } from '../../api/historyApi';
import type { DTEHistoryItem } from '../../../types/history';
import type { ChatDomain, LocalIntentRule } from '../types';

export interface HistorialFilters {
  busqueda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipoDte?: string;
  estado?: 'PROCESADO' | 'RECHAZADO' | 'PENDIENTE' | string;
}

const toISO = (d: Date): string => d.toISOString().split('T')[0];

const startOfMonth = (offset = 0): Date => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfMonth = (offset = 0): Date => {
  const d = startOfMonth(offset + 1);
  d.setDate(0);
  return d;
};

const todayISO = (): string => toISO(new Date());

const rules: LocalIntentRule<HistorialFilters>[] = [
  // ---- Tipo DTE ----
  {
    match: /\b(ccfe?|credito\s*fiscal|comprobante\s*de\s*credito)\b/i,
    filters: { tipoDte: '03' },
    reply: 'Filtrando por Comprobantes de Crédito Fiscal (03).',
  },
  {
    match: /\b(factura\s*electronica|^fe\b|\bfes\b|facturas?\b)/i,
    filters: { tipoDte: '01' },
    reply: 'Filtrando por Facturas Electrónicas (01).',
  },
  {
    match: /\bnota\s*de\s*remision\b/i,
    filters: { tipoDte: '04' },
    reply: 'Filtrando por Notas de Remisión (04).',
  },
  {
    match: /\bnota\s*de\s*credito\b/i,
    filters: { tipoDte: '05' },
    reply: 'Filtrando por Notas de Crédito (05).',
  },
  {
    match: /\bnota\s*de\s*debito\b/i,
    filters: { tipoDte: '06' },
    reply: 'Filtrando por Notas de Débito (06).',
  },
  {
    match: /\bsujeto\s*excluido\b/i,
    filters: { tipoDte: '14' },
    reply: 'Filtrando por Sujeto Excluido (14).',
  },

  // ---- Estado ----
  {
    match: /\brechazad[oa]s?\b/i,
    filters: { estado: 'RECHAZADO' },
    reply: 'Mostrando DTEs rechazados.',
  },
  {
    match: /\b(pendientes?|en\s*proceso)\b/i,
    filters: { estado: 'PENDIENTE' },
    reply: 'Mostrando DTEs pendientes.',
  },
  {
    match: /\b(aceptad[oa]s?|procesad[oa]s?|exitos[oa]s?)\b/i,
    filters: { estado: 'PROCESADO' },
    reply: 'Mostrando DTEs procesados correctamente.',
  },

  // ---- Fechas relativas ----
  {
    match: /\bmes\s*pasad[oa]\b/i,
    filters: () => ({
      fechaDesde: toISO(startOfMonth(-1)),
      fechaHasta: toISO(endOfMonth(-1)),
    }),
    reply: 'Filtrando por el mes pasado.',
  },
  {
    match: /\beste\s*mes\b/i,
    filters: () => ({
      fechaDesde: toISO(startOfMonth(0)),
      fechaHasta: todayISO(),
    }),
    reply: 'Filtrando por este mes.',
  },
  {
    match: /\b(hoy|dia\s*de\s*hoy)\b/i,
    filters: () => ({ fechaDesde: todayISO(), fechaHasta: todayISO() }),
    reply: 'Filtrando por el día de hoy.',
  },
  {
    match: /\bultim[oa]s?\s*(\d+)\s*d[ií]as?\b/i,
    filters: (m) => {
      const n = parseInt(m[1], 10) || 7;
      const from = new Date();
      from.setDate(from.getDate() - n);
      return { fechaDesde: toISO(from), fechaHasta: todayISO() };
    },
    reply: 'Filtrando por los últimos días indicados.',
  },
  {
    match: /\bultima\s*semana\b|\b7\s*dias\b/i,
    filters: () => {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { fechaDesde: toISO(from), fechaHasta: todayISO() };
    },
    reply: 'Filtrando por los últimos 7 días.',
  },

  // ---- Búsqueda por receptor/cliente ----
  {
    // "ventas a Juan Pueblo", "facturas de Juan Pueblo", "cliente Juan"
    match: /\b(?:a|de|para|cliente|receptor)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][\wÁÉÍÓÚÑáéíóúñ\s.]{2,50}?)(?:\s*[?.,]|$)/,
    filters: (m) => {
      const raw = (m[1] || '').trim();
      // Descarta matches triviales
      const stop = new Set([
        'hoy',
        'ayer',
        'mañana',
        'este',
        'esta',
        'mes',
        'semana',
        'dia',
        'año',
      ]);
      if (!raw || stop.has(raw.toLowerCase())) return {};
      return { busqueda: raw };
    },
    reply: (f) => (f.busqueda ? `Filtrando por "${f.busqueda}".` : 'Aplicando filtro de búsqueda.'),
  },

  // ---- Limpiar ----
  {
    match: /\b(limpia|borra|quita)\s*(los?\s*)?filtros?\b/i,
    filters: {
      busqueda: '',
      fechaDesde: '',
      fechaHasta: '',
      tipoDte: '',
      estado: '',
    },
    reply: 'Filtros limpiados.',
  },
];

export const createHistorialDomain = (
  businessId: string
): ChatDomain<HistorialFilters, DTEHistoryItem> => ({
  id: 'historial',
  name: 'Historial de DTEs',
  suggestedQuestions: [
    'Muéstrame los CCFE rechazados',
    'Ventas a Consumidor Final este mes',
    '¿Cuál es mi monto total facturado?',
    '¿Quiénes son mis principales clientes?',
  ],
  localRules: rules,
  analyticalKeywords: [
    'cuanto',
    'cuanta',
    'cuantos',
    'cuantas',
    'total',
    'totales',
    'promedio',
    'ranking',
    'principales',
    'top',
    'mejores',
    'peores',
    'comparar',
    'diferencia',
    'porcentaje',
    'grafico',
    'tendencia',
  ],
  llmSystemPrompt:
    'Eres un asistente de facturación electrónica (El Salvador). Analiza los datos del historial de DTEs del usuario y responde de forma breve y clara.',
  llmFilterSchema: {
    busqueda: 'string (nombre/NIT del receptor)',
    fechaDesde: 'YYYY-MM-DD',
    fechaHasta: 'YYYY-MM-DD',
    tipoDte: '01=FE, 03=CCFE, 04=Remisión, 05=NC, 06=ND, 14=Sujeto Excluido',
    estado: 'PROCESADO | RECHAZADO | PENDIENTE',
  },
  loadRecords: async () => {
    const fechaHasta = todayISO();
    const fechaDesde = toISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const res = await getDTEHistory(businessId, {
      limit: 500,
      fechaDesde,
      fechaHasta,
    });
    return res.dtes || [];
  },
  computeSummary: (records) => {
    const porTipo: Record<string, number> = {};
    const porEstado: Record<string, number> = {};
    const porReceptor: Record<string, { cantidad: number; monto: number }> = {};
    let montoTotal = 0;

    for (const r of records) {
      porTipo[r.tipoDte] = (porTipo[r.tipoDte] || 0) + 1;
      porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
      const nombre = r.receptorNombre || 'Consumidor Final';
      if (!porReceptor[nombre]) porReceptor[nombre] = { cantidad: 0, monto: 0 };
      porReceptor[nombre].cantidad += 1;
      porReceptor[nombre].monto += r.montoTotal || 0;
      montoTotal += r.montoTotal || 0;
    }

    const topReceptores = Object.entries(porReceptor)
      .sort((a, b) => b[1].monto - a[1].monto)
      .slice(0, 10)
      .map(([nombre, info]) => ({
        nombre,
        cantidad: info.cantidad,
        monto: Number(info.monto.toFixed(2)),
      }));

    return {
      totalDocumentos: records.length,
      montoTotal: Number(montoTotal.toFixed(2)),
      porTipo,
      porEstado,
      topReceptores,
      periodo: '30 días',
    };
  },
});
