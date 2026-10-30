/*
 * ==========================================================
 * ROBOT: ARTURITO v3 - SEGUIDOR DE LINEA CON GEOMETRIA REAL
 * CONCURSO: 1er Concurso Distrital de Robotica 2026 (Santa Cruz)
 * ==========================================================
 * Largada igual que v2: apoyar sobre la linea, S2 sobre negro
 * con S0/S4 libres, pulsar D8. Un segundo click detiene y
 * devuelve a la espera.
 *
 * Cambios respecto a v2:
 *
 * - Posicion en milimetros reales: pesos {-30,-15,0,+15,+30}
 *   segun la geometria medida del arreglo en flecha.
 * - Zona muerta de +-DB_MM: dentro, correccion cero y VEL_MAX
 *   pleno (turbo de recta). Con la linea de 20 mm centrada solo
 *   S2 la ve (S1/S3 a +-15 mm quedan fuera) y S2 pesa 0: hasta
 *   ~5 mm de desvio no hay senal que corregir; corregirla igual
 *   era el bamboleo.
 * - Rueda interna siempre adelante en el PD (piso RUEDA_MIN):
 *   dobla con diferencial, sin frenar. La rueda a cero o en
 *   reversa queda para la curva comprometida y la busqueda.
 * - Memoria de las ultimas posiciones validas (anillo de 16):
 *   distingue cruce de esquina (a un cruce se llega centrado,
 *   a una esquina con la linea ya corrida) y da la direccion
 *   de arranque de la busqueda.
 * - Curva cerrada comprometida: si solo un extremo ve la linea,
 *   o si el todo-negro venia con historial corrido, gira a ese
 *   lado con la rueda interna quieta hasta que la linea vuelve
 *   al trio interno o vence el tiempo.
 * - Busqueda sin 180: arco hacia adelante hacia el lado de la
 *   perdida, pivote acotado a ~90 grados, arco al lado
 *   contrario y pivote acotado de vuelta. Ninguna maniobra
 *   junta mas de ~90 grados de rumbo, asi que el robot ya no
 *   puede terminar mirando para atras.
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
const float KP = 7.0;       // PWM por mm de error efectivo
const float KD = 10.0;      // amortiguacion (delta de posF por ciclo)
const float KS = 5.0;       // cuanto baja la velocidad con el error
const float ALPHA = 0.55;   // filtro EMA de la posicion (0..1)
const float DB_MM = 6.0;    // zona muerta: dentro, corr = 0 y a fondo
const int RUEDA_MIN = 40;   // piso de la rueda interna en el PD

// Trim de motores (1.0 = igual). Si tira a la derecha, bajar TRIM_IZQ
// o subir TRIM_DER. Se ajusta a mano tras la prueba de recta.
// Medida 2026-10-30: ruedas parejas a alta potencia — el derrape fue
// insensible al trim en dos tandas (deriva ~14° constante), viene de
// la pose o de algo mecanico. TRIM 1.0 hasta la corrida 255/255.
// Medida 2026-10-30: el viraje mecanico es ~15 grados a la derecha
// (insensible al balance PWM: convergencia o bola); subir la derecha
// ~7 % lo compensa en carrera. Afinar en pista.
const float TRIM_IZQ = 1.0;
const float TRIM_DER = 1.05;

// Compuerta de arranque (umbrales sobre negrura 0..1)
const float N_ON = 0.6;    // S2 tiene que ver negro firme
const float N_OFF = 0.4;   // S0 y S4 tienen que ver blanco

// Lectura de linea
const float UMBRAL_LINEA = 0.3;  // suma de negruras para "linea a la vista"
const int PERDIDA_MIN_CICLOS = 3; // ciclos sin linea antes de buscar

// Interseccion: avance recto comprometido al ver todo negro.
// El todo-negro se lee cuando la fila trasera (S0/S4) entra a
// la banda; la distancia ciega cubre esos 20 mm + margen. Se
// pasa a tiempo con la velocidad real medida en el piso.
const int VEL_CRUCE = 140;
const float AVANCE_CRUCE_MM = 30.0;
const float MM_S_A_CRUCE = 264.0; // medida 2026-10-29: ~79 cm de arco en 3 s

// Curva cerrada comprometida (esquina de 90 grados)
const int VEL_CURVA_EXT = 150;    // rueda externa
const int VEL_CURVA_INT = 0;      // rueda interna quieta (aca si frena)
const unsigned long CURVA_MIN_MS = 90;   // giro comprometido minimo
const unsigned long CURVA_MAX_MS = 500;  // techo antes de pasar a buscar
const float NEG_EXT = 0.45;       // negrura para "el extremo ve la linea"
const float SUMA_OTROS = 0.6;     // techo de los demas canales
const int EXTREMO_CICLOS = 2;     // persistencia para disparar la curva
const float NEG_INTERNA = 0.6;    // trio interno que confirma la vuelta

// Discriminacion cruce/esquina sobre el historial
const float POS_ESQ_MM = 8.0;     // |posF| historica que delata esquina
const int HIST_CRUCE = 12;        // cuantas muestras atras mirar

// Busqueda de linea perdida: pivote acotado primero — gira sobre el
// eje sin desplazarse, la rueda no sale de la pista buscando. Los
// arcos van despues, cortos y cerrados.
const int VEL_ARCO_EXT = 110;
const int VEL_ARCO_INT = 25;
const int VEL_BUSQUEDA = 110;
const unsigned long PIVOTE_MS = 280;  // ~90 grados a VEL_BUSQUEDA: medir
const unsigned long ARCO_MS = 400;    // arco hacia el lado de la perdida
const unsigned long PIVOTE2_MS = 560; // pivote de vuelta (~-90 grados)
const unsigned long ARCO2_MS = 500;   // arco al lado contrario

// Si la linea asoma un instante en plena busqueda, el PD la agarra y
// el barrido queda en pausa: al perderla otra vez retoma donde iba,
// no vuelve a la fase 0. Reiniciar el pivote en cada asomo sumaba
// giros al mismo lado sin tope y terminaba sacando la rueda de la
// pista (corrida #5: 117 reentradas en 10 s). Vencido el plazo la
// perdida se toma como otra y el barrido empieza de cero.
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

// Posicion lateral de cada canal en mm (medida sobre el chasis,
// centro del sensor al punto medio del eje de ruedas):
// S1/S3 a +-15 mm; S0/S4 a +-30 mm. Filas a 47/38/28 mm del eje.
const float X_MM[5] = {-30.0, -15.0, 0.0, 15.0, 30.0};
const int CANALES[5] = {S0, S1, S2, S3, S4};

// Historial de posiciones validas: anillo, [0] = la mas reciente.
// Solo se escribe con linea a la vista; en cruces y perdidas se
// congela y guarda como venia la pista antes del evento.
#define HIST_N 16
float hist[HIST_N];
int histLen = 0;

// --- MEMORIA PERSISTENTE (EEPROM, sobrevive al apagado) ---
// Registro de carreras: calibracion aprendida en la pista real y
// hasta 8 tiempos con sus contadores. Al parar con el pulsador se
// guarda la corrida; al encender se recarga la calibracion y se
// imprime la tabla de tiempos por serie.
struct Registro {
  byte magic;                  // 0xA7 si hay datos validos
  byte corridas;               // total de corridas guardadas
  int calMin[5];
  int calMax[5];
  unsigned long tiempos[8];    // ms largada -> parada
  byte perdidas[8];            // entradas a busqueda por corrida
  byte esquinas[8];            // curvas comprometidas
  byte cruces[8];              // todo-negro resuelto como cruce
};
const byte EEPROM_MAGIC = 0xA7;
Registro reg;
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
bool btnBloqueado = false;
unsigned long btnUltimo = 0;
unsigned long cruceHasta = 0;
unsigned long curvaDesde = 0;
int curvaLado = 0;
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

// --- MANEJADORES DE MANIOBRA COMPROMETIDA ---
void entrarCruce() {
  cruceRun++;
  cruceHasta = millis() +
    (unsigned long)(AVANCE_CRUCE_MM * 1000.0 / MM_S_A_CRUCE);
  posF = posPrev = 0;
  perdidaConteo = 0;
  extremoConteo = 0;
  faseBusqueda = -1;
  pausaFase = -1;
  enLinea = false;
  motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
}

// lado: -1 izquierda, +1 derecha
void entrarCurva(int lado) {
  esqRun++;
  curvaDesde = millis();
  curvaLado = lado;
  perdidaConteo = 0;
  extremoConteo = 0;
  faseBusqueda = -1;
  pausaFase = -1; // la curva cambia el marco: la pausa ya no aplica
  enLinea = false;
}

// --- BUSQUEDA: arranque, pausa y fases ---
// Al salir de la busqueda (el PD tomo la linea) se guarda la fase, el
// lado y cuanto llevaba de esa fase: si la perdida vuelve enseguida el
// barrido retoma donde iba. Tambien capa la velocidad un tramo
// (asiento), como hacia la salida por confirmacion.
void pausarBusqueda() {
  if (faseBusqueda >= 0) {
    pausaFase = faseBusqueda;
    pausaLado = ladoBusqueda;
    pausaEnFase = millis() - faseDesde;
    pausaDesde = millis();
    asientoHasta = millis() + ASIENTO_MS;
  }
  faseBusqueda = -1;
}

void arrancarBusqueda() {
  perdRun++;
  // Pausa reciente: mismo episodio, retomar la fase sin reiniciar el
  // pivote. Pausa vieja o inexistente: episodio nuevo desde cero.
  if (pausaFase >= 0 && millis() - pausaDesde <= PAUSA_MAX_MS) {
    ladoBusqueda = pausaLado;
    faseBusqueda = pausaFase;
    faseDesde = millis() - pausaEnFase;
    return;
  }
  pausaFase = -1;
  // Direccion: promedio de las ultimas posiciones validas; si no
  // alcanza, el ultimo lado grande; si no, la derecha.
  float p = (histGet(0) + histGet(1) + histGet(2)) / 3.0;
  if (p > 1.0) ladoBusqueda = 1;
  else if (p < -1.0) ladoBusqueda = -1;
  else ladoBusqueda = (ultimoLado != 0) ? ultimoLado : 1;
  faseBusqueda = 0;
  faseDesde = millis();
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
  Serial.println("===== ARTURITO v3 =====");
  Serial.println("Esperando: apoyar sobre la linea y pulsar largada.");

  // Recargar el registro persistente: si es valido, la calibracion
  // de la ultima pista arranca sembrada y la tabla de tiempos sale
  // por serie para consultarla con cable despues de las corridas.
  EEPROM.get(0, reg);
  if (reg.magic != EEPROM_MAGIC) {
    reg.magic = EEPROM_MAGIC;
    reg.corridas = 0;
    memset(reg.tiempos, 0, sizeof(reg.tiempos));
    memset(reg.perdidas, 0, sizeof(reg.perdidas));
    memset(reg.esquinas, 0, sizeof(reg.esquinas));
    memset(reg.cruces, 0, sizeof(reg.cruces));
  } else {
    for (int i = 0; i < 5; i++) {
      calMin[i] = reg.calMin[i];
      calMax[i] = reg.calMax[i];
    }
    Serial.print("Corridas guardadas: ");
    Serial.println(reg.corridas);
    for (int i = 0; i < reg.corridas && i < 8; i++) {
      Serial.print("  #"); Serial.print(i + 1);
      Serial.print(": "); Serial.print(reg.tiempos[i] / 1000.0);
      Serial.print(" s | perdidas "); Serial.print(reg.perdidas[i]);
      Serial.print(" esquinas "); Serial.print(reg.esquinas[i]);
      Serial.print(" cruces "); Serial.println(reg.cruces[i]);
    }
  }
}

void loop() {
  leerSensores();

  // 1. Pulsador: flanco de pulsado (HIGH->LOW) con antirrebote
  bool btn = digitalRead(BTN);
  bool presion = false;
  if (btn != btnPrev && millis() - btnUltimo > BTN_DEBOUNCE_MS) {
    btnUltimo = millis();
    btnPrev = btn;
    if (btn == LOW) presion = true;
  }

  // 2. Compuerta de arranque (igual que v2)
  if (!arrancado) {
    if (btn == HIGH) btnBloqueado = false;
    // Compuerta: negrura normal o lectura cruda de respaldo, por si
    // la calibracion persistida de otra pista comprime la escala.
    if (!btnBloqueado && btn == LOW &&
        (negrura(2) > N_ON || lecturas[2] > 650) &&
        (negrura(0) < N_OFF || lecturas[0] < 350) &&
        (negrura(4) < N_OFF || lecturas[4] < 350)) {
      sembrarPista();
      arrancado = true;
      largadaDesde = millis();
      perdRun = esqRun = cruceRun = 0;
      posF = posPrev = 0;
      histLen = 0;
      perdidaConteo = 0;
      cruceHasta = 0;
      curvaDesde = 0;
      faseBusqueda = -1;
      pausaFase = -1;
      enLinea = false;
      asientoHasta = 0;
      Serial.println("LARGADA: arrancando.");
    } else {
      detener();
      delay(5);
      return;
    }
  }
  // 3. En carrera: un nuevo click detiene y devuelve a la espera
  else if (presion) {
    arrancado = false;
    btnBloqueado = true;
    detener();
    // Guardar la corrida en EEPROM: tiempo, contadores y calibracion
    int slot = reg.corridas % 8;
    reg.tiempos[slot] = millis() - largadaDesde;
    reg.perdidas[slot] = perdRun;
    reg.esquinas[slot] = esqRun;
    reg.cruces[slot] = cruceRun;
    for (int i = 0; i < 5; i++) {
      reg.calMin[i] = calMin[i];
      reg.calMax[i] = calMax[i];
    }
    reg.corridas++;
    EEPROM.put(0, reg);
    Serial.print("DETENIDO: ");
    Serial.print(reg.tiempos[slot] / 1000.0);
    Serial.println(" s guardados. Esperando nueva largada.");
    delay(5);
    return;
  }

  // 4. Cruce comprometido: recto sin leer hasta que venza el tramo
  if (cruceHasta) {
    if (millis() < cruceHasta) {
      motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
      delay(5);
      return;
    }
    cruceHasta = 0;
  }

  // 5. Curva comprometida: gira hasta que la linea vuelve al trio
  //    interno o vence el techo. Todo-negro aca no es cruce: es el
  //    cuadrado de la esquina, se ignora.
  if (curvaDesde) {
    unsigned long enCurva = millis() - curvaDesde;
    float interna = negrura(1) + negrura(2) + negrura(3);
    if (enCurva >= CURVA_MIN_MS && interna > NEG_INTERNA) {
      curvaDesde = 0;
      asientoHasta = millis() + ASIENTO_MS;
    } else if (enCurva >= CURVA_MAX_MS) {
      curvaDesde = 0;
      arrancarBusqueda();
    } else {
      if (curvaLado > 0) { motorIzq(VEL_CURVA_EXT); motorDer(VEL_CURVA_INT); }
      else               { motorIzq(VEL_CURVA_INT); motorDer(VEL_CURVA_EXT); }
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
    if (posRef > POS_ESQ_MM) entrarCurva(1);
    else if (posRef < -POS_ESQ_MM) entrarCurva(-1);
    else entrarCruce();
    delay(5);
    return;
  }

  // 8. Solo un extremo ve la linea: esquina que arranca. Pide
  //    persistencia de unos ciclos para no morder en un cruce
  //    ladeado (una banda lateral alcanza a los dos extremos).
  bool extIzq = (n[0] > NEG_EXT) && (suma - n[0] < SUMA_OTROS);
  bool extDer = (n[4] > NEG_EXT) && (suma - n[4] < SUMA_OTROS);
  int ladoExt = extIzq ? -1 : (extDer ? 1 : 0);
  if (ladoExt != 0 && ladoExt == extremoLado) {
    if (++extremoConteo >= EXTREMO_CICLOS) {
      entrarCurva(ladoExt);
      delay(5);
      return;
    }
  } else {
    extremoConteo = 0;
    extremoLado = ladoExt;
  }

  // 9. Linea a la vista: PD con zona muerta y rueda interna en piso.
  //    Histeresis: entra pidiendo UMBRAL_LINEA pero no la suelta hasta
  //    que la senal se apaga del todo (cae de UMBRAL/2). La banda
  //    debil intermedia la sigue el PD — girar hacia el asomo recupera
  //    la linea; soltarla ahi era lo que recaia en la busqueda.
  enLinea = (suma > UMBRAL_LINEA) || (enLinea && suma > UMBRAL_LINEA / 2.0);
  if (enLinea) {
    float pos = sumaP / suma;            // mm, -30 (izq) .. +30 (der)
    posF += ALPHA * (pos - posF);
    float deriv = posF - posPrev;
    posPrev = posF;
    histPush(posF);

    if (posF > 6.0) ultimoLado = 1;
    else if (posF < -6.0) ultimoLado = -1;
    perdidaConteo = 0;
    pausarBusqueda();

    // Zona muerta como interruptor: dentro de +-DB_MM no hay senal
    // real y se va a fondo; afuera la correccion es completa sobre
    // posF — restarla dejaba una banda debil justo donde empiezan
    // las curvas y el robot las pasaba de largo (regresion vs v2).
    int base = (int)(VEL_MAX - KS * fabs(posF));
    if (base < VEL_MIN) base = VEL_MIN;
    if (millis() < asientoHasta && base > VEL_ASIENTO) base = VEL_ASIENTO;

    float corr = (fabs(posF) < DB_MM) ? 0 : KP * posF + KD * deriv;

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
  //     Reaparece -> asiento; no reaparece -> arco, pivote acotado,
  //     arco contrario, pivote acotado de vuelta, y se repite.
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
