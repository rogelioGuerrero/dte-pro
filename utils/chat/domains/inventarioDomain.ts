// Dominio de chat para Inventario / Catálogo de Productos.

import { inventarioService } from '../../inventario/inventarioService';
import type { Producto } from '../../../types/inventario';
import type { ChatDomain, LocalIntentRule } from '../types';

export interface InventarioFilters {
  busqueda?: string;
  categoria?: string; // 'todos' o nombre de categoría
}

const rules: LocalIntentRule<InventarioFilters>[] = [
  // Sin stock / agotados
  {
    match: /\b(sin\s*stock|agotad[oa]s?|sin\s*existencias?)\b/i,
    filters: { busqueda: '__sin_stock__' }, // sentinel manejado por la UI si se desea
    reply: 'Mostrando productos sin stock (usa el filtro manual si tu pantalla no soporta este marcador).',
  },
  // Busqueda por categoría explícita
  {
    match: /\bcategoria\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][\w\sÁÉÍÓÚÑáéíóúñ.-]{1,40}?)(?:\s*[?.,]|$)/i,
    filters: (m) => ({ categoria: (m[1] || '').trim() }),
    reply: (f) => (f.categoria ? `Filtrando por categoría "${f.categoria}".` : 'Aplicando filtro de categoría.'),
  },
  // Buscar por palabra clave
  {
    match: /\b(?:producto|productos|busca|buscar|muestra|muestrame)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][\w\sÁÉÍÓÚÑáéíóúñ.-]{2,50}?)(?:\s*[?.,]|$)/i,
    filters: (m) => {
      const raw = (m[1] || '').trim();
      const stop = new Set(['todos', 'todas', 'activos']);
      if (!raw || stop.has(raw.toLowerCase())) return {};
      return { busqueda: raw };
    },
    reply: (f) => (f.busqueda ? `Filtrando productos por "${f.busqueda}".` : 'Aplicando búsqueda.'),
  },
  // Limpiar
  {
    match: /\b(limpia|borra|quita)\s*(los?\s*)?filtros?\b/i,
    filters: { busqueda: '', categoria: 'todos' },
    reply: 'Filtros limpiados.',
  },
];

export const inventarioDomain: ChatDomain<InventarioFilters, Producto> = {
  id: 'inventario',
  name: 'Inventario',
  suggestedQuestions: [
    '¿Cuántos productos tengo en inventario?',
    'Busca producto leche',
    'Categoría bebidas',
    '¿Cuáles son mis productos con más stock?',
  ],
  localRules: rules,
  analyticalKeywords: [
    'cuantos',
    'cuantas',
    'total',
    'principales',
    'top',
    'mas',
    'mejores',
    'ranking',
    'valor',
    'promedio',
  ],
  llmSystemPrompt:
    'Eres un asistente de inventario para un negocio pequeño. Responde breve en español y ayuda a filtrar el catálogo.',
  llmFilterSchema: {
    busqueda: 'string (descripción o código)',
    categoria: 'string (nombre de la categoría, o "todos")',
  },
  loadRecords: async () => {
    return inventarioService.getProductos();
  },
  computeSummary: (records) => {
    const porCategoria: Record<string, number> = {};
    let valorTotal = 0;
    for (const p of records) {
      const c = p.categoria || 'Sin categoría';
      porCategoria[c] = (porCategoria[c] || 0) + 1;
      valorTotal += (p.existenciasTotales || 0) * (p.costoPromedio || 0);
    }
    const topPorStock = [...records]
      .sort((a, b) => (b.existenciasTotales || 0) - (a.existenciasTotales || 0))
      .slice(0, 10)
      .map((p) => ({
        descripcion: p.descripcion,
        categoria: p.categoria,
        existencias: p.existenciasTotales,
      }));
    return {
      totalProductos: records.length,
      valorInventario: Number(valorTotal.toFixed(2)),
      porCategoria,
      topPorStock,
    };
  },
};
