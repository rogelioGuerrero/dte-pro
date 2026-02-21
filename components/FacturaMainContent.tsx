import React from 'react';
import { FacturaActionsBar } from './FacturaActionsBar';
import { FacturaItemsTable } from './FacturaItemsTable';
import { FacturaPaymentSection } from './FacturaPaymentSection';
import { FacturaRightPanel } from './FacturaRightPanel';
import { FacturaTipoDocumentoSelector } from './FacturaTipoDocumentoSelector';
import { ReceptorPicker } from './ReceptorPicker';

interface ItemForm {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadVenta: string;
  factorConversion: number;
  precioUni: number;
  precioUniRaw?: string;
  tipoItem: number;
  uniMedida: number;
  esExento: boolean;
}

interface FacturaMainContentProps {
  // Left column props
  selectedReceptor: any;
  showClientSearch: boolean;
  setShowClientSearch: React.Dispatch<React.SetStateAction<boolean>>;
  clientSearch: string;
  setClientSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredClients: any[];
  onSelectReceptor: (client: any) => void;
  tipoDocumento: string;
  setTipoDocumento: (value: string) => void;
  receptorEsConsumidorFinal: boolean;
  tiposDocumentoFiltrados: Array<{ codigo: string; descripcion: string }>;
  items: ItemForm[];
  canUseCatalogoProductos: boolean;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onOpenProductPicker: (index: number) => void;
  onItemChange: (index: number, field: keyof ItemForm, value: any) => void;
  onItemDescriptionBlur: (index: number) => void;
  onPrecioUniChange: (index: number, value: string) => void;
  onPrecioUniBlur: (index: number) => void;
  getPresentacionesForCodigo: (codigo: string) => any[];
  getStockDisplayForCodigo: (codigo: string) => string;
  redondear: (value: number, decimales: number) => number;
  formaPago: string;
  setFormaPago: React.Dispatch<React.SetStateAction<string>>;
  formasPago: any[];
  condicionOperacion: number;
  setCondicionOperacion: React.Dispatch<React.SetStateAction<number>>;
  observaciones: string;
  setObservaciones: React.Dispatch<React.SetStateAction<string>>;
  stockError: string;
  isGenerating: boolean;
  emisor: any;
  generatedDTE: any;
  onGenerateDTE: () => void;
  onNuevaFactura: () => void;
  // Right column props
  totales: any;
  requiereStripe: (formaPago: string) => boolean;
  onOpenDTEPreview: () => void;
  onTransmit: () => void;
  onDeleteDTE: () => void;
}

export const FacturaMainContent: React.FC<FacturaMainContentProps> = ({
  // Left column
  selectedReceptor,
  showClientSearch,
  setShowClientSearch,
  clientSearch,
  setClientSearch,
  filteredClients,
  onSelectReceptor,
  tipoDocumento,
  setTipoDocumento,
  receptorEsConsumidorFinal,
  tiposDocumentoFiltrados,
  items,
  canUseCatalogoProductos,
  onAddItem,
  onRemoveItem,
  onOpenProductPicker,
  onItemChange,
  onItemDescriptionBlur,
  onPrecioUniChange,
  onPrecioUniBlur,
  getPresentacionesForCodigo,
  getStockDisplayForCodigo,
  redondear,
  formaPago,
  setFormaPago,
  formasPago,
  condicionOperacion,
  setCondicionOperacion,
  observaciones,
  setObservaciones,
  stockError,
  isGenerating,
  emisor,
  generatedDTE,
  onGenerateDTE,
  onNuevaFactura,
  // Right column
  totales,
  requiereStripe,
  onOpenDTEPreview,
  onTransmit,
  onDeleteDTE,
}) => {
  return (
    <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
      {/* Left: Form */}
      <div className="col-span-8 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Receptor y Tipo de Documento */}
          <div className="grid grid-cols-2 gap-4">
            <ReceptorPicker
              selectedReceptor={selectedReceptor}
              showClientSearch={showClientSearch}
              setShowClientSearch={setShowClientSearch}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              filteredClients={filteredClients}
              onSelectReceptor={onSelectReceptor}
            />

            <FacturaTipoDocumentoSelector
              tipoDocumento={tipoDocumento}
              setTipoDocumento={setTipoDocumento}
              selectedReceptor={selectedReceptor}
              receptorEsConsumidorFinal={receptorEsConsumidorFinal}
              tiposDocumentoFiltrados={tiposDocumentoFiltrados}
            />
          </div>

          {/* Items */}
          <FacturaItemsTable
            items={items}
            tipoDocumento={tipoDocumento}
            canUseCatalogoProductos={canUseCatalogoProductos}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
            onOpenProductPicker={onOpenProductPicker}
            onItemChange={onItemChange}
            onItemDescriptionBlur={onItemDescriptionBlur}
            onPrecioUniChange={onPrecioUniChange}
            onPrecioUniBlur={onPrecioUniBlur}
            getPresentacionesForCodigo={getPresentacionesForCodigo}
            getStockDisplayForCodigo={getStockDisplayForCodigo}
            redondear={redondear}
          />

          {/* Forma de Pago y Observaciones */}
          <FacturaPaymentSection
            formaPago={formaPago}
            setFormaPago={setFormaPago}
            formasPago={formasPago}
            condicionOperacion={condicionOperacion}
            setCondicionOperacion={setCondicionOperacion}
            observaciones={observaciones}
            setObservaciones={setObservaciones}
          />
        </div>

        {/* Actions */}
        <FacturaActionsBar
          stockError={stockError}
          isGenerating={isGenerating}
          emisor={emisor}
          selectedReceptor={selectedReceptor}
          generatedDTE={generatedDTE}
          onGenerateDTE={onGenerateDTE}
          onNuevaFactura={onNuevaFactura}
        />
      </div>

      {/* Right: Totals & Preview */}
      <FacturaRightPanel
        totales={totales}
        selectedReceptor={selectedReceptor}
        generatedDTE={generatedDTE}
        formaPago={formaPago}
        tipoDocumento={tipoDocumento}
        requiereStripe={requiereStripe}
        onOpenDTEPreview={onOpenDTEPreview}
        onTransmit={onTransmit}
        onDeleteDTE={onDeleteDTE}
      />
    </div>
  );
};
