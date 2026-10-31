---
type: registro
status: cerrado
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
1000` fijo en las tres tandas; la placa quedó en nivel C
(`EXT_MARCHA 2`) tras cerrar B1-B3 el 2026-10-30 — el nivel 2 sí
registra los eventos `ext-veto-izq/der` en la traza.

| # | Nivel | `MUESTRA_MS` | Tiempo | Perdidas | Curvas ext falsas | Curvas ext reales | Veto a masa ajena | Veto a esquina real | Timeouts de curva | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | 0 | 1000 | 14,67 s | 24 | — | — | — | — | — | 2 disparos ext: +2,21 (e3=12 → habría vetado) salió `curva-ok`; +10,04 (e3=6 → pasaba) salió `curva-barrida`. Clasificación real/falsa pendiente del humano |
| A2 | 0 | 1000 | 9,14 s | 12 | — | — | — | — | — | 2 disparos ext, ambos `curva-ok`: +2,25 (e3=31 → habría vetado) y +5,83 (e3=46 → habría vetado). Si son esquinas reales, la marcha las hubiera bloqueado a las dos. Clasificación pendiente |
| A3 | 0 | 1000 | 6,32 s | 11 | — | — | — | — | — | 1 disparo ext +1,07 (e3=39 → habría vetado), salió `curva-barrida`. Terminó buscando en vacío. Clasificación pendiente |
| B1 | 1 | 1000 | 14,46 s | 28 | — | — | — | — | 1 | Solo 1 disparo ext en toda la corrida (+5,37, s4=820, e3=1 → pasó) y terminó `curva-timeout`. El nivel 1 vetó el resto en silencio — el evento `ext-veto` solo se registra en nivel 2. Mismo ping-pong busq/pausa que en A |
| B2 | 1 | 1000 | 11,37 s | 13 | — | — | — | — | 1 | 1 disparo ext +2,20 (s4=864, e3=7 → pasó) → `curva-timeout`. Vetos silenciosos en punta sola con e3 alto. **Físico: pasó el desvío ligero, atravesó la X y se perdió antes de los tres giros a la izquierda** |
| B3 | 1 | 1000 | 14,42 s | 29 | — | — | — | — | 1 | 1 disparo ext +12,97 (s4=700, e3=2 → pasó) → `curva-timeout`. **Físico: atravesó la X y su lazo; en el cruce siguiente a la derecha se perdió y volvió en dirección contraria, perdiéndose dentro del lazo de la X** |
| C1 | 2 | 1000 | 12,39 s | 40 | — | — | ~28 | 1 | 0 | Tormenta de `ext-veto-izq` de +8,81 a +9,38 (~28 vetos en 570 ms): s0 leía 250-470 con trío vacío y e1 alto. **Físico: siguió de largo tras el segundo giro a la izquierda — la punta veía la línea real de la tercera esquina del lazo, vetada por la marcha y enmascarada del centroide → no volvió. Veto a esquina real + recuperación cegada.** El anillo se saturó y borró el inicio |
| B4 | 1 | 1000 | 8,42 s | 21 | — | — | — | — | 1 | 1 disparo ext +0,41 (s4=716, e3=2 → pasó) → `curva-timeout`. **Físico: se saltó el lazo siguiendo el camino de salida** |
| B5 | 1 | 1000 | 12,82 s | 25 | — | — | — | — | 0 | Cero disparos ext en toda la corrida — la marcha bloqueó todo o la punta nunca persistió. Pista más oscura (negro ~664). **Físico: atravesó el lazo con dificultad y se perdió en el cruce a la derecha posterior, mismo punto que B3 y C1** |

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

```text
B1 (nivel 1): Ultima corrida: 14.46 s | perdidas 28 esquinas 1 cruces 0 | pista 13-738 (vistos 0-886)
  +0.67 busq*-izq | p-12 | v40 214 | 36 16 36 20 12 | e1 3 e3 255
  +0.72 pausa | p14 | v-110 110 | 20 24 8 412 8 | e1 11 e3 0
  +0.85 busq*-der | p14 | v160 80 | 12 16 20 28 12 | e1 32 e3 3
  +0.86 pausa | p28 | v110 24 | 12 16 8 20 260 | e1 35 e3 6
  +1.00 mue | p27 | v254 0 | 12 12 16 36 40 | e1 57 e3 28
  +1.00 busq*-der | p27 | v254 0 | 16 16 16 32 32 | e1 58 e3 29
  +1.26 pausa | p28 | v110 24 | 12 16 12 20 288 | e1 101 e3 72
  +1.61 busq*-der | p12 | v170 108 | 0 8 156 32 12 | e1 160 e3 3
  +1.63 pausa | p1 | v110 24 | 12 16 272 48 16 | e1 162 e3 5
  +1.80 busq*-izq | p-10 | v96 144 | 16 32 20 44 24 | e1 3 e3 34
  +1.83 pausa | p-22 | v24 110 | 296 16 20 44 24 | e1 7 e3 38
  +2.00 mue | p-25 | v0 254 | 452 16 16 32 24 | e1 35 e3 67
  +2.31 busq*-izq | p-12 | v50 230 | 16 152 40 32 12 | e1 0 e3 118
  +2.33 pausa | p4 | v24 110 | 4 276 72 516 16 | e1 0 e3 0
  +2.61 busq*-der | p26 | v254 0 | 12 8 16 44 20 | e1 33 e3 24
  +3.00 mue | p26 | v-110 110 | 12 16 12 28 16 | e1 98 e3 89
  +3.61 pausa | p-26 | v24 110 | 256 16 12 32 12 | e1 201 e3 192
  +3.86 busq*-izq | p0 | v120 122 | 16 24 8 44 16 | e1 6 e3 232
  +3.86 pausa | p14 | v110 24 | 16 24 12 340 16 | e1 7 e3 0
  +3.97 busq*-der | p14 | v160 80 | 8 12 20 32 76 | e1 25 e3 3
  +3.98 pausa | p28 | v24 110 | 8 4 12 36 292 | e1 26 e3 4
  +4.00 mue | p28 | v254 0 | 12 20 20 44 672 | e1 30 e3 8
  +4.09 busq*-der | p28 | v254 0 | 8 8 16 32 24 | e1 45 e3 23
  +4.28 pausa | p26 | v110 -110 | 16 24 20 28 320 | e1 76 e3 54
  +4.56 busq*-der | p28 | v254 0 | 12 8 16 24 28 | e1 124 e3 101
  +4.71 pausa | p28 | v110 -110 | 12 8 16 28 352 | e1 148 e3 126
  +5.00 mue | p14 | v166 84 | 4 8 16 824 16 | e1 197 e3 0
  +5.37 curva-der/ext | p21 | v254 0 | 12 16 20 48 820 | e1 14 e3 1
  +6.07 curva-timeout | p21 | v150 -70 | 8 8 24 496 388 | e1 131 e3 0
  +6.07 busq-izq | p21 | v150 -70 | 8 8 24 496 388 | e1 131 e3 0
  +6.07 mue | p21 | v150 -70 | 8 8 24 496 388 | e1 131 e3 0
  +6.07 pausa | p14 | v150 -70 | 8 8 24 496 388 | e1 131 e3 0
  +6.20 busq*-der | p12 | v154 86 | 24 20 36 24 8 | e1 152 e3 3
  +6.26 pausa | p-12 | v110 -110 | 12 292 20 36 24 | e1 0 e3 13
  +6.33 busq*-izq | p-11 | v92 150 | 16 52 16 24 16 | e1 3 e3 24
  +6.43 pausa | p-13 | v-110 110 | 16 260 12 24 20 | e1 0 e3 41
  +6.48 busq*-izq | p-13 | v84 158 | 16 0 16 20 16 | e1 3 e3 50
  +6.56 pausa | p-14 | v-110 110 | 8 320 8 16 8 | e1 0 e3 64
  +6.64 busq*-izq | p-14 | v40 234 | 36 32 12 16 8 | e1 3 e3 77
  +6.70 pausa | p-13 | v24 110 | 8 280 32 16 8 | e1 0 e3 87
  +6.79 busq*-izq | p-12 | v86 156 | 16 4 28 20 12 | e1 3 e3 101
  +6.86 pausa | p0 | v24 110 | 4 16 340 24 8 | e1 15 e3 113
  +6.95 busq*-izq | p0 | v120 122 | 12 16 36 16 16 | e1 29 e3 128
  +7.00 pausa | p15 | v24 110 | 8 8 12 412 16 | e1 38 e3 0
  +7.08 mue | p14 | v224 40 | 8 12 16 708 420 | e1 50 e3 0
  +7.15 busq*-der | p26 | v254 0 | 8 8 16 16 24 | e1 64 e3 5
  +8.08 mue | p26 | v24 110 | 8 0 12 20 12 | e1 217 e3 158
  +9.08 mue | p26 | v110 24 | 52 24 12 24 12 | e1 255 e3 255
  +9.99 pausa | p-30 | v24 110 | 284 4 12 12 8 | e1 255 e3 255
  +10.05 busq*-izq | p-28 | v0 254 | 60 12 12 12 12 | e1 255 e3 255
  +10.08 mue | p-28 | v110 24 | 24 20 8 8 8 | e1 255 e3 255
  +10.36 pausa | p-28 | v110 24 | 288 16 8 20 8 | e1 255 e3 255
  +10.45 busq*-izq | p-25 | v0 254 | 108 8 12 16 16 | e1 255 e3 255
  +10.53 pausa | p-14 | v-110 110 | 16 316 8 16 8 | e1 0 e3 255
  +10.60 busq*-izq | p-14 | v80 162 | 16 16 20 16 4 | e1 3 e3 255
  +10.65 pausa | p-13 | v-110 110 | 20 288 32 12 8 | e1 0 e3 255
  +10.75 busq*-izq | p0 | v120 122 | 16 20 28 28 16 | e1 14 e3 255
  +10.79 pausa | p14 | v-110 110 | 16 24 12 408 4 | e1 20 e3 0
  +11.08 mue | p29 | v254 0 | 12 8 12 24 336 | e1 69 e3 25
  +11.46 busq-der | p15 | v230 16 | 8 8 16 28 4 | e1 11 e3 3
  +12.09 mue | p15 | v110 24 | 16 24 16 36 16 | e1 115 e3 106
  +13.09 mue | p15 | v24 110 | 0 4 12 28 20 | e1 255 e3 255
  +14.09 mue | p15 | v-110 110 | 24 0 4 20 16 | e1 255 e3 255
  +14.46 stop | p15 | v0 0 | 12 16 8 28 16 | e1 255 e3 255
```

```text
B2 (nivel 1): Ultima corrida: 11.37 s | perdidas 13 esquinas 1 cruces 0 | pista 14-806 (vistos 0-882)
  +0.08 busq-der | p0 | v198 202 | 16 40 36 20 8 | e1 190 e3 190
  +0.11 pausa | p1 | v110 -110 | 20 36 284 64 0 | e1 196 e3 196
  +0.24 busq*-der | p0 | v120 122 | 12 12 40 52 20 | e1 217 e3 217
  +0.27 pausa | p1 | v110 -110 | 12 16 528 80 32 | e1 222 e3 222
  +0.68 busq*-der | p14 | v230 40 | 8 20 16 48 184 | e1 38 e3 3
  +0.69 pausa | p24 | v110 -110 | 32 32 20 32 432 | e1 39 e3 4
  +1.00 mue | p14 | v166 86 | 12 12 16 860 32 | e1 91 e3 0
  +1.10 busq*-der | p13 | v166 94 | 0 4 40 40 8 | e1 108 e3 3
  +1.19 pausa | p-13 | v110 -110 | 24 612 24 40 8 | e1 0 e3 18
  +1.27 busq*-izq | p-15 | v6 236 | 4 48 16 16 20 | e1 3 e3 31
  +1.35 pausa | p-14 | v-110 110 | 16 284 16 20 16 | e1 0 e3 43
  +1.41 busq*-izq | p-14 | v40 228 | 40 20 4 12 8 | e1 3 e3 54
  +1.46 pausa | p-15 | v-110 110 | 12 288 8 8 16 | e1 0 e3 63
  +1.65 busq*-izq | p-14 | v40 236 | 40 20 28 12 8 | e1 3 e3 94
  +1.79 pausa | p15 | v24 110 | 4 8 8 364 16 | e1 26 e3 0
  +2.00 mue | p14 | v160 80 | 12 16 20 768 16 | e1 61 e3 0
  +2.20 curva-der/ext | p29 | v254 0 | 12 16 16 28 864 | e1 15 e3 7
  +2.90 curva-timeout | p29 | v150 -70 | 8 12 32 24 60 | e1 43 e3 50
  +2.90 busq-izq | p29 | v150 -70 | 8 12 32 24 60 | e1 43 e3 50
  +3.00 mue | p29 | v-110 110 | 12 20 4 8 8 | e1 60 e3 68
  +4.00 mue | p29 | v110 -110 | 12 24 8 12 8 | e1 227 e3 234
  +4.92 pausa | p-29 | v-110 110 | 280 16 4 16 16 | e1 255 e3 255
  +5.01 mue | p-27 | v0 254 | 264 16 16 16 20 | e1 255 e3 255
  +5.20 busq*-izq | p-25 | v0 254 | 24 16 20 24 20 | e1 21 e3 255
  +6.01 mue | p-25 | v110 -110 | 36 8 0 8 4 | e1 155 e3 255
  +7.01 mue | p-25 | v-110 110 | 140 12 4 20 20 | e1 255 e3 255
  +7.33 pausa | p14 | v24 110 | 0 4 20 324 16 | e1 21 e3 0
  +7.67 busq*-der | p14 | v166 84 | 8 16 28 76 12 | e1 77 e3 3
  +7.68 pausa | p15 | v110 24 | 12 8 8 336 16 | e1 80 e3 0
  +8.01 mue | p14 | v166 84 | 12 12 20 736 20 | e1 134 e3 0
  +8.12 busq*-der | p0 | v198 202 | 12 16 40 12 8 | e1 152 e3 9
  +8.23 pausa | p-5 | v110 24 | 12 172 296 16 8 | e1 0 e3 27
  +8.25 busq*-izq | p-7 | v42 200 | 28 100 16 20 28 | e1 1 e3 31
  +8.32 pausa | p-26 | v24 110 | 292 20 12 24 20 | e1 2 e3 43
  +8.36 busq*-izq | p-26 | v0 254 | 16 12 16 24 16 | e1 8 e3 49
  +9.01 mue | p-26 | v110 -110 | 12 12 8 52 16 | e1 116 e3 158
  +10.01 mue | p-26 | v-110 110 | 8 16 12 44 12 | e1 255 e3 255
  +11.02 mue | p-26 | v110 -110 | 12 16 8 36 24 | e1 255 e3 255
  +11.37 stop | p-26 | v0 0 | 16 32 4 36 24 | e1 255 e3 255
```

```text
B3 (nivel 1): Ultima corrida: 14.42 s | perdidas 29 esquinas 1 cruces 0 | pista 13-792 (vistos 0-892)
  +1.26 busq*-der | p1 | v194 196 | 16 16 44 48 16 | e1 136 e3 7
  +1.31 pausa | p-12 | v110 -110 | 8 668 12 64 16 | e1 0 e3 15
  +1.45 busq*-izq | p-12 | v40 214 | 32 20 16 28 8 | e1 3 e3 38
  +1.48 pausa | p-25 | v-110 110 | 288 24 8 36 12 | e1 8 e3 43
  +1.59 busq*-izq | p-19 | v0 206 | 28 16 20 40 24 | e1 26 e3 62
  +1.66 pausa | p-12 | v24 110 | 16 292 12 36 12 | e1 0 e3 73
  +1.88 busq*-izq | p-6 | v120 120 | 16 24 84 28 12 | e1 4 e3 109
  +1.97 pausa | p15 | v24 110 | 12 4 8 344 8 | e1 20 e3 0
  +2.00 mue | p14 | v160 80 | 8 16 20 556 4 | e1 25 e3 0
  +2.28 busq*-der | p26 | v254 0 | 8 16 16 48 20 | e1 15 e3 14
  +3.01 mue | p26 | v-110 110 | 16 8 8 28 8 | e1 137 e3 136
  +3.24 pausa | p28 | v24 110 | 0 4 12 44 272 | e1 175 e3 174
  +3.49 busq*-der | p12 | v212 40 | 40 8 92 60 8 | e1 217 e3 3
  +3.55 pausa | p-11 | v24 110 | 16 296 8 56 12 | e1 0 e3 12
  +3.67 busq*-izq | p-9 | v102 140 | 24 28 16 48 12 | e1 3 e3 32
  +3.69 pausa | p-23 | v110 24 | 284 32 12 44 16 | e1 6 e3 35
  +3.95 busq*-izq | p-25 | v0 254 | 24 4 12 28 12 | e1 49 e3 79
  +4.01 mue | p-25 | v110 24 | 12 16 8 24 8 | e1 60 e3 89
  +4.59 pausa | p-23 | v-110 110 | 276 12 12 52 16 | e1 156 e3 186
  +4.94 busq*-izq | p0 | v196 200 | 12 8 24 24 12 | e1 13 e3 244
  +4.97 pausa | p14 | v-110 110 | 16 20 4 364 8 | e1 18 e3 0
  +5.01 mue | p14 | v158 80 | 24 24 28 800 8 | e1 25 e3 0
  +5.11 busq*-der | p14 | v160 80 | 28 8 20 52 16 | e1 40 e3 3
  +5.12 pausa | p27 | v110 -110 | 12 8 28 76 408 | e1 42 e3 5
  +5.31 busq*-izq | p-10 | v94 148 | 68 36 16 44 20 | e1 3 e3 13
  +5.31 pausa | p-24 | v-110 110 | 308 28 4 44 16 | e1 4 e3 14
  +5.41 busq*-izq | p-22 | v0 238 | 28 16 20 36 24 | e1 20 e3 30
  +5.88 pausa | p-20 | v110 -110 | 280 20 24 56 28 | e1 98 e3 108
  +6.01 mue | p14 | v218 40 | 224 16 48 672 332 | e1 120 e3 0
  +6.55 busq-der | p14 | v166 90 | 108 16 16 32 20 | e1 29 e3 3
  +6.57 pausa | p6 | v110 -110 | 196 24 12 24 316 | e1 32 e3 6
  +6.73 busq*-der | p28 | v254 0 | 8 8 16 40 32 | e1 59 e3 33
  +6.79 pausa | p28 | v110 -110 | 4 8 8 60 328 | e1 69 e3 42
  +7.01 mue | p29 | v254 0 | 8 8 16 156 412 | e1 106 e3 0
  +7.17 busq*-der | p9 | v162 142 | 8 4 48 48 24 | e1 132 e3 3
  +7.23 pausa | p-11 | v110 -110 | 12 372 20 60 20 | e1 0 e3 14
  +7.30 busq*-izq | p-11 | v92 150 | 4 40 8 56 16 | e1 3 e3 25
  +7.65 pausa | p-12 | v24 110 | 12 292 8 36 8 | e1 0 e3 84
  +7.98 busq*-der | p27 | v254 0 | 12 8 12 56 20 | e1 16 e3 12
  +8.02 mue | p27 | v110 24 | 12 16 12 52 12 | e1 22 e3 18
  +9.03 mue | p27 | v24 110 | 12 4 12 36 16 | e1 190 e3 185
  +10.03 mue | p27 | v110 24 | 8 24 8 44 8 | e1 255 e3 255
  +10.52 pausa | p-25 | v-110 110 | 344 20 8 36 16 | e1 255 e3 255
  +10.68 busq*-izq | p-19 | v0 226 | 20 12 16 40 20 | e1 255 e3 255
  +10.84 pausa | p-29 | v110 24 | 276 16 8 8 0 | e1 255 e3 255
  +11.03 mue | p-27 | v0 254 | 300 12 16 16 16 | e1 255 e3 255
  +11.07 busq*-izq | p-25 | v0 254 | 16 36 20 20 12 | e1 255 e3 255
  +11.11 pausa | p-15 | v110 24 | 16 308 8 12 8 | e1 0 e3 255
  +11.21 busq*-izq | p-13 | v84 156 | 20 124 12 12 12 | e1 3 e3 255
  +11.26 pausa | p-14 | v110 24 | 16 284 28 12 8 | e1 0 e3 255
  +11.32 busq*-izq | p-1 | v120 122 | 12 16 36 16 16 | e1 6 e3 255
  +11.44 pausa | p14 | v110 24 | 12 16 12 376 12 | e1 26 e3 0
  +12.03 mue | p-2 | v186 188 | 16 316 44 20 28 | e1 0 e3 3
  +12.07 busq-izq | p-12 | v46 230 | 24 12 36 16 20 | e1 3 e3 10
  +12.10 pausa | p-27 | v-110 110 | 280 28 24 8 4 | e1 7 e3 14
  +12.25 busq*-izq | p0 | v120 122 | 16 16 36 16 4 | e1 32 e3 39
  +12.33 pausa | p0 | v-110 110 | 16 20 312 20 16 | e1 45 e3 52
  +12.39 busq*-izq | p0 | v120 122 | 12 16 12 56 16 | e1 56 e3 63
  +12.43 pausa | p15 | v-110 110 | 20 12 4 372 4 | e1 62 e3 0
  +12.97 curva-der/ext | p22 | v254 0 | 12 12 16 28 700 | e1 152 e3 2
  +13.67 curva-timeout | p22 | v150 -70 | 32 0 24 28 16 | e1 255 e3 119
  +13.67 busq-izq | p22 | v150 -70 | 32 0 24 28 16 | e1 255 e3 119
  +13.67 mue | p22 | v150 -70 | 32 0 24 28 16 | e1 255 e3 119
  +14.41 stop | p22 | v0 0 | 20 28 12 32 24 | e1 255 e3 242
```

```text
C1 (nivel 2): Ultima corrida: 12.39 s | perdidas 40 esquinas 1 cruces 0 | pista 15-821 (vistos 0-926)
  +8.81 ext-veto-izq | p-28 | v0 254 | 304 12 32 24 28 | e1 53 e3 63
  +8.82 busq*-izq | p-28 | v0 254 | 296 16 20 24 24 | e1 55 e3 65
  +8.84 pausa | p-28 | v24 110 | 368 8 16 20 16 | e1 59 e3 68
  +8.84 ext-veto-izq | p-28 | v0 254 | 436 12 20 24 24 | e1 60 e3 69
  +8.86 busq*-izq | p-28 | v0 254 | 192 12 16 20 20 | e1 62 e3 71
  +8.92 pausa | p-28 | v110 -110 | 356 48 0 8 8 | e1 72 e3 81
  +8.92 ext-veto-izq | p-28 | v0 254 | 288 16 20 28 24 | e1 73 e3 82
  +8.93 busq*-izq | p-28 | v0 254 | 336 12 20 24 24 | e1 75 e3 84
  +8.94 pausa | p-29 | v110 -110 | 380 32 0 12 8 | e1 76 e3 85
  +8.95 ext-veto-izq | p-29 | v0 254 | 344 12 20 24 24 | e1 77 e3 86
  +8.96 busq*-izq | p-29 | v0 254 | 344 8 24 28 24 | e1 79 e3 88
  +8.97 pausa | p-27 | v110 -110 | 420 88 0 12 12 | e1 80 e3 89
  +8.97 ext-veto-izq | p-27 | v0 254 | 340 16 20 24 24 | e1 81 e3 90
  +8.98 busq*-izq | p-27 | v0 254 | 316 12 20 24 20 | e1 83 e3 92
  +8.99 pausa | p-30 | v110 -110 | 356 0 0 12 8 | e1 84 e3 93
  +9.00 ext-veto-izq | p-30 | v0 254 | 316 20 20 20 20 | e1 85 e3 94
  +9.01 busq*-izq | p-30 | v0 254 | 320 12 20 20 24 | e1 87 e3 96
  +9.01 pausa | p-30 | v110 -110 | 412 0 4 12 8 | e1 88 e3 97
  +9.02 ext-veto-izq | p-30 | v0 254 | 292 12 16 24 24 | e1 89 e3 98
  +9.03 busq*-izq | p-30 | v0 254 | 268 16 20 20 20 | e1 91 e3 100
  +9.07 pausa | p-26 | v110 -110 | 300 32 24 28 0 | e1 97 e3 106
  +9.07 ext-veto-izq | p-26 | v0 254 | 320 16 20 20 20 | e1 98 e3 107
  +9.09 busq*-izq | p-26 | v0 254 | 380 12 20 20 20 | e1 100 e3 109
  +9.09 pausa | p-26 | v110 -110 | 384 40 36 28 0 | e1 101 e3 110
  +9.10 ext-veto-izq | p-26 | v0 254 | 368 16 20 24 20 | e1 102 e3 111
  +9.11 busq*-izq | p-26 | v0 254 | 388 16 24 24 24 | e1 104 e3 113
  +9.12 pausa | p-28 | v110 -110 | 456 40 20 0 0 | e1 105 e3 114
  +9.12 ext-veto-izq | p-28 | v0 254 | 416 16 24 24 24 | e1 106 e3 115
  +9.14 mue | p-28 | v0 254 | 380 16 20 24 16 | e1 108 e3 118
  +9.14 busq*-izq | p-28 | v0 254 | 380 16 20 24 16 | e1 108 e3 118
  +9.14 pausa | p-27 | v110 -110 | 432 40 32 0 0 | e1 109 e3 119
  +9.15 ext-veto-izq | p-27 | v0 254 | 384 12 20 20 20 | e1 110 e3 120
  +9.16 busq*-izq | p-27 | v0 254 | 280 12 16 16 20 | e1 112 e3 122
  +9.17 pausa | p-24 | v110 -110 | 304 32 72 0 0 | e1 113 e3 123
  +9.17 ext-veto-izq | p-24 | v0 254 | 252 12 16 16 20 | e1 114 e3 124
  +9.18 busq*-izq | p-24 | v0 254 | 296 12 16 20 20 | e1 116 e3 126
  +9.19 pausa | p-24 | v110 -110 | 344 20 8 32 32 | e1 117 e3 127
  +9.20 ext-veto-izq | p-24 | v0 254 | 404 16 28 28 24 | e1 118 e3 128
  +9.21 busq*-izq | p-24 | v0 254 | 460 16 20 28 28 | e1 120 e3 130
  +9.22 pausa | p-23 | v110 -110 | 420 24 8 40 40 | e1 122 e3 131
  +9.22 ext-veto-izq | p-23 | v0 252 | 392 16 20 28 28 | e1 123 e3 132
  +9.23 busq*-izq | p-23 | v0 252 | 392 16 20 28 24 | e1 125 e3 134
  +9.24 pausa | p-23 | v110 -110 | 356 24 20 40 36 | e1 126 e3 135
  +9.25 ext-veto-izq | p-23 | v0 250 | 324 16 20 28 28 | e1 127 e3 136
  +9.26 busq*-izq | p-23 | v0 250 | 304 16 20 28 28 | e1 129 e3 138
  +9.26 pausa | p-23 | v110 -110 | 304 12 28 40 24 | e1 130 e3 139
  +9.27 ext-veto-izq | p-23 | v0 250 | 316 12 20 28 28 | e1 131 e3 140
  +9.28 busq*-izq | p-23 | v0 250 | 356 12 20 36 24 | e1 133 e3 142
  +9.29 pausa | p-23 | v110 -110 | 380 32 32 44 24 | e1 134 e3 143
  +9.29 ext-veto-izq | p-23 | v0 252 | 380 16 24 28 24 | e1 135 e3 144
  +9.31 busq*-izq | p-23 | v0 252 | 376 12 36 20 28 | e1 137 e3 146
  +9.31 pausa | p-29 | v110 -110 | 404 16 8 16 16 | e1 138 e3 147
  +9.32 ext-veto-izq | p-29 | v0 254 | 448 16 20 28 24 | e1 139 e3 148
  +9.33 busq*-izq | p-29 | v0 254 | 388 12 20 28 28 | e1 141 e3 150
  +9.34 pausa | p-29 | v110 -110 | 372 16 8 16 12 | e1 142 e3 151
  +9.34 ext-veto-izq | p-29 | v0 254 | 348 12 20 20 24 | e1 143 e3 152
  +9.36 busq*-izq | p-29 | v0 254 | 412 12 16 20 20 | e1 145 e3 154
  +9.36 pausa | p-29 | v110 -110 | 460 16 8 12 8 | e1 146 e3 155
  +9.37 ext-veto-izq | p-29 | v0 254 | 472 12 12 20 20 | e1 147 e3 156
  +9.38 busq*-izq | p-29 | v0 254 | 256 12 20 20 20 | e1 149 e3 158
  +10.14 mue | p-29 | v110 24 | 16 16 4 12 8 | e1 255 e3 255
  +11.14 mue | p-29 | v24 110 | 4 24 36 16 32 | e1 255 e3 255
  +12.15 mue | p-29 | v-110 110 | 16 32 32 20 20 | e1 255 e3 255
  +12.38 stop | p-29 | v0 0 | 24 20 16 4 8 | e1 255 e3 255
```

```text
B4 (nivel 1): Ultima corrida: 8.42 s | perdidas 21 esquinas 1 cruces 0 | pista 11-796 (vistos 0-895)
  +0.41 curva-der/ext | p21 | v254 0 | 8 8 12 28 716 | e1 245 e3 2
  +1.11 curva-timeout | p21 | v150 -70 | 4 12 88 852 12 | e1 255 e3 0
  +1.11 busq-izq | p21 | v150 -70 | 4 12 88 852 12 | e1 255 e3 0
  +1.11 mue | p21 | v150 -70 | 4 12 88 852 12 | e1 255 e3 0
  +1.11 pausa | p13 | v150 -70 | 4 12 88 852 12 | e1 255 e3 0
  +1.19 busq*-der | p10 | v146 94 | 20 24 56 0 0 | e1 255 e3 3
  +1.22 pausa | p-14 | v110 -110 | 24 616 20 4 4 | e1 0 e3 9
  +1.32 busq*-izq | p-13 | v86 156 | 8 20 16 16 16 | e1 3 e3 25
  +1.39 pausa | p-25 | v-110 110 | 300 24 12 20 24 | e1 14 e3 36
  +1.46 busq*-izq | p-28 | v0 254 | 40 4 8 12 12 | e1 26 e3 48
  +1.56 pausa | p-29 | v-110 110 | 288 12 0 4 0 | e1 43 e3 66
  +1.64 busq*-izq | p-27 | v0 254 | 40 4 12 8 12 | e1 57 e3 79
  +1.77 pausa | p-15 | v24 110 | 8 276 4 8 8 | e1 0 e3 99
  +1.97 busq*-izq | p-1 | v120 122 | 12 20 32 4 8 | e1 9 e3 133
  +2.03 pausa | p14 | v24 110 | 0 4 12 484 16 | e1 19 e3 0
  +2.11 mue | p14 | v224 40 | 0 4 12 448 0 | e1 32 e3 0
  +2.19 busq*-der | p14 | v160 80 | 4 8 20 8 8 | e1 45 e3 3
  +2.24 pausa | p27 | v110 24 | 8 20 24 4 328 | e1 54 e3 12
  +2.83 busq*-izq | p-11 | v122 166 | 0 28 8 16 16 | e1 3 e3 10
  +2.92 pausa | p-26 | v24 110 | 280 8 16 20 16 | e1 18 e3 25
  +2.97 busq*-izq | p-27 | v0 254 | 12 4 12 12 12 | e1 25 e3 32
  +3.11 mue | p-27 | v24 110 | 12 12 4 8 4 | e1 49 e3 56
  +4.02 pausa | p10 | v110 24 | 12 12 204 432 12 | e1 201 e3 0
  +4.11 mue | p14 | v220 40 | 16 0 32 680 424 | e1 216 e3 0
  +4.28 busq*-izq | p-17 | v0 254 | 16 8 12 16 20 | e1 14 e3 18
  +4.86 pausa | p-29 | v-110 110 | 276 20 12 4 4 | e1 111 e3 115
  +4.95 busq*-izq | p-28 | v0 254 | 16 12 12 12 12 | e1 126 e3 130
  +4.97 pausa | p-14 | v-110 110 | 12 408 8 16 16 | e1 0 e3 134
  +5.11 mue | p-11 | v90 150 | 16 736 360 16 16 | e1 0 e3 157
  +5.19 busq*-izq | p-1 | v120 122 | 20 24 60 4 0 | e1 12 e3 170
  +5.23 pausa | p15 | v24 110 | 4 0 4 332 4 | e1 19 e3 0
  +5.40 busq*-der | p13 | v156 84 | 4 8 24 8 16 | e1 46 e3 3
  +5.43 pausa | p30 | v110 24 | 8 8 4 8 320 | e1 51 e3 8
  +5.86 busq*-der | p29 | v254 0 | 4 0 12 16 28 | e1 122 e3 79
  +6.12 mue | p29 | v110 24 | 8 12 4 12 16 | e1 166 e3 123
  +6.19 pausa | p29 | v110 24 | 12 4 4 12 296 | e1 178 e3 135
  +7.06 busq-der | p14 | v166 86 | 20 0 72 24 4 | e1 255 e3 3
  +7.12 mue | p14 | v110 -110 | 0 4 36 28 4 | e1 255 e3 14
  +7.14 pausa | p0 | v110 -110 | 0 8 336 16 8 | e1 255 e3 17
  +7.22 busq*-izq | p-10 | v92 148 | 20 140 12 60 0 | e1 3 e3 30
  +7.23 pausa | p-13 | v-110 110 | 32 312 4 20 0 | e1 0 e3 32
  +7.77 busq*-izq | p0 | v194 198 | 8 12 44 20 0 | e1 26 e3 121
  +7.85 pausa | p1 | v-110 110 | 16 24 332 56 12 | e1 39 e3 135
  +7.95 busq*-der | p12 | v216 40 | 4 8 28 132 0 | e1 55 e3 3
  +7.96 pausa | p15 | v110 -110 | 0 4 8 328 8 | e1 58 e3 0
  +8.06 busq*-der | p9 | v140 100 | 4 8 16 48 16 | e1 75 e3 3
  +8.12 mue | p9 | v110 -110 | 16 0 12 32 4 | e1 85 e3 13
  +8.14 pausa | p-13 | v110 -110 | 44 444 4 36 8 | e1 0 e3 16
  +8.22 busq*-izq | p-12 | v90 150 | 20 64 16 16 32 | e1 3 e3 29
  +8.28 pausa | p-13 | v24 110 | 16 304 20 24 0 | e1 0 e3 38
  +8.30 busq*-izq | p-12 | v90 152 | 28 52 16 20 0 | e1 3 e3 42
  +8.34 pausa | p-23 | v24 110 | 308 4 16 44 20 | e1 9 e3 48
  +8.42 stop | p-26 | v0 0 | 396 8 12 32 8 | e1 22 e3 61
```

```text
B5 (nivel 1): Ultima corrida: 12.82 s | perdidas 25 esquinas 0 cruces 0 | pista 11-664 (vistos 0-897)
  +0.08 busq-der | p0 | v198 202 | 16 20 48 28 8 | e1 191 e3 191
  +0.11 pausa | p1 | v110 -110 | 4 12 284 40 0 | e1 196 e3 196
  +0.23 busq*-der | p2 | v120 122 | 12 16 32 40 16 | e1 215 e3 215
  +0.26 pausa | p1 | v110 -110 | 28 0 340 36 8 | e1 220 e3 220
  +0.47 busq*-der | p0 | v120 122 | 16 24 0 48 8 | e1 255 e3 255
  +0.48 pausa | p12 | v110 -110 | 32 36 0 272 4 | e1 255 e3 0
  +0.66 busq*-der | p14 | v160 80 | 8 12 20 44 12 | e1 255 e3 3
  +0.68 pausa | p28 | v110 -110 | 4 12 8 40 296 | e1 255 e3 6
  +0.83 busq*-der | p27 | v254 0 | 12 8 12 44 32 | e1 255 e3 30
  +0.85 pausa | p15 | v110 -110 | 0 0 4 416 12 | e1 255 e3 0
  +1.00 mue | p14 | v224 40 | 20 4 16 648 4 | e1 255 e3 0
  +1.13 busq*-der | p11 | v166 116 | 8 28 76 44 0 | e1 255 e3 3
  +1.20 pausa | p2 | v110 -110 | 8 12 232 64 24 | e1 255 e3 14
  +1.28 busq*-izq | p-6 | v112 128 | 20 48 0 48 4 | e1 3 e3 27
  +1.30 pausa | p-13 | v-110 110 | 28 232 0 20 0 | e1 0 e3 31
  +1.80 busq*-izq | p-12 | v98 172 | 20 40 120 20 8 | e1 3 e3 113
  +1.81 pausa | p0 | v-110 110 | 20 36 244 20 8 | e1 5 e3 115
  +2.00 mue | p13 | v220 40 | 324 24 12 724 12 | e1 4 e3 0
  +2.41 busq*-der | p9 | v174 134 | 20 0 32 20 8 | e1 72 e3 3
  +2.44 pausa | p-22 | v110 -110 | 276 52 40 40 0 | e1 77 e3 8
  +2.54 busq*-izq | p-13 | v94 146 | 28 36 16 20 4 | e1 5 e3 25
  +3.00 mue | p-13 | v110 -110 | 32 44 32 108 0 | e1 82 e3 102
  +4.00 mue | p-13 | v-110 110 | 16 40 24 48 0 | e1 248 e3 255
  +4.41 pausa | p-25 | v-110 110 | 228 24 4 28 8 | e1 255 e3 255
  +4.66 busq*-izq | p-22 | v0 242 | 128 8 12 24 16 | e1 255 e3 255
  +4.73 pausa | p-21 | v-110 110 | 228 12 4 60 8 | e1 255 e3 255
  +4.75 busq*-izq | p-21 | v0 238 | 24 12 12 24 16 | e1 255 e3 255
  +4.95 pausa | p-13 | v24 110 | 12 232 16 20 4 | e1 0 e3 255
  +4.98 busq*-izq | p-13 | v40 226 | 40 40 32 20 8 | e1 3 e3 255
  +5.01 mue | p-13 | v24 110 | 0 8 40 28 12 | e1 7 e3 255
  +5.06 pausa | p0 | v24 110 | 4 16 284 32 4 | e1 15 e3 255
  +5.12 busq*-izq | p0 | v120 122 | 16 16 8 28 16 | e1 25 e3 255
  +5.12 pausa | p14 | v24 110 | 4 4 12 240 16 | e1 26 e3 0
  +5.39 busq*-der | p12 | v148 90 | 16 16 28 60 12 | e1 70 e3 3
  +5.42 pausa | p27 | v110 24 | 16 12 8 28 240 | e1 75 e3 8
  +5.75 busq*-der | p14 | v166 86 | 20 4 12 20 8 | e1 13 e3 3
  +6.01 mue | p14 | v-110 110 | 16 16 12 20 16 | e1 55 e3 45
  +6.77 pausa | p-24 | v24 110 | 252 28 8 28 16 | e1 182 e3 172
  +7.01 mue | p-23 | v0 248 | 360 12 20 36 28 | e1 222 e3 212
  +7.51 busq-izq | p-12 | v46 230 | 28 32 16 40 4 | e1 3 e3 255
  +7.62 pausa | p-12 | v-110 110 | 16 328 12 32 16 | e1 0 e3 255
  +7.72 busq*-izq | p-12 | v96 146 | 12 84 4 12 12 | e1 1 e3 255
  +7.75 pausa | p-14 | v-110 110 | 16 348 4 12 12 | e1 0 e3 255
  +7.84 busq*-izq | p-14 | v40 236 | 36 112 20 12 8 | e1 3 e3 255
  +7.89 pausa | p0 | v-110 110 | 8 20 276 16 8 | e1 11 e3 255
  +7.99 busq*-izq | p-1 | v120 122 | 20 24 116 12 4 | e1 27 e3 255
  +8.01 mue | p-1 | v-110 110 | 24 24 24 20 4 | e1 30 e3 255
  +8.02 pausa | p13 | v-110 110 | 24 24 20 400 8 | e1 32 e3 0
  +8.82 busq-der | p3 | v184 186 | 12 0 40 36 0 | e1 45 e3 10
  +8.90 pausa | p-13 | v110 -110 | 20 592 16 28 12 | e1 0 e3 23
  +8.98 busq*-izq | p-12 | v86 154 | 20 60 16 20 16 | e1 3 e3 36
  +9.01 pausa | p-12 | v-110 110 | 24 448 8 56 0 | e1 0 e3 41
  +9.01 mue | p-12 | v40 208 | 32 352 16 40 16 | e1 0 e3 42
  +9.11 busq*-izq | p-12 | v88 154 | 12 52 12 32 12 | e1 3 e3 58
  +9.15 pausa | p-12 | v-110 110 | 16 252 8 28 8 | e1 0 e3 66
  +9.43 busq*-izq | p-1 | v194 196 | 12 12 56 12 4 | e1 18 e3 112
  +9.48 pausa | p0 | v-110 110 | 16 24 236 36 24 | e1 25 e3 119
  +9.81 busq*-der | p27 | v254 0 | 8 12 16 32 16 | e1 81 e3 10
  +10.01 mue | p27 | v110 24 | 12 16 16 20 8 | e1 114 e3 43
  +11.02 mue | p27 | v24 110 | 0 16 20 48 20 | e1 255 e3 211
  +12.02 mue | p27 | v110 24 | 16 28 8 32 0 | e1 255 e3 255
  +12.82 stop | p27 | v0 0 | 4 0 8 36 8 | e1 255 e3 255
```

Pendiente de corridas. Debajo de cada fila va la traza completa tal
como sale por serie (`t`, 9600, robot detenido).

## Decisión

**`EXT_MARCHA 1`** — C (nivel 2) falló el criterio 2 en la primera
corrida: C1 vetó la punta sobre la línea real de la tercera esquina del
lazo (`ext-veto-izq` ×~28) y el enmascarado le quitó además al
centroide la única señal para reenganchar; el robot siguió de largo y
no volvió. B (nivel 1) cumplió los 4 criterios: las esquinas reales se
doblaron siempre que el robot llegó a ellas (B3 y B5 atravesaron la X y
su lazo), las pérdidas quedaron en el rango de A y el tiempo no empeoró.

Nota honesta sobre el alcance: en esta pista casi todos los `ext` son
salidas reales y el caso «masa ajena» casi no apareció, así que el
nivel 1 **cumple por no dañar, no por mejorar mediblemente** — en B
ningún `ext` resolvió `curva-ok` (los que pasaron la marcha terminaron
en timeout). La ganancia efectiva de v2.6 sobre v2.5 es la
instrumentación `e1`/`e3` y el fix de `arrancarBusqueda(-curvaLado)`
tras timeout de curva, no el veto.
