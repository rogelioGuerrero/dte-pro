import { useState } from 'react';
import { DTEJSON, ItemFactura, calcularTotales, generarCorrelativoControlado, generarDTE, redondear } from '../utils/dteGenerator';
import { ClientData } from '../utils/clientDb';
import { EmisorData } from '../utils/emisorDb';
import { ItemForm } from './useFacturaItems';
import { inventarioService } from '../utils/inventario/inventarioService';
import { applySalesFromDTE, revertSalesFromDTE, validateStockForSale } from '../utils/inventoryDb';

interface Params {
  emisor: EmisorData | null;
  selectedReceptor: ClientData | null;
  setSelectedReceptor: (c: ClientData | null) => void;
  items: ItemForm[];
  setItems: (items: ItemForm[]) => void;
  defaultItem: ItemForm;
  tipoDocumento: string;
  setTipoDocumento: (t: string) => void;
  setFormaPago: (fp: string) => void;
  setCondicionOperacion: (co: number) => void;
  setObservaciones: (obs: string) => void;
  formaPago: string;
  condicionOperacion: number;
  observaciones: string;
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setStockError: (msg: string) => void;
  ambiente: string;
  onTransmitBlocked?: () => boolean;
}

export function useDTEWorkflow({
  emisor,
  selectedReceptor,
  setSelectedReceptor,
  items,
  setItems,
  defaultItem,
  tipoDocumento,
  setTipoDocumento,
  setFormaPago,
  setCondicionOperacion,
  setObservaciones,
  formaPago,
  condicionOperacion,
  observaciones,
  addToast,
  setStockError,
  ambiente,
  onTransmitBlocked,
}: Params) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [showDTEPreview, setShowDTEPreview] = useState(false);
  const [showTransmision, setShowTransmision] = useState(false);

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
        cantidad: i.cantidad * i.factorConversion,
        descripcion: i.descripcion
      }));

    if (goodsOnly.length > 0) {
      const itemsToCheckInDb: typeof goodsOnly = [];

      for (const item of goodsOnly) {
        const codeToSearch = (item.codigo || '').trim();
        const prodService = inventarioService.findProductoByCodigo(codeToSearch);

        if (prodService) {
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
      const correlativo = generarCorrelativoControlado(
        tipoDocumento,
        emisor.codEstableMH ?? null,
        emisor.codPuntoVentaMH ?? null,
      );

      const itemsParaCalculo: ItemFactura[] = validItems.map((item, idx) => {
        const cantidad8 = redondear(item.cantidad, 8);
        const precio8 = redondear(item.precioUni, 8);
        const totalLinea = redondear(cantidad8 * precio8, 8);

        let ventaGravada = 0;
        let ventaExenta = 0;
        let ventaNoSuj = 0;
        let ivaItem = 0;

        if (item.esExento) {
          ventaExenta = totalLinea;
        } else if (tipoDocumento === '01') {
          // FE: mantener precio final con IVA en ventaGravada; backend recalcula IVA
          ventaGravada = totalLinea;
          ivaItem = 0;
        } else if (tipoDocumento === '03') {
          const totalFinal = totalLinea;
          ventaGravada = redondear(totalFinal / 1.13, 8);
          ivaItem = redondear(totalFinal - ventaGravada, 2);
        } else {
          ventaGravada = totalLinea;
        }

        const tributos = (ventaGravada > 0 && tipoDocumento === '03') ? ['20'] : null;
        const precioUnitarioNormalizado = tipoDocumento === '03' && cantidad8 > 0
          ? redondear((ventaGravada + ventaExenta + ventaNoSuj) / cantidad8, 8)
          : precio8;

        return {
          numItem: idx + 1,
          tipoItem: item.tipoItem,
          cantidad: cantidad8,
          codigo: item.codigo || null,
          uniMedida: item.uniMedida || 99,
          descripcion: item.descripcion,
          precioUni: precioUnitarioNormalizado,
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

      const totalesPreview = calcularTotales(itemsParaCalculo, tipoDocumento);

      const tolerance = 0.01;
      const itemErrors: string[] = [];
      itemsParaCalculo.forEach((it) => {
        const baseBruta = redondear(redondear(it.precioUni, 8) * redondear(it.cantidad, 8) - redondear(it.montoDescu, 8), 8);
        const baseEsperada =
          tipoDocumento === '03' && it.ventaGravada > 0 && it.ventaExenta === 0 && it.ventaNoSuj === 0
            ? baseBruta
            : baseBruta;
        const sumaLineas = redondear(it.ventaGravada + it.ventaExenta + it.ventaNoSuj, 8);
        if (Math.abs(baseEsperada - sumaLineas) > tolerance) {
          itemErrors.push(`Ítem ${it.numItem}: base ${baseEsperada.toFixed(2)} ≠ sumatoria ${sumaLineas.toFixed(2)}`);
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

      const datosErrors: string[] = [];
      const filled = (v?: string | null) => (v ?? '').toString().trim().length > 0;
      const missingEmisor: string[] = [];
      if (!filled(emisor.nit)) missingEmisor.push('NIT');
      if (!filled(emisor.nrc)) missingEmisor.push('NRC');
      if (!filled(emisor.nombre)) missingEmisor.push('nombre');
      if (!filled(emisor.actividadEconomica)) missingEmisor.push('actividad');
      if (!filled(emisor.telefono)) missingEmisor.push('teléfono');
      if (!filled(emisor.correo)) missingEmisor.push('correo');
      if (missingEmisor.length > 0) {
        datosErrors.push(`Faltan datos del emisor: ${missingEmisor.join(', ')}`);
      }

      const totalDoc = totalesPreview.totalPagar;
      if (tipoDocumento === '01') {
        const receptorId = (selectedReceptor.nit || '').replace(/\s|-/g, '');
        if (totalDoc >= 1095 && receptorId.length < 9) {
          datosErrors.push('Factura (01) ≥ 1095 requiere documento de receptor');
        }
      }
      if (tipoDocumento === '03') {
        if (!filled(selectedReceptor.name)) {
          datosErrors.push('Crédito Fiscal (03) requiere al menos el nombre del receptor');
        }
        const receptorNit = (selectedReceptor.nit || '').replace(/\s|-/g, '');
        if (receptorNit.length !== 14) {
          datosErrors.push('Crédito Fiscal (03) requiere NIT de receptor válido de 14 dígitos');
        }
        if (!filled(selectedReceptor.nrc)) {
          datosErrors.push('Crédito Fiscal (03) requiere NRC del receptor');
        }
        if (!filled(selectedReceptor.departamento) || !filled(selectedReceptor.municipio) || !filled(selectedReceptor.direccion)) {
          datosErrors.push('Crédito Fiscal (03) requiere dirección completa del receptor');
        }
        if (!filled(selectedReceptor.actividadEconomica) && !filled(selectedReceptor.descActividad)) {
          datosErrors.push('Crédito Fiscal (03) requiere actividad económica o giro del receptor');
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
      }, correlativo, ambiente);

      setGeneratedDTE(dte);

      await inventarioService.aplicarVentaDesdeDTE(dte);
      await applySalesFromDTE(dte);

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
    if (onTransmitBlocked && onTransmitBlocked()) return;
    setShowDTEPreview(false);
    setShowTransmision(true);
  };

  const handleDeleteGeneratedDTE = async () => {
    if (generatedDTE) {
      const docRef = generatedDTE.identificacion.numeroControl;
      if (docRef) {
        await inventarioService.revertirVentaPorDocumentoReferencia(docRef);
      }
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

  return {
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
  };
}
