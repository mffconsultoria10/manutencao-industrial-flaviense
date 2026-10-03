(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  if (!exigirAdmin(sessao)) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;

  async function carregarEmails() {
    const resp = await apiGet('listarAlertaEmails');
    const corpo = document.getElementById('corpo-emails');
    const vazio = document.getElementById('vazio-emails');
    corpo.innerHTML = '';
    const lista = resp.ok ? resp.data.filter(function (e) { return e.Ativo; }) : [];
    if (!lista.length) { vazio.style.display = 'block'; return; }
    vazio.style.display = 'none';
    lista.forEach(function (e) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeHtml(e.Email) + '</td>' +
        '<td><button type="button" class="botao botao-perigo botao-pequeno" data-row="' + e._row + '">Remover</button></td>';
      tr.querySelector('button').addEventListener('click', async function () {
        if (!confirm('Remover este e-mail da lista de alertas?')) return;
        await apiPost('removerAlertaEmail', { row: e._row });
        carregarEmails();
      });
      corpo.appendChild(tr);
    });
  }

  document.getElementById('form-email').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const campo = document.getElementById('novo-email');
    const resp = await apiPost('adicionarAlertaEmail', { email: campo.value.trim() });
    if (resp.ok) { campo.value = ''; carregarEmails(); }
  });

  async function carregarUsuarios() {
    const resp = await apiGet('listarUsuarios');
    const corpo = document.getElementById('corpo-usuarios');
    corpo.innerHTML = '';
    if (!resp.ok) return;
    resp.data.forEach(function (u) {
      const tr = document.createElement('tr');
      const badge = u.Ativo ? '<span class="badge badge-ok">Ativo</span>' : '<span class="badge badge-inativo">Inativo</span>';
      const badgePapel = u.Papel === 'admin' ? '<span class="badge badge-atencao">Administrador</span>' : '<span class="badge badge-inativo">Usuário comum</span>';
      const acaoTexto = u.Ativo ? 'Desativar' : 'Reativar';
      const ehEuMesmo = String(u.Usuario).toLowerCase() === String(sessao.usuario).toLowerCase();
      const botaoPapel = ehEuMesmo ? '' :
        '<button type="button" class="botao botao-secundario botao-pequeno" data-acao-papel style="margin-left:0.4rem;">' +
        (u.Papel === 'admin' ? 'Tornar usuário comum' : 'Tornar administrador') + '</button>';
      tr.innerHTML = '<td>' + escapeHtml(u.Nome) + '</td><td>' + escapeHtml(u.Usuario) + '</td>' +
        '<td>' + badgePapel + botaoPapel + '</td><td>' + badge + '</td>' +
        '<td><button type="button" class="botao botao-secundario botao-pequeno">' + acaoTexto + '</button></td>';
      tr.querySelector('button:not([data-acao-papel])').addEventListener('click', async function () {
        await apiPost('alternarUsuario', { usuario: u.Usuario });
        carregarUsuarios();
      });
      const botaoPapelEl = tr.querySelector('[data-acao-papel]');
      if (botaoPapelEl) {
        botaoPapelEl.addEventListener('click', async function () {
          const vaiVirarAdmin = u.Papel !== 'admin';
          const msg = vaiVirarAdmin
            ? 'Tornar "' + u.Nome + '" administrador? Isso dá acesso total, incluindo excluir equipamentos e registros.'
            : 'Remover o acesso de administrador de "' + u.Nome + '"?';
          if (!confirm(msg)) return;
          const resp = await apiPost('alternarPapel', { usuario: u.Usuario });
          if (resp.ok) {
            carregarUsuarios();
          } else {
            alert('Erro ao alterar papel: ' + resp.error);
          }
        });
      }
      corpo.appendChild(tr);
    });
  }

  document.getElementById('form-usuario').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const msg = document.getElementById('msg-usuario');
    msg.style.display = 'none';
    const nome = document.getElementById('novo-nome').value.trim();
    const usuario = document.getElementById('novo-usuario').value.trim();
    const senha = document.getElementById('nova-senha').value;
    const papel = document.getElementById('novo-papel').value;
    const senhaHash = await sha256Hex(senha);
    const resp = await apiPost('adicionarUsuario', { nome: nome, usuario: usuario, senhaHash: senhaHash, papel: papel });
    if (resp.ok) {
      document.getElementById('form-usuario').reset();
      carregarUsuarios();
    } else {
      msg.textContent = 'Erro: ' + resp.error;
      msg.style.display = 'block';
    }
  });

  carregarEmails();
  carregarUsuarios();
})();
