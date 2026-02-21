import React from 'react';
import { Settings } from 'lucide-react';
import Tooltip from './Tooltip';

interface FacturaHeaderProps {
  emisor: any;
  onOpenEmisorConfig: () => void;
}

export const FacturaHeader: React.FC<FacturaHeaderProps> = ({ emisor, onOpenEmisorConfig }) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Generar Factura DTE</h2>
        <p className="text-sm text-gray-500">Crea documentos tributarios electrónicos</p>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip
          content={emisor ? 'Datos del emisor configurados' : 'Configura los datos del emisor'}
          position="bottom"
        >
          <button
            onClick={onOpenEmisorConfig}
            className={`p-2 rounded-lg transition-colors ${
              emisor 
                ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
