// ===========================================================
// ConduDrive - ESCENARIO DE PRUEBA (Paso 1)
// Una pequeña cuadrícula de calles con manzanas, veredas, casitas,
// árboles, postes y algunos autos estacionados para probar choques.
// (En el Paso 2 esto se reemplaza por el pueblo completo.)
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';

const { tamanoManzana: M, anchoCalle: A, anchoVereda: V } = CONFIG.ciudad;

// Paleta de colores agradable (casas de colores, estilo pueblo chileno)
const COLORES_CASAS = [0xf4a261, 0xe9c46a, 0x2a9d8f, 0xe76f51, 0x8ecae6, 0xffb4a2, 0xb5e48c, 0xcdb4db];

export function crearEscenario(escena) {
  // Lo que puede chocar el auto
  const mundo = { cajas: [], circulos: [] };

  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
  const matAsfalto = mat(0x4a4f57);
  const matVereda = mat(0xc9c3b6);
  const matPasto = mat(0x7cb85a);
  const matLinea = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });

  // ----- Suelo de asfalto -----
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), matAsfalto);
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  // ----- Cuadrícula: 3 x 3 manzanas con calles entre ellas -----
  // Centros de las calles: -75, -25, 25, 75 (en X y en Z)
  const N = 3;
  const total = N * M + (N + 1) * A;          // 160 m
  const inicio = -total / 2;                   // -80
  const centrosCalles = [];
  for (let i = 0; i <= N; i++) centrosCalles.push(inicio + A / 2 + i * (M + A));
  const centrosManzanas = [];
  for (let i = 0; i < N; i++) centrosManzanas.push(inicio + A + M / 2 + i * (M + A));

  const geoCasa = new THREE.BoxGeometry(1, 1, 1);
  const geoTecho = new THREE.ConeGeometry(0.75, 1, 4);
  geoTecho.rotateY(Math.PI / 4);

  // Función que crea una manzana con vereda, pasto y casitas
  const crearManzana = (cx, cz, ancho, largo, conCasas) => {
    // Vereda (bloque elevado 15 cm)
    const vereda = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.15, largo), matVereda);
    vereda.position.set(cx, 0.075, cz);
    vereda.receiveShadow = true;
    escena.add(vereda);
    // Pasto en el interior
    const pasto = new THREE.Mesh(new THREE.BoxGeometry(ancho - V * 2, 0.04, largo - V * 2), matPasto);
    pasto.position.set(cx, 0.17, cz);
    pasto.receiveShadow = true;
    escena.add(pasto);
    // La manzana entera es sólida (chocar = subirse a la vereda)
    mundo.cajas.push({ minX: cx - ancho / 2, maxX: cx + ancho / 2, minZ: cz - largo / 2, maxZ: cz + largo / 2, tipo: 'vereda' });

    if (!conCasas) return;
    // Casitas de colores alrededor del borde de la manzana
    const lado = ancho / 2 - V - 4;
    const posiciones = [];
    for (let t = -1; t <= 1; t += 1) {
      posiciones.push([cx + t * lado * 0.75, cz + lado, 0]);
      posiciones.push([cx + t * lado * 0.75, cz - lado, Math.PI]);
    }
    posiciones.push([cx + lado, cz, Math.PI / 2], [cx - lado, cz, -Math.PI / 2]);
    posiciones.forEach(([x, z, rot], i) => {
      const w = 5 + ((i * 7) % 3), h = 3 + ((i * 5) % 3) * 0.8, d = 5;
      const color = COLORES_CASAS[(Math.abs(Math.round(cx + cz)) + i) % COLORES_CASAS.length];
      const casa = new THREE.Mesh(geoCasa, mat(color));
      casa.scale.set(w, h, d);
      casa.position.set(x, h / 2 + 0.15, z);
      casa.rotation.y = rot;
      casa.castShadow = true;
      casa.receiveShadow = true;
      escena.add(casa);
      const techo = new THREE.Mesh(geoTecho, mat(0x9b3d2e));
      techo.scale.set(w * 0.95, 2, d * 0.95);
      techo.position.set(x, h + 1.15, z);
      techo.rotation.y = rot;
      techo.castShadow = true;
      escena.add(techo);
    });
  };

  for (const x of centrosManzanas) for (const z of centrosManzanas) crearManzana(x, z, M, M, true);

  // Bordes exteriores (para que no te salgas del mapa)
  const borde = 200;
  const fin = total / 2;
  crearManzana(0, fin + borde / 2, total + borde * 2, borde, false);   // norte
  crearManzana(0, -fin - borde / 2, total + borde * 2, borde, false);  // sur
  crearManzana(fin + borde / 2, 0, borde, total, false);               // este
  crearManzana(-fin - borde / 2, 0, borde, total, false);              // oeste

  // ----- Líneas segmentadas al centro de cada calle -----
  // Usamos "InstancedMesh": dibuja cientos de líneas como si fuera una sola (rápido en celular)
  const segmentos = [];
  for (const c of centrosCalles) {
    // Tramos entre cruces
    for (let i = 0; i < centrosCalles.length - 1; i++) {
      const desde = centrosCalles[i] + A / 2 + 1.5;
      const hasta = centrosCalles[i + 1] - A / 2 - 1.5;
      for (let t = desde; t < hasta - 2; t += 6) {
        segmentos.push([c, t + 1.5, 0]);            // calle vertical (a lo largo de Z)
        segmentos.push([t + 1.5, c, Math.PI / 2]);  // calle horizontal (a lo largo de X)
      }
    }
  }
  const geoLinea = new THREE.PlaneGeometry(0.15, 3);
  geoLinea.rotateX(-Math.PI / 2);
  const lineas = new THREE.InstancedMesh(geoLinea, matLinea, segmentos.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 1, 0);
  segmentos.forEach(([x, z, rot], i) => {
    q.setFromAxisAngle(eje, rot);
    m4.compose(new THREE.Vector3(x, 0.01, z), q, new THREE.Vector3(1, 1, 1));
    lineas.setMatrixAt(i, m4);
  });
  escena.add(lineas);

  // ----- Postes de luz en las veredas -----
  const posPostes = [];
  for (const x of centrosManzanas) for (const z of centrosManzanas) {
    const e = M / 2 - 0.5;
    posPostes.push([x - e, z - e], [x + e, z - e], [x - e, z + e], [x + e, z + e]);
  }
  const geoPoste = new THREE.CylinderGeometry(0.1, 0.12, 5, 6);
  geoPoste.translate(0, 2.5, 0);
  const postes = new THREE.InstancedMesh(geoPoste, mat(0x5b6470), posPostes.length);
  postes.castShadow = true;
  posPostes.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.15, z);
    postes.setMatrixAt(i, m4);
  });
  escena.add(postes);

  // ----- Árboles (tronco + copa) -----
  const posArboles = [];
  for (const x of centrosManzanas) for (const z of centrosManzanas) {
    posArboles.push([x - 6, z - 4], [x + 5, z + 6], [x + 2, z - 7], [x - 7, z + 5]);
  }
  const geoTronco = new THREE.CylinderGeometry(0.2, 0.3, 2, 5);
  geoTronco.translate(0, 1, 0);
  const geoCopa = new THREE.IcosahedronGeometry(1.6, 0);
  geoCopa.translate(0, 3, 0);
  const troncos = new THREE.InstancedMesh(geoTronco, mat(0x7a5230), posArboles.length);
  const copas = new THREE.InstancedMesh(geoCopa, mat(0x3f8f4a), posArboles.length);
  troncos.castShadow = copas.castShadow = true;
  posArboles.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.17, z);
    troncos.setMatrixAt(i, m4);
    copas.setMatrixAt(i, m4);
  });
  escena.add(troncos, copas);

  // ----- Autos estacionados (para probar choques) -----
  const crearAutoEstacionado = (x, z, rot, color) => {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3.8), mat(color));
    cuerpo.position.y = 0.6;
    const cabina = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.9), mat(0x2b3d52));
    cabina.position.set(0, 1.2, -0.2);
    cuerpo.castShadow = cabina.castShadow = true;
    g.add(cuerpo, cabina);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    escena.add(g);
    const girado = Math.abs(Math.sin(rot)) > 0.5;
    const mx = girado ? 1.9 : 0.85, mz = girado ? 0.85 : 1.9;
    mundo.cajas.push({ minX: x - mx, maxX: x + mx, minZ: z - mz, maxZ: z + mz, tipo: 'auto' });
  };
  // Pegados a la vereda, en la pista derecha
  crearAutoEstacionado(-29.1, -12, 0, 0x457b9d);
  crearAutoEstacionado(-29.1, 0, 0, 0xf1c40f);
  crearAutoEstacionado(29.1, 40, Math.PI, 0x9b59b6);
  crearAutoEstacionado(10, -20.9, Math.PI / 2, 0x2ecc71);

  return mundo;
}
