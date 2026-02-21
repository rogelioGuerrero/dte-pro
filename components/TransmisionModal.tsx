import { useState, useEffect } from 'react';
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
  WifiOff
} from 'lucide-react';
import { DTEJSON, convertirAContingencia } from '../utils/dteGenerator';
import TemplateSelector from './TemplateSelector';
import { construirDTEArchivado, guardarDTEEnHistorial } from '../utils/dteHistoryDb';
import { generarLibroDesdeDTEs } from '../utils/librosAutoGenerator';
import { getCertificate } from '../utils/secureStorage';
import { firmarDocumento, limpiarDteParaFirma, wakeFirmaService } from '../utils/firmaApiClient';
import { processDTE } from '../utils/mh/process';
import { loadSettings } from '../utils/settings';
import { 
  TransmisionResult,
  EstadoTransmision
} from '../utils/dteSignature';

interface TransmisionModalProps {
  dte: DTEJSON;
  onClose: () => void;
  onSuccess: (selloRecepcion: string, resultado: TransmisionResult) => void;
  onGeneratePDF?: (dte: DTEJSON, resultado: TransmisionResult) => void;
  ambiente?: '00' | '01';
  logoUrl?: string;
}

const PASOS = [
  { id: 'firmando', label: 'Firmando documento', icon: FileSignature },
  { id: 'transmitiendo', label: 'Transmitiendo a MH', icon: Wifi },
  { id: 'procesado', label: 'Procesado', icon: CheckCircle2 },
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
  const [estado, setEstado] = useState<EstadoTransmision>('pendiente');
  const [resultado, setResultado] = useState<TransmisionResult | null>(null);
  const [jwsFirmado, setJwsFirmado] = useState<string | null>(null);
  const [dteTransmitido, setDteTransmitido] = useState<DTEJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnectionError, setIsConnectionError] = useState(false);

  const iniciarTransmision = async () => {
    setEstado('firmando');
    setError(null);
    setResultado(null);
    setIsConnectionError(false);

    try {
      const processed = processDTE(dte);
      setDteTransmitido(processed.dte);
      const ambienteFinal = (processed.dte?.identificacion?.ambiente === '01' ? '01' : '00') as '00' | '01';
      if (processed.errores.length > 0) {
        const rechazo: TransmisionResult = {
          success: false,
          estado: 'RECHAZADO',
          codigoGeneracion: processed.dte.identificacion.codigoGeneracion,
          numeroControl: processed.dte.identificacion.numeroControl,
          fechaHoraRecepcion: new Date().toISOString(),
          mensaje: 'Documento contiene errores de validación',
          errores: processed.errores,
        };
        setResultado(rechazo);
        setEstado('rechazado');
        return;
      }

      // La contraseña se obtiene del backend usando el NIT del emisor
      const nitEmisor = (processed.dte?.emisor?.nit || '').toString().trim();
      if (!nitEmisor || nitEmisor.length < 9 || nitEmisor.replace(/[\s-]/g, '') === '00000000000000') {
        throw new Error('NIT del emisor inválido o no configurado. Revisa la configuración del emisor.');
      }

      await wakeFirmaService({ retries: 3, baseDelayMs: 1000, timeoutMs: 15000 });

      const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);

      // Enviar al backend para que obtenga la contraseña y firme
      const response = await fetch('https://api-dte.onrender.com/api/dte/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': nitEmisor
        },
        body: JSON.stringify({
          dte: dteLimpio,
          nit: nitEmisor,
          ambiente: (dteLimpio as any).identificacion?.ambiente || '00',
          flowType: 'emission'
        })
      });

      if (!response.ok) {
        throw new Error('Error del backend al procesar DTE');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.userMessage || 'Error del backend');
      }

      setJwsFirmado(result.data?.jwsFirmado || '');
      setEstado('transmitiendo');

      // El backend ya hizo la transmisión, usar resultado directo
      const transmisionResult = result.data?.transmisionResult;
      
      // Debug: log completo para ver errores MH
      console.log('TransmisionResult completo:', JSON.stringify(transmisionResult, null, 2));
      
      setResultado(transmisionResult);
      
      if (transmisionResult.success) {
        setEstado('procesado');
        
        // Guardar en historial local
        await guardarDTEHistory(processed.dte, transmisionResult, ambienteFinal, jwsFirmado);
        
        if (transmisionResult.selloRecepcion) {
          onSuccess(transmisionResult.selloRecepcion, transmisionResult);
        } else {
          onSuccess('', transmisionResult);
        }
      } else {
        // Verificar si es error de comunicación
        const isCommError = transmisionResult.errores?.some((e: any) => e.codigo === 'COM-ERR' || e.codigo.startsWith('HTTP-'));
        if (isCommError) {
          setIsConnectionError(true);
        }
        setEstado('rechazado');
      }
    } catch (err) {
      setEstado('error');
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEmitirContingencia = async () => {
    // Validar restricción: solo Factura (01)
    if (dte.identificacion.tipoDte !== '01') {
      alert('Por seguridad, el modo de contingencia solo está habilitado para Facturas (01) en este momento.');
      return;
    }

    try {
      setEstado('firmando');
      setError(null);

      // 1. Convertir a contingencia
      const dteContingencia = convertirAContingencia(dte);
      const processed = processDTE(dteContingencia);
      setDteTransmitido(processed.dte);
      
      const ambienteFinal = (processed.dte?.identificacion?.ambiente === '01' ? '01' : '00') as '00' | '01';

      // 2. Firmar nuevamente (necesitamos password)
      const stored = await getCertificate();
      const passwordPri = stored?.password
        ? stored.password
        : (window.prompt('Modo Contingencia: Ingresa la contraseña/PIN del certificado para firmar:') || '').trim();
      
      if (!passwordPri) {
        setEstado('rechazado');
        return;
      }

      const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
      const nitEmisor = (processed.dte?.emisor?.nit || '').toString().trim();

      const jwsContingencia = await firmarDocumento({
        nit: nitEmisor,
        passwordPri,
        dteJson: dteLimpio,
      });

      setJwsFirmado(jwsContingencia);

      // 3. Crear resultado simulado de contingencia
      const resultContingencia: TransmisionResult = {
        success: false, // No transmitido a MH aún
        estado: 'CONTINGENCIA',
        codigoGeneracion: processed.dte.identificacion.codigoGeneracion,
        numeroControl: processed.dte.identificacion.numeroControl,
        fechaHoraRecepcion: new Date().toISOString(),
        mensaje: 'Documento generado en Contingencia (Offline). Pendiente de transmisión.',
        errores: [],
        advertencias: [{
          codigo: 'CONTINGENCIA',
          descripcion: 'Documento emitido en modo diferido por falla de conexión.',
          severidad: 'ALTA'
        }]
      };

      setResultado(resultContingencia);
      setEstado('procesado'); // Lo marcamos como procesado (guardado localmente)

      // 4. Guardar en historial
      await guardarDTEHistory(processed.dte, resultContingencia, ambienteFinal, jwsContingencia);

    } catch (err) {
      setEstado('error');
      setError(err instanceof Error ? err.message : 'Error al generar contingencia');
    }
  };

  const guardarDTEHistory = async (dteObj: DTEJSON, result: TransmisionResult, ambienteFinal: '00' | '01', jws: string | null) => {
    try {
      await guardarDTEEnHistorial(dteObj, result, ambienteFinal, jws || undefined);

      try {
        const settings = loadSettings();
        const normalizeId = (id: string) => (id || '').toString().replace(/[\s-]/g, '').trim();
        const myNit = normalizeId(settings.myNit || '');
        const myNrc = normalizeId(settings.myNrc || '');
        const emisorNit = normalizeId(dteObj.emisor?.nit || '');
        const emisorNrc = normalizeId(dteObj.emisor?.nrc || '');
        const receptorNit = normalizeId(dteObj.receptor?.numDocumento || '');
        const receptorNrc = normalizeId(dteObj.receptor?.nrc || '');

        const isMyCompanyEmitter = (myNit && emisorNit === myNit) || (myNrc && emisorNrc === myNrc);
        const isMyCompanyReceiver = (myNit && receptorNit === myNit) || (myNrc && receptorNrc === myNrc);
        const modoLibro = isMyCompanyReceiver && !isMyCompanyEmitter ? 'compras' : 'ventas';
        const periodo = (dteObj.identificacion?.fecEmi || '').substring(0, 7);
        if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
          await generarLibroDesdeDTEs({
            modo: modoLibro,
            periodo,
            incluirPendientes: true, // Incluimos pendientes/contingencia
            incluirRechazados: false,
          });
        }
      } catch (autoLibroError) {
        console.error('Error generando libro automático:', autoLibroError);
      }
    } catch (historyError) {
      console.error('Error guardando en historial:', historyError);
    }
  };

  useEffect(() => {
    iniciarTransmision();
  }, []);

  const handleCopiar = (texto: string, campo: string) => {
    navigator.clipboard.writeText(texto);
    setCopiedField(campo);
    setTimeout(() => setCopiedField(null), 2000);
  };

  
  const getPasoActual = (): number => {
    switch (estado) {
      case 'firmando': return 0;
      case 'transmitiendo': return 1;
      case 'procesado': return 2;
      default: return -1;
    }
  };

  const renderProgreso = () => {
    const pasoActual = getPasoActual();
    
    return (
      <div className="space-y-4">
        {PASOS.map((paso, index) => {
          const Icon = paso.icon;
          const isActive = index === pasoActual;
          const isComplete = index < pasoActual || estado === 'procesado';
          const isPending = index > pasoActual && estado !== 'procesado';
          
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
                {isActive && estado !== 'procesado' ? (
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
                {isActive && estado !== 'procesado' && (
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
    const esContingencia = resultado?.estado === 'CONTINGENCIA';
    
    return (
      <div className="py-4">
        {/* Header de éxito */}
        <div className="text-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${esContingencia ? 'bg-amber-100' : 'bg-green-100'}`}>
            {esContingencia ? (
              <WifiOff className="w-8 h-8 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {esContingencia ? 'Guardado en Contingencia' : '¡DTE Autorizado!'}
          </h3>
          <p className="text-sm text-gray-500">{resultado?.mensaje || 'Proceso finalizado'}</p>
        </div>
        
        {/* Datos de la respuesta */}
        <div className="space-y-3 mb-4">
          {/* Sello de Recepción */}
          {resultado?.selloRecepcion ? (
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-green-700">Sello de Recepción</p>
                <button
                  onClick={() => handleCopiar(resultado.selloRecepcion!, 'sello')}
                  className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                >
                  {copiedField === 'sello' ? '¡Copiado!' : <><Copy className="w-3 h-3" /> Copiar</>}
                </button>
              </div>
              <code className="text-xs font-mono text-green-800 break-all block">
                {resultado.selloRecepcion}
              </code>
            </div>
          ) : esContingencia && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p className="text-xs font-medium text-amber-700 mb-1">Estado Offline</p>
              <p className="text-xs text-amber-600">
                El documento ha sido firmado y guardado localmente. Deberás transmitirlo cuando restablezcas la conexión.
              </p>
            </div>
          )}

          {/* Número de Control y Código Generación */}
          <div className="grid grid-cols-2 gap-2">
            {resultado?.numeroControl && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500 uppercase">Número Control</p>
                <p className="text-xs font-mono text-gray-800 truncate" title={resultado.numeroControl}>
                  {resultado.numeroControl}
                </p>
              </div>
            )}
            {resultado?.codigoGeneracion && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500 uppercase">Código Generación</p>
                <p className="text-xs font-mono text-gray-800 truncate" title={resultado.codigoGeneracion}>
                  {resultado.codigoGeneracion.substring(0, 8)}...
                </p>
              </div>
            )}
          </div>

          {/* Fecha de procesamiento */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span>{esContingencia ? 'Generado:' : 'Procesado:'}</span>
            <span>{new Date().toLocaleString()}</span>
          </div>

          {/* Advertencias */}
          {resultado?.advertencias && resultado.advertencias.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Advertencias
              </p>
              <ul className="space-y-1">
                {resultado.advertencias.map((adv, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    <span className="font-mono text-amber-600">[{adv.codigo}]</span> {adv.descripcion}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                const dteArchivado = construirDTEArchivado(dteTransmitido || dte, resultado || undefined, jwsFirmado || undefined);
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

  const renderError = () => (
    <div className="py-4">
      {/* Header de error */}
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">
          {estado === 'rechazado' ? 'DTE Rechazado' : 'Error de Transmisión'}
        </h3>
        <p className="text-sm text-gray-500">{resultado?.mensaje || error || 'Ocurrió un error'}</p>
      </div>
      
      {/* Errores detallados */}
      {resultado?.errores && resultado.errores.length > 0 && (
        <div className="bg-red-50 rounded-xl p-3 mb-4 border border-red-100 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-red-700 mb-2">Errores de validación:</p>
          <ul className="space-y-2">
            {resultado.errores.map((err, i) => (
              <li key={i} className="text-xs bg-white rounded-lg p-2 border border-red-100">
                <div className="flex items-start gap-2">
                  <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">
                      <span className="font-mono text-red-600">[{err.codigo}]</span> {err.descripcion}
                    </p>
                    {err.campo && (
                      <p className="text-red-600 font-mono text-[10px] mt-0.5">
                        Campo: {err.campo}
                      </p>
                    )}
                    {err.valorActual && err.valorEsperado && (
                      <p className="text-red-500 text-[10px] mt-0.5">
                        Valor: "{err.valorActual}" → Esperado: "{err.valorEsperado}"
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Código de generación si existe */}
      {resultado?.codigoGeneracion && (
        <div className="bg-gray-50 rounded-lg p-2 mb-4">
          <p className="text-[10px] text-gray-500 uppercase">Código Generación</p>
          <p className="text-xs font-mono text-gray-700">{resultado.codigoGeneracion}</p>
        </div>
      )}

      {/* Opción de Contingencia si es error de conexión */}
      {isConnectionError && dte.identificacion.tipoDte === '01' && (
        <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <WifiOff className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-800 mb-1">Problemas de Conexión</h4>
              <p className="text-xs text-amber-700 mb-3">
                No se pudo conectar con Hacienda. Puedes emitir este documento en <strong>Modo Contingencia (Offline)</strong> y transmitirlo después.
              </p>
              <button
                onClick={handleEmitirContingencia}
                className="w-full py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
              >
                Emitir en Contingencia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={iniciarTransmision}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    </div>
  );

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
              ${estado === 'procesado' ? (resultado?.estado === 'CONTINGENCIA' ? 'bg-amber-100' : 'bg-green-100') : estado === 'rechazado' || estado === 'error' ? 'bg-red-100' : 'bg-indigo-100'}
            `}>
              {estado === 'procesado' && resultado?.estado === 'CONTINGENCIA' ? (
                <WifiOff className="w-5 h-5 text-amber-600" />
              ) : (
                <Send className={`
                  w-5 h-5
                  ${estado === 'procesado' ? 'text-green-600' : estado === 'rechazado' || estado === 'error' ? 'text-red-600' : 'text-indigo-600'}
                `} />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {estado === 'procesado' && resultado?.estado === 'CONTINGENCIA' ? 'DTE Offline' : 'Transmitir DTE'}
              </h2>
              <p className="text-xs text-gray-500">
                Ambiente: {ambiente === '00' ? 'Pruebas' : 'Producción'}
              </p>
            </div>
          </div>
          {(estado === 'procesado' || estado === 'rechazado' || estado === 'error') && (
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
          {estado === 'procesado' && renderExito()}
          {(estado === 'rechazado' || estado === 'error') && renderError()}
          {(estado === 'pendiente' || estado === 'firmando' || estado === 'transmitiendo') && renderProgreso()}
        </div>

        {/* Footer info */}
        {(estado === 'firmando' || estado === 'transmitiendo') && (
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
