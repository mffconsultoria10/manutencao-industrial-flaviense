(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;

  let todos = [];

  function statusData(iso) {
    if (!iso) return { texto: '—', classe: '' };
    const data = new Date(iso);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    data.setHours(0, 0, 0, 0);
    const diffDias = Math.round((data - hoje) / 86400000);
    let classe = 'badge-ok';
    if (diffDias < 0) classe = 'badge-atrasado';
    else if (diffDias <= 7) classe = 'badge-atencao';
    return { texto: formatarData(iso), classe: classe };
  }

  function render(lista) {
    const corpo = document.getElementById('corpo-tabela');
    const vazio = document.getElementById('vazio');
    corpo.innerHTML = '';
    if (!lista.length) {
      vazio.style.display = 'block';
      return;
    }
    vazio.style.display = 'none';
    lista.forEach(function (eq) {
      const st = statusData(eq.DataProximaIntervencao);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(eq.ID) + '</td>' +
        '<td>' + escapeHtml(eq.Nome) + '</td>' +
        '<td>' + escapeHtml(eq.Local) + '</td>' +
        '<td><span class="badge ' + st.classe + '">' + st.texto + '</span></td>' +
        '<td><a class="botao botao-secundario botao-pequeno" href="cadastro.html?id=' + encodeURIComponent(eq.ID) + '">Abrir</a></td>';
      corpo.appendChild(tr);
    });
  }

  document.getElementById('busca').addEventListener('input', function (ev) {
    const termo = ev.target.value.trim().toLowerCase();
    if (!termo) { render(todos); return; }
    render(todos.filter(function (eq) {
      return String(eq.Nome).toLowerCase().indexOf(termo) !== -1 ||
        String(eq.ID).toLowerCase().indexOf(termo) !== -1;
    }));
  });

  (async function carregar() {
    const resp = await apiGet('listarEquipamentos');
    if (resp.ok) {
      todos = resp.data.sort(function (a, b) { return String(a.ID).localeCompare(String(b.ID)); });
      render(todos);
    }
  })();
})();
