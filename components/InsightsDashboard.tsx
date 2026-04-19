import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, Newspaper, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { callLLM, type LLMProvider } from '../utils/chatHandlers';
import { loadSettings } from '../utils/settings';
import { getDTEHistory, getResumenVentas } from '../utils/api/historyApi';
import { useEmisor } from '../contexts/EmisorContext';

function getKeys() {
  const s = loadSettings();
  return {
    provider: (s.aiProvider as LLMProvider) || 'gemini',
    gemini: s.geminiApiKey || s.apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '',
    groq: s.groqApiKey || '',
    deepseek: s.deepseekApiKey || '',
    zai: s.zaiApiKey || '',
    news:   s.newsApiKey || (import.meta.env.VITE_NEWS_API_KEY as string) || '',
    gnews:  s.gnewsApiKey || (import.meta.env.VITE_GNEWS_API_KEY as string) || '',
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

const TIPO_LABELS: Record<string, string> = {
  '01': 'Factura (FE)',
  '03': 'Crédito Fiscal (CCFE)',
  '04': 'Nota de Remisión',
  '05': 'Nota de Crédito',
  '06': 'Nota de Débito',
  '11': 'Factura de Exportación',
  '14': 'Sujeto Excluido',
};

interface NewsArticle {
  titulo: string;
  fuente: string;
  fecha: string;
  url: string;
}

async function callLLMWithProvider(systemPrompt: string, userPrompt: string): Promise<string> {
  const keys = getKeys();
  const apiKey = keys[keys.provider] || keys.gemini;
  if (!apiKey) throw new Error('Configura tu API Key de LLM en Configuración Avanzada → IA & APIs');

  // Combinar systemPrompt y userPrompt para callLLM (que solo acepta un prompt)
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  return await callLLM(keys.provider, apiKey, fullPrompt);
}

async function fetchFacturasInsight(businessId: string): Promise<{ content: string; meta: Record<string, string | number> }> {
  const cached = JSON.parse(localStorage.getItem(FACTURAS_CACHE_KEY) || 'null');
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return { content: cached.content, meta: cached.meta };
  }

  const keys = getKeys();
  if (!keys.gemini) throw new Error('Configura tu Gemini API Key en Configuración Avanzada → IA & APIs');
  if (!businessId) throw new Error('NO_BUSINESS');

  // Leer DTEs reales del backend (igual que el Historial)
  const fechaHasta = new Date().toISOString().split('T')[0];
  const fechaDesde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [histRes, resumenRes] = await Promise.all([
    getDTEHistory(businessId, { limit: 50, fechaDesde, fechaHasta }),
    getResumenVentas(businessId, { fechaDesde, fechaHasta }).catch(() => null),
  ]);

  if (!histRes.dtes || histRes.dtes.length === 0) throw new Error('NO_DTES');

  const dtes = histRes.dtes;
  const total = histRes.total;
  const aceptadas = dtes.filter(d => d.estado === 'PROCESADO').length;
  const rechazadas = dtes.filter(d => d.estado === 'RECHAZADO').length;
  const montoTotal = resumenRes?.resumen?.totalVentas ?? dtes.reduce((s, d) => s + (d.montoTotal || 0), 0);
  const montoIva = resumenRes?.resumen?.totalIva ?? 0;

  const porTipo = dtes.reduce((acc: Record<string, number>, d) => {
    const label = TIPO_LABELS[d.tipoDte] || `Tipo ${d.tipoDte}`;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const resumen = dtes.slice(0, 15).map(d => ({
    tipo: TIPO_LABELS[d.tipoDte] || d.tipoDte,
    fecha: d.createdAt?.split('T')[0],
    receptor: d.receptorNombre,
    total: d.montoTotal,
    estado: d.estado,
  }));

  const content = await callLLMWithProvider(
    'Eres un asistente fiscal experto en facturación electrónica de El Salvador (DTE). Analiza los datos reales del contribuyente y da respuestas claras en español. No inventes datos.',
    `Analiza estos documentos tributarios electrónicos (últimos 90 días) y genera un análisis ejecutivo conciso (máximo 180 palabras):
1. Estado general de facturación
2. Alertas si hay rechazados
3. Una sugerencia práctica

Estadísticas: total en BD=${total}, en muestra=${dtes.length}, procesados=${aceptadas}, rechazados=${rechazadas}, monto=$${montoTotal.toFixed(2)}, IVA=$${montoIva.toFixed(2)}
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
  if (!keys.gnews) throw new Error('GNEWS_MISSING');

  const url = `/.netlify/functions/news-proxy?q=economia+negocios&lang=es&max=10&apikey=${keys.gnews}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(json.errors?.[0] || 'Error en GNews');

  const articulos: NewsArticle[] = (json.articles || []).map((a: { title: string; source?: { name?: string }; publishedAt?: string; url: string }) => ({
    titulo: a.title,
    fuente: a.source?.name ?? '',
    fecha: a.publishedAt?.split('T')[0] ?? '',
    url: a.url,
  }));

  if (articulos.length === 0) throw new Error('No se encontraron noticias recientes');

  const content = await callLLMWithProvider(
    'Eres un analista económico para empresarios salvadoreños. Produce briefs ejecutivos concisos en español. No repitas titulares literalmente.',
    `Genera un brief ejecutivo (máximo 180 palabras) para un empresario salvadoreño basado en estos titulares recientes. Incluye: (1) qué está pasando, (2) impacto posible en su negocio, (3) recomendación práctica.

Titulares:
${articulos.map((a, i) => `${i + 1}. [${a.fecha}] ${a.titulo} (${a.fuente})`).join('\n')}`
  );

  localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), content, articulos }));
  return { content, articulos };
}

const InsightsDashboard: React.FC = () => {
  const { businessId, operationalBusinessId } = useEmisor();
  const currentBusinessId = businessId || operationalBusinessId || '';

  const [facturasCard, setFacturasCard] = useState<InsightCard>({
    id: 'facturas', title: 'Análisis de Facturación', content: '', loading: true, error: null, updatedAt: null,
  });
  const [newsCard, setNewsCard] = useState<InsightCard>({
    id: 'news', title: 'Contexto Económico', content: '', loading: true, error: null, updatedAt: null,
  });
  const [newsArticulos, setNewsArticulos] = useState<NewsArticle[]>([]);

  const loadFacturas = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) localStorage.removeItem(FACTURAS_CACHE_KEY);
    setFacturasCard(c => ({ ...c, loading: true, error: null }));
    try {
      const { content, meta } = await fetchFacturasInsight(currentBusinessId);
      setFacturasCard(c => ({ ...c, loading: false, content, meta, updatedAt: new Date().toLocaleTimeString('es-SV') }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setFacturasCard(c => ({ ...c, loading: false, error: msg === 'NO_DTES' ? 'NO_DTES' : msg }));
    }
  }, [currentBusinessId]);

  const loadNews = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) localStorage.removeItem(NEWS_CACHE_KEY);
    setNewsCard(c => ({ ...c, loading: true, error: null }));
    try {
      const { content, articulos } = await fetchNewsInsight();
      setNewsCard(c => ({ ...c, loading: false, content, updatedAt: new Date().toLocaleTimeString('es-SV') }));
      setNewsArticulos(articulos);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      if (msg === 'NEWSAPI_SUSPENDED' || msg === 'GNEWS_MISSING') {
        setNewsCard(c => ({ ...c, loading: false, error: 'GNEWS_MISSING' }));
      } else {
        setNewsCard(c => ({ ...c, loading: false, error: msg }));
      }
    }
  }, []);

  useEffect(() => {
    loadFacturas();
    loadNews();
  }, [loadFacturas, loadNews]);

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
            {facturasCard.error === 'NO_DTES' && (
              <div className="flex flex-col items-center justify-center h-32 gap-3 text-center px-4">
                <TrendingUp className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Sin facturas aún</p>
                  <p className="text-xs text-gray-400 mt-1">Importa o genera DTEs para ver tu análisis de facturación.</p>
                </div>
              </div>
            )}
            {facturasCard.error && facturasCard.error !== 'NO_DTES' && (
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
            <button onClick={() => loadNews(true)} className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors" title="Actualizar">
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${newsCard.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex-1 px-5 py-4">
            {newsCard.loading && (
              <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400">
                <Sparkles className="w-8 h-8 animate-pulse text-blue-400" />
                <span className="text-sm">Obteniendo noticias y generando brief...</span>
              </div>
            )}
            {newsCard.error === 'GNEWS_MISSING' && (
              <div className="flex flex-col items-center justify-center h-32 gap-3 text-center px-4">
                <Newspaper className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Configura tu GNews API Key</p>
                  <p className="text-xs text-gray-400 mt-1">Ve a Configuración Avanzada → IA & APIs y pega tu key de gnews.io</p>
                </div>
              </div>
            )}
            {newsCard.error && newsCard.error !== 'GNEWS_MISSING' && (
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
            {/* Fuentes como links directos */}
            {newsArticulos.length > 0 && !newsCard.loading && !newsCard.error && (
              <div className="mt-4 border-t border-gray-100 pt-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fuentes</p>
                {newsArticulos.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline group">
                    <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100" />
                    <span>{a.titulo} <span className="text-gray-400">· {a.fuente}</span></span>
                  </a>
                ))}
              </div>
            )}
          </div>
          {newsCard.updatedAt && (
            <div className="px-5 py-2 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3 h-3" />Actualizado a las {newsCard.updatedAt} · caché 1h · vía GNews
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-center text-gray-400">
        Análisis generados con Gemini 2.5 Flash · Datos de facturación vía backend · Noticias vía GNews
      </p>
    </div>
  );
};

export default InsightsDashboard;
