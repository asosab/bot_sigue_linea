/*
 * ==========================================================
 * ROBOT: ARTURITO v2 - SEGUIDOR DE LINEA CON CONTROL CONTINUO
 * CONCURSO: 1er Concurso Distrital de Robotica 2026 (Santa Cruz)
 * ==========================================================
 * Diferencias con v1:
 * - Posicion continua (media ponderada de los 5 canales
 *   analogicos) en vez de tabla de casos binaria.
 * - Velocidad adaptativa: a fondo en rectas, baja en curvas.
 * - Autocalibracion al encender: 4 s para pasar la linea por
 *   los sensores; si no se calibra usa valores por defecto.
 * - Recuperacion: gira hacia el ultimo lado que vio la linea y,
 *   si no la encuentra, rebobina (retrocede buscando el punto).
 * - Trim de motores: TRIM_IZQ/TRIM_DER corrigen la deriva en
 *   recta (medir en el piso y ajustar a mano).
 *
 * Hardware: UNO + 5xTCRT5000 (A0..A4, flecha: S2 adelante,
 * S1/S3 medios, S0/S4 atras en las puntas) + DRV8833 (IN1..IN4
 * en D5/D6/D9/D10, EEP en D4, ULT en D2).
 */

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

// --- PARAMETROS DE CONTROL ---
const int VEL_MAX = 200;   // velocidad en recta
const int VEL_MIN = 80;    // velocidad en curva cerrada
const float KP = 55.0;     // giro proporcional por unidad de posicion
const float KD = 18.0;     // amortigua el zigzag (derivada de la posicion)
const float KS = 60.0;     // cuanto baja la velocidad con el error

// Trim de motores (1.0 = igual). Si tira a la derecha, bajar TRIM_IZQ
// o subir TRIM_DER. Se ajusta a mano tras la prueba de recta.
const float TRIM_IZQ = 1.0;
const float TRIM_DER = 1.0;

// Recuperacion de linea perdida
const unsigned long GIRO_BUSQUEDA_MS = 1500; // tiempo girando antes de rebobinar
const int VEL_BUSQUEDA = 130;
const int VEL_REBOBINADO = 90;

// Calibracion por defecto si la ventana no capto negro
const int CAL_MIN_DEF = 30;
const int CAL_MAX_DEF = 930;
const unsigned long CAL_MS = 4000;

// Posicion lateral de cada canal en la flecha: -2 izq .. +2 der
const float PESO[5] = {-2.0, -1.0, 0.0, 1.0, 2.0};
const int CANALES[5] = {S0, S1, S2, S3, S4};

int calMin[5];
int calMax[5];

float posPrev = 0;
int ultimoLado = 0;           // -1 izquierda, +1 derecha
unsigned long perdidaDesde = 0;

// --- MOTORES (velocidad con signo: + adelante, - atras) ---
void motorIzq(int vel) {
  if (vel >= 0) {
    analogWrite(IN1, min(vel, 255));
    digitalWrite(IN2, LOW);
  } else {
    digitalWrite(IN1, LOW);
    analogWrite(IN2, min(-vel, 255));
  }
}

void motorDer(int vel) {
  if (vel >= 0) {
    analogWrite(IN3, min(vel, 255));
    digitalWrite(IN4, LOW);
  } else {
    digitalWrite(IN3, LOW);
    analogWrite(IN4, min(-vel, 255));
  }
}

void detener() {
  motorIzq(0); motorDer(0);
}

// --- CALIBRACION ---
void calibrar() {
  Serial.println("CALIBRACION: pasa la linea por debajo de los");
  Serial.println("sensores durante 4 s (blanco y negro).");
  for (int i = 0; i < 5; i++) { calMin[i] = 1023; calMax[i] = 0; }

  unsigned long t0 = millis();
  while (millis() - t0 < CAL_MS) {
    for (int i = 0; i < 5; i++) {
      int v = analogRead(CANALES[i]);
      if (v < calMin[i]) calMin[i] = v;
      if (v > calMax[i]) calMax[i] = v;
    }
    delay(10);
  }

  // Si algun canal no vio contraste, usar valores por defecto
  for (int i = 0; i < 5; i++) {
    if (calMax[i] - calMin[i] < 150) {
      calMin[i] = CAL_MIN_DEF;
      calMax[i] = CAL_MAX_DEF;
    }
    Serial.print("S"); Serial.print(i);
    Serial.print(": "); Serial.print(calMin[i]);
    Serial.print("-"); Serial.println(calMax[i]);
  }
}

// Negrura de un canal normalizada 0..1 segun su calibracion
float negrura(int i) {
  int v = analogRead(CANALES[i]);
  float n = (float)(v - calMin[i]) / (float)(calMax[i] - calMin[i]);
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
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

  Serial.begin(9600);
  Serial.println("===== ARTURITO v2 =====");
  calibrar();

  // Prueba de motores igual que v1: adelante, pausa, atras
  Serial.println("Prueba de motores...");
  motorIzq(150); motorDer(150); delay(800);
  detener(); delay(300);
  motorIzq(-150); motorDer(-150); delay(800);
  detener(); delay(500);
  Serial.println("A seguir la linea.");
}

void loop() {
  // 1. Lectura ponderada
  float suma = 0, sumaP = 0;
  bool todoNegro = true;
  for (int i = 0; i < 5; i++) {
    float n = negrura(i);
    suma += n;
    sumaP += PESO[i] * n;
    if (n < 0.7) todoNegro = false;
  }

  // 2. Cruce o bifurcacion: todos negros -> seguir recto a fondo
  if (todoNegro) {
    motorIzq(VEL_MAX); motorDer(VEL_MAX);
    ultimoLado = 0;
    perdidaDesde = 0;
    delay(5);
    return;
  }

  // 3. Linea a la vista: control proporcional-derivativo
  if (suma > 0.3) {
    float pos = sumaP / suma;               // -2 (izq) .. +2 (der)
    float deriv = pos - posPrev;
    posPrev = pos;

    if (pos > 0.5) ultimoLado = 1;
    else if (pos < -0.5) ultimoLado = -1;
    perdidaDesde = 0;

    int base = (int)(VEL_MAX - KS * abs(pos));
    if (base < VEL_MIN) base = VEL_MIN;

    float corr = KP * pos + KD * deriv;
    int velIzq = (int)((base + corr) * TRIM_IZQ);
    int velDer = (int)((base - corr) * TRIM_DER);
    motorIzq(velIzq);
    motorDer(velDer);
    delay(5);
    return;
  }

  // 4. Linea perdida: buscar hacia el ultimo lado visto
  if (perdidaDesde == 0) perdidaDesde = millis();
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
  delay(5);
}
