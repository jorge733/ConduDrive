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

| Acción | Computador | Celular | Control (gamepad) |
|---|---|---|---|
| Acelerar | ↑ o W (se pisa de a poco) | pedal verde (más arriba = más fuerte) | RT |
| Frenar | ↓ o S | pedal rojo | LT |
| Marcha atrás | detenido: suelta y vuelve a mantener ↓ | igual, con el pedal rojo | igual, con LT |
| Girar | ← → o A D | arrastra el volante | stick izquierdo |
| Freno de mano | Espacio | FRENO MANO | A |
| Intermitentes | Q / E | ⬅ ➡ | LB / RB |
| Cambiar cámara · mirar atrás | C · B (mantener) | 🎥 | Y |
| Caja manual: subir / bajar marcha | X / Z (o Shift / Ctrl) | ▲ ▼ | B / X |
| Caja automática ↔ manual | T | menú ⏸ | — |
| Lluvia · sonido | L · M | menú ⏸ | — |
| Reubicar el auto en la calle | R | menú ⏸ | Back |
| Pausa | P o Esc | ⏸ | Start |

Las opciones del menú de pausa (caja, clima, control de estabilidad, sonido) se recuerdan entre partidas.

## Examen práctico 📋

Al abrir el juego eliges **Dar el examen práctico** o **Manejo libre** (también desde el menú de pausa).
El examinador va sentado a tu lado y te da las instrucciones en pantalla y en voz alta.
La próxima meta aparece como un anillo azul en la calle y como una línea en el minimapa.

**Recorrido:** salir del estacionamiento → semáforo → paso de cebra → disco PARE → CEDA EL PASO →
rotonda (segunda salida) → zona escolar → **estacionar en paralelo** → semáforo con viraje a la
izquierda → volver y **estacionar en tu lugar** original.

**Puntaje:** partes con 100 puntos y apruebas con **75 o más**.

| Tipo de falta | Descuento | Ejemplos |
|---|---|---|
| Leve | −3 | no señalizar un viraje, la salida de la rotonda o al salir de estacionar; subirse a la solera; frenada brusca; exceso leve de velocidad; desviarse del recorrido |
| Grave | −10 | chocar; circular por la pista contraria; no ceder el paso; exceso en zona escolar o de más de 15 km/h; derrapar; no lograr estacionar a tiempo; pedir reubicar el auto (R) |
| Eliminatoria | reprueba | cruzar con luz roja; no detenerse en el PARE; no respetar al peatón en la cebra; atropellar; ir contra el sentido de la rotonda; choque fuerte; pasar los 15 minutos |

Al terminar ves el resultado con todas las faltas, y se guarda tu mejor examen aprobado.

## Conducción realista

- **Física de verdad (simplificada)**: masa, inercia, traspaso de peso al frenar/acelerar y
  neumáticos que se deforman y pueden perder agarre (curva tipo Pacejka). Detenido, el auto no gira.
- **Motor y caja**: curva de torque, revoluciones, 5 marchas (automática o manual secuencial),
  freno motor, corte de inyección y "creep" (la automática avanza sola despacito si sueltas el freno).
- **Frenos con ABS**, freno de mano que bloquea las ruedas traseras (el auto puede cruzarse),
  **control de estabilidad y tracción** (se puede apagar) y resistencia del aire.
- **Lluvia**: el asfalto se moja y brilla, hay menos agarre y frenar toma más distancia.
- **Sonido sintetizado**: motor según las revoluciones, chirrido de neumáticos, viento, choques e intermitente.
- **Marcas de neumáticos** en el asfalto al derrapar o frenar con las ruedas bloqueadas.
- La carrocería se inclina sobre sus resortes; en la vista interior la cabeza se mueve con las fuerzas G.
- **HUD**: velocidad, marcha, revoluciones, testigos ABS/ESC/freno de mano, **límite de velocidad
  de la zona** (50 urbano, 30 zona escolar, 20 estacionamiento) con aviso de exceso y **minimapa**.

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
| `js/auto.js` | Modelo 3D del auto del jugador, su física, motor y caja de cambios |
| `js/examen.js` | Examen práctico: recorrido, reglas, faltas y puntaje |
| `js/sonido.js` | Sonidos sintetizados (motor, neumáticos, viento, golpes) |
| `js/marcas.js` | Marcas de neumáticos en el asfalto |
| `js/lluvia.js` | Lluvia y asfalto mojado |
| `js/minimapa.js` | Minimapa que gira con el auto |
| `js/interior.js` | Tablero, volante, velocímetro, asientos y espejos retrovisores |
| `js/controles.js` | Teclado, volante y pedales táctiles, y gamepad |
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
