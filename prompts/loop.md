---
agent: lead
arguments: $ARGUMENTS
name: loop
---

Objetivo o acción:

$ARGUMENTS

Ejecuta un loop manual y reanudable sobre una tarea de ingeniería con validación
mecánica. Este comando no programa cadencias ni convierte el trabajo en una
automatización desatendida.

## Invariantes verificables

```text
approval_gate: explicit_before_writes
max_iterations_per_invocation: 3
completion_authority: reviewer_only
canonical_policy_path: references/review-policy.md
canonical_policy_scope: global_skill
final_review_authority: reviewer
canonical_state_path: .opencode/loops/<slug>.json
history_path: .opencode/loops/<slug>.history.jsonl
lock_path: .opencode/loops/<slug>.lock
human_view_path: .opencode/loops/<slug>.md
worktree_mode: explicit_opt_in
```

El `handoff_packet` durable (`.opencode/handoffs/<slug>.md` con
`approval_status`) persiste la aprobación humana para que sobreviva reinicios
de sesión. `/loop` mantiene `.opencode/loops/<slug>.json` como estado canónico,
`.opencode/loops/<slug>.history.jsonl` como historial append-only y
`.opencode/loops/<slug>.md` como vista humana. Ver
`docs/ai/harness/agents.md` sección "Estado durable de `/loop`".

La secuencia de una iteración es:

```text
developer -> reviewer -> developer (state sync)
```

## Interfaz

- `/loop <objetivo>` diseña un loop nuevo.
- `/loop resume <slug>` adquiere el lock durable, valida el hash del contrato y
  continúa desde el estado canónico `.opencode/loops/<slug>.json`.
- Solo activa worktree si el usuario incluye explícitamente `worktree` en los
  argumentos o lo solicita durante el gate. En cualquier otro caso trabaja de
  forma secuencial sobre el checkout actual.
- Cada invocación, incluida una reanudación, abre un bloque nuevo de como máximo
  tres iteraciones.

## Fase 1: preflight y Loop Contract

Antes de cualquier escritura o handoff a `developer`:

1. Lee `AGENTS.md`, `PROJECT_CONTEXT.md` o `docs/ai/project-context.md` si
   existen, el estado git y la documentación mínima necesaria.
2. Si es una reanudación, ejecuta únicamente
   `node {{PI_HARNESS_ROOT}}/runtime/scripts/loop-state.mjs inspect` y lee el Markdown solicitado. Si falta
   el estado o hay corrupción, detente; no lo repares ni sustituyas
   silenciosamente. `inspect` es read-only y no adquiere el lock.
3. Identifica cambios locales preexistentes y decláralos protegidos. Si el loop
   tendría que tocar una ruta ya modificada, detente y pide decisión humana.
4. Carga `autonomous-loops` para diseñar el límite y `verification-loop` para
   definir evidencia, usando `docs/ai/harness/skill_registry.md` cuando exista.
5. Presenta un `Loop Contract` con:
   - slug y objetivo en una frase;
   - criterios de éxito observables;
   - alcance y no-alcance;
   - archivos o áreas permitidas y cambios preexistentes protegidos;
   - comandos de validación y resultado baseline si fue necesario ejecutarlos;
   - riesgos, denylist y triggers de escalado;
   - modo `current_checkout` o `worktree_explicit`;
   - límite de tres iteraciones y condiciones de parada.
6. Pide aprobación humana explícita del contrato y termina el turno esperando
   respuesta. No escribas estado, no invoques a `developer` y no modifiques
   archivos antes de recibir esa aprobación.

Si el usuario rechaza o cambia el contrato, revisa el diseño o finaliza sin
escrituras. La aprobación del objetivo original no sustituye la aprobación del
`Loop Contract` concreto.

## Fase 2: inicialización del estado

Después de la aprobación, delega a `developer` únicamente:

1. para un loop nuevo, crear o actualizar la vista humana
   `.opencode/loops/<slug>.md` y ejecutar `node {{PI_HARNESS_ROOT}}/runtime/scripts/loop-state.mjs init` con
   el baseline Git, sesión y un `action_id` único;
2. para una reanudación aprobada, ejecutar `node {{PI_HARNESS_ROOT}}/runtime/scripts/loop-state.mjs resume`
   con el slug, contrato, sesión y un `action_id` nuevo.

No edites esos archivos como `lead`.

La vista Markdown debe ser legible e incluir:

- `status`: `approved`, `running`, `completed`, `paused` o `blocked`;
- objetivo, criterios de éxito, alcance, no-alcance y denylist;
- modo de ejecución y baseline git;
- cambios preexistentes protegidos;
- comandos de validación;
- número de bloque, iteración actual y máximo tres;
- historial por iteración: cambio, archivos, comandos, resultados y evidencia;
- último veredicto del reviewer y siguiente acción;
- decisiones humanas y motivo de terminación.

El estado puede versionarse o ignorarse según las reglas del repo objetivo. No
modifiques `.gitignore` salvo petición explícita.

El JSON es la fuente de verdad para `schema_version`, hash aprobado, baseline
Git, sesión, aprobación, lease, `status`, iteración, último paso, causa de
bloqueo y último `action_id`. Cada transición se registra con
`node {{PI_HARNESS_ROOT}}/runtime/scripts/loop-state.mjs record`; repetir el mismo `action_id` con el mismo
contenido es idempotente y reutilizarlo con otro contenido es un error.
Las transiciones de una misma sesión también se serializan dentro del lock;
ningún proceso puede escribir una secuencia concurrente con el mismo
`session_id`. Un retry solo se considera aplicado si journal, snapshot y locks
confirman un commit completo; si no, devuelve `recovery_required`.

## Fase 3: ciclo acotado

Para cada iteración disponible:

1. Envía a `developer` un handoff autocontenido con el contrato aprobado, estado,
   cambios protegidos, una sola siguiente acción y validación esperada.
2. `developer` realiza un único cambio enfocado, ejecuta la validación razonable
   y actualiza el historial del estado con evidencia. No puede ampliar alcance ni
   declarar completado el objetivo.
3. Envía el diff, contrato y Verification Envelope a `reviewer`.
4. `reviewer` devuelve `review_stage: final` y exactamente `pass`,
   `pass_with_observations`, `needs_changes` o `blocked`, con causalidad,
   evidencia y evaluación de todos los criterios de éxito.
5. Delega de nuevo a `developer` solo la sincronización del veredicto y estado.
   Esta escritura administrativa no consume una iteración y no puede incluir
   cambios de implementación. Debe actualizar la vista Markdown y registrar la
   transición canónica con un `action_id` nuevo.
6. Con `needs_changes`, convierte los findings bloqueantes en la única siguiente
   acción de la iteración posterior. Con `blocked`, pausa inmediatamente.
7. Solo marca `completed` cuando todos los criterios pasan y `reviewer` emite
   `pass` o `pass_with_observations`. La afirmación de `developer` nunca basta
   para completar el loop. Si el runtime exige la atestación histórica
   `APPROVE`, sólo puede registrarla como traducción de uno de esos dos
   veredictos finales.

## Condiciones de parada

Detén el ciclo, sincroniza el estado y entrega un handoff humano cuando ocurra
cualquiera de estas condiciones:

- objetivo completado con `pass` o `pass_with_observations` final;
- tres iteraciones consumidas en la invocación;
- dos iteraciones consecutivas sin progreso observable;
- necesidad de ampliar el alcance aprobado;
- validación requerida imposible de ejecutar o interpretar;
- solapamiento con cambios locales preexistentes;
- tercer intento sobre el mismo fallo;
- cualquier cambio en `.env`, secretos, credenciales, auth, autorización,
  pagos, billing, PII, migraciones, Terraform, Kubernetes o producción.

Para rutas sensibles usa `blocked` o `paused` y `ESCALATE_HUMAN`; no propongas
una excepción silenciosa.

## Límites de la primera versión

- No auto-merge.
- No scheduling ni cadencias.
- No conectores MCP con permisos de escritura.
- No ejecución paralela.
- No creación implícita de worktrees.
- No dependencias, agentes ni skills nuevas.

## Recuperación y reparación

- Una escritura interrumpida puede dejar el journal por delante del snapshot.
  Usa `node {{PI_HARNESS_ROOT}}/runtime/scripts/loop-state.mjs repair` para reconstruir el JSON desde el
  último evento completo.
- La reparación valida continuidad de slug, contrato, baseline, aprobación,
  iteración y lease antes de confiar en un `state_after`.
- `--truncate-tail` solo elimina una última línea JSON incompleta; la corrupción
  intermedia se rechaza.
- `--release-lock` es una decisión humana explícita para un lock abandonado; no
  hay desbloqueo automático por timeout. `repair` rechaza cualquier lock activo
  si no se proporciona esa autorización explícita.
- `migrate` convierte schema v0 o un estado solo Markdown a schema v1 únicamente
  con `--approval-status approved`; nunca hereda una aprobación antigua.
- Al pausar o cerrar una invocación, ejecuta `release` con la sesión propietaria
  y un `action_id` nuevo.

## Cierre

Entrega siempre: slug, rutas JSON/JSONL/Markdown, status, iteraciones usadas,
cambios, validaciones, último veredicto, motivo de parada, riesgos y siguiente
decisión humana. Distingue `pass`, `fail` y `not_run`; no presentes `not_run`
como éxito.

Runtime contract:
- entrypoint: {{PI_HARNESS_ROOT}}/runtime/commands/loop.mjs
- guarantees: Preserve iteration limits, locks, hashes, human gates, idempotency, and reviewer authority.
