(function () {
  const sessao = exigirLogin();
  if (!sessao) return;
  document.getElementById('nome-usuario').textContent = 'Olá, ' + sessao.nome;
  document.getElementById('falha-registrado-por').value = sessao.nome;

  let todos = [];
  let selecionado = null;
  let modo = 'registro';
  let fotosSelecionadas = [];

  const params = new URLSearchParams(window.location.search);
  const idPreSelecionado = params.get('id');

  const buscaInput = document.getElementById('busca-equipamento');
  const listaResultados = document.getElementById('lista-resultados');
  const etapaBusca = document.getElementById('etapa-busca');
  const etapaForm = document.getElementById('etapa-formulario');
  const blocoEquipFixo = document.getElementById('bloco-equip-fixo');
  const blocoEquipSelect = document.getElementById('bloco-equip-select');
  const selectEquipamento = document.getElementById('falha-equipamento-select');
  const filtroLocalBusca = document.getElementById('filtro-local-busca');
  const filtroLocalSelect = document.getElementById('filtro-local-select');
  const menuRegistro = document.getElementById('menu-modo-registro');
  const menuBranco = document.getElementById('menu-modo-branco');
  const btnImprimirBranco = document.getElementById('btn-imprimir-branco');

  function renderResultados() {
    const termo = buscaInput.value.trim().toLowerCase();
    const local = filtroLocalBusca.value;
    if (!termo && !local) { listaResultados.innerHTML = ''; return; }
    const filtrados = todos.filter(function (eq) {
      const bateTermo = !termo || String(eq.Nome).toLowerCase().indexOf(termo) !== -1 || String(eq.ID).toLowerCase().indexOf(termo) !== -1;
      const bateLocal = !local || eq.Local === local;
      return bateTermo && bateLocal;
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
    const local = filtroLocalSelect.value;
    const lista = local ? todos.filter(function (eq) { return eq.Local === local; }) : todos;
    selectEquipamento.innerHTML = '<option value="">Selecione um equipamento...</option>' +
      lista.map(function (eq) {
        return '<option value="' + escapeHtml(eq.ID) + '">' + escapeHtml(eq.Nome) + ' (' + escapeHtml(eq.ID) + ')</option>';
      }).join('');
  }

  function popularFiltrosLocal() {
    const locaisUnicos = Array.from(new Set(todos.map(function (eq) { return eq.Local; }).filter(Boolean))).sort();
    [filtroLocalBusca, filtroLocalSelect].forEach(function (select) {
      locaisUnicos.forEach(function (local) {
        const opt = document.createElement('option');
        opt.value = local;
        opt.textContent = local;
        select.appendChild(opt);
      });
    });
  }

  function irParaModo(novoModo) {
    modo = novoModo;
    menuRegistro.classList.toggle('ativo', modo === 'registro');
    menuBranco.classList.toggle('ativo', modo === 'branco');
    selecionado = null;
    document.getElementById('form-falha').reset();
    document.getElementById('falha-registrado-por').value = sessao.nome;
    atualizarCampoEmpresa();
    limparFotos();

    if (modo === 'branco') {
      etapaBusca.style.display = 'none';
      etapaForm.style.display = 'block';
      blocoEquipFixo.style.display = 'none';
      blocoEquipSelect.style.display = 'block';
      btnImprimirBranco.style.display = 'inline-flex';
      filtroLocalSelect.value = '';
      popularSelectEquipamentos();
      document.getElementById('falha-data').value = new Date().toISOString().slice(0, 10);
    } else {
      etapaForm.style.display = 'none';
      etapaBusca.style.display = 'block';
      blocoEquipFixo.style.display = 'block';
      blocoEquipSelect.style.display = 'none';
      btnImprimirBranco.style.display = 'none';
      buscaInput.value = '';
      filtroLocalBusca.value = '';
      listaResultados.innerHTML = '';
    }
  }

  function imprimirFormularioEmBranco() {
    document.getElementById('ficha-falha-impressao').innerHTML =
      '<h1 style="margin-bottom:0;">Registro de Falha / Intervenção</h1>' +
      '<p style="color:#5b6b7a; margin-top:0.2rem;">Manutenção Industrial Flaviense — preencher à mão e entregar para digitação</p>' +
      '<table style="margin:1.2rem 0;">' +
        '<tr><th style="width:230px;">Equipamento (nome ou ID)</th><td>&nbsp;</td></tr>' +
        '<tr><th>Local</th><td>&nbsp;</td></tr>' +
        '<tr><th>Data da falha</th><td>&nbsp;</td></tr>' +
        '<tr><th>Registrado por</th><td>&nbsp;</td></tr>' +
      '</table>' +
      '<h2>Descrição da falha</h2>' +
      '<div class="caixa-descricao-impressao"></div>' +
      '<table>' +
        '<tr><th style="width:290px;">Gerou parada de produção?</th><td>☐ Sim&nbsp;&nbsp;&nbsp;&nbsp;☐ Não</td></tr>' +
        '<tr><th>Manutenção realizada por</th><td>☐ Equipe própria&nbsp;&nbsp;&nbsp;&nbsp;☐ Equipe terceirizada</td></tr>' +
        '<tr><th>Empresa terceirizada (se houver)</th><td>&nbsp;</td></tr>' +
        '<tr><th>Custo da intervenção (R$)</th><td>&nbsp;</td></tr>' +
      '</table>';
    window.print();
  }

  btnImprimirBranco.addEventListener('click', imprimirFormularioEmBranco);

  menuRegistro.addEventListener('click', function () { irParaModo('registro'); });
  menuBranco.addEventListener('click', function () { irParaModo('branco'); });

  selectEquipamento.addEventListener('change', function (ev) {
    selecionado = todos.find(function (x) { return x.ID === ev.target.value; }) || null;
  });

  filtroLocalSelect.addEventListener('change', function () {
    popularSelectEquipamentos();
    selecionado = null;
  });

  // ---------------------------------------------------------------------
  // Ditado por voz (Web Speech API) na descrição da falha
  // ---------------------------------------------------------------------
  (function configurarDitado() {
    const elDescricao = document.getElementById('falha-descricao');
    const btnDitado = document.getElementById('btn-ditado');
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      btnDitado.style.display = 'none';
      document.getElementById('msg-ditado-indisponivel').style.display = 'block';
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let gravando = false;
    let textoBase = '';

    function atualizarBotao() {
      btnDitado.textContent = gravando ? '⏹ Parar' : '🎤 Ditar';
      btnDitado.classList.toggle('botao-gravando', gravando);
    }

    recognition.addEventListener('result', function (ev) {
      let textoFinal = '';
      let textoInterino = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcricao = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          textoFinal += transcricao;
        } else {
          textoInterino += transcricao;
        }
      }
      if (textoFinal) {
        textoBase = (textoBase ? textoBase.trim() + ' ' : '') + textoFinal.trim();
      }
      elDescricao.value = textoBase + (textoInterino ? (textoBase ? ' ' : '') + textoInterino : '');
    });

    recognition.addEventListener('end', function () {
      gravando = false;
      atualizarBotao();
    });

    recognition.addEventListener('error', function (ev) {
      gravando = false;
      atualizarBotao();
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        alert('Permissão de microfone negada. Permita o acesso ao microfone no navegador para usar o ditado por voz.');
      }
    });

    btnDitado.addEventListener('click', function () {
      if (gravando) {
        recognition.stop();
        return;
      }
      textoBase = elDescricao.value;
      try {
        recognition.start();
        gravando = true;
        atualizarBotao();
      } catch (err) {
        gravando = false;
        atualizarBotao();
      }
    });
  })();

  // ---------------------------------------------------------------------
  // Fotos da falha (redimensiona no navegador antes de enviar)
  // ---------------------------------------------------------------------
  const inputFotos = document.getElementById('falha-fotos');
  const previewsFotos = document.getElementById('previews-fotos');

  function redimensionarImagem(arquivo, dimensaoMaxima, qualidade) {
    return new Promise(function (resolve, reject) {
      const leitor = new FileReader();
      leitor.onload = function (ev) {
        const img = new Image();
        img.onload = function () {
          let largura = img.width;
          let altura = img.height;
          if (largura > altura && largura > dimensaoMaxima) {
            altura = Math.round(altura * dimensaoMaxima / largura);
            largura = dimensaoMaxima;
          } else if (altura > dimensaoMaxima) {
            largura = Math.round(largura * dimensaoMaxima / altura);
            altura = dimensaoMaxima;
          }
          const canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          canvas.getContext('2d').drawImage(img, 0, 0, largura, altura);
          resolve(canvas.toDataURL('image/jpeg', qualidade));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      leitor.onerror = reject;
      leitor.readAsDataURL(arquivo);
    });
  }

  function limparFotos() {
    fotosSelecionadas = [];
    inputFotos.value = '';
    previewsFotos.innerHTML = '';
  }

  inputFotos.addEventListener('change', async function (ev) {
    const arquivos = Array.from(ev.target.files).slice(0, 4);
    fotosSelecionadas = [];
    previewsFotos.innerHTML = '';
    for (let i = 0; i < arquivos.length; i++) {
      try {
        const dataUrl = await redimensionarImagem(arquivos[i], 1280, 0.7);
        fotosSelecionadas.push(dataUrl);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:6px; border:1px solid var(--cinza-borda);';
        previewsFotos.appendChild(img);
      } catch (err) {
        // ignora arquivo que não conseguiu processar (ex: não é imagem válida)
      }
    }
  });

  async function enviarFotosSelecionadas() {
    const urls = [];
    for (let i = 0; i < fotosSelecionadas.length; i++) {
      const base64 = fotosSelecionadas[i].split(',')[1];
      const resp = await apiPost('uploadFoto', { base64: base64, tipo: 'image/jpeg' });
      if (resp.ok) urls.push(resp.data.url);
    }
    return urls;
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

  buscaInput.addEventListener('input', renderResultados);
  filtroLocalBusca.addEventListener('change', renderResultados);
  document.getElementById('form-busca-equipamento').addEventListener('submit', function (ev) {
    ev.preventDefault();
    renderResultados();
  });

  document.getElementById('form-falha').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!selecionado) return;
    const botaoEnviar = ev.target.querySelector('button[type="submit"]');
    botaoEnviar.disabled = true;
    const textoOriginalBotao = botaoEnviar.textContent;
    try {
      if (fotosSelecionadas.length) botaoEnviar.textContent = 'Enviando fotos...';
      const urlsFotos = await enviarFotosSelecionadas();
      botaoEnviar.textContent = textoOriginalBotao;

      const equipeTerceirizada = document.getElementById('falha-equipe-terceirizada').checked;
      const resp = await apiPost('adicionarFalha', {
        equipamentoId: selecionado.ID,
        data: document.getElementById('falha-data').value,
        descricao: document.getElementById('falha-descricao').value.trim(),
        registradoPor: document.getElementById('falha-registrado-por').value.trim(),
        paradaProducao: document.getElementById('falha-parada').checked ? 'true' : 'false',
        equipeResponsavel: equipeTerceirizada ? 'Terceirizada' : 'Propria',
        empresaTerceirizada: equipeTerceirizada ? document.getElementById('falha-empresa').value.trim() : '',
        custo: document.getElementById('falha-custo').value,
        fotos: JSON.stringify(urlsFotos)
      });
      if (resp.ok) {
        document.getElementById('msg-ok').style.display = 'inline';
        document.getElementById('falha-descricao').value = '';
        document.getElementById('falha-parada').checked = false;
        document.getElementById('falha-equipe-propria').checked = true;
        document.getElementById('falha-empresa').value = '';
        document.getElementById('falha-custo').value = '';
        atualizarCampoEmpresa();
        limparFotos();
        setTimeout(function () { document.getElementById('msg-ok').style.display = 'none'; }, 2500);
      } else {
        alert('Erro ao registrar falha: ' + resp.error);
      }
    } finally {
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = textoOriginalBotao;
    }
  });

  (async function carregar() {
    const resp = await apiGet('listarEquipamentos');
    if (resp.ok) {
      todos = resp.data;
      popularFiltrosLocal();
      popularSelectEquipamentos();
      if (idPreSelecionado) {
        const eq = todos.find(function (x) { return x.ID === idPreSelecionado; });
        if (eq) selecionar(eq);
      }
    }
  })();
})();
