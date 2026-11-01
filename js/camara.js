// ===========================================================
// ConduDrive - CÁMARAS (se cambian con la tecla C o el botón 🎥)
// 1. Tercera persona: detrás del auto, con seguimiento suave.
// 2. Interior: desde el asiento, con volante, tablero, examinador y espejos.
// 3. Aérea: desde arriba, útil para estacionar.
// ===========================================================
import * as THREE from 'three';
import { OJO_INTERIOR, MIRA_INTERIOR } from './interior.js';

const NOMBRES = { tercera: 'Cámara: detrás', interior: 'Cámara: interior', aerea: 'Cámara: aérea' };

export class ControlCamara {
  constructor(camara) {
    this.camara = camara;
    this.modos = ['tercera', 'interior', 'aerea'];
    this.indice = 0;
    this._mirarA = new THREE.Vector3();
    this._primerCuadro = true;
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this.alCambiar = null; // función que avisa el cambio de modo
    this._yaw = 0;          // la cámara de atrás sigue el giro con un leve retraso (se ven los derrapes)
    this._sacudon = 0;
    this._cabeza = new THREE.Vector3();
    this.mirarAtras = false;
  }

  /** Sacude la cámara (choques) */
  sacudir(fuerza) { this._sacudon = Math.min(0.6, this._sacudon + fuerza * 0.04); }

  _aplicarSacudon(dt) {
    if (this._sacudon <= 0.001) return;
    const s = this._sacudon;
    this.camara.position.x += (Math.random() - 0.5) * s;
    this.camara.position.y += (Math.random() - 0.5) * s * 0.6;
    this.camara.position.z += (Math.random() - 0.5) * s;
    this._sacudon *= Math.exp(-7 * dt);
  }

  get modo() { return this.modos[this.indice]; }
  get nombre() { return NOMBRES[this.modo]; }

  siguiente() {
    this.indice = (this.indice + 1) % this.modos.length;
    this._primerCuadro = true; // salto inmediato al cambiar de cámara
    // La vista interior usa un ángulo más abierto y ve objetos muy cercanos
    this.camara.fov = this.modo === 'interior' ? 74 : 60;
    this.camara.near = this.modo === 'interior' ? 0.05 : 0.1;
    this.camara.updateProjectionMatrix();
    if (this.alCambiar) this.alCambiar(this.modo);
    return this.modo;
  }

  actualizar(dt, auto) {
    if (this.modo === 'interior') {
      // Pegada al auto: se mueve con la carrocería. La cabeza se va un poco
      // hacia afuera en las curvas y hacia adelante al frenar (fuerzas G).
      const objetivo = this._v1.set(
        THREE.MathUtils.clamp(auto.aceleracionLateral * 0.006, -0.06, 0.06),
        Math.sin(performance.now() * 0.03) * Math.min(auto.kmh, 100) * 0.00002,
        THREE.MathUtils.clamp(-auto.aceleracionActual * 0.005, -0.05, 0.05)
      );
      this._cabeza.lerp(objetivo, this._primerCuadro ? 1 : 1 - Math.exp(-8 * dt));
      auto.grupo.updateMatrixWorld(true);
      const ojo = auto.carroceria.localToWorld(this._v1.copy(OJO_INTERIOR).add(this._cabeza));
      const mira = this._v2.copy(MIRA_INTERIOR);
      if (this.mirarAtras) mira.set(OJO_INTERIOR.x, 1.2, -10);
      auto.carroceria.localToWorld(mira);
      this.camara.position.copy(ojo);
      this.camara.lookAt(mira);
      this._mirarA.copy(mira);
      this._primerCuadro = false;
      this._aplicarSacudon(dt);
      return;
    }

    // El ángulo de la cámara sigue al auto con un pequeño retraso
    let dif = auto.angulo - this._yaw;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    this._yaw = this._primerCuadro ? auto.angulo : this._yaw + dif * (1 - Math.exp(-5 * dt));
    const yaw = this.mirarAtras && this.modo === 'tercera' ? this._yaw + Math.PI : this._yaw;
    const adelante = this._v1.set(Math.sin(yaw), 0, Math.cos(yaw));
    const deseada = new THREE.Vector3();
    const mirar = this._v2;

    if (this.modo === 'tercera') {
      // Detrás y arriba del auto; se aleja un poco a mayor velocidad
      const distancia = 6.5 + Math.min(auto.kmh, 120) * 0.015;
      deseada.copy(auto.posicion).addScaledVector(adelante, -distancia);
      deseada.y = 2.8;
      mirar.copy(auto.posicion).addScaledVector(adelante, 3);
      mirar.y = 1;
    } else {
      // Vista aérea: casi desde arriba (ideal para estacionar)
      deseada.copy(auto.posicion).addScaledVector(adelante, -3);
      deseada.y = 22;
      mirar.copy(auto.posicion);
    }

    // Seguimiento suave: la cámara "persigue" su posición ideal
    const suavidad = this.modo === 'tercera' ? 5 : 4;
    const t = this._primerCuadro ? 1 : 1 - Math.exp(-suavidad * dt);
    this.camara.position.lerp(deseada, t);
    this._mirarA.lerp(mirar, this._primerCuadro ? 1 : 1 - Math.exp(-10 * dt));
    this.camara.lookAt(this._mirarA);
    this._primerCuadro = false;
    this._aplicarSacudon(dt);

    // Sensación de velocidad: el ángulo de visión se abre un poco al ir rápido
    if (this.modo === 'tercera') {
      const fov = 60 + Math.min(auto.kmh, 140) * 0.07;
      if (Math.abs(this.camara.fov - fov) > 0.05) {
        this.camara.fov += (fov - this.camara.fov) * Math.min(1, dt * 3);
        this.camara.updateProjectionMatrix();
      }
    }
  }
}
