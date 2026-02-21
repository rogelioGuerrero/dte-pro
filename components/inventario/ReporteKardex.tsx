import React, { useState, useEffect } from 'react';
import { FileText, Download, Search, Filter } from 'lucide-react';
import type { ReporteKardex as ReporteKardexType } from '../../types/inventario';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { notify } from '../../utils/notifications';

const ReporteKardex: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [reporte, setReporte] = useState<ReporteKardexType | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    setProductos(inventarioService.getProductos());
  }, []);

  const generarReporte = () => {
    if (!productoSeleccionado) {
      notify('Seleccione un producto', 'error');
      return;
    }

    setLoading(true);
    try {
      const reporteData = inventarioService.generarReporteKardex(productoSeleccionado.id);
      if (reporteData) {
        setReporte(reporteData);
      } else {
        notify('No hay movimientos para este producto', 'info');
        setReporte(null);
      }
    } catch (error) {
      console.error('Error al generar reporte:', error);
      notify('Error al generar el reporte', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!reporte) return;

    const headers = [
      'Fecha',
      'Documento',
      'Tipo',
      'Cantidad',
      'Costo Unitario',
      'Valor',
      'Saldo Cantidad',
      'Saldo Valor'
    ];

    const rows = reporte.movimientos.map(mov => [
      mov.fecha.toLocaleDateString(),
      mov.documento,
      mov.tipo,
      mov.cantidad.toString(),
      mov.costoUnitario.toFixed(2),
      mov.valor.toFixed(2),
      mov.saldoCantidad.toString(),
      mov.saldoValor.toFixed(2)
    ]);

    // Agregar fila de saldo final
    rows.push([
      '',
      '',
      'SALDO FINAL',
      reporte.saldoFinal.cantidad.toString(),
      '',
      '',
      reporte.saldoFinal.cantidad.toString(),
      reporte.saldoFinal.valor.toFixed(2)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kardex_${reporte.descripcion.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    notify('Reporte exportado correctamente', 'success');
  };

  const exportarPDF = () => {
    if (!reporte) return;

    // Crear contenido HTML para imprimir
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kardex - ${reporte.descripcion}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .entrada { color: green; }
            .salida { color: red; }
            .total { background-color: #f9f9f9; font-weight: bold; }
            .header-info { margin-bottom: 20px; }
            .header-info p { margin: 5px 0; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h1>REPORTE KARDEX</h1>
            <p><strong>Producto:</strong> ${reporte.descripcion}</p>
            <p><strong>Código:</strong> ${reporte.codigo}</p>
            <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Costo Unitario</th>
                <th>Valor</th>
                <th>Saldo Cantidad</th>
                <th>Saldo Valor</th>
              </tr>
            </thead>
            <tbody>
              ${reporte.movimientos.map(mov => `
                <tr>
                  <td>${mov.fecha.toLocaleDateString()}</td>
                  <td>${mov.documento}</td>
                  <td class="${mov.tipo === 'ENTRADA' ? 'entrada' : 'salida'}">${mov.tipo}</td>
                  <td>${mov.cantidad}</td>
                  <td>$${mov.costoUnitario.toFixed(2)}</td>
                  <td>$${mov.valor.toFixed(2)}</td>
                  <td>${mov.saldoCantidad}</td>
                  <td>$${mov.saldoValor.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="3">SALDO FINAL</td>
                <td>${reporte.saldoFinal.cantidad}</td>
                <td></td>
                <td></td>
                <td>${reporte.saldoFinal.cantidad}</td>
                <td>$${reporte.saldoFinal.valor.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()">Imprimir</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const productosFiltrados = productos.filter(p =>
    p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Reporte de Kardex
        </h1>
        <p className="text-gray-600 mt-2">
          Genera reportes de movimientos de inventario para cumplir con los requisitos de Hacienda
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Selección de producto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Producto
          </label>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={productoSeleccionado?.id || ''}
              onChange={(e) => {
                const producto = productos.find(p => p.id === e.target.value);
                setProductoSeleccionado(producto || null);
                setReporte(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleccionar producto...</option>
              {productosFiltrados.map(producto => (
                <option key={producto.id} value={producto.id}>
                  {producto.codigo ? `[${producto.codigo}] ` : ''}{producto.descripcion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros de fecha (opcionales) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Inicio (opcional)
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Fin (opcional)
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Botón generar */}
        <button
          onClick={generarReporte}
          disabled={!productoSeleccionado || loading}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <>
              <Filter className="w-4 h-4" />
              Generar Reporte
            </>
          )}
        </button>

        {/* Reporte generado */}
        {reporte && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header del reporte */}
            <div className="bg-gray-50 p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{reporte.descripcion}</h2>
                  <p className="text-sm text-gray-600">
                    Código: {reporte.codigo} | 
                    Movimientos: {reporte.movimientos.length} | 
                    Saldo: {reporte.saldoFinal.cantidad} unidades
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportarCSV}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={exportarPDF}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla de movimientos */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Documento</th>
                    <th className="px-4 py-2 text-center">Tipo</th>
                    <th className="px-4 py-2 text-right">Cantidad</th>
                    <th className="px-4 py-2 text-right">Costo Unitario</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-right">Saldo Cantidad</th>
                    <th className="px-4 py-2 text-right">Saldo Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.movimientos.map((mov, index) => (
                    <tr key={index} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-2">{mov.fecha.toLocaleDateString()}</td>
                      <td className="px-4 py-2 font-mono text-xs">{mov.documento}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          mov.tipo === 'ENTRADA' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{mov.cantidad}</td>
                      <td className="px-4 py-2 text-right">${mov.costoUnitario.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${mov.valor.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{mov.saldoCantidad}</td>
                      <td className="px-4 py-2 text-right">${mov.saldoValor.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan={3} className="px-4 py-2">SALDO FINAL</td>
                    <td className="px-4 py-2 text-right">{reporte.saldoFinal.cantidad}</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right">{reporte.saldoFinal.cantidad}</td>
                    <td className="px-4 py-2 text-right">${reporte.saldoFinal.valor.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Resumen */}
            <div className="bg-gray-50 p-4 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total Entradas</p>
                  <p className="font-semibold text-green-600">
                    {reporte.movimientos
                      .filter(m => m.tipo === 'ENTRADA')
                      .reduce((sum, m) => sum + m.cantidad, 0)} unidades
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Total Salidas</p>
                  <p className="font-semibold text-red-600">
                    {reporte.movimientos
                      .filter(m => m.tipo === 'SALIDA')
                      .reduce((sum, m) => sum + m.cantidad, 0)} unidades
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Valor del Inventario</p>
                  <p className="font-semibold text-blue-600">
                    ${reporte.saldoFinal.valor.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporteKardex;
