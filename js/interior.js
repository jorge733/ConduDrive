// ===========================================================
// ConduDrive - INTERIOR DEL AUTO
// Tablero, volante que gira, velocímetro con aguja, asientos,
// conductor, examinador y ESPEJOS RETROVISORES que funcionan:
// una cámara mira hacia atrás y su imagen se muestra en los espejos.
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { texturaCanvas } from './util.js';
import { crearPersonaSentada, COLORES_EXAMINADOR, COLORES_CONDUCTOR } from './personajes.js';

// En Chile el volante va a la IZQUIERDA. Mirando hacia adelante, la izquierda del auto es +X.
export const LADO_CONDUCTOR = 0.38;
// Posición del "ojo" en la vista interior y hacia dónde mira (coordenadas del auto)
// (el ojo va un poco atrás para que se vea al examinador a la derecha)
export const OJO_INTERIOR = new THREE.Vector3(0.36, 1.28, -0.98);
export const MIRA_INTERIOR = new THREE.Vector3(-0.55, 0.95, 6);
// El asiento del copiloto va un poco más adelante (así el examinador entra en cuadro)
const Z_COPILOTO = -0.28;

export class Interior {
  constructor(auto) {
    this.auto = auto;
    const g = new THREE.Group();
    auto.carroceria.add(g);
    this.grupo = g;

    const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...extra });
    const caja = (padre, material, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      padre.add(m);
      return m;
    };
    const matTablero = mat(0x2d2f33);
    const matAsiento = mat(0x3b3f46);

    // ----- Tablero -----
    caja(g, matTablero, 1.46, 0.2, 0.36, 0, 0.98, 0.56);
    caja(g, matTablero, 0.42, 0.1, 0.22, LADO_CONDUCTOR, 1.11, 0.5);  // visera del velocímetro
    caja(g, mat(0x1c1d20), 0.3, 0.12, 0.05, -0.05, 0.95, 0.38);        // radio
    caja(g, mat(0x88d1ff, { emissive: 0x2288cc, emissiveIntensity: 0.6 }), 0.22, 0.07, 0.01, -0.05, 0.96, 0.355);

    // ----- Velocímetro: esfera dibujada + aguja -----
    const texDial = texturaCanvas(256, 256, (ctx, w) => {
      const c = w / 2;
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(c, c, c - 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 6; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 26px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= 120; v += 10) {
        const a = (-120 + (v / 120) * 240) * Math.PI / 180 - Math.PI / 2;
        const largo = v % 20 === 0 ? 22 : 12;
        ctx.strokeStyle = v >= 100 ? '#ff4d4d' : '#fff'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * (c - 12), c + Math.sin(a) * (c - 12));
        ctx.lineTo(c + Math.cos(a) * (c - 12 - largo), c + Math.sin(a) * (c - 12 - largo));
        ctx.stroke();
        if (v % 20 === 0) ctx.fillText(v, c + Math.cos(a) * (c - 56), c + Math.sin(a) * (c - 56));
      }
      ctx.font = '700 20px Arial'; ctx.fillText('km/h', c, c + 60);
    });
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), new THREE.MeshBasicMaterial({ map: texDial }));
    dial.position.set(LADO_CONDUCTOR, 1.06, 0.4);
    dial.rotation.set(-0.25, Math.PI, 0);
    g.add(dial);
    this.aguja = new THREE.Group();
    const aguja = caja(this.aguja, new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0.006, 0.07, 0.003, 0, 0.03, 0);
    aguja.position.z = 0.002;
    dial.add(this.aguja);

    // ----- Volante -----
    const columna = new THREE.Group();
    columna.position.set(LADO_CONDUCTOR, 0.93, 0.28);
    columna.rotation.x = -0.45; // inclinado hacia el conductor
    g.add(columna);
    caja(columna, matTablero, 0.07, 0.07, 0.3, 0, 0, 0.17);
    this.volante = new THREE.Group();
    columna.add(this.volante);
    const matVolante = mat(0x1a1a1a);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 18), matVolante);
    this.volante.add(aro);
    caja(this.volante, matVolante, 0.34, 0.035, 0.03, 0, -0.02, 0);                  // rayos
    caja(this.volante, matVolante, 0.035, 0.16, 0.03, 0, -0.09, 0);
    caja(this.volante, mat(0xe63946), 0.08, 0.06, 0.04, 0, -0.01, -0.005);          // centro con logo rojo

    // ----- Piso interior (alfombra) -----
    caja(g, mat(0x34363b), 1.46, 0.02, 1.9, 0, 0.885, -0.25);

    // ----- Asientos -----
    // Los respaldos se ocultan en la vista interior (tapaban la vista y al examinador)
    this.respaldos = new THREE.Group();
    g.add(this.respaldos);
    for (const x of [LADO_CONDUCTOR, -LADO_CONDUCTOR]) {
      const dz = x > 0 ? 0 : Z_COPILOTO + 0.42;
      caja(g, matAsiento, 0.5, 0.12, 0.5, x, 0.66, -0.4 + dz);
      const respaldo = caja(this.respaldos, matAsiento, 0.5, 0.62, 0.12, x, 0.98, -0.7 + dz);
      respaldo.rotation.x = -0.12;
      caja(this.respaldos, matAsiento, 0.26, 0.16, 0.1, x, 1.38, -0.75 + dz); // apoyacabeza
    }
    // Paneles de las puertas y techo interior (solo el borde de adelante)
    for (const x of [0.74, -0.74]) caja(g, mat(0x50545c), 0.04, 0.12, 1.8, x, 0.92, -0.3);
    caja(g, mat(0xd8d2c4), 1.5, 0.05, 0.25, 0, 1.47, 0.58);

    // ----- Personas -----
    this.conductor = crearPersonaSentada(COLORES_CONDUCTOR, 'conductor');
    this.conductor.grupo.position.set(LADO_CONDUCTOR, 0.72, -0.42);
    g.add(this.conductor.grupo);
    this.examinador = crearPersonaSentada(COLORES_EXAMINADOR, 'examinador');
    this.examinador.grupo.position.set(-LADO_CONDUCTOR, 0.72, Z_COPILOTO);
    this.examinador.grupo.rotation.y = 0.45; // sentado medio girado hacia ti, vigilando
    this.examinador.cabeza.rotation.y = 1.0; // ...y te mira fijo (en el Paso 4 tendrá más movimientos)
    g.add(this.examinador.grupo);

    // ----- ESPEJOS RETROVISORES -----
    const C = CONFIG.graficos;
    this.imagenEspejo = new THREE.WebGLRenderTarget(C.espejoAncho, C.espejoAlto);
    // Cámara que mira hacia atrás desde el techo (el auto mira a +Z; las cámaras miran a su -Z)
    this.camaraEspejo = new THREE.PerspectiveCamera(42, 3, 0.5, 160);
    this.camaraEspejo.position.set(0, 1.35, -2.1);
    auto.grupo.add(this.camaraEspejo);

    const ojo = OJO_INTERIOR;
    const crearEspejo = (w, h, x, y, z, u0, u1, v0, v1, carcasa) => {
      const geo = new THREE.PlaneGeometry(w, h);
      // Elegimos qué parte de la imagen muestra cada espejo, dada vuelta como un espejo real
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) < 0.5 ? u1 : u0, uv.getY(i) < 0.5 ? v0 : v1);
      }
      const espejo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.imagenEspejo.texture }));
      espejo.position.set(x, y, z);
      espejo.lookAt(ojo.x, ojo.y, ojo.z);
      const marco = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.04), carcasa);
      marco.position.copy(espejo.position);
      marco.quaternion.copy(espejo.quaternion);
      marco.translateZ(-0.022);
      g.add(espejo, marco);
    };
    // Central (arriba del parabrisas), izquierdo y derecho (afuera, en las puertas)
    crearEspejo(0.3, 0.085, 0.0, 1.38, 0.55, 0.28, 0.72, 0.15, 0.85, mat(0x222222));
    crearEspejo(0.2, 0.13, 0.95, 1.02, 0.52, 0.62, 1.0, 0.1, 0.8, auto.matCuerpo);
    crearEspejo(0.2, 0.13, -0.95, 1.02, 0.52, 0.0, 0.38, 0.1, 0.8, auto.matCuerpo);

    this._cuadro = 0;
    this.activo = false;
  }

  /** Cambia entre vista interior (sin techo/vidrio que tapen) y vista exterior */
  modoInterior(activo) {
    this.activo = activo;
    this.auto.vidrio.visible = !activo;
    this.auto.techo.visible = !activo;
    this.conductor.grupo.visible = !activo;
    this.respaldos.visible = !activo;
  }

  actualizar(dt, renderer, escena) {
    const a = this.auto;
    // Aguja: 0 km/h = -120°, 120 km/h = +120°
    const kmh = Math.min(a.kmh, 125);
    this.aguja.rotation.z = THREE.MathUtils.degToRad(120 - (kmh / 120) * 240);
    // Volante: gira bastante más que las ruedas (como en la vida real)
    this.volante.rotation.z = a.giro * 5;
    // Las manos del conductor siguen al volante
    this.conductor.brazos[0].rotation.y = a.giro * 0.8;
    this.conductor.brazos[1].rotation.y = a.giro * 0.8;

    // Los espejos se actualizan solo en la vista interior y cuadro por medio (para ahorrar trabajo)
    if (this.activo && (this._cuadro++ % 2 === 0)) {
      renderer.setRenderTarget(this.imagenEspejo);
      renderer.render(escena, this.camaraEspejo);
      renderer.setRenderTarget(null);
    }
  }
}
