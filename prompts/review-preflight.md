---
agent: lead
arguments: $ARGUMENTS
name: review-preflight
---

Ejecuta solo el preflight determinista del diff actual.

Argumentos del usuario:

$ARGUMENTS

## Contrato

```text
canonical_policy: required
canonical_policy_path: references/review-policy.md
review_stage: preflight
verdict: not_run
```

- Este comando es el camino recomendado para uso diario.
- No modifica archivos del repo revisado.
- Ejecuta
  `rtk node {{PI_HARNESS_ROOT}}/runtime/scripts/review-orchestrated-prepare.mjs --dry-run`
  con los argumentos recibidos que sean de scope o presupuesto. El script es
  global; no debe existir dentro del repo revisado.
- Genera workspace, `manifest.json`, `shared-review-context.md`, `patches/` y
  `findings/`.
- No invoques revisores, subagentes ni revisión adicional.
- No afirmes que se hizo una revisión de IA; esto es solo preflight.
- No preguntes por siguientes pasos; devuelve el resultado observado y termina.
- `--retain` conserva el workspace; si no se usa, limpia al terminar.
- `canonical_policy_path` apunta a la skill global del harness; su ausencia
  dentro del repo revisado no es un error de preflight.

## Salida

Devuelve de forma concisa:

1. Nivel: `skipped`, `trivial`, `lite` o `full`.
2. Flags de riesgo.
3. Archivos considerados y archivos filtrados.
4. Revisores recomendados, marcados claramente como no ejecutados.
5. Presupuestos y si se excedieron.
6. Ruta del workspace o estado de limpieza.
7. Envelope explícito `review_stage: preflight`, `verdict: not_run`.

Runtime contract:
- entrypoint: {{PI_HARNESS_ROOT}}/runtime/commands/review-preflight.mjs
- guarantees: Preserve preflight gates, locks, hashes, idempotency, and final reviewer authority.
