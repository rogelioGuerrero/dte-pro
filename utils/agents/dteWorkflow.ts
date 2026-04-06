import { StateGraph, END } from "@langchain/langgraph";
import { DTEState } from "./state";
import { convertirAContingencia } from "../dteGenerator";
import { updateTaxAccumulator, createEmptyAccumulator, getPeriodFromDate } from "../tax/taxCalculator";
import { getAccumulator, saveAccumulator } from "../tax/taxStorage";
import { firmarDocumento, limpiarDteParaFirma, transmitirDocumento, wakeFirmaService } from "../dteApiClient";
import { processDTE } from "../mh/process";
import { TransmisionResult } from "../dteSignature";

// --- NODES ---

// 1. Validator Node ("Agente Validador")
const validateNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🕵️ Agente Validador: Revisando estructura y reglas de negocio...");
  
  const dte = state.dte;
  if (!dte) {
    return { isValid: false, validationErrors: ["No se proporcionó un objeto DTE"], status: 'failed' };
  }

  // Usar el validador real del sistema
  const processed = processDTE(dte);
  
  if (processed.errores.length > 0) {
    console.warn("❌ Agente Validador: DTE Rechazado", processed.errores);
    return {
      isValid: false,
      validationErrors: processed.errores.map(e => `${e.campo}: ${e.descripcion}`),
      status: 'failed'
    };
  }

  console.log("✅ Agente Validador: DTE Aprobado");
  return {
    isValid: true,
    validationErrors: [],
    status: 'signing'
  };
};

// 2. Signer Node ("Nodo Firmador")
const signNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("✍️ Nodo Firmador: Solicitando firma electrónica...");
  
  if (!state.dte) return { status: 'failed' };
  if (!state.passwordPri) {
    return { 
      status: 'failed', 
      validationErrors: ["No se proporcionó contraseña de firma"] 
    };
  }

  try {
    // Asegurar que el servicio de firma esté despierto
    // Render free tier puede tardar 30s+ en despertar, damos 60s
    await wakeFirmaService({ retries: 3, baseDelayMs: 2000, timeoutMs: 60000 });

    const processed = processDTE(state.dte);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);

    // Ejecutar firma real
    const jwsFirmado = await firmarDocumento({
      passwordPri: state.passwordPri,
      dteJson: dteLimpio,
    });

    console.log("✅ Firma exitosa");
    return {
      isSigned: true,
      signature: jwsFirmado,
      status: 'transmitting'
    };
  } catch (error: any) {
    console.error("❌ Error de firma:", error);
    return {
      status: 'failed',
      validationErrors: [`Error al firmar: ${error.message || 'Desconocido'}`]
    };
  }
};

// 3. Transmitter Node ("Transmisor Inteligente")
const transmitNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📡 Transmisor: Enviando a Ministerio de Hacienda...");
  
  if (!state.dte || !state.passwordPri) return { status: 'failed', validationErrors: ["Faltan datos para transmitir"] };

  try {
    const ambiente = state.ambiente || '00';
    const processed = processDTE(state.dte);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    
    const backendResponse = await transmitirDocumento({
      dte: dteLimpio,
      passwordPri: state.passwordPri,
      ambiente,
    });

    const mh = backendResponse.mhResponse;
    const result: TransmisionResult = backendResponse.isOffline
      ? {
          success: false,
          estado: 'CONTINGENCIA',
          codigoGeneracion: mh?.codigoGeneracion || processed.dte.identificacion.codigoGeneracion,
          numeroControl: mh?.numeroControl || processed.dte.identificacion.numeroControl,
          fechaHoraRecepcion: mh?.fechaHoraRecepcion || new Date().toISOString(),
          fechaHoraProcesamiento: mh?.fechaHoraProcesamiento,
          mensaje: backendResponse.contingencyReason || mh?.mensaje || 'Documento enviado a contingencia',
          advertencias: mh?.advertencias,
          errores: mh?.errores?.map(e => ({
            codigo: e.codigo,
            campo: e.campo,
            descripcion: e.descripcion,
            severidad: 'ERROR',
            valorActual: e.valorActual,
            valorEsperado: e.valorEsperado,
          })),
          enlaceConsulta: mh?.enlaceConsulta,
        }
      : {
          success: backendResponse.transmitted === true && mh?.success === true,
          estado: mh?.estado || 'RECHAZADO',
          codigoGeneracion: mh?.codigoGeneracion || processed.dte.identificacion.codigoGeneracion,
          selloRecepcion: mh?.selloRecepcion,
          numeroControl: mh?.numeroControl || processed.dte.identificacion.numeroControl,
          fechaHoraRecepcion: mh?.fechaHoraRecepcion,
          fechaHoraProcesamiento: mh?.fechaHoraProcesamiento,
          mensaje: mh?.mensaje,
          advertencias: mh?.advertencias,
          errores: mh?.errores?.map(e => ({
            codigo: e.codigo,
            campo: e.campo,
            descripcion: e.descripcion,
            severidad: 'ERROR',
            valorActual: e.valorActual,
            valorEsperado: e.valorEsperado,
          })),
          enlaceConsulta: mh?.enlaceConsulta,
        };
    
    if (result.success) {
      console.log("✅ MH: Recibido exitosamente.", result.selloRecepcion);
      return {
        isTransmitted: true,
        mhResponse: result,
        status: 'completed'
      };
    } else {
      // Manejo de errores
      console.error("❌ MH Rechazo/Error:", result);
      
      if (backendResponse.isOffline) {
        return {
          status: 'contingency',
          isOffline: true,
          contingencyReason: backendResponse.contingencyReason || 'Falla de comunicación con MH',
          mhResponse: result,
          signature: backendResponse.signature || state.signature,
        };
      }

      // Detectar problemas de conexión o errores 500 para contingencia
      const isCommError = result.errores?.some(e => e.codigo === 'COM-ERR' || e.codigo.startsWith('HTTP-'));
      
      if (isCommError) {
        if (state.retryCount < 2) {
          console.log(`🔄 Error de conexión. Reintentando (${state.retryCount + 1}/3)...`);
          return {
            retryCount: state.retryCount + 1,
            status: 'transmitting' 
          };
        } else {
          console.warn("⚠️ Timeout/Error Conexión. Activando Contingencia.");
          return {
            status: 'contingency',
            isOffline: true,
            contingencyReason: "Falla de comunicación con MH"
          };
        }
      }

      // Errores de validación de MH (no reintentables)
      return {
        status: 'failed',
        validationErrors: result.errores?.map(e => `MH [${e.codigo}]: ${e.descripcion}`) || [result.mensaje || 'Error desconocido MH']
      };
    }
  } catch (error: any) {
    console.error("❌ Error crítico en transmisión:", error);
    return {
      status: 'failed',
      validationErrors: [`Error transmisión: ${error.message}`]
    };
  }
};

// 4. Contingency Node ("Gestor de Contingencia")
const contingencyNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📦 Gestor Contingencia: Transformando a Modelo Diferido...");
  
  if (!state.dte || !state.passwordPri) return { status: 'failed' };

  try {
    // Transformar DTE a Contingencia
    const dteContingencia = convertirAContingencia(state.dte, state.contingencyReason);
    
    // Volver a procesar y firmar el DTE de contingencia
    const processed = processDTE(dteContingencia);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);

    const jwsContingencia = await firmarDocumento({
      passwordPri: state.passwordPri,
      dteJson: dteLimpio,
    });

    console.log("💾 DTE Contingencia firmado y listo.");
    // Aquí se guardaría en cola offline (pendiente implementar persistencia de cola)

    return {
      dte: dteContingencia,
      signature: jwsContingencia,
      isOffline: true,
      status: 'completed', // Marcamos como completado para el usuario (tiene su DTE firmado)
      contingencyReason: state.contingencyReason,
      // Simulamos respuesta exitosa local
      mhResponse: {
        success: false,
        estado: 'CONTINGENCIA',
        mensaje: 'Documento en contingencia',
        fechaHoraRecepcion: new Date().toISOString()
      } as TransmisionResult
    };
  } catch (error: any) {
    return {
      status: 'failed',
      validationErrors: [`Error generando contingencia: ${error.message}`]
    };
  }
};

// 6. Reception Node ("Procesador de Compras")
const receptionNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📥 Procesador de Recepción: Analizando documento recibido...");

  if (!state.dte) {
    // Intentar parsear rawInput si dte es nulo (caso de carga de JSON)
    if (state.rawInput) {
       try {
         // Aquí se podría agregar lógica para decodificar JWS si viene firmado
         // Por ahora asumimos que rawInput es el objeto DTE o un JSON string
         const dte = typeof state.rawInput === 'string' ? JSON.parse(state.rawInput) : state.rawInput;
         return {
           dte,
           isValid: true, // Asumimos válido si viene de otro emisor (o agregar validación firma)
           status: 'completed'
         };
       } catch (e) {
         return { status: 'failed', validationErrors: ["Error parseando JSON recibido"] };
       }
    }
    return { status: 'failed', validationErrors: ["No se proporcionó DTE de compra"] };
  }

  return {
    status: 'completed',
    isValid: true
  };
};

// 5. Tax Keeper Node
const taxNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log(`📊 Contador Autónomo (${state.flowType || 'emission'}): Actualizando libros...`);
  
  if (state.status !== 'completed' || !state.dte) {
    return {};
  }

  try {
    const period = getPeriodFromDate(state.dte.identificacion.fecEmi);
    const existingAcc = await getAccumulator(period);
    const baseAcc = existingAcc || createEmptyAccumulator(period);
    
    // Pasamos el flowType para distinguir si suma a Ventas o Compras
    const updatedAcc = updateTaxAccumulator(baseAcc, state.dte, state.flowType);
    
    await saveAccumulator(updatedAcc);

    console.log(`💰 Impacto Fiscal Guardado: ${state.flowType === 'reception' ? 'Crédito' : 'Débito'} actualizado.`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dte-tax-updated'));
    }

    return {
      taxImpact: updatedAcc
    };
  } catch (error) {
    console.error("❌ Error en Contador Autónomo:", error);
    return {};
  }
};

// --- GRAPH DEFINITION ---
// Casting channels to any to avoid strict type inference issues with LangGraph reducers
const channels: any = {
    dte: { reducer: (x: any, y: any) => y ?? x },
    isValid: { reducer: (x: any, y: any) => y ?? x },
    validationErrors: { reducer: (x: any, y: any) => y ?? x },
    isSigned: { reducer: (x: any, y: any) => y ?? x },
    signature: { reducer: (x: any, y: any) => y ?? x },
    isTransmitted: { reducer: (x: any, y: any) => y ?? x },
    mhResponse: { reducer: (x: any, y: any) => y ?? x },
    isOffline: { reducer: (x: any, y: any) => y ?? x },
    contingencyReason: { reducer: (x: any, y: any) => y ?? x },
    taxImpact: { reducer: (x: any, y: any) => y ?? x },
    status: { reducer: (x: any, y: any) => y ?? x },
    retryCount: { reducer: (x: any, y: any) => y ?? x },
    rawInput: { reducer: (x: any, y: any) => y ?? x },
    passwordPri: { reducer: (x: any, y: any) => y ?? x },
    ambiente: { reducer: (x: any, y: any) => y ?? x },
    flowType: { reducer: (x: any, y: any) => y ?? x }
};

const workflow = new StateGraph<DTEState>({ channels })
  .addNode("validator", validateNode)
  .addNode("signer", signNode)
  .addNode("transmitter", transmitNode)
  .addNode("contingency", contingencyNode)
  .addNode("reception_processor", receptionNode)
  .addNode("tax_keeper", taxNode)

  // Router Inicial
  .addConditionalEdges("__start__", (state: any) => {
    return state.flowType === 'reception' ? "reception_processor" : "validator";
  })

  // Flujo Emisión
  .addConditionalEdges("validator", (state: any) => state.isValid ? "signer" : END)
  .addEdge("signer", "transmitter")
  .addConditionalEdges("transmitter", (state: any) => {
      if (state.status === 'completed') return "tax_keeper";
      if (state.status === 'contingency') return "contingency";
      if (state.status === 'transmitting') return "transmitter"; 
      return END;
  })
  .addEdge("contingency", "tax_keeper")
  
  // Flujo Recepción
  .addEdge("reception_processor", "tax_keeper")
  
  .addEdge("tax_keeper", END);

export const dteGraph = workflow.compile();
