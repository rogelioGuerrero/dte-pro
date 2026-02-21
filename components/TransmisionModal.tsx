import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  FileSignature,
  Wifi,
  AlertTriangle,
  Copy,
  Download,
  RefreshCw,
  WifiOff,
  Info
} from 'lucide-react';
import { DTEJSON } from '../utils/dteGenerator';
import TemplateSelector from './TemplateSelector';
import { construirDTEArchivado, guardarDTEEnHistorial } from '../utils/dteHistoryDb';
import { getCertificate } from '../utils/secureStorage';
import { TransmisionResult } from '../utils/dteSignature';
import { ProcessError, DteProcessData, DteProcessResponse } from '../utils/mh/apiResponse';

import { BACKEND_CONFIG, getAuthHeaders } from '../utils/backendConfig';

interface TransmisionModalProps {
  dte: DTEJSON;
  onClose: () => void;
  onSuccess: (selloRecepcion: string, resultado: TransmisionResult) => void;
  onGeneratePDF?: (dte: DTEJSON, resultado: TransmisionResult) => void;
  ambiente?: '00' | '01';
  logoUrl?: string;
}

const PASOS = [
  { id: 'validating', label: 'Validando estructura', icon: Loader2 },
  { id: 'signing', label: 'Firmando documento', icon: FileSignature },
  { id: 'transmitting', label: 'Transmitiendo a MH', icon: Wifi },
  { id: 'completed', label: 'Procesado', icon: CheckCircle2 },
];

const TransmisionModal: React.FC<TransmisionModalProps> = ({
  dte,
  onClose,
  onSuccess,
  ambiente = '00',
  logoUrl,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  
  // Estado UI
  const [uiStep, setUiStep] = useState<string>('validating');
  const [resultado, setResultado] = useState<TransmisionResult | null>(null);
  
  // Nuevo Estado Contrato API
  const [processError, setProcessError] = useState<ProcessError | null>(null);
  const [processData, setProcessData] = useState<DteProcessData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Para evitar doble ejecución en React StrictMode
  const hasStartedRef = useRef(false);

  const ejecutarAgente = async (retry: boolean = false, forceContingencia: boolean = false) => {
    if (hasStartedRef.current && !retry && !forceContingencia) return;
    hasStartedRef.current = true;

    setUiStep('validating');
    setProcessError(null);
    setProcessData(null);
    setResultado(null);

    try {
      const stored = await getCertificate();
      const passwordPri = stored?.password
        ? stored.password
        : (window.prompt('Ingresa la contraseña/PIN del certificado para firmar:') || '').trim();
      
      if (!passwordPri) {
        throw new Error('Se requiere la contraseña del certificado para firmar.');
      }

      // Preparar request para backend LangGraph
      const request = {
        dte: dte as any,
        passwordPri,
        ambiente,
        flowType: 'emission' as const,
        businessId: dte.emisor?.nit || 'NIT_NO_DISPONIBLE', // Usar NIT del emisor
        deviceId: await import('../utils/deviceFingerprint').then(m => m.deviceFingerprint.generateFingerprint())
      };

      // Llamar al backend LangGraph
      console.log(`🚀 Enviando a backend LangGraph en ${BACKEND_CONFIG.URL}...`);
      const response = await fetch(`${BACKEND_CONFIG.URL}/api/dte/process`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request)
      });

      const result: DteProcessResponse = await response.json();

      if (!response.ok) {
        // Si el error no es JSON, crear un error genérico
        if (!result || typeof result !== 'object') {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        throw new Error(result.error?.userMessage || 'Error del servidor');
      }

      // Procesar respuesta del backend
      if (result.success) {
        setProcessData(result.data || null);
        setUiStep('completed');
        
        // Construir resultado para UI
        const resultUI: TransmisionResult = {
          success: true,
          estado: 'PROCESADO',
          codigoGeneracion: result.data?.codigoGeneracion || '',
          numeroControl: dte.identificacion.numeroControl,
          fechaHoraRecepcion: result.data?.fechaHoraRecepcion,
          mensaje: 'Procesado exitosamente',
          selloRecepcion: result.data?.selloRecepcion,
          errores: [],
          advertencias: result.error?.severity === 'warning' ? [{
            codigo: result.error.code,
            descripcion: result.error.userMessage,
            severidad: 'MEDIA'
          }] : []
        };

        setResultado(resultUI);
        
        // Guardar historial
        await guardarDTEHistory(dte, resultUI, ambiente, null);

        if (result.data?.selloRecepcion) {
          const sello = result.data.selloRecepcion;
          setTimeout(() => {
            onSuccess(sello, resultUI);
          }, 1500);
        }
      } else {
        // Manejar error del backend
        setProcessError(result.error || null);
        setUiStep('failed');
      }

    } catch (err: any) {
      console.error("Error en backend:", err);
      setUiStep('failed');
      setProcessError({
        severity: 'error',
        category: 'system',
        code: 'INTERNAL_ERROR',
        userMessage: err.message || 'Error de conexión con el servidor',
        canRetry: true,
        details: [err.message]
      });
    }
  };

  const handleEmitirContingencia = () => {
    hasStartedRef.current = false;
    ejecutarAgente(true, true);
  };

  const guardarDTEHistory = async (dteObj: DTEJSON, result: TransmisionResult, ambienteFinal: '00' | '01', jws: string | null) => {
    try {
      await guardarDTEEnHistorial(dteObj, result, ambienteFinal, jws || undefined);
    } catch (historyError) {
      console.error('Error guardando en historial:', historyError);
    }
  };

  useEffect(() => {
    ejecutarAgente();
  }, []);

  const handleCopiar = (texto: string, campo: string) => {
    navigator.clipboard.writeText(texto);
    setCopiedField(campo);
    setTimeout(() => setCopiedField(null), 2000);
  };
  
  const getPasoActualIndex = (): number => {
    switch (uiStep) {
      case 'validating': return 0;
      case 'signing': return 1;
      case 'transmitting': return 2;
      case 'completed': return 3;
      case 'contingency': return 3;
      case 'failed': return -1;
      default: return 0;
    }
  };

  const renderProgreso = () => {
    const pasoActual = getPasoActualIndex();
    
    return (
      <div className="space-y-4">
        {PASOS.map((paso, index) => {
          const Icon = paso.icon;
          const isActive = index === pasoActual;
          const isComplete = index < pasoActual || uiStep === 'completed' || uiStep === 'contingency';
          const isPending = index > pasoActual && uiStep !== 'completed' && uiStep !== 'contingency';
          
          return (
            <div 
              key={paso.id}
              className={`
                flex items-center gap-4 p-4 rounded-xl transition-all
                ${isActive ? 'bg-indigo-50 border-2 border-indigo-200' : ''}
                ${isComplete ? 'bg-green-50' : ''}
                ${isPending ? 'opacity-40' : ''}
              `}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${isComplete ? 'bg-green-500 text-white' : ''}
                ${isActive ? 'bg-indigo-500 text-white' : ''}
                ${isPending ? 'bg-gray-200 text-gray-400' : ''}
              `}>
                {isActive && uiStep !== 'completed' && uiStep !== 'contingency' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${isComplete ? 'text-green-700' : isActive ? 'text-indigo-700' : 'text-gray-500'}`}>
                  {paso.label}
                </p>
                {isActive && (uiStep !== 'completed' && uiStep !== 'contingency') && (
                  <p className="text-sm text-indigo-500 animate-pulse">Procesando...</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderExito = () => {
    const esContingencia = uiStep === 'contingency' || (processError && processError.category === 'network');
    const esWarning = processError?.severity === 'warning';
    
    return (
      <div className="py-4">
        {/* Header de éxito */}
        <div className="text-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 
            ${esContingencia ? 'bg-amber-100' : esWarning ? 'bg-yellow-100' : 'bg-green-100'}`}>
            {esContingencia ? (
              <WifiOff className="w-8 h-8 text-amber-500" />
            ) : esWarning ? (
              <Info className="w-8 h-8 text-yellow-500" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {esContingencia ? 'Guardado en Contingencia' : 
             esWarning ? '¡Aceptado con Observaciones!' : '¡DTE Autorizado!'}
          </h3>
        </div>

        {/* Warning Message */}
        {processError && (esWarning || esContingencia) && (
          <div className={`rounded-xl p-4 mb-4 text-sm font-medium border
            ${esWarning ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
            <p>{processError.userMessage}</p>
            {processError.details && (
              <ul className="mt-2 text-xs opacity-80 list-disc list-inside pl-4">
                {processError.details.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
          </div>
        )}
        
        {/* Datos de la respuesta */}
        <div className="space-y-3 mb-4">
          {processData?.selloRecepcion && !esContingencia && (
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-green-700">Sello de Recepción</p>
                <button
                  onClick={() => handleCopiar(processData.selloRecepcion || '', 'sello')}
                  className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                >
                  {copiedField === 'sello' ? '¡Copiado!' : <><Copy className="w-3 h-3" /> Copiar</>}
                </button>
              </div>
              <code className="text-xs font-mono text-green-800 break-all block">
                {processData.selloRecepcion}
              </code>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {processData?.codigoGeneracion && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500 uppercase">Código Generación</p>
                <p className="text-xs font-mono text-gray-800 truncate" title={processData.codigoGeneracion}>
                  {processData.codigoGeneracion.substring(0, 8)}...
                </p>
              </div>
            )}
            {resultado?.numeroControl && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500 uppercase">Número Control</p>
                <p className="text-xs font-mono text-gray-800 truncate" title={resultado.numeroControl}>
                  {resultado.numeroControl}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-2">
          {resultado && (
            <button
              onClick={() => setShowTemplateSelector(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-medium shadow-lg 
                ${esContingencia 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-200' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'}`}
            >
              <Download className="w-4 h-4" />
              Descargar PDF {esContingencia && '(Contingencia)'}
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const dteArchivado = construirDTEArchivado(dte, resultado || undefined, undefined);
                const json = JSON.stringify(dteArchivado, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `DTE-${dte.identificacion.codigoGeneracion}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderError = () => {
    if (!processError) return null;

    return (
      <div className="py-4 animate-in fade-in">
        {/* Header de error */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            {processError.category === 'network' ? (
              <WifiOff className="w-8 h-8 text-red-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {processError.category === 'auth' ? 'Error de Autenticación' :
             processError.category === 'data' ? 'Error en Datos de Factura' :
             processError.category === 'network' ? 'Problema de Conexión' : 'Error de Procesamiento'}
          </h3>
        </div>
        
        {/* Mensaje Amigable para el Usuario */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-800 font-medium leading-relaxed">
            {processError.userMessage}
          </p>
        </div>

        {/* Detalles Técnicos Ocultables */}
        {processError.details && processError.details.length > 0 && (
          <div className="mb-4">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-700 underline mb-2"
            >
              {showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
            </button>
            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-32 overflow-y-auto">
                <ul className="space-y-1">
                  {processError.details.map((err, i) => (
                    <li key={i} className="text-xs font-mono text-gray-600 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Opción de Contingencia si es error de red */}
        {processError.category === 'network' && dte.identificacion.tipoDte === '01' && (
          <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
            <h4 className="text-sm font-bold text-amber-800 mb-1">Activar Modo Contingencia</h4>
            <p className="text-xs text-amber-700 mb-3">
              Al guardar en contingencia, la factura se firmará y será válida para entregar al cliente. Deberás transmitirla a Hacienda cuando vuelva el internet.
            </p>
            <button
              onClick={handleEmitirContingencia}
              className="w-full py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
            >
              Guardar en Contingencia
            </button>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          {processError.canRetry && (
            <button
              onClick={() => { hasStartedRef.current = false; ejecutarAgente(true); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  };

  // Mostrar selector de plantillas si está activo
  if (showTemplateSelector && resultado) {
    return (
      <TemplateSelector
        dte={dte}
        resultado={resultado}
        onClose={() => setShowTemplateSelector(false)}
        logoUrl={logoUrl}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${uiStep === 'completed' ? (resultado?.estado === 'CONTINGENCIA' ? 'bg-amber-100' : 'bg-green-100') : uiStep === 'failed' ? 'bg-red-100' : 'bg-indigo-100'}
            `}>
              {uiStep === 'completed' && resultado?.estado === 'CONTINGENCIA' ? (
                <WifiOff className="w-5 h-5 text-amber-600" />
              ) : uiStep === 'failed' ? (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              ) : (
                <Send className={`
                  w-5 h-5
                  ${uiStep === 'completed' ? 'text-green-600' : 'text-indigo-600'}
                `} />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {uiStep === 'completed' && resultado?.estado === 'CONTINGENCIA' ? 'DTE Offline' : 'Transmitir DTE'}
              </h2>
              <p className="text-xs text-gray-500">
                {uiStep === 'completed' ? 'Finalizado' : uiStep === 'failed' ? 'Detenido' : 'Agente procesando...'}
              </p>
            </div>
          </div>
          {(uiStep === 'completed' || uiStep === 'failed') && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {(uiStep === 'completed' || uiStep === 'contingency') && renderExito()}
          {uiStep === 'failed' && renderError()}
          {uiStep !== 'completed' && uiStep !== 'contingency' && uiStep !== 'failed' && renderProgreso()}
        </div>

        {/* Footer info */}
        {uiStep !== 'completed' && uiStep !== 'failed' && (
          <div className="px-4 pb-4">
            <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                {ambiente === '00' 
                  ? 'Modo pruebas: No genera obligaciones fiscales reales.'
                  : 'Modo producción: Este documento tendrá efectos fiscales reales.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransmisionModal;
