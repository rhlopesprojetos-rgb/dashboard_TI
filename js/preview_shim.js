// MODO DEMONSTRAÇÃO — substitui as chamadas ao backend por dados locais (DADOS_MOCK).
// Use apenas para conferir o visual do painel. Apague este arquivo e a referência
// dele no HTML depois que o Apps Script estiver implantado de verdade.

document.getElementById('emailLogin').value = 'demo@lopes.com.br';
document.getElementById('senhaLogin').value = 'demo123';
document.querySelector('.subtitulo-login').textContent = 'Modo demonstração — clique em Entrar (qualquer email/senha funciona)';

// Mock só pra demonstrar a página "Pendência Intra" no preview offline.
const PENDENCIAS_MOCK = {
  cadastroIncompleto: [
    { nome: 'Marcos Vinícius', unidade: 'GRUPO LOPES  MT', departamento: 'Logística', cargo: 'Separador', camposFaltando: ['Celular', 'Data de nascimento'] },
    { nome: 'Juliana Prado', unidade: 'GRUPO LOPES  MS', departamento: 'Comercial', cargo: 'Representante Comercial', camposFaltando: ['Camiseta'] }
  ],
  desligadosPendentes: [
    { chave: 'email:demo1@exemplo.com', nome: 'Ricardo Nascimento', unidade: 'GRUPO LOPES  MT', departamento: 'Comercial', cargo: 'Representante Comercial', dataDesligamento: '2026-05-10T00:00:00.000Z' },
    { chave: 'email:demo2@exemplo.com', nome: 'Fernanda Botelho', unidade: 'GRUPO LOPES  MS', departamento: 'Logística', cargo: 'Conferente', dataDesligamento: '2026-06-02T00:00:00.000Z' }
  ],
  nomesForaPadrao: [
    { nome: 'CARLOS DA SILVA COELHO', unidade: 'GRUPO LOPES  MS', departamento: 'Comercial', situacao: 'desligado' },
    { nome: 'joyce silva', unidade: 'GRUPO LOPES  MT', departamento: 'Logística', situacao: 'ativo' }
  ]
};

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
  if (payload.action === 'salvarJustificativaDesligamento') {
    PENDENCIAS_MOCK.desligadosPendentes = PENDENCIAS_MOCK.desligadosPendentes.filter(c => c.chave !== payload.chave);
    return { success: true };
  }
  return { success: false, message: 'Ação não disponível no modo demonstração.' };
};
