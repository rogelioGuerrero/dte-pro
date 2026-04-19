// Dominio de chat para el módulo de Clientes.

import { getClients, type ClientData } from '../../clientDb';
import type { ChatDomain, LocalIntentRule } from '../types';

export interface ClientesFilters {
  busqueda?: string;
  departamento?: string;
}

const rules: LocalIntentRule<ClientesFilters>[] = [
  // Buscar por nombre / NIT
  {
    match: /\b(?:cliente|clientes|buscar|muestra|muestrame)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][\w\sÁÉÍÓÚÑáéíóúñ.-]{2,50}?)(?:\s*[?.,]|$)/i,
    filters: (m) => {
      const raw = (m[1] || '').trim();
      const stop = new Set(['todos', 'todas', 'hoy', 'activos']);
      if (!raw || stop.has(raw.toLowerCase())) return {};
      return { busqueda: raw };
    },
    reply: (f) => (f.busqueda ? `Filtrando clientes por "${f.busqueda}".` : 'Aplicando búsqueda.'),
  },
  // Limpiar
  {
    match: /\b(limpia|borra|quita)\s*(los?\s*)?filtros?\b/i,
    filters: { busqueda: '', departamento: '' },
    reply: 'Filtros limpiados.',
  },
];

export const clientesDomain: ChatDomain<ClientesFilters, ClientData> = {
  id: 'clientes',
  name: 'Clientes',
  suggestedQuestions: [
    '¿Cuántos clientes tengo?',
    'Busca al cliente Juan Pueblo',
    '¿Cuáles son mis clientes de San Salvador?',
  ],
  localRules: rules,
  analyticalKeywords: [
    'cuantos',
    'cuantas',
    'total',
    'principales',
    'top',
    'ranking',
    'resumen',
    'estadisticas',
  ],
  llmSystemPrompt:
    'Eres un asistente que ayuda al usuario a explorar su base de clientes. Responde con brevedad en español.',
  llmFilterSchema: {
    busqueda: 'string (nombre, NIT o NRC)',
    departamento: 'string (nombre del departamento de El Salvador)',
  },
  loadRecords: async () => {
    return await getClients();
  },
  computeSummary: (records) => {
    const porDepto: Record<string, number> = {};
    for (const c of records) {
      const d = (c.departamento || 'Sin depto').trim() || 'Sin depto';
      porDepto[d] = (porDepto[d] || 0) + 1;
    }
    const topDeptos = Object.entries(porDepto)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));
    return {
      totalClientes: records.length,
      topDepartamentos: topDeptos,
      ejemplos: records.slice(0, 10).map((c) => ({
        nombre: c.name,
        nit: c.nit,
        departamento: c.departamento,
      })),
    };
  },
};
