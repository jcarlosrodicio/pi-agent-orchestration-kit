---
agent: lead
arguments: $ARGUMENTS
name: autonomous
---

Objetivo:

$ARGUMENTS

```text
authorization: explicit_command_invocation
execution_scope: local_checkout_only
max_iterations_per_invocation: 6
planned_iteration_budget: task_specific_1_to_6
hard_safety_ceiling: 6
completion_authority: reviewer_only
canonical_policy_path: references/review-policy.md
canonical_policy_scope: global_skill
final_review_authority: reviewer
validation_gate: deterministic_per_iteration
canonical_state_path: .opencode/loops/<slug>.json
history_path: .opencode/loops/<slug>.history.jsonl
lock_path: .opencode/loops/<slug>.lock
human_view_path: .opencode/loops/<slug>.md
worktree_mode: prohibited
scheduling: prohibited
parallelism: prohibited
external_writes: prohibited
auto_commit_push_merge_deploy: prohibited
reviewer_execution: task_subagent_only
reviewer_evidence: required_subagent_attestation
final_review_attestation: review_stage_verdict_causality_evidence
```

`/autonomous` es distinto de `/loop`: la invocación explícita autoriza una sola
tarea local y elimina el gate intermedio, pero no amplía permisos. No crea
worktrees, no programa cadencias, no ejecuta ramas en paralelo, no usa red ni
conectores MCP de escritura y no publica cambios.

## Contrato y preflight

1. Lee `AGENTS.md`, estado Git y la documentación/validación mínima del repo.
2. Protege cambios locales preexistentes; si la tarea los solapa, detente.
3. Escribe un Task Contract y una vista durable en `.opencode/loops/<slug>.md`.
   Si no existe `.opencode/loops/<slug>.json`, inicializa con
   `oak state init --root . --slug <slug> --contract <contract-path> --git-baseline <baseline> --session-id <session-id> --action-id <action-id>`;
   después adquiere el lease con `oak state resume` usando los mismos `root`,
   `slug`, `contract`, `session-id` y un `action-id` nuevo. Si el JSON ya
   existe, inspecciónalo y reanúdalo: nunca lo borres ni lo reinicialices. El
   runtime empaquetado de `oak` conserva el journal, lock e idempotencia sin
   depender de archivos dentro del checkout objetivo. El contrato debe
   contener objetivo, criterios observables, no-alcance, validación,
   presupuesto y denylist. El presupuesto planificado es específico de la tarea:
   `planned_iteration_budget` se fija como un entero de 1 a 6 antes de iniciar;
   seis sigue siendo el techo duro de seguridad de toda invocación.
4. Detente antes de escribir si aparecen secretos, credenciales, auth,
   autorización, pagos, PII, migraciones, infraestructura, producción o una
   decisión material fuera del contrato.
5. Si el estado requiere una migración, ejecuta una migración explícita a
   schema-v1 y solicita aprobación humana renovada antes de `oak state resume`.
   La aprobación anterior nunca se reutiliza tras una migración.

## Ciclo autónomo

```text
developer -> reviewer -> developer (state sync)
```

Para un máximo de seis iteraciones, `developer` aplica una única acción
enfocada y ejecuta al menos una validación determinista relevante. `reviewer`
inspecciona el diff y la evidencia real como subagente invocado por `lead` con
`task reviewer`; nunca se invoca con `opencode run --agent reviewer`. Sólo un
`review_stage: final` con `pass` o `pass_with_observations` de esa sesión hija
puede completar el objetivo. La atestación debe conservar `review_stage`,
`verdict`, causalidad y evidencia. Tras el veredicto, el
sincronizador registra `reviewer_session_id`, `reviewer_agent: reviewer` y
`reviewer_verdict: APPROVE` mediante
`oak state attest-review --root . --slug <slug> --reviewer-session-id <session-id> --reviewer-agent reviewer --reviewer-verdict APPROVE`.
`oak state record` sólo puede marcar `completed` cuando exista esa atestación
ligada al contrato; el valor runtime `APPROVE` es únicamente la traducción de
un veredicto canónico de éxito. Con `needs_changes`, el finding bloqueante es la
única siguiente acción; con `blocked`, pausa. Cada retry requiere evidencia
nueva; `developer` sólo sincroniza el
estado después del veredicto y nunca se autoaprueba.

La aprobación final del reviewer detiene de inmediato el ciclo. No se inicia otra iteración, no se aplica otra acción y no se reanuda sin un nuevo contrato.

## Paradas obligatorias

Detén y deja estado `blocked` o `paused` por: éxito aprobado; seis iteraciones;
dos iteraciones sin progreso observable; repetición del mismo fallo; validación
imposible; presupuesto agotado; cambios protegidos; expansión de alcance; o
una superficie denegada. Informa `pass`, `fail` o `not_run`, sin presentar
`not_run` como éxito.

Una migración explícita a schema-v1 exige aprobación humana renovada antes de oak state resume.

## Denylist

Prohibidos: commit, push, merge, pull request, deploy, release, tag,
publicación, red, conectores MCP de escritura, secretos, credenciales, cambios
de permisos, producción, pagos, PII, migraciones, Terraform y Kubernetes.

## Cierre

Entrega el estado, iteraciones, diff base, validaciones, envelope final y
veredicto del reviewer, motivo de parada y riesgos. Si no hay `pass` o
`pass_with_observations` final, con todos los criterios y la validación
requerida, traducido a la atestación runtime `APPROVE`, el objetivo no está
completado.

Runtime contract:
- entrypoint: {{PI_HARNESS_ROOT}}/runtime/commands/autonomous.mjs
- guarantees: Preserve budget limits, locks, hashes, human gates, idempotency, and reviewer authority.
