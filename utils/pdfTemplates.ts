// Sistema de Plantillas de Factura DTE
// 4 estilos profesionales para generar valor agregado

import { DTEJSON } from './dteGenerator';
import { tiposDocumento } from './dteGenerator';
import { TransmisionResult } from './dteSignature';

export type TemplateName = 'clasica' | 'moderna' | 'minimalista' | 'ejecutiva';

export interface TemplateConfig {
  id: TemplateName;
  nombre: string;
  descripcion: string;
  preview: string; // Color principal para preview
  campos: {
    mostrarLogo: boolean;
    mostrarQR: boolean;
    mostrarNombreComercial: boolean;
    mostrarTelefono: boolean;
    mostrarDireccion: boolean;
    mostrarActividad: boolean;
    mostrarObservaciones: boolean;
    mostrarSello: boolean;
    mostrarEnlaceConsulta: boolean;
  };
}

export const PLANTILLAS: TemplateConfig[] = [
  {
    id: 'clasica',
    nombre: 'Clásica',
    descripcion: 'Formato tradicional similar al oficial de Hacienda',
    preview: '#1e40af', // Azul
    campos: {
      mostrarLogo: true,
      mostrarQR: true,
      mostrarNombreComercial: true,
      mostrarTelefono: true,
      mostrarDireccion: true,
      mostrarActividad: true,
      mostrarObservaciones: true,
      mostrarSello: true,
      mostrarEnlaceConsulta: true,
    }
  },
  {
    id: 'moderna',
    nombre: 'Moderna',
    descripcion: 'Diseño limpio con acentos de color y mejor legibilidad',
    preview: '#059669', // Verde
    campos: {
      mostrarLogo: true,
      mostrarQR: true,
      mostrarNombreComercial: true,
      mostrarTelefono: true,
      mostrarDireccion: true,
      mostrarActividad: true,
      mostrarObservaciones: true,
      mostrarSello: true,
      mostrarEnlaceConsulta: true,
    }
  },
  {
    id: 'minimalista',
    nombre: 'Minimalista',
    descripcion: 'Diseño simple y elegante, enfocado en la información esencial',
    preview: '#374151', // Gris
    campos: {
      mostrarLogo: true,
      mostrarQR: true,
      mostrarNombreComercial: false,
      mostrarTelefono: true,
      mostrarDireccion: true,
      mostrarActividad: false,
      mostrarObservaciones: false,
      mostrarSello: true,
      mostrarEnlaceConsulta: false,
    }
  },
  {
    id: 'ejecutiva',
    nombre: 'Ejecutiva',
    descripcion: 'Estilo corporativo premium con detalles refinados',
    preview: '#7c3aed', // Púrpura
    campos: {
      mostrarLogo: true,
      mostrarQR: true,
      mostrarNombreComercial: true,
      mostrarTelefono: true,
      mostrarDireccion: true,
      mostrarActividad: true,
      mostrarObservaciones: true,
      mostrarSello: true,
      mostrarEnlaceConsulta: true,
    }
  }
];

// Obtener nombre del tipo de documento
const getTipoDocumentoNombre = (codigo: string): string => {
  const tipo = tiposDocumento.find((t) => t.codigo === codigo);
  if (!tipo) return 'DOCUMENTO TRIBUTARIO ELECTRÓNICO';
  return tipo.descripcion.replace(/\s*\(.*?\)\s*/g, ' ').trim().toUpperCase();
};

// Formatear fecha
const formatearFecha = (fechaISO: string): string => {
  try {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-SV', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return fechaISO;
  }
};

// Generar URL de consulta pública según normativa MH
const generarUrlConsultaMH = (dte: DTEJSON, ambiente: '00' | '01' = '00'): string => {
  const baseUrl = ambiente === '00' 
    ? 'https://consultadte-test.mh.gob.sv/consultaPublica'
    : 'https://consultadte.mh.gob.sv/consultaPublica';
  
  // Limpiar NIT (sin guiones)
  const nitLimpio = dte.emisor.nit.replace(/-/g, '');
  
  const params = new URLSearchParams({
    cod: dte.identificacion.codigoGeneracion,
    nit: nitLimpio,
    fec: dte.identificacion.fecEmi,
    mont: dte.resumen.montoTotalOperacion.toFixed(2)
  });
  
  // Agregar parámetros opcionales si existen
  if (dte.emisor.codEstableMH) {
    params.append('est', dte.emisor.codEstableMH);
  }
  if (dte.emisor.codPuntoVentaMH) {
    params.append('ptov', dte.emisor.codPuntoVentaMH);
  }
  
  return `${baseUrl}?${params.toString()}`;
};

// Generar imagen QR usando API externa
const getQRImageUrl = (urlConsulta: string, size: number = 150): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(urlConsulta)}`;
};

interface GenerarHTMLOptions {
  dte: DTEJSON;
  resultado?: TransmisionResult;
  plantilla: TemplateName;
  config?: Partial<TemplateConfig['campos']>;
  logoUrl?: string; // Base64 encoded logo
  ambiente?: '00' | '01'; // 00=Pruebas, 01=Producción
}

// ============================================
// PLANTILLA CLÁSICA - Estilo oficial MH
// ============================================
const generarPlantillaClasica = (dte: DTEJSON, resultado?: TransmisionResult, config?: Partial<TemplateConfig['campos']>, logoUrl?: string, ambiente: '00' | '01' = '00'): string => {
  const tipoDocNombre = getTipoDocumentoNombre(dte.identificacion.tipoDte);
  const urlConsulta = generarUrlConsultaMH(dte, ambiente);
  const qrImageUrl = getQRImageUrl(urlConsulta, 120);
  const cfg = { ...PLANTILLAS[0].campos, ...config };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>DTE - ${dte.identificacion.numeroControl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; line-height: 1.2; color: #1a1a1a; background: #fff; padding: 8px; }
    .container { max-width: 800px; margin: 0 auto; border: 1px solid #1e40af; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 6px; text-align: center; }
    .header h1 { font-size: 9px; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px; }
    .header h2 { font-size: 11px; font-weight: 700; }
    .version { position: absolute; right: 12px; top: 12px; font-size: 8px; color: #93c5fd; }
    .info-bar { display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .qr-section { padding: 6px; border-right: 1px solid #e2e8f0; display: flex; align-items: center; }
    .qr-code { width: 55px; height: 55px; }
    .doc-info { flex: 1; padding: 6px; }
    .doc-info .field { display: flex; margin-bottom: 1px; font-size: 8px; }
    .doc-info .label { font-weight: 600; color: #64748b; min-width: 100px; }
    .doc-info .value { color: #1e293b; font-family: 'Consolas', monospace; font-size: 7px; }
    .parties { display: flex; border-bottom: 1px solid #e2e8f0; }
    .party { flex: 1; padding: 6px; }
    .party:first-child { border-right: 1px solid #e2e8f0; }
    .party h3 { font-size: 9px; font-weight: 700; color: #1e40af; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px solid #1e40af; text-transform: uppercase; }
    .party .field { display: flex; margin-bottom: 1px; font-size: 8px; }
    .party .label { font-weight: 600; color: #64748b; min-width: 70px; }
    .party .value { color: #1e293b; flex: 1; }
    table { width: 100%; border-collapse: collapse; }
    table th { background: #1e40af; color: white; padding: 4px 3px; font-size: 7px; font-weight: 600; text-transform: uppercase; }
    table td { padding: 3px; font-size: 8px; border-bottom: 1px solid #e2e8f0; }
    table tr:nth-child(even) { background: #f8fafc; }
    .number { text-align: right; font-family: 'Consolas', monospace; }
    .center { text-align: center; }
    .totals { display: flex; justify-content: flex-end; padding: 6px; background: #f8fafc; }
    .totals table { width: 200px; }
    .totals td { padding: 2px 4px; font-size: 8px; }
    .totals td:first-child { text-align: right; color: #64748b; }
    .totals td:last-child { text-align: right; font-family: 'Consolas', monospace; font-weight: 500; }
    .totals .total-row { background: #1e40af; color: white; }
    .totals .total-row td { font-size: 9px; font-weight: 700; padding: 4px; }
    .sello { margin: 6px; padding: 6px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 4px; }
    .sello h4 { color: #059669; font-size: 8px; margin-bottom: 2px; }
    .sello code { font-size: 6px; color: #047857; word-break: break-all; display: block; }
    .footer { text-align: center; padding: 4px; background: #f1f5f9; font-size: 7px; color: #64748b; border-top: 1px solid #e2e8f0; }
    @media print { body { padding: 0; } @page { margin: 5mm; } }
  </style>
</head>
<body>
  <div class="container" style="position: relative;">
    <div class="version">Ver.${dte.identificacion.version}</div>
    <div class="header">
      ${logoUrl && cfg.mostrarLogo ? `<img src="${logoUrl}" alt="Logo" style="max-height:30px;max-width:100px;margin-bottom:4px;" />` : ''}
      <h1>DOCUMENTO TRIBUTARIO ELECTRÓNICO</h1>
      <h2>${tipoDocNombre}</h2>
    </div>

    <div class="info-bar">
      ${cfg.mostrarQR ? `
      <div class="qr-section">
        <img src="${qrImageUrl}" alt="QR" class="qr-code" style="width:55px;height:55px;" title="Escanea para verificar en MH" />
      </div>
      ` : ''}
      <div class="doc-info">
        <div class="field"><span class="label">Código de Generación:</span><span class="value">${dte.identificacion.codigoGeneracion}</span></div>
        <div class="field"><span class="label">Número de Control:</span><span class="value">${dte.identificacion.numeroControl}</span></div>
        ${resultado?.selloRecepcion ? `<div class="field"><span class="label">Sello de Recepción:</span><span class="value" style="font-size:8px;">${resultado.selloRecepcion}</span></div>` : ''}
        <div class="field"><span class="label">Fecha/Hora Generación:</span><span class="value">${dte.identificacion.fecEmi} ${dte.identificacion.horEmi}</span></div>
        <div class="field"><span class="label">Modelo:</span><span class="value">Previo | Transmisión Normal</span></div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Emisor</h3>
        <div class="field"><span class="label">Razón Social:</span><span class="value">${dte.emisor.nombre}</span></div>
        ${cfg.mostrarNombreComercial && dte.emisor.nombreComercial ? `<div class="field"><span class="label">Nombre Comercial:</span><span class="value">${dte.emisor.nombreComercial}</span></div>` : ''}
        <div class="field"><span class="label">NIT:</span><span class="value">${dte.emisor.nit}</span></div>
        <div class="field"><span class="label">NRC:</span><span class="value">${dte.emisor.nrc}</span></div>
        ${cfg.mostrarActividad ? `<div class="field"><span class="label">Actividad:</span><span class="value">${dte.emisor.descActividad || '—'}</span></div>` : ''}
        ${cfg.mostrarDireccion ? `<div class="field"><span class="label">Dirección:</span><span class="value">${dte.emisor.direccion?.complemento || '—'}</span></div>` : ''}
        ${cfg.mostrarTelefono ? `<div class="field"><span class="label">Teléfono:</span><span class="value">${dte.emisor.telefono || '—'}</span></div>` : ''}
        <div class="field"><span class="label">Correo:</span><span class="value">${dte.emisor.correo || '—'}</span></div>
      </div>
      <div class="party">
        <h3>Receptor</h3>
        <div class="field"><span class="label">Razón Social:</span><span class="value">${dte.receptor.nombre}</span></div>
        <div class="field"><span class="label">NIT/DUI:</span><span class="value">${dte.receptor.numDocumento || '—'}</span></div>
        ${dte.receptor.nrc ? `<div class="field"><span class="label">NRC:</span><span class="value">${dte.receptor.nrc}</span></div>` : ''}
        ${cfg.mostrarActividad ? `<div class="field"><span class="label">Actividad:</span><span class="value">${dte.receptor.descActividad || '—'}</span></div>` : ''}
        ${cfg.mostrarDireccion ? `<div class="field"><span class="label">Dirección:</span><span class="value">${dte.receptor.direccion?.complemento || '—'}</span></div>` : ''}
        ${cfg.mostrarTelefono ? `<div class="field"><span class="label">Teléfono:</span><span class="value">${dte.receptor.telefono || '—'}</span></div>` : ''}
        <div class="field"><span class="label">Correo:</span><span class="value">${dte.receptor.correo || '—'}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:30px;">N°</th>
          <th style="width:50px;">Cant.</th>
          <th style="width:50px;">Unidad</th>
          <th>Descripción</th>
          <th style="width:70px;">P. Unit.</th>
          <th style="width:60px;">Desc.</th>
          <th style="width:70px;">Gravado</th>
        </tr>
      </thead>
      <tbody>
        ${dte.cuerpoDocumento.map(item => `
        <tr>
          <td class="center">${item.numItem}</td>
          <td class="number">${item.cantidad.toFixed(2)}</td>
          <td class="center">${item.uniMedida === 99 ? 'Unid' : item.uniMedida}</td>
          <td>${item.descripcion}</td>
          <td class="number">$${item.precioUni.toFixed(2)}</td>
          <td class="number">$${(item.montoDescu || 0).toFixed(2)}</td>
          <td class="number">$${(item.ventaGravada || 0).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Suma de Ventas:</td><td>$${dte.resumen.subTotalVentas.toFixed(2)}</td></tr>
        ${dte.identificacion.tipoDte !== '01' ? `<tr><td>IVA 13%:</td><td>$${dte.resumen.tributos?.[0]?.valor?.toFixed(2) || '0.00'}</td></tr>` : ''}
        <tr><td>Sub-Total:</td><td>$${dte.resumen.subTotal.toFixed(2)}</td></tr>
        <tr><td>IVA Retenido:</td><td>$${(dte.resumen.ivaRete1 || 0).toFixed(2)}</td></tr>
        <tr class="total-row"><td>TOTAL A PAGAR:</td><td>$${dte.resumen.totalPagar.toFixed(2)}</td></tr>
      </table>
    </div>

    ${cfg.mostrarSello && resultado?.selloRecepcion ? `
    <div class="sello">
      <h4>✓ Documento Validado por el Ministerio de Hacienda</h4>
      <code>${resultado.selloRecepcion}</code>
      ${resultado.fechaHoraProcesamiento ? `<p style="margin-top:5px;font-size:9px;color:#047857;">Procesado: ${formatearFecha(resultado.fechaHoraProcesamiento)}</p>` : ''}
    </div>
    ` : ''}

    <div class="footer">
      <p>Este documento es una representación impresa de un DTE</p>
      ${cfg.mostrarEnlaceConsulta ? `<p>Verifique en: https://consultadte.mh.gob.sv</p>` : ''}
    </div>
  </div>
</body>
</html>`;
};

// ============================================
// PLANTILLA MODERNA - Diseño limpio y fresco
// ============================================
const generarPlantillaModerna = (dte: DTEJSON, resultado?: TransmisionResult, config?: Partial<TemplateConfig['campos']>, logoUrl?: string, ambiente: '00' | '01' = '00'): string => {
  const tipoDocNombre = getTipoDocumentoNombre(dte.identificacion.tipoDte);
  const urlConsulta = generarUrlConsultaMH(dte, ambiente);
  const qrImageUrl = getQRImageUrl(urlConsulta, 100);
  const cfg = { ...PLANTILLAS[1].campos, ...config };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>DTE - ${dte.identificacion.numeroControl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 8px; line-height: 1.2; color: #1f2937; background: #fff; padding: 8px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #059669; }
    .header-left h1 { font-size: 12px; font-weight: 700; color: #059669; margin-bottom: 1px; }
    .header-left h2 { font-size: 7px; font-weight: 500; color: #6b7280; text-transform: uppercase; }
    .header-right { text-align: right; }
    .header-right .doc-type { background: #059669; color: white; padding: 2px 6px; border-radius: 8px; font-size: 7px; font-weight: 600; display: inline-block; margin-bottom: 2px; }
    .header-right .doc-info { font-size: 7px; color: #6b7280; }
    .header-right .doc-info strong { color: #1f2937; }
    .meta-grid { display: grid; grid-template-columns: auto 1fr 1fr; gap: 6px; margin-bottom: 6px; padding: 6px; background: #f9fafb; border-radius: 4px; }
    .qr-box { display: flex; align-items: center; justify-content: center; }
    .qr-box img { width: 50px; height: 50px; }
    .meta-section h4 { font-size: 6px; color: #059669; text-transform: uppercase; margin-bottom: 2px; font-weight: 600; }
    .meta-section p { font-size: 7px; color: #4b5563; margin-bottom: 1px; }
    .meta-section p strong { color: #1f2937; }
    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
    .party-card { padding: 6px; border-radius: 4px; background: white; border: 1px solid #e5e7eb; }
    .party-card.emisor { border-left: 2px solid #059669; }
    .party-card.receptor { border-left: 2px solid #0ea5e9; }
    .party-card h3 { font-size: 8px; font-weight: 700; margin-bottom: 3px; }
    .party-card.emisor h3 { color: #059669; }
    .party-card.receptor h3 { color: #0ea5e9; }
    .party-card .field { display: flex; margin-bottom: 1px; font-size: 7px; }
    .party-card .label { color: #9ca3af; min-width: 50px; }
    .party-card .value { color: #1f2937; font-weight: 500; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .items-table th { background: #059669; color: white; padding: 3px 2px; font-size: 6px; font-weight: 600; text-transform: uppercase; }
    .items-table td { padding: 3px 2px; font-size: 7px; border-bottom: 1px solid #f3f4f6; }
    .items-table tr:last-child td { border-bottom: none; }
    .items-table tr:nth-child(even) { background: #f9fafb; }
    .number { text-align: right; font-family: 'SF Mono', 'Consolas', monospace; }
    .center { text-align: center; }
    .summary-section { display: flex; justify-content: flex-end; }
    .summary-card { width: 180px; background: #f9fafb; border-radius: 4px; padding: 6px; }
    .summary-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 7px; border-bottom: 1px solid #e5e7eb; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row .label { color: #6b7280; }
    .summary-row .value { font-weight: 600; font-family: 'SF Mono', monospace; }
    .summary-row.total { background: #059669; color: white; margin: 4px -6px -6px; padding: 4px 6px; border-radius: 0 0 4px 4px; font-size: 9px; }
    .sello-card { margin-top: 6px; padding: 4px 6px; background: #ecfdf5; border-radius: 4px; border: 1px solid #10b981; }
    .sello-card h4 { color: #047857; font-size: 7px; margin-bottom: 2px; }
    .sello-card code { font-size: 5px; color: #065f46; background: white; padding: 2px 4px; border-radius: 2px; display: block; word-break: break-all; }
    .footer { margin-top: 6px; text-align: center; font-size: 6px; color: #9ca3af; }
    @media print { body { padding: 5px; } @page { margin: 5mm; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${logoUrl && cfg.mostrarLogo ? `<img src="${logoUrl}" alt="Logo" style="max-height:28px;max-width:80px;margin-bottom:3px;" />` : ''}
        <h1>${dte.emisor.nombreComercial || dte.emisor.nombre}</h1>
        <h2>Documento Tributario Electrónico</h2>
      </div>
      <div class="header-right">
        <div class="doc-type">${tipoDocNombre}</div>
        <div class="doc-info">
          <p><strong>N° Control:</strong> ${dte.identificacion.numeroControl}</p>
          <p><strong>Fecha:</strong> ${dte.identificacion.fecEmi} ${dte.identificacion.horEmi}</p>
        </div>
      </div>
    </div>

    <div class="meta-grid">
      ${cfg.mostrarQR ? `
      <div class="qr-box">
        <img src="${qrImageUrl}" alt="QR" title="Escanea para verificar" />
      </div>
      ` : '<div></div>'}
      <div class="meta-section">
        <h4>Identificación</h4>
        <p><strong>Código:</strong> ${dte.identificacion.codigoGeneracion.substring(0, 18)}...</p>
        <p><strong>Ambiente:</strong> ${dte.identificacion.ambiente === '00' ? 'Pruebas' : 'Producción'}</p>
        <p><strong>Modelo:</strong> Previo</p>
      </div>
      <div class="meta-section">
        <h4>Validación MH</h4>
        ${resultado?.selloRecepcion ? `
        <p><strong>Estado:</strong> ✓ Aceptado</p>
        <p><strong>Sello:</strong> ${resultado.selloRecepcion.substring(0, 20)}...</p>
        ` : '<p>Pendiente de transmisión</p>'}
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-card emisor">
        <h3>📤 Emisor</h3>
        <div class="field"><span class="label">Razón Social</span><span class="value">${dte.emisor.nombre}</span></div>
        <div class="field"><span class="label">NIT</span><span class="value">${dte.emisor.nit}</span></div>
        <div class="field"><span class="label">NRC</span><span class="value">${dte.emisor.nrc}</span></div>
        ${cfg.mostrarDireccion ? `<div class="field"><span class="label">Dirección</span><span class="value">${dte.emisor.direccion?.complemento || '—'}</span></div>` : ''}
        ${cfg.mostrarTelefono ? `<div class="field"><span class="label">Teléfono</span><span class="value">${dte.emisor.telefono || '—'}</span></div>` : ''}
        <div class="field"><span class="label">Correo</span><span class="value">${dte.emisor.correo}</span></div>
      </div>
      <div class="party-card receptor">
        <h3>📥 Receptor</h3>
        <div class="field"><span class="label">Razón Social</span><span class="value">${dte.receptor.nombre}</span></div>
        <div class="field"><span class="label">NIT/DUI</span><span class="value">${dte.receptor.numDocumento || '—'}</span></div>
        ${dte.receptor.nrc ? `<div class="field"><span class="label">NRC</span><span class="value">${dte.receptor.nrc}</span></div>` : ''}
        ${cfg.mostrarDireccion ? `<div class="field"><span class="label">Dirección</span><span class="value">${dte.receptor.direccion?.complemento || '—'}</span></div>` : ''}
        <div class="field"><span class="label">Correo</span><span class="value">${dte.receptor.correo}</span></div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width:35px;">#</th>
          <th style="width:55px;">Cant.</th>
          <th>Descripción</th>
          <th style="width:80px;">P. Unitario</th>
          <th style="width:70px;">Descuento</th>
          <th style="width:80px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${dte.cuerpoDocumento.map(item => `
        <tr>
          <td class="center">${item.numItem}</td>
          <td class="number">${item.cantidad.toFixed(2)}</td>
          <td>${item.descripcion}</td>
          <td class="number">$${item.precioUni.toFixed(2)}</td>
          <td class="number">$${(item.montoDescu || 0).toFixed(2)}</td>
          <td class="number"><strong>$${(item.ventaGravada || 0).toFixed(2)}</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-card">
        <div class="summary-row"><span class="label">Subtotal Ventas</span><span class="value">$${dte.resumen.subTotalVentas.toFixed(2)}</span></div>
        ${dte.identificacion.tipoDte !== '01' ? `<div class="summary-row"><span class="label">IVA (13%)</span><span class="value">$${dte.resumen.tributos?.[0]?.valor?.toFixed(2) || '0.00'}</span></div>` : ''}
        <div class="summary-row"><span class="label">Subtotal</span><span class="value">$${dte.resumen.subTotal.toFixed(2)}</span></div>
        ${dte.resumen.ivaRete1 ? `<div class="summary-row"><span class="label">IVA Retenido</span><span class="value">-$${dte.resumen.ivaRete1.toFixed(2)}</span></div>` : ''}
        <div class="summary-row total"><span class="label">TOTAL</span><span class="value">$${dte.resumen.totalPagar.toFixed(2)}</span></div>
      </div>
    </div>

    ${cfg.mostrarSello && resultado?.selloRecepcion ? `
    <div class="sello-card">
      <h4>✓ Validado por Ministerio de Hacienda</h4>
      <code>${resultado.selloRecepcion}</code>
    </div>
    ` : ''}

    <div class="footer">
      <p>Documento Tributario Electrónico - Representación impresa</p>
      ${cfg.mostrarEnlaceConsulta ? `<p>Consulte en: consultadte.mh.gob.sv</p>` : ''}
    </div>
  </div>
</body>
</html>`;
};

// ============================================
// PLANTILLA MINIMALISTA - Simple y elegante
// ============================================
const generarPlantillaMinimalista = (dte: DTEJSON, resultado?: TransmisionResult, config?: Partial<TemplateConfig['campos']>, logoUrl?: string, ambiente: '00' | '01' = '00'): string => {
  const tipoDocNombre = getTipoDocumentoNombre(dte.identificacion.tipoDte);
  const urlConsulta = generarUrlConsultaMH(dte, ambiente);
  const qrImageUrl = getQRImageUrl(urlConsulta, 80);
  const cfg = { ...PLANTILLAS[2].campos, ...config };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>DTE - ${dte.identificacion.numeroControl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 8px; line-height: 1.3; color: #111; background: #fff; padding: 10px; }
    .container { max-width: 700px; margin: 0 auto; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: 14px; font-weight: 300; color: #111; }
    .header .subtitle { font-size: 8px; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px; }
    .divider { height: 1px; background: #eee; margin: 8px 0; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-block h4 { font-size: 7px; color: #999; text-transform: uppercase; margin-bottom: 3px; }
    .info-block p { font-size: 8px; color: #333; margin-bottom: 1px; }
    .info-block .mono { font-family: 'SF Mono', 'Monaco', monospace; font-size: 7px; }
    .qr-inline { display: flex; align-items: center; gap: 8px; }
    .qr-inline img { width: 45px; height: 45px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 8px; }
    .party h3 { font-size: 7px; color: #999; text-transform: uppercase; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #eee; }
    .party p { font-size: 8px; color: #333; margin-bottom: 1px; }
    .party .name { font-size: 9px; font-weight: 500; color: #111; margin-bottom: 3px; }
    table { width: 100%; margin: 8px 0; }
    table th { font-size: 7px; color: #999; text-transform: uppercase; text-align: left; padding: 4px 0; border-bottom: 1px solid #eee; font-weight: 400; }
    table td { padding: 4px 0; font-size: 8px; border-bottom: 1px solid #f5f5f5; }
    .number { text-align: right; font-family: 'SF Mono', monospace; }
    .totals { display: flex; justify-content: flex-end; margin-top: 6px; }
    .totals-inner { width: 160px; }
    .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 8px; }
    .total-row.final { font-size: 10px; font-weight: 500; padding-top: 6px; margin-top: 4px; border-top: 1px solid #111; }
    .total-row .label { color: #666; }
    .total-row .value { font-family: 'SF Mono', monospace; }
    .sello { margin-top: 8px; padding: 6px; background: #fafafa; border-left: 2px solid #10b981; }
    .sello p { font-size: 7px; color: #666; }
    .sello code { font-size: 6px; color: #333; display: block; margin-top: 2px; word-break: break-all; }
    .footer { margin-top: 8px; font-size: 7px; color: #999; }
    @media print { body { padding: 5px; } @page { margin: 5mm; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl && cfg.mostrarLogo ? `<img src="${logoUrl}" alt="Logo" style="max-height:25px;max-width:70px;margin-bottom:4px;" />` : ''}
      <h1>${dte.emisor.nombre}</h1>
      <p class="subtitle">${tipoDocNombre}</p>
    </div>

    <div class="info-row">
      <div class="info-block">
        <h4>Documento</h4>
        <p class="mono">${dte.identificacion.numeroControl}</p>
        <p>${dte.identificacion.fecEmi}</p>
      </div>
      ${cfg.mostrarQR ? `
      <div class="qr-inline">
        <img src="${qrImageUrl}" alt="QR" title="Escanea para verificar" />
        <div class="info-block">
          <h4>Código</h4>
          <p class="mono" style="font-size:9px;">${dte.identificacion.codigoGeneracion.substring(0,18)}...</p>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="divider"></div>

    <div class="parties">
      <div class="party">
        <h3>De</h3>
        <p class="name">${dte.emisor.nombre}</p>
        <p>NIT: ${dte.emisor.nit} | NRC: ${dte.emisor.nrc}</p>
        ${cfg.mostrarDireccion ? `<p>${dte.emisor.direccion?.complemento || ''}</p>` : ''}
        <p>${dte.emisor.correo}</p>
      </div>
      <div class="party">
        <h3>Para</h3>
        <p class="name">${dte.receptor.nombre}</p>
        <p>${dte.receptor.numDocumento || 'Sin documento'}</p>
        ${cfg.mostrarDireccion && dte.receptor.direccion ? `<p>${dte.receptor.direccion.complemento}</p>` : ''}
        <p>${dte.receptor.correo}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:50px;">Cant.</th>
          <th>Descripción</th>
          <th style="width:80px;text-align:right;">Precio</th>
          <th style="width:80px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${dte.cuerpoDocumento.map(item => `
        <tr>
          <td>${item.cantidad}</td>
          <td>${item.descripcion}</td>
          <td class="number">$${item.precioUni.toFixed(2)}</td>
          <td class="number">$${(item.ventaGravada || 0).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-inner">
        <div class="total-row"><span class="label">Subtotal</span><span class="value">$${dte.resumen.subTotalVentas.toFixed(2)}</span></div>
        ${dte.identificacion.tipoDte !== '01' ? `<div class="total-row"><span class="label">IVA 13%</span><span class="value">$${dte.resumen.tributos?.[0]?.valor?.toFixed(2) || '0.00'}</span></div>` : ''}
        <div class="total-row final"><span class="label">Total</span><span class="value">$${dte.resumen.totalPagar.toFixed(2)}</span></div>
      </div>
    </div>

    ${cfg.mostrarSello && resultado?.selloRecepcion ? `
    <div class="sello">
      <p>✓ Validado por Hacienda</p>
      <code>${resultado.selloRecepcion}</code>
    </div>
    ` : ''}

    <div class="footer">
      <p>Documento Tributario Electrónico</p>
    </div>
  </div>
</body>
</html>`;
};

// ============================================
// PLANTILLA EJECUTIVA - Corporativo premium
// ============================================
const generarPlantillaEjecutiva = (dte: DTEJSON, resultado?: TransmisionResult, config?: Partial<TemplateConfig['campos']>, logoUrl?: string, ambiente: '00' | '01' = '00'): string => {
  const tipoDocNombre = getTipoDocumentoNombre(dte.identificacion.tipoDte);
  const urlConsulta = generarUrlConsultaMH(dte, ambiente);
  const qrImageUrl = getQRImageUrl(urlConsulta, 100);
  const cfg = { ...PLANTILLAS[3].campos, ...config };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>DTE - ${dte.identificacion.numeroControl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 8px; line-height: 1.2; color: #1a1a2e; background: #fff; padding: 8px; }
    .container { max-width: 800px; margin: 0 auto; background: white; }
    .header-band { height: 4px; background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 50%, #7c3aed 100%); }
    .header { padding: 8px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e5e5; }
    .header-left h1 { font-size: 12px; font-weight: 400; color: #1a1a2e; margin-bottom: 2px; }
    .header-left .tagline { font-size: 7px; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; font-family: 'Helvetica', sans-serif; }
    .header-right { text-align: right; }
    .header-right .badge { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 3px 8px; font-size: 7px; font-weight: 600; font-family: 'Helvetica', sans-serif; text-transform: uppercase; display: inline-block; margin-bottom: 3px; }
    .header-right .doc-num { font-size: 7px; color: #666; font-family: 'Helvetica', sans-serif; }
    .content { padding: 8px; }
    .meta-bar { display: flex; gap: 10px; padding: 6px; background: #faf5ff; border-radius: 4px; margin-bottom: 8px; align-items: center; }
    .qr-wrap img { width: 45px; height: 45px; border: 1px solid white; }
    .meta-item { font-family: 'Helvetica', sans-serif; }
    .meta-item label { display: block; font-size: 6px; color: #7c3aed; text-transform: uppercase; margin-bottom: 1px; }
    .meta-item span { font-size: 7px; color: #1a1a2e; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .party { padding: 6px; border: 1px solid #e5e5e5; border-radius: 4px; position: relative; }
    .party::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 4px 4px 0 0; }
    .party h3 { font-size: 7px; color: #7c3aed; text-transform: uppercase; margin-bottom: 4px; font-family: 'Helvetica', sans-serif; font-weight: 600; }
    .party .name { font-size: 9px; font-weight: 400; color: #1a1a2e; margin-bottom: 3px; }
    .party .detail { font-size: 7px; color: #666; margin-bottom: 1px; font-family: 'Helvetica', sans-serif; }
    .party .detail strong { color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table th { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 4px 3px; font-size: 6px; font-weight: 600; text-transform: uppercase; font-family: 'Helvetica', sans-serif; }
    table th:first-child { border-radius: 4px 0 0 0; }
    table th:last-child { border-radius: 0 4px 0 0; }
    table td { padding: 4px 3px; font-size: 7px; border-bottom: 1px solid #f0f0f0; font-family: 'Helvetica', sans-serif; }
    .number { text-align: right; font-family: 'SF Mono', 'Consolas', monospace; }
    .center { text-align: center; }
    .summary { display: flex; justify-content: flex-end; }
    .summary-box { width: 180px; border: 1px solid #7c3aed; border-radius: 4px; overflow: hidden; }
    .summary-row { display: flex; justify-content: space-between; padding: 3px 6px; font-size: 7px; font-family: 'Helvetica', sans-serif; border-bottom: 1px solid #f0f0f0; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row .label { color: #666; }
    .summary-row .value { font-family: 'SF Mono', monospace; font-weight: 500; }
    .summary-row.total { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; font-size: 9px; }
    .summary-row.total .label, .summary-row.total .value { color: white; font-weight: 600; }
    .validation { margin-top: 6px; padding: 6px; background: #ecfdf5; border-radius: 4px; border-left: 2px solid #10b981; }
    .validation h4 { color: #047857; font-size: 7px; margin-bottom: 3px; font-family: 'Helvetica', sans-serif; }
    .validation code { font-size: 5px; color: #065f46; background: white; padding: 3px; border-radius: 2px; display: block; word-break: break-all; }
    .footer { padding: 6px; background: #1a1a2e; color: #a0a0a0; font-size: 6px; text-align: center; font-family: 'Helvetica', sans-serif; }
    .footer a { color: #a78bfa; text-decoration: none; }
    @media print { body { padding: 5px; } @page { margin: 5mm; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-band"></div>
    <div class="header">
      <div class="header-left">
        ${logoUrl && cfg.mostrarLogo ? `<img src="${logoUrl}" alt="Logo" style="max-height:25px;max-width:70px;margin-bottom:3px;" />` : ''}
        <h1>${dte.emisor.nombreComercial || dte.emisor.nombre}</h1>
        <p class="tagline">Documento Tributario Electrónico</p>
      </div>
      <div class="header-right">
        <div class="badge">${tipoDocNombre}</div>
        <p class="doc-num">${dte.identificacion.numeroControl}</p>
        <p class="doc-num">${dte.identificacion.fecEmi} | ${dte.identificacion.horEmi}</p>
      </div>
    </div>

    <div class="content">
      <div class="meta-bar">
        ${cfg.mostrarQR ? `
        <div class="qr-wrap">
          <img src="${qrImageUrl}" alt="QR" title="Escanea para verificar" />
        </div>
        ` : ''}
        <div class="meta-item">
          <label>Código de Generación</label>
          <span style="font-family:monospace;font-size:9px;">${dte.identificacion.codigoGeneracion}</span>
        </div>
        <div class="meta-item">
          <label>Ambiente</label>
          <span>${dte.identificacion.ambiente === '00' ? 'Pruebas' : 'Producción'}</span>
        </div>
        <div class="meta-item">
          <label>Modelo</label>
          <span>Previo</span>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>Emisor</h3>
          <p class="name">${dte.emisor.nombre}</p>
          <p class="detail"><strong>NIT:</strong> ${dte.emisor.nit} | <strong>NRC:</strong> ${dte.emisor.nrc}</p>
          ${cfg.mostrarActividad ? `<p class="detail"><strong>Actividad:</strong> ${dte.emisor.descActividad || '—'}</p>` : ''}
          ${cfg.mostrarDireccion ? `<p class="detail">${dte.emisor.direccion?.complemento || ''}</p>` : ''}
          ${cfg.mostrarTelefono ? `<p class="detail"><strong>Tel:</strong> ${dte.emisor.telefono || '—'} | <strong>Email:</strong> ${dte.emisor.correo}</p>` : `<p class="detail"><strong>Email:</strong> ${dte.emisor.correo}</p>`}
        </div>
        <div class="party">
          <h3>Receptor</h3>
          <p class="name">${dte.receptor.nombre}</p>
          <p class="detail"><strong>Documento:</strong> ${dte.receptor.numDocumento || '—'}${dte.receptor.nrc ? ` | <strong>NRC:</strong> ${dte.receptor.nrc}` : ''}</p>
          ${cfg.mostrarActividad && dte.receptor.descActividad ? `<p class="detail"><strong>Actividad:</strong> ${dte.receptor.descActividad}</p>` : ''}
          ${cfg.mostrarDireccion && dte.receptor.direccion ? `<p class="detail">${dte.receptor.direccion.complemento}</p>` : ''}
          <p class="detail"><strong>Email:</strong> ${dte.receptor.correo}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:35px;">#</th>
            <th style="width:55px;">Cantidad</th>
            <th>Descripción del Producto/Servicio</th>
            <th style="width:80px;">P. Unitario</th>
            <th style="width:70px;">Descuento</th>
            <th style="width:85px;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${dte.cuerpoDocumento.map(item => `
          <tr>
            <td class="center">${item.numItem}</td>
            <td class="number">${item.cantidad.toFixed(2)}</td>
            <td>${item.descripcion}</td>
            <td class="number">$${item.precioUni.toFixed(2)}</td>
            <td class="number">$${(item.montoDescu || 0).toFixed(2)}</td>
            <td class="number"><strong>$${(item.ventaGravada || 0).toFixed(2)}</strong></td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-box">
          <div class="summary-row"><span class="label">Subtotal Ventas</span><span class="value">$${dte.resumen.subTotalVentas.toFixed(2)}</span></div>
          <div class="summary-row"><span class="label">IVA (13%)</span><span class="value">$${dte.resumen.tributos?.[0]?.valor?.toFixed(2) || '0.00'}</span></div>
          <div class="summary-row"><span class="label">Subtotal</span><span class="value">$${dte.resumen.subTotal.toFixed(2)}</span></div>
          ${dte.resumen.ivaRete1 ? `<div class="summary-row"><span class="label">IVA Retenido</span><span class="value">-$${dte.resumen.ivaRete1.toFixed(2)}</span></div>` : ''}
          <div class="summary-row total"><span class="label">TOTAL A PAGAR</span><span class="value">$${dte.resumen.totalPagar.toFixed(2)}</span></div>
        </div>
      </div>

      ${cfg.mostrarSello && resultado?.selloRecepcion ? `
      <div class="validation">
        <h4>✓ Documento Validado por el Ministerio de Hacienda</h4>
        <code>${resultado.selloRecepcion}</code>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Este documento es una representación impresa de un Documento Tributario Electrónico (DTE)</p>
      ${cfg.mostrarEnlaceConsulta ? `<p>Verifique la autenticidad en <a href="https://consultadte.mh.gob.sv">consultadte.mh.gob.sv</a></p>` : ''}
    </div>
  </div>
</body>
</html>`;
};

// ============================================
// FUNCIÓN PRINCIPAL - Generar HTML según plantilla
// ============================================
export const generarHTMLConPlantilla = (options: GenerarHTMLOptions): string => {
  const { dte, resultado, plantilla, config, logoUrl, ambiente = '00' } = options;

  switch (plantilla) {
    case 'clasica':
      return generarPlantillaClasica(dte, resultado, config, logoUrl, ambiente);
    case 'moderna':
      return generarPlantillaModerna(dte, resultado, config, logoUrl, ambiente);
    case 'minimalista':
      return generarPlantillaMinimalista(dte, resultado, config, logoUrl, ambiente);
    case 'ejecutiva':
      return generarPlantillaEjecutiva(dte, resultado, config, logoUrl, ambiente);
    default:
      return generarPlantillaClasica(dte, resultado, config, logoUrl, ambiente);
  }
};

// Descargar PDF con plantilla seleccionada
export const descargarPDFConPlantilla = (options: GenerarHTMLOptions): void => {
  const html = generarHTMLConPlantilla(options);
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
};

// Previsualizar plantilla (sin imprimir)
export const previsualizarPlantilla = (options: GenerarHTMLOptions): void => {
  const html = generarHTMLConPlantilla(options);
  
  const previewWindow = window.open('', '_blank');
  if (previewWindow) {
    previewWindow.document.write(html);
    previewWindow.document.close();
  }
};
