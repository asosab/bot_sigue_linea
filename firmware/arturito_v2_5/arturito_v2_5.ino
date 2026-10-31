/*
 * ==========================================================
 * ROBOT: ARTURITO v2.5 - V2 REFORZADA CON LO MEJOR DE V3
 * CONCURSO: 1er Concurso Distrital de Robotica 2026 (Santa Cruz)
 * ==========================================================
 * Base v2 (que sigue la linea bien) mas las piezas de v3 que
 * aportan sin apostar a ciegas. Lo que v3 tenia de mas — tres
 * disparadores de curva, sesgo, confianza, vetos de masa — eran
 * parches sobre un PD inestable y se quitaron (ver
 * docs/analisis-v2-v3.md).
 *
 * Largada: apretar D8 prepara, soltar larga si el apoyo es bueno
 * (S2 sobre negro, S0/S4 libres). Apretar en carrera detiene y
 * devuelve a la espera.
 *
 * - Posicion en mm reales (geometria de la flecha) con zona
 *   muerta +-DB_MM: centrado va a VEL_MAX pleno, sin corregir
 *   ruido = turbo de recta.
 * - PD con freno de retorno: al converger en banda media la
 *   correccion se atenúa; fue lo que corto el ciclo limite que
 *   cruzaba la cinta al recentrar (corridas #14-#22).
 * - Rueda interna en piso RUEDA_MIN (0 si el error es grande):
 *   dobla con diferencial sin frenar.
 * - Historial de posiciones: distingue cruce de esquina en el
 *   todo-negro y da el lado de la busqueda.
 * - Curva comprometida solo cuando el PD ya no tiene senal:
 *   extremo solo (la linea se salio del arreglo) o todo-negro
 *   con historial corrido (cuadrado de esquina). Nada de
 *   comprometer giros sobre centroide: eso lo resuelve el PD.
 * - Busqueda acotada por fases: ninguna maniobra junta mas de
 *   ~90 grados, no puede quedar mirando para atras.
 * - Traza EEPROM identica a v3: anillo de eventos con canales
 *   crudos, posF y comandos; calibracion persistida.
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

#define DEBUG 0 // 1 = imprime posF/base/corr cada 100 ms por serial

// --- PARAMETROS DE CONTROL ---
const int VEL_MAX = 200;    // velocidad centrado (turbo de recta)
const int VEL_MIN = 80;     // velocidad en correccion fuerte
const float KP = 7.0;       // PWM por mm de error
const float KD = 10.0;      // amortiguacion (delta de posF por ciclo)
const float KS = 5.0;       // cuanto baja la velocidad con el error
const float ALPHA = 0.55;   // filtro EMA de la posicion (0..1)
const float DB_MM = 6.0;    // zona muerta: dentro, corr = 0 y a fondo
// Freno de retorno: con el error convergiendo en banda media la
// correccion se amortigua; sin freno la virada cruzaba la cinta y
// el error picaba de lado a lado (corridas #14-#21, estabilizo #22).
const float FRENO_RETORNO = 0.4;
const int RUEDA_MIN = 40;   // piso de la rueda interna en el PD

// Trim de motores (1.0 = igual). Viraje mecanico ~15 grados a la
// derecha, insensible al balance de potencia: la derecha ~2 %
// arriba deja un resto chico (medido 2026-10-30).
const float TRIM_IZQ = 1.0;
const float TRIM_DER = 1.02;

// Compuerta de arranque (umbrales sobre negrura 0..1)
const float N_ON = 0.6;    // S2 tiene que ver negro firme
const float N_OFF = 0.4;   // S0 y S4 tienen que ver blanco

// Lectura de linea
const float UMBRAL_LINEA = 0.3;  // suma de negruras para "linea a la vista"
const int PERDIDA_MIN_CICLOS = 3; // ciclos sin linea antes de buscar

// Interseccion: avance recto que sale cuando la punta S2
// reencuentra la linea (va adelantada, es la primera en ver la
// salida) o al vencer el techo. ~264 mm/s medido en el piso.
const int VEL_CRUCE = 140;
const unsigned long CRUCE_MIN_MS = 60;   // tramo ciego minimo
const unsigned long CRUCE_MAX_MS = 500;  // ~130 mm: techo del avance

// Curva cerrada comprometida: solo se dispara cuando el PD quedo
// sin senal — la linea se fue del arreglo (extremo solo) o el
// todo-negro llego con historial corrido (cuadrado de esquina).
const int VEL_CURVA_EXT = 150;    // rueda externa
const int VEL_CURVA_INT = 0;      // rueda interna quieta (aca si frena)
const unsigned long CURVA_MIN_MS = 60;   // giro comprometido minimo
const unsigned long CURVA_MAX_MS = 700;  // techo antes de pasar a buscar
// Pasado este plazo sin confirmacion, la rueda interna pasa a
// reversa: pivote sobre el eje. Con la interna a cero el arco
// desplazaba el arreglo fuera de la esquina (corrida #10).
const unsigned long CURVA_PIVOTE_MS = 250;
const int VEL_PIVOTE_INT = -70;   // -110 devolvia al robot (corrida #22)
const float NEG_EXT = 0.45;       // negrura para "el extremo ve la linea"
const float SUMA_OTROS = 0.6;     // techo de los demas canales
const int EXTREMO_CICLOS = 2;     // persistencia para disparar la curva
const float NEG_INTERNA = 0.6;    // trio interno que confirma la vuelta
// Veto con la punta sobre cinta: un brazo de la X asoma por un
// extremo mientras S2 sigue sobre la linea propia — ahi la linea
// no se esta yendo, esta cruzando otra (corrida #11).
const float NEG_CENTRO_VETO = 0.4;

// Guardia unica de rearmado: tras salir de curva, cruce o pausa
// de busqueda, ningun giro comprometido se dispara hasta que el
// PD pruebe la linea un tramo. Reemplaza al lockout entre curvas
// y a la guardia post-recuperacion de v3 (corridas #9, #13, #15).
const unsigned long GUARDIA_MS = 400;

// Discriminacion cruce/esquina sobre el historial
const float POS_ESQ_MM = 8.0;     // |posF| historica que delata esquina
const int HIST_CRUCE = 12;        // cuantas muestras atras mirar

// Busqueda de linea perdida: pivote acotado primero — gira sobre
// el eje sin desplazarse. Los arcos van despues, cortos.
const int VEL_ARCO_EXT = 110;
const int VEL_ARCO_INT = 25;
const int VEL_BUSQUEDA = 110;
const unsigned long PIVOTE_MS = 280;  // ~90 grados a VEL_BUSQUEDA: medir
const unsigned long ARCO_MS = 400;    // arco hacia el lado de la perdida
const unsigned long PIVOTE2_MS = 560; // pivote de vuelta (~-90 grados)
const unsigned long ARCO2_MS = 500;   // arco al lado contrario

// Si la linea asoma un instante en plena busqueda, el PD la agarra
// y el barrido queda en pausa: al perderla otra vez retoma donde
// iba, no vuelve a la fase 0 (corrida #5: 117 reentradas en 10 s).
const unsigned long PAUSA_MAX_MS = 600;

// Asiento tras recuperar la linea: velocidad capada un tramo
const unsigned long ASIENTO_MS = 250;
const int VEL_ASIENTO = 120;

// Antirrebote del pulsador
const unsigned long BTN_DEBOUNCE_MS = 50;

// Calibracion inicial de laboratorio (por canal; medir y rellenar).
// En cinta negra sobre papel blanco: blanco ~26-30, negro ~850-960.
int calMin[5] = {30, 30, 30, 30, 30};
int calMax[5] = {930, 930, 930, 930, 930};

// Posicion lateral de cada canal en mm (medida sobre el chasis):
// S1/S3 a +-15 mm; S0/S4 a +-30 mm.
const float X_MM[5] = {-30.0, -15.0, 0.0, 15.0, 30.0};
const int CANALES[5] = {S0, S1, S2, S3, S4};

// Historial de posiciones validas: anillo, [0] = la mas reciente.
// Solo se escribe con linea a la vista; en cruces y perdidas se
// congela y guarda como venia la pista antes del evento.
#define HIST_N 16
float hist[HIST_N];
int histLen = 0;

// --- MEMORIA PERSISTENTE (EEPROM, sobrevive al apagado) ---
// Mismo formato que v3: cabecera con resumen y calibracion +
// anillo de eventos. La traza se arma en RAM (EEPROM.write tarda
// ~3 ms por byte, no se escribe en carrera) y se vuelca al detener.
#define TRAZA_N 64
struct Traza {
  unsigned int dt;        // (millis - largada) / 10, da hasta ~10 min
  byte tipo;
  signed char dato;       // lado o subtipo, segun el evento
  signed char posFmm;     // posF en mm en ese instante
  signed char velI;       // comando rueda izq / 2
  signed char velD;       // comando rueda der / 2
  byte lect[5];           // ADC / 4 (reconstruir x4)
};
const byte T_MUESTRA = 0, T_CURVA = 1, T_CURVA_OUT = 2, T_CRUCE = 3,
           T_BUSQ = 4, T_BUSQ_RES = 5, T_PAUSA = 6, T_LARGADA = 7,
           T_STOP = 8;
Traza traza[TRAZA_N];
byte trazaIdx = 0;        // proxima escritura = la mas vieja si esta lleno
byte trazaLen = 0;
unsigned long muestraProx = 0;
const unsigned long MUESTRA_MS = 100;
int velIcmd = 0, velDcmd = 0;   // ultimo comando enviado a cada rueda

// Cabecera EEPROM en offset 0; los eventos van justo despues.
struct TrazaHead {
  byte magic;                   // TRAZA_MAGIC si hay datos validos
  unsigned long tiempo;         // ms largada -> parada
  byte perdidas, esquinas, cruces;
  int calMin[5];
  int calMax[5];
  byte n;                       // eventos validos en el anillo
  byte start;                   // indice del evento mas viejo
};
const byte TRAZA_MAGIC = 0xC1;

unsigned long largadaDesde = 0;
byte perdRun = 0, esqRun = 0, cruceRun = 0;

int lecturas[5];
float posF = 0;
float posPrev = 0;
int ultimoLado = 0;                 // -1 izquierda, +1 derecha
int perdidaConteo = 0;
int extremoConteo = 0;
int extremoLado = 0;
bool arrancado = false;
bool btnPrev = HIGH;
bool preparado = false;             // pulsador apretado: armado para largar al soltar
unsigned long btnUltimo = 0;
unsigned long cruceDesde = 0;
unsigned long cruceHasta = 0;
unsigned long curvaDesde = 0;
int curvaLado = 0;
unsigned long rearmadoHasta = 0;    // guardia unica post-maniobra
unsigned long asientoHasta = 0;

// Maquina de la busqueda: fase 0..3 y lado recordado
int faseBusqueda = -1;              // -1 = no esta buscando
int ladoBusqueda = 0;
unsigned long faseDesde = 0;
int pausaFase = -1;                 // fase pausada por un asomo (-1 = sin pausa)
int pausaLado = 0;
unsigned long pausaEnFase = 0;
unsigned long pausaDesde = 0;
bool enLinea = false;               // histeresis: el PD la suelta solo si se apaga del todo

// --- MOTORES (velocidad con signo: + adelante, - atras) ---
void motorIzq(int vel) {
  velIcmd = vel;
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
  velDcmd = vel;
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
void leerSensores() {
  for (int i = 0; i < 5; i++) {
    int v = analogRead(CANALES[i]);
    lecturas[i] = v;
    if (v < calMin[i]) calMin[i] = v;
    if (v > calMax[i]) calMax[i] = v;
  }
}

float negrura(int i) {
  float n = (float)(lecturas[i] - calMin[i]) / (float)(calMax[i] - calMin[i]);
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}

// Al apoyarlo sobre la linea, la posicion de salida siembra la
// pista real: canal sobre negro -> su calMax, sobre blanco -> calMin
void sembrarPista() {
  for (int i = 0; i < 5; i++) {
    int medio = (calMin[i] + calMax[i]) / 2;
    if (lecturas[i] > medio) calMax[i] = lecturas[i];
    else calMin[i] = lecturas[i];
    Serial.print("S"); Serial.print(i);
    Serial.print(": "); Serial.print(calMin[i]);
    Serial.print("-"); Serial.println(calMax[i]);
  }
}

// --- HISTORIAL DE POSICIONES ---
void histPush(float p) {
  for (int i = HIST_N - 1; i > 0; i--) hist[i] = hist[i - 1];
  hist[0] = p;
  if (histLen < HIST_N) histLen++;
}

// k = 0 es la muestra mas reciente; si no hay tantas, da la mas vieja
float histGet(int k) {
  if (histLen == 0) return 0;
  if (k >= histLen) k = histLen - 1;
  return hist[k];
}

// --- TRAZA: registrar un evento en el anillo ---
void trazaEvento(byte tipo, signed char dato) {
  Traza &t = traza[trazaIdx];
  t.dt = (unsigned int)((millis() - largadaDesde) / 10);
  t.tipo = tipo;
  t.dato = dato;
  t.posFmm = (signed char)constrain((int)posF, -127, 127);
  t.velI = (signed char)(velIcmd / 2);
  t.velD = (signed char)(velDcmd / 2);
  for (int i = 0; i < 5; i++) t.lect[i] = lecturas[i] / 4;
  trazaIdx = (trazaIdx + 1) % TRAZA_N;
  if (trazaLen < TRAZA_N) trazaLen++;
}

// Imprime la traza persistida: una linea por evento, del mas viejo
// al mas nuevo.
void imprimirTraza() {
  TrazaHead th;
  EEPROM.get(0, th);
  if (th.magic != TRAZA_MAGIC || th.n > TRAZA_N) {
    Serial.println("Sin traza guardada.");
    return;
  }
  Serial.print("Ultima corrida: "); Serial.print(th.tiempo / 1000.0);
  Serial.print(" s | perdidas "); Serial.print(th.perdidas);
  Serial.print(" esquinas "); Serial.print(th.esquinas);
  Serial.print(" cruces "); Serial.println(th.cruces);
  Serial.println("Traza (t | evento | posF | velI velD | s0..s4):");
  for (int i = 0; i < th.n; i++) {
    Traza t;
    EEPROM.get(sizeof(TrazaHead) +
               ((th.start + i) % TRAZA_N) * sizeof(Traza), t);
    Serial.print("  +"); Serial.print(t.dt / 100.0, 2);
    Serial.print(' ');
    switch (t.tipo) {
      case T_CURVA:
        Serial.print(t.dato < 0 ? "curva-izq/" : "curva-der/");
        Serial.print(abs(t.dato) == 1 ? "ext" :
                     abs(t.dato) == 2 ? "posf" : "negro");
        break;
      case T_CURVA_OUT:
        Serial.print(t.dato == 0 ? "curva-ok" :
                     t.dato == 1 ? "curva-timeout" : "curva-barrida");
        break;
      case T_CRUCE:    Serial.print("cruce"); break;
      case T_BUSQ:     Serial.print(t.dato < 0 ? "busq-izq" : "busq-der"); break;
      case T_BUSQ_RES: Serial.print(t.dato < 0 ? "busq*-izq" : "busq*-der"); break;
      case T_PAUSA:    Serial.print("pausa"); break;
      case T_LARGADA:  Serial.print("largada"); break;
      case T_STOP:     Serial.print("stop"); break;
      default:         Serial.print("mue"); break;
    }
    Serial.print(" | p"); Serial.print(t.posFmm);
    Serial.print(" | v"); Serial.print(t.velI * 2);
    Serial.print(' '); Serial.print(t.velD * 2);
    Serial.print(" |");
    for (int k = 0; k < 5; k++) {
      Serial.print(' '); Serial.print(t.lect[k] * 4);
    }
    Serial.println();
  }
}

// --- MANEJADORES DE MANIOBRA COMPROMETIDA ---
void entrarCruce() {
  cruceRun++;
  trazaEvento(T_CRUCE, 0);
  cruceDesde = millis();
  cruceHasta = millis() + CRUCE_MAX_MS;
  posF = posPrev = 0;
  perdidaConteo = 0;
  extremoConteo = 0;
  faseBusqueda = -1;
  pausaFase = -1;
  enLinea = false;
  motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
}

// lado: -1 izquierda, +1 derecha. via: 1 extremo-solo, 3
// todo-negro con historial corrido (la via 2 por centroide de v3
// se quito: con la linea bajo el arreglo, corregir es trabajo del
// PD, no de un giro a ciegas). La guardia de rearmado impide un
// nuevo compromiso hasta que el PD pruebe la linea un tramo.
void entrarCurva(int lado, int via) {
  if (millis() < rearmadoHasta) return;
  esqRun++;
  trazaEvento(T_CURVA, lado * via);
  curvaDesde = millis();
  curvaLado = lado;
  perdidaConteo = 0;
  extremoConteo = 0;
  faseBusqueda = -1;
  pausaFase = -1; // la curva cambia el marco: la pausa ya no aplica
  enLinea = false;
}

// --- BUSQUEDA: arranque, pausa y fases ---
// Al salir de la busqueda (el PD tomo la linea) se guarda la fase,
// el lado y cuanto llevaba: si la perdida vuelve enseguida el
// barrido retoma donde iba.
void pausarBusqueda() {
  if (faseBusqueda >= 0) {
    trazaEvento(T_PAUSA, 0);
    pausaFase = faseBusqueda;
    pausaLado = ladoBusqueda;
    pausaEnFase = millis() - faseDesde;
    pausaDesde = millis();
    asientoHasta = millis() + ASIENTO_MS;
    rearmadoHasta = millis() + GUARDIA_MS;
  }
  faseBusqueda = -1;
}

void arrancarBusqueda() {
  perdRun++;
  // Pausa reciente: mismo episodio, retomar la fase sin reiniciar
  // el pivote. Pausa vieja o inexistente: episodio nuevo desde cero.
  if (pausaFase >= 0 && millis() - pausaDesde <= PAUSA_MAX_MS) {
    // El lado de la pausa puede venir de una decision vieja: si los
    // asomos recientes marcaron otro lado, el dato fresco gana.
    ladoBusqueda = (ultimoLado != 0) ? ultimoLado : pausaLado;
    faseBusqueda = pausaFase;
    faseDesde = millis() - pausaEnFase;
    trazaEvento(T_BUSQ_RES, ladoBusqueda);
    return;
  }
  pausaFase = -1;
  // Direccion: promedio de las ultimas posiciones validas; si no
  // alcanza, el ultimo lado grande; si no, la derecha.
  float p = (histGet(0) + histGet(1) + histGet(2)) / 3.0;
  if (p > 6.0) ladoBusqueda = 1;
  else if (p < -6.0) ladoBusqueda = -1;
  else ladoBusqueda = (ultimoLado != 0) ? ultimoLado : 1;
  faseBusqueda = 0;
  faseDesde = millis();
  trazaEvento(T_BUSQ, ladoBusqueda);
}

// Arco hacia adelante: las dos ruedas avanzan, diferencial fuerte
void arco(int lado) {
  if (lado > 0) { motorIzq(VEL_ARCO_EXT); motorDer(VEL_ARCO_INT); }
  else          { motorIzq(VEL_ARCO_INT); motorDer(VEL_ARCO_EXT); }
}

// Pivote en el sitio: solo dentro de la busqueda y acotado en tiempo
void pivote(int lado) {
  motorIzq(lado * VEL_BUSQUEDA);
  motorDer(-lado * VEL_BUSQUEDA);
}

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  detener();

  pinMode(SLEEP_DRV, OUTPUT);
  digitalWrite(SLEEP_DRV, HIGH);
  pinMode(FAULT_PIN, INPUT_PULLUP);
  pinMode(BTN, INPUT_PULLUP); // presionado = LOW

  Serial.begin(9600);
  Serial.println("===== ARTURITO v2.5 =====");
  Serial.println("Esperando: apoyar sobre la linea, apretar y soltar.");

  // Recargar la traza persistida: si es valida, la calibracion de
  // la ultima pista arranca sembrada y el detalle sale por serie.
  TrazaHead th;
  EEPROM.get(0, th);
  if (th.magic == TRAZA_MAGIC) {
    for (int i = 0; i < 5; i++) {
      calMin[i] = th.calMin[i];
      calMax[i] = th.calMax[i];
    }
    imprimirTraza();
  } else {
    Serial.println("Sin traza guardada.");
  }
}

void loop() {
  leerSensores();

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
  //    el apoyo es bueno en ese instante (S2 sobre la linea,
  //    extremos libres). El dedo ya esta fuera al soltar, asi que
  //    no hay espera extra.
  if (!arrancado) {
    if (flancoBajo) preparado = true;
    if (flancoAlto && preparado) {
      preparado = false;
      // Compuerta: negrura normal o lectura cruda de respaldo, por si
      // la calibracion persistida de otra pista comprime la escala.
      if ((negrura(2) > N_ON || lecturas[2] > 650) &&
          (negrura(0) < N_OFF || lecturas[0] < 350) &&
          (negrura(4) < N_OFF || lecturas[4] < 350)) {
        sembrarPista();
        arrancado = true;
        largadaDesde = millis();
        muestraProx = millis() + MUESTRA_MS;
        trazaEvento(T_LARGADA, 0);
        perdRun = esqRun = cruceRun = 0;
        posF = posPrev = 0;
        ultimoLado = 0; // no heredar el lado de la corrida anterior
        histLen = 0;
        perdidaConteo = 0;
        extremoConteo = 0;
        extremoLado = 0;
        cruceHasta = 0;
        curvaDesde = 0;
        rearmadoHasta = 0;
        faseBusqueda = -1;
        pausaFase = -1;
        enLinea = false;
        asientoHasta = 0;
        trazaIdx = trazaLen = 0;
        Serial.println("LARGADA: arrancando.");
      }
    }
    if (!arrancado) {
      detener();
      delay(5);
      return;
    }
  }
  // 3. En carrera: apretar detiene, vuelca la corrida a EEPROM y
  //    devuelve a la espera.
  else if (flancoBajo) {
    arrancado = false;
    detener();
    trazaEvento(T_STOP, 0);
    TrazaHead th;
    th.magic = TRAZA_MAGIC;
    th.tiempo = millis() - largadaDesde;
    th.perdidas = perdRun;
    th.esquinas = esqRun;
    th.cruces = cruceRun;
    for (int i = 0; i < 5; i++) {
      th.calMin[i] = calMin[i];
      th.calMax[i] = calMax[i];
    }
    th.n = trazaLen;
    th.start = (trazaIdx + TRAZA_N - trazaLen) % TRAZA_N;
    EEPROM.put(0, th);
    EEPROM.put(sizeof(TrazaHead), traza);
    Serial.print("DETENIDO: ");
    Serial.print(th.tiempo / 1000.0);
    Serial.println(" s guardados. Esperando nueva largada.");
    delay(5);
    return;
  }

  // Traza: muestra periodica con los 5 canales en crudo, posF y
  // comandos — cubre tambien los tramos de maniobra comprometida.
  if (millis() >= muestraProx) {
    muestraProx = millis() + MUESTRA_MS;
    trazaEvento(T_MUESTRA, 0);
  }

  // 4. Cruce comprometido: recto hasta que la punta reencuentra el
  //    patron de linea o vence el techo.
  if (cruceHasta) {
    bool saturado = negrura(0) > 0.7 && negrura(1) > 0.7 &&
                    negrura(2) > 0.7 && negrura(3) > 0.7 &&
                    negrura(4) > 0.7;
    bool reaparecio = millis() - cruceDesde >= CRUCE_MIN_MS &&
                      negrura(2) > N_ON && !saturado;
    if (millis() < cruceHasta && !reaparecio) {
      motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
      delay(5);
      return;
    }
    cruceHasta = 0;
    rearmadoHasta = millis() + GUARDIA_MS;
  }

  // 5. Curva comprometida: gira hasta que la linea vuelve al trio
  //    interno, la masa cruza al lado contrario o vence el techo.
  //    Todo-negro aca no es cruce: es el cuadrado de la esquina.
  if (curvaDesde) {
    unsigned long enCurva = millis() - curvaDesde;
    float interna = negrura(1) + negrura(2) + negrura(3);
    float lider = (curvaLado > 0) ? negrura(3) + negrura(4)
                                : negrura(0) + negrura(1);
    float cola  = (curvaLado > 0) ? negrura(0) + negrura(1)
                                : negrura(3) + negrura(4);
    bool volvio = interna > NEG_INTERNA && negrura(2) > 0.4;
    bool barrida = cola > lider && cola > UMBRAL_LINEA;
    if (enCurva >= CURVA_MIN_MS && (volvio || barrida)) {
      curvaDesde = 0;
      asientoHasta = millis() + ASIENTO_MS;
      rearmadoHasta = millis() + GUARDIA_MS;
      trazaEvento(T_CURVA_OUT, (barrida && !volvio) ? 2 : 0);
    } else if (enCurva >= CURVA_MAX_MS) {
      curvaDesde = 0;
      trazaEvento(T_CURVA_OUT, 1);
      arrancarBusqueda();
    } else {
      int ruedaInt = (enCurva > CURVA_PIVOTE_MS)
                     ? VEL_PIVOTE_INT : VEL_CURVA_INT;
      if (curvaLado > 0) { motorIzq(VEL_CURVA_EXT); motorDer(ruedaInt); }
      else               { motorIzq(ruedaInt); motorDer(VEL_CURVA_EXT); }
      delay(5);
      return;
    }
  }

  // 6. Lectura ponderada en mm
  float suma = 0, sumaP = 0;
  bool todoNegro = true;
  float n[5];
  for (int i = 0; i < 5; i++) {
    n[i] = negrura(i);
    suma += n[i];
    sumaP += X_MM[i] * n[i];
    if (n[i] < 0.7) todoNegro = false;
  }

  // 7. Todo negro: cruce o esquina. El historial decide: si antes
  //    del negro la linea venia corrida, era una esquina y hay que
  //    girar; si venia centrada, es un cruce y se atraviesa recto.
  if (todoNegro) {
    float posRef = histGet(HIST_CRUCE);
    if (posRef > POS_ESQ_MM) entrarCurva(1, 3);
    else if (posRef < -POS_ESQ_MM) entrarCurva(-1, 3);
    else entrarCruce();
    delay(5);
    return;
  }

  // 8. Solo un extremo ve la linea: la cinta se salio del arreglo
  //    y el PD ya no tiene que medir — ahi si se compromete el
  //    giro. Persistencia de unos ciclos, punta libre de cinta
  //    (veto del brazo de la X) y guardia de rearmado.
  bool extIzq = (n[0] > NEG_EXT) && (n[2] < NEG_CENTRO_VETO) &&
                (suma - n[0] < SUMA_OTROS) && millis() >= rearmadoHasta;
  bool extDer = (n[4] > NEG_EXT) && (n[2] < NEG_CENTRO_VETO) &&
                (suma - n[4] < SUMA_OTROS) && millis() >= rearmadoHasta;
  int ladoExt = extIzq ? -1 : (extDer ? 1 : 0);
  if (ladoExt != 0 && ladoExt == extremoLado) {
    if (++extremoConteo >= EXTREMO_CICLOS) {
      entrarCurva(ladoExt, 1);
      delay(5);
      return;
    }
  } else {
    extremoConteo = 0;
    extremoLado = ladoExt;
  }

  // 9. Linea a la vista: PD con zona muerta y rueda interna en
  //    piso. Histeresis: entra pidiendo UMBRAL_LINEA pero no la
  //    suelta hasta que la senal se apaga del todo.
  bool estabaEnLinea = enLinea;
  enLinea = (suma > UMBRAL_LINEA) || (enLinea && suma > UMBRAL_LINEA / 2.0);
  if (enLinea) {
    float pos = sumaP / suma;            // mm, -30 (izq) .. +30 (der)
    // Al reenganchar la lectura actual es la mejor estima: el EMA
    // arrastraba el valor viejo y corregia al lado equivocado; y
    // deriv sobre un salto de tiempo metia picos (corridas #15, #20).
    posF = estabaEnLinea ? posF + ALPHA * (pos - posF) : pos;
    float deriv = estabaEnLinea ? (posF - posPrev) : 0;
    posPrev = posF;
    histPush(posF);

    if (posF > 6.0) ultimoLado = 1;
    else if (posF < -6.0) ultimoLado = -1;
    perdidaConteo = 0;
    pausarBusqueda();

    // Zona muerta como interruptor: dentro de +-DB_MM no hay senal
    // real y se va a fondo; afuera la correccion es completa.
    int base = (int)(VEL_MAX - KS * fabs(posF));
    if (base < VEL_MIN) base = VEL_MIN;
    if (millis() < asientoHasta && base > VEL_ASIENTO) base = VEL_ASIENTO;

    float corr = (fabs(posF) < DB_MM) ? 0 : KP * posF + KD * deriv;
    // Convergiendo en banda media se frena el retorno: el resto del
    // arco cierra sola sin cruzar la cinta.
    if (deriv * posF < 0 && fabs(posF) <= 15.0) corr *= FRENO_RETORNO;

    int velIzq = (int)((base + corr) * TRIM_IZQ);
    int velDer = (int)((base - corr) * TRIM_DER);
    // Piso de la rueda interna: 40 en correccion normal, 0 en error
    // grande — el freno completo queda para el caso extremo.
    int piso = (fabs(posF) > 15.0) ? 0 : RUEDA_MIN;
    if (velIzq < piso) velIzq = piso;
    if (velDer < piso) velDer = piso;
    if (velIzq > 255) velIzq = 255;
    if (velDer > 255) velDer = 255;
    motorIzq(velIzq);
    motorDer(velDer);

#if DEBUG
    static unsigned long dbgT = 0;
    if (millis() - dbgT > 100) {
      dbgT = millis();
      Serial.print("pos "); Serial.print(posF);
      Serial.print(" base "); Serial.print(base);
      Serial.print(" corr "); Serial.println(corr);
    }
#endif
    delay(5);
    return;
  }

  // 10. Linea perdida: debounce corto y luego busqueda por fases.
  //     Reaparece -> asiento; no reaparece -> pivote acotado,
  //     arco, pivote contrario, arco contrario, y se repite.
  if (++perdidaConteo < PERDIDA_MIN_CICLOS) {
    delay(5);
    return;
  }
  if (faseBusqueda < 0) arrancarBusqueda();

  unsigned long enFase = millis() - faseDesde;
  switch (faseBusqueda) {
    case 0: // pivote acotado hacia el lado de la perdida (sin avanzar)
      if (enFase < PIVOTE_MS) pivote(ladoBusqueda);
      else { faseBusqueda = 1; faseDesde = millis(); }
      break;
    case 1: // arco hacia ese lado
      if (enFase < ARCO_MS) arco(ladoBusqueda);
      else { faseBusqueda = 2; faseDesde = millis(); }
      break;
    case 2: // pivote acotado de vuelta hacia el otro lado
      if (enFase < PIVOTE2_MS) pivote(-ladoBusqueda);
      else { faseBusqueda = 3; faseDesde = millis(); }
      break;
    default: // arco al otro lado, y se repite el ciclo
      if (enFase < ARCO2_MS) arco(-ladoBusqueda);
      else { faseBusqueda = 0; faseDesde = millis(); }
      break;
  }
  delay(5);
}
