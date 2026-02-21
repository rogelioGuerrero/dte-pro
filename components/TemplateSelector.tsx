import { useState } from 'react';
import { 
  X, 
  Check, 
  FileText, 
  Sparkles, 
  Minimize2, 
  Crown,
  Eye,
  Download,
  Settings2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PLANTILLAS, TemplateName, TemplateConfig, descargarPDFConPlantilla, previsualizarPlantilla } from '../utils/pdfTemplates';
import { DTEJSON } from '../utils/dteGenerator';
import { TransmisionResult } from '../utils/dteSignature';

interface TemplateSelectorProps {
  dte: DTEJSON;
  resultado?: TransmisionResult;
  onClose: () => void;
  onDownload?: () => void;
  logoUrl?: string;
}

const TEMPLATE_ICONS: Record<TemplateName, React.ReactNode> = {
  clasica: <FileText className="w-5 h-5" />,
  moderna: <Sparkles className="w-5 h-5" />,
  minimalista: <Minimize2 className="w-5 h-5" />,
  ejecutiva: <Crown className="w-5 h-5" />,
};

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  dte,
  resultado,
  onClose,
  onDownload,
  logoUrl
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('clasica');
  const [showConfig, setShowConfig] = useState(false);
  const [customConfig, setCustomConfig] = useState<Partial<TemplateConfig['campos']>>({});

  const currentTemplate = PLANTILLAS.find(p => p.id === selectedTemplate)!;

  const handlePreview = () => {
    previsualizarPlantilla({
      dte,
      resultado,
      plantilla: selectedTemplate,
      config: customConfig,
      logoUrl
    });
  };

  const handleDownload = () => {
    descargarPDFConPlantilla({
      dte,
      resultado,
      plantilla: selectedTemplate,
      config: customConfig,
      logoUrl
    });
    onDownload?.();
  };

  const toggleConfigOption = (key: keyof TemplateConfig['campos']) => {
    setCustomConfig(prev => ({
      ...prev,
      [key]: !(prev[key] ?? currentTemplate.campos[key])
    }));
  };

  const configOptions: { key: keyof TemplateConfig['campos']; label: string }[] = [
    { key: 'mostrarQR', label: 'Código QR' },
    { key: 'mostrarNombreComercial', label: 'Nombre Comercial' },
    { key: 'mostrarTelefono', label: 'Teléfono' },
    { key: 'mostrarDireccion', label: 'Dirección' },
    { key: 'mostrarActividad', label: 'Actividad Económica' },
    { key: 'mostrarObservaciones', label: 'Observaciones' },
    { key: 'mostrarSello', label: 'Sello de Recepción' },
    { key: 'mostrarEnlaceConsulta', label: 'Enlace de Consulta' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Seleccionar Plantilla</h2>
              <p className="text-xs text-gray-500">Elige el estilo de tu factura</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {PLANTILLAS.map((plantilla) => (
              <button
                key={plantilla.id}
                onClick={() => {
                  setSelectedTemplate(plantilla.id);
                  setCustomConfig({});
                }}
                className={`
                  relative p-4 rounded-xl border-2 transition-all text-left
                  ${selectedTemplate === plantilla.id 
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                {selectedTemplate === plantilla.id && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {/* Preview Color Bar */}
                <div 
                  className="h-2 rounded-full mb-3"
                  style={{ background: `linear-gradient(90deg, ${plantilla.preview}, ${plantilla.preview}88)` }}
                />
                
                {/* Icon */}
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${plantilla.preview}20`, color: plantilla.preview }}
                >
                  {TEMPLATE_ICONS[plantilla.id]}
                </div>
                
                <h3 className="font-semibold text-gray-900 text-sm">{plantilla.nombre}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plantilla.descripcion}</p>
              </button>
            ))}
          </div>

          {/* Selected Template Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${currentTemplate.preview}20`, color: currentTemplate.preview }}
                >
                  {TEMPLATE_ICONS[selectedTemplate]}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{currentTemplate.nombre}</h4>
                  <p className="text-xs text-gray-500">{currentTemplate.descripcion}</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Personalizar
                {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Configuration Options */}
            {showConfig && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">Campos a mostrar:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {configOptions.map(({ key, label }) => {
                    const isEnabled = customConfig[key] ?? currentTemplate.campos[key];
                    return (
                      <button
                        key={key}
                        onClick={() => toggleConfigOption(key)}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                          ${isEnabled 
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isEnabled ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                          {isEnabled && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Document Info */}
          <div className="bg-indigo-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-indigo-600 font-medium">N° Control:</span>
                <span className="text-indigo-900 ml-1 font-mono">{dte.identificacion.numeroControl}</span>
              </div>
              <div>
                <span className="text-indigo-600 font-medium">Fecha:</span>
                <span className="text-indigo-900 ml-1">{dte.identificacion.fecEmi}</span>
              </div>
              <div>
                <span className="text-indigo-600 font-medium">Total:</span>
                <span className="text-indigo-900 ml-1 font-mono">${dte.resumen.totalPagar.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" />
            Vista Previa
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;
