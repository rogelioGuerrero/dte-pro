import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, FileUp, Search, Settings, Trash2, X } from 'lucide-react';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';
import { getProducts, ProductData } from '../utils/productDb';
import {
  applyManualAdjustment,
  applyPurchasesFromDTE,
  clearInventory,
  getAllStock,
  InventoryStock,
  revertLastPurchaseImport,
} from '../utils/inventoryDb';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';

const InventoryManager: React.FC = () => {
  const [stock, setStock] = useState<InventoryStock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [products, setProducts] = useState<ProductData[]>([]);

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentSearch, setAdjustmentSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [adjustmentDirection, setAdjustmentDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjustmentQty, setAdjustmentQty] = useState<number>(1);
  const [adjustmentUnitCost, setAdjustmentUnitCost] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isApplyingAdjustment, setIsApplyingAdjustment] = useState(false);
  const [showInventoryConfig, setShowInventoryConfig] = useState(false);
  const [inventorySettings, setInventorySettings] = useState<AppSettings>(loadSettings());

  const importInputRef = useRef<HTMLInputElement>(null);

  const { toasts, addToast, removeToast } = useToast();

  const load = async () => {
    const all = await getAllStock();
    setStock(all);
  };

  const handleRevertLastImport = async () => {
    const ok = window.confirm(
      'Revertir la última importación eliminará los movimientos de esa compra (como si no hubiera pasado). Solo se permite si no hay movimientos posteriores. ¿Continuar?'
    );
    if (!ok) return;

    setIsImporting(true);
    try {
      const r = await revertLastPurchaseImport();
      if (!r.ok) {
        addToast(r.message, 'error');
        return;
      }
      await load();
      addToast(`Importación revertida (${r.docRef}). Movimientos eliminados: ${r.removed}`, 'success');
    } catch {
      addToast('No se pudo revertir la importación', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    load();
    const loadProducts = async () => {
      const all = await getProducts();
      setProducts(all);
    };
    loadProducts();
  }, []);

  useEffect(() => {
    if (!importInputRef.current) return;
    importInputRef.current.setAttribute('webkitdirectory', '');
    importInputRef.current.setAttribute('directory', '');
  }, []);

  const stockMinByCode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const code = (p.codigo || '').trim();
      if (!code) continue;
      map[code] = typeof p.stockMin === 'number' ? p.stockMin : 0;
    }
    return map;
  }, [products]);

  const filteredStock = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = term
      ? stock.filter((s) => {
          return (
            (s.productCode || '').toLowerCase().includes(term) ||
            (s.productDesc || '').toLowerCase().includes(term)
          );
        })
      : stock;

    if (!onlyLowStock) return base;

    return base.filter((s) => {
      const code = (s.productCode || '').trim();
      const min = stockMinByCode[code] ?? 0;
      return min > 0 && (s.onHand || 0) < min;
    });
  }, [searchTerm, stock, onlyLowStock, stockMinByCode]);

  const lowStockCount = useMemo(() => {
    let c = 0;
    for (const s of stock) {
      const code = (s.productCode || '').trim();
      const min = stockMinByCode[code] ?? 0;
      if (min > 0 && (s.onHand || 0) < min) c++;
    }
    return c;
  }, [stock, stockMinByCode]);

  const totals = useMemo(() => {
    const totalItems = stock.length;
    const totalUnits = stock.reduce((sum, s) => sum + (s.onHand || 0), 0);
    const totalValue = stock.reduce((sum, s) => sum + (s.onHand || 0) * (s.avgCost || 0), 0);
    return { totalItems, totalUnits, totalValue };
  }, [stock]);

  const filteredProductsForAdjustment = useMemo(() => {
    const term = adjustmentSearch.trim().toLowerCase();
    if (!term) return products.slice(0, 80);
    return products
      .filter((p) => {
        return (
          (p.codigo || '').toLowerCase().includes(term) ||
          (p.descripcion || '').toLowerCase().includes(term)
        );
      })
      .slice(0, 80);
  }, [adjustmentSearch, products]);

  const openAdjustmentModal = () => {
    setShowAdjustmentModal(true);
    setAdjustmentSearch('');
    setSelectedProduct(null);
    setAdjustmentDirection('IN');
    setAdjustmentQty(1);
    setAdjustmentUnitCost(0);
    setAdjustmentReason('');
  };

  const applyAdjustment = async () => {
    if (!selectedProduct) {
      addToast('Selecciona un producto', 'error');
      return;
    }
    const codigo = (selectedProduct.codigo || '').trim();
    if (!codigo) {
      addToast('El producto no tiene código', 'error');
      return;
    }
    if (!adjustmentQty || adjustmentQty <= 0) {
      addToast('Cantidad inválida', 'error');
      return;
    }
    if (adjustmentDirection === 'IN' && adjustmentUnitCost < 0) {
      addToast('Costo inválido', 'error');
      return;
    }

    setIsApplyingAdjustment(true);
    try {
      const r = await applyManualAdjustment({
        productCode: codigo,
        productDesc: selectedProduct.descripcion,
        direction: adjustmentDirection,
        qty: adjustmentQty,
        unitCost: adjustmentDirection === 'IN' ? adjustmentUnitCost : undefined,
        reason: adjustmentReason,
      });

      if (!r.ok) {
        addToast(r.message, 'error');
        return;
      }

      await load();
      addToast('Ajuste aplicado', 'success');
      setShowAdjustmentModal(false);
    } catch {
      addToast('No se pudo aplicar el ajuste', 'error');
    } finally {
      setIsApplyingAdjustment(false);
    }
  };

  const handleImportPurchases = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsImporting(true);
    try {
      let imported = 0;
      let skipped = 0;
      let missingCodes = 0;
      let resolvedByDesc = 0;
      let updatedStock = 0;

      const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'));

      for (const file of jsonFiles) {
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          const sample = Array.isArray(parsed) ? parsed[0] : parsed;

          if (sample?.cuerpoDocumento) {
            const r = await applyPurchasesFromDTE(text);
            imported += r.imported;
            skipped += r.skipped;
            missingCodes += r.missingCodes;
            resolvedByDesc += r.resolvedByDesc;
            updatedStock += r.updatedStock;
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
      }

      await load();

      const resolvedHint = resolvedByDesc > 0
        ? ` ${resolvedByDesc} items se resolvieron por descripción usando tu catálogo.`
        : '';
      const warn = missingCodes > 0
        ? ` ${missingCodes} items sin código (no se pudieron resolver; debes corregirlos en el catálogo).`
        : '';

      addToast(
        `${imported} entradas, ${updatedStock} stocks actualizados, ${skipped} omitidos.${resolvedHint}${warn}`,
        missingCodes > 0 ? 'info' : 'success'
      );
    } catch {
      addToast('Error al importar compras', 'error');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (!stock.length) return;
    if (!window.confirm('¿Borrar todo el inventario (movimientos y stock)? Esta acción no se puede deshacer.')) return;
    await clearInventory();
    await load();
    addToast('Inventario eliminado', 'info');
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventario</h2>
          <p className="text-sm text-gray-500">Stock actual y costo promedio ponderado</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={importInputRef}
            className="hidden"
            accept=".json"
            onChange={handleImportPurchases}
            multiple
          />

          <Tooltip content="Importar DTE JSON de COMPRAS (archivos o carpeta)" position="bottom">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <FileUp className="w-4 h-4" />
              Importar
            </button>
          </Tooltip>

          <Tooltip content="Revertir la última importación de compras" position="bottom">
            <button
              type="button"
              onClick={handleRevertLastImport}
              disabled={isImporting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              Revertir última
            </button>
          </Tooltip>

          <Tooltip content="Ajuste de inventario" position="bottom">
            <button
              type="button"
              onClick={openAdjustmentModal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
            >
              <ArrowUpCircle className="w-4 h-4 text-green-600" />
              Ajuste
            </button>
          </Tooltip>

          <Tooltip content="Configurar inventario" position="bottom">
            <button
              type="button"
              onClick={() => setShowInventoryConfig(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
            >
              <Settings className="w-4 h-4 text-gray-600" />
              Configurar
            </button>
          </Tooltip>

          <Tooltip content="Borrar inventario" position="bottom">
            <button
              type="button"
              onClick={handleClear}
              disabled={!stock.length}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-4 flex-wrap">
            <span>Productos: <span className="font-semibold text-gray-700">{totals.totalItems}</span></span>
            <span>Unidades: <span className="font-semibold text-gray-700">{totals.totalUnits.toFixed(2)}</span></span>
            <span>Valor: <span className="font-semibold text-gray-700">${totals.totalValue.toFixed(2)}</span></span>
            <span className={lowStockCount > 0 ? 'text-red-600' : ''}>
              Bajo mínimo: <span className="font-semibold">{lowStockCount}</span>
            </span>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
              />
              <span>Solo bajo mínimo</span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3 text-right">Costo Prom.</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Sin datos. Importa compras para construir el inventario.
                  </td>
                </tr>
              ) : (
                filteredStock.map((s) => (
                  <tr
                    key={s.productKey}
                    className={`hover:bg-gray-50 ${
                      (stockMinByCode[(s.productCode || '').trim()] ?? 0) > 0 &&
                      (s.onHand || 0) < (stockMinByCode[(s.productCode || '').trim()] ?? 0)
                        ? 'bg-red-50/40'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.productCode}</td>
                    <td className="px-4 py-3 text-gray-800">{s.productDesc}</td>
                    <td className="px-4 py-3 text-right font-mono">{(s.onHand || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">{(stockMinByCode[(s.productCode || '').trim()] ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">${(s.avgCost || 0).toFixed(4)}</td>
                    <td className="px-4 py-3 text-right font-mono">${((s.onHand || 0) * (s.avgCost || 0)).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Nuevo ajuste</p>
                <p className="text-xs text-gray-500">Entrada o salida manual para control operativo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Producto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={adjustmentSearch}
                    onChange={(e) => setAdjustmentSearch(e.target.value)}
                    placeholder="Buscar por código o descripción..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                </div>

                <div className="mt-2 max-h-56 overflow-y-auto border border-gray-100 rounded-xl">
                  {filteredProductsForAdjustment.length === 0 ? (
                    <div className="p-6 text-sm text-gray-400 text-center">Sin resultados</div>
                  ) : (
                    filteredProductsForAdjustment.map((p) => (
                      <button
                        key={p.id ?? p.key}
                        type="button"
                        onClick={() => setSelectedProduct(p)}
                        className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                          selectedProduct?.id === p.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">{p.codigo || 'SIN CÓDIGO'}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tipo</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentDirection('IN')}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        adjustmentDirection === 'IN'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowUpCircle className="w-4 h-4" /> Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentDirection('OUT')}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        adjustmentDirection === 'OUT'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowDownCircle className="w-4 h-4" /> Salida
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Costo unitario (solo entrada)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={adjustmentUnitCost}
                    onChange={(e) => setAdjustmentUnitCost(parseFloat(e.target.value) || 0)}
                    disabled={adjustmentDirection !== 'IN'}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Motivo (opcional)</label>
                  <input
                    type="text"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Ej: Conteo físico"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyAdjustment}
                  disabled={isApplyingAdjustment}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isApplyingAdjustment ? 'Aplicando…' : 'Aplicar ajuste'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuración de Inventario */}
      {showInventoryConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                Configuración de Inventario
              </h3>
              <button 
                onClick={() => setShowInventoryConfig(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Costeo</label>
                <select
                  value={inventorySettings.inventoryCostingMethod || 'UEPS'}
                  onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryCostingMethod: e.target.value as any })}
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
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryShowLotProvider: e.target.checked })}
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
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryFallbackByDescription: e.target.checked })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umbral Auto-match
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={inventorySettings.inventoryAutoMatchThreshold || 0.9}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryAutoMatchThreshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Coincidencia automática</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umbral Sugerir
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={inventorySettings.inventoryAskMatchThreshold || 0.75}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryAskMatchThreshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Para sugerir productos</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setShowInventoryConfig(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  saveSettings(inventorySettings);
                  setInventorySettings(inventorySettings);
                  setShowInventoryConfig(false);
                  addToast('Configuración guardada correctamente', 'success');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;
