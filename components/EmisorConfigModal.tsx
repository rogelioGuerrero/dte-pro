import React from 'react';
import { Building2, FileSignature, Loader2, Save } from 'lucide-react';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectActividad, SelectUbicacion } from './formularios';
import LogoUploader from './LogoUploader';

interface EmisorConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  emisorForm: any;
  setEmisorForm: (form: any) => void;
  nitValidation: any;
  nrcValidation: any;
  telefonoValidation: any;
  correoValidation: any;
  formatTextInput: (value: string) => string;
  formatMultilineTextInput: (value: string) => string;
  handleSaveEmisor: () => void;
  isSavingEmisor: boolean;
  certificatePassword: string;
  showCertPassword: boolean;
  certificateError: string | null;
  isSavingCert: boolean;
  certificateFile: File | null;
  setCertificatePassword: (value: string) => void;
  setShowCertPassword: (value: boolean) => void;
  handleCertFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveCertificate: (nit: string, nrc: string, ambiente?: string) => void | Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement>;
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
  certificatePassword,
  showCertPassword,
  certificateError,
  isSavingCert,
  certificateFile,
  setCertificatePassword,
  setShowCertPassword,
  handleCertFileSelect,
  handleSaveCertificate,
  fileInputRef,
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
                onDepartamentoChange={(codigo: string) =>
                  setEmisorForm((prev: any) => ({ ...prev, departamento: codigo, municipio: '' }))
                }
                onMunicipioChange={(codigo: string) => setEmisorForm((prev: any) => ({ ...prev, municipio: codigo }))}
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
                  <FileSignature className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase">Firma electrónica</p>
                    <p className="text-[11px] text-gray-500">
                      Sube tu certificado digital (.crt) y contraseña
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".crt"
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
                  {certificateFile ? <span>{certificateFile.name}</span> : <span>Seleccionar archivo .crt</span>}
                </button>
                
                {certificateFile && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      Contraseña del Certificado <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showCertPassword ? "text" : "password"}
                        value={certificatePassword}
                        onChange={(e) => setCertificatePassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ingresa la contraseña del certificado"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCertPassword(!showCertPassword)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCertPassword ? "👁️" : "👁️‍🗨️"}
                      </button>
                    </div>
                  </div>
                )}
                
                {certificateError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-600">{certificateError}</p>
                  </div>
                )}
                
                <button
                  onClick={() => handleSaveCertificate(emisorForm.nit, emisorForm.nrc)}
                  disabled={isSavingCert || !certificateFile || !certificatePassword || !emisorForm.nit || !emisorForm.nrc}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSavingCert ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando certificado...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar certificado digital
                    </>
                  )}
                </button>
              </div>
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
