(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;

  const params = new URLSearchParams(window.location.search);
  let equipamentoId = params.get('id') || null;
  let dadosAtuais = null;

  const elId = document.getElementById('id-equipamento');
  const elNome = document.getElementById('nome');
  const elDescricao = document.getElementById('descricao');
  const elLocal = document.getElementById('local');
  const elDataProxima = document.getElementById('data-proxima');
  const elTitulo = document.getElementById('titulo-pagina');
  const btnImprimir = document.getElementById('btn-imprimir');

  function paraInputDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  async function carregarEquipamento() {
    if (!equipamentoId) return;
    const resp = await apiGet('obterEquipamento', { id: equipamentoId });
    if (!resp.ok || !resp.data) {
      alert('Equipamento não encontrado.');
      window.location.href = 'equipamentos.html';
      return;
    }
    dadosAtuais = resp.data;
    const eq = resp.data.equipamento;
    elTitulo.textContent = eq.Nome;
    elId.value = eq.ID;
    elNome.value = eq.Nome;
    elDescricao.value = eq.Descricao || '';
    elLocal.value = eq.Local || '';
    elDataProxima.value = paraInputDate(eq.DataProximaIntervencao);

    document.getElementById('bloco-preventivas').style.display = 'block';
    document.getElementById('bloco-monitoramento').style.display = 'block';
    document.getElementById('bloco-falhas').style.display = 'block';
    document.getElementById('link-nova-falha').href = 'falhas.html?id=' + encodeURIComponent(eq.ID);
    btnImprimir.style.display = 'inline-flex';

    renderPreventivas(resp.data.preventivas);
    renderMonitoramento(resp.data.monitoramento);
    renderFalhas(resp.data.falhas);
    renderFicha();
  }

  function renderPreventivas(lista) {
    const corpo = document.getElementById('corpo-preventivas');
    const vazio = document.getElementById('vazio-preventivas');
    corpo.innerHTML = '';
    if (!lista.length) { vazio.style.display = 'block'; return; }
    vazio.style.display = 'none';
    lista.forEach(function (p) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeHtml(p.Descricao) + '</td><td>' + escapeHtml(p.Periodicidade) + '</td>' +
        '<td><button type="button" class="botao botao-perigo botao-pequeno" data-row="' + p._row + '">Remover</button></td>';
      tr.querySelector('button').addEventListener('click', async function () {
        if (!confirm('Remover esta preventiva?')) return;
        await apiPost('removerPreventiva', { row: p._row });
        carregarEquipamento();
      });
      corpo.appendChild(tr);
    });
  }

  function renderMonitoramento(lista) {
    const corpo = document.getElementById('corpo-monitoramento');
    const vazio = document.getElementById('vazio-monitoramento');
    corpo.innerHTML = '';
    if (!lista.length) { vazio.style.display = 'block'; return; }
    vazio.style.display = 'none';
    lista.slice().sort(function (a, b) { return new Date(b.Data) - new Date(a.Data); }).forEach(function (m) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + formatarData(m.Data) + '</td><td>' + escapeHtml(m.Responsavel) + '</td>' +
        '<td>' + escapeHtml(m.Horimetro) + '</td><td>' + escapeHtml(m.Observacoes) + '</td>' +
        '<td><button type="button" class="botao botao-perigo botao-pequeno" data-row="' + m._row + '">Remover</button></td>';
      tr.querySelector('button').addEventListener('click', async function () {
        if (!confirm('Remover este registro de monitoramento?')) return;
        await apiPost('removerMonitoramento', { row: m._row });
        carregarEquipamento();
      });
      corpo.appendChild(tr);
    });
  }

  function formatarMoeda(valor) {
    const n = parseFloat(valor);
    if (!valor || isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarEquipe(f) {
    if (!f.EquipeResponsavel) return '—';
    return f.EquipeResponsavel === 'Terceirizada' ? 'Terceirizada' : 'Própria';
  }

  function renderFalhas(lista) {
    const corpo = document.getElementById('corpo-falhas');
    const vazio = document.getElementById('vazio-falhas');
    corpo.innerHTML = '';
    if (!lista.length) { vazio.style.display = 'block'; return; }
    vazio.style.display = 'none';
    lista.slice().sort(function (a, b) { return new Date(b.Data) - new Date(a.Data); }).forEach(function (f) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + formatarData(f.Data) + '</td><td>' + escapeHtml(f.Descricao) + '</td>' +
        '<td>' + (f.ParadaProducao === true ? '<span class="badge badge-atrasado">Sim</span>' : 'Não') + '</td>' +
        '<td>' + formatarEquipe(f) + '</td>' +
        '<td>' + escapeHtml(f.EmpresaTerceirizada || '—') + '</td>' +
        '<td>' + formatarMoeda(f.Custo) + '</td>' +
        '<td>' + escapeHtml(f.RegistradoPor) + '</td>';
      corpo.appendChild(tr);
    });
  }

  function linhasOuVazio(html, temItens) {
    return temItens ? html : '<tr><td colspan="10" style="font-style:italic; color:#5b6b7a;">Nenhum registro.</td></tr>';
  }

  function renderFicha() {
    if (!dadosAtuais) return;
    const eq = dadosAtuais.equipamento;
    const prevRows = dadosAtuais.preventivas.map(function (p) {
      return '<tr><td>' + escapeHtml(p.Descricao) + '</td><td>' + escapeHtml(p.Periodicidade) + '</td></tr>';
    }).join('');
    const monRows = dadosAtuais.monitoramento.slice().sort(function (a, b) { return new Date(b.Data) - new Date(a.Data); }).map(function (m) {
      return '<tr><td>' + formatarData(m.Data) + '</td><td>' + escapeHtml(m.Responsavel) + '</td><td>' + escapeHtml(m.Horimetro) + '</td><td>' + escapeHtml(m.Observacoes) + '</td></tr>';
    }).join('');
    const falhaRows = dadosAtuais.falhas.slice().sort(function (a, b) { return new Date(b.Data) - new Date(a.Data); }).map(function (f) {
      return '<tr><td>' + formatarData(f.Data) + '</td><td>' + escapeHtml(f.Descricao) + '</td>' +
        '<td>' + (f.ParadaProducao === true ? 'Sim' : 'Não') + '</td>' +
        '<td>' + formatarEquipe(f) + '</td>' +
        '<td>' + escapeHtml(f.EmpresaTerceirizada || '—') + '</td>' +
        '<td>' + formatarMoeda(f.Custo) + '</td>' +
        '<td>' + escapeHtml(f.RegistradoPor) + '</td></tr>';
    }).join('');

    document.getElementById('ficha-impressao').innerHTML =
      '<h1 style="margin-bottom:0;">Ficha do equipamento</h1>' +
      '<p style="color:#5b6b7a; margin-top:0.2rem;">Emitida em ' + new Date().toLocaleString('pt-BR') + '</p>' +
      '<table style="margin-bottom:1.2rem;">' +
        '<tr><th style="width:160px;">ID</th><td>' + escapeHtml(eq.ID) + '</td></tr>' +
        '<tr><th>Nome</th><td>' + escapeHtml(eq.Nome) + '</td></tr>' +
        '<tr><th>Descrição</th><td>' + escapeHtml(eq.Descricao) + '</td></tr>' +
        '<tr><th>Local</th><td>' + escapeHtml(eq.Local) + '</td></tr>' +
        '<tr><th>Próxima intervenção</th><td>' + formatarData(eq.DataProximaIntervencao) + '</td></tr>' +
      '</table>' +
      '<h2>Plano de manutenções preventivas</h2>' +
      '<table style="margin-bottom:1.2rem;"><thead><tr><th>O que</th><th>Periodicidade</th></tr></thead><tbody>' +
        linhasOuVazio(prevRows, dadosAtuais.preventivas.length) + '</tbody></table>' +
      '<h2>Monitoramento (inspeções)</h2>' +
      '<table style="margin-bottom:1.2rem;"><thead><tr><th>Data</th><th>Responsável</th><th>Horímetro</th><th>Observações</th></tr></thead><tbody>' +
        linhasOuVazio(monRows, dadosAtuais.monitoramento.length) + '</tbody></table>' +
      '<h2>Histórico de falhas / intervenções corretivas</h2>' +
      '<table><thead><tr><th>Data</th><th>Descrição</th><th>Parada?</th><th>Equipe</th><th>Empresa terceirizada</th><th>Custo</th><th>Registrado por</th></tr></thead><tbody>' +
        linhasOuVazio(falhaRows, dadosAtuais.falhas.length) + '</tbody></table>';
  }

  document.getElementById('form-equipamento').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const resp = await apiPost('salvarEquipamento', {
      id: equipamentoId || '',
      nome: elNome.value.trim(),
      descricao: elDescricao.value.trim(),
      local: elLocal.value.trim(),
      dataProxima: elDataProxima.value
    });
    if (resp.ok) {
      const msg = document.getElementById('msg-salvo');
      msg.style.display = 'inline';
      setTimeout(function () { msg.style.display = 'none'; }, 2500);
      if (!equipamentoId) {
        equipamentoId = resp.data.id;
        window.history.replaceState({}, '', 'cadastro.html?id=' + encodeURIComponent(equipamentoId));
      }
      carregarEquipamento();
    } else {
      alert('Erro ao salvar: ' + resp.error);
    }
  });

  document.getElementById('form-preventiva').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!equipamentoId) return;
    const descricao = document.getElementById('prev-descricao').value.trim();
    const periodicidade = document.getElementById('prev-periodicidade').value.trim();
    if (!descricao || !periodicidade) return;
    const resp = await apiPost('adicionarPreventiva', { equipamentoId: equipamentoId, descricao: descricao, periodicidade: periodicidade });
    if (resp.ok) {
      document.getElementById('prev-descricao').value = '';
      document.getElementById('prev-periodicidade').value = '';
      carregarEquipamento();
    }
  });

  document.getElementById('form-monitoramento').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!equipamentoId) return;
    const data = document.getElementById('mon-data').value;
    const responsavel = document.getElementById('mon-responsavel').value.trim();
    const horimetro = document.getElementById('mon-horimetro').value.trim();
    const observacoes = document.getElementById('mon-observacoes').value.trim();
    if (!data || !responsavel) return;
    const resp = await apiPost('adicionarMonitoramento', { equipamentoId: equipamentoId, data: data, responsavel: responsavel, horimetro: horimetro, observacoes: observacoes });
    if (resp.ok) {
      document.getElementById('form-monitoramento').reset();
      carregarEquipamento();
    }
  });

  btnImprimir.addEventListener('click', function () {
    renderFicha();
    window.print();
  });

  carregarEquipamento();
})();
