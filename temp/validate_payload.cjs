const fs = require('fs');
const Ajv = require('ajv');

const schemaStr = fs.readFileSync('temp/svfe-json-schemas/fe-fc-v1.json', 'utf8');
const schema = JSON.parse(schemaStr);

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const payload = {
  "identificacion": {
    "version": 1,
    "ambiente": "00",
    "tipoDte": "01",
    "numeroControl": "DTE-01-M001P001-001774973986384",
    "codigoGeneracion": "7EF1330E-AFA4-4E72-BEBB-8D5654800DF3",
    "tipoModelo": 1,
    "tipoOperacion": 1,
    "tipoContingencia": null,
    "motivoContin": null,
    "fecEmi": "2026-03-31",
    "horEmi": "10:19:46",
    "tipoMoneda": "USD"
  },
  "documentoRelacionado": null,
  "emisor": {
    "nit": "14012805761025",
    "nrc": "1571266",
    "nombre": "Rogelio Guerrero",
    "codActividad": "96092",
    "descActividad": "Servicios n.c.p.",
    "nombreComercial": "n/a",
    "tipoEstablecimiento": "01",
    "codEstable": "0001",
    "codPuntoVenta": "0001",
    "direccion": {
      "departamento": "06",
      "municipio": "15",
      "complemento": "kalalal"
    },
    "telefono": "79293710",
    "correo": "guerrero_vi@yahoo.com",
    "codEstableMH": null,
    "codPuntoVentaMH": null
  },
  "receptor": {
    "tipoDocumento": null,
    "numDocumento": null,
    "nrc": null,
    "nombre": "Consumidor Final",
    "nombreComercial": null,
    "codActividad": null,
    "descActividad": null,
    "direccion": {
      "departamento": "06",
      "municipio": "15",
      "complemento": "Consumidor final"
    },
    "telefono": null,
    "correo": "guerrero_vi@yahoo.com"
  },
  "otrosDocumentos": null,
  "ventaTercero": null,
  "cuerpoDocumento": [
    {
      "numItem": 1,
      "tipoItem": 2,
      "cantidad": 1,
      "codigo": null,
      "uniMedida": 59,
      "descripcion": "Prueba FE01",
      "precioUni": 10,
      "montoDescu": 0,
      "ventaNoSuj": 0,
      "ventaExenta": 0,
      "ventaGravada": 10,
      "tributos": [
        "20"
      ],
      "numeroDocumento": null,
      "codTributo": null,
      "psv": 0,
      "noGravado": 0,
      "ivaItem": 0
    }
  ],
  "resumen": {
    "totalNoSuj": 0,
    "totalExenta": 0,
    "totalGravada": 8.85,
    "subTotalVentas": 8.85,
    "descuNoSuj": 0,
    "descuExenta": 0,
    "descuGravada": 0,
    "porcentajeDescuento": 0,
    "totalDescu": 0,
    "tributos": [
      {
        "codigo": "20",
        "descripcion": "Impuesto al Valor Agregado 13%",
        "valor": 1.15
      }
    ],
    "subTotal": 8.85,
    "ivaPerci1": 0,
    "ivaRete1": 0,
    "reteRenta": 0,
    "montoTotalOperacion": 10,
    "totalNoGravado": 0,
    "totalPagar": 10,
    "totalLetras": "DIEZ DÓLARES CON 00/100 USD",
    "totalIva": 1.15,
    "saldoFavor": 0,
    "condicionOperacion": 1,
    "pagos": [
      {
        "codigo": "01",
        "montoPago": 10,
        "referencia": null,
        "plazo": null,
        "periodo": null
      }
    ],
    "numPagoElectronico": null
  },
  "extension": null,
  "apendice": null
};

const valid = validate(payload);
if (!valid) {
  console.log("Validation errors:");
  console.log(JSON.stringify(validate.errors, null, 2));
} else {
  console.log("Payload is valid against JSON schema!");
}
