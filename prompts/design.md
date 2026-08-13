---
agent: designer
arguments: $ARGUMENTS
name: design
---

Diseña lo siguiente usando el flujo visual completo:

$ARGUMENTS

Flujo obligatorio:

1. Busca y lee `PRODUCT.md` y `DESIGN.md`.
2. Si falta uno o ambos, carga `impeccable` y crea o propone los documentos faltantes.
3. Carga `open-design`.
4. Resuelve `baseUrl` desde configuración segura aprobada o contexto explícito del usuario/lead.
5. Si falta `baseUrl`, detente y pregunta; no adivines ni hardcodees URLs.
6. Comprueba `open_design_health` pasando el `baseUrl` resuelto.
7. Comprueba `open_design_list_agents` pasando el `baseUrl` resuelto.
8. Elige el mejor Open Design `skillId`.
9. Elige el mejor `designSystemId`.
10. Si el usuario pide diseño generado, usa `open_design_run_design` con el `baseUrl` resuelto.
11. Si el usuario pide proyecto editable, propuesta o handoff, usa `open_design_create_project` con el `baseUrl` resuelto.
12. Define criterios observables como handoff para specifier/reviewer si el diseño pasa a implementación.
13. Devuelve URL del proyecto, archivos generados si existen, prompt usado, decisiones, supuestos, riesgos visuales y handoff para specifier/developer.

Reglas:

- No uses `using-superpowers`.
- No uses ninguna skill distinta de `open-design` o `impeccable`.
- No inventes URLs de Open Design.
- No hardcodees `baseUrl`; debe venir de configuración/contexto aprobado.
- No contradigas `PRODUCT.md` ni `DESIGN.md` sin reportarlo.
- No dejes decisiones visuales críticas abiertas sin marcarlas como bloqueo para specifier.
