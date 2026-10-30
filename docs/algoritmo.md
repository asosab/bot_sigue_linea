---
type: algoritmo
status: en-uso
created: 2026-10-28
---
# Algoritmo de seguimiento

Versión en curso: `firmware/arturito_v3/arturito_v3.ino`. La v2 queda en
`firmware/arturito_v2/` como respaldo y la v1 en `firmware/arturito/`.

## Arranque de competencia

El reglamento no permite tocar el robot una vez en carrera. El procedimiento
de salida tiene dos gestos: encenderlo en la mano y largarlo con un pulsador
ya apoyado en la pista. Por eso no hay prueba de motores ni ventana de
calibración.

- Al encender queda quieto, con los motores parados.
- La **largada** exige dos cosas a la vez: el pulsador (D8, a GND con
  pull-up interno — presionado = LOW) y S2 viendo la línea
  (`negrura > 0.6`) con los extremos S0 y S4 libres (`< 0.4`). S1 y S3
  son indiferentes: por el grosor de la línea o la pose de salida pueden
  pisarla o no.
- El orden que da el pulsador permite verificar primero el LED del módulo
  S2 encendido — confirmación visual de que está leyendo la línea antes
  de largar. Cableado en [[esquema]].
- Si se apoya mal (S2 fuera de la línea o un extremo pisándola) el botón
  no hace nada: es la señal de reacomodarlo y volver a pulsar.
- Mantener el botón apretado mientras se baja el robot también sirve:
  arranca en cuanto S2 ve la línea.
- En el aire los cinco canales leen parecido, así que un toque accidental
  del pulsador sin la línea debajo no arranca nada.
- En carrera, un nuevo click **detiene** el robot y lo devuelve a la
  espera. Para relanzar hay que soltar el botón y pulsarlo de nuevo,
  con la misma regla de largada (línea centrada). El flanco de pulsado
  lleva antirrebote de 50 ms.

## Calibración adaptativa

`calMin[5]`/`calMax[5]` arrancan con los valores de laboratorio y se
ajustan solos. Detalle en [[calibracion]].

- Cada lectura expande el rango del canal con el extremo nuevo.
- Al dispararse la compuerta, la posición de salida siembra la pista
  real: el canal sobre negro guarda su lectura como `calMax` y el que
  está sobre blanco como `calMin`.

## Posición en milímetros

Los pesos de la media ponderada son las coordenadas laterales medidas del
arreglo (ver [[componente-tcrt5000]]): S0/S4 a ±30 mm, S1/S3 a ±15 mm y S2
al centro. La posición `posF` (filtrada con EMA, `ALPHA = 0.55`) queda en
milímetros reales, −30 izquierda a +30 derecha.

El montaje tiene una consecuencia medible: la línea de 20 mm cubre ±10 mm
y con el robot centrado solo S2 la ve, así que hasta ~5 mm de desvío no
hay señal de posición (S2 pesa cero en la ponderada). Fuera de esa zona
el paso de 15 mm entre sensores vecinos es menor que el ancho de línea y
la posición es continua hasta las puntas.
Corregir sobre esa zona muerta era el bamboleo en recta: el control se
aplica sobre `posE = posF − signo·DB_MM` (`DB_MM = 6`), que vale cero
dentro de la banda. Ahí el robot va a `VEL_MAX` pleno, sin corrección — el
turbo de recta sale solo.

```
posE = posF menos DB_MM hacia el centro   (0 dentro de la banda)
base = VEL_MAX − KS·|posE|                (mínimo VEL_MIN)
corr = KP·posE + KD·(posF − posPrev)      (0 si posE es 0)
rueda = constrain(base ± corr, RUEDA_MIN, 255)
```

`RUEDA_MIN` (40) mantiene las dos ruedas hacia adelante en toda corrección
normal: el robot dobla con diferencial sin frenar. La rueda quieta o en
reversa queda reservada a la curva comprometida y a la búsqueda.

## Memoria de posiciones

Un anillo de 16 muestras guarda las últimas posiciones válidas (`posF` con
línea a la vista). Se congela durante cruces, curvas comprometidas y
pérdidas, así que siempre responde cómo venía la pista antes del evento.
Dos usos:

- **Cruce o esquina**: al leer todo negro se mira `posF` de ~12 muestras
  atrás. Si supera ±8 mm la línea venía corrida — era una esquina y toca
  girar. Si venía centrada es un cruce y se atraviesa recto. Sin la
  memoria, una esquina de 90° entrando ladeada leía todo negro y el robot
  se lanzaba recto fuera de la pista.
- **Dirección de búsqueda**: al perder la línea, el promedio de las tres
  últimas posiciones da el lado real por donde salió, mejor que la última
  excursión grande del bamboleo.

## Intersección y curva comprometida

- **Cruce**: avance recto comprometido de `AVANCE_CRUCE_MM` (30 mm = banda
  de 20 mm que le queda por recorrer a la fila trasera + margen) a
  `VEL_CRUCE`, sin leer. Se convierte a tiempo con `MM_S_A_CRUCE`, la
  velocidad real medida en el piso.
- **Curva cerrada**: si solo un extremo ve la línea durante 3 ciclos, o si
  el todo-negro llegó con historial corrido, entra la curva comprometida:
  rueda externa a `VEL_CURVA_EXT` e interna quieta (aquí sí frena una rueda)
  hacia ese lado. Sale cuando el trío interno recupera la línea (mínimo
  `CURVA_MIN_MS` de giro) o al vencer `CURVA_MAX_MS`, que pasa a búsqueda.

Tras salir de curva o de búsqueda hay un asiento de `ASIENTO_MS` con la
velocidad capada a `VEL_ASIENTO`, para que el PD la recupere centrándola
en vez de salir disparado.

## Memoria persistente (EEPROM)

La UNO guarda un registro en EEPROM que sobrevive al apagado — pensado
para las corridas de prueba y las tres de la competencia:

- Al parar con el pulsador se guarda la corrida: tiempo largada→parada
  (ms), contadores de pérdidas, esquinas comprometidas y cruces, más la
  calibración `calMin`/`calMax` aprendida en la pista real.
- Al encender recarga la calibración de la última pista (la siguiente
  corrida arranca calibrada) e imprime por serie la tabla de hasta 8
  corridas con sus contadores — se consulta conectando el cable después.
- La compuerta de arranque acepta también lectura cruda de respaldo, por
  si la calibración persistida de otra pista comprime la negrura.

## Línea perdida: búsqueda sin 180

Sin línea durante `PERDIDA_MIN_CICLOS` arranca la búsqueda por fases, con
el lado que da el historial:

1. Pivote acotado hacia ese lado (`PIVOTE_MS`, ~90°): gira sobre el eje
   sin desplazarse — la rueda no sale de la pista buscando.
2. Arco hacia ese lado (`ARCO_MS`), corto y cerrado.
3. Pivote acotado de vuelta (`PIVOTE2_MS`).
4. Arco al lado contrario (`ARCO2_MS`), y se repite el ciclo.

Ninguna fase junta más de ~90° de rumbo respecto al rumbo de carrera, así
que el robot ya no puede terminar la búsqueda mirando para atrás — el
modo de v2 que giraba 1,5 s a contra-rotación y enganchaba la línea a
180° era el que lo devolvía a la largada. En cualquier fase, confirmar la
línea dos ciclos seguidos devuelve al PD con asiento.

## Parámetros

| Constante | Valor | Qué regula |
|---|---|---|
| VEL_MAX / VEL_MIN | 200 / 80 | velocidad centrado (turbo) y piso en curva |
| KP / KD | 6.0 / 10.0 | corrección por mm y amortiguación |
| KS | 5.0 | cuánto baja la velocidad con el error |
| ALPHA | 0.55 | filtro EMA de la posición |
| DB_MM | 6 | zona muerta (≈ la zona saturada del arreglo) |
| RUEDA_MIN | 40 | piso de la rueda interna corrigiendo |
| UMBRAL_LINEA / PERDIDA_MIN_CICLOS | 0.3 / 3 | línea a la vista y debounce de pérdida |
| N_ON / N_OFF | 0.6 / 0.4 | compuerta de arranque |
| VEL_CRUCE / AVANCE_CRUCE_MM | 140 / 30 mm | tramo ciego en intersección |
| MM_S_A_CRUCE | 264 mm/s | velocidad real a PWM 140 ([[medicion-velocidad]]) |
| VEL_CURVA_EXT / VEL_CURVA_INT | 150 / 0 | ruedas en la curva comprometida |
| CURVA_MIN_MS / CURVA_MAX_MS | 90 / 500 | giro mínimo y techo de la curva |
| EXTREMO_CICLOS / NEG_EXT | 2 / 0.45 | persistencia del solo-extremo |
| POS_ESQ_MM / HIST_CRUCE | 8 mm / 12 | historial que separa esquina de cruce |
| VEL_ARCO_EXT / VEL_ARCO_INT | 110 / 25 | ruedas del arco de búsqueda |
| VEL_BUSQUEDA / PIVOTE_MS | 110 / 280 ms | pivote acotado (~90°, medir) |
| ARCO_MS / ARCO2_MS / PIVOTE2_MS | 400 / 500 / 560 | fases de la búsqueda |
| ASIENTO_MS / VEL_ASIENTO | 250 / 120 | velocidad capada tras recuperar |
| TRIM_IZQ / TRIM_DER | 1.0 / 1.05 | compensa viraje derecha ([[medicion-velocidad]]) |

El simulador del sitio (`web/assets/js/track.js`) porta el algoritmo de la
v2; falta migrarlo a esta versión (posición en mm, zona muerta, historial,
curva comprometida y búsqueda por fases).
