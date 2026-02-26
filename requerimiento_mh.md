# Consulta a Ministerio de Hacienda - Soporte API DTE

**Asunto:** Consulta sobre estructura y validación de JSON para Factura Electrónica (01) - Valores en cero y Tributos.

**Contexto:**
Estamos desarrollando la integración para Factura Electrónica (01) y nos enfrentamos a rechazos de validación relacionados con los valores del `cuerpoDocumento`, específicamente cuando hay ítems con precios en cero o cuando hay discrepancias percibidas por el validador en los tributos.

**Ejemplo del problema (fragmento del JSON rechazado):**
```json
{
  "numItem": 1,
  "tipoItem": 2,
  "cantidad": 1,
  "descripcion": "limpi",
  "precioUni": 0,
  "montoDescu": 0,
  "ventaNoSuj": 0,
  "ventaExenta": 0,
  "ventaGravada": 0,
  "tributos": ["20"],
  "ivaItem": 0
}
```

**Consultas Técnicas Específicas:**

1. **Ítems con Precio o Valor Cero:**
   - Si requerimos enviar un ítem con `precioUni: 0.00` (por ejemplo: promociones, regalos, o líneas meramente descriptivas), ¿es permitido por el esquema?
   - De ser permitido, ¿cómo deben ir los campos `ventaGravada`, `ivaItem` y `tributos`? ¿Debe ir `tributos: null` en lugar de `["20"]` dado que no hay monto gravado?

2. **Validación del campo `tributos`:**
   - Si declaramos `tributos: ["20"]` en un ítem, ¿el validador exige estrictamente que `ventaGravada` sea mayor a `0`?
   - Para un documento tipo 01 (Factura Electrónica), donde el receptor es Consumidor Final, ¿es obligatorio que todos los ítems no exentos lleven el array `tributos: ["20"]`, o se asume implícito al ser tipo 01 y se puede omitir?

3. **Cálculo Exacto (Base vs IVA):**
   - En Factura Electrónica (01), el precio ya tiene el IVA incluido. Sabemos que el resumen debe cuadrar. ¿El validador extrae el IVA de cada línea (ej. `precioUni / 1.13`) para cuadrar con el resumen, o simplemente suma las `ventaGravada` de las líneas y a ese total global le extrae el IVA para propósitos informativos en el XML/PDF impreso?

4. **Estructura mínima garantizada:**
   - ¿Podrían proporcionarnos un ejemplo oficial (payload JSON mínimo) de una Factura Electrónica (01) con 1 ítem gravado y 1 ítem con precio $0.00 (si es permitido), para alinear nuestra estructura exactamente a sus reglas de validación?

Agradecemos de antemano su orientación técnica para corregir la estructura de nuestro JSON.
