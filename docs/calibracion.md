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
- Orden físico verificado: visto el bot desde arriba, de izquierda a derecha
  van S0, S1, S2, S3, S4 — coincide con el código (S0 extremo izquierdo, S4
  extremo derecho).

Síntoma de canal sin alimentación: lectura clavada en ~1015 = "negro"
permanente. Tres módulos llegaron a ese estado por un corte de corriente en
la protoboard y el bot se movía sin parar (v1, v2, v4 siempre activos).

## Calibración adaptativa (firmware en curso)

Ya no hay ventana de calibración al encender: el bot sale con valores de
laboratorio y se ajusta solo sobre la marcha.

- **Arranque en la mano**: `calMin[5]`/`calMax[5]` arrancan en 30/930 por
  canal (arrays por canal en el código, listos para cargar valores medidos
  individuales).
- **Al apoyarlo sobre la línea**: la compuerta de arranque siembra la pista
  real — cada canal que ve negro guarda su lectura como `calMax` y cada uno
  que ve blanco guarda su `calMin`. La escala base queda en la primera
  lectura.
- **En marcha**: cada lectura expande el rango del canal con el extremo
  nuevo que observe.

Tiempo de adaptación: la posición de salida siembra de una vez el negro de
S2 y el blanco de los demás. Cada canal completa su rango la primera vez
que pisa la línea: S1 y S3 en los primeros metros (basta un desvío leve),
S0 y S4 en la primera curva o cruce. Si la pista del concurso da lecturas
distintas a las del laboratorio (otra luz, otro pigmento), el robot las
toma solo, sin reprogramar.

Pendiente de laboratorio: medir blanco/negro por canal con
`prueba_sensores` y cargar los arrays `calMin`/`calMax` iniciales — así
las diferencias de cada módulo quedan registradas desde antes de pisar la
pista.

## Ajuste de constantes

El PD filtrado (KP 40, KD 25, KS 70, ALPHA 0.4) arranca con valores
razonados, no medidos: afinar en la pista de práctica mirando el zigzag y
la salida de curvas. `TRIM_IZQ`/`TRIM_DER` corrigen la deriva en recta;
`REV_MAX` limita la marcha atrás al corregir (subirlo si una curva de 90°
le cuesta al seguimiento normal).
