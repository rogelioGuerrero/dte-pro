import React, { useState, useMemo } from 'react';
import { X, CheckCircle, AlertTriangle, Package, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { notify } from '../../utils/notifications';

interface ItemPreview {
  jsonIndex: number;
  fileName: string;
  itemIndex: number;
  descripcion: string;
  codigo: string;
  cantidad: number;
  precioUni: number;
  proveedor: string;
  docRef: string;
  accion: 'crear' | 'actualizar' | 'asociar' | 'omitir';
  productoExistente?: Producto;
  productosSimilares?: Array<{ producto: Producto; score: number }>;
  seleccionado: boolean;
  razon?: string;
  presentacion?: string;
  requiereFactor?: boolean;
  categoriaSugerida?: string;
}

interface PreValidacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmaciones: { item: ItemPreview; recordar: boolean; categoria?: string; factorConversion?: number }[]) => Promise<void>;
  analisis: {
    items: ItemPreview[];
    categoriasDisponibles?: string[];
    resumen: {
      nuevos: number;
      actualizar: number;
      asociar: number;
      omitir: number;
      total: number;
    };
  };
}

const PreValidacionModal: React.FC<PreValidacionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  analisis
}) => {
  const [confirmaciones, setConfirmaciones] = useState<Record<string, boolean>>({});
  const [recordarMappings, setRecordarMappings] = useState<Record<string, boolean>>({});
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState<string>('todos');
  const [itemsExpandidos, setItemsExpandidos] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [categoriaByKey, setCategoriaByKey] = useState<Record<string, string>>({});
  const [factorByKey, setFactorByKey] = useState<Record<string, string>>({});

  // Filtrar items
  const itemsFiltrados = useMemo(() => {
    return analisis.items.filter(item => {
      const cumpleBusqueda = !busqueda || 
        item.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.proveedor.toLowerCase().includes(busqueda.toLowerCase());

      const cumpleFiltro = filtroAccion === 'todos' || item.accion === filtroAccion;

      return cumpleBusqueda && cumpleFiltro;
    });
  }, [analisis.items, busqueda, filtroAccion]);

  const selectedCount = useMemo(() => {
    return analisis.items.reduce((acc, item) => {
      const key = `${item.jsonIndex}-${item.itemIndex}`;
      const selected = confirmaciones[key] ?? (item.accion !== 'omitir');
      return acc + (selected && item.accion !== 'omitir' ? 1 : 0);
    }, 0);
  }, [analisis.items, confirmaciones]);

  const missingFactorCount = useMemo(() => {
    return analisis.items.reduce((acc, item) => {
      const key = `${item.jsonIndex}-${item.itemIndex}`;
      const selected = confirmaciones[key] ?? (item.accion !== 'omitir');
      if (!selected || item.accion === 'omitir') return acc;
      if (!item.requiereFactor) return acc;
      const raw = (factorByKey[key] ?? '').toString().trim();
      const f = Number(raw);
      if (!Number.isFinite(f) || f <= 0) return acc + 1;
      return acc;
    }, 0);
  }, [analisis.items, confirmaciones, factorByKey]);

  // Seleccionar/deseleccionar todo
  const handleSeleccionarTodo = (seleccionar: boolean) => {
    const nuevasConfirmaciones: Record<string, boolean> = {};
    itemsFiltrados.forEach(item => {
      if (item.accion !== 'omitir') {
        nuevasConfirmaciones[`${item.jsonIndex}-${item.itemIndex}`] = seleccionar;
      }
    });
    setConfirmaciones(prev => ({ ...prev, ...nuevasConfirmaciones }));
  };

  // Toggle selección individual
  const toggleSeleccion = (item: ItemPreview) => {
    const key = `${item.jsonIndex}-${item.itemIndex}`;
    setConfirmaciones(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle recordar mapping
  const toggleRecordar = (item: ItemPreview) => {
    const key = `${item.jsonIndex}-${item.itemIndex}`;
    setRecordarMappings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle expandir item
  const toggleExpandir = (key: string) => {
    setItemsExpandidos(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Confirmar importación
  const handleConfirmar = async () => {
    if (missingFactorCount > 0) {
      notify('Hay productos que requieren factor (ej. CAJA = 12). Completa esos factores antes de confirmar.', 'error');
      return;
    }

    const itemsConfirmados = analisis.items
      .filter(item => {
        const key = `${item.jsonIndex}-${item.itemIndex}`;
        const selected = confirmaciones[key] ?? (item.accion !== 'omitir');
        return selected && item.accion !== 'omitir';
      })
      .map(item => ({
        item,
        recordar: recordarMappings[`${item.jsonIndex}-${item.itemIndex}`] ?? true,
        categoria:
          (categoriaByKey[`${item.jsonIndex}-${item.itemIndex}`] ?? item.categoriaSugerida ?? '')
            .toString()
            .trim() || undefined,
        factorConversion: (() => {
          const key = `${item.jsonIndex}-${item.itemIndex}`;
          if (!item.requiereFactor) return undefined;
          const raw = (factorByKey[key] ?? '').toString().trim();
          const f = Number(raw);
          return Number.isFinite(f) && f > 0 ? f : undefined;
        })()
      }));

    if (itemsConfirmados.length === 0) {
      notify('Debes seleccionar al menos un producto para importar', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(itemsConfirmados);
      onClose();
    } catch (error) {
      console.error('Error en la importación:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Obtener color de acción
  const getColorAccion = (accion: string) => {
    switch (accion) {
      case 'crear': return 'text-blue-600 bg-blue-50';
      case 'actualizar': return 'text-green-600 bg-green-50';
      case 'asociar': return 'text-amber-600 bg-amber-50';
      case 'omitir': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Obtener ícono de acción
  const getIconoAccion = (accion: string) => {
    switch (accion) {
      case 'crear': return Package;
      case 'actualizar': return CheckCircle;
      case 'asociar': return AlertTriangle;
      default: return Package;
    }
  };

  if (!isOpen) return null;

  const categoriasDisponibles = Array.isArray(analisis.categoriasDisponibles)
    ? analisis.categoriasDisponibles
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 p-0 sm:p-4 z-50 sm:flex sm:items-center sm:justify-center">
      <div
        className="bg-white shadow-xl w-full h-[100dvh] overflow-y-auto overscroll-contain touch-pan-y sm:overflow-hidden sm:h-auto sm:rounded-xl sm:max-w-6xl sm:max-h-[90vh] sm:flex sm:flex-col min-h-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10 sm:static">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pre-validación de Importación</h2>
              <p className="text-gray-600 mt-1">
                Revisa y selecciona qué productos importar al Kardex
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{analisis.resumen.nuevos}</div>
              <div className="text-xs text-blue-700">Nuevos</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{analisis.resumen.actualizar}</div>
              <div className="text-xs text-green-700">Actualizar</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{analisis.resumen.asociar}</div>
              <div className="text-xs text-amber-700">Asociar</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{analisis.resumen.omitir}</div>
              <div className="text-xs text-gray-700">Omitir</div>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{analisis.resumen.total}</div>
              <div className="text-xs text-gray-700">Total</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por descripción, código, proveedor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todas las acciones</option>
              <option value="crear">Crear nuevos</option>
              <option value="actualizar">Actualizar existentes</option>
              <option value="asociar">Asociar similares</option>
              <option value="omitir">Omitir</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => handleSeleccionarTodo(true)}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Seleccionar todo
              </button>
              <button
                onClick={() => handleSeleccionarTodo(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Deseleccionar todo
              </button>
            </div>
          </div>
        </div>

        {/* Lista de items */}
        <div
          className="p-4 sm:flex-1 sm:min-h-0 sm:overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {itemsFiltrados.map((item) => {
              const key = `${item.jsonIndex}-${item.itemIndex}`;
              const isExpandido = itemsExpandidos[key];
              const IconoAccion = getIconoAccion(item.accion);
              const estaSeleccionado = confirmaciones[key] ?? (item.accion !== 'omitir');

              return (
                <div
                  key={key}
                  className={`border rounded-lg transition-all h-full ${
                    estaSeleccionado ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {item.accion !== 'omitir' && (
                        <input
                          type="checkbox"
                          checked={estaSeleccionado}
                          onChange={() => toggleSeleccion(item)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getColorAccion(item.accion)}`}>
                                <IconoAccion className="w-3 h-3" />
                                {item.accion === 'crear' ? 'Nuevo' : 
                                 item.accion === 'actualizar' ? 'Actualizar' :
                                 item.accion === 'asociar' ? 'Asociar' : 'Omitir'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {item.fileName} - Item #{item.itemIndex + 1}
                              </span>
                            </div>
                            
                            <h3 className="font-semibold text-gray-900 truncate">
                              {item.descripcion}
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                              <span>Código: <span className="font-mono">{item.codigo || 'N/A'}</span></span>
                              <span>Cantidad: <span className="font-medium">{item.cantidad}</span></span>
                              <span>Precio: <span className="font-medium">${item.precioUni.toFixed(2)}</span></span>
                              <span>Proveedor: <span className="font-medium">{item.proveedor}</span></span>
                            </div>

                            {item.presentacion && item.presentacion !== 'UNIDAD' && (
                              <div className="mt-2 text-xs text-gray-600">
                                Presentación detectada: <span className="font-mono">{item.presentacion}</span>
                              </div>
                            )}

                            {item.razon && (
                              <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                {item.razon}
                              </div>
                            )}
                          </div>

                          {/* Botón expandir */}
                          {item.productosSimilares && item.productosSimilares.length > 0 && (
                            <button
                              onClick={() => toggleExpandir(key)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {isExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          )}
                        </div>

                        {/* Productos similares (expandido) */}
                        {isExpandido && item.productosSimilares && item.productosSimilares.length > 0 && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-700 mb-2">Productos similares encontrados:</div>
                            <div className="space-y-2">
                              {item.productosSimilares.slice(0, 3).map((similar) => (
                                <div key={similar.producto.id} className="flex items-center justify-between text-sm">
                                  <div>
                                    <span className="font-medium">{similar.producto.descripcion}</span>
                                    <span className="text-gray-500 ml-2">
                                      [{inventarioService.getCodigoPreferidoProducto(similar.producto)}]
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                    {(similar.score * 100).toFixed(1)}% similar
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Categoría sugerida / custom (solo para crear) */}
                    {estaSeleccionado && item.accion === 'crear' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-1">Categoría</div>
                          <select
                            value={(categoriaByKey[key] ?? item.categoriaSugerida ?? 'Varios').toString()}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCategoriaByKey((prev) => ({ ...prev, [key]: v }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {(categoriasDisponibles.length ? categoriasDisponibles : ['Varios']).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {!categoriasDisponibles.includes('Varios') && <option value="Varios">Varios</option>}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Factor requerido */}
                    {estaSeleccionado && item.requiereFactor && (item.presentacion || 'UNIDAD') !== 'UNIDAD' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-medium text-amber-700 mb-1">Requiere factor</div>
                        <div className="text-[11px] text-gray-600 mb-2">
                          ¿Cuántas unidades base tiene 1 {item.presentacion}? (Ej: 1 CAJA = 12)
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={factorByKey[key] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFactorByKey((prev) => ({ ...prev, [key]: v }));
                            }}
                            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="12"
                          />
                          <div className="text-xs text-gray-500">unidad base</div>
                        </div>
                        {(() => {
                          const raw = (factorByKey[key] ?? '').toString().trim();
                          const f = Number(raw);
                          if (!raw) return null;
                          if (!Number.isFinite(f) || f <= 0) {
                            return <div className="mt-2 text-xs text-red-600">Factor inválido</div>;
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Opción de recordar */}
                    {item.accion === 'asociar' && estaSeleccionado && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={recordarMappings[key] ?? true}
                            onChange={() => toggleRecordar(item)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          Recordar esta asociación para futuras importaciones
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {itemsFiltrados.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay productos que coincidan con los filtros</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sticky bottom-0 bg-white z-10 sm:static">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedCount} productos seleccionados
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={isProcessing || selectedCount === 0 || missingFactorCount > 0}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Importando...' : 'Confirmar Importación'}
              </button>
            </div>
          </div>

          {missingFactorCount > 0 && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Hay {missingFactorCount} producto(s) seleccionados que requieren factor de conversión. Completa esos factores para poder confirmar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreValidacionModal;
