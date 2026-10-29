---
type: manual
status: para-imprimir
created: 2026-10-29
---
# El programa de Arturito

Manual del firmware `arturito_v2`, el que corre el robot en el concurso.
Primero va el mapa completo y después cada proceso en detalle.

## De un vistazo

Arturito encendido no se mueve. Espera a que lo apoyen sobre la línea y
a que alguien pulse el botón de largada; recién ahí arranca. En marcha
lee sus cinco sensores unas doscientas veces por segundo, calcula en qué
posición queda la línea bajo el robot y corrige las ruedas en proporción.
Si ve una intersección avanza recto un tramo fijo sin leer, y si pierde
la línea la busca girando hacia el último lado donde la vio.

| Etapa | Qué hace |
|---|---|
| Encendido | motores parados, espera la largada |
| Largada | pulsador + línea centrada → arranca y siembra la calibración |
| Segundo click | detiene y vuelve a la espera de largada |
| Marcha | posición filtrada + corrección PD, velocidad según el error |
| Intersección | avance recto de 200 ms sin leer sensores |
| Línea perdida | pivote hacia el último lado 1.5 s → rebobinado |

## 1. Los ojos: cinco sensores infrarrojos

Cinco módulos TCRT5000 apuntan al suelo en punta de flecha: el del centro
(S2) va adelantado, los del medio (S1, S3) detrás de él y los de las
puntas (S0, S4) más atrás todavía. Cada uno devuelve un número entre 0 y
1023 según la luz que rebota: sobre el blanco del suelo lee cerca de 30,
sobre la cinta negra, cerca de 900.

La punta de flecha es a propósito. El sensor adelantado ve la curva antes
de que el robot llegue a ella — casi una lectura en profundidad — y los
laterales quedan cerca del eje de giro, donde lo que ven se parece a lo
que el robot gira de verdad.

## 2. La calibración que se hace sola

El programa no trae un umbral fijo para decidir «esto es negro». Cada
sensor normaliza su lectura entre su propio mínimo y máximo conocidos, en
una escala de 0 a 1 llamada **negrura**: 0 es el blanco más limpio que
vio, 1 es el negro más oscuro.

La calibración arranca con valores medidos en la mesa y se ajusta sola:

- **En la mano**, encendido, los cinco canales leen parecido. Cada
  lectura nueva ensancha el rango del canal.
- **Al apoyarlo sobre la línea**, la posición de salida siembra la pista
  real: el sensor que ve negro guarda su lectura como máximo y el que ve
  blanco como mínimo. La escala queda fijada en la primera lectura.
- **En marcha** cada canal sigue ensanchando su rango con cada extremo
  que descubre. S1 y S3 completan su calibración de negro en los primeros
  metros; S0 y S4, en la primera curva o cruce.

Si la pista del concurso lee distinto a la del taller — otra luz, otro
papel, otra cinta — el robot lo descubre solo, sin reprogramar nada.

## 3. La espera y la largada

El reglamento prohíbe tocar el robot una vez en carrera, así que la
salida se hace en dos gestos: encenderlo en la mano y largarlo con un
pulsador ya apoyado.

La largada exige dos condiciones a la vez:

- El **pulsador** presionado (pin D8, a masa con pull-up interno:
  presionado = LOW).
- La **línea centrada**: S2 con negrura mayor a 0.6 y los extremos S0 y
  S4 por debajo de 0.4. S1 y S3 no cuentan: por el grosor de la cinta o
  la pose de salida pueden estar pisándola o no.

Antes de pulsar se puede mirar el LED del módulo S2: encendido significa
que está viendo la línea. Si el botón no hace nada, la pose está mal —
S2 fuera de la línea o una punta pisándola — y toca reacomodar el robot.
Un toque accidental en el aire no arranca nada, porque los extremos
tampoco ven blanco limpio. Mantener el botón apretado mientras se baja el
robot también funciona: arranca en el instante en que S2 encuentra la
línea.

En carrera, un nuevo click **detiene** el robot y lo devuelve a la
espera. Para volver a ponerlo en marcha hay que soltar el botón y
pulsarlo de nuevo, con la misma regla de largada: S2 sobre la línea y
extremos libres.

## 4. Seguir la línea: posición, filtro y corrección

Cada ciclo, el programa convierte las cinco lecturas en un solo número:
la **posición** de la línea, una media ponderada con pesos -2, -1, 0, +1,
+2 de izquierda a derecha. Posición 0 es línea centrada bajo el robot;
+2 es línea a la derecha extrema.

La posición cruda salta en escalones al pasar de un sensor al siguiente,
y esos saltos eran el bamboleo. Por eso el control trabaja sobre `posF`,
la posición filtrada con una media exponencial (`ALPHA = 0.4`): cada
lectura nueva empuja el valor un 40 % hacia donde apunta, suavizando el
salto sin llegar tarde a las curvas.

Sobre esa posición corre un control **PD**:

```
base = VEL_MAX - KS · |posF|      → baja la velocidad cuanto más error
corr = KP · posF + KD · (posF - posPrev)
ruedas = base ± corr, limitadas entre -60 y 255
```

- `KP` es el giro proporcional: a más desvío, más diferencia de ruedas.
- `KD` frena el zigzag: si la posición viene cambiando rápido, resta
  impulso a la corrección.
- La reversa al corregir toca en 60: una rueda puede morder hacia atrás
  sin que el robot pivote violento.
- `TRIM_IZQ` y `TRIM_DER` corrigen que ningún par de motores gire
  exactamente igual; se ajustan a mano tras una prueba de recta.

## 5. Las intersecciones

Cuando los cinco canales ven negro a la vez — cruce, bifurcación o
esquina muy cerrada — el programa deja de leer: arma un avance recto
comprometido de 200 ms a velocidad moderada y lo cumple entero. Una
lectura a medio cruce podía mandarlo por un ramal equivocado; el tramo
ciego lo atraviesa con el rumbo firme.

Al entrar, la posición filtrada se resetea a cero para que la salida no
herede un golpe de la derivada. El último lado conocido de la línea se
conserva: si el «todo negro» era una esquina y no un cruce, la
recuperación que viene después sigue buscando hacia el lado correcto.

## 6. Cuando pierde la línea

Si ningún canal ve la línea (la suma de negruras cae debajo de 0.3), el
robot no se rinde:

- Los primeros 1.5 s **pivotea en el sitio** hacia el último lado donde
  vio la línea.
- Pasado ese tiempo **rebobina**: retrocede despacio, todavía girando al
  mismo lado, buscando el punto donde la perdió.

En cuanto un sensor vuelve a verla, el control normal retoma el mando.

## 7. Los números que se pueden tocar

| Constante | Valor | Qué pasa si se sube |
|---|---|---|
| VEL_MAX / VEL_MIN | 180 / 70 | más rápido en recta y en curva |
| KP | 40 | giros más agresivos, más zigzag |
| KD | 25 | más amortiguación, menos rebote |
| KS | 70 | más freno en las curvas |
| ALPHA | 0.4 | más suavidad, más retraso |
| REV_MAX | 60 | mordida más fuerte al corregir |
| VEL_CRUCE / AVANCE_CRUCE_MS | 140 / 200 ms | tramo ciego más largo |
| GIRO_BUSQUEDA_MS | 1500 | más tiempo pivotando antes de rebobinar |
| VEL_BUSQUEDA / VEL_REBOBINADO | 130 / 90 | búsqueda y retroceso más rápidos |
| TRIM_IZQ / TRIM_DER | 1.0 / 1.0 | compensa la deriva en recta |

El ajuste se hace en la pista de práctica: si zigzaguea, bajar KP o subir
KD; si se pasa en las curvas, subir KS o KD; si entra lento a los cruces,
subir VEL_CRUCE.
