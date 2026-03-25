---
description: Limpieza de código muerto con Knip, ESLint y Depcheck para proyectos React + TypeScript + Tailwind/shadcn
auto_execution_mode: 3
---

# Workflow de limpieza de código muerto

Este flujo ayuda a detectar y eliminar archivos huérfanos, imports/variables sin uso y dependencias que ya no aportan valor.

## Cuándo usarlo

- Después de una refactorización grande.
- Antes de cerrar una entrega importante.
- Cuando el proyecto tiene demasiados archivos legacy o componentes duplicados.
- Cuando sospechas que hay dependencias instaladas que ya no se usan.

## Alcance recomendado

- React + TypeScript.
- Vite, Next.js u otros setups modernos.
- Tailwind CSS.
- shadcn/ui.
- Proyectos con alias como `@/`.

## Regla principal

Haz primero un análisis y revisa falsos positivos antes de borrar nada. Knip, ESLint y Depcheck son guías; no sustituyen la validación humana.

## Preparación

1. Asegúrate de estar en una rama dedicada.
2. Confirma que el repositorio está limpio o guarda un commit base.
3. Ejecuta build y typecheck antes de limpiar para tener una línea base.

## Herramientas

Si no están instaladas, agrega estas dependencias de desarrollo:

```bash
npm i -D knip depcheck eslint
```

Si el proyecto usa reglas para imports no utilizados, añade también el plugin que corresponda a tu configuración actual de ESLint.

## Orden de ejecución

### 1) Knip: detectar archivos, exports y configuración huérfanos

```bash
npx knip
```

Usa el reporte para revisar:

- archivos sin uso,
- exports no consumidos,
- configuraciones huérfanas,
- dependencias no listadas o no utilizadas.

Si la versión instalada soporta auto-fix para tu caso, puedes probar:

```bash
npx knip --fix
```

Después, elimina manualmente los archivos y configuraciones que Knip marque como huérfanos y que sí sean seguros de borrar.

### 2) ESLint: limpiar imports y variables dentro de archivos vivos

```bash
npx eslint . --ext .ts,.tsx,.js,.jsx --fix
```

Si el repositorio usa flat config o rutas distintas, adapta el comando al archivo de configuración existente.

Objetivo de esta fase:

- eliminar imports sin uso,
- eliminar variables sin uso,
- corregir pequeñas inconsistencias de estilo en archivos que sí permanecen.

### 3) Depcheck: encontrar dependencias instaladas que ya no se usan

```bash
npx depcheck
```

Revisa con especial cuidado los falsos positivos comunes:

- imports dinámicos,
- configuraciones de Tailwind,
- archivos de shadcn/ui,
- rutas alias,
- dependencias usadas solo en scripts o tooling.

Si una dependencia realmente ya no se usa, desinstálala con el package manager del proyecto.

### 4) Verificación final

```bash
npm run typecheck
npm run build
```

Si el proyecto tiene tests o lint script, ejecútalos también.

## Recomendaciones específicas para shadcn/ui y Tailwind

- No borres `components.json` sin confirmar que el proyecto ya no usa shadcn.
- Revisa con cuidado `tailwind.config.*`, `postcss.config.*`, `vite.config.*` y `tsconfig.json`.
- Mantén los componentes de `components/ui` si siguen siendo usados de forma indirecta.
- Muchas utilidades como `clsx`, `tailwind-merge` y `class-variance-authority` pueden parecer redundantes si no detectas sus usos transversales; verifica antes de eliminar.

## Checklist de limpieza

- [ ] Knip revisado.
- [ ] Archivos huérfanos eliminados.
- [ ] ESLint ejecutado con `--fix`.
- [ ] Variables e imports sin uso eliminados.
- [ ] Depcheck revisado.
- [ ] Dependencias innecesarias desinstaladas.
- [ ] `typecheck` pasa.
- [ ] `build` pasa.
- [ ] Commit final realizado.

## Plantilla rápida

```bash
npx knip && npx eslint . --ext .ts,.tsx,.js,.jsx --fix && npx depcheck && npm run typecheck && npm run build
```

## Nota

Este workflow está pensado para reutilizarse en cualquier proyecto moderno basado en React, TypeScript, Tailwind CSS y shadcn/ui. Ajusta los comandos al package manager y al sistema de configuración de cada repositorio.
