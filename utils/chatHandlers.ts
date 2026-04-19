import { getDTEHistory } from './api/historyApi';
import { loadSettings } from './settings';

interface PageContextHandler {
  (question: string): Promise<string>;
}

export async function createHistorialHandler(businessId: string): Promise<PageContextHandler> {
  const settings = loadSettings();
  const apiKey = settings.apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

  if (!apiKey) {
    return async () => 'Configura tu Gemini API Key en Configuración Avanzada → IA & APIs';
  }

  return async (question: string) => {
    // Cargar DTEs del último mes por defecto
    const fechaHasta = new Date().toISOString().split('T')[0];
    const fechaDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const histRes = await getDTEHistory(businessId, { limit: 100, fechaDesde, fechaHasta });

    if (!histRes.dtes || histRes.dtes.length === 0) {
      return 'No hay DTEs en el periodo seleccionado para analizar.';
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

Responde en español, máximo 150 palabras.`;

    const res = await fetch(
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

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Error llamando a Gemini');
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini no devolvió respuesta');
    return text;
  };
}

export async function createInventarioHandler(_businessId: string): Promise<PageContextHandler> {
  return async (_question: string) => {
    // Placeholder para Inventario - aún no implementado
    return 'El chat de Inventario aún está en desarrollo. Próximamente podrás preguntar sobre stock, productos, márgenes, etc.';
  };
}
