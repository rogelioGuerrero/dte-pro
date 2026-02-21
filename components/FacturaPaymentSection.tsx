import React from 'react';
import { ChevronDown } from 'lucide-react';

interface FormaPagoItem {
  codigo: string;
  descripcion: string;
}

interface FacturaPaymentSectionProps {
  formaPago: string;
  setFormaPago: React.Dispatch<React.SetStateAction<string>>;
  formasPago: FormaPagoItem[];
  condicionOperacion: number;
  setCondicionOperacion: React.Dispatch<React.SetStateAction<number>>;
  observaciones: string;
  setObservaciones: React.Dispatch<React.SetStateAction<string>>;
}

export const FacturaPaymentSection: React.FC<FacturaPaymentSectionProps> = ({
  formaPago,
  setFormaPago,
  formasPago,
  condicionOperacion,
  setCondicionOperacion,
  observaciones,
  setObservaciones,
}) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Forma de Pago</label>
          <div className="relative">
            <select
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
            >
              {formasPago.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.descripcion}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Condición</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCondicionOperacion(1)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                condicionOperacion === 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Contado
            </button>
            <button
              onClick={() => setCondicionOperacion(2)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                condicionOperacion === 2 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Crédito
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          placeholder="Observaciones opcionales..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />
      </div>
    </>
  );
};
