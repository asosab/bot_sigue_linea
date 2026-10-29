---
type: esquema
status: registrado
created: 2026-10-28
---
# Esquema de cableado

Extraído de `firmware/arturito/arturito.ino` y verificado sobre el montaje
físico el 2026-10-28. Falta documentar la alimentación (VCC de sensores,
VMOT del driver, masa común).

## Sensores → UNO

| Señal | Pin |
|---|---|
| S0 (extremo izq.) | A0 |
| S1 (centro izq.) | A1 |
| S2 (centro) | A2 |
| S3 (centro der.) | A3 |
| S4 (extremo der.) | A4 |

## UNO → DRV8833

| Señal | Pin |
|---|---|
| IN1 (motor izq. adelante) | D5 |
| IN2 (motor izq. atrás) | D6 |
| IN3 (motor der. adelante) | D9 |
| IN4 (motor der. atrás) | D10 |
| EEP (nSLEEP, HIGH = despierto) | D4 |
| ULT (nFAULT, opcional) | D2 |

## Pulsador de largada → UNO

Un botón momentáneo aparte del de encendido: al pulsarlo el bot larga la
carrera si está bien apoyado (ver [[algoritmo]]). Permite verificar antes
que el LED del módulo S2 esté encendido, es decir, leyendo la línea.

| Tramo | Conexión |
|---|---|
| + batería → pulsador → resistencia ~4.7 k | D8 |
| D8 → resistencia 100 k | GND (pull-down) |

La resistencia en serie protege el pin: con 4×AA (~6 V) el exceso sobre
VCC drena por el diodo interno a corriente mínima; con una 18650 (~4.2 V)
sobra margen sobre el umbral de HIGH (~3 V a VCC 5 V). Alternativa igual
de válida y sin cuenta de voltaje: el pulsador al pin `5V` en vez de
`+BAT`, con el mismo pull-down. Otra opción sin resistencias: pull-up
interno (`INPUT_PULLUP`) y pulsador a GND, invirtiendo la lógica
(presionado = LOW) — quedó descartada para no invertir el cableado
propuesto.

## DRV8833 → motores

- OUT1/OUT2 → [[componente-hc02-48|motor izquierdo]]
- OUT3/OUT4 → motor derecho

Motor izquierdo: los cables llegaron invertidos y se corrigieron en el
conector (2026-10-28). Si un motor rueda al revés, se intercambian sus dos
cables en OUT o sus dos entradas IN; da igual por dónde.

## Relacionado

- [[hardware]] · [[componentes]]
