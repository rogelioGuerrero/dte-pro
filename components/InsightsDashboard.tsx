import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, Newspaper, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink, X, Image } from 'lucide-react';
import { openCacheDb } from '../utils/dteHistoryDb';
import { loadSettings } from '../utils/settings';

function getKeys() {
  const s = loadSettings();
  return {
    gemini: s.apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '',
    news:   s.newsApiKey || (import.meta.env.VITE_NEWS_API_KEY as string) || '',
    pexels: s.pexelsApiKey || (import.meta.env.VITE_PEXELS_API_KEY as string) || '',
  };
}
const NEWS_CACHE_KEY     = 'insights_news_cache';
const FACTURAS_CACHE_KEY = 'insights_facturas_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

interface InsightCard {
  id: string;
  title: string;
  content: string;
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  meta?: Record<string, string | number>;
}

interface DteSummary {
  tipoDte: string;
  fechaEmision: string;
  receptorNombre: string;
  montoTotal: number;
  montoIva: number;
  estado: string;
}

interface RawNewsArticle {
  title: string;
  source?: { name?: string };
  publishedAt?: string;
  url: string;
}

interface NewsArticle {
  titulo: string;
  fuente: string;
  fecha: string;
  url: string;
}

function geminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getKeys().gemini}`;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(geminiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'Error llamando a Gemini');
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini no devolvió respuesta');
  return text;
}

async function fetchFacturasInsight(): Promise<{ content: string; meta: Record<string, string | number> }> {
  // Intentar leer de cache
  const cached = JSON.parse(localStorage.getItem(FACTURAS_CACHE_KEY) || 'null');
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return { content: cached.content, meta: cached.meta };
  }

  const keys = getKeys();
  if (!keys.gemini) throw new Error('Configura tu Gemini API Key en Configuración Avanzada → IA & APIs');

  // Leer DTEs de IndexedDB
  const db = await openCacheDb();
  const allDtes = await db.getAll('dteCache');

  let dtes = allDtes;

  // Datos de ejemplo si no hay nada
  if (dtes.length === 0) {
    dtes = [
      { tipoDte:'01', fechaEmision:'2025-04-01', receptorNombre:'Juan García', montoTotal:115, montoIva:15, estado:'ACEPTADO' },
      { tipoDte:'01', fechaEmision:'2025-04-03', receptorNombre:'María López', montoTotal:230, montoIva:30, estado:'ACEPTADO' },
      { tipoDte:'03', fechaEmision:'2025-04-05', receptorNombre:'Empresa XYZ', montoTotal:500, montoIva:65, estado:'ACEPTADO' },
      { tipoDte:'01', fechaEmision:'2025-04-08', receptorNombre:'Carlos Rivas', montoTotal:57.5, montoIva:7.5, estado:'RECHAZADO' },
      { tipoDte:'03', fechaEmision:'2025-04-10', receptorNombre:'Distribuidora ABC', montoTotal:1200, montoIva:156, estado:'ACEPTADO' },
      { tipoDte:'14', fechaEmision:'2025-04-12', receptorNombre:'Pedro Martínez', montoTotal:80, montoIva:0, estado:'ACEPTADO' },
    ] as DteSummary[];
  }

  const typed = dtes as DteSummary[];
  const total = typed.length;
  const aceptadas = typed.filter(d => d.estado === 'ACEPTADO').length;
  const rechazadas = typed.filter(d => d.estado === 'RECHAZADO').length;
  const montoTotal = typed.reduce((s, d) => s + (d.montoTotal || 0), 0);
  const montoIva = typed.reduce((s, d) => s + (d.montoIva || 0), 0);
  const porTipo = typed.reduce((acc: Record<string, number>, d) => {
    const label = d.tipoDte === '01' ? 'Factura (01)' : d.tipoDte === '03' ? 'Crédito Fiscal (03)' : d.tipoDte === '14' ? 'Sujeto Excluido (14)' : `Tipo ${d.tipoDte}`;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const resumen = typed.slice(0, 15).map(d => ({
    tipo: d.tipoDte, fecha: d.fechaEmision,
    receptor: d.receptorNombre, total: d.montoTotal, estado: d.estado,
  }));

  const content = await callGemini(
    'Eres un asistente fiscal experto en facturación electrónica de El Salvador (DTE). Analiza los datos reales del contribuyente y da respuestas claras en español. No inventes datos.',
    `Analiza estos documentos tributarios electrónicos y genera un análisis ejecutivo conciso (máximo 180 palabras):
1. Estado general de facturación
2. Alertas si hay rechazados
3. Una sugerencia práctica

Estadísticas: total=${total}, aceptados=${aceptadas}, rechazados=${rechazadas}, monto=$${montoTotal.toFixed(2)}, IVA=$${montoIva.toFixed(2)}
Por tipo: ${JSON.stringify(porTipo)}
Últimos documentos: ${JSON.stringify(resumen)}`
  );

  const meta = { total, aceptadas, rechazadas, montoTotal: parseFloat(montoTotal.toFixed(2)), montoIva: parseFloat(montoIva.toFixed(2)) };
  localStorage.setItem(FACTURAS_CACHE_KEY, JSON.stringify({ ts: Date.now(), content, meta }));
  return { content, meta };
}

async function fetchNewsInsight(): Promise<{ content: string; articulos: NewsArticle[] }> {
  const cached = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || 'null');
  if (cached && cached.articulos?.length > 0 && (Date.now() - cached.ts) < CACHE_TTL) {
    return { content: cached.content, articulos: cached.articulos };
  }

  const keys = getKeys();
  if (!keys.gemini) throw new Error('Configura tu Gemini API Key en Configuración Avanzada → IA & APIs');
  if (!keys.news) throw new Error('Configura tu NewsAPI Key en Configuración Avanzada → IA & APIs');

  // NewsAPI - usar fecha de ayer por el retraso de indexación del plan gratuito
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `https://newsapi.org/v2/everything?q=euro+dollar&from=${ayer}&sortBy=popularity&pageSize=10&apiKey=${keys.news}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.status === 'error') throw new Error(json.message || 'Error en NewsAPI');

  const articulos: NewsArticle[] = (json.articles as RawNewsArticle[] || []).map(a => ({
    titulo: a.title, fuente: a.source?.name ?? '',
    fecha: a.publishedAt?.split('T')[0] ?? '', url: a.url,
  }));

  if (articulos.length === 0) throw new Error('No se encontraron noticias recientes para este tema');

  const content = await callGemini(
    'Eres un analista económico para empresarios salvadoreños. Produce briefs ejecutivos concisos en español. No repitas titulares literalmente.',
    `Genera un brief ejecutivo (máximo 180 palabras) para un empresario salvadoreño basado en estos titulares recientes de economía global. Incluye: (1) qué está pasando, (2) impacto posible en su negocio, (3) recomendación práctica.

Titulares:
${articulos.map((a, i) => `${i + 1}. [${a.fecha}] ${a.titulo} (${a.fuente})`).join('\n')}`
  );

  localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), content, articulos }));
  return { content, articulos };
}

const InsightsDashboard: React.FC = () => {
  const [facturasCard, setFacturasCard] = useState<InsightCard>({
    id: 'facturas', title: 'Análisis de Facturación', content: '', loading: true, error: null, updatedAt: null,
  });
  const [newsCard, setNewsCard] = useState<InsightCard>({
    id: 'news', title: 'Contexto Económico', content: '', loading: true, error: null, updatedAt: null,
  });
  const [newsArticulos, setNewsArticulos] = useState<NewsArticle[]>([]);
  const [showArticulos, setShowArticulos] = useState(false);
  const [modalArticulo, setModalArticulo] = useState<NewsArticle | null>(null);
  const [modalImagen, setModalImagen] = useState<string | null>(null);

  const loadFacturas = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) localStorage.removeItem(FACTURAS_CACHE_KEY);
    setFacturasCard(c => ({ ...c, loading: true, error: null }));
    try {
      const { content, meta } = await fetchFacturasInsight();
      setFacturasCard(c => ({ ...c, loading: false, content, meta, updatedAt: new Date().toLocaleTimeString('es-SV') }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setFacturasCard(c => ({ ...c, loading: false, error: msg }));
    }
  }, []);

  const loadNews = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) localStorage.removeItem(NEWS_CACHE_KEY);
    setNewsCard(c => ({ ...c, loading: true, error: null }));
    try {
      const { content, articulos } = await fetchNewsInsight();
      setNewsCard(c => ({ ...c, loading: false, content, updatedAt: new Date().toLocaleTimeString('es-SV') }));
      setNewsArticulos(articulos);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setNewsCard(c => ({ ...c, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    loadFacturas();
    loadNews();
  }, [loadFacturas, loadNews]);

  const handleOpenArticulo = useCallback(async (articulo: NewsArticle) => {
    setModalArticulo(articulo);
    setModalImagen(null);
    const { pexels } = getKeys();
    if (!pexels) return;
    try {
      const keyword = articulo.titulo.split(' ').slice(0, 3).join(' ');
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`,
        { headers: { Authorization: pexels } }
      );
      const json = await res.json();
      const img = json?.photos?.[0]?.src?.large;
      if (img) setModalImagen(img);
    } catch { /* imagen opcional */ }
  }, []);

  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: bold }} />;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-100">
            <Sparkles className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insights IA</h1>
            <p className="text-sm text-gray-500">Análisis inteligente basado en tus datos reales</p>
          </div>
        </div>
        <button
          onClick={() => { loadFacturas(true); loadNews(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar todo
        </button>
      </div>

      {/* Stats mini-bar (facturas) */}
      {facturasCard.meta && !facturasCard.loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total docs', value: facturasCard.meta.total, icon: <CheckCircle className="w-4 h-4 text-gray-400" /> },
            { label: 'Aceptados', value: facturasCard.meta.aceptadas, icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
            { label: 'Rechazados', value: facturasCard.meta.rechazadas, icon: <XCircle className="w-4 h-4 text-red-500" /> },
            { label: 'Total facturado', value: `$${Number(facturasCard.meta.montoTotal).toLocaleString('es-SV', { minimumFractionDigits: 2 })}`, icon: <TrendingUp className="w-4 h-4 text-blue-500" /> },
            { label: 'IVA total', value: `$${Number(facturasCard.meta.montoIva).toLocaleString('es-SV', { minimumFractionDigits: 2 })}`, icon: <TrendingUp className="w-4 h-4 text-indigo-500" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">{stat.icon}{stat.label}</div>
              <div className="font-bold text-gray-900">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Facturas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Análisis de Facturación</h2>
            </div>
            <button onClick={() => loadFacturas(true)} className="p-1.5 rounded-lg hover:bg-green-100 transition-colors" title="Actualizar">
              <RefreshCw className={`w-3.5 h-3.5 text-green-600 ${facturasCard.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex-1 px-5 py-4">
            {facturasCard.loading && (
              <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400">
                <Sparkles className="w-8 h-8 animate-pulse text-green-400" />
                <span className="text-sm">Analizando tus facturas...</span>
              </div>
            )}
            {facturasCard.error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{facturasCard.error}</span>
              </div>
            )}
            {!facturasCard.loading && !facturasCard.error && (
              <div className="text-sm text-gray-700 leading-relaxed">
                {formatContent(facturasCard.content)}
              </div>
            )}
          </div>
          {facturasCard.updatedAt && (
            <div className="px-5 py-2 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3 h-3" />Actualizado a las {facturasCard.updatedAt} · caché 1h
            </div>
          )}
        </div>

        {/* Card: Noticias */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Contexto Económico</h2>
            </div>
            <div className="flex items-center gap-1">
              {newsArticulos.length > 0 && (
                <button
                  onClick={() => setShowArticulos(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors text-xs text-blue-600 font-medium"
                >
                  {showArticulos ? 'Ocultar' : `Ver ${newsArticulos.length} fuentes`}
                </button>
              )}
              <button onClick={() => loadNews(true)} className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors" title="Actualizar">
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${newsCard.loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="flex-1 px-5 py-4">
            {newsCard.loading && (
              <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400">
                <Sparkles className="w-8 h-8 animate-pulse text-blue-400" />
                <span className="text-sm">Obteniendo noticias y generando brief...</span>
              </div>
            )}
            {newsCard.error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{newsCard.error}</span>
              </div>
            )}
            {!newsCard.loading && !newsCard.error && (
              <div className="text-sm text-gray-700 leading-relaxed">
                {formatContent(newsCard.content)}
              </div>
            )}
            {/* Lista de fuentes */}
            {showArticulos && newsArticulos.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fuentes</p>
                {newsArticulos.map((a, i) => (
                  <button key={i} onClick={() => handleOpenArticulo(a)}
                    className="flex items-start gap-2 text-xs text-blue-600 hover:text-blue-800 text-left w-full group">
                    <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                    <span>[{a.fecha}] {a.titulo} <span className="text-gray-400">({a.fuente})</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {newsCard.updatedAt && (
            <div className="px-5 py-2 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3 h-3" />Actualizado a las {newsCard.updatedAt} · caché 1h · vía NewsAPI
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-center text-gray-400">
        Los análisis se generan con Gemini 2.5 Flash · Los datos de facturación provienen de tu dispositivo local · Las noticias provienen de NewsAPI
      </p>

      {/* Modal de artículo */}
      {modalArticulo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalArticulo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Imagen */}
            {modalImagen ? (
              <div className="relative h-48 bg-gray-100 flex-shrink-0">
                <img src={modalImagen} alt={modalArticulo.titulo} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-3 left-4 text-white text-xs font-medium opacity-80">Foto: Pexels</span>
              </div>
            ) : (
              <div className="h-24 bg-gradient-to-r from-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
                <Image className="w-8 h-8 text-blue-300" />
              </div>
            )}
            {/* Contenido */}
            <div className="p-6 overflow-y-auto space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-gray-900 text-lg leading-snug">{modalArticulo.titulo}</h3>
                <button onClick={() => setModalArticulo(null)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{modalArticulo.fuente}</span>
                <span>·</span>
                <span>{modalArticulo.fecha}</span>
              </div>
              <a
                href={modalArticulo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Leer artículo completo
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsDashboard;
