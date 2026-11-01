// ===========================================================
// ConduDrive - MARCAS DE NEUMÁTICOS EN EL ASFALTO
// Cuando una rueda patina, frena bloqueada o derrapa, deja una
// huella oscura. Todas las huellas son UNA sola malla "instanciada"
// (muy liviana). Cuando se llenan, las más antiguas se reutilizan.
// ===========================================================
import * as THREE from 'three';

const MAX = 1200;
const ANCHO = 0.2;

export class MarcasNeumaticos {
  constructor(escena) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x111111, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    this.malla = new THREE.InstancedMesh(geo, mat, MAX);
    this.malla.count = 0;
    this.malla.frustumCulled = false;
    this.malla.renderOrder = 1;
    escena.add(this.malla);
    this._siguiente = 0;
    this._anterior = [null, null, null, null];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._eje = new THREE.Vector3(0, 1, 0);
    this._tmp = { x: 0, z: 0 };
  }

  actualizar(auto) {
    let cambio = false;
    for (let i = 0; i < 4; i++) {
      const p = auto.posicionRueda(i, this._tmp);
      const ant = this._anterior[i];
      if (!auto.ruedasDeslizan[i]) { this._anterior[i] = null; continue; }
      if (!ant) { this._anterior[i] = { x: p.x, z: p.z }; continue; }
      const dx = p.x - ant.x, dz = p.z - ant.z;
      const largo = Math.hypot(dx, dz);
      if (largo < 0.25) continue;               // espera a recorrer un trocito
      if (largo > 3) { ant.x = p.x; ant.z = p.z; continue; } // salto raro (reinicio)
      this._p.set((p.x + ant.x) / 2, 0.03, (p.z + ant.z) / 2);
      this._q.setFromAxisAngle(this._eje, Math.atan2(dx, dz));
      this._s.set(ANCHO, 1, largo + 0.04);
      this._m.compose(this._p, this._q, this._s);
      this.malla.setMatrixAt(this._siguiente, this._m);
      this._siguiente = (this._siguiente + 1) % MAX;
      this.malla.count = Math.min(MAX, this.malla.count + 1);
      ant.x = p.x; ant.z = p.z;
      cambio = true;
    }
    if (cambio) this.malla.instanceMatrix.needsUpdate = true;
  }

  /** Corta las huellas (por ejemplo, al reiniciar la posición) */
  cortar() { this._anterior = [null, null, null, null]; }
}
