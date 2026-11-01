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

// ---------- HUD (textos en pantalla) ----------
const elVelocidad = document.getElementById('velocidad');
const elIndIzq = document.getElementById('ind-izq');
const elIndDer = document.getElementById('ind-der');
const elAviso = document.getElementById('aviso');
const btnIntIzq = document.querySelector('[data-toque="intIzq"]');
const btnIntDer = document.querySelector('[data-toque="intDer"]');
let temporizadorAviso = null;

function mostrarAviso(texto, ms = 1200) {
  elAviso.textContent = texto;
  elAviso.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => elAviso.classList.remove('visible'), ms);
}

// Acciones de un toque
controles.on('intIzq', () => auto.alternarIntermitente('izq'));
controles.on('intDer', () => auto.alternarIntermitente('der'));
controles.on('camara', () => {
  controlCamara.siguiente();
  mostrarAviso(controlCamara.nombre, 800);
});

// ---------- Ajustar al tamaño de la pantalla ----------
function alCambiarTamano() {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', alCambiarTamano);
window.addEventListener('orientationchange', () => setTimeout(alCambiarTamano, 300));

// Acceso para pruebas desde la consola del navegador
window.ConduDrive = { renderer, escena, auto, semaforo, trafico, peatones, barreras };

// ---------- Bucle del juego ----------
const reloj = new THREE.Clock();
let ultimoChoque = 0;
let ultimaVelocidadMostrada = -1;

function bucle() {
  requestAnimationFrame(bucle);
  // dt = tiempo desde el cuadro anterior (limitado por si el celular se traba)
  const dt = Math.min(reloj.getDelta(), 0.05);

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
  auto.grupo.position.copy(auto.posicion);
  const ahora = performance.now();
  if (choque && choque.tipo === 'peaton') peatones.atropellar();
  if (choque && (choque.fuerza > 2 || choque.tipo === 'peaton') && ahora - ultimoChoque > 800) {
    ultimoChoque = ahora;
    const textos = { auto: '¡PUM! Chocaste un auto', peaton: '¡Atropellaste a alguien!', vereda: '¡Uy! Te subiste a la vereda', barrera: '¡Chocaste la barrera!' };
    mostrarAviso(textos[choque.tipo] || '¡Choque!');
  }

  // 4) Cámara y sol siguen al auto
  controlCamara.actualizar(dt, auto);
  sol.position.copy(auto.posicion).add(desfaseSol);
  sol.target.position.copy(auto.posicion);

  // 5) HUD
  const kmh = Math.round(auto.kmh);
  if (kmh !== ultimaVelocidadMostrada) {
    elVelocidad.textContent = kmh;
    ultimaVelocidadMostrada = kmh;
  }
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
