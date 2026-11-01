// ===========================================================
// ConduDrive - TRÁNSITO (otros autos que circulan)
// Cada auto sigue una ruta fija (un circuito cerrado por la pista
// derecha). Frena si hay alguien adelante y respeta el semáforo.
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { derechaDe } from './util.js';
import { crearAutoMalla, COLORES_AUTOS } from './vehiculos.js';

const T = CONFIG.trafico;
const MEDIA_PISTA = CONFIG.ciudad.anchoCalle / 4; // 2,5 m: centro de la pista derecha

// Rutas: esquinas por el CENTRO de las calles, en orden de viaje.
// (Se evitan la rotonda y el recorrido delicado del examen)
const RUTAS = [
  { esquinas: [[-25, -75], [-25, 25], [-75, 25], [-75, -75]], autos: 3 },  // pasa por el semáforo
  { esquinas: [[75, -75], [75, 75], [-75, 75], [-75, -75]], autos: 3 },    // vuelta exterior
  { esquinas: [[-75, -75], [-75, 75], [75, 75], [75, -75]], autos: 3 }     // vuelta exterior, al revés
];

/** Convierte las esquinas en un camino con curvas suaves por la pista derecha */
function construirCamino(esquinas) {
  const n = esquinas.length;
  const dir = (a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    return { x: dx / l, z: dz / l };
  };
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const prev = esquinas[(i - 1 + n) % n], act = esquinas[i], sig = esquinas[(i + 1) % n];
    const d1 = dir(prev, act), d2 = dir(act, sig);
    const r1 = derechaDe(d1), r2 = derechaDe(d2);
    // Esquina desplazada a la pista derecha
    const px = act[0] + (r1.x + r2.x) * MEDIA_PISTA, pz = act[1] + (r1.z + r2.z) * MEDIA_PISTA;
    // Curva suave (Bézier) alrededor de la esquina
    const corte = 6;
    const a = { x: px - d1.x * corte, z: pz - d1.z * corte }, b = { x: px + d2.x * corte, z: pz + d2.z * corte };
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      puntos.push(new THREE.Vector2(u * u * a.x + 2 * u * t * px + t * t * b.x, u * u * a.z + 2 * u * t * pz + t * t * b.z));
    }
  }
  // Distancias acumuladas
  const dist = [0];
  for (let i = 1; i <= puntos.length; i++) {
    dist.push(dist[i - 1] + puntos[i % puntos.length].distanceTo(puntos[i - 1]));
  }
  return { puntos, dist, largo: dist[dist.length - 1] };
}

/** Posición y dirección en el camino a cierta distancia s */
function muestrear(camino, s, salida) {
  s = ((s % camino.largo) + camino.largo) % camino.largo;
  const { puntos, dist } = camino;
  let i = 0;
  // Búsqueda binaria del tramo
  let lo = 0, hi = dist.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dist[mid] <= s) { i = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const a = puntos[i], b = puntos[(i + 1) % puntos.length];
  const t = (s - dist[i]) / Math.max(dist[i + 1] - dist[i], 0.0001);
  salida.x = a.x + (b.x - a.x) * t;
  salida.z = a.y + (b.y - a.y) * t;
  const l = Math.max(a.distanceTo(b), 0.0001);
  salida.dx = (b.x - a.x) / l;
  salida.dz = (b.y - a.y) / l;
  return salida;
}

export class Trafico {
  constructor(escena, semaforo) {
    this.semaforo = semaforo;
    this.autos = [];
    let c = 0;
    for (const ruta of RUTAS) {
      const camino = construirCamino(ruta.esquinas);
      for (let i = 0; i < ruta.autos; i++) {
        const malla = crearAutoMalla(COLORES_AUTOS[c++ % COLORES_AUTOS.length]);
        escena.add(malla);
        const s = (i / ruta.autos) * camino.largo + c * 7;
        const auto = {
          malla, camino, s,
          v: 0,
          crucero: T.velocidadCrucero * (0.85 + Math.random() * 0.3),
          x: 0, z: 0, angulo: 0,
          detenido: 0,      // segundos detenido (para destrabarse)
          ignorar: 0        // segundos ignorando autos de adelante (si se trabaron)
        };
        const m = muestrear(camino, s, {});
        auto.x = m.x; auto.z = m.z; auto.angulo = Math.atan2(m.dx, m.dz);
        this.autos.push(auto);
      }
    }
    this._m = {};
    this._m2 = {};
  }

  actualizar(dt, jugador) {
    for (const a of this.autos) {
      const fx = Math.sin(a.angulo), fz = Math.cos(a.angulo);
      let objetivo = a.crucero;

      // 1) Más lento en las curvas: comparamos la dirección actual con la de más adelante
      const m2 = muestrear(a.camino, a.s + 9, this._m2);
      if (m2.dx * fx + m2.dz * fz < 0.9) objetivo = Math.min(objetivo, a.crucero * 0.55);

      // 2) ¿Hay alguien adelante? (otros autos o el jugador)
      let bloqueadoPorAuto = false;
      const revisar = (ox, oz, esJugador) => {
        const rx = ox - a.x, rz = oz - a.z;
        const adelante = rx * fx + rz * fz;
        const lado = Math.abs(rx * fz - rz * fx);
        if (adelante > 0.5 && adelante < T.distanciaSeguridad + 8 && lado < 2.2) {
          objetivo = Math.min(objetivo, Math.max(0, (adelante - T.distanciaSeguridad) * 1.2));
          if (!esJugador) bloqueadoPorAuto = true;
        }
      };
      revisar(jugador.posicion.x, jugador.posicion.z, true);
      if (a.ignorar <= 0) {
        for (const o of this.autos) if (o !== a) revisar(o.x, o.z, false);
      } else a.ignorar -= dt;

      // 3) Semáforo: si no está en verde y voy hacia su línea, me detengo
      for (const ap of this.semaforo.aproximaciones) {
        if (fx * ap.d.x + fz * ap.d.z < 0.9) continue;
        const rx = ap.linea.x - a.x, rz = ap.linea.z - a.z;
        const adelante = rx * ap.d.x + rz * ap.d.z;
        const lado = Math.abs(rx * ap.r.x + rz * ap.r.z);
        if (lado > 2.5 || adelante < 0 || adelante > 30) continue;
        const estado = this.semaforo.estado(ap.eje);
        if (estado === 'rojo' || (estado === 'amarillo' && adelante > 6)) {
          objetivo = Math.min(objetivo, Math.max(0, (adelante - 2.6) * 0.9));
        }
      }

      // 4) Acelerar o frenar suavemente hacia la velocidad objetivo
      if (a.v < objetivo) a.v = Math.min(objetivo, a.v + 2.5 * dt);
      else a.v = Math.max(objetivo, a.v - 7 * dt);

      // Si quedaron trabados entre ellos (pasa en los cruces), uno se "destraba"
      if (a.v < 0.1 && bloqueadoPorAuto) {
        a.detenido += dt;
        if (a.detenido > 5) { a.ignorar = 2.5; a.detenido = 0; }
      } else a.detenido = 0;

      // 5) Avanzar por el camino
      a.s += a.v * dt;
      const m = muestrear(a.camino, a.s, this._m);
      a.x = m.x; a.z = m.z;
      const angObj = Math.atan2(m.dx, m.dz);
      let dif = angObj - a.angulo;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      a.angulo += dif * Math.min(1, dt * 8);

      a.malla.position.set(a.x, 0, a.z);
      a.malla.rotation.y = a.angulo;
    }
  }

  /** Agrega los autos como obstáculos (dos círculos por auto) */
  agregarColisiones(lista) {
    for (const a of this.autos) {
      const fx = Math.sin(a.angulo), fz = Math.cos(a.angulo);
      lista.push({ x: a.x + fx * 1.05, z: a.z + fz * 1.05, r: 0.85, tipo: 'auto' });
      lista.push({ x: a.x - fx * 1.05, z: a.z - fz * 1.05, r: 0.85, tipo: 'auto' });
    }
  }
}
