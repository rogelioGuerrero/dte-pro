import { MonthlyTaxAccumulator } from './types';

export const getPeriodFromDate = (dateStr: string): { month: string; year: string; key: string } => {
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return { month, year, key: `${year}-${month}` };
};

export const createEmptyAccumulator = (periodKey: { key: string }): MonthlyTaxAccumulator => {
  return {
    period: periodKey.key,
    ingresosBrutos: 0,
    totalGravada: 0,
    totalExenta: 0,
    totalNoSujeta: 0,
    ivaDebito: 0,
    comprasGravadas: 0,
    comprasExentas: 0,
    ivaCredito: 0,
    retencionRenta: 0,
    retencionIva: 0,
    percepcionIva: 0,
    lastUpdated: new Date().toISOString()
  };
};

export const updateTaxAccumulator = (acc: MonthlyTaxAccumulator, dte: any, flowType: 'emission' | 'reception' = 'emission'): MonthlyTaxAccumulator => {
  const newAcc = { ...acc };
  
  // Asumimos estructura estándar de DTE JSON (FE o CCF)
  const resumen = dte.resumen;
  
  if (resumen) {
    const gravada = (resumen.totalGravada || 0);
    const exenta = (resumen.totalExenta || 0);
    const noSujeta = (resumen.totalNoSuj || 0);
    
    // Calcular IVA
    let iva = 0;
    if (resumen.tributos && Array.isArray(resumen.tributos)) {
       const ivaTributo = resumen.tributos.find((t: any) => t.codigo === '20');
       if (ivaTributo) {
         iva = (ivaTributo.valor || 0);
       }
    }

    if (flowType === 'emission') {
      // --- VENTAS (Débito Fiscal) ---
      newAcc.totalGravada += gravada;
      newAcc.totalExenta += exenta;
      newAcc.totalNoSujeta += noSujeta;
      newAcc.ingresosBrutos += (gravada + exenta + noSujeta);
      newAcc.ivaDebito += iva;
      
    } else {
      // --- COMPRAS (Crédito Fiscal) ---
      // Solo sumamos al crédito fiscal si es DTE 03 (CCF) o similar deducible
      // DTE 01 (Factura) recibido por un contribuyente NO genera crédito fiscal (generalmente gasto)
      // DTE 14 (Sujeto Excluido) es compra
      
      const tipoDte = dte.identificacion?.tipoDte;
      
      // Mapeo básico
      newAcc.comprasGravadas += gravada;
      newAcc.comprasExentas += exenta;
      
      // Si es CCF (03) o DTE con IVA desglosado deducible
      if (tipoDte === '03' || tipoDte === '05' || iva > 0) {
        newAcc.ivaCredito += iva;
      }
      
      // Retenciones recibidas (DTE 07 recibido)
      if (tipoDte === '07') {
         // Lógica para retenciones recibidas (reducen pago)
         // Depende de si es Renta o IVA
         // Simplificación: Asumir IVA por ahora si no hay detalle
         newAcc.retencionIva += (resumen.totalRetencion || 0); 
      }
    }
  }
  
  newAcc.lastUpdated = new Date().toISOString();
  return newAcc;
};
