// ===========================================================
// ConduDrive - PEATONES
// - Algunos caminan dando vueltas por las veredas de las manzanas.
// - Uno cruza el paso de cebra cada cierto rato (prueba del examen).
// ===========================================================
import * as THREE from 'three';
import { crearPeaton, animarCaminata, coloresAlAzar } from './personajes.js';
import { PUNTOS } from './ciudad.js';
import { aleatorio } from './util.js';

const rand = aleatorio(77);

// Manzanas por cuyas veredas caminan peatones (centro x, z)
const MANZANAS_PASEO = [[-50, 0], [-50, 50], [0, -50], [50, -50]]; // (las que no tocan la rotonda)

export class Peatones {
  constructor(escena) {
    this.lista = [];

    // ----- Peatones que pasean por las veredas -----
    for (const [bx, bz] of MANZANAS_PASEO) {
      for (let k = 0; k < 2; k++) {
        const e = 18.9; // a 1,1 m del borde de la manzana
        const esquinas = [[bx - e, bz - e], [bx + e, bz - e], [bx + e, bz + e], [bx - e, bz + e]];
        if (k === 1) esquinas.reverse();
        const p = crearPeaton(coloresAlAzar(rand));
        escena.add(p.grupo);
        this.lista.push({
          tipo: 'paseo', p, esquinas,
          tramo: Math.floor(rand() * 4), t: rand(),
          velocidad: 1.1 + rand() * 0.5, fase: rand() * 6
        });
      }
    }

    // ----- Peatón del paso de cebra -----
    const c = PUNTOS.cebra;
    const p = crearPeaton({ piel: 0xe0ac69, polera: 0xff006e, pantalon: 0x1d3557, pelo: 0x111111 });
    escena.add(p.grupo);
    this.cebra = {
      tipo: 'cebra', p,
      ladoA: new THREE.Vector3(c.x, 0.15, c.z + 6.2),   // vereda de la plaza
      ladoB: new THREE.Vector3(c.x, 0.15, c.z - 6.2),   // vereda del almacén
      enA: true,
      estado: 'esperando',
      espera: 4 + rand() * 4,
      progreso: 0,
      velocidad: 1.3,
      fase: 0,
      caido: 0
    };
    p.grupo.position.copy(this.cebra.ladoA);
    this.lista.push(this.cebra);
  }

  /** ¿Hay alguien cruzando (o por cruzar) el paso de cebra? (para el Paso 3) */
  get cebraOcupada() { return this.cebra.estado === 'cruzando'; }

  actualizar(dt) {
    for (const q of this.lista) {
      if (q.tipo === 'paseo') this._pasear(q, dt);
      else this._cruzar(q, dt);
    }
  }

  _pasear(q, dt) {
    const a = q.esquinas[q.tramo], b = q.esquinas[(q.tramo + 1) % 4];
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
    q.t += (q.velocidad * dt) / largo;
    if (q.t >= 1) { q.t = 0; q.tramo = (q.tramo + 1) % 4; }
    const x = a[0] + (b[0] - a[0]) * q.t, z = a[1] + (b[1] - a[1]) * q.t;
    q.p.grupo.position.set(x, 0.15, z);
    q.p.grupo.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    q.fase += dt * q.velocidad * 5;
    animarCaminata(q.p, q.fase);
  }

  _cruzar(q, dt) {
    const g = q.p.grupo;
    // Si lo atropellaron: queda en el suelo un rato y se levanta
    if (q.caido > 0) {
      q.caido -= dt;
      g.rotation.x = Math.min(Math.PI / 2, g.rotation.x + dt * 6);
      if (q.caido <= 0) g.rotation.x = 0;
      return;
    }
    if (q.estado === 'esperando') {
      q.espera -= dt;
      animarCaminata(q.p, 0, 0);
      if (q.espera <= 0) { q.estado = 'cruzando'; q.progreso = 0; }
    } else {
      const desde = q.enA ? q.ladoA : q.ladoB, hasta = q.enA ? q.ladoB : q.ladoA;
      q.progreso += (q.velocidad * dt) / desde.distanceTo(hasta);
      g.position.lerpVectors(desde, hasta, Math.min(q.progreso, 1));
      // Al bajar a la calle, queda a nivel del asfalto
      const enCalle = Math.abs(g.position.z - PUNTOS.cebra.z) < 5;
      g.position.y = enCalle ? 0 : 0.15;
      g.rotation.y = Math.atan2(hasta.x - desde.x, hasta.z - desde.z);
      q.fase += dt * 7;
      animarCaminata(q.p, q.fase);
      if (q.progreso >= 1) {
        q.enA = !q.enA;
        q.estado = 'esperando';
        q.espera = 8 + rand() * 10;
      }
    }
  }

  /** Lo llama el juego cuando el auto golpea al peatón */
  atropellar() {
    if (this.cebra.caido <= 0) this.cebra.caido = 3;
  }

  /** Agrega al peatón de la cebra como obstáculo (solo cuando está en la calle) */
  agregarColisiones(lista) {
    const g = this.cebra.p.grupo;
    if (Math.abs(g.position.z - PUNTOS.cebra.z) < 5.2 && this.cebra.caido <= 0) {
      lista.push({ x: g.position.x, z: g.position.z, r: 0.35, tipo: 'peaton' });
    }
  }
}
