import { useEffect, useState, useRef } from 'react';
import { EmisorData } from '../utils/emisorDb';
import { saveCertificate } from '../utils/secureStorage';

export const useCertificateManager = (params: {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}): {
  apiPassword: string;
  certificatePassword: string;
  showCertPassword: boolean;
  certificateError: string | null;
  isSavingCert: boolean;
  certificateFile: File | null;
  setApiPassword: (value: string) => void;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  setCertificateError: (value: string | null) => void;
  handleCertFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveCertificate: (emisor: Partial<EmisorData>, ambiente?: string) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement>;
} => {
  const [apiPassword, setApiPassword] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // No necesitamos verificar certificado localmente
  }, []);

  const handleCertFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar que sea un archivo de certificado válido (.crt, .p12, .pfx)
      const validExtensions = ['.crt', '.p12', '.pfx'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        setCertificateError('El archivo debe ser un certificado digital válido (.crt, .p12, .pfx)');
        setCertificateFile(null);
        return;
      }
      
      // Validar tamaño máximo (10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setCertificateError('El archivo no debe superar los 10MB');
        setCertificateFile(null);
        return;
      }
      
      setCertificateFile(file);
      setCertificateError(null);
    }
  };

  const handleSaveCertificate = async (_emisor: Partial<EmisorData>, _ambiente: string = '00') => {
    if (!certificatePassword) {
      setCertificateError('La contraseña del certificado es requerida.');
      return;
    }
    
    if (!certificateFile) {
      setCertificateError('Debes seleccionar un archivo de certificado (.p12 o .pfx).');
      return;
    }

    setIsSavingCert(true);
    try {
      const arrayBuffer = await certificateFile.arrayBuffer();
      await saveCertificate(arrayBuffer, certificatePassword);

      // Limpiar formulario después de guardar
      setApiPassword('');
      setCertificatePassword('');
      setCertificateFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      params.onToast?.('Certificado digital guardado correctamente en este dispositivo', 'success');
    } catch (error) {
      console.error('Error guardando certificado:', error);
      setCertificateError(error instanceof Error ? error.message : 'Error al guardar el certificado. Intenta de nuevo.');
    } finally {
      setIsSavingCert(false);
    }
  };

  return {
    apiPassword,
    certificatePassword,
    showCertPassword,
    certificateError,
    isSavingCert,
    certificateFile,
    setApiPassword,
    setCertificatePassword,
    setShowCertPassword,
    setCertificateError,
    handleCertFileSelect,
    handleSaveCertificate,
    fileInputRef,
  };
};
