import React, { useMemo } from 'react';
import { X, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { EmisorData } from '../utils/emisorDb';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectActividad, SelectUbicacion } from './formularios';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';

interface MobileEmisorModalProps {
  emisorForm: Omit<EmisorData, 'id'>;
  setEmisorForm: React.Dispatch<React.SetStateAction<Omit<EmisorData, 'id'>>>;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}

interface FieldValidation {
  valid: boolean;
  message: string;
}

const MobileEmisorModal: React.FC<MobileEmisorModalProps> = ({
  emisorForm,
  setEmisorForm,
  onSave,
  onClose,
  isSaving,
}) => {
  // Validaciones en tiempo real
  const validations = useMemo(() => {
    const nrcValidationBase = validateNRC(emisorForm.nrc);
    const nrcValidation = emisorForm.nrc
      ? nrcValidationBase
      : { valid: false, message: 'Requerido' };

    return {
      nit: validateNIT(emisorForm.nit),
      nrc: nrcValidation,
      nombre: {
        valid: emisorForm.nombre.trim().length >= 3,
        message: emisorForm.nombre.trim().length >= 3 ? 'Válido' : 'Mínimo 3 caracteres',
      },
      nombreComercial: { valid: true, message: '' },
      actividadEconomica: {
        valid: emisorForm.actividadEconomica.trim().length > 0,
        message: emisorForm.actividadEconomica ? 'Válido' : 'Requerido',
      },
      descActividad: {
        valid: emisorForm.descActividad ? emisorForm.descActividad.trim().length > 0 : false,
        message: emisorForm.descActividad ? 'Válido' : 'Requerido',
      },
      departamento: {
        valid: emisorForm.departamento.length > 0,
        message: emisorForm.departamento ? 'Válido' : 'Requerido',
      },
      municipio: {
        valid: emisorForm.municipio.length > 0,
        message: emisorForm.municipio ? 'Válido' : 'Requerido',
      },
      direccion: {
        valid: emisorForm.direccion.trim().length >= 5,
        message: emisorForm.direccion.trim().length >= 5 ? 'Válido' : 'Mínimo 5 caracteres',
      },
      telefono: validatePhone(emisorForm.telefono),
      correo: validateEmail(emisorForm.correo),
    };
  }, [emisorForm]);

  // Verificar si el formulario es válido para guardar
  const canSave = useMemo(() => {
    return (
      validations.nit.valid &&
      validations.nrc.valid &&
      validations.nombre.valid &&
      validations.actividadEconomica.valid &&
      validations.departamento.valid &&
      validations.municipio.valid &&
      validations.direccion.valid &&
      validations.telefono.valid &&
      validations.correo.valid
    );
  }, [validations]);

  const renderField = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    validation: FieldValidation,
    placeholder: string,
    required: boolean = true,
    type: string = 'text'
  ) => {
    const showValidation = value.length > 0;
    const borderColor = showValidation
      ? validation.valid
        ? 'border-green-300 focus:border-green-500'
        : 'border-red-300 focus:border-red-500'
      : 'border-gray-300 focus:border-blue-500';

    return (
      <div>
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative mt-1">
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 border rounded-xl pr-10 ${borderColor} focus:ring-2 focus:ring-opacity-20`}
            placeholder={placeholder}
          />
          {showValidation && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {validation.valid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          )}
        </div>
        {showValidation && !validation.valid && (
          <p className="text-xs text-red-500 mt-1">{validation.message}</p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
      {/* Header fijo */}
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 safe-area-pt">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Configurar Emisor</h3>
            <p className="text-xs text-gray-500">Datos del contribuyente</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 pb-32">
        <div className="space-y-4">
          {/* Sección: Identificación Fiscal */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Identificación Fiscal
            </h4>
            <div className="space-y-4">
              <NitOrDuiField
                label="NIT"
                labelClassName="text-sm font-medium text-gray-700 flex items-center gap-1"
                required
                value={emisorForm.nit}
                onChange={(nit) => setEmisorForm({ ...emisorForm, nit })}
                placeholder="0614-123456-123-4"
                validation={validations.nit}
                messageVariant="below-invalid"
                colorMode="status"
                inputClassName="px-4 py-3 rounded-xl focus:ring-opacity-20"
                rightAdornment={
                  emisorForm.nit.length > 0 ? (
                    validations.nit.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : null
                }
              />
              <NrcField
                label="NRC"
                labelClassName="text-sm font-medium text-gray-700 flex items-center gap-1"
                required
                value={emisorForm.nrc}
                onChange={(nrc) => setEmisorForm({ ...emisorForm, nrc })}
                placeholder="1234567-8"
                validation={validations.nrc}
                messageVariant="below-invalid"
                colorMode="status"
                inputClassName="px-4 py-3 rounded-xl focus:ring-opacity-20"
                rightAdornment={
                  emisorForm.nrc.length > 0 ? (
                    validations.nrc.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : null
                }
              />
            </div>
          </div>

          {/* Sección: Información del Negocio */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Información del Negocio
            </h4>
            <div className="space-y-4">
              {renderField(
                'Razón Social',
                emisorForm.nombre,
                (val) => setEmisorForm({ ...emisorForm, nombre: formatTextInput(val) }),
                validations.nombre,
                'Nombre legal del contribuyente'
              )}
              {renderField(
                'Nombre Comercial',
                emisorForm.nombreComercial || '',
                (val) => setEmisorForm({ ...emisorForm, nombreComercial: formatTextInput(val) }),
                validations.nombreComercial,
                'Nombre comercial (opcional)',
                false
              )}
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
                {!validations.actividadEconomica.valid && (
                  <p className="text-xs text-red-500 mt-1">{validations.actividadEconomica.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  Código Actividad <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={emisorForm.actividadEconomica}
                    readOnly
                    className="w-full px-4 py-3 border rounded-xl bg-gray-50 text-gray-700 font-mono border-gray-300 focus:ring-2 focus:ring-opacity-20"
                    placeholder="Se completa al seleccionar"
                  />
                </div>
                {!validations.descActividad.valid && (
                  <p className="text-xs text-red-500 mt-1">{validations.descActividad.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sección: Ubicación */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Ubicación
            </h4>
            <div className="space-y-4">
              <SelectUbicacion
                departamento={emisorForm.departamento}
                municipio={emisorForm.municipio}
                onDepartamentoChange={(codigo) =>
                  setEmisorForm((prev) => ({ ...prev, departamento: codigo, municipio: '' }))
                }
                onMunicipioChange={(codigo) => setEmisorForm((prev) => ({ ...prev, municipio: codigo }))}
                required
                showLabels
                layout="vertical"
                size="lg"
              />

              {renderField(
                'Dirección',
                emisorForm.direccion,
                (val) => setEmisorForm({ ...emisorForm, direccion: formatMultilineTextInput(val) }),
                validations.direccion,
                'Calle, número, colonia, etc.'
              )}
            </div>
          </div>

          {/* Sección: Contacto */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Contacto
            </h4>
            <div className="space-y-4">
              <PhoneField
                label="Teléfono"
                labelClassName="text-sm font-medium text-gray-700 flex items-center gap-1"
                required
                value={emisorForm.telefono}
                onChange={(telefono) => setEmisorForm({ ...emisorForm, telefono })}
                placeholder="70001234"
                type="tel"
                validation={validations.telefono}
                messageVariant="below-invalid"
                colorMode="status"
                inputClassName="px-4 py-3 rounded-xl focus:ring-opacity-20"
                rightAdornment={
                  emisorForm.telefono.length > 0 ? (
                    validations.telefono.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : null
                }
              />
              <EmailField
                label="Correo Electrónico"
                labelClassName="text-sm font-medium text-gray-700 flex items-center gap-1"
                required
                value={emisorForm.correo}
                onChange={(correo) => setEmisorForm({ ...emisorForm, correo })}
                placeholder="correo@ejemplo.com"
                validation={validations.correo}
                messageVariant="below-invalid"
                colorMode="status"
                inputClassName="px-4 py-3 rounded-xl focus:ring-opacity-20"
                rightAdornment={
                  emisorForm.correo.length > 0 ? (
                    validations.correo.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : null
                }
              />
            </div>
          </div>

          {/* Sección: Códigos MH (Opcional) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Códigos MH (Opcional)
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Tipo Establecimiento
                </label>
                <select
                  value={emisorForm.tipoEstablecimiento || '01'}
                  onChange={(e) =>
                    setEmisorForm({ ...emisorForm, tipoEstablecimiento: e.target.value })
                  }
                  className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl"
                >
                  <option value="01">Casa Matriz</option>
                  <option value="02">Sucursal</option>
                  <option value="04">Bodega</option>
                  <option value="07">Centro de Distribución</option>
                  <option value="20">Otro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Cód. Establecimiento</label>
                  <input
                    type="text"
                    value={emisorForm.codEstableMH || ''}
                    onChange={(e) =>
                      setEmisorForm({ ...emisorForm, codEstableMH: e.target.value || null })
                    }
                    className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl"
                    placeholder="M001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Cód. Punto Venta</label>
                  <input
                    type="text"
                    value={emisorForm.codPuntoVentaMH || ''}
                    onChange={(e) =>
                      setEmisorForm({ ...emisorForm, codPuntoVentaMH: e.target.value || null })
                    }
                    className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl"
                    placeholder="P001"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer fijo con botón guardar */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 safe-area-pb">
        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
            canSave && !isSaving
              ? 'bg-green-600 text-white shadow-lg shadow-green-200 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Guardar Emisor
            </>
          )}
        </button>
        {!canSave && (
          <p className="text-center text-xs text-gray-500 mt-2">
            Completa todos los campos requeridos
          </p>
        )}
      </div>
    </div>
  );
};

export default MobileEmisorModal;
