---
type: archivo
status: activo
created: 2026-10-30
---
# Archivo de corridas

Historial de pruebas en pista. Desde el 2026-10-30 la EEPROM del UNO ya
no acumula la tabla: guarda solo la traza de la última corrida (eventos
con los 5 canales, posF, comandos y decisiones), que se archiva acá al
leerla por serie antes de que el próximo test la pise.

Contadores: `pérdidas` = entradas a la búsqueda (incluye reentradas del
mismo episodio), `esquinas` = curvas comprometidas disparadas, `cruces`
= todo-negro resuelto como cruce. Recorrido de la pista en [[pista]].

| # | Tiempo | Pérdidas | Esquinas | Cruces | Nota |
|---|--------|----------|----------|--------|------|
| 1 | 6,14 s | 11 | 1 | 0 | primera en pista de práctica |
| 2 | 4,08 s | 10 | 1 | 0 | |
| 3 | 2,90 s | 8 | 1 | 0 | |
| 4 | 28,50 s | 9 | 19 | 0 | la más larga; 19 curvas comprometidas, ¿reales o detector gatilloso? |
| 5 | 10,75 s | 117 | 4 | 0 | reinicio de fase 0 en la búsqueda → pivote sin tope, rueda fuera de la pista. Fix: pausa/retoma |
| 6 | 6,11 s | 5 | 0 | 0 | pasó de largo la horquilla de 180° sin registrarla (ventana extremo-solo inexistente). Fix: disparo por posF |
| 7 | 3,59 s | 5 | 0 | 0 | perdió la línea a ~100 ms de la largada; buscó a la izq. con la línea a la der. todo el episodio. Fixes: reset de `ultimoLado` en largada + retoma con lado fresco |
| 8 | 5,73 s | 6 | 0 | 2 | horquilla: centroide crudo llegó a −19 mm pero POSF_ESQ era 20 → 0 esquinas. Lado de búsqueda ya correcto (busq-der). posF clavado +7/+9 = TRIM_DER 1.05 sobre-compensa. Fix: POSF_ESQ 16 + espera 700 ms |
| 9 | 11,35 s | 14 | 4 | 0 | posF ya dispara (3× curva-der/posf) pero 2 curva-ok instantáneos en el borrón + timeout 500 ms ≈ 180° de error → se regresó por donde venía. Fixes: curva-ok pide S2 sobre línea + lockout 300 ms entre curvas |
| 10 | 10,97 s | 14 | 4 | 0 | mucho mejor: llegó al cruce de 90°, `curva-izq/posf` disparó bien pero el arco con interna=0 barrió el arreglo fuera de la esquina → timeout → rueda fuera del tablero. Fix: rueda interna a reversa (pivote) pasados 250 ms + CURVA_MAX 700 |
| 11 | 13,50 s | 18 | 9 | 0 | llegó a la intersección en X pero los disparos ext/posf se adelantan al todo-negro: cada brazo de la X dispara esquina como si fuera curva real → camino equivocado. Pivote en reversa confirmado en traza (v150 -110). Fix: veto ext/posf con S2 ≥0,4 (`NEG_CENTRO_VETO`) + TRIM_DER 1,02 |

| 12 | 13,00 s | 16 | 7 | 0 | cruzó la X y llegó a la esquina superior derecha; la línea pasó por el trío interno a ~80 ms de giro pero CURVA_MIN=90 vetó el curva-ok → el arreglo la barrió de largo y el pivote a reversa la alejó → timeout → el rescate armó una reversa de 180° → salió del tablero por arriba. Fix: abortar la curva cuando la masa cruza al lado contrario (`curva-barrida` → PD) |

| 13 | 23,23 s | 21 | 14 | 0 | la más larga hasta ahora; `curva-barrida` funcionó dos veces y el PD recuperó cinta real. Cayó en el sector del trapecio: un asomo débil (S0≈0,26) gatilló `posf` a un ciclo de salir de la pausa → pivote a blanco → cadena de rescates → fuera del tablero arriba-izq. Fixes: posf con guardia 400 ms post-recuperación (pausa/salida de curva/cruce) + CURVA_MIN 60 ms |

| 14 | 34,35 s | 22 | 10 | 0 | la más larga; no salió del tablero (stop del usuario con línea cerca). `ext` gatilló dos veces sobre el borde de un borrón (extremo solo ~100 ms tras suma >2,4) → timeouts a blanco. El `ext` que sí era esquina (+32,52, curva-ok +33,05) venía de suma <1,0. Fix: veto ext/posf 400 ms tras masa ancha (suma >1,4) |

| 15 | 11,38 s | 10 | 7 | 0 | tardó en la primera esquina de 90°: `curva-der/ext` + `curva-ok` funcionaron, pero al reenganchar perdió y `ext` gatilló izq sobre un asomo débil 200 ms tras pausa → 700 ms a blanco → búsqueda → fuera de pista. Fixes: ext también bajo guardia post-recuperación + posF se resetea a la lectura actual al reenganchar la línea |

| 16 | 6,32 s | 9 | 0 | 0 | regresión del veto de masa: MASA_ANCHA 1,4 la alcanzaba una línea fina barriendo dos canales (~1,8) → ext/posf vetados toda la horquilla → pasó de largo la primera curva, 0 esquinas. Fix: MASA_ANCHA 2,0 (borrón real) + ventana 200 ms |

| 17 | 7,53 s | 9 | 1 | 0 | perdió la segunda curva: cinta bajo S1(+S2) y el PD viró duro a la izquierda persiguiendo el centroide — la cruzó a la derecha y se fue. Insight del usuario: S1+S2 = diagonal apuntando adelante-derecha → alinear a la derecha. Fix: término de sesgo `K_SESGO·(n1-n3)` en corr |

| 18 | 12,02 s | 6 | 7 | 0 | perdió en la intersección; el usuario notó oscilación al recentrar la cinta — el propio `K_SESGO=70` oscilaba: cada vaivén S1/S3 inyectaba ±40-70 PWM alternos. Fix: K_SESGO=40 + exige asimetría >0,3 |

| 19 | 5,09 s | 6 | 1 | 0 | nunca enganchó firme: parpadeo S2 224→804→84→680, perdió a los 80 ms, `posf` comprometió sobre masa 0,36 → blanco → fuera. Fix: `corr` se atenúa con la confianza de la lectura (`suma < 0,7` → proporcional) |

| 20 | 6,50 s | 9 | 0 | 0 | oscilación por sobrepaso: la cinta alternaba S3→S1→S3 (cada virada la cruzaba), ping-pong PD↔búsqueda. Dos causas: `deriv` picaba ±300 PWM en cada reenganche (comparaba contra posF pre-pérdida) y la banda media viraba demasiado cerrado. Fixes: deriv=0 al reenganchar + tope suave `CORR_SUAVE=45` con interno dominante |

| 21 | 6,29 s | 8 | 0 | 0 | mismo ciclo límite: enganche débil, viraje a la derecha sostenido 700 ms sobre S3 sin converger, cruce a la izquierda, búsqueda. Nueva perspectiva: el problema desde #14 no es decisión sino ciclo límite del control — la virada no frena al converger. Fix: `FRENO_RETORNO` (corr ×0,4 al converger en banda media), reemplaza `CORR_SUAVE` |

| 22 | 17,58 s | 27 | 4 | 0 | la más larga — el freno de retorno estabilizó el seguimiento. El usuario notó que "se devuelve ligeramente": es `VEL_PIVOTE_INT = -110` (rueda interna en reversa en el pivote). Fix v3: -110 → -70. Luego se instaló v2 para demo (botón arranca/para/rearranca, ya incorporado) |

Las trazas detalladas de cada corrida se pegan en la entrada del día en
`docs/log/` cuando se leen.
