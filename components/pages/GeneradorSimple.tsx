import React, { useState } from 'react';
import { generarDTE, redondear } from '../../utils/dteGenerator';

export const GeneradorSimple: React.FC = () => {
  const [precio, setPrecio] = useState<number>(0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [descripcion, setDescripcion] = useState<string>('limpi');
  const [resultadoJSON, setResultadoJSON] = useState<string>('');

  const generarJSON = () => {
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
    const totalLinea = redondear(precio * cantidad, 8);
    const base = redondear(totalLinea / 1.13, 8);
    const iva = redondear(totalLinea - base, 2);

    const item = {
      numItem: 1,
      tipoItem: 2, // Servicio
      cantidad: cantidad,
      codigo: null,
      uniMedida: 99,
      descripcion: descripcion,
      precioUni: precio,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: 0,
      ventaGravada: precio > 0 ? totalLinea : 0,
      tributos: precio > 0 ? ['20'] : null,
      ivaItem: precio > 0 ? iva : 0,
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
    setResultadoJSON(JSON.stringify(dte, null, 2));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Generador Simple de DTE (01)</h1>
      
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
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
      >
        Generar JSON
      </button>

      {resultadoJSON && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Resultado JSON</h2>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto text-sm">
            {resultadoJSON}
          </pre>
        </div>
      )}
    </div>
  );
};

export default GeneradorSimple;
