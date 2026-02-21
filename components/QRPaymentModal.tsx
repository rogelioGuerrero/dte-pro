import { useState, useEffect } from 'react';
import { QrCode, CreditCard, Copy, CheckCircle, Smartphone, ArrowLeft } from 'lucide-react';
import { useToast } from './Toast';
import QRCode from 'qrcode';

interface QRPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  dteJson: any;
  connectedAccountId?: string;
  sellerInfo?: {
    businessName: string;
    name: string;
  };
  onPaymentGenerated: (checkoutUrl: string, sessionId: string) => void;
}

export default function QRPaymentModal({ 
  isOpen, 
  onClose, 
  totalAmount,
  dteJson,
  connectedAccountId,
  sellerInfo,
  onPaymentGenerated
}: QRPaymentModalProps) {
  const { addToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const getEnvNumber = (name: string, fallback: number) => {
    const raw = (import.meta as any)?.env?.[name];
    const n = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const PLATFORM_FEE_THRESHOLD_CENTS = getEnvNumber('VITE_PLATFORM_FEE_THRESHOLD_CENTS', 1000);
  const PLATFORM_FEE_FIXED_CENTS = getEnvNumber('VITE_PLATFORM_FEE_FIXED_CENTS', 100);
  const PLATFORM_FEE_RATE = getEnvNumber('VITE_PLATFORM_FEE_RATE', 0.05);

  const CARD_PROCESSING_RATE = getEnvNumber('VITE_CARD_PROCESSING_RATE', 0.054);
  const CARD_PROCESSING_FIXED_CENTS = getEnvNumber('VITE_CARD_PROCESSING_FIXED_CENTS', 10);

  // `totalAmount` = PRECIO EN EFECTIVO (total DTE con IVA)
  // Si paga con tarjeta, se agrega un recargo por servicio.
  const calcularPlatformFeeCents = (cashCents: number) => {
    return cashCents < PLATFORM_FEE_THRESHOLD_CENTS
      ? Math.round(PLATFORM_FEE_FIXED_CENTS)
      : Math.round(cashCents * PLATFORM_FEE_RATE);
  };

  const calcularStripeFeeCents = (baseCents: number) => {
    const a = CARD_PROCESSING_RATE;
    const b = CARD_PROCESSING_FIXED_CENTS;
    const raw = (a * baseCents + b) / (1 - a);
    return Math.round(raw);
  };

  const cashCents = Math.round(totalAmount * 100);
  const platformFeeCents = calcularPlatformFeeCents(cashCents);
  const baseBeforeStripeCents = cashCents + platformFeeCents;
  const stripeFeeCents = calcularStripeFeeCents(baseBeforeStripeCents);
  const surchargeCents = platformFeeCents + stripeFeeCents;
  const cardCents = cashCents + surchargeCents;

  const cashTotal = cashCents / 100;
  const platformFee = platformFeeCents / 100;
  const stripeFee = stripeFeeCents / 100;
  const surcharge = surchargeCents / 100;
  const cardTotal = cardCents / 100;

  const generatePaymentLink = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cashAmount: cashCents,
          connectedAccountId,
          dteJson,
          sellerInfo,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setCheckoutUrl(result.checkoutUrl);
        
        // Generar QR Code
        const qrDataUrl = await QRCode.toDataURL(result.checkoutUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        
        setQrCodeUrl(qrDataUrl);
        onPaymentGenerated(result.checkoutUrl, result.sessionId);
        
        addToast('Link de pago generado exitosamente', 'success');
      } else {
        addToast(result.error || 'Error generando link de pago', 'error');
      }
    } catch (error) {
      addToast('Error de conexión', 'error');
      console.error('Error generating payment:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      addToast('Link copiado al portapapeles', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      addToast('Error copiando link', 'error');
    }
  };

  const openPaymentPage = () => {
    window.open(checkoutUrl, '_blank');
  };

  // Resetear estado al cerrar
  useEffect(() => {
    if (!isOpen) {
      setQrCodeUrl('');
      setCheckoutUrl('');
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Cobrar con Tarjeta</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Información del cobro */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-medium text-gray-900 mb-3">Detalles del cobro</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Precio en efectivo (DTE)</span>
                <span className="font-mono">${cashTotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Recargo por pago con tarjeta</span>
                <span className="font-mono text-orange-600">${surcharge.toFixed(2)}</span>
              </div>

              <div className="pl-3 mt-1 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Servicio de plataforma</span>
                  <span className="font-mono">${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Procesamiento con tarjeta</span>
                  <span className="font-mono">${stripeFee.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total con tarjeta</span>
                <span>${cardTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              💡 En efectivo paga ${cashTotal.toFixed(2)} (ahorra ${surcharge.toFixed(2)})
            </div>
          </div>

          {!qrCodeUrl ? (
            // Botón para generar pago
            <button
              onClick={generatePaymentLink}
              disabled={isGenerating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generando link de pago...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Generar Link de Pago
                </>
              )}
            </button>
          ) : (
            // Mostrar QR y opciones
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                </div>
                
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Escanee el código QR con su cámara
                </p>
              </div>

              {/* Opciones adicionales */}
              <div className="space-y-2">
                <button
                  onClick={copyToClipboard}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Link copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Link
                    </>
                  )}
                </button>

                <button
                  onClick={openPaymentPage}
                  className="w-full py-2 px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Abrir en el navegador
                </button>
              </div>

              {/* Instrucciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <p className="font-medium mb-1">Instrucciones para el cliente:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Escanee el QR con su cámara</li>
                  <li>Haga clic en el link que aparece</li>
                  <li>Complete los datos de su tarjeta</li>
                  <li>Confirme el pago</li>
                </ol>
              </div>
            </div>
          )}

          {/* Botón de regresar */}
          {qrCodeUrl && (
            <button
              onClick={() => {
                setQrCodeUrl('');
                setCheckoutUrl('');
              }}
              className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Generar nuevo link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
