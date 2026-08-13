---
agent: developer
arguments: $ARGUMENTS
name: code-simplify
---

Simplifica este alcance:

$ARGUMENTS

Usa `code-simplification`.

Flujo:

1. Identifica el alcance exacto y el comportamiento que debe preservarse.
2. Lee código y tests relacionados antes de editar.
3. Simplifica solo el código indicado o el código que el cambio actual dejó
   innecesariamente complejo.
4. Mantén comportamiento, errores, side effects y contratos observables.
5. Ejecuta la validación más adecuada para demostrar que no cambió el comportamiento.

Reglas:

- No hagas refactors adyacentes no solicitados.
- No elimines código muerto dudoso sin reportarlo o pedir confirmación.
- No mezcles simplificación con nuevas features.
- Si no hay cobertura suficiente para preservar comportamiento, declara el riesgo
  y añade una prueba mínima si el alcance lo permite.

Entrega:

1. Qué se simplificó.
2. Qué comportamiento se preservó.
3. Archivos tocados.
4. Validaciones ejecutadas.
5. Riesgos o código no tocado.
