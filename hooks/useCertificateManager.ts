import { useEffect, useRef, useState } from 'react';
import { hasCertificate, saveCertificate } from '../utils/secureStorage';
import { CertificadoInfo, leerP12, validarCertificadoDTE } from '../utils/p12Handler';

export const useCertificateManager = (params: {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}): {
  hasCert: boolean;
  certificateFile: File | null;
  certificatePassword: string;
  showCertPassword: boolean;
  certificateInfo: CertificadoInfo | null;
  certificateError: string | null;
  isValidatingCert: boolean;
  isSavingCert: boolean;
  p12Data: ArrayBuffer | null;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  setCertificateInfo: (value: CertificadoInfo | null) => void;
  setCertificateError: (value: string | null) => void;
  handleCertFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleValidateCertificate: () => Promise<void>;
  handleSaveCertificate: (nit: string, nrc: string, ambiente?: string) => Promise<void>;
  refreshCertificateStatus: () => Promise<void>;
} => {
  const [hasCert, setHasCert] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [certificateInfo, setCertificateInfo] = useState<CertificadoInfo | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isValidatingCert, setIsValidatingCert] = useState(false);
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [p12Data, setP12Data] = useState<ArrayBuffer | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshCertificateStatus = async () => {
    const has = await hasCertificate();
    setHasCert(has);
  };

  useEffect(() => {
    refreshCertificateStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCertFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.p12') || file.name.endsWith('.pfx'))) {
      setCertificateFile(file);
      setCertificateInfo(null);
      setCertificateError(null);
      const buffer = await file.arrayBuffer();
      setP12Data(buffer);
    }
  };

  const handleValidateCertificate = async () => {
    if (!p12Data || !certificatePassword) return;
    setIsValidatingCert(true);
    setCertificateError(null);
    try {
      const result = await leerP12(p12Data, certificatePassword);
      if (!result.success) {
        setCertificateError(result.error || 'Error al leer certificado');
        setCertificateInfo(null);
        setHasCert(false);
      } else if (result.certificateInfo) {
        const validation = validarCertificadoDTE(result.certificateInfo);
        if (!validation.valid) {
          setCertificateError(validation.errors.join('. '));
        }
        setCertificateInfo(result.certificateInfo);
      }
    } catch (error) {
      setCertificateError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsValidatingCert(false);
    }
  };

  const handleSaveCertificate = async (nit: string, nrc: string, ambiente: string = '00') => {
    if (!p12Data || !certificatePassword || !certificateInfo) return;
    
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

      // Guardar certificado localmente (por si acaso se necesita)
      await saveCertificate(p12Data, certificatePassword);
      setHasCert(true);
      params.onToast?.('Certificado guardado correctamente en el servidor', 'success');
    } catch (error) {
      console.error('Error guardando certificado:', error);
      setCertificateError(error instanceof Error ? error.message : 'Error al guardar el certificado. Intenta de nuevo.');
      setHasCert(false);
    } finally {
      setIsSavingCert(false);
    }
  };

  return {
    hasCert,
    certificateFile,
    certificatePassword,
    showCertPassword,
    certificateInfo,
    certificateError,
    isValidatingCert,
    isSavingCert,
    p12Data,
    fileInputRef,
    setCertificatePassword,
    setShowCertPassword,
    setCertificateInfo,
    setCertificateError,
    handleCertFileSelect,
    handleValidateCertificate,
    handleSaveCertificate,
    refreshCertificateStatus,
  };
};
