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
      // Pegada al auto (sin retraso): se mueve con la carrocería
      auto.grupo.updateMatrixWorld(true);
      const ojo = auto.carroceria.localToWorld(this._v1.copy(OJO_INTERIOR));
      const mira = auto.carroceria.localToWorld(this._v2.copy(MIRA_INTERIOR));
      this.camara.position.copy(ojo);
      this.camara.lookAt(mira);
      this._mirarA.copy(mira);
      this._primerCuadro = false;
      return;
    }

    const adelante = this._v1.set(Math.sin(auto.angulo), 0, Math.cos(auto.angulo));
    const deseada = new THREE.Vector3();
    const mirar = this._v2;

    if (this.modo === 'tercera') {
      // Detrás y arriba del auto; se aleja un poco a mayor velocidad
      const distancia = 6.5 + auto.kmh * 0.02;
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
  }
}
