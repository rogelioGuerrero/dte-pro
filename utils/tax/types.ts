export interface MonthlyTaxAccumulator {
  period: string; // "YYYY-MM"
  
  // Ventas (Débito Fiscal)
  ingresosBrutos: number; 
  totalGravada: number;
  totalExenta: number;
  totalNoSujeta: number;
  ivaDebito: number; 
  
  // Compras (Crédito Fiscal)
  comprasGravadas: number;
  comprasExentas: number;
  ivaCredito: number;
  
  // Retenciones/Percepciones
  retencionRenta: number; 
  retencionIva: number;   
  percepcionIva: number;  
  
  lastUpdated: string;
}
