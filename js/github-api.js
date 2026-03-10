/* ============================================
   PontoCLT — GitHub API
   CRUD via GitHub Contents API
   ============================================ */

const GitHubAPI = (() => {
  const DATA_PATH = 'data/ponto.json';
  const API_BASE = 'https://api.github.com';

  function getCredentials() {
    return {
      owner: localStorage.getItem('gh_owner') || '',
      repo: localStorage.getItem('gh_repo') || '',
      token: localStorage.getItem('gh_token') || ''
    };
  }

  function setCredentials(owner, repo, token) {
    localStorage.setItem('gh_owner', owner);
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_token', token);
  }

  function hasCredentials() {
    const c = getCredentials();
    return !!(c.owner && c.repo && c.token);
  }

  function headers() {
    const { token } = getCredentials();
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  function repoUrl() {
    const { owner, repo } = getCredentials();
    return `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }

  /** Testa conexão com o repositório */
  async function testConnection(owner, repo, token) {
    const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Token inválido');
      if (resp.status === 404) throw new Error('Repositório não encontrado');
      throw new Error(`Erro HTTP ${resp.status}`);
    }
    return true;
  }

  /** Lê o arquivo ponto.json do repositório.
   *  Retorna { data, sha } ou null se não existir.
   */
  async function readData() {
    const url = `${repoUrl()}/contents/${DATA_PATH}`;
    const resp = await fetch(url, { headers: headers() });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Erro ao ler dados: ${resp.status}`);
    const json = await resp.json();
    const decoded = atob(json.content);
    const data = JSON.parse(decoded);
    return { data, sha: json.sha };
  }

  /** Escreve/atualiza ponto.json no repositório.
   *  @param {object} data - Objeto de dados completo
   *  @param {string|null} sha - SHA atual (null para criar arquivo novo)
   *  @param {string} message - Mensagem de commit
   */
  async function writeData(data, sha, message) {
    const url = `${repoUrl()}/contents/${DATA_PATH}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = { message, content };
    if (sha) body.sha = sha;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });

    if (resp.status === 409) {
      throw new Error('CONFLICT');
    }
    if (!resp.ok) throw new Error(`Erro ao salvar: ${resp.status}`);
    const result = await resp.json();
    return result.content.sha;
  }

  /** Cria o arquivo ponto.json inicial se não existir */
  async function initDataFile(config) {
    const existing = await readData();
    if (existing) return existing;

    const initialData = {
      version: 1,
      config: config || {
        jornadaHoras: 8,
        intervaloMinutos: 60,
        toleranciaMinutos: 10,
        horaExtraPercentual: 50,
        adicionalNoturnoPercentual: 20,
        salarioBase: null
      },
      registros: {}
    };

    const sha = await writeData(initialData, null, 'Inicializar PontoCLT');
    return { data: initialData, sha };
  }

  return {
    getCredentials, setCredentials, hasCredentials,
    testConnection, readData, writeData, initDataFile
  };
})();
