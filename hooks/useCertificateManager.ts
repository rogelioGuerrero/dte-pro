import { useEffect, useState, useRef } from 'react';

export const useCertificateManager = (params: {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}): {
  certificatePassword: string;
  showCertPassword: boolean;
  certificateError: string | null;
  isSavingCert: boolean;
  certificateFile: File | null;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  setCertificateError: (value: string | null) => void;
  handleCertFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveCertificate: (nit: string, nrc: string, ambiente?: string) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement>;
} => {
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
      // Validar que sea un archivo .crt
      const validExtensions = ['.crt'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        setCertificateError('El archivo debe ser un certificado digital (.crt)');
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

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          // El resultado viene como "data:application/x-pkcs12;base64,MIIJ..."
          // Debemos limpiar el prefijo para enviar solo la cadena Base64 pura
          const base64String = event.target?.result?.toString().split(',')[1];
          if (!base64String) {
            throw new Error('Error al leer el archivo');
          }
          resolve(base64String);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleSaveCertificate = async (nit: string, nrc: string, ambiente: string = '00') => {
    if (!certificatePassword) {
      setCertificateError('La contraseña del certificado es requerida.');
      return;
    }
    
    if (!certificateFile) {
      setCertificateError('Debes seleccionar un archivo de certificado (.p12 o .pfx).');
      return;
    }
    
    if (!nit || !nrc) {
      setCertificateError('NIT y NRC son requeridos para guardar el certificado en el servidor.');
      return;
    }

    setIsSavingCert(true);
    try {
      // Convertir archivo a Base64
      const certificadoB64 = await readFileAsBase64(certificateFile);

      // Guardar certificado en Supabase (via backend)
      const response = await fetch(`https://api-dte.onrender.com/api/business/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nit: nit.replace(/-/g, ''), // Limpiar guiones
          nrc: nrc.replace(/-/g, ''),
          passwordPri: certificatePassword,  // Backend espera camelCase
          certificadoB64, // Certificado en Base64
          ambiente,
          activo: true // Asegurar que las credenciales se marquen como activas
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

      // Limpiar formulario después de guardar
      setCertificatePassword('');
      setCertificateFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      params.onToast?.('Certificado digital guardado correctamente en el servidor', 'success');
    } catch (error) {
      console.error('Error guardando certificado:', error);
      setCertificateError(error instanceof Error ? error.message : 'Error al guardar el certificado. Intenta de nuevo.');
    } finally {
      setIsSavingCert(false);
    }
  };

  return {
    certificatePassword,
    showCertPassword,
    certificateError,
    isSavingCert,
    certificateFile,
    setCertificatePassword,
    setShowCertPassword,
    setCertificateError,
    handleCertFileSelect,
    handleSaveCertificate,
    fileInputRef,
  };
};
