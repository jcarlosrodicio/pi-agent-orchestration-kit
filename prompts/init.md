---
agent: lead
arguments: $ARGUMENTS
name: init
---

# /init

Contrato: `lead` ejecuta calibración ligera del repo y persiste el contexto.

## Init/context policy

1. Confirmar `cwd` y repo target.
2. Detectar stack, test runner, convenciones y tooling mediante señales de archivos de config.
3. Opcionalmente preguntar preferencias al usuario (modo interactivo, ubicación del archivo, presupuesto de review).
4. Escribir `PROJECT_CONTEXT.md` en la raíz del repo (o `docs/ai/project-context.md` si el usuario lo prefiere).
5. Devolver resumen de detección, confidence y next action.

## Criterio

- `/init` es idempotente: reescribir el archivo sin duplicar secciones.
- Detección basada en archivos de config reales, no en suposiciones.
- Items ambiguos se marcan como `unknown` o con confidence `low`.
- No muta archivos del proyecto excepto el context file.
- Si `PROJECT_CONTEXT.md` ya existe, lo sobrescribe con detección actualizada.
- Strict TDD se recomienda (advisory) solo cuando se detectan tests con confidence alta.
- El archivo generado es compacto (~80 líneas max), markdown bullet-list, optimized para lectura por agentes.

## Result Contract

- `status`: pass | needs_changes | blocked
- `summary`: resumen corto de lo detectado
- `artifacts`: path del archivo escrito
- `next_recommended`: siguiente paso
- `risks`: detecciones con confidence baja o unknowns
