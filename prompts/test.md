---
agent: developer
arguments: $ARGUMENTS
name: test
---

Objetivo de test:

$ARGUMENTS

Usa las skills locales que correspondan:

- `test-driven-development` para cambios de comportamiento, bugs o tests nuevos.
- `debugging-and-error-recovery` si hay fallo, traza o comportamiento inesperado.

Flujo:

1. Identifica comportamiento esperado, alcance y criterio de éxito.
2. Si es un bug, reproduce primero con una prueba o evidencia observable.
3. Añade o ajusta el test mínimo que demuestra el comportamiento.
4. Ejecuta la validación más acotada posible.
5. Si el cambio requiere implementación para pasar el test y el alcance está claro,
   implementa el mínimo código necesario.
6. Ejecuta la validación final razonable y resume evidencia.

Reglas:

- No sustituyas `/feature` si falta spec, research o decisión de alcance.
- No escribas tests que solo verifiquen detalles internos frágiles.
- No declares éxito si no viste fallar el test nuevo de un bug reproducible, salvo
  que expliques por qué no era viable.
- No amplíes refactors fuera del comportamiento probado.

Entrega:

1. Test o validación añadida.
2. Resultado antes/después si aplica.
3. Cambios de implementación si hubo.
4. Comandos ejecutados.
5. Riesgos o cobertura pendiente.
