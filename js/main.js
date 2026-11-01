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
import { crearEscenario } from './escenario.js';
import { resolverColisiones } from './colisiones.js';

// ---------- Renderizador (el "pintor" que dibuja la escena) ----------
const contenedor = document.getElementById('juego');
const renderer = new THREE.WebGLRenderer({ antialias: CONFIG.graficos.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.graficos.pixelRatioMax));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
contenedor.appendChild(renderer.domElement);

// ---------- Escena, cielo y niebla ----------
const escena = new THREE.Scene();
const colorCielo = new THREE.Color(0x9fd3f0);
escena.background = colorCielo;
escena.fog = new THREE.Fog(colorCielo, 70, 190);

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
const camara = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

// ---------- Mundo, auto y controles ----------
const mundo = crearEscenario(escena);
const auto = new Auto(escena);
auto.posicion.set(-27.5, 0, -55);   // pista derecha de una calle (en Chile se maneja por la derecha)
auto.angulo = 0;                     // mirando hacia +Z
const controles = new Controles();
const controlCamara = new ControlCamara(camara);

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
  const modo = controlCamara.siguiente();
  mostrarAviso(modo === 'tercera' ? 'Cámara: detrás' : 'Cámara: aérea', 800);
});

// ---------- Ajustar al tamaño de la pantalla ----------
function alCambiarTamano() {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', alCambiarTamano);
window.addEventListener('orientationchange', () => setTimeout(alCambiarTamano, 300));

// ---------- Bucle del juego ----------
const reloj = new THREE.Clock();
let ultimoChoque = 0;
let ultimaVelocidadMostrada = -1;

function bucle() {
  requestAnimationFrame(bucle);
  // dt = tiempo desde el cuadro anterior (limitado por si el celular se traba)
  const dt = Math.min(reloj.getDelta(), 0.05);

  // 1) Física del auto
  auto.actualizar(dt, controles);

  // 2) Choques
  const choque = resolverColisiones(auto, mundo);
  auto.grupo.position.copy(auto.posicion);
  const ahora = performance.now();
  if (choque && choque.fuerza > 2 && ahora - ultimoChoque > 800) {
    ultimoChoque = ahora;
    mostrarAviso(choque.tipo === 'auto' ? '¡PUM! Chocaste un auto' : '¡Uy! Te subiste a la vereda');
  }

  // 3) Cámara y sol siguen al auto
  controlCamara.actualizar(dt, auto);
  sol.position.copy(auto.posicion).add(desfaseSol);
  sol.target.position.copy(auto.posicion);

  // 4) HUD
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

  // 5) Dibujar
  renderer.render(escena, camara);
}
bucle();
