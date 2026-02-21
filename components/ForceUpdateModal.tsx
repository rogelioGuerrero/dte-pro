import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ForceUpdateModalProps {
  isOpen: boolean;
  minVersion: string;
  message?: string;
  onReload: () => void;
}

const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  isOpen,
  minVersion,
  message,
  onReload,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-semibold text-gray-900 text-lg">Actualización requerida</h3>
          <p className="text-sm text-gray-600 mt-1">
            Debes actualizar a la versión {minVersion} para continuar.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">{message || 'Recarga la aplicación para obtener la última versión.'}</p>
          </div>

          <button
            onClick={onReload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar ahora
          </button>

          <p className="text-xs text-gray-500 text-center">
            Si no se actualiza, cierra completamente la app y vuelve a abrirla.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForceUpdateModal;
