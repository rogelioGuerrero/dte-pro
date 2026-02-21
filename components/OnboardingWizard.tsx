import { useState, useRef } from 'react';
import { 
  FileKey, 
  CheckCircle2, 
  ChevronRight, 
  Upload,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Loader2,
  BadgeCheck,
  Calendar,
} from 'lucide-react';
import { leerP12, CertificadoInfo, formatearFechaCertificado, validarCertificadoDTE } from '../utils/p12Handler';
import { saveCertificate, setOnboardingComplete } from '../utils/secureStorage';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const STEPS = [
  { id: 1, title: 'Bienvenida', icon: Sparkles },
  { id: 2, title: 'Certificado', icon: FileKey },
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [certificateInfo, setCertificateInfo] = useState<CertificadoInfo | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isValidatingCert, setIsValidatingCert] = useState(false);
  const [p12Data, setP12Data] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!certificateFile || !certificatePassword || !p12Data) return;
    setIsValidatingCert(true);
    setCertificateError(null);
    try {
      const result = await leerP12(p12Data, certificatePassword);
      if (!result.success) {
        setCertificateError(result.error || 'Error al leer certificado');
        setCertificateInfo(null);
      } else if (result.certificateInfo) {
        const validation = validarCertificadoDTE(result.certificateInfo);
        if (!validation.valid) {
          setCertificateError(validation.errors.join('. '));
        }
        setCertificateInfo(result.certificateInfo);
      }
    } catch (err) {
      setCertificateError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsValidatingCert(false);
    }
  };

  const validateStep = (): boolean => {
    if (currentStep === 2) {
      return !!certificateFile && certificatePassword.length >= 4 && !!certificateInfo && certificateInfo.isValid;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < 2) {
        setCurrentStep(currentStep + 1);
      } else {
        handleComplete();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleComplete = async () => {
    if (!p12Data || !certificatePassword) return;
    setIsSaving(true);
    try {
      await saveCertificate(p12Data, certificatePassword);
      setOnboardingComplete(true);
      onComplete();
    } catch (error) {
      console.error('Error guardando configuracion:', error);
      setCertificateError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStepClass = (stepId: number) => {
    if (currentStep === stepId) return 'bg-blue-600 text-white scale-110';
    if (currentStep > stepId) return 'bg-green-500 text-white';
    return 'bg-gray-200 text-gray-500';
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${getStepClass(step.id)}`}>
            {currentStep > step.id ? <CheckCircle2 className="w-4 h-4" /> : step.id}
          </div>
          {index < STEPS.length - 1 && (
            <div className={`w-12 h-0.5 mx-1 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="text-center px-4">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Bienvenido a DTE Pro!</h2>
      <p className="text-gray-600 mb-6 leading-relaxed">
        Genera facturas electronicas desde tu telefono de forma rapida y segura.
      </p>
      <div className="bg-blue-50 rounded-xl p-4 text-left space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <FileKey className="w-3 h-3 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Certificado Digital</p>
            <p className="text-xs text-gray-500">Sube tu archivo .p12 de Hacienda</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Listo para facturar</p>
            <p className="text-xs text-gray-500">En menos de 1 minuto</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400">Tus datos se guardan localmente en tu dispositivo.</p>
    </div>
  );

  const renderStep2 = () => (
    <div className="px-4">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileKey className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Certificado Digital</h2>
        <p className="text-sm text-gray-500">Sube el archivo .p12 que te proporciono el Ministerio de Hacienda</p>
      </div>
      <input ref={fileInputRef} type="file" accept=".p12,.pfx" onChange={handleFileSelect} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-6 border-2 border-dashed rounded-xl transition-all mb-4 ${certificateFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
      >
        {certificateFile ? (
          <div className="flex items-center justify-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <div className="text-left">
              <p className="font-medium text-green-700">{certificateFile.name}</p>
              <p className="text-xs text-green-600">{(certificateFile.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Toca para seleccionar archivo</p>
            <p className="text-xs text-gray-400 mt-1">.p12 o .pfx</p>
          </div>
        )}
      </button>
      {certificateFile && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena del certificado</label>
            <div className="relative">
              <input
                type={showCertPassword ? 'text' : 'password'}
                value={certificatePassword}
                onChange={(e) => { setCertificatePassword(e.target.value); setCertificateInfo(null); setCertificateError(null); }}
                placeholder="PIN que te dio Hacienda"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
              />
              <button type="button" onClick={() => setShowCertPassword(!showCertPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCertPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Es el PIN que recibiste junto con tu certificado</p>
          </div>
          {certificatePassword.length >= 4 && !certificateInfo && (
            <button onClick={handleValidateCertificate} disabled={isValidatingCert} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {isValidatingCert ? (<><Loader2 className="w-4 h-4 animate-spin" />Validando...</>) : (<><BadgeCheck className="w-4 h-4" />Validar Certificado</>)}
            </button>
          )}
          {certificateError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{certificateError}</p>
            </div>
          )}
          {certificateInfo && (
            <div className={`p-4 rounded-xl border ${certificateInfo.isValid ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <BadgeCheck className={`w-5 h-5 ${certificateInfo.isValid ? 'text-green-600' : 'text-amber-600'}`} />
                <span className={`font-medium ${certificateInfo.isValid ? 'text-green-700' : 'text-amber-700'}`}>
                  {certificateInfo.isValid ? 'Certificado Valido' : 'Certificado con Advertencias'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Titular:</span>
                  <span className="font-medium text-gray-900">{certificateInfo.subject.commonName}</span>
                </div>
                {certificateInfo.subject.organization && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Organizacion:</span>
                    <span className="text-gray-700">{certificateInfo.subject.organization}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Valido hasta:</span>
                  <span className={`font-medium ${certificateInfo.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {formatearFechaCertificado(certificateInfo.validTo)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const getButtonClass = () => {
    if ((currentStep === 2 && !validateStep()) || isSaving) {
      return 'bg-gray-200 text-gray-400 cursor-not-allowed';
    }
    return 'bg-blue-600 text-white hover:bg-blue-700';
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Configuracion Inicial</h1>
          {onSkip && currentStep === 1 && (
            <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">Omitir</button>
          )}
        </div>
        {renderStepIndicator()}
      </div>
      <div className="flex-1 overflow-y-auto py-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
      </div>
      <div className="p-4 border-t border-gray-100 bg-white safe-area-pb">
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button onClick={handleBack} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
              Atras
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={(currentStep === 2 && !validateStep()) || isSaving}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${getButtonClass()}`}
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
            ) : currentStep === 2 ? (
              <><CheckCircle2 className="w-4 h-4" />Finalizar</>
            ) : (
              <>Comenzar<ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
