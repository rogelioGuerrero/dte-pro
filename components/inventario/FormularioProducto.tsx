import React, { useState, useEffect, useRef } from 'react';
import { X, Save, DollarSign, ToggleLeft, ToggleRight, Camera, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { notify } from '../../utils/notifications';
import { compressImage } from '../../utils/images/imageOptimizer';
import { imageStorage } from '../../utils/images/imageStorage';

interface FormularioProductoProps {
  producto?: Producto | null;
  onClose: () => void;
  onSave: (producto: Producto) => void;
}

const FormularioProducto: React.FC<FormularioProductoProps> = ({
  producto,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    descripcion: '',
    categoria: 'Varios',
    codigo: '',
    precioSugerido: '0.00',
    gestionarInventario: true,
    esFavorito: false,
    unidadBase: 'UNIDAD'
  });

  const [presentaciones, setPresentaciones] = useState<Array<{ nombre: string; factor: number }>>([
    { nombre: 'UNIDAD', factor: 1 }
  ]);
  const [presentacionesPendientes, setPresentacionesPendientes] = useState<string[]>([]);
  const [nuevaPresentacionNombre, setNuevaPresentacionNombre] = useState('');
  const [nuevaPresentacionFactor, setNuevaPresentacionFactor] = useState<number>(1);

  const [categoriaMode, setCategoriaMode] = useState<'preset' | 'custom'>('preset');
  const [categoriaCustom, setCategoriaCustom] = useState('');

  const [loading, setLoading] = useState(false);
  
  // Estado para imágenes
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImageBlob, setSelectedImageBlob] = useState<Blob | null>(null);
  const [imageModified, setImageModified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

  useEffect(() => {
    if (producto) {
      setFormData({
        descripcion: producto.descripcion,
        categoria: producto.categoria,
        codigo: producto.codigo || '',
        precioSugerido: round2(producto.precioSugerido || 0).toFixed(2),
        gestionarInventario: producto.gestionarInventario,
        esFavorito: producto.esFavorito,
        unidadBase: (producto.unidadBase || 'UNIDAD').toUpperCase(),
      });

      const base = (producto.unidadBase || 'UNIDAD').toUpperCase();
      const pres = Array.isArray(producto.presentaciones) && producto.presentaciones.length
        ? producto.presentaciones.map((p) => ({ nombre: (p.nombre || '').toUpperCase(), factor: Number(p.factor) || 1 }))
        : [{ nombre: base, factor: 1 }];

      if (!pres.some((p) => p.nombre === base)) pres.unshift({ nombre: base, factor: 1 });
      setPresentaciones(pres);
      setPresentacionesPendientes((producto.presentacionesPendientes || []).map((x) => (x || '').toUpperCase()));
      
      // Cargar imagen existente si hay
      if (producto.hasImage) {
        imageStorage.getImageUrl(producto.id).then(url => {
          if (url) setImagePreview(url);
        });
      }
    }
  }, [producto]);

  // Limpiar URL de preview al desmontar
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Comprimir imagen
      const compressedBlob = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8
      });
      
      const url = URL.createObjectURL(compressedBlob);
      setImagePreview(url);
      setSelectedImageBlob(compressedBlob);
      setImageModified(true);
    } catch (error) {
      console.error('Error procesando imagen:', error);
      notify('Error al procesar la imagen', 'error');
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setSelectedImageBlob(null);
    setImageModified(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descripcion.trim()) {
      notify('La descripción es obligatoria', 'error');
      return;
    }

    setLoading(true);

    try {
      let productoGuardado: Producto;
      const precioSugerido = round2(Number(formData.precioSugerido) || 0);

      // Preparar objeto base
      const datosComunes = {
        descripcion: formData.descripcion,
        categoria: formData.categoria,
        codigo: formData.codigo,
        precioSugerido: precioSugerido,
        gestionarInventario: formData.gestionarInventario,
        esFavorito: formData.esFavorito,
        unidadBase: (formData.unidadBase || 'UNIDAD').toUpperCase(),
        presentaciones: presentaciones.map((p) => ({ nombre: (p.nombre || '').toUpperCase(), factor: Number(p.factor) || 1 })),
        presentacionesPendientes: presentacionesPendientes
      };

      if (producto) {
        // Editar producto existente
        productoGuardado = { ...producto, ...datosComunes };
        
        // Manejo de imagen en edición
        if (imageModified) {
          if (selectedImageBlob) {
            await imageStorage.saveImage(producto.id, selectedImageBlob);
            productoGuardado.hasImage = true;
            productoGuardado.imageTimestamp = Date.now();
          } else {
            await imageStorage.deleteImage(producto.id);
            productoGuardado.hasImage = false;
            productoGuardado.imageTimestamp = undefined;
          }
        }
        
        inventarioService.actualizarProducto(productoGuardado);
      } else {
        // Crear nuevo producto
        productoGuardado = await inventarioService.crearProducto({
          descripcion: formData.descripcion,
          categoria: formData.categoria,
          codigoProveedor: formData.codigo
        });
        
        // Asignar resto de propiedades
        Object.assign(productoGuardado, {
          precioSugerido: datosComunes.precioSugerido,
          gestionarInventario: datosComunes.gestionarInventario,
          esFavorito: datosComunes.esFavorito,
          unidadBase: datosComunes.unidadBase,
          presentaciones: datosComunes.presentaciones,
          presentacionesPendientes: datosComunes.presentacionesPendientes
        });

        // Manejo de imagen en creación
        if (selectedImageBlob) {
          await imageStorage.saveImage(productoGuardado.id, selectedImageBlob);
          productoGuardado.hasImage = true;
          productoGuardado.imageTimestamp = Date.now();
        }
        
        inventarioService.actualizarProducto(productoGuardado);
      }

      onSave(productoGuardado);
      notify(producto ? 'Producto actualizado' : 'Producto creado', 'success');
      onClose();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      notify('Error al guardar el producto', 'error');
    } finally {
      setLoading(false);
    }
  };

  const categorias = [
    'Eléctricos',
    'Cocina',
    'Limpieza',
    'Herramientas',
    'Ferretería',
    'Pintura',
    'Fontanería',
    'Iluminación',
    'Oficina',
    'Electrónica',
    'Construcción',
    'Varios'
  ];

  useEffect(() => {
    const current = (formData.categoria || '').toString().trim();
    if (!current) {
      setCategoriaMode('preset');
      setCategoriaCustom('');
      return;
    }

    if (categorias.includes(current)) {
      setCategoriaMode('preset');
      setCategoriaCustom('');
    } else {
      setCategoriaMode('custom');
      setCategoriaCustom(current);
    }
  }, [formData.categoria]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {producto ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Imagen del Producto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen del Producto
                </label>
                <div className="flex items-start gap-4">
                  <div 
                    className="relative w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <>
                        <img 
                          src={imagePreview} 
                          alt="Vista previa" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                          <Camera className="text-white opacity-0 group-hover:opacity-100 w-8 h-8 drop-shadow-lg" />
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-2">
                        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-500">Toque para agregar</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
                    >
                      <Camera className="w-4 h-4" />
                      {imagePreview ? 'Cambiar imagen' : 'Tomar foto / Subir'}
                    </button>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-sm text-red-600 font-medium hover:text-red-800 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar imagen
                      </button>
                    )}
                    <p className="text-xs text-gray-500">
                      Se guardará una versión optimizada para no ocupar mucho espacio.
                    </p>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción del Producto *
                </label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ej: Toma adaptador polarizado 419/1160"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Unidad base */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidad base
                </label>
                <input
                  type="text"
                  value={formData.unidadBase}
                  onChange={(e) => setFormData({ ...formData, unidadBase: e.target.value.toUpperCase() })}
                  placeholder="UNIDAD"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El stock se guarda en esta unidad. Ej: UNIDAD, KG, LT.
                </p>
              </div>

              {/* Presentaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Presentaciones (conversión a unidad base)
                </label>

                <div className="space-y-2">
                  {presentaciones.map((p, idx) => (
                    <div
                      key={`${p.nombre}-${idx}`}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_96px_auto] items-center gap-2"
                    >
                      <input
                        type="text"
                        value={p.nombre}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase();
                          setPresentaciones((prev) => prev.map((x, i) => (i === idx ? { ...x, nombre: v } : x)));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="CAJA"
                        disabled={idx === 0}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.factor}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setPresentaciones((prev) => prev.map((x, i) => (i === idx ? { ...x, factor: v } : x)));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPresentaciones((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        disabled={idx === 0}
                        className="px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                {presentacionesPendientes.length > 0 && (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                    Pendientes: {presentacionesPendientes.join(', ')}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_96px_auto] items-center gap-2">
                  <input
                    type="text"
                    value={nuevaPresentacionNombre}
                    onChange={(e) => setNuevaPresentacionNombre(e.target.value.toUpperCase())}
                    placeholder="CAJA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={nuevaPresentacionFactor}
                    onChange={(e) => setNuevaPresentacionFactor(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = (nuevaPresentacionNombre || '').trim().toUpperCase();
                      const f = Number(nuevaPresentacionFactor);
                      if (!n || !Number.isFinite(f) || f <= 0) return;
                      setPresentaciones((prev) => {
                        if (prev.some((x) => x.nombre === n)) return prev;
                        return [...prev, { nombre: n, factor: f }];
                      });
                      setPresentacionesPendientes((prev) => prev.filter((x) => x !== n));
                      setNuevaPresentacionNombre('');
                      setNuevaPresentacionFactor(1);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría
                </label>
                <select
                  value={categoriaMode === 'custom' ? '__CUSTOM__' : formData.categoria}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__CUSTOM__') {
                      setCategoriaMode('custom');
                      const nextCustom = (categoriaCustom || '').trim();
                      setFormData({ ...formData, categoria: nextCustom || 'Varios' });
                    } else {
                      setCategoriaMode('preset');
                      setCategoriaCustom('');
                      setFormData({ ...formData, categoria: v });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__CUSTOM__">Otra…</option>
                </select>

                {categoriaMode === 'custom' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={categoriaCustom}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCategoriaCustom(v);
                        setFormData({ ...formData, categoria: v });
                      }}
                      placeholder="Escribe tu categoría..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Ej: Lácteos, Bebidas, Repuestos</p>
                  </div>
                )}
              </div>

              {/* Código */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código (opcional)
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ej: 14848"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si no se especifica, se generará automáticamente
                </p>
              </div>

              {/* Precio Sugerido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Venta Sugerido
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioSugerido}
                    onChange={(e) => setFormData({ ...formData, precioSugerido: e.target.value })}
                    onBlur={() => {
                      const v = round2(Number(formData.precioSugerido) || 0).toFixed(2);
                      setFormData((prev) => ({ ...prev, precioSugerido: v }));
                    }}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Precio recomendado para ventas (40% sobre costo promedio)
                </p>
              </div>

              {/* Opciones */}
              <div className="space-y-4">
                {/* Gestionar Inventario */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Gestionar Inventario</p>
                    <p className="text-sm text-gray-500">
                      Controlar stock y movimientos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gestionarInventario: !formData.gestionarInventario })}
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {formData.gestionarInventario ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>

                {/* Favorito */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Producto Favorito</p>
                    <p className="text-sm text-gray-500">
                      Mostrar en la sección de rápidos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, esFavorito: !formData.esFavorito })}
                    className="text-yellow-500 hover:text-yellow-600 transition-colors"
                  >
                    {formData.esFavorito ? '⭐' : '☆'}
                  </button>
                </div>
              </div>

              {/* Información adicional */}
              {producto && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Información Actual</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Existencias:</span>
                      <span className={producto.existenciasTotales === 0 ? 'text-red-600 font-medium' : ''}>
                        {producto.existenciasTotales} unidades
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Costo Promedio:</span>
                      <span>${producto.costoPromedio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Última Compra:</span>
                      <span>{producto.fechaUltimaCompra.toLocaleDateString()}</span>
                    </div>
                    {producto.proveedores.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Proveedores:</span>
                        <span>{producto.proveedores.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {producto ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioProducto;
