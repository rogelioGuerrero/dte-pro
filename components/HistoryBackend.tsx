import React, { useEffect, useState } from 'react';
import { useEmisor } from '../contexts/EmisorContext';
import { useToast, ToastContainer } from './Toast';
import {
  getDTEHistory,
  getResumenVentas,
  downloadDTEPdf,
  downloadDTEXml
} from '../utils/api/historyApi';
import type { DTEHistoryParams, DTEHistoryResponse, ResumenVentasParams, ResumenVentasResponse } from '../types/history';
import type { DTEHistoryItem } from '../types/history';
import {
  History as HistoryIcon,
  Search,
  Filter,
  Download,
  FileText,
  Calendar,
  DollarSign,
  FileX,
  RefreshCw
} from 'lucide-react';

const TIPOS_DTE = [
  { value: '', label: 'Todos' },
  { value: '01', label: 'Factura Electrónica' },
  { value: '03', label: 'CCF' },
  { value: '14', label: 'Sujeto Excluido' },
];

const ESTADOS_DTE = [
  { value: '', label: 'Todos' },
  { value: 'PROCESADO', label: 'Procesado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
];

const History: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();
  const currentBusinessId = businessId || operationalBusinessId;

  // Estados para el listado de DTEs
  const [dtes, setDtes] = useState<DTEHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [_total, _setTotal] = useState(0);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, hasMore: false });

  // Estados para los filtros
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoDte, setTipoDte] = useState('');
  const [estado, setEstado] = useState('');

  // Estados para el resumen
  const [resumen, setResumen] = useState<ResumenVentasResponse | null>(null);
  const [_loadingResumen, _setLoadingResumen] = useState(false);

  // Cargar el listado de DTEs
  const loadDTEs = async (resetOffset = false) => {
    if (!currentBusinessId) return;

    setLoading(true);
    try {
      const params: DTEHistoryParams = {
        search: search || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        tipo: tipoDte || undefined,
        estado: estado || undefined,
        limit: pagination.limit,
        offset: resetOffset ? 0 : pagination.offset,
      };

      const response: DTEHistoryResponse = await getDTEHistory(currentBusinessId, params);
      
      if (resetOffset) {
        setDtes(response.dtes);
      } else {
        setDtes(prev => [...prev, ...response.dtes]);
      }
      
      _setTotal(response.total);
      setPagination(response.pagination);
    } catch (error: any) {
      addToast(error.message || 'Error al cargar el historial', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cargar el resumen de ventas
  const loadResumen = async () => {
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

  // Descargar PDF
  const handleDownloadPdf = async (item: DTEHistoryItem) => {
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

  // Descargar XML
  const handleDownloadXml = async (item: DTEHistoryItem) => {
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

  // Aplicar filtros
  const applyFilters = () => {
    setPagination({ limit: 50, offset: 0, hasMore: false });
    loadDTEs(true);
    loadResumen();
  };

  // Cargar más
  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      const newOffset = pagination.offset + pagination.limit;
      setPagination(prev => ({ ...prev, offset: newOffset }));
      loadDTEs(false);
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-SV', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtener label del tipo DTE
  const getTipoDteLabel = (tipo: string) => {
    return TIPOS_DTE.find(t => t.value === tipo)?.label || tipo;
  };

  // Obtener color del estado
  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PROCESADO': return 'text-green-600 bg-green-50';
      case 'RECHAZADO': return 'text-red-600 bg-red-50';
      case 'PENDIENTE': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Cargar inicial
  useEffect(() => {
    if (currentBusinessId) {
      loadDTEs(true);
    }
  }, [currentBusinessId]);

  // Cargar resumen cuando cambien las fechas
  useEffect(() => {
    if (currentBusinessId && fechaDesde && fechaHasta) {
      loadResumen();
    }
  }, [fechaDesde, fechaHasta, tipoDte, currentBusinessId]);

  if (!currentBusinessId) {
    return (
      <div className="max-w-7xl mx-auto mt-10 text-center">
        <p className="text-gray-500">Selecciona un negocio para ver el historial</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Documentos</h2>
            <p className="text-sm text-gray-500">Todos los DTEs generados en el sistema</p>
          </div>
        </div>
        <button
          onClick={() => loadDTEs(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Búsqueda</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Nombre o NIT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              {TIPOS_DTE.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
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
              {ESTADOS_DTE.map(est => (
                <option key={est.value} value={est.value}>{est.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      {/* Resumen de Ventas */}
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
              <FileX className="w-8 h-8 text-purple-500" />
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
              <Calendar className="w-8 h-8 text-orange-500" />
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
              <HistoryIcon className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>
      )}

      {/* Listado de DTEs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {dtes.length === 0 && !loading ? (
          <div className="text-center py-12">
            <HistoryIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No se encontraron documentos</p>
          </div>
        ) : (
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
                      {formatDate(item.createdAt)}
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
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getEstadoColor(item.estado)}`}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {item.tienePdf && (
                          <button
                            onClick={() => handleDownloadPdf(item)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {item.tieneXml && (
                          <button
                            onClick={() => handleDownloadXml(item)}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Descargar XML"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Paginación */}
        {pagination.hasMore && (
          <div className="px-4 py-3 border-t border-gray-200">
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Cargar más'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
