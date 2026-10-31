/*
 * ==========================================================
 * ROBOT: ARTURITO v2.6 - v2.5 + marcha del vecino en el disparo ext
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
 * - Sin calibracion: "hay linea" se decide por margen en ADC
 *   sobre el blanco visto (estable entre superficies); el negro
 *   varia demasiado para calibrarlo (corridas #23-#24).
 * - Traza EEPROM: anillo de eventos con canales crudos, posF y
 *   comandos, mas muestra periodica; se lee por serie con 't'.
 *   Se vuelca al detener o si la busqueda supera 3 s seguidos.
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
const float LADO_MM = 6.0;  // |posF| que fija lado recordado y lado de busqueda
const float BANDA_MM = 15.0; // banda media: freno de retorno y piso de rueda
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

// Compuerta de arranque: la pose de salida la garantiza el
// usuario — S2 sobre la linea, S0 y S4 sobre blanco. El margen
// solo pide contraste minimo; la escala de la corrida se deduce
// de esa pose (S2 = negro de referencia, S0/S4 = blanco).
const int MARGEN_LARGADA = 120;   // ADC: S2 supera a S0 y S4 por esto

// Umbrales de la corrida, deducidos de la pose de largada: la
// linea varia mucho entre superficies (150 a 960) pero el rango
// medido en el punto de inicio es la escala real de esta pista.
// "hay linea" = un tercio del rango sobre el blanco; saturacion =
// dos tercios; la histeresis aguanta hasta un sexto. Nada de
// margenes fijos ni calibracion heredada (corridas #23 y #24).
int blancoRef = 0;      // blanco de la pose (min de S0/S4)
int negroRef = 0;       // negro de la pose (lectura de S2)
int umbralLinea = 0;    // blancoRef + rango/3
int umbralFuerte = 0;   // blancoRef + rango*2/3
int umbralDebil = 0;    // blancoRef + max(rango/6, 30): piso contra ruido
                        // en superficies de poco contraste
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
const int EXTREMO_CICLOS = 2;     // persistencia para disparar la curva

// Marcha del vecino (propuesta ext-marcha). Una salida real de la cinta
// hacia un lado cruza antes el canal interno de ese lado (S1 o S3, a
// +-15 mm) que la punta (+-30 mm). Una masa ajena (cap de esquina,
// brazo paralelo) enciende la punta sola, sin historia en el vecino.
//   0 = desactivada (comportamiento v2.5)
//   1 = solo exige marcha para disparar ext (la propuesta tal cual)
//   2 = ademas la punta sin marcha deja de votar en el centroide, en la
//       histeresis y en el historial: sin esto el PD sigue girando a
//       fondo hacia la masa ajena (posF = +-30) y la busqueda arranca
//       hacia ese mismo lado, aunque ext este vetado.
// El enmascarado solo rige fuera de curva, cruce y busqueda: ahi la
// punta si es la primera en ver la cinta.
#define EXT_MARCHA 2
const unsigned long MARCHA_MS = 60;  // ~2 filas de sensores a VEL_MAX

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
const unsigned long PIVOTE2_MS = 560; // pivote de vuelta: el doble de la ida
const unsigned long ARCO2_MS = 400;   // arco al lado contrario, igual que ARCO_MS
// Desde la segunda vuelta del barrido la fase 0 tambien dura PIVOTE2_MS:
// con fase 0 de PIVOTE_MS el giro neto por vuelta era -theta - a2 y se
// acumulaba, y el robot terminaba mirando para atras.
// Busqueda que supera este plazo seguido = perdida real: parada de
// seguridad con volcado a EEPROM (la corrida no se pierde al cortar).
const unsigned long BUSQ_MAX_MS = 3000;

// Si la linea asoma un instante en plena busqueda, el PD la agarra
// y el barrido queda en pausa: al perderla otra vez retoma donde
// iba, no vuelve a la fase 0 (corrida #5: 117 reentradas en 10 s).
const unsigned long PAUSA_MAX_MS = 600;

// Asiento tras recuperar la linea: velocidad capada un tramo
const unsigned long ASIENTO_MS = 250;
const int VEL_ASIENTO = 120;

// Antirrebote del pulsador
const unsigned long BTN_DEBOUNCE_MS = 50;

// Referencias del piso de la pista, se actualizan solas con cada
// lectura. Solo alimentan la estadistica de la traza (refs[2..3]);
// la deteccion usa blancoRef/negroRef fijados en la pose de largada.
int negroVisto = 0;
int blancoVisto = 1023;

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
  byte e1, e3;            // edad de S1 y S3 sobre umbralDebil, en ciclos de 6 ms (tope 255)
};
const byte T_MUESTRA = 0, T_CURVA = 1, T_CURVA_OUT = 2, T_CRUCE = 3,
           T_BUSQ = 4, T_BUSQ_RES = 5, T_PAUSA = 6, T_LARGADA = 7,
           T_STOP = 8, T_EXT_VETO = 9;
Traza traza[TRAZA_N];
byte trazaIdx = 0;        // proxima escritura = la mas vieja si esta lleno
byte trazaLen = 0;
unsigned long muestraProx = 0;
const unsigned long MUESTRA_MS = 250; // muestra periodica de la traza
int velIcmd = 0, velDcmd = 0;   // ultimo comando enviado a cada rueda

// Cabecera EEPROM en offset 0; los eventos van justo despues.
// Mismo tamano que la version con calMin/calMax: refs[0..1] guarda
// la escala de la pose (blanco, negro) y refs[2..3] los extremos
// vistos en carrera; el resto libre.
struct TrazaHead {
  byte magic;                   // TRAZA_MAGIC si hay datos validos
  unsigned long tiempo;         // ms largada -> parada
  byte perdidas, esquinas, cruces;
  int refs[10];
  byte n;                       // eventos validos en el anillo
  byte start;                   // indice del evento mas viejo
};
const byte TRAZA_MAGIC = 0xC2;  // 0xC2: layout con e1/e3, invalida trazas v2.5

unsigned long largadaDesde = 0;
byte perdRun = 0, esqRun = 0, cruceRun = 0;

int lecturas[5];
unsigned long vistoPor[5];          // ultima vez que cada canal supero umbralDebil
bool vetoPrevIzq = false, vetoPrevDer = false; // para registrar el veto una vez por episodio
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
int ciclosBusq = 0;                 // vueltas del barrido (0 = primera)
unsigned long busqDesde = 0;        // arranque del episodio: parada de seguridad
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

// --- SENSORES Y REFERENCIAS DE PISTA ---
// No hay calibracion: cada lectura actualiza el piso del blanco y
// el techo del negro vistos. Toda la deteccion se hace con margen
// en ADC sobre el blanco, que es estable entre superficies.
void leerSensores() {
  for (int i = 0; i < 5; i++) {
    // doble lectura: descarta la carga residual del multiplexor ADC
    analogRead(CANALES[i]);
    int v = analogRead(CANALES[i]);
    lecturas[i] = v;
    if (v < blancoVisto) blancoVisto = v;
    if (v > negroVisto) negroVisto = v;
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
  unsigned long ahora = millis();
  unsigned long a1 = (ahora - vistoPor[1]) / 6, a3 = (ahora - vistoPor[3]) / 6;
  t.e1 = (byte)(a1 > 255 ? 255 : a1);
  t.e3 = (byte)(a3 > 255 ? 255 : a3);
  trazaIdx = (trazaIdx + 1) % TRAZA_N;
  if (trazaLen < TRAZA_N) trazaLen++;
}

// Imprime la traza persistida: una linea por evento, del mas viejo
// al mas nuevo.
void imprimirTraza() {
  TrazaHead th;
  EEPROM.get(0, th);
  if (th.magic != TRAZA_MAGIC || th.n > TRAZA_N) {
    Serial.println(F("Sin traza guardada."));
    return;
  }
  Serial.print(F("Ultima corrida: ")); Serial.print(th.tiempo / 1000.0);
  Serial.print(F(" s | perdidas ")); Serial.print(th.perdidas);
  Serial.print(F(" esquinas ")); Serial.print(th.esquinas);
  Serial.print(F(" cruces ")); Serial.print(th.cruces);
  Serial.print(F(" | pista ")); Serial.print(th.refs[0]);
  Serial.print(F("-")); Serial.print(th.refs[1]);
  Serial.print(F(" (vistos ")); Serial.print(th.refs[2]);
  Serial.print(F("-")); Serial.print(th.refs[3]);
  Serial.println(F(")"));
  Serial.println(F("Traza (t | evento | posF | velI velD | s0..s4 | edad S1 S3 en ciclos):"));
  for (int i = 0; i < th.n; i++) {
    Traza t;
    EEPROM.get(sizeof(TrazaHead) +
               ((th.start + i) % TRAZA_N) * sizeof(Traza), t);
    Serial.print(F("  +")); Serial.print(t.dt / 100.0, 2);
    Serial.print(' ');
    switch (t.tipo) {
      case T_CURVA:
        Serial.print(t.dato < 0 ? F("curva-izq/") : F("curva-der/"));
        Serial.print(abs(t.dato) == 1 ? F("ext") :
                     abs(t.dato) == 2 ? F("posf") : F("negro"));
        break;
      case T_CURVA_OUT:
        Serial.print(t.dato == 0 ? F("curva-ok") :
                     t.dato == 1 ? F("curva-timeout") : F("curva-barrida"));
        break;
      case T_CRUCE:    Serial.print(F("cruce")); break;
      case T_BUSQ:     Serial.print(t.dato < 0 ? F("busq-izq") : F("busq-der")); break;
      case T_BUSQ_RES: Serial.print(t.dato < 0 ? F("busq*-izq") : F("busq*-der")); break;
      case T_PAUSA:    Serial.print(F("pausa")); break;
      case T_LARGADA:  Serial.print(F("largada")); break;
      case T_STOP:     Serial.print(F("stop")); break;
      case T_EXT_VETO: Serial.print(t.dato < 0 ? F("ext-veto-izq") : F("ext-veto-der")); break;
      default:         Serial.print(F("mue")); break;
    }
    Serial.print(F(" | p")); Serial.print(t.posFmm);
    Serial.print(F(" | v")); Serial.print(t.velI * 2);
    Serial.print(' '); Serial.print(t.velD * 2);
    Serial.print(" |");
    for (int k = 0; k < 5; k++) {
      Serial.print(' '); Serial.print(t.lect[k] * 4);
    }
    Serial.print(F(" | e1 ")); Serial.print(t.e1);
    Serial.print(F(" e3 ")); Serial.print(t.e3);
    Serial.println();
  }
}

// --- MANEJADORES DE MANIOBRA COMPROMETIDA ---
void entrarCruce() {
  cruceRun++;
  trazaEvento(T_CRUCE, 0);
  cruceDesde = millis();
  cruceHasta = millis() + CRUCE_MAX_MS;
  histLen = 0;            // el historial de antes del cruce no decide el siguiente
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
  histLen = 0;            // idem: el historial que disparo la curva no se reusa
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

void arrancarBusqueda(int forzado) {  // forzado = 0: decide el historial
  perdRun++;
  busqDesde = millis(); // la pausa la vio la linea: el plazo seguido reinicia
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
  ciclosBusq = 0;
  // Direccion: promedio de las ultimas posiciones validas; si no
  // alcanza, el ultimo lado grande; si no, la derecha.
  float p = (histGet(0) + histGet(1) + histGet(2)) / 3.0;
  if (forzado != 0) ladoBusqueda = forzado;
  else if (p > LADO_MM) ladoBusqueda = 1;
  else if (p < -LADO_MM) ladoBusqueda = -1;
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

// Para la corrida y vuelca la traza a EEPROM. La llama el pulsador
// y la parada de seguridad de busqueda agotada.
void detenerYGuardar() {
  arrancado = false;
  detener();
  trazaEvento(T_STOP, 0);
  TrazaHead th;
  th.magic = TRAZA_MAGIC;
  th.tiempo = millis() - largadaDesde;
  th.perdidas = perdRun;
  th.esquinas = esqRun;
  th.cruces = cruceRun;
  for (int i = 0; i < 10; i++) th.refs[i] = 0;
  th.refs[0] = blancoRef;
  th.refs[1] = negroRef;
  th.refs[2] = blancoVisto;
  th.refs[3] = negroVisto;
  th.n = trazaLen;
  th.start = (trazaIdx + TRAZA_N - trazaLen) % TRAZA_N;
  EEPROM.put(0, th);
  EEPROM.put(sizeof(TrazaHead), traza);
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
  Serial.println(F("===== ARTURITO v2.6 ====="));
  Serial.println(F("Esperando: apoyar sobre la linea, apretar y soltar."));
  Serial.println(F("Enviar 't' para ver la traza de la ultima corrida."));

  // La traza queda en EEPROM pero NO se imprime aca: eran ~4 s de
  // salida serie antes del loop y un apretar-soltar en esa ventana
  // se perdia entero. Tampoco se hereda la calibracion: las pistas
  // de prueba no se repiten y una cal vieja desvia la negrura.
}

void loop() {
  // Periodo fijo de lazo: el trabajo ya hecho cuenta en el plazo,
  // asi KD actua sobre un dt constante en todas las ramas.
  static unsigned long tLazo = 0;
  while (millis() - tLazo < 6) {}
  tLazo = millis();

  leerSensores();

  // Comando por serie: 't' imprime la traza guardada. Solo en
  // espera — imprimir en carrera dejaria el robot ciego un rato.
  if (!arrancado && Serial.available() > 0 && Serial.read() == 't') {
    imprimirTraza();
  }

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
      // Compuerta relativa: S2 sobre la linea lee bastante mas
      // oscuro que ambos extremos. Vale en cualquier superficie.
      // Promedio de 8 lecturas: una sola muestra sesga la escala.
      int l0 = 0, l2 = 0, l4 = 0;
      for (int i = 0; i < 8; i++) {
        l0 += analogRead(S0); l2 += analogRead(S2); l4 += analogRead(S4);
      }
      l0 /= 8; l2 /= 8; l4 /= 8;
      if (l2 > l0 + MARGEN_LARGADA && l2 > l4 + MARGEN_LARGADA) {
        // La pose da la escala de la corrida: S2 es el negro de
        // referencia y el peor de los extremos el blanco.
        blancoRef = (l0 < l4) ? l0 : l4;
        negroRef = l2;
        int rango = negroRef - blancoRef;
        umbralLinea = blancoRef + rango / 3;
        umbralFuerte = blancoRef + rango * 2 / 3;
        umbralDebil = blancoRef + max(rango / 6, 30);
        blancoVisto = blancoRef;
        negroVisto = negroRef;
        Serial.print(F("Pista: blanco ")); Serial.print(blancoRef);
        Serial.print(F(" negro ")); Serial.print(negroRef);
        Serial.print(F(" umbral ")); Serial.println(umbralLinea);
        arrancado = true;
        largadaDesde = millis();
        for (int i = 0; i < 5; i++) vistoPor[i] = largadaDesde - (MARCHA_MS + 1000UL);
        vetoPrevIzq = vetoPrevDer = false;
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
        Serial.println(F("LARGADA: arrancando."));
      } else {
        Serial.println(F("NO LARGA: S2 no destaca sobre los extremos."));
      }
    }
    if (!arrancado) {
      detener();
      return;
    }
  }
  // 3. En carrera: apretar detiene, vuelca la corrida a EEPROM y
  //    devuelve a la espera.
  else if (flancoBajo) {
    unsigned long tCarrera = millis() - largadaDesde;
    detenerYGuardar();
    Serial.print(F("DETENIDO: "));
    Serial.print(tCarrera / 1000.0);
    Serial.println(F(" s guardados. Esperando nueva largada."));
    return;
  }

  // --- DETECCION: exceso crudo sobre el blanco de la pose ---
  // exc = cuanto pisa de oscuro cada canal (el blanco da ~0). El
  // centroide ponderado sobre exc es insensible a la escala — la
  // ponderacion la cancela — y "hay linea" se decide contra los
  // umbrales deducidos del rango medido en la largada.
  // Marcha: ultima vez que cada canal paso umbralDebil. Se actualiza
  // ANTES de cualquier return de maniobra (cruce, curva) para que la
  // historia no quede congelada.
  unsigned long ahora = millis();
  for (int i = 0; i < 5; i++)
    if (lecturas[i] > umbralDebil) vistoPor[i] = ahora;
  bool marchaIzq = (ahora - vistoPor[1]) <= MARCHA_MS;
  bool marchaDer = (ahora - vistoPor[3]) <= MARCHA_MS;

  // lect[] = lo que ve la logica; lecturas[] queda crudo para la traza.
  int lect[5];
  for (int i = 0; i < 5; i++) lect[i] = lecturas[i];
#if EXT_MARCHA >= 2
  bool vetoIzq = false, vetoDer = false;
  if (!curvaDesde && !cruceHasta && faseBusqueda < 0 &&
      lecturas[1] <= umbralLinea && lecturas[2] <= umbralLinea &&
      lecturas[3] <= umbralLinea) {
    // Trio vacio y punta encendida sin marcha reciente: masa ajena.
    if (lecturas[0] > umbralDebil && !marchaIzq) { lect[0] = blancoRef; vetoIzq = true; }
    if (lecturas[4] > umbralDebil && !marchaDer) { lect[4] = blancoRef; vetoDer = true; }
  }
  if (vetoIzq && !vetoPrevIzq) trazaEvento(T_EXT_VETO, -1);
  if (vetoDer && !vetoPrevDer) trazaEvento(T_EXT_VETO, 1);
  vetoPrevIzq = vetoIzq;
  vetoPrevDer = vetoDer;
#endif

  int exc[5];
  bool sobre[5];
  int nSobre = 0, nFuerte = 0, maxLect = 0;
  for (int i = 0; i < 5; i++) {
    int e = lect[i] - blancoRef;
    if (e < 0) e = 0;
    exc[i] = e;
    sobre[i] = lect[i] > umbralLinea;
    if (sobre[i]) nSobre++;
    if (lect[i] > umbralFuerte) nFuerte++;
    if (lect[i] > maxLect) maxLect = lect[i];
  }
  bool todoNegro = (nFuerte == 5);

  // Centroide: con la linea bajo el trio interno las puntas no
  // votan — un brazo de la X bajo S0/S4 arrastraba el posF y el PD
  // giraba hacia el brazo soltando la marcha recta (corrida #25).
  // Solo cuando el trio queda vacio cuentan las puntas.
  float suma = 0, sumaP = 0;
  bool trioEnLinea = sobre[1] || sobre[2] || sobre[3];
  int iIni = trioEnLinea ? 1 : 0, iFin = trioEnLinea ? 3 : 4;
  for (int i = iIni; i <= iFin; i++) {
    suma += exc[i];
    sumaP += X_MM[i] * exc[i];
  }

  // 4. Cruce comprometido: recto hasta que la punta reencuentra el
  //    patron de linea o vence el techo.
  if (cruceHasta) {
    bool reaparecio = millis() - cruceDesde >= CRUCE_MIN_MS &&
                      sobre[2] && !todoNegro;
    if (millis() < cruceHasta && !reaparecio) {
      motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
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
    int interna = sobre[1] + sobre[2] + sobre[3];
    int lider = (curvaLado > 0) ? exc[3] + exc[4] : exc[0] + exc[1];
    int cola  = (curvaLado > 0) ? exc[0] + exc[1] : exc[3] + exc[4];
    // Con todo-negro aun no "volvio" la linea: es el cuadrado de la
    // esquina. Sin esta guardia la curva salia a los 60 ms y el
    // ultimo comando quedaba sosteniendo el giro sin registro.
    bool volvio = sobre[2] && interna >= 2 && !todoNegro;
    bool barrida = cola > lider && cola > (umbralLinea - blancoRef);
    if (enCurva >= CURVA_MIN_MS && (volvio || barrida)) {
      curvaDesde = 0;
      asientoHasta = millis() + ASIENTO_MS;
      rearmadoHasta = millis() + GUARDIA_MS;
      trazaEvento(T_CURVA_OUT, (barrida && !volvio) ? 2 : 0);
    } else if (enCurva >= CURVA_MAX_MS) {
      curvaDesde = 0;
      trazaEvento(T_CURVA_OUT, 1);
      // La curva ya giro ~100 grados hacia curvaLado sin hallar la
      // cinta y entrarCurva borro el historial: sin lado forzado la
      // busqueda caia en ultimoLado (a menudo el mismo lado) y sumaba
      // otro pivote. Se deshace el giro: primero hacia el lado contrario.
      arrancarBusqueda(-curvaLado);
    } else {
      int ruedaInt = (enCurva > CURVA_PIVOTE_MS)
                     ? VEL_PIVOTE_INT : VEL_CURVA_INT;
      if (curvaLado > 0) { motorIzq(VEL_CURVA_EXT); motorDer(ruedaInt); }
      else               { motorIzq(ruedaInt); motorDer(VEL_CURVA_EXT); }
      return;
    }
  }

  // 6. Todo negro: cruce o esquina. El historial decide: si antes
  //    del negro la linea venia corrida, era una esquina y hay que
  //    girar; si venia centrada, es un cruce y se atraviesa recto.
  //    Si la guardia veta el compromiso, se sostiene el ultimo
  //    comando (el giro en curso) hasta que el cuadrado se despeje.
  if (todoNegro) {
    float posRef = histGet(HIST_CRUCE);
    if (posRef > POS_ESQ_MM) entrarCurva(1, 3);
    else if (posRef < -POS_ESQ_MM) entrarCurva(-1, 3);
    else entrarCruce();
    return;
  }

  // 7. Solo un extremo ve la linea: la cinta se salio del arreglo
  //    y el PD ya no tiene que medir — ahi si se compromete el
  //    giro. Persistencia de unos ciclos, punta libre de cinta
  //    (veto del brazo de la X) y guardia de rearmado.
  bool extIzq = sobre[0] && !sobre[1] && !sobre[2] &&
                !sobre[3] && !sobre[4] && millis() >= rearmadoHasta;
  bool extDer = sobre[4] && !sobre[3] && !sobre[2] &&
                !sobre[1] && !sobre[0] && millis() >= rearmadoHasta;
#if EXT_MARCHA >= 1
  extIzq = extIzq && marchaIzq;   // la cinta tuvo que viajar hacia ese lado
  extDer = extDer && marchaDer;
#endif
  int ladoExt = extIzq ? -1 : (extDer ? 1 : 0);
  if (ladoExt != 0) {
    if (ladoExt != extremoLado) { extremoLado = ladoExt; extremoConteo = 0; }
    if (++extremoConteo >= EXTREMO_CICLOS) {
      entrarCurva(ladoExt, 1);
      return;
    }
  } else {
    extremoConteo = 0;
    extremoLado = 0;
  }

  // Muestra periodica de la traza: canales, posF y comandos cada
  // MUESTRA_MS, con linea o sin ella (en maniobra no llega: los
  // eventos ya cuentan esa historia).
  if (millis() >= muestraProx) {
    muestraProx = millis() + MUESTRA_MS;
    trazaEvento(T_MUESTRA, 0);
  }

  // 8. Linea a la vista: PD con zona muerta y rueda interna en
  //    piso. Histeresis: entra con un canal sobre el umbral y no
  //    la suelta hasta que todo baja del piso debil.
  bool estabaEnLinea = enLinea;
  enLinea = (nSobre > 0) || (enLinea && maxLect > umbralDebil);
  if (enLinea) {
    float pos = (suma > 0) ? sumaP / suma : 0;  // mm, -30 .. +30
    // Al reenganchar la lectura actual es la mejor estima: el EMA
    // arrastraba el valor viejo y corregia al lado equivocado; y
    // deriv sobre un salto de tiempo metia picos (corridas #15, #20).
    posF = estabaEnLinea ? posF + ALPHA * (pos - posF) : pos;
    float deriv = estabaEnLinea ? (posF - posPrev) : 0;
    posPrev = posF;
    histPush(posF);

    if (posF > LADO_MM) ultimoLado = 1;
    else if (posF < -LADO_MM) ultimoLado = -1;
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
    if (deriv * posF < 0 && fabs(posF) <= BANDA_MM) corr *= FRENO_RETORNO;

    int velIzq = (int)((base + corr) * TRIM_IZQ);
    int velDer = (int)((base - corr) * TRIM_DER);
    // Piso de la rueda interna: 40 en correccion normal, 0 en error
    // grande — el freno completo queda para el caso extremo.
    int piso = (fabs(posF) > BANDA_MM) ? 0 : RUEDA_MIN;
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
    return;
  }

  // 9. Linea perdida: debounce corto y luego busqueda por fases.
  //     Reaparece -> asiento; no reaparece -> pivote acotado,
  //     arco, pivote contrario, arco contrario, y se repite.
  if (++perdidaConteo < PERDIDA_MIN_CICLOS) {
    return;
  }
  if (faseBusqueda < 0) arrancarBusqueda(0);

  // Parada de seguridad: buscar mas de BUSQ_MAX_MS seguidos es una
  // perdida real — detiene y guarda la traza antes de vagar.
  if (millis() - busqDesde > BUSQ_MAX_MS) {
    detenerYGuardar();
    Serial.println(F("DETENIDO: busqueda agotada, traza guardada."));
    return;
  }

  unsigned long enFase = millis() - faseDesde;
  switch (faseBusqueda) {
    case 0: // pivote acotado hacia el lado de la perdida (sin avanzar)
      // 1a vuelta: PIVOTE_MS; desde la 2a: PIVOTE2_MS, que cierra el
      // barrido — con PIVOTE_MS el giro neto se acumulaba por vuelta.
      if (enFase < (ciclosBusq == 0 ? PIVOTE_MS : PIVOTE2_MS)) pivote(ladoBusqueda);
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
      else { faseBusqueda = 0; faseDesde = millis(); ciclosBusq++; }
      break;
  }
}
