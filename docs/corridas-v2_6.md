---
type: registro
status: pendiente-de-corridas
created: 2026-10-30
---
# Registro de corridas — Arturito v2.6

Pruebas de la regla de marcha del vecino (`EXT_MARCHA`, propuesta en
[[propuesta-ext-marcha]]). Misma pista, misma superficie, misma pose
de largada y misma batería. Mínimo 3 vueltas por nivel:

- **A — `EXT_MARCHA 0`**: línea base v2.5 con instrumentación (`e1`/`e3`).
- **B — `EXT_MARCHA 1`**: solo veta `ext`.
- **C — `EXT_MARCHA 2`**: veta `ext` y enmascara la punta ajena.

Para cada corrida anotar el `MUESTRA_MS` usado y detener con el
pulsador justo después de la zona de interés. **Estado**: `MUESTRA_MS =
1000` fijo en las tres tandas; la placa quedó en nivel B
(`EXT_MARCHA 1`) tras cerrar A1-A3 el 2026-10-30.

| # | Nivel | `MUESTRA_MS` | Tiempo | Perdidas | Curvas ext falsas | Curvas ext reales | Veto a masa ajena | Veto a esquina real | Timeouts de curva | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | 0 | 1000 | 14,67 s | 24 | — | — | — | — | — | 2 disparos ext: +2,21 (e3=12 → habría vetado) salió `curva-ok`; +10,04 (e3=6 → pasaba) salió `curva-barrida`. Clasificación real/falsa pendiente del humano |
| A2 | 0 | 1000 | 9,14 s | 12 | — | — | — | — | — | 2 disparos ext, ambos `curva-ok`: +2,25 (e3=31 → habría vetado) y +5,83 (e3=46 → habría vetado). Si son esquinas reales, la marcha las hubiera bloqueado a las dos. Clasificación pendiente |
| A3 | 0 | 1000 | 6,32 s | 11 | — | — | — | — | — | 1 disparo ext +1,07 (e3=39 → habría vetado), salió `curva-barrida`. Terminó buscando en vacío. Clasificación pendiente |

```text
A1 (nivel 0): Ultima corrida: 14.67 s | perdidas 24 esquinas 2 cruces 0 | pista 8-793 (vistos 0-866)
  +0.51 busq*-der | p28 | v254 0 | 0 4 8 40 12 | e1 255 e3 21
  +0.63 pausa | p28 | v110 -110 | 4 8 4 64 524 | e1 255 e3 41
  +1.00 mue | p14 | v166 92 | 0 0 28 52 0 | e1 255 e3 2
  +1.00 busq*-der | p14 | v166 92 | 0 0 32 40 0 | e1 255 e3 3
  +1.09 pausa | p-11 | v110 -110 | 20 384 16 60 0 | e1 0 e3 17
  +1.16 busq*-izq | p-9 | v94 148 | 4 132 8 40 12 | e1 3 e3 29
  +1.38 pausa | p-9 | v24 110 | 0 280 4 68 16 | e1 0 e3 65
  +1.49 busq*-izq | p-14 | v40 228 | 32 60 12 16 4 | e1 3 e3 84
  +1.53 pausa | p-12 | v24 110 | 0 304 12 32 0 | e1 0 e3 91
  +1.65 busq*-izq | p-13 | v40 218 | 32 4 44 28 0 | e1 3 e3 110
  +1.69 pausa | p1 | v24 110 | 0 4 360 32 16 | e1 10 e3 117
  +1.77 busq*-izq | p0 | v120 122 | 8 20 4 44 8 | e1 23 e3 131
  +1.80 pausa | p15 | v24 110 | 0 0 4 296 4 | e1 28 e3 0
  +2.00 mue | p14 | v160 80 | 0 4 12 516 4 | e1 61 e3 0
  +2.21 curva-der/ext | p29 | v254 0 | 8 4 8 36 712 | e1 18 e3 12
  +2.56 curva-ok | p29 | v150 -70 | 4 8 288 816 0 | e1 77 e3 0
  +2.68 busq-izq | p-13 | v40 240 | 0 56 8 36 12 | e1 3 e3 9
  +2.91 pausa | p-27 | v-110 110 | 332 32 0 20 8 | e1 40 e3 46
  +3.00 mue | p-13 | v82 160 | 272 340 0 20 0 | e1 0 e3 63
  +3.08 busq*-izq | p-24 | v0 254 | 16 4 12 32 16 | e1 7 e3 76
  +4.00 mue | p-24 | v110 -110 | 16 20 0 20 0 | e1 160 e3 229
  +4.93 pausa | p-28 | v-110 110 | 380 8 0 16 4 | e1 255 e3 255
  +5.00 busq*-izq | p-24 | v0 254 | 28 0 4 20 8 | e1 255 e3 255
  +5.01 mue | p-24 | v-110 110 | 24 12 4 12 0 | e1 255 e3 255
  +5.33 pausa | p15 | v24 110 | 0 0 0 356 16 | e1 27 e3 0
  +5.93 busq-der | p13 | v166 94 | 0 0 28 20 0 | e1 128 e3 3
  +6.01 mue | p13 | v110 -110 | 16 16 40 92 0 | e1 141 e3 16
  +6.04 pausa | p-12 | v110 -110 | 20 300 12 28 0 | e1 0 e3 22
  +6.11 busq*-izq | p-12 | v84 158 | 16 32 28 20 0 | e1 3 e3 33
  +6.16 pausa | p-10 | v-110 110 | 40 304 4 56 8 | e1 0 e3 41
  +6.31 busq*-izq | p-23 | v0 242 | 20 0 8 24 8 | e1 16 e3 67
  +7.01 mue | p-23 | v110 -110 | 4 16 0 36 4 | e1 132 e3 183
  +8.01 mue | p-23 | v-110 110 | 24 4 0 24 0 | e1 255 e3 255
  +8.19 pausa | p-24 | v-110 110 | 288 12 0 32 16 | e1 255 e3 255
  +8.28 busq*-izq | p-24 | v0 252 | 12 8 8 28 12 | e1 255 e3 255
  +8.32 pausa | p-13 | v-110 110 | 8 356 0 28 12 | e1 0 e3 255
  +8.42 busq*-izq | p-13 | v84 158 | 8 84 0 20 8 | e1 3 e3 255
  +8.45 pausa | p-14 | v-110 110 | 16 304 0 12 0 | e1 0 e3 255
  +8.54 busq*-izq | p-13 | v84 158 | 16 0 68 16 0 | e1 3 e3 255
  +8.59 pausa | p0 | v-110 110 | 12 20 300 24 0 | e1 12 e3 255
  +8.65 busq*-izq | p0 | v120 122 | 16 20 4 108 0 | e1 21 e3 255
  +8.65 pausa | p13 | v-110 110 | 20 20 4 328 0 | e1 22 e3 0
  +8.87 busq*-izq | p-11 | v88 154 | 4 4 0 36 8 | e1 3 e3 8
  +8.92 pausa | p-26 | v24 110 | 288 0 8 24 12 | e1 12 e3 17
  +9.02 mue | p-23 | v0 242 | 164 4 8 28 12 | e1 28 e3 33
  +9.08 busq*-izq | p-19 | v0 224 | 40 8 8 32 16 | e1 38 e3 43
  +9.49 pausa | p-28 | v110 -110 | 304 24 0 8 0 | e1 106 e3 111
  +9.61 busq*-izq | p-24 | v0 254 | 16 32 4 24 48 | e1 127 e3 132
  +9.63 pausa | p-9 | v110 -110 | 12 308 20 72 304 | e1 0 e3 135
  +10.02 mue | p1 | v192 196 | 12 16 444 44 804 | e1 51 e3 3
  +10.04 curva-der/ext | p22 | v254 0 | 4 24 16 40 732 | e1 54 e3 6
  +10.71 curva-barrida | p22 | v150 -70 | 4 496 32 28 8 | e1 0 e3 11
  +10.83 busq-izq | p-11 | v90 152 | 24 32 16 52 20 | e1 3 e3 31
  +10.84 pausa | p-25 | v-110 110 | 452 28 8 44 16 | e1 5 e3 33
  +11.02 busq*-izq | p-24 | v0 254 | 156 0 8 24 8 | e1 34 e3 63
  +11.02 mue | p-24 | v-110 110 | 204 16 4 16 0 | e1 35 e3 64
  +11.05 pausa | p-27 | v-110 110 | 284 16 0 20 0 | e1 39 e3 68
  +11.51 busq*-izq | p0 | v196 198 | 4 12 16 28 0 | e1 12 e3 145
  +11.52 pausa | p13 | v-110 110 | 16 24 0 364 0 | e1 13 e3 0
  +11.66 busq*-der | p24 | v254 0 | 4 4 8 20 12 | e1 36 e3 5
  +12.02 mue | p24 | v110 24 | 8 16 0 24 4 | e1 97 e3 66
  +13.02 mue | p24 | v24 110 | 0 0 4 20 4 | e1 255 e3 232
  +14.03 mue | p24 | v110 24 | 8 16 0 16 0 | e1 255 e3 255
  +14.66 stop | p24 | v0 0 | 24 20 12 28 8 | e1 255 e3 255
```

```text
A2 (nivel 0): Ultima corrida: 9.14 s | perdidas 12 esquinas 2 cruces 0 | pista 12-789 (vistos 0-855)
  +0.38 busq-der | p14 | v166 84 | 4 8 16 28 16 | e1 241 e3 3
  +0.39 pausa | p29 | v110 -110 | 0 0 0 24 288 | e1 243 e3 5
  +0.58 busq*-der | p27 | v254 0 | 8 8 16 44 32 | e1 255 e3 35
  +0.62 pausa | p27 | v110 -110 | 12 8 20 48 292 | e1 255 e3 42
  +1.00 mue | p6 | v178 154 | 20 24 296 56 0 | e1 255 e3 1
  +1.03 busq*-der | p1 | v192 194 | 16 16 44 36 0 | e1 255 e3 6
  +1.09 pausa | p-11 | v110 -110 | 28 380 0 52 4 | e1 0 e3 16
  +1.16 busq*-izq | p-12 | v40 216 | 24 32 16 12 12 | e1 3 e3 28
  +1.46 pausa | p-15 | v24 110 | 0 288 12 8 8 | e1 0 e3 78
  +1.77 busq*-izq | p0 | v196 200 | 0 8 44 0 8 | e1 17 e3 130
  +1.84 pausa | p14 | v24 110 | 8 8 12 488 16 | e1 28 e3 0
  +2.00 mue | p7 | v176 64 | 180 192 32 608 4 | e1 0 e3 0
  +2.25 curva-der/ext | p29 | v254 0 | 8 8 12 92 468 | e1 40 e3 31
  +2.41 curva-ok | p29 | v150 0 | 12 16 292 640 8 | e1 68 e3 0
  +2.52 busq-izq | p-15 | v0 246 | 12 36 12 12 16 | e1 3 e3 14
  +2.77 pausa | p-29 | v-110 110 | 272 20 0 4 4 | e1 44 e3 55
  +2.92 busq*-izq | p-25 | v0 250 | 16 12 16 20 16 | e1 70 e3 81
  +3.00 mue | p-25 | v24 110 | 0 8 12 20 16 | e1 83 e3 94
  +4.00 mue | p-25 | v110 24 | 16 24 4 12 8 | e1 251 e3 255
  +4.62 pausa | p-25 | v-110 110 | 272 32 16 28 8 | e1 255 e3 255
  +4.95 busq*-izq | p-27 | v0 254 | 152 4 12 12 12 | e1 255 e3 255
  +5.01 mue | p-27 | v-110 110 | 184 32 0 0 4 | e1 255 e3 255
  +5.04 pausa | p-29 | v-110 110 | 272 16 0 4 4 | e1 255 e3 255
  +5.14 busq*-izq | p-28 | v0 254 | 28 12 12 12 12 | e1 255 e3 255
  +5.19 pausa | p-15 | v-110 110 | 20 316 8 4 4 | e1 0 e3 255
  +5.31 busq*-izq | p-13 | v40 218 | 36 32 32 12 8 | e1 3 e3 255
  +5.36 pausa | p0 | v-110 110 | 12 20 272 8 4 | e1 12 e3 255
  +5.40 busq*-izq | p0 | v120 122 | 12 20 4 12 4 | e1 18 e3 255
  +5.42 pausa | p14 | v-110 110 | 12 16 4 316 8 | e1 21 e3 0
  +5.83 curva-der/ext | p29 | v254 0 | 8 8 16 12 468 | e1 89 e3 46
  +6.01 curva-ok | p29 | v150 0 | 12 532 292 808 12 | e1 0 e3 0
  +6.01 mue | p29 | v150 0 | 12 532 292 808 12 | e1 0 e3 0
  +6.13 busq-der | p13 | v156 84 | 12 12 28 20 0 | e1 9 e3 3
  +7.01 mue | p13 | v-110 110 | 28 32 16 4 4 | e1 156 e3 150
  +8.01 mue | p13 | v110 -110 | 28 32 12 12 0 | e1 255 e3 255
  +9.01 mue | p13 | v-110 110 | 4 20 4 4 8 | e1 255 e3 255
  +9.14 stop | p13 | v0 0 | 20 36 0 0 4 | e1 255 e3 255
```

```text
A3 (nivel 0): Ultima corrida: 6.32 s | perdidas 11 esquinas 1 cruces 0 | pista 13-788 (vistos 0-886)
  +0.10 busq-der | p-1 | v190 192 | 4 4 116 12 12 | e1 193 e3 193
  +0.13 pausa | p0 | v110 -110 | 8 20 412 32 32 | e1 199 e3 199
  +0.22 busq*-der | p0 | v120 122 | 0 8 24 8 8 | e1 214 e3 214
  +0.27 pausa | p0 | v110 -110 | 4 12 304 12 8 | e1 222 e3 222
  +0.34 busq*-der | p0 | v120 122 | 8 20 28 16 24 | e1 234 e3 234
  +0.41 pausa | p-14 | v110 -110 | 24 272 20 4 8 | e1 0 e3 245
  +0.51 busq*-izq | p-12 | v86 154 | 20 172 40 16 16 | e1 0 e3 255
  +0.57 pausa | p-1 | v-110 110 | 24 36 312 4 4 | e1 3 e3 255
  +0.63 busq*-izq | p0 | v120 122 | 16 20 4 20 16 | e1 14 e3 255
  +0.66 pausa | p14 | v-110 110 | 16 20 8 288 16 | e1 19 e3 0
  +1.00 mue | p29 | v254 0 | 12 8 16 16 436 | e1 75 e3 27
  +1.07 curva-der/ext | p29 | v254 0 | 12 8 12 20 348 | e1 87 e3 39
  +1.58 curva-barrida | p29 | v150 -70 | 276 24 40 0 4 | e1 15 e3 44
  +1.68 busq-izq | p-27 | v0 254 | 28 12 16 12 16 | e1 31 e3 61
  +1.85 pausa | p-26 | v-110 110 | 284 28 12 20 20 | e1 61 e3 90
  +2.00 mue | p-27 | v0 254 | 376 12 16 16 28 | e1 85 e3 114
  +2.19 busq*-izq | p-13 | v92 172 | 16 60 124 16 12 | e1 3 e3 147
  +2.22 pausa | p0 | v-110 110 | 16 24 284 16 16 | e1 7 e3 151
  +2.26 busq*-izq | p0 | v120 122 | 16 24 12 36 16 | e1 14 e3 158
  +2.27 pausa | p14 | v-110 110 | 20 20 8 416 8 | e1 16 e3 0
  +2.55 busq*-der | p18 | v254 0 | 12 12 16 24 24 | e1 14 e3 14
  +2.83 pausa | p29 | v110 24 | 12 12 8 12 292 | e1 61 e3 61
  +3.00 mue | p29 | v254 0 | 12 8 12 292 376 | e1 89 e3 0
  +3.13 busq*-der | p12 | v168 104 | 8 56 32 24 0 | e1 110 e3 3
  +3.16 pausa | p-14 | v110 24 | 16 400 12 12 12 | e1 0 e3 9
  +3.31 busq*-izq | p-27 | v0 254 | 20 12 16 16 12 | e1 19 e3 33
  +4.00 mue | p-27 | v110 -110 | 24 20 28 4 8 | e1 135 e3 149
  +5.00 mue | p-27 | v24 110 | 8 20 24 12 8 | e1 255 e3 255
  +6.01 mue | p-27 | v110 24 | 16 16 0 8 8 | e1 255 e3 255
  +6.31 stop | p-27 | v0 0 | 16 24 8 12 8 | e1 255 e3 255
```

Pendiente de corridas. Debajo de cada fila va la traza completa tal
como sale por serie (`t`, 9600, robot detenido).

## Criterio de decisión

- C cumple los 4 criterios → queda `EXT_MARCHA 2`.
- C falla solo en veto a esquina real pero B lo cumple → `EXT_MARCHA 1`.
- B también falla → `EXT_MARCHA 0` y probar `MARCHA_MS` 90 y 120.
