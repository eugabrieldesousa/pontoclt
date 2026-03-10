/* ============================================
   PontoCLT — DB (Data Layer)
   localStorage + sync com GitHub
   ============================================ */

const DB = (() => {
  const STORAGE_KEY = 'pontoclt_data';
  const SHA_KEY = 'pontoclt_sha';
  const LAST_SYNC_KEY = 'pontoclt_last_sync';
  const CONFIG_DIRTY_KEY = 'pontoclt_config_dirty';

  /** Estrutura padrão */
  function defaultData() {
    return {
      version: 1,
      config: {
        jornadaHoras: 8,
        intervaloMinutos: 60,
        toleranciaMinutos: 10,
        horaExtraPercentual: 50,
        adicionalNoturnoPercentual: 20,
        salarioBase: null,
        diasTrabalhados: [1,2,3,4,5],
        dataInicioBancoHoras: null
      },
      registros: {}
    };
  }

  /** Lê dados locais */
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    try {
      return JSON.parse(raw);
    } catch {
      return defaultData();
    }
  }

  /** Salva dados locais */
  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /** Retorna config */
  function getConfig() {
    return load().config;
  }

  /** Salva config */
  function setConfig(config) {
    const data = load();
    data.config = { ...data.config, ...config };
    save(data);
    localStorage.setItem(CONFIG_DIRTY_KEY, '1');
  }

  /** Retorna todos os registros */
  function getRegistros() {
    return load().registros || {};
  }

  /** Retorna registro de um dia */
  function getRegistro(dateStr) {
    const reg = load().registros;
    return reg[dateStr] || null;
  }

  /** Salva/atualiza registro de um dia */
  function setRegistro(dateStr, registro) {
    const data = load();
    if (!data.registros) data.registros = {};
    data.registros[dateStr] = {
      ...registro,
      sincronizado: false
    };
    save(data);
  }

  /** Registra uma batida no dia */
  function baterPonto(dateStr, tipo, hora) {
    const data = load();
    if (!data.registros) data.registros = {};
    if (!data.registros[dateStr]) {
      data.registros[dateStr] = {
        entrada: null,
        saidaAlmoco: null,
        voltaAlmoco: null,
        saida: null,
        obs: '',
        editado: false,
        sincronizado: false
      };
    }
    data.registros[dateStr][tipo] = hora;
    data.registros[dateStr].sincronizado = false;
    save(data);
    return data.registros[dateStr];
  }

  /** Edita uma batida existente */
  function editarBatida(dateStr, tipo, hora, obs) {
    const data = load();
    if (!data.registros) data.registros = {};
    if (!data.registros[dateStr]) {
      data.registros[dateStr] = {
        entrada: null,
        saidaAlmoco: null,
        voltaAlmoco: null,
        saida: null,
        obs: '',
        editado: false,
        sincronizado: false
      };
    }
    data.registros[dateStr][tipo] = hora;
    data.registros[dateStr].editado = true;
    data.registros[dateStr].sincronizado = false;
    if (obs !== undefined) {
      const prev = data.registros[dateStr].obs || '';
      const sep = prev ? '\n' : '';
      data.registros[dateStr].obs = prev + sep + obs;
    }
    save(data);
    return data.registros[dateStr];
  }

  /** Limpa uma batida (seta null) */
  function limparBatida(dateStr, tipo, obs) {
    const data = load();
    if (!data.registros || !data.registros[dateStr]) return null;
    data.registros[dateStr][tipo] = null;
    data.registros[dateStr].editado = true;
    data.registros[dateStr].sincronizado = false;
    if (obs) {
      const prev = data.registros[dateStr].obs || '';
      const sep = prev ? '\n' : '';
      data.registros[dateStr].obs = prev + sep + obs;
    }
    save(data);
    return data.registros[dateStr];
  }

  /** Salva observação */
  function setObs(dateStr, obs) {
    const data = load();
    if (!data.registros || !data.registros[dateStr]) return;
    data.registros[dateStr].obs = obs;
    data.registros[dateStr].sincronizado = false;
    save(data);
  }

  /** Verifica se há registros ou config pendentes de sync */
  function hasPendingSync() {
    if (localStorage.getItem(CONFIG_DIRTY_KEY)) return true;
    const registros = getRegistros();
    return Object.values(registros).some((r) => r.sincronizado === false);
  }

  /** SHA armazenado */
  function getSha() {
    return localStorage.getItem(SHA_KEY);
  }

  function setSha(sha) {
    localStorage.setItem(SHA_KEY, sha);
  }

  /** Última sincronização */
  function getLastSync() {
    return localStorage.getItem(LAST_SYNC_KEY);
  }

  function setLastSync() {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  /** Merge dados locais com remotos. Dados locais não-sincronizados prevalecem. */
  function mergeData(local, remote) {
    const merged = { ...remote };
    merged.registros = { ...remote.registros };

    for (const [dia, reg] of Object.entries(local.registros || {})) {
      if (reg.sincronizado === false) {
        // Dados locais não sincronizados vencem
        merged.registros[dia] = { ...reg };
      } else if (!merged.registros[dia]) {
        merged.registros[dia] = { ...reg };
      }
    }

    // Manter config local se foi alterada
    merged.config = { ...remote.config, ...local.config };
    return merged;
  }

  /** Sincroniza com GitHub */
  async function sync() {
    if (!GitHubAPI.hasCredentials()) return { ok: false, error: 'Sem credenciais' };
    if (!navigator.onLine) return { ok: false, error: 'Offline' };

    try {
      const local = load();
      const remote = await GitHubAPI.readData();

      let dataToSave;
      let sha;

      if (remote) {
        dataToSave = mergeData(local, remote.data);
        sha = remote.sha;
      } else {
        dataToSave = local;
        sha = null;
      }

      // Marca tudo como sincronizado
      for (const reg of Object.values(dataToSave.registros)) {
        reg.sincronizado = true;
      }

      try {
        const newSha = await GitHubAPI.writeData(
          dataToSave, sha,
          `Sync PontoCLT — ${new Date().toISOString()}`
        );
        setSha(newSha);
      } catch (err) {
        if (err.message === 'CONFLICT') {
          // Conflito de SHA — re-ler e tentar merge novamente
          const freshRemote = await GitHubAPI.readData();
          if (freshRemote) {
            const reMerged = mergeData(local, freshRemote.data);
            for (const reg of Object.values(reMerged.registros)) {
              reg.sincronizado = true;
            }
            const newSha = await GitHubAPI.writeData(
              reMerged, freshRemote.sha,
              `Sync PontoCLT (merge) — ${new Date().toISOString()}`
            );
            setSha(newSha);
            dataToSave = reMerged;
          }
        } else {
          throw err;
        }
      }

      save(dataToSave);
      setLastSync();
      localStorage.removeItem(CONFIG_DIRTY_KEY);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /** Exporta todos os dados como JSON string */
  function exportAll() {
    return JSON.stringify(load(), null, 2);
  }

  /** Importa dados de JSON string */
  function importAll(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!data.version || !data.registros) throw new Error('Formato inválido');
    // Marca todos como não-sincronizados para forçar push ao GitHub
    for (const reg of Object.values(data.registros)) {
      reg.sincronizado = false;
    }
    save(data);
    localStorage.setItem(CONFIG_DIRTY_KEY, '1');
  }

  /** Limpa dados locais */
  function clearLocal() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SHA_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }

  /** Limpa todos os dados (local + GitHub) */
  async function clearAll() {
    clearLocal();
    if (!GitHubAPI.hasCredentials() || !navigator.onLine) return { ok: true };
    try {
      const remote = await GitHubAPI.readData();
      const emptyData = defaultData();
      const sha = remote ? remote.sha : null;
      const newSha = await GitHubAPI.writeData(emptyData, sha, 'Limpar dados PontoCLT');
      setSha(newSha);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return {
    load, save, getConfig, setConfig,
    getRegistros, getRegistro, setRegistro,
    baterPonto, editarBatida, limparBatida, setObs,
    hasPendingSync, getSha, setSha,
    getLastSync, setLastSync,
    sync, exportAll, importAll, clearLocal, clearAll
  };
})();
