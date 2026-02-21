import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, AlertCircle, Star, DollarSign, TrendingUp } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { ProductoImagen } from './ProductoImagen';
import { formatMoneda } from '../libros/librosConfig';

export interface ProductoFactura {
  id: string;
  codigo: string;
  descripcion: string;
  tipoItem: number;
  precioUnitario: number;
  unidadMedida: string;
  cantidad?: number;
}

interface SelectorProductosFacturaProps {
  onProductoSeleccionado: (productoFactura: ProductoFactura) => void;
  productosExistentes?: ProductoFactura[]; // Para evitar duplicados
}

const SelectorProductosFactura: React.FC<SelectorProductosFacturaProps> = ({
  onProductoSeleccionado,
  productosExistentes = []
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [precioUnitario, setPrecioUnitario] = useState(0);
  const [alertaPrecio, setAlertaPrecio] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Productos favoritos para acceso rápido
  const [favoritos, setFavoritos] = useState<Producto[]>([]);

  useEffect(() => {
    // Cargar productos favoritos
    const todosProductos = inventarioService.getProductos();
    setFavoritos(todosProductos.filter(p => p.esFavorito).slice(0, 5));
  }, []);

  // Buscar productos
  useEffect(() => {
    if (busqueda.length >= 2) {
      const resultadosBusqueda = inventarioService.buscarProductosFacturacion(busqueda);
      
      // Filtrar productos ya agregados
      const productosDisponibles = resultadosBusqueda.filter(producto => 
        !productosExistentes.some(pe => pe.id === producto.id)
      );
      
      setResultados(productosDisponibles);
      setMostrarResultados(true);
    } else {
      setResultados([]);
      setMostrarResultados(false);
    }
  }, [busqueda, productosExistentes]);

  // Click fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setMostrarResultados(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seleccionar producto de los resultados
  const seleccionarProducto = (producto: Producto) => {
    setProductoSeleccionado(producto);
    setCantidad(1);
    setPrecioUnitario(producto.precioSugerido);
    setBusqueda(producto.descripcion);
    setMostrarResultados(false);
    
    // Verificar si vende bajo costo
    if (precioUnitario > 0 && precioUnitario < producto.costoPromedio) {
      setAlertaPrecio(true);
    } else {
      setAlertaPrecio(false);
    }
  };

  // Seleccionar favorito
  const seleccionarFavorito = (producto: Producto) => {
    seleccionarProducto(producto);
  };

  // Cambiar precio
  const handlePrecioChange = (nuevoPrecio: number) => {
    setPrecioUnitario(nuevoPrecio);
    
    if (productoSeleccionado && nuevoPrecio < productoSeleccionado.costoPromedio) {
      setAlertaPrecio(true);
    } else {
      setAlertaPrecio(false);
    }
  };

  // Agregar a la factura
  const handleAgregarProducto = () => {
    if (!productoSeleccionado) return;

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (productoSeleccionado.gestionarInventario && cantidad > productoSeleccionado.existenciasTotales) {
      if (!confirm(`Stock insuficiente. Stock actual: ${productoSeleccionado.existenciasTotales}. ¿Desea continuar?`)) {
        return;
      }
    }

    const productoFactura: ProductoFactura = {
      id: productoSeleccionado.id,
      codigo: productoSeleccionado.codigo || '',
      descripcion: productoSeleccionado.descripcion,
      tipoItem: 1, // Bienes por defecto
      precioUnitario: precioUnitario,
      unidadMedida: '59', // Unidad por defecto
      cantidad: cantidad
    };

    onProductoSeleccionado(productoFactura);
    
    // Resetear formulario
    setProductoSeleccionado(null);
    setBusqueda('');
    setCantidad(1);
    setPrecioUnitario(0);
    setAlertaPrecio(false);
  };

  // Limpiar selección
  const handleLimpiar = () => {
    setProductoSeleccionado(null);
    setBusqueda('');
    setCantidad(1);
    setPrecioUnitario(0);
    setAlertaPrecio(false);
    setMostrarResultados(false);
  };

  // Calcular margen
  const calcularMargen = () => {
    if (!productoSeleccionado || precioUnitario === 0) return 0;
    return ((precioUnitario - productoSeleccionado.costoPromedio) / productoSeleccionado.costoPromedio) * 100;
  };

  const margen = calcularMargen();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Agregar Producto</h3>

      {/* Productos Favoritos */}
      {favoritos.length > 0 && !productoSeleccionado && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Productos frecuentes:</p>
          <div className="flex flex-wrap gap-2">
            {favoritos.map(producto => (
              <button
                key={producto.id}
                onClick={() => seleccionarFavorito(producto)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-yellow-200 hover:bg-yellow-50 text-gray-700 rounded-lg text-sm transition-colors shadow-sm"
              >
                {producto.hasImage ? (
                  <ProductoImagen producto={producto} className="w-6 h-6 rounded" />
                ) : (
                  <Star className="w-3 h-3 text-yellow-500 fill-current" />
                )}
                <span className="truncate max-w-[150px]">
                  {producto.descripcion}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto por descripción o código..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Resultados de búsqueda */}
        {mostrarResultados && resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {resultados.map(producto => (
              <button
                key={producto.id}
                onClick={() => seleccionarProducto(producto)}
                className="w-full px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{producto.descripcion}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Stock: {producto.existenciasTotales}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatMoneda(producto.precioSugerido)}
                      </span>
                    </div>
                  </div>
                  {producto.esFavorito && (
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detalles del producto seleccionado */}
      {productoSeleccionado && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-medium text-gray-900">{productoSeleccionado.descripcion}</h4>
              <p className="text-sm text-gray-500">
                Código: {productoSeleccionado.codigo || 'N/A'} | 
                Categoría: {productoSeleccionado.categoria}
              </p>
            </div>
            <button
              onClick={handleLimpiar}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Información de stock y costo */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`p-2 rounded ${productoSeleccionado.existenciasTotales === 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs text-gray-600">Stock disponible</p>
              <p className={`font-semibold ${productoSeleccionado.existenciasTotales === 0 ? 'text-red-600' : 'text-green-600'}`}>
                {productoSeleccionado.existenciasTotales} unidades
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-gray-600">Costo promedio</p>
              <p className="font-semibold text-blue-600">
                {formatMoneda(productoSeleccionado.costoPromedio)}
              </p>
            </div>
          </div>

          {/* Campos de entrada */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Unitario
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precioUnitario}
                  onChange={(e) => handlePrecioChange(parseFloat(e.target.value) || 0)}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    alertaPrecio ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Alertas y sugerencias */}
          {alertaPrecio && (
            <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">
                  Vendiendo por debajo del costo
                </p>
                <p className="text-xs text-red-600">
                  Costo: {formatMoneda(productoSeleccionado.costoPromedio)} | 
                  Precio: {formatMoneda(precioUnitario)} | 
                  Pérdida: {formatMoneda(productoSeleccionado.costoPromedio - precioUnitario)}
                </p>
              </div>
            </div>
          )}

          {margen !== 0 && !alertaPrecio && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-800">
                Margen de ganancia: {margen.toFixed(1)}%
              </p>
            </div>
          )}

          {/* Total */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Total:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatMoneda(cantidad * precioUnitario)}
              </span>
            </div>
          </div>

          {/* Botón agregar */}
          <button
            onClick={handleAgregarProducto}
            className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Agregar a la Factura
          </button>
        </div>
      )}
    </div>
  );
};

export default SelectorProductosFactura;
