---
type: algoritmo
status: en-uso
created: 2026-10-28
---
# Algoritmo de seguimiento

Máquina de casos sobre las 5 lecturas binarias (`lectura > UMBRAL = negro`).
No es PID: corrige por escalones según qué sensor pisa la línea.

| Caso | Condición | Acción |
|---|---|---|
| Centrado | solo S2 | recto rápido |
| Desvío leve izq. | S3 (o S2+S3) | rápido izq., lento der. |
| Desvío leve der. | S1 (o S2+S1) | lento izq., rápido der. |
| Curva cerrada izq. | S4 (o S3+S4) | gira a la derecha |
| Curva cerrada der. | S0 (o S0+S1) | gira a la izquierda |
| Borde suelo | solo S0 o solo S4 | giro cerrado al lado que tocó |
| Cruce | los 5 en negro | recto rápido |
| Línea perdida | todos en blanco | repite `ultimoGiro`; si iba recto, se para |

Ojo: en el código los casos 2–3 dicen «desviado a la izquierda» pero el
giro aplicado corrige hacia el lado que ve la línea — conviene revisar el
comentario contra el comportamiento real en pista.

`ultimoGiro` (0/1/2) es la única memoria: al perder la línea el robot
busca hacia el último lado donde la vio.

Mejoras posibles pendientes: interpolación por peso de sensores o PID si
la tabla de casos oscila en curvas rápidas.
