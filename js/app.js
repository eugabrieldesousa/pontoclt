/* ============================================
   PontoCLT — App
   Inicialização, eventos, roteamento
   ============================================ */

(function () {
  'use strict';

  /* ---- Service Worker ---- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    UI.initTheme();

    if (!GitHubAPI.hasCredentials()) {
      UI.showSetup();
    } else {
      UI.showApp();
      autoSync();
      startSyncTimer();
      LoveNotifications.init();
    }

    bindEvents();
  }

  /* ---- Event Bindings ---- */
  function bindEvents() {
    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.showScreen(btn.dataset.screen);
        autoSync();
      });
    });

    // Setup
    document.getElementById('btn-test-connection').addEventListener('click', testSetupConnection);
    document.getElementById('setup-form').addEventListener('submit', handleSetupSubmit);

    // Home — Bater ponto
    document.getElementById('btn-bater-ponto').addEventListener('click', handleBaterPonto);

    // Sync indicator click
    document.getElementById('sync-indicator').addEventListener('click', async () => {
      UI.toast('Sincronizando...', '');
      const result = await DB.sync();
      if (result.ok) {
        UI.toast('Sincronizado!', 'success');
      } else {
        UI.toast(`Erro: ${result.error}`, 'error');
      }
      UI.renderHome();
    });

    // Histórico navigation
    document.getElementById('hist-prev').addEventListener('click', () => UI.changeHistMonth(-1));
    document.getElementById('hist-next').addEventListener('click', () => UI.changeHistMonth(1));

    // Histórico filters
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => UI.setHistFilter(btn.dataset.filter));
    });

    // Resumo navigation
    document.getElementById('resumo-prev').addEventListener('click', () => UI.changeResumoMonth(-1));
    document.getElementById('resumo-next').addEventListener('click', () => UI.changeResumoMonth(1));

    // Resumo export
    document.getElementById('btn-exportar-resumo').addEventListener('click', UI.exportResumo);

    // Config
    document.getElementById('btn-cfg-save').addEventListener('click', UI.saveConfig);

    // Update weekly hours when daily hours change
    document.getElementById('cfg-jornada-h').addEventListener('input', updateJornadaSemanal);
    document.getElementById('cfg-jornada-m').addEventListener('input', updateJornadaSemanal);

    // Update daily hours when weekly hours change
    document.getElementById('cfg-jornada-semanal').addEventListener('input', () => {
      const semanal = parseFloat(document.getElementById('cfg-jornada-semanal').value) || 44;
      const checked = document.querySelectorAll('#cfg-dias-trabalhados input:checked');
      if (checked.length > 0) {
        const dailyH = semanal / checked.length;
        const totalMin = Math.round(dailyH * 60);
        document.getElementById('cfg-jornada-h').value = Math.floor(totalMin / 60);
        document.getElementById('cfg-jornada-m').value = totalMin % 60;
      }
    });

    document.getElementById('btn-cfg-test').addEventListener('click', async () => {
      const owner = document.getElementById('cfg-owner').value.trim();
      const repo = document.getElementById('cfg-repo').value.trim();
      const token = document.getElementById('cfg-token').value.trim();
      try {
        await GitHubAPI.testConnection(owner, repo, token);
        UI.toast('Conexão OK!', 'success');
      } catch (err) {
        UI.toast(`Erro: ${err.message}`, 'error');
      }
    });

    document.getElementById('btn-cfg-sync').addEventListener('click', async () => {
      UI.toast('Sincronizando...', '');
      const result = await DB.sync();
      if (result.ok) {
        UI.toast('Sincronizado!', 'success');
        UI.renderConfig();
      } else {
        UI.toast(`Erro: ${result.error}`, 'error');
      }
    });

    // Export / Import / Clear
    document.getElementById('btn-cfg-export').addEventListener('click', () => {
      const json = DB.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pontoclt-backup-${Utils.hoje()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('Dados exportados!', 'success');
    });

    document.getElementById('btn-cfg-import').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          DB.importAll(reader.result);
          UI.toast('Dados importados!', 'success');
          UI.renderConfig();
          autoSync();
        } catch (err) {
          UI.toast(`Erro: ${err.message}`, 'error');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-cfg-clear').addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja limpar TODOS os dados (local e GitHub)? Esta ação não pode ser desfeita.')) {
        UI.toast('Limpando dados...', '');
        const result = await DB.clearAll();
        if (result.ok) {
          UI.toast('Todos os dados foram limpos!', 'success');
        } else {
          UI.toast(`Dados locais limpos. Erro no GitHub: ${result.error}`, 'error');
        }
        UI.renderConfig();
      }
    });

    document.getElementById('btn-cfg-logout').addEventListener('click', () => {
      if (confirm('Deseja sair? Suas credenciais serão removidas.')) {
        stopSyncTimer();
        GitHubAPI.clearCredentials();
        UI.toast('Desconectado com sucesso', 'success');
        UI.showSetup();
      }
    });

    // Edit modal
    document.getElementById('modal-edit-close').addEventListener('click', () => UI.closeModal('modal-edit'));
    document.getElementById('modal-edit-save').addEventListener('click', UI.saveEdit);
    document.querySelector('#modal-edit .modal-overlay').addEventListener('click', () => UI.closeModal('modal-edit'));

    // Detalhe modal
    document.getElementById('modal-detalhe-close').addEventListener('click', () => UI.closeModal('modal-detalhe'));
    document.querySelector('#modal-detalhe .modal-overlay').addEventListener('click', () => UI.closeModal('modal-detalhe'));

    // Ajuste modal
    document.getElementById('modal-ajuste-close').addEventListener('click', () => UI.closeModal('modal-ajuste'));
    document.querySelector('#modal-ajuste .modal-overlay').addEventListener('click', () => UI.closeModal('modal-ajuste'));
    document.getElementById('modal-ajuste-save').addEventListener('click', UI.saveAjuste);
    document.getElementById('modal-ajuste-remove').addEventListener('click', UI.removeAjusteBatida);
    document.getElementById('ajuste-obs-input').addEventListener('input', (e) => {
      document.getElementById('ajuste-obs-count').textContent = e.target.value.length;
      e.target.classList.remove('error');
      document.getElementById('ajuste-obs-error').style.display = 'none';
    });

    // Theme
    document.getElementById('cfg-theme').addEventListener('change', (e) => {
      UI.applyTheme(e.target.value);
    });

    // Love notifications
    document.getElementById('cfg-love-notifications').addEventListener('change', (e) => {
      LoveNotifications.setEnabled(e.target.checked);
      if (e.target.checked) {
        LoveNotifications.schedulePeriodicNotification();
        UI.toast('Notificacoes de amor ativadas!', 'success');
      } else {
        UI.toast('Notificacoes desativadas', '');
      }
    });
    document.getElementById('cfg-love-name').addEventListener('input', (e) => {
      LoveNotifications.setName(e.target.value.trim());
    });

    // Date picker
    UI.initDatepickerEvents();

    // Ajuste datepicker
    UI.initAjusteDatepickerEvents();

    // Init time picker wheels
    UI.initTimePickerWheels();

    // Init ajuste time picker wheels
    UI.initAjusteTimePickerWheels();

    // Online/offline events
    window.addEventListener('online', () => {
      autoSync();
      startSyncTimer();
    });
    window.addEventListener('offline', stopSyncTimer);

    // Sync ao voltar para a aba/app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        autoSync();
        startSyncTimer();
      } else {
        stopSyncTimer();
      }
    });
  }

  function updateJornadaSemanal() {
    const h = parseInt(document.getElementById('cfg-jornada-h').value) || 8;
    const m = parseInt(document.getElementById('cfg-jornada-m').value) || 0;
    const checked = document.querySelectorAll('#cfg-dias-trabalhados input:checked');
    const daily = (h * 60 + m) / 60;
    document.getElementById('cfg-jornada-semanal').value = (daily * checked.length).toFixed(1).replace(/\.0$/, '');
  }

  /* ---- Setup handlers ---- */
  async function testSetupConnection() {
    const owner = document.getElementById('setup-owner').value.trim();
    const repo = document.getElementById('setup-repo').value.trim();
    const token = document.getElementById('setup-token').value.trim();
    const statusEl = document.getElementById('setup-status');
    const startBtn = document.getElementById('btn-setup-start');

    if (!owner || !repo || !token) {
      statusEl.textContent = 'Preencha todos os campos';
      statusEl.className = 'setup-status error';
      return;
    }

    statusEl.textContent = 'Testando conexão...';
    statusEl.className = 'setup-status loading';

    try {
      await GitHubAPI.testConnection(owner, repo, token);
      statusEl.textContent = '✓ Conexão bem sucedida!';
      statusEl.className = 'setup-status success';
      startBtn.disabled = false;
    } catch (err) {
      statusEl.textContent = `✗ ${err.message}`;
      statusEl.className = 'setup-status error';
      startBtn.disabled = true;
    }
  }

  async function handleSetupSubmit(e) {
    e.preventDefault();
    const owner = document.getElementById('setup-owner').value.trim();
    const repo = document.getElementById('setup-repo').value.trim();
    const token = document.getElementById('setup-token').value.trim();
    const statusEl = document.getElementById('setup-status');

    GitHubAPI.setCredentials(owner, repo, token);

    statusEl.textContent = 'Configurando...';
    statusEl.className = 'setup-status loading';

    try {
      await GitHubAPI.initDataFile(DB.getConfig());
      statusEl.textContent = '✓ Pronto!';
      statusEl.className = 'setup-status success';
      await Utils.sleep(500);
      UI.showApp();
      autoSync();
      startSyncTimer();
    } catch (err) {
      statusEl.textContent = `✗ Erro: ${err.message}`;
      statusEl.className = 'setup-status error';
    }
  }

  /* ---- Bater ponto ---- */
  function handleBaterPonto() {
    const hoje = Utils.hoje();
    const reg = DB.getRegistro(hoje) || {};
    const proxima = Calculator.proximaBatida(reg);

    if (!proxima) return;

    const hora = Utils.horaAtual();
    DB.baterPonto(hoje, proxima, hora);
    Utils.vibrar();

    // Visual feedback
    const item = document.querySelector(`.timeline-item[data-tipo="${proxima}"]`);
    if (item) {
      const content = item.querySelector('.timeline-content');
      if (content) {
        content.style.background = 'var(--accent-dim)';
        setTimeout(() => (content.style.background = ''), 400);
      }
    }

    UI.renderHome();
    UI.toast(`${Calculator.LABELS[proxima]}: ${hora}`, 'success');

    // Try to sync
    autoSync();
  }

  /* ---- Auto sync ---- */
  let syncing = false;
  let syncTimer = null;
  const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutos

  async function autoSync() {
    if (syncing) return;
    if (!GitHubAPI.hasCredentials() || !navigator.onLine) return;

    syncing = true;
    try {
      const result = await DB.sync();
      if (result.ok) {
        refreshCurrentScreen();
      }
    } finally {
      syncing = false;
    }
  }

  function refreshCurrentScreen() {
    const screen = UI.currentScreen();
    if (screen === 'home') UI.renderHome();
    else if (screen === 'historico') UI.renderHistorico();
    else if (screen === 'resumo') UI.renderResumo();
    else if (screen === 'config') UI.renderConfig();
    else if (screen === 'ajuste') UI.renderAjuste();
  }

  function startSyncTimer() {
    stopSyncTimer();
    syncTimer = setInterval(autoSync, SYNC_INTERVAL);
  }

  function stopSyncTimer() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  // Expor autoSync globalmente para UI poder chamar após edições
  window.autoSync = autoSync;
})();
