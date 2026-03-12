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
import { getBillingStyle, getUserModeConfig, hasFeature } from '../utils/userMode';
import { useStockByCode } from '../hooks/useStockByCode';
import { requiereStripe } from '../catalogos/pagos';
import { mergeProducts } from '../utils/inventoryAdapter';
import { 
  getPresentacionesForCodigo as getPresentacionesForCodigoHelper,
} from '../utils/facturaGeneratorInventoryHelpers';
import type { ResolverItem } from './ResolveNoCodeModal';
import type { ProductoFactura } from './inventario/SelectorProductosFactura';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';
import { useEmisor } from '../contexts/EmisorContext';

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
  const billingStyle = getBillingStyle();
  const defaultItem: ItemForm = isModoProfesional ? { ...emptyItem, tipoItem: 2 } : { ...emptyItem };
  const canUseCatalogoProductos = hasFeature('productos');
  const { toasts, addToast, removeToast } = useToast();
  const { businessId } = useEmisor();

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

  const handleSetTipoDocumento = (_value: string) => {
    setTipoDocumento('03');
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
    onTransmitBlocked: () => {
      if (!businessId) {
        addToast('Demo: selecciona/crea un emisor en Mi Cuenta para transmitir.', 'info');
        return true;
      }
      return false;
    },
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

  const receptorEsConsumidorFinal = false;

  const tipoDocumentoHint = 'Crédito Fiscal (03): usa el mismo precio final de venta; el sistema separa base e IVA al generar el DTE.';

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10);
    const lower = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      c.nit.includes(clientSearch) ||
      (c.nombreComercial && c.nombreComercial.toLowerCase().includes(lower))
    ).slice(0, 10);
  }, [clients, clientSearch]);

  const tiposDocumentoFiltrados = useMemo(() => tiposDocumento.filter(t => t.codigo === '03'), []);

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

  const openProductPicker = (index: number) => {
    setProductPickerIndex(index);
    setProductSearch('');
    setShowProductPicker(true);
  };

  const handleApplyProductToItem = (index: number, p: ProductData) => {
    applyProductToItem(index, p);
    setStockError('');
  };

  const handleQuickAddProduct = (producto: ProductoFactura) => {
    const normalizedCode = (producto.codigo || '').trim();
    const quantityToAdd = producto.cantidad || 1;

    if (normalizedCode) {
      const existingIndex = items.findIndex((item) => (item.codigo || '').trim() === normalizedCode);
      if (existingIndex >= 0) {
        handleItemChange(existingIndex, 'cantidad', items[existingIndex].cantidad + quantityToAdd);
        setStockError('');
        return;
      }
    }

    const productData: ProductData = {
      key: `quick-${producto.id}`,
      codigo: normalizedCode,
      descripcion: producto.descripcion,
      uniMedida: Number(producto.unidadMedida) || 99,
      tipoItem: producto.tipoItem || 1,
      precioUni: producto.precioUnitario || 0,
      timestamp: Date.now(),
    };

    const newItem: ItemForm = {
      ...defaultItem,
      codigo: productData.codigo,
      descripcion: productData.descripcion,
      cantidad: quantityToAdd,
      unidadVenta: 'UNIDAD',
      factorConversion: 1,
      precioUni: productData.precioUni,
      tipoItem: productData.tipoItem,
      uniMedida: productData.uniMedida,
    };

    const isDefaultEmptyRow =
      items.length === 1 &&
      !(items[0].codigo || '').trim() &&
      !(items[0].descripcion || '').trim() &&
      items[0].precioUni === 0;

    if (isDefaultEmptyRow) {
      setItems([newItem]);
      setStockError('');
      return;
    }

    setItems((prev) => [...prev, newItem]);
    setStockError('');
  };

  const handleItemDescriptionBlurWithStockClear = (index: number) => {
    handleItemDescriptionBlur(index);
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
      const totalFinal = totalLinea;
      ventaGravada = redondear(totalFinal / 1.13, 8);
      ivaItem = redondear(totalFinal - ventaGravada, 2);
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
        onQuickAddProduct={billingStyle === 'inventory_first' ? handleQuickAddProduct : undefined}
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
