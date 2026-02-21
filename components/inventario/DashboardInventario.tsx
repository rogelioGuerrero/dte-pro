import React, { useState, useEffect } from 'react';
import { Package, TrendingDown, AlertTriangle, DollarSign, Download, Settings } from 'lucide-react';
import { ResumenInventario, Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { formatMoneda } from '../libros/librosConfig';

const DashboardInventario: React.FC = () => {
  const [resumen, setResumen] = useState<ResumenInventario | null>(null);
  const [productosBajoStock, setProductosBajoStock] = useState<Producto[]>([]);
  const [productosSinStock, setProductosSinStock] = useState<Producto[]>([]);
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'año'>('mes');

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = () => {
    const resumenData = inventarioService.generarResumenInventario();
    setResumen(resumenData);

    const todosProductos = inventarioService.getProductos();
    const config = inventarioService.getConfig();

    // Productos bajo stock
    const bajoStock = todosProductos.filter(p => 
      p.gestionarInventario && 
      p.existenciasTotales > 0 && 
      p.existenciasTotales < config.alertaBajoStock
    );
    setProductosBajoStock(bajoStock);

    // Productos sin stock
    const sinStock = todosProductos.filter(p => 
      p.gestionarInventario && 
      p.existenciasTotales === 0
    );
    setProductosSinStock(sinStock);
  };

  const getIconoCategoria = (categoria: string) => {
    const iconos: { [key: string]: string } = {
      'Eléctricos': '⚡',
      'Cocina': '🍳',
      'Limpieza': '🧹',
      'Herramientas': '🔧',
      'Ferretería': '🔩',
      'Pintura': '🎨',
      'Fontanería': '🚰',
      'Iluminación': '💡',
      'Oficina': '📎',
      'Electrónica': '📱',
      'Construcción': '🏗️',
      'Varios': '📦'
    };
    return iconos[categoria] || '📦';
  };

  const getColorPorcentaje = (porcentaje: number) => {
    if (porcentaje > 70) return 'text-green-600';
    if (porcentaje > 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const exportarReporte = () => {
    const csv = inventarioService.exportarInventarioCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!resumen) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Inventario</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-auto"
          >
            <option value="mes">Último mes</option>
            <option value="trimestre">Último trimestre</option>
            <option value="año">Último año</option>
          </select>
          <button
            onClick={exportarReporte}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            <span className="sm:hidden">Exportar</span>
            <span className="hidden sm:inline">Exportar Reporte</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">{resumen.totalProductos}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valor Inventario</p>
              <p className="text-2xl font-bold text-gray-900">{formatMoneda(resumen.valorTotalInventario)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bajo Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{resumen.productosBajoStock}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sin Stock</p>
              <p className="text-2xl font-bold text-red-600">{resumen.sinInventario}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Inventario por Categorías */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventario por Categorías</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(resumen.categorias).map(([categoria, data]) => {
            const porcentajeValor = (data.valor / resumen.valorTotalInventario) * 100;
            const porcentajeCantidad = (data.cantidad / 
              Object.values(resumen.categorias).reduce((sum, c) => sum + c.cantidad, 0)) * 100;

            return (
              <div key={categoria} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getIconoCategoria(categoria)}</span>
                    <h3 className="font-medium text-gray-900">{categoria}</h3>
                  </div>
                  <span className="text-sm text-gray-500">{data.productos} productos</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Valor</span>
                      <span className="font-medium">{formatMoneda(data.valor)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${porcentajeValor}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${getColorPorcentaje(porcentajeValor)}`}>
                      {porcentajeValor.toFixed(1)}% del total
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Unidades</span>
                      <span className="font-medium">{data.cantidad}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${porcentajeCantidad}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {porcentajeCantidad.toFixed(1)}% del total
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alertas de Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos bajo stock */}
        {productosBajoStock.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-yellow-600 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Productos con Stock Bajo
            </h2>
            <div className="space-y-2">
              {productosBajoStock.slice(0, 5).map(producto => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{producto.descripcion}</p>
                    <p className="text-sm text-gray-500">{producto.categoria}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-600">{producto.existenciasTotales} unid</p>
                    <p className="text-sm text-gray-500">{formatMoneda(producto.costoPromedio)} c/u</p>
                  </div>
                </div>
              ))}
              {productosBajoStock.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  Y {productosBajoStock.length - 5} más...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Productos sin stock */}
        {productosSinStock.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Productos sin Stock
            </h2>
            <div className="space-y-2">
              {productosSinStock.slice(0, 5).map(producto => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{producto.descripcion}</p>
                    <p className="text-sm text-gray-500">{producto.categoria}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">AGOTADO</p>
                    <p className="text-sm text-gray-500">{formatMoneda(producto.costoPromedio)} c/u</p>
                  </div>
                </div>
              ))}
              {productosSinStock.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  Y {productosSinStock.length - 5} más...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Configuración rápida */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configuración de Inventario
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Margen de Ganancia Sugerido
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={(inventarioService.getConfig().margenSugerido * 100)}
                onChange={(e) => {
                  inventarioService.setConfig({
                    margenSugerido: parseFloat(e.target.value) / 100
                  });
                }}
                className="w-20 px-3 py-1 border border-gray-300 rounded-lg"
              />
              <span className="text-gray-500">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alerta de Bajo Stock
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={inventarioService.getConfig().alertaBajoStock}
                onChange={(e) => {
                  inventarioService.setConfig({
                    alertaBajoStock: parseInt(e.target.value) || 5
                  });
                }}
                className="w-20 px-3 py-1 border border-gray-300 rounded-lg"
              />
              <span className="text-gray-500">unidades</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Método de Costeo
            </label>
            <select
              value={inventarioService.getConfig().metodoCosteo}
              onChange={(e) => {
                inventarioService.setConfig({
                  metodoCosteo: e.target.value as any
                });
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg"
            >
              <option value="UEPS">UEPS (Últimas entradas)</option>
              <option value="PEPS">PEPS (Primeras entradas)</option>
              <option value="PROMEDIO">Costo Promedio</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardInventario;
