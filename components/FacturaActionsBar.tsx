import React from 'react';
import { FileText, Loader2, Plus } from 'lucide-react';
import type { EmisorData } from '../utils/emisorDb';
import type { ClientData } from '../utils/clientDb';
import type { DTEJSON } from '../utils/dteGenerator';

interface FacturaActionsBarProps {
  stockError: string;
  isGenerating: boolean;
  emisor: EmisorData | null;
  selectedReceptor: ClientData | null;
  generatedDTE: DTEJSON | null;
  onGenerateDTE: () => void;
  onNuevaFactura: () => void;
}

export const FacturaActionsBar: React.FC<FacturaActionsBarProps> = ({
  stockError,
  isGenerating,
  emisor,
  selectedReceptor,
  generatedDTE,
  onGenerateDTE,
  onNuevaFactura,
}) => {
  return (
    <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
      {stockError && (
        <div className="mr-auto text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {stockError}
        </div>
      )}
      <button
        onClick={onGenerateDTE}
        disabled={isGenerating || !emisor || !selectedReceptor || !!stockError}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {generatedDTE ? 'Actualizar DTE' : 'Generar DTE'}
      </button>
      <button
        onClick={onNuevaFactura}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nueva Factura
      </button>
    </div>
  );
};
