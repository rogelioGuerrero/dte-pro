import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  ImagePlus,
  LayoutGrid,
  List,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import {
  ProductData,
  addProduct,
  clearProducts,
  deleteProduct,
  exportProducts,
  getProducts,
  importProducts,
  importProductsFromDTE,
  updateProduct,
} from '../utils/productDb';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';

type ViewMode = 'list' | 'cards';
type GroupMode = 'none' | 'az';
type MobilePane = 'list' | 'detail';

interface ProductFormData {
  codigo: string;
  descripcion: string;
  uniMedida: number;
  tipoItem: number;
  precioUni: number;
  stockMin: number;
  favorite: boolean;
  image: string | null;
}

const emptyForm: ProductFormData = {
  codigo: '',
  descripcion: '',
  uniMedida: 0,
  tipoItem: 1,
  precioUni: 0,
  stockMin: 0,
  favorite: false,
  image: null,
};

const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');

  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(420);
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [showInventoryConfig, setShowInventoryConfig] = useState(false);
  const [inventorySettings, setInventorySettings] = useState<AppSettings>(loadSettings());

  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const panelsContainerRef = useRef<HTMLDivElement>(null);

  const { toasts, addToast, removeToast } = useToast();

  const load = async () => {
    const all = await getProducts();
    setProducts(all);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('products_left_panel_width');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!Number.isNaN(val)) setLeftPanelWidth(val);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsMdUp(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isResizingPanels) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!panelsContainerRef.current) return;
      const rect = panelsContainerRef.current.getBoundingClientRect();
      const raw = ev.clientX - rect.left;
      const min = 320;
      const max = 640;
      const next = Math.min(max, Math.max(min, raw));
      setLeftPanelWidth(next);
    };

    const onMouseUp = () => {
      setIsResizingPanels(false);
      try {
        localStorage.setItem('products_left_panel_width', String(leftPanelWidth));
      } catch {
        // ignore
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizingPanels, leftPanelWidth]);

  useEffect(() => {
    if (!importInputRef.current) return;
    importInputRef.current.setAttribute('webkitdirectory', '');
    importInputRef.current.setAttribute('directory', '');
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => {
      return (
        p.codigo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  const groupedProducts = useMemo(() => {
    const getKey = (p: ProductData): string => {
      if (groupMode === 'az') {
        const v = (p.descripcion || '').trim();
        return v ? v[0].toUpperCase() : '#';
      }
      return 'Todos';
    };

    const map = filteredProducts.reduce((acc, p) => {
      const k = getKey(p);
      if (!acc[k]) acc[k] = [];
      acc[k].push(p);
      return acc;
    }, {} as Record<string, ProductData[]>);

    const keys = Object.keys(map);
    if (groupMode === 'az') keys.sort((a, b) => a.localeCompare(b, 'es'));

    return keys.map((k) => ({ key: k, products: map[k] }));
  }, [filteredProducts, groupMode]);

  const handleSelect = (p: ProductData) => {
    setSelectedProduct(p);
    setIsEditing(false);
    setFormData({
      codigo: p.codigo,
      descripcion: p.descripcion,
      uniMedida: p.uniMedida,
      tipoItem: p.tipoItem,
      precioUni: p.precioUni,
      stockMin: typeof p.stockMin === 'number' ? p.stockMin : 0,
      favorite: !!p.favorite,
      image: typeof p.image === 'string' ? p.image : null,
    });
    setMobilePane('detail');
  };

  const handleNew = () => {
    setSelectedProduct(null);
    setIsEditing(true);
    setFormData(emptyForm);
    setMobilePane('detail');
  };

  const resizeImageToDataUrl = async (file: File, maxSize: number = 640): Promise<string> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read_error'));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('img_error'));
      i.src = dataUrl;
    });

    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.75);
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImageToDataUrl(file);
      setFormData((prev) => ({ ...prev, image: resized }));
      setIsEditing(true);
    } catch {
      addToast('No se pudo cargar la imagen', 'error');
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!formData.descripcion.trim() && !formData.codigo.trim()) {
      addToast('Completa al menos código o descripción', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedProduct?.id && !isEditing) {
        setIsEditing(true);
        return;
      }

      if (selectedProduct?.id) {
        await updateProduct({
          ...selectedProduct,
          codigo: formData.codigo.trim(),
          descripcion: formData.descripcion.trim(),
          uniMedida: Number(formData.uniMedida) || 0,
          tipoItem: Number(formData.tipoItem) || 1,
          precioUni: Number(formData.precioUni) || 0,
          stockMin: Number(formData.stockMin) || 0,
          favorite: !!formData.favorite,
          image: formData.image,
          timestamp: Date.now(),
        });
        addToast('Producto actualizado', 'success');
      } else {
        await addProduct({
          key: `COD:${formData.codigo.trim()}`,
          codigo: formData.codigo.trim(),
          descripcion: formData.descripcion.trim(),
          uniMedida: Number(formData.uniMedida) || 0,
          tipoItem: Number(formData.tipoItem) || 1,
          precioUni: Number(formData.precioUni) || 0,
          stockMin: Number(formData.stockMin) || 0,
          favorite: !!formData.favorite,
          image: formData.image,
          timestamp: Date.now(),
        });
        addToast('Producto creado', 'success');
      }

      setIsEditing(false);
      await load();
    } catch {
      addToast('Error al guardar producto', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    await deleteProduct(id);
    if (selectedProduct?.id === id) {
      setSelectedProduct(null);
      setIsEditing(false);
      setFormData({
        codigo: '',
        descripcion: '',
        uniMedida: 0,
        tipoItem: 1,
        precioUni: 0,
        stockMin: 0,
        favorite: false,
        image: null,
      });
      setMobilePane('list');
    }
    await load();
    addToast('Producto eliminado', 'info');
  };

  const handleDeleteAll = async () => {
    if (!products.length) return;
    if (!window.confirm('¿Borrar todo el catálogo de productos? Esta acción no se puede deshacer.')) return;
    await clearProducts();
    setSelectedProduct(null);
    setIsEditing(false);
    setFormData({
      codigo: '',
      descripcion: '',
      uniMedida: 0,
      tipoItem: 1,
      precioUni: 0,
      stockMin: 0,
      favorite: false,
      image: null,
    });
    setMobilePane('list');
    await load();
    addToast('Catálogo eliminado', 'info');
  };

  const handleExport = async () => {
    try {
      const json = await exportProducts();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos-dte-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Productos exportados', 'success');
    } catch {
      addToast('Error al exportar', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      let imported = 0;
      let updated = 0;
      let skipped = 0;

      const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'));

      for (const file of jsonFiles) {
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          const sample = Array.isArray(parsed) ? parsed[0] : parsed;

          if (sample?.cuerpoDocumento) {
            const r = await importProductsFromDTE(text);
            imported += r.imported;
            updated += r.updated;
            skipped += r.skipped;
          } else {
            const r = await importProducts(text);
            imported += r.imported;
            updated += r.updated;
            skipped += r.skipped;
          }
        } catch {
          const r = await importProducts(text);
          imported += r.imported;
          updated += r.updated;
          skipped += r.skipped;
        }
      }

      await load();
      addToast(
        `${imported} nuevos, ${updated} actualizados, ${skipped} omitidos (ya existían o repetidos).`,
        'success'
      );
    } catch {
      addToast('Error al importar', 'error');
    }

    if (importInputRef.current) importInputRef.current.value = '';
  };

  const renderProductCard = (p: ProductData) => {
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => handleSelect(p)}
        className={`text-left p-3 rounded-xl border transition-colors hover:bg-blue-50 ${
          selectedProduct?.id === p.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono text-gray-500 truncate">{p.codigo || 'SIN CÓDIGO'}</p>
            <p className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">{p.descripcion}</p>
          </div>
          {p.favorite && (
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
        </div>
        {p.image && (
          <div className="mt-2">
            <img src={p.image} alt={p.descripcion} className="w-full h-20 object-cover rounded-lg border border-gray-100" />
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">Uni: {p.uniMedida}</span>
          <span className="text-sm font-mono text-gray-900">${p.precioUni.toFixed(2)}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Catálogo de Productos</h2>
          <p className="text-sm text-gray-500">Importa productos desde tus DTE de ventas (cuerpoDocumento)</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Tooltip content="Importar productos desde JSON (DTE o export)" position="bottom">
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileUp className="w-4 h-4" />
                Importar
              </button>
            </Tooltip>

            <Tooltip content="Borrar todo el catálogo" position="bottom">
              <button
                onClick={handleDeleteAll}
                disabled={products.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Borrar todos
              </button>
            </Tooltip>

            <Tooltip content="Exportar catálogo a JSON" position="bottom">
              <button
                onClick={handleExport}
                disabled={products.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </Tooltip>

            <Tooltip content="Configurar inventario" position="bottom">
              <button
                onClick={() => setShowInventoryConfig(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Configurar
              </button>
            </Tooltip>
          </div>

          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={importInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImport}
        multiple
      />

      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        onChange={handlePickImage}
      />

      <div
        ref={panelsContainerRef}
        className="flex-1 flex flex-col md:flex-row gap-4 md:gap-0 min-h-0"
      >
        {/* Left */}
        <div
          className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden md:w-[420px] ${
            mobilePane === 'detail' ? 'hidden md:flex' : 'flex'
          }`}
          style={{ width: isMdUp ? leftPanelWidth : undefined }}
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por código o descripción..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <select
                value={groupMode}
                onChange={(e) => setGroupMode(e.target.value as GroupMode)}
                className="h-9 text-sm border border-gray-200 rounded-lg bg-white px-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                title="Agrupar"
              >
                <option value="none">Sin agrupar</option>
                <option value="az">A-Z</option>
              </select>

              <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Vista lista"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'cards'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Vista tarjetas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                <Package className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">
                  {products.length === 0 ? 'Sin productos' : 'Sin resultados'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="divide-y divide-gray-100">
                {groupedProducts.map((g) => (
                  <div key={g.key}>
                    {groupMode !== 'none' && (
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-0">
                        {g.key}{' '}
                        <span className="font-normal">({g.products.length})</span>
                      </div>
                    )}

                    {g.products.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelect(p)}
                        className={`p-3 cursor-pointer transition-colors group ${
                          selectedProduct?.id === p.id
                            ? 'bg-blue-50 border-l-2 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {p.descripcion}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {p.codigo ? `Código: ${p.codigo}` : 'Sin código'}
                              {' · '}
                              ${p.precioUni.toFixed(2)}
                            </p>
                          </div>
                          {p.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(p.id as number);
                              }}
                              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 space-y-4">
                {groupedProducts.map((g) => (
                  <div key={g.key}>
                    {groupMode !== 'none' && (
                      <div className="px-1 pb-2 text-xs font-semibold text-gray-500">
                        {g.key}{' '}
                        <span className="font-normal">({g.products.length})</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {g.products.map(renderProductCard)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
            <span className="text-xs text-gray-400">
              {products.length} producto{products.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Divider (solo desktop/tablet) */}
        <div
          className="hidden md:flex items-stretch px-1"
          onDoubleClick={() => {
            setLeftPanelWidth(420);
            try {
              localStorage.setItem('products_left_panel_width', String(420));
            } catch {
              // ignore
            }
          }}
        >
          <div
            className="cursor-col-resize"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingPanels(true);
            }}
            title="Arrastra para ajustar"
          >
            <div
              className={`w-[2px] h-full rounded ${isResizingPanels ? 'bg-blue-300' : 'bg-gray-200 hover:bg-gray-300'}`}
            />
          </div>
        </div>

        {/* Right */}
        <div
          className={`bg-white rounded-xl border border-gray-200 flex-1 flex flex-col overflow-hidden ${
            mobilePane === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="md:hidden border-b border-gray-100 p-3">
            <button
              type="button"
              onClick={() => setMobilePane('list')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Volver
            </button>
          </div>

          {!selectedProduct && !isEditing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <Package className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-500">Selecciona o crea un producto</p>
              <p className="text-sm mt-1">Puedes importarlos desde facturas antiguas</p>
              <button
                onClick={handleNew}
                className="mt-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear nuevo producto
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-700">
                    {selectedProduct ? (isEditing ? 'Editar Producto' : 'Detalle del Producto') : 'Nuevo Producto'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {selectedProduct && !isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || (!isEditing && !!selectedProduct)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin">
                          <Save className="w-4 h-4" />
                        </span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Guardar
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Código</label>
                    <input
                      type="text"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Unidad de Medida</label>
                    <input
                      type="number"
                      value={formData.uniMedida}
                      onChange={(e) => setFormData({ ...formData, uniMedida: parseInt(e.target.value) || 0 })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Descripción</label>
                    <input
                      type="text"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tipo</label>
                    <select
                      value={formData.tipoItem}
                      onChange={(e) => setFormData({ ...formData, tipoItem: parseInt(e.target.value) || 1 })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                    >
                      <option value={1}>Bien</option>
                      <option value={2}>Servicio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Precio Unitario</label>
                    <input
                      type="number"
                      value={formData.precioUni}
                      onChange={(e) => setFormData({ ...formData, precioUni: parseFloat(e.target.value) || 0 })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Stock mínimo</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.stockMin}
                      onChange={(e) => setFormData({ ...formData, stockMin: parseFloat(e.target.value) || 0 })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Favorito</label>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, favorite: !prev.favorite }))}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          formData.favorite
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${formData.favorite ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`} />
                        {formData.favorite ? 'Marcado' : 'Marcar'}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-500 uppercase">Imagen</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <ImagePlus className="w-4 h-4" />
                          Cargar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, image: null }));
                            setIsEditing(true);
                          }}
                          disabled={!formData.image}
                          className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    {formData.image ? (
                      <img src={formData.image} alt={formData.descripcion} className="w-full h-40 object-cover rounded-xl border border-gray-100" />
                    ) : (
                      <div className="w-full h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                        Sin imagen
                      </div>
                    )}
                  </div>
                </div>

                {selectedProduct?.id && (
                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="text-xs text-gray-400">
                      <span className="font-mono">key: {selectedProduct.key}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(selectedProduct.id as number)}
                      className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Configuración de Inventario */}
      {showInventoryConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                Configuración de Inventario
              </h3>
              <button 
                onClick={() => setShowInventoryConfig(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Costeo</label>
                <select
                  value={inventorySettings.inventoryCostingMethod || 'UEPS'}
                  onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryCostingMethod: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="UEPS">UEPS (últimas entradas, primeras salidas)</option>
                  <option value="PEPS">PEPS (primeras entradas, primeras salidas)</option>
                  <option value="PROMEDIO">Promedio ponderado</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">Para cálculo de costo de ventas</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inventorySettings.inventoryShowLotProvider || false}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryShowLotProvider: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Mostrar Lote y Proveedor</span>
                </label>
                <p className="text-[10px] text-gray-500 mt-1 ml-6">
                  Muestra información de lote y proveedor en facturas
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inventorySettings.inventoryFallbackByDescription !== false}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryFallbackByDescription: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Buscar por Descripción</span>
                </label>
                <p className="text-[10px] text-gray-500 mt-1 ml-6">
                  Si no encuentra código, busca por nombre del producto
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umbral Auto-match
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={inventorySettings.inventoryAutoMatchThreshold || 0.9}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryAutoMatchThreshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Coincidencia automática</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umbral Sugerir
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={inventorySettings.inventoryAskMatchThreshold || 0.75}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, inventoryAskMatchThreshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Para sugerir productos</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setShowInventoryConfig(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  saveSettings(inventorySettings);
                  setInventorySettings(inventorySettings);
                  setShowInventoryConfig(false);
                  addToast('Configuración guardada correctamente', 'success');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
