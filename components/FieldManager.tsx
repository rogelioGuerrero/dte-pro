import React from 'react';
import { FieldConfiguration, FieldDefinition } from '../types';
import { X, ArrowUp, ArrowDown, Plus, Trash2, RefreshCcw } from 'lucide-react';
import { EXACT_SCRIPT_CONFIG } from '../utils/fieldMapping';

interface FieldManagerProps {
  config: FieldConfiguration;
  onConfigChange: (newConfig: FieldConfiguration) => void;
  onClose: () => void;
}

const FieldManager: React.FC<FieldManagerProps> = ({ config, onConfigChange, onClose }) => {
  
  const handleFieldChange = (index: number, field: string, value: any) => {
    const newConfig = [...config];
    (newConfig[index] as any)[field] = value;
    onConfigChange(newConfig);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === config.length - 1)
    ) return;

    const newConfig = [...config];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newConfig[index], newConfig[swapIndex]] = [newConfig[swapIndex], newConfig[index]];
    onConfigChange(newConfig);
  };

  const addField = () => {
    const newField: FieldDefinition = {
      id: Date.now().toString(),
      columnLetter: String.fromCharCode(65 + config.length), // A, B, C...
      label: 'Nuevo Campo',
      sourceType: 'static',
      value: '',
      transformation: 'none',
      enabled: true
    };
    onConfigChange([...config, newField]);
  };

  const removeField = (index: number) => {
    const newConfig = config.filter((_, i) => i !== index);
    onConfigChange(newConfig);
  };

  const resetToDefault = () => {
    if(window.confirm('¿Estás seguro? Esto borrará tu configuración personalizada.')) {
      onConfigChange(EXACT_SCRIPT_CONFIG);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-white px-6 py-5 flex justify-between items-center shrink-0 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xl text-gray-900">Gestor de Campos CSV</h3>
            <p className="text-gray-500 text-sm">Configura la estructura del archivo de salida</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={resetToDefault}
              className="text-gray-500 hover:text-indigo-600 text-sm flex items-center space-x-1 px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>Restaurar</span>
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body (Scrollable) */}
        <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
          <div className="space-y-3">
            {config.map((field, index) => (
              <div key={field.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Order Controls */}
                <div className="flex flex-col space-y-1 shrink-0">
                  <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveField(index, 'down')} disabled={index === config.length - 1} className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Index Badge */}
                <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-700 font-bold rounded-lg text-sm">
                  {index + 1}
                </div>

                {/* Main Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
                  
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Etiqueta / Columna</label>
                    <input 
                      type="text" 
                      value={field.label} 
                      onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                      className="w-full text-sm bg-gray-50 text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Origen</label>
                    <select 
                      value={field.sourceType} 
                      onChange={(e) => handleFieldChange(index, 'sourceType', e.target.value)}
                      className="w-full text-sm bg-gray-50 text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    >
                      <option value="json">JSON (Dinámico)</option>
                      <option value="static">Fijo (Estático)</option>
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">
                      {field.sourceType === 'json' ? 'Ruta (Path JSON)' : 'Valor Constante'}
                    </label>
                    <input 
                      type="text" 
                      value={field.value} 
                      onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                      placeholder={field.sourceType === 'json' ? 'ej. identificacion.fecEmi' : 'ej. 4'}
                      className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 outline-none text-gray-900 transition-all ${field.sourceType === 'json' ? 'border-blue-200 bg-blue-50/50' : 'border-yellow-200 bg-yellow-50/50'}`}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Transformación</label>
                    <select 
                      value={field.transformation} 
                      onChange={(e) => handleFieldChange(index, 'transformation', e.target.value)}
                      className="w-full text-sm bg-gray-50 text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    >
                      <option value="none">Ninguna</option>
                      <option value="date_ddmmyyyy">Fecha DD/MM/AAAA</option>
                      <option value="remove_hyphens">Quitar Guiones (-)</option>
                      <option value="currency">Moneda (0.00)</option>
                      <option value="first_element_currency">Array[0].valor</option>
                    </select>
                  </div>
                </div>

                {/* Delete */}
                <button onClick={() => removeField(index)} className="text-gray-400 hover:text-red-500 p-2 transition-colors shrink-0">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            <button 
              onClick={addField}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Agregar Columna
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};

export default FieldManager;