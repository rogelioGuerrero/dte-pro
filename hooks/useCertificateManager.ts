import { useEffect, useState } from 'react';

export const useCertificateManager = (params: {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}): {
  certificatePassword: string;
  showCertPassword: boolean;
  certificateError: string | null;
  isSavingCert: boolean;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  setCertificateError: (value: string | null) => void;
  handleSaveCertificate: (nit: string, nrc: string, ambiente?: string) => Promise<void>;
} => {
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isSavingCert, setIsSavingCert] = useState(false);

  useEffect(() => {
    // No necesitamos verificar certificado localmente
  }, []);

  const handleSaveCertificate = async (nit: string, nrc: string, ambiente: string = '00') => {
    if (!certificatePassword) {
      setCertificateError('La contraseña del certificado es requerida.');
      return;
    }
    
    if (!nit || !nrc) {
      setCertificateError('NIT y NRC son requeridos para guardar la contraseña en el servidor.');
      return;
    }

    setIsSavingCert(true);
    try {
      // Guardar contraseña en Supabase (via backend)
      const response = await fetch(`https://api-dte.onrender.com/api/business/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nit: nit.replace(/-/g, ''), // Limpiar guiones
          nrc: nrc.replace(/-/g, ''),
          passwordPri: certificatePassword,
          ambiente
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || 'Error guardando credenciales en el servidor');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.userMessage || 'Error guardando credenciales');
      }

      // Limpiar contraseña después de guardar
      setCertificatePassword('');
      params.onToast?.('Credenciales guardadas correctamente en el servidor', 'success');
    } catch (error) {
      console.error('Error guardando credenciales:', error);
      setCertificateError(error instanceof Error ? error.message : 'Error al guardar las credenciales. Intenta de nuevo.');
    } finally {
      setIsSavingCert(false);
    }
  };

  return {
    certificatePassword,
    showCertPassword,
    certificateError,
    isSavingCert,
    setCertificatePassword,
    setShowCertPassword,
    setCertificateError,
    handleSaveCertificate,
  };
};
