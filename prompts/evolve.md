---
agent: lead
arguments: $ARGUMENTS
name: evolve
---

Quiero evolucionar el harness OpenCode:

$ARGUMENTS

```text
canonical_policy_path: references/review-policy.md
canonical_policy_scope: global_skill
final_review_authority: reviewer
```

Ejecuta el flujo AHE que corresponda al alcance pedido. El flujo completo sigue
siendo obligatorio para cambios reales del harness; las ramas de auditoría sin
aplicación tienen condiciones explícitas de parada.

## Precondiciones

1. Comprueba si el harness está en un repo git con `git status`.
2. Si no hay git, bloquea rollback automático y pide versionar o trabajar en copia versionada antes de aplicar cambios.
3. Lee `docs/ai/evolution/README.md`.
4. Identifica la iteración objetivo: `docs/ai/evolution/runs/iteration-XXX/`.

## Init/context policy

Antes de evaluar o proponer cambios del harness, registra:

- `cwd`: debe ser el repo del harness OpenCode.
- `AGENTS.md`: reglas locales y límites de evolución.
- `git state`: rama, cambios pendientes y posibilidad real de rollback.
- `validation commands`: `node [unsupported-runtime:check-harness]`,
  `node --test [unsupported-runtime:check-harness-test]` y replays necesarios.

Expectativas mínimas de validación:

- `node [unsupported-runtime:check-harness]` es el smoke rápido/local y debe tratarse como
  comprobación barata.
- `node --test [unsupported-runtime:check-harness-test]` es la suite larga del checker;
  debe ejecutarse con presupuesto explícito de tiempo superior al timeout por
  defecto del harness, registrar runtime observado y no clasificarse como fallo
  funcional solo por cancelación cerca del techo temporal.
- `repo docs`: `docs/ai/harness/`, `docs/ai/evolution/`,
  `mechanisms.jsonl`, `rejected_mechanisms.jsonl`, `session-sources.md` y benchmarks.

## Session sources

`/evolve` es OpenCode-first. La base local por defecto es:

- `~/.local/share/opencode/opencode.db`

La unidad principal de evidencia no es una sesión plana sino un `execution tree`:

- una root session con `parent_id = null`
- todas las child sessions y descendientes enlazadas por `parent_id`

`session_sources` puede añadir raw exports opcionales desde:

- `RAW_SESSIONS_DIR`
- `/Volumes/ingestion/raw-sessions/opencode`
- `/raw-sessions`

Antes de `evaluator`, ejecuta staging con:

- `node [unsupported-runtime:collect-session-evidence] --iteration iteration-XXX`

El collector debe producir:

- `execution-trees.jsonl`
- `normalized-sessions.jsonl`
- `session-sources.summary.json`
- `cursor.json`

Por defecto, `/evolve` usa cursor incremental por árboles:

- boundary canónica: `tree_time_updated_max`
- tie-breaker: `root_session_id`
- cada iteración usa el `cursor.json` válido más reciente como punto de partida

Los raw exports son suplementarios:

- pueden enriquecer evidencia o replay
- no avanzan ni resetean el cursor canónico
- no sustituyen a `opencode.db` como fuente incremental
- puede forzarse `--full-rescan` para auditoría o recuperación

Si no hay raw exports externos, `/evolve` sigue funcionando con `opencode.db`.

## Preflight audit

Antes de evaluar o proponer cambios, ejecuta el preflight audit para producir
un baseline objetivo del estado del harness:

```bash
node scripts/preflight-audit.mjs --iteration iteration-XXX
```

El preflight produce `preflight-audit.json` con:

- `scores`: `contract_coverage`, `runtime_evidence_coverage`, `doc_runtime_alignment`, `drift_severity`.
- `doc_runtime_matrix`: matriz por surface (agent, command, workflow, evidence).
- `drifts`: drifts observables clasificados por severidad.
- `recommendations`: recomendaciones priorizadas.
- `confidence`: nivel de confianza del preflight.

Ramas permitidas del preflight:

- `audit-only`: ejecuta solo el preflight y entrega resultados sin invocar `evaluator`, `debugger` ni `evolver`.
- `debugger-only`: ejecuta preflight + `evaluator` + `debugger` sin llegar a `evolver`.
- `full evolve`: preflight + flujo completo.

El preflight reutiliza staging/doc/contracts existentes; no requiere inputs
manuales adicionales. Es un artefacto por iteración, no un sistema paralelo.

## Flujo obligatorio

1. Ejecuta el preflight audit para la iteración objetivo.
2. Recolecta `session_sources` y genera artefactos staged con `collect-session-evidence.mjs`.
3. Invoca a `evaluator` para ejecutar o definir escenarios benchmark/smoke.
4. Si el usuario pidió solo evaluación/auditoría y no hay autorización para
   análisis, manifest ni aplicación, detente aquí con resultados, limitaciones y
   siguiente handoff; no crees manifest.
5. Invoca a `debugger` para producir overview, detalles y root causes cuando haya
   resultados o trazas que atribuir.
6. Si el alcance es debugger-only, no-apply o no-manifest, detente aquí con root
   causes, criterios de falsificación y recomendación; no invoques `evolver` ni
   `developer`.
7. Invoca a `evolver` solo si hay evidencia suficiente y el alcance del usuario
   permite proponer cambios del harness.
8. Revisa el `change_manifest.json` propuesto.
9. Si el manifest es válido y el usuario/lead aprueba aplicar, invoca a
   `developer`.
10. Invoca a `evaluator` otra vez para medir la nueva iteración.
11. Invoca a `debugger` para `change_evaluation.json`: keep / improve /
    rollback+pivot.
12. Invoca a `reviewer` con spec/Task Contract, base del diff, diff, manifest,
    evaluación y evidencia original. Exige `review_stage: final` y un veredicto
    canónico antes de decidir el cierre.
13. Cierra con decisión: keep, improve o rollback+pivot.

## Reglas

- No aceptes cambios sin evidencia concreta.
- No aceptes cambios sin predicted fixes y risk tasks.
- No mezcles patrones independientes en un solo cambio.
- No prometas rollback si no hay git.
- No modifiques LLM config, modelos, credenciales o proveedores para simular mejora.
- No uses `~/.codex/sessions` como fuente base de `/evolve`.
- No trates cada subagent session como evidencia independiente si pertenece a un `execution tree`.
- Clasifica prompts que ordenan hablar con cada agente, cada fase o cada sidecar
  como tests sintéticos/coercitivos de routing, no como evidencia natural de
  `/feature`.
- Un árbol coercitivo de `/feature`, por sí solo, no basta para afirmar una
  regresión de sidecar-overreach: exige una segunda prueba, como un árbol
  natural sin wording coercitivo o un replay estable sobre el harness actual.
- Las peticiones explícitas del usuario para usar sidecars siguen siendo
  legales; la clasificación sintética solo evita atribuirlas como baseline de
  feature normal.
- Crea o actualiza manifest solo cuando hay evidencia suficiente, el alcance del
  usuario permite proponer cambios y la fase llegó a `evolver`.
- No invoques `developer` ni apliques cambios sin manifest válido y aprobación
  explícita para aplicar.

## Resultado esperado

- Preflight audit ejecutado con `preflight-audit.json` produced.
- Iteración evaluada.
- Artefactos staged de `session_sources` y `execution trees`.
- Manifest creado o actualizado solo si la rama llegó a propuesta de cambio.
- Evaluación de cambios previos si aplica.
- Cambios aplicados, si procede.
- Validaciones ejecutadas.
- Decisión final y riesgos.
- `Task Contract` si se delega implementación a `developer`.
- `handoff_packet` si la iteración queda a medias o requiere otra sesión.
