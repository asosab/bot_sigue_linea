---
type: calibración
status: medido
created: 2026-10-28
---
# Calibración de sensores

Lecturas reales apuntadas en la cabecera del sketch (`firmware/arturito/arturito.ino`):

- Blanco: 30–40
- Negro: 970–990
- Umbral en código: `UMBRAL = 500` (negro si lectura > 500)

Margen amplio entre fondo y línea: el umbral de 500 queda holgado en medio.
Si la pista del concurso cambia de material o luz, volver a medir blanco y
negro en [[pista]] y ajustar `UMBRAL` antes de tocar velocidades.
