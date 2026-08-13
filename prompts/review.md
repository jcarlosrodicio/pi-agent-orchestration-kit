---
agent: reviewer
arguments: $ARGUMENTS
name: review
---

Revisa el diff actual contra la tarea o spec activa.

```text
canonical_policy: required
canonical_policy_path: references/review-policy.md
review_stage: final
final_verdict_authority: reviewer
review_only: true
mutation_authority: none
```

Usa:
- git status
- git diff
- documentación del repo si existe
- specs o tareas si existen
- `docs/ai/evolution/` si el diff cambia agentes, comandos, skills o tools de OpenCode
- `change_manifest.json` y `change_evaluation.json` si existen

Inspecciona como evidencia primaria el diff, los artefactos originales y los
resultados ejecutados. El resumen de implementación sólo aporta contexto.
Entrega el envelope final canónico con perfiles resueltos, causalidad de cada
finding, veredicto, cobertura de criterios, checks `not_run`, estado AHE si
aplica y recomendación final.

No invoques `developer` ni implementes correcciones dentro de `/review`. Si el
veredicto exige cambios, devuelve únicamente el handoff mínimo para que quien
llamó al comando decida el siguiente paso y finaliza la ejecución.
