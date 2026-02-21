# Guía de Modos de Usuario - DTE Pro

## 🎯 Concepto

DTE Pro se adapta a diferentes tipos de usuarios mostrando solo las funcionalidades que cada uno necesita.

## 👥 Tipos de Usuario

### 1. Contador 📊
- **Para:** Profesionales que gestionan múltiples clientes
- **Acceso:** Todas las funcionalidades
- **Pestañas visibles:** Libros IVA, Clientes, Productos, Inventario, Facturar, Historial
- **Ideal para:** Generar declaraciones, gestionar libros de IVA, facturación masiva

### 2. Negocio / Tienda 🏪
- **Para:** Dueños de negocios, tiendas, panaderías, restaurantes
- **Acceso:** Solo facturación y gestión básica
- **Pestañas visibles:** Clientes, Productos, Inventario, Facturar, Historial
- **Ideal para:** Vender productos/servicios, controlar stock, facturar

### 3. Independiente 💼
- **Para:** Emprendedores que gestionan todo
- **Acceso:** Todas las funcionalidades
- **Pestañas visibles:** Libros IVA, Clientes, Productos, Inventario, Facturar, Historial
- **Ideal para:** Quienes hacen sus propias declaraciones

## 🚀 Configuración Inicial

La primera vez que se abre la app, aparecerá un asistente para seleccionar el modo:

```
¡Bienvenido a DTE Pro!
¿Qué tipo de usuario eres?
┌─ 1. Contador (gestiono múltiples clientes)
├─ 2. Negocio/Tienda (vendo productos/servicios)
└─ 3. Independiente (gestiono todo yo mismo)
```

## 🔧 Cambiar Modo

### ¿Cómo acceder?
1. Haz clic 5 veces en el logo DTE Pro
2. Ingresa el PIN de administrador (configurado en VITE_ADMIN_PIN)
3. Ve a "Modo de Usuario"
4. Selecciona el nuevo tipo
5. Haz clic en "Recargar para aplicar cambios"

## 📋 Comparación de Funcionalidades

| Funcionalidad | Contador | Negocio | Independiente |
|---------------|----------|---------|---------------|
| **Libros IVA** | ✅ | ❌ | ✅ |
| **Declaraciones** | ✅ | ❌ | ✅ |
| **Facturación** | ✅ | ✅ | ✅ |
| **Inventario** | ✅ | ✅ | ✅ |
| **Clientes** | ✅ | ✅ | ✅ |
| **Productos** | ✅ | ✅ | ✅ |
| **Historial** | ✅ | ✅ | ✅ |

## 💡 Casos de Uso

### Caso 1: Contadora María
- Tiene 20 clientes
- Usa "Modo Contador"
- Genera libros IVA para todos
- Presenta declaraciones mensuales
- No necesita facturar directamente

### Caso 2: Panadería "El Trigo Dorado"
- Vende pan y pasteles
- Usa "Modo Negocio"
- Gestiona inventario de harina, levadura
- Factura a diario
- No ve libros IVA (su contador lo hace)

### Caso 3: Freelancer Carlos
- Diseñador gráfico
- Usa "Modo Independiente"
- Factura sus proyectos
- Genera sus propios libros IVA
- Presenta sus declaraciones

## 🔄 Flujo de Trabajo Típico

### Para Contadores:
1. Reciben JSON de clientes
2. Importan en "Libros IVA"
3. Generan reportes consolidados
4. Exportan para declaración

### Para Negocios:
1. Cargan productos en inventario
2. Facturan ventas diarias
3. Controlan stock
4. Envían JSON a su contador

### Para Independientes:
1. Hacen todo en un solo lugar
2. Facturan y gestionan inventario
3. Generan libros IVA
4. Presentan declaraciones

## ⚙️ Configuración Técnica

El modo de usuario se guarda en:
```javascript
localStorage.setItem('dte_user_mode', 'contador|negocio|independiente');
```

Para resetear el asistente inicial:
```javascript
localStorage.removeItem('dte_setup_completed');
```

## 🎨 Personalización Futura

Posibles mejoras:
- **Modo Empresa:** Para corporaciones con múltiples sucursales
- **Modo Estudiante:** Con datos de prueba para aprendizaje
- **Permisos granulares:** Activar/desactivar features específicas
- **Temas personalizados:** Diferentes colores por modo

## ❓ Preguntas Frecuentes

**¿Puedo cambiar de modo después?**
Sí,随时都可以在Configuración Avanzada中更改。

**¿Mis datos se pierden al cambiar?**
No, solo cambia la interfaz visible.

**¿Un cliente puede usar la app sin contador?**
Sí, modo "Independiente" le da acceso a todo.

**¿Cómo sé qué modo necesito?**
- Si solo facturas → Negocio
- Si gestionas clientes → Contador
- Si haces todo → Independiente
