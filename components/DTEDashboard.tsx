import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileJson,
  Loader2,
  BarChart3,
  DollarSign,
  Hash
} from 'lucide-react';
import { tiposDocumento } from '../utils/dteGenerator';
import { descargarPDFConPlantilla, TemplateName } from '../utils/pdfTemplates';
import { notify } from '../utils/notifications';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useEmisor } from '../contexts/EmisorContext';

interface DTEDashboardProps {
  onClose?: () => void;
  logoUrl?: string;
}

const ITEMS_POR_PAGINA = 10;

type DTERow = {
  codigo_generacion: string;
  numero_control: string;
  tipo_dte: string;
  fecha_emision: string;
  hora_emision: string | null;
  monto_total: number;
  monto_gravado?: number;
  monto_iva?: number;
  receptor_nombre: string | null;
  receptor_documento: string | null;
  estado: string;
  sello_recepcion?: string | null;
  dte_json: any;
  emisor_nombre?: string | null;
  emisor_nit?: string | null;
  ambiente?: string | null;
  fecha_hora_procesamiento?: string | null;
};

type DTEStats = {
  totalEmitidos: number;
  totalAceptados: number;
  totalRechazados: number;
  totalPendientes: number;
  montoTotalEmitido: number;
  montoTotalIva: number;
  porTipo: Record<string, number>;
  porMes: Record<string, { cantidad: number; monto: number }>;
};

const DTEDashboard: React.FC<DTEDashboardProps> = ({ logoUrl }) => {
  const { user } = useAuth();
  const { businessId } = useEmisor();

  const [registros, setRegistros] = useState<DTERow[]>([]);
  const [stats, setStats] = useState<DTEStats | null>(null);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoDte, setTipoDte] = useState('');
  const [estado, setEstado] = useState('');
  const [tiposDisponibles, setTiposDisponibles] = useState<string[]>([]);

  // Vista
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'estadisticas'>('lista');
  const [dteSeleccionado, setDteSeleccionado] = useState<DTERow | null>(null);
  const [exportando, setExportando] = useState(false);

  const [loading, setLoading] = useState(false);

  const filtrosMemo = useMemo(() => ({
    busqueda,
    fechaDesde,
    fechaHasta,
    tipoDte,
    estado,
  }), [busqueda, fechaDesde, fechaHasta, tipoDte, estado]);

  const cargarDatos = async () => {
    if (!businessId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('dte_responses')
        .select(
          `codigo_generacion,numero_control,tipo_dte,fecha_emision,hora_emision,monto_total,monto_gravado,monto_iva,receptor_nombre,receptor_documento,estado,sello_recepcion,dte_json,emisor_nombre,emisor_nit,ambiente,fecha_hora_procesamiento`,
          { count: 'exact' }
        )
        .eq('business_id', businessId)
        .order('fecha_hora_procesamiento', { ascending: false });

      if (tipoDte) query = query.eq('tipo_dte', tipoDte);
      if (estado) query = query.eq('estado', estado);
      if (fechaDesde) query = query.gte('fecha_emision', fechaDesde);
      if (fechaHasta) query = query.lte('fecha_emision', fechaHasta);
      if (busqueda) {
        const pattern = `%${busqueda}%`;
        query = query.or(
          `codigo_generacion.ilike.${pattern},numero_control.ilike.${pattern},receptor_nombre.ilike.${pattern},receptor_documento.ilike.${pattern}`
        );
      }

      const from = (paginaActual - 1) * ITEMS_POR_PAGINA;
      const to = from + ITEMS_POR_PAGINA - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setRegistros(data || []);
      setTotalRegistros(count ?? data?.length ?? 0);

      // Calcular stats simples con registros cargados (limitados) para UI rápida
      const statsLocales: DTEStats = {
        totalEmitidos: count ?? data?.length ?? 0,
        totalAceptados: 0,
        totalRechazados: 0,
        totalPendientes: 0,
        montoTotalEmitido: 0,
        montoTotalIva: 0,
        porTipo: {},
        porMes: {},
      };

      (data || []).forEach((r: DTERow) => {
        if (r.estado === 'ACEPTADO') statsLocales.totalAceptados += 1;
        if (r.estado === 'RECHAZADO') statsLocales.totalRechazados += 1;
        if (r.estado === 'PENDIENTE') statsLocales.totalPendientes += 1;
        if (r.estado === 'ACEPTADO') {
          statsLocales.montoTotalEmitido += r.monto_total || 0;
          statsLocales.montoTotalIva += r.monto_iva || 0;
        }
        statsLocales.porTipo[r.tipo_dte] = (statsLocales.porTipo[r.tipo_dte] || 0) + 1;
        const mes = (r.fecha_emision || '').substring(0, 7);
        if (mes) {
          if (!statsLocales.porMes[mes]) statsLocales.porMes[mes] = { cantidad: 0, monto: 0 };
          statsLocales.porMes[mes].cantidad += 1;
          if (r.estado === 'ACEPTADO') statsLocales.porMes[mes].monto += r.monto_total || 0;
        }
      });

      setStats(statsLocales);
      if (statsLocales && Object.keys(statsLocales.porTipo).length > 0) {
        setTiposDisponibles(Object.keys(statsLocales.porTipo));
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      notify('No se pudo cargar el historial', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setRegistros([]);
      setTotalRegistros(0);
      return;
    }
    cargarDatos();
  }, [user, businessId, paginaActual, filtrosMemo]);

  const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

  const handleExportar = async () => {
    setExportando(true);
    try {
      if (!businessId) throw new Error('Sin emisor activo');
      let query = supabase
        .from('dte_responses')
        .select('*')
        .eq('business_id', businessId);
      if (tipoDte) query = query.eq('tipo_dte', tipoDte);
      if (estado) query = query.eq('estado', estado);
      if (fechaDesde) query = query.gte('fecha_emision', fechaDesde);
      if (fechaHasta) query = query.lte('fecha_emision', fechaHasta);
      if (busqueda) {
        const pattern = `%${busqueda}%`;
        query = query.or(
          `codigo_generacion.ilike.${pattern},numero_control.ilike.${pattern},receptor_nombre.ilike.${pattern},receptor_documento.ilike.${pattern}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      const json = JSON.stringify({ version: 'supabase', registros: data || [] }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dte-historial-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando historial:', error);
      notify('Error al exportar el historial', 'error');
    } finally {
      setExportando(false);
    }
  };

  const handleDescargarPDF = (registro: DTERow) => {
    descargarPDFConPlantilla({
      dte: registro.dte_json,
      resultado: undefined,
      plantilla: 'moderna' as TemplateName,
      logoUrl,
      ambiente: (registro.ambiente as any) || '00'
    });
  };

  const getTipoDocNombre = (codigo: string): string => {
    const tipo = tiposDocumento.find(t => t.codigo === codigo);
    return tipo?.descripcion || codigo;
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'ACEPTADO': return 'bg-green-100 text-green-700';
      case 'RECHAZADO': return 'bg-red-100 text-red-700';
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'ACEPTADO': return <CheckCircle2 className="w-4 h-4" />;
      case 'RECHAZADO': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-SV', {
      style: 'currency',
      currency: 'USD'
    }).format(monto);
  };

  const renderEstadisticas = () => {
    if (!stats) return null;

    return (
      <div className="space-y-6">
        {/* Cards de resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Hash className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEmitidos}</p>
                <p className="text-xs text-gray-500">Total Emitidos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.totalAceptados}</p>
                <p className="text-xs text-gray-500">Aceptados</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatMonto(stats.montoTotalEmitido)}</p>
                <p className="text-xs text-gray-500">Monto Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatMonto(stats.montoTotalIva)}</p>
                <p className="text-xs text-gray-500">IVA Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Por tipo de documento */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Por Tipo de Documento
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.porTipo).map(([tipo, cantidad]: [string, any]) => (
              <div key={tipo} className="flex justify-between items-center text-sm">
                <span className="text-gray-600 truncate mr-2" title={tipo}>
                  {tipo}
                </span>
                <span className="font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
                  {cantidad as number}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Por mes */}
        {Object.keys(stats.porMes).length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Por Mes
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500 font-medium">Mes</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Cantidad</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.porMes)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 3)
                    .map(([mes, data]: [string, any]) => (
                      <tr key={mes} className="border-t border-gray-100 last:border-0">
                        <td className="py-2 text-gray-900 font-medium">
                          {new Date(`${mes}-01`).toLocaleDateString('es-SV', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 text-right text-gray-600">{(data as { cantidad: number; monto: number }).cantidad}</td>
                        <td className="py-2 text-right text-gray-900 font-mono">{formatMonto((data as { cantidad: number; monto: number }).monto)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLista = () => (
    <div className="space-y-4">
      {/* Tabla de registros */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay DTEs en el historial</p>
          <p className="text-sm text-gray-400">Los DTEs transmitidos aparecerán aquí</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">N° Control</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Receptor</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Monto</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr 
                      key={registro.codigo_generacion}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{registro.fecha_emision}</p>
                        <p className="text-xs text-gray-500">{registro.hora_emision}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs text-gray-700">{registro.numero_control}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {getTipoDocNombre(registro.tipo_dte).substring(0, 15)}...
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900 truncate max-w-[150px]">{registro.receptor_nombre}</p>
                        <p className="text-xs text-gray-500">{registro.receptor_documento}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono font-medium text-gray-900">{formatMonto(registro.monto_total)}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(registro.estado)}`}>
                          {getEstadoIcon(registro.estado)}
                          {registro.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDteSeleccionado(registro)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDescargarPDF(registro)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const json = JSON.stringify(registro.dte_json, null, 2);
                              const blob = new Blob([json], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${registro.codigo_generacion}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Descargar JSON"
                          >
                            <FileJson className="w-4 h-4" />
                          </button>

                          {/* Anulación local removida: ahora se depende de backend/MH */}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {((paginaActual - 1) * ITEMS_POR_PAGINA) + 1} - {Math.min(paginaActual * ITEMS_POR_PAGINA, totalRegistros)} de {totalRegistros}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Página {paginaActual} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderDetalleModal = () => {
    if (!dteSeleccionado) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Detalle del DTE</h3>
            <button
              onClick={() => setDteSeleccionado(null)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Info principal */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Número de Control</p>
                <p className="font-mono text-sm text-gray-900">{dteSeleccionado.numero_control}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Código Generación</p>
                <p className="font-mono text-xs text-gray-900 break-all">{dteSeleccionado.codigo_generacion}</p>
              </div>
            </div>

            {/* Estado y sello */}
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getEstadoColor(dteSeleccionado.estado)}`}>
                {getEstadoIcon(dteSeleccionado.estado)}
                {dteSeleccionado.estado}
              </span>
              {dteSeleccionado.sello_recepcion && (
                <div className="flex-1 bg-green-50 rounded-lg p-2">
                  <p className="text-xs text-green-600 font-medium">Sello de Recepción</p>
                  <p className="font-mono text-xs text-green-800 break-all">{dteSeleccionado.sello_recepcion}</p>
                </div>
              )}
            </div>

            {/* Emisor y Receptor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase mb-2">Emisor</p>
                <p className="font-medium text-gray-900">{dteSeleccionado.emisor_nombre}</p>
                <p className="text-sm text-gray-600">{dteSeleccionado.emisor_nit}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase mb-2">Receptor</p>
                <p className="font-medium text-gray-900">{dteSeleccionado.receptor_nombre}</p>
                <p className="text-sm text-gray-600">{dteSeleccionado.receptor_documento}</p>
              </div>
            </div>

            {/* Montos */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-indigo-600 uppercase">Gravado</p>
                  <p className="text-lg font-bold text-indigo-900">{formatMonto(dteSeleccionado.monto_gravado || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 uppercase">IVA</p>
                  <p className="text-lg font-bold text-indigo-900">{formatMonto(dteSeleccionado.monto_iva || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 uppercase">Total</p>
                  <p className="text-lg font-bold text-indigo-900">{formatMonto(dteSeleccionado.monto_total)}</p>
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div>
                <span className="text-gray-400">Emisión:</span> {dteSeleccionado.fecha_emision} {dteSeleccionado.hora_emision}
              </div>
              <div>
                <span className="text-gray-400">Transmisión:</span> {dteSeleccionado.fecha_hora_procesamiento ? new Date(dteSeleccionado.fecha_hora_procesamiento).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => handleDescargarPDF(dteSeleccionado)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
            <button
              onClick={() => {
                const json = JSON.stringify(dteSeleccionado.dte_json, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${dteSeleccionado.codigo_generacion}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <FileJson className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Historial de DTEs</h1>
              <p className="text-sm text-gray-500">Documentos tributarios emitidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cargarDatos}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportar}
              disabled={exportando || totalRegistros === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setVistaActiva('lista')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              vistaActiva === 'lista' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setVistaActiva('estadisticas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              vistaActiva === 'estadisticas' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Estadísticas
          </button>
        </div>

        {/* Filtros */}
        {vistaActiva === 'lista' && (
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, NIT, número..."
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setPaginaActual(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setPaginaActual(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <select
              value={tipoDte}
              onChange={(e) => { setTipoDte(e.target.value); setPaginaActual(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Todos los tipos</option>
              {tiposDisponibles.map(t => (
                <option key={t} value={t}>{getTipoDocNombre(t)}</option>
              ))}
            </select>
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPaginaActual(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="ACEPTADO">Aceptados</option>
              <option value="RECHAZADO">Rechazados</option>
              <option value="PENDIENTE">Pendientes</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {vistaActiva === 'lista' ? renderLista() : renderEstadisticas()}
      </div>

      {/* Modal de detalle */}
      {renderDetalleModal()}
    </div>
  );
};

export default DTEDashboard;
