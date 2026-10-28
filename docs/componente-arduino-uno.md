---
type: componente
part: Arduino UNO
status: verificado
created: 2026-10-28
---
# Arduino UNO

## Qué es y para qué va en el bot

Placa del robot. Lee los 5 sensores analógicos y manda PWM al
[[componente-drv8833]].

## Pines usados

- Entradas: A0–A4 (sensores [[componente-tcrt5000]])
- Salidas PWM: D5, D6, D9, D10 (IN1–IN4 del driver)
- Serie: 9600 baudios para depurar

## Datos clave

- FQBN: `arduino:avr:uno`
- Sketch actual: `firmware/arturito/arturito.ino` (2692 B flash, 186 B RAM)

## Relacionado

- [[componentes]] · [[hardware]] · [[firmware]]
