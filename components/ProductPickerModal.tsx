import React from 'react';
import { Search } from 'lucide-react';
import type { ProductData } from '../utils/productDb';

interface ProductPickerModalProps {
  isOpen: boolean;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredProductsForPicker: ProductData[];
  productPickerIndex: number | null;
  applyProductToItem: (index: number, p: ProductData) => void;
  onClose: () => void;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  isOpen,
  productSearch,
  setProductSearch,
  filteredProductsForPicker,
  productPickerIndex,
  applyProductToItem,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Seleccionar producto</p>
            <p className="text-xs text-gray-500">Busca por código o descripción</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cerrar
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Ej: 14848 o TOMA ADAPTADOR..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
            {filteredProductsForPicker.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">Sin resultados</div>
            ) : (
              filteredProductsForPicker.slice(0, 200).map((p) => (
                <button
                  key={p.id ?? p.key}
                  type="button"
                  onClick={() => {
                    const idx = productPickerIndex;
                    if (typeof idx === 'number') {
                      applyProductToItem(idx, p);
                    }
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {p.codigo ? `Código: ${p.codigo}` : 'Sin código'}
                      </p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-sm font-mono text-gray-900">${p.precioUni.toFixed(2)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {filteredProductsForPicker.length > 200 && (
            <p className="mt-2 text-xs text-gray-400">Mostrando 200 resultados. Refina tu búsqueda.</p>
          )}
        </div>
      </div>
    </div>
  );
};
