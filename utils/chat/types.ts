/* eslint-disable @typescript-eslint/no-explicit-any */
// Tipos base para el sistema de chat abstracto con filtrado de tablas.
// Cada "dominio" (historial, clientes, inventario) provee su configuración
// y el motor genérico se encarga de: cache, parser local y LLM.

import type { PageAction } from '../../contexts/ChatContext';

/** Acción que produce una respuesta del chat (coincide con PageAction). */
export type ChatAction = PageAction;

/** Respuesta unificada del handler del chat. */
export interface ChatResponse {
  content: string;
  action?: ChatAction;
  /** Origen de la respuesta, útil para debug. */
  source?: 'cache' | 'local' | 'llm' | 'error';
}

/** Regla del parser local: si la pregunta matchea, se aplican filtros y/o se ejecuta un mapper. */
export interface LocalIntentRule<TFilters extends Record<string, any>> {
  /** Patrón que dispara la regla. Puede ser string (substring, case-insensitive) o RegExp. */
  match: RegExp | string;
  /**
   * Filtros a aplicar. Puede ser un objeto estático o una función que recibe
   * el match (o la pregunta normalizada) y devuelve los filtros.
   */
  filters: Partial<TFilters> | ((match: RegExpMatchArray, question: string) => Partial<TFilters>);
  /** Texto de respuesta opcional; si no se provee, se genera uno por defecto. */
  reply?: string | ((filters: Partial<TFilters>) => string);
}

/** Descriptor de un dominio de chat (una tabla/entidad). */
export interface ChatDomain<TFilters extends Record<string, any>, TRecord = any> {
  id: string;
  name: string;
  suggestedQuestions: string[];

  /** Reglas del parser local (primera que matchee gana). */
  localRules: LocalIntentRule<TFilters>[];

  /**
   * Palabras que indican que la pregunta es analítica (requiere LLM).
   * Si alguna aparece en la pregunta, se prioriza LLM sobre parser local.
   */
  analyticalKeywords?: string[];

  /** Prompt del sistema que describe al LLM los filtros válidos. */
  llmSystemPrompt: string;

  /** Schema JSON estilo Gemini responseSchema para forzar output estructurado. */
  llmFilterSchema: Record<string, any>;

  /** Carga los datos necesarios para alimentar al LLM (solo se invoca si hay que llamar al LLM). */
  loadRecords: () => Promise<TRecord[]>;

  /**
   * Calcula un resumen compacto a partir de los registros.
   * Esto se envía al LLM en lugar de los registros crudos → baja tokens drásticamente.
   */
  computeSummary: (records: TRecord[]) => Record<string, any>;

  /** Aplica los filtros a la UI (callback que el componente registra). */
  applyFilters?: (filters: Partial<TFilters>) => void;
}

/** Configuración para el factory del handler. */
export interface CreateChatHandlerOptions<TFilters extends Record<string, any>, TRecord = any> {
  domain: ChatDomain<TFilters, TRecord>;
  /** Habilita/deshabilita el cache. Default: true. */
  enableCache?: boolean;
  /** TTL del cache en ms. Default: 15 minutos. */
  cacheTtlMs?: number;
}
