import { getDTEHistory } from './api/historyApi';
import { loadSettings } from './settings';
import type { PageAction } from '../contexts/ChatContext';

interface PageContextHandler {
  (question: string): Promise<{ content: string; action?: PageAction }>;
}

type LLMProvider = 'gemini' | 'groq' | 'deepseek' | 'zai';

async function callLLM(provider: LLMProvider, apiKey: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'gemini': {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          }),
        }
      );
      const geminiJson = await geminiRes.json();
      if (!geminiRes.ok) throw new Error(geminiJson?.error?.message || 'Error llamando a Gemini');
      const geminiText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!geminiText) throw new Error('Gemini no devolvió respuesta');
      return geminiText;
    }

    case 'groq': {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });
      const groqJson = await groqRes.json();
      if (!groqRes.ok) throw new Error(groqJson?.error?.message || 'Error llamando a Groq');
      const groqText = groqJson?.choices?.[0]?.message?.content;
      if (!groqText) throw new Error('Groq no devolvió respuesta');
      return groqText;
    }

    case 'deepseek': {
      const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });
      const dsJson = await dsRes.json();
      if (!dsRes.ok) throw new Error(dsJson?.error?.message || 'Error llamando a DeepSeek');
      const dsText = dsJson?.choices?.[0]?.message?.content;
      if (!dsText) throw new Error('DeepSeek no devolvió respuesta');
      return dsText;
    }

    case 'zai': {
      // z.ai usa formato similar a OpenAI
      const zaiRes = await fetch('https://api.z.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'zai-7b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });
      const zaiJson = await zaiRes.json();
      if (!zaiRes.ok) throw new Error(zaiJson?.error?.message || 'Error llamando a z.ai');
      const zaiText = zaiJson?.choices?.[0]?.message?.content;
      if (!zaiText) throw new Error('z.ai no devolvió respuesta');
      return zaiText;
    }

    default:
      throw new Error('Proveedor LLM no soportado');
  }
}

export async function createHistorialHandler(businessId: string): Promise<PageContextHandler> {
  const settings = loadSettings();

  // Determinar proveedor y API key a usar
  const provider: LLMProvider = (settings.aiProvider as LLMProvider) || 'gemini';
  let apiKey = '';

  switch (provider) {
    case 'gemini':
      apiKey = settings.geminiApiKey || settings.apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
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

  if (!apiKey) {
    return async () => ({
      content: `Configura tu API Key de ${provider.toUpperCase()} en Configuración Avanzada → IA & APIs`
    });
  }

  return async (question: string) => {
    // Cargar DTEs del último mes por defecto
    const fechaHasta = new Date().toISOString().split('T')[0];
    const fechaDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const histRes = await getDTEHistory(businessId, { limit: 100, fechaDesde, fechaHasta });

    if (!histRes.dtes || histRes.dtes.length === 0) {
      return { content: 'No hay DTEs en el periodo seleccionado para analizar.' };
    }

    // Construir prompt con datos
    const datosResumen = histRes.dtes.map(d => ({
      tipo: d.tipoDte,
      fecha: d.createdAt?.split('T')[0],
      receptor: d.receptorNombre,
      monto: d.montoTotal,
      estado: d.estado,
    }));

    const prompt = `Eres un asistente experto en facturación electrónica de El Salvador (DTE).
El usuario te pregunta sobre sus datos reales. Responde de forma clara y concisa.

Datos de DTEs (últimos 30 días, total ${histRes.total} documentos):
${JSON.stringify(datosResumen.slice(0, 50))}

Pregunta del usuario: "${question}"

Si la pregunta implica filtrar los datos (ej: "muéstrame solo rechazados", "del mes pasado", "mayores a $1000"),
responde en formato JSON con esta estructura:
{
  "respuesta": "tu respuesta en español",
  "accion": {
    "type": "filter",
    "filters": {
      "estado": "RECHAZADO",
      "fechaDesde": "2025-03-01",
      "montoMin": 1000
    }
  }
}

Si no requiere filtros, responde solo con texto en español, máximo 150 palabras.`;

    try {
      const text = await callLLM(provider, apiKey, prompt);

      // Intentar parsear JSON si el LLM devolvió una acción
      try {
        const parsed = JSON.parse(text);
        if (parsed.respuesta && parsed.accion) {
          return {
            content: parsed.respuesta,
            action: parsed.accion,
          };
        }
      } catch {
        // No es JSON, es texto plano
      }

      return { content: text };
    } catch (err) {
      console.error('[chatHandlers] Error:', err);
      return { content: `Error al llamar a ${provider.toUpperCase()}: ${(err as Error).message}` };
    }
  };
}

export async function createInventarioHandler(_businessId: string): Promise<PageContextHandler> {
  return async (_question: string) => {
    // Placeholder para Inventario - aún no implementado
    return { content: 'El chat de Inventario aún está en desarrollo. Próximamente podrás preguntar sobre stock, productos, márgenes, etc.' };
  };
}
