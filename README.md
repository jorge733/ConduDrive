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

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | La página: pantalla del juego y botones |
| `css/estilos.css` | Colores y posición de los textos y botones |
| `js/main.js` | Arma todo y ejecuta el bucle del juego |
| `js/config.js` | **Números ajustables** (velocidad, agarre, calidad, etc.) |
| `js/auto.js` | Modelo 3D del auto y su física |
| `js/controles.js` | Teclado y botones táctiles |
| `js/camara.js` | Cámaras |
| `js/colisiones.js` | Choques |
| `js/escenario.js` | Calles, casas, árboles (escenario de prueba) |
