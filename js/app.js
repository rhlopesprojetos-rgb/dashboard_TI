// ------------------------- ESTADO GLOBAL -------------------------

let TOKEN = null;
let USUARIO = null;
let dadosOriginais = [];
let dadosFiltrados = [];
let paginaAtual = 1;
const ITENS_POR_PAGINA = 20;
const CHAVE_TOKEN = 'ti_lopes_token';
const CHAVE_TEMA = 'ti_lopes_tema';
const CHAVE_SIDEBAR = 'ti_lopes_sidebar_recolhida';

const CORES = {
  primaria: '#E8410A',
  escura: '#1a2744',
  bom: '#1f9d55',
  neutro: '#f0a500',
  ruim: '#e53e3e',
  paleta: ['#E8410A', '#1a2744', '#4453d6', '#0d9488', '#b5720a', '#9090a8', '#7c3aed', '#0891b2']
};

let charts = {};

// ------------------------- INICIALIZAÇÃO -------------------------

document.addEventListener('DOMContentLoaded', () => {
  const temaSalvo = localStorage.getItem(CHAVE_TEMA);
  if (temaSalvo === 'escuro') aplicarTema('escuro');

  if (localStorage.getItem(CHAVE_SIDEBAR) === '1') {
    document.getElementById('sidebar').classList.add('recolhida');
  }

  const tokenSalvo = localStorage.getItem(CHAVE_TOKEN);
  if (tokenSalvo) {
    TOKEN = tokenSalvo;
    mostrarApp();
  }

  document.getElementById('senhaLogin').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });
  document.getElementById('emailLogin').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });
});

// ------------------------- LOGIN / LOGOUT -------------------------

async function fazerLogin() {
  const email = document.getElementById('emailLogin').value.trim();
  const senha = document.getElementById('senhaLogin').value;
  const erroEl = document.getElementById('erroLogin');
  erroEl.classList.remove('visivel');
  if (!email || !senha) return;

  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'login', email, senha });
    if (resp.success) {
      TOKEN = resp.token;
      USUARIO = resp.usuario;
      localStorage.setItem(CHAVE_TOKEN, TOKEN);
      mostrarApp();
    } else {
      erroEl.textContent = resp.message || 'Email ou senha incorretos.';
      erroEl.classList.add('visivel');
    }
  } catch (err) {
    erroEl.textContent = 'Erro de conexão. Tente novamente.';
    erroEl.classList.add('visivel');
  } finally {
    mostrarCarregando(false);
  }
}

function sair() {
  localStorage.removeItem(CHAVE_TOKEN);
  TOKEN = null;
  USUARIO = null;
  document.getElementById('app').hidden = true;
  document.getElementById('telaLogin').hidden = false;
}

function mostrarApp() {
  document.getElementById('telaLogin').hidden = true;
  document.getElementById('app').hidden = false;
  carregarDados();
}

// ------------------------- NAVEGAÇÃO ENTRE PÁGINAS -------------------------

function irParaPaginaApp(nome) {
  document.querySelectorAll('.pagina-app').forEach(p => p.classList.toggle('ativa', p.id === 'pg-' + nome));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('ativo', n.dataset.pagina === nome));
  // A barra de filtros (Período/Unidade/Departamento/Atendente) é só dos
  // chamados — não se aplica à Pendência Intra, que usa outra planilha.
  document.getElementById('filtrosBar').hidden = (nome === 'pendenciaIntra');
  if (nome === 'admin') carregarUsuarios();
  if (nome === 'pendenciaIntra') carregarPendenciasCadastro();
  if (nome === 'assistenteIA') { renderizarRepetitivos(); carregarInstrucoesIA(); }
}

function alternarSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('recolhida');
  localStorage.setItem(CHAVE_SIDEBAR, sidebar.classList.contains('recolhida') ? '1' : '0');
}

function alternarTema() {
  const atual = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
  aplicarTema(atual);
  localStorage.setItem(CHAVE_TEMA, atual);
  renderizarTudo(); // recria gráficos pra pegar cores atualizadas do tema, se necessário
}

function aplicarTema(tema) {
  if (tema === 'escuro') {
    document.documentElement.setAttribute('data-tema', 'escuro');
    document.getElementById('iconeTema').textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-tema');
    document.getElementById('iconeTema').textContent = '🌙';
  }
}

// ------------------------- BACKEND (com retry) -------------------------

async function chamarBackend(payload, tentativas = 3) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ token: TOKEN }, payload))
      });
      return await resp.json();
    } catch (err) {
      if (tentativa === tentativas) throw err;
      await new Promise(r => setTimeout(r, 600 * tentativa));
    }
  }
}

async function carregarDados() {
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'listarDados' });
    if (!resp.success) {
      alert(resp.message || 'Sessão expirada. Faça login novamente.');
      sair();
      return;
    }
    dadosOriginais = resp.dados || [];
    USUARIO = resp.usuario || USUARIO;
    atualizarInfoUsuario();
    popularFiltros();
    aplicarFiltros();
  } catch (err) {
    alert('Erro ao carregar dados. Verifique sua conexão.');
  } finally {
    mostrarCarregando(false);
  }
}

function recarregarDados() { carregarDados(); }

function atualizarInfoUsuario() {
  if (!USUARIO) return;
  document.getElementById('nomeUsuarioSidebar').textContent = USUARIO.nome;
  document.getElementById('papelUsuarioSidebar').textContent = USUARIO.papel === 'admin' ? 'Administrador' : 'Usuário';
  const avatar = document.getElementById('avatarUsuario');
  avatar.textContent = (USUARIO.nome || '?').trim().charAt(0).toUpperCase();
  avatar.className = 'avatar-usuario ' + (USUARIO.papel === 'admin' ? 'admin' : 'usuario');
  document.querySelector('.nav-admin').hidden = USUARIO.papel !== 'admin';
}

// ------------------------- FILTROS -------------------------

function popularFiltros() {
  const periodos = [...new Set(dadosOriginais.map(d => d._mesAno).filter(Boolean))].sort().reverse();
  preencherSelect('filtroPeriodo', periodos, rotuloPeriodo, 'Todos os períodos');

  const unidades = [...new Set(dadosOriginais.map(d => d.unidade).filter(Boolean))].sort();
  preencherSelect('filtroUnidade', unidades, v => v, 'Todas');

  const departamentos = [...new Set(dadosOriginais.map(d => d.departamento).filter(Boolean))].sort();
  preencherSelect('filtroDepartamento', departamentos, v => v, 'Todos');

  const atendentes = [...new Set(dadosOriginais.map(d => d.atendente).filter(Boolean))].sort();
  preencherSelect('filtroAtendente', atendentes, v => v, 'Todos');
}

function preencherSelect(id, valores, rotuloFn, rotuloVazio) {
  const sel = document.getElementById(id);
  const valorAtual = sel.value;
  sel.innerHTML = `<option value="">${rotuloVazio}</option>` + valores.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(rotuloFn(v))}</option>`).join('');
  if (valores.includes(valorAtual)) sel.value = valorAtual;
}

function rotuloPeriodo(mesAno) {
  const [ano, mes] = mesAno.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return nomes[parseInt(mes, 10) - 1] + '/' + ano;
}

function aplicarFiltros() {
  const periodo = document.getElementById('filtroPeriodo').value;
  const unidade = document.getElementById('filtroUnidade').value;
  const departamento = document.getElementById('filtroDepartamento').value;
  const atendente = document.getElementById('filtroAtendente').value;
  const busca = (document.getElementById('buscaLista').value || '').trim().toLowerCase();

  dadosFiltrados = dadosOriginais.filter(d => {
    if (periodo && d._mesAno !== periodo) return false;
    if (unidade && d.unidade !== unidade) return false;
    if (departamento && d.departamento !== departamento) return false;
    if (atendente && d.atendente !== atendente) return false;
    if (busca) {
      const alvo = `${d.id} ${d.solicitante} ${d.assunto}`.toLowerCase();
      if (alvo.indexOf(busca) === -1) return false;
    }
    return true;
  });

  paginaAtual = 1;
  renderizarTudo();
}

function limparFiltros() {
  document.getElementById('filtroPeriodo').value = '';
  document.getElementById('filtroUnidade').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroAtendente').value = '';
  document.getElementById('buscaLista').value = '';
  aplicarFiltros();
}

// ------------------------- RENDERIZAÇÃO -------------------------

function renderizarTudo() {
  // "Relatório" = tudo que está filtrado, MENOS os chamados cancelados e os
  // marcados como "ignorar de tudo". Cancelados/ignorados continuam visíveis
  // na aba Chamados (lista bruta), mas não entram em nenhum KPI/gráfico.
  const relatorio = dadosFiltrados.filter(d => d.situacao !== 'cancelado' && !d.ignorarTudo);
  // Além disso, pra satisfação, tira também quem foi marcado como
  // "ignorar da pesquisa de satisfação".
  const relatorioSatisfacao = relatorio.filter(d => !d.ignorarSatisfacao);

  renderizarKpis(relatorio, relatorioSatisfacao);
  renderizarGraficoSatisfacao(relatorioSatisfacao);
  renderizarGraficoUnidadePizza(relatorio);
  renderizarGraficoQtdAtendente(relatorio);
  renderizarGraficoTempoAtendente(relatorio);
  renderizarGraficoTempoDepartamento(relatorio);
  renderizarGraficoTempoUnidade(relatorio);
  renderizarGraficoQtdDepartamento(relatorio);
  renderizarGraficoTipoChamado(relatorio);
  renderizarGraficoTopSolicitantes(relatorio);
  renderizarTabelaNegativas(relatorioSatisfacao);
  renderizarAnoAno();
  renderizarLista(); // usa dadosFiltrados (todas as situações, inclusive cancelados/ignorados)
}

function renderizarKpis(relatorio, relatorioSatisfacao) {
  const total = relatorio.length;
  const concluidos = relatorio.filter(d => d.situacao === 'concluido').length;
  const temposValidos = relatorio.map(d => d._tempoMin).filter(v => v !== null && v !== undefined);
  const mediaMin = temposValidos.length ? temposValidos.reduce((a, b) => a + b, 0) / temposValidos.length : null;

  const totalSat = relatorioSatisfacao.length;
  const negativas = relatorioSatisfacao.filter(d => d._satisfacao && d._satisfacao !== 'bom').length;
  const boaPerc = totalSat ? Math.round(100 * (totalSat - negativas) / totalSat) : null;
  const negativasPerc = totalSat ? Math.round(100 * negativas / totalSat) : null;

  document.getElementById('kpisVisaoGeral').innerHTML = `
    <div class="card-resumo"><div class="rotulo">Qtd. Chamados</div><div class="valor">${total.toLocaleString('pt-BR')}</div></div>
    <div class="card-resumo"><div class="rotulo">Concluídos</div><div class="valor">${concluidos.toLocaleString('pt-BR')}</div></div>
    <div class="card-resumo"><div class="rotulo">Média de Atendimento</div><div class="valor laranja">${mediaMin !== null ? formatarDuracao(mediaMin) : '—'}</div></div>
    <div class="card-resumo"><div class="rotulo">Satisfação Boa</div><div class="valor">${boaPerc !== null ? boaPerc + '%' : '—'}</div></div>
    <div class="card-resumo"><div class="rotulo">Avaliações Negativas</div><div class="valor vermelho">${negativas.toLocaleString('pt-BR')}${negativasPerc !== null ? ' (' + negativasPerc + '%)' : ''}</div></div>
  `;
}

function renderizarGraficoSatisfacao(relatorioSatisfacao) {
  const contagem = { bom: 0, neutro: 0, ruim: 0 };
  relatorioSatisfacao.forEach(d => { if (d._satisfacao) contagem[d._satisfacao]++; });

  criarOuAtualizarChart('chSatisfacao', 'pie', {
    labels: ['Bom, estou satisfeito', 'Nem satisfeito, nem insatisfeito', 'Ruim, não estou satisfeito'],
    datasets: [{ data: [contagem.bom, contagem.neutro, contagem.ruim], backgroundColor: [CORES.bom, CORES.neutro, CORES.ruim] }]
  }, { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } });
}

function renderizarGraficoUnidadePizza(relatorio) {
  const contagem = agrupar(relatorio, 'unidade');
  const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  criarOuAtualizarChart('chUnidadePizza', 'pie', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.paleta }]
  }, { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } });
}

function renderizarGraficoQtdAtendente(relatorio) {
  const concluidos = relatorio.filter(d => d.situacao === 'concluido');
  const contagem = agrupar(concluidos, 'atendente');
  const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 10);

  criarOuAtualizarChart('chQtdAtendente', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.primaria }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } });
}

function renderizarGraficoTempoAtendente(relatorio) {
  const grupos = agruparValores(relatorio, 'atendente', '_tempoMin');
  const entradas = Object.entries(grupos)
    .map(([nome, vals]) => [nome, vals.reduce((a, b) => a + b, 0) / vals.length])
    .sort((a, b) => b[1] - a[1]).slice(0, 10);

  criarOuAtualizarChart('chTempoAtendente', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.escura }]
  }, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatarDuracao(ctx.raw) } } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => formatarDuracao(v) } } }
  });
}

function renderizarGraficoTempoDepartamento(relatorio) {
  const grupos = agruparValores(relatorio, 'departamento', '_tempoMin');
  const entradas = Object.entries(grupos)
    .map(([nome, vals]) => [nome, vals.reduce((a, b) => a + b, 0)])
    .sort((a, b) => b[1] - a[1]);

  criarOuAtualizarChart('chTempoDepartamento', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.paleta[2] }]
  }, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatarDuracao(ctx.raw) } } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => formatarDuracao(v) } } }
  });
}

function renderizarGraficoTempoUnidade(relatorio) {
  const grupos = agruparValores(relatorio, 'unidade', '_tempoMin');
  const entradas = Object.entries(grupos)
    .map(([nome, vals]) => [nome, vals.reduce((a, b) => a + b, 0) / vals.length])
    .sort((a, b) => b[1] - a[1]);

  criarOuAtualizarChart('chTempoUnidade', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.paleta[3] }]
  }, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatarDuracao(ctx.raw) } } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => formatarDuracao(v) } } }
  });
}

function renderizarGraficoQtdDepartamento(relatorio) {
  const contagem = agrupar(relatorio, 'departamento');
  const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  criarOuAtualizarChart('chQtdDepartamento', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.paleta[4] }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } });
}

function renderizarGraficoTipoChamado(relatorio) {
  const contagem = agrupar(relatorio, 'tipo');
  const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 12);

  criarOuAtualizarChart('chTipoChamado', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.paleta[5] }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true } }
  });
}

function renderizarGraficoTopSolicitantes(relatorio) {
  const contagem = agrupar(relatorio, 'solicitante');
  const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 10);

  criarOuAtualizarChart('chTopSolicitantes', 'bar', {
    labels: entradas.map(e => e[0]),
    datasets: [{ data: entradas.map(e => e[1]), backgroundColor: CORES.paleta[6] }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true } }
  });
}

function renderizarTabelaNegativas(relatorioSatisfacao) {
  const negativas = relatorioSatisfacao
    .filter(d => d._satisfacao && d._satisfacao !== 'bom')
    .sort((a, b) => new Date(b.concluidoEm || b.criadoEm || 0) - new Date(a.concluidoEm || a.criadoEm || 0));

  document.getElementById('tabelaNegativasVazia').hidden = negativas.length !== 0;

  document.getElementById('tabelaNegativasCorpo').innerHTML = negativas.map(d => `
    <tr>
      <td>${escapeHtml(d.departamento)}</td>
      <td>${escapeHtml(d.atendente)}</td>
      <td>${escapeHtml(d.solicitante)}</td>
      <td>${escapeHtml(d.assunto || '—')}</td>
      <td>${escapeHtml(d.ultimaResposta || '—')}</td>
      <td>${formatarDuracao(d._tempoMin)}</td>
      <td>${rotuloSatisfacao(d._satisfacao)}</td>
    </tr>
  `).join('');
}

// ------------------------- ANO X ANO -------------------------

const MIN_REGISTROS_RANKING_MES = 5;

function obterBaseAnoAno() {
  // Ignora o filtro de Período de propósito — esta página é justamente pra
  // comparar todo o histórico. Mas respeita unidade/departamento/atendente.
  const unidade = document.getElementById('filtroUnidade').value;
  const departamento = document.getElementById('filtroDepartamento').value;
  const atendente = document.getElementById('filtroAtendente').value;

  return dadosOriginais.filter(d => {
    if (d.situacao === 'cancelado' || d.ignorarTudo) return false;
    if (unidade && d.unidade !== unidade) return false;
    if (departamento && d.departamento !== departamento) return false;
    if (atendente && d.atendente !== atendente) return false;
    return true;
  });
}

function renderizarAnoAno() {
  const base = obterBaseAnoAno();
  const baseSatisfacao = base.filter(d => !d.ignorarSatisfacao);
  const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Matriz ano -> [12 meses] com os agregados de cada mês daquele ano.
  const matriz = {};
  const celula = (ano, mesIdx) => {
    if (!matriz[ano]) matriz[ano] = Array.from({ length: 12 }, () => ({ total: 0, concluidos: 0, tempos: [], satTotal: 0, satNegativas: 0 }));
    return matriz[ano][mesIdx];
  };

  base.forEach(d => {
    if (!d._mesAno) return;
    const [anoStr, mesStr] = d._mesAno.split('-');
    const cel = celula(anoStr, parseInt(mesStr, 10) - 1);
    cel.total++;
    if (d.situacao === 'concluido') cel.concluidos++;
    if (d._tempoMin !== null && d._tempoMin !== undefined) cel.tempos.push(d._tempoMin);
  });

  baseSatisfacao.forEach(d => {
    if (!d._mesAno) return;
    const [anoStr, mesStr] = d._mesAno.split('-');
    const cel = celula(anoStr, parseInt(mesStr, 10) - 1);
    cel.satTotal++;
    if (d._satisfacao && d._satisfacao !== 'bom') cel.satNegativas++;
  });

  const anos = Object.keys(matriz).sort();
  document.getElementById('anoAnoVazio').hidden = anos.length !== 0;

  // Tabela "Comparativo por Ano" — soma os 12 meses de cada ano.
  document.getElementById('anoAnoCorpo').innerHTML = anos.map(ano => {
    const meses = matriz[ano];
    const total = meses.reduce((a, m) => a + m.total, 0);
    const concluidos = meses.reduce((a, m) => a + m.concluidos, 0);
    const tempos = meses.flatMap(m => m.tempos);
    const satTotal = meses.reduce((a, m) => a + m.satTotal, 0);
    const satNegativas = meses.reduce((a, m) => a + m.satNegativas, 0);
    const mediaMin = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
    const boaPerc = satTotal ? Math.round(100 * (satTotal - satNegativas) / satTotal) : null;
    return `<tr>
      <td>${ano}</td>
      <td>${total.toLocaleString('pt-BR')}</td>
      <td>${concluidos.toLocaleString('pt-BR')}</td>
      <td>${mediaMin !== null ? formatarDuracao(mediaMin) : '—'}</td>
      <td>${boaPerc !== null ? boaPerc + '%' : '—'}</td>
      <td>${satNegativas.toLocaleString('pt-BR')}</td>
    </tr>`;
  }).join('');

  // Datasets: uma linha por ano, 12 pontos (um por mês), sobrepostas pra comparar.
  const datasetsBase = (valorFn) => anos.map((ano, i) => ({
    label: ano,
    data: matriz[ano].map(valorFn),
    borderColor: CORES.paleta[i % CORES.paleta.length],
    backgroundColor: CORES.paleta[i % CORES.paleta.length],
    tension: 0.3,
    spanGaps: true,
    fill: false
  }));

  criarOuAtualizarChart('chQtdAno', 'line', {
    labels: NOMES_MES,
    datasets: datasetsBase(m => m.total || 0)
  }, { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } });

  criarOuAtualizarChart('chTempoAno', 'line', {
    labels: NOMES_MES,
    datasets: datasetsBase(m => m.tempos.length ? m.tempos.reduce((a, b) => a + b, 0) / m.tempos.length : null)
  }, {
    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatarDuracao(ctx.raw)}` } } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => formatarDuracao(v) } } }
  });

  criarOuAtualizarChart('chSatisfacaoAno', 'line', {
    labels: NOMES_MES,
    datasets: datasetsBase(m => m.satTotal ? Math.round(100 * (m.satTotal - m.satNegativas) / m.satTotal) : null)
  }, {
    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}%` } } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }
  });

  criarOuAtualizarChart('chNegativasAno', 'line', {
    labels: NOMES_MES,
    datasets: datasetsBase(m => m.satNegativas || 0)
  }, { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } });

  // Ranking: melhores meses em tempo de atendimento (menor média, com volume mínimo)
  const temposPorMes = {};
  base.forEach(d => {
    if (!d._mesAno || d._tempoMin === null || d._tempoMin === undefined) return;
    if (!temposPorMes[d._mesAno]) temposPorMes[d._mesAno] = [];
    temposPorMes[d._mesAno].push(d._tempoMin);
  });
  const rankingAtendimento = Object.entries(temposPorMes)
    .filter(([, vals]) => vals.length >= MIN_REGISTROS_RANKING_MES)
    .map(([mes, vals]) => [mes, vals.reduce((a, b) => a + b, 0) / vals.length, vals.length])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10);

  document.getElementById('topMesesAtendimentoCorpo').innerHTML = rankingAtendimento.length
    ? rankingAtendimento.map(([mes, media, qtd], i) => `
        <tr><td>${i + 1}º</td><td>${rotuloPeriodo(mes)}</td><td>${qtd}</td><td>${formatarDuracao(media)}</td></tr>
      `).join('')
    : `<tr><td colspan="4" class="vazio">Sem meses com volume suficiente (mín. ${MIN_REGISTROS_RANKING_MES} chamados).</td></tr>`;

  // Ranking: melhores meses em satisfação (maior % bom, com volume mínimo)
  const satisfacaoPorMes = {};
  baseSatisfacao.forEach(d => {
    if (!d._mesAno) return;
    if (!satisfacaoPorMes[d._mesAno]) satisfacaoPorMes[d._mesAno] = { total: 0, negativas: 0 };
    satisfacaoPorMes[d._mesAno].total++;
    if (d._satisfacao && d._satisfacao !== 'bom') satisfacaoPorMes[d._mesAno].negativas++;
  });
  const rankingSatisfacao = Object.entries(satisfacaoPorMes)
    .filter(([, info]) => info.total >= MIN_REGISTROS_RANKING_MES)
    .map(([mes, info]) => [mes, Math.round(100 * (info.total - info.negativas) / info.total), info.total])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  document.getElementById('topMesesSatisfacaoCorpo').innerHTML = rankingSatisfacao.length
    ? rankingSatisfacao.map(([mes, perc, qtd], i) => `
        <tr><td>${i + 1}º</td><td>${rotuloPeriodo(mes)}</td><td>${qtd}</td><td>${perc}%</td></tr>
      `).join('')
    : `<tr><td colspan="4" class="vazio">Sem meses com volume suficiente (mín. ${MIN_REGISTROS_RANKING_MES} avaliações).</td></tr>`;
}

function criarOuAtualizarChart(canvasId, tipo, data, options) {
  if (typeof Chart === 'undefined') return; // CDN bloqueado — não trava o resto do painel
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  charts[canvasId] = new Chart(ctx, {
    type: tipo,
    data: data,
    options: Object.assign({ responsive: true, maintainAspectRatio: true }, options)
  });
}

function agrupar(lista, campo) {
  const contagem = {};
  lista.forEach(d => {
    const chave = d[campo] || 'Não informado';
    contagem[chave] = (contagem[chave] || 0) + 1;
  });
  return contagem;
}

function agruparValores(lista, campoGrupo, campoValor) {
  const grupos = {};
  lista.forEach(d => {
    if (d[campoValor] === null || d[campoValor] === undefined) return;
    const chave = d[campoGrupo] || 'Não informado';
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(d[campoValor]);
  });
  return grupos;
}

function formatarDuracao(minutos) {
  if (minutos === null || minutos === undefined || isNaN(minutos)) return '—';
  const totalSeg = Math.round(minutos * 60);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ------------------------- LISTA DE CHAMADOS -------------------------

function renderizarLista() {
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const pagina = dadosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  document.getElementById('listaVazia').hidden = dadosFiltrados.length !== 0;

  document.getElementById('listaCorpo').innerHTML = pagina.map(d => `
    <tr>
      <td>${escapeHtml(d.id)}</td>
      <td>${escapeHtml(d.assunto || '—')}</td>
      <td>${escapeHtml(d.solicitante || '—')}</td>
      <td>${escapeHtml(d.departamento)}</td>
      <td>${escapeHtml(d.unidade)}</td>
      <td>${escapeHtml(d.atendente)}</td>
      <td>${badgeSituacao(d.situacao)}</td>
      <td>${escapeHtml(d.prioridade)}</td>
      <td>${d.criadoEm ? new Date(d.criadoEm).toLocaleString('pt-BR') : '—'}</td>
      <td>${formatarDuracao(d._tempoMin)}</td>
      <td>${rotuloSatisfacao(d._satisfacao)}</td>
      <td>
        <div class="acoes-lista">
          <button class="botao-toggle ${d.ignorarSatisfacao ? 'ativo' : ''}" onclick="alternarIgnorar('${escapeAttr(d.id)}','ignorarSatisfacao')" title="Ignorar este chamado só na pesquisa de satisfação">🙈 Satisf.</button>
          <button class="botao-toggle ${d.ignorarTudo ? 'ativo' : ''}" onclick="alternarIgnorar('${escapeAttr(d.id)}','ignorarTudo')" title="Ignorar este chamado em todos os relatórios">🚫 Tudo</button>
        </div>
      </td>
    </tr>
  `).join('');
  renderizarPaginacao();
}

function badgeSituacao(situacao) {
  const classe = situacao === 'concluido' ? 'badge-concluido' : situacao === 'cancelado' ? 'badge-cancelado' : situacao === 'atribuido' ? 'badge-atribuido' : 'badge-aberto';
  return `<span class="badge ${classe}">${escapeHtml(situacao || 'aberto')}</span>`;
}

function rotuloSatisfacao(valor) {
  if (valor === 'bom') return '🟢 Bom';
  if (valor === 'neutro') return '🟡 Neutro';
  if (valor === 'ruim') return '🔴 Ruim';
  return '—';
}

function renderizarPaginacao() {
  const totalPaginas = Math.max(1, Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA));
  const el = document.getElementById('listaPaginacao');
  let html = `<button ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual - 1})">‹</button>`;
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1) {
      html += `<button class="${p === paginaAtual ? 'ativo' : ''}" onclick="mudarPagina(${p})">${p}</button>`;
    } else if (Math.abs(p - paginaAtual) === 2) {
      html += `<span>…</span>`;
    }
  }
  html += `<button ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual + 1})">›</button>`;
  el.innerHTML = html;
}

function mudarPagina(p) {
  const totalPaginas = Math.max(1, Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA));
  if (p < 1 || p > totalPaginas) return;
  paginaAtual = p;
  renderizarLista();
}

async function alternarIgnorar(id, campo) {
  const item = dadosOriginais.find(d => String(d.id) === String(id));
  if (!item) return;

  const novoValor = !item[campo];
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({
      action: 'definirIgnorado',
      id: id,
      ignorarSatisfacao: campo === 'ignorarSatisfacao' ? novoValor : !!item.ignorarSatisfacao,
      ignorarTudo: campo === 'ignorarTudo' ? novoValor : !!item.ignorarTudo
    });
    if (resp.success) {
      item.ignorarSatisfacao = resp.ignorarSatisfacao;
      item.ignorarTudo = resp.ignorarTudo;
      renderizarTudo();
    } else {
      alert(resp.message || 'Erro ao atualizar o chamado.');
    }
  } catch (err) {
    alert('Erro de conexão ao atualizar o chamado.');
  } finally {
    mostrarCarregando(false);
  }
}

function exportarCsv() {
  if (!dadosFiltrados.length) { alert('Não há dados para exportar.'); return; }
  const colunas = ['id', 'assunto', 'solicitante', 'departamento', 'unidade', 'atendente', 'situacao', 'prioridade', 'criadoEm', 'concluidoEm'];
  const linhas = [colunas.join(',')];
  dadosFiltrados.forEach(d => linhas.push(colunas.map(c => `"${String(d[c] ?? '').replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chamados_ti_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------- PENDÊNCIA INTRA (cadastro de colaboradores) -------------------------

let pendenciaCadastroDados = { cadastroIncompleto: [], desligadosPendentes: [], nomesForaPadrao: [] };

async function carregarPendenciasCadastro() {
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'listarPendenciasCadastro' });
    if (!resp.success) { alert(resp.message || 'Não foi possível carregar as pendências de cadastro.'); return; }
    pendenciaCadastroDados = resp.pendencias || { cadastroIncompleto: [], desligadosPendentes: [], nomesForaPadrao: [] };
    renderizarPendenciaIntra();
  } catch (err) {
    alert('Erro de conexão ao carregar as pendências de cadastro.');
  } finally {
    mostrarCarregando(false);
  }
}

function renderizarPendenciaIntra() {
  const { cadastroIncompleto, desligadosPendentes, nomesForaPadrao } = pendenciaCadastroDados;

  document.getElementById('kpisPendenciaIntra').innerHTML = `
    <div class="card-resumo"><div class="rotulo">Cadastro Incompleto (Ativos)</div><div class="valor vermelho">${cadastroIncompleto.length}</div></div>
    <div class="card-resumo"><div class="rotulo">Desligados sem Justificativa</div><div class="valor vermelho">${desligadosPendentes.length}</div></div>
    <div class="card-resumo"><div class="rotulo">Nomes Fora do Padrão</div><div class="valor laranja">${nomesForaPadrao.length}</div></div>
  `;

  document.getElementById('pendenciaCadastroCorpo').innerHTML = cadastroIncompleto.map((c, i) => `
    <tr>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.unidade)}</td>
      <td>${escapeHtml(c.departamento)}</td>
      <td>${escapeHtml(c.cargo)}</td>
      <td>${c.admissao ? new Date(c.admissao).toLocaleDateString('pt-BR') : '—'}</td>
      <td>${c.camposFaltando.map(f => `<span class="badge badge-cancelado">${escapeHtml(f)}</span>`).join(' ')}</td>
      <td><input type="text" class="input-linha" id="justificativaCadastro-${i}" placeholder="Justificativa, se necessário..."></td>
      <td><button class="botao botao-primario" onclick="salvarJustificativaCadastro('${escapeAttr(c.chave)}', '${escapeAttr(c.nome)}', '${escapeAttr(c.camposFaltando.join(', '))}', ${i})">Salvar</button></td>
    </tr>
  `).join('');
  document.getElementById('pendenciaCadastroVazia').hidden = cadastroIncompleto.length > 0;

  document.getElementById('pendenciaDesligadosCorpo').innerHTML = desligadosPendentes.map((c, i) => `
    <tr>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.unidade)}</td>
      <td>${escapeHtml(c.departamento)}</td>
      <td>${c.dataDesligamento ? new Date(c.dataDesligamento).toLocaleDateString('pt-BR') : '—'}</td>
      <td><input type="text" class="input-linha" id="justificativa-${i}" placeholder="Explique o motivo real do desligamento..."></td>
      <td><button class="botao botao-primario" onclick="salvarJustificativaDesligamento('${escapeAttr(c.chave)}', '${escapeAttr(c.nome)}', ${i})">Salvar</button></td>
    </tr>
  `).join('');
  document.getElementById('pendenciaDesligadosVazia').hidden = desligadosPendentes.length > 0;

  document.getElementById('pendenciaNomesCorpo').innerHTML = nomesForaPadrao.map(c => `
    <tr>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.unidade)}</td>
      <td>${escapeHtml(c.departamento)}</td>
    </tr>
  `).join('');
  document.getElementById('pendenciaNomesVazia').hidden = nomesForaPadrao.length > 0;
}

async function salvarJustificativaCadastro(chave, nome, camposFaltando, indice) {
  const input = document.getElementById('justificativaCadastro-' + indice);
  const justificativa = (input.value || '').trim();
  if (!justificativa) { alert('Escreva a justificativa antes de salvar.'); return; }

  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'salvarJustificativaCadastro', chave, nome, camposFaltando, justificativa });
    if (resp.success) {
      pendenciaCadastroDados.cadastroIncompleto = pendenciaCadastroDados.cadastroIncompleto.filter(c => c.chave !== chave);
      renderizarPendenciaIntra();
    } else {
      alert(resp.message || 'Erro ao salvar a justificativa.');
    }
  } catch (err) {
    alert('Erro de conexão ao salvar a justificativa.');
  } finally {
    mostrarCarregando(false);
  }
}

async function salvarJustificativaDesligamento(chave, nome, indice) {
  const input = document.getElementById('justificativa-' + indice);
  const justificativa = (input.value || '').trim();
  if (!justificativa) { alert('Escreva a justificativa antes de salvar.'); return; }

  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'salvarJustificativaDesligamento', chave, nome, justificativa });
    if (resp.success) {
      pendenciaCadastroDados.desligadosPendentes = pendenciaCadastroDados.desligadosPendentes.filter(c => c.chave !== chave);
      renderizarPendenciaIntra();
    } else {
      alert(resp.message || 'Erro ao salvar a justificativa.');
    }
  } catch (err) {
    alert('Erro de conexão ao salvar a justificativa.');
  } finally {
    mostrarCarregando(false);
  }
}

// ------------------------- ASSISTENTE IA (chamados repetitivos + perguntas) -------------------------

let mensagensIA = []; // [{ autor: 'usuario'|'assistente', texto, erro? }]

function normalizarTexto(t) {
  return String(t || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ');
}

/**
 * Monta o resumo agregado dos chamados FILTRADOS (mesmos filtros da tela)
 * pra mandar pro backend/IA. Nunca manda os chamados "crus" — só contagens,
 * médias e alguns exemplos curtos de devolutiva.
 */
function construirResumoParaIA() {
  const relatorio = dadosFiltrados.filter(d => d.situacao !== 'cancelado' && !d.ignorarTudo);

  const porTipo = {};
  relatorio.forEach(d => {
    const chave = d.tipo || 'Não informado';
    if (!porTipo[chave]) porTipo[chave] = { tipo: chave, qtd: 0, somaTempo: 0, qtdComTempo: 0, negativos: 0, departamentos: {} };
    porTipo[chave].qtd++;
    if (d._tempoMin != null) { porTipo[chave].somaTempo += d._tempoMin; porTipo[chave].qtdComTempo++; }
    if (d._satisfacao === 'ruim' || d._satisfacao === 'neutro') porTipo[chave].negativos++;
    porTipo[chave].departamentos[d.departamento] = (porTipo[chave].departamentos[d.departamento] || 0) + 1;
  });
  const topTipos = Object.values(porTipo)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 12)
    .map(t => {
      const deptOrdenados = Object.entries(t.departamentos).sort((x, y) => y[1] - x[1]).slice(0, 8);
      const porDepartamento = {};
      deptOrdenados.forEach(([dept, qtd]) => { porDepartamento[dept] = qtd; });
      return {
        tipo: t.tipo,
        quantidade: t.qtd,
        tempoMedioMin: t.qtdComTempo ? Math.round(t.somaTempo / t.qtdComTempo) : null,
        avaliacoesNegativas: t.negativos,
        porDepartamento: porDepartamento
      };
    });

  const porAssunto = {};
  relatorio.forEach(d => {
    const norm = normalizarTexto(d.assunto);
    if (!norm) return;
    if (!porAssunto[norm]) porAssunto[norm] = { assunto: d.assunto, qtd: 0, departamentos: {}, exemplosResposta: [] };
    porAssunto[norm].qtd++;
    porAssunto[norm].departamentos[d.departamento] = (porAssunto[norm].departamentos[d.departamento] || 0) + 1;
    if (d.ultimaResposta && porAssunto[norm].exemplosResposta.length < 3) {
      porAssunto[norm].exemplosResposta.push(String(d.ultimaResposta).slice(0, 200));
    }
  });
  const topAssuntos = Object.values(porAssunto)
    .filter(a => a.qtd >= 2)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 15)
    .map(a => {
      const deptOrdenados = Object.entries(a.departamentos).sort((x, y) => y[1] - x[1]);
      return {
        assunto: a.assunto,
        quantidade: a.qtd,
        departamentoMaisFrequente: deptOrdenados.length ? deptOrdenados[0][0] : null,
        exemplosDevolutiva: a.exemplosResposta
      };
    });

  // Histórico mensal por tipo dos ÚLTIMOS 12 MESES — ignora o filtro de
  // Período de propósito (mesma lógica da página Ano x Ano), mas respeita
  // Unidade/Departamento/Atendente. Isso permite comparar meses (ex.: "e no
  // mês passado?") mesmo com um período específico selecionado na tela.
  const unidade = document.getElementById('filtroUnidade').value;
  const departamento = document.getElementById('filtroDepartamento').value;
  const atendente = document.getElementById('filtroAtendente').value;
  const baseHistorico = dadosOriginais.filter(d => {
    if (d.situacao === 'cancelado' || d.ignorarTudo) return false;
    if (unidade && d.unidade !== unidade) return false;
    if (departamento && d.departamento !== departamento) return false;
    if (atendente && d.atendente !== atendente) return false;
    return true;
  });
  const porTipoMes = {};
  baseHistorico.forEach(d => {
    if (!d._mesAno) return;
    const tipo = d.tipo || 'Não informado';
    if (!porTipoMes[tipo]) porTipoMes[tipo] = {};
    porTipoMes[tipo][d._mesAno] = (porTipoMes[tipo][d._mesAno] || 0) + 1;
  });
  const historicoMensalPorTipo = topTipos.map(t => {
    const meses = porTipoMes[t.tipo] || {};
    const ultimosMeses = Object.entries(meses).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    return { tipo: t.tipo, historico: ultimosMeses.map(([mesAno, quantidade]) => ({ mesAno, quantidade })) };
  });

  return {
    totalChamadosNoFiltro: relatorio.length,
    filtrosAtivos: {
      periodo: document.getElementById('filtroPeriodo').value || 'Todos os períodos',
      unidade: document.getElementById('filtroUnidade').value || 'Todas',
      departamento: document.getElementById('filtroDepartamento').value || 'Todos',
      atendente: document.getElementById('filtroAtendente').value || 'Todos'
    },
    topTipos: topTipos,
    topAssuntosRepetidos: topAssuntos,
    historicoMensalPorTipo: historicoMensalPorTipo
  };
}

// Só a listagem/contagem (sem IA) — roda na hora, sem custo nenhum.
function renderizarRepetitivos() {
  const resumo = construirResumoParaIA();
  const linhas = resumo.topAssuntosRepetidos;

  document.getElementById('repetitivosCorpo').innerHTML = linhas.map(a => `
    <tr>
      <td>${escapeHtml(a.assunto)}</td>
      <td>${a.quantidade}</td>
      <td>${escapeHtml(a.departamentoMaisFrequente || '—')}</td>
    </tr>
  `).join('');
  document.getElementById('repetitivosVazio').hidden = linhas.length > 0;
}

async function pedirExplicacaoRepetitivos() {
  await enviarPerguntaIA('Quais são os chamados mais repetitivos no resumo e, com base nos exemplos de devolutiva, quais as prováveis causas de cada um se repetir tanto?');
}

function montarHistoricoIA() {
  // Reconstrói pares pergunta/resposta a partir das mensagens já trocadas
  // (ignora a pergunta que acabou de ser enviada, que ainda não tem resposta).
  const historico = [];
  for (let i = 0; i < mensagensIA.length - 1; i++) {
    if (mensagensIA[i].autor === 'usuario' && mensagensIA[i + 1] && mensagensIA[i + 1].autor === 'assistente') {
      historico.push({ pergunta: mensagensIA[i].texto, resposta: mensagensIA[i + 1].texto });
    }
  }
  return historico.slice(-5);
}

async function enviarPerguntaIA(perguntaForcada) {
  const inputEl = document.getElementById('perguntaIAInput');
  const pergunta = (perguntaForcada !== undefined ? perguntaForcada : inputEl.value).trim();
  if (!pergunta) return;

  const historico = montarHistoricoIA();
  mensagensIA.push({ autor: 'usuario', texto: pergunta });
  if (perguntaForcada === undefined) inputEl.value = '';
  renderizarChatIA();

  document.getElementById('statusIA').hidden = false;
  try {
    const resp = await chamarBackend({
      action: 'perguntarAgenteIA',
      pergunta: pergunta,
      resumo: construirResumoParaIA(),
      historico: historico
    });
    if (resp.success) {
      mensagensIA.push({ autor: 'assistente', texto: resp.resposta });
    } else {
      mensagensIA.push({ autor: 'assistente', texto: resp.message || 'Não consegui responder agora.', erro: true });
    }
  } catch (err) {
    mensagensIA.push({ autor: 'assistente', texto: 'Erro de conexão com o assistente. Tente novamente.', erro: true });
  } finally {
    document.getElementById('statusIA').hidden = true;
    renderizarChatIA();
  }
}

function renderizarChatIA() {
  const caixa = document.getElementById('chatIACorpo');
  if (mensagensIA.length === 0) {
    caixa.innerHTML = '<div class="chat-vazio" id="chatIAVazio">Pergunte algo como "Por que os chamados de impressora se repetem tanto no Comercial?"</div>';
    return;
  }
  caixa.innerHTML = mensagensIA.map(m => `
    <div class="chat-mensagem ${m.autor === 'usuario' ? 'chat-usuario' : 'chat-assistente'} ${m.erro ? 'chat-erro' : ''}">${escapeHtml(m.texto)}</div>
  `).join('');
  caixa.scrollTop = caixa.scrollHeight;
}

function limparConversaIA() {
  mensagensIA = [];
  renderizarChatIA();
}

// Instruções personalizadas (só admin edita, mas valem pra qualquer pergunta
// de qualquer usuário — é a forma de "treinar"/instruir o assistente sem
// precisar mexer em código).
async function carregarInstrucoesIA() {
  const secao = document.getElementById('secaoInstrucoesIA');
  if (!USUARIO || USUARIO.papel !== 'admin') { secao.hidden = true; return; }
  secao.hidden = false;
  try {
    const resp = await chamarBackend({ action: 'obterInstrucoesIA' });
    if (resp.success) document.getElementById('instrucoesIATextarea').value = resp.instrucoes || '';
  } catch (err) {
    // Silencioso — não trava a página por causa disso.
  }
}

async function salvarInstrucoesIA() {
  const texto = document.getElementById('instrucoesIATextarea').value;
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'salvarInstrucoesIA', instrucoes: texto });
    if (resp.success) {
      alert('Instruções salvas! Já valem a partir da próxima pergunta.');
    } else {
      alert(resp.message || 'Erro ao salvar as instruções.');
    }
  } catch (err) {
    alert('Erro de conexão ao salvar as instruções.');
  } finally {
    mostrarCarregando(false);
  }
}

// ------------------------- ADMINISTRAÇÃO DE USUÁRIOS -------------------------

async function carregarUsuarios() {
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'listarUsuarios' });
    if (!resp.success) { alert(resp.message || 'Não foi possível carregar os usuários.'); return; }
    renderizarUsuarios(resp.usuarios || []);
  } finally {
    mostrarCarregando(false);
  }
}

function renderizarUsuarios(usuarios) {
  document.getElementById('usuariosCorpo').innerHTML = usuarios.map(u => `
    <tr>
      <td>${escapeHtml(u.nome)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${u.papel === 'admin' ? 'Administrador' : 'Usuário'}</td>
      <td>${u.ativo ? '<span class="badge badge-concluido">Ativo</span>' : '<span class="badge badge-cancelado">Desativado</span>'}</td>
      <td style="display:flex; gap:6px;">
        <button class="botao botao-secundario" onclick="alternarStatusUsuario('${escapeAttr(u.email)}', ${!u.ativo})">${u.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="botao botao-secundario" onclick="resetarSenhaUsuario('${escapeAttr(u.email)}')">Resetar senha</button>
      </td>
    </tr>
  `).join('');
}

async function alternarStatusUsuario(email, novoStatus) {
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'atualizarUsuario', email, ativo: novoStatus });
    if (!resp.success) alert(resp.message || 'Erro ao atualizar usuário.');
    carregarUsuarios();
  } finally {
    mostrarCarregando(false);
  }
}

async function resetarSenhaUsuario(email) {
  if (!confirm(`Resetar a senha de ${email}? Uma nova senha temporária será gerada.`)) return;
  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'resetarSenha', email });
    if (resp.success) alert(`Nova senha temporária para ${email}:\n\n${resp.senhaTemporaria}\n\nEnvie com segurança e peça pra trocar no primeiro acesso.`);
    else alert(resp.message || 'Erro ao resetar senha.');
  } finally {
    mostrarCarregando(false);
  }
}

function abrirModalNovoUsuario() {
  document.getElementById('novoNomeInput').value = '';
  document.getElementById('novoEmailInput').value = '';
  document.getElementById('novoPapelInput').value = 'usuario';
  document.getElementById('erroNovoUsuario').classList.remove('visivel');
  document.getElementById('modalNovoUsuario').hidden = false;
}

async function confirmarNovoUsuario() {
  const nome = document.getElementById('novoNomeInput').value.trim();
  const email = document.getElementById('novoEmailInput').value.trim();
  const papel = document.getElementById('novoPapelInput').value;
  const erroEl = document.getElementById('erroNovoUsuario');
  erroEl.classList.remove('visivel');
  if (!nome || !email) { erroEl.textContent = 'Preencha nome e email.'; erroEl.classList.add('visivel'); return; }

  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'criarUsuario', nome, email, papel });
    if (resp.success) {
      fecharModal('modalNovoUsuario');
      alert(`Usuário criado!\n\nEmail: ${email}\nSenha temporária: ${resp.senhaTemporaria}\n\nEnvie com segurança e peça pra trocar no primeiro acesso.`);
      carregarUsuarios();
    } else {
      erroEl.textContent = resp.message || 'Erro ao criar usuário.';
      erroEl.classList.add('visivel');
    }
  } finally {
    mostrarCarregando(false);
  }
}

// ------------------------- TROCAR SENHA -------------------------

function abrirModalSenha() {
  document.getElementById('novaSenhaInput').value = '';
  document.getElementById('erroSenha').classList.remove('visivel');
  document.getElementById('modalSenha').hidden = false;
}

async function confirmarTrocaSenha() {
  const novaSenha = document.getElementById('novaSenhaInput').value;
  const erroEl = document.getElementById('erroSenha');
  erroEl.classList.remove('visivel');
  if (novaSenha.length < 6) { erroEl.textContent = 'A senha precisa ter ao menos 6 caracteres.'; erroEl.classList.add('visivel'); return; }

  mostrarCarregando(true);
  try {
    const resp = await chamarBackend({ action: 'trocarSenha', novaSenha });
    if (resp.success) {
      fecharModal('modalSenha');
      alert('Senha alterada com sucesso!');
    } else {
      erroEl.textContent = resp.message || 'Erro ao trocar senha.';
      erroEl.classList.add('visivel');
    }
  } finally {
    mostrarCarregando(false);
  }
}

function fecharModal(id) {
  document.getElementById(id).hidden = true;
}

// ------------------------- HELPERS -------------------------

function mostrarCarregando(mostrar) {
  document.getElementById('overlayCarregando').classList.toggle('visivel', mostrar);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str === null || str === undefined ? '' : String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'");
}
