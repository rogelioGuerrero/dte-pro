import React, { useEffect, useMemo, useState } from 'react';
import { Package, BarChart3, FileText, Settings, Menu, X, AlertTriangle, Save, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import CatalogoProductos from './CatalogoProductos';
import DashboardInventario from './DashboardInventario';
import ReporteKardex from './ReporteKardex';
import FormularioProducto from './FormularioProducto';
import { Producto } from '../../types/inventario';
import { loadSettings, saveSettings, type AppSettings } from '../../utils/settings';
import { notify } from '../../utils/notifications';
import { inventarioService } from '../../utils/inventario/inventarioService';

type VistaInventario = 'dashboard' | 'catalogo' | 'reportes' | 'configuracion' | 'pendientes' | 'ajustes';

const SistemaInventario: React.FC = () => {
  const [vistaActual, setVistaActual] = useState<VistaInventario>('dashboard');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [inventorySettings, setInventorySettings] = useState<AppSettings>(loadSettings());
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pendienteFactorByKey, setPendienteFactorByKey] = useState<Record<string, string>>({});
  const [compraResolveById, setCompraResolveById] = useState<Record<string, { selectedProductoId: string; recordar: boolean; search: string }>>({});

  const [ajusteProductoId, setAjusteProductoId] = useState('');
  const [ajusteTipo, setAjusteTipo] = useState<'entrada' | 'salida'>('entrada');
  const [ajusteCantidad, setAjusteCantidad] = useState<string>('');
  const [ajusteCostoUnitario, setAjusteCostoUnitario] = useState<string>('');
  const [ajusteMotivo, setAjusteMotivo] = useState<string>('');
  const [ajusteFecha, setAjusteFecha] = useState<string>('');
  const [isApplyingAjuste, setIsApplyingAjuste] = useState(false);

  const reloadProductos = () => {
    setProductos(inventarioService.getProductos());
  };

  useEffect(() => {
    reloadProductos();
  }, []);

  const pendientes = useMemo(() => {
    return productos
      .filter((p) => Array.isArray(p.presentacionesPendientes) && p.presentacionesPendientes.length > 0)
      .map((p) => ({
        producto: p,
        pendientes: (p.presentacionesPendientes || []).map((x) => (x || '').toUpperCase()).filter(Boolean),
      }));
  }, [productos]);

  const pendientesPresentacionesCount = useMemo(() => {
    return pendientes.reduce((sum, x) => sum + x.pendientes.length, 0);
  }, [pendientes]);

  const comprasPendientes = useMemo(() => {
    return inventarioService.getComprasPendientes();
  }, [productos]);

  const pendientesCount = useMemo(() => {
    return pendientesPresentacionesCount + (comprasPendientes?.length || 0);
  }, [pendientesPresentacionesCount, comprasPendientes]);

  const handleProductoGuardado = (_producto: Producto) => {
    setMostrarFormulario(false);
    setEditandoProducto(null);
    // Recargar la vista actual si es necesario
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'catalogo', label: 'Catálogo', icon: Package },
    { id: 'pendientes', label: 'Pendientes', icon: AlertTriangle },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
    { id: 'reportes', label: 'Reportes', icon: FileText },
    { id: 'configuracion', label: 'Configuración', icon: Settings }
  ];

  const renderVista = () => {
    switch (vistaActual) {
      case 'dashboard':
        return <DashboardInventario />;
      case 'catalogo':
        return (
          <CatalogoProductos
            onProductoEdit={(producto) => {
              setEditandoProducto(producto);
              setMostrarFormulario(true);
            }}
            onOpenConfig={() => setVistaActual('configuracion')}
          />
        );
      case 'reportes':
        return <ReporteKardex />;
      case 'pendientes':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                Pendientes de Inventario
              </h2>
              <p className="text-gray-600 mt-2">
                Completa factores de conversión detectados en compras (ej. CAJA = 12 UNIDADES). Mientras no lo completes, se usa factor 1.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {pendientes.length === 0 && (!comprasPendientes || comprasPendientes.length === 0) ? (
                <div className="text-sm text-gray-600">No hay pendientes por resolver.</div>
              ) : (
                <>
                  {/* Pendientes de presentaciones */}
                  {pendientes.length > 0 && (
                    <div className="space-y-4">
                      {pendientes.map(({ producto, pendientes }) => (
                        <div key={producto.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-gray-900">{producto.descripcion}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Unidad base: <span className="font-mono">{(producto.unidadBase || 'UNIDAD').toUpperCase()}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoProducto(producto);
                                setMostrarFormulario(true);
                              }}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                            >
                              Editar producto
                            </button>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {pendientes.map((pres) => {
                              const key = `${producto.id}::${pres}`;
                              const val = pendienteFactorByKey[key] ?? '';
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-600">{pres}</div>
                                    <div className="text-[10px] text-gray-500">
                                      ¿Cuántas unidades base tiene 1 {pres}?
                                    </div>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={val}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setPendienteFactorByKey((prev) => ({ ...prev, [key]: v }));
                                    }}
                                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="12"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const raw = (pendienteFactorByKey[key] ?? '').toString();
                                      const factor = Number(raw);
                                      if (!Number.isFinite(factor) || factor <= 0) {
                                        notify('Ingresa un factor válido (> 0)', 'error');
                                        return;
                                      }
                                      inventarioService.setPresentacionProducto(producto.id, pres, factor);
                                      setPendienteFactorByKey((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                      });
                                      reloadProductos();
                                      notify('Presentación actualizada', 'success');
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                  >
                                    <Save className="w-4 h-4" />
                                    Guardar
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pendientes de compras */}
                  {comprasPendientes && comprasPendientes.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-sm font-semibold text-gray-900">Compras pendientes de vincular</div>
                      {comprasPendientes.map((cp) => {
                        const state = compraResolveById[cp.id] || { selectedProductoId: '', recordar: true, search: '' };
                        const candidatos = Array.isArray(cp.candidates) ? cp.candidates : [];

                        const searchResults = state.search.trim()
                          ? inventarioService.buscarProductosFacturacion(state.search).slice(0, 8)
                          : [];

                        return (
                          <div key={cp.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{cp.descripcion}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Proveedor: <span className="font-medium">{cp.proveedorNombre}</span> · Doc: <span className="font-mono">{cp.docRef}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Cantidad: <span className="font-mono">{cp.cantidadOriginal}</span> {cp.presentacion} (factor {cp.factorConversion}) → <span className="font-mono">{cp.cantidadBase}</span> base · Costo: <span className="font-mono">{cp.costoUnitario.toFixed(2)}</span>
                                </div>
                              </div>

                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={state.recordar}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setCompraResolveById((prev) => ({
                                      ...prev,
                                      [cp.id]: { ...state, recordar: checked },
                                    }));
                                  }}
                                  className="w-4 h-4"
                                />
                                Recordar
                              </label>
                            </div>

                            {candidatos.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {candidatos.map((c) => (
                                  <button
                                    key={c.productoId}
                                    type="button"
                                    onClick={() => {
                                      setCompraResolveById((prev) => ({
                                        ...prev,
                                        [cp.id]: { ...state, selectedProductoId: c.productoId },
                                      }));
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs border ${state.selectedProductoId === c.productoId ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                    title={`score: ${c.score.toFixed(3)}`}
                                  >
                                    {(() => {
                                      const p = inventarioService.getProductoById(c.productoId);
                                      const cod = p ? inventarioService.getCodigoPreferidoProducto(p) : '';
                                      return `${cod ? `[${cod}] ` : ''}${c.descripcion}`;
                                    })()}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <input
                                  type="text"
                                  value={state.search}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setCompraResolveById((prev) => ({
                                      ...prev,
                                      [cp.id]: { ...state, search: v },
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="Buscar producto..."
                                />

                                {searchResults.length > 0 && (
                                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                                    {searchResults.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                          setCompraResolveById((prev) => ({
                                            ...prev,
                                            [cp.id]: { ...state, selectedProductoId: p.id, search: '' },
                                          }));
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                      >
                                        {(inventarioService.getCodigoPreferidoProducto(p) ? `[${inventarioService.getCodigoPreferidoProducto(p)}] ` : '')}{p.descripcion}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-start justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await inventarioService.crearProductoYAplicarCompraPendiente(cp.id, Boolean(compraResolveById[cp.id]?.recordar ?? true));
                                      setCompraResolveById((prev) => {
                                        const next = { ...prev };
                                        delete next[cp.id];
                                        return next;
                                      });
                                      reloadProductos();
                                      notify('Producto creado y compra aplicada', 'success');
                                    } catch (e: any) {
                                      notify(e?.message || 'No se pudo crear/aplicar', 'error');
                                    }
                                  }}
                                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                >
                                  Crear producto
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const selected = (compraResolveById[cp.id]?.selectedProductoId || '').trim();
                                    if (!selected) {
                                      notify('Selecciona un producto para vincular', 'error');
                                      return;
                                    }
                                    try {
                                      await inventarioService.resolverCompraPendiente(cp.id, selected, Boolean(compraResolveById[cp.id]?.recordar));
                                      setCompraResolveById((prev) => {
                                        const next = { ...prev };
                                        delete next[cp.id];
                                        return next;
                                      });
                                      reloadProductos();
                                      notify('Compra aplicada correctamente', 'success');
                                    } catch (e: any) {
                                      notify(e?.message || 'No se pudo aplicar la compra', 'error');
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                >
                                  <Save className="w-4 h-4" />
                                  Aplicar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      case 'ajustes':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Ajustes de Inventario</h2>
              <p className="text-gray-600 mt-2">
                Registra entradas o salidas manuales (inventario inicial, correcciones por conteo físico, mermas, etc.). Esto crea movimientos para el Kardex.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                  <select
                    value={ajusteProductoId}
                    onChange={(e) => setAjusteProductoId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos
                      .slice()
                      .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {(p.codigoPrincipal || p.codigo || '').toString().trim() ? `[${(p.codigoPrincipal || p.codigo || '').toString().trim()}] ` : ''}{p.descripcion}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de ajuste</label>
                  <select
                    value={ajusteTipo}
                    onChange={(e) => setAjusteTipo(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="entrada">Entrada (sumar stock)</option>
                    <option value="salida">Salida (restar stock)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ajusteCantidad}
                    onChange={(e) => setAjusteCantidad(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo unitario (solo entrada)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={ajusteCostoUnitario}
                    onChange={(e) => setAjusteCostoUnitario(e.target.value)}
                    disabled={ajusteTipo !== 'entrada'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={ajusteFecha}
                    onChange={(e) => setAjusteFecha(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / referencia</label>
                <input
                  type="text"
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: Conteo físico"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAjusteProductoId('');
                    setAjusteTipo('entrada');
                    setAjusteCantidad('');
                    setAjusteCostoUnitario('');
                    setAjusteMotivo('');
                    setAjusteFecha('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={isApplyingAjuste}
                  onClick={async () => {
                    if (!ajusteProductoId) {
                      notify('Selecciona un producto', 'error');
                      return;
                    }
                    const qty = Number(ajusteCantidad);
                    if (!Number.isFinite(qty) || qty <= 0) {
                      notify('Ingresa una cantidad válida (> 0)', 'error');
                      return;
                    }
                    setIsApplyingAjuste(true);
                    try {
                      const fecha = ajusteFecha ? new Date(`${ajusteFecha}T00:00:00`) : new Date();
                      const docRef = ajusteMotivo?.trim() ? `AJUSTE:${ajusteMotivo.trim()}` : undefined;
                      if (ajusteTipo === 'entrada') {
                        const costo = ajusteCostoUnitario.trim() ? Number(ajusteCostoUnitario) : undefined;
                        await inventarioService.registrarEntradaManual({
                          productoId: ajusteProductoId,
                          cantidad: qty,
                          costoUnitario: costo,
                          fecha,
                          documentoReferencia: docRef,
                          proveedorNombre: 'AJUSTE',
                          unidad: 'UNIDAD',
                        });
                        notify('Entrada registrada', 'success');
                      } else {
                        await inventarioService.registrarSalidaManual({
                          productoId: ajusteProductoId,
                          cantidad: qty,
                          fecha,
                          documentoReferencia: docRef,
                          motivo: ajusteMotivo || 'AJUSTE',
                        });
                        notify('Salida registrada', 'success');
                      }
                      reloadProductos();
                      setAjusteCantidad('');
                      setAjusteCostoUnitario('');
                    } catch (e: any) {
                      notify(e?.message || 'No se pudo registrar el ajuste', 'error');
                    } finally {
                      setIsApplyingAjuste(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {ajusteTipo === 'entrada' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                  {isApplyingAjuste ? 'Aplicando…' : 'Aplicar ajuste'}
                </button>
              </div>
            </div>
          </div>
        );
      case 'configuracion':
        return (
          <div className="bg-white rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Configuración de Inventario</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Costeo</label>
                <select
                  value={inventorySettings.inventoryCostingMethod || 'UEPS'}
                  onChange={(e) =>
                    setInventorySettings({
                      ...inventorySettings,
                      inventoryCostingMethod: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="UEPS">UEPS (últimas entradas, primeras salidas)</option>
                  <option value="PEPS">PEPS (primeras entradas, primeras salidas)</option>
                  <option value="PROMEDIO">Promedio ponderado</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">Para cálculo de costo de ventas</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inventorySettings.inventoryShowLotProvider || false}
                    onChange={(e) =>
                      setInventorySettings({
                        ...inventorySettings,
                        inventoryShowLotProvider: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Mostrar Lote y Proveedor</span>
                </label>
                <p className="text-[10px] text-gray-500 mt-1 ml-6">
                  Muestra información de lote y proveedor en facturas
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inventorySettings.inventoryFallbackByDescription !== false}
                    onChange={(e) =>
                      setInventorySettings({
                        ...inventorySettings,
                        inventoryFallbackByDescription: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Buscar por Descripción</span>
                </label>
                <p className="text-[10px] text-gray-500 mt-1 ml-6">
                  Si no encuentra código, busca por nombre del producto
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Umbral Auto-match</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={inventorySettings.inventoryAutoMatchThreshold ?? 0.9}
                    onChange={(e) =>
                      setInventorySettings({
                        ...inventorySettings,
                        inventoryAutoMatchThreshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Coincidencia automática</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Umbral Sugerir</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={inventorySettings.inventoryAskMatchThreshold ?? 0.75}
                    onChange={(e) =>
                      setInventorySettings({
                        ...inventorySettings,
                        inventoryAskMatchThreshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Para sugerir productos</p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const reloaded = loadSettings();
                    setInventorySettings(reloaded);
                    notify('Cambios descartados', 'info');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveSettings(inventorySettings);
                    notify('Configuración guardada correctamente', 'success');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <DashboardInventario />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar - Desktop */}
        <div className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900">Sistema de Inventario</h1>
          </div>
          <nav className="px-4 pb-6">
            {menuItems.map(item => {
              const Icon = item.icon;
              const showBadge = item.id === 'pendientes' && pendientesCount > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setVistaActual(item.id as VistaInventario)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                    vistaActual === item.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {showBadge && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {pendientesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar móvil */}
        {menuAbierto && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMenuAbierto(false)} />
            <div className="relative bg-white w-64 min-h-full">
              <div className="p-6">
                <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
              </div>
              <nav className="px-4 pb-6">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  const showBadge = item.id === 'pendientes' && pendientesCount > 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setVistaActual(item.id as VistaInventario);
                        setMenuAbierto(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                        vistaActual === item.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {showBadge && (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {pendientesCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <div className="flex-1 p-4 lg:p-6">
          {renderVista()}
        </div>
      </div>

      {/* Botón flotante para abrir menú en móvil (evita header duplicado arriba) */}
      <button
        type="button"
        onClick={() => setMenuAbierto(!menuAbierto)}
        className="lg:hidden fixed right-4 bottom-20 z-30 p-3 rounded-full shadow-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        aria-label={menuAbierto ? 'Cerrar menú de inventario' : 'Abrir menú de inventario'}
      >
        {menuAbierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Formulario flotante */}
      {mostrarFormulario && (
        <FormularioProducto
          producto={editandoProducto}
          onClose={() => {
            setMostrarFormulario(false);
            setEditandoProducto(null);
          }}
          onSave={(p) => {
            handleProductoGuardado(p);
            reloadProductos();
          }}
        />
      )}
    </div>
  );
};

export default SistemaInventario;
