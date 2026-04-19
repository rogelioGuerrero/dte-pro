/* eslint-disable @typescript-eslint/no-explicit-any */
// Factory genérico: dado un ChatDomain, produce un queryHandler compatible
// con ChatContext. Pipeline:  cache → parser local → LLM (con resumen).

import { callLLM, type LLMProvider } from '../chatHandlers';
import { loadSettings } from '../settings';
import { getCachedResponse, setCachedResponse } from './chatCache';
import { parseLocalIntent } from './localIntentParser';
import type { ChatResponse, CreateChatHandlerOptions } from './types';

const resolveLLMCredentials = (): { provider: LLMProvider; apiKey: string } | null => {
  const settings = loadSettings();
  const provider: LLMProvider = (settings.aiProvider as LLMProvider) || 'gemini';
  let apiKey = '';
  switch (provider) {
    case 'gemini':
      apiKey =
        settings.geminiApiKey ||
        settings.apiKey ||
        (import.meta.env.VITE_GEMINI_API_KEY as string) ||
        '';
      break;
    case 'groq':
      apiKey = settings.groqApiKey || '';
      break;
    case 'deepseek':
      apiKey = settings.deepseekApiKey || '';
      break;
    case 'zai':
      apiKey = settings.zaiApiKey || '';
      break;
  }
  return apiKey ? { provider, apiKey } : null;
};

const extractJson = (text: string): any | null => {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    // Intentar extraer el primer bloque {...}
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

export const createChatHandler = <TFilters extends Record<string, any>>(
  options: CreateChatHandlerOptions<TFilters>
) => {
  const { domain, enableCache = true, cacheTtlMs } = options;

  return async (question: string): Promise<ChatResponse> => {
    const trimmed = question.trim();
    if (!trimmed) return { content: 'Escribe una pregunta.' };

    // 1. CACHE ---------------------------------------------------------
    if (enableCache) {
      const cached = getCachedResponse(domain.id, trimmed, cacheTtlMs);
      if (cached) return cached;
    }

    // 2. PARSER LOCAL --------------------------------------------------
    const local = parseLocalIntent(domain, trimmed);
    if (local) {
      if (enableCache) setCachedResponse(domain.id, trimmed, local);
      return local;
    }

    // 3. LLM -----------------------------------------------------------
    const creds = resolveLLMCredentials();
    if (!creds) {
      return {
        content:
          'Configura tu API Key de IA en Configuración Avanzada → IA & APIs para preguntas analíticas.',
        source: 'error',
      };
    }

    let summary: Record<string, any> = {};
    try {
      const records = await domain.loadRecords();
      if (!records || records.length === 0) {
        return { content: 'No hay datos en este módulo para analizar.', source: 'error' };
      }
      summary = domain.computeSummary(records);
    } catch (e: any) {
      return {
        content: `No se pudieron cargar los datos: ${e?.message || 'error desconocido'}`,
        source: 'error',
      };
    }

    const prompt = `${domain.llmSystemPrompt}

Resumen de datos disponibles:
${JSON.stringify(summary)}

Pregunta del usuario: "${trimmed}"

INSTRUCCIONES DE FORMATO:
- Responde SIEMPRE en JSON válido con esta estructura exacta:
  { "respuesta": "<texto en español, max 120 palabras>", "accion": <null o objeto filter> }
- Si la pregunta implica filtrar la tabla, "accion" debe ser:
  { "type": "filter", "filters": { ...campos válidos según el esquema... } }
- Si es solo informativa (totales, rankings), "accion" debe ser null.
- Esquema de filtros válidos: ${JSON.stringify(domain.llmFilterSchema)}
- NO inventes campos fuera del esquema. Si el campo no aplica, omítelo.`;

    try {
      const raw = await callLLM(creds.provider, creds.apiKey, prompt);
      const parsed = extractJson(raw);

      let response: ChatResponse;
      if (parsed && typeof parsed.respuesta === 'string') {
        response = {
          content: parsed.respuesta,
          action:
            parsed.accion && parsed.accion.type === 'filter' && parsed.accion.filters
              ? { type: 'filter', filters: parsed.accion.filters }
              : undefined,
          source: 'llm',
        };
      } else {
        response = { content: raw, source: 'llm' };
      }

      if (enableCache) setCachedResponse(domain.id, trimmed, response);
      return response;
    } catch (e: any) {
      return {
        content: `Error al consultar la IA: ${e?.message || 'desconocido'}`,
        source: 'error',
      };
    }
  };
};
