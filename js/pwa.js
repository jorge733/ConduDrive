// ===========================================================
// ConduDrive - APLICACIÓN INSTALABLE (PWA)
// - Registra el service worker (juego sin internet).
// - Muestra el botón "Instalar" cuando el navegador lo permite
//   (Chrome/Edge/Android). En iPhone/iPad explica cómo hacerlo.
// ===========================================================

export function iniciarPWA({ alAvisar } = {}) {
  const botones = document.querySelectorAll('[data-instalar]');
  const ayudaIOS = document.getElementById('ayuda-ios');
  const instalada = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  let aviso = null;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Si ya había una versión controlando la página, lo que se instale ahora es una actualización
    const habiaVersion = !!navigator.serviceWorker.controller;
    const registrar = () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // Si llega una versión nueva mientras se juega, avisamos (no recargamos a la fuerza)
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          nuevo?.addEventListener('statechange', () => {
            if (nuevo.state === 'activated' && habiaVersion && alAvisar) {
              alAvisar('🔄 Hay una versión nueva: se usará al volver a abrir el juego', 3500);
            }
          });
        });
      }).catch((err) => console.warn('Service worker no registrado:', err));
    };
    if (document.readyState === 'complete') registrar(); else window.addEventListener('load', registrar);
  }

  const mostrar = (si) => botones.forEach((b) => { b.hidden = !si; });
  mostrar(false);

  // Chrome / Edge / Android: el navegador avisa que se puede instalar
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    aviso = e;
    mostrar(true);
  });
  botones.forEach((b) => b.addEventListener('click', async () => {
    if (!aviso) return;
    aviso.prompt();
    const { outcome } = await aviso.userChoice;
    aviso = null;
    mostrar(false);
    if (outcome === 'accepted' && alAvisar) alAvisar('📲 ¡ConduDrive instalado!', 2000);
  }));
  window.addEventListener('appinstalled', () => { aviso = null; mostrar(false); });

  // iPhone / iPad (Safari no tiene botón de instalar): mostramos cómo hacerlo
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ayudaIOS) ayudaIOS.hidden = !(esIOS && !instalada);
}
