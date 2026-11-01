// ===========================================================
// ConduDrive - MINIMAPA
// Mapa chico que gira con el auto (el auto siempre apunta hacia arriba).
// Muestra calles, rotonda, semáforo, otros autos y lugares importantes.
// ===========================================================
import { CALLES, ROTONDA, PUNTOS } from './ciudad.js';
import { CONFIG } from './config.js';

const ESCALA = 0.9;   // píxeles por metro
const LIMITE = 100;   // las calles van de -100 a 100

export class Minimapa {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.tam = canvas.clientWidth || 140;
    canvas.width = this.tam * dpr;
    canvas.height = this.tam * dpr;
    this.ctx.scale(dpr, dpr);
    this._t = 0;
  }

  actualizar(dt, auto, trafico) {
    this._t += dt;
    if (this._t < 1 / 15) return; // 15 veces por segundo basta
    this._t = 0;
    const ctx = this.ctx, T = this.tam, m = T / 2;
    ctx.save();
    ctx.clearRect(0, 0, T, T);
    ctx.beginPath(); ctx.arc(m, m, m - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(110, 160, 90, 0.85)';
    ctx.fillRect(0, 0, T, T);

    // Mundo → pantalla: centro en el auto, girado para que el auto mire hacia arriba.
    // (en el mundo, +X queda a la izquierda del auto cuando mira a +Z)
    ctx.translate(m, m);
    ctx.rotate(auto.angulo);
    ctx.scale(-ESCALA, -ESCALA);
    ctx.translate(-auto.posicion.x, -auto.posicion.z);

    // Calles
    const ancho = CONFIG.ciudad.anchoCalle;
    ctx.strokeStyle = '#4a4f57';
    ctx.lineWidth = ancho;
    ctx.beginPath();
    for (const c of CALLES) {
      ctx.moveTo(c, -LIMITE); ctx.lineTo(c, LIMITE);
      ctx.moveTo(-LIMITE, c); ctx.lineTo(LIMITE, c);
    }
    ctx.stroke();
    // Rotonda
    ctx.fillStyle = '#4a4f57';
    ctx.beginPath(); ctx.arc(ROTONDA.x, ROTONDA.z, ROTONDA.radio, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6aa84f';
    ctx.beginPath(); ctx.arc(ROTONDA.x, ROTONDA.z, ROTONDA.isla, 0, Math.PI * 2); ctx.fill();
    // Línea central
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const c of CALLES) {
      ctx.moveTo(c, -LIMITE); ctx.lineTo(c, LIMITE);
      ctx.moveTo(-LIMITE, c); ctx.lineTo(LIMITE, c);
    }
    ctx.stroke();
    // Zona escolar y estacionamiento
    const z = PUNTOS.zonaEscolar;
    ctx.fillStyle = 'rgba(255, 200, 0, 0.45)';
    ctx.fillRect(z.hastaX, z.z - ancho / 2, z.desdeX - z.hastaX, ancho);
    ctx.fillStyle = 'rgba(60, 120, 220, 0.6)';
    ctx.fillRect(-68, -68, 36, 36);

    // Semáforo, PARE y CEDA
    const punto = (p, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, Math.PI * 2); ctx.fill(); };
    punto(PUNTOS.semaforo, '#ffcc00');
    punto(PUNTOS.pare, '#e53935');
    punto(PUNTOS.ceda, '#ffffff');

    // Otros autos
    if (trafico) for (const a of trafico.autos) punto(a, '#ffffff', 1.8);
    ctx.restore();

    // El auto del jugador (siempre al centro, mirando hacia arriba)
    ctx.fillStyle = '#e63946';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m, m - 8); ctx.lineTo(m + 5.5, m + 6); ctx.lineTo(m, m + 3); ctx.lineTo(m - 5.5, m + 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Borde
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m, m, m - 1, 0, Math.PI * 2); ctx.stroke();
    // Norte
    ctx.save();
    ctx.translate(m, m);
    ctx.rotate(auto.angulo);
    ctx.fillStyle = '#fff'; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -(m - 10));
    ctx.restore();
  }
}
