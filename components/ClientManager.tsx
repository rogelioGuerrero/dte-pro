import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, Save, Search, Users, Trash2, 
  Download, FileUp, Plus, Edit3, Building2,
  ScanLine,
  LayoutGrid,
  List
} from 'lucide-react';
import { 
  addClient, getClients, deleteClient, updateClient, exportClients, importClients, ClientData 
} from '../utils/clientDb';
import { extractDataFromImage } from '../utils/ocr';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';
import { EmailField, NitOrDuiField, NrcField, PhoneField, SelectActividad, SelectUbicacion } from './formularios';
import {
  validateNIT,
  validateNRC,
  validatePhone,
  validateEmail,
  formatNitOrDuiInput,
  formatNRCInput,
  formatPhoneInput,
  formatEmailInput,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';

interface FormData {
  nit: string;
  name: string;
  nrc: string;
  nombreComercial: string;
  actividadEconomica: string;
  descActividad: string;
  departamento: string;
  municipio: string;
  direccion: string;
  email: string;
  telefono: string;
  esConsumidorFinal: boolean;
}

const emptyForm: FormData = {
  nit: '',
  name: '',
  nrc: '',
  nombreComercial: '',
  actividadEconomica: '',
  descActividad: '',
  departamento: '',
  municipio: '',
  direccion: '',
  email: '',
  telefono: '',
  esConsumidorFinal: false,
};

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [importMode, setImportMode] = useState<'ventas' | 'compras'>('ventas');
  const [clientsViewMode, setClientsViewMode] = useState<'list' | 'cards'>('list');
  const [clientsGroupMode, setClientsGroupMode] = useState<'none' | 'az' | 'tipo' | 'departamento'>('none');
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(360);
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');
  
  const { toasts, addToast, removeToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const panelsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('clients_left_panel_width');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!Number.isNaN(val)) setLeftPanelWidth(val);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isResizingPanels) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!panelsContainerRef.current) return;
      const rect = panelsContainerRef.current.getBoundingClientRect();
      const raw = ev.clientX - rect.left;
      const min = 280;
      const max = 520;
      const next = Math.min(max, Math.max(min, raw));
      setLeftPanelWidth(next);
    };

    const onMouseUp = () => {
      setIsResizingPanels(false);
      try {
        localStorage.setItem('clients_left_panel_width', String(leftPanelWidth));
      } catch {
        // ignore
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizingPanels, leftPanelWidth]);

  useEffect(() => {
    if (!importInputRef.current) return;
    importInputRef.current.setAttribute('webkitdirectory', '');
    importInputRef.current.setAttribute('directory', '');
  }, []);

  const loadClients = async () => {
    try {
      const allClients = await getClients();
      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const handleDeleteAllClients = async () => {
    if (clients.length === 0) return;
    const ok = window.confirm('¿Deseas borrar todos los clientes? Esta acción no se puede deshacer.');
    if (!ok) return;

    try {
      const { clearClients } = await import('../utils/clientDb');
      await clearClients();
      await loadClients();
      setSelectedClient(null);
      setFormData(emptyForm);
      setIsEditing(false);
      addToast('Clientes eliminados', 'info');
    } catch {
      addToast('Error al borrar clientes', 'error');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.nit.includes(clientSearch) ||
    client.nrc.includes(clientSearch) ||
    client.nombreComercial?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const groupedClients = React.useMemo(() => {
    const getGroupKey = (client: ClientData): string => {
      if (clientsGroupMode === 'az') {
        const v = (client.name || '').trim();
        return v ? v[0].toUpperCase() : '#';
      }
      if (clientsGroupMode === 'tipo') {
        return client.nrc ? 'Contribuyentes' : 'Consumidor final';
      }
      if (clientsGroupMode === 'departamento') {
        return (client.departamento || '').trim() || 'Sin departamento';
      }
      return 'Todos';
    };

    const map = filteredClients.reduce((acc, client) => {
      const key = getGroupKey(client);
      if (!acc[key]) acc[key] = [];
      acc[key].push(client);
      return acc;
    }, {} as Record<string, ClientData[]>);

    const sortKeys = (keys: string[]) => {
      if (clientsGroupMode === 'none') return keys;
      if (clientsGroupMode === 'tipo') {
        const order = ['Contribuyentes', 'Consumidor final'];
        return keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      }
      return keys.sort((a, b) => a.localeCompare(b, 'es'));
    };

    return sortKeys(Object.keys(map)).map((key) => ({
      key,
      clients: map[key]
    }));
  }, [filteredClients, clientsGroupMode]);

  // Validaciones
  const nitValidation = validateNIT(formData.nit);
  const nrcValidation = validateNRC(formData.nrc);
  const phoneValidation = validatePhone(formData.telefono);
  const emailValidation = validateEmail(formData.email);

  const isFormValid = (formData.esConsumidorFinal || nitValidation.valid) && formData.name.trim() && phoneValidation.valid && emailValidation.valid;

  const handleNewClient = () => {
    setSelectedClient(null);
    setFormData(emptyForm);
    setIsEditing(true);
    setMobilePane('detail');
  };

  const handleSelectClient = (client: ClientData) => {
    setSelectedClient(client);
    setFormData({
      nit: formatNitOrDuiInput(client.nit),
      name: formatTextInput(client.name),
      nrc: formatNRCInput(client.nrc),
      nombreComercial: formatTextInput(client.nombreComercial || ''),
      actividadEconomica: client.actividadEconomica || '',
      descActividad: client.descActividad || '',
      departamento: client.departamento || '',
      municipio: client.municipio || '',
      direccion: formatMultilineTextInput(client.direccion || ''),
      email: formatEmailInput(client.email),
      telefono: formatPhoneInput(client.telefono),
      esConsumidorFinal: !client.nit || client.nit === '' || client.name === 'Consumidor Final',
    });
    setIsEditing(false);
    setMobilePane('detail');
  };

  const handleDeleteClient = async (id: number) => {
    try {
      await deleteClient(id);
      await loadClients();
      if (selectedClient?.id === id) {
        setSelectedClient(null);
        setFormData(emptyForm);
        setIsEditing(false);
      }
      addToast('Cliente eliminado', 'info');
    } catch (error) {
      addToast('Error al eliminar cliente', 'error');
    }
  };

  const handleSave = async () => {
    if (!isFormValid) {
      addToast('Completa los campos requeridos correctamente', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const clientData = {
        ...formData,
        nit: formData.esConsumidorFinal ? '' : formData.nit,
        name: formData.esConsumidorFinal ? 'Consumidor Final' : formData.name,
        timestamp: Date.now(),
      };
      
      if (selectedClient?.id) {
        await updateClient({
          ...selectedClient,
          ...clientData,
        });
        addToast('Cliente actualizado', 'success');
      } else {
        await addClient(clientData);
        addToast('Cliente guardado', 'success');
      }
      await loadClients();
      setIsEditing(false);
    } catch (error) {
      addToast('Error al guardar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportClients();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clientes-dte-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`${clients.length} clientes exportados`, 'success');
    } catch (error) {
      addToast('Error al exportar', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      let imported = 0;
      let skipped = 0;

      const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));

      for (const file of jsonFiles) {
        const text = await file.text();

        try {
          const parsed = JSON.parse(text);
          const sample = Array.isArray(parsed) ? parsed[0] : parsed;

          if (sample?.identificacion?.numeroControl) {
            const { importClientsFromDTE } = await import('../utils/clientDb');
            const result = await importClientsFromDTE(text, importMode);
            imported += result.imported;
            skipped += result.skipped;
          } else {
            const result = await importClients(text);
            imported += result.imported;
            skipped += result.skipped;
          }
        } catch {
          const result = await importClients(text);
          imported += result.imported;
          skipped += result.skipped;
        }
      }

      await loadClients();
      const hint = imported === 0 && skipped > 0
        ? ` Revisa si seleccionaste el modo correcto (${importMode === 'ventas' ? 'Ventas' : 'Compras'}).`
        : '';
      addToast(`${imported} importados, ${skipped} omitidos (ya existían o repetidos).${hint}`, 'success');
    } catch (error) {
      addToast('Error al importar: formato inválido', 'error');
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingOCR(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const extracted = await extractDataFromImage(base64);
          setFormData(prev => ({
            ...prev,
            name: extracted.name ? formatTextInput(extracted.name) : prev.name,
            nit: extracted.nit ? formatNitOrDuiInput(extracted.nit) : prev.nit,
            nrc: extracted.nrc ? formatNRCInput(extracted.nrc) : prev.nrc,
            actividadEconomica: extracted.activity && /^\d{5,6}$/.test(formatTextInput(extracted.activity))
              ? formatTextInput(extracted.activity)
              : prev.actividadEconomica,
            descActividad: extracted.activity && !/^\d{5,6}$/.test(formatTextInput(extracted.activity))
              ? formatTextInput(extracted.activity)
              : prev.descActividad,
            direccion: extracted.address ? formatMultilineTextInput(extracted.address) : prev.direccion,
            telefono: extracted.phone ? formatPhoneInput(extracted.phone) : prev.telefono,
            email: extracted.email ? formatEmailInput(extracted.email) : prev.email,
          }));
          addToast('Datos extraídos con IA', 'success');
        } catch {
          addToast('No se pudieron extraer datos', 'error');
        } finally {
          setIsProcessingOCR(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessingOCR(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
          <p className="text-sm text-gray-500">Administra los receptores para tus documentos DTE</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Tooltip content="Importar clientes desde archivo JSON" position="bottom">
              <div className="flex items-center">
                <div className="bg-gray-100 p-1 rounded-lg flex items-center mr-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('ventas')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${importMode === 'ventas' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Ventas
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('compras')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${importMode === 'compras' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Compras
                  </button>
                </div>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileUp className="w-4 h-4" />
                  Importar
                </button>
              </div>
            </Tooltip>
            <Tooltip content="Borrar todos los clientes" position="bottom">
              <button
                onClick={handleDeleteAllClients}
                disabled={clients.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Borrar todos
              </button>
            </Tooltip>
            <Tooltip content="Exportar todos los clientes a JSON" position="bottom">
              <button
                onClick={handleExport}
                disabled={clients.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </Tooltip>
          </div>
          <button
            onClick={handleNewClient}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={importInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImport}
        multiple
      />

      {/* Main Content */}
      <div
        ref={panelsContainerRef}
        className="flex-1 flex flex-col md:flex-row gap-4 md:gap-0 min-h-0"
      >
        
        {/* Left: Client List */}
        <div
          className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden md:flex-none ${mobilePane === 'detail' ? 'hidden md:flex' : 'flex'}`}
          style={{ width: leftPanelWidth }}
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre, NIT..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <select
                value={clientsGroupMode}
                onChange={(e) => setClientsGroupMode(e.target.value as any)}
                className="h-9 text-sm border border-gray-200 rounded-lg bg-white px-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                title="Agrupar"
              >
                <option value="none">Sin agrupar</option>
                <option value="az">A-Z</option>
                <option value="tipo">Tipo</option>
                <option value="departamento">Departamento</option>
              </select>

              <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button
                  type="button"
                  onClick={() => setClientsViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${clientsViewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Vista lista"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setClientsViewMode('cards')}
                  className={`p-1.5 rounded-md transition-all ${clientsViewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Vista tarjetas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
                <Users className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">{clients.length === 0 ? 'Sin clientes' : 'Sin resultados'}</p>
              </div>
            ) : (
              clientsViewMode === 'list' ? (
                <div className="divide-y divide-gray-100">
                  {groupedClients.map(group => (
                    <div key={group.key}>
                      {clientsGroupMode !== 'none' && (
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-0">
                          {group.key} <span className="font-normal">({group.clients.length})</span>
                        </div>
                      )}
                      {group.clients.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className={`p-3 cursor-pointer transition-colors group ${
                            selectedClient?.id === client.id ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">NIT: {client.nit}</p>
                              {client.nombreComercial && (
                                <p className="text-xs text-gray-400 truncate">{client.nombreComercial}</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (client.id) handleDeleteClient(client.id);
                              }}
                              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {groupedClients.map(group => (
                    <div key={group.key}>
                      {clientsGroupMode !== 'none' && (
                        <div className="px-1 pb-2 text-xs font-semibold text-gray-500">
                          {group.key} <span className="font-normal">({group.clients.length})</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.clients.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className={`cursor-pointer rounded-xl border p-3 transition-all group ${
                              selectedClient?.id === client.id
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                                <p className="text-xs text-gray-500 mt-1 truncate">NIT: {client.nit}</p>
                                {client.nrc && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">NRC: {client.nrc}</p>
                                )}
                                {client.nombreComercial && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">{client.nombreComercial}</p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (client.id) handleDeleteClient(client.id);
                                }}
                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
            <span className="text-xs text-gray-400">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Divider (solo desktop/tablet) */}
        <div
          className="hidden md:flex items-stretch px-1"
          onDoubleClick={() => {
            setLeftPanelWidth(360);
            try {
              localStorage.setItem('clients_left_panel_width', String(360));
            } catch {
              // ignore
            }
          }}
        >
          <div
            className="cursor-col-resize"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingPanels(true);
            }}
            title="Arrastra para ajustar"
          >
            <div
              className={`w-[2px] h-full rounded ${isResizingPanels ? 'bg-blue-300' : 'bg-gray-200 hover:bg-gray-300'}`}
            />
          </div>
        </div>

        {/* Right: Form */}
        <div className={`bg-white rounded-xl border border-gray-200 flex-1 flex flex-col overflow-hidden mt-4 md:mt-0 ${mobilePane === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {/* Mobile back */}
          <div className="md:hidden border-b border-gray-100 p-3">
            <button
              type="button"
              onClick={() => setMobilePane('list')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Volver
            </button>
          </div>
          {!selectedClient && !isEditing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <Building2 className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-500">Selecciona o crea un cliente</p>
              <p className="text-sm mt-1">Los datos se usarán como receptor en tus facturas DTE</p>
              <button
                onClick={handleNewClient}
                className="mt-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear nuevo cliente
              </button>
            </div>
          ) : (
            <>
              {/* Form Header */}
              <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-700">
                    {selectedClient ? (isEditing ? 'Editar Cliente' : 'Detalle del Cliente') : 'Nuevo Cliente'}
                  </h3>
                  {!isEditing && selectedClient && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <Tooltip content="Escanear tarjeta NIT/NRC con IA" position="left">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingOCR}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                      {isProcessingOCR ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanLine className="w-3.5 h-3.5" />
                      )}
                      Escanear con IA
                    </button>
                  </Tooltip>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleOCRUpload} />

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Consumidor Final Toggle */}
                {isEditing && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.esConsumidorFinal}
                        onChange={(e) => {
                          const esConsumidorFinal = e.target.checked;
                          setFormData({
                            ...formData,
                            esConsumidorFinal,
                            nit: esConsumidorFinal ? '' : formData.nit,
                            name: esConsumidorFinal ? 'Consumidor Final' : formData.name,
                            nrc: esConsumidorFinal ? '' : formData.nrc,
                            nombreComercial: esConsumidorFinal ? '' : formData.nombreComercial,
                            actividadEconomica: esConsumidorFinal ? '' : formData.actividadEconomica,
                            descActividad: esConsumidorFinal ? '' : formData.descActividad,
                            departamento: esConsumidorFinal ? '' : formData.departamento,
                            municipio: esConsumidorFinal ? '' : formData.municipio,
                            direccion: esConsumidorFinal ? '' : formData.direccion,
                          });
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Consumidor Final</span>
                        <p className="text-xs text-gray-600 mt-0.5">Para operaciones menores a $25,000 (opcional según normativa)</p>
                      </div>
                    </label>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  
                  {/* NIT */}
                  <div>
                    <NitOrDuiField
                      label="NIT / DUI"
                      required={!formData.esConsumidorFinal}
                      value={formData.nit}
                      onChange={(nit) => setFormData({ ...formData, nit })}
                      validation={formData.esConsumidorFinal ? { valid: true, message: '' } : nitValidation}
                      disabled={!isEditing || formData.esConsumidorFinal}
                      placeholder="0000-000000-000-0"
                      messageVariant="overlay-when-value"
                      colorMode="blue"
                    />
                  </div>

                  {/* NRC */}
                  <div>
                    <NrcField
                      label="NRC"
                      value={formData.nrc}
                      onChange={(nrc) => setFormData({ ...formData, nrc })}
                      validation={formData.esConsumidorFinal ? { valid: true, message: '' } : nrcValidation}
                      disabled={!isEditing || formData.esConsumidorFinal}
                      placeholder="000000-0"
                      messageVariant="overlay-when-value"
                      colorMode="blue"
                    />
                  </div>

                  {/* Nombre */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      Nombre del Cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: formatTextInput(e.target.value) })}
                      disabled={!isEditing || formData.esConsumidorFinal}
                      placeholder={formData.esConsumidorFinal ? 'Consumidor Final' : 'Nombre completo del cliente'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Nombre Comercial */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre Comercial</label>
                    <input
                      type="text"
                      value={formData.nombreComercial}
                      onChange={(e) => setFormData({ ...formData, nombreComercial: formatTextInput(e.target.value) })}
                      disabled={!isEditing || formData.esConsumidorFinal}
                      placeholder="Personalizar nombre comercial"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Actividad Económica */}
                  <div className="col-span-2">
                    <SelectActividad
                      value={formData.actividadEconomica}
                      onChange={(codigo, descripcion) =>
                        setFormData((prev) => ({ ...prev, actividadEconomica: codigo, descActividad: descripcion }))
                      }
                      disabled={!isEditing || formData.esConsumidorFinal}
                      label="Actividad Económica"
                      placeholder="Escribe una actividad..."
                    />
                  </div>

                  {/* Departamento */}
                  <div className="col-span-2">
                    <SelectUbicacion
                      departamento={formData.departamento}
                      municipio={formData.municipio}
                      onDepartamentoChange={(codigo) => setFormData(prev => ({ ...prev, departamento: codigo, municipio: '' }))}
                      onMunicipioChange={(codigo) => setFormData(prev => ({ ...prev, municipio: codigo }))}
                      disabled={!isEditing || formData.esConsumidorFinal}
                      showLabels
                      layout="horizontal"
                      size="md"
                    />
                  </div>

                  {/* Dirección */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Dirección Complemento</label>
                    <textarea
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: formatMultilineTextInput(e.target.value) })}
                      disabled={!isEditing || formData.esConsumidorFinal}
                      rows={2}
                      placeholder="Digite el complemento de la dirección"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <EmailField
                      label="Correo electrónico"
                      required
                      value={formData.email}
                      onChange={(email) => setFormData({ ...formData, email })}
                      validation={emailValidation}
                      disabled={!isEditing}
                      placeholder="cliente@ejemplo.com"
                      messageVariant="overlay-when-value"
                      colorMode="blue"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <PhoneField
                      label="Teléfono"
                      required
                      value={formData.telefono}
                      onChange={(telefono) => setFormData({ ...formData, telefono })}
                      validation={phoneValidation}
                      disabled={!isEditing}
                      placeholder="2222-2222"
                      messageVariant="overlay-when-value"
                      colorMode="blue"
                    />
                  </div>

                </div>
              </div>

              {/* Form Actions */}
              {isEditing && (
                <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      if (selectedClient) {
                        handleSelectClient(selectedClient);
                      } else {
                        setFormData(emptyForm);
                        setIsEditing(false);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !isFormValid}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {selectedClient ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientManager;
