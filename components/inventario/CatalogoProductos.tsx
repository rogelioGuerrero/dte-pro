import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Package, Edit, Trash2, Star, StarOff, Upload, Download, AlertCircle, Settings, Ban, CheckCircle2, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { notify } from '../../utils/notifications';
import { loadSettings } from '../../utils/settings';
import { formatMoneda } from '../libros/librosConfig';
import FormularioProducto from './FormularioProducto';
import PreValidacionModal from './PreValidacionModal';
import { ProductoImagen } from './ProductoImagen';

 type AccionPreValidacion = 'crear' | 'actualizar' | 'asociar' | 'omitir';

 const detectarPresentacionSimple = (descripcion: string): string => {
  const d = (descripcion || '').toUpperCase();
  if (!d) return 'UNIDAD';
  if (/(\bDOCENA\b|\b12\s*U\b)/.test(d)) return 'DOCENA';
  if (/(\bCAJA\b|\bCJ\b)/.test(d)) return 'CAJA';
  if (/(\bSACO\b|\bBULTO\b)/.test(d)) return 'SACO';
  if (/(\bPAQUETE\b|\bPQT\b)/.test(d)) return 'PAQUETE';
  if (/(\bBOLSA\b)/.test(d)) return 'BOLSA';
  if (/(\bBOTELLA\b)/.test(d)) return 'BOTELLA';
  return 'UNIDAD';
 };

interface CatalogoProductosProps {
  onProductoSelect?: (producto: Producto) => void;
  onProductoEdit?: (producto: Producto) => void;
  onOpenConfig?: () => void;
  modoSeleccion?: boolean; // Si es true, solo permite seleccionar productos
}

const CatalogoProductos: React.FC<CatalogoProductosProps> = ({ 
  onProductoSelect, 
  onProductoEdit,
  onOpenConfig,
  modoSeleccion = false 
}) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [mostrarPreValidacion, setMostrarPreValidacion] = useState(false);
  const [analisisPreValidacion, setAnalisisPreValidacion] = useState<any>(null);
  const [filesPendientes, setFilesPendientes] = useState<File[]>([]);
  const [mostrarModalEntrada, setMostrarModalEntrada] = useState(false);
  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);
  const [formularioMovimiento, setFormularioMovimiento] = useState({
    cantidad: '',
    costoUnitario: '',
    documentoReferencia: '',
    proveedorNombre: '',
    motivo: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    // React/TSX no siempre refleja bien webkitdirectory; setAttribute es más confiable
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
    el.setAttribute('mozdirectory', '');
  }, []);

  const cargarDatos = () => {
    setProductos(inventarioService.getProductos());
  };

  const handleRevertirUltimaCompra = async () => {
    const ok = window.confirm(
      'Revertir la última importación de compras eliminará los movimientos/lotes creados por esa compra (como si no hubiera pasado). Solo se permite si no hay movimientos posteriores. ¿Continuar?'
    );
    if (!ok) return;

    setLoading(true);
    try {
      const r = inventarioService.revertirUltimaImportacionCompras();
      if (!r.ok) {
        notify(r.message, 'error');
        return;
      }
      cargarDatos();
      notify(
        `Compra revertida (${r.docRef}). Movimientos eliminados: ${r.movimientosEliminados}, lotes eliminados: ${r.lotesEliminados}, productos eliminados: ${r.productosEliminados}`,
        'success'
      );
    } catch (e: any) {
      notify(e?.message || 'No se pudo revertir la compra', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos
  const productosFiltrados = productos.filter(producto => {
    const cumpleBusqueda = !busqueda || 
      producto.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      producto.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      producto.codigoPrincipal?.toLowerCase().includes(busqueda.toLowerCase());

    const cumpleCategoria = categoriaFiltro === 'todos' || producto.categoria === categoriaFiltro;

    return cumpleBusqueda && cumpleCategoria;
  });

  // Obtener categorías únicas
  const categorias = ['todos', ...Array.from(new Set(productos.map(p => p.categoria)))];

  // Analizar JSON para pre-validación
  const analizarJSONParaPreValidacion = async (files: File[]) => {
    const categoriasDisponibles = Array.from(
      new Set(
        (inventarioService.getProductos() || [])
          .map((p) => (p?.categoria || '').toString().trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    const items: Array<{
      jsonIndex: number;
      fileName: string;
      itemIndex: number;
      descripcion: string;
      codigo: string;
      cantidad: number;
      precioUni: number;
      proveedor: string;
      docRef: string;
      accion: AccionPreValidacion;
      productoExistente?: Producto;
      productosSimilares: Array<{ producto: Producto; score: number }>;
      seleccionado: boolean;
      razon: string;
      presentacion: string;
      requiereFactor: boolean;
      categoriaSugerida: string;
    }> = [];
    let nuevos = 0;
    let actualizar = 0;
    let asociar = 0;
    let omitir = 0;

    // Obtener umbrales
    let autoThreshold = 0.9;
    let askThreshold = 0.75;
    try {
      const s = loadSettings();
      autoThreshold = typeof s.inventoryAutoMatchThreshold === 'number' ? s.inventoryAutoMatchThreshold : autoThreshold;
      askThreshold = typeof s.inventoryAskMatchThreshold === 'number' ? s.inventoryAskMatchThreshold : askThreshold;
    } catch {
      // usar defaults
    }

    for (let jsonIndex = 0; jsonIndex < files.length; jsonIndex++) {
      const file = files[jsonIndex];
      try {
        const texto = await file.text();
        const json = JSON.parse(texto);

        const isCompraDTE = Boolean(json?.identificacion?.numeroControl && Array.isArray(json?.cuerpoDocumento));
        
        if (!isCompraDTE) {
          // Si no es DTE de compras, se omite del análisis
          continue;
        }

        const docRef = json?.identificacion?.numeroControl || `DOC-${jsonIndex + 1}`;
        const proveedorNombre = json?.emisor?.nombre || 'Proveedor desconocido';
        
        // Analizar cada item del DTE
        for (let itemIndex = 0; itemIndex < json.cuerpoDocumento.length; itemIndex++) {
          const item = json.cuerpoDocumento[itemIndex];

          const codigoItem = (item?.codigo || '').trim();
          const descripcion = item?.descripcion || '';
          const cantidad = Number(item?.cantidad) || 0;
          const precioUni = Number(item?.precioUni) || 0;
          const presentacion = detectarPresentacionSimple(descripcion);

          // Determinar acción
          let accion: AccionPreValidacion = 'crear';
          let productoExistente: Producto | undefined;
          let productosSimilares: Array<{ producto: Producto; score: number }> = [];
          let razon = '';
          let requiereFactor = false;
          let categoriaSugerida = 'Varios';

          // Solo bienes (tipoItem 1)
          if (item?.tipoItem !== 1) {
            accion = 'omitir';
            razon = 'No es un bien (tipoItem distinto de 1)';
          }

          if (!descripcion || cantidad <= 0) {
            accion = 'omitir';
            razon = !descripcion ? 'Sin descripción' : 'Cantidad inválida';
          }

          if (accion !== 'omitir') {
            // 1) Buscar por código
            if (codigoItem) {
              const byCode = inventarioService.findProductoByCodigo(codigoItem);
              if (byCode) {
                productoExistente = byCode;
                accion = 'actualizar';
                razon = 'Coincide por código';
              }
            }
          }

          // 2) Si no hay match por código, buscar por similitud
          if (accion !== 'omitir' && !productoExistente) {
            productosSimilares = inventarioService.sugerirProductosPorDescripcion(descripcion, askThreshold, 5);

            if (productosSimilares.length > 0) {
              const top = productosSimilares[0];
              const score = top.score;

              if (score >= autoThreshold) {
                productoExistente = top.producto;
                accion = 'actualizar';
                razon = `Similaridad ${(score * 100).toFixed(1)}% (auto-match)`;
              } else if (score >= askThreshold) {
                accion = 'asociar';
                // default: sugerir el mejor match; el usuario puede desmarcarlo
                productoExistente = top.producto;
                razon = `Similaridad ${(score * 100).toFixed(1)}% - requiere confirmación`;
              } else {
                accion = 'crear';
                razon = 'Sin productos similares encontrados';
              }
            } else {
              accion = 'crear';
              razon = 'Producto nuevo - sin coincidencias';
            }
          }

          // Categoría sugerida (incluye custom existentes)
          categoriaSugerida = (
            productoExistente?.categoria ||
            productosSimilares?.[0]?.producto?.categoria ||
            'Varios'
          ).toString().trim() || 'Varios';
          if (!categoriasDisponibles.includes(categoriaSugerida) && categoriaSugerida) {
            categoriasDisponibles.push(categoriaSugerida);
            categoriasDisponibles.sort((a, b) => a.localeCompare(b));
          }

          // Factor requerido: si viene en CAJA/DOCENA/... y no se conoce el factor
          if (accion !== 'omitir' && presentacion !== 'UNIDAD') {
            const presUpper = presentacion.toUpperCase();
            const factorKnown = Boolean(
              productoExistente?.presentaciones?.some(
                (x) => (x?.nombre || '').toString().trim().toUpperCase() === presUpper && Number(x?.factor) > 0
              )
            );
            // Para producto nuevo o sin presentación definida: exigir factor
            requiereFactor = !factorKnown;
          }

          // Contar por acción
          switch (accion) {
            case 'crear': nuevos++; break;
            case 'actualizar': actualizar++; break;
            case 'asociar': asociar++; break;
            case 'omitir': omitir++; break;
          }

          items.push({
            jsonIndex,
            fileName: file.name,
            itemIndex,
            descripcion,
            codigo: codigoItem,
            cantidad,
            precioUni,
            proveedor: proveedorNombre,
            docRef,
            accion,
            productoExistente,
            productosSimilares,
            seleccionado: accion !== 'omitir',
            razon,
            presentacion,
            requiereFactor,
            categoriaSugerida,
          });
        }
      } catch (e) {
        console.error('Error analizando archivo:', file.name, e);
      }
    }

    return {
      items,
      categoriasDisponibles,
      resumen: {
        nuevos,
        actualizar,
        asociar,
        omitir,
        total: items.length
      }
    };
  };

  // Importar JSON de compras con pre-validación
  const handleImportarJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    // Copiar antes de limpiar el input
    const files = Array.from(fileList);
    event.target.value = '';

    setLoading(true);
    try {
      // 1) Importar catálogos inmediatamente (comportamiento anterior)
      let catalogoCreados = 0;
      let catalogoActualizados = 0;
      let catalogoOmitidos = 0;
      let errores = 0;

      const compraFiles: File[] = [];

      for (const file of files) {
        try {
          const texto = await file.text();
          const json = JSON.parse(texto);
          const isCompraDTE = Boolean(json?.identificacion?.numeroControl && Array.isArray(json?.cuerpoDocumento));
          const isCatalogo = Array.isArray(json) || Array.isArray(json?.productos);

          if (isCompraDTE) {
            compraFiles.push(file);
          } else if (isCatalogo) {
            const r = inventarioService.importarCatalogoProductosJSON(json);
            catalogoCreados += r.creados;
            catalogoActualizados += r.actualizados;
            catalogoOmitidos += r.omitidos;
          } else {
            throw new Error('JSON no reconocido (no es DTE de compras ni catálogo de productos)');
          }
        } catch (e) {
          console.error('Error al importar/analizar JSON:', file?.name, e);
          errores += 1;
        }
      }

      if (catalogoCreados + catalogoActualizados + catalogoOmitidos > 0) {
        notify(
          `Catálogo importado:` +
            ` ${catalogoCreados} nuevos, ${catalogoActualizados} actualizados, ${catalogoOmitidos} omitidos` +
            (errores > 0 ? `; errores: ${errores}` : ''),
          errores > 0 ? 'error' : 'success'
        );
      }

      // 2) Compras: abrir pre-validación
      if (compraFiles.length === 0) {
        cargarDatos();
        return;
      }

      const analisis = await analizarJSONParaPreValidacion(compraFiles);

      if (analisis.items.length === 0) {
        notify('No se encontraron productos válidos para importar en compras', 'info');
        cargarDatos();
        return;
      }

      setFilesPendientes(compraFiles);
      setAnalisisPreValidacion(analisis);
      setMostrarPreValidacion(true);
    } catch (error) {
      console.error('Error al analizar JSON:', error);
      notify('Error al analizar los archivos JSON', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar importación después de pre-validación
  const handleConfirmarImportacion = async (confirmaciones: { item: any; recordar: boolean; categoria?: string; factorConversion?: number }[]) => {
    setLoading(true);
    try {
      let productosCreados = 0;
      let productosActualizados = 0;
      let pendientes = 0;
      const comprasDocRefs: string[] = [];
      const comprasProductosCreados: string[] = [];

      // Procesar solo los archivos confirmados
      const archivosProcesar = new Set(confirmaciones.map(c => c.item.fileName));
      const archivosConfirmados = filesPendientes.filter(f => archivosProcesar.has(f.name));

      for (const file of archivosConfirmados) {
        try {
          const texto = await file.text();
          const json = JSON.parse(texto);

          if (!json?.identificacion?.numeroControl || !Array.isArray(json?.cuerpoDocumento)) {
            continue;
          }

          // Filtrar items confirmados para este archivo
          const itemsConfirmadosArchivo = confirmaciones
            .filter(c => c.item.fileName === file.name)
            .map(c => ({
              itemIndex: c.item.itemIndex,
              recordar: c.recordar,
              accion: c.item.accion,
              productoId: c.item.productoExistente?.id,
              categoria: c.categoria,
              factorConversion: c.factorConversion,
            }));

          if (itemsConfirmadosArchivo.length === 0) {
            continue;
          }

          // Procesar importación con items confirmados
          const resultado = await inventarioService.importarComprasJSONConConfirmacion(
            json,
            itemsConfirmadosArchivo
          );

          productosCreados += resultado.productosCreados;
          productosActualizados += resultado.productosActualizados;
          pendientes += resultado.pendientes;
          
          if (resultado.docRef) comprasDocRefs.push(resultado.docRef);
          if (Array.isArray(resultado.productosCreadosIds)) {
            comprasProductosCreados.push(...resultado.productosCreadosIds);
          }
        } catch (e) {
          console.error('Error al importar archivo:', file.name, e);
        }
      }

      notify(
        `Importación completada:` +
          ` ${productosCreados} nuevos, ${productosActualizados} actualizados, ${pendientes} pendientes`,
        pendientes > 0 ? 'info' : 'success'
      );

      if (comprasDocRefs.length > 0) {
        inventarioService.marcarUltimaImportacionCompraBatch({
          docRefs: comprasDocRefs,
          productosCreados: comprasProductosCreados,
        });
      }

      cargarDatos();
      
      // Limpiar estado
      setFilesPendientes([]);
      setAnalisisPreValidacion(null);
      setMostrarPreValidacion(false);
    } catch (error) {
      console.error('Error en la importación:', error);
      notify('Error al importar los productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Exportar inventario
  const handleExportarCSV = () => {
    const csv = inventarioService.exportarInventarioCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Toggle favorito
  const toggleFavorito = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId);
    if (producto) {
      producto.esFavorito = !producto.esFavorito;
      inventarioService.actualizarProducto(producto);
      setProductos([...productos]);
    }
  };

  // Seleccionar producto
  const handleSelectProducto = (producto: Producto) => {
    if (modoSeleccion && onProductoSelect) {
      onProductoSelect(producto);
    } else {
      setProductoSeleccionado(producto);
    }
  };

  // Eliminar producto
  const handleEliminarProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    const label = p ? p.descripcion : 'este producto';
    if (!confirm(`¿Está seguro de eliminar ${label}?`)) return;

    try {
      inventarioService.eliminarProducto(productoId);
      setProductos((prev) => prev.filter((x) => x.id !== productoId));
      setProductoSeleccionado((prev) => (prev?.id === productoId ? null : prev));
      setEditandoProducto((prev) => (prev?.id === productoId ? null : prev));
      notify('Producto eliminado', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo eliminar el producto', 'error');
    }
  };

  const handleToggleActivo = (productoId: string, activar: boolean) => {
    try {
      if (activar) {
        inventarioService.reactivarProducto(productoId);
        notify('Producto reactivado', 'success');
      } else {
        inventarioService.desactivarProducto(productoId);
        notify('Producto desactivado', 'info');
      }
      cargarDatos();
    } catch (e: any) {
      notify(e?.message || 'No se pudo actualizar el producto', 'error');
    }
  };

  // Obtener color de stock
  const getColorStock = (existencias: number) => {
    if (existencias === 0) return 'text-red-600 bg-red-50';
    if (existencias < 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  // Obtener ícono de categoría
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

  return (
    <div className="max-w-7xl mx-auto">
      <input
        id="import-json"
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={handleImportarJSON}
      />
      <input
        id="import-folder"
        ref={folderInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={handleImportarJSON}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-900">Catálogo de Productos</h2>
          <p className="text-gray-600">Gestiona tu inventario y productos</p>
        </div>
        <div className="flex flex-wrap sm:justify-end items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => document.getElementById('import-json')?.click()}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            Importar
          </button>

          <button
            onClick={() => document.getElementById('import-folder')?.click()}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            Importar carpeta
          </button>

          <button
            onClick={handleRevertirUltimaCompra}
            disabled={loading}
            title="Revertir la última importación de compras (deshace la última carga de JSON de compras)"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Revertir
          </button>

          <button
            onClick={handleExportarCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>

          {onOpenConfig && (
            <button
              onClick={onOpenConfig}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          )}

          <button
            onClick={() => setMostrarFormulario(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por descripción, código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categorias.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'todos' ? 'Todas las categorías' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {busqueda || categoriaFiltro !== 'todos'
                ? 'No se encontraron productos con los filtros seleccionados'
                : 'No hay productos en el inventario'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productosFiltrados.map((producto) => (
              <div
                key={producto.id}
                onClick={() => handleSelectProducto(producto)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  productoSeleccionado?.id === producto.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${producto.activo === false ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="text-xs text-gray-500">
                    {getIconoCategoria(producto.categoria)} {producto.categoria}
                  </div>

                  {!modoSeleccion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorito(producto.id);
                      }}
                      className="text-yellow-500 hover:text-yellow-600 transition-colors"
                    >
                      {producto.esFavorito ? (
                        <Star className="w-4 h-4 fill-current" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <div className="flex gap-3 mb-3">
                  <ProductoImagen 
                    producto={producto} 
                    className="w-16 h-16 flex-shrink-0" 
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm sm:text-base">
                      {producto.descripcion}
                    </h3>
                    <div className="mt-1 text-xs text-gray-500 truncate">
                      {producto.codigo || 'Sin código'}
                    </div>
                  </div>
                </div>

                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3 ${getColorStock(
                    producto.existenciasTotales
                  )}`}
                >
                  <Package className="w-3 h-3" />
                  Stock: {producto.existenciasTotales}
                </div>

                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Costo:</span>
                    <span className="font-medium">{formatMoneda(producto.costoPromedio)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Sugerido:</span>
                    <span className="font-semibold text-green-600">{formatMoneda(producto.precioSugerido)}</span>
                  </div>
                </div>

                {producto.existenciasTotales > 0 && producto.existenciasTotales < 5 && (
                  <div className="flex items-center gap-1 text-yellow-600 text-xs mb-2">
                    <AlertCircle className="w-3 h-3" />
                    Stock bajo
                  </div>
                )}

                {producto.proveedores.length > 0 && (
                  <div className="text-xs text-gray-400">
                    Proveedores: {producto.proveedores.slice(0, 2).join(', ')}
                    {producto.proveedores.length > 2 && ` (+${producto.proveedores.length - 2})`}
                  </div>
                )}

                {!modoSeleccion && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onProductoEdit) {
                          onProductoEdit(producto);
                        } else {
                          setEditandoProducto(producto);
                          setMostrarFormulario(true);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Editar
                    </button>

                    {producto.activo === false ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActivo(producto.id, true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-white border border-gray-200 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Reactivar
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActivo(producto.id, false);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Ban className="w-3 h-3" />
                        Desactivar
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminarProducto(producto.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de detalles (solo si no está en modo selección) */}
      {!modoSeleccion && productoSeleccionado && (
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">Detalles del Producto</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Información General</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Código:</dt>
                  <dd className="font-mono">{productoSeleccionado.codigo || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Categoría:</dt>
                  <dd>{productoSeleccionado.categoria}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fecha última compra:</dt>
                  <dd>{productoSeleccionado.fechaUltimaCompra.toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Gestionar inventario:</dt>
                  <dd>{productoSeleccionado.gestionarInventario ? 'Sí' : 'No'}</dd>
                </div>
              </dl>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Información de Inventario</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Existencias:</dt>
                  <dd className={productoSeleccionado.existenciasTotales === 0 ? 'text-red-600 font-medium' : ''}>
                    {productoSeleccionado.existenciasTotales} unidades
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Costo promedio:</dt>
                  <dd>{formatMoneda(productoSeleccionado.costoPromedio)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Valor total:</dt>
                  <dd>{formatMoneda(productoSeleccionado.existenciasTotales * productoSeleccionado.costoPromedio)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Lotes:</dt>
                  <dd>{productoSeleccionado.lotes.length}</dd>
                </div>
              </dl>

              {/* Botones de ajuste manual de inventario */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFormularioMovimiento({
                        cantidad: '',
                        costoUnitario: productoSeleccionado.costoPromedio.toFixed(2),
                        documentoReferencia: '',
                        proveedorNombre: '',
                        motivo: ''
                      });
                      setMostrarModalEntrada(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <TrendingUp className="w-3 h-3" />
                    Añadir Stock
                  </button>
                  <button
                    onClick={() => {
                      setFormularioMovimiento({
                        cantidad: '',
                        costoUnitario: '',
                        documentoReferencia: '',
                        proveedorNombre: '',
                        motivo: ''
                      });
                      setMostrarModalSalida(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <TrendingDown className="w-3 h-3" />
                    Salida Manual
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Formulario flotante */}
      {mostrarFormulario && (
        <FormularioProducto
          producto={editandoProducto}
          onClose={() => {
            setMostrarFormulario(false);
            setEditandoProducto(null);
          }}
          onSave={(_producto) => {
            cargarDatos();
            setMostrarFormulario(false);
            setEditandoProducto(null);
          }}
        />
      )}

      {mostrarPreValidacion && analisisPreValidacion && (
        <PreValidacionModal
          isOpen={mostrarPreValidacion}
          analisis={analisisPreValidacion}
          onClose={() => {
            setMostrarPreValidacion(false);
            setAnalisisPreValidacion(null);
            setFilesPendientes([]);
          }}
          onConfirm={handleConfirmarImportacion}
        />
      )}

      {/* Modal para entrada manual de stock */}
      {mostrarModalEntrada && productoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Añadir Stock - {productoSeleccionado.descripcion}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad *
                </label>
                <input
                  type="number"
                  value={formularioMovimiento.cantidad}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, cantidad: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo Unitario
                </label>
                <input
                  type="number"
                  value={formularioMovimiento.costoUnitario}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, costoUnitario: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dejar vacío para usar costo promedio actual ({formatMoneda(productoSeleccionado.costoPromedio)})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento de Referencia
                </label>
                <input
                  type="text"
                  value={formularioMovimiento.documentoReferencia}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, documentoReferencia: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: FACT-001, AJUSTE_MANUAL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor
                </label>
                <input
                  type="text"
                  value={formularioMovimiento.proveedorNombre}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, proveedorNombre: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre del proveedor (opcional)"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setMostrarModalEntrada(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const cantidad = Number(formularioMovimiento.cantidad);
                  if (!cantidad || cantidad <= 0) {
                    notify('Cantidad inválida', 'error');
                    return;
                  }

                  setLoading(true);
                  try {
                    await inventarioService.registrarEntradaManual({
                      productoId: productoSeleccionado.id,
                      cantidad,
                      costoUnitario: formularioMovimiento.costoUnitario ? Number(formularioMovimiento.costoUnitario) : undefined,
                      documentoReferencia: formularioMovimiento.documentoReferencia || 'AJUSTE_MANUAL',
                      proveedorNombre: formularioMovimiento.proveedorNombre || 'AJUSTE'
                    });
                    
                    notify('Stock añadido correctamente', 'success');
                    cargarDatos();
                    setProductoSeleccionado(inventarioService.getProductoById(productoSeleccionado.id));
                    setMostrarModalEntrada(false);
                  } catch (e: any) {
                    notify(e?.message || 'Error al añadir stock', 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Añadir Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para salida manual de stock */}
      {mostrarModalSalida && productoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Salida Manual - {productoSeleccionado.descripcion}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad *
                </label>
                <input
                  type="number"
                  value={formularioMovimiento.cantidad}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, cantidad: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0.01"
                  max={productoSeleccionado.existenciasTotales}
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Stock disponible: {productoSeleccionado.existenciasTotales} unidades
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento de Referencia
                </label>
                <input
                  type="text"
                  value={formularioMovimiento.documentoReferencia}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, documentoReferencia: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: DEV-001, MERMA, AJUSTE"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo
                </label>
                <textarea
                  value={formularioMovimiento.motivo}
                  onChange={(e) => setFormularioMovimiento({...formularioMovimiento, motivo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Motivo de la salida (opcional)"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setMostrarModalSalida(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const cantidad = Number(formularioMovimiento.cantidad);
                  if (!cantidad || cantidad <= 0) {
                    notify('Cantidad inválida', 'error');
                    return;
                  }
                  if (cantidad > productoSeleccionado.existenciasTotales) {
                    notify('Stock insuficiente', 'error');
                    return;
                  }

                  setLoading(true);
                  try {
                    await inventarioService.registrarSalidaManual({
                      productoId: productoSeleccionado.id,
                      cantidad,
                      documentoReferencia: formularioMovimiento.documentoReferencia || 'AJUSTE_SALIDA',
                      motivo: formularioMovimiento.motivo
                    });
                    
                    notify('Salida registrada correctamente', 'success');
                    cargarDatos();
                    setProductoSeleccionado(inventarioService.getProductoById(productoSeleccionado.id));
                    setMostrarModalSalida(false);
                  } catch (e: any) {
                    notify(e?.message || 'Error al registrar salida', 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Registrar Salida'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoProductos;
