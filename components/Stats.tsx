import React from 'react';
import { FileCheck, FileWarning, DollarSign } from 'lucide-react';

interface StatsProps {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalAmount: number;
  totalNeto: number;
  totalIva: number;
  totalExentas: number;
}

const Stats: React.FC<StatsProps> = ({ totalFiles, successCount, errorCount, totalAmount, totalNeto, totalIva }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto mt-8">
      
      {/* Card: Total Amount */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 transform transition-all hover:-translate-y-1">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <p className="text-indigo-100 font-medium text-sm mb-2">Monto Total Procesado</p>
            <h3 className="text-3xl font-bold tracking-tight mb-3">
              ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-200 font-medium">Neto:</span>
                <span className="font-semibold">${totalNeto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-200 font-medium">IVA:</span>
                <span className="font-semibold">${totalIva.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Card: Success */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
             <p className="text-gray-500 font-medium text-sm mb-1">Documentos Válidos</p>
             <div className="flex items-baseline space-x-2">
                <h3 className="text-3xl font-bold text-gray-800">{successCount}</h3>
                <span className="text-sm text-gray-400">de {totalFiles} archivos</span>
             </div>
          </div>
          <div className="bg-green-50 p-2 rounded-lg">
            <FileCheck className="w-6 h-6 text-green-600" />
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4">
          <div 
            className="bg-green-500 h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${totalFiles > 0 ? (successCount / totalFiles) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Card: Errors */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
             <p className="text-gray-500 font-medium text-sm mb-1">Archivos con Error</p>
             <h3 className={`text-3xl font-bold ${errorCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
               {errorCount}
             </h3>
          </div>
          <div className={`p-2 rounded-lg ${errorCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <FileWarning className={`w-6 h-6 ${errorCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
        </div>
        {errorCount > 0 ? (
           <p className="text-xs text-red-500 mt-4 font-medium">Revisar lista de errores abajo</p>
        ) : (
           <p className="text-xs text-green-600 mt-4 font-medium">Todo se ve bien</p>
        )}
      </div>

    </div>
  );
};

export default Stats;