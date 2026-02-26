import React, { useState } from 'react';
import { generarDTE, redondear } from '../../utils/dteGenerator';
import { useToast } from '../Toast';
import { Copy, Send } from 'lucide-react';

import { BACKEND_CONFIG, getAuthHeaders } from '../../utils/backendConfig';

export const GeneradorSimple: React.FC = () => {
  const { addToast } = useToast();
  const [precio, setPrecio] = useState<number>(0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [descripcion, setDescripcion] = useState<string>('limpi');
  const [resultadoJSON, setResultadoJSON] = useState<string>('');
  const [respuestaMH, setRespuestaMH] = useState<any>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [dteData, setDteData] = useState<any>(null);

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

  const generarJSON = () => {
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
      email: '',
      esConsumidorFinal: true,
      nombreComercial: '',
      timestamp: Date.now()
    };

    // Item simple calculado aquí mismo
    const precioNum = Number(precio);
    const cantidadNum = Number(cantidad);
    const totalLinea = redondear(precioNum * cantidadNum, 8);

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
      ventaGravada: precioNum > 0 ? totalLinea : 0,
      tributos: precioNum > 0 ? ['20'] : null,
      numeroDocumento: null,
      codTributo: null,
      psv: 0,
      noGravado: 0
    };

    const datosFactura = {
      emisor,
      receptor,
      items: [item],
      tipoDocumento: '01',
      tipoTransmision: 1, // Normal
      formaPago: '01', // Efectivo
      condicionOperacion: 1 // Contado
    };

    const dte = generarDTE(datosFactura, 1);
    setDteData(dte);
    setResultadoJSON(JSON.stringify(dte, null, 2));
    setRespuestaMH(null); // Limpiar respuesta anterior
  };

  const copiarJSON = () => {
    navigator.clipboard.writeText(resultadoJSON);
    addToast('JSON copiado al portapapeles', 'success');
  };

  const transmitirMH = async () => {
    if (!dteData) return;
    
    setIsTransmitting(true);
    addToast('Transmitiendo a Hacienda...', 'info');

    try {
      const response = await fetch(`${BACKEND_CONFIG.URL}/api/dte/process`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          dte: dteData,
          ambiente: '00', // Pruebas
          business_id: import.meta.env.VITE_BUSINESS_ID || 'uuid-business-temporal',
        })
      });

      const result = await response.json();
      setRespuestaMH(result);

      if (response.ok && result.estado === 'PROCESADO') {
        addToast('DTE Procesado exitosamente', 'success');
      } else {
        addToast(result.descripcionMsg || 'Error en la transmisión', 'error');
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
            <div className={`border rounded-xl overflow-hidden shadow-sm ${respuestaMH.estado === 'PROCESADO' ? 'border-green-300' : 'border-red-300'}`}>
              <div className={`px-4 py-3 border-b ${respuestaMH.estado === 'PROCESADO' ? 'bg-green-50' : 'bg-red-50'}`}>
                <h2 className={`text-lg font-bold ${respuestaMH.estado === 'PROCESADO' ? 'text-green-800' : 'text-red-800'}`}>
                  Respuesta Hacienda: {respuestaMH.estado || 'ERROR'}
                </h2>
                <p className={`text-sm ${respuestaMH.estado === 'PROCESADO' ? 'text-green-600' : 'text-red-600'}`}>
                  {respuestaMH.descripcionMsg || respuestaMH.error || 'Mensaje no disponible'}
                </p>
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
