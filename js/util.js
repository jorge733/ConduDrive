// ===========================================================
// ConduDrive - HERRAMIENTAS DE APOYO
// - "Lote": junta muchas piezas (cajas, cilindros...) en UNA sola malla.
//   Así el celular dibuja cientos de casas como si fuera un solo objeto
//   (mucho más rápido).
// - texturaCanvas: dibuja letreros con texto sin usar imágenes externas.
// - aleatorio: números "al azar" pero siempre iguales (el pueblo no cambia).
// ===========================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometrías base reutilizables
export const GEO = {
  caja: new THREE.BoxGeometry(1, 1, 1),
  cilindro: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cilindro6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  esfera: new THREE.IcosahedronGeometry(0.5, 0)
};

// Techo de dos aguas: un prisma triangular (ancho 1, alto 1, fondo 1, base en y=0)
GEO.techo = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  g.scale(1, 1 / 1.5, 1 / 1.732);
  g.translate(0, 0.5 / 1.5, 0);
  return g;
})();

const _euler = new THREE.Euler();

/** Crea una matriz de posición/rotación/escala */
export function matriz(x, y, z, rotY = 0, sx = 1, sy = 1, sz = 1, rotX = 0, rotZ = 0) {
  _euler.set(rotX, rotY, rotZ, 'YXZ');
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(_euler),
    new THREE.Vector3(sx, sy, sz)
  );
}

export class Lote {
  constructor() { this.partes = []; }

  /** Agrega una geometría con un color y una transformación */
  agregar(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    // Dejamos solo posición y normales (todas las piezas deben ser iguales para unirlas)
    for (const nombre of Object.keys(g.attributes)) {
      if (nombre !== 'position' && nombre !== 'normal') g.deleteAttribute(nombre);
    }
    g.clearGroups();
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { colores[i * 3] = c.r; colores[i * 3 + 1] = c.g; colores[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    this.partes.push(g);
  }

  /** Atajo: agrega una caja (x,y,z = centro; w,h,d = ancho, alto, fondo) */
  caja(color, x, y, z, w, h, d, rotY = 0, base = null) {
    const m = matriz(x, y, z, rotY, w, h, d);
    this.agregar(GEO.caja, color, base ? base.clone().multiply(m) : m);
  }

  /** Une todo y devuelve una sola malla */
  malla({ sombra = true, recibe = true, rugosidad = 0.85 } = {}) {
    if (this.partes.length === 0) return new THREE.Group();
    const geo = mergeGeometries(this.partes, false);
    this.partes.forEach((p) => p.dispose());
    this.partes = [];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: rugosidad });
    const malla = new THREE.Mesh(geo, mat);
    malla.castShadow = sombra;
    malla.receiveShadow = recibe;
    return malla;
  }
}

/** Dibuja en un "lienzo" y lo convierte en textura */
export function texturaCanvas(ancho, alto, dibujar) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  dibujar(lienzo.getContext('2d'), ancho, alto);
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Letrero rectangular con texto (para negocios, colegio, etc.) */
export function texturaLetrero(texto, fondo = '#1d3557', colorTexto = '#ffffff', ancho = 512, alto = 128) {
  return texturaCanvas(ancho, alto, (ctx, w, h) => {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = colorTexto;
    let tam = h * 0.5;
    ctx.font = `900 ${tam}px Arial, sans-serif`;
    while (ctx.measureText(texto).width > w * 0.9 && tam > 10) {
      tam -= 2;
      ctx.font = `900 ${tam}px Arial, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, w / 2, h / 2 + 2);
  });
}

/** Generador de números al azar "con semilla" (siempre da la misma secuencia) */
export function aleatorio(semilla = 1) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vector "a la derecha" de una dirección de manejo (en el suelo) */
export const derechaDe = (d) => ({ x: -d.z, z: d.x });

/** Ángulo de rotación Y para que algo mire hacia la dirección (fx, fz) */
export const anguloHacia = (fx, fz) => Math.atan2(fx, fz);
