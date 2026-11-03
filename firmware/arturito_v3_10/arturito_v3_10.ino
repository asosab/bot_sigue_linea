/*
 * ==========================================================
 * ROBOT: ARTURITO v3.10 - SEGUIDOR DE LINEA: S2 ANCLA + ALERTAS
 * DESARROLLO: linea de aprendizaje post-concurso
 * ==========================================================
 * Esquema de versiones 3.0x: cada decimal es una vuelta al
 * circuito para ajustar la respuesta. Objetivo de esta etapa:
 * S2 nunca deja de ver linea negra. No es un asunto de
 * velocidad — cuando se logre, se sube VEL_MAX en progresion
 * y se reajustan las respuestas.
 *
 * v3.10 (vuelta 10): 9 vueltas lo confirmaron — el modelo de
 * "acelerar una rueda" mantenia ~140 mm/s de arrastre corrigiendo,
 * y con cinta de 20 mm cualquier giro suficiente la cruzaba por
 * inercia (v3.09 cuadratica: 17 P en 5.6 s). Se vuelve a la ley
 * probada de v2.11: PD simetrico base+-corr (KP 40, KD 80) con
 * base que cae por KS*|posF| + KS2*|deriv| — el carrito entero se
 * frena fuera de linea, no solo una rueda. La maquina 3.x queda
 * intacta (S2 ancla, esquina por puntas, cruce, telemetria 'm').
 *
 * v3.09 (vuelta 9): v3.08 dejo de cazar pero posF subia despacio
 * a +0.9 y no volvia — un solo valor de K no sirve: 90 bastaba
 * cerca del centro pero no en saturacion. Ganancia por banda:
 * corr = K_CORR*exceso + K_CORR2*exceso^2. Suave cerca del
 * centro (~14 PWM a pos 0.3), fuerte en saturacion (~135+ a
 * pos 0.9). Caia de S2: solo 2 en v3.08.
 *
 * v3.08 (vuelta 8): la muestra 'm' de v3.07 mostro posF clavada
 * +-0.9 por 400 ms de cada lado — no es jitter, es caza riel a
 * riel. La cuenta: corr 180*(pos-0.15) da diferencial ~245 a
 * pos=1, casi 3x lo que la v2.11 usaba para seguir a 19.3 s
 * (40*pos+80*deriv repartido +-: ~80-160). pos ademas se satura
 * en +-1 (linea bajo un solo sensor = sin gradiente fino) y la
 * correccion sobreactua justo ahi. K_CORR 180->90, resto igual.
 *
 * v3.07 (vuelta 7): la muestra 'm' mostro la forma del ciclo —
 * posF oscila +-0.8-1.1 cruzando el centro cada ~400 ms. No es
 * ruido ni falta de KD: es momentum. Corrigiendo a ~140 mm/s el
 * carrito cruza la cinta de 20 mm antes de que posF baje, y la
 * rueda interna en reversa lo convierte en giro en el sitio.
 * KS 50->80 (la base cae mas con el exceso) y piso de la interna
 * en 0 en el seguimiento — la reversa queda para los pivotes.
 * Dato bueno: caidas de S2 bajaron de 7-11 a 1.
 *
 * v3.06 (vuelta 6): KD 60->80 (el valor probado de la 2.x; 60 no
 * mato el ciclo en v3.05: 5 P en 3.7 s, 11 alertas con 2
 * resueltas). Y se agrega telemetria de muestreo: evento 'm'
 * cada 200 ms con posF — la forma de la oscilacion (amplitud,
 * frecuencia, si se amortigua o crece) dice si falta autoridad,
 * sobra ganancia o hay ruido, en vez de ajustar a tientas.
 *
 * v3.05 (vuelta 5): la corrida de v3.04 mostro el ciclo limite —
 * P->R cada 0.2-0.4 s, alertas de lado y lado: la correccion pura
 * proporcional no frena al retorno y el carrito cruza la linea de
 * lado a lado (los 'o' quedan en 0 porque el cruce pasa por tramos
 * oscuros y la alerta se cierra antes). Se agrega amortiguacion
 * por derivada: corrF = K_CORR*exceso*signo + KD*deriv, con el
 * mismo reparto acelera-externa/frena-interna aplicado a |corrF|.
 *
 * v3.04 (vuelta 4): la corrida de v3.03 perdio el camino de verdad —
 * el usuario lo vio: se mueve demasiado lateralmente buscando la
 * linea y se la pasa de largo. El pivote de busqueda a 130 gira
 * rapido y el reenganche a 0.45 la exige solida: cuando el trio la
 * acepta ya esta del otro lado. VEL_BUSQUEDA 130->110,
 * VEL_ESQ_EXT 170->140, TRIO_ENGANCHE 0.45->0.35. Riesgo anotado:
 * si 110 no gira el chasis, subir a 115.
 *
 * v3.03 (vuelta 3): la corrida de v3.02 ya se movio (6 perdidas
 * en 2.9 s, reenganches de 0.0-0.4 s, una alerta de posF 1.03
 * resuelta al centro) pero siguio sin haber sobrepasos: hay
 * margen para corregir mas. posF llegaba tarde — ALPHA 0.4->0.55
 * (posF sigue mas rapido a la linea real) y K_CORR 140->180
 * (autoridad en banda media, donde hoy escala a oscuras). Si
 * aparecen 'o', ese es el techo.
 *
 * v3.02 (vuelta 2): la corrida de v3.01 registro 2.2 s con todo
 * en cero — el carrito nunca se movio. VEL_MAX 120 quedo por
 * debajo del umbral de arranque del chasis con la bateria actual
 * (los motores sonaban sin avanzar). Se sube a 150, punto medio
 * reducido que seguro mueve; maniobras acordes. Ademas 'B' ya no
 * se registra cuando el boost esta apagado.
 *
 * v3.01 (vuelta 1): la corrida de v3.0 dio 42 perdidas y 0
 * sobrepasos — la correccion llega tarde y sin autoridad, no
 * se pasa. Ajustes: velocidad reducida (VEL_MAX 180 -> 120,
 * boost apagado), la rueda interna tambien frena en
 * proporcion (FRAC_INT: mismo giro, mas autoridad), la base
 * cae con la profundidad de la alerta (KS, como en la linea
 * 2.x) y la banda muerta se achica (0.25 -> 0.15) para
 * corregir antes. Fix del informe: 'R oscuros' guardaba
 * centesimas y las imprimia como segundos.
 *
 * Apertura de la linea 3.x sobre la base probada de v2.13
 * (19.3 s quedo como referencia de lo que dio el concurso; aca
 * el objetivo es entender y mejorar, no competir). Nada de la
 * v3 vieja (arturito_v3,
 * abandonada): las maniobras comprometidas a prueba y error
 * quedan descartadas. Modelo nuevo, una sola idea:
 *
 *   S2 nunca deberia soltar la linea.
 *
 *   S1/S3 son las alarmas tempranas: si uno se apaga, la linea
 *   se esta yendo a ese lado y toca corregir antes de que S2
 *   la pierda. S0/S4 son informacion de borde: prendidos los
 *   dos = cruce de caminos; uno solo con el trio oscuro = el
 *   vertice de una esquina que ya se paso, y la punta que ve
 *   linea dice a que lado doblar. Trio oscuro sin punta =
 *   perdida real; entra la recuperacion con la memoria del
 *   ultimo lado que vio linea.
 *
 * Correccion proporcional, no conmutada: fuera de una banda
 * muerta chica se acelera SOLO la rueda del lado que perdio la
 * linea, en proporcion a posF (media ponderada filtrada, misma
 * escala +-2 de la linea 2.x). Si la correccion pasa el techo
 * PWM, el exceso frena la rueda contraria — asi la alerta
 * profunda (solo S1 o solo S3 viendo) dobla fuerte sin cambiar
 * de modo.
 *
 * Telemetria (lo nuevo de la 3.0): cada alerta deja su evento
 * en EEPROM con el |posF| de entrada; al cerrarse queda
 * registrado si volvio limpio al centro ('k'), si se paso al
 * lado contrario ('o' = sobrepaso, correccion excesiva) o si
 * escalo a esquina/perdida. Cada caida de S2 deja evento 's'
 * con la mascara de quien seguia viendo linea. El ciclo de
 * ajuste es: correr -> 'r'/'t' por serial -> si mandan los 'o',
 * bajar K_CORR o subir MUERTA_POS; si mandan los 's', subir
 * K_CORR o bajar VEL_MAX. Meta: sobrepasos y caidas de S2 en
 * casi cero.
 *
 * Largada igual que la linea 2.x: apoyar sobre la linea, S2
 * sobre negro con S0/S4 libres. Apretar D8 prepara el arranque
 * y soltarlo larga; apretar en carrera detiene y devuelve a la
 * espera. La calibracion viva siembra la pista en la espera
 * (S0/S4 dan el blanco, S2 el negro).
 *
 * Hardware: UNO + 5xTCRT5000 (A0..A4, flecha: S2 adelante,
 * S1/S3 medios, S0/S4 atras en las puntas) + DRV8833 (IN1..IN4
 * en D5/D6/D9/D10, EEP en D4, ULT en D2).
 */

#include <EEPROM.h>

// --- PINES ---
#define S0 A0 // extremo izquierdo (atras en la flecha)
#define S1 A1 // medio izquierdo
#define S2 A2 // centro (punta adelantada)
#define S3 A3 // medio derecho
#define S4 A4 // extremo derecho (atras en la flecha)

#define IN1 5   // motor izquierdo adelante (PWM)
#define IN2 6   // motor izquierdo atras (PWM)
#define IN3 9   // motor derecho adelante (PWM)
#define IN4 10  // motor derecho atras (PWM)
#define SLEEP_DRV 4 // EEP del DRV8833: HIGH = despierto
#define FAULT_PIN 2 // ULT del DRV8833 (opcional)
#define BTN 8       // pulsador de largada: entre D8 y GND, pull-up
                    // interno (presionado = LOW). Sin resistencias.

// --- PARAMETROS DE CONTROL ---
const int VEL_MAX = 150;      // velocidad en recta. 3.02: 120 no
                              // movia el chasis (umbral de arranque);
                              // 150 es el piso que lo mueve con margen
const int VEL_MIN = 60;       // piso de la base bajo alerta profunda
// Ley de correccion = la probada de v2.11 (19.3 s): PD simetrico
// base+-corr y base que cae con |posF| y |deriv|. El modelo de
// "acelerar una rueda" de la 3.0x mantenia ~140 mm/s de arrastre
// corrigiendo: con cinta de 20 mm cualquier giro suficiente la
// cruzaba por inercia (9 vueltas lo confirmaron).
const float KP = 40.0;        // giro proporcional por unidad de posF
const float KD = 80.0;        // amortigua el retorno (valor v2 probado)
const float KS = 70.0;        // cuanto baja la base con |posF| (v2: 70)
const float KS2 = 100.0;      // freno por derivada: posF moviendose
                              // rapido = curva empezando; baja antes
                              // de salirse (v2: 150; 100 con la 3.x)
const float ALPHA = 0.4;      // filtro EMA (v2 probado; 0.5 la dejo
                              // nerviosa en las corridas de la 2.x)
const int REV_MAX = 60;       // reversa maxima en la rueda interna
const float K_PUNTA = 0.5;    // peso de S0/S4 dentro de pos (tiran
                              // menos: avisan, no mandan)
const float TRIO_MIN = 0.3;   // suma S1+S2+S3 para "trio ve linea"
const float TRIO_ENGANCHE = 0.35; // para volver de esquina/busqueda el
                              // trio tiene que verla. 3.04: 0.45 era
                              // tarde — al exigirla solida el pivote
                              // ya se la habia pasado de largo
const float SUMA_AMBIGUA = 2.0;   // suma con mas de una linea bajo el
                              // arreglo: posF se congela en lo que traia

// Umbrales binarios con histeresis: el sensor prende arriba de
// NEG_ON y apaga abajo de NEG_OFF; entre los dos conserva estado.
const float NEG_ON = 0.55;
const float NEG_OFF = 0.35;

// Alertas (solo telemetria: marcan donde medir el sobrepaso)
const float ALERTA_POS = 0.4; // |posF| donde arranca una alerta
const float ALERTA_OK = 0.2;  // |posF| donde la alerta se da por cerrada

// Muestreo periodico de posF para la traza (evento 'm'): la forma
// de la oscilacion dice si es ciclo limite, ruido o falta de
// autoridad — sin ella el ajuste va a tientas
const unsigned long MUESTRA_MS = 200;

// Esquina: trio oscuro con una sola punta viendo linea. Pivote
// hacia esa punta; la rueda interna en reversa leve (-110 se
// devolvia en la corrida de v2.6; -70 es el valor medido).
const int VEL_ESQ_EXT = 140;  // 3.04: 170 lo pasaba de largo; el
                              // pivote mas lento no barre la linea
const int VEL_ESQ_INT = -70;
const unsigned long ESQ_MAX_MS = 700;   // techo del pivoteo; luego recupera
const int GRACIA_OSCUROS = 6;  // ~40 ms congelando la orden para que
                               // una punta declare la esquina

// Recuperacion de linea perdida (heredada de v2.12, probada)
const unsigned long GIRO_BUSQUEDA_MS = 450; // pivoteo antes de rebobinar
const int VEL_BUSQUEDA = 110; // 3.04: 130 pivotaba tan rapido que se
                              // pasaba la linea de largo al reenganchar.
                              // Si no gira (torque), anotar y subir a 115
const int VEL_REBOBINADO = 115;

// Cruce: S0 y S4 prendidos = camino perpendicular; avance recto
// comprometido para no tomar un ramal por una lectura a medias
const int VEL_CRUCE = 140;    // 3.02: acorde a la velocidad
const unsigned long AVANCE_CRUCE_MS = 140;

// Boost de recta: |posF| bajo sostenido = recta de verdad
const float RECTA_POS = 0.35;
const int RECTA_CICLOS = 12;    // ~80 ms seguidos antes de subir
const float RECTA_SOLTAR = 0.8; // histeresis
const int BOOST_RECTA = 0;      // extra sobre VEL_MAX (0 = apagado;
                                // 3.01: la velocidad no es el objetivo)

// Trim de motores (1.0 = igual). Interpola entre TRIM_DER abajo
// y TRIM_DER_ALTA a 255: la deriva cambia con la velocidad.
const float TRIM_IZQ = 1.0;
const float TRIM_DER = 1.02;
const float TRIM_DER_ALTA = 0.85;

// Compuerta de arranque: margen en ADC crudo contra el blanco
const int MARGEN_PISTA = 300;

// Antirrebote del pulsador
const unsigned long BTN_DEBOUNCE_MS = 50;

// Calibracion inicial de laboratorio (por canal). En cinta negra
// sobre papel blanco: blanco ~26-30, negro ~850-960. La siembra
// viva de largada los reemplaza con el rango real de la pista.
int calMin[5] = {30, 30, 30, 30, 30};
int calMax[5] = {930, 930, 930, 930, 930};

const int CANALES[5] = {S0, S1, S2, S3, S4};

int lecturas[5];
bool neg[5];                    // estado binario por canal, con histeresis
bool s2Antes = true;            // para detectar el flanco de caida de S2
float posF = 0;
float posPrev = 0;
int ciclosOscuros = 0;          // ciclos seguidos con el trio a oscuras
byte maskOscuro = 0;            // quien veia linea en el 1er ciclo oscuro
unsigned long oscuroDesde = 0;
unsigned long esqDesde = 0;     // inicio de la maniobra de esquina (0 = no)
unsigned long perdidaDesde = 0; // inicio de la recuperacion (0 = no)
unsigned long cruceHasta = 0;
int ultimoLado = 0;             // -1 izquierda, +1 derecha
int alertaLado = 0;             // lado de la alerta abierta (signo de posF)
float alertaPico = 0;           // mayor |posF| durante la alerta abierta
int ciclosRecta = 0;
bool boostActivo = false;
int velIzqCmd = 0;              // ultima orden: la gracia la congela
unsigned long ultMuestra = 0;   // ultimo evento 'm' emitido
int velDerCmd = 0;
bool arrancado = false;
bool btnPrev = HIGH;
bool preparado = false;
unsigned long btnUltimo = 0;
unsigned long inicioCarrera = 0;

// Metricas de la corrida: se guardan en EEPROM y se leen con 'r'
unsigned int perdidas = 0;      // entradas a recuperacion (trio oscuro sin punta)
unsigned int cruces = 0;        // S0 y S4 prendidos a la vez
unsigned int esquinas = 0;      // maniobras de esquina
unsigned int s2perdidas = 0;    // flancos de caida de S2 (la metrica a bajar)
unsigned int alertas = 0;       // alertas abiertas
unsigned int sobrepasos = 0;    // alertas que cruzaron al lado contrario
unsigned int resueltas = 0;     // alertas cerradas volviendo al centro

// Mapa de EEPROM (se conserva solo la ultima corrida)
const byte EE_FIRMA = 0xA3;         // formato v3 (0xA2 era la linea 2.x)
const int EE_FIRMA_DIR = 0;         // 1 byte
const int EE_NEV = 1;               // 1 byte: cantidad de eventos
const int EE_TIEMPO = 2;            // 4 bytes: ms de carrera (0 = sin cierre)
const int EE_PERD = 6;              // 1 byte: perdidas
const int EE_CRUCES = 7;            // 1 byte: cruces
const int EE_CAL = 8;               // 20 bytes: calMin/calMax finales
const int EE_STATS = 28;            // 5 bytes: alertas, sobrepasos,
                                    // esquinas, s2perdidas, resueltas
const int EE_EVENTOS = 36;          // 4 bytes por evento:
                                    // tipo + decimas de s + info
const int EE_MAX_EV = 115;          // 36 + 115*4 = 496 < 1024

// --- MOTORES (velocidad con signo: + adelante, - atras) ---
void motorIzq(int vel) {
  vel = constrain(vel, -255, 255);
  if (vel >= 0) {
    analogWrite(IN1, vel);
    digitalWrite(IN2, LOW);
  } else {
    digitalWrite(IN1, LOW);
    analogWrite(IN2, -vel);
  }
}

void motorDer(int vel) {
  vel = constrain(vel, -255, 255);
  if (vel >= 0) {
    analogWrite(IN3, vel);
    digitalWrite(IN4, LOW);
  } else {
    digitalWrite(IN3, LOW);
    analogWrite(IN4, -vel);
  }
}

void detener() {
  motorIzq(0); motorDer(0);
}

// --- SENSORES Y CALIBRACION ADAPTATIVA ---
// Lee los 5 canales y expande calMin/calMax con cada extremo nuevo.
void leerSensores() {
  for (int i = 0; i < 5; i++) {
    int v = analogRead(CANALES[i]);
    lecturas[i] = v;
    if (v < calMin[i]) calMin[i] = v;
    if (v > calMax[i]) calMax[i] = v;
  }
}

// Negrura de un canal normalizada 0..1 segun su calibracion
float negrura(int i) {
  float n = (float)(lecturas[i] - calMin[i]) / (float)(calMax[i] - calMin[i]);
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}

// Estado binario por canal con histeresis: prende sobre NEG_ON,
// apaga bajo NEG_OFF, entre los dos conserva lo que tenia. Asi el
// estado no parpadea con el ruido del borde de la cinta.
void leerBinarios() {
  for (int i = 0; i < 5; i++) {
    float n = negrura(i);
    if (neg[i]) {
      if (n < NEG_OFF) neg[i] = false;
    } else if (n > NEG_ON) {
      neg[i] = true;
    }
  }
}

// Calibracion viva: corre en cada ciclo de la espera. El apoyo
// garantiza S0/S4 sobre blanco y S2 sobre negro, asi que el blanco
// real es el menor de las puntas y el negro real lo da S2. Si no
// hay contraste (en la mano, mal apoyado) no siembra.
void sembrarPista() {
  int blanco = min(lecturas[0], lecturas[4]);
  int negro = lecturas[2];
  if (negro - blanco < 50) return;
  for (int i = 0; i < 5; i++) {
    calMin[i] = blanco;
    calMax[i] = negro;
  }
}

// --- REGISTRO EN EEPROM ---
// Al largar: deja el registro en cero (solo escribe bytes que cambian).
void eeIniciar() {
  EEPROM.update(EE_FIRMA_DIR, EE_FIRMA);
  EEPROM.update(EE_NEV, 0);
  EEPROM.update(EE_PERD, 0);
  EEPROM.update(EE_CRUCES, 0);
  EEPROM.put(EE_TIEMPO, 0UL);
  for (int i = 0; i < 5; i++) EEPROM.update(EE_STATS + i, 0);
}

// Vuelca los contadores a EEPROM; se llama en cada evento y al
// cerrar, asi el informe sobrevive aunque se apague en carrera.
void eeStats() {
  EEPROM.update(EE_PERD, perdidas > 255 ? 255 : perdidas);
  EEPROM.update(EE_CRUCES, cruces > 255 ? 255 : cruces);
  EEPROM.update(EE_STATS + 0, alertas > 255 ? 255 : alertas);
  EEPROM.update(EE_STATS + 1, sobrepasos > 255 ? 255 : sobrepasos);
  EEPROM.update(EE_STATS + 2, esquinas > 255 ? 255 : esquinas);
  EEPROM.update(EE_STATS + 3, s2perdidas > 255 ? 255 : s2perdidas);
  EEPROM.update(EE_STATS + 4, resueltas > 255 ? 255 : resueltas);
}

// En carrera: agrega un evento con su tiempo y un byte de info.
// Tipos: 'a' alerta linea a la izq, 'd' alerta a la der (info =
// |posF|*100 de entrada), 'k' alerta resuelta al centro y 'o'
// sobrepaso al lado contrario (info = pico *100), 's' caida de S2
// (info = mascara de quien veia linea), 'E' esquina (info = mascara
// de puntas), 'R' reenganche (info = decimas de s a oscuras), 'P'
// perdida real (info = mascara de vista), 'C' cruce, 'B' boost.
void eeEvento(char tipo, byte info) {
  byte n = EEPROM.read(EE_NEV);
  if (n < EE_MAX_EV) {
    int dir = EE_EVENTOS + 4 * n;
    unsigned int d = (millis() - inicioCarrera) / 100;
    EEPROM.update(dir, (byte)tipo);
    EEPROM.put(dir + 1, d);
    EEPROM.update(dir + 3, info);
    EEPROM.update(EE_NEV, n + 1);
  }
  eeStats();
}

// Al detener: guarda calibracion final, contadores y tiempo total.
void eeCerrar() {
  unsigned long t = millis() - inicioCarrera;
  if (t == 0) t = 1;
  for (int i = 0; i < 5; i++) {
    EEPROM.put(EE_CAL + 4 * i, (unsigned int)calMin[i]);
    EEPROM.put(EE_CAL + 4 * i + 2, (unsigned int)calMax[i]);
  }
  eeStats();
  EEPROM.put(EE_TIEMPO, t);
}

void eeBorrar() {
  EEPROM.update(EE_FIRMA_DIR, 0);
  Serial.println(F("Registro borrado."));
}

// Decodifica la mascara de 5 bits como lista de sensores
void imprimeVista(byte info) {
  Serial.print(F("  vista:"));
  if (info == 0) Serial.print(F(" nada"));
  for (int s = 0; s < 5; s++) {
    if (info & (1 << s)) {
      Serial.print(F(" S")); Serial.print(s);
    }
  }
}

void eeInforme() {
  if (EEPROM.read(EE_FIRMA_DIR) != EE_FIRMA) {
    Serial.println(F("EEPROM sin datos."));
    return;
  }
  unsigned long t;
  EEPROM.get(EE_TIEMPO, t);
  Serial.println(F("--- ULTIMA CORRIDA (v3.10) ---"));
  if (t > 0) {
    Serial.print(F("Tiempo (s): "));
    Serial.println(t / 1000.0, 1);
  } else {
    Serial.println(F("Sin cierre: se apago sin pulsador. Ver ultimo evento."));
  }
  Serial.print(F("Perdidas: ")); Serial.println(EEPROM.read(EE_PERD));
  Serial.print(F("Cruces: ")); Serial.println(EEPROM.read(EE_CRUCES));
  Serial.print(F("Alertas: ")); Serial.println(EEPROM.read(EE_STATS + 0));
  Serial.print(F("  resueltas al centro: ")); Serial.println(EEPROM.read(EE_STATS + 4));
  Serial.print(F("  sobrepasos (correccion pasada): ")); Serial.println(EEPROM.read(EE_STATS + 1));
  Serial.print(F("Esquinas: ")); Serial.println(EEPROM.read(EE_STATS + 2));
  Serial.print(F("S2 perdio senal: ")); Serial.println(EEPROM.read(EE_STATS + 3));
  if (t > 0) {
    Serial.println(F("Calibracion final (min-max):"));
    for (int i = 0; i < 5; i++) {
      unsigned int a, b;
      EEPROM.get(EE_CAL + 4 * i, a);
      EEPROM.get(EE_CAL + 4 * i + 2, b);
      Serial.print(F("S")); Serial.print(i);
      Serial.print(F(": ")); Serial.print(a);
      Serial.print(F("-")); Serial.println(b);
    }
  }
  byte n = EEPROM.read(EE_NEV);
  Serial.println(F("Eventos en segundos:"));
  Serial.println(F("a/d alerta izq/der (info=|posF| entra), k resuelta"));
  Serial.println(F("y o sobrepaso (info=pico), s caida S2, E esquina,"));
  Serial.println(F("R reenganche, P perdida, C cruce, B boost,"));
  Serial.println(F("m muestra de posF cada 200 ms:"));
  for (byte i = 0; i < n; i++) {
    int dir = EE_EVENTOS + 4 * i;
    char tipo = (char)EEPROM.read(dir);
    unsigned int d;
    EEPROM.get(dir + 1, d);
    byte info = EEPROM.read(dir + 3);
    Serial.print(tipo); Serial.print(F(" "));
    Serial.print(d / 10.0, 1);
    switch (tipo) {
      case 'a': case 'd':
        Serial.print(F("  pos=")); Serial.print(info / 100.0, 2);
        break;
      case 'm':
        Serial.print(F("  pos=")); Serial.print(info / 63.75 - 2.0, 2);
        break;
      case 'k': case 'o':
        Serial.print(F("  pico=")); Serial.print(info / 100.0, 2);
        break;
      case 's': case 'P':
        imprimeVista(info);
        break;
      case 'E':
        Serial.print(F("  punta:"));
        if (info & 1) Serial.print(F(" S0"));
        if (info & 16) Serial.print(F(" S4"));
        break;
      case 'R':
        Serial.print(F("  oscuros=")); Serial.print(info / 10.0, 1);
        Serial.print(F("s"));
        break;
    }
    Serial.println();
  }
  Serial.println(F("--- FIN ---"));
}

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  detener();

  // Despertar el DRV8833 (EEP en HIGH)
  pinMode(SLEEP_DRV, OUTPUT);
  digitalWrite(SLEEP_DRV, HIGH);
  pinMode(FAULT_PIN, INPUT_PULLUP);
  pinMode(BTN, INPUT_PULLUP); // presionado = LOW

  Serial.begin(9600);
  Serial.println(F("===== ARTURITO v3.10 ====="));
  Serial.println(F("Comandos: r o t = informe, b = borrar"));
}

void loop() {
  leerSensores();
  leerBinarios();

  // 1. Pulsador: flancos con antirrebote. Apretar prepara la
  //    largada, soltar la ejecuta; en carrera, apretar detiene.
  bool btn = digitalRead(BTN);
  bool flancoBajo = false, flancoAlto = false;
  if (btn != btnPrev && millis() - btnUltimo > BTN_DEBOUNCE_MS) {
    btnUltimo = millis();
    btnPrev = btn;
    if (btn == LOW) flancoBajo = true;
    else flancoAlto = true;
  }

  // 2. Compuerta de arranque: apretar arma y soltar larga, solo si
  //    el apoyo es bueno en ese instante: S2 sobre negro con margen
  //    contra el blanco que ven S0/S4, y las puntas libres.
  if (!arrancado) {
    if (flancoBajo) preparado = true;
    if (flancoAlto && preparado) {
      preparado = false;
      int blanco = min(lecturas[0], lecturas[4]);
      bool apoyoOk = lecturas[2] - blanco > MARGEN_PISTA &&
                     lecturas[0] - blanco < MARGEN_PISTA / 2 &&
                     lecturas[4] - blanco < MARGEN_PISTA / 2;
      if (apoyoOk) {
        arrancado = true;
        posF = posPrev = 0;
        ciclosOscuros = 0;
        oscuroDesde = 0;
        esqDesde = 0;
        perdidaDesde = 0;
        cruceHasta = 0;
        ultimoLado = 0;
        alertaLado = 0;
        alertaPico = 0;
        ciclosRecta = 0;
        boostActivo = false;
        velIzqCmd = velDerCmd = 0;
        s2Antes = true;
        perdidas = cruces = esquinas = s2perdidas = 0;
        alertas = sobrepasos = resueltas = 0;
        eeIniciar();
        inicioCarrera = millis();
        ultMuestra = millis();
        Serial.print(F("Pista: blanco ")); Serial.print(blanco);
        Serial.print(F(" negro ")); Serial.println(lecturas[2]);
      }
    }
    if (!arrancado) {
      detener();
      sembrarPista(); // siembra en vivo mientras espera la largada
      if (Serial.available()) {
        char c = Serial.read();
        if (c == 'r' || c == 't') eeInforme();
        else if (c == 'b') eeBorrar();
      }
      delay(5);
      return;
    }
  }
  // 3. En carrera: apretar detiene y devuelve a la espera. El mismo
  //    apretado no arma (preparado queda en falso), asi que soltar
  //    no relanza.
  else if (flancoBajo) {
    arrancado = false;
    detener();
    eeCerrar();
    delay(5);
    return;
  }

  // 4. Caida de S2: la metrica central de la 3.x. Cada flanco deja
  //    evento 's' con la mascara de quien seguia viendo linea.
  if (s2Antes && !neg[2]) {
    s2perdidas++;
    byte vista = 0;
    for (int i = 0; i < 5; i++) {
      if (negrura(i) > 0.15) vista |= (1 << i);
    }
    eeEvento('s', vista);
  }
  s2Antes = neg[2];

  // 5. Cruce comprometido: recto sin leer hasta que venza el tramo
  if (cruceHasta) {
    if (millis() < cruceHasta) {
      motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
      delay(5);
      return;
    }
    cruceHasta = 0;
  }

  // Lecturas continuas de este ciclo
  float n0 = negrura(0), n1 = negrura(1), n2 = negrura(2);
  float n3 = negrura(3), n4 = negrura(4);
  float trio = n1 + n2 + n3;
  float suma = trio + K_PUNTA * (n0 + n4);

  // 6. Cruce de caminos: las dos puntas prendidas a la vez solo lo
  //    da un camino perpendicular bajo el arreglo. Recto fijo.
  if (neg[0] && neg[4]) {
    cruceHasta = millis() + AVANCE_CRUCE_MS;
    posF = posPrev = 0;
    perdidaDesde = 0;
    esqDesde = 0;
    ciclosOscuros = 0;
    alertaLado = 0;
    cruces++;
    motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
    velIzqCmd = velDerCmd = VEL_CRUCE;
    eeEvento('C', 0);
    delay(5);
    return;
  }

  bool enManiobra = (esqDesde != 0 || perdidaDesde != 0);
  bool trioOk = trio > (enManiobra ? TRIO_ENGANCHE : TRIO_MIN);

  // 7. Trio con linea a la vista: el regimen normal. Correccion
  //    proporcional acelerando la rueda del lado que perdio.
  if (trioOk) {
    // Reenganche tras esquina o perdida: cuanto duro a oscuras
    if (enManiobra && oscuroDesde) {
      eeEvento('R', (byte)min(255L, (millis() - oscuroDesde) / 100));
    }
    esqDesde = 0;
    perdidaDesde = 0;
    ciclosOscuros = 0;
    oscuroDesde = 0;

    // Posicion lateral ponderada (-2 izq .. +2 der): el trio pesa
    // 1 por canal, las puntas K_PUNTA — avisan antes, no mandan.
    // Con mas de una linea bajo el arreglo el centroide miente:
    // posF se congela en lo que traia.
    if (suma < SUMA_AMBIGUA) {
      float pos = (-2.0 * K_PUNTA * n0 - n1 + n3 + 2.0 * K_PUNTA * n4) / suma;
      posF += ALPHA * (pos - posF);        // EMA: corta los saltos
      if (posF > 0.2) ultimoLado = 1;
      else if (posF < -0.2) ultimoLado = -1;
    }
    // Derivada del ciclo (posF ya viene filtrada). Tras un tramo
    // oscuro posPrev trae el valor viejo: deriv sale en 0 al
    // reenganchar — mismo arreglo que la corrida #20 de la 2.x.
    float deriv = posF - posPrev;
    posPrev = posF;

    // Registro de alertas: abre al pasar ALERTA_POS, cierra al
    // volver bajo ALERTA_OK ('k') o al cruzar al lado contrario
    // ('o' = la correccion se paso: el dato para ajustar K_CORR).
    if (alertaLado == 0) {
      if (posF > ALERTA_POS || posF < -ALERTA_POS) {
        alertaLado = (posF > 0) ? 1 : -1;
        alertaPico = (posF > 0) ? posF : -posF;
        alertas++;
        eeEvento(posF > 0 ? 'd' : 'a', (byte)min(255.0, (posF > 0 ? posF : -posF) * 100));
      }
    } else {
      float ap = (posF > 0) ? posF : -posF;
      if (ap > alertaPico) alertaPico = ap;
      if (posF * alertaLado < -ALERTA_POS) {
        sobrepasos++;
        eeEvento('o', (byte)min(255.0, alertaPico * 100));
        alertaLado = (posF > 0) ? 1 : -1;
        alertaPico = ap;
        alertas++;
        eeEvento(posF > 0 ? 'd' : 'a', (byte)min(255.0, ap * 100));
      } else if (ap < ALERTA_OK) {
        resueltas++;
        eeEvento('k', (byte)min(255.0, alertaPico * 100));
        alertaLado = 0;
      }
    }

    // Boost con histeresis: arma con recta sostenida, suelta en curva
    if (boostActivo) {
      if (posF > RECTA_SOLTAR || posF < -RECTA_SOLTAR) {
        boostActivo = false;
        ciclosRecta = 0;
      }
    } else {
      if (posF < RECTA_POS && posF > -RECTA_POS) ciclosRecta++;
      else ciclosRecta = 0;
      if (ciclosRecta >= RECTA_CICLOS) {
        boostActivo = true;
        if (BOOST_RECTA > 0) eeEvento('B', 0);
      }
    }

    int velMax = VEL_MAX + (boostActivo ? BOOST_RECTA : 0);

    // Muestreo periodico de posF (evento 'm', cada MUESTRA_MS):
    // info = (posF + 2) * 63.75, se decodifica restando 2
    if (millis() - ultMuestra >= MUESTRA_MS) {
      ultMuestra = millis();
      eeEvento('m', (byte)constrain((int)((posF + 2.0) * 63.75), 0, 255));
    }

    // Correccion = la ley probada de v2.11: PD simetrico sobre
    // base que cae con |posF| y |deriv|. corr>0 = girar a la
    // derecha (rueda izquierda mas rapida, derecha mas lenta).
    // La base baja con el error y con la velocidad del error:
    // todo el carrito se frena fuera de linea, no solo una rueda
    // — eso es lo que sostenia 19.3 s en la linea 2.x.
    float corr = KP * posF + KD * deriv;
    int base = (int)(velMax - KS * (posF > 0 ? posF : -posF)
                          - KS2 * (deriv > 0 ? deriv : -deriv));
    if (base < VEL_MIN) base = VEL_MIN;
    int velIzq = (int)(base + corr);
    int velDer = (int)(base - corr);
    if (velIzq > 255) { velDer -= (velIzq - 255); velIzq = 255; }
    if (velDer > 255) { velIzq -= (velDer - 255); velDer = 255; }

    float trimDer = TRIM_DER + (TRIM_DER_ALTA - TRIM_DER) * (velMax / 255.0);
    velIzqCmd = constrain((int)(velIzq * TRIM_IZQ), -REV_MAX, 255);
    velDerCmd = constrain((int)(velDer * trimDer), -REV_MAX, 255);
    motorIzq(velIzqCmd);
    motorDer(velDerCmd);
    delay(5);
    return;
  }

  // 8. Trio a oscuras. Primer ciclo: foto de quien la veia todavia
  //    y cierre silencioso de la alerta abierta (el desenlace lo
  //    cuentan 'E' o 'P', no 'k' ni 'o').
  if (ciclosOscuros == 0) {
    maskOscuro = 0;
    for (int i = 0; i < 5; i++) {
      if (negrura(i) > 0.15) maskOscuro |= (1 << i);
    }
    oscuroDesde = millis();
    alertaLado = 0;
  }
  ciclosOscuros++;

  // Una sola punta viendo linea = vertice de esquina ya pasado:
  // la punta dice a que lado doblar. El pivote arranca con la
  // punta prendida y se sostiene aunque se apague a mitad del
  // giro (la linea barre hacia el trio: es lo esperado), hasta
  // que el trio reenganche o venza el techo.
  int ladoExt = 0;
  if (neg[0] && !neg[4]) ladoExt = -1;
  else if (neg[4] && !neg[0]) ladoExt = 1;
  if (ladoExt != 0) ultimoLado = ladoExt;
  if (ladoExt != 0 && esqDesde == 0) {
    esqDesde = millis();
    esquinas++;
    byte info = (neg[0] ? 1 : 0) | (neg[4] ? 16 : 0);
    eeEvento('E', info);
  }
  if (esqDesde != 0 && millis() - esqDesde < ESQ_MAX_MS) {
    // ultimoLado quedo fijado al arrancar (y se actualiza si la
    // otra punta declara): izquierda atras leve, derecha adelante
    motorIzq(ultimoLado < 0 ? VEL_ESQ_INT : VEL_ESQ_EXT);
    motorDer(ultimoLado < 0 ? VEL_ESQ_EXT : VEL_ESQ_INT);
    velIzqCmd = (ultimoLado < 0) ? VEL_ESQ_INT : VEL_ESQ_EXT;
    velDerCmd = (ultimoLado < 0) ? VEL_ESQ_EXT : VEL_ESQ_INT;
    delay(5);
    return;
  }
  esqDesde = 0;

  // 9. Gracia: a oscuras y sin punta, congela la ultima orden unos
  //    ciclos — en una esquina la linea tarda un tramo en llegar a
  //    la punta, y declararla perdida antes de tiempo pivotaba al
  //    lado equivocado.
  if (ciclosOscuros <= GRACIA_OSCUROS) {
    motorIzq(velIzqCmd);
    motorDer(velDerCmd);
    delay(5);
    return;
  }

  // 10. Perdida real: pivotea hacia el ultimo lado que vio linea;
  //     si no la encuentra, rebobina recto con el rumbo congelado.
  if (perdidaDesde == 0) {
    perdidaDesde = millis();
    perdidas++;
    eeEvento('P', maskOscuro);
  }
  unsigned long perdidaMs = millis() - perdidaDesde;
  if (perdidaMs < GIRO_BUSQUEDA_MS) {
    int giro = (ultimoLado >= 0) ? VEL_BUSQUEDA : -VEL_BUSQUEDA;
    motorIzq(giro);
    motorDer(-giro);
  } else {
    motorIzq(-VEL_REBOBINADO);
    motorDer(-VEL_REBOBINADO);
  }
  delay(5);
}
