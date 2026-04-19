/**
 * POC: NewsAPI + Gemini → Brief ejecutivo de noticias
 * 
 * - Llama a NewsAPI UNA vez y cachea en localStorage por 1 hora
 * - Pasa los titulares a Gemini para generar un brief narrativo
 * - Ejecutar en consola del navegador: fetch('/poc_news.js').then(r=>r.text()).then(code=>eval(code))
 */

(async () => {
  // ⚠️ POC local - pon tus API keys aquí para pruebas
  const GEMINI_KEY = '';
  const NEWS_KEY   = '';
  if (!GEMINI_KEY || !NEWS_KEY) { console.error('❌ Pon tus API keys en poc_news.js'); return; }
  const CACHE_KEY  = 'poc_news_cache';
  const CACHE_TTL  = 60 * 60 * 1000; // 1 hora en ms

  // ── 1. Noticias con cache ────────────────────────────────────────────────────
  let articulos = [];

  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  const ahora  = Date.now();

  if (cached && cached.articulos && cached.articulos.length > 0 && (ahora - cached.ts) < CACHE_TTL) {
    console.log(`📦 Usando cache de noticias (${cached.articulos.length} artículos, guardado hace ${Math.round((ahora - cached.ts)/60000)} min)`);
    articulos = cached.articulos;
  } else {
    console.log('🌐 Consultando NewsAPI...');

    const query = 'euro dollar';
    const url   = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=2026-04-18&sortBy=popularity&pageSize=10&apiKey=${NEWS_KEY}`;

    try {
      const res  = await fetch(url);
      const json = await res.json();

      if (!res.ok || json.status === 'error') {
        console.error('❌ Error NewsAPI:', json.message || json);
        return;
      }

      articulos = (json.articles || []).map(a => ({
        titulo:  a.title,
        fuente:  a.source?.name,
        fecha:   a.publishedAt?.split('T')[0],
        resumen: a.description,
        url:     a.url,
      }));

      // Guardar cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: ahora, articulos }));
      console.log(`✅ ${articulos.length} artículos obtenidos y cacheados por 1 hora.`);

    } catch (err) {
      console.error('❌ Fallo al llamar NewsAPI:', err);
      return;
    }
  }

  if (articulos.length === 0) {
    console.warn('⚠️ No hay artículos para analizar.');
    return;
  }

  console.log('📰 Artículos recibidos:');
  articulos.forEach((a, i) => console.log(`  ${i+1}. [${a.fecha}] ${a.titulo} (${a.fuente})`));

  // ── 2. Enviar a Gemini para brief ejecutivo ──────────────────────────────────
  const systemPrompt = `Eres un analista económico senior especializado en El Salvador y Centroamérica.
Tu rol es producir briefs ejecutivos concisos, neutrales y útiles para pequeños y medianos empresarios.
Responde siempre en español. Sé directo, evita repetir los titulares literalmente.`;

  const userPrompt = `Con base en los siguientes titulares de noticias recientes, genera un brief ejecutivo de máximo 200 palabras para un empresario salvadoreño. 
Incluye: (1) qué está pasando, (2) qué impacto puede tener en su negocio, (3) una recomendación práctica.

Titulares:
${articulos.map((a, i) => `${i+1}. [${a.fecha}] ${a.titulo} (${a.fuente})`).join('\n')}`;

  console.log('\n📤 Enviando a Gemini...');

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };

  try {
    const res  = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok) {
      console.error('❌ Error Gemini:', json?.error?.message || json);
      return;
    }

    const candidate = json?.candidates?.[0];
    const brief = candidate?.content?.parts?.[0]?.text;
    const finishReason = candidate?.finishReason;
    console.log('finishReason:', finishReason);
    if (!brief) { console.error('❌ Gemini no devolvió texto. Raw:', JSON.stringify(json)); return; }

    console.log('\n── BRIEF EJECUTIVO (Gemini) ────────────────────────────────');
    console.log(brief);
    console.log('────────────────────────────────────────────────────────────\n');

    window._newsBrief    = brief;
    window._newsArticulos = articulos;
    console.log('💡 Brief en window._newsBrief | Artículos en window._newsArticulos');

  } catch (err) {
    console.error('❌ Error al llamar Gemini:', err);
  }
})();
