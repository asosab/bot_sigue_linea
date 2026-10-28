---
type: firmware
status: compilado
created: 2026-10-28
---
# Firmware

Sketch actual: `firmware/arturito/arturito.ino` — registrado verbatim del
código que corre el robot.

- Placa: `arduino:avr:uno`
- Tamaño: 2706 B flash (8 %), 186 B RAM (9 %)
- `setup`: despierta el DRV8833 (`SLEEP_DRV` = D4 en HIGH, ver
  [[componente-drv8833]]) y luego corre la prueba de motores (800 ms
  adelante, 800 ms atrás) antes de seguir la línea — sirve de check en la
  salida
- `loop`: lee 5 sensores y aplica la tabla de casos de [[algoritmo]]
- Serie: 9600 baudios
- Diagnóstico del driver: `firmware/prueba_drv8833/` — barrido de pines
  con toggle de sleep por serie
- Diagnóstico de sensores: `firmware/prueba_sensores/` — solo lectura,
  driver dormido por EEP en LOW
- `firmware/arturito_v2/` — control continuo (posición ponderada + PD +
  velocidad adaptativa), autocalibración y recuperación con rebobinado

## Parámetros en código

| Constante | Valor |
|---|---|
| VEL_RAPIDA | 180 |
| VEL_MEDIA | 150 |
| VEL_LENTA | 120 |
| UMBRAL | 500 |

Calibración en [[calibracion]]. Compilar y subir: [[toolchain]].
