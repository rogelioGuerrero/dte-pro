import { useState } from 'react';
import {
  Play, 
  CheckCircle2, 
  FileText,
  Download,
  Copy,
  AlertCircle,
  Settings,
  Zap
} from 'lucide-react';
import { DTEJSON } from '../utils/dteGenerator';
import { guardarDTEEnHistorial } from '../utils/dteHistoryDb';
import { generarLibroDesdeDTEs } from '../utils/librosAutoGenerator';
import { loadSettings } from '../utils/settings';
import type { TransmisionResult } from '../utils/dteSignature';

const generarSelloRecepcionFake = (): string => {
  return crypto.randomUUID().toUpperCase();
};

interface SimuladorTransmisionProps {
  dte: DTEJSON;
  onClose: () => void;
  onSuccess: (resultado: TransmisionResult) => void;
}

const SimuladorTransmision: React.FC<SimuladorTransmisionProps> = ({
  dte,
  onClose,
  onSuccess,
}) => {
  const [estado, setEstado] = useState<'idle' | 'simulando' | 'completado'>('idle');
  const [resultado, setResultado] = useState<TransmisionResult | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [config, setConfig] = useState({
    siempreAceptado: true,
    conAdvertencias: false,
    latencia: 1500,
  });

  const ejecutarSimulacion = async () => {
    setEstado('simulando');
    
    // Simular latencia
    await new Promise(resolve => setTimeout(resolve, config.latencia));

    // Generar resultado de la simulación
    const simulacion: TransmisionResult = {
      success: config.siempreAceptado,
      estado: config.siempreAceptado ? 'ACEPTADO' : 'RECHAZADO',
      codigoGeneracion: dte.identificacion.codigoGeneracion,
      numeroControl: dte.identificacion.numeroControl,
      selloRecepcion: generarSelloRecepcionFake(),
      fechaHoraRecepcion: new Date().toISOString(),
      fechaHoraProcesamiento: new Date().toISOString(),
      mensaje: config.siempreAceptado 
        ? 'Documento aceptado (simulación)' 
        : 'Documento rechazado (simulación)',
      enlaceConsulta: `https://consultadte.mh.gob.sv/consulta/${dte.identificacion.codigoGeneracion}`,
      ...(config.conAdvertencias && config.siempreAceptado && {
        advertencias: [
          {
            codigo: 'W001',
            descripcion: 'Esta es una advertencia simulada'
          },
          {
            codigo: 'W002',
            descripcion: 'Campo opcional no incluido'
          }
        ]
      }),
      ...(!config.siempreAceptado && {
        errores: [
          {
            codigo: 'E-SIM01',
            descripcion: 'Error de simulación para pruebas',
            severidad: 'ERROR',
            campo: 'simulacion',
            valorActual: 'simulado',
            valorEsperado: 'real'
          }
        ]
      })
    };

    setResultado(simulacion);
    
    // Guardar en historial local
    try {
      await guardarDTEEnHistorial(dte, simulacion, dte.identificacion.ambiente as '00' | '01');

      try {
        const settings = loadSettings();
        const normalizeId = (id: string) => (id || '').toString().replace(/[\s-]/g, '').trim();
        const myNit = normalizeId(settings.myNit || '');
        const myNrc = normalizeId(settings.myNrc || '');
        const emisorNit = normalizeId(dte?.emisor?.nit || '');
        const emisorNrc = normalizeId(dte?.emisor?.nrc || '');
        const receptorNit = normalizeId(dte?.receptor?.numDocumento || '');
        const receptorNrc = normalizeId(dte?.receptor?.nrc || '');

        const isMyCompanyEmitter = (myNit && emisorNit === myNit) || (myNrc && emisorNrc === myNrc);
        const isMyCompanyReceiver = (myNit && receptorNit === myNit) || (myNrc && receptorNrc === myNrc);
        const modoLibro = isMyCompanyReceiver && !isMyCompanyEmitter ? 'compras' : 'ventas';
        const periodo = (dte?.identificacion?.fecEmi || '').substring(0, 7);
        if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
          await generarLibroDesdeDTEs({
            modo: modoLibro,
            periodo,
            incluirPendientes: false,
            incluirRechazados: false,
          });
        }
      } catch (autoLibroError) {
        console.error('Error generando libro automático:', autoLibroError);
      }
    } catch (error) {
      console.error('Error guardando en historial:', error);
    }

    setEstado('completado');
    
    if (config.siempreAceptado) {
      onSuccess(simulacion);
    }
  };

  const copiarAlPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const descargarJSON = () => {
    const json = JSON.stringify({
      dteOriginal: dte,
      respuestaMH: resultado,
      simulacion: {
        timestamp: new Date().toISOString(),
        configuracion: config
      }
    }, null, 2);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIMULACION-${dte.identificacion.codigoGeneracion}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (estado === 'completado' && resultado) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                resultado.success ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {resultado.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  Simulación {resultado.success ? 'Exitosa' : 'Con Errores'}
                </h2>
                <p className="text-xs text-gray-500">
                  {resultado.estado === 'ACEPTADO' ? 'DTE Aceptado' : 'DTE Rechazado'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>

          {/* Contenido */}
          <div className="p-4 space-y-4">
            {/* Sello de recepción */}
            {resultado.selloRecepcion && (
              <div className={`rounded-xl p-3 border ${
                resultado.success 
                  ? 'bg-green-50 border-green-100' 
                  : 'bg-red-50 border-red-100'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-xs font-medium ${
                    resultado.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Sello de Recepción
                  </p>
                  <button
                    onClick={() => copiarAlPortapapeles(resultado.selloRecepcion!)}
                    className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                  >
                    {copiado ? '¡Copiado!' : <><Copy className="w-3 h-3" /> Copiar</>}
                  </button>
                </div>
                <code className={`text-xs font-mono break-all block ${
                  resultado.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {resultado.selloRecepcion}
                </code>
              </div>
            )}

            {/* Datos del DTE */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500 uppercase">Código Generación</p>
                <p className="text-xs font-mono text-gray-800 truncate" title={resultado.codigoGeneracion}>
                  {resultado.codigoGeneracion}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500 uppercase">Número Control</p>
                <p className="text-xs font-mono text-gray-800 truncate" title={resultado.numeroControl}>
                  {resultado.numeroControl}
                </p>
              </div>
            </div>

            {/* Advertencias */}
            {resultado.advertencias && resultado.advertencias.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Advertencias
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

            {/* Errores */}
            {resultado.errores && resultado.errores.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Errores
                </p>
                <ul className="space-y-1">
                  {resultado.errores.map((err, i) => (
                    <li key={i} className="text-xs text-red-700">
                      <span className="font-mono text-red-600">[{err.codigo}]</span> {err.descripcion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fecha y hora */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>Simulado:</span>
              <span>{new Date(resultado.fechaHoraRecepcion!).toLocaleString()}</span>
            </div>

            {/* Badge de simulación */}
            <div className="bg-purple-50 rounded-lg p-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-purple-700">
                Esta es una simulación - No tiene validez fiscal
              </p>
            </div>

            {/* Botones */}
            <div className="space-y-2">
              <button
                onClick={descargarJSON}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 font-medium shadow-lg"
              >
                <Download className="w-4 h-4" />
                Descargar JSON Completo
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEstado('idle')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Nueva Simulación
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Simulador de Transmisión</h2>
              <p className="text-xs text-gray-500">Prueba todo el pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-4">
          {estado === 'idle' && (
            <>
              {/* Configuración */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-medium text-gray-700">Configuración</p>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Siempre aceptado</span>
                    <input
                      type="checkbox"
                      checked={config.siempreAceptado}
                      onChange={(e) => setConfig({...config, siempreAceptado: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Con advertencias</span>
                    <input
                      type="checkbox"
                      checked={config.conAdvertencias}
                      onChange={(e) => setConfig({...config, conAdvertencias: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </label>
                  
                  <div>
                    <label className="text-sm text-gray-600">Latencia (ms)</label>
                    <input
                      type="number"
                      value={config.latencia}
                      onChange={(e) => setConfig({...config, latencia: parseInt(e.target.value) || 0})}
                      className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      min="0"
                      max="5000"
                    />
                  </div>
                </div>
              </div>

              {/* Info del DTE */}
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-700">Documento a simular</p>
                </div>
                <div className="space-y-1 text-xs text-blue-600">
                  <p><span className="font-medium">Tipo:</span> {dte.identificacion.tipoDte}</p>
                  <p><span className="font-medium">Código:</span> {dte.identificacion.codigoGeneracion}</p>
                  <p><span className="font-medium">Cliente:</span> {dte.receptor?.nombre || ''}</p>
                  <p><span className="font-medium">Total:</span> ${dte.resumen?.totalPagar?.toFixed(2)}</p>
                </div>
              </div>

              {/* Botón de simulación */}
              <button
                onClick={ejecutarSimulacion}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 font-medium shadow-lg"
              >
                <Play className="w-4 h-4" />
                Iniciar Simulación
              </button>

              {/* Nota */}
              <div className="bg-amber-50 rounded-lg p-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Esta simulación no transmite realmente al Ministerio de Hacienda. 
                  Solo genera una respuesta de prueba para validar el flujo completo.
                </p>
              </div>
            </>
          )}

          {estado === 'simulando' && (
            <div className="py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">Simulando transmisión...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Generando respuesta de Hacienda
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimuladorTransmision;
