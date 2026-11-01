// ===========================================================
// ConduDrive - PERSONAJES LOW-POLY
// Peatones (de pie, caminan), el conductor y el examinador (sentados).
// ===========================================================
import * as THREE from 'three';

const PIELES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const ROPA = [0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0x6d597a, 0xffb703, 0x3a86ff, 0x8ac926];
const PELO = [0x2b1b10, 0x4a2c17, 0x111111, 0x8b5a2b, 0xd9b26f];

const mats = {};
function mat(color) {
  if (!mats[color]) mats[color] = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });
  return mats[color];
}
function caja(padre, color, w, h, d, x, y, z, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = sombra;
  padre.add(m);
  return m;
}

/** Elige colores al azar para un peatón */
export function coloresAlAzar(rand = Math.random) {
  const elegir = (lista) => lista[Math.floor(rand() * lista.length)];
  return { piel: elegir(PIELES), polera: elegir(ROPA), pantalon: elegir([0x264653, 0x1d3557, 0x3d405b, 0x5c4033]), pelo: elegir(PELO) };
}

/**
 * Peatón de pie (mide ~1,7 m). Mira hacia +Z.
 * Devuelve el grupo y las partes que se mueven al caminar.
 */
export function crearPeaton(colores, esNino = false) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  if (esNino) cuerpo.scale.setScalar(0.65);

  // Piernas (giran desde la cadera)
  const piernas = [-0.11, 0.11].map((x) => {
    const p = new THREE.Group();
    p.position.set(x, 0.88, 0);
    caja(p, colores.pantalon, 0.17, 0.82, 0.2, 0, -0.41, 0);
    caja(p, 0x222222, 0.18, 0.08, 0.28, 0, -0.84, 0.04);
    cuerpo.add(p);
    return p;
  });
  // Tronco y cabeza
  caja(cuerpo, colores.polera, 0.48, 0.6, 0.26, 0, 1.18, 0);
  caja(cuerpo, colores.piel, 0.26, 0.28, 0.26, 0, 1.64, 0);
  caja(cuerpo, colores.pelo, 0.28, 0.1, 0.28, 0, 1.8, -0.01);
  // Brazos (giran desde el hombro)
  const brazos = [-0.31, 0.31].map((x) => {
    const b = new THREE.Group();
    b.position.set(x, 1.44, 0);
    caja(b, colores.polera, 0.13, 0.32, 0.15, 0, -0.14, 0);
    caja(b, colores.piel, 0.11, 0.26, 0.12, 0, -0.43, 0);
    cuerpo.add(b);
    return b;
  });
  return { grupo: g, cuerpo, piernas, brazos };
}

/** Anima la caminata (fase = cuánto ha caminado) */
export function animarCaminata(p, fase, intensidad = 1) {
  const a = Math.sin(fase) * 0.55 * intensidad;
  p.piernas[0].rotation.x = a;
  p.piernas[1].rotation.x = -a;
  p.brazos[0].rotation.x = -a * 0.8;
  p.brazos[1].rotation.x = a * 0.8;
}

/**
 * Persona sentada (conductor o examinador), a escala del auto.
 * El origen es el punto del asiento. Mira hacia +Z.
 */
export function crearPersonaSentada(colores, tipo = 'conductor') {
  const g = new THREE.Group();
  // Muslos y piernas
  for (const x of [-0.09, 0.09]) {
    caja(g, colores.pantalon, 0.13, 0.12, 0.4, x, 0.02, 0.18);
    caja(g, colores.pantalon, 0.11, 0.38, 0.12, x, -0.17, 0.38);
  }
  // Tronco, un poquito echado hacia atrás
  const tronco = caja(g, colores.polera, 0.36, 0.42, 0.2, 0, 0.24, -0.04);
  tronco.rotation.x = -0.08;

  // Cabeza (en un "pivote" para poder girarla)
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.47, -0.05);
  caja(cabeza, colores.piel, 0.2, 0.22, 0.2, 0, 0.11, 0);
  g.add(cabeza);

  // Brazos: pivotes en los hombros
  const brazos = [-0.22, 0.22].map((x) => {
    const b = new THREE.Group();
    b.position.set(x, 0.4, -0.04);
    caja(b, colores.polera, 0.09, 0.26, 0.1, 0, -0.12, 0);
    caja(b, colores.piel, 0.08, 0.24, 0.09, 0, -0.36, 0);
    g.add(b);
    return b;
  });

  const partes = { grupo: g, cabeza, brazos, tablilla: null };

  if (tipo === 'conductor') {
    caja(cabeza, colores.pelo, 0.22, 0.08, 0.22, 0, 0.24, -0.01);
    // Brazos hacia el volante
    brazos[0].rotation.x = -1.15; brazos[0].rotation.z = 0.25;
    brazos[1].rotation.x = -1.15; brazos[1].rotation.z = -0.25;
  } else {
    // ----- EXAMINADOR: pelado, bigote, lentes, corbata y tablilla -----
    caja(cabeza, 0x8a8a8a, 0.21, 0.07, 0.17, 0, 0.17, -0.03);      // pelo gris a los lados
    caja(cabeza, 0x8a8a8a, 0.17, 0.05, 0.05, 0, 0.13, -0.1);
    caja(cabeza, 0x2b2b2b, 0.12, 0.035, 0.03, 0, 0.06, 0.105);      // bigote
    caja(cabeza, 0x111111, 0.07, 0.05, 0.02, -0.05, 0.13, 0.105);  // lentes
    caja(cabeza, 0x111111, 0.07, 0.05, 0.02, 0.05, 0.13, 0.105);
    caja(cabeza, 0x111111, 0.04, 0.012, 0.02, 0, 0.14, 0.105);
    caja(g, 0xb22222, 0.05, 0.24, 0.02, 0, 0.3, 0.07, false);       // corbata
    // Brazos hacia adelante, sosteniendo la tablilla
    brazos[0].rotation.x = -0.75; brazos[1].rotation.x = -0.75;
    // Tablilla (con hoja blanca)
    const tablilla = new THREE.Group();
    tablilla.position.set(0, 0.2, 0.3);
    tablilla.rotation.x = -0.85;
    caja(tablilla, 0x8b5a2b, 0.24, 0.32, 0.015, 0, 0, 0);
    caja(tablilla, 0xffffff, 0.2, 0.26, 0.01, 0, -0.01, 0.01, false);
    caja(tablilla, 0x999999, 0.08, 0.03, 0.02, 0, 0.15, 0.01, false); // clip
    g.add(tablilla);
    partes.tablilla = tablilla;
  }
  return partes;
}

export const COLORES_EXAMINADOR = { piel: 0xe0ac69, polera: 0xf5f5f0, pantalon: 0x3d405b, pelo: 0x8a8a8a };
export const COLORES_CONDUCTOR = { piel: 0xf1c27d, polera: 0x3a86ff, pantalon: 0x264653, pelo: 0x2b1b10 };
