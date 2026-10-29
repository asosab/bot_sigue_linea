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

| Terminal del pulsador | Va a |
|---|---|
| un lado | D8 (header digital, entre D7 y D9) |
| otro lado | GND — cualquier masa: el pin GND del header POWER (junto a Vin y 5V), el GND del header digital (entre AREF y D13) o el riel de masa de la protoboard |

El pin usa el pull-up interno (`INPUT_PULLUP`): reposo = HIGH,
presionado = LOW. **No lleva resistencias** — dos cables y listo.

Nota de por qué no a `5V`: un pulsador entre `5V` y D8 obliga a un
pull-down de 100 k a GND, porque sin él el pin queda flotando al soltar
y lee disparos falsos — una largada fantasma en plena pista. Con pull-up
interno el reposo queda definido por el propio Arduino y no hace falta
nada externo. Si algún día se prefiere el cable a `5V` igual: se agrega
el pull-down y en el código `digitalRead(BTN) == LOW` pasa a `== HIGH`.

## DRV8833 → motores

- OUT1/OUT2 → [[componente-hc02-48|motor izquierdo]]
- OUT3/OUT4 → motor derecho

Motor izquierdo: los cables llegaron invertidos y se corrigieron en el
conector (2026-10-28). Si un motor rueda al revés, se intercambian sus dos
cables en OUT o sus dos entradas IN; da igual por dónde.

## Relacionado

- [[hardware]] · [[componentes]]
