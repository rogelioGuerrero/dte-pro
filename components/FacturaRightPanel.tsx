import React from 'react';
import { Calculator, User, CheckCircle, Eye, FileText, Trash2 } from 'lucide-react';
import type { ClientData } from '../utils/clientDb';
import type { DTEJSON } from '../utils/dteGenerator';

interface TotalesResumen {
  totalGravada: number;
  totalExenta: number;
  subTotalVentas: number;
  iva: number;
  totalCargosNoBase?: number;
  totalPagar: number;
}

interface FacturaRightPanelProps {
  totales: TotalesResumen;
  selectedReceptor: ClientData | null;
  generatedDTE: DTEJSON | null;
  formaPago: string;
  tipoDocumento?: string;
  requiereStripe: (formaPago: string) => boolean;
  onOpenDTEPreview: () => void;
  onTransmit: () => void;
  onDeleteDTE: () => void;
}

export const FacturaRightPanel: React.FC<FacturaRightPanelProps> = ({
  totales,
  selectedReceptor,
  generatedDTE,
  formaPago,
  tipoDocumento = '01',
  requiereStripe,
  onOpenDTEPreview,
  onTransmit,
  onDeleteDTE,
}) => {
  const isFactura = tipoDocumento === '01';

  return (
    <div className="col-span-4 flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Resumen
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Gravado:</span>
            <span className="font-mono">${totales.totalGravada.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Exento:</span>
            <span className="font-mono">${totales.totalExenta.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal:</span>
            <span className="font-mono">${totales.subTotalVentas.toFixed(2)}</span>
          </div>

          {typeof totales.totalCargosNoBase === 'number' && totales.totalCargosNoBase !== 0 && (
            <div className="flex justify-between text-blue-700">
              <span>Cargos/Abonos (no base):</span>
              <span className="font-mono">${totales.totalCargosNoBase.toFixed(2)}</span>
            </div>
          )}
          
          {/* En Factura (01) el IVA va incluido, lo mostramos informativo */}
          {isFactura ? (
            <div className="flex justify-between text-gray-400 text-xs border-t border-dashed border-gray-200 pt-1 mt-1">
              <span>(IVA incluido en precios):</span>
              <span className="font-mono">${totales.iva.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-blue-600">
              <span>IVA 13%:</span>
              <span className="font-mono">${totales.iva.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className="font-mono text-green-600">${totales.totalPagar.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {selectedReceptor && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" /> Receptor
          </h3>
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-800">{selectedReceptor.name}</p>
            <p className="text-gray-500">NIT: {selectedReceptor.nit}</p>
            {selectedReceptor.nrc && <p className="text-gray-500">NRC: {selectedReceptor.nrc}</p>}
            <p className="text-gray-500">{selectedReceptor.email}</p>
          </div>
        </div>
      )}

      {generatedDTE && (
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">DTE Generado</h3>
              <p className="text-xs text-gray-500 font-mono truncate">
                {generatedDTE.identificacion.codigoGeneracion.substring(0, 20)}...
              </p>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-600">Total</span>
              <span className="text-lg font-bold text-green-700">
                ${generatedDTE.resumen.totalPagar.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={onOpenDTEPreview}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              <Eye className="w-4 h-4" />
              Ver Detalles
            </button>

            <button
              onClick={onTransmit}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              {requiereStripe(formaPago) ? 'Cobrar con Tarjeta' : 'Transmitir a Hacienda'}
            </button>

            <button
              onClick={onDeleteDTE}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar DTE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
