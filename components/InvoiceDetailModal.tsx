import React from 'react';
import { X, FileText, Calendar, Hash, User } from 'lucide-react';
import { ProcessedFile } from '../types';

interface InvoiceDetailModalProps {
  file: ProcessedFile | null;
  onClose: () => void;
}

const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ file, onClose }) => {
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center space-x-2 text-gray-800">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 truncate max-w-[300px]" title={file.fileName}>
              {file.fileName}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Main Amount */}
          <div className="text-center py-2 border-b border-gray-100">
             <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Monto Total</p>
             <div className="text-4xl font-bold text-gray-900 flex justify-center items-start">
               <span className="text-xl mt-1 mr-1">$</span>
               {file.data.total}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className="flex items-center space-x-2 text-gray-500 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Fecha</span>
              </div>
              <p className="font-semibold text-gray-900">{file.data.date}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className="flex items-center space-x-2 text-gray-500 mb-1">
                <Hash className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Control</span>
              </div>
              <p className="font-mono font-semibold text-gray-900">{file.data.controlNumber}</p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center space-x-2 text-blue-500 mb-2">
              <User className="w-4 h-4" />
              {/* The logic for 'receiver' field in 'file.data' is handled by the processor 
                  to contain the relevant counterparty (Client for Sales, Provider for Purchases) */}
              <span className="text-xs font-bold uppercase tracking-wide">Contraparte (Cliente/Proveedor)</span>
            </div>
            <p className="font-medium text-blue-900 text-lg">{file.data.receiver}</p>
          </div>

          {/* CSV Line Preview */}
          <div className="space-y-2">
             <p className="text-xs font-medium text-gray-400 uppercase">Línea CSV Generada</p>
             <div className="bg-gray-50 text-gray-900 border border-gray-200 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-nowrap shadow-inner">
               {file.csvLine.trim()}
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
          <button 
            onClick={onClose}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;