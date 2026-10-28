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

## Datos clave del datasheet

- Lectura analógica con `analogRead` (0–1023)
- En este montaje: blanco da 30–40, negro da 970–990 → ver [[calibracion]]
- Lógica: valor > umbral = negro

## Librería y código

- Sin librería; `analogRead` directo en `firmware/arturito/arturito.ino`

## Relacionado

- [[componentes]] · [[calibracion]]
