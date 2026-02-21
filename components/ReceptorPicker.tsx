import React from 'react';
import { Search, User } from 'lucide-react';
import type { ClientData } from '../utils/clientDb';

interface ReceptorPickerProps {
  selectedReceptor: ClientData | null;
  showClientSearch: boolean;
  setShowClientSearch: React.Dispatch<React.SetStateAction<boolean>>;
  clientSearch: string;
  setClientSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredClients: ClientData[];
  onSelectReceptor: (client: ClientData) => void;
}

export const ReceptorPicker: React.FC<ReceptorPickerProps> = ({
  selectedReceptor,
  showClientSearch,
  setShowClientSearch,
  clientSearch,
  setClientSearch,
  filteredClients,
  onSelectReceptor,
}) => {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
        Receptor (Cliente) <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <button
          onClick={() => setShowClientSearch(!showClientSearch)}
          className={`w-full px-3 py-2 border rounded-lg text-sm text-left flex items-center justify-between ${
            selectedReceptor ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          {selectedReceptor ? (
            <span className="truncate">{selectedReceptor.name}</span>
          ) : (
            <span className="text-gray-400">Seleccionar cliente...</span>
          )}
          <User className="w-4 h-4 text-gray-400" />
        </button>

        {showClientSearch && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre o NIT..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() =>
                  onSelectReceptor({
                    nit: '',
                    name: 'Consumidor Final',
                    nrc: '',
                    nombreComercial: '',
                    actividadEconomica: '',
                    descActividad: '',
                    departamento: '',
                    municipio: '',
                    direccion: '',
                    email: '',
                    telefono: '',
                    timestamp: Date.now(),
                  })
                }
                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100"
              >
                <p className="text-sm font-medium text-gray-800 truncate">Consumidor Final</p>
                <p className="text-xs text-gray-400">Sin documento</p>
              </button>
              {filteredClients.length === 0 ? (
                <p className="p-3 text-sm text-gray-400 text-center">Sin resultados</p>
              ) : (
                filteredClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => onSelectReceptor(client)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{client.name}</p>
                    <p className="text-xs text-gray-400">NIT: {client.nit}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
