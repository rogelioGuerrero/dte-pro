import React, { useState } from 'react';
import { CreditCard, Info, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';
import { useToast } from './Toast';

interface StripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clienteId: string;
  clienteNombre: string;
  totalVenta: number;
}

export const StripeConnectModal: React.FC<StripeConnectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clienteId,
  clienteNombre,
  totalVenta
}) => {
  const { addToast } = useToast();
  const [hasStripeAccount, setHasStripeAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modelo A (simple): el cliente paga solo el total del DTE (venta + IVA).
  // - Cliente paga: base (venta + IVA)
  // - Vendedora paga: fee Stripe (se descuenta del cargo en su cuenta)
  const iva = totalVenta * 0.13;
  const base = totalVenta + iva;
  // Modelo B (visual): podemos mostrar una "Comisión por servicios" que afecta al consumidor.
  // Por ahora la dejamos en 0% para no alterar montos ni DTE.
  const serviceFeeRate = 0;
  const serviceFee = base * serviceFeeRate;
  const totalCliente = base + serviceFee;
  const stripeFee = totalCliente * 0.054 + 0.10;
  const montoRecibir = totalCliente - stripeFee;
  const liquidezNeta = totalCliente - stripeFee - iva;
  const ivaPagar = iva;

  const handleConnectStripe = async () => {
    setIsLoading(true);
    try {
      // En producción, esto crearía una cuenta conectada
      addToast('Redirigiendo a Stripe para conectar cuenta...', 'info');
      
      // Simulación
      setTimeout(() => {
        setHasStripeAccount(true);
        addToast('Cuenta Stripe conectada exitosamente', 'success');
      }, 2000);
    } catch (error) {
      addToast('Error al conectar con Stripe', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptPayment = () => {
    addToast('Cliente redirigido a formulario de pago', 'info');
    // Aquí iría el flujo real de Stripe
    setTimeout(() => {
      addToast('Pago autorizado (fase de prueba)', 'success');
      addToast(`$${montoRecibir.toFixed(2)} transferidos a tu cuenta`, 'success');
      onSuccess();
      onClose();
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Procesar pago con tarjeta
            </h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {(clienteNombre || clienteId) && (
            <div className="text-xs text-gray-500">
              {clienteNombre ? (
                <p>
                  <span className="font-medium text-gray-700">Vendedora (emisor):</span> {clienteNombre}
                </p>
              ) : null}
              {clienteId ? (
                <p>
                  <span className="font-medium text-gray-700">NIT:</span> {clienteId}
                </p>
              ) : null}
            </div>
          )}

          {/* Alerta informativa */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Pago con tarjeta (fase de prueba)</p>
                <p className="text-xs">El comprador paga el total del DTE. Stripe descuenta la comisión bancaria de la transferencia.</p>
              </div>
            </div>
          </div>

          {/* Desglose de pagos */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-900 mb-3">Desglose de la transacción</h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Gravado (sin IVA)</span>
                <span className="font-mono">${totalVenta.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">IVA (13%)</span>
                <span className="font-mono">${iva.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Comisión por servicios ({serviceFeeRate * 100}%)</span>
                <span className="font-mono">${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Comisión bancaria (5.4% + $0.10)</span>
                <span className="font-mono">-${stripeFee.toFixed(2)}</span>
              </div>

              <div className="border-t pt-2 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>Total DTE (comprador paga)</span>
                  <span className="font-mono text-lg">${totalCliente.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-green-700">
                  <span>Transferencia estimada</span>
                  <span className="font-mono text-lg">${montoRecibir.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-gray-800">
                  <span>Liquidez neta</span>
                  <span className="font-mono text-lg">${liquidezNeta.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-gray-500">Fórmula: transferencia = total DTE - comisión bancaria</p>
                <p className="text-[11px] text-gray-500">Fórmula: liquidez neta = total DTE - comisión bancaria - IVA</p>
              </div>
            </div>
          </div>

          {/* Información fiscal */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Importante para tu contabilidad</p>
                <ul className="text-xs space-y-1">
                  <li>• Debes declarar el IVA de ${ivaPagar.toFixed(2)}</li>
                  <li>• Ventas (sin IVA): ${totalVenta.toFixed(2)}</li>
                  <li>• Guarda este comprobante para tus registros</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Estado de cuenta Stripe */}
          {!hasStripeAccount ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Conecta tu cuenta Stripe</h4>
              <p className="text-sm text-gray-500 mb-4">
                Necesitas una cuenta para recibir pagos. Es gratis y solo toma 2 minutos.
              </p>
              <button
                onClick={handleConnectStripe}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Conectar cuenta Stripe
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Cuenta conectada</h4>
              <p className="text-sm text-gray-500 mb-4">
                Listo para recibir pagos seguros
              </p>
              <button
                onClick={handleAcceptPayment}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <DollarSign className="w-4 h-4" />
                Aceptar pago de tarjeta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
