// ===========================================================
// ConduDrive - CONTROLES
// Lee el teclado (computador) y los botones táctiles (celular)
// y los convierte en un "estado" simple que el auto entiende.
// ===========================================================

export class Controles {
  constructor() {
    // Botones que se MANTIENEN apretados
    this.estado = {
      acelerar: false,
      frenar: false,
      izquierda: false,
      derecha: false,
      frenoMano: false
    };
    // Acciones de un solo toque (intermitentes, cámara)
    this.alPulsar = {};       // ej: this.alPulsar.camara = () => {...}

    // Se guardan por separado teclado y táctil para que no se pisen
    this._teclado = {};
    this._tactil = {};

    this._configurarTeclado();
    this._configurarTactil();
  }

  // Permite registrar qué hacer cuando se pulsa una acción
  on(accion, funcion) { this.alPulsar[accion] = funcion; }

  _disparar(accion) {
    if (this.alPulsar[accion]) this.alPulsar[accion]();
  }

  _actualizar() {
    for (const clave of Object.keys(this.estado)) {
      this.estado[clave] = !!(this._teclado[clave] || this._tactil[clave]);
    }
  }

  // ---------- Teclado ----------
  _configurarTeclado() {
    // Qué tecla hace qué
    const mapa = {
      ArrowUp: 'acelerar',   KeyW: 'acelerar',
      ArrowDown: 'frenar',   KeyS: 'frenar',
      ArrowLeft: 'izquierda', KeyA: 'izquierda',
      ArrowRight: 'derecha',  KeyD: 'derecha',
      Space: 'frenoMano'
    };
    const toques = { KeyQ: 'intIzq', KeyE: 'intDer', KeyC: 'camara' };

    window.addEventListener('keydown', (e) => {
      if (mapa[e.code]) {
        this._teclado[mapa[e.code]] = true;
        this._actualizar();
        e.preventDefault();
      } else if (toques[e.code] && !e.repeat) {
        this._disparar(toques[e.code]);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (mapa[e.code]) {
        this._teclado[mapa[e.code]] = false;
        this._actualizar();
      }
    });
    // Si la ventana pierde el foco, soltamos todo (evita autos "pegados")
    window.addEventListener('blur', () => {
      this._teclado = {};
      this._tactil = {};
      this._actualizar();
    });
  }

  // ---------- Pantalla táctil ----------
  _configurarTactil() {
    // ¿Es un dispositivo táctil? Si lo es, mostramos los botones
    const esTactil = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (esTactil) document.body.classList.add('tactil');

    // Botones que se mantienen (pedales y giro). Se permiten varios dedos a la vez.
    document.querySelectorAll('[data-mantener]').forEach((boton) => {
      const accion = boton.dataset.mantener;
      const apretar = (e) => {
        e.preventDefault();
        boton.setPointerCapture?.(e.pointerId);
        this._tactil[accion] = true;
        boton.classList.add('activo');
        this._actualizar();
      };
      const soltar = (e) => {
        e.preventDefault();
        this._tactil[accion] = false;
        boton.classList.remove('activo');
        this._actualizar();
      };
      boton.addEventListener('pointerdown', apretar);
      boton.addEventListener('pointerup', soltar);
      boton.addEventListener('pointercancel', soltar);
      boton.addEventListener('lostpointercapture', soltar);
    });

    // Botones de un toque
    document.querySelectorAll('[data-toque]').forEach((boton) => {
      boton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._disparar(boton.dataset.toque);
      });
    });

    // Evita el menú contextual al mantener presionado
    window.addEventListener('contextmenu', (e) => e.preventDefault());

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
