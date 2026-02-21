import React, { useState, useMemo, useEffect } from 'react';
import { X, Download, Calendar, CheckSquare, Square, FileText, DollarSign, Eye, ArrowLeft } from 'lucide-react';
import { GroupedData, FieldConfiguration } from '../types';
import { generateHeaderRow } from '../utils/fieldMapping';

interface DownloadModalProps {
  isOpen: boolean;
  groupedData: GroupedData;
  fieldConfig: FieldConfiguration;
  onClose: () => void;
  onDownload: (selectedMonths: string[]) => void | Promise<void>;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, groupedData, fieldConfig, onClose, onDownload }) => {
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  // Get sorted months
  const months = useMemo(() => Object.keys(groupedData).sort(), [groupedData]);

  // Initialize selection when opening
  useEffect(() => {
    if (isOpen) {
      // Default to selecting all
      setSelectedMonths(new Set(months));
      setShowPreview(false);
    }
  }, [isOpen, months]);

  const toggleMonth = (month: string) => {
    const newSet = new Set(selectedMonths);
    if (newSet.has(month)) {
      newSet.delete(month);
    } else {
      newSet.add(month);
    }
    setSelectedMonths(newSet);
  };

  const toggleAll = () => {
    if (selectedMonths.size === months.length) {
      setSelectedMonths(new Set());
    } else {
      setSelectedMonths(new Set(months));
    }
  };

  const handleDownload = () => {
    onDownload(Array.from(selectedMonths));
  };

  // Stats for selection
  const stats = useMemo(() => {
    let files = 0;
    let amount = 0;
    selectedMonths.forEach(m => {
      if (groupedData[m]) {
        files += groupedData[m].length;
        amount += groupedData[m].reduce((sum, f) => sum + parseFloat(f.data.total), 0);
      }
    });
    return { files, amount };
  }, [selectedMonths, groupedData]);

  // Generate Preview Content
  const previewContent = useMemo(() => {
    if (!showPreview) return '';

    const header = generateHeaderRow(fieldConfig);
    let lines = '';
    let count = 0;
    const maxPreview = 50;

    const sortedSelected: string[] = (Array.from(selectedMonths) as string[]).sort();

    for (const month of sortedSelected) {
      const files = groupedData[month] || [];
      for (const file of files) {
        lines += file.csvLine;
        count++;
        if (count >= maxPreview) break;
      }
      if (count >= maxPreview) break;
    }

    const footer = count >= maxPreview ? `\n... (Vista previa truncada a los primeros ${maxPreview} registros de ${stats.files})` : '';
    return header + lines + footer;
  }, [showPreview, selectedMonths, groupedData, fieldConfig, stats.files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${showPreview ? 'max-w-4xl' : 'max-w-2xl'} flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-all`}>
        
        {/* Header */}
        <div className="bg-white px-6 py-5 flex justify-between items-center shrink-0 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            {showPreview && (
                <button 
                   onClick={() => setShowPreview(false)}
                   className="text-gray-400 hover:text-gray-700 mr-2 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            )}
            <div>
                <h3 className="font-bold text-xl text-gray-800">
                    {showPreview ? 'Vista previa del reporte' : 'Reporte consolidado'}
                </h3>
                <p className="text-gray-500 text-sm">
                    {showPreview 
                      ? 'Previsualización del archivo: encabezado + primeros 50 registros (no es el archivo completo).'
                      : 'Selecciona los meses que quieres incluir en el reporte consolidado (uso interno, no fiscal).'}
                </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!showPreview ? (
          /* --- SELECTION VIEW --- */
          <>
            {/* Toolbar */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <button 
                onClick={toggleAll}
                className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
              >
                {selectedMonths.size === months.length ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
                <span>Seleccionar Todo</span>
              </button>
              <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-md">
                {selectedMonths.size} meses seleccionados
              </span>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-6 max-h-[50vh]">
              <div className="grid grid-cols-1 gap-3">
                {months.map(month => {
                  const isSelected = selectedMonths.has(month);
                  const monthData = groupedData[month];
                  const total = monthData.reduce((acc, curr) => acc + parseFloat(curr.data.total), 0);

                  return (
                    <div 
                      key={month}
                      onClick={() => toggleMonth(month)}
                      className={`
                        flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all
                        ${isSelected 
                          ? 'bg-indigo-50 border-indigo-300 shadow-sm' 
                          : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`
                            p-2 rounded-lg transition-colors
                            ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-400'}
                        `}>
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className={`font-bold text-lg ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                Mes: {month}
                            </h4>
                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                                <span className="flex items-center">
                                    <FileText className="w-3 h-3 mr-1" /> {monthData.length} Docs
                                </span>
                            </div>
                        </div>
                      </div>

                      <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Total</p>
                          <p className={`font-mono font-bold ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>
                              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
            /* --- PREVIEW VIEW --- */
            <div className="flex-grow overflow-hidden flex flex-col bg-gray-50">
                <div className="flex-grow overflow-auto p-4">
                    <div className="relative">
                         <pre className="font-mono text-xs leading-relaxed p-4 bg-white border border-gray-200 rounded-xl shadow-inner text-gray-700 whitespace-pre overflow-x-auto">
                            {previewContent}
                         </pre>
                         <div className="absolute top-2 right-2 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded uppercase">
                             CSV RAW
                         </div>
                    </div>
                </div>
                <div className="bg-yellow-50 border-t border-yellow-100 px-6 py-2">
                    <p className="text-xs text-yellow-700 flex items-center">
                        <span className="font-bold mr-1">Nota:</span> Esta es solo una vista previa. El archivo descargado contendrá todos los registros seleccionados.
                    </p>
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center shrink-0">
          <div className="hidden sm:block">
             <p className="text-xs text-gray-400 uppercase">Resumen de selección</p>
             <div className="flex items-center space-x-4">
                <span className="font-bold text-gray-800 flex items-center">
                    <FileText className="w-4 h-4 mr-1 text-gray-400" />
                    {stats.files} Archivos
                </span>
                <span className="font-bold text-indigo-600 flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {stats.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
             </div>
          </div>
          
          <div className="flex space-x-3 w-full sm:w-auto justify-end">
            {!showPreview && (
                <button
                    onClick={() => setShowPreview(true)}
                    disabled={selectedMonths.size === 0}
                    className="flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 px-4 py-3 rounded-xl font-medium transition-all"
                >
                    <Eye className="w-5 h-5" />
                    <span className="hidden sm:inline">Vista Previa</span>
                </button>
            )}

            <button 
                onClick={handleDownload}
                disabled={selectedMonths.size === 0}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium shadow-lg transition-all hover:-translate-y-0.5"
            >
                <Download className="w-5 h-5" />
                <span>Descargar CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;