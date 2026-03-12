---
description: Flujo completo para finalizar tareas complejas con build, pruebas y deploy
---

# Flujo de Trabajo Completo para Tareas Complejas

Este workflow automatiza el proceso de build, pruebas y deploy después de completar tareas complejas.

## Pasos Automáticos

1. **Build del proyecto**:
   ```bash
   npm run build
   ```

2. **Type checking**:
   ```bash
   npm run typecheck
   ```

3. **Preview del build**:
   ```bash
   npm run preview
   ```

4. **Verificar estado de git**:
   ```bash
   git status
   ```

5. **Agregar cambios**:
   ```bash
   git add .
   ```

6. **Commit con mensaje descriptivo**:
   ```bash
   git commit -m "feat: [descripción del cambio] - build y pruebas exitosas"
   ```

7. **Push a GitHub**:
   ```bash
   git push origin main
   ```

## Cuándo Usar

Este workflow se debe ejecutar automáticamente cuando:
- Se completan cambios significativos en el código
- Se implementan nuevas funcionalidades
- Se resuelven bugs complejos
- Se actualizan dependencias importantes
- Se modifican archivos de configuración

## Verificación Automática

El sistema debe verificar que:
- El build se complete sin errores
- No haya warnings de TypeScript
- Las pruebas (si existen) pasen exitosamente
- El código esté formateado correctamente

## Deploy Automático

Si el proyecto está configurado para deploy automático (Netlify, Vercel, etc.), el push a GitHub activará el deploy automáticamente.

## Comando Rápido

Para ejecutar este workflow completo:
```bash
npm run build && npm run typecheck && git add . && git commit -m "feat: [descripción] - build y pruebas exitosas" && git push origin main
```
