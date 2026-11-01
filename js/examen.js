// ===========================================================
// ConduDrive - EXAMEN PRÁCTICO DE CONDUCCIÓN
//
// El examinador da instrucciones (en pantalla y en voz alta) y
// recorre contigo el pueblo. Partes con 100 puntos:
//   - Falta LEVE ........ −3 puntos  (ej: no señalizar un viraje)
//   - Falta GRAVE ....... −10 puntos (ej: choque leve, pista contraria)
//   - Falta ELIMINATORIA: reprueba al instante (ej: luz roja, PARE, atropello)
// Apruebas si terminas el recorrido con 75 puntos o más.
//
// Recorrido: estacionamiento → semáforo → paso de cebra → PARE →
// CEDA EL PASO → rotonda → zona escolar → estacionar en paralelo →
// semáforo (viraje a la izquierda) → volver a estacionar en tu lugar.
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CALLES, ROTONDA, PUNTOS } from './ciudad.js';

export const PUNTAJE_INICIAL = 100;
export const PUNTAJE_APROBAR = 75;
export const DESCUENTO = { leve: 3, grave: 10, eliminatoria: 0 };
const TIEMPO_MAXIMO = 15 * 60; // segundos para todo el examen
const MEDIA_PISTA = CONFIG.ciudad.anchoCalle / 4;

/** Límite de velocidad (km/h) según la zona del pueblo */
export function limiteEn(x, z) {
  const L = CONFIG.limites, ze = PUNTOS.zonaEscolar;
  if (Math.abs(x + 50) < 20 && Math.abs(z + 50) < 20) return L.estacionamiento;
  if (Math.abs(z - ze.z) < 6 && x < ze.desdeX + 4 && x > ze.hastaX - 4) return L.zonaEscolar;
  return L.urbano;
}

// ----- Recorrido del examen -----
// Cada etapa tiene una instrucción y puntos por los que hay que pasar (en orden),
// o un lugar donde estacionar.
const ETAPAS = [
  { texto: 'Salga del estacionamiento y doble a la izquierda.', puntos: [[-50, -37], [-37, -22.5]] },
  { texto: 'Siga derecho. Atención al semáforo.', puntos: [[-14, -22.5]] },
  { texto: 'Viene un paso de cebra: ceda el paso a los peatones.', puntos: [[10, -22.5]] },
  { texto: 'En el disco PARE, deténgase por completo y luego siga derecho.', puntos: [[36, -22.5]] },
  { texto: 'En el CEDA EL PASO, doble a la derecha.', puntos: [[64, -22.5], [72.5, -10]] },
  { texto: 'En la próxima esquina, doble a la derecha.', puntos: [[72.5, 13], [60, 22.5]] },
  { texto: 'Entre a la rotonda cediendo el paso y tome la segunda salida, siguiendo derecho.', puntos: [[43, 22.5], [9, 22.5]] },
  { texto: 'Zona escolar: no supere los 30 kilómetros por hora.', puntos: [[-13, 22.5]] },
  { texto: 'En la esquina, doble a la derecha.', puntos: [[-23, 17]] },
  {
    texto: 'Estaciónese en paralelo, entre los dos autos de su derecha.',
    estacionar: { x: -21.15, z: 0, tolLado: 0.5, tolLargo: 1.5, ancho: 2.1, largo: 6.6, sentido: -1 },
    tiempo: 150, nombre: 'estacionamiento en paralelo'
  },
  { texto: 'Muy bien. Salga señalizando, siga derecho y en el semáforo doble a la izquierda.', puntos: [[-22.5, -12], [-37, -27.5]], salirDeParalelo: true },
  { texto: 'Doble a la derecha para entrar al estacionamiento.', puntos: [[-50, -39]] },
  {
    texto: 'Para terminar, estaciónese en su lugar original: el espacio libre.',
    estacionar: { x: -50, z: -65, tolLado: 0.6, tolLargo: 1.3, ancho: 2.9, largo: 5.4, sentido: 0 },
    tiempo: 150, nombre: 'estacionamiento final'
  }
];

// Cruces (para revisar intermitentes): todos los de la cuadrícula menos la rotonda,
// más la salida/entrada del estacionamiento
const CRUCES = [];
for (const x of CALLES) for (const z of CALLES) {
  if (x === ROTONDA.x && z === ROTONDA.z) continue;
  CRUCES.push({ x0: x - 7, x1: x + 7, z0: z - 7, z1: z + 7 });
}
CRUCES.push({ x0: -57, x1: -43, z0: -34, z1: -19 }); // salida del estacionamiento

const envolver = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Examen {
  /**
   * @param o { escena, auto, semaforo, peatones, trafico, interior, sonido, alAvisar(texto, ms), alTerminar(resultado) }
   */
  constructor(o) {
    Object.assign(this, o);
    this.activo = false;
    this.voz = true;
    this._crearMarcadores();
    this._crearUI();
  }

  // ===========================================================
  // INICIO / FIN
  // ===========================================================
  iniciar() {
    this.activo = true;
    this.terminado = false;
    this.puntaje = PUNTAJE_INICIAL;
    this.faltas = [];          // { tipo, texto, puntos, t }
    this.tiempo = 0;
    this.etapa = -1;
    this.punto = 0;
    this._ultimas = {};        // para no repetir la misma falta seguida
    this._cruce = null;
    this._ultIzq = -99; this._ultDer = -99;
    this._exceso = 0; this._excesoMarcado = null;
    this._contraria = 0; this._contrariaMarcada = false;
    this._desliz = 0;
    this._lineas = new Map();  // distancia previa a cada línea (semáforo, PARE, CEDA)
    this._minVelPare = new Map();
    this._rotonda = null;
    this._enCebra = false;
    this._retroceso = 0;
    this._quieto = 0;
    this.ui.panel.classList.add('visible');
    this._pintarFaltas();
    this._siguienteEtapa();
  }

  abandonar() {
    if (!this.activo) return;
    this._terminar(false, 'Examen abandonado');
  }

  _terminar(completo, motivo = null) {
    this.activo = false;
    this.terminado = true;
    this._ocultarMarcadores();
    this.ui.panel.classList.remove('visible');
    const eliminada = this.faltas.find((f) => f.tipo === 'eliminatoria');
    const aprobado = completo && !eliminada && this.puntaje >= PUNTAJE_APROBAR;
    const resultado = {
      aprobado, completo, puntaje: Math.max(0, this.puntaje), tiempo: this.tiempo,
      faltas: this.faltas.slice(),
      motivo: motivo || (eliminada ? eliminada.texto : (!aprobado ? `Puntaje menor a ${PUNTAJE_APROBAR}` : null))
    };
    this._decir(aprobado ? '¡Felicitaciones! Aprobó el examen.' : 'Lo siento, no aprobó el examen esta vez.');
    if (this.alTerminar) this.alTerminar(resultado);
  }

  // ===========================================================
  // FALTAS
  // ===========================================================
  /** Registra una falta. "clave" evita repetirla antes de "espera" segundos. */
  falta(tipo, texto, clave = texto, espera = 3) {
    if (!this.activo) return;
    if (this._ultimas[clave] !== undefined && this.tiempo - this._ultimas[clave] < espera) return;
    this._ultimas[clave] = this.tiempo;
    const puntos = DESCUENTO[tipo];
    this.puntaje -= puntos;
    this.faltas.push({ tipo, texto, puntos, t: this.tiempo });
    this._pintarFaltas({ tipo, texto, puntos });
    if (this.sonido) this.sonido.pitido();
    this._reaccionExaminador();
    if (tipo === 'eliminatoria') {
      this._decir('Falta eliminatoria. ' + texto + '. Detenga el vehículo; el examen terminó.');
      this._terminar(false, texto);
    } else if (tipo === 'grave') {
      this._decir(texto);
    }
  }

  // ===========================================================
  // ETAPAS DEL RECORRIDO
  // ===========================================================
  _siguienteEtapa() {
    this.etapa++;
    this.punto = 0;
    if (this.etapa >= ETAPAS.length) { this._terminar(true); return; }
    const e = ETAPAS[this.etapa];
    this._tiempoEtapa = 0;
    this._quieto = 0;
    this._desvioMarcado = false;
    this._inicioTramo = { x: this.auto.posicion.x, z: this.auto.posicion.z };
    this.ui.instruccion.textContent = e.texto;
    this.ui.instruccion.classList.remove('nueva');
    void this.ui.instruccion.offsetWidth; // reinicia la animación
    this.ui.instruccion.classList.add('nueva');
    this._decir(e.texto);
    if (e.salirDeParalelo) this._salidaParalelo = { x: this.auto.posicion.x, z: this.auto.posicion.z, senalizo: false };
    this._ponerMarcadores();
  }

  get objetivo() {
    const e = ETAPAS[this.etapa];
    if (!e) return null;
    if (e.estacionar) return { x: e.estacionar.x, z: e.estacionar.z };
    const p = e.puntos[this.punto];
    return { x: p[0], z: p[1] };
  }

  /** Puntos que faltan, para dibujar la ruta en el minimapa */
  get rutaPendiente() {
    if (!this.activo) return [];
    const r = [];
    for (let i = this.etapa; i < ETAPAS.length; i++) {
      const e = ETAPAS[i];
      if (e.estacionar) r.push([e.estacionar.x, e.estacionar.z]);
      else e.puntos.forEach((p, k) => { if (i > this.etapa || k >= this.punto) r.push(p); });
    }
    return r;
  }

  _revisarEtapa(dt) {
    const e = ETAPAS[this.etapa], a = this.auto, p = a.posicion;
    this._tiempoEtapa += dt;
    if (e.estacionar) { this._revisarEstacionamiento(e, dt); return; }
    const [px, pz] = e.puntos[this.punto];
    if (Math.hypot(p.x - px, p.z - pz) < 6) {
      this.punto++;
      this._inicioTramo = { x: px, z: pz };
      if (this.punto >= e.puntos.length) this._siguienteEtapa();
      else this._ponerMarcadores();
      return;
    }
    // ¿Se fue lejos del recorrido indicado?
    const d = distSegmento(p.x, p.z, this._inicioTramo.x, this._inicioTramo.z, px, pz);
    if (d > 28 && !this._desvioMarcado) {
      this._desvioMarcado = true;
      this.falta('leve', 'Se desvió del recorrido indicado', 'desvio' + this.etapa, 999);
      this._decir('Vuelva al recorrido, por favor.');
    }
  }

  _revisarEstacionamiento(e, dt) {
    const s = e.estacionar, a = this.auto, p = a.posicion;
    // El lugar está alineado con el eje Z: "largo" en Z y "lado" en X
    const lado = Math.abs(p.x - s.x), largo = Math.abs(p.z - s.z);
    const cz = Math.cos(a.angulo);
    const alineado = s.sentido === 0 ? Math.abs(cz) > 0.975 : cz * s.sentido > 0.975;
    const dentro = lado < s.tolLado && largo < s.tolLargo && alineado;
    this._marcaLugar.material.color.setHex(dentro ? 0x33ff66 : 0xffd23f);
    if (dentro && a.kmh < 0.5) this._quieto += dt; else this._quieto = 0;
    const restante = Math.max(0, e.tiempo - this._tiempoEtapa);
    this.ui.extra.textContent = dentro
      ? (a.kmh < 0.5 ? 'Quédese detenido…' : '¡Ahí! Deténgase')
      : `Tiempo para estacionar: ${Math.ceil(restante)} s`;
    if (this._quieto > 1.5) {
      this.ui.extra.textContent = '';
      this.alAvisar('✅ ¡Bien estacionado!', 1500);
      this._siguienteEtapa();
    } else if (restante <= 0) {
      this.ui.extra.textContent = '';
      this.falta('grave', 'No logró el ' + e.nombre + ' a tiempo', 'est' + this.etapa, 999);
      if (this.activo) this._siguienteEtapa();
    }
  }

  // ===========================================================
  // REVISIÓN DE REGLAS (cada cuadro)
  // ===========================================================
  actualizar(dt) {
    if (!this.activo) return;
    this.tiempo += dt;
    const a = this.auto;
    if (a.intermitente === 'izq') this._ultIzq = this.tiempo;
    if (a.intermitente === 'der') this._ultDer = this.tiempo;

    this._revisarEtapa(dt);
    if (!this.activo) return;
    this._revisarSemaforoYSenales(dt);
    this._revisarCebra();
    this._revisarCruces();
    this._revisarRotonda(dt);
    this._revisarVelocidad(dt);
    this._revisarPista(dt);
    this._revisarConduccion(dt);
    this._revisarSalidaParalelo();

    if (this.tiempo > TIEMPO_MAXIMO && this.activo) this.falta('eliminatoria', 'Se acabó el tiempo del examen');
    this._actualizarMarcadores(dt);
    this._actualizarUI();
  }

  /** Lo llama el juego cuando hay un choque */
  registrarChoque(choque) {
    if (!this.activo || !choque) return;
    if (choque.tipo === 'peaton') return this.falta('eliminatoria', 'Atropelló a un peatón');
    if (choque.tipo === 'vereda') {
      if (choque.fuerza > 1.5) this.falta('leve', 'Se subió o golpeó la solera', 'vereda', 2.5);
      return;
    }
    if (choque.fuerza > 7) return this.falta('eliminatoria', 'Chocó fuertemente');
    if (choque.fuerza > 0.8) {
      const que = choque.tipo === 'barrera' ? 'la barrera' : 'otro vehículo';
      this.falta('grave', 'Chocó ' + que, 'choque', 2);
    }
  }

  /** Pedir ayuda (reubicar el auto) cuesta una falta grave */
  registrarAyuda() {
    this.falta('grave', 'Necesitó ayuda del examinador (reubicar el auto)', 'ayuda', 1);
  }

  // ----- Semáforo, PARE y CEDA EL PASO: cruces de líneas -----
  _revisarSemaforoYSenales(dt) {
    const a = this.auto, p = a.posicion;
    // Semáforo (las 4 aproximaciones)
    for (const ap of this.semaforo.aproximaciones) {
      const cruzo = this._cruzoLinea('sem' + ap.d.x + ap.d.z, ap.linea, ap.d, ap.r);
      if (!cruzo) continue;
      const luz = this.semaforo.estado(ap.eje);
      if (luz === 'rojo') this.falta('eliminatoria', 'Cruzó con luz roja');
      else if (luz === 'amarillo' && this.semaforo.tiempo > 1.2 && a.kmh > 15) {
        this.falta('leve', 'Cruzó con luz amarilla pudiendo detenerse', 'amarillo', 5);
      }
    }
    // PARE (ambos sentidos del cruce 25,-25)
    for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }]) {
      const r = { x: -d.z, z: d.x }, c = PUNTOS.pare;
      const linea = { x: c.x - d.x * 6.2 + r.x * 2.5, z: c.z - d.z * 6.2 + r.z * 2.5 };
      const clave = 'pare' + d.x;
      // Mientras se acerca, guarda la velocidad mínima
      const rx = p.x - linea.x, rz = p.z - linea.z;
      const antes = rx * d.x + rz * d.z, lado = Math.abs(rx * r.x + rz * r.z);
      if (antes > -14 && antes < 0.5 && lado < 3) {
        this._minVelPare.set(clave, Math.min(this._minVelPare.get(clave) ?? 999, a.kmh));
      } else if (antes < -16 || antes > 6) this._minVelPare.delete(clave);
      // El frente del auto cruza la línea
      if (this._cruzoLinea(clave, linea, d, r, 1.9)) {
        if ((this._minVelPare.get(clave) ?? 999) > 1.5) this.falta('eliminatoria', 'No se detuvo en el disco PARE');
        else this._revisarCeder(d, c, 'No cedió el paso después del PARE');
        this._minVelPare.delete(clave);
      }
    }
    // CEDA EL PASO (cruce 75,-25, llegando por el oeste)
    {
      const d = { x: 1, z: 0 }, r = { x: 0, z: 1 }, c = PUNTOS.ceda;
      const linea = { x: c.x - 6.2, z: c.z + 2.5 };
      if (this._cruzoLinea('ceda', linea, d, r, 1.9)) {
        this._revisarCeder(d, c, 'No cedió el paso en el CEDA EL PASO');
        if (a.kmh > 25) this.falta('leve', 'Llegó al CEDA EL PASO a velocidad excesiva', 'cedaVel', 10);
      }
    }
  }

  /**
   * ¿El auto cruzó la línea en el sentido d este cuadro?
   * "adelanto" = qué punto del auto se mide (1,9 = el parachoques delantero).
   */
  _cruzoLinea(clave, linea, d, r, adelanto = 0) {
    const a = this.auto;
    const fx = Math.sin(a.angulo), fz = Math.cos(a.angulo);
    const px = a.posicion.x + fx * adelanto, pz = a.posicion.z + fz * adelanto;
    const rx = px - linea.x, rz = pz - linea.z;
    const s = rx * d.x + rz * d.z, lado = Math.abs(rx * r.x + rz * r.z);
    const previo = this._lineas.get(clave);
    this._lineas.set(clave, s);
    return previo !== undefined && previo < 0 && s >= 0 && lado < 2.8 && a.velocidadAvance > 0;
  }

  /** Si viene un auto hacia el cruce con preferencia y no lo dejamos pasar: falta grave */
  _revisarCeder(d, c, texto) {
    if (this.auto.kmh < 3) return;
    for (const o of this.trafico.autos) {
      if (o.v < 1) continue;
      const ox = c.x - o.x, oz = c.z - o.z, dist = Math.hypot(ox, oz);
      if (dist > 17 || dist < 3) continue;
      const fx = Math.sin(o.angulo), fz = Math.cos(o.angulo);
      const haciaCruce = (ox * fx + oz * fz) / dist > 0.6;
      const mismoSentido = fx * d.x + fz * d.z > 0.7; // va delante de nosotros: no tiene preferencia
      if (haciaCruce && !mismoSentido) { this.falta('grave', texto, 'ceder', 6); return; }
    }
  }

  // ----- Paso de cebra -----
  _revisarCebra() {
    const a = this.auto, c = PUNTOS.cebra;
    const fx = Math.sin(a.angulo), fz = Math.cos(a.angulo);
    const px = a.posicion.x + fx * 1.9, pz = a.posicion.z + fz * 1.9;
    const dentro = Math.abs(px - c.x) < 2.3 && Math.abs(pz - c.z) < 5;
    if (dentro && !this._enCebra) {
      const g = this.peatones.cebra.p.grupo.position;
      const peatonEnCalle = this.peatones.cebraOcupada && Math.abs(g.z - c.z) < 5.6;
      if (peatonEnCalle) this.falta('eliminatoria', 'No respetó al peatón en el paso de cebra');
    }
    this._enCebra = dentro;
  }

  // ----- Intermitentes en los virajes -----
  _revisarCruces() {
    const a = this.auto, p = a.posicion;
    const region = CRUCES.find((r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) || null;
    if (region === (this._cruce && this._cruce.region)) return;
    // Salió de un cruce: ¿viró?
    if (this._cruce) {
      const giro = envolver(a.angulo - this._cruce.angulo);
      if (Math.abs(giro) > 0.9 && a.velocidadAvance > 0) {
        const izquierda = giro > 0; // el ángulo crece al virar a la izquierda
        const desde = this._cruce.t - 6;
        const senalCorrecta = izquierda ? this._ultIzq >= desde : this._ultDer >= desde;
        const senalContraria = izquierda ? this._ultDer >= desde : this._ultIzq >= desde;
        const lado = izquierda ? 'izquierda' : 'derecha';
        if (!senalCorrecta && senalContraria) this.falta('leve', `Señalizó al lado contrario al virar a la ${lado}`, 'senal', 2);
        else if (!senalCorrecta) this.falta('leve', `No señalizó el viraje a la ${lado}`, 'senal', 2);
      }
    }
    this._cruce = region ? { region, angulo: a.angulo, t: this.tiempo } : null;
  }

  // ----- Rotonda: sentido de giro, velocidad de entrada y señal de salida -----
  _revisarRotonda(dt) {
    const a = this.auto, p = a.posicion;
    const dx = ROTONDA.x - p.x, dz = ROTONDA.z - p.z;
    const dist = Math.hypot(dx, dz);
    const enAnillo = dist < ROTONDA.radio + 0.5;
    if (enAnillo && !this._rotonda) {
      this._rotonda = { t: this.tiempo, contra: 0 };
      if (a.kmh > 30) this.falta('leve', 'Entró a la rotonda a velocidad excesiva', 'rotVel', 10);
    }
    if (this._rotonda && enAnillo) {
      // Con tránsito por la derecha, la isla debe quedar a la IZQUIERDA del auto
      const v = a.velocidad, rap = Math.hypot(v.x, v.y);
      if (rap > 1.5) {
        const derecha = { x: -v.y / rap, z: v.x / rap }; // derecha de la dirección de avance
        const islaDerecha = (dx * derecha.x + dz * derecha.z) / dist;
        this._rotonda.contra = islaDerecha > 0.5 ? this._rotonda.contra + dt : 0;
        if (this._rotonda.contra > 0.8) this.falta('eliminatoria', 'Circuló en contra del sentido de la rotonda');
      }
    }
    if (this._rotonda && dist > ROTONDA.radio + 2) {
      // Al salir debe haber puesto el intermitente derecho
      if (this._ultDer < this._rotonda.t && this.tiempo - this._rotonda.t > 1) {
        this.falta('leve', 'No señalizó la salida de la rotonda', 'rotSenal', 5);
      }
      this._rotonda = null;
    }
  }

  // ----- Velocidad -----
  _revisarVelocidad(dt) {
    const a = this.auto, lim = limiteEn(a.posicion.x, a.posicion.z);
    const kmh = a.kmh;
    if (kmh > lim + 4) this._exceso += dt; else this._exceso = Math.max(0, this._exceso - dt * 2);
    if (kmh <= lim) this._excesoMarcado = null;
    if (this._exceso > 1.5 && !this._excesoMarcado) {
      const muy = kmh > lim + 15;
      this._excesoMarcado = true;
      const zona = lim === CONFIG.limites.zonaEscolar ? ' en zona escolar' : '';
      this.falta(muy || zona ? 'grave' : 'leve', `Exceso de velocidad${zona} (máx. ${lim} km/h)`, 'vel', 4);
    }
  }

  // ----- Pista contraria -----
  _revisarPista(dt) {
    const a = this.auto, p = a.posicion;
    const e = ETAPAS[this.etapa];
    const libre = e?.estacionar || a.velocidadAvance < 1 ||
      CRUCES.some((r) => p.x > r.x0 - 2 && p.x < r.x1 + 2 && p.z > r.z0 - 2 && p.z < r.z1 + 2) ||
      Math.hypot(p.x - ROTONDA.x, p.z - ROTONDA.z) < ROTONDA.radio + 6 ||
      (Math.abs(p.x + 50) < 20 && Math.abs(p.z + 50) < 20);
    let izquierda = null; // null = no se puede saber (cruce, rotonda, estacionamiento…)
    if (!libre) {
      const sa = Math.sin(a.angulo), ca = Math.cos(a.angulo);
      for (const c of CALLES) {
        // Calle a lo largo de Z (hay que ir a la derecha según el sentido)
        if (Math.abs(p.x - c) < 5 && Math.abs(ca) > 0.6) izquierda = (p.x - c) * Math.sign(ca);
        // Calle a lo largo de X
        if (Math.abs(p.z - c) < 5 && Math.abs(sa) > 0.6) izquierda = -(p.z - c) * Math.sign(sa);
      }
    }
    // izquierda > 0: el centro del auto pasó la línea central hacia la pista contraria
    if (izquierda !== null && izquierda > 0.7) this._contraria += dt;
    else if (izquierda !== null && izquierda < 0) { this._contraria = 0; this._contrariaMarcada = false; } // volvió a su pista
    if (this._contraria > 1.5 && !this._contrariaMarcada) {
      this._contrariaMarcada = true;
      this.falta('grave', 'Circuló por la pista contraria', 'pista', 3);
    }
  }

  // ----- Manejo brusco, freno de mano y retroceso -----
  _revisarConduccion(dt) {
    const a = this.auto;
    this._desliz = a.deslizamiento > 0.6 && a.kmh > 15 ? this._desliz + dt : 0;
    if (this._desliz > 0.5) this.falta('grave', 'Perdió el control del vehículo (derrape)', 'desliz', 6);
    if (a.aceleracionActual < -7.5 && a.kmh > 20) this.falta('leve', 'Frenada brusca', 'frenada', 8);
    if (a.frenando && a.freno < 0.05 && a.kmh > 10) this.falta('leve', 'Usó el freno de mano en movimiento', 'fmano', 8);
    if (a.velocidadAvance < -2.8) this.falta('leve', 'Retrocedió a velocidad excesiva', 'retro', 8);
  }

  // ----- Salir del estacionamiento en paralelo señalizando a la izquierda -----
  _revisarSalidaParalelo() {
    const s = this._salidaParalelo;
    if (!s) return;
    const p = this.auto.posicion;
    if (this.auto.intermitente === 'izq') s.senalizo = true;
    if (Math.hypot(p.x - s.x, p.z - s.z) > 4) {
      if (!s.senalizo) this.falta('leve', 'No señalizó al salir del estacionamiento', 'salParalelo', 999);
      this._salidaParalelo = null;
    }
  }

  // ===========================================================
  // EXAMINADOR: voz y gestos
  // ===========================================================
  _decir(texto) {
    if (!this.voz || !window.speechSynthesis || (this.sonido && !this.sonido.activo)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      const voces = speechSynthesis.getVoices();
      const voz = voces.find((v) => v.lang === 'es-CL') || voces.find((v) => v.lang?.startsWith('es-4')) ||
        voces.find((v) => v.lang?.startsWith('es'));
      if (voz) u.voice = voz;
      u.lang = voz ? voz.lang : 'es-CL';
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch (err) { /* sin voz disponible */ }
  }

  _reaccionExaminador() { this._gesto = 1.2; }

  // ===========================================================
  // MARCADORES 3D (meta siguiente y lugar para estacionar)
  // ===========================================================
  _crearMarcadores() {
    const g = new THREE.Group();
    const anillo = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 2.4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x33c3ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    anillo.position.y = 1.2;
    const flecha = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.4, 4),
      new THREE.MeshBasicMaterial({ color: 0x33c3ff })
    );
    flecha.rotation.x = Math.PI;
    flecha.position.y = 4.2;
    g.add(anillo, flecha);
    g.visible = false;
    this.escena.add(g);
    this._marcaMeta = g;
    this._flecha = flecha;

    // Rectángulo en el piso para estacionar
    const forma = new THREE.Shape();
    forma.moveTo(-0.5, -0.5); forma.lineTo(0.5, -0.5); forma.lineTo(0.5, 0.5); forma.lineTo(-0.5, 0.5); forma.lineTo(-0.5, -0.5);
    const hueco = new THREE.Path();
    hueco.moveTo(-0.44, -0.47); hueco.lineTo(-0.44, 0.47); hueco.lineTo(0.44, 0.47); hueco.lineTo(0.44, -0.47); hueco.lineTo(-0.44, -0.47);
    forma.holes.push(hueco);
    const geo = new THREE.ShapeGeometry(forma);
    geo.rotateX(-Math.PI / 2);
    this._marcaLugar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false }));
    this._marcaLugar.position.y = 0.04;
    this._marcaLugar.visible = false;
    this.escena.add(this._marcaLugar);
    this._t = 0;
  }

  _ponerMarcadores() {
    const e = ETAPAS[this.etapa];
    if (!e) return this._ocultarMarcadores();
    if (e.estacionar) {
      const s = e.estacionar;
      this._marcaLugar.position.set(s.x, 0.04, s.z);
      this._marcaLugar.scale.set(s.ancho, 1, s.largo);
      this._marcaLugar.visible = true;
      this._marcaMeta.visible = false;
    } else {
      const o = this.objetivo;
      this._marcaMeta.position.set(o.x, 0, o.z);
      this._marcaMeta.visible = true;
      this._marcaLugar.visible = false;
    }
  }

  _ocultarMarcadores() {
    this._marcaMeta.visible = false;
    this._marcaLugar.visible = false;
    if (this.interior) this.interior.examinador.cabeza.rotation.z = 0;
  }

  _actualizarMarcadores(dt) {
    this._t += dt;
    this._flecha.position.y = 4.2 + Math.sin(this._t * 3) * 0.35;
    this._flecha.rotation.y += dt * 2;
    // El examinador niega con la cabeza cuando hay una falta
    if (this.interior) {
      const cabeza = this.interior.examinador.cabeza;
      if (this._gesto > 0) {
        this._gesto -= dt;
        cabeza.rotation.z = Math.sin(this._gesto * 18) * 0.25 * Math.min(1, this._gesto);
      } else cabeza.rotation.z = 0;
    }
  }

  // ===========================================================
  // PANEL EN PANTALLA
  // ===========================================================
  _crearUI() {
    const $ = (id) => document.getElementById(id);
    this.ui = {
      panel: $('examen'), puntaje: $('ex-puntaje'), tiempo: $('ex-tiempo'),
      instruccion: $('ex-instruccion'), faltas: $('ex-faltas'), extra: $('ex-extra'), barra: $('ex-barra')
    };
  }

  _actualizarUI() {
    const t = Math.floor(this.tiempo);
    const texto = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    if (this.ui.tiempo.textContent !== texto) this.ui.tiempo.textContent = texto;
    this.ui.barra.style.width = ((this.etapa / ETAPAS.length) * 100).toFixed(0) + '%';
  }

  _pintarFaltas(nueva) {
    const pts = Math.max(0, this.puntaje);
    this.ui.puntaje.textContent = pts;
    this.ui.puntaje.className = pts >= PUNTAJE_APROBAR ? 'ok' : 'mal';
    this.ui.faltas.innerHTML = '';
    for (const f of this.faltas.slice(-3).reverse()) {
      const li = document.createElement('li');
      li.className = f.tipo;
      li.textContent = (f.tipo === 'eliminatoria' ? '✖ ' : `−${f.puntos} `) + f.texto;
      this.ui.faltas.appendChild(li);
    }
    if (nueva) {
      const etiqueta = { leve: 'Falta leve', grave: 'Falta grave', eliminatoria: 'Falta eliminatoria' }[nueva.tipo];
      this.alAvisar(`${etiqueta}: ${nueva.texto}`, 2200);
    }
  }
}

/** Distancia de un punto a un segmento */
function distSegmento(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

export { ETAPAS };
