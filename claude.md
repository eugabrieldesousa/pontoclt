# PontoCLT

Sistema de controle de ponto pessoal para trabalhadores CLT. PWA mobile-first que roda 100% no browser via GitHub Pages e persiste dados usando a GitHub Contents API.

## Stack

- HTML/CSS/JS (Vanilla) -- zero dependencias externas (exceto CDN)
- Lucide Icons via CDN (`unpkg.com/lucide`) -- icones SVG leves, sem emojis
- jsPDF + jsPDF-AutoTable via CDN (`cdnjs.cloudflare.com`) -- exportacao PDF
- Google Fonts (DM Sans + JetBrains Mono)
- PWA (Service Worker + manifest.json)
- GitHub Pages (hosting)
- GitHub Contents API (persistencia via arquivo JSON no repositorio)

## Estrutura de arquivos

```
pontoclt/
|-- index.html              SPA principal (todas as telas e modais)
|-- manifest.json           PWA manifest (standalone, theme_color: #0A0A0F)
|-- sw.js                   Service Worker (cache-first shell, network-first API/fonts/CDN)
|-- claude.md               Documentacao do projeto (este arquivo)
|-- css/
|   +-- styles.css          Estilos globais com CSS custom properties (dark/light/auto themes)
|-- js/
|   |-- utils.js            Helpers de data/hora, formatacao, vibracao
|   |-- calculator.js       Calculos CLT (horas, extras, saldo, noturno, alertas)
|   |-- github-api.js       CRUD via GitHub Contents API (read/write ponto.json)
|   |-- db.js               Camada de dados: localStorage + sync/merge com GitHub
|   |-- ui.js               Renderizacao de todas as telas, modais, datepickers, time pickers
|   +-- app.js              Inicializacao, event bindings, roteamento SPA, autoSync global
|-- assets/
|   |-- favicon.ico
|   +-- icons/
|       |-- icon-192.png
|       |-- icon-192.svg
|       |-- icon-512.png
|       +-- icon-512.svg
+-- data/
    +-- ponto.json          Arquivo de dados (criado no repo via API no setup inicial)
```

## Arquitetura

### Modulos JS (carregados em ordem no index.html)

1. **Utils** (`utils.js`) -- funcoes puras de formatacao e helpers:
   - Datas: `hoje()`, `formatDate()`, `parseDate()`, `horaAtual()`, `diaSemana()`, `diaCurto()`, `dataExtenso()`, `mesAnoLabel()`, `diasDoMes()`, `diasUteisNoMes()`, `isDiaUtil()`
   - Conversao: `horaParaMinutos()`, `minutosParaHora()`, `minutosParaDisplay()`, `minutosParaDisplaySemSinal()`
   - Config: `getJornadaMinutos()` (suporta `jornadaDiariaMinutos` e fallback `jornadaHoras`)
   - Outros: `vibrar()`, `sleep()`

2. **Calculator** (`calculator.js`) -- regras de negocio CLT:
   - Constantes: `SEQUENCE` (ordem das 4 batidas), `LABELS` (nomes exibidos)
   - Horas: `horasTrabalhadas()` (tempo real p/ dia corrente), `horasTrabalhadasStatic()` (p/ historico)
   - Saldo: `saldoDia()` (com tolerancia CLT), `horasExtras()`, `deficit()`
   - Intervalo: `intervaloAlmoco()`
   - Noturno: `calcNoturno()` (22h-5h, hora reduzida 52m30s)
   - Financeiro: `valorHorasExtras()` (requer salarioBase na config)
   - Alertas: `alertasDia()` (intervalo <30min, jornada >10h, interjornada <11h)
   - Navegacao: `proximaBatida()`, `diaCompleto()`
   - Resumo: `resumoMensal()` (agrega dias/horas/saldo/extras/deficit/noturno/irregularidades/valor)

3. **GitHubAPI** (`github-api.js`) -- comunicacao com GitHub Contents API:
   - Credenciais: `getCredentials()`, `setCredentials()`, `hasCredentials()` -- armazena em localStorage (`gh_owner`, `gh_repo`, `gh_token`)
   - CRUD: `testConnection()`, `readData()`, `writeData()`, `initDataFile()`
   - Encoding: `btoa(unescape(encodeURIComponent(...)))` para suportar UTF-8 no base64
   - Path fixo: `data/ponto.json`

4. **DB** (`db.js`) -- camada de dados local:
   - Storage keys: `pontoclt_data`, `pontoclt_sha`, `pontoclt_last_sync`
   - CRUD: `load()`, `save()`, `getConfig()`, `setConfig()`, `getRegistros()`, `getRegistro()`, `setRegistro()`
   - Batidas: `baterPonto()`, `editarBatida()` (com obs opcional), `limparBatida()`, `setObs()`
   - Sync: `sync()` (merge local+remote), `mergeData()` (local nao-sincronizado prevalece), `hasPendingSync()`
   - SHA: `getSha()`, `setSha()`, `getLastSync()`, `setLastSync()`
   - Dados: `exportAll()`, `importAll()`, `clearLocal()`, `clearAll()` (local + GitHub)
   - Conflito 409: re-fetch + re-merge automatico

5. **UI** (`ui.js`) -- renderizacao de telas, modais e componentes:
   - Navegacao: `showScreen()`, `showSetup()`, `showApp()`, `currentScreen()`
   - Home: `renderHome()` (clock a cada 1s, timeline, progress bar, stats, alertas)
   - Historico: `renderHistorico()`, `changeHistMonth()`, `setHistFilter()`, `openDetalhe()`
   - Resumo: `renderResumo()`, `changeResumoMonth()`, `renderChart()`, `exportResumo()` (PDF via jsPDF)
   - Config: `renderConfig()`, `saveConfig()`, `renderBancoHorasInfo()`
   - Ajuste: `renderAjuste()`, `renderAjusteBatidas()`, `openAjusteModal()`, `saveAjuste()`, `removeAjusteBatida()`
   - Modais: `openModal()`, `closeModal()`, modal-detalhe, modal-edit (time picker), modal-ajuste (time picker + obs obrigatoria)
   - Datepickers: custom datepicker para banco de horas e ajuste de ponto
   - Time pickers: scroll wheels (24h/60min) com snap, usados em modal-edit e modal-ajuste
   - Tema: `applyTheme()`, `initTheme()` -- dark/light/auto (prefers-color-scheme)
   - Helpers: `refreshIcons()` (lucide.createIcons), `toast()`, `escapeHtml()`

6. **App** (`app.js`) -- IIFE de bootstrap:
   - ServiceWorker: registro no load
   - Init: verifica credenciais → showSetup ou showApp
   - Event bindings: bottom nav, setup form, bater ponto, sync, historico nav/filtros, resumo nav/export, config save/test/sync/export/import/clear, modais, datepickers, time pickers, theme, ajuste
   - `handleBaterPonto()`: calcula proxima batida, salva via `DB.baterPonto()`, feedback visual, toast, autoSync
   - `autoSync()`: verifica credenciais + online + pending → `DB.sync()`. Exposta em `window.autoSync` para UI chamar apos edicoes.
   - Setup: `testSetupConnection()`, `handleSetupSubmit()` (salva credenciais, cria ponto.json via API)

### Icones

- Biblioteca: **Lucide Icons** via CDN (`https://unpkg.com/lucide@latest/dist/umd/lucide.js`)
- Padrao de uso no HTML: `<i data-lucide="nome-do-icone" class="classe-css"></i>`
- Apos qualquer atualizacao de DOM que insira icones, chamar `lucide.createIcons()` (via `UI.refreshIcons()`)
- Nenhum emoji e usado no projeto -- todos substituidos por icones Lucide
- Classes de tamanho: `.btn-icon` (16px), `.inline-icon` (14px), `.section-icon` (22px), `.section-icon-sm` (18px), `.stat-icon` (12px), `.nav-icon` (22px)
- Icones usados: fingerprint, log-in, utensils, coffee, log-out, clock, scale, activity, alert-triangle, check-circle, refresh-cw, chevron-left, chevron-right, calendar, calendar-days, calendar-check, calendar-x, bar-chart-2, bar-chart-3, trending-up, trending-down, plus-circle, minus-circle, moon, dollar-sign, target, pencil, edit-3, plus, info, file-text, check, x, trash-2, save, download, upload, database, wifi, user, folder-git-2, key-round, shield-check, settings, briefcase, timer, palette, github, home, file-down, message-square

### Fluxo de dados

```
Usuario bate ponto -> localStorage (imediato, offline) -> GitHub API sync (quando online)
Edicao/Ajuste -> localStorage (imediato) -> autoSync (quando online)
Config alterada -> localStorage (imediato) -> autoSync (quando online)
```

- Cada batida/edicao marca `sincronizado: false`
- `autoSync()` roda apos cada batida, edicao, ajuste, save de config e ao reconectar (evento `online`)
- `window.autoSync` exposta globalmente para UI.js poder chamar apos operacoes de edicao
- Conflito de SHA (409) -> re-fetch do remote, merge automatico, re-write
- Merge: dados locais nao-sincronizados prevalecem; config local prevalece sobre remote

### Telas (SPA com bottom nav)

| Tela | ID | Nav icon | Descricao |
|------|----|----------|-----------|
| Setup | `screen-setup` | -- | Config inicial (owner, repo, token). Aparece se nao ha credenciais. Bottom nav oculta. |
| Home | `screen-home` | `home` | Relogio digital, timeline de 4 batidas, barra de progresso, botao BATER PONTO, stats, alertas CLT. Sem edicao direta. |
| Ajuste | `screen-ajuste` | `edit-3` | Corrigir/registrar batidas esquecidas. Date picker, cards das 4 batidas, modal com time picker + obs obrigatoria. |
| Historico | `screen-historico` | `calendar-days` | Lista por mes com cards (dia, horarios, trabalhado, saldo). Filtros: todos/extras/faltas/pendentes. Resumo do mes. Tap abre modal de detalhe com edicao. |
| Resumo | `screen-resumo` | `bar-chart-3` | Dashboard mensal: saldo highlight, visao geral (dias, total, esperado, media intervalo), extras/deficit, noturno, valor R$, grafico de barras por dia, irregularidades, export PDF. |
| Config | `screen-config` | `settings` | Jornada (h/dia, h/semana, intervalo, dias trabalhados), banco de horas (data inicio + saldo acumulado), GitHub (credenciais, teste, sync manual), aparencia (tema dark/light/auto), dados (export JSON/import/clear). |

### Home -- Componentes

- **Sync Indicator:** botao no header que mostra status (check-circle = sincronizado, refresh-cw = pendente). Clique forca sync manual.
- **Date Display:** dia da semana + data por extenso
- **Clock Display:** relogio digital atualizado a cada segundo (JetBrains Mono, 3.2rem)
- **Timeline:** 4 itens verticais (Entrada, Saida almoco, Volta almoco, Saida) com dots, linhas e status (done/next/pending)
- **Barra de Progresso:** percentual da jornada em tempo real (atualiza a cada 1s durante jornada), muda de cor se >100%
- **Botao Fingerprint:** botao BATER PONTO com icone biometrico, mostra proxima batida esperada, desabilitado quando dia completo
- **Stats:** 3 cards (Trabalhadas em tempo real, Saldo do dia, Status)
- **Alertas:** cards com alertas CLT do dia (intervalo curto, jornada longa, interjornada insuficiente)
- **Edicao removida:** nenhum mecanismo de edicao na Home. Edicao via Historico ou Ajuste.

### Resumo -- Componentes

- **Saldo highlight card:** card grande com saldo do mes e icone trending-up/down
- **Visao geral:** dias trabalhados/uteis, total trabalhado, horas esperadas, media intervalo
- **Extras & deficit:** horas extras, deficit, horas noturnas (se houver), valor extras em R$ (se salarioBase configurado)
- **Grafico de barras:** horas por dia util do mes com linha de referencia da jornada. Barras coloridas (normal, over, under)
- **Irregularidades:** lista de dias com alertas
- **Export PDF:** gera PDF com resumo + tabela diaria + irregularidades via jsPDF + AutoTable

### Modais

| Modal | ID | Trigger | Campos |
|-------|----|---------|--------|
| Detalhe | `modal-detalhe` | Tap em card no Historico | Batidas (tap para editar), horas trabalhadas, intervalo, saldo, extras, deficit |
| Edit | `modal-edit` | Tap em batida no modal Detalhe | Time picker (scroll wheels h:m), sem obs |
| Ajuste | `modal-ajuste` | Tap em batida card na tela Ajuste | Time picker (scroll wheels h:m), obs obrigatoria (textarea 200 chars), botao remover batida |

### Custom Datepicker

- Usado em: Config (data inicio banco de horas) e Ajuste (selecao de dia)
- Componentes: display text, dropdown calendar, nav prev/next mes, grid de dias, botao limpar
- Bloqueia datas futuras (classe `disabled`)
- Marca dia selecionado e hoje

### Time Picker (Scroll Wheels)

- Dois wheels: horas (0-23) e minutos (0-59)
- Item height: 40px, snap via scroll
- Highlight bar central para indicar selecao
- `setTPValue()` / `getTPValue()` para controlar programaticamente

## Regras de negocio CLT

- **Jornada padrao:** 8h/dia, 44h/semana (configuravel)
- **4 batidas sequenciais:** Entrada -> Saida almoco -> Volta almoco -> Saida (ordem obrigatoria)
- **Tolerancia:** variacoes <= 10min/dia nao contam como extra nem deficit (Art. 58 CLT)
- **Horas trabalhadas:** `(saidaAlmoco - entrada) + (saida - voltaAlmoco)` -- intervalo nao conta
- **Horas trabalhadas (tempo real):** durante jornada, calcula ate hora atual para stats da Home
- **Saldo mensal:** soma dos saldos diarios (com tolerancia aplicada por dia)
- **Hora noturna:** 22h-5h, hora reduzida de 52min30s, adicional de 20%
- **Valor horas extras:** `(extras/60) * (salario / horasMes) * (1 + percentual/100)`
- **Alertas automaticos:** intervalo < 30min (danger) ou < 60min (warning), jornada > 10h, interjornada < 11h
- **Banco de horas:** saldo acumulado desde data de inicio configurada

## Design

- **Icones:** Lucide Icons via unpkg CDN (SVG inline, leve, MIT)
- **Fonts:** JetBrains Mono (horarios/numeros), DM Sans (textos/labels) -- via Google Fonts
- **Tema escuro (padrao):** bg `#0A0A0F`, surface `#12121C`, accent `#00E676`, danger `#FF6B35`
- **Tema claro:** bg `#F4F4EE`, surface `#FFFFFF`, accent `#00875A`
- **Tema auto:** detecta `prefers-color-scheme` do sistema
- **CSS custom properties** em `:root` e `[data-theme="light"]` -- troca via `data-theme` no `<html>`
- **Variaveis extras:** `--accent-rgb`, `--accent-glow`, `--surface-3`, `--text-muted`, `--transition`, `--radius-xl`
- **Efeitos:** backdrop-filter blur na nav/modais, box-shadow glow nos dots da timeline, gradient overlay no botao ponto

## Persistencia de dados

### localStorage keys

| Key | Conteudo |
|-----|----------|
| `pontoclt_data` | JSON completo (version + config + registros) |
| `pontoclt_sha` | SHA do ultimo commit no GitHub |
| `pontoclt_last_sync` | ISO timestamp da ultima sincronizacao |
| `pontoclt_theme` | Tema selecionado (dark/light/auto) |
| `gh_owner` | GitHub username |
| `gh_repo` | Nome do repositorio |
| `gh_token` | Fine-grained personal access token |

### Fluxo de sync

1. `load()` le dados de `pontoclt_data` (localStorage)
2. `readData()` busca `data/ponto.json` do GitHub via Contents API
3. `mergeData()` combina: registros locais `sincronizado: false` prevalecem; config local prevalece
4. Marca todos registros como `sincronizado: true`
5. `writeData()` envia para GitHub (PUT com SHA para update)
6. Se HTTP 409 (conflito SHA): re-fetch remote, re-merge, re-write
7. Salva resultado merged no localStorage + atualiza SHA e lastSync

### Dados que sao persistidos

| Dado | Salvo em | Trigger | Sync GitHub |
|------|----------|---------|-------------|
| Batida de ponto | localStorage | `baterPonto()` | autoSync imediato |
| Edicao de batida (Historico) | localStorage | `editarBatida()` | autoSync imediato |
| Ajuste de batida (com obs) | localStorage | `editarBatida()` | autoSync imediato |
| Remocao de batida | localStorage | `limparBatida()` | autoSync imediato |
| Observacao | localStorage | `setObs()` | no proximo sync |
| Config jornada | localStorage | `setConfig()` | autoSync imediato |
| Config dias trabalhados | localStorage | `setConfig()` | autoSync imediato |
| Config banco de horas | localStorage | `setConfig()` | autoSync imediato |
| Credenciais GitHub | localStorage | `setCredentials()` | n/a (local only) |
| Tema | localStorage | `applyTheme()` | n/a (local only) |

## JSON de dados (data/ponto.json)

```json
{
  "version": 1,
  "config": {
    "jornadaHoras": 8,
    "jornadaDiariaMinutos": 480,
    "jornadaSemanalHoras": 44,
    "intervaloMinutos": 60,
    "toleranciaMinutos": 10,
    "horaExtraPercentual": 50,
    "adicionalNoturnoPercentual": 20,
    "salarioBase": null,
    "diasTrabalhados": [1,2,3,4,5],
    "dataInicioBancoHoras": null
  },
  "registros": {
    "2026-03-10": {
      "entrada": "08:02",
      "saidaAlmoco": "12:00",
      "voltaAlmoco": "13:00",
      "saida": "18:05",
      "obs": "",
      "editado": false,
      "sincronizado": true
    }
  }
}
```

### Config fields detalhe

| Campo | Tipo | Default | Editor UI | Descricao |
|-------|------|---------|-----------|-----------|
| `jornadaHoras` | number | 8 | Config | Horas/dia (derivado de jornadaDiariaMinutos) |
| `jornadaDiariaMinutos` | number | 480 | Config | Jornada diaria em minutos (campo primario) |
| `jornadaSemanalHoras` | number | 44 | Config | Horas/semana informativo |
| `intervaloMinutos` | number | 60 | Config | Intervalo almoco padrao |
| `toleranciaMinutos` | number | 10 | -- (v2) | Tolerancia CLT em minutos |
| `horaExtraPercentual` | number | 50 | -- (v2) | Percentual adicional hora extra |
| `adicionalNoturnoPercentual` | number | 20 | -- (v2) | Percentual adicional noturno |
| `salarioBase` | number\|null | null | -- (v2) | Salario base para calculo financeiro |
| `diasTrabalhados` | number[] | [1,2,3,4,5] | Config | Dias da semana (0=dom, 6=sab) |
| `dataInicioBancoHoras` | string\|null | null | Config | YYYY-MM-DD inicio do banco de horas |

## PWA

- **Service Worker** (`sw.js`): cache `pontoclt-v6`
  - Cache-first: shell estatico (index.html, CSS, JS, icons)
  - Network-first: `api.github.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com`, `cdnjs.cloudflare.com`
  - Install: pre-cache de STATIC_ASSETS
  - Activate: limpa caches antigos
  - Bump de cache version: alterar `CACHE_NAME` a cada deploy com mudancas nos assets
- **Manifest** (`manifest.json`): `display: standalone`, orientacao portrait, icones 192px e 512px (any maskable)
- **Offline:** funciona completo sem internet; sync automatico ao reconectar via evento `online`

## CDNs utilizados

| Biblioteca | CDN | Uso |
|------------|-----|-----|
| Lucide Icons | `https://unpkg.com/lucide@latest/dist/umd/lucide.js` | Icones SVG |
| jsPDF | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js` | Gerar PDF |
| jsPDF-AutoTable | `https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js` | Tabelas no PDF |
| DM Sans + JetBrains Mono | Google Fonts | Tipografia |

## Pendencias para v2

- [ ] Campos financeiros no Config: toleranciaMinutos, salarioBase, horaExtraPercentual, adicionalNoturnoPercentual
- [ ] Suporte a feriados nacionais/customizados
- [ ] Notificacoes (lembretes de batida)
- [ ] Historico de alteracoes com timestamps

## Comandos

Para servir localmente:
```bash
npx serve .
# ou
python -m http.server 8000
```

Para deploy: push para GitHub e ativar GitHub Pages no branch principal (root /).
