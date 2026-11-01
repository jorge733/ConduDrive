// ===========================================================
// ConduDrive - LLUVIA
// Miles de gotas (líneas cortas) que caen alrededor de la cámara.
// Además cambia el cielo, la niebla, la luz y hace brillar el asfalto.
// El auto pierde agarre (eso lo maneja auto.lluvia).
// ===========================================================
import * as THREE from 'three';

const N = 2200;
const CAJA = { x: 50, y: 26, z: 50 };

export class Lluvia {
  constructor(escena, luces) {
    this.escena = escena;
    this.luces = luces;
    this.activa = false;
    const pos = new Float32Array(N * 6);
    this.gotas = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.gotas[i * 3] = (Math.random() - 0.5) * CAJA.x;
      this.gotas[i * 3 + 1] = Math.random() * CAJA.y;
      this.gotas[i * 3 + 2] = (Math.random() - 0.5) * CAJA.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lineas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.45 }));
    this.lineas.frustumCulled = false;
    this.lineas.visible = false;
    escena.add(this.lineas);

    // Guardamos el clima despejado para volver a él
    this._original = {
      fondo: escena.background.clone(),
      nieblaCerca: escena.fog.near, nieblaLejos: escena.fog.far,
      cielo: luces.cielo.intensity, sol: luces.sol.intensity
    };
    this.piso = escena.getObjectByName('piso');
    this._rugosidad = this.piso ? this.piso.material.roughness : 0.95;
  }

  poner(activa) {
    this.activa = activa;
    this.lineas.visible = activa;
    const e = this.escena, o = this._original;
    const gris = new THREE.Color(0x6f7d88);
    e.background.copy(activa ? gris : o.fondo);
    e.fog.color.copy(e.background);
    e.fog.near = activa ? 25 : o.nieblaCerca;
    e.fog.far = activa ? 170 : o.nieblaLejos;
    this.luces.cielo.intensity = activa ? o.cielo * 0.7 : o.cielo;
    this.luces.sol.intensity = activa ? o.sol * 0.25 : o.sol;
    if (this.piso) {
      this.piso.material.roughness = activa ? 0.35 : this._rugosidad;
      this.piso.material.metalness = activa ? 0.25 : 0;
      this.piso.material.color.setHex(activa ? 0x3a3e45 : 0x4a4f57);
    }
  }

  actualizar(dt, camara, vientoX = 0, vientoZ = 0) {
    if (!this.activa) return;
    const pos = this.lineas.geometry.attributes.position.array;
    const g = this.gotas, c = camara.position;
    const caida = 22 * dt;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      g[k + 1] -= caida;
      // Las gotas "se mueven" respecto al auto que avanza
      g[k] -= vientoX * dt; g[k + 2] -= vientoZ * dt;
      if (g[k + 1] < 0) g[k + 1] += CAJA.y;
      if (g[k] < -CAJA.x / 2) g[k] += CAJA.x; else if (g[k] > CAJA.x / 2) g[k] -= CAJA.x;
      if (g[k + 2] < -CAJA.z / 2) g[k + 2] += CAJA.z; else if (g[k + 2] > CAJA.z / 2) g[k + 2] -= CAJA.z;
      const x = c.x + g[k], y = g[k + 1] - 3, z = c.z + g[k + 2];
      const j = i * 6;
      pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      pos[j + 3] = x + vientoX * 0.02; pos[j + 4] = y + 0.45; pos[j + 5] = z + vientoZ * 0.02;
    }
    this.lineas.geometry.attributes.position.needsUpdate = true;
  }
}
