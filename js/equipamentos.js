(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;

  let todos = [];
  let filtradosAtuais = [];

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
    filtradosAtuais = lista;
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

  function filtrar() {
    const termo = document.getElementById('busca').value.trim().toLowerCase();
    const local = document.getElementById('filtro-local').value;
    render(todos.filter(function (eq) {
      const bateTermo = !termo ||
        String(eq.Nome).toLowerCase().indexOf(termo) !== -1 ||
        String(eq.ID).toLowerCase().indexOf(termo) !== -1;
      const bateLocal = !local || eq.Local === local;
      return bateTermo && bateLocal;
    }));
  }

  function popularFiltroLocal() {
    const select = document.getElementById('filtro-local');
    const locaisUnicos = Array.from(new Set(todos.map(function (eq) { return eq.Local; }).filter(Boolean))).sort();
    locaisUnicos.forEach(function (local) {
      const opt = document.createElement('option');
      opt.value = local;
      opt.textContent = local;
      select.appendChild(opt);
    });
  }

  document.getElementById('busca').addEventListener('input', filtrar);
  document.getElementById('filtro-local').addEventListener('change', filtrar);
  document.getElementById('form-busca').addEventListener('submit', function (ev) {
    ev.preventDefault();
    filtrar();
  });

  // ---- Exportar (Excel / PDF) ----
  const btnExportar = document.getElementById('btn-exportar');
  const menuExportar = document.getElementById('menu-exportar');

  btnExportar.addEventListener('click', function (ev) {
    ev.stopPropagation();
    menuExportar.classList.toggle('aberto');
  });
  document.addEventListener('click', function () {
    menuExportar.classList.remove('aberto');
  });

  document.getElementById('btn-exportar-xlsx').addEventListener('click', function () {
    menuExportar.classList.remove('aberto');
    if (!filtradosAtuais.length) { alert('Nenhum equipamento para exportar.'); return; }
    const linhas = filtradosAtuais.map(function (eq) {
      return {
        ID: eq.ID,
        Nome: eq.Nome,
        Descrição: eq.Descricao || '',
        Local: eq.Local || '',
        'Próxima intervenção': formatarData(eq.DataProximaIntervencao)
      };
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
    XLSX.writeFile(wb, 'equipamentos.xlsx');
  });

  document.getElementById('btn-exportar-pdf').addEventListener('click', function () {
    menuExportar.classList.remove('aberto');
    if (!filtradosAtuais.length) { alert('Nenhum equipamento para exportar.'); return; }
    const linhas = filtradosAtuais.map(function (eq) {
      return '<tr><td>' + escapeHtml(eq.ID) + '</td><td>' + escapeHtml(eq.Nome) + '</td>' +
        '<td>' + escapeHtml(eq.Local) + '</td><td>' + formatarData(eq.DataProximaIntervencao) + '</td></tr>';
    }).join('');
    document.getElementById('lista-impressao').innerHTML =
      '<h1 style="margin-bottom:0;">Lista de equipamentos</h1>' +
      '<p style="color:#5b6b7a; margin-top:0.2rem;">Emitida em ' + new Date().toLocaleString('pt-BR') + '</p>' +
      '<table><thead><tr><th>ID</th><th>Nome</th><th>Local</th><th>Próxima intervenção</th></tr></thead><tbody>' +
        linhas + '</tbody></table>';
    window.print();
  });

  (async function carregar() {
    const resp = await apiGet('listarEquipamentos');
    if (resp.ok) {
      todos = resp.data.sort(function (a, b) { return String(a.ID).localeCompare(String(b.ID)); });
      popularFiltroLocal();
      render(todos);
    }
  })();
})();
