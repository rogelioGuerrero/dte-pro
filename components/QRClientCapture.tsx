import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Share2, 
  Copy, 
  Check, 
  Users, 
  Bell,
  X,
  UserPlus,
  Trash2,
  Clock,
} from 'lucide-react';
import { 
  generateClientFormUrl, 
  getOrCreateVendorSession,
  getUnimportedClients, 
  getUnimportedClientsApi,
  markClientImported,
  markClientImportedApi,
  dismissPendingClient,
  dismissPendingClientApi,
  PendingClient,
} from '../utils/qrClientCapture';
import { saveClient, ClientData } from '../utils/clientDb';

interface QRClientCaptureProps {
  onClientImported?: (client: ClientData) => void;
  onClose?: () => void;
}

const QRClientCapture: React.FC<QRClientCaptureProps> = ({ onClientImported, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [activeTab, setActiveTab] = useState<'qr' | 'pending'>('qr');
  const [vendorId, setVendorId] = useState<string>('');

  useEffect(() => {
    const vid = getOrCreateVendorSession();
    setVendorId(vid);
    generateQR();
    loadPendingClients(vid);
    
    // Polling para nuevos clientes cada 5 segundos
    const interval = setInterval(() => loadPendingClients(vid), 5000);
    return () => clearInterval(interval);
  }, []);

  const generateQR = async () => {
    const url = generateClientFormUrl();
    setFormUrl(url);
    
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Error generating QR:', err);
    }
  };

  const loadPendingClients = async (vid?: string) => {
    const v = vid || vendorId;
    if (v) {
      // Intentar cargar desde API
      const apiClients = await getUnimportedClientsApi(v);
      if (apiClients) {
        setPendingClients(apiClients);
        return;
      }
    }
    // Fallback a localStorage
    const clients = getUnimportedClients();
    setPendingClients(clients);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ingresa tus datos para factura',
          text: 'Escanea o abre este enlace para ingresar tus datos de facturacion',
          url: formUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleImportClient = async (pending: PendingClient) => {
    const clientData: Omit<ClientData, 'id' | 'timestamp'> = {
      name: pending.data.name || '',
      nit: pending.data.nit || '',
      nrc: pending.data.nrc || '',
      email: pending.data.email || '',
      telefono: pending.data.telefono || (pending.data as any).phone || '',
      departamento: pending.data.departamento || (pending.data as any).department || '',
      municipio: pending.data.municipio || (pending.data as any).municipality || '',
      direccion: pending.data.direccion || (pending.data as any).address || '',
      actividadEconomica: pending.data.actividadEconomica || '',
      descActividad: pending.data.descActividad || (pending.data as any).activity || '',
      nombreComercial: pending.data.nombreComercial || '',
    };

    try {
      const savedClient = await saveClient(clientData);
      // Marcar como importado via API o localStorage
      if (vendorId) {
        await markClientImportedApi(vendorId, pending.id);
      } else {
        markClientImported(pending.id);
      }
      loadPendingClients();
      
      if (onClientImported && savedClient) {
        onClientImported(savedClient);
      }
    } catch (err) {
      console.error('Error importing client:', err);
    }
  };

  const handleDismiss = async (id: string) => {
    // Descartar via API o localStorage
    if (vendorId) {
      await dismissPendingClientApi(vendorId, id);
    } else {
      dismissPendingClient(id);
    }
    loadPendingClients();
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Capturar Cliente</h2>
              <p className="text-xs text-gray-500">Via codigo QR</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'qr' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <QrCode className="w-4 h-4 inline mr-2" />
            Mi Codigo QR
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'pending' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Pendientes
            {pendingClients.length > 0 && (
              <span className="absolute -top-1 right-4 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingClients.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'qr' ? (
            <div className="p-6 text-center">
              {/* QR Code */}
              <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 inline-block mb-6 shadow-sm">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                ) : (
                  <div className="w-64 h-64 bg-gray-100 animate-pulse rounded-lg" />
                )}
              </div>

              <p className="text-gray-600 mb-6">
                Pide a tu cliente que escanee este codigo para ingresar sus datos
              </p>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir enlace
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar enlace
                    </>
                  )}
                </button>
              </div>

              {/* Notification hint */}
              {pendingClients.length > 0 && (
                <div className="mt-6 p-3 bg-amber-50 rounded-xl flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    Tienes {pendingClients.length} cliente(s) pendiente(s)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              {pendingClients.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay clientes pendientes</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Cuando un cliente escanee tu QR y envie sus datos, apareceran aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingClients.map((client) => (
                    <div
                      key={client.id}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {client.data.name || 'Sin nombre'}
                          </p>
                          <p className="text-sm text-gray-500">
                            NIT: {client.data.nit || 'No especificado'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {formatTime(client.receivedAt)}
                        </div>
                      </div>
                      
                      {client.data.email && (
                        <p className="text-xs text-gray-500 mb-2">{client.data.email}</p>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleImportClient(client)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                          <UserPlus className="w-4 h-4" />
                          Importar
                        </button>
                        <button
                          onClick={() => handleDismiss(client.id)}
                          className="px-3 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRClientCapture;
