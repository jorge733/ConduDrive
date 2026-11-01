// ===========================================================
// ConduDrive - CONFIGURACIÓN GENERAL
// Aquí están los números importantes del juego, juntos y fáciles
// de cambiar sin tocar el resto del código.
// (Las velocidades están en metros por segundo: 1 m/s = 3,6 km/h)
// ===========================================================

export const CONFIG = {
  auto: {
    velocidadMax: 22,          // ~80 km/h
    velocidadMaxReversa: 4.5,  // ~16 km/h (marcha atrás más lenta)
    aceleracion: 5.0,          // qué tan rápido gana velocidad
    aceleracionReversa: 2.5,
    frenado: 11,               // fuerza del freno normal
    frenoMano: 7,              // fuerza del freno de mano
    rozamiento: 1.3,           // frenado suave cuando sueltas el acelerador
    distanciaEjes: 2.5,        // distancia entre ruedas delanteras y traseras
    giroMax: 0.6,              // ángulo máximo de las ruedas (radianes, ~34°)
    velocidadVolante: 2.8,     // qué tan rápido se mueve el volante
    agarre: 10,                // agarre normal de los neumáticos
    agarreLluvia: 3.5,         // agarre con lluvia (se usará en el modo pesadilla)
    agarreFrenoMano: 1.6,      // con freno de mano el auto "patina"
    radioRueda: 0.32,
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
