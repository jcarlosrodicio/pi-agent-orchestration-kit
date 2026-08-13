---
agent: scoper
arguments: $ARGUMENTS
name: scope
---

Quiero investigar y especificar esta tarea:

$ARGUMENTS

Ejecuta exclusivamente el flujo researcher → specifier.

## Init/context policy

Antes del research, fija contexto mínimo:

- `cwd`: repo actual o directorio objetivo.
- `AGENTS.md`: reglas locales aplicables si existe.
- `git state`: estado limpio/sucio si hay cambios relevantes que leer.
- `validation commands`: checks que deberían demostrar la spec.
- `repo docs`: documentación local relevante.

Reglas obligatorias:

1. No uses designer.
2. No uses developer.
3. No uses reviewer.
4. No implementes código.
5. No modifiques archivos de aplicación.
6. Invoca primero a researcher.
7. Espera el resultado completo de researcher.
8. Invoca a `debugger` solo si el usuario pide analizar trazas/resultados existentes o si hay evidencia previa concreta que interpretar.
9. Sintetiza hallazgos, riesgos, decisiones y supuestos.
10. Solo si research y debugging opcional están listos para spec, invoca a specifier.
11. Pide a specifier specs acotadas, no una macro-spec.
12. Divide la salida en tareas pequeñas, ordenadas y verificables.

Entrega final:

- resumen de research
- resumen de debugging solo si se invocó sidecar
- decisiones tomadas
- alcance
- no alcance
- spec acotada
- tareas atómicas
- criterios de aceptación
- plan de validación
- riesgos
- `Task Contract` para la implementación futura
- `handoff_packet` si hay varias sesiones o agentes
- siguiente paso recomendado
