---
type: algoritmo
status: en-uso
created: 2026-10-28
---
# Algoritmo de seguimiento

Versión en curso: `firmware/arturito_v2/arturito_v2.ino`. La v1 (tabla de
casos sobre lecturas binarias) queda en `firmware/arturito/` como respaldo;
ya no es la que corre el robot.

## Arranque de competencia

El reglamento no permite tocar el robot una vez en carrera. El procedimiento
de salida tiene dos gestos: encenderlo en la mano y largarlo con un pulsador
ya apoyado en la pista. Por eso no hay prueba de motores ni ventana de
calibración.

- Al encender queda quieto, con los motores parados.
- La **largada** exige dos cosas a la vez: el pulsador (D8) presionado y
  S2 viendo la línea (`negrura > 0.6`) con los extremos S0 y S4 libres
  (`< 0.4`). S1 y S3 son indiferentes: por el grosor de la línea o la
  pose de salida pueden pisarla o no.
- El orden que da el pulsador permite verificar primero el LED del módulo
  S2 encendido — confirmación visual de que está leyendo la línea antes
  de largar. Cableado en [[esquema]].
- Si se apoya mal (S2 fuera de la línea o un extremo pisándola) el botón
  no hace nada: es la señal de reacomodarlo y volver a pulsar.
- Mantener el botón apretado mientras se baja el robot también sirve:
  arranca en cuanto S2 ve la línea.
- En el aire los cinco canales leen parecido, así que un toque accidental
  del pulsador sin la línea debajo no arranca nada.
- Una vez en carrera el pulsador queda inerte.

## Calibración adaptativa

`calMin[5]`/`calMax[5]` arrancan con los valores de laboratorio y se
ajustan solos. Detalle en [[calibracion]].

- Cada lectura expande el rango del canal con el extremo nuevo.
- Al dispararse la compuerta, la posición de salida siembra la pista
  real: el canal sobre negro guarda su lectura como `calMax` y el que
  está sobre blanco como `calMin`.

## Control: posición filtrada + PD

Cada canal se normaliza a negrura 0..1 y la posición es la media
ponderada con pesos -2..+2 (S0..S4). La posición cruda salta en escalones
al pasar de un sensor al siguiente, así que el control trabaja sobre
`posF`, un filtro EMA (`ALPHA = 0.4`), y la derivada se calcula sobre la
filtrada — eso corta el golpe que daba el salto discreto.

```
base = VEL_MAX - KS·|posF|        (mínimo VEL_MIN)
corr = KP·posF + KD·(posF - posPrev)
rueda = constrain(base ± corr, -REV_MAX, 255)
```

La reversa al corregir está limitada a `REV_MAX` (60): una rueda puede
morder sin que el robot pivote violento. La recuperación sí pivotea a
fondo, que es donde hace falta.

## Intersección comprometida

Cuando los cinco canales ven negro (cruce o bifurcación) el robot arma un
avance recto temporizado: `AVANCE_CRUCE_MS` (200 ms) a `VEL_CRUCE` sin
leer sensores. Entrar bamboleado a un cruce dejaba lecturas a medio
camino que podían mandarlo a un ramal; el tramo comprometido lo atraviesa
con rumbo firme.

`ultimoLado` se conserva al entrar al cruce: si el «todo negro» era una
esquina cerrada y no una intersección, la recuperación busca hacia el
lado correcto.

## Línea perdida

Sin línea (`suma < 0.3`): pivotea hacia `ultimoLado` a `VEL_BUSQUEDA`
durante `GIRO_BUSQUEDA_MS` (1.5 s); si no reaparece, rebobina retrocediendo
despacio a `VEL_REBOBINADO` todavía girando al mismo lado.

## Parámetros

| Constante | Valor | Qué regula |
|---|---|---|
| VEL_MAX / VEL_MIN | 180 / 70 | velocidad en recta y techo de curva |
| KP / KD | 40 / 25 | corrección proporcional y amortiguación |
| KS | 70 | cuánto baja la velocidad con el error |
| ALPHA | 0.4 | filtro EMA de la posición |
| REV_MAX | 60 | reversa máxima corrigiendo |
| N_ON / N_OFF | 0.6 / 0.4 | compuerta de arranque |
| VEL_CRUCE / AVANCE_CRUCE_MS | 140 / 200 ms | tramo ciego en intersección |
| VEL_BUSQUEDA / GIRO_BUSQUEDA_MS | 130 / 1.5 s | pivote de recuperación |
| VEL_REBOBINADO | 90 | retroceso si no reaparece la línea |
| TRIM_IZQ / TRIM_DER | 1.0 / 1.0 | deriva en recta, ajuste a mano |

El simulador del sitio (`web/assets/js/track.js`) porta este mismo
algoritmo: encendido con compuerta, calibración en marcha, PD filtrado y
cruce comprometido.
