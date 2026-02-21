import React, { useState, useEffect } from 'react';
import DropZone from './DropZone';
import Stats from './Stats';
import FileList from './FileList';
import FieldManager from './FieldManager';
import DownloadModal from './DownloadModal';
import History from './History';
import { processJsonContent, downloadCSV } from '../utils/processor';
import { VENTAS_CONFIG, COMPRAS_CONFIG } from '../utils/fieldMapping';
import { addHistoryEntry, computeSHA256 } from '../utils/historyDb';
import { consumeExportSlot, getUsageInfo } from '../utils/usageLimit';
import { getAllLibrosData, saveLibroData, clearAllLibrosData } from '../utils/libroLegalDb';
import { loadSettings } from '../utils/settings';
import { GroupedData, ProcessedFile, FieldConfiguration, AppMode } from '../types';
import LibroLegalViewer, { TipoLibro } from './libros/LibroLegalViewer';
import { RefreshCw, Search, Download, Settings2, ShoppingCart, FileSpreadsheet, BookOpen, Table, AlertTriangle } from 'lucide-react';
import { ingestDteBatch } from '../utils/agents/batchIngestion';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

import { notify } from '../utils/notifications';

const BatchDashboard: React.FC = () => {
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [errors, setErrors] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  
  // Vista actual: 'csv', 'libro_compras', 'libro_contribuyentes', 'libro_consumidor'
  const [currentView, setCurrentView] = useState<string>('csv');

  // Application Mode: 'ventas' or 'compras'
  const [appMode, setAppMode] = useState<AppMode>('ventas');

  // Load config based on mode
  const [fieldConfig, setFieldConfig] = useState<FieldConfiguration>([]);

  const MAX_EXPORTS_PER_DAY = 5;
  const [usageInfo, setUsageInfo] = useState({ count: 0, remaining: MAX_EXPORTS_PER_DAY, max: MAX_EXPORTS_PER_DAY, hasLicense: false });

  // Load usage info
  useEffect(() => {
    const loadUsageInfo = async () => {
      const info = await getUsageInfo();
      setUsageInfo(info);
    };
    loadUsageInfo();
  }, []);

  // Initialize or switch config when mode changes
  useEffect(() => {
    const storageKey = `dte_field_config_${appMode}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      setFieldConfig(JSON.parse(saved));
    } else {
      // Load default based on mode
      setFieldConfig(appMode === 'ventas' ? VENTAS_CONFIG : COMPRAS_CONFIG);
    }
    
    // Reset view when switching modes
    setCurrentView('csv');
  }, [appMode]);

  // Load saved data from IndexedDB when mode changes
  useEffect(() => {
    const loadSavedData = async () => {
      const savedData = await getAllLibrosData(appMode);
      setGroupedData(savedData);
    };
    loadSavedData();
  }, [appMode]);

  // Refrescar cuando se generen libros automáticamente desde historial DTE
  useEffect(() => {
    const handler = async (evt: any) => {
      const detailMode = evt?.detail?.modo;
      if (detailMode && detailMode !== appMode) return;
      const savedData = await getAllLibrosData(appMode);
      setGroupedData(savedData);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dte-libros-updated', handler as any);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dte-libros-updated', handler as any);
      }
    };
  }, [appMode]);

  // Track daily usage info for the free plan indicator
  useEffect(() => {
    const handler = async () => {
      const info = await getUsageInfo();
      setUsageInfo(info);
    };

    // Inicializar al montar
    handler();

    if (typeof window !== 'undefined') {
      window.addEventListener('dte-usage-updated', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dte-usage-updated', handler);
      }
    };
  }, []);

  // Save config when changed
  useEffect(() => {
    if (fieldConfig.length > 0) {
      const storageKey = `dte_field_config_${appMode}`;
      localStorage.setItem(storageKey, JSON.stringify(fieldConfig));
    }
  }, [fieldConfig, appMode]);

  // Helper to read file as text promise
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });
    
    // Use local vars to accumulate results across batches
    const newGroupedData: GroupedData = { ...groupedData };
    const newErrors: ProcessedFile[] = [...errors];
    const allNewValidFiles: ProcessedFile[] = [];

    // Check if auto-detection is enabled
    const settings = loadSettings();
    const processingMode = settings.useAutoDetection ? 'auto' : appMode;

    // Batch processing configuration
    const BATCH_SIZE = 50; // Process 50 files at a time
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchResults = await Promise.all(batch.map(async (file) => {
            try {
                const content = await readFileAsText(file);
                // Use 'auto' if detection is enabled, otherwise use manual appMode
                return processJsonContent(file.name, content, fieldConfig, processingMode);
            } catch (error) {
                const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                return {
                    id: uniqueId,
                    fileName: file.name,
                    month: 'error',
                    csvLine: '',
                    isValid: false,
                    errorMessage: "Error de lectura",
                    data: { date: '', controlNumber: '', total: '', receiver: '' }
                } as ProcessedFile;
            }
        }));

        // Update state with batch results
        batchResults.forEach(result => {
            if (result.isValid) {
                if (!newGroupedData[result.month]) {
                    newGroupedData[result.month] = [];
                }
                newGroupedData[result.month].push(result);
                allNewValidFiles.push(result);
            } else {
                newErrors.push(result);
            }
        });

        // Update Progress
        setProgress({ current: Math.min(i + BATCH_SIZE, files.length), total: files.length });
        
        // Small delay to allow UI to render the progress bar update
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // --- AGENTE FISCAL: Ingestión Automática ---
    if (allNewValidFiles.length > 0) {
      notify('Analizando impacto fiscal...', 'info');
      
      const filesForAgent = allNewValidFiles
        .filter(f => f.originalDte) // Ensure DTE data is available
        .map(f => ({
          dte: f.originalDte!,
          mode: f.detectedMode || appMode
        }));

      const agentResult = await ingestDteBatch(filesForAgent);
      
      if (agentResult.successful > 0) {
         notify(`Libros Fiscales: ${agentResult.successful} documentos conciliados.`, 'success');
      }
      if (agentResult.failed > 0) {
         console.warn("Errores en ingestión fiscal:", agentResult.errors);
      }
    }
    // -------------------------------------------

    setGroupedData(newGroupedData);
    setErrors(newErrors);
    setIsProcessing(false);

    if (newErrors.length > 0) {
      notify(`Procesado: ${files.length - newErrors.length} exitosos, ${newErrors.length} errores`, 'error');
    } else {
      notify('Todos los archivos se procesaron correctamente', 'success');
    }

    // Guardar en IndexedDB para persistencia
    Object.entries(newGroupedData).forEach(async ([month, files]) => {
      if (files.length > 0) {
        const monthData: GroupedData = { [month]: files };
        await saveLibroData(appMode, month, monthData);
      }
    });
  };

  const handleReorder = (month: string, newOrder: ProcessedFile[]) => {
    setGroupedData(prev => ({
      ...prev,
      [month]: newOrder
    }));
  };
  
  const handleRemoveFiles = (idsToRemove: string[]) => {
      const idSet = new Set(idsToRemove);
      const newData = { ...groupedData };
      
      Object.keys(newData).forEach(month => {
          newData[month] = newData[month].filter(file => !idSet.has(file.id));
          // Clean up empty months
          if (newData[month].length === 0) {
              delete newData[month];
          }
      });
      
      setGroupedData(newData);
  };

  const handleReset = async () => {
    setGroupedData({});
    setErrors([]);
    setSearchTerm('');
    await clearAllLibrosData();
  };

  const handleBatchDownload = async (selectedMonths: string[]) => {
    const slot = await consumeExportSlot();
    if (!slot.allowed) {
      notify(slot.message || 'No se puede exportar. Límite alcanzado.', 'error');
      setShowDownloadModal(false);
      return;
    }

    let allLines = "";
    let exportTotalAmount = 0;
    let exportFileCount = 0;

    const sortedMonths = [...selectedMonths].sort();

    sortedMonths.forEach(month => {
      const files = groupedData[month];
      if (files && files.length > 0) {
        files.forEach(f => {
          allLines += f.csvLine;
          exportTotalAmount += parseFloat(f.data.total);
        });
        exportFileCount += files.length;
      }
    });

    if (!allLines) {
      setShowDownloadModal(false);
      return;
    }

    const prefix = appMode === 'ventas' ? 'VENTAS' : 'COMPRAS';
    const label = selectedMonths.length === Object.keys(groupedData).length ? 'CONSOLIDADO' : 'PARCIAL';
    const fileName = `REPORTE_INTERNO_${prefix}_${label}.csv`;

    const hash = await computeSHA256(allLines);
    await addHistoryEntry({
      timestamp: Date.now(),
      mode: appMode,
      fileName,
      totalAmount: exportTotalAmount,
      fileCount: exportFileCount,
      hash,
    });

    downloadCSV(allLines, fileName);

    setShowDownloadModal(false);
  };

  // Filter data based on mode in auto-detection (empresa mode)
  const settings = loadSettings();
  const isEmpresaMode = settings.useAutoDetection;
  
  const filteredGroupedData: GroupedData = isEmpresaMode 
    ? Object.entries(groupedData).reduce((acc, [month, files]) => {
        const filtered = files.filter(file => file.detectedMode === appMode);
        if (filtered.length > 0) {
          acc[month] = filtered;
        }
        return acc;
      }, {} as GroupedData)
    : groupedData;

  // Detección de Múltiples Contribuyentes (Seguridad)
  const mixedTaxpayerWarnings = React.useMemo(() => {
    const warnings: { month: string; count: number; nits: string[] }[] = [];
    
    Object.entries(filteredGroupedData).forEach(([month, files]) => {
      // Filtrar NITS únicos del "Dueño" del libro (Emisor en Ventas, Receptor en Compras)
      const uniqueNits = new Set<string>();
      
      files.forEach(file => {
        if (file.isValid && file.taxpayer?.nit) {
          // Normalizar NIT para comparación (quitar guiones)
          const cleanNit = file.taxpayer.nit.replace(/[-\s]/g, '');
          if (cleanNit) uniqueNits.add(cleanNit);
        }
      });

      if (uniqueNits.size > 1) {
        warnings.push({
          month,
          count: uniqueNits.size,
          nits: Array.from(uniqueNits)
        });
      }
    });
    
    return warnings;
  }, [filteredGroupedData]);

  const getNombreMes = (monthKey: string) => {
    try {
      const parts = monthKey.split('-');
      if (parts.length >= 2) {
        const monthIndex = parseInt(parts[1], 10) - 1;
        return MESES[monthIndex] || monthKey;
      }
      return monthKey;
    } catch {
      return monthKey;
    }
  };

  // Calculate stats using filtered data
  const filesValues = Object.values(filteredGroupedData) as ProcessedFile[][];
  const validFilesCount = filesValues.reduce((acc, files) => acc + files.length, 0);
  const totalFiles = validFilesCount + errors.length;
  const allFiles = filesValues.flat();

  // En compras, el monto total procesado debe sumar solo los archivos dentro del período válido
  const filesForTotals = appMode === 'compras'
    ? allFiles.filter(file => !file.isOutOfTime)
    : allFiles;

  const totalAmount = filesForTotals.reduce((acc, file) => acc + parseFloat(file.data.total), 0);
  const totalNeto = filesForTotals.reduce((acc, file) => acc + parseFloat(file.data.neto || '0'), 0);
  const totalIva = filesForTotals.reduce((acc, file) => acc + parseFloat(file.data.iva || '0'), 0);
  const totalExentas = filesForTotals.reduce((acc, file) => acc + parseFloat(file.data.exentas || '0'), 0);

  return (
    <>
      <div className={`fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${appMode === 'ventas' ? 'from-indigo-100/50' : 'from-emerald-100/50'} via-gray-50 to-white transition-colors duration-700`}></div>
      
      {/* Sub-Header for Batch Controls */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-gray-100 py-3 px-4 sm:px-6 lg:px-8 mb-6 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
             {/* Mode Switcher */}
            <div className="bg-gray-100 p-1 rounded-lg flex items-center">
             <button 
               onClick={() => setAppMode('ventas')}
               className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'ventas' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <FileSpreadsheet className="w-4 h-4" />
               <span>Ventas</span>
             </button>
             <button 
               onClick={() => setAppMode('compras')}
               className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'compras' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <ShoppingCart className="w-4 h-4" />
               <span>Compras</span>
             </button>
            </div>

            <div className="flex items-center space-x-3">
             {/* Toggle Vista CSV / Libro Legal */}
             {totalFiles > 0 && (
               <div className="bg-gray-100 p-1 rounded-lg flex items-center mr-2">
                 <button 
                   onClick={() => setCurrentView('csv')}
                   className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'csv' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                   title="Vista de lista de archivos"
                 >
                   <Table className="w-4 h-4" />
                   <span className="hidden sm:inline">Lista</span>
                 </button>
                 
                 {appMode === 'compras' ? (
                   <button 
                     onClick={() => setCurrentView('libro_compras')}
                     className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'libro_compras' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     title="Libro de Compras"
                   >
                     <BookOpen className="w-4 h-4" />
                     <span className="hidden sm:inline">Libro Compras</span>
                   </button>
                 ) : (
                   <>
                    <button 
                       onClick={() => setCurrentView('libro_contribuyentes')}
                       className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'libro_contribuyentes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                       title="Libro de Ventas a Contribuyentes"
                     >
                       <BookOpen className="w-4 h-4" />
                       <span className="hidden sm:inline">Contribuyentes</span>
                     </button>
                     <button 
                       onClick={() => setCurrentView('libro_consumidor')}
                       className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'libro_consumidor' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                       title="Libro de Ventas a Consumidor Final"
                     >
                       <BookOpen className="w-4 h-4" />
                       <span className="hidden sm:inline">Consumidor</span>
                     </button>
                   </>
                 )}
               </div>
             )}

             <button 
               onClick={() => setShowFieldManager(true)}
               className={`text-gray-500 px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition-all border border-transparent ${appMode === 'ventas' ? 'hover:text-indigo-600 hover:bg-indigo-50' : 'hover:text-emerald-600 hover:bg-emerald-50'}`}
             >
               <Settings2 className="w-4 h-4" />
               <span className="hidden sm:inline">Campos</span>
             </button>

             {totalFiles > 0 && (
               <>
                <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>
                <div className="hidden md:flex relative">
                   <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                   <input 
                      type="text" 
                      placeholder={appMode === 'ventas' ? "Buscar cliente..." : "Buscar proveedor..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white outline-none transition-all w-64 ${appMode === 'ventas' ? 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200' : 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'}`}
                   />
                </div>
                <button 
                  onClick={handleReset}
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reiniciar</span>
                </button>
               </>
             )}
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
          {totalFiles === 0 ? (
            <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 mt-10">
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                Libro de <span className={appMode === 'ventas' ? 'text-indigo-600' : 'text-emerald-600'}>{appMode === 'ventas' ? 'Ventas' : 'Compras'}</span> a CSV
              </h2>
              <p className="max-w-2xl mx-auto text-lg text-gray-500">
                Selecciona <span className="font-semibold text-gray-700">carpetas sincronizadas</span> o archivos locales de {appMode === 'ventas' ? 'facturas' : 'comprobantes'}.
                <br/>El sistema importará automáticamente el lote completo.
              </p>
              <DropZone onFilesSelected={handleFilesSelected} />
            </div>
          ) : currentView.startsWith('libro') ? (
            /* Vista Libro Legal Dinámica */
            (() => {
              // Determinar tipo de libro y filtro
              let tipoLibro: TipoLibro = 'compras';
              let filteredDataForBook = filteredGroupedData;
              let resumenDataForBook: GroupedData | undefined = undefined;

              if (currentView === 'libro_contribuyentes') {
                tipoLibro = 'contribuyentes';
                // Filtrar solo CCF (03)
                filteredDataForBook = Object.entries(filteredGroupedData).reduce((acc, [month, files]) => {
                  const filtered = files.filter(f => f.dteType === '03');
                  if (filtered.length > 0) acc[month] = filtered;
                  return acc;
                }, {} as GroupedData);
                // Para el resumen, necesitamos también los documentos de consumidor (01)
                resumenDataForBook = filteredGroupedData;
              } else if (currentView === 'libro_consumidor') {
                tipoLibro = 'consumidor';
                // Filtrar solo Facturas (01)
                filteredDataForBook = Object.entries(filteredGroupedData).reduce((acc, [month, files]) => {
                  const filtered = files.filter(f => f.dteType === '01');
                  if (filtered.length > 0) acc[month] = filtered;
                  return acc;
                }, {} as GroupedData);
              } else {
                tipoLibro = 'compras';
                // Para compras tomamos todo lo que esté en modo compras
              }

              return (
                <LibroLegalViewer
                  groupedData={filteredDataForBook}
                  groupedDataForResumen={resumenDataForBook}
                  tipoLibro={tipoLibro}
                />
              );
            })()
          ) : (
            <div className="animate-in fade-in duration-500 space-y-8">
              
              {/* Alerta de Seguridad: Múltiples Contribuyentes */}
              {mixedTaxpayerWarnings.length > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm animate-in slide-in-from-top-2">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-amber-800">
                        Advertencia de Seguridad: Múltiples Contribuyentes Detectados
                      </h3>
                      <div className="mt-2 text-sm text-amber-700">
                        <p className="mb-2">
                          Se han detectado documentos pertenecientes a diferentes contribuyentes (NITs) dentro del mismo mes. 
                          Esto podría indicar que has mezclado archivos de diferentes clientes por error.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          {mixedTaxpayerWarnings.map((w, idx) => (
                            <li key={idx}>
                              <span className="font-semibold">
                                {getNombreMes(w.month)} {w.month.split('-')[0]}:
                              </span>{' '}
                              Se encontraron <span className="font-bold">{w.count}</span> NITs distintos.
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900">Dashboard de {appMode === 'ventas' ? 'Ventas' : 'Compras'}</h2>
                    <p className="text-gray-500 text-sm">Validación y cálculo completado. Para declarar ante Hacienda usa el CSV mensual de cada periodo.</p>
                 </div>
                 <div className="flex flex-col items-stretch md:items-end gap-2">
                   <button 
                      onClick={() => setShowDownloadModal(true)}
                      title="Genera un reporte consolidado en CSV para análisis y control interno (no usar para declaración mensual)."
                      className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
                   >
                      <Download className="w-5 h-5" />
                      <span>Reporte consolidado</span>
                   </button>
                   <div className="relative group inline-flex items-center">
                     <span className="text-[11px] text-gray-400 border border-dashed border-gray-300 rounded-full px-2 py-0.5 cursor-default">
                       {usageInfo.hasLicense ? 'Licencia activa' : `Plan gratuito: ${Math.min(usageInfo.count, usageInfo.max)}/${usageInfo.max} exportaciones hoy`}
                     </span>
                     <div className="absolute z-10 hidden group-hover:block -top-14 right-0 w-64 px-3 py-2 rounded-lg bg-gray-900 text-[11px] text-gray-100 shadow-xl">
                       {usageInfo.hasLicense 
                         ? 'Tu licencia está activa. Puedes exportar sin límites según tu plan.'
                         : 'Las exportaciones se cuentan por día calendario. Este límite aplica solo como demostración del servicio.'
                       }
                     </div>
                   </div>
                 </div>
              </div>

              <Stats 
                totalFiles={totalFiles}
                successCount={validFilesCount}
                errorCount={errors.length}
                totalAmount={totalAmount}
                totalNeto={totalNeto}
                totalIva={totalIva}
                totalExentas={totalExentas}
              />
              
              <FileList 
                groupedData={filteredGroupedData} 
                errors={errors} 
                searchTerm={searchTerm} 
                onReorder={handleReorder}
                onRemoveFiles={handleRemoveFiles}
                appMode={appMode}
              />
            </div>
          )}

          <History />

          {/* Progress Overlay */}
          {isProcessing && (
             <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
               <div className="flex flex-col items-center bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full">
                 <div className="w-full flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <span>Procesando</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${appMode === 'ventas' ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                 </div>
                 <p className="text-gray-600 text-sm">
                    Analizando {progress.current} de {progress.total} archivos...
                 </p>
               </div>
             </div>
          )}

          {/* Field Manager Modal */}
          {showFieldManager && (
            <FieldManager 
              config={fieldConfig} 
              onConfigChange={setFieldConfig} 
              onClose={() => setShowFieldManager(false)} 
            />
          )}

          {/* Download Manager Modal */}
          <DownloadModal 
            isOpen={showDownloadModal}
            groupedData={groupedData}
            fieldConfig={fieldConfig}
            onClose={() => setShowDownloadModal(false)}
            onDownload={handleBatchDownload}
          />

      </div>
    </>
  );
};

export default BatchDashboard;
