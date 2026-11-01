// ===========================================================
// ConduDrive - ARCHIVO PRINCIPAL
// Arma la escena 3D, crea el auto, los controles y la cámara,
// y ejecuta el "bucle del juego" (se repite ~60 veces por segundo).
// ===========================================================
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Auto } from './auto.js';
import { Controles } from './controles.js';
import { ControlCamara } from './camara.js';
import { crearCiudad, PUNTOS } from './ciudad.js';
import { resolverColisiones } from './colisiones.js';
import { Trafico } from './trafico.js';
import { Peatones } from './peatones.js';
import { Interior } from './interior.js';
import { Sonido } from './sonido.js';
import { MarcasNeumaticos } from './marcas.js';
import { Lluvia } from './lluvia.js';
import { Minimapa } from './minimapa.js';
import { CALLES, ROTONDA } from './ciudad.js';
import { Examen, limiteEn } from './examen.js';

// ---------- Renderizador (el "pintor" que dibuja la escena) ----------
const contenedor = document.getElementById('juego');
const renderer = new THREE.WebGLRenderer({ antialias: CONFIG.graficos.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.graficos.pixelRatioMax));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Las sombras se calculan una vez por cuadro (no de nuevo para los espejos)
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
contenedor.appendChild(renderer.domElement);

// ---------- Escena, cielo y niebla ----------
const escena = new THREE.Scene();
const colorCielo = new THREE.Color(0x9fd3f0);
escena.background = colorCielo;
escena.fog = new THREE.Fog(colorCielo, 90, 330);

// ---------- Luces (pocas, para que corra bien en celular) ----------
// Luz ambiente de cielo/suelo: suave, sin sombras
const luzCielo = new THREE.HemisphereLight(0xdff2ff, 0x6b8f4e, 1.1);
escena.add(luzCielo);
// El "sol": una sola luz con sombras, que sigue al auto
const sol = new THREE.DirectionalLight(0xfff1d6, 2.0);
sol.castShadow = true;
sol.shadow.mapSize.set(CONFIG.graficos.tamanoSombra, CONFIG.graficos.tamanoSombra);
const s = sol.shadow.camera;
s.left = -35; s.right = 35; s.top = 35; s.bottom = -35; s.near = 1; s.far = 120;
sol.shadow.bias = -0.0005;
sol.shadow.normalBias = 0.03;
escena.add(sol, sol.target);
const desfaseSol = new THREE.Vector3(30, 50, 20);

// ---------- Cámara ----------
const camara = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

// ---------- Mundo, auto y controles ----------
const { mundo, semaforo, barreras } = crearCiudad(escena);
const auto = new Auto(escena);
const interior = new Interior(auto);         // tablero, volante, examinador y espejos
auto.posicion.set(PUNTOS.inicio.x, 0, PUNTOS.inicio.z); // en el estacionamiento
auto.angulo = PUNTOS.inicio.angulo;
const trafico = new Trafico(escena, semaforo);
const peatones = new Peatones(escena);
const controles = new Controles();
const controlCamara = new ControlCamara(camara);
controlCamara.alCambiar = (modo) => interior.modoInterior(modo === 'interior');
const sonido = new Sonido();
const marcas = new MarcasNeumaticos(escena);
const lluvia = new Lluvia(escena, { cielo: luzCielo, sol });
const minimapa = new Minimapa(document.getElementById('minimapa'));
auto.alCambiarMarcha = () => sonido.cambio();
auto.alParpadear = (on) => sonido.tic(on);

// ---------- HUD (textos en pantalla) ----------
const $ = (id) => document.getElementById(id);
const elVelocidad = $('velocidad');
const elVelocimetro = $('velocimetro');
const elMarcha = $('marcha');
const elRpm = $('rpm-barra');
const elAbs = $('t-abs'), elEsc = $('t-esc'), elFm = $('t-fm');
const elLimite = $('limite'), elLimiteNum = $('limite-num');
const elIndIzq = $('ind-izq');
const elIndDer = $('ind-der');
const elAviso = $('aviso');
const elPausa = $('pausa');
const btnIntIzq = document.querySelector('[data-toque="intIzq"]');
const btnIntDer = document.querySelector('[data-toque="intDer"]');
let temporizadorAviso = null;

function mostrarAviso(texto, ms = 1200) {
  elAviso.textContent = texto;
  elAviso.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => elAviso.classList.remove('visible'), ms);
}

// ---------- Opciones (se recuerdan entre partidas) ----------
const opciones = { cajaManual: false, lluvia: false, esc: true, sonido: true };
try { Object.assign(opciones, JSON.parse(localStorage.getItem('condudrive-opciones') || '{}')); } catch (e) { /* sin almacenamiento */ }
function guardarOpciones() {
  try { localStorage.setItem('condudrive-opciones', JSON.stringify(opciones)); } catch (e) { /* sin almacenamiento */ }
}
function aplicarOpciones() {
  auto.ponerCajaManual(opciones.cajaManual);
  auto.lluvia = opciones.lluvia;
  auto.esc = opciones.esc;
  lluvia.poner(opciones.lluvia);
  if (sonido.activo !== opciones.sonido) sonido.alternar();
  document.body.classList.toggle('caja-manual', opciones.cajaManual);
  const txt = {
    caja: opciones.cajaManual ? 'Manual' : 'Automática',
    lluvia: opciones.lluvia ? 'Lluvia' : 'Despejado',
    esc: opciones.esc ? 'Sí' : 'No',
    sonido: opciones.sonido ? 'Sí' : 'No'
  };
  for (const [k, v] of Object.entries(txt)) {
    const b = document.querySelector(`[data-opcion="${k}"] b`);
    if (b) b.textContent = v;
  }
  guardarOpciones();
}

// ---------- Pausa ----------
let pausado = false;
let enPantalla = true; // pantalla de inicio o de resultado abierta (el juego espera)
function ponerPausa(p) {
  if (enPantalla) return;
  pausado = p;
  elPausa.classList.toggle('visible', p);
  controles.soltarTodo();
  if (window.speechSynthesis) p ? speechSynthesis.pause() : speechSynthesis.resume();
}
function mostrarPantalla(id) {
  for (const el of document.querySelectorAll('.pantalla')) el.classList.toggle('visible', el.id === id);
  enPantalla = !!id;
  pausado = !!id;
  elPausa.classList.remove('visible');
  controles.soltarTodo();
}

// ---------- Reubicar el auto ----------
const MEDIA_PISTA = CONFIG.ciudad.anchoCalle / 4;
/** Deja el auto en la pista derecha de la calle más cercana, mirando en su dirección */
function reubicar() {
  const p = auto.posicion;
  let mejor = null;
  for (const c of CALLES) {
    const dx = Math.abs(p.x - c), dz = Math.abs(p.z - c);
    if (!mejor || dx < mejor.d) mejor = { d: dx, eje: 'x', c };
    if (dz < mejor.d) mejor = { d: dz, eje: 'z', c };
  }
  let angulo;
  if (mejor.eje === 'x') { // calle que corre a lo largo de Z
    angulo = Math.cos(auto.angulo) >= 0 ? 0 : Math.PI;
    p.x = mejor.c; p.z = THREE.MathUtils.clamp(p.z, -95, 95);
  } else {
    angulo = Math.sin(auto.angulo) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    p.z = mejor.c; p.x = THREE.MathUtils.clamp(p.x, -95, 95);
  }
  // Fuera de la rotonda
  const dr = Math.hypot(p.x - ROTONDA.x, p.z - ROTONDA.z);
  if (dr < ROTONDA.radio + 4) {
    const fx = Math.sin(angulo), fz = Math.cos(angulo);
    p.x -= fx * (ROTONDA.radio + 6); p.z -= fz * (ROTONDA.radio + 6);
  }
  // Pista derecha (en Chile se maneja por la derecha)
  p.x += -Math.cos(angulo) * MEDIA_PISTA;
  p.z += Math.sin(angulo) * MEDIA_PISTA;
  auto.angulo = angulo;
  auto.detener();
  marcas.cortar();
  controlCamara._primerCuadro = true;
  mostrarAviso('Auto reubicado', 900);
}
function volverAlInicio() {
  auto.posicion.set(PUNTOS.inicio.x, 0, PUNTOS.inicio.z);
  auto.angulo = PUNTOS.inicio.angulo;
  auto.detener();
  marcas.cortar();
  controlCamara._primerCuadro = true;
}

// Acciones de un toque
controles.on('interaccion', () => sonido.iniciar());
controles.on('intIzq', () => auto.alternarIntermitente('izq'));
controles.on('intDer', () => auto.alternarIntermitente('der'));
controles.on('camara', () => {
  controlCamara.siguiente();
  mostrarAviso(controlCamara.nombre, 800);
});
controles.on('pausa', () => ponerPausa(!pausado));
controles.on('reiniciar', () => {
  if (pausado) return;
  if (examen.activo) examen.registrarAyuda();
  reubicar();
});
controles.on('caja', () => {
  opciones.cajaManual = !opciones.cajaManual;
  aplicarOpciones();
  mostrarAviso(opciones.cajaManual ? 'Caja manual (X/Z cambian)' : 'Caja automática', 1200);
});
controles.on('subirMarcha', () => {
  if (!auto.cajaManual) return;
  const err = auto.cambiarMarcha(+1);
  if (err) mostrarAviso(err, 1000);
});
controles.on('bajarMarcha', () => {
  if (!auto.cajaManual) return;
  const err = auto.cambiarMarcha(-1);
  if (err) mostrarAviso(err, 1000);
});
controles.on('lluvia', () => {
  opciones.lluvia = !opciones.lluvia;
  aplicarOpciones();
  mostrarAviso(opciones.lluvia ? '🌧 Lluvia: ¡menos agarre!' : '☀ Despejado', 1200);
});
controles.on('sonido', () => {
  opciones.sonido = !opciones.sonido;
  aplicarOpciones();
  mostrarAviso(opciones.sonido ? '🔊 Sonido' : '🔇 Sin sonido', 800);
});
controles.on('gamepad', () => mostrarAviso('🎮 Control conectado', 1500));

$('btn-continuar').addEventListener('click', () => ponerPausa(false));
document.querySelectorAll('[data-opcion]').forEach((b) => b.addEventListener('click', () => {
  const o = b.dataset.opcion;
  if (o === 'caja') opciones.cajaManual = !opciones.cajaManual;
  if (o === 'lluvia') opciones.lluvia = !opciones.lluvia;
  if (o === 'esc') opciones.esc = !opciones.esc;
  if (o === 'sonido') { opciones.sonido = !opciones.sonido; sonido.iniciar(); }
  if (o === 'reiniciar') { if (examen.activo) examen.registrarAyuda(); reubicar(); ponerPausa(false); }
  if (o === 'inicio') { examen.abandonar(); volverAlInicio(); ponerPausa(false); }
  if (o === 'examen') {
    if (examen.activo) { examen.abandonar(); } else { ponerPausa(false); iniciarExamen(); }
  }
  if (o === 'menu') { examen.activo && examen.abandonar(); mostrarInicio(); }
  aplicarOpciones();
  actualizarBotonExamen();
}));
aplicarOpciones();

// ---------- EXAMEN ----------
const examen = new Examen({
  escena, auto, semaforo, peatones, trafico, interior, sonido,
  alAvisar: (t, ms) => mostrarAviso(t, ms),
  alTerminar: (r) => setTimeout(() => mostrarResultado(r), r.completo ? 1200 : 2500)
});

function leerMejor() {
  try { return JSON.parse(localStorage.getItem('condudrive-mejor') || 'null'); } catch (e) { return null; }
}
function textoTiempo(seg) {
  const t = Math.floor(seg);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
function mostrarInicio() {
  const mejor = leerMejor();
  $('mejor-puntaje').textContent = mejor ? `🏆 Tu mejor examen aprobado: ${mejor.puntaje} puntos en ${textoTiempo(mejor.tiempo)}` : '';
  mostrarPantalla('inicio');
}
function iniciarExamen() {
  volverAlInicio();
  auto.intermitente = null;
  mostrarPantalla(null);
  sonido.iniciar();
  examen.iniciar();
  actualizarBotonExamen();
}
function actualizarBotonExamen() {
  const b = document.querySelector('[data-opcion="examen"] b');
  if (b) b.textContent = examen.activo ? 'Abandonar examen' : 'Iniciar examen';
}
function mostrarResultado(r) {
  if (examen.activo) return; // ya empezó otro
  const titulo = $('res-titulo');
  titulo.textContent = r.aprobado ? '✅ APROBADO' : '❌ REPROBADO';
  titulo.className = r.aprobado ? 'aprobado' : 'reprobado';
  $('res-motivo').textContent = r.aprobado ? '¡Felicitaciones! Ya puedes ir a buscar tu licencia.' : (r.motivo || '');
  $('res-puntaje').textContent = r.puntaje;
  $('res-tiempo').textContent = textoTiempo(r.tiempo);
  $('res-cantidad').textContent = r.faltas.length;
  // Faltas agrupadas: "No señalizó el viraje (x2) −6"
  const lista = $('res-faltas');
  lista.innerHTML = '';
  const grupos = new Map();
  for (const f of r.faltas) {
    const g = grupos.get(f.texto) || { ...f, veces: 0, total: 0 };
    g.veces++; g.total += f.puntos;
    grupos.set(f.texto, g);
  }
  for (const g of grupos.values()) {
    const li = document.createElement('li');
    li.className = g.tipo;
    li.textContent = `${g.tipo === 'eliminatoria' ? '✖' : '−' + g.total} · ${g.texto}${g.veces > 1 ? ` (×${g.veces})` : ''}`;
    lista.appendChild(li);
  }
  if (!r.faltas.length) lista.innerHTML = '<li class="sin">¡Sin faltas! Conducción perfecta.</li>';
  // Mejor puntaje (solo exámenes aprobados)
  let mejor = leerMejor();
  let record = false;
  if (r.aprobado && (!mejor || r.puntaje > mejor.puntaje || (r.puntaje === mejor.puntaje && r.tiempo < mejor.tiempo))) {
    mejor = { puntaje: r.puntaje, tiempo: r.tiempo };
    record = true;
    try { localStorage.setItem('condudrive-mejor', JSON.stringify(mejor)); } catch (e) { /* sin almacenamiento */ }
  }
  $('res-mejor').textContent = record ? '🏆 ¡Nuevo récord!' : (mejor ? `🏆 Mejor: ${mejor.puntaje} puntos en ${textoTiempo(mejor.tiempo)}` : '');
  actualizarBotonExamen();
  mostrarPantalla('resultado');
}
document.querySelectorAll('[data-inicio]').forEach((b) => b.addEventListener('click', () => {
  sonido.iniciar();
  if (b.dataset.inicio === 'examen') iniciarExamen();
  else { mostrarPantalla(null); }
}));
document.querySelectorAll('[data-resultado]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.resultado === 'repetir') iniciarExamen();
  else mostrarPantalla(null);
}));
mostrarInicio();

// ---------- Límite de velocidad según la zona (ver examen.js) ----------
let tiempoExceso = 0, avisoExcesoDado = false;

// ---------- Ajustar al tamaño de la pantalla ----------
function alCambiarTamano() {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', alCambiarTamano);
window.addEventListener('orientationchange', () => setTimeout(alCambiarTamano, 300));

// Acceso para pruebas desde la consola del navegador
window.ConduDrive = { renderer, escena, auto, semaforo, trafico, peatones, barreras, controles, reubicar, examen, simular: (dt) => simular(dt) };

// ---------- Bucle del juego ----------
const reloj = new THREE.Clock();
let ultimoChoque = 0;
let ultimaVelocidadMostrada = -1;

function bucle() {
  requestAnimationFrame(bucle);
  // dt = tiempo desde el cuadro anterior (limitado por si el celular se traba)
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (!pausado) simular(dt);
  else controles.leer(dt); // sigue leyendo el gamepad (para el botón Start)
  dibujar(dt);
}

/** Avanza el mundo dt segundos (sin dibujar). Las pruebas automáticas lo llaman directo. */
function simular(dt) {
  {
    // 1) El pueblo se mueve: semáforo, autos y peatones
    semaforo.actualizar(dt);
    trafico.actualizar(dt, auto);
    peatones.actualizar(dt);
    barreras.actualizar(dt, auto);

    // 2) Física del auto del jugador
    auto.actualizar(dt, controles);

    // 3) Choques (con lo fijo y con lo que se mueve)
    mundo.dinamicos.length = 0;
    trafico.agregarColisiones(mundo.dinamicos);
    peatones.agregarColisiones(mundo.dinamicos);
    mundo.cajasDinamicas.length = 0;
    barreras.agregarColisiones(mundo.cajasDinamicas);
    const choque = resolverColisiones(auto, mundo);
    examen.registrarChoque(choque);
    auto.grupo.position.copy(auto.posicion);
    const ahora = performance.now();
    if (choque && choque.tipo === 'peaton') peatones.atropellar();
    if (choque && choque.fuerza > 1.2 && ahora - ultimoChoque > 250) {
      sonido.golpe(choque.fuerza);
      controlCamara.sacudir(choque.fuerza);
    }
    if (choque && (choque.fuerza > 2 || choque.tipo === 'peaton') && ahora - ultimoChoque > 800) {
      ultimoChoque = ahora;
      const textos = { auto: '¡PUM! Chocaste un auto', peaton: '¡Atropellaste a alguien!', vereda: '¡Uy! Te subiste a la vereda', barrera: '¡Chocaste la barrera!' };
      mostrarAviso(textos[choque.tipo] || '¡Choque!');
    }
    marcas.actualizar(auto);
    examen.actualizar(dt);

    // Límite de velocidad
    const limite = limiteEn(auto.posicion.x, auto.posicion.z);
    if (elLimiteNum.textContent !== String(limite)) elLimiteNum.textContent = limite;
    const excede = auto.kmh > limite + 3;
    tiempoExceso = excede ? tiempoExceso + dt : 0;
    if (tiempoExceso > 1.2 && !avisoExcesoDado && !examen.activo) { // en el examen lo anota el examinador
      avisoExcesoDado = true;
      mostrarAviso(`¡Exceso de velocidad! Máximo ${limite} km/h`, 1600);
      sonido.pitido();
    }
    if (!excede && auto.kmh < limite) avisoExcesoDado = false;
    elVelocimetro.classList.toggle('exceso', excede);
    elLimite.classList.toggle('alerta', tiempoExceso > 0.5);
  }
}

function dibujar(dt) {
  // 4) Cámara y sol siguen al auto
  const atras = !!controles.mirandoAtras;
  if (atras !== controlCamara.mirarAtras) { controlCamara.mirarAtras = atras; controlCamara._primerCuadro = true; }
  controlCamara.actualizar(dt, auto);
  sol.position.copy(auto.posicion).add(desfaseSol);
  sol.target.position.copy(auto.posicion);
  lluvia.actualizar(pausado ? 0 : dt, camara, auto.velocidad.x, auto.velocidad.y);
  sonido.actualizar(auto, opciones.lluvia, pausado);
  minimapa.actualizar(dt, auto, trafico, examen);

  // 5) HUD
  const kmh = Math.round(auto.kmh);
  if (kmh !== ultimaVelocidadMostrada) {
    elVelocidad.textContent = kmh;
    ultimaVelocidadMostrada = kmh;
  }
  const marcha = auto.textoMarcha;
  if (elMarcha.textContent !== marcha) elMarcha.textContent = marcha;
  elRpm.style.width = Math.min(100, (auto.rpm / 7000) * 100).toFixed(1) + '%';
  elAbs.classList.toggle('on', auto.absActivo && auto.kmh > 5);
  elEsc.classList.toggle('on', auto.escActivo || !auto.esc);
  elFm.classList.toggle('on', controles.salida.frenoMano);
  const izqOn = auto.intermitente === 'izq', derOn = auto.intermitente === 'der';
  elIndIzq.classList.toggle('encendida', izqOn && auto.intermitenteEncendido);
  elIndDer.classList.toggle('encendida', derOn && auto.intermitenteEncendido);
  btnIntIzq?.classList.toggle('intermitente-on', izqOn);
  btnIntDer?.classList.toggle('intermitente-on', derOn);

  // 6) Dibujar: primero los espejos (si estamos adentro), después la escena
  interior.actualizar(dt, renderer, escena);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(escena, camara);
}
bucle();
