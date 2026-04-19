import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  DollarSign,
  FileJson,
  Filter
} from 'lucide-react';
import { tiposDocumento } from '../utils/dteGenerator';
import { useEmisor } from '../contexts/EmisorContext';
import { useChat, type PageAction } from '../contexts/ChatContext';
import { useToast, ToastContainer } from './Toast';
import ChatWidget from './ChatWidget';
import {
  getDTEHistory,
  getResumenVentas,
  downloadDTEPdf,
  downloadDTEXml
} from '../utils/api/historyApi';
import { createHistorialHandler } from '../utils/chatHandlers';
import type { DTEHistoryParams, DTEHistoryResponse, ResumenVentasParams, ResumenVentasResponse } from '../types/history';
import type { DTEHistoryItem } from '../types/history';

interface DTEDashboardProps {
  onClose?: () => void;
  logoUrl?: string;
}

const ITEMS_POR_PAGINA = 10;

const DTEDashboard: React.FC<DTEDashboardProps> = () => {
  const { toasts, addToast, removeToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();
  const currentBusinessId = businessId || operationalBusinessId;
  const { setCurrentPage } = useChat();

  const [dtes, setDtes] = useState<DTEHistoryItem[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoDte, setTipoDte] = useState('');
  const [estado, setEstado] = useState('');

  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState<ResumenVentasResponse | null>(null);
  const cargarDatosRef = useRef<((reset?: boolean) => Promise<void>) | null>(null);

  const cargarDatos = useCallback(async (resetPagina = false) => {
    if (!currentBusinessId) return;
    setLoading(true);

    try {
      const pagina = resetPagina ? 1 : paginaActual;
      const offset = (pagina - 1) * ITEMS_POR_PAGINA;

      const params: DTEHistoryParams = {
        search: busqueda || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        tipo: tipoDte || undefined,
        estado: estado || undefined,
        limit: ITEMS_POR_PAGINA,
        offset,
      };

      const response: DTEHistoryResponse = await getDTEHistory(currentBusinessId, params);
      
      if (resetPagina) {
        setDtes(response.dtes);
        setPaginaActual(1);
      } else {
        setDtes(response.dtes);
      }
      
      setTotalRegistros(response.total);
    } catch (error: any) {
      addToast(error.message || 'Error al cargar los documentos', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentBusinessId, paginaActual, busqueda, fechaDesde, fechaHasta, tipoDte, estado, addToast]);

  cargarDatosRef.current = cargarDatos;

  // Handler para aplicar filtros desde el chat
  const handleChatAction = useCallback((action: PageAction) => {
    if (action.type === 'filter' && action.filters) {
      const filters = action.filters;
      if (filters.estado) setEstado(filters.estado);
      if (filters.fechaDesde) setFechaDesde(filters.fechaDesde);
      if (filters.fechaHasta) setFechaHasta(filters.fechaHasta);
      if (filters.tipoDte) setTipoDte(filters.tipoDte);
      if (filters.busqueda) setBusqueda(filters.busqueda);
      setPaginaActual(1);
      cargarDatosRef.current?.(true);
    }
  }, [setEstado, setFechaDesde, setFechaHasta, setTipoDte, setBusqueda]);

  // Configurar contexto de chat cuando el componente se monta
  useEffect(() => {
    if (currentBusinessId) {
      createHistorialHandler(currentBusinessId).then(handler => {
        setCurrentPage({
          id: 'historial',
          name: 'Historial de DTEs',
          queryHandler: handler,
          onAction: handleChatAction,
          suggestedQuestions: [
            '¿Cuánto vendí el último mes?',
            '¿Cuántos DTEs tengo rechazados?',
            '¿Quiénes son mis principales clientes?',
            '¿Cuál es mi monto total facturado?',
          ],
        });
      });
    }
    return () => setCurrentPage(null);
  }, [currentBusinessId, setCurrentPage, handleChatAction]);

  const cargarResumen = async () => {
    if (!currentBusinessId || !fechaDesde || !fechaHasta) return;
    // setLoadingResumen(true);

    try {
      const params: ResumenVentasParams = {
        fechaDesde,
        fechaHasta,
        tipoDte: tipoDte || undefined,
      };

      const response = await getResumenVentas(currentBusinessId, params);
      setResumen(response);
    } catch (error: any) {
      addToast(error.message || 'Error al cargar el resumen', 'error');
    } finally {
      // setLoadingResumen(false);
    }
  };

  const handleDescargarPdf = async (item: DTEHistoryItem) => {
    if (!currentBusinessId || !item.tienePdf) return;

    try {
      const blob = await downloadDTEPdf(currentBusinessId, item.codigoGeneracion);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.tipoDte}-${item.numeroControl}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('PDF descargado exitosamente', 'success');
    } catch (error: any) {
      addToast(error.message || 'Error al descargar PDF', 'error');
    }
  };

  const handleDescargarXml = async (item: DTEHistoryItem) => {
    if (!currentBusinessId || !item.tieneXml) return;

    try {
      const blob = await downloadDTEXml(currentBusinessId, item.codigoGeneracion);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.tipoDte}-${item.numeroControl}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('XML descargado exitosamente', 'success');
    } catch (error: any) {
      addToast(error.message || 'Error al descargar XML', 'error');
    }
  };

  const aplicarFiltros = () => {
    cargarDatos(true);
    if (fechaDesde && fechaHasta) {
      cargarResumen();
    }
  };

  const cambiarPagina = (nuevaPagina: number) => {
    if (nuevaPagina < 1 || nuevaPagina > Math.ceil(totalRegistros / ITEMS_POR_PAGINA)) return;
    setPaginaActual(nuevaPagina);
  };

  const formatearFecha = (fechaString: string) => {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-SV', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTipoDteLabel = (tipo: string) => {
    const tipoDoc = tiposDocumento.find(t => t.codigo === tipo);
    return tipoDoc?.descripcion || tipo;
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'PROCESADO': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'RECHAZADO': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'PENDIENTE': return <Clock className="w-4 h-4 text-yellow-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PROCESADO': return 'text-green-700 bg-green-50';
      case 'RECHAZADO': return 'text-red-700 bg-red-50';
      case 'PENDIENTE': return 'text-yellow-700 bg-yellow-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

  useEffect(() => {
    if (currentBusinessId) {
      cargarDatos(true);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    if (currentBusinessId && paginaActual > 1) {
      cargarDatos(false);
    }
  }, [paginaActual]);

  useEffect(() => {
    if (currentBusinessId && fechaDesde && fechaHasta) {
      cargarResumen();
    }
  }, [fechaDesde, fechaHasta, tipoDte, currentBusinessId]);

  if (!currentBusinessId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Selecciona un negocio para ver el historial</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto p-6">
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Historial de Documentos Tributarios</h1>
          <p className="text-gray-600">Consulta y gestiona todos tus DTEs generados</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Filtros de búsqueda</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nombre o NIT..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo DTE</label>
              <select
                value={tipoDte}
                onChange={(e) => setTipoDte(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todos</option>
                {tiposDocumento.map(tipo => (
                  <option key={tipo.codigo} value={tipo.codigo}>{tipo.descripcion}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todos</option>
                <option value="PROCESADO">Procesado</option>
                <option value="RECHAZADO">Rechazado</option>
                <option value="PENDIENTE">Pendiente</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setBusqueda('');
                setFechaDesde('');
                setFechaHasta('');
                setTipoDte('');
                setEstado('');
                setResumen(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Limpiar
            </button>
            <button
              onClick={aplicarFiltros}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Aplicar filtros'}
            </button>
          </div>
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total Ventas</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${resumen.resumen.totalVentas.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total IVA</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${resumen.resumen.totalIva.toFixed(2)}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Gravada</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${resumen.resumen.totalGravada.toFixed(2)}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Exenta</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${resumen.resumen.totalExenta.toFixed(2)}
                  </p>
                </div>
                <ShieldCheck className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Documentos</p>
                  <p className="text-xl font-bold text-gray-900">
                    {resumen.resumen.cantidadDocumentos}
                  </p>
                </div>
                <FileJson className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Tabla de resultados */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading && dtes.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : dtes.length === 0 ? (
            <div className="text-center py-12">
              <FileJson className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No se encontraron documentos</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Control</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receptor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NIT</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dtes.map((item) => (
                      <tr key={item.codigoGeneracion} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatearFecha(item.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {getTipoDteLabel(item.tipoDte)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                          {item.numeroControl}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.receptorNombre}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                          {item.receptorNit}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          ${item.montoTotal.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getEstadoColor(item.estado)}`}>
                            {getEstadoIcon(item.estado)}
                            {item.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {item.tienePdf && (
                              <button
                                onClick={() => handleDescargarPdf(item)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Descargar PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            {item.tieneXml && (
                              <button
                                onClick={() => handleDescargarXml(item)}
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title="Descargar XML"
                              >
                                <FileJson className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="px-4 py-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      Mostrando {((paginaActual - 1) * ITEMS_POR_PAGINA) + 1} a {Math.min(paginaActual * ITEMS_POR_PAGINA, totalRegistros)} de {totalRegistros} resultados
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cambiarPagina(paginaActual - 1)}
                        disabled={paginaActual === 1}
                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-700">
                        Página {paginaActual} de {totalPaginas}
                      </span>
                      <button
                        onClick={() => cambiarPagina(paginaActual + 1)}
                        disabled={paginaActual === totalPaginas}
                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ChatWidget />
    </>
  );
};

export default DTEDashboard;
