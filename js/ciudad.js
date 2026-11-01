// ===========================================================
// ConduDrive - EL PUEBLO ("Villa ConduDrive")
//
// Plano (vista desde arriba, +Z hacia arriba, +X hacia la izquierda
// visto desde el auto al inicio):
//
//   Calles en X = -75, -25, 25, 75  y  en Z = -75, -25, 25, 75
//   Manzanas de 40 x 40 m centradas en -50, 0, 50
//
//   (-50, 50) casas     ( 0, 50) COLEGIO      (50, 50) casas
//   (-50,  0) casas     ( 0,  0) PLAZA        (50,  0) casas
//   (-50,-50) ESTACION. ( 0,-50) casas        (50,-50) casas
//
//   Semáforo en el cruce (-25,-25) · Paso de cebra en (0,-25)
//   PARE en (25,-25) · CEDA EL PASO en (75,-25) · Rotonda en (25,25)
//   Zona escolar en la calle Z=25 frente al colegio
//   Estacionamiento en paralelo en la calle X=-25, junto a la plaza
//   Barreras automáticas en la salida del estacionamiento
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Lote, GEO, matriz, texturaLetrero, aleatorio, anguloHacia, derechaDe } from './util.js';
import { crearSenal, Semaforo } from './senales.js';
import { agregarAutoALote, COLORES_AUTOS } from './vehiculos.js';
import { Barreras } from './barreras.js';

const { tamanoManzana: M, anchoCalle: A, anchoVereda: V, radioRotonda: RR, radioIsla: RI } = CONFIG.ciudad;
const MEDIA = M / 2;

export const CALLES = [-75, -25, 25, 75];
export const MANZANAS = [-50, 0, 50];
export const ROTONDA = { x: 25, z: 25, radio: RR, isla: RI };

// Lugares importantes (se usarán en el Paso 3 para el examen)
export const PUNTOS = {
  inicio: { x: -50, z: -65, angulo: 0 },
  salidaEstacionamiento: { x: -50, z: -30 },
  semaforo: { x: -25, z: -25 },
  cebra: { x: 0, z: -25 },
  pare: { x: 25, z: -25 },
  ceda: { x: 75, z: -25 },
  rotonda: { x: ROTONDA.x, z: ROTONDA.z },
  zonaEscolar: { desdeX: 6, hastaX: -16, z: 25 },
  paralelo: { x: -21, z: 0 }   // espacio entre dos autos, pegado a la vereda
};

const COL = {
  vereda: 0xcfc8b8, solera: 0xb8b0a0, pasto: 0x7cb85a, asfalto: 0x4a4f57, asfaltoClaro: 0x5d636b,
  linea: 0xf2f2f2, lineaAmarilla: 0xf2c200, techo: [0x9b3d2e, 0x6b4f3a, 0x3d5a80, 0x8d3b2f, 0x5b5b5b],
  casas: [0xf4a261, 0xe9c46a, 0x2a9d8f, 0xe76f51, 0x8ecae6, 0xffb4a2, 0xb5e48c, 0xcdb4db, 0xff6b6b, 0x4cc9f0, 0xffd166, 0x06d6a0]
};

export function crearCiudad(escena) {
  const mundo = { cajas: [], cajasDinamicas: [], circulos: [], dinamicos: [] };
  const solidos = new Lote();  // cosas que dan sombra (casas, postes, autos estacionados)
  const suelo = new Lote();    // veredas, pasto, líneas (solo reciben sombra)
  const lejos = new Lote();    // cordillera (sin sombras)
  const arboles = [];          // [x, z, escala]
  const faroles = [];          // [x, z, rotación]
  const rand = aleatorio(2024);
  let barreras = null;

  // ---------- Suelo de asfalto ----------
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: COL.asfalto, roughness: 0.95 })
  );
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  escena.add(piso);

  // ---------- Ayudantes ----------
  const veredaRect = (r, tipo = 'vereda') => {
    suelo.caja(COL.vereda, (r.x0 + r.x1) / 2, 0.075, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.15, r.z1 - r.z0);
    mundo.cajas.push({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, tipo });
  };
  const pastoRect = (r, color = COL.pasto) =>
    suelo.caja(color, (r.x0 + r.x1) / 2, 0.17, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.04, r.z1 - r.z0);
  const distRotonda = (x, z) => Math.hypot(x - ROTONDA.x, z - ROTONDA.z);

  // Divide un rectángulo en dos, quitándole una esquina cuadrada de lado s
  const sinEsquina = (r, kx, kz, s) => {
    const sx = kx === r.x0 ? 1 : -1, sz = kz === r.z0 ? 1 : -1;
    const r1 = sx === 1 ? { x0: r.x0 + s, x1: r.x1, z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1 - s, z0: r.z0, z1: r.z1 };
    const r2 = {
      x0: sx === 1 ? r.x0 : r.x1 - s, x1: sx === 1 ? r.x0 + s : r.x1,
      z0: sz === 1 ? r.z0 + s : r.z0, z1: sz === 1 ? r.z1 : r.z1 - s
    };
    return [r1, r2];
  };

  /** Manzana: vereda + pasto. Si toca la rotonda, se le recorta la esquina. */
  const crearManzana = (bx, bz, ancho = M, largo = M, colorPasto = COL.pasto) => {
    const r = { x0: bx - ancho / 2, x1: bx + ancho / 2, z0: bz - largo / 2, z1: bz + largo / 2 };
    const interior = { x0: r.x0 + V, x1: r.x1 - V, z0: r.z0 + V, z1: r.z1 - V };
    // ¿Alguna esquina queda dentro de la rotonda?
    const kx = ROTONDA.x > bx ? r.x1 : r.x0, kz = ROTONDA.z > bz ? r.z1 : r.z0;
    if (ancho === M && distRotonda(kx, kz) < RR) {
      const s = RR - A / 2; // 9 m
      sinEsquina(r, kx, kz, s).forEach((p) => veredaRect(p));
      const ikx = kx === r.x0 ? interior.x0 : interior.x1, ikz = kz === r.z0 ? interior.z0 : interior.z1;
      sinEsquina(interior, ikx, ikz, s).forEach((p) => pastoRect(p, colorPasto));
      rellenoRotonda(Math.sign(kx - ROTONDA.x), Math.sign(kz - ROTONDA.z));
      return { recortada: true };
    }
    veredaRect(r);
    pastoRect(interior, colorPasto);
    return { recortada: false };
  };

  /** Vereda curva que rodea la rotonda en una esquina (cuadrante qx, qz) */
  const rellenoRotonda = (qx, qz) => {
    const borde = A / 2, s = RR; // de 5 a 14 m desde el centro
    const a1 = Math.asin(borde / RR), a2 = Math.PI / 2 - a1;
    const pts = [[Math.cos(a1) * RR, borde], [s, borde], [s, s], [borde, s], [borde, Math.cos(a1) * RR]];
    for (let i = 1; i < 12; i++) {
      const a = a2 - (i / 12) * (a2 - a1);
      pts.push([Math.cos(a) * RR, Math.sin(a) * RR]);
    }
    const forma = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u * qx, -v * qz)));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.15, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    suelo.agregar(geo, COL.vereda, matriz(ROTONDA.x, 0, ROTONDA.z));
    // Choques: una fila de círculos a lo largo de la curva
    const pasos = 10;
    for (let i = 0; i <= pasos; i++) {
      const a = a1 + (i / pasos) * (a2 - a1);
      mundo.circulos.push({
        x: ROTONDA.x + Math.cos(a) * (RR + 1) * qx,
        z: ROTONDA.z + Math.sin(a) * (RR + 1) * qz,
        r: 1, tipo: 'vereda'
      });
    }
  };

  /** Casa de colores. (x,z) = centro; mira hacia la dirección (nx, nz) */
  const crearCasa = (x, z, nx, nz, w, d, pisos, color, letrero) => {
    const rot = anguloHacia(nx, nz);
    const base = matriz(x, 0.15, z, rot);
    const h = 2.8 + (pisos - 1) * 2.4;
    solidos.caja(color, 0, h / 2, 0, w, h, d, 0, base);
    solidos.agregar(GEO.techo, COL.techo[Math.floor(rand() * COL.techo.length)], base.clone().multiply(matriz(0, h, 0, 0, w + 0.4, 1.5, d + 0.6)));
    // Puerta y ventanas en la fachada (+Z local)
    const fz = d / 2;
    const puertaX = w * 0.25;
    solidos.caja(0x6b3e26, puertaX, 1.0, fz + 0.03, 0.95, 1.9, 0.06, 0, base);
    const ventana = (vx, vy) => {
      solidos.caja(0xffffff, vx, vy, fz + 0.03, 1.15, 1.0, 0.05, 0, base);
      solidos.caja(0x2f4858, vx, vy, fz + 0.05, 0.95, 0.8, 0.05, 0, base);
    };
    ventana(-w * 0.25, 1.5);
    for (let p = 1; p < pisos; p++) { ventana(-w * 0.25, 1.5 + p * 2.4); ventana(w * 0.25, 1.5 + p * 2.4); }
    if (rand() < 0.3) solidos.caja(0x8d6e63, w * 0.3, h + 1.1, -d * 0.15, 0.5, 1.2, 0.5, 0, base); // chimenea

    if (letrero) {
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, 0.7), new THREE.MeshStandardMaterial({ map: texturaLetrero(letrero.texto, letrero.fondo), roughness: 0.7 }));
      placa.position.copy(new THREE.Vector3(0, 2.45, fz + 0.09).applyMatrix4(base));
      placa.rotation.y = rot;
      escena.add(placa);
    }
  };

  /** Llena una manzana con casas en sus cuatro lados */
  const casasEnManzana = (bx, bz, tiendas = {}) => {
    const lados = { norte: [0, 1], sur: [0, -1], este: [1, 0], oeste: [-1, 0] };
    for (const [nombre, [nx, nz]] of Object.entries(lados)) {
      const tx = nz, tz = -nx;
      [-7.5, 0, 7.5].forEach((a, i) => {
        const w = 5.6 + rand() * 1.0, d = 6 + rand();
        const prof = V + 0.6 + d / 2;
        const x = bx + nx * (MEDIA - prof) + tx * a;
        const z = bz + nz * (MEDIA - prof) + tz * a;
        if (distRotonda(x, z) < RR + 9) return;
        const pisos = rand() < 0.35 ? 2 : 1;
        const color = COL.casas[Math.floor(rand() * COL.casas.length)];
        const letrero = tiendas[nombre] && i === 1 ? tiendas[nombre] : null;
        crearCasa(x, z, nx, nz, w, d, letrero ? 1 : pisos, color, letrero);
      });
      // Faroles en la vereda
      for (const a of [-12, 12]) {
        const x = bx + nx * (MEDIA - 0.6) + tx * a, z = bz + nz * (MEDIA - 0.6) + tz * a;
        if (distRotonda(x, z) > RR + 3) faroles.push([x, z, anguloHacia(nx, nz)]);
      }
    }
    // Árboles en el patio interior
    for (let i = 0; i < 4; i++) {
      const x = bx + (rand() - 0.5) * 14, z = bz + (rand() - 0.5) * 14;
      if (distRotonda(x, z) > RR + 6) arboles.push([x, z, 0.8 + rand() * 0.5]);
    }
  };

  const autoEstacionado = (x, z, rot, color) => {
    agregarAutoALote(solidos, color ?? COLORES_AUTOS[Math.floor(rand() * COLORES_AUTOS.length)], matriz(x, 0, z, rot));
    const girado = Math.abs(Math.sin(rot)) > 0.5;
    const mx = girado ? 1.9 : 0.85, mz = girado ? 0.85 : 1.9;
    mundo.cajas.push({ minX: x - mx, maxX: x + mx, minZ: z - mz, maxZ: z + mz, tipo: 'auto' });
  };

  // Línea de detención (blanca, continua) antes de un cruce
  const lineaDetencion = (cx, cz, d, dist = 6.2) => {
    const r = derechaDe(d);
    suelo.caja(COL.linea, cx - d.x * dist + r.x * 2.5, 0.012, cz - d.z * dist + r.z * 2.5,
      d.x !== 0 ? 0.45 : 4.8, 0.02, d.x !== 0 ? 4.8 : 0.45);
  };
  // Línea de "ceda el paso" (segmentada)
  const lineaCeda = (cx, cz, d, dist) => {
    const r = derechaDe(d);
    for (let k = 0; k < 4; k++) {
      const o = 0.6 + k * 1.2;
      suelo.caja(COL.linea, cx - d.x * dist + r.x * o, 0.012, cz - d.z * dist + r.z * o,
        d.x !== 0 ? 0.35 : 0.7, 0.02, d.x !== 0 ? 0.7 : 0.35);
    }
  };

  // ===========================================================
  // MANZANAS
  // ===========================================================
  // Casas (con algunos negocios con letrero)
  crearManzana(0, -50);  casasEnManzana(0, -50, { norte: { texto: 'ALMACÉN DON PEPE', fondo: '#c1121f' } });
  crearManzana(50, -50); casasEnManzana(50, -50, { norte: { texto: 'PELUQUERÍA LA CHASCONA', fondo: '#7b2cbf' } });
  crearManzana(-50, 0);  casasEnManzana(-50, 0, { este: { texto: 'FERRETERÍA EL CLAVO', fondo: '#e85d04' } });
  crearManzana(50, 0);   casasEnManzana(50, 0);
  crearManzana(-50, 50); casasEnManzana(-50, 50, { este: { texto: 'COMPLETOS EL GUATÓN', fondo: '#2b9348' } });
  crearManzana(50, 50);  casasEnManzana(50, 50);

  // ----- PLAZA (0, 0) -----
  crearManzana(0, 0, M, M, 0x6fb24e);
  suelo.caja(0xdccfa8, 0, 0.2, 0, 2.6, 0.03, M - V * 2);
  suelo.caja(0xdccfa8, 0, 0.2, 0, M - V * 2, 0.03, 2.6);
  solidos.agregar(GEO.cilindro, 0xbfb8a5, matriz(0, 0.4, 0, 0, 5.4, 0.5, 5.4));        // pileta
  solidos.agregar(GEO.cilindro, 0x6ec6ff, matriz(0, 0.42, 0, 0, 4.7, 0.5, 4.7));
  solidos.agregar(GEO.cilindro, 0xbfb8a5, matriz(0, 1.0, 0, 0, 0.5, 1.4, 0.5));
  solidos.agregar(GEO.cilindro, 0xbfb8a5, matriz(0, 1.75, 0, 0, 1.8, 0.2, 1.8));
  for (const [x, z, r] of [[5.5, 2, 0], [-5.5, -2, 0], [2, -5.5, Math.PI / 2], [-2, 5.5, Math.PI / 2]]) {
    solidos.caja(0x8b5a2b, x, 0.6, z, 1.8, 0.12, 0.5, r);   // escaño
    solidos.caja(0x8b5a2b, x - Math.cos(r) * 0 + Math.sin(r) * 0.25, 0.85, z + Math.cos(r) * 0.25, 1.8, 0.4, 0.08, r);
    solidos.caja(0x333333, x, 0.37, z, 1.6, 0.35, 0.3, r);
  }
  for (const [x, z] of [[8, 8], [-8, 8], [8, -8], [-8, -8], [14, -5], [-14, 5], [-14, -6], [5, -14], [-5, 14], [-6, -14], [14, 5]]) {
    arboles.push([x, z, 1 + rand() * 0.3]);
  }
  for (const [x, z, nx, nz] of [[-12, 19.4, 0, 1], [12, -19.4, 0, -1], [-12, -19.4, 0, -1], [-19.4, 12, -1, 0], [-19.4, -12, -1, 0], [19.4, -12, 1, 0]]) {
    faroles.push([x, z, anguloHacia(nx, nz)]);
  }

  // ----- COLEGIO (0, 50) -----
  crearManzana(0, 50);
  {
    const fx = -1, fz = 61, w = 30, d = 10, h = 7;
    solidos.caja(0xf3e3c3, fx, h / 2 + 0.15, fz, w, h, d);
    solidos.caja(0xc1121f, fx, h + 0.25, fz, w + 0.4, 0.4, d + 0.4);         // borde del techo
    solidos.caja(0xc1121f, fx, 3.6, fz - d / 2 - 0.02, w, 0.25, 0.05);       // franja
    for (let i = -6; i <= 6; i++) {
      for (const y of [1.9, 5.1]) {
        if (y < 3 && Math.abs(i) < 1) continue; // espacio para la puerta
        solidos.caja(0x2f4858, fx + i * 2.2, y, fz - d / 2 - 0.04, 1.3, 1.2, 0.06);
      }
    }
    solidos.caja(0x264653, fx, 1.25, fz - d / 2 - 0.04, 2.4, 2.2, 0.08);     // puerta
    const letrero = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.3), new THREE.MeshStandardMaterial({ map: texturaLetrero('ESCUELA BÁSICA LOS COPIHUES', '#003049'), roughness: 0.7 }));
    letrero.position.set(fx, 4.3, fz - d / 2 - 0.1);
    letrero.rotation.y = Math.PI;
    escena.add(letrero);
    // Patio con cancha y arcos
    suelo.caja(0xd0d0d0, -4, 0.2, 43, 27, 0.03, 19);
    const linea = (x, z, lw, ld) => suelo.caja(0xffffff, x, 0.225, z, lw, 0.02, ld);
    linea(-4, 38, 18, 0.15); linea(-4, 48, 18, 0.15); linea(-13, 43, 0.15, 10); linea(5, 43, 0.15, 10); linea(-4, 43, 0.15, 10);
    for (const gx of [-13, 5]) {
      solidos.caja(0xffffff, gx, 1.1, 41.8, 0.12, 1.8, 0.12);
      solidos.caja(0xffffff, gx, 1.1, 44.2, 0.12, 1.8, 0.12);
      solidos.caja(0xffffff, gx, 2.0, 43, 0.12, 0.12, 2.5);
    }
    // Reja del colegio (con portón)
    for (const [x0, x1] of [[-17.5, -6], [-2, 9.5]]) {
      solidos.caja(0x2a9d8f, (x0 + x1) / 2, 0.95, 32.7, x1 - x0, 0.1, 0.08);
      solidos.caja(0x2a9d8f, (x0 + x1) / 2, 0.45, 32.7, x1 - x0, 0.1, 0.08);
      for (let x = x0; x <= x1 + 0.01; x += 1.5) solidos.caja(0x2a9d8f, x, 0.6, 32.7, 0.08, 1.0, 0.08);
    }
    // Bandera de Chile
    const bx = -15, bz = 35, top = 6.5;
    solidos.agregar(GEO.cilindro6, 0xdddddd, matriz(bx, top / 2, bz, 0, 0.1, top, 0.1));
    solidos.caja(0xd52b1e, bx + 0.8, top - 0.75, bz, 1.5, 0.5, 0.04);
    solidos.caja(0xffffff, bx + 1.05, top - 0.25, bz, 1.0, 0.5, 0.04);
    solidos.caja(0x0039a6, bx + 0.3, top - 0.25, bz, 0.5, 0.5, 0.04);
    solidos.caja(0xffffff, bx + 0.3, top - 0.25, bz, 0.14, 0.14, 0.06);
    for (const [x, z] of [[14, 50], [14, 62], [-17, 50]]) arboles.push([x, z, 1.1]);
    for (const a of [-12, 0]) faroles.push([a, 30.6, Math.PI]);
  }

  // ----- ESTACIONAMIENTO (-50, -50): punto de partida -----
  {
    const x0 = -70, x1 = -30, z0 = -70, z1 = -30;
    veredaRect({ x0, x1, z0, z1: z0 + V });                 // sur
    veredaRect({ x0, x1: x0 + V, z0, z1 });                 // oeste
    veredaRect({ x0: x1 - V, x1, z0, z1 });                 // este
    veredaRect({ x0, x1: -55, z0: z1 - V, z1 });            // norte (con hueco para salir)
    veredaRect({ x0: -45, x1, z0: z1 - V, z1 });
    suelo.caja(COL.asfaltoClaro, -50, 0.006, -50, M - V * 2, 0.01, M - V * 2);
    // Estacionamientos pintados
    for (let k = -5; k <= 5; k++) {
      const lx = -50 + k * 3.2 + 1.6;
      if (lx > -67.8 && lx < -32.2) suelo.caja(COL.linea, lx, 0.015, -65.05, 0.12, 0.01, 5.5);
      if (lx > -67.8 && lx < -32.2 && Math.abs(lx + 50) > 5) suelo.caja(COL.linea, lx, 0.015, -34.95, 0.12, 0.01, 5.5);
    }
    // Autos estacionados (el espacio k=0 es el del jugador)
    for (const k of [-5, -3, -2, -1, 1, 2, 4]) autoEstacionado(-50 + k * 3.2, -65, 0);
    for (const k of [-5, -4, -2, 2, 3, 5]) {
      const x = -50 + k * 3.2;
      if (x < -33) autoEstacionado(x, -35, Math.PI);
    }
    crearSenal(escena, solidos, ['estacionamiento'], -58, -31, 0, 1);
    // Barreras automáticas en el hueco de salida (se abren al acercarse el auto)
    barreras = new Barreras(escena, -55.4, -44.6, -31.3);
  }

  // ----- Bordes exteriores del pueblo -----
  const total = 3 * M + 4 * A, fin = total / 2, borde = 220;
  crearManzana(0, fin + borde / 2, total + borde * 2, borde);
  crearManzana(0, -fin - borde / 2, total + borde * 2, borde);
  crearManzana(fin + borde / 2, 0, borde, total);
  crearManzana(-fin - borde / 2, 0, borde, total);
  for (let i = 0; i < 70; i++) {
    const ang = rand() * Math.PI * 2, dist = 90 + rand() * 60;
    arboles.push([Math.cos(ang) * dist, Math.sin(ang) * dist, 1 + rand() * 0.8]);
  }

  // ===========================================================
  // ROTONDA (25, 25)
  // ===========================================================
  solidos.agregar(new THREE.CylinderGeometry(RI, RI, 0.25, 20), COL.vereda, matriz(ROTONDA.x, 0.125, ROTONDA.z));
  suelo.agregar(new THREE.CylinderGeometry(RI - 0.4, RI - 0.4, 0.05, 20), COL.pasto, matriz(ROTONDA.x, 0.26, ROTONDA.z));
  mundo.circulos.push({ x: ROTONDA.x, z: ROTONDA.z, r: RI, tipo: 'vereda' });
  // Copihue gigante (la flor nacional) en el centro
  solidos.agregar(GEO.cilindro6, 0x2d6a4f, matriz(ROTONDA.x, 1.4, ROTONDA.z, 0, 0.2, 2.4, 0.2));
  solidos.agregar(new THREE.ConeGeometry(0.8, 1.4, 6, 1, true), 0xd00000, matriz(ROTONDA.x + 0.3, 2.2, ROTONDA.z, 0, 1, 1, 1, 0, 0.5));
  solidos.agregar(new THREE.ConeGeometry(0.7, 1.2, 6, 1, true), 0xe5383b, matriz(ROTONDA.x - 0.4, 1.9, ROTONDA.z + 0.3, 0, 1, 1, 1, 0.4, -0.5));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    solidos.agregar(GEO.esfera, 0x40916c, matriz(ROTONDA.x + Math.cos(a) * 3.3, 0.6, ROTONDA.z + Math.sin(a) * 3.3, 0, 1.3, 0.9, 1.3));
  }

  // ===========================================================
  // LÍNEAS PINTADAS EN LAS CALLES
  // ===========================================================
  for (const c of CALLES) {
    for (let i = 0; i < CALLES.length - 1; i++) {
      const desde = CALLES[i] + A / 2 + 1.5, hasta = CALLES[i + 1] - A / 2 - 1.5;
      for (let t = desde; t < hasta - 2; t += 6) {
        const m = t + 1.5;
        // Calle a lo largo de Z (vertical)
        if (distRotonda(c, m) > RR + 3) suelo.caja(COL.linea, c, 0.01, m, 0.15, 0.02, 3);
        // Calle a lo largo de X (horizontal); se salta el paso de cebra
        if (distRotonda(m, c) > RR + 3 && !(c === PUNTOS.cebra.z && Math.abs(m - PUNTOS.cebra.x) < 4)) {
          suelo.caja(COL.linea, m, 0.01, c, 3, 0.02, 0.15);
        }
      }
    }
  }

  // ----- Paso de cebra -----
  for (let i = 0; i < 9; i++) {
    suelo.caja(COL.linea, PUNTOS.cebra.x, 0.012, -29.3 + i * 1.1, 4, 0.02, 0.55);
  }
  crearSenal(escena, solidos, ['peatones'], -3.2, -18.7, -1, 0);
  crearSenal(escena, solidos, ['peatones'], 3.2, -31.3, 1, 0);

  // ----- Semáforo -----
  const semaforo = new Semaforo(escena, solidos, suelo, PUNTOS.semaforo.x, PUNTOS.semaforo.z);

  // ----- Disco PARE (cruce 25,-25) -----
  for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }]) {
    const r = derechaDe(d), c = PUNTOS.pare;
    crearSenal(escena, solidos, ['pare'], c.x - d.x * 6.4 + r.x * 6.4, c.z - d.z * 6.4 + r.z * 6.4, -d.x, -d.z);
    lineaDetencion(c.x, c.z, d);
  }

  // ----- CEDA EL PASO (cruce 75,-25) -----
  {
    const d = { x: 1, z: 0 }, r = derechaDe(d), c = PUNTOS.ceda;
    crearSenal(escena, solidos, ['ceda'], c.x - d.x * 6.4 + r.x * 6.4, c.z - d.z * 6.4 + r.z * 6.4, -1, 0);
    lineaCeda(c.x, c.z, d, 6.2);
  }

  // ----- Señales de CEDA EL PASO en cada entrada de la rotonda -----
  for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
    const r = derechaDe(d);
    crearSenal(escena, solidos, ['ceda'], ROTONDA.x - d.x * 15.5 + r.x * 6.3, ROTONDA.z - d.z * 15.5 + r.z * 6.3, -d.x, -d.z);
    lineaCeda(ROTONDA.x, ROTONDA.z, d, RR + 0.6);
  }

  // ----- Zona escolar (calle Z=25, frente al colegio) -----
  crearSenal(escena, solidos, ['escolar', 'vel30'], 6, 18.7, 1, 0);       // viniendo de la rotonda
  crearSenal(escena, solidos, ['finEscolar'], -16, 18.7, 1, 0);
  crearSenal(escena, solidos, ['escolar', 'vel30'], -16, 31.3, -1, 0);    // viniendo del otro lado
  crearSenal(escena, solidos, ['finEscolar'], 5, 31.3, -1, 0);

  // ----- Autos estacionados en la calle -----
  // Los dos del estacionamiento en paralelo (calle X=-25, pista hacia el sur)
  autoEstacionado(-20.95, 5.4, Math.PI, 0x9b59b6);
  autoEstacionado(-20.95, -5.4, Math.PI, 0xf1c40f);
  autoEstacionado(-20.95, 13.5, Math.PI);
  autoEstacionado(50, -29.05, -Math.PI / 2);
  autoEstacionado(-10, -29.05, -Math.PI / 2);
  autoEstacionado(55, 29.05, Math.PI / 2);

  // ===========================================================
  // ÁRBOLES y FAROLES (dibujados con "instancias": muy rápido)
  // ===========================================================
  {
    const lote = new Lote();
    lote.agregar(GEO.cilindro6, 0x7a5230, matriz(0, 1, 0, 0, 0.45, 2, 0.45));
    lote.agregar(GEO.esfera, 0x3f8f4a, matriz(0, 3.2, 0, 0, 3.4, 3.0, 3.4));
    lote.agregar(GEO.esfera, 0x52a35a, matriz(0.3, 4.3, 0.2, 0.6, 2.2, 2.0, 2.2));
    const base = lote.malla();
    const inst = new THREE.InstancedMesh(base.geometry, base.material, arboles.length);
    arboles.forEach(([x, z, s], i) => inst.setMatrixAt(i, matriz(x, 0.15, z, (i * 1.7) % 6.28, s, s, s)));
    inst.castShadow = true;
    escena.add(inst);
  }
  {
    const lote = new Lote();
    lote.agregar(GEO.cilindro6, 0x5b6470, matriz(0, 2.6, 0, 0, 0.16, 5.2, 0.16));
    lote.caja(0x5b6470, 0, 5.1, 0.6, 0.08, 0.08, 1.3);
    lote.caja(0xfff4c2, 0, 5.0, 1.2, 0.35, 0.15, 0.5);
    const base = lote.malla();
    const inst = new THREE.InstancedMesh(base.geometry, base.material, faroles.length);
    faroles.forEach(([x, z, r], i) => inst.setMatrixAt(i, matriz(x, 0.15, z, r)));
    inst.castShadow = true;
    escena.add(inst);
  }

  // ===========================================================
  // CORDILLERA DE LOS ANDES al fondo (sin sombras)
  // ===========================================================
  for (let i = 0; i < 14; i++) {
    const x = -320 + i * 50 + rand() * 20, z = 300 + rand() * 60, alto = 90 + rand() * 80, radio = 60 + rand() * 30;
    lejos.agregar(new THREE.ConeGeometry(radio, alto, 6), 0x7d8fa8, matriz(x, alto / 2 - 5, z, rand()));
    lejos.agregar(new THREE.ConeGeometry(radio * 0.36, alto * 0.36, 6), 0xf5f7fa, matriz(x, alto - 5 - alto * 0.18 + 0.5, z, rand()));
  }

  // ---------- Agregar todo a la escena ----------
  escena.add(solidos.malla({ sombra: true, recibe: true }));
  escena.add(suelo.malla({ sombra: false, recibe: true }));
  escena.add(lejos.malla({ sombra: false, recibe: false }));

  return { mundo, semaforo, barreras };
}
