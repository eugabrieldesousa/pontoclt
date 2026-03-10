/* ============================================
   PontoCLT — UI
   Renderizacao das telas (Lucide Icons, sem emojis)
   ============================================ */

const UI = (() => {
  /* ---- Toast ---- */
  let toastTimer = null;
  function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast' + (type ? ` ${type}` : '');
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  /* ---- Lucide helper ---- */
  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  /* ---- Navigation ---- */
  let currentScreen = 'home';

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => (s.style.display = 'none'));
    const target = document.getElementById('screen-' + name);
    if (target) target.style.display = 'block';
    currentScreen = name;

    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.screen === name);
    });

    if (name === 'home') renderHome();
    if (name === 'historico') renderHistorico();
    if (name === 'resumo') renderResumo();
    if (name === 'config') renderConfig();
    if (name === 'ajuste') renderAjuste();
  }

  function showSetup() {
    document.querySelectorAll('.screen').forEach((s) => (s.style.display = 'none'));
    document.getElementById('screen-setup').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'none';
    refreshIcons();
  }

  function showApp() {
    document.getElementById('bottom-nav').style.display = 'flex';
    showScreen('home');
    refreshIcons();
  }

  /* ==========================================
     HOME SCREEN
     ========================================== */
  let homeTimer = null;
  let clockTimer = null;

  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock-time').textContent = `${h}:${m}`;
  }

  function startClock() {
    updateClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000);
  }

  function renderHome() {
    const hoje = Utils.hoje();
    const reg = DB.getRegistro(hoje) || {};
    const config = DB.getConfig();

    // Date display
    document.getElementById('home-day-name').textContent = Utils.diaSemana(hoje);
    document.getElementById('home-date-full').textContent = Utils.dataExtenso(hoje);

    // Clock
    startClock();

    // Sync indicator
    const syncBtn = document.getElementById('sync-indicator');
    if (DB.hasPendingSync()) {
      syncBtn.innerHTML = '<i data-lucide="refresh-cw"></i>';
      syncBtn.classList.add('pending');
      syncBtn.title = 'Pendente de sincronizacao';
    } else {
      syncBtn.innerHTML = '<i data-lucide="check-circle"></i>';
      syncBtn.classList.remove('pending');
      syncBtn.title = 'Sincronizado';
    }

    // Timeline batidas
    const proxima = Calculator.proximaBatida(reg);
    Calculator.SEQUENCE.forEach((tipo) => {
      const horaEl = document.getElementById('batida-' + tipo);
      const timelineItem = horaEl.closest('.timeline-item');

      timelineItem.classList.remove('done', 'next');

      if (reg[tipo]) {
        horaEl.textContent = reg[tipo];
        horaEl.classList.remove('empty');
        timelineItem.classList.add('done');
      } else {
        horaEl.textContent = '--:--';
        horaEl.classList.add('empty');
        if (tipo === proxima) {
          timelineItem.classList.add('next');
        }
      }
    });

    // Botao bater ponto
    const btnPonto = document.getElementById('btn-bater-ponto');
    const btnTipo = document.getElementById('btn-ponto-tipo');
    if (proxima) {
      btnPonto.disabled = false;
      btnPonto.classList.remove('complete');
      btnTipo.textContent = Calculator.LABELS[proxima];
    } else {
      btnPonto.disabled = true;
      btnPonto.classList.add('complete');
      btnTipo.textContent = 'Dia completo';
    }

    // Progress
    const jornadaMin = Utils.getJornadaMinutos(config);
    const trabalhado = Calculator.horasTrabalhadas(reg);
    let pct = jornadaMin > 0 ? Math.round((trabalhado / jornadaMin) * 100) : 0;
    pct = Math.min(pct, 120);
    document.getElementById('progress-value').textContent = pct + '%';
    const fillEl = document.getElementById('progress-fill');
    fillEl.style.width = Math.min(pct, 100) + '%';
    fillEl.classList.toggle('over', pct > 100);

    // Stats
    document.getElementById('stat-trabalhadas').textContent = Utils.minutosParaDisplaySemSinal(trabalhado);

    const saldo = Calculator.saldoDia(reg, config);
    const saldoEl = document.getElementById('stat-saldo');
    if (saldo != null) {
      saldoEl.textContent = Utils.minutosParaDisplay(saldo);
      saldoEl.className = 'stat-value' + (saldo > 0 ? ' positive' : saldo < 0 ? ' negative' : '');
    } else {
      saldoEl.textContent = '--';
      saldoEl.className = 'stat-value';
    }

    const statusEl = document.getElementById('stat-status');
    if (!reg.entrada) {
      statusEl.textContent = '--';
    } else if (Calculator.diaCompleto(reg)) {
      const s = saldo || 0;
      statusEl.textContent = s >= 0 ? 'Em dia' : 'Deficit';
      statusEl.className = 'stat-value' + (s >= 0 ? ' positive' : ' negative');
    } else {
      statusEl.textContent = 'Em jornada';
      statusEl.className = 'stat-value';
    }

    // Alertas
    const anterior = DB.getRegistro(Utils.formatDate(new Date(Date.now() - 86400000)));
    const alertas = Calculator.alertasDia(reg, config, anterior);
    const alertsEl = document.getElementById('home-alerts');
    alertsEl.innerHTML = alertas.map((a) =>
      `<div class="alert alert-${a.tipo}"><i data-lucide="alert-triangle" class="alert-icon"></i> ${escapeHtml(a.msg)}</div>`
    ).join('');

    // Timer (atualiza a cada segundo se em jornada)
    clearInterval(homeTimer);
    if (reg.entrada && !Calculator.diaCompleto(reg)) {
      homeTimer = setInterval(() => {
        if (currentScreen !== 'home') { clearInterval(homeTimer); return; }
        const r = DB.getRegistro(Utils.hoje()) || {};
        const t = Calculator.horasTrabalhadas(r);
        document.getElementById('stat-trabalhadas').textContent = Utils.minutosParaDisplaySemSinal(t);

        // Update progress in real time
        const cfg = DB.getConfig();
        const jMin = Utils.getJornadaMinutos(cfg);
        let p = jMin > 0 ? Math.round((t / jMin) * 100) : 0;
        p = Math.min(p, 120);
        document.getElementById('progress-value').textContent = p + '%';
        const fill = document.getElementById('progress-fill');
        fill.style.width = Math.min(p, 100) + '%';
        fill.classList.toggle('over', p > 100);
      }, 1000);
    }

    refreshIcons();
  }

  /* ==========================================
     HISTORICO SCREEN
     ========================================== */
  let histYear, histMonth, histFilter = 'todos';

  function initHistorico() {
    const now = new Date();
    histYear = now.getFullYear();
    histMonth = now.getMonth();
  }

  function renderHistorico() {
    if (histYear == null) initHistorico();
    const config = DB.getConfig();
    const registros = DB.getRegistros();

    document.getElementById('hist-month-label').textContent = Utils.mesAnoLabel(histYear, histMonth);

    const dias = Utils.diasDoMes(histYear, histMonth);
    const hoje = Utils.hoje();
    const list = document.getElementById('historico-list');
    let totalSaldo = 0;
    let diasTrabalhados = 0;
    let diasUteis = 0;
    let items = [];

    for (let i = dias.length - 1; i >= 0; i--) {
      const dia = dias[i];
      if (dia > hoje) continue;
      const reg = registros[dia];
      const isUtil = Utils.isDiaUtil(dia, config);

      if (isUtil) diasUteis++;

      if (!isUtil && !reg) continue;

      let statusClass, statusLabel, saldo, entradaSaida, trabalhado, saldoClass;

      if (reg && Calculator.diaCompleto(reg)) {
        const s = Calculator.saldoDia(reg, config);
        saldo = s || 0;
        totalSaldo += saldo;
        diasTrabalhados++;
        statusClass = 'done';
        statusLabel = 'Completo';
        trabalhado = Calculator.horasTrabalhadasStatic(reg);
        entradaSaida = `${reg.entrada} - ${reg.saida}`;
        saldoClass = saldo > 0 ? 'positive' : saldo < 0 ? 'negative' : 'zero';
      } else if (reg && reg.entrada) {
        saldo = null;
        statusClass = 'pending';
        statusLabel = 'Em andamento';
        trabalhado = Calculator.horasTrabalhadas(reg);
        const ultimaBatida = reg.saida || reg.voltaAlmoco || reg.saidaAlmoco || reg.entrada;
        entradaSaida = `${reg.entrada} - ...`;
        saldoClass = 'zero';
      } else if (isUtil) {
        const dataInicio = config.dataInicioBancoHoras;
        if (dataInicio && dia < dataInicio) {
          saldo = null;
          statusClass = 'not-started';
          statusLabel = 'Não iniciado';
          trabalhado = 0;
          entradaSaida = '--:-- - --:--';
          saldoClass = '';
        } else {
          saldo = null;
          statusClass = 'missing';
          statusLabel = 'Sem registro';
          trabalhado = 0;
          entradaSaida = '--:-- - --:--';
          saldoClass = 'negative';
        }
      } else {
        continue;
      }

      if (histFilter === 'extras' && !(saldo > 0)) continue;
      if (histFilter === 'faltas' && statusClass !== 'missing') continue;
      if (histFilter === 'pendentes' && statusClass !== 'pending') continue;

      const diaNum = Utils.parseDate(dia).getDate();
      const diaNome = Utils.diaCurto(dia);
      const saldoText = saldo != null ? Utils.minutosParaDisplay(saldo) : '--';
      const trabText = Utils.minutosParaDisplaySemSinal(trabalhado);
      const hasObs = reg && reg.obs ? true : false;

      items.push(`
        <div class="hist-card" data-dia="${dia}">
          <div class="hist-card-left">
            <div class="hist-card-day">
              <span class="hist-card-num">${diaNum}</span>
              <span class="hist-card-weekday">${diaNome}</span>
            </div>
            <div class="hist-card-status status-${statusClass}">${statusLabel}</div>
          </div>
          <div class="hist-card-center">
            <div class="hist-card-times">
              <i data-lucide="clock" class="hist-card-icon"></i>
              <span>${escapeHtml(entradaSaida)}</span>
            </div>
            <div class="hist-card-worked">${trabText}</div>
          </div>
          <div class="hist-card-right">
            <div class="hist-card-saldo ${saldoClass}">${saldoText}</div>
            <i data-lucide="chevron-right" class="hist-card-arrow"></i>
          </div>
        </div>
      `);
    }

    list.innerHTML = items.length > 0
      ? items.join('')
      : '<div class="historico-empty"><i data-lucide="calendar-x" class="empty-icon"></i><p>Nenhum registro encontrado</p></div>';

    // Summary card
    const summaryEl = document.getElementById('hist-summary');
    const saldoClass = totalSaldo > 0 ? 'positive' : totalSaldo < 0 ? 'negative' : '';
    summaryEl.innerHTML = `
      <div class="hist-summary-item">
        <span class="hist-summary-label">Dias</span>
        <span class="hist-summary-value">${diasTrabalhados}/${diasUteis}</span>
      </div>
      <div class="hist-summary-item">
        <span class="hist-summary-label">Saldo do mes</span>
        <span class="hist-summary-value ${saldoClass}">${Utils.minutosParaDisplay(totalSaldo)}</span>
      </div>
    `;

    list.querySelectorAll('.hist-card').forEach((item) => {
      item.addEventListener('click', () => openDetalhe(item.dataset.dia));
    });

    refreshIcons();
  }

  function changeHistMonth(delta) {
    histMonth += delta;
    if (histMonth > 11) { histMonth = 0; histYear++; }
    if (histMonth < 0) { histMonth = 11; histYear--; }
    renderHistorico();
  }

  function setHistFilter(filter) {
    histFilter = filter;
    document.querySelectorAll('.filter-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    renderHistorico();
  }

  /* ---- Detalhe do dia (modal) ---- */
  const DETALHE_ICONS = {
    entrada: 'log-in',
    saidaAlmoco: 'utensils',
    voltaAlmoco: 'coffee',
    saida: 'log-out'
  };

  function openDetalhe(dateStr) {
    const reg = DB.getRegistro(dateStr) || {};
    const config = DB.getConfig();

    document.getElementById('modal-detalhe-title').textContent =
      `${Utils.diaSemana(dateStr)}, ${Utils.dataExtenso(dateStr)}`;

    const body = document.getElementById('modal-detalhe-body');
    const trabalhado = Calculator.horasTrabalhadasStatic(reg);
    const intervalo = Calculator.intervaloAlmoco(reg);
    const saldo = Calculator.saldoDia(reg, config);
    const extras = Calculator.horasExtras(reg, config);
    const def = Calculator.deficit(reg, config);

    body.innerHTML = `
      <div class="detalhe-batidas">
        ${Calculator.SEQUENCE.map((tipo) => `
          <div class="detalhe-row detalhe-row-editable" data-date="${dateStr}" data-tipo="${tipo}">
            <span class="detalhe-row-label"><i data-lucide="${DETALHE_ICONS[tipo]}" class="detalhe-row-icon"></i> ${Calculator.LABELS[tipo]}</span>
            <span class="detalhe-row-value">
              ${reg[tipo] || '--:--'}
              <i data-lucide="pencil" class="detalhe-edit-icon"></i>
            </span>
          </div>
        `).join('')}
      </div>
      <div class="detalhe-stats">
        <div class="detalhe-stat-row">
          <span>Horas trabalhadas</span>
          <span>${Utils.minutosParaDisplaySemSinal(trabalhado)}</span>
        </div>
        <div class="detalhe-stat-row">
          <span>Intervalo almoco</span>
          <span>${intervalo > 0 ? Utils.minutosParaDisplaySemSinal(intervalo) : '--'}</span>
        </div>
        <div class="detalhe-stat-row">
          <span>Saldo do dia</span>
          <span class="${saldo > 0 ? 'text-accent' : saldo < 0 ? 'text-danger' : ''}">${saldo != null ? Utils.minutosParaDisplay(saldo) : '--'}</span>
        </div>
        ${extras > 0 ? `<div class="detalhe-stat-row"><span>Horas extras</span><span class="text-accent">${Utils.minutosParaDisplaySemSinal(extras)}</span></div>` : ''}
        ${def > 0 ? `<div class="detalhe-stat-row"><span>Deficit</span><span class="text-danger">${Utils.minutosParaDisplaySemSinal(def)}</span></div>` : ''}
      </div>

    `;

    body.querySelectorAll('.detalhe-row-editable').forEach((row) => {
      row.addEventListener('click', () => {
        closeModal('modal-detalhe');
        openEditModal(row.dataset.date, row.dataset.tipo);
      });
    });

    openModal('modal-detalhe');
    refreshIcons();
  }

  function openEditBatidas(dateStr) {
    const reg = DB.getRegistro(dateStr) || {};
    const tipo = Calculator.SEQUENCE.find((t) => !reg[t]) || 'entrada';
    openEditModal(dateStr, tipo);
  }

  /* ---- Edit Modal ---- */
  let editContext = {};
  const TP_ITEM_H = 40;

  function initTimePickerWheels() {
    const hoursEl = document.getElementById('tp-edit-hours');
    const minutesEl = document.getElementById('tp-edit-minutes');
    let hHtml = '';
    for (let i = 0; i < 24; i++) {
      hHtml += `<div class="tp-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`;
    }
    hoursEl.innerHTML = hHtml;
    let mHtml = '';
    for (let i = 0; i < 60; i++) {
      mHtml += `<div class="tp-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`;
    }
    minutesEl.innerHTML = mHtml;
    hoursEl.addEventListener('scroll', () => updateTPSelection(hoursEl));
    minutesEl.addEventListener('scroll', () => updateTPSelection(minutesEl));
  }

  function updateTPSelection(wheel) {
    clearTimeout(wheel._tpTimer);
    wheel._tpTimer = setTimeout(() => {
      const idx = Math.round(wheel.scrollTop / TP_ITEM_H);
      wheel.querySelectorAll('.tp-item').forEach((item, i) => {
        item.classList.toggle('active', i === idx);
      });
    }, 40);
  }

  function setTPValue(wheel, value) {
    wheel.scrollTop = value * TP_ITEM_H;
    updateTPSelection(wheel);
  }

  function getTPValue(wheel) {
    return Math.round(wheel.scrollTop / TP_ITEM_H);
  }

  function openEditModal(dateStr, tipo) {
    editContext = { dateStr, tipo };
    const reg = DB.getRegistro(dateStr) || {};
    document.getElementById('modal-edit-label').textContent = Calculator.LABELS[tipo];
    openModal('modal-edit');

    const hora = reg[tipo] || '08:00';
    const [h, m] = hora.split(':').map(Number);
    setTimeout(() => {
      const hoursEl = document.getElementById('tp-edit-hours');
      const minutesEl = document.getElementById('tp-edit-minutes');
      setTPValue(hoursEl, h || 0);
      setTPValue(minutesEl, m || 0);
    }, 50);
    refreshIcons();
  }

  function saveEdit() {
    const { dateStr, tipo } = editContext;
    const h = getTPValue(document.getElementById('tp-edit-hours'));
    const m = getTPValue(document.getElementById('tp-edit-minutes'));
    const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    DB.editarBatida(dateStr, tipo, hora);
    closeModal('modal-edit');
    toast('Horario atualizado', 'success');
    if (currentScreen === 'home') renderHome();
    if (currentScreen === 'historico') renderHistorico();
    if (window.autoSync) window.autoSync();
  }

  /* ---- Modal helpers ---- */
  function openModal(id) {
    document.getElementById(id).style.display = 'flex';
  }

  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }

  /* ==========================================
     RESUMO SCREEN
     ========================================== */
  let resumoYear, resumoMonth;

  function initResumo() {
    const now = new Date();
    resumoYear = now.getFullYear();
    resumoMonth = now.getMonth();
  }

  function renderResumo() {
    if (resumoYear == null) initResumo();
    const config = DB.getConfig();
    const registros = DB.getRegistros();

    document.getElementById('resumo-month-label').textContent = Utils.mesAnoLabel(resumoYear, resumoMonth);

    const resumo = Calculator.resumoMensal(registros, config, resumoYear, resumoMonth);
    const jornadaMin = Utils.getJornadaMinutos(config);

    const cards = document.getElementById('resumo-cards');
    const saldoClass = resumo.saldo >= 0 ? 'positive' : 'negative';
    const saldoIcon = resumo.saldo >= 0 ? 'trending-up' : 'trending-down';

    let cardsHtml = `
      <div class="resumo-card highlight ${saldoClass}">
        <div class="resumo-card-header">
          <i data-lucide="${saldoIcon}" class="resumo-card-icon-lg"></i>
          <div class="resumo-card-label">Saldo de Horas</div>
        </div>
        <div class="resumo-card-value">${Utils.minutosParaDisplay(resumo.saldo)}</div>
      </div>

      <div class="resumo-section-label">
        <i data-lucide="bar-chart-2" class="resumo-section-icon"></i>
        Vis\u00e3o geral
      </div>

      <div class="resumo-card">
        <i data-lucide="calendar-check" class="resumo-card-icon"></i>
        <div class="resumo-card-label">Dias trabalhados</div>
        <div class="resumo-card-value">${resumo.diasTrabalhados}<span class="resumo-card-total">/${resumo.diasUteis}</span></div>
      </div>
      <div class="resumo-card">
        <i data-lucide="clock" class="resumo-card-icon"></i>
        <div class="resumo-card-label">Total trabalhado</div>
        <div class="resumo-card-value">${Utils.minutosParaDisplaySemSinal(resumo.totalTrabalhado)}</div>
      </div>
      <div class="resumo-card">
        <i data-lucide="target" class="resumo-card-icon"></i>
        <div class="resumo-card-label">Horas esperadas</div>
        <div class="resumo-card-value">${Utils.minutosParaDisplaySemSinal(resumo.horasEsperadas)}</div>
      </div>
      <div class="resumo-card">
        <i data-lucide="utensils" class="resumo-card-icon"></i>
        <div class="resumo-card-label">M\u00e9dia intervalo</div>
        <div class="resumo-card-value">${resumo.mediaIntervalo > 0 ? resumo.mediaIntervalo + 'min' : '--'}</div>
      </div>

      <div class="resumo-section-label">
        <i data-lucide="scale" class="resumo-section-icon"></i>
        Horas extras & d\u00e9ficit
      </div>

      <div class="resumo-card">
        <i data-lucide="plus-circle" class="resumo-card-icon"></i>
        <div class="resumo-card-label">Horas extras</div>
        <div class="resumo-card-value text-accent">${Utils.minutosParaDisplaySemSinal(resumo.totalExtras)}</div>
      </div>
      <div class="resumo-card">
        <i data-lucide="minus-circle" class="resumo-card-icon"></i>
        <div class="resumo-card-label">D\u00e9ficit</div>
        <div class="resumo-card-value text-danger">${Utils.minutosParaDisplaySemSinal(resumo.totalDeficit)}</div>
      </div>
    `;

    if (resumo.totalMinutosNoturnos > 0) {
      cardsHtml += `
        <div class="resumo-card">
          <i data-lucide="moon" class="resumo-card-icon"></i>
          <div class="resumo-card-label">Horas noturnas</div>
          <div class="resumo-card-value">${Utils.minutosParaDisplaySemSinal(resumo.totalMinutosNoturnos)}</div>
        </div>
      `;
    }

    if (resumo.valorExtras != null) {
      cardsHtml += `
        <div class="resumo-card">
          <i data-lucide="dollar-sign" class="resumo-card-icon"></i>
          <div class="resumo-card-label">Extras (R$)</div>
          <div class="resumo-card-value text-accent">R$ ${resumo.valorExtras.toFixed(2)}</div>
        </div>
      `;
    }

    cards.innerHTML = cardsHtml;

    renderChart(registros, config, resumoYear, resumoMonth);

    const alertsEl = document.getElementById('resumo-alerts');
    if (resumo.irregularidades.length > 0) {
      alertsEl.innerHTML = `<h3 style="font-size:0.9rem;margin-bottom:8px;">Irregularidades</h3>` +
        resumo.irregularidades.map((irr) =>
          irr.alertas.map((a) =>
            `<div class="resumo-alert-item">
              <i data-lucide="alert-triangle" class="resumo-alert-icon"></i>
              <span>${Utils.diaCurto(irr.dia)} ${Utils.parseDate(irr.dia).getDate()}</span>
              <span>${escapeHtml(a.msg)}</span>
            </div>`
          ).join('')
        ).join('');
    } else {
      alertsEl.innerHTML = '';
    }

    refreshIcons();
  }

  function renderChart(registros, config, year, month) {
    const chartEl = document.getElementById('resumo-chart');
    const dias = Utils.diasDoMes(year, month);
    const hoje = Utils.hoje();
    const jornadaMin = Utils.getJornadaMinutos(config);
    const maxH = jornadaMin + 120;
    const jornadaH = Math.floor(jornadaMin / 60);
    const jornadaM = jornadaMin % 60;
    const jornadaLabel = jornadaM > 0 ? `${jornadaH}h${String(jornadaM).padStart(2, '0')}` : `${jornadaH}h`;

    let bars = [];
    for (const dia of dias) {
      if (dia > hoje) continue;
      if (!Utils.isDiaUtil(dia, config)) continue;
      const reg = registros[dia];
      let trab = 0;
      let cls = '';
      if (reg && Calculator.diaCompleto(reg)) {
        trab = Calculator.horasTrabalhadasStatic(reg);
        if (trab > jornadaMin + 10) cls = 'over';
        else if (trab < jornadaMin - 10) cls = 'under';
      } else {
        cls = 'under';
      }
      const pct = Math.min(100, (trab / maxH) * 100);
      bars.push(`
        <div class="chart-bar-wrapper">
          <div class="chart-bar ${cls}" style="height:${pct}%;" title="${Utils.minutosParaDisplaySemSinal(trab)}"></div>
          <div class="chart-bar-label">${Utils.parseDate(dia).getDate()}</div>
        </div>
      `);
    }

    const refPct = (jornadaMin / maxH) * 100;

    chartEl.innerHTML = `
      <div class="chart-title">Horas por dia</div>
      <div class="chart-bars" style="position:relative;">
        <div class="chart-ref-line" style="bottom:${refPct}%;">
          <span class="chart-ref-label">${jornadaLabel}</span>
        </div>
        ${bars.join('')}
      </div>
    `;
  }

  function changeResumoMonth(delta) {
    resumoMonth += delta;
    if (resumoMonth > 11) { resumoMonth = 0; resumoYear++; }
    if (resumoMonth < 0) { resumoMonth = 11; resumoYear--; }
    renderResumo();
  }

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensurePdfLibs() {
    if (window.jspdf && typeof window.jspdf.jsPDF === 'function') return true;
    try {
      await loadScript('./js/vendor/jspdf.umd.min.js');
      await loadScript('./js/vendor/jspdf.plugin.autotable.min.js');
      return !!(window.jspdf && typeof window.jspdf.jsPDF === 'function');
    } catch (e) {
      return false;
    }
  }

  async function exportResumo() {
    if (resumoYear == null) initResumo();
    if (!window.jspdf) {
      toast('Carregando biblioteca PDF...', 'info');
      var loaded = await ensurePdfLibs();
      if (!loaded) {
        toast('Falha ao carregar biblioteca PDF. Verifique sua conexao.', 'error');
        return;
      }
    }
    const { jsPDF } = window.jspdf;
    const config = DB.getConfig();
    const registros = DB.getRegistros();
    const resumo = Calculator.resumoMensal(registros, config, resumoYear, resumoMonth);
    const label = Utils.mesAnoLabel(resumoYear, resumoMonth);
    const dias = Utils.diasDoMes(resumoYear, resumoMonth);
    const hoje = Utils.hoje();

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    // Header bar
    doc.setFillColor(0, 135, 90);
    doc.rect(0, 0, pw, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relat\u00f3rio de Ponto', 14, 16);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 14, 26);
    doc.setFontSize(8);
    doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), pw - 14, 26, { align: 'right' });

    doc.setTextColor(50, 50, 60);

    // Summary table
    let y = 46;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do M\u00eas', 14, y);
    y += 6;

    const summaryData = [
      ['Dias Trabalhados', resumo.diasTrabalhados + ' / ' + resumo.diasUteis],
      ['Total Trabalhado', Utils.minutosParaDisplaySemSinal(resumo.totalTrabalhado)],
      ['Horas Esperadas', Utils.minutosParaDisplaySemSinal(resumo.horasEsperadas)],
      ['Saldo', Utils.minutosParaDisplay(resumo.saldo)],
      ['Horas Extras', Utils.minutosParaDisplaySemSinal(resumo.totalExtras)],
      ['D\u00e9ficit', Utils.minutosParaDisplaySemSinal(resumo.totalDeficit)],
      ['M\u00e9dia Intervalo', resumo.mediaIntervalo > 0 ? resumo.mediaIntervalo + ' min' : '--'],
    ];
    if (resumo.totalMinutosNoturnos > 0) {
      summaryData.push(['Horas Noturnas', Utils.minutosParaDisplaySemSinal(resumo.totalMinutosNoturnos)]);
    }
    if (resumo.valorExtras != null) {
      summaryData.push(['Valor Extras', 'R$ ' + resumo.valorExtras.toFixed(2)]);
    }

    doc.autoTable({
      startY: y,
      head: [['M\u00e9trica', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [0, 135, 90], textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 14;

    // Daily records
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Registros Di\u00e1rios', 14, y);
    y += 6;

    const dailyData = [];
    for (const dia of dias) {
      if (dia > hoje) continue;
      const reg = registros[dia];
      const isUtil = Utils.isDiaUtil(dia, config);
      if (!isUtil && !reg) continue;

      const d = Utils.parseDate(dia);
      const diaNum = d.getDate();
      const diaSem = Utils.diaCurto(dia);

      if (reg && Calculator.diaCompleto(reg)) {
        const trab = Calculator.horasTrabalhadasStatic(reg);
        const saldo = Calculator.saldoDia(reg, config);
        dailyData.push([
          String(diaNum), diaSem,
          reg.entrada || '--:--', reg.saidaAlmoco || '--:--',
          reg.voltaAlmoco || '--:--', reg.saida || '--:--',
          Utils.minutosParaDisplaySemSinal(trab),
          saldo != null ? Utils.minutosParaDisplay(saldo) : '--'
        ]);
      } else if (reg && reg.entrada) {
        dailyData.push([
          String(diaNum), diaSem,
          reg.entrada || '--:--', reg.saidaAlmoco || '--:--',
          reg.voltaAlmoco || '--:--', reg.saida || '--:--',
          '--', 'Incompleto'
        ]);
      } else if (isUtil) {
        dailyData.push([
          String(diaNum), diaSem,
          '--:--', '--:--', '--:--', '--:--', '--', 'Sem registro'
        ]);
      }
    }

    doc.autoTable({
      startY: y,
      head: [['Dia', '', 'Entrada', 'Sa\u00edda Alm.', 'Volta Alm.', 'Sa\u00edda', 'Trab.', 'Saldo']],
      body: dailyData,
      theme: 'striped',
      headStyles: { fillColor: [0, 135, 90], textColor: [255, 255, 255], fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 12 }, 1: { cellWidth: 14 },
        2: { cellWidth: 20 }, 3: { cellWidth: 22 },
        4: { cellWidth: 22 }, 5: { cellWidth: 20 },
        6: { cellWidth: 26 }, 7: { cellWidth: 26 }
      },
      margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 10;

    // Irregularities
    if (resumo.irregularidades.length > 0) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Irregularidades', 14, y);
      y += 6;

      const irrData = [];
      for (const irr of resumo.irregularidades) {
        for (const a of irr.alertas) {
          irrData.push([Utils.parseDate(irr.dia).getDate() + ' ' + Utils.diaCurto(irr.dia), a.msg]);
        }
      }
      doc.autoTable({
        startY: y,
        head: [['Dia', 'Irregularidade']],
        body: irrData,
        theme: 'grid',
        headStyles: { fillColor: [255, 107, 53], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: 14, right: 14 }
      });
    }

    // Footer
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('PontoCLT \u2014 Controle de ponto pessoal', 14, ph - 8);

    const filename = 'relatorio-ponto-' + resumoYear + '-' + String(resumoMonth + 1).padStart(2, '0') + '.pdf';
    doc.save(filename);
    toast('PDF gerado com sucesso!', 'success');
  }

  /* ==========================================
     CONFIG SCREEN
     ========================================== */
  function renderConfig() {
    const config = DB.getConfig();
    const creds = GitHubAPI.getCredentials();

    const jornadaMin = Utils.getJornadaMinutos(config);
    document.getElementById('cfg-jornada-h').value = Math.floor(jornadaMin / 60);
    document.getElementById('cfg-jornada-m').value = jornadaMin % 60;
    const diasTrab = config.diasTrabalhados || [1,2,3,4,5];
    const horasSemana = config.jornadaSemanalHoras != null
      ? config.jornadaSemanalHoras
      : (jornadaMin / 60) * diasTrab.length;
    document.getElementById('cfg-jornada-semanal').value = horasSemana;
    document.getElementById('cfg-intervalo').value = config.intervaloMinutos || 60;
    document.getElementById('cfg-owner').value = creds.owner;
    document.getElementById('cfg-repo').value = creds.repo;
    document.getElementById('cfg-token').value = creds.token;

    // Dias trabalhados checkboxes
    const checksContainer = document.getElementById('cfg-dias-trabalhados');
    checksContainer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = diasTrab.includes(parseInt(cb.value));
    });

    // Update hours/week when days change
    checksContainer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const checked = checksContainer.querySelectorAll('input:checked');
        const h = parseInt(document.getElementById('cfg-jornada-h').value) || 8;
        const m = parseInt(document.getElementById('cfg-jornada-m').value) || 0;
        document.getElementById('cfg-jornada-semanal').value = ((h * 60 + m) / 60 * checked.length).toFixed(1).replace(/\.0$/, '');
      });
    });

    // Banco de horas
    document.getElementById('cfg-data-inicio').value = config.dataInicioBancoHoras || '';
    renderDatepicker(config.dataInicioBancoHoras || '');
    renderBancoHorasInfo(config);

    const lastSync = DB.getLastSync();
    document.getElementById('cfg-sync-status').textContent = lastSync
      ? `Ultima sync: ${new Date(lastSync).toLocaleString('pt-BR')}` : 'Nunca sincronizado';

    const theme = localStorage.getItem('pontoclt_theme') || 'dark';
    document.getElementById('cfg-theme').value = theme;

    refreshIcons();
  }

  function renderBancoHorasInfo(config) {
    const infoEl = document.getElementById('cfg-banco-horas-info');
    const dataInicio = config.dataInicioBancoHoras;
    if (!dataInicio) {
      infoEl.innerHTML = '<span class="form-hint">Configure a data de inicio para ver o saldo acumulado</span>';
      return;
    }
    const registros = DB.getRegistros();
    let saldoAcumulado = 0;
    const hoje = Utils.hoje();
    for (const [dia, reg] of Object.entries(registros)) {
      if (dia < dataInicio || dia > hoje) continue;
      if (Calculator.diaCompleto(reg)) {
        const s = Calculator.saldoDia(reg, config);
        if (s != null) saldoAcumulado += s;
      }
    }
    const cls = saldoAcumulado > 0 ? 'positive' : saldoAcumulado < 0 ? 'negative' : '';
    infoEl.innerHTML = `
      <div class="banco-horas-card">
        <div class="banco-horas-label">Saldo acumulado desde ${Utils.dataExtenso(dataInicio)}</div>
        <div class="banco-horas-value ${cls}">${Utils.minutosParaDisplay(saldoAcumulado)}</div>
      </div>
    `;
  }

  /* ---- Custom Date Picker ---- */
  let dpYear, dpMonth, dpSelectedValue = '';

  function renderDatepicker(value) {
    dpSelectedValue = value || '';
    const textEl = document.getElementById('cfg-data-inicio-text');
    if (dpSelectedValue) {
      textEl.textContent = Utils.dataExtenso(dpSelectedValue);
      textEl.classList.add('has-value');
    } else {
      textEl.textContent = 'Selecionar data';
      textEl.classList.remove('has-value');
    }
  }

  function toggleDatepicker() {
    const dropdown = document.getElementById('cfg-data-inicio-dropdown');
    if (dropdown.style.display === 'none') {
      const now = dpSelectedValue ? Utils.parseDate(dpSelectedValue) : new Date();
      dpYear = now.getFullYear();
      dpMonth = now.getMonth();
      renderDatepickerCalendar();
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  }

  function renderDatepickerCalendar() {
    document.getElementById('dp-month-label').textContent = Utils.mesAnoLabel(dpYear, dpMonth);
    const daysEl = document.getElementById('dp-days');
    const firstDow = new Date(dpYear, dpMonth, 1).getDay();
    const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();
    const hoje = Utils.hoje();

    let html = '';
    for (let i = 0; i < firstDow; i++) {
      html += '<span class="dp-day empty"></span>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = Utils.formatDate(new Date(dpYear, dpMonth, d));
      const isSelected = dateStr === dpSelectedValue;
      const isToday = dateStr === hoje;
      const isFuture = dateStr > hoje;
      let cls = 'dp-day';
      if (isSelected) cls += ' selected';
      if (isToday) cls += ' today';
      if (isFuture) cls += ' disabled';
      html += `<span class="${cls}" data-date="${dateStr}">${d}</span>`;
    }
    daysEl.innerHTML = html;

    daysEl.querySelectorAll('.dp-day:not(.empty):not(.disabled)').forEach((el) => {
      el.addEventListener('click', () => {
        dpSelectedValue = el.dataset.date;
        document.getElementById('cfg-data-inicio').value = dpSelectedValue;
        renderDatepicker(dpSelectedValue);
        document.getElementById('cfg-data-inicio-dropdown').style.display = 'none';
        refreshIcons();
      });
    });

    refreshIcons();
  }

  function initDatepickerEvents() {
    document.getElementById('cfg-data-inicio-display').addEventListener('click', toggleDatepicker);
    document.getElementById('dp-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      dpMonth--;
      if (dpMonth < 0) { dpMonth = 11; dpYear--; }
      renderDatepickerCalendar();
    });
    document.getElementById('dp-next').addEventListener('click', (e) => {
      e.stopPropagation();
      dpMonth++;
      if (dpMonth > 11) { dpMonth = 0; dpYear++; }
      renderDatepickerCalendar();
    });
    document.getElementById('dp-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      dpSelectedValue = '';
      document.getElementById('cfg-data-inicio').value = '';
      renderDatepicker('');
      document.getElementById('cfg-data-inicio-dropdown').style.display = 'none';
    });
    document.addEventListener('click', (e) => {
      const picker = document.getElementById('cfg-data-inicio-picker');
      if (picker && !picker.contains(e.target)) {
        document.getElementById('cfg-data-inicio-dropdown').style.display = 'none';
      }
    });
  }

  function saveConfig() {
    const diasCheckboxes = document.querySelectorAll('#cfg-dias-trabalhados input:checked');
    const diasTrabalhados = Array.from(diasCheckboxes).map((cb) => parseInt(cb.value));

    const h = parseInt(document.getElementById('cfg-jornada-h').value) || 8;
    const m = parseInt(document.getElementById('cfg-jornada-m').value) || 0;
    const jornadaDiariaMinutos = h * 60 + m;
    const jornadaSemanalHoras = parseFloat(document.getElementById('cfg-jornada-semanal').value) || 44;

    const existingConfig = DB.getConfig();
    const config = {
      jornadaHoras: jornadaDiariaMinutos / 60,
      jornadaDiariaMinutos: jornadaDiariaMinutos,
      jornadaSemanalHoras: jornadaSemanalHoras,
      intervaloMinutos: parseInt(document.getElementById('cfg-intervalo').value) || 60,
      toleranciaMinutos: existingConfig.toleranciaMinutos || 10,
      salarioBase: existingConfig.salarioBase || null,
      horaExtraPercentual: existingConfig.horaExtraPercentual || 50,
      adicionalNoturnoPercentual: existingConfig.adicionalNoturnoPercentual || 20,
      diasTrabalhados: diasTrabalhados.length > 0 ? diasTrabalhados : [1,2,3,4,5],
      dataInicioBancoHoras: document.getElementById('cfg-data-inicio').value || null
    };
    DB.setConfig(config);

    const owner = document.getElementById('cfg-owner').value.trim();
    const repo = document.getElementById('cfg-repo').value.trim();
    const token = document.getElementById('cfg-token').value.trim();
    if (owner && repo && token) {
      GitHubAPI.setCredentials(owner, repo, token);
    }

    const theme = document.getElementById('cfg-theme').value;
    applyTheme(theme);

    toast('Configuracoes salvas!', 'success');
    if (window.autoSync) window.autoSync();
  }

  function applyTheme(theme) {
    localStorage.setItem('pontoclt_theme', theme);
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function initTheme() {
    const theme = localStorage.getItem('pontoclt_theme') || 'dark';
    applyTheme(theme);
  }

  /* ---- Helper ---- */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  window._escapeHtml = escapeHtml;

  /* ==========================================
     AJUSTE DE PONTO SCREEN
     ========================================== */
  let ajusteDpYear, ajusteDpMonth, ajusteSelectedDate = '';
  let ajusteContext = {};

  const AJUSTE_ICONS = {
    entrada: 'log-in',
    saidaAlmoco: 'utensils',
    voltaAlmoco: 'coffee',
    saida: 'log-out'
  };

  const AJUSTE_HINTS = {
    entrada: 'Inicio da jornada',
    saidaAlmoco: 'Saida para almoco',
    voltaAlmoco: 'Retorno do almoco',
    saida: 'Fim da jornada'
  };

  function renderAjuste() {
    // Initialize datepicker
    if (!ajusteDpYear) {
      const now = new Date();
      ajusteDpYear = now.getFullYear();
      ajusteDpMonth = now.getMonth();
    }
    renderAjusteDatepicker();
    if (ajusteSelectedDate) {
      renderAjusteBatidas(ajusteSelectedDate);
    }
    refreshIcons();
  }

  function renderAjusteDatepicker() {
    const textEl = document.getElementById('ajuste-date-text');
    if (ajusteSelectedDate) {
      textEl.textContent = Utils.diaSemana(ajusteSelectedDate) + ', ' + Utils.dataExtenso(ajusteSelectedDate);
      textEl.classList.add('has-value');
    } else {
      textEl.textContent = 'Selecionar data';
      textEl.classList.remove('has-value');
    }
  }

  function toggleAjusteDatepicker() {
    const dropdown = document.getElementById('ajuste-date-dropdown');
    if (dropdown.style.display === 'none') {
      if (ajusteSelectedDate) {
        const d = Utils.parseDate(ajusteSelectedDate);
        ajusteDpYear = d.getFullYear();
        ajusteDpMonth = d.getMonth();
      }
      renderAjusteDatepickerCalendar();
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  }

  function renderAjusteDatepickerCalendar() {
    document.getElementById('ajuste-dp-month-label').textContent = Utils.mesAnoLabel(ajusteDpYear, ajusteDpMonth);
    const daysEl = document.getElementById('ajuste-dp-days');
    const firstDow = new Date(ajusteDpYear, ajusteDpMonth, 1).getDay();
    const daysInMonth = new Date(ajusteDpYear, ajusteDpMonth + 1, 0).getDate();
    const hoje = Utils.hoje();

    let html = '';
    for (let i = 0; i < firstDow; i++) {
      html += '<span class="dp-day empty"></span>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = Utils.formatDate(new Date(ajusteDpYear, ajusteDpMonth, d));
      const isSelected = dateStr === ajusteSelectedDate;
      const isToday = dateStr === hoje;
      const isFuture = dateStr > hoje;
      let cls = 'dp-day';
      if (isSelected) cls += ' selected';
      if (isToday) cls += ' today';
      if (isFuture) cls += ' disabled';
      html += `<span class="${cls}" data-date="${dateStr}">${d}</span>`;
    }
    daysEl.innerHTML = html;

    daysEl.querySelectorAll('.dp-day:not(.empty):not(.disabled)').forEach((el) => {
      el.addEventListener('click', () => {
        ajusteSelectedDate = el.dataset.date;
        renderAjusteDatepicker();
        renderAjusteBatidas(ajusteSelectedDate);
        document.getElementById('ajuste-date-dropdown').style.display = 'none';
        refreshIcons();
      });
    });

    refreshIcons();
  }

  function renderAjusteBatidas(dateStr) {
    const container = document.getElementById('ajuste-batidas');
    const reg = DB.getRegistro(dateStr) || {};
    const hasAny = reg.entrada || reg.saidaAlmoco || reg.voltaAlmoco || reg.saida;

    let html = '';

    // Day header
    html += `
      <div class="ajuste-day-header">
        <div class="ajuste-day-info">
          <div class="ajuste-day-name">${Utils.diaSemana(dateStr)}</div>
          <div class="ajuste-day-date">${Utils.dataExtenso(dateStr)}</div>
        </div>
        <span class="ajuste-day-badge ${hasAny ? 'has-records' : 'no-records'}">
          ${hasAny ? '<i data-lucide="check-circle" style="width:12px;height:12px;"></i> Com registros' : '<i data-lucide="alert-circle" style="width:12px;height:12px;"></i> Sem registros'}
        </span>
      </div>
    `;

    // Batidas
    html += '<div class="ajuste-batidas-label"><i data-lucide="clock" style="width:14px;height:14px;color:var(--accent);"></i> Batidas do dia</div>';
    html += '<div class="ajuste-batidas-grid">';

    Calculator.SEQUENCE.forEach((tipo) => {
      const hora = reg[tipo];
      const hasValue = !!hora;
      html += `
        <div class="ajuste-batida-card ${hasValue ? 'has-value' : 'empty'}" data-date="${dateStr}" data-tipo="${tipo}">
          <div class="ajuste-batida-icon">
            <i data-lucide="${AJUSTE_ICONS[tipo]}"></i>
          </div>
          <div class="ajuste-batida-info">
            <div class="ajuste-batida-tipo">${Calculator.LABELS[tipo]}</div>
            <div class="ajuste-batida-hint">${AJUSTE_HINTS[tipo]}</div>
          </div>
          <div class="ajuste-batida-hora">
            ${hora || '--:--'}
            <i data-lucide="${hasValue ? 'pencil' : 'plus'}" class="ajuste-batida-edit-icon"></i>
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Tip
    html += `
      <div class="ajuste-tip">
        <i data-lucide="info"></i>
        <span>Toque em uma batida para ajustar o horario. Cada ajuste requer um motivo obrigatorio.</span>
      </div>
    `;

    // Show history of adjustments if there are obs
    if (reg.obs) {
      html += `
        <div class="ajuste-history-section">
          <div class="ajuste-history-label"><i data-lucide="file-text" style="width:14px;height:14px;color:var(--accent);"></i> Historico de ajustes</div>
      `;
      const lines = reg.obs.split('\n').filter(l => l.trim());
      lines.forEach((line) => {
        html += `
          <div class="ajuste-history-item">
            <i data-lucide="edit-3"></i>
            <span class="ajuste-history-text">${escapeHtml(line)}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    container.innerHTML = html;
    container.style.display = 'block';

    // Bind click on batida cards
    container.querySelectorAll('.ajuste-batida-card').forEach((card) => {
      card.addEventListener('click', () => {
        openAjusteModal(card.dataset.date, card.dataset.tipo);
      });
    });

    refreshIcons();
  }

  /* ---- Ajuste Modal ---- */
  function initAjusteTimePickerWheels() {
    const hoursEl = document.getElementById('tp-ajuste-hours');
    const minutesEl = document.getElementById('tp-ajuste-minutes');
    let hHtml = '';
    for (let i = 0; i < 24; i++) {
      hHtml += `<div class="tp-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`;
    }
    hoursEl.innerHTML = hHtml;
    let mHtml = '';
    for (let i = 0; i < 60; i++) {
      mHtml += `<div class="tp-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`;
    }
    minutesEl.innerHTML = mHtml;
    hoursEl.addEventListener('scroll', () => updateTPSelection(hoursEl));
    minutesEl.addEventListener('scroll', () => updateTPSelection(minutesEl));
  }

  function openAjusteModal(dateStr, tipo) {
    ajusteContext = { dateStr, tipo };
    const reg = DB.getRegistro(dateStr) || {};
    document.getElementById('modal-ajuste-label').textContent = Calculator.LABELS[tipo];

    // Show or hide remove button
    const removeBtn = document.getElementById('modal-ajuste-remove');
    removeBtn.style.display = reg[tipo] ? 'inline-flex' : 'none';

    // Clear obs
    const obsInput = document.getElementById('ajuste-obs-input');
    obsInput.value = '';
    obsInput.classList.remove('error');
    document.getElementById('ajuste-obs-count').textContent = '0';
    document.getElementById('ajuste-obs-error').style.display = 'none';

    openModal('modal-ajuste');

    const hora = reg[tipo] || '08:00';
    const [h, m] = hora.split(':').map(Number);
    setTimeout(() => {
      const hoursEl = document.getElementById('tp-ajuste-hours');
      const minutesEl = document.getElementById('tp-ajuste-minutes');
      setTPValue(hoursEl, h || 0);
      setTPValue(minutesEl, m || 0);
    }, 50);
    refreshIcons();
  }

  function saveAjuste() {
    const { dateStr, tipo } = ajusteContext;
    const obsInput = document.getElementById('ajuste-obs-input');
    const obs = obsInput.value.trim();

    if (!obs) {
      obsInput.classList.add('error');
      document.getElementById('ajuste-obs-error').style.display = 'block';
      obsInput.focus();
      return;
    }

    const h = getTPValue(document.getElementById('tp-ajuste-hours'));
    const m = getTPValue(document.getElementById('tp-ajuste-minutes'));
    const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const obsEntry = `[${Calculator.LABELS[tipo]}] ${hora} — ${obs}`;
    DB.editarBatida(dateStr, tipo, hora, obsEntry);

    closeModal('modal-ajuste');
    toast('Ajuste salvo com sucesso', 'success');
    renderAjusteBatidas(dateStr);

    if (dateStr === Utils.hoje()) renderHome();
    if (window.autoSync) window.autoSync();
  }

  function removeAjusteBatida() {
    const { dateStr, tipo } = ajusteContext;
    const obsInput = document.getElementById('ajuste-obs-input');
    const obs = obsInput.value.trim();

    if (!obs) {
      obsInput.classList.add('error');
      document.getElementById('ajuste-obs-error').style.display = 'block';
      obsInput.focus();
      return;
    }

    const obsEntry = `[${Calculator.LABELS[tipo]}] Removido — ${obs}`;
    DB.limparBatida(dateStr, tipo, obsEntry);

    closeModal('modal-ajuste');
    toast('Batida removida', 'success');
    renderAjusteBatidas(dateStr);

    if (dateStr === Utils.hoje()) renderHome();
    if (window.autoSync) window.autoSync();
  }

  function initAjusteDatepickerEvents() {
    document.getElementById('ajuste-date-display').addEventListener('click', toggleAjusteDatepicker);
    document.getElementById('ajuste-dp-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      ajusteDpMonth--;
      if (ajusteDpMonth < 0) { ajusteDpMonth = 11; ajusteDpYear--; }
      renderAjusteDatepickerCalendar();
    });
    document.getElementById('ajuste-dp-next').addEventListener('click', (e) => {
      e.stopPropagation();
      ajusteDpMonth++;
      if (ajusteDpMonth > 11) { ajusteDpMonth = 0; ajusteDpYear++; }
      renderAjusteDatepickerCalendar();
    });
    document.addEventListener('click', (e) => {
      const picker = document.getElementById('ajuste-datepicker');
      if (picker && !picker.contains(e.target)) {
        document.getElementById('ajuste-date-dropdown').style.display = 'none';
      }
    });
  }

  /** Open ajuste screen with a specific date pre-selected */
  function openAjusteForDate(dateStr) {
    ajusteSelectedDate = dateStr;
    showScreen('ajuste');
  }

  return {
    toast, showScreen, showSetup, showApp,
    renderHome, renderHistorico, changeHistMonth, setHistFilter,
    openDetalhe, openEditModal, saveEdit, initTimePickerWheels,
    openModal, closeModal,
    renderResumo, changeResumoMonth, exportResumo,
    renderConfig, saveConfig, initDatepickerEvents,
    renderAjuste, openAjusteForDate, saveAjuste, removeAjusteBatida,
    initAjusteDatepickerEvents, initAjusteTimePickerWheels,
    applyTheme, initTheme, refreshIcons,
    currentScreen: () => currentScreen
  };
})();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
