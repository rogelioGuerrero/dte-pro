// Proveedor de IA: Google Gemini
import { AIProvider, AIProviderConfig, TaxPayerData, INITIAL_TAX_PAYER_DATA } from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';

const PROMPT =
  'Extract the data from this El Salvador Tax ID Card (Tarjeta de IVA/Contribuyente). ' +
  'I need the Name (Nombre), NIT, NRC (Registro), Economic Activity (Giro), Address (Direccion), Phone (Telefono), and Email. ' +
  'If a field is not visible, return an empty string.';

export const geminiProvider: AIProvider = {
  name: 'Google Gemini',

  async extractTaxPayerData(base64Image: string, config: AIProviderConfig): Promise<TaxPayerData> {
    const { apiKey, model = DEFAULT_MODEL } = config;

    if (!apiKey) {
      throw new Error('Falta configurar la API Key de Google Gemini.');
    }

    // Quitar encabezado data URL si viene asi
    const [header, dataPart] = base64Image.split(',');
    const cleanBase64 = dataPart || base64Image;

    let mimeType = 'image/jpeg';
    if (header && header.startsWith('data:')) {
      const match = header.match(/^data:(.*?);base64/);
      if (match && match[1]) {
        mimeType = match[1];
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: PROMPT,
            },
          ],
        },
      ],
      systemInstruction: {
        role: 'system',
        parts: [
          {
            text: 'You are an expert OCR system for El Salvador Ministry of Finance documents. Extract fields accurately.',
          },
        ],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            nit: { type: 'string' },
            nrc: { type: 'string' },
            activity: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'nit', 'nrc', 'activity', 'address'],
        },
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      const message = json?.error?.message || 'Error al llamar a Gemini.';
      throw new Error(message);
    }

    const text: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? undefined;

    if (!text) {
      throw new Error('Gemini no devolvio texto con los datos extraidos.');
    }

    // Limpiar posibles ```json ... ```
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '');

    let extracted: Partial<TaxPayerData> = {};
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      console.error('No se pudo parsear el JSON devuelto por Gemini:', text);
      throw new Error('Respuesta de Gemini no es JSON valido.');
    }

    return { ...INITIAL_TAX_PAYER_DATA, ...extracted };
  },
};
