(function () {
  const sessaoAtual = getSessao();
  if (sessaoAtual && sessaoAtual.token) {
    window.location.href = 'equipamentos.html';
    return;
  }

  const form = document.getElementById('form-login');
  const msgErro = document.getElementById('msg-erro');

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    msgErro.style.display = 'none';
    const usuario = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('senha').value;
    if (!usuario || !senha) return;

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Entrando...';

    try {
      const senhaHash = await sha256Hex(senha);
      const resp = await apiPost('login', { usuario: usuario, senhaHash: senhaHash });
      if (resp.ok) {
        salvarSessao({ token: resp.token, nome: resp.nome, usuario: resp.usuario, papel: resp.papel });
        window.location.href = 'equipamentos.html';
      } else {
        msgErro.textContent = resp.error === 'credenciais_invalidas'
          ? 'Usuário ou senha inválidos.'
          : (resp.error === 'api_nao_configurada' ? 'API não configurada (veja js/api.js).' : 'Erro ao entrar: ' + resp.error);
        msgErro.style.display = 'block';
      }
    } catch (err) {
      msgErro.textContent = 'Falha de conexão com o servidor.';
      msgErro.style.display = 'block';
    } finally {
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
})();
