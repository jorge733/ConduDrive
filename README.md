# ConduDrive 🚗

Juego 3D de conducción: da tu examen práctico de manejo en un pueblo ficticio inspirado en Chile.
Hecho con HTML, CSS, JavaScript y [Three.js](https://threejs.org) (cargado desde CDN, sin compilar nada).

## Cómo probarlo en tu computador

El juego necesita un "servidor local" (abrir `index.html` con doble clic no funciona por seguridad del navegador).

**Opción A – Python** (viene instalado en Mac/Linux): en una terminal, dentro de la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Luego abre <http://localhost:8000> en el navegador.

**Opción B – VS Code**: instala la extensión "Live Server", abre la carpeta y presiona "Go Live".

## Controles

| Acción | Computador | Celular |
|---|---|---|
| Acelerar | ↑ o W | botón verde ACELERAR |
| Frenar / marcha atrás | ↓ o S (manteniendo, estando detenido) | botón rojo FRENO |
| Girar | ← → o A D | botones ◀ ▶ |
| Freno de mano | Espacio | FRENO MANO |
| Intermitentes | Q / E | ⬅ ➡ arriba a la izquierda |
| Cambiar cámara | C | 🎥 |

## El pueblo

```
  (-50, 50) casas        ( 0, 50) COLEGIO        (50, 50) casas
  (-50,  0) casas        ( 0,  0) PLAZA          (50,  0) casas
  (-50,-50) ESTACIONAM.  ( 0,-50) casas          (50,-50) casas
```

- Partida: estacionamiento (abajo a la izquierda), con barreras que se levantan solas al acercarte.
- Semáforo en el cruce (-25,-25) · Paso de cebra en (0,-25) · PARE en (25,-25)
- CEDA EL PASO en (75,-25) · Rotonda en (25,25) · Zona escolar frente al colegio
- Estacionamiento en paralelo junto a la plaza (calle X = -25)

## Cámaras

1. **Detrás del auto** (por defecto)
2. **Interior**: volante, velocímetro, examinador y espejos retrovisores que funcionan
3. **Aérea**: para estacionar

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | La página: pantalla del juego y botones |
| `css/estilos.css` | Colores y posición de los textos y botones |
| `js/main.js` | Arma todo y ejecuta el bucle del juego |
| `js/config.js` | **Números ajustables** (velocidad, agarre, semáforo, tránsito, calidad...) |
| `js/auto.js` | Modelo 3D del auto del jugador y su física |
| `js/interior.js` | Tablero, volante, velocímetro, asientos y espejos retrovisores |
| `js/controles.js` | Teclado y botones táctiles |
| `js/camara.js` | Las tres cámaras |
| `js/colisiones.js` | Choques |
| `js/ciudad.js` | El pueblo: calles, casas, plaza, colegio, rotonda, señales |
| `js/senales.js` | Señales de tránsito y semáforo |
| `js/trafico.js` | Autos que circulan solos |
| `js/barreras.js` | Barreras automáticas del estacionamiento |
| `js/peatones.js` | Peatones (incluido el del paso de cebra) |
| `js/personajes.js` | Modelos de personas: peatones, conductor y examinador |
| `js/vehiculos.js` | Modelos simples de otros autos |
| `js/util.js` | Herramientas de apoyo (unir piezas, letreros con texto) |
