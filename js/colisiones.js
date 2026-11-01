// ===========================================================
// ConduDrive - CHOQUES
// Sistema simple: el auto son 2 círculos; los obstáculos son
// rectángulos (manzanas/veredas, autos estacionados, barreras) o círculos
// (borde de la rotonda, autos que circulan, peatones).
// Si se tocan, empujamos el auto hacia afuera y le quitamos velocidad.
// ===========================================================
import { CONFIG } from './config.js';

const R = CONFIG.auto.radioChoque;

/**
 * Revisa choques del auto con el mundo.
 * Devuelve el choque más fuerte de este cuadro: { fuerza, tipo } o null.
 */
export function resolverColisiones(auto, mundo) {
  let peor = null;

  for (const p of auto.puntosChoque()) {
    // --- Rectángulos ---
    for (const c of cajas(mundo)) {
      // Punto del rectángulo más cercano al centro del círculo
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      let dx = p.x - cx, dz = p.z - cz;
      let dist = Math.hypot(dx, dz);
      if (dist >= R) continue;

      let nx, nz, empuje;
      if (dist > 0.0001) {
        nx = dx / dist; nz = dz / dist;
        empuje = R - dist;
      } else {
        // El centro quedó dentro: salimos por el lado más cercano
        const opciones = [
          [p.x - c.minX, -1, 0], [c.maxX - p.x, 1, 0],
          [p.z - c.minZ, 0, -1], [c.maxZ - p.z, 0, 1]
        ].sort((a, b) => a[0] - b[0]);
        nx = opciones[0][1]; nz = opciones[0][2];
        empuje = opciones[0][0] + R;
      }
      const f = aplicarEmpuje(auto, nx, nz, empuje, p);
      if (f !== null && (!peor || f > peor.fuerza)) peor = { fuerza: f, tipo: c.tipo };
    }

    // --- Círculos (bordes de la rotonda, autos en movimiento, peatones) ---
    for (const o of circulos(mundo)) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const dist = Math.hypot(dx, dz);
      const minimo = R + o.r;
      if (dist >= minimo || dist < 0.0001) continue;
      const f = aplicarEmpuje(auto, dx / dist, dz / dist, minimo - dist, p);
      if (f !== null && (!peor || f > peor.fuerza)) peor = { fuerza: f, tipo: o.tipo };
    }
  }
  return peor;
}

// Rectángulos fijos y los que cambian (barreras del estacionamiento)
function* cajas(mundo) {
  yield* mundo.cajas;
  if (mundo.cajasDinamicas) yield* mundo.cajasDinamicas;
}

// Recorre los obstáculos fijos y los que se mueven (autos, peatones)
function* circulos(mundo) {
  yield* mundo.circulos;
  if (mundo.dinamicos) yield* mundo.dinamicos;
}

// Saca al auto del obstáculo y ajusta la velocidad (rebote suave)
function aplicarEmpuje(auto, nx, nz, empuje, p) {
  auto.posicion.x += nx * empuje;
  auto.posicion.z += nz * empuje;
  p.x += nx * empuje;
  p.z += nz * empuje;

  const v = auto.velocidad;
  const contraPared = v.x * nx + v.y * nz; // negativo = vamos hacia el obstáculo
  if (contraPared >= 0) return null;

  // Quitamos la velocidad que va "contra la pared" y rebotamos un poquito
  const dvx = -nx * contraPared * 1.25, dvz = -nz * contraPared * 1.25;
  v.x += dvx;
  v.y += dvz;
  // Pierde también algo de velocidad al raspar (más si el golpe es fuerte)
  v.multiplyScalar(-contraPared > 4 ? 0.75 : 0.9);
  // Un golpe en la punta o en la cola hace girar el auto
  if (auto.impulsoChoque) auto.impulsoChoque(p.x - auto.posicion.x, p.z - auto.posicion.z, dvx, dvz);

  // Mantener coherente la velocidad hacia adelante del auto
  auto.velocidadAvance = v.x * Math.sin(auto.angulo) + v.y * Math.cos(auto.angulo);
  return -contraPared; // fuerza del golpe (m/s)
}
