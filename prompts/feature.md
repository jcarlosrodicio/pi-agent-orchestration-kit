---
agent: lead
arguments: $ARGUMENTS
chain: research -> spec -> implement -> review
name: feature
---

Objetivo:

$ARGUMENTS

Ejecuta el flujo con barreras obligatorias.

> Routing: para mensajes libres sin comando, `lead` usa la tabla de routing
> declarativo en `docs/ai/harness/commands.md` (sección "Routing declarativo").
> En `/feature` aplica el flujo obligatorio de abajo, que tiene precedencia.

```text
canonical_policy_path: references/review-policy.md
canonical_policy_scope: global_skill
final_review_authority: reviewer
```

La ruta canónica es relativa a la skill global `code-review-and-quality`; no la
busques ni exijas dentro del repo objetivo.

## Init/context policy

Antes del primer handoff, confirma solo lo necesario para enrutar bien:

- `cwd`: repo actual o directorio indicado por el usuario.
- `AGENTS.md`: reglas locales aplicables si existe.
- `git state`: estado limpio/sucio si el cambio tocará archivos.
- `validation commands`: checks probables del repo, sin ejecutarlos todavía salvo
  que sean necesarios para clasificar.
- `repo docs`: docs locales relevantes nombrados o evidentes.

Mantén esta política ligera. El mensaje libre pequeño conserva el fast path; no
conviertas init en discovery técnico.

## Flujo obligatorio

1. Analiza el objetivo solo lo necesario para clasificar alcance, incertidumbres y handoffs; no conviertas esta fase en discovery técnico ni inspección amplia del repo/config.
2. Aplica el flujo base: `lead -> designer si aplica -> researcher -> specifier -> developer -> reviewer`.
3. Decide si hace falta diseño y/o research con contexto mínimo de routing. La inspección previa permitida al `lead` se limita a ubicar señales obvias necesarias para elegir el siguiente agente.
4. Si la petición declara o revela incertidumbre de UX, marca, layout, interacción o criterios de aceptación visuales, invoca a `designer` antes del primer discovery sustantivo sobre esos temas y espera su handoff.
5. Si la petición declara o revela incertidumbre técnica, de producto, APIs, librerías, riesgos o arquitectura, invoca a `researcher` antes del primer discovery sustantivo, lectura amplia de implementación/config o conclusión técnica del `lead`, y espera su resultado.
6. El handoff temprano a `researcher`/`designer` debe incluir objetivo, incertidumbre detectada, restricciones y evidencia esperada; no debe pre-resolver la pregunta que motiva la delegación.
7. No hagas `researcher` universal: si la feature es simple, clara y sin incertidumbre relevante, conserva el routing rápido hacia spec/implementación según corresponda.
8. Puedes paralelizar `designer` y `researcher` solo si sus resultados son independientes.
9. Solo después de recibir y sintetizar research/diseño requeridos, invoca a `specifier`.
10. Revisa la spec producida.
11. Invoca a `developer` solo para tareas suficientemente especificadas.
12. Invoca a `reviewer` después de la implementación con spec/Task Contract,
    base del diff y Verification Envelope con evidencia original. Exige
    `review_stage: final` y un veredicto canónico antes de cerrar.
13. Cierra con resumen de cambios, validaciones y riesgos.

## Reglas de dependencia

- No invoques `specifier` mientras `researcher` tenga trabajo pendiente.
- No invoques `specifier` mientras `designer` tenga trabajo pendiente que pueda afectar requisitos o criterios de aceptación.
- No invoques `developer` antes de tener criterios de aceptación.
- No invoques `reviewer` antes de tener diff revisable.
- No paralelices tareas dependientes.
- Puedes paralelizar solo tareas claramente independientes.
- `evaluator` y `debugger` son sidecars opcionales: úsalos solo si hay validación dudosa/no ejecutada, fallos reales, trazas o evidencia explícitamente solicitada.
- Si la feature modifica agentes, comandos, skills o tools de OpenCode, trátala como evolución del harness y exige `change_manifest.json`.

## Resultado esperado

Entrega:

1. Fase ejecutada.
2. Agentes usados.
3. Decisiones tomadas.
4. Spec o tareas generadas, con `Task Contract` cuando haya implementación.
5. Cambios implementados, si aplica.
6. Validaciones.
7. Evidencia sidecar si se invocó evaluator/debugger.
8. Riesgos y pendientes.
9. `handoff_packet` si el trabajo fue largo o multiagente.
