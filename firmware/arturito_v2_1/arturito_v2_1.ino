/*
 * ==========================================================
 * ROBOT: ARTURITO v2.1 - SEGUIDOR DE LINEA CON CONTROL CONTINUO
 * CONCURSO: 1er Concurso Distrital de Robotica 2026 (Santa Cruz)
 * ==========================================================
 * Base: v2 (version segura). La v2.1 agrega cambios pequenos y
 * reversibles; cada uno vive en una constante para volver al
 * comportamiento de v2 cambiando un numero:
 *
 *   Ronda 1  KD 25 -> 80          (derivada con efecto real)
 *            TRIM_DER 1.0 -> 1.02 (compensa deriva a la derecha)
 *   Ronda 2  AVANCE_CRUCE_MS 200 -> 140 (menos avance ciego)
 *   Ronda 3  K_PUNTA 1.0 -> 0.5   (S0/S4 tiran menos cuando
 *                                  S1/S2/S3 ya ven la linea)
 *   Extra    Registro en EEPROM (sin cable en pista): tiempo,
 *            perdidas, cruces, linea de tiempo de eventos y
 *            calibracion final. Se lee despues por Serial:
 *            'r' muestra el informe, 'b' lo borra.
 *
 * Para volver a v2: KD=25, TRIM_DER=1.0, AVANCE_CRUCE_MS=200,
 * K_PUNTA=1.0.
 *
 * Arranque de competencia: se enciende en la mano, con motores
 * parados, se apoya sobre la linea. Apretar el pulsador de
 * largada (D8) prepara el arranque y soltarlo larga el robot,
 * siempre que S2 siga sobre negro y los extremos S0/S4 libres:
 * si esta mal apoyado no arranca y da tiempo de reacomodarlo.
 * Mantenerlo apretado mientras se baja el robot tambien sirve:
 * larga al soltar. En carrera, apretar detiene y devuelve a la
 * espera; un ciclo apretar-soltar nuevo lo relanza con la misma
 * regla. Sin prueba de motores ni ventana de calibracion: el
 * reglamento no permite tocarlo una vez en carrera. Antes de
 * pulsar se puede verificar el LED del modulo S2 encendido
 * = esta viendo la linea.
 *
 * - Posicion continua (media ponderada de los 5 canales
 *   analogicos) filtrada con EMA: corta el bamboleo.
 * - Velocidad adaptativa: a fondo en rectas, baja en curvas.
 * - Calibracion adaptativa: parte de valores de laboratorio y
 *   se ajusta sola en marcha; al apoyarlo, la posicion de
 *   salida siembra el blanco y el negro reales de la pista.
 * - Interseccion: al ver todo negro avanza recto un tramo
 *   fijo sin leer, para no tomar un ramal por una lectura a
 *   medio cruce.
 * - Recuperacion: gira hacia el ultimo lado que vio la linea
 *   y, si no la encuentra, rebobina (retrocede buscando).
 * - Trim de motores: TRIM_IZQ/TRIM_DER corrigen la deriva en
 *   recta (medir en el piso y ajustar a mano).
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
const int VEL_MAX = 180;   // velocidad en recta
const int VEL_MIN = 70;    // velocidad en curva cerrada
const float KP = 40.0;     // giro proporcional por unidad de posicion
const float KD = 80.0;     // amortigua el zigzag (v2: 25). Se mide por
                           // ciclo de loop: no cambiar delay(5)
const float KS = 70.0;     // cuanto baja la velocidad con el error
const float ALPHA = 0.4;   // filtro EMA de la posicion (0..1)
const int REV_MAX = 60;    // reversa maxima corrigiendo (anti-pivoteo)

// Trim de motores (1.0 = igual). Si tira a la derecha, bajar TRIM_IZQ
// o subir TRIM_DER. Se ajusta a mano tras la prueba de recta.
const float TRIM_IZQ = 1.0;
const float TRIM_DER = 1.02; // v2: 1.0

// Compuerta de arranque (umbrales sobre negrura 0..1)
const float N_ON = 0.6;    // S2 tiene que ver negro firme
const float N_OFF = 0.4;   // S0 y S4 tienen que ver blanco

// Puntas S0/S4: peso relativo cuando el trio S1/S2/S3 ya ve linea.
// 1.0 = como v2; 0.5 = mitad del tiron; 0.0 = puntas excluidas.
const float K_PUNTA = 0.5;
const float UMBRAL_TRIO = 0.3;

// Interseccion: avance recto comprometido al ver todo negro
const int VEL_CRUCE = 140;
const unsigned long AVANCE_CRUCE_MS = 140; // v2: 200

// Antirrebote del pulsador (flanco estable despues de este tiempo)
const unsigned long BTN_DEBOUNCE_MS = 50;

// Recuperacion de linea perdida
const unsigned long GIRO_BUSQUEDA_MS = 1500; // tiempo girando antes de rebobinar
const int VEL_BUSQUEDA = 130;
const int VEL_REBOBINADO = 90;

// Calibracion inicial de laboratorio (por canal; medir y rellenar).
// En cinta negra sobre papel blanco: blanco ~26-30, negro ~850-960.
int calMin[5] = {30, 30, 30, 30, 30};
int calMax[5] = {930, 930, 930, 930, 930};

// Posicion lateral de cada canal en la flecha: -2 izq .. +2 der
const float PESO[5] = {-2.0, -1.0, 0.0, 1.0, 2.0};
const int CANALES[5] = {S0, S1, S2, S3, S4};

int lecturas[5];
float posF = 0;
float posPrev = 0;
int ultimoLado = 0;                 // -1 izquierda, +1 derecha
unsigned long perdidaDesde = 0;
unsigned long cruceHasta = 0;
bool arrancado = false;
bool btnPrev = HIGH;                // pull-up: HIGH = suelto
bool preparado = false;             // pulsador apretado: armado para largar al soltar
unsigned long btnUltimo = 0;

// Medicion de pruebas: se guarda en EEPROM, se lee despues por Serial
unsigned int perdidas = 0;          // veces que entro en busqueda de linea
unsigned int cruces = 0;            // veces que detecto todo negro
unsigned long inicioCarrera = 0;

// Mapa de EEPROM (se conserva solo la ultima corrida)
const byte EE_FIRMA = 0xA2;         // marca de datos validos
const int EE_FIRMA_DIR = 0;         // 1 byte
const int EE_NEV = 1;               // 1 byte: cantidad de eventos
const int EE_TIEMPO = 2;            // 4 bytes: ms de carrera (0 = sin cierre)
const int EE_PERD = 6;              // 1 byte: perdidas
const int EE_CRUCES = 7;            // 1 byte: cruces
const int EE_CAL = 8;               // 20 bytes: calMin/calMax finales
const int EE_EVENTOS = 28;          // 3 bytes por evento: tipo + decimas de s
const int EE_MAX_EV = 120;

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

// Al apoyarlo sobre la linea, la posicion de salida siembra la
// pista real: canal sobre negro -> su calMax, sobre blanco -> calMin
void sembrarPista() {
  for (int i = 0; i < 5; i++) {
    int medio = (calMin[i] + calMax[i]) / 2;
    if (lecturas[i] > medio) calMax[i] = lecturas[i];
    else calMin[i] = lecturas[i];
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
}

// En carrera: agrega un evento ('P' perdida, 'C' cruce) con su tiempo.
void eeEvento(char tipo) {
  byte n = EEPROM.read(EE_NEV);
  if (n < EE_MAX_EV) {
    int dir = EE_EVENTOS + 3 * n;
    unsigned int d = (millis() - inicioCarrera) / 100;
    EEPROM.update(dir, (byte)tipo);
    EEPROM.put(dir + 1, d);
    EEPROM.update(EE_NEV, n + 1);
  }
  EEPROM.update(EE_PERD, perdidas > 255 ? 255 : perdidas);
  EEPROM.update(EE_CRUCES, cruces > 255 ? 255 : cruces);
}

// Al detener: guarda calibracion final y tiempo total.
void eeCerrar() {
  unsigned long t = millis() - inicioCarrera;
  if (t == 0) t = 1;
  for (int i = 0; i < 5; i++) {
    EEPROM.put(EE_CAL + 4 * i, (unsigned int)calMin[i]);
    EEPROM.put(EE_CAL + 4 * i + 2, (unsigned int)calMax[i]);
  }
  EEPROM.put(EE_TIEMPO, t);
}

void eeBorrar() {
  EEPROM.update(EE_FIRMA_DIR, 0);
  Serial.println(F("Registro borrado."));
}

void eeInforme() {
  if (EEPROM.read(EE_FIRMA_DIR) != EE_FIRMA) {
    Serial.println(F("EEPROM sin datos."));
    return;
  }
  unsigned long t;
  EEPROM.get(EE_TIEMPO, t);
  Serial.println(F("--- ULTIMA CORRIDA ---"));
  if (t > 0) {
    Serial.print(F("Tiempo (s): "));
    Serial.println(t / 1000.0, 1);
  } else {
    Serial.println(F("Sin cierre: se apago sin pulsador. Ver ultimo evento."));
  }
  Serial.print(F("Perdidas: ")); Serial.println(EEPROM.read(EE_PERD));
  Serial.print(F("Cruces: ")); Serial.println(EEPROM.read(EE_CRUCES));
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
  Serial.println(F("Eventos (P perdida, C cruce) en segundos:"));
  for (byte i = 0; i < n; i++) {
    int dir = EE_EVENTOS + 3 * i;
    char tipo = (char)EEPROM.read(dir);
    unsigned int d;
    EEPROM.get(dir + 1, d);
    Serial.print(tipo); Serial.print(F(" "));
    Serial.println(d / 10.0, 1);
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
  Serial.println(F("===== ARTURITO v2.1 ====="));
  Serial.println(F("Comandos: r = informe, b = borrar"));
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
  //    extremos libres). Si no se cumple no pasa nada: senal de
  //    reacomodar y volver a intentar.
  if (!arrancado) {
    if (flancoBajo) preparado = true;
    if (flancoAlto && preparado) {
      preparado = false;
      if (negrura(2) > N_ON && negrura(0) < N_OFF && negrura(4) < N_OFF) {
        sembrarPista();
        arrancado = true;
        posF = posPrev = 0;
        perdidaDesde = 0;
        cruceHasta = 0;
        perdidas = 0;
        cruces = 0;
        eeIniciar();
        inicioCarrera = millis();
      }
    }
    if (!arrancado) {
      detener();
      if (Serial.available()) {
        char c = Serial.read();
        if (c == 'r') eeInforme();
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

  // 2. Cruce comprometido: recto sin leer hasta que venza el tramo
  if (cruceHasta) {
    if (millis() < cruceHasta) {
      motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
      delay(5);
      return;
    }
    cruceHasta = 0;
  }

  // 3. Lectura ponderada. Si el trio S1/S2/S3 ya ve linea, las
  //    puntas S0/S4 votan con peso K_PUNTA (un brazo de la X bajo
  //    una punta tira menos del centroide).
  float suma = 0, sumaP = 0;
  bool todoNegro = true;
  float trio = negrura(1) + negrura(2) + negrura(3);
  float kPunta = (trio > UMBRAL_TRIO) ? K_PUNTA : 1.0;
  for (int i = 0; i < 5; i++) {
    float n = negrura(i);
    if (n < 0.7) todoNegro = false;
    if (i == 0 || i == 4) n *= kPunta;
    suma += n;
    sumaP += PESO[i] * n;
  }

  // 4. Cruce o bifurcacion: armar el avance recto temporizado.
  //    ultimoLado se conserva: si era una esquina cerrada y no un
  //    cruce, la recuperacion sigue buscando al lado correcto.
  if (todoNegro) {
    cruceHasta = millis() + AVANCE_CRUCE_MS;
    posF = posPrev = 0;
    perdidaDesde = 0;
    cruces++;
    motorIzq(VEL_CRUCE); motorDer(VEL_CRUCE);
    eeEvento('C');
    delay(5);
    return;
  }

  // 5. Linea a la vista: PD sobre la posicion filtrada
  if (suma > 0.3) {
    float pos = sumaP / suma;            // -2 (izq) .. +2 (der)
    posF += ALPHA * (pos - posF);        // EMA: corta los saltos
    float deriv = posF - posPrev;
    posPrev = posF;

    if (posF > 0.5) ultimoLado = 1;
    else if (posF < -0.5) ultimoLado = -1;
    perdidaDesde = 0;

    int base = (int)(VEL_MAX - KS * abs(posF));
    if (base < VEL_MIN) base = VEL_MIN;

    float corr = KP * posF + KD * deriv;
    int velIzq = constrain((int)((base + corr) * TRIM_IZQ), -REV_MAX, 255);
    int velDer = constrain((int)((base - corr) * TRIM_DER), -REV_MAX, 255);
    motorIzq(velIzq);
    motorDer(velDer);
    delay(5);
    return;
  }

  // 6. Linea perdida: buscar hacia el ultimo lado visto
  bool nuevaPerdida = false;
  if (perdidaDesde == 0) {
    perdidaDesde = millis();
    perdidas++;
    nuevaPerdida = true;
  }
  unsigned long perdidaMs = millis() - perdidaDesde;

  if (perdidaMs < GIRO_BUSQUEDA_MS) {
    // Pivotar en el sitio hacia el ultimo lado conocido
    int giro = (ultimoLado >= 0) ? VEL_BUSQUEDA : -VEL_BUSQUEDA;
    motorIzq(giro);
    motorDer(-giro);
  } else {
    // Rebobinar: retroceder despacio, todavia girando hacia ese lado
    int giro = (ultimoLado >= 0) ? VEL_REBOBINADO : -VEL_REBOBINADO;
    motorIzq(-VEL_REBOBINADO + giro / 2);
    motorDer(-VEL_REBOBINADO - giro / 2);
  }
  if (nuevaPerdida) eeEvento('P');
  delay(5);
}
