import { useState } from 'react';
import { 
  User, 
  FileText, 
  Phone, 
  Mail, 
  Building2,
  CheckCircle2,
  Send,
  Loader2,
  Camera,
  Sparkles,
} from 'lucide-react';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectUbicacion } from './formularios';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';
import { savePendingClient, savePendingClientApi, exportClientAsJson } from '../utils/qrClientCapture';
import { emitGlobalToast } from '../utils/globalToast';
import { extractDataFromImage } from '../utils/ocr';

interface ClientFormPageProps {
  vendorId?: string;
}

const ClientFormPage: React.FC<ClientFormPageProps> = ({ vendorId }) => {
  const [formData, setFormData] = useState({
    name: '',
    nit: '',
    nrc: '',
    email: '',
    phone: '',
    department: '',
    municipality: '',
    address: '',
    activity: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    let processedValue = value;
    if (field === 'name') processedValue = formatTextInput(value);
    if (field === 'address') processedValue = formatMultilineTextInput(value);
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleScanDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const extracted = await extractDataFromImage(base64);
          setFormData(prev => ({
            ...prev,
            name: extracted.name ? formatTextInput(extracted.name) : prev.name,
            nit: extracted.nit ? extracted.nit : prev.nit,
            nrc: extracted.nrc ? extracted.nrc : prev.nrc,
            activity: extracted.activity || prev.activity,
            address: extracted.address ? formatMultilineTextInput(extracted.address) : prev.address,
            phone: extracted.phone ? extracted.phone : prev.phone,
            email: extracted.email ? extracted.email : prev.email,
          }));
        } catch (err) {
          console.error('Error scanning:', err);
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsScanning(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    const nitResult = validateNIT(formData.nit);
    if (!nitResult.valid) {
      newErrors.nit = nitResult.message;
    }

    if (formData.nrc) {
      const nrcResult = validateNRC(formData.nrc);
      if (!nrcResult.valid) {
        newErrors.nrc = nrcResult.message;
      }
    }

    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.valid) {
        newErrors.phone = phoneResult.message;
      }
    }

    if (formData.email) {
      const emailResult = validateEmail(formData.email);
      if (!emailResult.valid) {
        newErrors.email = emailResult.message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Intentar guardar via API (sincronizacion entre dispositivos)
      if (vendorId) {
        const result = await savePendingClientApi(vendorId, formData);
        if (result?.id) {
          setIsSubmitted(true);
          return;
        }

        emitGlobalToast(
          'No se pudo enviar al emisor. Verifica que el vendedor esté online y vuelve a intentar.',
          'error'
        );
        return;
      }
      // Fallback a localStorage si no hay vendorId o falla la API
      savePendingClient(formData);
      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting:', err);
      emitGlobalToast('Error al enviar. Intenta de nuevo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareViaWhatsApp = () => {
    const json = exportClientAsJson(formData);
    const message = encodeURIComponent(
      `Mis datos para factura:\n\n${json}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Datos Enviados!</h1>
          <p className="text-gray-600 mb-6">
            Tus datos han sido recibidos. El vendedor podra generar tu factura.
          </p>
          
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
            <p className="text-sm text-gray-500 mb-1">Nombre</p>
            <p className="font-medium text-gray-900">{formData.name}</p>
            {formData.nit && (
              <>
                <p className="text-sm text-gray-500 mt-3 mb-1">NIT</p>
                <p className="font-medium text-gray-900">{formData.nit}</p>
              </>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Puedes cerrar esta pagina
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Datos para Factura</h1>
            <p className="text-xs text-gray-500">
              {vendorId ? `Vendedor: ${vendorId}` : 'Ingresa tus datos'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto p-4 pb-24">
        {/* AI Scan Button */}
        <div className="mb-6">
          <label className="block">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleScanDocument}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium cursor-pointer hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg">
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Escaneando con IA...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <Sparkles className="w-4 h-4" />
                  Escanear Tarjeta de IVA
                </>
              )}
            </div>
          </label>
          <p className="text-xs text-center text-gray-500 mt-2">
            Toma una foto de tu tarjeta y la IA extraera los datos
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4" />
              Nombre o Razon Social *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Tu nombre completo o empresa"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* NIT */}
          <div>
            <NitOrDuiField
              label={
                <>
                  <FileText className="w-4 h-4" />
                  NIT
                </>
              }
              labelClassName="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"
              value={formData.nit}
              onChange={(nit) => handleChange('nit', nit)}
              placeholder="0000-000000-000-0"
              validation={errors.nit ? { valid: false, message: errors.nit } : { valid: true, message: '' }}
              showErrorWhenEmpty={!!errors.nit}
              messageVariant="below-invalid"
              colorMode="blue"
              tone="neutral"
              inputClassName={errors.nit ? 'bg-red-50' : ''}
            />
          </div>

          {/* NRC */}
          <div>
            <NrcField
              label={
                <>
                  <Building2 className="w-4 h-4" />
                  NRC (Registro)
                </>
              }
              labelClassName="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"
              value={formData.nrc}
              onChange={(nrc) => handleChange('nrc', nrc)}
              placeholder="000000-0"
              validation={errors.nrc ? { valid: false, message: errors.nrc } : { valid: true, message: '' }}
              showErrorWhenEmpty={!!errors.nrc}
              messageVariant="below-invalid"
              colorMode="blue"
              tone="neutral"
              inputClassName={errors.nrc ? 'bg-red-50' : ''}
            />
          </div>

          {/* Phone */}
          <div>
            <PhoneField
              label={
                <>
                  <Phone className="w-4 h-4" />
                  Telefono
                </>
              }
              labelClassName="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"
              value={formData.phone}
              onChange={(phone) => handleChange('phone', phone)}
              placeholder="0000-0000"
              type="tel"
              validation={errors.phone ? { valid: false, message: errors.phone } : { valid: true, message: '' }}
              showErrorWhenEmpty={!!errors.phone}
              messageVariant="below-invalid"
              colorMode="blue"
              tone="neutral"
              inputClassName={errors.phone ? 'bg-red-50' : ''}
            />
          </div>

          {/* Email */}
          <div>
            <EmailField
              label={
                <>
                  <Mail className="w-4 h-4" />
                  Correo Electronico
                </>
              }
              labelClassName="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"
              value={formData.email}
              onChange={(email) => handleChange('email', email)}
              placeholder="correo@ejemplo.com"
              validation={errors.email ? { valid: false, message: errors.email } : { valid: true, message: '' }}
              showErrorWhenEmpty={!!errors.email}
              messageVariant="below-invalid"
              colorMode="blue"
              tone="neutral"
              inputClassName={errors.email ? 'bg-red-50' : ''}
            />
          </div>

          <SelectUbicacion
            departamento={formData.department}
            municipio={formData.municipality}
            onDepartamentoChange={(codigo) => handleChange('department', codigo)}
            onMunicipioChange={(codigo) => handleChange('municipality', codigo)}
            layout="vertical"
            size="lg"
          />

          {/* Address */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Direccion
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Direccion completa"
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Alternative: WhatsApp */}
        <div className="mt-4 text-center">
          <button
            onClick={handleShareViaWhatsApp}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            O enviar por WhatsApp
          </button>
        </div>
      </div>

      {/* Fixed Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-area-pb">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
            className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-medium text-lg transition-colors ${
              isSubmitting || !formData.name.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Enviar Datos
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientFormPage;
