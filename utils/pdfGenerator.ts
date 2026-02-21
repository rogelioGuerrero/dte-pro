// Generador de PDF para DTE - Comprobante de Crédito Fiscal
// Basado en el formato oficial del Ministerio de Hacienda de El Salvador

import { DTEJSON, tiposDocumento } from './dteGenerator';
import { TransmisionResult } from './dteSignature';

export interface PDFGeneratorOptions {
  dte: DTEJSON;
  resultado?: TransmisionResult;
  logoUrl?: string;
}

// Generar código QR como data URL (usando API externa)
const generarQRDataUrl = async (texto: string): Promise<string> => {
  try {
    // Usar API de QR gratuita
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(texto)}`;
    return url;
  } catch {
    return '';
  }
};

// Formatear fecha para mostrar
const formatearFecha = (fechaISO: string): string => {
  try {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-SV', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return fechaISO;
  }
};

// Obtener nombre del tipo de documento
const getTipoDocumentoNombre = (codigo: string): string => {
  const tipo = tiposDocumento.find((t) => t.codigo === codigo);
  if (!tipo) return 'DOCUMENTO TRIBUTARIO ELECTRÓNICO';
  return tipo.descripcion.replace(/\s*\(.*?\)\s*/g, ' ').trim().toUpperCase();
};

// Generar HTML del PDF
export const generarHTMLFactura = async (options: PDFGeneratorOptions): Promise<string> => {
  const { dte, resultado } = options;
  
  const tipoDocNombre = getTipoDocumentoNombre(dte.identificacion.tipoDte);
  const qrData = resultado?.enlaceConsulta || 
    `https://consultadte.mh.gob.sv/consulta/${dte.identificacion.codigoGeneracion}?ambiente=${dte.identificacion.ambiente}&fechaEmi=${dte.identificacion.fecEmi}`;
  const qrUrl = await generarQRDataUrl(qrData);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DTE - ${dte.identificacion.numeroControl}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #000;
      padding: 15px;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ccc;
    }
    .header .version {
      text-align: right;
      font-size: 10px;
      color: #666;
    }
    .header h1 {
      font-size: 14px;
      font-weight: bold;
      margin: 5px 0;
    }
    .header h2 {
      font-size: 12px;
      font-weight: bold;
      margin: 3px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
    }
    .info-section {
      flex: 1;
      padding: 10px;
      border: 1px solid #ccc;
      margin: 0 5px;
    }
    .info-section:first-child {
      margin-left: 0;
    }
    .info-section:last-child {
      margin-right: 0;
    }
    .info-section h3 {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
      text-align: center;
    }
    .info-section .field {
      display: flex;
      margin-bottom: 4px;
    }
    .info-section .field .label {
      font-weight: bold;
      min-width: 120px;
      color: #333;
    }
    .info-section .field .value {
      flex: 1;
    }
    .qr-section {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      margin-bottom: 15px;
    }
    .qr-code {
      width: 100px;
      height: 100px;
    }
    .qr-info {
      flex: 1;
    }
    .qr-info .field {
      display: flex;
      margin-bottom: 3px;
    }
    .qr-info .field .label {
      font-weight: bold;
      min-width: 180px;
    }
    .modelo-info {
      text-align: right;
    }
    .modelo-info .field {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 3px;
    }
    .modelo-info .field .label {
      font-weight: bold;
      margin-right: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    table th, table td {
      border: 1px solid #ccc;
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
    }
    table th {
      background: #f5f5f5;
      font-weight: bold;
      text-align: center;
    }
    table td.number {
      text-align: right;
      font-family: 'Courier New', monospace;
    }
    table td.center {
      text-align: center;
    }
    .totals {
      margin-top: 15px;
    }
    .totals table {
      width: 50%;
      margin-left: auto;
    }
    .totals table td {
      padding: 4px 8px;
    }
    .totals table td:first-child {
      text-align: right;
      font-weight: bold;
    }
    .totals table td:last-child {
      text-align: right;
      font-family: 'Courier New', monospace;
    }
    .totals table tr.total-final {
      background: #f0f0f0;
      font-weight: bold;
    }
    .totals table tr.total-final td {
      font-size: 12px;
    }
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 9px;
      color: #666;
      text-align: center;
    }
    .sello-section {
      background: #e8f5e9;
      border: 1px solid #4caf50;
      padding: 10px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .sello-section h4 {
      color: #2e7d32;
      margin-bottom: 5px;
    }
    .sello-section code {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      word-break: break-all;
    }
    @media print {
      body {
        padding: 0;
      }
      .container {
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="version">Ver.${dte.identificacion.version}</div>
      <h1>DOCUMENTO TRIBUTARIO ELECTRÓNICO</h1>
      <h2>${tipoDocNombre}</h2>
    </div>

    <div class="qr-section">
      <img src="${qrUrl}" alt="QR Code" class="qr-code" />
      <div class="qr-info">
        <div class="field">
          <span class="label">Código de Generación:</span>
          <span class="value">${dte.identificacion.codigoGeneracion}</span>
        </div>
        <div class="field">
          <span class="label">Número de Control:</span>
          <span class="value">${dte.identificacion.numeroControl}</span>
        </div>
        ${resultado?.selloRecepcion ? `
        <div class="field">
          <span class="label">Sello de Recepción:</span>
          <span class="value" style="font-size: 9px;">${resultado.selloRecepcion}</span>
        </div>
        ` : ''}
      </div>
      <div class="modelo-info">
        <div class="field">
          <span class="label">Modelo de Facturación:</span>
          <span class="value">Previo</span>
        </div>
        <div class="field">
          <span class="label">Tipo de Transmisión:</span>
          <span class="value">Normal</span>
        </div>
        <div class="field">
          <span class="label">Fecha y Hora de Generación:</span>
          <span class="value">${dte.identificacion.fecEmi} ${dte.identificacion.horEmi}</span>
        </div>
      </div>
    </div>

    <div class="info-row">
      <div class="info-section">
        <h3>EMISOR</h3>
        <div class="field">
          <span class="label">Nombre o razón social:</span>
          <span class="value">${dte.emisor.nombre}</span>
        </div>
        <div class="field">
          <span class="label">NIT:</span>
          <span class="value">${dte.emisor.nit}</span>
        </div>
        <div class="field">
          <span class="label">NRC:</span>
          <span class="value">${dte.emisor.nrc}</span>
        </div>
        <div class="field">
          <span class="label">Actividad económica:</span>
          <span class="value">${dte.emisor.descActividad || '—'}</span>
        </div>
        <div class="field">
          <span class="label">Dirección:</span>
          <span class="value">${dte.emisor.direccion?.complemento || '—'}</span>
        </div>
        <div class="field">
          <span class="label">Número de teléfono:</span>
          <span class="value">${dte.emisor.telefono || '—'}</span>
        </div>
        <div class="field">
          <span class="label">Correo electrónico:</span>
          <span class="value">${dte.emisor.correo || '—'}</span>
        </div>
        ${dte.emisor.nombreComercial ? `
        <div class="field">
          <span class="label">Nombre Comercial:</span>
          <span class="value">${dte.emisor.nombreComercial}</span>
        </div>
        ` : ''}
        <div class="field">
          <span class="label">Tipo de establecimiento:</span>
          <span class="value">${dte.emisor.tipoEstablecimiento === '01' ? 'Casa Matriz' : 'Sucursal'}</span>
        </div>
      </div>

      <div class="info-section">
        <h3>RECEPTOR</h3>
        <div class="field">
          <span class="label">Nombre o razón social:</span>
          <span class="value">${dte.receptor.nombre}</span>
        </div>
        <div class="field">
          <span class="label">NIT:</span>
          <span class="value">${dte.receptor.numDocumento || '—'}</span>
        </div>
        ${dte.receptor.nrc ? `
        <div class="field">
          <span class="label">NRC:</span>
          <span class="value">${dte.receptor.nrc}</span>
        </div>
        ` : ''}
        <div class="field">
          <span class="label">Actividad económica:</span>
          <span class="value">${dte.receptor.descActividad || '—'}</span>
        </div>
        <div class="field">
          <span class="label">Dirección:</span>
          <span class="value">${dte.receptor.direccion?.complemento || '—'}</span>
        </div>
        <div class="field">
          <span class="label">Número de teléfono:</span>
          <span class="value">${dte.receptor.telefono || '—'}</span>
        </div>
        <div class="field">
          <span class="label">Correo electrónico:</span>
          <span class="value">${dte.receptor.correo || '—'}</span>
        </div>
              </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">N°</th>
          <th style="width: 50px;">Cantidad</th>
          <th style="width: 50px;">Unidad</th>
          <th>Descripción</th>
          <th style="width: 70px;">Precio Unitario</th>
          <th style="width: 60px;">Descuento por ítem</th>
          <th style="width: 70px;">Otros montos no afectos</th>
          <th style="width: 60px;">Ventas No Sujetas</th>
          <th style="width: 60px;">Ventas Exentas</th>
          <th style="width: 70px;">Ventas Gravadas</th>
        </tr>
      </thead>
      <tbody>
        ${dte.cuerpoDocumento.map((item) => `
        <tr>
          <td class="center">${item.numItem}</td>
          <td class="number">${item.cantidad.toFixed(2)}</td>
          <td class="center">${item.uniMedida === 99 ? 'Unidad' : item.uniMedida}</td>
          <td>${item.descripcion}</td>
          <td class="number">${item.precioUni.toFixed(2)}</td>
          <td class="number">${(item.montoDescu || 0).toFixed(2)}</td>
          <td class="number">0.00</td>
          <td class="number">${(item.ventaNoSuj || 0).toFixed(2)}</td>
          <td class="number">${(item.ventaExenta || 0).toFixed(2)}</td>
          <td class="number">${(item.ventaGravada || 0).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Suma de Ventas:</td>
          <td>${dte.resumen.subTotalVentas.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Suma Total de Operaciones:</td>
          <td>${dte.resumen.subTotalVentas.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Monto global Desc., Rebajas y otros a ventas no sujetas:</td>
          <td>${(dte.resumen.descuNoSuj || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Monto global Desc., Rebajas y otros a ventas Exentas:</td>
          <td>${(dte.resumen.descuExenta || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Monto global Desc., Rebajas y otros a ventas gravadas:</td>
          <td>${(dte.resumen.descuGravada || 0).toFixed(2)}</td>
        </tr>
        ${dte.identificacion.tipoDte !== '01' ? `
        <tr>
          <td>Impuesto al Valor Agregado 13%:</td>
          <td>${dte.resumen.tributos?.[0]?.valor?.toFixed(2) || '0.00'}</td>
        </tr>
        ` : ''}
        <tr>
          <td>Sub-Total:</td>
          <td>${dte.resumen.subTotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td>IVA Percibido:</td>
          <td>0.00</td>
        </tr>
        <tr>
          <td>IVA Retenido:</td>
          <td>${(dte.resumen.ivaRete1 || 0).toFixed(2)}</td>
        </tr>
        <tr class="total-final">
          <td>Monto Total de la Operación:</td>
          <td>${dte.resumen.totalPagar.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    ${resultado?.selloRecepcion ? `
    <div class="sello-section">
      <h4>✓ Documento Validado por el Ministerio de Hacienda</h4>
      <p><strong>Sello de Recepción:</strong></p>
      <code>${resultado.selloRecepcion}</code>
      <p style="margin-top: 5px;"><strong>Fecha de Procesamiento:</strong> ${resultado.fechaHoraProcesamiento ? formatearFecha(resultado.fechaHoraProcesamiento) : '—'}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Este documento es una representación impresa de un Documento Tributario Electrónico (DTE)</p>
      <p>Puede verificar su autenticidad en: https://consultadte.mh.gob.sv</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
};

// Generar y descargar PDF
export const descargarPDF = async (options: PDFGeneratorOptions): Promise<void> => {
  const html = await generarHTMLFactura(options);
  
  // Crear una nueva ventana para imprimir/guardar como PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Esperar a que cargue el QR y luego imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
};

// Descargar como HTML (alternativa si no funciona print)
export const descargarHTML = async (options: PDFGeneratorOptions): Promise<void> => {
  const html = await generarHTMLFactura(options);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DTE-${options.dte.identificacion.codigoGeneracion}.html`;
  a.click();
  URL.revokeObjectURL(url);
};
