---
type: medicion
status: medido
created: 2026-10-29
---
# Medición de velocidad en el piso (PWM 140)

Prueba del sketch `firmware/calibra_velocidad/` (2026-10-29), batería al
100 %, sin USB: cada pulsada corre 3 s exactos a PWM 140 con el LED
marcando el tramo en el video. Seis corridas filmadas sobre cinta
métrica.

## Datos crudos

| Prueba | cm a los 2 s | cm a los 3 s | lateral izq. |
|---|---|---|---|
| 1 | 49.5 | 70.0 | ~30 cm |
| 2 | — | 69.5 | ~30 cm |
| 3 | 50.0 | 71.0 | ~30 cm |
| 4 | 49.0 | 70.5 | ~30 cm |
| 5 | 48.0 | 72.5 | ~30 cm |
| 6 | 47.2 | 72.5 | ~30 cm |
| **media** | **48.7** | **71.0** | **~30** |

Dispersión entre corridas: ±1,5 cm sobre 71 → piso de ruido ~±5 %.

## Derivado

- El robot no va recto: derrapa ~30 cm a la izquierda por cada ~70 cm
  de avance proyectado. La regla mide proyección; el camino real es un
  arco.
- Arco circular estimado: `tan(φ/2) = 30/71` → giro de ~46° y radio
  ~99 cm. Longitud de arco ≈ 79 cm en 3 s.
- **Velocidad real ≈ 264 mm/s a PWM 140** → `MM_S_A_CRUCE = 264` en
  `arturito_v3`. La lectura ingenua de la regla (71 cm/3 s = 237 mm/s)
  queda corta porque ignora el arco; la del último segundo (~226) igual.
  El «tercer segundo más lento» no es desaceleración: es la proyección
  de una velocidad que gira.
- El rumbo crece ~23° por metro recorrido: la rueda izquierda corre
  ~12 % menos que la derecha → `TRIM_DER` **0.88**. Cálculo con el
  ancho de vía medido, `w = 131 mm` (156 mm borde a borde menos
  2 × 25 mm de rueda): `v_izq/v_der = (2R−w)/(2R+w) ≈ 0.876`.
  Falta una corrida de verificación para confirmar que va recto.

## Geometría del arreglo de sensores

Medida al centro de cada módulo (10 × 5 mm) respecto al punto medio del
eje de las ruedas; x lateral (+ derecha), y hacia adelante.
Detalle en [[componente-tcrt5000]].

| Sensor | x (mm) | y (mm) |
|---|---|---|
| S0 | −30 | +28 |
| S1 | −15 | +38 |
| S2 | 0 | +47 |
| S3 | +15 | +38 |
| S4 | +30 | +28 |

## Segunda tanda: lateralidad a alta potencia (2026-10-30)

Mismo sketch, otra configuración: `VEL_IZQ = 255` a plena potencia y
`VEL_DER = 224` (255 × 0.876, la primera estimación). Protocolo nuevo
sin video: frente en 0 cm y 8 cm de separación al borde derecho; se
mide distancia recorrida y separación final.

| Prueba | cm recorridos (3 s) | separación final a la derecha |
|---|---|---|
| 1 | 94.8 | 31.7 |
| 2 | 96.0 | 28.0 |
| 3 | 95.9 | 27.0 |
| 4 | 94.8 | 31.9 |
| 5 | 94.6 | 35.5 |
| 6 | 94.2 | 34.0 |
| **media** | **95.1** | **31.4** |

## Derivado

- Separación al borde derecho creció de 8 a ~31 cm: siguió curvando a
  la izquierda ~23 cm por 95 cm — menos que en la primera tanda
  (0,24 contra 0,42 cm/cm), el recorte ayudó pero quedó corto.
- Arco: radio ~208 cm → `v_L/v_R = 0.939` a PWM 255/224 →
  `e_izq/e_der = 0.825` a esta potencia, cuando a 140 era 0.876.
  La rueda izquierda es la lenta y su desventaja crece con el PWM:
  no hay un solo trim que valga para todo el rango.
- Velocidad a 255: ~95 cm proyectados en 3 s → ~32 cm/s proyectados,
  ~34 cm/s de arco (~340 mm/s).
- La lectura intermedia (TRIM 0.88 a PWM 140 «empeoró» a ojo) queda
  reconciliada: el valor era insuficiente, no de lado equivocado.

## Decisiones que salen de acá

- `MM_S_A_CRUCE = 264` — convierte `AVANCE_CRUCE_MM` (30 mm) en ~114 ms
  de tramo ciego de cruce.
- `TRIM_DER = 0.85` en la v3: compromiso del rango de carrera
  (140–255). La verificación fina corre con `VEL_DER = 210`
  (255 × 0.825).
- `PIVOTE_MS` sigue sin medir: falta la corrida con `MODO_PIVOTE = 1`.

## Relacionado

- [[calibracion]] · [[algoritmo]] · [[firmware]]
