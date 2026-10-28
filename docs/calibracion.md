---
type: calibración
status: medido
created: 2026-10-28
---
# Calibración de sensores

Lecturas medidas con `firmware/prueba_sensores` (2026-10-28, cinta negra sobre
papel blanco):

- Blanco: 26–30 en los cinco canales
- Negro: 850–960 (S2 respondió 500–675 con la cinta al borde; sobre la línea
  de 20 mm debe leer en rango completo)
- Umbral en código: `UMBRAL = 500` (negro si lectura > 500)

Orden físico verificado: visto el bot desde arriba, de izquierda a derecha
van S0, S1, S2, S3, S4 — coincide con el código (S0 extremo izquierdo, S4
extremo derecho).

Síntoma de canal sin alimentación: lectura clavada en ~1015 = "negro"
permanente. Tres módulos llegaron a ese estado por un corte de corriente en
la protoboard y el bot se movía sin parar (v1, v2, v4 siempre activos).

Margen amplio entre fondo y línea: el umbral de 500 queda holgado en medio.
Si la pista del concurso cambia de material o luz, volver a medir blanco y
negro en [[pista]] y ajustar `UMBRAL` antes de tocar velocidades.
