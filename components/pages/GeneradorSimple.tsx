import React, { useState } from 'react';
import { generarDTE, redondear } from '../../utils/dteGenerator';
import { useToast } from '../Toast';
import { Copy, Send } from 'lucide-react';

import { checkLicense } from '../../utils/licenseValidator';
import { getCertificate } from '../../utils/secureStorage';
import { limpiarDteParaFirma, transmitirDocumento, type TransmitDTEResponse } from '../../utils/firmaApiClient';

export const GeneradorSimple: React.FC = () => {
  const { addToast } = useToast();
  const [precio, setPrecio] = useState<number>(0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [descripcion, setDescripcion] = useState<string>('limpi');
  const [resultadoJSON, setResultadoJSON] = useState<string>('');
  const [respuestaMH, setRespuestaMH] = useState<TransmitDTEResponse | { error: string } | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const emisor = {
    nit: '14012805761025',
    nrc: '1571266',
    nombre: 'rogelio guerrero',
    nombreComercial: 'na',
    actividadEconomica: '96092', // codActividad en el JSON
    descActividad: 'Servicios n.c.p.',
    tipoEstablecimiento: '01',
    departamento: '06',
    municipio: '15',
    direccion: 'av maraai',
    telefono: '7929-3710',
    correo: 'rogelio.guerrero@agtisa.com',
    codEstableMH: 'M001',
    codPuntoVentaMH: 'P001'
  };

  const buildDatosFactura = () => {
    // Receptor fijo: Consumidor Final
    const receptor = {
      id: 999999,
      name: 'Consumidor Final',
      nit: '',
      nrc: '',
      actividadEconomica: '',
      departamento: '',
      municipio: '',
      direccion: '',
      telefono: '',
      email: 'guerrero_vi@yahoo.com',
      esConsumidorFinal: true,
      nombreComercial: '',
      timestamp: Date.now()
    };

    // Item simple calculado aquí mismo
    const precioNum = Number(precio);
    const cantidadNum = Number(cantidad);
    const totalLinea = redondear(precioNum * cantidadNum, 8);
    // Para FE (01) el precio incluye IVA: base = total/1.13, ivaItem = total - base
    const base = precioNum > 0 ? redondear(totalLinea / 1.13, 8) : 0;
    const ivaItem = precioNum > 0 ? redondear(totalLinea - base, 2) : 0;

    const item = {
      numItem: 1,
      tipoItem: 2, // Servicio
      cantidad: cantidadNum,
      codigo: null,
      uniMedida: 99,
      descripcion: descripcion,
      precioUni: precioNum,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: 0,
      ventaGravada: base,
      tributos: precioNum > 0 ? ['20'] : null,
      numeroDocumento: null,
      codTributo: null,
      psv: 0,
      noGravado: 0,
      ivaItem,
    };

    return {
      emisor,
      receptor,
      items: [item],
      tipoDocumento: '01',
      tipoTransmision: 1, // Normal
      formaPago: '01', // Efectivo
      condicionOperacion: 1 // Contado
    };
  };

  const buildAndSetDTE = () => {
    const datosFactura = buildDatosFactura();
    // Correlativo único basado en timestamp para evitar duplicados en MH
    const correlativo = Date.now();
    const dte = generarDTE(datosFactura, correlativo);
    setResultadoJSON(JSON.stringify(dte, null, 2));
    setRespuestaMH(null); // Limpiar respuesta anterior
    return dte;
  };

  const generarJSON = () => {
    buildAndSetDTE();
  };

  const copiarJSON = () => {
    navigator.clipboard.writeText(resultadoJSON);
    addToast('JSON copiado al portapapeles', 'success');
  };

  const transmitirMH = async () => {
    const licensed = await checkLicense();
    if (!licensed) {
      addToast('Licencia requerida para transmitir desde este dispositivo.', 'error');
      return;
    }

    // Siempre regenerar para forzar numeroControl único en cada envío
    const dteParaEnviar = buildAndSetDTE();

    setIsTransmitting(true);
    addToast('Transmitiendo a Hacienda...', 'info');

    const nitEmisor = emisor.nit.replace(/[\s-]/g, '');
    if (!(nitEmisor.length === 9 || nitEmisor.length === 14)) {
      addToast('NIT debe tener 9 o 14 dígitos (sin guiones) para transmitir.', 'error');
      setIsTransmitting(false);
      return;
    }

    try {
      const stored = await getCertificate();
      if (!stored?.password) {
        addToast('Guarda la contraseña del certificado en Mi Cuenta antes de transmitir.', 'error');
        return;
      }

      const dteLimpio = limpiarDteParaFirma(dteParaEnviar as any);
      const result = await transmitirDocumento({
        dte: dteLimpio,
        passwordPri: stored.password,
        ambiente: '00',
      });
      setRespuestaMH(result);

      const estado = result.mhResponse?.estado;
      const ok = result.transmitted === true && result.mhResponse?.success === true;

      if (ok && (estado === 'PROCESADO' || estado === 'ACEPTADO' || estado === 'ACEPTADO_CON_ADVERTENCIAS')) {
        addToast('DTE procesado por Hacienda', 'success');
      } else if (result.isOffline) {
        addToast(result.contingencyReason || 'Documento enviado a contingencia', 'info');
      } else {
        addToast(result.mhResponse?.mensaje || 'Error en la transmisión', 'error');
      }
    } catch (error: any) {
      setRespuestaMH({ error: error.message });
      addToast('Error de conexión con el backend', 'error');
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Test DTE (Factura 01)</h1>
      <p className="text-gray-600 mb-6">Generador y transmisor de prueba con datos quemados de emisor y receptor.</p>
      
      <div className="grid grid-cols-3 gap-4 bg-white p-6 rounded-xl border">
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <input 
            type="text" 
            value={descripcion} 
            onChange={e => setDescripcion(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad</label>
          <input 
            type="number" 
            value={cantidad} 
            onChange={e => setCantidad(Number(e.target.value))}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Precio Unitario (con IVA)</label>
          <input 
            type="number" 
            step="0.01"
            value={precio} 
            onChange={e => setPrecio(Number(e.target.value))}
            className="w-full border p-2 rounded"
          />
        </div>
      </div>

      <button 
        onClick={generarJSON}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 transition text-white rounded-xl font-bold"
      >
        Generar JSON
      </button>

      {resultadoJSON && (
        <div className="mt-8 space-y-6">
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-gray-50 border-b px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-bold">Resultado JSON</h2>
              <div className="flex gap-2">
                <button 
                  onClick={copiarJSON}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
                >
                  <Copy size={16} /> Copiar
                </button>
                <button 
                  onClick={transmitirMH}
                  disabled={isTransmitting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                >
                  <Send size={16} /> {isTransmitting ? 'Enviando...' : 'Transmitir'}
                </button>
              </div>
            </div>
            <pre className="bg-gray-900 text-green-400 p-4 overflow-x-auto text-xs max-h-96">
              {resultadoJSON}
            </pre>
          </div>

          {respuestaMH && (
            <div className={`border rounded-xl overflow-hidden shadow-sm ${'mhResponse' in respuestaMH && respuestaMH.mhResponse?.success ? 'border-green-300' : 'border-red-300'}`}>
              <div className={`px-4 py-3 border-b ${'mhResponse' in respuestaMH && respuestaMH.mhResponse?.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <h2 className={`text-lg font-bold ${'mhResponse' in respuestaMH && respuestaMH.mhResponse?.success ? 'text-green-800' : 'text-red-800'}`}>
                  Hacienda: {('mhResponse' in respuestaMH ? respuestaMH.mhResponse?.estado : undefined) || 'Sin estado'}
                </h2>
                <p className={`text-sm ${'mhResponse' in respuestaMH && respuestaMH.mhResponse?.success ? 'text-green-600' : 'text-red-600'}`}>
                  {('error' in respuestaMH ? respuestaMH.error : respuestaMH.mhResponse?.mensaje) || 'Mensaje no disponible'}
                </p>
                {'mhResponse' in respuestaMH && respuestaMH.mhResponse?.selloRecepcion && (
                  <p className="text-xs text-gray-500 break-all">Sello: {respuestaMH.mhResponse.selloRecepcion}</p>
                )}
                {'mhResponse' in respuestaMH && respuestaMH.mhResponse?.codigoGeneracion && (
                  <p className="text-xs text-gray-500 break-all">Código: {respuestaMH.mhResponse.codigoGeneracion}</p>
                )}
              </div>
              <pre className="bg-gray-50 p-4 overflow-x-auto text-xs text-gray-800 max-h-64">
                {JSON.stringify(respuestaMH, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneradorSimple;
