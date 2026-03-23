import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Send, Loader2, Search, X, ReceiptText, Package, ChevronRight, ArrowRight } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { useToast } from '../Toast';
import { generarCorrelativoControlado, generarDTE, redondear } from '../../utils/dteGenerator';
import { getEmisor } from '../../utils/emisorDb';
import { useEmisor } from '../../contexts/EmisorContext';
import { checkLicense } from '../../utils/licenseValidator';
import { getCertificate } from '../../utils/secureStorage';
import { limpiarDteParaFirma, type TransmitDTEResponse, transmitirDocumento } from '../../utils/firmaApiClient';

interface CartItem {
  producto: Producto;
  cantidad: number;
}

const formatCurrency = (n: number) => `$${(n || 0).toFixed(2)}`;

const PosCF: React.FC = () => {
  const { addToast } = useToast();
  const { businessId } = useEmisor();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [correoReceptor, setCorreoReceptor] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [resultadoJSON, setResultadoJSON] = useState<string>('');
  const [respuestaMH, setRespuestaMH] = useState<TransmitDTEResponse | { error: string } | null>(null);

  // Función para convertir a CCF
  const handleConvertirACCF = () => {
    if (cart.length === 0) {
      addToast('No hay items para convertir', 'error');
      return;
    }

    // Guardar items actuales en localStorage para que CCF03Generator los use
    const itemsParaCCF = cart.map(item => ({
      id: `cart_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      tipoItem: item.producto.gestionarInventario ? 1 : 2, // 1=Bien si gestiona inventario, 2=Servicio
      codigo: item.producto.codigo || item.producto.codigoPrincipal || '',
      descripcion: item.producto.descripcion,
      cantidad: item.cantidad,
      uniMedida: 59, // Unidad por defecto
      precioUni: redondear(item.producto.precioSugerido / 1.13, 8), // Convertir precio con IVA a precio sin IVA
      montoDescu: 0,
      esExento: false,
    }));
    
    localStorage.setItem('ccf_items_temp', JSON.stringify(itemsParaCCF));
    localStorage.setItem('ccf_observaciones_temp', '');
    localStorage.setItem('ccf_forma_pago_temp', '01');
    localStorage.setItem('ccf_condicion_temp', '1');
    
    // Cambiar al tab de CCF (factura)
    window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'factura' } }));
    addToast('Redirigiendo a Crédito Fiscal...', 'info');
    setTimeout(() => {
      addToast('Items convertidos para CCF. Los precios se ajustaron sin IVA.', 'success');
    }, 500);
  };
  const [mobileView, setMobileView] = useState<'productos' | 'carrito'>('productos');
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false);

  useEffect(() => {
    setProductos(inventarioService.getProductos());
  }, []);

  const categorias = useMemo(() => ['todos', ...Array.from(new Set(productos.map((p) => p.categoria)))], [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const cumpleCategoria = categoriaFiltro === 'todos' || p.categoria === categoriaFiltro;
      const text = (busqueda || '').toLowerCase();
      const cumpleBusqueda =
        !text ||
        p.descripcion.toLowerCase().includes(text) ||
        (p.codigo || '').toLowerCase().includes(text) ||
        (p.codigoPrincipal || '').toLowerCase().includes(text);
      return cumpleCategoria && cumpleBusqueda && p.activo !== false;
    });
  }, [productos, categoriaFiltro, busqueda]);

  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.producto.id === producto.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return copy;
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateQty = (productoId: string, delta: number) => {
    setCart((prev) => {
      const copy = prev
        .map((c) => (c.producto.id === productoId ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c))
        .filter((c) => c.cantidad > 0);
      return copy;
    });
  };

  const removeItem = (productoId: string) => {
    setCart((prev) => prev.filter((c) => c.producto.id !== productoId));
  };

  const clearSale = () => {
    setCart([]);
    setCorreoReceptor('');
    setResultadoJSON('');
    setRespuestaMH(null);
    setMobileView('productos');
  };

  const totales = useMemo(() => {
    // Para FE 01: precios incluyen IVA; no calcular IVA en frontend
    const gravado = cart.reduce(
      (sum, item) => sum + redondear((item.producto.precioSugerido || 0) * item.cantidad, 8),
      0
    );
    const iva = 0;
    const total = redondear(gravado, 2);
    return { gravado, iva, total };
  }, [cart]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.cantidad, 0), [cart]);

  const resultadoResumen = useMemo(() => {
    if (!respuestaMH) return null;
    const mh = 'mhResponse' in respuestaMH ? respuestaMH.mhResponse : undefined;
    const estado = mh?.estado || ('error' in respuestaMH ? 'ERROR' : 'Sin estado');
    const rawErrorMessage =
      'error' in respuestaMH
        ? String(respuestaMH.error || '')
        : typeof respuestaMH.error === 'string'
          ? respuestaMH.error
          : String(respuestaMH.error?.message || '');
    const mensaje = 'error' in respuestaMH ? rawErrorMessage : String(mh?.mensaje || rawErrorMessage || 'Mensaje no disponible');
    const isOffline = 'mhResponse' in respuestaMH && Boolean(respuestaMH.isOffline);
    const esExitoso =
      'mhResponse' in respuestaMH &&
      respuestaMH.transmitted === true &&
      mh?.success === true &&
      ['PROCESADO', 'ACEPTADO', 'ACEPTADO_CON_ADVERTENCIAS'].includes(mh?.estado || '');

    return {
      estado,
      mensaje,
      selloRecepcion: mh?.selloRecepcion || '',
      codigoGeneracion: mh?.codigoGeneracion || '',
      isOffline,
      esExitoso,
      tono: esExitoso ? 'success' : isOffline ? 'warning' : 'error',
    };
  }, [respuestaMH]);

  const buildDTE = async () => {
    const emisor = await getEmisor();
    if (!emisor) throw new Error('Configura datos del emisor primero');

    const nit = (emisor.nit || '').replace(/[\s-]/g, '');
    if (!(nit.length === 9 || nit.length === 14)) {
      throw new Error('NIT del emisor debe tener 9 o 14 dígitos (sin guiones)');
    }

    const items = cart.map((item, idx) => {
      const precioConIva = redondear(Number(item.producto.precioSugerido || 0), 2);
      const cantidad = Number(item.cantidad || 1);

      // FE 01: mantener precio final (incluye IVA) en ventaGravada y precioUni; backend recalcula IVA
      const precioUni = precioConIva;
      const ventaGravada = redondear(precioConIva * cantidad, 2);
      const ivaItem = 0; // no enviar IVA desde frontend

      return {
        numItem: idx + 1,
        tipoItem: 1, // Bien
        cantidad,
        codigo: item.producto.codigo || item.producto.codigoPrincipal || `VAR-${idx + 1}`,
        uniMedida: 99,
        descripcion: item.producto.descripcion.toUpperCase(),
        precioUni: precioUni,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: null, // no enviar tributos; backend arma IVA
        numeroDocumento: null,
        codTributo: null,
        psv: 0,
        noGravado: 0,
        ivaItem,
      };
    });

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
      email: correoReceptor,
      esConsumidorFinal: true,
      nombreComercial: '',
      timestamp: Date.now(),
    };

    const telefonoEmisor = (emisor.telefono || '').replace(/\D/g, '');
    const nombreComercial = (emisor.nombreComercial || '').trim();
    const direccionEmisor = (emisor.direccion || '').trim() || 'Dirección del negocio';

    const datosFactura = {
      emisor: {
        nit: emisor.nit,
        nrc: emisor.nrc,
        nombre: emisor.nombre,
        nombreComercial: ['n/a', 'na'].includes(nombreComercial.toLowerCase()) ? '' : nombreComercial,
        actividadEconomica: emisor.actividadEconomica,
        descActividad: emisor.descActividad,
        tipoEstablecimiento: emisor.tipoEstablecimiento,
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        direccion: direccionEmisor,
        telefono: telefonoEmisor,
        correo: emisor.correo,
        codEstableMH: emisor.codEstableMH || 'M001',
        codPuntoVentaMH: emisor.codPuntoVentaMH || 'P001',
      },
      receptor,
      items,
      tipoDocumento: '01',
      tipoTransmision: 1,
      formaPago: '01', // Efectivo
      condicionOperacion: 1, // Contado
    };

    const correlativo = generarCorrelativoControlado(datosFactura.tipoDocumento, datosFactura.emisor.codEstableMH, datosFactura.emisor.codPuntoVentaMH);
    const dte = generarDTE(datosFactura as any, correlativo);
    setResultadoJSON(JSON.stringify(dte, null, 2));
    return { dte, nitSinGuiones: nit };
  };

  const transmitir = async () => {
    if (!cart.length) {
      addToast('Agrega productos al carrito', 'error');
      return;
    }
    setIsSending(true);
    try {
      const licensed = await checkLicense();
      if (!licensed) {
        addToast('Licencia requerida para transmitir desde este dispositivo.', 'error');
        return;
      }

      const { dte, nitSinGuiones } = await buildDTE();

      const activeBusinessId = businessId || nitSinGuiones;
      if (!activeBusinessId) {
        addToast('Selecciona un emisor antes de transmitir.', 'error');
        return;
      }

      const stored = await getCertificate();
      const passwordPri = stored?.password || '';

      const dteLimpio = limpiarDteParaFirma(dte as any);
      const result = await transmitirDocumento({
        dte: dteLimpio,
        passwordPri,
        ambiente: '00',
      });

      setRespuestaMH(result);
      setMobileView('carrito');

      const estado = result.mhResponse?.estado;
      const ok = result.transmitted === true && result.mhResponse?.success === true;

      if (ok && (estado === 'PROCESADO' || estado === 'ACEPTADO' || estado === 'ACEPTADO_CON_ADVERTENCIAS')) {
        addToast('DTE procesado exitosamente', 'success');
      } else if (result.isOffline) {
        addToast(result.contingencyReason || 'Documento enviado a contingencia', 'info');
      } else {
        addToast(result.mhResponse?.mensaje || 'Error en la transmisión', 'error');
      }
    } catch (e: any) {
      setRespuestaMH({ error: e?.message || 'Error al transmitir' });
      setMobileView('carrito');
      addToast(e?.message || 'Error al transmitir', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const technicalResponseText = respuestaMH ? JSON.stringify(respuestaMH, null, 2) : '';

  const technicalToneClass =
    resultadoResumen?.tono === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : resultadoResumen?.tono === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-800';

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-4 lg:flex-row lg:items-end lg:justify-between lg:p-6">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">
                Punto de venta
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">POS Consumidor Final</h1>
                <p className="text-sm text-gray-500">Diseñado para cobro ágil en tablet y teléfono.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Productos</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{productosFiltrados.length}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Items</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{cartCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-900 px-4 py-3 text-white">
                <div className="text-[11px] uppercase tracking-wide text-gray-300">Total</div>
                <div className="mt-1 text-lg font-semibold">{formatCurrency(totales.total)}</div>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-100 px-4 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMobileView('productos')}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                  mobileView === 'productos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Productos
              </button>
              <button
                type="button"
                onClick={() => setMobileView('carrito')}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                  mobileView === 'carrito' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Carrito ({cartCount})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,0.78fr)] lg:p-6">
            <section className={`${mobileView === 'carrito' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col rounded-3xl border border-gray-200 bg-gray-50`}>
              <div className="space-y-4 border-b border-gray-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
                    <p className="text-sm text-gray-500">Toca un producto para agregarlo al carrito.</p>
                  </div>
                  <div className="relative w-full lg:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre o código"
                      className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categorias.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoriaFiltro(cat)}
                      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                        categoriaFiltro === cat
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                  {productosFiltrados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        addToCart(p);
                        setMobileView('carrito');
                      }}
                      className="group overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                    >
                      <div className="relative aspect-square border-b border-gray-100 bg-gray-50">
                        <div
                          className={`absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
                            p.gestionarInventario
                              ? p.existenciasTotales <= 0
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : p.existenciasTotales < 5
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-gray-200 bg-white text-gray-700'
                              : 'border-gray-200 bg-white text-gray-500'
                          }`}
                          title={p.gestionarInventario ? `Existencias: ${p.existenciasTotales}` : 'Inventario no gestionado'}
                        >
                          {p.gestionarInventario ? p.existenciasTotales : '—'}
                        </div>

                        {p.hasImage ? (
                          <div className="h-full w-full bg-gray-100" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-white text-3xl text-gray-400 transition-transform group-hover:scale-105">
                              🛒
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 p-4">
                        <div className="min-h-[2.75rem] text-sm font-semibold leading-5 text-gray-900 line-clamp-2">{p.descripcion}</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">{p.categoria}</div>
                          {p.gestionarInventario && p.existenciasTotales < 5 && (
                            <div className="text-[11px] font-medium text-amber-700">Stock bajo</div>
                          )}
                        </div>
                        <div className="flex items-end justify-between gap-2 pt-1">
                          <div className="text-lg font-bold text-gray-900">{formatCurrency(p.precioSugerido || 0)}</div>
                          <div className="text-[11px] text-gray-400">{p.gestionarInventario ? 'Inventario' : 'Servicio'}</div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {productosFiltrados.length === 0 && (
                    <div className="col-span-full rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                      <Package className="mx-auto h-8 w-8 text-gray-300" />
                      <div className="mt-3 text-sm font-medium text-gray-700">Sin productos para mostrar</div>
                      <div className="mt-1 text-sm text-gray-500">Prueba otra búsqueda o cambia la categoría.</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className={`${mobileView === 'productos' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col rounded-3xl border border-gray-200 bg-white`}>
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-semibold text-gray-900">Cobro</h2>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Revisa el pedido y completa la venta.</p>
                </div>
                <div className="rounded-2xl bg-gray-900 px-3 py-2 text-right text-white">
                  <div className="text-[11px] uppercase tracking-wide text-gray-300">Items</div>
                  <div className="text-base font-semibold">{cartCount}</div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {resultadoResumen && (
                  <div className={`rounded-2xl border p-4 ${technicalToneClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em]">Resultado</div>
                        <div className="mt-1 text-lg font-semibold">{resultadoResumen.estado}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTechnicalDetail(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-current/20 px-3 py-1.5 text-xs font-medium"
                      >
                        Detalle técnico
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-3 text-sm">{resultadoResumen.mensaje}</p>
                    <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
                      <div className="rounded-xl bg-white/70 p-3 text-gray-700">
                        <div className="font-medium text-gray-500">Código de generación</div>
                        <div className="mt-1 break-all font-mono">{resultadoResumen.codigoGeneracion || 'No disponible'}</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3 text-gray-700">
                        <div className="font-medium text-gray-500">Sello de recepción</div>
                        <div className="mt-1 break-all font-mono">{resultadoResumen.selloRecepcion || 'No disponible'}</div>
                      </div>
                    </div>
                    {resultadoResumen.isOffline && (
                      <div className="mt-3 text-sm font-medium">Documento enviado a contingencia.</div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Cliente</h3>
                      <p className="text-sm text-gray-500">Consumidor final</p>
                    </div>
                    <ReceiptText className="h-5 w-5 text-gray-300" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Correo para envío de factura</label>
                    <input
                      type="email"
                      value={correoReceptor}
                      onChange={(e) => setCorreoReceptor(e.target.value)}
                      placeholder="cliente@correo.com"
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                    />
                    <p className="text-xs text-gray-400">Déjalo vacío si el cliente no desea correo.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {cart.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                      <ShoppingCart className="mx-auto h-8 w-8 text-gray-300" />
                      <div className="mt-3 text-sm font-medium text-gray-700">Carrito vacío</div>
                      <div className="mt-1 text-sm text-gray-500">Agrega productos para iniciar una venta.</div>
                    </div>
                  )}

                  {cart.map((item) => (
                    <div key={item.producto.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 line-clamp-2">{item.producto.descripcion}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatCurrency(item.producto.precioSugerido || 0)} c/u</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.producto.id)}
                          className="rounded-full border border-gray-200 p-2 text-gray-400 transition hover:border-red-200 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQty(item.producto.id, -1)}
                            className="rounded-full border border-gray-200 p-2.5 text-gray-700 transition hover:bg-gray-50"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="min-w-10 text-center text-sm font-semibold text-gray-900">{item.cantidad}</div>
                          <button
                            type="button"
                            onClick={() => updateQty(item.producto.id, 1)}
                            className="rounded-full border border-gray-200 p-2.5 text-gray-700 transition hover:bg-gray-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-base font-semibold text-gray-900">
                          {formatCurrency((item.producto.precioSugerido || 0) * item.cantidad)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 bg-white p-4">
                <div className="rounded-3xl bg-gray-900 p-4 text-white">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-gray-300">
                      <span>Gravado</span>
                      <span>{formatCurrency(totales.gravado)}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-300">
                      <span>IVA 13%</span>
                      <span>{formatCurrency(totales.iva)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-lg font-semibold text-white">
                      <span>Total</span>
                      <span>{formatCurrency(totales.total)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {/* Botón para convertir a CCF */}
                    {cart.length > 0 && (
                      <button
                        onClick={handleConvertirACCF}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Convertir a CCF
                      </button>
                    )}

                    <button
                      onClick={transmitir}
                      disabled={isSending || cart.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      {isSending ? 'Enviando...' : `Cobrar ${formatCurrency(totales.total)}`}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMobileView('productos')}
                        className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 lg:hidden"
                      >
                        Seguir vendiendo
                      </button>
                      <button
                        type="button"
                        onClick={clearSale}
                        className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                      >
                        Nueva venta
                      </button>
                    </div>

                    {(resultadoJSON || respuestaMH) && (
                      <button
                        type="button"
                        onClick={() => setShowTechnicalDetail(true)}
                        className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                      >
                        Ver detalle técnico
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {showTechnicalDetail && (resultadoJSON || respuestaMH) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Detalle técnico</h3>
                <p className="text-sm text-gray-500">Información para soporte, validación y auditoría.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTechnicalDetail(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">JSON generado</h4>
                  {resultadoJSON && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(resultadoJSON)}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Copiar
                    </button>
                  )}
                </div>
                <pre className="max-h-[60vh] overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-[11px] text-gray-800">
                  {resultadoJSON || 'No disponible'}
                </pre>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Respuesta MH</h4>
                  {technicalResponseText && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(technicalResponseText)}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Copiar
                    </button>
                  )}
                </div>
                <pre className="max-h-[60vh] overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-[11px] text-gray-800">
                  {technicalResponseText || 'No disponible'}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PosCF;
