(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;
  document.getElementById('falha-registrado-por').value = sessao.nome;

  let todos = [];
  let selecionado = null;
  let modo = 'registro';

  const params = new URLSearchParams(window.location.search);
  const idPreSelecionado = params.get('id');

  const buscaInput = document.getElementById('busca-equipamento');
  const listaResultados = document.getElementById('lista-resultados');
  const etapaBusca = document.getElementById('etapa-busca');
  const etapaForm = document.getElementById('etapa-formulario');
  const blocoEquipFixo = document.getElementById('bloco-equip-fixo');
  const blocoEquipSelect = document.getElementById('bloco-equip-select');
  const selectEquipamento = document.getElementById('falha-equipamento-select');
  const menuRegistro = document.getElementById('menu-modo-registro');
  const menuBranco = document.getElementById('menu-modo-branco');

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

  function popularSelectEquipamentos() {
    selectEquipamento.innerHTML = '<option value="">Selecione um equipamento...</option>' +
      todos.map(function (eq) {
        return '<option value="' + escapeHtml(eq.ID) + '">' + escapeHtml(eq.Nome) + ' (' + escapeHtml(eq.ID) + ')</option>';
      }).join('');
  }

  function irParaModo(novoModo) {
    modo = novoModo;
    menuRegistro.classList.toggle('ativo', modo === 'registro');
    menuBranco.classList.toggle('ativo', modo === 'branco');
    selecionado = null;
    document.getElementById('form-falha').reset();
    document.getElementById('falha-registrado-por').value = sessao.nome;
    atualizarCampoEmpresa();

    if (modo === 'branco') {
      etapaBusca.style.display = 'none';
      etapaForm.style.display = 'block';
      blocoEquipFixo.style.display = 'none';
      blocoEquipSelect.style.display = 'block';
      selectEquipamento.value = '';
      document.getElementById('falha-data').value = new Date().toISOString().slice(0, 10);
    } else {
      etapaForm.style.display = 'none';
      etapaBusca.style.display = 'block';
      blocoEquipFixo.style.display = 'block';
      blocoEquipSelect.style.display = 'none';
      buscaInput.value = '';
      listaResultados.innerHTML = '';
    }
  }

  menuRegistro.addEventListener('click', function () { irParaModo('registro'); });
  menuBranco.addEventListener('click', function () { irParaModo('branco'); });

  selectEquipamento.addEventListener('change', function (ev) {
    selecionado = todos.find(function (x) { return x.ID === ev.target.value; }) || null;
  });

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
      popularSelectEquipamentos();
      if (idPreSelecionado) {
        const eq = todos.find(function (x) { return x.ID === idPreSelecionado; });
        if (eq) selecionar(eq);
      }
    }
  })();
})();
