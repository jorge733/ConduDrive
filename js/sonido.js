// ===========================================================
// ConduDrive - SONIDO (todo sintetizado, sin archivos de audio)
// - Motor: osciladores que siguen las revoluciones (un 4 cilindros
//   hace 2 explosiones por vuelta) + filtro que se abre al acelerar.
// - Neumáticos chirriando, viento a alta velocidad, golpes,
//   "tic-tac" del intermitente y cambio de marcha.
// El navegador solo deja sonar audio después de que el jugador
// toca la pantalla o una tecla: por eso se "despierta" con iniciar().
// ===========================================================

export class Sonido {
  constructor() {
    this.ctx = null;
    this.activo = true;
    this._listo = false;
  }

  iniciar() {
    if (this._listo) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this._listo = true;

    this.maestro = ctx.createGain();
    this.maestro.gain.value = this.activo ? 0.8 : 0;
    const compresor = ctx.createDynamicsCompressor();
    this.maestro.connect(compresor).connect(ctx.destination);

    // ----- Motor -----
    this.filtroMotor = ctx.createBiquadFilter();
    this.filtroMotor.type = 'lowpass';
    this.filtroMotor.Q.value = 2;
    this.gananciaMotor = ctx.createGain();
    this.gananciaMotor.gain.value = 0;
    const distorsion = ctx.createWaveShaper();
    distorsion.curve = curvaDistorsion(6);
    this.oscMotor = [];
    const partes = [
      { tipo: 'sawtooth', mult: 1, vol: 0.5 },
      { tipo: 'square', mult: 0.5, vol: 0.35 },   // "golpe" grave de cada vuelta
      { tipo: 'triangle', mult: 2, vol: 0.18 }
    ];
    for (const p of partes) {
      const o = ctx.createOscillator();
      o.type = p.tipo;
      const g = ctx.createGain();
      g.gain.value = p.vol;
      o.connect(g).connect(distorsion);
      o.start();
      this.oscMotor.push({ o, mult: p.mult });
    }
    distorsion.connect(this.filtroMotor).connect(this.gananciaMotor).connect(this.maestro);

    // ----- Ruido base (para neumáticos, viento y golpes) -----
    this.bufferRuido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const datos = this.bufferRuido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;

    const fuenteRuido = (tipo, frecuencia, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.bufferRuido;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = tipo; f.frequency.value = frecuencia; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.maestro);
      src.start();
      return { f, g };
    };
    // Chirrido de neumáticos: ruido muy filtrado + un tono agudo que tiembla
    this.neumaticos = fuenteRuido('bandpass', 1100, 9);
    const chirrido = ctx.createOscillator();
    chirrido.type = 'sawtooth';
    chirrido.frequency.value = 820;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 23;
    const profundidad = ctx.createGain();
    profundidad.gain.value = 40;
    vibrato.connect(profundidad).connect(chirrido.frequency);
    const fCh = ctx.createBiquadFilter();
    fCh.type = 'bandpass'; fCh.frequency.value = 1000; fCh.Q.value = 3;
    this.gananciaChirrido = ctx.createGain();
    this.gananciaChirrido.gain.value = 0;
    chirrido.connect(fCh).connect(this.gananciaChirrido).connect(this.maestro);
    chirrido.start(); vibrato.start();

    this.viento = fuenteRuido('lowpass', 500, 0.5);
    this.rodado = fuenteRuido('lowpass', 180, 0.7);   // rumor del asfalto
    this.lluvia = fuenteRuido('highpass', 2500, 0.3);
  }

  alternar() {
    this.activo = !this.activo;
    if (this.maestro) this.maestro.gain.setTargetAtTime(this.activo ? 0.8 : 0, this.ctx.currentTime, 0.05);
    return this.activo;
  }

  /** Se llama cada cuadro con el estado del auto */
  actualizar(auto, lloviendo, pausado) {
    if (!this._listo) return;
    const t = this.ctx.currentTime;
    const suave = 0.05;
    const silencio = pausado ? 0 : 1;

    // Motor
    const rpm = auto.rpm;
    const base = rpm / 60 * 2; // frecuencia de encendido
    for (const { o, mult } of this.oscMotor) o.frequency.setTargetAtTime(base * mult, t, 0.02);
    const carga = auto.acelerador;
    this.filtroMotor.frequency.setTargetAtTime(300 + rpm * 0.25 + carga * 1400, t, suave);
    this.gananciaMotor.gain.setTargetAtTime((0.1 + carga * 0.14 + rpm / 6300 * 0.08) * silencio, t, suave);

    // Neumáticos
    const v = Math.abs(auto.velocidadAvance);
    const desl = auto.deslizamiento * Math.min(1, v / 3);
    this.neumaticos.g.gain.setTargetAtTime(desl * 0.5 * silencio, t, 0.04);
    this.neumaticos.f.frequency.setTargetAtTime(900 + desl * 500, t, 0.05);
    this.gananciaChirrido.gain.setTargetAtTime(Math.max(0, desl - 0.25) * 0.09 * silencio, t, 0.04);

    // Viento y rodado
    this.viento.g.gain.setTargetAtTime(Math.min(0.35, (v * v) / 2200) * silencio, t, 0.1);
    this.viento.f.frequency.setTargetAtTime(300 + v * 25, t, 0.1);
    this.rodado.g.gain.setTargetAtTime(Math.min(0.25, v / 60) * (lloviendo ? 1.6 : 1) * silencio, t, 0.1);
    this.lluvia.g.gain.setTargetAtTime((lloviendo ? 0.08 : 0) * silencio, t, 0.3);
  }

  /** "Tic" o "tac" del intermitente */
  tic(encendido) {
    if (!this._listo || !this.activo) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = encendido ? 1800 : 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(this.maestro);
    o.start(t); o.stop(t + 0.04);
  }

  /** Golpe de choque: más fuerte según la velocidad del impacto */
  golpe(fuerza) {
    if (!this._listo) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const vol = Math.min(1, fuerza / 10);
    const src = ctx.createBufferSource();
    src.buffer = this.bufferRuido;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 350 + vol * 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25 + vol * 0.75, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + vol * 0.3);
    src.connect(f).connect(g).connect(this.maestro);
    src.start(t, Math.random()); src.stop(t + 0.6);
    // Tono grave del "pum"
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.2);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.5 * vol, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g2).connect(this.maestro);
    o.start(t); o.stop(t + 0.3);
  }

  /** Pequeño "clac" al cambiar de marcha */
  cambio() {
    if (!this._listo) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bufferRuido;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.maestro);
    src.start(t, Math.random()); src.stop(t + 0.06);
  }

  /** Pitido de aviso (exceso de velocidad) */
  pitido() {
    if (!this._listo || !this.activo) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1500;
      const g = ctx.createGain();
      const t0 = t + i * 0.18;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.01);
      g.gain.linearRampToValueAtTime(0, t0 + 0.12);
      o.connect(g).connect(this.maestro);
      o.start(t0); o.stop(t0 + 0.13);
    }
  }
}

function curvaDistorsion(k) {
  const n = 1024, curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curva[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }
  return curva;
}
