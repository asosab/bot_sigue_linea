---
type: componente
part: TCRT5000
status: verificado
created: 2026-10-28
---
# TCRT5000 (×5)

## Qué es y para qué va en el bot

Sensor IR reflectante (emisor + fototransistor). Cinco en fila leen la línea
y el fondo para que [[algoritmo]] decida hacia dónde corregir.

## Pines y cableado

| Sensor | Pin del Arduino | Posición |
|---|---|---|
| S0 | A0 | extremo izquierdo |
| S1 | A1 | centro izquierdo |
| S2 | A2 | centro |
| S3 | A3 | centro derecho |
| S4 | A4 | extremo derecho |

## Geometría del montaje (medida 2026-10-29)

Arreglo en flecha sobre cartón: S2 adelante, S1/S3 medios, S0/S4 atrás en
las puntas. Cada módulo mide 10 × 5 mm. Coordenadas desde el centro del
sensor (punto medio entre emisor y receptor) al punto medio del eje de
las ruedas: x lateral (+ derecha del bot), y hacia adelante.

| Sensor | x (mm) | y (mm) |
|---|---|---|
| S0 | −30 | +28 |
| S1 | −15 | +38 |
| S2 | 0 | +47 |
| S3 | +15 | +38 |
| S4 | +30 | +28 |

Fotos del montaje con regla: `imagen/sensores01..03.jpg`.

Tres consecuencias que usa [[algoritmo]]:

- Con la línea de 20 mm centrada solo S2 la ve: S1/S3 a ±15 mm quedan
  fuera de los ±10 mm de media línea. Hasta ~5 mm de desvío no hay señal
  de posición y el control la declara zona muerta en vez de corregir
  a ciegas.
- El paso lateral entre vecinos es 15 mm < 20 mm de línea: fuera de la
  zona muerta siempre hay un sensor pisándola, la posición es continua
  hasta los ±30 mm de las puntas.
- Las filas traseras (S1/S3 y S0/S4, a 10 mm entre sí) caben dentro de la
  banda de 20 mm de un cruce, así que «todo negro» sí puede leerse —
  en cruces y también en esquinas de 90°, por eso el historial separa
  una de otra.

## Datos clave del datasheet

- Lectura analógica con `analogRead` (0–1023); el cable de señal va al pin
  **AO** del módulo, no al DO
- En este montaje: blanco da ~28, negro da ~900 → ver [[calibracion]]
- Lógica: valor > umbral = negro
- Orden físico verificado el 2026-10-28: de izquierda a derecha del bot van
  S0, S1, S2, S3, S4 (coincide con la tabla de arriba)
- Módulo sin VCC: sus LEDs apagan y el canal lee ~1015 fijo = "negro"

## Librería y código

- Sin librería; `analogRead` directo en `firmware/arturito/arturito.ino`

## Relacionado

- [[componentes]] · [[calibracion]]
