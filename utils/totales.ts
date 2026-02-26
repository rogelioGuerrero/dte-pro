import { ItemFactura } from './types';
import { redondear } from './formatters';

export const calcularTotales = (items: ItemFactura[], tipoDocumento: string = '01') => {
  const normalizados = items.map((item) => ({
    cantidad: redondear(item.cantidad || 0, 8),
    precioUni: redondear(item.precioUni || 0, 8),
    montoDescu: redondear(item.montoDescu || 0, 8),
    ventaNoSuj: redondear(item.ventaNoSuj || 0, 8),
    ventaExenta: redondear(item.ventaExenta || 0, 8),
    ventaGravada: redondear(item.ventaGravada || 0, 8),
    ivaItem: redondear(item.ivaItem || 0, 8),
    noGravado: redondear(item.noGravado || 0, 8),
    cargosNoBase: redondear(item.cargosNoBase || 0, 8),
  }));

  const totalGravadaRaw = normalizados.reduce((sum, item) => sum + item.ventaGravada, 0);
  const totalExentaRaw = normalizados.reduce((sum, item) => sum + item.ventaExenta, 0);
  const totalNoSujRaw = normalizados.reduce((sum, item) => sum + item.ventaNoSuj, 0);
  const totalDescuRaw = normalizados.reduce((sum, item) => sum + item.montoDescu, 0);
  const totalNoGravadoRaw = normalizados.reduce((sum, item) => sum + item.noGravado, 0);
  const ivaItemsRaw = normalizados.reduce((sum, item) => sum + item.ivaItem, 0);
  const totalCargosNoBaseRaw = normalizados.reduce((sum, item) => sum + item.cargosNoBase, 0);

  const totalGravada = redondear(totalGravadaRaw, 2);
  const totalExenta = redondear(totalExentaRaw, 2);
  const totalNoSuj = redondear(totalNoSujRaw, 2);
  const totalDescu = redondear(totalDescuRaw, 2);
  const totalNoGravado = redondear(totalNoGravadoRaw, 2);
  const totalCargosNoBase = redondear(totalCargosNoBaseRaw, 2);

  const subTotalVentas = redondear(totalGravada + totalExenta + totalNoSuj, 2);
  const subTotal = redondear(subTotalVentas - totalDescu, 2);

  // El IVA ahora se pre-calcula por ítem en la UI, solo sumamos (redondeado a 2)
  const iva = redondear(ivaItemsRaw, 2);

  const tributosAdicionales = 0;
  const ivaRete1 = 0;
  const reteRenta = 0;
  const saldoFavor = 0;
  const ivaPerci1 = 0;

  const montoTotalOperacion = tipoDocumento === '01'
    ? redondear(totalGravada + tributosAdicionales + totalNoGravado, 2)
    : redondear(subTotal + iva + tributosAdicionales + totalNoGravado, 2);

  const totalPagar = redondear(
    montoTotalOperacion - ivaRete1 - reteRenta + saldoFavor + totalCargosNoBase,
    2
  );

  return {
    totalNoSuj,
    totalExenta,
    totalGravada,
    totalNoGravado,
    subTotalVentas,
    subTotal,
    totalDescu,
    iva,
    montoTotalOperacion,
    totalCargosNoBase,
    totalPagar,
    ivaPerci1,
  };
};
