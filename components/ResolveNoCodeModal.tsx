import React from 'react';
import { X } from 'lucide-react';

export type ResolverItem = {
  index: number;
  descripcion: string;
  cantidad: number;
  selectedProductoId: string;
  recordar: boolean;
  candidates: Array<{ productoId: string; label: string; score: number }>;
  search: string;
};

export const ResolveNoCodeModal: React.FC<{
  isOpen: boolean;
  resolverItems: ResolverItem[];
  setResolverItems: React.Dispatch<React.SetStateAction<ResolverItem[]>>;
  onClose: () => void;
  onContinue: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  inventarioService: {
    buscarProductosFacturacion: (term: string) => Array<{ id: string; descripcion: string }>;
    getCodigoPreferidoProducto: (p: any) => string;
  };
}> = ({
  isOpen,
  resolverItems,
  setResolverItems,
  onClose,
  onContinue,
  addToast,
  inventarioService,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Resolver productos sin código</p>
            <p className="text-xs text-gray-500">Selecciona el producto correcto para evitar errores de inventario y cumplimiento.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {resolverItems.map((r, idx) => (
            <div key={`${r.index}-${idx}`} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.descripcion}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Cantidad: <span className="font-mono">{r.cantidad}</span></p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={r.recordar}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setResolverItems((prev) => prev.map((x) => x.index === r.index ? { ...x, recordar: v } : x));
                    }}
                  />
                  Recordar
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Producto</label>
                  <select
                    value={r.selectedProductoId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setResolverItems((prev) => prev.map((x) => x.index === r.index ? { ...x, selectedProductoId: v } : x));
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Seleccionar…</option>
                    {r.candidates.map((c) => (
                      <option key={c.productoId} value={c.productoId}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {r.candidates.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">No hay candidatos. Crea el producto en Productos o ajusta la descripción.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Buscar en inventario</label>
                  <input
                    type="text"
                    value={r.search}
                    onChange={(e) => {
                      const v = e.target.value;
                      const candidatos = inventarioService.buscarProductosFacturacion(v)
                        .slice(0, 8)
                        .map((p) => ({
                          productoId: p.id,
                          label: `${inventarioService.getCodigoPreferidoProducto(p) ? `[${inventarioService.getCodigoPreferidoProducto(p)}] ` : ''}${p.descripcion}`,
                          score: 0,
                        }));
                      setResolverItems((prev) => prev.map((x) => x.index === r.index ? { ...x, search: v, candidates: v.trim() ? candidatos : x.candidates } : x));
                    }}
                    placeholder="Escribe para buscar…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Opcional: si no aparece, búscalo manualmente.</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              const faltantes = resolverItems.filter((r) => !r.selectedProductoId);
              if (faltantes.length > 0) {
                addToast('Selecciona un producto para cada ítem sin código', 'error');
                return;
              }
              onContinue();
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
