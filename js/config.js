// ===========================================================
// ConduDrive - CONFIGURACIÓN GENERAL
// Aquí están los números importantes del juego, juntos y fáciles
// de cambiar sin tocar el resto del código.
// (Las velocidades están en metros por segundo: 1 m/s = 3,6 km/h)
// ===========================================================

export const CONFIG = {
  auto: {
    // ----- Cuerpo (un auto chico tipo hatchback, tracción delantera) -----
    masa: 1200,                // kg
    inercia: 1850,             // resistencia a girar sobre sí mismo (kg·m²)
    cgDelante: 1.12,           // metros del centro de masa al eje delantero
    cgAtras: 1.38,             // metros del centro de masa al eje trasero
    alturaCG: 0.52,            // altura del centro de masa (traspaso de peso)
    radioRueda: 0.31,

    // ----- Neumáticos (curva tipo "Pacejka" simplificada) -----
    agarre: 1.0,               // coeficiente de roce con asfalto seco
    agarreLluvia: 0.6,         // con asfalto mojado
    rigidezNeumatico: 16,      // qué tan rápido responde el neumático (B)
    formaNeumatico: 1.45,      // forma de la curva (C): pasado el máximo, pierde agarre

    // ----- Motor (1.4 litros, ~75 kW) -----
    rpmRalenti: 850,
    rpmMax: 6300,              // corte de inyección
    torqueMax: 140,            // N·m
    rpmTorqueMax: 4000,
    frenoMotor: 0.006,         // retención del motor al soltar el acelerador
    torqueArrastre: 24,        // empuje suave de la caja automática en ralentí ("creep")

    // ----- Caja de cambios -----
    cambios: [3.45, 2.05, 1.38, 1.03, 0.82],
    reversa: 3.3,
    diferencial: 4.06,
    eficiencia: 0.9,

    // ----- Frenos y resistencia del aire -----
    frenoMax: 11500,           // fuerza total máxima de los frenos (N)
    repartoFreno: 0.68,        // parte del frenado que hacen las ruedas delanteras
    arrastreAire: 0.42,        // ½·densidad·Cd·área
    rodadura: 0.013,           // resistencia a la rodadura

    // ----- Dirección -----
    distanciaEjes: 2.5,
    giroMax: 0.62,             // ángulo máximo de las ruedas (~35°)
    relacionVolante: 13,       // vueltas del volante vs. ruedas
    sensibilidadTeclado: 55,   // a más número, menos se reduce el giro con la velocidad (teclado)
    sensibilidadAnalogica: 160,// lo mismo para volante táctil o joystick (más preciso)

    radioChoque: 0.85          // tamaño del auto para detectar choques
  },

  graficos: {
    pixelRatioMax: 1.5,        // limita la resolución en pantallas muy densas (celulares)
    tamanoSombra: 1024,        // calidad de las sombras
    antialias: true,
    espejoAncho: 384,          // resolución de la imagen de los espejos retrovisores
    espejoAlto: 128
  },

  semaforo: {
    verde: 9,                  // segundos en verde
    amarillo: 3,               // segundos en amarillo
    todoRojo: 1.5              // segundos con todos en rojo (por seguridad)
  },

  // Límites de velocidad (km/h), como en Chile
  limites: {
    urbano: 50,
    zonaEscolar: 30,
    estacionamiento: 20
  },

  trafico: {
    velocidadCrucero: 8.5,     // ~30 km/h, los otros autos andan tranquilos
    distanciaSeguridad: 7      // metros que dejan con el auto de adelante
  },

  ciudad: {
    tamanoManzana: 40,         // lado de cada manzana (metros)
    anchoCalle: 10,            // ancho de cada calle (dos pistas)
    anchoVereda: 2.2,
    radioRotonda: 14,          // radio exterior de la rotonda
    radioIsla: 5               // radio de la isla del centro de la rotonda
  }
};
