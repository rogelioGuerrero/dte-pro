import React, { useState } from 'react';
import { CreditCard, Lock, DollarSign, Info } from 'lucide-react';
import { useToast } from './Toast';

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  dteJson: any;
  totalAmount: number;
  onPaymentSuccess: (paymentResult: any) => void;
}

export default function StripePaymentModal({ 
  isOpen, 
  onClose, 
  dteJson, 
  totalAmount, 
  onPaymentSuccess 
}: StripePaymentModalProps) {
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });

  // Calcular comisiones
  const calculateFees = (amount: number) => {
    const amountCents = Math.round(amount * 100);
    const stripeFeeCents = Math.round(amountCents * 0.054) + 10; // 5.4% + $0.10
    const yourFeeCents = amountCents < 1000 ? 100 : Math.round(amountCents * 0.05); // $1 o 5%
    const totalCents = amountCents + stripeFeeCents + yourFeeCents;
    
    return {
      subtotal: amount,
      stripeFee: stripeFeeCents / 100,
      yourFee: yourFeeCents / 100,
      total: totalCents / 100,
      netAmount: (amountCents - yourFeeCents) / 100
    };
  };

  const fees = calculateFees(totalAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Crear Payment Method con Stripe (simulado por ahora)
      const paymentMethodId = 'pm_card_' + Date.now(); // Simulación

      // Enviar a tu función Netlify
      const response = await fetch('/api/stripe/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dteJson,
          paymentMethodId,
          connectedAccountId: null // Futuro: cuenta conectada del cliente
        }),
      });

      const result = await response.json();

      if (result.success) {
        addToast('Pago autorizado (fase de prueba)', 'success');
        onPaymentSuccess(result);
        onClose();
      } else if (result.requiresAction) {
        // Manejar 3D Secure si es necesario
        addToast('Autenticación requerida. Procesando...', 'info');
        // Simular aprobación automática en modo test
        setTimeout(() => {
          addToast('Pago autorizado (fase de prueba)', 'success');
          onPaymentSuccess({ ...result, success: true });
          onClose();
        }, 2000);
      } else {
        addToast(result.error || 'Error procesando pago', 'error');
      }
    } catch (error) {
      addToast('Error de conexión con el procesador de pagos', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Procesar Pago</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información del pago */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Detalles de la transacción</p>
                <p className="text-xs">El pago será procesado de forma segura a través de Stripe</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Ventas</span>
                <span className="font-mono text-gray-800">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">IVA</span>
                <span className="font-mono text-gray-800">${(totalAmount * 0.13).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total cliente</span>
                <span>${fees.total.toFixed(2)}</span>
              </div>
              {totalAmount < 10 && (
                <div className="mt-2 text-xs text-green-600 text-center">
                  💡 En efectivo: ${totalAmount.toFixed(2)} (ahorra ${fees.yourFee.toFixed(2)})
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Comisión bancaria (5.4%)</span>
                  <span className="font-mono text-xs text-gray-600">-${fees.stripeFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    Comisión del servicio ({totalAmount < 10 ? '$1.00 fijo' : '5%'})
                  </span>
                  <span className="font-mono text-xs text-gray-600">-${fees.yourFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-green-700">
                  <span className="text-sm">Ingreso neto</span>
                  <span className="font-mono">${(totalAmount - fees.yourFee).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Datos de la tarjeta (simulación) */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Información de pago</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre en la tarjeta
              </label>
              <input
                type="text"
                required
                value={cardData.name}
                onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de tarjeta
              </label>
              <input
                type="text"
                required
                value={cardData.number}
                onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vencimiento
                </label>
                <input
                  type="text"
                  required
                  value={cardData.expiry}
                  onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="MM/AA"
                  maxLength={5}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CVC
                </label>
                <input
                  type="text"
                  required
                  value={cardData.cvc}
                  onChange={(e) => setCardData({ ...cardData, cvc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123"
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          {/* Badge de seguridad */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Lock className="w-4 h-4" />
            <span>Pago seguro con encriptación SSL</span>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Pagar ${fees.total.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
