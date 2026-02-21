import React from 'react';
import { Building2, FileSignature, Loader2, Save } from 'lucide-react';
import type { EmisorData } from '../utils/emisorDb';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectActividad, SelectUbicacion } from './formularios';
import LogoUploader from './LogoUploader';
import { CertificadoInfo, formatearFechaCertificado } from '../utils/p12Handler';

type ValidationResult = {
  valid: boolean;
  message: string;
};

interface EmisorConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  emisorForm: Omit<EmisorData, 'id'>;
  setEmisorForm: React.Dispatch<React.SetStateAction<Omit<EmisorData, 'id'>>>;
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
  certificateInfo: CertificadoInfo | null;
  certificateError: string | null;
  isValidatingCert: boolean;
  isSavingCert: boolean;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  setCertificateInfo: (value: CertificadoInfo | null) => void;
  setCertificateError: (value: string | null) => void;
  handleCertFileSelect: React.ChangeEventHandler<HTMLInputElement>;
  handleValidateCertificate: () => void | Promise<void>;
  handleSaveCertificate: () => void | Promise<void>;
}

export const EmisorConfigModal: React.FC<EmisorConfigModalProps> = ({
  isOpen,
  onClose,
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
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Configurar Datos del Emisor
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <NitOrDuiField
                label="NIT"
                required
                value={emisorForm.nit}
                onChange={(nit) => setEmisorForm({ ...emisorForm, nit })}
                validation={nitValidation}
                placeholder="0000-000000-000-0"
                messageVariant="below-invalid"
                colorMode="status"
              />
            </div>
            <div>
              <NrcField
                label="NRC"
                required
                value={emisorForm.nrc}
                onChange={(nrc) => setEmisorForm({ ...emisorForm, nrc })}
                validation={nrcValidation}
                placeholder="000000-0"
                messageVariant="below-invalid"
                colorMode="status"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Nombre / Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={emisorForm.nombre}
                onChange={(e) => setEmisorForm({ ...emisorForm, nombre: formatTextInput(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nombre legal del contribuyente"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre Comercial</label>
              <input
                type="text"
                value={emisorForm.nombreComercial}
                onChange={(e) =>
                  setEmisorForm({ ...emisorForm, nombreComercial: formatTextInput(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nombre comercial (opcional)"
              />
            </div>
            <div className="col-span-2">
              <LogoUploader
                currentLogo={emisorForm.logo}
                onLogoChange={(logo) => setEmisorForm({ ...emisorForm, logo })}
              />
            </div>
            <div>
              <SelectActividad
                value={emisorForm.actividadEconomica}
                onChange={(codigo, descripcion) =>
                  setEmisorForm({ ...emisorForm, actividadEconomica: codigo, descActividad: descripcion })
                }
                required
                label="Actividad Económica"
                placeholder="Escribe una actividad..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Código Actividad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={emisorForm.actividadEconomica}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Se completa al seleccionar"
              />
            </div>
            <div className="col-span-2">
              <SelectUbicacion
                departamento={emisorForm.departamento}
                municipio={emisorForm.municipio}
                onDepartamentoChange={(codigo) =>
                  setEmisorForm((prev) => ({ ...prev, departamento: codigo, municipio: '' }))
                }
                onMunicipioChange={(codigo) => setEmisorForm((prev) => ({ ...prev, municipio: codigo }))}
                required
                showLabels
                layout="horizontal"
                size="md"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Dirección <span className="text-red-500">*</span>
              </label>
              <textarea
                value={emisorForm.direccion}
                onChange={(e) =>
                  setEmisorForm({ ...emisorForm, direccion: formatMultilineTextInput(e.target.value) })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Calle, número, colonia, etc."
              />
            </div>
            <div>
              <PhoneField
                label="Teléfono"
                required
                value={emisorForm.telefono}
                onChange={(telefono) => setEmisorForm({ ...emisorForm, telefono })}
                validation={telefonoValidation}
                placeholder="0000-0000"
                messageVariant="below-invalid"
                colorMode="status"
              />
            </div>
            <div>
              <EmailField
                label="Correo"
                required
                value={emisorForm.correo}
                onChange={(correo) => setEmisorForm({ ...emisorForm, correo })}
                validation={correoValidation}
                placeholder="correo@ejemplo.com"
                messageVariant="below-invalid"
                colorMode="status"
              />
            </div>
            <div className="col-span-2 mt-2 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileSignature className={`w-4 h-4 ${hasCert ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase">Firma electrónica</p>
                    <p className="text-[11px] text-gray-500">
                      {hasCert
                        ? 'Tu certificado está guardado. Puedes actualizarlo cuando quieras.'
                        : 'Aún no has registrado tu certificado digital (.p12/.pfx) y PIN.'}
                    </p>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".p12,.pfx"
                onChange={handleCertFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full p-3 border-2 border-dashed rounded-xl text-sm mb-3 transition-colors ${
                  certificateFile
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {certificateFile ? <span>{certificateFile.name}</span> : <span>Seleccionar archivo .p12 / .pfx</span>}
              </button>
              {certificateFile && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Contraseña / PIN del certificado
                    </label>
                    <div className="relative">
                      <input
                        type={showCertPassword ? 'text' : 'password'}
                        value={certificatePassword}
                        onChange={(e) => {
                          setCertificatePassword(e.target.value);
                          setCertificateInfo(null);
                          setCertificateError(null);
                        }}
                        placeholder="PIN que te dio Hacienda"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCertPassword(!showCertPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
                      >
                        {showCertPassword ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Es el PIN que recibiste junto con tu certificado.
                    </p>
                  </div>
                  {certificatePassword.length >= 4 && !certificateInfo && (
                    <button
                      onClick={handleValidateCertificate}
                      disabled={isValidatingCert}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isValidatingCert ? 'Validando…' : 'Validar certificado'}
                    </button>
                  )}
                  {certificateError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      {certificateError}
                    </div>
                  )}
                  {certificateInfo && (
                    <div className="p-3 rounded-lg border bg-green-50 border-green-200 text-xs space-y-1">
                      <p className="font-semibold text-green-700 flex items-center gap-1">
                        <span>Certificado válido</span>
                      </p>
                      <p className="text-gray-700">Titular: {certificateInfo.subject.commonName}</p>
                      <p className="text-gray-700">
                        Válido hasta: {formatearFechaCertificado(certificateInfo.validTo)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleSaveCertificate}
                    disabled={!certificateInfo || isSavingCert}
                    className="w-full mt-2 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingCert ? 'Guardando firma…' : 'Guardar firma digital'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span className="text-red-500">*</span> Campos obligatorios
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEmisor}
              disabled={isSavingEmisor}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingEmisor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
