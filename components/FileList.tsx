import React, { useState, useMemo } from 'react';

import { GroupedData, ProcessedFile, AppMode } from '../types';



import { Download, FileText, AlertCircle, Calendar, Search, Eye, AlertTriangle, GripVertical, Trash2, CheckSquare, Minimize2 } from 'lucide-react';



import { downloadCSV } from '../utils/processor';

import { consumeExportSlot } from '../utils/usageLimit';

import { addHistoryEntry, computeSHA256 } from '../utils/historyDb';



import InvoiceDetailModal from './InvoiceDetailModal';



import { notify } from '../utils/notifications';



interface FileListProps {

  groupedData: GroupedData;

  errors: ProcessedFile[];

  searchTerm: string;

  onReorder: (month: string, newOrder: ProcessedFile[]) => void;

  onRemoveFiles: (ids: string[]) => void; // New prop for bulk deletion

  appMode: AppMode;

}



const FileList: React.FC<FileListProps> = ({ groupedData, errors, searchTerm, onReorder, onRemoveFiles, appMode }) => {

  const [selectedFile, setSelectedFile] = useState<ProcessedFile | null>(null);

  

  // Selection State

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  

  // Drag State

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  const [activeDragMonth, setActiveDragMonth] = useState<string | null>(null);



  const months = Object.keys(groupedData).sort();



  // Helper for download header

  // const HEADER_ROW = "fecEmi;tipoDte;numeroControl;selloRecibido;codigoGeneracion;;nrc;nombre;totalExenta;totalNoSuj;totalGravada;valor;0.00;0.00;montoTotalOperacion;;1;2;1\n";



  // --- Selection Logic ---



  // Flatten all visible files for global selection

  const allVisibleFiles = useMemo(() => {

     let all: ProcessedFile[] = [];

     months.forEach(m => {

         const monthFiles = groupedData[m];

         if (searchTerm) {

             const term = searchTerm.toLowerCase();

             const filtered = monthFiles.filter(f => 

                f.fileName.toLowerCase().includes(term) ||

                f.data.receiver.toLowerCase().includes(term) ||

                f.data.controlNumber.includes(term) ||

                f.data.total.includes(term)

             );

             all = all.concat(filtered);

         } else {

             all = all.concat(monthFiles);

         }

     });

     return all;

  }, [groupedData, months, searchTerm]);



  const handleSelectAll = () => {

      if (selectedIds.size === allVisibleFiles.length && allVisibleFiles.length > 0) {

          setSelectedIds(new Set()); // Deselect All

      } else {

          const newSet = new Set<string>();

          allVisibleFiles.forEach(f => newSet.add(f.id));

          setSelectedIds(newSet);

      }

  };



  const handleSelectMonth = (month: string) => {

      const filesInMonth = getDisplayFiles(month);

      const idsInMonth = filesInMonth.map(f => f.id);

      const allSelected = idsInMonth.every(id => selectedIds.has(id));

      

      const newSet = new Set(selectedIds);

      if (allSelected) {

          idsInMonth.forEach(id => newSet.delete(id));

      } else {

          idsInMonth.forEach(id => newSet.add(id));

      }

      setSelectedIds(newSet);

  };



  const handleSelectRow = (id: string) => {

      const newSet = new Set(selectedIds);

      if (newSet.has(id)) {

          newSet.delete(id);

      } else {

          newSet.add(id);

      }

      setSelectedIds(newSet);

  };



  const handleDownload = async (month: string) => {

    const slot = await consumeExportSlot();

    if (!slot.allowed) {

      notify(slot.message || 'No se puede exportar. Límite alcanzado.', 'error');

      return;

    }



    const files = groupedData[month];

    if (!files || files.length === 0) return;



    // Separar archivos por tipo de DTE

    const contribuyentesFiles = files.filter(f => f.dteType === '03'); // CCF

    const consumidorFiles = files.filter(f => f.dteType === '01'); // Factura CF

    

    // Generar CSV para contribuyentes si hay archivos

    if (contribuyentesFiles.length > 0) {

      // Usar la misma configuración que Exportar CSV

      const { getConfigLibro } = await import('./libros/librosConfig');

      const config = getConfigLibro('contribuyentes');

      

      if (!config) {
        notify('Error de configuración para contribuyentes', 'error');
        return;
      }
      
      // Procesar archivos como lo hace LibroLegalViewer
      const processedItems = contribuyentesFiles.map((file, index) => {
        const csvParts = file.csvLine.split(';');
        
        // Formatear fecha: DD/MM/YYYY (con ceros)
        const fechaParts = file.data.date.split('/');
        const dia = parseInt(fechaParts[0], 10).toString().padStart(2, '0');
        const mes = parseInt(fechaParts[1], 10).toString().padStart(2, '0');
        const anio = fechaParts[2];
        const fechaFormateada = `${dia}/${mes}/${anio}`;
        
        return {
          correlativo: index + 1,
          fecha: fechaFormateada, // Usar fecha formateada
          codigoGeneracion: csvParts[5] || '', // Columna F: NÚMERO DE DOCUMENTO
          formUnico: '',
          cliente: file.data.receiver,
          nrc: csvParts[7] || '', // Columna H: NIT O NRC
          ventasExentas: parseFloat(csvParts[9] || '0'), // Columna J: VENTAS EXENTAS
          ventasNoSujetas: parseFloat(csvParts[10] || '0'), // Columna K: VENTAS NO SUJETAS
          ventasGravadas: parseFloat(csvParts[11] || '0'), // Columna L: VENTAS GRAVADAS
          debitoFiscal: parseFloat(csvParts[12] || '0'), // Columna M: DÉBITO FISCAL
          ventaCuentaTerceros: 0,
          debitoFiscalTerceros: 0,
          impuestoPercibido: 0,
          ventasTotales: parseFloat(file.data.total),
          dui: csvParts[16] || '', // Columna Q: DUI DEL CLIENTE
          numeroControlDel: file.data.controlNumber, // Para columna D
          selloRecibido: csvParts[4] || '', // Columna E: NÚMERO DE SERIE
        };
      });
      
      const totales = config.calcularTotales(processedItems);
      const contribuyentesContent = config.generarCSV(processedItems, totales);

      

      if (contribuyentesContent) {

        const fileName = `LIBRO_VENTAS_CONTRIBUYENTES_${month}.csv`;

        downloadCSV(contribuyentesContent, fileName);

        

        const totalAmount = contribuyentesFiles.reduce((sum, f) => sum + parseFloat(f.data.total), 0);

        const hash = await computeSHA256(contribuyentesContent);

        await addHistoryEntry({

          timestamp: Date.now(),

          mode: 'ventas',

          fileName,

          totalAmount,

          fileCount: contribuyentesFiles.length,

          hash,

        });

      }

    }

    

    // Generar CSV para consumidor final si hay archivos

    if (consumidorFiles.length > 0) {

      // Usar la misma configuración que Exportar CSV

      const { getConfigLibro } = await import('./libros/librosConfig');

      const config = getConfigLibro('consumidor');

      

      if (!config) {

        notify('Error de configuración para consumidor final', 'error');

        return;

      }

      

      // Procesar archivos como lo hace LibroLegalViewer

      const processedItems = consumidorFiles.map((file) => {
        const csvParts = file.csvLine.split(';');
        
        // Formatear fecha: DD/MM/YYYY (con ceros)
        const fechaParts = file.data.date.split('/');
        const dia = parseInt(fechaParts[0], 10).toString().padStart(2, '0');
        const mes = parseInt(fechaParts[1], 10).toString().padStart(2, '0');
        const anio = fechaParts[2];
        const fechaFormateada = `${dia}/${mes}/${anio}`;
        
        return {
          fecha: fechaFormateada, // Usar fecha formateada
          codigoGeneracionInicial: csvParts[5] || csvParts[3] || '',
          codigoGeneracionFinal: csvParts[5] || csvParts[3] || '',
          numeroControlDel: file.data.controlNumber,
          numeroControlAl: file.data.controlNumber,
          selloRecibido: csvParts[4] || '', // Columna E: NÚMERO DE SERIE
          ventasExentas: parseFloat(csvParts[9] || '0'),
          ventasInternasExentas: parseFloat(csvParts[10] || '0'), // Columna L
          ventasNoSujetas: parseFloat(csvParts[11] || '0'), // Columna M
          ventasGravadas: parseFloat(csvParts[12] || '0'), // Columna N
          exportacionesCentroAmerica: 0, // Columna O
          exportacionesFueraCentroAmerica: 0, // Columna P
          exportacionesServicios: 0, // Columna Q
          ventasZonasFrancas: 0, // Columna R
          ventasCuentaTerceros: 0, // Columna S
          ventaTotal: parseFloat(file.data.total),
        };
      });

      

      const totales = config.calcularTotales(processedItems);

      const consumidorContent = config.generarCSV(processedItems, totales);

      

      if (consumidorContent) {

        const fileName = `LIBRO_CONSUMIDOR_FINAL_${month}.csv`;

        downloadCSV(consumidorContent, fileName);

        

        const totalAmount = consumidorFiles.reduce((sum, f) => sum + parseFloat(f.data.total), 0);

        const hash = await computeSHA256(consumidorContent);

        await addHistoryEntry({

          timestamp: Date.now(),

          mode: 'ventas',

          fileName,

          totalAmount,

          fileCount: consumidorFiles.length,

          hash,

        });

      }

    }

    

    if (contribuyentesFiles.length === 0 && consumidorFiles.length === 0) {

      notify('No hay archivos para exportar', 'info');

      return;

    }

    

    const totalFiles = contribuyentesFiles.length + consumidorFiles.length;

    notify(`Se exportaron ${totalFiles} archivos (${contribuyentesFiles.length} contribuyentes, ${consumidorFiles.length} consumidor final)`, 'success');

  };



  const handleBulkDownload = async () => {

      const slot = await consumeExportSlot();

      if (!slot.allowed) {

        notify(slot.message || 'No se puede exportar. Límite alcanzado.', 'error');

        return;

      }



      const selectedFiles = allVisibleFiles.filter(f => selectedIds.has(f.id));

      if (selectedFiles.length === 0) return;

      

      const content = selectedFiles.map(f => f.csvLine).join('');

      downloadCSV(content, `seleccionados_export.csv`);

  };



  const handleBulkDelete = () => {

      if (window.confirm(`¿Eliminar ${selectedIds.size} archivos seleccionados?`)) {

          onRemoveFiles(Array.from(selectedIds));

          setSelectedIds(new Set());

      }

  };



  // --- Drag Logic ---

  const handleDragStart = (e: React.DragEvent, index: number, month: string) => {

    setDraggedItemIndex(index);

    setActiveDragMonth(month);

    e.dataTransfer.effectAllowed = 'move';

  };



  const handleDragOver = (e: React.DragEvent, index: number, month: string) => {

    e.preventDefault();

    if (activeDragMonth !== month) return;

    setDragOverItemIndex(index);

  };



  const handleDrop = (e: React.DragEvent, month: string) => {

    e.preventDefault();

    if (activeDragMonth !== month || draggedItemIndex === null || dragOverItemIndex === null) {

       resetDragState();

       return;

    }

    const files = [...groupedData[month]];

    const draggedItem = files[draggedItemIndex];

    files.splice(draggedItemIndex, 1);

    files.splice(dragOverItemIndex, 0, draggedItem);

    onReorder(month, files);

    resetDragState();

  };



  const resetDragState = () => {

    setDraggedItemIndex(null);

    setDragOverItemIndex(null);

    setActiveDragMonth(null);

  };



  const isSearching = searchTerm.length > 0;



  const getDisplayFiles = (month: string) => {

    const files = groupedData[month];

    if (!isSearching) return files;

    const term = searchTerm.toLowerCase();

    return files.filter(file => 

        file.fileName.toLowerCase().includes(term) ||

        file.data.receiver.toLowerCase().includes(term) ||

        file.data.controlNumber.includes(term) ||

        file.data.total.includes(term)

    );

  };



  // Compute Global Checkbox State

  const isAllSelected = allVisibleFiles.length > 0 && selectedIds.size === allVisibleFiles.length;

  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < allVisibleFiles.length;



  if (months.length === 0 && errors.length === 0) {

    if (searchTerm) {

        return (

            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 mt-8">

                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />

                <p className="text-gray-500">No se encontraron facturas que coincidan con "{searchTerm}"</p>

            </div>

        )

    }

    return null;

  }



  return (

    <div className="w-full max-w-6xl mx-auto mt-8 pb-24 space-y-8 relative">

      

      {/* Global Select All Bar (Only visible if items exist) */}

      {allVisibleFiles.length > 0 && (

          <div className="flex items-center space-x-3 px-6 mb-2">

              <div className="relative flex items-center">

                  <input 

                    type="checkbox"

                    checked={isAllSelected}

                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}

                    onChange={handleSelectAll}

                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"

                  />

              </div>

              <span className="text-sm font-medium text-gray-600 cursor-pointer" onClick={handleSelectAll}>

                Seleccionar Todo ({allVisibleFiles.length} archivos)

              </span>

          </div>

      )}



      {/* Section for Valid Files */}

      {months.map(month => {

        const filesToDisplay = getDisplayFiles(month);

        if (filesToDisplay.length === 0) return null;



        const totalMonthAmount = filesToDisplay.reduce((sum, f) => sum + parseFloat(f.data.total), 0);

        const totalMonthNeto = filesToDisplay.reduce((sum, f) => sum + parseFloat(f.data.neto || '0'), 0);

        const totalMonthIva = filesToDisplay.reduce((sum, f) => sum + parseFloat(f.data.iva || '0'), 0);

        

        // Month Selection State

        const idsInMonth = filesToDisplay.map(f => f.id);

        const isMonthAllSelected = idsInMonth.length > 0 && idsInMonth.every(id => selectedIds.has(id));

        const isMonthIndeterminate = idsInMonth.some(id => selectedIds.has(id)) && !isMonthAllSelected;



        return (

          <div key={month} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">

            <div className="bg-gray-50/50 px-6 py-4 flex flex-wrap gap-4 justify-between items-center border-b border-gray-100">

              

              <div className="flex items-center space-x-3">

                {/* Month Checkbox */}

                <input 

                    type="checkbox"

                    checked={isMonthAllSelected}

                    ref={input => { if (input) input.indeterminate = isMonthIndeterminate; }}

                    onChange={() => handleSelectMonth(month)}

                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer mr-2"

                />

                

                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">

                   <Calendar className="w-5 h-5" />

                </div>

                <div>

                  <h2 className="text-lg font-bold text-gray-800">Mes: {month}</h2>

                  <p className="text-xs text-gray-500">{filesToDisplay.length} documentos procesados</p>

                </div>

              </div>



              <div className="flex items-center space-x-6">

                 <div className="hidden md:block text-right">

                    <p className="text-xs text-gray-400 uppercase font-medium mb-1">Total Mes</p>

                    <p className="font-bold text-gray-800 text-lg">${totalMonthAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>

                    <p className="text-xs text-gray-500 mt-1">

                      Neto: ${totalMonthNeto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • IVA: ${totalMonthIva.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

                    </p>

                 </div>

                 <button

                    onClick={() => handleDownload(month)}

                    title="Descargar CSV de este mes para la declaración del libro."

                    className="flex items-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-indigo-600 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm"

                 >

                    <Download className="w-4 h-4" />

                    <span>CSV Mensual</span>

                 </button>

              </div>

            </div>

            

            <div className="overflow-x-auto">

              <table className="w-full text-sm text-left text-gray-500">

                <thead className="text-xs text-gray-400 uppercase bg-gray-50/30 border-b border-gray-100">

                  <tr>

                    <th className="w-10 px-4 py-3 text-center">

                        {/* Header checkbox handled by Month Header Logic above, leaving blank or specific column title */}

                        <CheckSquare className="w-4 h-4 text-gray-400 mx-auto opacity-50" />

                    </th>

                    {!isSearching && <th className="w-10 px-2 py-3"></th>}

                    <th className="px-6 py-3 font-medium">Fecha</th>

                    <th className="px-6 py-3 font-medium">Receptor</th>

                    <th className="px-6 py-3 font-medium">Control</th>

                    <th className="px-6 py-3 text-right font-medium">Monto</th>

                    <th className="px-6 py-3 font-medium">Archivo</th>

                    <th className="px-6 py-3 text-center font-medium">Acción</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-50">

                  {filesToDisplay.map((file, idx) => {

                    const isSelected = selectedIds.has(file.id);

                    const isOutOfTime = appMode === 'compras' && file.isOutOfTime;

                    return (

                        <tr 

                        key={`${month}-${file.id}`}

                        draggable={!isSearching}

                        onDragStart={(e) => handleDragStart(e, idx, month)}

                        onDragOver={(e) => handleDragOver(e, idx, month)}

                        onDrop={(e) => handleDrop(e, month)}

                        className={`

                            transition-colors group

                            ${isSelected ? 'bg-indigo-50/60' : 'bg-white hover:bg-gray-50'}

                            ${draggedItemIndex === idx && activeDragMonth === month ? 'opacity-50 bg-indigo-100' : ''}

                            ${dragOverItemIndex === idx && activeDragMonth === month ? 'border-t-2 border-indigo-500' : ''}

                            ${isOutOfTime ? 'border-l-4 border-red-500 bg-red-50/30' : ''}

                        `}

                        >

                        <td className="px-4 py-4 text-center">

                            <input 

                                type="checkbox"

                                checked={isSelected}

                                onChange={() => handleSelectRow(file.id)}

                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"

                            />

                        </td>

                        {!isSearching && (

                            <td className="px-2 text-center cursor-grab active:cursor-grabbing">

                            <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 mx-auto" />

                            </td>

                        )}

                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{file.data.date}</td>

                        <td className="px-6 py-4 truncate max-w-[200px] text-gray-600 group-hover:text-indigo-900">{file.data.receiver}</td>

                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{file.data.controlNumber}</td>

                        <td className="px-6 py-4 text-right font-bold text-gray-700">${file.data.total}</td>

                        <td className="px-6 py-4 text-xs text-gray-400 truncate max-w-[150px]" title={file.fileName}>{file.fileName}</td>

                        <td className="px-6 py-4 text-center">

                            {isOutOfTime && (

                                <div className="flex items-center justify-center" title="Fuera del plazo de declaración (más de 3 meses)">

                                    <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />

                                    <span className="text-xs text-red-600 font-medium">Fuera de tiempo</span>

                                </div>

                            )}

                            <button 

                                onClick={() => setSelectedFile(file)}

                                className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-all"

                                title="Ver detalles"

                            >

                                <Eye className="w-4 h-4" />

                            </button>

                        </td>

                        </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          </div>

        );

      })}



      {/* Section for Errors */}

      {errors.length > 0 && (

        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">

           <div className="bg-red-50/80 px-6 py-4 flex items-center justify-between border-b border-red-100">

             <div className="flex items-center space-x-3">

                <div className="bg-white p-1.5 rounded-full">

                    <AlertCircle className="w-5 h-5 text-red-600" />

                </div>

                <div>

                    <h2 className="text-lg font-bold text-red-800">Archivos con Errores</h2>

                    <p className="text-xs text-red-600/80">Estos archivos no se incluyeron en el reporte</p>

                </div>

             </div>

             <span className="bg-white text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-100">

                {errors.length} fallos

             </span>

           </div>

           <ul className="divide-y divide-red-50">

             {errors.map((err, idx) => (

               <li key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-red-50/30 transition-colors">

                  <div className="flex items-center space-x-3">

                    <FileText className="w-4 h-4 text-red-400" />

                    <span className="text-sm font-medium text-gray-700">{err.fileName}</span>

                  </div>

                  <div className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">

                    <AlertTriangle className="w-3 h-3 mr-2" />

                    {err.errorMessage}

                  </div>

               </li>

             ))}

           </ul>

        </div>

      )}



      {/* Detail Modal */}

      <InvoiceDetailModal 

        file={selectedFile} 

        onClose={() => setSelectedFile(null)} 

      />



      {/* Floating Bulk Actions Bar */}

      <div 

        className={`

            fixed bottom-8 left-1/2 transform -translate-x-1/2 

            bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl

            flex items-center space-x-6 z-50 transition-all duration-300

            ${selectedIds.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}

        `}

      >

          <div className="flex items-center space-x-2 border-r border-gray-700 pr-6">

              <span className="font-bold text-indigo-400">{selectedIds.size}</span>

              <span className="text-sm text-gray-300">seleccionados</span>

          </div>

          

          <div className="flex items-center space-x-4">

              <button 

                 onClick={handleBulkDownload}

                 className="flex items-center space-x-2 hover:text-indigo-300 transition-colors"

              >

                  <Download className="w-4 h-4" />

                  <span className="text-sm font-medium">Descargar CSV</span>

              </button>

              

              <button 

                 onClick={handleBulkDelete}

                 className="flex items-center space-x-2 hover:text-red-400 transition-colors"

              >

                  <Trash2 className="w-4 h-4" />

                  <span className="text-sm font-medium">Eliminar</span>

              </button>

          </div>



          <button 

            onClick={() => setSelectedIds(new Set())}

            className="bg-gray-800 p-1 rounded-full hover:bg-gray-700 transition-colors ml-2"

            title="Cancelar selección"

          >

              <Minimize2 className="w-3 h-3 text-gray-500" />

          </button>

      </div>



    </div>

  );

};



export default FileList;