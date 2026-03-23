---
auto_execution_mode: 3
description: Complete Stitch Import Workflow - Raw Import → AST
---
# Complete Stitch Import Workflow

**Skill Name:** `stitch-import-complete`

## 🎯 Purpose
Importar pantallas desde Stitch y parsear a AST para que el LLM las incorpore al proyecto.

## 📋 Usage
```
/import-stitch [project-id]
```

## 🚀 Complete Workflow:

### Step 1: Raw Import (Node 1)
**Skill:** `stitch-raw-import`

1. **Connect to Stitch MCP** - Obtiene proyecto y pantallas
2. **Download raw HTML** - Guarda HTML sin procesar
3. **Download screenshots** - Guarda imágenes PNG
4. **Save metadata** - Guarda JSON con detalles
5. **Organize in folders** - Estructura limpia

**Output:** `stitch-import/screens/*.html`

### Step 2: HTML Parser (Node 2)
**Skill:** `html-parser`

1. **Read HTML files** - Lee HTML crudo
2. **Parse to AST** - Convierte a estructura de árbol
3. **Extract elements** - Identifica formularios, botones, textos
4. **Generate structured JSON** - Crea AST por pantalla
5. **Save parsed data** - Guarda en `stitch-import/parsed/`

**Output:** `stitch-import/parsed/*.ast.json`

## 🤖 Next Step: LLM Integration
El LLM de turno debe leer los AST y decidir cómo incorporarlos al proyecto existente.

**Carpeta que debe leer el LLM:**
```
stitch-import/parsed/
```

**Contenido para analizar:**
- `*.ast.json` - Estructura de componentes
- `*.elements.json` - Elementos extraídos
- `../screens.json` - Metadata de pantallas

## 📁 Complete Output Structure:
```
stitch-import/
├── project.json          # Project metadata
├── screens.json          # Screens list
├── screens/
│   ├── [screen-id].html  # Raw HTML
│   ├── [screen-id].png   # Screenshot
│   └── [screen-id].json  # Screen metadata
├── parsed/
│   ├── [screen-id].ast.json        # ← LLM lee estos archivos
│   ├── [screen-id].elements.json   # ← LLM lee estos archivos
│   └── parsed-summary.json         # ← LLM lee este resumen
└── config.json          # Import configuration
```

## ⚙️ Technical Details:
- **Step 1:** Uses MCP functions `mcp4_get_project`, `mcp4_list_screens`, `mcp4_get_screen`
- **Step 2:** HTML parsing with regex/DOM, element extraction
- **LLM Integration:** El LLM analiza `stitch-import/parsed/` y genera componentes según el stack existente
- **Framework agnostic:** AST es neutral, el LLM adapta al proyecto

## ⚠️ PowerShell Note:
**NO usar `&&` en PowerShell** - Ejecutar comandos en líneas separadas o usar `;` como separador.