import { useState } from 'react';
import { 
  X, 
  Copy, 
  Download, 
  Send, 
  CheckCircle2,
  FileText,
  User,
  Building2,
  Calendar,
  Hash
} from 'lucide-react';
import { DTEJSON } from '../utils/dteGenerator';
import { tiposDocumento } from '../utils/dteGenerator';

interface DTEPreviewModalProps {
  dte: DTEJSON;
  onClose: () => void;
  onTransmit: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

const DTEPreviewModal: React.FC<DTEPreviewModalProps> = ({
  dte,
  onClose,
  onTransmit,
  onCopy,
  onDownload,
}) => {
  const [showJSON, setShowJSON] = useState(false);
  const [copied, setCopied] = useState(false);

  const tipoDoc = tiposDocumento.find((t) => t.codigo === dte.identificacion.tipoDte);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">DTE Generado</h2>
              <p className="text-xs text-gray-500">Listo para transmitir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Identificación */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Tipo:</span>
              <span className="text-gray-700">
                {dte.identificacion.tipoDte}
                {tipoDoc ? ` - ${tipoDoc.descripcion}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Código:</span>
              <code className="font-mono text-xs bg-white px-2 py-0.5 rounded border text-gray-700">
                {dte.identificacion.codigoGeneracion.substring(0, 16)}...
              </code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Versión:</span>
              <span className="text-gray-700">{dte.identificacion.version}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Control:</span>
              <code className="font-mono text-xs bg-white px-2 py-0.5 rounded border text-gray-700">
                {dte.identificacion.numeroControl}
              </code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Fecha:</span>
              <span className="text-gray-700">{dte.identificacion.fecEmi} {dte.identificacion.horEmi}</span>
            </div>
          </div>

          {/* Emisor y Receptor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase">Emisor</span>
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">{dte.emisor.nombre}</p>
              <p className="text-xs text-gray-500">NIT: {dte.emisor.nit}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase">Receptor</span>
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">{dte.receptor.nombre}</p>
              <p className="text-xs text-gray-500">NIT: {dte.receptor.numDocumento}</p>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 uppercase font-medium">Total a Pagar</p>
                <p className="text-2xl font-bold text-green-700">${dte.resumen.totalPagar.toFixed(2)}</p>
              </div>
              <div className="text-right text-xs text-green-600">
                <p>Items: {dte.cuerpoDocumento.length}</p>
                <p>IVA: ${dte.resumen.tributos?.[0]?.valor?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>

          {/* Toggle JSON */}
          <button
            onClick={() => setShowJSON(!showJSON)}
            className="w-full text-xs text-gray-500 hover:text-gray-700 py-2"
          >
            {showJSON ? 'Ocultar JSON' : 'Ver JSON completo'}
          </button>

          {showJSON && (
            <div className="bg-gray-900 rounded-xl p-3 max-h-48 overflow-auto">
              <pre className="text-[10px] font-mono text-green-400 whitespace-pre-wrap">
                {JSON.stringify(dte, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          {/* Primary Action */}
          <button
            onClick={onTransmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            Transmitir a Hacienda
          </button>

          {/* Secondary Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
            <button
              onClick={onDownload}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DTEPreviewModal;
