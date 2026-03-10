/* ============================================
   PontoCLT — Calculator
   Cálculos CLT: horas trabalhadas, extras,
   saldo, hora noturna, alertas
   ============================================ */

const Calculator = (() => {
  const SEQUENCE = ['entrada', 'saidaAlmoco', 'voltaAlmoco', 'saida'];
  const LABELS = { entrada: 'Entrada', saidaAlmoco: 'Saída almoço', voltaAlmoco: 'Volta almoço', saida: 'Saída' };

  /**
   * Calcula horas trabalhadas em minutos para um registro do dia.
   * horasTrabalhadas = (saidaAlmoco - entrada) + (saida - voltaAlmoco)
   */
  function horasTrabalhadas(reg) {
    if (!reg) return 0;
    const ent = Utils.horaParaMinutos(reg.entrada);
    const sa = Utils.horaParaMinutos(reg.saidaAlmoco);
    const va = Utils.horaParaMinutos(reg.voltaAlmoco);
    const sai = Utils.horaParaMinutos(reg.saida);

    let total = 0;
    if (ent != null && sa != null) total += sa - ent;
    if (va != null && sai != null) total += sai - va;
    // Caso parcial: entrada sem saída almoço (está no primeiro período)
    if (ent != null && sa == null && va == null && sai == null) {
      // Em jornada — calcula tempo em tempo real
      const agora = Utils.horaParaMinutos(Utils.horaAtual());
      total += agora - ent;
    }
    // Após almoço, sem saída
    if (ent != null && sa != null && va != null && sai == null) {
      const agora = Utils.horaParaMinutos(Utils.horaAtual());
      total += (sa - ent) + (agora - va);
      total -= (sa - ent); // remove duplicação
      total = (sa - ent) + (agora - va);
    }
    return Math.max(0, total);
  }

  /**
   * Calcula horas trabalhadas estáticas (sem tempo real, para histórico).
   */
  function horasTrabalhadasStatic(reg) {
    if (!reg) return 0;
    const ent = Utils.horaParaMinutos(reg.entrada);
    const sa = Utils.horaParaMinutos(reg.saidaAlmoco);
    const va = Utils.horaParaMinutos(reg.voltaAlmoco);
    const sai = Utils.horaParaMinutos(reg.saida);

    let total = 0;
    if (ent != null && sa != null) total += sa - ent;
    if (va != null && sai != null) total += sai - va;
    return Math.max(0, total);
  }

  /**
   * Duração do intervalo de almoço em minutos.
   */
  function intervaloAlmoco(reg) {
    if (!reg) return 0;
    const sa = Utils.horaParaMinutos(reg.saidaAlmoco);
    const va = Utils.horaParaMinutos(reg.voltaAlmoco);
    if (sa == null || va == null) return 0;
    return va - sa;
  }

  /**
   * Calcula saldo do dia (em minutos). Positivo = horas extras, negativo = déficit.
   * Aplica tolerância CLT.
   */
  function saldoDia(reg, config) {
    if (!reg || !reg.saida) return null;
    const trabalhado = horasTrabalhadasStatic(reg);
    const jornada = Utils.getJornadaMinutos(config);
    const tolerancia = config.toleranciaMinutos || 10;
    const diff = trabalhado - jornada;

    // Tolerância: variações até toleranciaMinutos não contam
    if (Math.abs(diff) <= tolerancia) return 0;
    return diff > 0 ? diff - tolerancia : diff + tolerancia;
  }

  /**
   * Horas extras do dia (minutos). Retorna 0 se não houver.
   */
  function horasExtras(reg, config) {
    const saldo = saldoDia(reg, config);
    if (saldo == null) return 0;
    return Math.max(0, saldo);
  }

  /**
   * Déficit do dia (minutos positivos representando quanto faltou).
   */
  function deficit(reg, config) {
    const saldo = saldoDia(reg, config);
    if (saldo == null) return 0;
    return Math.max(0, -saldo);
  }

  /**
   * Calcula minutos noturnos (entre 22:00 e 05:00).
   * Retorna { minutosNoturnos, horasNoturnas }
   */
  function calcNoturno(reg) {
    if (!reg) return { minutosNoturnos: 0, horasNoturnas: 0 };
    const periodos = [];
    const ent = Utils.horaParaMinutos(reg.entrada);
    const sa = Utils.horaParaMinutos(reg.saidaAlmoco);
    const va = Utils.horaParaMinutos(reg.voltaAlmoco);
    const sai = Utils.horaParaMinutos(reg.saida);

    if (ent != null && sa != null) periodos.push([ent, sa]);
    if (va != null && sai != null) periodos.push([va, sai]);

    let minutosNoturnos = 0;
    // Faixa noturna: 0-300 (00:00-05:00) e 1320-1440 (22:00-24:00)
    for (const [ini, fim] of periodos) {
      // 22:00 (1320) a 24:00 (1440)
      if (fim > 1320) {
        minutosNoturnos += Math.min(fim, 1440) - Math.max(ini, 1320);
      }
      // 00:00 (0) a 05:00 (300)
      if (ini < 300) {
        minutosNoturnos += Math.min(fim, 300) - Math.max(ini, 0);
      }
    }
    minutosNoturnos = Math.max(0, minutosNoturnos);
    const horasNoturnas = minutosNoturnos / 52.5;
    return { minutosNoturnos, horasNoturnas };
  }

  /**
   * Valor financeiro de horas extras.
   */
  function valorHorasExtras(extras, config) {
    if (!config.salarioBase || !extras) return null;
    const horasMes = (Utils.getJornadaMinutos(config) / 60) * Utils.diasUteisNoMes(new Date().getFullYear(), new Date().getMonth(), config);
    const valorHora = config.salarioBase / horasMes;
    const pct = 1 + (config.horaExtraPercentual || 50) / 100;
    return (extras / 60) * valorHora * pct;
  }

  /**
   * Gera alertas para um registro com base nas regras CLT.
   */
  function alertasDia(reg, config, regAnterior) {
    const alertas = [];
    if (!reg) return alertas;

    // Intervalo almoço < 30min
    const intervalo = intervaloAlmoco(reg);
    if (intervalo > 0 && intervalo < 30) {
      alertas.push({ tipo: 'danger', msg: 'Intervalo abaixo do mínimo legal (30min)' });
    } else if (intervalo > 0 && intervalo < 60) {
      alertas.push({ tipo: 'warning', msg: 'Intervalo abaixo do padrão (1h)' });
    }

    // Jornada > 10h
    const trabalhado = reg.saida ? horasTrabalhadasStatic(reg) : horasTrabalhadas(reg);
    if (trabalhado > 600) {
      alertas.push({ tipo: 'danger', msg: 'Limite de 2h extras diárias atingido (>10h)' });
    }

    // Interjornada < 11h
    if (regAnterior && regAnterior.saida && reg.entrada) {
      const saidaOntem = Utils.horaParaMinutos(regAnterior.saida);
      const entradaHoje = Utils.horaParaMinutos(reg.entrada);
      const interjornada = (24 * 60 - saidaOntem) + entradaHoje;
      if (interjornada < 660) { // 11h = 660min
        alertas.push({ tipo: 'danger', msg: 'Descanso entre jornadas insuficiente (<11h)' });
      }
    }

    return alertas;
  }

  /** Próxima batida esperada na sequência */
  function proximaBatida(reg) {
    if (!reg) return 'entrada';
    for (const tipo of SEQUENCE) {
      if (!reg[tipo]) return tipo;
    }
    return null; // Todas preenchidas
  }

  /** Verifica se o dia está completo (4 batidas) */
  function diaCompleto(reg) {
    return reg && reg.entrada && reg.saidaAlmoco && reg.voltaAlmoco && reg.saida;
  }

  /** Resumo mensal */
  function resumoMensal(registros, config, year, month) {
    const dias = Utils.diasDoMes(year, month);
    const diasUteis = Utils.diasUteisNoMes(year, month, config);
    let diasTrabalhados = 0;
    let totalTrabalhado = 0;
    let totalExtras = 0;
    let totalDeficit = 0;
    let totalIntervalo = 0;
    let totalMinutosNoturnos = 0;
    let diasComIntervalo = 0;
    let irregularidades = [];

    for (const dia of dias) {
      const reg = registros[dia];
      if (!reg || !reg.entrada) continue;

      if (diaCompleto(reg)) {
        diasTrabalhados++;
        const trab = horasTrabalhadasStatic(reg);
        totalTrabalhado += trab;
        totalExtras += horasExtras(reg, config);
        totalDeficit += deficit(reg, config);

        const intv = intervaloAlmoco(reg);
        if (intv > 0) {
          totalIntervalo += intv;
          diasComIntervalo++;
        }

        const noturno = calcNoturno(reg);
        totalMinutosNoturnos += noturno.minutosNoturnos;

        const alertas = alertasDia(reg, config, null);
        if (alertas.length > 0) {
          irregularidades.push({ dia, alertas });
        }
      } else if (reg.entrada) {
        // Dia incompleto
        irregularidades.push({ dia, alertas: [{ tipo: 'warning', msg: 'Dia incompleto' }] });
      }
    }

    const jornadaMin = Utils.getJornadaMinutos(config);
    const horasEsperadas = diasUteis * jornadaMin;
    const saldo = totalExtras - totalDeficit;
    const mediaIntervalo = diasComIntervalo > 0 ? Math.round(totalIntervalo / diasComIntervalo) : 0;

    let valorExtras = null;
    if (config.salarioBase && totalExtras > 0) {
      const horasMes = (Utils.getJornadaMinutos(config) / 60) * diasUteis;
      const valorHora = config.salarioBase / horasMes;
      const pct = 1 + (config.horaExtraPercentual || 50) / 100;
      valorExtras = (totalExtras / 60) * valorHora * pct;
    }

    return {
      diasUteis,
      diasTrabalhados,
      totalTrabalhado,
      horasEsperadas,
      saldo,
      totalExtras,
      totalDeficit,
      mediaIntervalo,
      totalMinutosNoturnos,
      irregularidades,
      valorExtras
    };
  }

  return {
    SEQUENCE, LABELS,
    horasTrabalhadas, horasTrabalhadasStatic, intervaloAlmoco,
    saldoDia, horasExtras, deficit, calcNoturno, valorHorasExtras,
    alertasDia, proximaBatida, diaCompleto, resumoMensal
  };
})();
