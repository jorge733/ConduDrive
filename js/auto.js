// ===========================================================
// ConduDrive - EL AUTO
// 1) Construye el auto low-poly con cajas y cilindros.
// 2) Calcula su movimiento (física arcade hecha a mano).
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.auto;

export class Auto {
  constructor(escena, colorCarroceria = 0xe63946) {
    // ----- Estado físico -----
    this.posicion = new THREE.Vector3(0, 0, 0);
    this.velocidad = new THREE.Vector2(0, 0); // velocidad en el suelo (x, z)
    this.angulo = 0;            // hacia dónde mira el auto (radianes)
    this.giro = 0;              // ángulo actual de las ruedas delanteras (+ = derecha)
    this.velocidadAvance = 0;   // velocidad hacia adelante (negativa = marcha atrás)
    this.aceleracionActual = 0; // para inclinar la carrocería
    this.frenando = false;
    this.lluvia = false;        // se usará en el "modo pesadilla"

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
    const matVidrio = mat(0x2b3d52, { roughness: 0.15, metalness: 0.3 });
    const matNegro = mat(0x222222);

    // Carrocería baja y techo (el auto mira hacia +Z)
    caja(1.7, 0.55, 3.8, matCuerpo, 0, 0.6, 0);
    caja(1.66, 0.12, 1.2, matCuerpo, 0, 0.92, 1.25);   // capó levantado un poco
    caja(1.5, 0.5, 1.9, matVidrio, 0, 1.12, -0.25);     // cabina de vidrio
    caja(1.54, 0.08, 1.7, matCuerpo, 0, 1.4, -0.3);     // techo
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
  // FÍSICA (se llama ~60 veces por segundo)
  // ===========================================================
  actualizar(dt, controles) {
    const e = controles.estado;

    // Direcciones del auto: "adelante" y "derecha" en el suelo
    let adelante = new THREE.Vector2(Math.sin(this.angulo), Math.cos(this.angulo));
    let derecha = new THREE.Vector2(-Math.cos(this.angulo), Math.sin(this.angulo));

    // Separamos la velocidad en "hacia adelante" y "de lado" (derrape)
    let vAvance = this.velocidad.dot(adelante);
    let vLateral = this.velocidad.dot(derecha);
    const vAntes = vAvance;

    // ----- Acelerador y freno -----
    this.frenando = false;
    if (e.acelerar && !e.frenar) {
      if (vAvance < -0.3) {
        // Íbamos hacia atrás: el acelerador primero frena
        vAvance = Math.min(0, vAvance + C.frenado * dt);
        this.frenando = true;
      } else {
        // Acelera, pero cada vez menos al acercarse a la velocidad máxima
        const factor = 1 - Math.pow(Math.max(0, vAvance) / C.velocidadMax, 2);
        vAvance += C.aceleracion * factor * dt;
      }
    } else if (e.frenar && !e.acelerar) {
      if (vAvance > 0.3) {
        // Frenar
        vAvance = Math.max(0, vAvance - C.frenado * dt);
        this.frenando = true;
      } else {
        // Detenidos (o casi): marcha atrás, más lenta
        const factor = 1 - Math.pow(Math.max(0, -vAvance) / C.velocidadMaxReversa, 2);
        vAvance -= C.aceleracionReversa * factor * dt;
      }
    } else {
      // Sin pedales: el auto se va deteniendo solito
      const freno = (C.rozamiento + Math.abs(vAvance) * 0.02) * dt;
      vAvance = Math.abs(vAvance) <= freno ? 0 : vAvance - Math.sign(vAvance) * freno;
    }

    // ----- Freno de mano -----
    if (e.frenoMano) {
      const freno = C.frenoMano * dt;
      vAvance = Math.abs(vAvance) <= freno ? 0 : vAvance - Math.sign(vAvance) * freno;
      this.frenando = true;
    }

    // ----- Volante -----
    // A más velocidad, menos ángulo de giro (para que no sea nervioso en recta)
    const entrada = (e.derecha ? 1 : 0) - (e.izquierda ? 1 : 0);
    const giroMaxActual = C.giroMax / (1 + Math.abs(vAvance) / 14);
    const objetivo = entrada * giroMaxActual;
    const paso = C.velocidadVolante * dt;
    if (entrada === 0) {
      // Al soltar, el volante vuelve al centro un poco más rápido
      this.giro += THREE.MathUtils.clamp(-this.giro, -paso * 1.6, paso * 1.6);
    } else {
      this.giro += THREE.MathUtils.clamp(objetivo - this.giro, -paso, paso);
    }

    // ----- Girar el auto -----
    // Modelo "bicicleta": cuanto más rápido y más giro, más dobla.
    // Si está detenido (vAvance = 0) NO gira. Igual que en la vida real.
    const velocidadGiro = (vAvance / C.distanciaEjes) * Math.tan(this.giro);
    this.angulo -= velocidadGiro * dt;
    this._giroAcumulado += velocidadGiro * dt;

    // ----- Agarre de los neumáticos -----
    // El deslizamiento lateral se "come" según el agarre disponible
    let agarre = this.lluvia ? C.agarreLluvia : C.agarre;
    if (e.frenoMano) agarre = C.agarreFrenoMano;
    vLateral *= Math.exp(-agarre * dt);

    // Recalculamos direcciones con el nuevo ángulo y armamos la velocidad
    adelante.set(Math.sin(this.angulo), Math.cos(this.angulo));
    derecha.set(-Math.cos(this.angulo), Math.sin(this.angulo));
    this.velocidad.set(
      adelante.x * vAvance + derecha.x * vLateral,
      adelante.y * vAvance + derecha.y * vLateral
    );

    // ----- Mover -----
    this.posicion.x += this.velocidad.x * dt;
    this.posicion.z += this.velocidad.y * dt;

    this.velocidadAvance = vAvance;
    this.aceleracionActual = THREE.MathUtils.lerp(this.aceleracionActual, (vAvance - vAntes) / Math.max(dt, 0.001), 0.1);
    this._velocidadGiro = velocidadGiro;

    this._actualizarIntermitentes(dt);
    this._actualizarVisual(dt);
  }

  // Apaga solo el intermitente después de completar un giro (como un auto real)
  _actualizarIntermitentes(dt) {
    if (!this.intermitente) {
      this.intermitenteEncendido = false;
    } else {
      this._tiempoParpadeo += dt;
      this.intermitenteEncendido = (this._tiempoParpadeo % 0.7) < 0.38;
      // Si ya giró más de ~50° y el volante volvió al centro, se apaga
      if (Math.abs(this._giroAcumulado) > 0.9 && Math.abs(this.giro) < 0.05) {
        this.intermitente = null;
        this.intermitenteEncendido = false;
      }
    }
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

    // Carrocería: se inclina un poquito al acelerar/frenar y al doblar
    const cabeceo = THREE.MathUtils.clamp(-this.aceleracionActual * 0.006, -0.05, 0.05);
    const balanceo = THREE.MathUtils.clamp(this._velocidadGiro * this.velocidadAvance * 0.004, -0.06, 0.06);
    this.carroceria.rotation.x = THREE.MathUtils.lerp(this.carroceria.rotation.x, cabeceo, 0.15);
    this.carroceria.rotation.z = THREE.MathUtils.lerp(this.carroceria.rotation.z, balanceo, 0.15);

    // Luces de freno
    this.matFreno.emissiveIntensity = this.frenando ? 2.2 : 0.15;

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
