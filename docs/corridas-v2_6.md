---
type: registro
status: pendiente-de-corridas
created: 2026-10-30
---
# Registro de corridas — Arturito v2.6

Pruebas de la regla de marcha del vecino (`EXT_MARCHA`, propuesta en
[[propuesta-ext-marcha]]). Misma pista, misma superficie, misma pose
de largada y misma batería. Mínimo 3 vueltas por nivel:

- **A — `EXT_MARCHA 0`**: línea base v2.5 con instrumentación (`e1`/`e3`).
- **B — `EXT_MARCHA 1`**: solo veta `ext`.
- **C — `EXT_MARCHA 2`**: veta `ext` y enmascara la punta ajena.

Para cada corrida anotar el `MUESTRA_MS` usado (sugerido 1000 para que
el anillo cubra ~64 s) y detener con el pulsador justo después de la
zona de interés.

| # | Nivel | `MUESTRA_MS` | Tiempo | Perdidas | Curvas ext falsas | Curvas ext reales | Veto a masa ajena | Veto a esquina real | Timeouts de curva | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

Pendiente de corridas. Debajo de cada fila va la traza completa tal
como sale por serie (`t`, 9600, robot detenido).

## Criterio de decisión

- C cumple los 4 criterios → queda `EXT_MARCHA 2`.
- C falla solo en veto a esquina real pero B lo cumple → `EXT_MARCHA 1`.
- B también falla → `EXT_MARCHA 0` y probar `MARCHA_MS` 90 y 120.
