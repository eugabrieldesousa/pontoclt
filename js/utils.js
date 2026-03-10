/* ============================================
   PontoCLT — Utils
   Helpers de formatação, datas e tempo
   ============================================ */

const Utils = (() => {
  const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  /** Retorna data local no formato "YYYY-MM-DD" */
  function hoje() {
    return formatDate(new Date());
  }

  /** Formata Date para "YYYY-MM-DD" */
  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Hora atual "HH:MM" */
  function horaAtual() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /** "HH:MM" → minutos desde meia-noite */
  function horaParaMinutos(hhmm) {
    if (!hhmm || hhmm === '──:──') return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Minutos → "HH:MM" */
  function minutosParaHora(minutos) {
    if (minutos == null) return '──:──';
    const h = Math.floor(Math.abs(minutos) / 60);
    const m = Math.abs(minutos) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Minutos → "Xh YYmin" com sinal */
  function minutosParaDisplay(minutos) {
    if (minutos == null) return '0h00min';
    const sinal = minutos < 0 ? '-' : (minutos > 0 ? '+' : '');
    const abs = Math.abs(minutos);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sinal}${h}h${String(m).padStart(2, '0')}min`;
  }

  /** Minutos → "Xh YYmin" sem sinal */
  function minutosParaDisplaySemSinal(minutos) {
    if (minutos == null) return '0h00min';
    const abs = Math.abs(minutos);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${h}h${String(m).padStart(2, '0')}min`;
  }

  /** Nome do dia da semana */
  function diaSemana(dateStr) {
    const d = parseDate(dateStr);
    return DIAS_SEMANA[d.getDay()];
  }

  /** Nome curto do dia (Seg, Ter...) */
  function diaCurto(dateStr) {
    return diaSemana(dateStr).substring(0, 3);
  }

  /** Mês por extenso */
  function mesNome(month) {
    return MESES[month];
  }

  /** Data formatada por extenso: "10 de Março, 2026" */
  function dataExtenso(dateStr) {
    const d = parseDate(dateStr);
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
  }

  /** "YYYY-MM-DD" → Date (local) */
  function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Retorna "Março 2026" para dado mês/ano */
  function mesAnoLabel(year, month) {
    return `${MESES[month]} ${year}`;
  }

  /** Dias uteis em um mes (respeita config de dias trabalhados) */
  function diasUteisNoMes(year, month, config) {
    const diasTrab = (config && config.diasTrabalhados) || [1,2,3,4,5];
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      if (diasTrab.includes(dow)) count++;
    }
    return count;
  }

  /** Todos os dias de um mês (YYYY-MM-DD[]) */
  function diasDoMes(year, month) {
    const days = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(formatDate(new Date(year, month, d)));
    }
    return days;
  }

  /** Checa se e dia util (respeita config de dias trabalhados) */
  function isDiaUtil(dateStr, config) {
    const diasTrab = (config && config.diasTrabalhados) || [1,2,3,4,5];
    const dow = parseDate(dateStr).getDay();
    return diasTrab.includes(dow);
  }

  /** Vibração háptica curta */
  function vibrar() {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  /** Delay helper */
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Retorna jornada diária em minutos, com fallback para jornadaHoras */
  function getJornadaMinutos(config) {
    if (config.jornadaDiariaMinutos != null) return config.jornadaDiariaMinutos;
    return (config.jornadaHoras || 8) * 60;
  }

  return {
    hoje, formatDate, horaAtual, horaParaMinutos, minutosParaHora,
    minutosParaDisplay, minutosParaDisplaySemSinal,
    diaSemana, diaCurto, mesNome, dataExtenso, parseDate,
    mesAnoLabel, diasUteisNoMes, diasDoMes, isDiaUtil,
    getJornadaMinutos,
    vibrar, sleep
  };
})();
