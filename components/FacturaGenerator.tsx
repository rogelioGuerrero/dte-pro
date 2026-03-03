import React, { useState, useEffect, useMemo } from 'react';
import { getClients, ClientData } from '../utils/clientDb';
import { ProductData, getProducts } from '../utils/productDb';
import { getEmisor, saveEmisor, EmisorData } from '../utils/emisorDb';
import { 
  ItemFactura, tiposDocumento, formasPago,
  calcularTotales, redondear
} from '../utils/dteGenerator';
import { ToastContainer, useToast } from './Toast';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { useFacturaItems, ItemForm } from '../hooks/useFacturaItems';
import { useDTEWorkflow } from '../hooks/useDTEWorkflow';
import { FacturaMainContent } from './FacturaMainContent';
import { FacturaModals } from './FacturaModals';
import { FacturaHeader } from './FacturaHeader';
import { inventarioService } from '../utils/inventario/inventarioService';
import { getUserModeConfig, hasFeature } from '../utils/userMode';
import { useStockByCode } from '../hooks/useStockByCode';
import { requiereStripe } from '../catalogos/pagos';
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

const emptyItem: ItemForm = {
  id: '',
  codigo: '',
  descripcion: '',
  cantidad: 1,
  unidadVenta: 'UNIDAD',
  factorConversion: 1,
  precioUni: 0,
  tipoItem: 1,
  uniMedida: 99,
  esExento: false,
  cargosNoBase: 0,
  tributoCodigo: null,
};

const FacturaGenerator: React.FC = () => {
  const isModoProfesional = getUserModeConfig().mode === 'profesional';
  const defaultItem: ItemForm = isModoProfesional ? { ...emptyItem, tipoItem: 2 } : { ...emptyItem };
  const canUseCatalogoProductos = hasFeature('productos');
  const { toasts, addToast, removeToast } = useToast();

  const [showQRCapture, setShowQRCapture] = useState(false);
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

  const [tipoDocumento, setTipoDocumento] = useState('03');
  const [formaPago, setFormaPago] = useState('01');
  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [observaciones, setObservaciones] = useState('');

  const ambiente = useMemo(() => localStorage.getItem('dte_ambiente') || '00', []);

  const {
    items,
    setItems,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    applyProductToItem,
    handleItemDescriptionBlur,
    handlePrecioUniChange,
    handlePrecioUniBlur,
  } = useFacturaItems({ defaultItem, tipoDocumento, products });

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

  const {
    isGenerating,
    generatedDTE,
    showDTEPreview,
    setShowDTEPreview,
    showTransmision,
    setShowTransmision,
    handleGenerateDTE,
    handleNuevaFactura,
    handleTransmitir,
    handleDeleteGeneratedDTE,
    handleCopyJSON,
    handleDownloadJSON,
  } = useDTEWorkflow({
    emisor,
    selectedReceptor,
    setSelectedReceptor,
    items,
    setItems,
    defaultItem,
    tipoDocumento,
    setTipoDocumento: handleSetTipoDocumento,
    setFormaPago,
    setCondicionOperacion,
    setObservaciones,
    formaPago,
    condicionOperacion,
    observaciones,
    addToast: (msg, type) => addToast(msg, type as any),
    setStockError,
    ambiente,
  });

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

  const tipoDocumentoHint = tipoDocumento === '01'
    ? '01: Ingresa precio con IVA incluido (13%).'
    : tipoDocumento === '03'
      ? '03: Ingresa precio sin IVA; se calculará 13%.'
      : 'Ajusta precios según el tipo de documento.';

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

  const openProductPicker = (index: number) => {
    setProductPickerIndex(index);
    setProductSearch('');
    setShowProductPicker(true);
  };

  const handleApplyProductToItem = (index: number, p: ProductData) => {
    applyProductToItem(index, p);
    setStockError('');
  };

  const handleItemDescriptionBlurWithStockClear = (index: number) => {
    handleItemDescriptionBlur(index, tipoDocumento);
    setStockError('');
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
    let ventaNoSuj = 0;
    let ivaItem = 0;

    // Lógica simple: solo esExento vs gravado
    if (item.esExento) {
      ventaExenta = totalLinea;
    } else if (tipoDocumento === '01') {
      // Factura: mantener precio final (incluye IVA) en ventaGravada; backend recalcula IVA
      ventaGravada = totalLinea;
      ivaItem = 0;
    } else if (tipoDocumento === '03') {
      // CCF: precio sin IVA
      ventaGravada = totalLinea;
      ivaItem = redondear(totalLinea * 0.13, 2);
    } else {
      // Otros documentos: sin IVA
      ventaGravada = totalLinea;
    }

    // Tributos: solo IVA 13% si hay venta gravada y es FE/CCF
    const tributos = (ventaGravada > 0 && tipoDocumento === '03') ? ['20'] : null;

    return {
      numItem: idx + 1,
      tipoItem: item.tipoItem,
      cantidad: cantidad8,
      codigo: item.codigo || null,
      uniMedida: item.uniMedida || 99,
      descripcion: item.descripcion,
      precioUni: precio8,
      montoDescu: 0,
      ventaNoSuj,
      ventaExenta,
      ventaGravada,
      tributos,
      numeroDocumento: null,
      codTributo: null,
      psv: 0,
      noGravado: 0,
      ivaItem,
      cargosNoBase: item.cargosNoBase || 0,
    };
  });

  const totales = calcularTotales(itemsParaCalculoUI, tipoDocumento);

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col md:h-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <FacturaModals
        showResolveModal={showResolveModal}
        setShowResolveModal={setShowResolveModal}
        resolverItems={resolverItems}
        setResolverItems={setResolverItems}
        inventarioService={inventarioService}
        addToast={addToast}
        confirmarResolucion={confirmarResolucion}
        showTransmision={showTransmision}
        generatedDTE={generatedDTE}
        emisor={emisor}
        setShowTransmision={setShowTransmision}
        showDTEPreview={showDTEPreview}
        setShowDTEPreview={setShowDTEPreview}
        handleCopyJSON={handleCopyJSON}
        handleDownloadJSON={handleDownloadJSON}
        showQRCapture={showQRCapture}
        setShowQRCapture={setShowQRCapture}
        setSelectedReceptor={setSelectedReceptor}
        loadData={loadData}
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
        handleSaveCertificate={() => handleSaveCertificate(emisorForm, ambiente)}
        fileInputRef={fileInputRef}
        canUseCatalogoProductos={canUseCatalogoProductos}
        showProductPicker={showProductPicker}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        filteredProductsForPicker={filteredProductsForPicker}
        productPickerIndex={productPickerIndex}
        applyProductToItem={handleApplyProductToItem}
        setShowProductPicker={setShowProductPicker}
        showQRPayment={showQRPayment}
        setShowQRPayment={setShowQRPayment}
        showStripeConnect={showStripeConnect}
        setShowStripeConnect={setShowStripeConnect}
        handleStripeConnectSuccess={handleStripeConnectSuccess}
        totales={totales}
      />

      <FacturaHeader emisor={emisor} onOpenEmisorConfig={() => setShowEmisorConfig(true)} />

      <FacturaMainContent
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
        onItemDescriptionBlur={handleItemDescriptionBlurWithStockClear}
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
        totales={totales}
        requiereStripe={requiereStripe}
        onOpenDTEPreview={() => setShowDTEPreview(true)}
        onTransmit={handleTransmitir}
        onDeleteDTE={handleDeleteGeneratedDTE}
        tipoDocumentoHint={tipoDocumentoHint}
      />
    </div>
  );
};

export default FacturaGenerator;
