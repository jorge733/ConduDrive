// ===========================================================
// ConduDrive - CONTROLES
// Lee el teclado (computador), la pantalla táctil (celular) y un
// control de consola (gamepad) y los convierte en valores simples:
//   acelerador 0..1 · freno 0..1 · direccion -1..1 · frenoMano sí/no
// Con teclado los pedales se pisan "de a poco" (como un pie real);
// el volante táctil y el joystick son analógicos.
// ===========================================================

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const acercar = (actual, objetivo, vel) => actual + limitar(objetivo - actual, -vel, vel);
// Captura el dedo para que el botón siga recibiéndolo aunque se salga de él
const capturar = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* puntero simulado */ } };

export class Controles {
  constructor() {
    // Botones que se MANTIENEN apretados (teclado)
    this.estado = { acelerar: false, frenar: false, izquierda: false, derecha: false, frenoMano: false };
    // Valores que entiende el auto
    this.salida = { acelerador: 0, freno: 0, direccion: 0, frenoMano: false, analogico: false };
    // Acciones de un solo toque (intermitentes, cámara, pausa...)
    this.alPulsar = {};

    this._teclado = {};
    this._tactil = { acelerador: 0, freno: 0, frenoMano: false, direccion: null };
    this._pedalTeclado = { acelerador: 0, freno: 0 };
    this._botonesGamepad = [];
    this.usandoGamepad = false;

    this._configurarTeclado();
    this._configurarTactil();
    window.addEventListener('gamepadconnected', () => this._disparar('gamepad'));
  }

  // Permite registrar qué hacer cuando se pulsa una acción
  on(accion, funcion) { this.alPulsar[accion] = funcion; }

  _disparar(accion) {
    if (this.alPulsar[accion]) this.alPulsar[accion]();
  }

  /** Se llama una vez por cuadro: mezcla teclado, táctil y gamepad */
  leer(dt) {
    const k = this._teclado, t = this._tactil, s = this.salida;

    // Teclado: los pedales suben en ~0,3 s y bajan más rápido
    const pk = this._pedalTeclado;
    pk.acelerador = acercar(pk.acelerador, k.acelerar ? 1 : 0, dt * (k.acelerar ? 3.5 : 6));
    pk.freno = acercar(pk.freno, k.frenar ? 1 : 0, dt * (k.frenar ? 4.5 : 8));
    const dirTeclado = (k.derecha ? 1 : 0) - (k.izquierda ? 1 : 0);

    let acel = Math.max(pk.acelerador, t.acelerador);
    let freno = Math.max(pk.freno, t.freno);
    let dir = dirTeclado, analogico = false;
    let frenoMano = !!k.frenoMano || t.frenoMano;

    if (t.direccion !== null) { dir = t.direccion; analogico = true; }

    // Gamepad (control de Xbox/PlayStation)
    const gp = this._leerGamepad();
    if (gp) {
      if (Math.abs(gp.direccion) > 0.01) { dir = gp.direccion; analogico = true; }
      acel = Math.max(acel, gp.acelerador);
      freno = Math.max(freno, gp.freno);
      frenoMano = frenoMano || gp.frenoMano;
    }

    s.acelerador = acel; s.freno = freno; s.direccion = dir;
    s.frenoMano = frenoMano; s.analogico = analogico;
    // Compatibilidad con el estado antiguo (booleanos)
    this.estado.acelerar = acel > 0.05; this.estado.frenar = freno > 0.05;
    this.estado.izquierda = dir < -0.1; this.estado.derecha = dir > 0.1;
    this.estado.frenoMano = frenoMano;
    return s;
  }

  _leerGamepad() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = lista && Array.from(lista).find((g) => g && g.connected);
    if (!gp) return null;
    const b = (i) => gp.buttons[i] ? gp.buttons[i].value : 0;
    // Botones de un toque (se detecta el momento en que se aprietan)
    const toques = { 4: 'intIzq', 5: 'intDer', 3: 'camara', 2: 'bajarMarcha', 1: 'subirMarcha', 9: 'pausa', 8: 'reiniciar' };
    for (const [i, accion] of Object.entries(toques)) {
      const ahora = b(i) > 0.5;
      if (ahora && !this._botonesGamepad[i]) this._disparar(accion);
      this._botonesGamepad[i] = ahora;
    }
    let eje = gp.axes[0] || 0;
    eje = Math.abs(eje) < 0.1 ? 0 : (eje - Math.sign(eje) * 0.1) / 0.9;
    eje = Math.sign(eje) * Math.pow(Math.abs(eje), 1.5); // más fino cerca del centro
    const r = { direccion: eje, acelerador: b(7), freno: b(6), frenoMano: b(0) > 0.5 };
    if (r.acelerador > 0.1 || r.freno > 0.1 || eje !== 0) this.usandoGamepad = true;
    return r;
  }

  // ---------- Teclado ----------
  _configurarTeclado() {
    const mapa = {
      ArrowUp: 'acelerar',   KeyW: 'acelerar',
      ArrowDown: 'frenar',   KeyS: 'frenar',
      ArrowLeft: 'izquierda', KeyA: 'izquierda',
      ArrowRight: 'derecha',  KeyD: 'derecha',
      Space: 'frenoMano'
    };
    const toques = {
      KeyQ: 'intIzq', KeyE: 'intDer', KeyC: 'camara', KeyR: 'reiniciar',
      KeyP: 'pausa', Escape: 'pausa', KeyT: 'caja', KeyX: 'subirMarcha', KeyZ: 'bajarMarcha',
      ShiftLeft: 'subirMarcha', ControlLeft: 'bajarMarcha', KeyL: 'lluvia', KeyM: 'sonido', KeyB: 'mirarAtras'
    };

    window.addEventListener('keydown', (e) => {
      this._disparar('interaccion');
      if (mapa[e.code]) {
        this._teclado[mapa[e.code]] = true;
        e.preventDefault();
      } else if (toques[e.code] && !e.repeat) {
        this._disparar(toques[e.code]);
        if (e.code === 'KeyB') this.mirandoAtras = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (mapa[e.code]) this._teclado[mapa[e.code]] = false;
      if (e.code === 'KeyB') this.mirandoAtras = false;
    });
    // Si la ventana pierde el foco, soltamos todo (evita autos "pegados")
    window.addEventListener('blur', () => this.soltarTodo());
  }

  soltarTodo() {
    this._teclado = {};
    this._tactil.acelerador = this._tactil.freno = 0;
    this._tactil.frenoMano = false;
    this._tactil.direccion = this._tactil.direccion === null ? null : 0;
    this.mirandoAtras = false;
    document.querySelectorAll('.boton.activo').forEach((b) => b.classList.remove('activo'));
  }

  // ---------- Pantalla táctil ----------
  _configurarTactil() {
    const esTactil = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.esTactil = esTactil;
    if (esTactil) document.body.classList.add('tactil');

    // Pedales analógicos: más arriba en el botón = más fuerza (mínimo 35 %)
    document.querySelectorAll('[data-pedal]').forEach((boton) => {
      const pedal = boton.dataset.pedal;
      const medir = (e) => {
        const r = boton.getBoundingClientRect();
        const alto = limitar(1 - (e.clientY - r.top) / r.height, 0, 1);
        this._tactil[pedal] = 0.35 + 0.65 * limitar(alto * 1.3, 0, 1);
      };
      boton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capturar(boton, e);
        boton.classList.add('activo');
        medir(e);
        this._disparar('interaccion');
      });
      boton.addEventListener('pointermove', (e) => { if (boton.classList.contains('activo')) medir(e); });
      const soltar = () => { this._tactil[pedal] = 0; boton.classList.remove('activo'); };
      boton.addEventListener('pointerup', soltar);
      boton.addEventListener('pointercancel', soltar);
      boton.addEventListener('lostpointercapture', soltar);
    });

    // Freno de mano (se mantiene)
    document.querySelectorAll('[data-mantener="frenoMano"]').forEach((boton) => {
      boton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capturar(boton, e);
        this._tactil.frenoMano = true;
        boton.classList.add('activo');
      });
      const soltar = () => { this._tactil.frenoMano = false; boton.classList.remove('activo'); };
      boton.addEventListener('pointerup', soltar);
      boton.addEventListener('pointercancel', soltar);
      boton.addEventListener('lostpointercapture', soltar);
    });

    // Volante táctil: se gira arrastrando el dedo en círculo (o de lado a lado)
    const volante = document.getElementById('volante-tactil');
    if (volante) {
      const imagen = volante.querySelector('.aro');
      const GIRO_MAX = 150; // grados de volante en pantalla = giro total
      let angulo = 0, anguloInicio = 0, dedo = null, xInicio = 0, anguloBase = 0;
      const anguloDedo = (e) => {
        const r = volante.getBoundingClientRect();
        return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
      };
      const pintar = () => {
        imagen.style.transform = `rotate(${angulo}deg)`;
        this._tactil.direccion = angulo / GIRO_MAX;
      };
      volante.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capturar(volante, e);
        dedo = e.pointerId;
        anguloInicio = anguloDedo(e);
        anguloBase = angulo;
        xInicio = e.clientX;
        volante.classList.add('activo');
        this._disparar('interaccion');
      });
      volante.addEventListener('pointermove', (e) => {
        if (e.pointerId !== dedo) return;
        let delta = anguloDedo(e) - anguloInicio;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        // También funciona deslizando de lado a lado
        const lateral = (e.clientX - xInicio) * 1.4;
        const giro = Math.abs(lateral) > Math.abs(delta) ? lateral : delta;
        angulo = limitar(anguloBase + giro, -GIRO_MAX, GIRO_MAX);
        if (Math.abs(delta) < 160) { anguloInicio = anguloDedo(e); anguloBase = angulo; xInicio = e.clientX; }
        pintar();
      });
      const soltar = () => {
        dedo = null;
        volante.classList.remove('activo');
        // Vuelve solo al centro, como un volante real
        const volver = () => {
          if (dedo !== null) return;
          angulo *= 0.75;
          if (Math.abs(angulo) < 1) angulo = 0;
          pintar();
          if (angulo !== 0) requestAnimationFrame(volver);
        };
        volver();
      };
      volante.addEventListener('pointerup', soltar);
      volante.addEventListener('pointercancel', soltar);
      volante.addEventListener('lostpointercapture', soltar);
      if (esTactil) this._tactil.direccion = 0;
    }

    // Botones de un toque
    document.querySelectorAll('[data-toque]').forEach((boton) => {
      boton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._disparar('interaccion');
        this._disparar(boton.dataset.toque);
      });
    });

    // Evita el menú contextual al mantener presionado
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerdown', () => this._disparar('interaccion'));

    // Al primer toque intentamos pantalla completa y modo horizontal
    if (esTactil) {
      const pedirPantallaCompleta = () => {
        const el = document.documentElement;
        const p = el.requestFullscreen ? el.requestFullscreen() : null;
        if (p && p.then) {
          p.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
        }
      };
      window.addEventListener('pointerdown', pedirPantallaCompleta, { once: true });
    }
  }
}
