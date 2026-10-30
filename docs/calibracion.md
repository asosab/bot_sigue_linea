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

El PD de v3 (KP 6, KD 10, KS 5, ALPHA 0.55, en milímetros) arranca con
valores razonados, no medidos: afinar en la pista de práctica mirando el
zigzag y la salida de curvas. `TRIM_IZQ`/`TRIM_DER` corrigen la deriva en
recta. `DB_MM` cubre la zona donde los tres internos saturan (~5 mm);
bajarla si sobra suelto en recta, subirla si sigue bamboleando.

Dos constantes piden medición en el piso, con el sketch
`firmware/calibra_velocidad/` — corre sin USB: cada pulsada ejecuta un
tramo exacto y para. Datos y derivados en [[medicion-velocidad]].

- `MM_S_A_CRUCE` (mm/s a PWM 140): **medida 2026-10-29 = 264**. Seis
  corridas de 3 s sobre cinta métrica; el robot describe un arco
  (~30 cm a la izquierda por ~70 cm proyectados), así que la velocidad
  sale del largo del arco (~79 cm), no de la proyección de la regla.
- `PIVOTE_MS` (ms para girar 90° a `VEL_BUSQUEDA` = 110): pendiente.
  Con `MODO_PIVOTE = 1`, cada pulsada pivotea en el sitio 3 s. En el
  video se cuentan los cuartos de vuelta. De ahí sale también
  `PIVOTE2_MS` (el doble, el barrido del otro lado).
- `TRIM_DER = 0.93`: la rueda izquierda es ~6 % lenta
  (`e_izq/e_der = 0.936`, medida del 2026-10-30 al borde izquierdo).
  La corrida fina usa `VEL_DER = 238` contra izquierdo a 255.
