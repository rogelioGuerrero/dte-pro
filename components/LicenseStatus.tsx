import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { licenseValidator } from '../utils/licenseValidator';
import { fetchLicensingConfig } from '../utils/remoteLicensing';

interface LicenseStatusProps {
  onManageLicense?: () => void;
}

export const LicenseStatus: React.FC<LicenseStatusProps> = ({ onManageLicense }) => {
  const [licenseStatus, setLicenseStatus] = useState<{
    isValid: boolean;
    remainingExports: number;
    expiresAt?: string;
    isExpired?: boolean;
  }>({
    isValid: false,
    remainingExports: 0
  });

  useEffect(() => {
    updateLicenseStatus();
    // Actualizar cada minuto
    const interval = setInterval(updateLicenseStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const updateLicenseStatus = async () => {
    // Verificar si el licenciamiento está desactivado remotamente
    const licensingConfig = await fetchLicensingConfig();
    if (!licensingConfig.enabled) {
      return; // No mostrar nada si está desactivado
    }

    const isValid = await licenseValidator.hasValidLicense();
    const license = licenseValidator.getCurrentLicense();
    const remainingExports = await licenseValidator.getRemainingExports();
    
    setLicenseStatus({
      isValid,
      remainingExports,
      expiresAt: license?.expiresAt,
      isExpired: license ? new Date(license.expiresAt) < new Date() : false
    });
  };

  // No mostrar nada si el licenciamiento está desactivado
  const [licensingEnabled, setLicensingEnabled] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkLicensing = async () => {
      const config = await fetchLicensingConfig();
      setLicensingEnabled(config.enabled);
    };
    checkLicensing();
  }, []);
  
  if (licensingEnabled === false) {
    return null;
  }

  if (!licenseStatus.isValid) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Modo trial - 5 exportaciones por día
            </span>
          </div>
          <button
            onClick={onManageLicense}
            className="text-xs text-yellow-700 hover:text-yellow-800 underline"
          >
            Activar licencia
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">
            Licencia activa
          </span>
          {licenseStatus.expiresAt && (
            <span className="text-xs text-green-600">
              - Expira: {new Date(licenseStatus.expiresAt).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>
        <button
          onClick={onManageLicense}
          className="text-xs text-green-700 hover:text-green-800 underline"
        >
          Gestionar
        </button>
      </div>
      
      {licenseStatus.remainingExports !== -1 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-green-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ 
                width: `${Math.max(0, (licenseStatus.remainingExports / 10) * 100)}%` 
              }}
            />
          </div>
          <span className="text-xs text-green-700 font-medium">
            {licenseStatus.remainingExports} restantes
          </span>
        </div>
      )}
    </div>
  );
};
