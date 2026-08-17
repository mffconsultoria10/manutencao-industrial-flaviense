(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;
  document.getElementById('falha-registrado-por').value = sessao.nome;

  let todos = [];
  let selecionado = null;

  const params = new URLSearchParams(window.location.search);
  const idPreSelecionado = params.get('id');

  const buscaInput = document.getElementById('busca-equipamento');
  const listaResultados = document.getElementById('lista-resultados');
  const etapaBusca = document.getElementById('etapa-busca');
  const etapaForm = document.getElementById('etapa-formulario');

  function renderResultados(termo) {
    if (!termo) { listaResultados.innerHTML = ''; return; }
    const filtrados = todos.filter(function (eq) {
      return String(eq.Nome).toLowerCase().indexOf(termo) !== -1 || String(eq.ID).toLowerCase().indexOf(termo) !== -1;
    }).slice(0, 20);
    if (!filtrados.length) {
      listaResultados.innerHTML = '<p class="vazio">Nenhum equipamento encontrado.</p>';
      return;
    }
    const tabela = document.createElement('table');
    tabela.innerHTML = '<thead><tr><th>ID</th><th>Nome</th><th>Local</th><th></th></tr></thead>';
    const corpo = document.createElement('tbody');
    filtrados.forEach(function (eq) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeHtml(eq.ID) + '</td><td>' + escapeHtml(eq.Nome) + '</td><td>' + escapeHtml(eq.Local) + '</td>' +
        '<td><button type="button" class="botao botao-secundario botao-pequeno">Selecionar</button></td>';
      tr.querySelector('button').addEventListener('click', function () { selecionar(eq); });
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    listaResultados.innerHTML = '';
    listaResultados.appendChild(tabela);
  }

  function selecionar(eq) {
    selecionado = eq;
    document.getElementById('equipamento-selecionado').textContent = eq.Nome + ' (ID: ' + eq.ID + ')';
    etapaBusca.style.display = 'none';
    etapaForm.style.display = 'block';
    document.getElementById('falha-data').value = new Date().toISOString().slice(0, 10);
  }

  const radiosEquipe = document.getElementsByName('equipe');
  const campoEmpresa = document.getElementById('campo-empresa-terceirizada');
  function atualizarCampoEmpresa() {
    const terceirizada = document.getElementById('falha-equipe-terceirizada').checked;
    campoEmpresa.style.display = terceirizada ? 'block' : 'none';
    if (!terceirizada) document.getElementById('falha-empresa').value = '';
  }
  radiosEquipe.forEach(function (r) { r.addEventListener('change', atualizarCampoEmpresa); });

  document.getElementById('btn-trocar').addEventListener('click', function () {
    selecionado = null;
    etapaForm.style.display = 'none';
    etapaBusca.style.display = 'block';
    buscaInput.value = '';
    buscaInput.focus();
  });

  buscaInput.addEventListener('input', function (ev) {
    renderResultados(ev.target.value.trim().toLowerCase());
  });
  document.getElementById('form-busca-equipamento').addEventListener('submit', function (ev) {
    ev.preventDefault();
    renderResultados(buscaInput.value.trim().toLowerCase());
  });

  document.getElementById('form-falha').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!selecionado) return;
    const equipeTerceirizada = document.getElementById('falha-equipe-terceirizada').checked;
    const resp = await apiPost('adicionarFalha', {
      equipamentoId: selecionado.ID,
      data: document.getElementById('falha-data').value,
      descricao: document.getElementById('falha-descricao').value.trim(),
      registradoPor: document.getElementById('falha-registrado-por').value.trim(),
      paradaProducao: document.getElementById('falha-parada').checked ? 'true' : 'false',
      equipeResponsavel: equipeTerceirizada ? 'Terceirizada' : 'Propria',
      empresaTerceirizada: equipeTerceirizada ? document.getElementById('falha-empresa').value.trim() : '',
      custo: document.getElementById('falha-custo').value
    });
    if (resp.ok) {
      document.getElementById('msg-ok').style.display = 'inline';
      document.getElementById('falha-descricao').value = '';
      document.getElementById('falha-parada').checked = false;
      document.getElementById('falha-equipe-propria').checked = true;
      document.getElementById('falha-empresa').value = '';
      document.getElementById('falha-custo').value = '';
      atualizarCampoEmpresa();
      setTimeout(function () { document.getElementById('msg-ok').style.display = 'none'; }, 2500);
    } else {
      alert('Erro ao registrar falha: ' + resp.error);
    }
  });

  (async function carregar() {
    const resp = await apiGet('listarEquipamentos');
    if (resp.ok) {
      todos = resp.data;
      if (idPreSelecionado) {
        const eq = todos.find(function (x) { return x.ID === idPreSelecionado; });
        if (eq) selecionar(eq);
      }
    }
  })();
})();
