/**
 * BACKEND - Sistema de Manutenção Industrial
 * -------------------------------------------
 * Este script deve ser colado no editor de Apps Script de uma planilha
 * Google Sheets (Extensões > Apps Script) e implantado como "Aplicativo da
 * Web" (Implantar > Nova implantação > Tipo: App da Web):
 *   - Executar como: Eu (seu usuário)
 *   - Quem pode acessar: Qualquer pessoa
 *
 * A URL gerada deve ser colada em js/api.js (variável API_URL).
 *
 * ARMAZENAMENTO: os dados agora ficam no Supabase (Postgres), não mais na
 * planilha. Antes de usar, configure em Projeto > Propriedades do script
 * (ícone de engrenagem > Propriedades do script) estas propriedades:
 *   SUPABASE_URL           -> URL do projeto, ex: https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY   -> a chave "service_role" (secreta) do projeto
 *                              (Project Settings > API Keys no Supabase)
 *   GEMINI_API_KEY         -> chave de API do Google AI Studio
 *                              (aistudio.google.com/apikey), usada para
 *                              preencher o formulário automaticamente a
 *                              partir de foto/PDF do papel preenchido à mão
 *   GEMINI_MODEL           -> opcional; padrão "gemini-3.8-flash" se não
 *                              configurado
 *
 * MIGRAÇÃO ÚNICA: se a planilha ainda tem os dados antigos (abas
 * Equipamentos, Usuarios, Falhas, etc.), rode manualmente a função
 * "migrarPlanilhaParaSupabase" pelo editor do Apps Script (selecione a
 * função no menu suspenso e clique em Executar). Ela copia tudo da
 * planilha para o Supabase; usuários, equipamentos e e-mails usam
 * "upsert" (substitui se já existir), então é seguro rodar de novo se
 * a execução parar no meio por algum erro. Preventivas, monitoramento
 * e falhas são sempre inseridos como novos registros — se rodar esta
 * função uma segunda vez DEPOIS que ela já tiver migrado esses três
 * com sucesso, eles ficariam duplicados.
 */

const VERSAO_CODIGO = 'v9-gemini-3-8-flash-2026-10-03';

// ---------------------------------------------------------------------
// Supabase - cliente REST (PostgREST)
// ---------------------------------------------------------------------

function supabaseUrl_() {
  const url = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
  if (!url) throw new Error('Propriedade SUPABASE_URL não configurada (Projeto > Propriedades do script).');
  return url.replace(/\/+$/, '');
}

function supabaseKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (!key) throw new Error('Propriedade SUPABASE_SERVICE_KEY não configurada (Projeto > Propriedades do script).');
  return key;
}

function supabaseRequest_(method, path, options) {
  options = options || {};
  const url = supabaseUrl_() + '/rest/v1/' + path;
  const key = supabaseKey_();
  const headers = Object.assign({
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  }, options.headers || {});
  const params = { method: method, headers: headers, muteHttpExceptions: true };
  if (options.body !== undefined) params.payload = JSON.stringify(options.body);
  const resp = UrlFetchApp.fetch(url, params);
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code >= 400) {
    throw new Error('Supabase ' + method + ' ' + path + ' falhou (' + code + '): ' + text);
  }
  return text ? JSON.parse(text) : null;
}

function eq_(coluna, valor) {
  return coluna + '=eq.' + encodeURIComponent(valor);
}

function supabaseSelect_(tabela, query) {
  return supabaseRequest_('GET', tabela + (query ? '?' + query : '')) || [];
}

function supabaseInsert_(tabela, objeto) {
  const linhas = supabaseRequest_('POST', tabela, { body: objeto, headers: { Prefer: 'return=representation' } });
  return linhas && linhas[0];
}

function supabaseUpdate_(tabela, query, patch) {
  return supabaseRequest_('PATCH', tabela + '?' + query, { body: patch, headers: { Prefer: 'return=representation' } });
}

function supabaseDelete_(tabela, query) {
  return supabaseRequest_('DELETE', tabela + '?' + query, { headers: { Prefer: 'return=representation' } });
}

/**
 * Insere, mas se já existir uma linha com o mesmo valor na coluna de
 * conflito (ex: um ID ou e-mail repetido), substitui silenciosamente em
 * vez de dar erro. Usado na migração para tolerar linhas duplicadas na
 * planilha antiga e permitir rodar de novo sem travar.
 */
function supabaseUpsert_(tabela, objeto, colunaConflito) {
  const linhas = supabaseRequest_('POST', tabela + '?on_conflict=' + colunaConflito, {
    body: objeto,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
  });
  return linhas && linhas[0];
}

// ---------------------------------------------------------------------
// Conversão entre colunas do Postgres (snake_case) e o formato que o
// frontend já espera (PascalCase, igual aos cabeçalhos da planilha antiga)
// ---------------------------------------------------------------------

function mapEquipamento_(r) {
  return {
    _row: r.id,
    ID: r.id,
    Nome: r.nome,
    Descricao: r.descricao,
    Local: r.local,
    DataProximaIntervencao: r.data_proxima_intervencao,
    CriadoEm: r.criado_em,
    AtualizadoEm: r.atualizado_em
  };
}

function mapPreventiva_(r) {
  return { _row: r.id, ID: r.id, EquipamentoID: r.equipamento_id, Descricao: r.descricao, Periodicidade: r.periodicidade, CriadoEm: r.criado_em };
}

function mapMonitoramento_(r) {
  return { _row: r.id, ID: r.id, EquipamentoID: r.equipamento_id, Data: r.data, Responsavel: r.responsavel, Horimetro: r.horimetro, Observacoes: r.observacoes, CriadoEm: r.criado_em };
}

function mapFalha_(r) {
  return {
    _row: r.id,
    ID: r.id,
    EquipamentoID: r.equipamento_id,
    Data: r.data,
    Descricao: r.descricao,
    RegistradoPor: r.registrado_por,
    CriadoEm: r.criado_em,
    ParadaProducao: r.parada_producao,
    EquipeResponsavel: r.equipe,
    EmpresaTerceirizada: r.empresa_terceirizada,
    Custo: r.custo,
    Fotos: r.fotos || []
  };
}

function mapUsuario_(r) {
  return { _row: r.id, Nome: r.nome, Usuario: r.usuario, Ativo: r.ativo, Papel: r.papel || 'usuario', CriadoEm: r.criado_em };
}

function mapEmail_(r) {
  return { _row: r.id, Email: r.email, Ativo: true };
}

// ---------------------------------------------------------------------
// Sessão / autenticação
// ---------------------------------------------------------------------

function criarSessao_(usuario, nome, papel) {
  const token = Utilities.getUuid();
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000);
  supabaseInsert_('flaviense_sessoes', { token: token, usuario: usuario, nome: nome, papel: papel, expira_em: expira.toISOString() });
  return token;
}

function validarSessao_(token) {
  if (!token) return null;
  const linhas = supabaseSelect_('flaviense_sessoes', eq_('token', token));
  if (!linhas.length) return null;
  const sessao = linhas[0];
  if (new Date(sessao.expira_em) > new Date()) {
    return { Usuario: sessao.usuario, Nome: sessao.nome, Papel: sessao.papel || 'usuario' };
  }
  return null;
}

function acaoLogin_(p) {
  const usuarios = supabaseSelect_('flaviense_usuarios', '');
  const found = usuarios.find(function (u) {
    return String(u.usuario).toLowerCase() === String(p.usuario || '').toLowerCase() && u.ativo === true;
  });
  if (!found || found.senha_hash !== p.senhaHash) {
    return { ok: false, error: 'credenciais_invalidas' };
  }
  const papel = found.papel || 'usuario';
  const token = criarSessao_(found.usuario, found.nome, papel);
  return { ok: true, token: token, nome: found.nome, usuario: found.usuario, papel: papel };
}

// ---------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------

function proximoIdEquipamento_() {
  const linhas = supabaseSelect_('flaviense_equipamentos', 'select=id');
  let max = 0;
  linhas.forEach(function (it) {
    const m = String(it.id).match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'EQ-' + String(max + 1).padStart(4, '0');
}

function listarEquipamentos_() {
  return supabaseSelect_('flaviense_equipamentos', '').map(mapEquipamento_);
}

function obterEquipamentoCompleto_(id) {
  const linhas = supabaseSelect_('flaviense_equipamentos', eq_('id', id));
  if (!linhas.length) return null;
  const preventivas = supabaseSelect_('flaviense_preventivas', eq_('equipamento_id', id)).map(mapPreventiva_);
  const monitoramento = supabaseSelect_('flaviense_monitoramento', eq_('equipamento_id', id)).map(mapMonitoramento_);
  const falhas = supabaseSelect_('flaviense_falhas', eq_('equipamento_id', id)).map(mapFalha_);
  return {
    equipamento: mapEquipamento_(linhas[0]),
    preventivas: preventivas,
    monitoramento: monitoramento,
    falhas: falhas
  };
}

function salvarEquipamento_(p) {
  if (p.id) {
    const linhas = supabaseUpdate_('flaviense_equipamentos', eq_('id', p.id), {
      nome: p.nome, descricao: p.descricao, local: p.local,
      data_proxima_intervencao: p.dataProxima || null, atualizado_em: new Date().toISOString()
    });
    if (!linhas || !linhas.length) throw new Error('Equipamento não encontrado');
    return { id: p.id };
  }
  const novoId = proximoIdEquipamento_();
  supabaseInsert_('flaviense_equipamentos', {
    id: novoId, nome: p.nome, descricao: p.descricao, local: p.local,
    data_proxima_intervencao: p.dataProxima || null,
    criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString()
  });
  return { id: novoId };
}

function removerEquipamento_(id) {
  if (!id) throw new Error('ID do equipamento não informado');
  supabaseDelete_('flaviense_equipamentos', eq_('id', id));
  return { removido: true };
}

// ---------------------------------------------------------------------
// Preventivas / Monitoramento / Falhas
// ---------------------------------------------------------------------

function adicionarPreventiva_(p) {
  const row = supabaseInsert_('flaviense_preventivas', { equipamento_id: p.equipamentoId, descricao: p.descricao, periodicidade: p.periodicidade });
  return { id: row.id };
}

function adicionarMonitoramento_(p) {
  const row = supabaseInsert_('flaviense_monitoramento', {
    equipamento_id: p.equipamentoId, data: p.data, responsavel: p.responsavel,
    horimetro: p.horimetro || null, observacoes: p.observacoes || null
  });
  return { id: row.id };
}

function adicionarFalha_(p) {
  let fotos = [];
  if (p.fotos) {
    try { fotos = JSON.parse(p.fotos); } catch (err) { fotos = []; }
  }
  const row = supabaseInsert_('flaviense_falhas', {
    equipamento_id: p.equipamentoId,
    data: p.data,
    descricao: p.descricao,
    registrado_por: p.registradoPor,
    parada_producao: p.paradaProducao === 'true',
    equipe: p.equipeResponsavel || null,
    empresa_terceirizada: p.empresaTerceirizada || null,
    custo: p.custo ? parseFloat(p.custo) : null,
    fotos: fotos
  });
  return { id: row.id };
}

// ---------------------------------------------------------------------
// Fotos (Supabase Storage)
// ---------------------------------------------------------------------

const BUCKET_FOTOS = 'flaviense-fotos';

function supabaseStorageUpload_(bucket, caminho, bytes, mimeType) {
  const url = supabaseUrl_() + '/storage/v1/object/' + bucket + '/' + caminho;
  const key = supabaseKey_();
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: mimeType,
    payload: bytes,
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code >= 400) {
    throw new Error('Falha ao enviar foto (' + code + '): ' + resp.getContentText());
  }
  return supabaseUrl_() + '/storage/v1/object/public/' + bucket + '/' + caminho;
}

function uploadFoto_(p) {
  if (!p.base64) throw new Error('Nenhuma imagem enviada');
  const bytes = Utilities.base64Decode(p.base64);
  const tipo = p.tipo || 'image/jpeg';
  const extensao = tipo.indexOf('png') !== -1 ? 'png' : 'jpg';
  const caminho = 'falhas/' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000) + '.' + extensao;
  const urlPublica = supabaseStorageUpload_(BUCKET_FOTOS, caminho, bytes, tipo);
  return { url: urlPublica };
}

function removerPorId_(tabela, id) {
  supabaseDelete_(tabela, eq_('id', id));
  return { removido: true };
}

// ---------------------------------------------------------------------
// Preenchimento automático via IA (Gemini) a partir de foto/PDF do
// formulário em papel preenchido à mão
// ---------------------------------------------------------------------

function geminiApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('Propriedade GEMINI_API_KEY não configurada (Projeto > Propriedades do script).');
  return key;
}

function geminiModel_() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-3.8-flash';
}

function extrairFormulario_(p) {
  if (!p.base64) throw new Error('Nenhum arquivo enviado');
  const tipo = p.tipo || 'image/jpeg';

  const prompt = 'Você está lendo um formulário de papel, preenchido à mão, de registro de falha/intervenção ' +
    'de manutenção industrial (em português do Brasil). Extraia os dados exatamente como estão escritos, ' +
    'preenchendo o schema JSON fornecido. Se um campo estiver ilegível, em branco, ou você não tiver certeza, ' +
    'deixe-o como string vazia "" — nunca invente ou adivinhe um valor. ' +
    'Para "data", converta para o formato AAAA-MM-DD (o formulário usa DD/MM/AAAA); se não der pra ler, deixe "". ' +
    'Para "equipe", responda exatamente "Propria" ou "Terceirizada" conforme a caixa marcada, ou "" se nenhuma ' +
    'estiver marcada. Para "paradaProducao", responda true se a caixa "Sim" estiver marcada, false se "Não" ' +
    'estiver marcada, ou deixe null se nenhuma estiver marcada. Para "custo", retorne só os números (ex: "150.00"), sem "R$".';

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: tipo, data: p.base64 } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          equipamentoTexto: { type: 'STRING' },
          local: { type: 'STRING' },
          data: { type: 'STRING' },
          descricao: { type: 'STRING' },
          paradaProducao: { type: 'BOOLEAN' },
          equipe: { type: 'STRING' },
          empresaTerceirizada: { type: 'STRING' },
          custo: { type: 'STRING' },
          registradoPor: { type: 'STRING' }
        }
      }
    }
  };

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel_() + ':generateContent?key=' + geminiApiKey_();
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  const texto = resp.getContentText();
  if (code >= 400) {
    throw new Error('Falha ao consultar a IA (' + code + '): ' + texto);
  }
  const json = JSON.parse(texto);
  const candidato = json.candidates && json.candidates[0];
  const partes = candidato && candidato.content && candidato.content.parts;
  if (!partes || !partes.length) {
    throw new Error('A IA não retornou resultado. Tente uma foto mais nítida ou com melhor iluminação.');
  }
  return JSON.parse(partes[0].text);
}

// ---------------------------------------------------------------------
// E-mails de alerta
// ---------------------------------------------------------------------

function listarAlertaEmails_() {
  return supabaseSelect_('flaviense_emails_alerta', '').map(mapEmail_);
}

function adicionarAlertaEmail_(p) {
  supabaseInsert_('flaviense_emails_alerta', { email: p.email });
  return { ok: true };
}

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------

function listarUsuarios_() {
  return supabaseSelect_('flaviense_usuarios', '').map(mapUsuario_);
}

function adicionarUsuario_(p) {
  const existentes = supabaseSelect_('flaviense_usuarios', '').map(mapUsuario_);
  if (existentes.some(function (u) { return String(u.Usuario).toLowerCase() === String(p.usuario).toLowerCase(); })) {
    throw new Error('Usuário já existe');
  }
  const papel = p.papel === 'admin' ? 'admin' : 'usuario';
  supabaseInsert_('flaviense_usuarios', { nome: p.nome, usuario: p.usuario, senha_hash: p.senhaHash, ativo: true, papel: papel });
  return { ok: true };
}

function alternarUsuario_(p) {
  const linhas = supabaseSelect_('flaviense_usuarios', eq_('usuario', p.usuario));
  if (!linhas.length) throw new Error('Usuário não encontrado');
  supabaseUpdate_('flaviense_usuarios', eq_('usuario', p.usuario), { ativo: !linhas[0].ativo });
  return { ok: true };
}

function alternarPapel_(p, sessao) {
  if (String(p.usuario).toLowerCase() === String(sessao.Usuario).toLowerCase()) {
    throw new Error('Você não pode alterar seu próprio papel');
  }
  const linhas = supabaseSelect_('flaviense_usuarios', eq_('usuario', p.usuario));
  if (!linhas.length) throw new Error('Usuário não encontrado');
  const novoPapel = linhas[0].papel === 'admin' ? 'usuario' : 'admin';
  supabaseUpdate_('flaviense_usuarios', eq_('usuario', p.usuario), { papel: novoPapel });
  return { ok: true, papel: novoPapel };
}

function redefinirSenha_(p) {
  if (!p.senhaHash) throw new Error('Nova senha não informada');
  const linhas = supabaseSelect_('flaviense_usuarios', eq_('usuario', p.usuario));
  if (!linhas.length) throw new Error('Usuário não encontrado');
  supabaseUpdate_('flaviense_usuarios', eq_('usuario', p.usuario), { senha_hash: p.senhaHash });
  return { ok: true };
}

// ---------------------------------------------------------------------
// Roteador HTTP
// ---------------------------------------------------------------------

function doGet(e) { return handle_(e); }
function doPost(e) { return handle_(e); }

function handle_(e) {
  const p = (e && e.parameter) || {};
  const action = p.action;
  let result;
  try {
    result = route_(action, p);
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// Ações que só um usuário com papel "admin" pode executar: excluir
// equipamentos/registros e tudo relacionado a gerenciar usuários e
// e-mails de alerta (página Configurações).
const ACOES_ADMIN_ = {
  removerEquipamento: true,
  removerPreventiva: true,
  removerMonitoramento: true,
  listarAlertaEmails: true,
  adicionarAlertaEmail: true,
  removerAlertaEmail: true,
  listarUsuarios: true,
  adicionarUsuario: true,
  alternarUsuario: true,
  alternarPapel: true,
  redefinirSenha: true
};

function route_(action, p) {
  if (action === 'versao') return { ok: true, versao: VERSAO_CODIGO };
  if (action === 'login') return acaoLogin_(p);

  const sessao = validarSessao_(p.token);
  if (!sessao) return { ok: false, error: 'sessao_invalida' };

  if (ACOES_ADMIN_[action] && sessao.Papel !== 'admin') {
    return { ok: false, error: 'acesso_negado' };
  }

  switch (action) {
    case 'listarEquipamentos': return { ok: true, data: listarEquipamentos_() };
    case 'obterEquipamento': return { ok: true, data: obterEquipamentoCompleto_(p.id) };
    case 'salvarEquipamento': return { ok: true, data: salvarEquipamento_(p) };
    case 'removerEquipamento': return { ok: true, data: removerEquipamento_(p.id) };
    case 'adicionarPreventiva': return { ok: true, data: adicionarPreventiva_(p) };
    case 'removerPreventiva': return { ok: true, data: removerPorId_('flaviense_preventivas', p.row) };
    case 'adicionarMonitoramento': return { ok: true, data: adicionarMonitoramento_(p) };
    case 'removerMonitoramento': return { ok: true, data: removerPorId_('flaviense_monitoramento', p.row) };
    case 'adicionarFalha': return { ok: true, data: adicionarFalha_(p) };
    case 'uploadFoto': return { ok: true, data: uploadFoto_(p) };
    case 'extrairFormulario': return { ok: true, data: extrairFormulario_(p) };
    case 'listarAlertaEmails': return { ok: true, data: listarAlertaEmails_() };
    case 'adicionarAlertaEmail': return { ok: true, data: adicionarAlertaEmail_(p) };
    case 'removerAlertaEmail': return { ok: true, data: removerPorId_('flaviense_emails_alerta', p.row) };
    case 'listarUsuarios': return { ok: true, data: listarUsuarios_() };
    case 'adicionarUsuario': return { ok: true, data: adicionarUsuario_(p) };
    case 'alternarUsuario': return { ok: true, data: alternarUsuario_(p) };
    case 'alternarPapel': return { ok: true, data: alternarPapel_(p, sessao) };
    case 'redefinirSenha': return { ok: true, data: redefinirSenha_(p) };
    default: return { ok: false, error: 'acao_desconhecida' };
  }
}

// ---------------------------------------------------------------------
// Alerta diário por e-mail (véspera da intervenção programada)
// ---------------------------------------------------------------------

function verificarAlertasDiarios() {
  const equipamentos = listarEquipamentos_();
  const emails = listarAlertaEmails_().map(function (e) { return e.Email; }).filter(Boolean);
  if (!emails.length) return;

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = Utilities.formatDate(amanha, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const pendentes = equipamentos.filter(function (eq) {
    if (!eq.DataProximaIntervencao) return false;
    const d = new Date(eq.DataProximaIntervencao);
    const dStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return dStr === amanhaStr;
  });
  if (!pendentes.length) return;

  const linhas = pendentes.map(function (eq) {
    return '- ' + eq.Nome + ' (ID: ' + eq.ID + ') — Local: ' + eq.Local;
  }).join('\n');

  const assunto = 'Alerta de manutenção: intervenção programada para amanhã (' + amanhaStr + ')';
  const corpo = 'Os equipamentos a seguir têm intervenção programada para amanhã:\n\n' + linhas +
    '\n\nEste é um e-mail automático do sistema de manutenção industrial.';

  emails.forEach(function (email) {
    MailApp.sendEmail(email, assunto, corpo);
  });
}

/**
 * Execute esta função UMA VEZ manualmente pelo editor do Apps Script
 * (selecione "criarGatilhoDiario" no menu de funções e clique em Executar)
 * para instalar o gatilho diário que dispara verificarAlertasDiarios.
 */
function criarGatilhoDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarAlertasDiarios') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('verificarAlertasDiarios').timeBased().everyDays(1).atHour(7).create();
}

// ---------------------------------------------------------------------
// Migração única: planilha (Google Sheets) -> Supabase
// ---------------------------------------------------------------------

const SHEETS_LEGADO = {
  EQUIPAMENTOS: 'Equipamentos',
  PREVENTIVAS: 'Preventivas',
  MONITORAMENTO: 'Monitoramento',
  FALHAS: 'Falhas',
  USUARIOS: 'Usuarios',
  ALERTAS: 'AlertaEmails'
};

function sheetToObjectsLegado_(nome) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function formatarDataSql_(v) {
  if (!v) return null;
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function toIso_(v) {
  if (!v) return null;
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Copia os dados da planilha (abas antigas) para o Supabase. Rode esta
 * função UMA VEZ, manualmente, pelo editor do Apps Script. Ela se recusa
 * a rodar se o Supabase já tiver equipamentos cadastrados, para evitar
 * duplicar dados em uma segunda execução acidental.
 */
function migrarPlanilhaParaSupabase() {
  const usuarios = sheetToObjectsLegado_(SHEETS_LEGADO.USUARIOS);
  usuarios.forEach(function (u) {
    supabaseUpsert_('flaviense_usuarios', { nome: u.Nome, usuario: u.Usuario, senha_hash: u.SenhaHash, ativo: u.Ativo === true }, 'usuario');
  });

  const equipamentos = sheetToObjectsLegado_(SHEETS_LEGADO.EQUIPAMENTOS);
  equipamentos.forEach(function (eq) {
    supabaseUpsert_('flaviense_equipamentos', {
      id: eq.ID, nome: eq.Nome, descricao: eq.Descricao || null, local: eq.Local || null,
      data_proxima_intervencao: formatarDataSql_(eq.DataProximaIntervencao),
      criado_em: toIso_(eq.CriadoEm), atualizado_em: toIso_(eq.AtualizadoEm)
    }, 'id');
  });

  const preventivas = sheetToObjectsLegado_(SHEETS_LEGADO.PREVENTIVAS);
  preventivas.forEach(function (p) {
    supabaseInsert_('flaviense_preventivas', { equipamento_id: p.EquipamentoID, descricao: p.Descricao, periodicidade: p.Periodicidade });
  });

  const monitoramento = sheetToObjectsLegado_(SHEETS_LEGADO.MONITORAMENTO);
  monitoramento.forEach(function (m) {
    supabaseInsert_('flaviense_monitoramento', {
      equipamento_id: m.EquipamentoID, data: formatarDataSql_(m.Data), responsavel: m.Responsavel,
      horimetro: m.Horimetro || null, observacoes: m.Observacoes || null
    });
  });

  const falhas = sheetToObjectsLegado_(SHEETS_LEGADO.FALHAS);
  falhas.forEach(function (f) {
    supabaseInsert_('flaviense_falhas', {
      equipamento_id: f.EquipamentoID, data: formatarDataSql_(f.Data), descricao: f.Descricao,
      registrado_por: f.RegistradoPor, criado_em: toIso_(f.CriadoEm),
      parada_producao: f.ParadaProducao === true, equipe: f.EquipeResponsavel || null,
      empresa_terceirizada: f.EmpresaTerceirizada || null, custo: f.Custo || null
    });
  });

  const emails = sheetToObjectsLegado_(SHEETS_LEGADO.ALERTAS);
  emails.forEach(function (e) {
    if (!e.Email) return;
    supabaseUpsert_('flaviense_emails_alerta', { email: e.Email }, 'email');
  });

  Logger.log(
    'Migração concluída: %s usuários, %s equipamentos, %s preventivas, %s monitoramentos, %s falhas, %s e-mails.',
    usuarios.length, equipamentos.length, preventivas.length, monitoramento.length, falhas.length, emails.length
  );
}
