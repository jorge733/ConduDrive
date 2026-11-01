// ===========================================================
// ConduDrive - EL AUTO
// 1) Construye el auto low-poly con cajas y cilindros.
// 2) Simula su movimiento con física de verdad (simplificada):
//    - Modelo "bicicleta" dinámico: masa, inercia y neumáticos que
//      se deforman (ángulo de deriva) y pueden perder agarre.
//    - Traspaso de peso al frenar/acelerar (más agarre adelante al frenar).
//    - Motor con curva de torque, revoluciones y caja de 5 marchas
//      (automática o manual secuencial), freno motor y "creep".
//    - Frenos con ABS, freno de mano que bloquea las ruedas traseras,
//      control de estabilidad (ESC), resistencia del aire y rodadura.
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.auto;
const G = 9.81;
const PASO_FISICA = 1 / 150;     // la física avanza en pasos chicos (más estable)
const RAD_A_RPM = 60 / (2 * Math.PI);

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const suave = (a, b, x) => { const t = limitar((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Acerca "actual" a "objetivo" a cierta velocidad (por segundo)
const acercar = (actual, objetivo, vel) => actual + limitar(objetivo - actual, -vel, vel);

export class Auto {
  constructor(escena, colorCarroceria = 0xe63946) {
    // ----- Estado físico -----
    this.posicion = new THREE.Vector3(0, 0, 0);
    this.velocidad = new THREE.Vector2(0, 0); // velocidad en el suelo (x, z), mundo
    this.angulo = 0;            // hacia dónde mira el auto (radianes)
    this.giro = 0;              // ángulo actual de las ruedas delanteras (+ = derecha)
    this.velocidadGiro = 0;     // rapidez con que gira el auto (rad/s, + = derecha)
    this.velocidadAvance = 0;   // velocidad hacia adelante (negativa = marcha atrás)
    this.velocidadLateral = 0;  // velocidad de lado (derrape)
    this.aceleracionActual = 0; // aceleración longitudinal (m/s²), para el cabeceo
    this.aceleracionLateral = 0;// aceleración lateral (m/s²), para el balanceo
    this.frenando = false;
    this.lluvia = false;        // asfalto mojado = menos agarre
    this.esc = true;            // control de estabilidad

    // ----- Motor y caja -----
    this.cajaManual = false;
    this.marcha = 1;            // 'R', 'N' o 1..5
    this.rpm = C.rpmRalenti;
    this.acelerador = 0;        // pedal efectivo 0..1 (después de la lógica D/R)
    this.freno = 0;
    this._corteCambio = 0;      // tiempo sin torque mientras cambia de marcha
    this._tiempoInversion = 0;  // para pasar de D a R manteniendo el freno
    this._fuerzaMotor = 0;
    this.limitador = false;
    this._pedalNuevo = false;   // el pedal para invertir se pisó estando detenido
    this._pedalPrevio = false;

    // ----- Estado de los neumáticos (para sonido y marcas) -----
    this.deslizamiento = 0;     // 0 = todo agarrado, 1 = chirriando fuerte
    this.ruedasDeslizan = [false, false, false, false]; // DI, DD, TI, TD
    this.absActivo = false;
    this.escActivo = false;

    this._direccion = 0;        // posición del volante -1..1
    this._rollVel = 0; this._pitchVel = 0;
    this.alCambiarMarcha = null; // aviso para el sonido/HUD

    // ----- Intermitentes -----
    this.intermitente = null;   // null, 'izq' o 'der'
    this._tiempoParpadeo = 0;
    this._giroAcumulado = 0;    // para apagar el intermitente solo después de doblar
    this.intermitenteEncendido = false; // si la luz está prendida en este instante

    this._giroRuedas = 0;       // rotación visual de las ruedas

    this._construirModelo(escena, colorCarroceria);
  }

  // ===========================================================
  // MODELO 3D
  // ===========================================================
  _construirModelo(escena, color) {
    this.grupo = new THREE.Group();          // todo el auto
    this.carroceria = new THREE.Group();     // la parte que se inclina
    this.grupo.add(this.carroceria);

    const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.6, ...extra });
    const caja = (w, h, l, material, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.carroceria.add(m);
      return m;
    };

    const matCuerpo = mat(color, { roughness: 0.45, metalness: 0.1 });
    this.matCuerpo = matCuerpo;
    // Vidrio semitransparente: desde afuera se ve al conductor y al examinador
    const matVidrio = mat(0x3d5a78, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.62, depthWrite: false });
    const matNegro = mat(0x222222);

    // Carrocería baja y techo (el auto mira hacia +Z)
    caja(1.7, 0.55, 3.8, matCuerpo, 0, 0.6, 0);
    caja(1.66, 0.1, 1.2, matCuerpo, 0, 0.92, 1.25);    // capó
    this.vidrio = caja(1.5, 0.62, 1.9, matVidrio, 0, 1.185, -0.25); // cabina de vidrio
    this.vidrio.castShadow = false;
    this.techo = caja(1.54, 0.08, 1.74, matCuerpo, 0, 1.53, -0.27);  // techo
    // Pilares que sostienen el techo (se ven desde adentro y desde afuera)
    for (const x of [0.73, -0.73]) {
      const a = caja(0.06, 0.66, 0.07, matCuerpo, x, 1.2, 0.62);
      a.rotation.x = -0.25;
      caja(0.06, 0.62, 0.07, matCuerpo, x, 1.185, -1.17);
    }
    // Parachoques
    caja(1.76, 0.22, 0.2, matNegro, 0, 0.42, 1.92);
    caja(1.76, 0.22, 0.2, matNegro, 0, 0.42, -1.92);

    // Luces delanteras (siempre algo brillantes)
    const matFaro = mat(0xfff6d5, { emissive: 0xfff2b0, emissiveIntensity: 0.6 });
    caja(0.38, 0.14, 0.05, matFaro, -0.55, 0.7, 1.91);
    caja(0.38, 0.14, 0.05, matFaro, 0.55, 0.7, 1.91);

    // Luces de freno (se encienden al frenar)
    this.matFreno = mat(0x661111, { emissive: 0xff1a1a, emissiveIntensity: 0.15 });
    caja(0.4, 0.14, 0.05, this.matFreno, -0.55, 0.72, -1.91);
    caja(0.4, 0.14, 0.05, this.matFreno, 0.55, 0.72, -1.91);

    // Luces de retroceso (blancas, se encienden en reversa)
    this.matRetroceso = mat(0x777777, { emissive: 0xffffff, emissiveIntensity: 0 });
    caja(0.16, 0.1, 0.05, this.matRetroceso, -0.2, 0.72, -1.91);
    caja(0.16, 0.1, 0.05, this.matRetroceso, 0.2, 0.72, -1.91);

    // Intermitentes (naranjos), en las 4 esquinas.
    // Ojo: mirando el auto desde atrás, su IZQUIERDA es +X.
    this.matIntIzq = mat(0x7a4a00, { emissive: 0xffa000, emissiveIntensity: 0 });
    this.matIntDer = mat(0x7a4a00, { emissive: 0xffa000, emissiveIntensity: 0 });
    caja(0.18, 0.12, 0.06, this.matIntIzq, 0.8, 0.68, 1.9);
    caja(0.18, 0.12, 0.06, this.matIntIzq, 0.8, 0.72, -1.9);
    caja(0.18, 0.12, 0.06, this.matIntDer, -0.8, 0.68, 1.9);
    caja(0.18, 0.12, 0.06, this.matIntDer, -0.8, 0.72, -1.9);

    // ----- Ruedas -----
    const geoRueda = new THREE.CylinderGeometry(C.radioRueda, C.radioRueda, 0.24, 12);
    geoRueda.rotateZ(Math.PI / 2); // que el eje quede de lado
    const geoTapa = new THREE.BoxGeometry(0.26, 0.12, 0.36); // "rayo" para que se note el giro
    const matRueda = mat(0x1a1a1a, { roughness: 0.9 });
    const matTapa = mat(0xbfc5cc);

    this.ruedas = [];        // las 4 ruedas (giran al avanzar)
    this.pivotesDelanteros = []; // las 2 delanteras (doblan)
    const posiciones = [
      [0.78, 1.25, true], [-0.78, 1.25, true],
      [0.78, -1.25, false], [-0.78, -1.25, false]
    ];
    for (const [x, z, delantera] of posiciones) {
      const pivote = new THREE.Group();
      pivote.position.set(x, C.radioRueda, z);
      const rueda = new THREE.Mesh(geoRueda, matRueda);
      rueda.castShadow = true;
      const tapa = new THREE.Mesh(geoTapa, matTapa);
      rueda.add(tapa);
      pivote.add(rueda);
      this.grupo.add(pivote);
      this.ruedas.push(rueda);
      if (delantera) this.pivotesDelanteros.push(pivote);
    }

    escena.add(this.grupo);
  }

  // ===========================================================
  // INTERMITENTES
  // ===========================================================
  alternarIntermitente(lado) {
    // Si ya estaba ese lado, se apaga. Si no, se enciende ese lado.
    this.intermitente = this.intermitente === lado ? null : lado;
    this._tiempoParpadeo = 0;
    this._giroAcumulado = 0;
  }

  // ===========================================================
  // CAJA DE CAMBIOS
  // ===========================================================
  /** Texto para el HUD: D1..D5 / R en automática; N, R, 1..5 en manual */
  get textoMarcha() {
    if (this.marcha === 'R' || this.marcha === 'N') return this.marcha;
    return this.cajaManual ? String(this.marcha) : 'D' + this.marcha;
  }

  _relacionMarcha() {
    if (this.marcha === 'R') return -C.reversa;
    if (this.marcha === 'N') return 0;
    return C.cambios[this.marcha - 1];
  }

  _ponerMarcha(m) {
    if (m === this.marcha) return;
    const subio = typeof m === 'number' && typeof this.marcha === 'number' && m > this.marcha;
    this.marcha = m;
    this._corteCambio = subio ? 0.22 : 0.12;
    if (this.alCambiarMarcha) this.alCambiarMarcha(m);
  }

  /** Caja manual secuencial: +1 sube, -1 baja (R ← N ← 1 ← 2 ...). Devuelve un aviso si no se puede. */
  cambiarMarcha(dir) {
    if (!this.cajaManual) return null;
    const orden = ['R', 'N', 1, 2, 3, 4, 5];
    const i = orden.indexOf(this.marcha);
    const j = limitar(i + dir, 0, orden.length - 1);
    if (orden[j] === 'R' && this.velocidadAvance > 1) return 'Detente para poner reversa';
    if (this.marcha === 'R' && orden[j] === 'N' && this.velocidadAvance < -1) return 'Detente antes de sacar la reversa';
    // Bajar de marcha a demasiadas revoluciones dañaría el motor: no se permite
    if (typeof orden[j] === 'number' && dir < 0 && orden[j] > 0) {
      const rpm = Math.abs(this.velocidadAvance) / C.radioRueda * C.cambios[orden[j] - 1] * C.diferencial * RAD_A_RPM;
      if (rpm > C.rpmMax + 200) return '¡Muy rápido para bajar a ' + orden[j] + 'ª!';
    }
    this._ponerMarcha(orden[j]);
    return null;
  }

  ponerCajaManual(manual) {
    this.cajaManual = manual;
    if (!manual && this.marcha === 'N') this._ponerMarcha(1);
    if (manual && typeof this.marcha === 'number') return; // conserva la marcha actual
  }

  /** Decide pedales efectivos, marcha automática y fuerza del motor (una vez por cuadro) */
  _actualizarMotor(dt, ent) {
    const u = this.velocidadAvance;
    const parado = Math.abs(u) < 0.5;

    // --- Pedales y paso automático entre D y R ---
    let acel = ent.acelerador, freno = ent.freno;
    // Para cambiar entre D y R hay que estar detenido y volver a pisar el pedal
    // (así, si frenas hasta parar en un semáforo, el auto NO se va para atrás)
    const pedalInverso = this.marcha === 'R' ? ent.acelerador : ent.freno;
    if (pedalInverso < 0.05) this._pedalNuevo = false;
    else if (Math.abs(u) < 0.3 && !this._pedalPrevio) this._pedalNuevo = true; // pisado ya detenido (o casi)
    this._pedalPrevio = pedalInverso >= 0.05;
    if (!this.cajaManual) {
      if (this.marcha === 'R') {
        // En reversa: el pedal de "freno/atrás" acelera hacia atrás y el acelerador frena
        [acel, freno] = [ent.freno, ent.acelerador];
        if (parado && this._pedalNuevo && ent.acelerador > 0.3 && ent.freno < 0.05) this._tiempoInversion += dt;
        else this._tiempoInversion = 0;
        if (this._tiempoInversion > 0.2) { this._ponerMarcha(1); this._tiempoInversion = 0; this._pedalPrevio = true; }
      } else {
        if (parado && this._pedalNuevo && ent.freno > 0.3 && ent.acelerador < 0.05) this._tiempoInversion += dt;
        else this._tiempoInversion = 0;
        if (this._tiempoInversion > 0.6) { this._ponerMarcha('R'); this._tiempoInversion = 0; this._pedalPrevio = true; }
      }
    }
    this.acelerador = acel;
    this.freno = freno;

    // --- Revoluciones y torque ---
    const relacion = this._relacionMarcha();
    const relTotal = Math.abs(relacion) * C.diferencial;
    const rpmRuedas = Math.abs(u) / C.radioRueda * relTotal * RAD_A_RPM;
    if (this._corteCambio > 0) this._corteCambio -= dt;
    let pedal = this._corteCambio > 0 ? acel * 0.15 : acel;
    if (this.marcha === 'R') pedal *= 0.55; // en reversa se acelera con más cuidado

    let fuerza = 0, rpmMotor;
    if (relacion === 0) {
      // Neutro: el motor gira libre
      rpmMotor = C.rpmRalenti + pedal * (C.rpmMax - C.rpmRalenti);
      this.limitador = rpmMotor > C.rpmMax - 100;
    } else {
      // Mismo sentido de la marcha que el movimiento: el motor está "conectado" a las ruedas
      const mismoSentido = Math.sign(u) === Math.sign(relacion) || Math.abs(u) < 0.5;
      let rpm = mismoSentido ? rpmRuedas : 0;
      let multiplicador = 1;
      // A baja velocidad el embrague (o convertidor de torque) patina: el motor no baja del ralentí
      const rpmEmbrague = C.rpmRalenti + pedal * 1700;
      if (rpm < rpmEmbrague) {
        const patina = 1 - rpm / rpmEmbrague;
        if (!this.cajaManual) multiplicador = 1 + 0.9 * patina;        // convertidor multiplica torque
        else if (this.marcha >= 3) multiplicador = 1 - 0.65 * patina;  // partir en 3ª+ "ahoga" el motor
        rpm = rpmEmbrague;
      }
      let torque = 0;
      if (pedal > 0.01) torque = this._curvaTorque(rpm) * pedal;
      this.limitador = rpm >= (this.marcha === 'R' ? 3000 : C.rpmMax); // reversa limitada (~25 km/h)
      if (this.limitador) torque = 0;
      // Freno motor (al soltar el acelerador, el motor retiene)
      if (pedal < 0.05 && mismoSentido && rpmRuedas > C.rpmRalenti * 1.15) {
        torque -= 8 + rpmRuedas * C.frenoMotor;
      }
      // Automática en D/R: avanza sola despacito ("creep")
      if (!this.cajaManual && pedal < 0.05 && Math.abs(u) < 2.2) {
        torque += C.torqueArrastre * (1 - Math.abs(u) / 2.2);
      }
      fuerza = torque * multiplicador * relTotal * C.eficiencia / C.radioRueda * Math.sign(relacion);
      rpmMotor = Math.max(rpm, C.rpmRalenti);
    }
    this._fuerzaMotor = fuerza;
    // Las revoluciones del motor no saltan de golpe (inercia del motor)
    this.rpm += (rpmMotor - this.rpm) * Math.min(1, dt * 14);
    if (this.limitador) this.rpm = (this.marcha === 'R' ? 3000 : C.rpmMax) - Math.random() * 250; // tiritón del corte

    // --- Cambio automático ---
    if (!this.cajaManual && typeof this.marcha === 'number' && this._corteCambio <= 0) {
      const g = this.marcha;
      const subir = 2100 + 3900 * Math.pow(acel, 1.3);
      const bajar = 1150 + 1700 * acel;
      if (g < 5 && rpmRuedas > subir) this._ponerMarcha(g + 1);
      else if (g > 1 && rpmRuedas < bajar && u > 0) this._ponerMarcha(g - 1);
      else if (g > 1 && acel > 0.9 && rpmRuedas * C.cambios[g - 2] / C.cambios[g - 1] < 5300 && rpmRuedas < 3400) {
        this._ponerMarcha(g - 1); // "kickdown": pisar a fondo baja una marcha
      }
    }
  }

  _curvaTorque(rpm) {
    const x = (rpm - C.rpmTorqueMax) / 3200;
    return C.torqueMax * Math.max(0.35, 1 - 0.5 * x * x);
  }

  // ===========================================================
  // FÍSICA (se llama una vez por cuadro y se divide en pasos chicos)
  // ===========================================================
  actualizar(dt, controles) {
    const ent = controles.leer ? controles.leer(dt) : controles;

    // Recuperamos velocidad de avance/lateral desde la velocidad del mundo
    // (los choques la pueden haber cambiado)
    const sa = Math.sin(this.angulo), ca = Math.cos(this.angulo);
    this.velocidadAvance = this.velocidad.x * sa + this.velocidad.y * ca;
    this.velocidadLateral = this.velocidad.x * -ca + this.velocidad.y * sa;

    this._actualizarDireccion(dt, ent);
    this._actualizarMotor(dt, ent);

    const vAntes = this.velocidadAvance;
    const giroAntes = this.angulo;
    let restante = dt;
    this._deslizMax = 0;
    this._marcas = [false, false, false, false];
    while (restante > 1e-6) {
      const h = Math.min(PASO_FISICA, restante);
      this._paso(h, ent);
      restante -= h;
    }
    this._giroAcumulado += -(this.angulo - giroAntes);
    this.ruedasDeslizan = this._marcas;
    this.deslizamiento += (limitar(this._deslizMax, 0, 1) - this.deslizamiento) * Math.min(1, dt * 12);
    this.frenando = this.freno > 0.05 || ent.frenoMano;
    this._dvLong = (this.velocidadAvance - vAntes) / Math.max(dt, 1e-4);

    this._actualizarIntermitentes(dt);
    this._actualizarVisual(dt);
  }

  // Volante: con teclado se mueve de a poco; con volante táctil/joystick va directo
  _actualizarDireccion(dt, ent) {
    const u = Math.abs(this.velocidadAvance);
    const objetivo = limitar(ent.direccion || 0, -1, 1);
    if (ent.analogico) {
      this._direccion = acercar(this._direccion, objetivo, dt * 6);
    } else {
      // Más lento a alta velocidad (como un conductor real con cuidado)
      const vel = (objetivo === 0 ? 3.2 : 2.2) / (1 + u / 25);
      // Si cambia de lado, vuelve rápido al centro primero
      const v = objetivo !== 0 && Math.sign(objetivo) !== Math.sign(this._direccion) ? vel * 1.8 : vel;
      this._direccion = acercar(this._direccion, objetivo, v * dt);
    }
    // A más velocidad, menos ángulo de rueda para el mismo movimiento del volante
    const k = ent.analogico ? C.sensibilidadAnalogica : C.sensibilidadTeclado;
    const maxGiro = C.giroMax / (1 + (u * u) / k);
    this.giro = this._direccion * maxGiro;
  }

  /** Un paso de física de duración h */
  _paso(h, ent) {
    const m = C.masa, a = C.cgDelante, b = C.cgAtras, L = a + b;
    const mu = this.lluvia ? C.agarreLluvia : C.agarre;
    let u = this.velocidadAvance, v = this.velocidadLateral, r = this.velocidadGiro;
    const d = this.giro, cd = Math.cos(d), sd = Math.sin(d);

    // --- Peso sobre cada eje (al frenar se carga adelante) ---
    const traspaso = m * this.aceleracionActual * C.alturaCG / L;
    const fzD = limitar(m * G * b / L - traspaso, m * G * 0.15, m * G * 0.85);
    const fzT = m * G - fzD;
    const maxD = mu * fzD, maxT = mu * fzT;

    // --- Velocidad de cada neumático en su propio sentido ---
    const vyD0 = v + a * r;
    const vxD = u * cd + vyD0 * sd;
    const vyD = -u * sd + vyD0 * cd;
    const vxT = u, vyT = v - b * r;

    const curva = (alfa, fmax) => fmax * Math.sin(C.formaNeumatico * Math.atan(C.rigidezNeumatico * alfa));

    // --- Fuerza longitudinal delantera: motor (tracción delantera) ---
    let fxD = this._fuerzaMotor;
    let patinaD = false;
    this.escActivo = false;
    if (Math.abs(fxD) > maxD * 0.92) {
      // Con control de tracción (parte del ESC) el motor se modera y no patina
      patinaD = !this.esc;
      fxD = Math.sign(fxD) * maxD * (this.esc ? 0.92 : 0.75);
      if (this.esc) this.escActivo = true;
    }

    // --- Frenos con ABS ---
    const parado = Math.abs(u) < 0.35 && Math.abs(v) < 0.5;
    const frenoTotal = this.freno * C.frenoMax;
    let frenoD = frenoTotal * C.repartoFreno, frenoT = frenoTotal * (1 - C.repartoFreno);
    this.absActivo = false;
    if (frenoD > maxD * 0.95) { frenoD = maxD * 0.95; this.absActivo = true; }
    if (frenoT > maxT * 0.95) { frenoT = maxT * 0.95; this.absActivo = true; }

    // --- Fuerzas laterales (deriva de los neumáticos) ---
    const minV = 2.5; // evita divisiones locas a muy baja velocidad
    let fyD = -curva(Math.atan(vyD / Math.max(Math.abs(vxD), minV)), maxD);
    // Círculo de fricción: si usa agarre para acelerar/frenar, queda menos para doblar
    const longD = Math.abs(fxD) + frenoD;
    const latDispD = Math.sqrt(Math.max(maxD * maxD - longD * longD, (maxD * 0.35) ** 2));
    fyD = limitar(fyD, -latDispD, latDispD);

    let fyT, fxT = 0;
    const bloqueada = ent.frenoMano && Math.hypot(vxT, vyT) > 0.6;
    if (bloqueada) {
      // Ruedas traseras bloqueadas: resbalan en la dirección en que se mueven
      const vel = Math.hypot(vxT, vyT);
      const roce = maxT * 0.8;
      fyT = -roce * vyT / vel;
      fxT = -roce * vxT / vel;
    } else {
      fyT = -curva(Math.atan(vyT / Math.max(Math.abs(vxT), minV)), maxT);
      const latDispT = Math.sqrt(Math.max(maxT * maxT - frenoT * frenoT, (maxT * 0.35) ** 2));
      fyT = limitar(fyT, -latDispT, latDispT);
    }

    // --- Suma de fuerzas sobre el auto ---
    let fx = fxD * cd - fyD * sd + fxT;
    let fy = fxD * sd + fyD * cd + fyT;
    let mz = a * (fxD * sd + fyD * cd) - b * fyT;
    // Resistencia del aire y rodadura
    fx -= C.arrastreAire * u * Math.abs(u);
    fx -= C.rodadura * m * G * limitar(u / 0.3, -1, 1);

    // --- Control de estabilidad (ESC): corrige si la cola se va ---
    if (this.esc && !ent.frenoMano && Math.abs(u) > 4) {
      const rMax = (mu * G * 0.95) / Math.abs(u);
      const rDeseada = limitar(u * Math.tan(d) / (L + 0.0025 * u * u), -rMax, rMax);
      const exceso = r - rDeseada;
      const derivaTrasera = Math.atan(vyT / Math.abs(vxT));
      const sobreviraje = Math.sign(exceso) === Math.sign(r) || Math.sign(r) !== Math.sign(rDeseada);
      if (sobreviraje && Math.abs(exceso) > 0.08 && (Math.abs(derivaTrasera) > 0.07 || Math.abs(r) > rMax)) {
        mz -= limitar(exceso * 9000, -5500, 5500);
        fx -= Math.sign(u) * 1200; // frena un poco
        this.escActivo = true;
      }
    }

    // --- Integrar (2ª ley de Newton en el marco del auto) ---
    const du = fx / m + v * r;
    const dv = fy / m - u * r;
    const dr = mz / C.inercia;
    u += du * h; v += dv * h; r += dr * h;

    // Frenos: quitan velocidad sin pasarse para el otro lado
    if (frenoD + frenoT > 0 && !bloqueada) {
      const dec = (frenoD + frenoT) / m * h;
      u = Math.abs(u) <= dec ? 0 : u - Math.sign(u) * dec;
    }
    // Detenido con freno o freno de mano: el auto queda quieto
    if (parado && (this.freno > 0.05 || ent.frenoMano) && Math.abs(this._fuerzaMotor) < (this.freno * C.frenoMax + (ent.frenoMano ? 4000 : 0))) {
      u = 0; v *= 0.5; r *= 0.5;
    }

    // --- A muy baja velocidad el modelo pasa a ser "geométrico" (sin deriva) ---
    const w = suave(1.0, 4.5, Math.abs(u));
    const rCin = u * Math.tan(d) / L, vCin = rCin * b;
    const t = (1 - w) * Math.min(1, 25 * h);
    r += (rCin - r) * t;
    v += (vCin - v) * t;

    // Guardar
    this.aceleracionActual += ((du - v * r) - this.aceleracionActual) * Math.min(1, 10 * h);
    this.aceleracionLateral += ((dv + u * r) - this.aceleracionLateral) * Math.min(1, 10 * h);
    this.velocidadAvance = u;
    this.velocidadLateral = v;
    this.velocidadGiro = r;
    this.angulo -= r * h;

    const sa = Math.sin(this.angulo), ca = Math.cos(this.angulo);
    this.velocidad.set(sa * u - ca * v, ca * u + sa * v);
    this.posicion.x += this.velocidad.x * h;
    this.posicion.z += this.velocidad.y * h;

    // --- ¿Chirrían los neumáticos? (para sonido y marcas en el piso) ---
    const deslD = Math.abs(vyD) > 2.2 || (patinaD && Math.abs(u) < 14);
    const deslT = Math.abs(vyT) > 2.2 || (bloqueada && Math.abs(u) > 1.5);
    const nivel = Math.max(
      (Math.abs(vyD) - 1.5) / 4, (Math.abs(vyT) - 1.5) / 4,
      bloqueada ? Math.abs(u) / 8 : 0,
      patinaD ? 0.6 : 0,
      this.absActivo && this.freno > 0.6 ? Math.min(Math.abs(u) / 20, 0.3) : 0
    );
    this._deslizMax = Math.max(this._deslizMax, nivel);
    if (deslD) this._marcas[0] = this._marcas[1] = true;
    if (deslT) this._marcas[2] = this._marcas[3] = true;
  }

  /** Lo llama el sistema de choques: un golpe descentrado hace girar el auto */
  impulsoChoque(palancaX, palancaZ, dvx, dvz) {
    const cruz = palancaX * dvz - palancaZ * dvx;
    this.velocidadGiro += cruz * C.masa / C.inercia * 0.35;
    this.velocidadGiro *= 0.8;
  }

  /** Detiene el auto por completo (para reiniciar la posición) */
  detener() {
    this.velocidad.set(0, 0);
    this.velocidadAvance = this.velocidadLateral = this.velocidadGiro = 0;
    this.aceleracionActual = this.aceleracionLateral = 0;
    this._direccion = 0; this.giro = 0;
    if (!this.cajaManual) this.marcha = 1;
  }

  /** Posición en el mundo de cada rueda: 0 DI, 1 DD, 2 TI, 3 TD (izquierda = +X local) */
  posicionRueda(i, salida = { x: 0, z: 0 }) {
    const lx = i % 2 === 0 ? 0.78 : -0.78, lz = i < 2 ? 1.25 : -1.25;
    const sa = Math.sin(this.angulo), ca = Math.cos(this.angulo);
    salida.x = this.posicion.x + ca * lx + sa * lz;
    salida.z = this.posicion.z - sa * lx + ca * lz;
    return salida;
  }

  // Apaga solo el intermitente después de completar un giro (como un auto real)
  _actualizarIntermitentes(dt) {
    const antes = this.intermitenteEncendido;
    if (!this.intermitente) {
      this.intermitenteEncendido = false;
    } else {
      this._tiempoParpadeo += dt;
      this.intermitenteEncendido = (this._tiempoParpadeo % 0.7) < 0.38;
      // Si ya giró más de ~50° y el volante volvió al centro, se apaga
      if (Math.abs(this._giroAcumulado) > 0.9 && Math.abs(this._direccion) < 0.1) {
        this.intermitente = null;
        this.intermitenteEncendido = false;
      }
    }
    if (antes !== this.intermitenteEncendido && this.alParpadear) this.alParpadear(this.intermitenteEncendido);
  }

  // ===========================================================
  // ACTUALIZAR LO QUE SE VE
  // ===========================================================
  _actualizarVisual(dt) {
    this.grupo.position.copy(this.posicion);
    this.grupo.rotation.y = this.angulo;

    // Ruedas: giran según la distancia recorrida
    this._giroRuedas += (this.velocidadAvance * dt) / C.radioRueda;
    for (const r of this.ruedas) r.rotation.x = this._giroRuedas;
    // Ruedas delanteras: doblan con el volante
    for (const p of this.pivotesDelanteros) p.rotation.y = -this.giro;

    // Carrocería sobre resortes: se inclina al frenar/acelerar y al doblar (y rebota un poco)
    const objPitch = limitar(-this.aceleracionActual * 0.006, -0.06, 0.06);
    const objRoll = limitar(-this.aceleracionLateral * 0.0065, -0.07, 0.07);
    const cr = this.carroceria.rotation;
    this._pitchVel += (140 * (objPitch - cr.x) - 13 * this._pitchVel) * dt;
    this._rollVel += (120 * (objRoll - cr.z) - 12 * this._rollVel) * dt;
    cr.x += this._pitchVel * dt;
    cr.z += this._rollVel * dt;

    // Luces de freno
    this.matFreno.emissiveIntensity = this.frenando ? 2.2 : 0.15;
    this.matRetroceso.emissiveIntensity = this.marcha === 'R' ? 1.6 : 0;

    // Intermitentes
    const on = this.intermitenteEncendido;
    this.matIntIzq.emissiveIntensity = on && this.intermitente === 'izq' ? 2.5 : 0;
    this.matIntDer.emissiveIntensity = on && this.intermitente === 'der' ? 2.5 : 0;
  }

  // Velocidad en km/h (para el velocímetro)
  get kmh() { return Math.abs(this.velocidadAvance) * 3.6; }

  // Puntos (círculos) que representan al auto para los choques
  puntosChoque() {
    const ax = Math.sin(this.angulo), az = Math.cos(this.angulo);
    const d = 1.05;
    return [
      { x: this.posicion.x + ax * d, z: this.posicion.z + az * d },
      { x: this.posicion.x - ax * d, z: this.posicion.z - az * d }
    ];
  }
}
