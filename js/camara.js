// ===========================================================
// ConduDrive - CÁMARA
// Por ahora: tercera persona (detrás del auto) y vista aérea.
// En el Paso 2 se agrega la vista interior con tablero y espejos.
// ===========================================================
import * as THREE from 'three';

export class ControlCamara {
  constructor(camara) {
    this.camara = camara;
    this.modos = ['tercera', 'aerea'];
    this.indice = 0;
    this._mirarA = new THREE.Vector3();
    this._primerCuadro = true;
  }

  get modo() { return this.modos[this.indice]; }

  siguiente() {
    this.indice = (this.indice + 1) % this.modos.length;
    this._primerCuadro = true; // salto inmediato al cambiar de cámara
    return this.modo;
  }

  actualizar(dt, auto) {
    const adelante = new THREE.Vector3(Math.sin(auto.angulo), 0, Math.cos(auto.angulo));
    const deseada = new THREE.Vector3();
    const mirar = new THREE.Vector3();

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
