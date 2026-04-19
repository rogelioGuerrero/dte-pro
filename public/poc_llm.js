/**
 * POC: LLM sobre datos de facturas en IndexedDB/localStorage
 * 
 * Uso: Pegar en la consola del navegador con la app abierta.
 * 
 * Flujo:
 *   1. Lee API Key de localStorage (dte_app_settings.apiKey)
 *   2. Lee los últimos DTEs del IndexedDB (dte-cache-db / dteCache)
 *   3. Arma un prompt plantilla con los datos reales
 *   4. Llama a Gemini Flash y muestra la respuesta
 */

(async () => {
  // ── 1. Leer API Key ──────────────────────────────────────────────────────────
  // ⚠️ POC local - pon tu API key aquí para pruebas
  const apiKey = '';
  if (!apiKey) { console.error('❌ Pon tu API key en poc_llm.js'); return; }
  console.log('✅ API Key lista.');

  // ── 2. Leer DTEs desde IndexedDB ─────────────────────────────────────────────
  const getDTEs = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('dte-cache-db');
      req.onsuccess = (e) => {
        const db = e.target.result;
        const storeNames = Array.from(db.objectStoreNames);
        const storeName = storeNames.includes('dteCache') ? 'dteCache' : storeNames[0];

        if (!storeName) {
          resolve([]);
          return;
        }

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const all = store.getAll();
        all.onsuccess = () => resolve(all.result || []);
        all.onerror = () => reject(all.error);
      };
      req.onerror = () => reject(req.error);
    });

  let dtes = [];
  try {
    dtes = await getDTEs();
  } catch (err) {
    console.warn('⚠️ No se pudo leer IndexedDB:', err);
  }

  if (dtes.length === 0) {
    console.warn('⚠️ No hay DTEs en cache local. Usando datos de ejemplo para probar el flujo con Gemini...');
    dtes = [
      { tipoDte:'01', fechaEmision:'2025-04-01', receptorNombre:'Juan García', montoTotal:115.00, montoIva:15.00, estado:'ACEPTADO', numeroControl:'DTE-01-00000001-000000000000001' },
      { tipoDte:'01', fechaEmision:'2025-04-03', receptorNombre:'María López', montoTotal:230.00, montoIva:30.00, estado:'ACEPTADO', numeroControl:'DTE-01-00000001-000000000000002' },
      { tipoDte:'03', fechaEmision:'2025-04-05', receptorNombre:'Empresa XYZ S.A.', montoTotal:500.00, montoIva:65.00, estado:'ACEPTADO', numeroControl:'DTE-03-00000001-000000000000001' },
      { tipoDte:'01', fechaEmision:'2025-04-08', receptorNombre:'Carlos Rivas', montoTotal:57.50, montoIva:7.50, estado:'RECHAZADO', numeroControl:'DTE-01-00000001-000000000000003' },
      { tipoDte:'03', fechaEmision:'2025-04-10', receptorNombre:'Distribuidora ABC', montoTotal:1200.00, montoIva:156.00, estado:'ACEPTADO', numeroControl:'DTE-03-00000001-000000000000002' },
      { tipoDte:'14', fechaEmision:'2025-04-12', receptorNombre:'Pedro Martínez', montoTotal:80.00, montoIva:0, estado:'ACEPTADO', numeroControl:'DTE-14-00000001-000000000000001' },
    ];
  }

  console.log(`📄 ${dtes.length} DTE(s) a analizar.`);

  // ── 3. Preparar resumen de datos (sin datos sensibles extra) ─────────────────
  // Solo enviamos campos de negocio, sin firma electrónica ni claves privadas
  const resumen = dtes
    .slice(0, 20) // máximo 20 para no exceder tokens
    .map((d) => ({
      tipo: d.tipoDte,
      fecha: d.fechaEmision,
      receptor: d.receptorNombre,
      montoTotal: d.montoTotal,
      montoIva: d.montoIva,
      estado: d.estado,
      numeroControl: d.numeroControl,
    }));

  // Calcular estadísticas básicas para el prompt
  const totalFacturas = dtes.length;
  const aceptadas = dtes.filter((d) => d.estado === 'ACEPTADO').length;
  const rechazadas = dtes.filter((d) => d.estado === 'RECHAZADO').length;
  const montoTotal = dtes.reduce((sum, d) => sum + (d.montoTotal || 0), 0);
  const montoIvaTotal = dtes.reduce((sum, d) => sum + (d.montoIva || 0), 0);

  const porTipo = dtes.reduce((acc, d) => {
    const label =
      d.tipoDte === '01' ? 'Factura Electrónica (01)' :
      d.tipoDte === '03' ? 'Crédito Fiscal (03)' :
      d.tipoDte === '14' ? 'Sujeto Excluido (14)' :
      `Tipo ${d.tipoDte}`;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  // ── 4. Armar prompt plantilla ────────────────────────────────────────────────
  const systemPrompt = `Eres un asistente fiscal experto en facturación electrónica de El Salvador (DTE - Ministerio de Hacienda).
Tu rol es analizar los datos reales de documentos tributarios electrónicos emitidos y dar respuestas claras, concisas y útiles al contribuyente.
IMPORTANTE: Solo analiza los datos proporcionados. No inventes cifras ni supongas información no presente.
Responde siempre en español.`;

  const userPrompt = `Analiza los siguientes documentos tributarios electrónicos emitidos y proporciona:
1. Un resumen ejecutivo del estado de facturación
2. Observaciones sobre documentos rechazados (si los hay)
3. Una sugerencia concreta basada en los datos

## Estadísticas generales
- Total de documentos: ${totalFacturas}
- Aceptados por MH: ${aceptadas}
- Rechazados: ${rechazadas}
- Monto total facturado: $${montoTotal.toFixed(2)}
- IVA total: $${montoIvaTotal.toFixed(2)}
- Por tipo de documento: ${JSON.stringify(porTipo, null, 2)}

## Últimos documentos (máximo 20)
${JSON.stringify(resumen, null, 2)}

Proporciona tu análisis en un formato amigable y directo.`;

  console.log('📤 Enviando a Gemini...');
  console.log('── PROMPT USUARIO ──');
  console.log(userPrompt);

  // ── 5. Llamar a Gemini Flash ─────────────────────────────────────────────────
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.3,       // Bajo para respuestas más factuales
      maxOutputTokens: 1024,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('❌ Error de Gemini:', json?.error?.message || json);
      return;
    }

    const respuesta = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!respuesta) {
      console.error('❌ Gemini no devolvió texto. Respuesta completa:', json);
      return;
    }

    console.log('\n── RESPUESTA DEL LLM ──────────────────────────────────────');
    console.log(respuesta);
    console.log('───────────────────────────────────────────────────────────\n');

    // También disponible como variable para inspección
    window._llmRespuesta = respuesta;
    console.log('💡 La respuesta también está en window._llmRespuesta');

  } catch (err) {
    console.error('❌ Error al llamar a Gemini:', err);
  }
})();
