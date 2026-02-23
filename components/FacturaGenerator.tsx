import React, { useState, useEffect, useMemo } from 'react';
import { getClients, ClientData } from '../utils/clientDb';
import { ProductData, getProducts } from '../utils/productDb';
import { getEmisor, saveEmisor, EmisorData } from '../utils/emisorDb';
import { 
  generarDTE, ItemFactura, tiposDocumento, formasPago,
  calcularTotales, redondear, DTEJSON
} from '../utils/dteGenerator';
import { ToastContainer, useToast } from './Toast';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { FacturaMainContent } from './FacturaMainContent';
import { FacturaModals } from './FacturaModals';
import TransmisionModal from './TransmisionModal';
import QRClientCapture from './QRClientCapture';
import { FacturaHeader } from './FacturaHeader';
import MobileFactura from './MobileFactura';
import MobileEmisorModal from './MobileEmisorModal';
import { applySalesFromDTE, validateStockForSale } from '../utils/inventoryDb';
import { revertSalesFromDTE } from '../utils/inventoryDb';
import { inventarioService } from '../utils/inventario/inventarioService';
import { getUserModeConfig, hasFeature } from '../utils/userMode';
import { resolveProductForDescription } from '../utils/facturaGeneratorHelpers';
import { useStockByCode } from '../hooks/useStockByCode';
import { requiereStripe } from '../catalogos/pagos';
import { useMobile } from '../hooks/useMobile';
import { mergeProducts } from '../utils/inventoryAdapter';
import { 
  getPresentacionesForCodigo as getPresentacionesForCodigoHelper,
} from '../utils/facturaGeneratorInventoryHelpers';
import type { ResolverItem } from './ResolveNoCodeModal';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';

interface ItemForm {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadVenta: string;
  factorConversion: number;
  precioUni: number;
  precioUniRaw?: string;
  tipoItem: number;
  uniMedida: number;
  esExento: boolean;
}

const emptyItem: ItemForm = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  unidadVenta: 'UNIDAD',
  factorConversion: 1,
  precioUni: 0,
  tipoItem: 1,
  uniMedida: 99,
  esExento: false,
};


const FacturaGenerator: React.FC = () => {
  const isModoProfesional = getUserModeConfig().mode === 'profesional';
  const defaultItem: ItemForm = isModoProfesional ? { ...emptyItem, tipoItem: 2 } : { ...emptyItem };
  const canUseCatalogoProductos = hasFeature('productos');
  const isMobile = useMobile();
  const { toasts, addToast, removeToast } = useToast();

  const [showTransmision, setShowTransmision] = useState(false);
  const [showQRCapture, setShowQRCapture] = useState(false);
  const [showDTEPreview, setShowDTEPreview] = useState(false);
  const [showStripeConnect, setShowStripeConnect] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [showEmisorConfig, setShowEmisorConfig] = useState(false);
  const [isSavingEmisor, setIsSavingEmisor] = useState(false);
  const [emisorForm, setEmisorForm] = useState<Omit<EmisorData, 'id'>>({
    nit: '',
    nrc: '',
    nombre: '',
    nombreComercial: '',
    actividadEconomica: '',
    descActividad: '',
    tipoEstablecimiento: '01',
    departamento: '',
    municipio: '',
    direccion: '',
    telefono: '',
    correo: '',
    codEstableMH: null,
    codPuntoVentaMH: null,
  });

  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedReceptor, setSelectedReceptor] = useState<ClientData | null>(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [products, setProducts] = useState<ProductData[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerIndex, setProductPickerIndex] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [stockError, setStockError] = useState<string>('');

  const [items, setItems] = useState<ItemForm[]>([{ ...defaultItem }]);
  const [tipoDocumento, setTipoDocumento] = useState('03');
  const [formaPago, setFormaPago] = useState('01');
  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [observaciones, setObservaciones] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);

  // Resolve Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolverItems, setResolverItems] = useState<ResolverItem[]>([]);

  // Certificate Manager
  const {
    apiPassword,
    certificatePassword,
    showCertPassword,
    certificateError,
    isSavingCert,
    certificateFile,
    setApiPassword,
    setCertificatePassword,
    setShowCertPassword,
    handleCertFileSelect,
    handleSaveCertificate,
    fileInputRef,
  } = useCertificateManager({ onToast: (msg, type) => addToast(msg, type) });

  const { stockByCode } = useStockByCode();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Sincronizar datos del inventario simplificado para asegurar frescura
    inventarioService.sincronizar();

    const [loadedClients, loadedProductsDb, loadedEmisor] = await Promise.all([
      getClients(),
      getProducts(),
      getEmisor()
    ]);

    // Obtener productos del inventario simplificado
    const inventoryProducts = inventarioService.getProductos();
    
    // Fusionar ambas fuentes
    const finalProducts = mergeProducts(loadedProductsDb, inventoryProducts);

    setClients(loadedClients);
    setProducts(finalProducts);
    setEmisor(loadedEmisor);
    if (loadedEmisor) {
      const { id, ...rest } = loadedEmisor;
      setEmisorForm(rest);
    }
  };

  const receptorEsConsumidorFinal = selectedReceptor ? !selectedReceptor.nit.trim() : false;

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10);
    const lower = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      c.nit.includes(clientSearch) ||
      (c.nombreComercial && c.nombreComercial.toLowerCase().includes(lower))
    ).slice(0, 10);
  }, [clients, clientSearch]);

  const tiposDocumentoFiltrados = useMemo(() => {
    return tiposDocumento.filter(t => {
      if (receptorEsConsumidorFinal) {
        return ['01', '02', '10', '11'].includes(t.codigo);
      } else {
        return !['02', '10'].includes(t.codigo);
      }
    });
  }, [receptorEsConsumidorFinal]);

  const filteredProductsForPicker = useMemo(() => {
    if (!productSearch) return products.slice(0, 20);
    const lower = productSearch.toLowerCase();
    return products.filter(p => 
      p.descripcion.toLowerCase().includes(lower) || 
      (p.codigo && p.codigo.toLowerCase().includes(lower))
    ).slice(0, 20);
  }, [products, productSearch]);

  // Recalcular precios al cambiar tipo de documento
  const handleSetTipoDocumento = (nuevoTipo: string) => {
    const tipoAnterior = tipoDocumento;
    setTipoDocumento(nuevoTipo);

    if (tipoAnterior === nuevoTipo) return;

    // Si no hay items o solo el default vacío, no hacer nada
    if (items.length === 0 || (items.length === 1 && !items[0].codigo && items[0].precioUni === 0)) return;

    const newItems = items.map(item => {
      // Si es exento, no se toca el precio
      if (item.esExento) return item;

      let nuevoPrecio = item.precioUni;

      // De Sin IVA (03) a Con IVA (01) -> Sumar IVA
      if (tipoAnterior !== '01' && nuevoTipo === '01') {
        nuevoPrecio = redondear(item.precioUni * 1.13, 8);
      }
      // De Con IVA (01) a Sin IVA (03) -> Restar IVA
      else if (tipoAnterior === '01' && nuevoTipo !== '01') {
        nuevoPrecio = redondear(item.precioUni / 1.13, 8);
      }

      return {
        ...item,
        precioUni: nuevoPrecio
      };
    });

    setItems(newItems);
    addToast(
      nuevoTipo === '01' 
        ? 'Precios actualizados a IVA incluido' 
        : 'Precios actualizados a Sin IVA',
      'info'
    );
  };

  const handleSelectReceptor = (client: ClientData) => {
    setSelectedReceptor(client);
    setShowClientSearch(false);
    setClientSearch('');

    const receptorId = (client?.nit || '').replace(/[\s-]/g, '').trim();
    if (!receptorId && tipoDocumento === '03') {
      handleSetTipoDocumento('01');
    }
  };

  const handleSaveEmisor = async () => {
    setIsSavingEmisor(true);
    try {
      await saveEmisor(emisorForm);
      const saved = await getEmisor(); // Reload to get ID and ensure consistency
      setEmisor(saved);
      addToast('Datos del emisor guardados', 'success');
      setShowEmisorConfig(false);
    } catch (error) {
      console.error(error);
      addToast('Error guardando emisor', 'error');
    } finally {
      setIsSavingEmisor(false);
    }
  };

  // Resetear tipo de documento cuando cambia el receptor (Auto-selección)
  useEffect(() => {
    if (selectedReceptor) {
      // Si es consumidor final y el tipo actual no es permitido, cambiar a 01
      if (receptorEsConsumidorFinal && !['01', '02', '10', '11'].includes(tipoDocumento)) {
        handleSetTipoDocumento('01');
      }
      // Si es cliente con NIT y el tipo actual es 02 o 10, cambiar a 01
      else if (!receptorEsConsumidorFinal && ['02', '10'].includes(tipoDocumento)) {
        handleSetTipoDocumento('01');
      }
    }
  }, [selectedReceptor, receptorEsConsumidorFinal]);

  const handleAddItem = () => {
    setItems([...items, { ...defaultItem }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setItems([{ ...defaultItem }]);
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof ItemForm, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const applyProductToItem = (index: number, p: ProductData) => {
    const newItems = [...items];
    if (!newItems[index]) return;
    
    // Si estamos en Factura (01), asumimos que el precio del catálogo es Neto y le agregamos IVA
    // Si estamos en CCF (03), usamos el precio del catálogo tal cual (Neto)
    const precioAplicar = tipoDocumento === '01' ? redondear(p.precioUni * 1.13, 8) : p.precioUni;

    newItems[index] = {
      ...newItems[index],
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidadVenta: 'UNIDAD',
      factorConversion: 1,
      precioUni: precioAplicar,
      uniMedida: p.uniMedida,
      tipoItem: p.tipoItem,
    };
    setItems(newItems);
    setStockError('');
  };

  const openProductPicker = (index: number) => {
    setProductPickerIndex(index);
    setProductSearch('');
    setShowProductPicker(true);
  };

  const handleItemDescriptionBlur = (index: number) => {
    const current = items[index];
    if (!current) return;

    const found = resolveProductForDescription({ raw: current.descripcion, products });
    if (!found) return;

    const newItems = [...items];
    const precioAplicar = tipoDocumento === '01' ? redondear(found.precioUni * 1.13, 8) : found.precioUni;

    newItems[index] = {
      ...newItems[index],
      codigo: found.codigo,
      descripcion: found.descripcion,
      precioUni: precioAplicar,
      uniMedida: found.uniMedida,
      tipoItem: found.tipoItem,
    };
    setItems(newItems);
    setStockError('');
  };

  const handlePrecioUniChange = (index: number, val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], precioUniRaw: val };
    setItems(newItems);
  };

  const handlePrecioUniBlur = (index: number) => {
    const newItems = [...items];
    const val = newItems[index].precioUniRaw;
    if (val !== undefined && val !== '') {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        newItems[index].precioUni = num;
      }
    }
    delete newItems[index].precioUniRaw;
    setItems(newItems);
  };

  const getPresentacionesForCodigo = (codigo: string) => {
    return getPresentacionesForCodigoHelper({ codigo, findProductoByCodigo: (c) => products.find(p => p.codigo === c) });
  };

  const getStockDisplayForCodigo = (codigo: string) => {
    // 1. Inventario Simplificado
    const prodService = inventarioService.findProductoByCodigo(codigo);
    if (prodService && prodService.gestionarInventario) {
      return prodService.existenciasTotales.toString();
    }
    // 2. Legacy
    const stock = stockByCode[codigo];
    if (!stock) return '0';
    return stock.onHand.toString();
  };

  const handleGenerateDTE = async () => {
    if (!emisor || !selectedReceptor) {
      addToast('Faltan datos de emisor o receptor', 'error');
      return;
    }

    // Validar items
    const validItems = items.filter(i => i.descripcion && i.cantidad > 0 && i.precioUni >= 0);
    if (validItems.length === 0) {
      addToast('Debe agregar al menos un ítem válido', 'error');
      return;
    }

    // Validar stock (si hay integración de inventario)
    const goodsOnly = validItems
      .filter(i => i.tipoItem === 1 && i.codigo)
      .map(i => ({
        codigo: i.codigo,
        cantidad: i.cantidad * i.factorConversion, // Convertir a unidades base para validación
        descripcion: i.descripcion
      }));

    if (goodsOnly.length > 0) {
      const itemsToCheckInDb: typeof goodsOnly = [];
      
      for (const item of goodsOnly) {
        const codeToSearch = (item.codigo || '').trim();
        // Prioridad: Inventario Simplificado (Service)
        const prodService = inventarioService.findProductoByCodigo(codeToSearch);
        
        if (prodService) {
           // Encontrado en el nuevo sistema.
           // Si gestiona inventario, validamos stock.
           // Si NO gestiona inventario, asumimos stock infinito (no validamos).
           // EN NINGÚN CASO caemos al sistema legacy si el producto existe aquí.
           if (prodService.gestionarInventario) {
             const config = inventarioService.getConfig();
             if (!config.permitirVentaSinStock && prodService.existenciasTotales < item.cantidad) {
               const msg = `Sin stock para ${codeToSearch}. Disponible: ${prodService.existenciasTotales.toFixed(2)}`;
               setStockError(msg);
               addToast(msg, 'error');
               return;
             }
           }
        } else {
           // No está en service, agregar a lista para validar en legacy DB
           itemsToCheckInDb.push(item);
        }
      }

      if (itemsToCheckInDb.length > 0) {
        const stockCheck = await validateStockForSale(itemsToCheckInDb);
        if (!stockCheck.ok) {
          setStockError(stockCheck.message);
          addToast(stockCheck.message, 'error');
          return;
        }
      }
    }

    setIsGenerating(true);
    setStockError('');

    try {
      const correlativo = Date.now() % 100000;
      
      const itemsParaCalculo: ItemFactura[] = validItems.map((item, idx) => {
        const cantidad8 = redondear(item.cantidad, 8);
        const precio8 = redondear(item.precioUni, 8);
        const totalLinea = redondear(cantidad8 * precio8, 8);

        let ventaGravada = 0;
        let ventaExenta = 0;
        let ivaItem = 0;

        if (item.esExento) {
          ventaExenta = totalLinea;
        } else if (tipoDocumento === '01') {
          const base = redondear(totalLinea / 1.13, 8);
          ventaGravada = base;
          ivaItem = redondear(totalLinea - base, 2);
        } else {
          ventaGravada = totalLinea;
          ivaItem = redondear(ventaGravada * 0.13, 2);
        }

        return {
          numItem: idx + 1,
          tipoItem: item.tipoItem,
          cantidad: cantidad8,
          codigo: item.codigo || null,
          uniMedida: item.uniMedida,
          descripcion: item.descripcion,
          precioUni: precio8,
          montoDescu: 0,
          ventaNoSuj: 0,
          ventaExenta,
          ventaGravada,
          tributos: null,
          numeroDocumento: null,
          codTributo: null,
          psv: 0,
          noGravado: 0,
          ivaItem,
        };
      });

      const totalesPreview = calcularTotales(itemsParaCalculo, tipoDocumento);

      // Validaciones MH: tolerancia 0.01
      const tolerance = 0.01;
      const itemErrors: string[] = [];
      itemsParaCalculo.forEach((it) => {
        const base = redondear(redondear(it.precioUni, 8) * redondear(it.cantidad, 8) - redondear(it.montoDescu, 8), 8);
        const sumaLineas = redondear(it.ventaGravada + it.ventaExenta + it.ventaNoSuj, 8);
        if (Math.abs(base - sumaLineas) > tolerance) {
          itemErrors.push(`Ítem ${it.numItem}: base ${base.toFixed(2)} ≠ sumatoria ${sumaLineas.toFixed(2)}`);
        }
      });

      const resumenErrors: string[] = [];
      if (Math.abs(totalesPreview.totalGravada - itemsParaCalculo.reduce((s, i) => s + i.ventaGravada, 0)) > tolerance) {
        resumenErrors.push('Total gravada no cuadra');
      }
      if (Math.abs(totalesPreview.totalExenta - itemsParaCalculo.reduce((s, i) => s + i.ventaExenta, 0)) > tolerance) {
        resumenErrors.push('Total exenta no cuadra');
      }
      if (Math.abs(totalesPreview.totalNoSuj - itemsParaCalculo.reduce((s, i) => s + i.ventaNoSuj, 0)) > tolerance) {
        resumenErrors.push('Total no sujeto no cuadra');
      }
      const ivaSum = itemsParaCalculo.reduce((s, i) => s + (i.ivaItem || 0), 0);
      if (Math.abs(totalesPreview.iva - ivaSum) > tolerance && !(ivaSum === 0 && totalesPreview.iva > 0)) {
        resumenErrors.push('IVA resumen no cuadra con ítems');
      }
      const recomputeMonto = redondear(totalesPreview.subTotal + totalesPreview.iva + totalesPreview.totalNoGravado, 2);
      if (Math.abs(totalesPreview.montoTotalOperacion - recomputeMonto) > tolerance) {
        resumenErrors.push('Monto total de operación no cuadra');
      }
      if (Math.abs(totalesPreview.totalPagar - (totalesPreview.montoTotalOperacion)) > tolerance) {
        resumenErrors.push('Total a pagar no cuadra');
      }

      // Validar datos obligatorios de emisor/receptor
      const datosErrors: string[] = [];
      const filled = (v?: string | null) => (v ?? '').toString().trim().length > 0;
      const emisorDirOK = filled(emisor.departamento) && filled(emisor.municipio) && filled(emisor.direccion);
      const emisorCodEst = emisor.codEstableMH ?? (emisor as any).codEstable;
      const emisorPunto = emisor.codPuntoVentaMH ?? (emisor as any).codPuntoVenta;
      const missingEmisor: string[] = [];
      if (!filled(emisor.nit)) missingEmisor.push('NIT');
      if (!filled(emisor.nrc)) missingEmisor.push('NRC');
      if (!filled(emisor.nombre)) missingEmisor.push('nombre');
      if (!filled(emisor.actividadEconomica)) missingEmisor.push('actividad');
      if (!emisorDirOK) missingEmisor.push('dirección');
      if (!filled(emisor.telefono)) missingEmisor.push('teléfono');
      if (!filled(emisor.correo)) missingEmisor.push('correo');
      if (!filled(emisorCodEst)) missingEmisor.push('código establecimiento MH');
      if (!filled(emisorPunto)) missingEmisor.push('código punto de venta MH');
      if (missingEmisor.length > 0) {
        datosErrors.push(`Faltan datos del emisor: ${missingEmisor.join(', ')}`);
      }

      const receptorDirOK = selectedReceptor.departamento && selectedReceptor.municipio && selectedReceptor.direccion;
      const receptorContactoOK = selectedReceptor.telefono || selectedReceptor.email;
      const totalDoc = totalesPreview.totalPagar;
      if (tipoDocumento === '01') {
        const receptorId = (selectedReceptor.nit || '').replace(/[\s-]/g, '');
        if (totalDoc >= 1095 && receptorId.length < 9) {
          datosErrors.push('Factura (01) ≥ 1095 requiere documento de receptor');
        }
      }
      if (tipoDocumento === '03') {
        if (!selectedReceptor.nit || !selectedReceptor.nrc || !receptorDirOK || !receptorContactoOK) {
          datosErrors.push('CCF (03) requiere NIT, NRC, dirección y contacto del receptor');
        }
      }

      const allErrors = [...itemErrors, ...resumenErrors, ...datosErrors];
      if (allErrors.length > 0) {
        setIsGenerating(false);
        allErrors.forEach(e => addToast(e, 'error'));
        return;
      }

      const dte = generarDTE({
        tipoDocumento,
        tipoTransmision: 1,
        emisor: {
          ...emisor,
          tipoEstablecimiento: emisor.tipoEstablecimiento || '01',
        },
        receptor: {
          id: selectedReceptor.id,
          nit: selectedReceptor.nit || '',
          name: selectedReceptor.name || '',
          nrc: selectedReceptor.nrc || '',
          nombreComercial: selectedReceptor.nombreComercial || '',
          actividadEconomica: selectedReceptor.actividadEconomica || '',
          descActividad: selectedReceptor.descActividad || '',
          departamento: selectedReceptor.departamento || '',
          municipio: selectedReceptor.municipio || '',
          direccion: selectedReceptor.direccion || '',
          telefono: selectedReceptor.telefono || '',
          email: selectedReceptor.email || '',
          timestamp: selectedReceptor.timestamp || Date.now(),
        },
        items: itemsParaCalculo,
        condicionOperacion,
        formaPago,
        observaciones,
      }, correlativo, '00');

      setGeneratedDTE(dte);
      
      // Aplicar descuentos de inventario si corresponde
      // 1. Inventario Simplificado (Prioridad)
      await inventarioService.aplicarVentaDesdeDTE(dte);
      // 2. Inventario Legacy (Opcional, mantenemos para no romper historial legacy si se usa)
      await applySalesFromDTE(dte);
      
      // Mostrar preview
      setShowDTEPreview(true);

    } catch (error) {
      console.error('Error generando DTE:', error);
      addToast('Error al generar DTE', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNuevaFactura = () => {
    setItems([{ ...defaultItem }]);
    setGeneratedDTE(null);
    setSelectedReceptor(null);
    setTipoDocumento('03');
    setFormaPago('01');
    setCondicionOperacion(1);
    setObservaciones('');
    setShowDTEPreview(false);
    setShowTransmision(false);
  };

  const handleTransmitir = () => {
    if (!generatedDTE) return;
    setShowDTEPreview(false);
    setShowTransmision(true);
  };

  const handleDeleteGeneratedDTE = async () => {
    if (generatedDTE) {
      // 1. Revertir en Inventario Simplificado
      const docRef = generatedDTE.identificacion.numeroControl;
      if (docRef) {
        await inventarioService.revertirVentaPorDocumentoReferencia(docRef);
      }
      
      // 2. Revertir en Legacy
      await revertSalesFromDTE(generatedDTE);
      
      setGeneratedDTE(null);
      addToast('DTE descartado y stock revertido', 'info');
      setShowDTEPreview(false);
    }
  };

  const handleCopyJSON = () => {
    if (generatedDTE) {
      navigator.clipboard.writeText(JSON.stringify(generatedDTE, null, 2));
      addToast('JSON copiado al portapapeles', 'success');
    }
  };

  const handleDownloadJSON = () => {
    if (generatedDTE) {
      const blob = new Blob([JSON.stringify(generatedDTE, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DTE-${generatedDTE.identificacion.codigoGeneracion}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleStripeConnectSuccess = () => {
    addToast('Conexión con Stripe exitosa', 'success');
    setShowStripeConnect(false);
  };

  const confirmarResolucion = async () => {
    // Implementación simplificada para resolver items sin código
    // Aquí deberías actualizar el inventario o crear productos
    // const resolved = resolverItems; // Accedemos al estado directamente si es necesario
    setShowResolveModal(false);
    addToast('Items resueltos (Simulado)', 'success');
  };

  // Validación de NIT, NRC, etc. (helpers)
  const emisorValidations = useMemo(() => ({
    nit: validateNIT(emisorForm.nit),
    nrc: validateNRC(emisorForm.nrc),
    telefono: validatePhone(emisorForm.telefono),
    correo: validateEmail(emisorForm.correo),
  }), [emisorForm]);

  // Calcular totales para la UI
  const itemsParaCalculoUI: ItemFactura[] = items.map((item, idx) => {
    const cantidad8 = redondear(item.cantidad, 8);
    const precio8 = redondear(item.precioUni, 8);
    const totalLinea = redondear(cantidad8 * precio8, 8);

    let ventaGravada = 0;
    let ventaExenta = 0;
    let ivaItem = 0;

    if (item.esExento) {
      ventaExenta = totalLinea;
    } else if (tipoDocumento === '01') {
      const base = redondear(totalLinea / 1.13, 8);
      ventaGravada = base;
      ivaItem = redondear(totalLinea - base, 2);
    } else {
      ventaGravada = totalLinea;
      ivaItem = redondear(ventaGravada * 0.13, 2);
    }

    return {
      numItem: idx + 1,
      tipoItem: item.tipoItem,
      cantidad: cantidad8,
      codigo: item.codigo || null,
      uniMedida: item.uniMedida,
      descripcion: item.descripcion,
      precioUni: precio8,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta,
      ventaGravada,
      tributos: null,
      numeroDocumento: null,
      codTributo: null,
      psv: 0,
      noGravado: 0,
      ivaItem,
    };
  });

  const totales = calcularTotales(itemsParaCalculoUI, tipoDocumento);

  if (isMobile) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {showTransmision && generatedDTE && (
          <TransmisionModal
            dte={generatedDTE}
            onClose={() => setShowTransmision(false)}
            onSuccess={(sello) => {
              addToast(`DTE transmitido. Sello: ${sello.substring(0, 8)}...`, 'success');
            }}
            ambiente="00"
            logoUrl={emisor?.logo}
          />
        )}

        {showQRCapture && (
          <QRClientCapture
            onClose={() => setShowQRCapture(false)}
            onClientImported={(client) => {
              setSelectedReceptor(client);
              setShowQRCapture(false);
              addToast(`Cliente "${client.name}" importado`, 'success');
              loadData();
            }}
          />
        )}

        <MobileFactura
          emisor={emisor}
          onShowEmisorConfig={() => setShowEmisorConfig(true)}
          onShowTransmision={(dte) => {
            setGeneratedDTE(dte);
            setShowTransmision(true);
          }}
        />

        {/* Modal Emisor Config para móvil - Completo con validación */}
        {showEmisorConfig && (
          <MobileEmisorModal
            emisorForm={emisorForm}
            setEmisorForm={setEmisorForm}
            onSave={handleSaveEmisor}
            onClose={() => setShowEmisorConfig(false)}
            isSaving={isSavingEmisor}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col md:h-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <FacturaModals
        // ResolveNoCodeModal
        showResolveModal={showResolveModal}
        setShowResolveModal={setShowResolveModal}
        resolverItems={resolverItems}
        setResolverItems={setResolverItems}
        inventarioService={inventarioService}
        addToast={addToast}
        confirmarResolucion={confirmarResolucion}
        // TransmisionModal
        showTransmision={showTransmision}
        generatedDTE={generatedDTE}
        emisor={emisor}
        setShowTransmision={setShowTransmision}
        // DTEPreviewModal
        showDTEPreview={showDTEPreview}
        setShowDTEPreview={setShowDTEPreview}
        handleCopyJSON={handleCopyJSON}
        handleDownloadJSON={handleDownloadJSON}
        // QRClientCapture
        showQRCapture={showQRCapture}
        setShowQRCapture={setShowQRCapture}
        setSelectedReceptor={setSelectedReceptor}
        loadData={loadData}
        // EmisorConfigModal
        showEmisorConfig={showEmisorConfig}
        setShowEmisorConfig={setShowEmisorConfig}
        emisorForm={emisorForm}
        setEmisorForm={setEmisorForm}
        nitValidation={emisorValidations.nit}
        nrcValidation={emisorValidations.nrc}
        telefonoValidation={emisorValidations.telefono}
        correoValidation={emisorValidations.correo}
        formatTextInput={formatTextInput}
        formatMultilineTextInput={formatMultilineTextInput}
        handleSaveEmisor={handleSaveEmisor}
        isSavingEmisor={isSavingEmisor}
        apiPassword={apiPassword}
        certificatePassword={certificatePassword}
        showCertPassword={showCertPassword}
        certificateError={certificateError}
        isSavingCert={isSavingCert}
        setApiPassword={setApiPassword}
        setCertificatePassword={setCertificatePassword}
        setShowCertPassword={setShowCertPassword}
        certificateFile={certificateFile}
        handleCertFileSelect={handleCertFileSelect}
        handleSaveCertificate={() => handleSaveCertificate(emisorForm.nit, emisorForm.nrc)}
        fileInputRef={fileInputRef}
        // ProductPickerModal
        canUseCatalogoProductos={canUseCatalogoProductos}
        showProductPicker={showProductPicker}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        filteredProductsForPicker={filteredProductsForPicker}
        productPickerIndex={productPickerIndex}
        applyProductToItem={applyProductToItem}
        setShowProductPicker={setShowProductPicker}
        // QRPaymentModal
        showQRPayment={showQRPayment}
        setShowQRPayment={setShowQRPayment}
        // StripeConnectModal
        showStripeConnect={showStripeConnect}
        setShowStripeConnect={setShowStripeConnect}
        handleStripeConnectSuccess={handleStripeConnectSuccess}
        totales={totales}
      />

      {/* Header */}
      <FacturaHeader emisor={emisor} onOpenEmisorConfig={() => setShowEmisorConfig(true)} />

      {/* Main Content */}
      <FacturaMainContent
        // Left column
        selectedReceptor={selectedReceptor}
        showClientSearch={showClientSearch}
        setShowClientSearch={setShowClientSearch}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        filteredClients={filteredClients}
        onSelectReceptor={handleSelectReceptor}
        tipoDocumento={tipoDocumento}
        setTipoDocumento={handleSetTipoDocumento}
        receptorEsConsumidorFinal={receptorEsConsumidorFinal}
        tiposDocumentoFiltrados={tiposDocumentoFiltrados}
        items={items}
        canUseCatalogoProductos={canUseCatalogoProductos}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onOpenProductPicker={openProductPicker}
        onItemChange={handleItemChange}
        onItemDescriptionBlur={handleItemDescriptionBlur}
        onPrecioUniChange={handlePrecioUniChange}
        onPrecioUniBlur={handlePrecioUniBlur}
        getPresentacionesForCodigo={getPresentacionesForCodigo}
        getStockDisplayForCodigo={getStockDisplayForCodigo}
        redondear={redondear}
        formaPago={formaPago}
        setFormaPago={setFormaPago}
        formasPago={formasPago}
        condicionOperacion={condicionOperacion}
        setCondicionOperacion={setCondicionOperacion}
        observaciones={observaciones}
        setObservaciones={setObservaciones}
        stockError={stockError}
        isGenerating={isGenerating}
        emisor={emisor}
        generatedDTE={generatedDTE}
        onGenerateDTE={handleGenerateDTE}
        onNuevaFactura={handleNuevaFactura}
        // Right column
        totales={totales}
        requiereStripe={requiereStripe}
        onOpenDTEPreview={() => setShowDTEPreview(true)}
        onTransmit={handleTransmitir}
        onDeleteDTE={handleDeleteGeneratedDTE}
      />
    </div>
  );
};

export default FacturaGenerator;
