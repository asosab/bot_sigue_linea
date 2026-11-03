/*
 * ==========================================================
 * PRUEBA SENSORES TCRT5000 - SOLO LECTURA, SIN MOVIMIENTO
 * ==========================================================
 * Lee A0..A4 y los imprime por serie. El driver queda DORMIDO
 * (EEP en LOW): las ruedas no pueden moverse en esta prueba.
 *
 * Uso: pasar una cinta negra por debajo de cada sensor, de
 * izquierda a derecha MIRANDO el bot de frente. El monitor
 * muestra que canal reacciona -> asi queda el mapa real
 * canal <-> posicion fisica.
 *
 * Valores esperados (calibracion previa): blanco 30-40,
 * negro 750-990, umbral 500. Si un canal da ~0 o ~1023 fijos,
 * esta cableado a la salida digital del modulo, no a la analogica.
 */

#define S0 A0
#define S1 A1
#define S2 A2
#define S3 A3
#define S4 A4

// Pines del driver: no se usan, pero se fuerzan a estado seguro
#define IN1 5
#define IN2 6
#define IN3 9
#define IN4 10
#define SLEEP_DRV 4

const int UMBRAL = 500;
const int CANALES[5] = {S0, S1, S2, S3, S4};

bool negro[5] = {false, false, false, false, false};

void setup() {
  // Todo el driver apagado y dormido: cero movimiento posible
  pinMode(IN1, OUTPUT); digitalWrite(IN1, LOW);
  pinMode(IN2, OUTPUT); digitalWrite(IN2, LOW);
  pinMode(IN3, OUTPUT); digitalWrite(IN3, LOW);
  pinMode(IN4, OUTPUT); digitalWrite(IN4, LOW);
  pinMode(SLEEP_DRV, OUTPUT);
  digitalWrite(SLEEP_DRV, LOW); // driver dormido

  Serial.begin(9600);
  Serial.println();
  Serial.println("===== PRUEBA SENSORES (sin motores) =====");
  Serial.println("Pasa la cinta negra por cada sensor, de izquierda");
  Serial.println("a derecha MIRANDO el bot de frente.");
  Serial.println("Columnas: S0=A0 S1=A1 S2=A2 S3=A3 S4=A4, * = negro");
  Serial.println("=========================================");
  delay(1000);
}

void loop() {
  Serial.print("S0..S4: ");
  for (int i = 0; i < 5; i++) {
    int v = analogRead(CANALES[i]);
    bool ahora = v > UMBRAL;

    // Evento al cambiar de estado: mas facil de seguir en el monitor
    if (ahora != negro[i]) {
      negro[i] = ahora;
      Serial.println();
      Serial.print(">>> canal S");
      Serial.print(i);
      Serial.println(ahora ? " vio NEGRO" : " volvio a blanco");
    }

    if (v < 10) Serial.print("   ");
    else if (v < 100) Serial.print("  ");
    else if (v < 1000) Serial.print(" ");
    Serial.print(v);
    Serial.print(ahora ? "*" : " ");
  }
  Serial.println();
  delay(200);
}
