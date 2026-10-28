---
type: firmware
status: compilado
created: 2026-10-28
---
# Firmware

Sketch actual: `firmware/arturito/arturito.ino` — registrado verbatim del
código que corre el robot.

- Placa: `arduino:avr:uno`
- Tamaño: 2692 B flash (8 %), 186 B RAM (9 %)
- `setup`: prueba de motores (800 ms adelante, 800 ms atrás) antes de seguir
  la línea — sirve de check en la salida
- `loop`: lee 5 sensores y aplica la tabla de casos de [[algoritmo]]
- Serie: 9600 baudios

## Parámetros en código

| Constante | Valor |
|---|---|
| VEL_RAPIDA | 180 |
| VEL_MEDIA | 150 |
| VEL_LENTA | 120 |
| UMBRAL | 500 |

Calibración en [[calibracion]]. Compilar y subir: [[toolchain]].
