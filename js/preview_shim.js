// MODO DEMONSTRAÇÃO — substitui as chamadas ao backend por dados locais (DADOS_MOCK).
// Use apenas para conferir o visual do painel. Apague este arquivo e a referência
// dele no HTML depois que o Apps Script estiver implantado de verdade.

document.getElementById('emailLogin').value = 'demo@lopes.com.br';
document.getElementById('senhaLogin').value = 'demo123';
document.querySelector('.subtitulo-login').textContent = 'Modo demonstração — clique em Entrar (qualquer email/senha funciona)';

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
  return { success: false, message: 'Ação não disponível no modo demonstração.' };
};
