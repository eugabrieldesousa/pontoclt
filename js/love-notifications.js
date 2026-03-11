/* ============================================
   PontoCLT — Love Notifications
   Notificacoes carinhosas do(a) namorado(a)
   ============================================ */

const LoveNotifications = (() => {
  'use strict';

  const STORAGE_KEY = 'pontoclt_love_notifications';
  const NAME_KEY = 'pontoclt_love_name';
  const LAST_NOTIF_KEY = 'pontoclt_love_last_notif';
  const MIN_INTERVAL = 4 * 60 * 60 * 1000; // 4 horas entre notificacoes

  const MESSAGES = [
    'Seu namorado te ama muito! Tenha um otimo dia de trabalho!',
    'Voce e a pessoa mais incrivel do mundo! Te amo demais!',
    'So passando pra dizer que voce e maravilhoso(a)!',
    'Cada segundo longe de voce e uma eternidade... Te amo!',
    'Voce merece o mundo inteiro! Eu te amo!',
    'Pensando em voce agora... como sempre!',
    'Voce e meu lugar favorito no mundo!',
    'Nao esquece de tomar agua e lembrar que eu te amo!',
    'Meu coracao bate mais forte so de pensar em voce!',
    'Voce e o melhor presente que a vida me deu!',
    'Te amo mais do que todas as estrelas do ceu!',
    'So queria te lembrar que voce e perfeito(a) do jeitinho que e!',
    'Mal posso esperar pra te ver... Te amo!',
    'Voce faz meus dias mais felizes! Obrigado(a) por existir!',
    'Saudade de voce ja bateu... Te amo muito!',
    'Voce e minha pessoa favorita nesse mundo todo!',
    'Trabalhando com garra! Que orgulho de voce, meu amor!',
    'Nao importa a distancia, meu amor por voce so cresce!',
    'Voce e forte, capaz e muito amado(a)!',
    'Se cuida, ta? Preciso de voce inteirinho(a) pra mim!',
    'Um beijo virtual pra aliviar o dia! Muah!',
    'Voce e a razao do meu sorriso bobo!',
    'Conte ate 3 e lembra que alguem te ama incondicionalmente!',
    'Eu escolheria voce em todas as vidas possiveis!',
    'Vai dar tudo certo, amor! Estou sempre com voce!',
    'Se o amor fosse tempo, o nosso seria infinito!',
    'Voce e meu sonho que virou realidade!',
    'Quero envelhecer do seu lado... Te amo pra sempre!',
    'Ninguem no mundo me faz tao feliz quanto voce!',
    'Voce e a minha melhor escolha de todos os dias!'
  ];

  function isEnabled() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  function setEnabled(value) {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    if (value) {
      requestPermission();
    }
  }

  function getName() {
    return localStorage.getItem(NAME_KEY) || '';
  }

  function setName(name) {
    localStorage.setItem(NAME_KEY, name || '');
  }

  function getRandomMessage() {
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    const name = getName();
    if (name) {
      return msg.replace(/Seu namorado/, name).replace(/namorado\(a\)/, name);
    }
    return msg;
  }

  function canShowNotification() {
    const last = localStorage.getItem(LAST_NOTIF_KEY);
    if (!last) return true;
    return (Date.now() - parseInt(last, 10)) > MIN_INTERVAL;
  }

  function markShown() {
    localStorage.setItem(LAST_NOTIF_KEY, Date.now().toString());
  }

  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  async function showNotification() {
    if (!isEnabled()) return;
    if (!canShowNotification()) return;

    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const message = getRandomMessage();
    markShown();

    // Try Service Worker notification first (works even when tab not focused)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'LOVE_NOTIFICATION',
        title: getName() ? `${getName()} diz:` : 'Mensagem de Amor',
        body: message
      });
      return;
    }

    // Fallback to regular Notification API
    new Notification(getName() ? `${getName()} diz:` : 'Mensagem de Amor', {
      body: message,
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      tag: 'love-notification',
      renotify: true
    });
  }

  // Schedule periodic notification via Service Worker
  function schedulePeriodicNotification() {
    if (!isEnabled()) return;
    if (!('serviceWorker' in navigator)) return;

    // Register periodic sync if available
    navigator.serviceWorker.ready.then((registration) => {
      if ('periodicSync' in registration) {
        registration.periodicSync.register('love-notification', {
          minInterval: MIN_INTERVAL
        }).catch(() => {
          // periodicSync not available, fallback to setInterval
          startFallbackTimer();
        });
      } else {
        startFallbackTimer();
      }
    });
  }

  let fallbackTimer = null;

  function startFallbackTimer() {
    stopFallbackTimer();
    if (!isEnabled()) return;
    // Show a notification every 4 hours while the app is open
    fallbackTimer = setInterval(() => {
      showNotification();
    }, MIN_INTERVAL);
  }

  function stopFallbackTimer() {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function init() {
    if (isEnabled()) {
      showNotification();
      schedulePeriodicNotification();
    }
  }

  return {
    isEnabled,
    setEnabled,
    getName,
    setName,
    showNotification,
    schedulePeriodicNotification,
    init
  };
})();
