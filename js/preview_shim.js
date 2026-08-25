// MODO DEMONSTRAÇÃO — substitui as chamadas ao backend por dados locais (DADOS_MOCK).
// Use apenas para conferir o visual do painel. Apague este arquivo e a referência
// dele no HTML depois que o Apps Script estiver implantado de verdade.

document.getElementById('emailLogin').value = 'demo@lopes.com.br';
document.getElementById('senhaLogin').value = 'demo123';
document.querySelector('.subtitulo-login').textContent = 'Modo demonstração — clique em Entrar (qualquer email/senha funciona)';

// Mock só pra demonstrar a página "Pendência Intra" no preview offline.
const PENDENCIAS_MOCK = {
  cadastroIncompleto: [
    { chave: 'email:mock1@exemplo.com', nome: 'Marcos Vinícius', unidade: 'GRUPO LOPES  MT', departamento: 'Comercial', cargo: 'Representante Comercial', admissao: '2025-03-10T00:00:00.000Z', camposFaltando: ['Celular', 'Data de nascimento'] },
    { chave: 'email:mock2@exemplo.com', nome: 'Juliano Prado', unidade: 'GRUPO LOPES  MS', departamento: 'Logística', cargo: 'Motorista', admissao: null, camposFaltando: ['Admissão', 'Camiseta'] }
  ],
  desligadosPendentes: [
    { chave: 'email:demo1@exemplo.com', nome: 'Ricardo Nascimento', unidade: 'GRUPO LOPES  MT', departamento: 'Comercial', cargo: 'Representante Comercial', dataDesligamento: '2026-05-10T00:00:00.000Z' },
    { chave: 'email:demo2@exemplo.com', nome: 'Fernanda Botelho', unidade: 'GRUPO LOPES  MS', departamento: 'Logística', cargo: 'Conferente', dataDesligamento: '2026-06-02T00:00:00.000Z' }
  ],
  nomesForaPadrao: [
    { nome: 'joyce silva', unidade: 'GRUPO LOPES  MT', departamento: 'Logística' },
    { nome: 'CARLOS DA SILVA', unidade: 'GRUPO LOPES  MS', departamento: 'Comercial' }
  ]
};

// Mock das instruções personalizadas (fica só na sessão do preview).
let INSTRUCOES_IA_MOCK = '';

chamarBackend = async function (payload) {
  await new Promise(r => setTimeout(r, 200));
  const usuarioDemo = { nome: 'Modo Demonstração', email: 'demo@lopes.com.br', papel: 'admin' };

  if (payload.action === 'login') {
    return { success: true, token: 'demo-token', usuario: usuarioDemo };
  }
  if (payload.action === 'listarDados') {
    return { success: true, dados: DADOS_MOCK, usuario: usuarioDemo };
  }
  if (payload.action === 'listarUsuarios') {
    return { success: true, usuarios: [{ nome: 'Modo Demonstração', email: 'demo@lopes.com.br', papel: 'admin', ativo: true, criadoEm: '' }] };
  }
  if (payload.action === 'definirIgnorado') {
    return { success: true, ignorarSatisfacao: !!payload.ignorarSatisfacao, ignorarTudo: !!payload.ignorarTudo };
  }
  if (payload.action === 'listarPendenciasCadastro') {
    return { success: true, pendencias: PENDENCIAS_MOCK };
  }
  if (payload.action === 'salvarJustificativaCadastro') {
    PENDENCIAS_MOCK.cadastroIncompleto = PENDENCIAS_MOCK.cadastroIncompleto.filter(c => c.chave !== payload.chave);
    return { success: true };
  }
  if (payload.action === 'salvarJustificativaDesligamento') {
    PENDENCIAS_MOCK.desligadosPendentes = PENDENCIAS_MOCK.desligadosPendentes.filter(c => c.chave !== payload.chave);
    return { success: true };
  }
  if (payload.action === 'obterInstrucoesIA') {
    return { success: true, instrucoes: INSTRUCOES_IA_MOCK };
  }
  if (payload.action === 'salvarInstrucoesIA') {
    INSTRUCOES_IA_MOCK = String(payload.instrucoes || '');
    return { success: true };
  }
  if (payload.action === 'perguntarAgenteIA') {
    // No preview offline não existe chamada real de IA — só uma resposta
    // fixa pra mostrar como o chat funciona.
    if (payload.imagemBase64) {
      const mime = payload.imagemMimeType || '';
      const tipo = mime === 'application/pdf' ? 'PDF' : (mime.indexOf('audio/') === 0 ? 'áudio' : 'imagem');
      return { success: true, resposta: `[Resposta de demonstração] Recebi o(a) ${tipo} anexado(a). No modo real, o Gemini analisaria esse anexo junto com o resumo dos chamados filtrados pra te ajudar.` };
    }
    const totalRepetidos = (payload.resumo && payload.resumo.topAssuntosRepetidos) || [];
    const exemplo = totalRepetidos[0];
    const texto = exemplo
      ? `[Resposta de demonstração] O chamado mais repetitivo no filtro atual é "${exemplo.assunto}", com ${exemplo.quantidade} ocorrências, concentrado no departamento ${exemplo.departamentoMaisFrequente || 'não identificado'}. No modo real, o Gemini analisaria os exemplos de devolutiva pra sugerir a causa provável.`
      : '[Resposta de demonstração] Não há chamados repetitivos suficientes no filtro atual pra essa análise. No modo real, a pergunta seria enviada ao Gemini junto com o resumo dos chamados filtrados.';
    return { success: true, resposta: texto };
  }
  return { success: false, message: 'Ação não disponível no modo demonstração.' };
};

// No preview offline os dados mock não vão até "hoje" de verdade — então o
// padrão de "período atual" (mês corrente) ficaria vazio. Aqui a gente troca
// só a base de cálculo pro mês do chamado mais recente dos dados mock, sem
// mudar o comportamento no site publicado de verdade (index.html).
definirPeriodoAtualPadrao = function () {
  const maisRecente = DADOS_MOCK.reduce((max, d) => {
    if (!d.concluidoEm) return max;
    const data = new Date(d.concluidoEm);
    return (!max || data > max) ? data : max;
  }, null);
  const base = maisRecente || new Date();
  const inicioMes = new Date(base.getFullYear(), base.getMonth(), 1);
  const fimMes = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  document.getElementById('filtroPeriodoInicio').value = formatarDataISO(inicioMes);
  document.getElementById('filtroPeriodoFim').value = formatarDataISO(fimMes);
};
