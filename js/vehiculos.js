// ===========================================================
// ConduDrive - OTROS VEHÍCULOS (modelos simples)
// Autos estacionados y autos que circulan por el pueblo.
// ===========================================================
import { Lote, GEO, matriz } from './util.js';

export const COLORES_AUTOS = [0x457b9d, 0xf1c40f, 0x9b59b6, 0x2ecc71, 0xecf0f1, 0x34495e, 0xe67e22, 0x1abc9c, 0xc0392b, 0x95a5a6];

/**
 * Agrega un auto simple a un lote, usando una matriz base (posición y giro).
 * El auto mira hacia +Z y mide 1,7 x 3,8 m.
 */
export function agregarAutoALote(lote, color, base) {
  const p = (geo, c, x, y, z, w, h, d, rotZ = 0) =>
    lote.agregar(geo, c, base.clone().multiply(matriz(x, y, z, 0, w, h, d, 0, rotZ)));
  p(GEO.caja, color, 0, 0.6, 0, 1.7, 0.55, 3.8);
  p(GEO.caja, 0x2b3d52, 0, 1.15, -0.25, 1.5, 0.55, 1.9);
  p(GEO.caja, color, 0, 1.45, -0.3, 1.54, 0.07, 1.7);
  p(GEO.caja, 0x222222, 0, 0.42, 1.92, 1.76, 0.22, 0.2);
  p(GEO.caja, 0x222222, 0, 0.42, -1.92, 1.76, 0.22, 0.2);
  p(GEO.caja, 0xfff2b0, 0.55, 0.7, 1.91, 0.38, 0.14, 0.04);
  p(GEO.caja, 0xfff2b0, -0.55, 0.7, 1.91, 0.38, 0.14, 0.04);
  p(GEO.caja, 0xb3001b, 0.55, 0.72, -1.91, 0.4, 0.14, 0.04);
  p(GEO.caja, 0xb3001b, -0.55, 0.72, -1.91, 0.4, 0.14, 0.04);
  for (const x of [0.78, -0.78]) for (const z of [1.25, -1.25]) {
    p(GEO.cilindro, 0x1a1a1a, x, 0.32, z, 0.64, 0.24, 0.64, Math.PI / 2);
  }
}

/** Crea un auto como una sola malla (1 llamada de dibujo) */
export function crearAutoMalla(color) {
  const lote = new Lote();
  agregarAutoALote(lote, color, matriz(0, 0, 0));
  return lote.malla({ recibe: false, rugosidad: 0.55 });
}
