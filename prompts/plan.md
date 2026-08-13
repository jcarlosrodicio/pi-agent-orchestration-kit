---
agent: lead
arguments: $ARGUMENTS
chain: research -> spec -> review
name: plan
---

Objetivo:

$ARGUMENTS

Ejecuta un flujo plan-only determinista.

Contrato: `lead -> researcher -> specifier -> reviewer`.

## Init/context policy

Antes de invocar a `researcher`, registra solo el contexto mínimo:

- `cwd`: repo o área objetivo.
- `AGENTS.md`: reglas locales aplicables si existe.
- `git state`: estado limpio/sucio cuando el plan dependa de cambios actuales.
- `validation commands`: checks probables que el plan deberá usar.
- `repo docs`: docs locales relevantes para research/spec.

No implementes ni hagas discovery profundo en esta fase.

## Flujo obligatorio

1. Aterriza el objetivo del usuario con supuestos, dudas, alcance, no-alcance y criterios de éxito comprobables.
2. Invoca siempre primero a `researcher`; espera su resultado completo antes de seguir.
3. Sintetiza los hallazgos de research: hechos verificados, inferencias, riesgos, decisiones recomendadas y preguntas abiertas.
4. Invoca a `specifier` solo después de tener el research consolidado.
5. Pide a `specifier` un plan implementable, criterios de aceptación, validación y tareas ordenadas.
6. Invoca a `reviewer` para revisar el plan/spec contra el objetivo, research, supuestos, riesgos y criterios de aceptación.
7. Si `reviewer` no encuentra issues significativos, entrega el plan final.
8. Si `reviewer` encuentra issues significativos, permite exactamente 1 vuelta de corrección.
9. Después de la segunda revisión, entrega el plan con riesgos explícitos o declara el estado bloqueado.

## Reglas de dependencia

- No invoques developer.
- No invoques `designer`; si el trabajo necesita diseño, marca esa dependencia en el plan o recomienda `/design` o `/feature`.
- No implementes código ni modifiques archivos de aplicación.
- No invoques `specifier` mientras `researcher` tenga trabajo pendiente.
- No invoques `reviewer` antes de tener un plan/spec revisable.
- No uses `evaluator`, `debugger` ni `evolver`; este comando planifica, no evoluciona ni valida el harness.
- No paralelices fases; este flujo es secuencial por diseño.
- Si hay una pregunta bloqueante, detén el flujo y declárala en vez de inventar una decisión.

## Vuelta única de corrección

Si `reviewer` devuelve `requiere cambios`:

- Si falta evidencia, contexto o research, reenvía una tarea acotada a `researcher` y después a `specifier`.
- Si el research está bien pero el plan está incompleto o inconsistente, reenvía una tarea acotada solo a `specifier`.
- Si hay contradicción no resoluble o decisión de producto bloqueante, detén el flujo y entrega estado bloqueado.
- Tras esa corrección, invoca una segunda y última revisión de `reviewer`.
- No hagas más ciclos aunque queden observaciones; entrega riesgos, pendientes y siguiente decisión humana.

## Resultado esperado

Entrega:

1. Resumen de research.
2. Clarifications: decisiones tomadas, supuestos, preguntas abiertas y respuestas.
3. Task Contract: `objective`, `success_criteria`, `non_goals`, `assumptions`,
   `open_questions`, `accepted_tradeoffs`, `validation` y
   `ask_abort_triggers`.
4. Plan implementable.
5. Acceptance Checklist con items marcados como pass/fail/not_run.
6. Plan de validación.
7. Resultado del reviewer.
8. Riesgos y pendientes.
9. `handoff_packet` si el plan requiere varias sesiones o varios agentes.
