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
| 11 | 13,50 s | 18 | 9 | 0 | llegó a la intersección en X pero los disparos ext/posf se adelantan al todo-negro: cada brazo de la X dispara esquina como si fuera curva real → camino equivocado. Pivote en reversa confirmado en traza (v150 -110) |

Las trazas detalladas de cada corrida se pegan en la entrada del día en
`docs/log/` cuando se leen.
