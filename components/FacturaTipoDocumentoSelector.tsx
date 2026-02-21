import React from 'react';
import { ChevronDown } from 'lucide-react';
import Tooltip from './Tooltip';

interface FacturaTipoDocumentoSelectorProps {
  tipoDocumento: string;
  setTipoDocumento: (value: string) => void;
  selectedReceptor: any;
  receptorEsConsumidorFinal: boolean;
  tiposDocumentoFiltrados: Array<{ codigo: string; descripcion: string }>;
}

export const FacturaTipoDocumentoSelector: React.FC<FacturaTipoDocumentoSelectorProps> = ({
  tipoDocumento,
  setTipoDocumento,
  selectedReceptor,
  receptorEsConsumidorFinal,
  tiposDocumentoFiltrados,
}) => {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
        Tipo de Documento
        {receptorEsConsumidorFinal && (
          <Tooltip content="Para Consumidor Final solo se permiten: Factura (01), Factura Simplificada (02), Tiquetes (10) y Factura de Exportación (11)" position="bottom">
            <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold cursor-help">
              i
            </span>
          </Tooltip>
        )}
      </label>
      <div className="relative">
        <select
          value={tipoDocumento}
          onChange={(e) => setTipoDocumento(e.target.value)}
          disabled={!selectedReceptor}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
        >
          {tiposDocumentoFiltrados.map(t => (
            <option
              key={t.codigo}
              value={t.codigo}
            >
              {t.codigo} - {t.descripcion}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {!selectedReceptor && (
        <p className="mt-1 text-[11px] text-gray-400">
          Selecciona receptor para ver documentos disponibles.
        </p>
      )}
    </div>
  );
};
