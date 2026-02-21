import React from 'react';
import { ResolveNoCodeModal, ResolverItem } from './ResolveNoCodeModal';
import { EmisorConfigModal } from './EmisorConfigModal';
import { ProductPickerModal } from './ProductPickerModal';
import QRPaymentModal from './QRPaymentModal';
import { StripeConnectModal } from './StripeConnectModal';
import TransmisionModal from './TransmisionModal';
import DTEPreviewModal from './DTEPreviewModal';
import QRClientCapture from './QRClientCapture';

import type { ValidationResult } from '../utils/validators';

interface FacturaModalsProps {
  // ResolveNoCodeModal
  showResolveModal: boolean;
  setShowResolveModal: (value: boolean) => void;
  resolverItems: ResolverItem[];
  setResolverItems: React.Dispatch<React.SetStateAction<ResolverItem[]>>;
  inventarioService: any;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  confirmarResolucion: () => void;
  // TransmisionModal
  showTransmision: boolean;
  generatedDTE: any;
  emisor: any;
  setShowTransmision: (value: boolean) => void;
  // DTEPreviewModal
  showDTEPreview: boolean;
  setShowDTEPreview: (value: boolean) => void;
  handleCopyJSON: () => void;
  handleDownloadJSON: () => void;
  // QRClientCapture
  showQRCapture: boolean;
  setShowQRCapture: (value: boolean) => void;
  setSelectedReceptor: (client: any) => void;
  loadData: () => void;
  // EmisorConfigModal
  showEmisorConfig: boolean;
  setShowEmisorConfig: (value: boolean) => void;
  emisorForm: any;
  setEmisorForm: React.Dispatch<React.SetStateAction<any>>;
  nitValidation: ValidationResult;
  nrcValidation: ValidationResult;
  telefonoValidation: ValidationResult;
  correoValidation: ValidationResult;
  formatTextInput: (value: string) => string;
  formatMultilineTextInput: (value: string) => string;
  handleSaveEmisor: () => void;
  isSavingEmisor: boolean;
  hasCert: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  certificateFile: File | null;
  certificatePassword: string;
  showCertPassword: boolean;
  certificateInfo: any;
  certificateError: string | null;
  isValidatingCert: boolean;
  isSavingCert: boolean;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  setCertificateInfo: (value: any) => void;
  setCertificateError: (value: string | null) => void;
  handleCertFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleValidateCertificate: () => Promise<void>;
  handleSaveCertificate: () => Promise<void>;
  // ProductPickerModal
  canUseCatalogoProductos: boolean;
  showProductPicker: boolean;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredProductsForPicker: any[];
  productPickerIndex: number | null;
  applyProductToItem: (index: number, p: any) => void;
  setShowProductPicker: (value: boolean) => void;
  // QRPaymentModal
  showQRPayment: boolean;
  setShowQRPayment: (value: boolean) => void;
  // StripeConnectModal
  showStripeConnect: boolean;
  setShowStripeConnect: (value: boolean) => void;
  handleStripeConnectSuccess: () => void;
  totales: any;
}

export const FacturaModals: React.FC<FacturaModalsProps> = ({
  // ResolveNoCodeModal
  showResolveModal,
  setShowResolveModal,
  resolverItems,
  setResolverItems,
  inventarioService,
  addToast,
  confirmarResolucion,
  // TransmisionModal
  showTransmision,
  generatedDTE,
  emisor,
  setShowTransmision,
  // DTEPreviewModal
  showDTEPreview,
  setShowDTEPreview,
  handleCopyJSON,
  handleDownloadJSON,
  // QRClientCapture
  showQRCapture,
  setShowQRCapture,
  setSelectedReceptor,
  loadData,
  // EmisorConfigModal
  showEmisorConfig,
  setShowEmisorConfig,
  emisorForm,
  setEmisorForm,
  nitValidation,
  nrcValidation,
  telefonoValidation,
  correoValidation,
  formatTextInput,
  formatMultilineTextInput,
  handleSaveEmisor,
  isSavingEmisor,
  hasCert,
  fileInputRef,
  certificateFile,
  certificatePassword,
  showCertPassword,
  certificateInfo,
  certificateError,
  isValidatingCert,
  isSavingCert,
  setCertificatePassword,
  setShowCertPassword,
  setCertificateInfo,
  setCertificateError,
  handleCertFileSelect,
  handleValidateCertificate,
  handleSaveCertificate,
  // ProductPickerModal
  canUseCatalogoProductos,
  showProductPicker,
  productSearch,
  setProductSearch,
  filteredProductsForPicker,
  productPickerIndex,
  applyProductToItem,
  setShowProductPicker,
  // QRPaymentModal
  showQRPayment,
  setShowQRPayment,
  // StripeConnectModal
  showStripeConnect,
  setShowStripeConnect,
  handleStripeConnectSuccess,
  totales,
}) => {
  return (
    <>
      <ResolveNoCodeModal
        isOpen={showResolveModal}
        resolverItems={resolverItems}
        setResolverItems={setResolverItems}
        inventarioService={inventarioService}
        addToast={addToast}
        onClose={() => {
          setShowResolveModal(false);
          setResolverItems([]);
        }}
        onContinue={confirmarResolucion}
      />
      
      {/* Transmision Modal */}
      {showTransmision && generatedDTE && (
        <TransmisionModal
          dte={generatedDTE}
          onClose={() => setShowTransmision(false)}
          onSuccess={(sello) => {
            addToast(`DTE transmitido. Sello: ${sello.substring(0, 8)}...`, 'success');
          }}
          ambiente="00"
          logoUrl={emisor?.logo}
        />
      )}

      {/* DTE Preview Modal */}
      {showDTEPreview && generatedDTE && (
        <DTEPreviewModal
          dte={generatedDTE}
          onClose={() => setShowDTEPreview(false)}
          onTransmit={() => {
            setShowDTEPreview(false);
            setShowTransmision(true);
          }}
          onCopy={handleCopyJSON}
          onDownload={handleDownloadJSON}
        />
      )}

      {/* QR Client Capture Modal */}
      {showQRCapture && (
        <QRClientCapture
          onClose={() => setShowQRCapture(false)}
          onClientImported={(client) => {
            setSelectedReceptor(client);
            setShowQRCapture(false);
            addToast(`Cliente "${client.name}" importado`, 'success');
            loadData();
          }}
        />
      )}

      {/* Modal: Configurar Emisor */}
      <EmisorConfigModal
        isOpen={showEmisorConfig}
        onClose={() => setShowEmisorConfig(false)}
        emisorForm={emisorForm}
        setEmisorForm={setEmisorForm}
        nitValidation={nitValidation}
        nrcValidation={nrcValidation}
        telefonoValidation={telefonoValidation}
        correoValidation={correoValidation}
        formatTextInput={formatTextInput}
        formatMultilineTextInput={formatMultilineTextInput}
        handleSaveEmisor={handleSaveEmisor}
        isSavingEmisor={isSavingEmisor}
        hasCert={hasCert}
        fileInputRef={fileInputRef}
        certificateFile={certificateFile}
        certificatePassword={certificatePassword}
        showCertPassword={showCertPassword}
        certificateInfo={certificateInfo}
        certificateError={certificateError}
        isValidatingCert={isValidatingCert}
        isSavingCert={isSavingCert}
        setCertificatePassword={setCertificatePassword}
        setShowCertPassword={setShowCertPassword}
        setCertificateInfo={setCertificateInfo}
        setCertificateError={setCertificateError}
        handleCertFileSelect={handleCertFileSelect}
        handleValidateCertificate={handleValidateCertificate}
        handleSaveCertificate={handleSaveCertificate}
      />

      <ProductPickerModal
        isOpen={canUseCatalogoProductos && showProductPicker}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        filteredProductsForPicker={filteredProductsForPicker}
        productPickerIndex={productPickerIndex}
        applyProductToItem={applyProductToItem}
        onClose={() => setShowProductPicker(false)}
      />
      
      {/* Modal: QR Payment */}
      {showQRPayment && generatedDTE && (
        <QRPaymentModal
          isOpen={showQRPayment}
          onClose={() => setShowQRPayment(false)}
          totalAmount={Number(generatedDTE.resumen?.totalPagar || 0)}
          dteJson={generatedDTE}
          sellerInfo={{
            businessName: emisor?.nombreComercial || emisor?.nombre || '',
            name: emisor?.nombre || ''
          }}
          onPaymentGenerated={(checkoutUrl, sessionId) => {
            console.log('Pago generado:', { checkoutUrl, sessionId });
            // Aquí puedes manejar el seguimiento del pago
          }}
        />
      )}
      
      {/* Modal: Stripe Connect */}
      {showStripeConnect && generatedDTE && (
        <StripeConnectModal
          isOpen={showStripeConnect}
          onClose={() => setShowStripeConnect(false)}
          onSuccess={handleStripeConnectSuccess}
          clienteId={String(emisor?.nit || '')}
          clienteNombre={String(emisor?.nombreComercial || emisor?.nombre || '')}
          totalVenta={Number(totales.subTotalVentas || 0)}
        />
      )}
    </>
  );
};
