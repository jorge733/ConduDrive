// ===========================================================
// ConduDrive - SEÑALES DE TRÁNSITO Y SEMÁFOROS
// Todas las señales se dibujan con código (canvas), sin imágenes.
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GEO, matriz, texturaCanvas, derechaDe, anguloHacia } from './util.js';

// ---------- Dibujos de cada señal ----------
function poligono(ctx, cx, cy, radio, lados, giro) {
  ctx.beginPath();
  for (let i = 0; i < lados; i++) {
    const a = giro + (i / lados) * Math.PI * 2;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * radio, cy + Math.sin(a) * radio);
  }
  ctx.closePath();
}

function textoCentrado(ctx, texto, x, y, tam, color, peso = 900) {
  ctx.fillStyle = color;
  ctx.font = `${peso} ${tam}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x, y);
}

const DIBUJOS = {
  // Disco PARE: octágono rojo con borde blanco
  pare: (ctx, w) => {
    poligono(ctx, w / 2, w / 2, w * 0.49, 8, Math.PI / 8);
    ctx.fillStyle = '#fff'; ctx.fill();
    poligono(ctx, w / 2, w / 2, w * 0.44, 8, Math.PI / 8);
    ctx.fillStyle = '#d62828'; ctx.fill();
    textoCentrado(ctx, 'PARE', w / 2, w / 2 + 4, w * 0.27, '#fff');
  },
  // CEDA EL PASO: triángulo invertido blanco con borde rojo
  ceda: (ctx, w) => {
    poligono(ctx, w / 2, w * 0.38, w * 0.56, 3, Math.PI / 2);
    ctx.fillStyle = '#d62828'; ctx.fill();
    poligono(ctx, w / 2, w * 0.38, w * 0.4, 3, Math.PI / 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    textoCentrado(ctx, 'CEDA', w / 2, w * 0.27, w * 0.11, '#111');
    textoCentrado(ctx, 'EL PASO', w / 2, w * 0.39, w * 0.08, '#111');
  },
  // Velocidad máxima 30
  vel30: (ctx, w) => {
    ctx.beginPath(); ctx.arc(w / 2, w / 2, w * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = '#d62828'; ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, w / 2, w * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    textoCentrado(ctx, '30', w / 2, w / 2 + 6, w * 0.42, '#111');
  },
  // Zona escolar (en Chile es amarillo-verde fluorescente)
  escolar: (ctx, w) => {
    ctx.fillStyle = '#c8f000';
    ctx.fillRect(w * 0.04, w * 0.04, w * 0.92, w * 0.92);
    ctx.lineWidth = w * 0.03; ctx.strokeStyle = '#111';
    ctx.strokeRect(w * 0.08, w * 0.08, w * 0.84, w * 0.84);
    // Dos niños caminando (monitos de palitos)
    ctx.lineWidth = w * 0.035; ctx.lineCap = 'round';
    for (const [x, s] of [[0.4, 1], [0.6, 0.8]]) {
      const cx = w * x, base = w * 0.6, alto = w * 0.3 * s;
      ctx.beginPath(); ctx.arc(cx, base - alto, w * 0.04 * s, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, base - alto * 0.85); ctx.lineTo(cx, base - alto * 0.35);
      ctx.lineTo(cx - alto * 0.2, base); ctx.moveTo(cx, base - alto * 0.35); ctx.lineTo(cx + alto * 0.2, base);
      ctx.moveTo(cx - alto * 0.25, base - alto * 0.6); ctx.lineTo(cx + alto * 0.25, base - alto * 0.7);
      ctx.stroke();
    }
    textoCentrado(ctx, 'ZONA ESCOLAR', w / 2, w * 0.78, w * 0.1, '#111');
  },
  finEscolar: (ctx, w) => {
    DIBUJOS.escolar(ctx, w);
    ctx.strokeStyle = '#d62828'; ctx.lineWidth = w * 0.06;
    ctx.beginPath(); ctx.moveTo(w * 0.12, w * 0.88); ctx.lineTo(w * 0.88, w * 0.12); ctx.stroke();
    textoCentrado(ctx, 'FIN', w / 2, w * 0.2, w * 0.12, '#111');
  },
  // Estacionamiento: "E" blanca en fondo azul
  estacionamiento: (ctx, w) => {
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(w * 0.04, w * 0.04, w * 0.92, w * 0.92);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.03;
    ctx.strokeRect(w * 0.1, w * 0.1, w * 0.8, w * 0.8);
    textoCentrado(ctx, 'E', w / 2, w / 2 + 6, w * 0.62, '#fff');
  },
  // Paso peatonal
  peatones: (ctx, w) => {
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(w * 0.04, w * 0.04, w * 0.92, w * 0.92);
    poligono(ctx, w / 2, w * 0.56, w * 0.42, 3, -Math.PI / 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = w * 0.04; ctx.lineCap = 'round';
    const cx = w / 2, b = w * 0.72;
    ctx.beginPath(); ctx.arc(cx, w * 0.4, w * 0.04, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, w * 0.45); ctx.lineTo(cx, w * 0.6); ctx.lineTo(cx - w * 0.08, b);
    ctx.moveTo(cx, w * 0.6); ctx.lineTo(cx + w * 0.08, b);
    ctx.moveTo(cx - w * 0.08, w * 0.52); ctx.lineTo(cx + w * 0.08, w * 0.5);
    ctx.stroke();
  }
};

// Las texturas se crean una sola vez y se reutilizan
const cacheTexturas = {};
function texturaSenal(tipo) {
  if (!cacheTexturas[tipo]) cacheTexturas[tipo] = texturaCanvas(256, 256, (ctx, w) => DIBUJOS[tipo](ctx, w));
  return cacheTexturas[tipo];
}
const cacheMateriales = {};
function materialesSenal(tipo) {
  if (!cacheMateriales[tipo]) {
    const map = texturaSenal(tipo);
    cacheMateriales[tipo] = {
      frente: new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.6 }),
      // La parte de atrás: misma forma pero gris oscura
      atras: new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, color: 0x333333, roughness: 0.9 })
    };
  }
  return cacheMateriales[tipo];
}
const geoPlaca = new THREE.PlaneGeometry(0.8, 0.8);

/**
 * Pone una señal en (x, z) mirando hacia la dirección (fx, fz)
 * (es decir, hacia los autos que se acercan).
 * Los postes se agregan al "lote" para que sean baratos de dibujar.
 * @param tipos lista de señales de arriba hacia abajo, ej: ['escolar','vel30']
 */
export function crearSenal(escena, lote, tipos, x, z, fx, fz) {
  const rot = anguloHacia(fx, fz);
  const altoPoste = 2.0 + tipos.length * 0.85;
  lote.agregar(GEO.cilindro6, 0x8d99ae, matriz(x, altoPoste / 2 + 0.15, z, 0, 0.09, altoPoste, 0.09));
  tipos.forEach((tipo, i) => {
    const m = materialesSenal(tipo);
    const y = altoPoste - 0.25 - i * 0.85;
    const frente = new THREE.Mesh(geoPlaca, m.frente);
    frente.position.set(x + fx * 0.07, y, z + fz * 0.07);
    frente.rotation.y = rot;
    const atras = new THREE.Mesh(geoPlaca, m.atras);
    atras.position.set(x + fx * 0.06, y, z + fz * 0.06);
    atras.rotation.y = rot + Math.PI;
    escena.add(frente, atras);
  });
}

// ===========================================================
// SEMÁFORO de 4 direcciones en un cruce
// Fases: eje X verde → X amarillo → todos rojo → eje Z verde → Z amarillo → todos rojo
// ("eje X" = autos que viajan en dirección Este-Oeste, "eje Z" = Norte-Sur)
// ===========================================================
export class Semaforo {
  constructor(escena, lote, suelo, cx, cz) {
    this.cx = cx;
    this.cz = cz;
    const T = CONFIG.semaforo;
    this.fases = [
      { x: 'verde', z: 'rojo', dur: T.verde },
      { x: 'amarillo', z: 'rojo', dur: T.amarillo },
      { x: 'rojo', z: 'rojo', dur: T.todoRojo },
      { x: 'rojo', z: 'verde', dur: T.verde },
      { x: 'rojo', z: 'amarillo', dur: T.amarillo },
      { x: 'rojo', z: 'rojo', dur: T.todoRojo }
    ];
    this.fase = 0;
    this.tiempo = 0;

    // Materiales de las ampolletas, uno por eje y color (para encender/apagar)
    const crearMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.05, roughness: 0.4 });
    this.mat = {
      x: { rojo: crearMat(0xff2020), amarillo: crearMat(0xffb000), verde: crearMat(0x20e060) },
      z: { rojo: crearMat(0xff2020), amarillo: crearMat(0xffb000), verde: crearMat(0x20e060) }
    };

    // Cada "aproximación" es una dirección por la que llegan autos al cruce
    this.aproximaciones = [];
    const geoAmpolleta = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10);
    geoAmpolleta.rotateX(Math.PI / 2);
    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    for (const d of dirs) {
      const r = derechaDe(d);
      const eje = d.x !== 0 ? 'x' : 'z';
      // Poste en la esquina del fondo a la derecha; la cabeza cuelga sobre la pista
      const px = cx + d.x * 6 + r.x * 6.2, pz = cz + d.z * 6 + r.z * 6.2;
      const hx = cx + d.x * 6 + r.x * 2.5, hz = cz + d.z * 6 + r.z * 2.5;
      const rot = anguloHacia(-d.x, -d.z);
      lote.agregar(GEO.cilindro6, 0x4a5563, matriz(px, 2.65, pz, 0, 0.18, 5, 0.18));
      lote.caja(0x4a5563, (px + hx) / 2, 4.95, (pz + hz) / 2, Math.abs(px - hx) + 0.12, 0.1, Math.abs(pz - hz) + 0.12);
      lote.caja(0x22262c, hx, 4.35, hz, 0.42, 1.05, 0.3, rot);
      // Viseras
      const colores = ['rojo', 'amarillo', 'verde'];
      colores.forEach((c, i) => {
        const y = 4.68 - i * 0.33;
        const amp = new THREE.Mesh(geoAmpolleta, this.mat[eje][c]);
        amp.position.set(hx - d.x * 0.16, y, hz - d.z * 0.16);
        amp.rotation.y = rot;
        escena.add(amp);
        lote.caja(0x22262c, hx - d.x * 0.22, y + 0.12, hz - d.z * 0.22, 0.3, 0.04, 0.3, rot);
      });

      // Línea de detención blanca (antes del cruce, en la pista derecha)
      const lx = cx - d.x * 6.2 + r.x * 2.5, lz = cz - d.z * 6.2 + r.z * 2.5;
      suelo.caja(0xf2f2f2, lx, 0.012, lz, d.x !== 0 ? 0.45 : 4.8, 0.02, d.x !== 0 ? 4.8 : 0.45);
      this.aproximaciones.push({ d, r, eje, linea: { x: lx, z: lz } });
    }
    this._aplicarLuces();
  }

  /** Color actual para quien viaja en el eje 'x' o 'z' */
  estado(eje) { return this.fases[this.fase][eje]; }

  actualizar(dt) {
    this.tiempo += dt;
    if (this.tiempo >= this.fases[this.fase].dur) {
      this.tiempo = 0;
      this.fase = (this.fase + 1) % this.fases.length;
      this._aplicarLuces();
    }
  }

  _aplicarLuces() {
    for (const eje of ['x', 'z']) {
      const actual = this.estado(eje);
      for (const c of ['rojo', 'amarillo', 'verde']) {
        this.mat[eje][c].emissiveIntensity = c === actual ? 2.2 : 0.04;
        this.mat[eje][c].color.setHex(c === actual ? 0xffffff : 0x333333);
      }
    }
  }
}
