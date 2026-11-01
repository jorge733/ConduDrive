// ===========================================================
// ConduDrive - BARRERAS DEL ESTACIONAMIENTO
// Dos "plumas" (brazos a rayas rojas y blancas) en el hueco de
// salida del estacionamiento: una para salir y otra para entrar.
// Cuando el auto se acerca, se levantan solas; cuando se aleja,
// esperan un poco y vuelven a bajar.
// Mientras están abajo (o casi), el brazo se puede chocar.
// ===========================================================
import * as THREE from 'three';
import { Lote } from './util.js';

const ALTO_BRAZO = 1.0;        // altura del brazo sobre el suelo (m)
const ABIERTA = Math.PI / 2 - 0.05; // casi vertical
const VELOCIDAD = 1.6;         // radianes por segundo (≈1 s en abrir)
const DIST_ABRIR = 9;          // a esta distancia del portón se abre
const ESPERA_CIERRE = 1.5;     // segundos antes de bajar cuando el auto se fue
const ANGULO_PASO = 0.9;       // sobre este ángulo el brazo ya no estorba

class Barrera {
  /**
   * @param x, z    posición del poste
   * @param sentido +1 si el brazo apunta hacia +X, -1 si apunta hacia -X
   * @param largo   largo del brazo
   */
  constructor(escena, x, z, sentido, largo) {
    this.x = x; this.z = z; this.sentido = sentido; this.largo = largo;
    this.angulo = 0;           // 0 = cerrada (horizontal)
    this.espera = 0;

    // Poste con caja de motor (fijo)
    const poste = new Lote();
    poste.caja(0x3d4550, 0, 0.55, 0, 0.5, 1.1, 0.5);            // gabinete
    poste.caja(0xf2c200, 0, 1.12, 0, 0.56, 0.06, 0.56);         // borde amarillo
    poste.caja(0x22272e, 0, 0.02, 0, 0.7, 0.04, 0.7);           // base
    this.poste = poste.malla();
    this.poste.position.set(x, 0.15, z);
    escena.add(this.poste);

    // Luz que cambia de color (roja cerrada / verde abierta)
    this.luz = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a })
    );
    this.luz.position.set(x, 1.38, z);
    escena.add(this.luz);

    // Brazo: gira alrededor del eje que sale del poste
    const brazo = new Lote();
    const tramos = 8;
    for (let i = 0; i < tramos; i++) {
      const t = (largo - 0.3) / tramos;
      brazo.caja(i % 2 ? 0xffffff : 0xd62828, 0.3 + t * (i + 0.5), 0, 0, t, 0.12, 0.08);
    }
    brazo.caja(0x3d4550, 0, 0, 0, 0.6, 0.22, 0.16);               // bisagra
    this.pivote = new THREE.Group();
    this.pivote.position.set(x, 0.15 + ALTO_BRAZO, z);
    this.pivote.rotation.y = sentido > 0 ? 0 : Math.PI;
    this.pivote.add(brazo.malla());
    escena.add(this.pivote);
  }

  actualizar(dt, cerca) {
    if (cerca) this.espera = ESPERA_CIERRE;
    else this.espera = Math.max(0, this.espera - dt);
    const objetivo = this.espera > 0 ? ABIERTA : 0;
    const paso = VELOCIDAD * dt;
    this.angulo += Math.max(-paso, Math.min(paso, objetivo - this.angulo));
    this.pivote.rotation.z = this.angulo;
    this.luz.material.color.setHex(this.angulo >= ABIERTA - 0.01 ? 0x2ecc40 : this.angulo > 0 ? 0xffb000 : 0xff2a2a);
  }

  /** Si el brazo está abajo, agrega un rectángulo para chocar */
  agregarColision(lista) {
    if (this.angulo > ANGULO_PASO) return;
    const extremo = this.x + this.sentido * this.largo;
    lista.push({
      minX: Math.min(this.x, extremo), maxX: Math.max(this.x, extremo),
      minZ: this.z - 0.12, maxZ: this.z + 0.12, tipo: 'barrera'
    });
  }
}

export class Barreras {
  /**
   * Portón con dos plumas entre x0 y x1, sobre la línea z.
   */
  constructor(escena, x0, x1, z) {
    this.centro = { x: (x0 + x1) / 2, z };
    const largo = (x1 - x0) / 2 + 0.25;
    this.lista = [
      new Barrera(escena, x0, z, +1, largo),   // salida (pista de la derecha al salir)
      new Barrera(escena, x1, z, -1, largo)    // entrada
    ];
  }

  actualizar(dt, auto) {
    const d = Math.hypot(auto.posicion.x - this.centro.x, auto.posicion.z - this.centro.z);
    const cerca = d < DIST_ABRIR;
    for (const b of this.lista) b.actualizar(dt, cerca);
  }

  agregarColisiones(lista) {
    for (const b of this.lista) b.agregarColision(lista);
  }
}
