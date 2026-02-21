import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Presentacion {
  nombre: string;
  factor: number;
}

interface FacturaItemRow {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadVenta: string;
  factorConversion: number;
  precioUni: number;
  precioUniRaw?: string;
  esExento: boolean;
}

interface FacturaItemsTableProps {
  items: FacturaItemRow[];
  canUseCatalogoProductos: boolean;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onOpenProductPicker: (idx: number) => void;
  onItemChange: (idx: number, field: keyof FacturaItemRow, value: any) => void;
  onItemDescriptionBlur: (idx: number) => void;
  onPrecioUniChange: (idx: number, value: string) => void;
  onPrecioUniBlur: (idx: number) => void;
  getPresentacionesForCodigo: (codigo: string) => Presentacion[];
  getStockDisplayForCodigo: (codigo: string) => string;
  redondear: (value: number, decimals: number) => number;
  tipoDocumento: string;
}

export const FacturaItemsTable: React.FC<FacturaItemsTableProps> = ({
  items,
  canUseCatalogoProductos,
  onAddItem,
  onRemoveItem,
  onOpenProductPicker,
  onItemChange,
  onItemDescriptionBlur,
  onPrecioUniChange,
  onPrecioUniBlur,
  getPresentacionesForCodigo,
  getStockDisplayForCodigo,
  redondear,
  tipoDocumento,
}) => {
  const precioHeaderLabel = tipoDocumento === '01' ? 'Precio (C/IVA)' : 'Precio (S/IVA)';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-500 uppercase">Detalle de Items</label>
        <button
          onClick={onAddItem}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left">Descripción</th>
              <th className="px-2 py-2 text-center w-20">Cant.</th>
              <th className="px-2 py-2 text-right w-24">{precioHeaderLabel}</th>
              <th className="px-2 py-2 text-right w-24">Subtotal</th>
              <th className="px-2 py-2 text-center w-16">Exento</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => onItemChange(idx, 'descripcion', e.target.value)}
                      onBlur={() => onItemDescriptionBlur(idx)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {canUseCatalogoProductos && (
                      <button
                        type="button"
                        onClick={() => onOpenProductPicker(idx)}
                        className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                        title="Buscar en catálogo"
                      >
                        Catálogo
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => onItemChange(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      min="0"
                      step="0.01"
                    />
                    <select
                      value={(item.unidadVenta || 'UNIDAD').toUpperCase()}
                      onChange={(e) => {
                        const unidad = (e.target.value || 'UNIDAD').toUpperCase();
                        const pres = getPresentacionesForCodigo(item.codigo || '');
                        const found = pres.find((p) => p.nombre === unidad);
                        onItemChange(idx, 'unidadVenta', unidad);
                        onItemChange(idx, 'factorConversion', found ? found.factor : 1);
                      }}
                      disabled={!(item.codigo || '').trim()}
                      className="px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      {getPresentacionesForCodigo(item.codigo || '').map((p) => (
                        <option key={p.nombre} value={p.nombre}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.precioUniRaw ?? (Number.isInteger(item.precioUni * 100) ? item.precioUni.toFixed(2) : parseFloat(item.precioUni.toFixed(8)).toString())}
                    onChange={(e) => onPrecioUniChange(idx, e.target.value)}
                    onBlur={() => onPrecioUniBlur(idx)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  {(() => {
                    const code = (item.codigo || '').trim();
                    if (!code) return null;
                    const stock = getStockDisplayForCodigo(code);
                    return (
                      <p className="mt-1 text-[10px] text-gray-400 text-center">
                        Stock: {stock}
                      </p>
                    );
                  })()}
                </td>
                <td className="px-2 py-2 text-right font-mono text-gray-700">
                  ${redondear(item.cantidad * item.precioUni, 2).toFixed(2)}
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.esExento}
                    onChange={(e) => onItemChange(idx, 'esExento', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => onRemoveItem(idx)}
                    disabled={items.length === 1}
                    className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
