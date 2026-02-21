import React, { useState, useEffect } from 'react';
import { getAllAccumulators } from '../../utils/tax/taxStorage';
import { MonthlyTaxAccumulator } from '../../utils/tax/types';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Calendar, FileText } from 'lucide-react';

const FiscalDashboard: React.FC = () => {
  const [accumulators, setAccumulators] = useState<MonthlyTaxAccumulator[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const loadData = async () => {
    const data = await getAllAccumulators();
    // Sort by period descending
    const sorted = data.sort((a, b) => b.period.localeCompare(a.period));
    setAccumulators(sorted);
    if (sorted.length > 0 && !selectedMonth) {
      setSelectedMonth(sorted[0].period);
    }
  };

  useEffect(() => {
    loadData();
    
    const handler = () => loadData();
    window.addEventListener('dte-tax-updated', handler);
    return () => window.removeEventListener('dte-tax-updated', handler);
  }, []);

  const currentAcc = accumulators.find(a => a.period === selectedMonth);

  if (!currentAcc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 animate-in fade-in">
        <Calculator className="w-16 h-16 mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700">Sin Datos Fiscales</h3>
        <p className="max-w-md text-center mt-2">
          Comienza a emitir facturas o sube tus comprobantes de compras en "Libros IVA" para ver tu proyección de impuestos.
        </p>
      </div>
    );
  }

  // Cálculos básicos
  const ivaPorPagar = Math.max(0, currentAcc.ivaDebito - currentAcc.ivaCredito - currentAcc.retencionIva + currentAcc.percepcionIva);
  const pagoCuenta = currentAcc.ingresosBrutos * 0.0175; // 1.75% por defecto (configurable en futuro)
  const totalImpuestos = ivaPorPagar + pagoCuenta - currentAcc.retencionRenta;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <Calculator className="w-6 h-6" />
            </span>
            Panel de Impuestos
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Proyección de impuestos basada en tus DTEs procesados en tiempo real.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 font-medium"
          >
            {accumulators.map(acc => (
              <option key={acc.period} value={acc.period}>
                {new Date(acc.period + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* F07 Summary */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              IVA (F07)
            </h3>
            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">MENSUAL</span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-end">
              <div className="text-sm text-gray-500">Débito Fiscal (Ventas)</div>
              <div className="font-mono font-medium text-gray-900">+ ${currentAcc.ivaDebito.toFixed(2)}</div>
            </div>
            <div className="flex justify-between items-end">
              <div className="text-sm text-gray-500">Crédito Fiscal (Compras)</div>
              <div className="font-mono font-medium text-emerald-600">- ${currentAcc.ivaCredito.toFixed(2)}</div>
            </div>
            {currentAcc.retencionIva > 0 && (
              <div className="flex justify-between items-end">
                <div className="text-sm text-gray-500">Retenciones Recibidas</div>
                <div className="font-mono font-medium text-emerald-600">- ${currentAcc.retencionIva.toFixed(2)}</div>
              </div>
            )}
            <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
              <div className="font-bold text-gray-800">IVA a Pagar</div>
              <div className="font-mono font-bold text-xl text-indigo-600">${ivaPorPagar.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* F14 Summary */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-blue-500" />
              Pago a Cuenta (F14)
            </h3>
            <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">1.75%</span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-end">
              <div className="text-sm text-gray-500">Ingresos Brutos</div>
              <div className="font-mono font-medium text-gray-900">${currentAcc.ingresosBrutos.toFixed(2)}</div>
            </div>
            <div className="flex justify-between items-end">
              <div className="text-sm text-gray-500">Ventas Exentas</div>
              <div className="font-mono font-medium text-gray-400">
                ${(currentAcc.totalExenta + currentAcc.totalNoSujeta).toFixed(2)}
              </div>
            </div>
            {currentAcc.retencionRenta > 0 && (
              <div className="flex justify-between items-end">
                <div className="text-sm text-gray-500">Retención Renta (Recibida)</div>
                <div className="font-mono font-medium text-emerald-600">- ${currentAcc.retencionRenta.toFixed(2)}</div>
              </div>
            )}
            <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
              <div className="font-bold text-gray-800">Anticipo Renta</div>
              <div className="font-mono font-bold text-xl text-blue-600">${pagoCuenta.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Total to Pay */}
        <div className="bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <DollarSign className="w-32 h-32" />
          </div>
          <div className="p-6 relative z-10 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-indigo-100 font-medium mb-1">Estimación Total a Pagar</h3>
              <p className="text-xs text-indigo-200">Vencimiento: día 14 del próximo mes</p>
            </div>
            
            <div className="text-center py-6">
              <div className="text-5xl font-extrabold tracking-tight">
                ${totalImpuestos.toFixed(2)}
              </div>
              <p className="text-indigo-200 text-sm mt-2">IVA + Pago a Cuenta</p>
            </div>

            <button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              Ver Detalle Declaración
            </button>
          </div>
        </div>

      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-semibold text-gray-800">Desglose de Operaciones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Concepto</th>
                <th className="px-6 py-3 text-right">Base Imponible</th>
                <th className="px-6 py-3 text-right">Débito (Cobrado)</th>
                <th className="px-6 py-3 text-right">Crédito (Pagado)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-white hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">Ventas Gravadas Locales</td>
                <td className="px-6 py-4 text-right text-gray-600">${currentAcc.totalGravada.toFixed(2)}</td>
                <td className="px-6 py-4 text-right font-medium text-red-600">${currentAcc.ivaDebito.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-gray-400">-</td>
              </tr>
              <tr className="bg-white hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">Compras Gravadas Locales</td>
                <td className="px-6 py-4 text-right text-gray-600">${currentAcc.comprasGravadas.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-gray-400">-</td>
                <td className="px-6 py-4 text-right font-medium text-emerald-600">${currentAcc.ivaCredito.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-50/50 font-semibold">
                <td className="px-6 py-4">TOTALES</td>
                <td className="px-6 py-4 text-right">-</td>
                <td className="px-6 py-4 text-right text-red-700">${currentAcc.ivaDebito.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-emerald-700">${currentAcc.ivaCredito.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default FiscalDashboard;
