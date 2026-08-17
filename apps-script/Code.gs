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
 * Na primeira execução, o script cria automaticamente todas as abas
 * necessárias na planilha e um usuário administrador padrão:
 *   usuário: admin   senha: admin123
 * Troque essa senha assim que possível na página de Configurações.
 */

const SHEETS = {
  EQUIPAMENTOS: 'Equipamentos',
  PREVENTIVAS: 'Preventivas',
  MONITORAMENTO: 'Monitoramento',
  FALHAS: 'Falhas',
  USUARIOS: 'Usuarios',
  ALERTAS: 'AlertaEmails',
  SESSOES: 'Sessoes'
};

const HEADERS = {
  Equipamentos: ['ID', 'Nome', 'Descricao', 'Local', 'DataProximaIntervencao', 'CriadoEm', 'AtualizadoEm'],
  Preventivas: ['ID', 'EquipamentoID', 'Descricao', 'Periodicidade', 'CriadoEm'],
  Monitoramento: ['ID', 'EquipamentoID', 'Data', 'Responsavel', 'Horimetro', 'Observacoes', 'CriadoEm'],
  Falhas: ['ID', 'EquipamentoID', 'Data', 'Descricao', 'RegistradoPor', 'CriadoEm', 'ParadaProducao', 'EquipeResponsavel', 'EmpresaTerceirizada', 'Custo'],
  Usuarios: ['Nome', 'Usuario', 'SenhaHash', 'Ativo', 'CriadoEm'],
  AlertaEmails: ['Email', 'Ativo', 'CriadoEm'],
  Sessoes: ['Token', 'Usuario', 'Nome', 'ExpiraEm']
};

// ---------------------------------------------------------------------
// Infraestrutura da planilha
// ---------------------------------------------------------------------

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    let criadaAgora = false;
    if (!sheet) {
      sheet = ss.insertSheet(name);
      criadaAgora = true;
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS[name]);
      sheet.setFrozenRows(1);
      criadaAgora = true;
    } else {
      migrarCabecalho_(sheet, HEADERS[name]);
    }
    if (criadaAgora && name === SHEETS.USUARIOS && sheet.getLastRow() === 1) {
      sheet.appendRow(['Administrador', 'admin', sha256Hex_('admin123'), true, new Date()]);
    }
  });

  ['Sheet1', 'Página1', 'Planilha1'].forEach(function (nomePadrao) {
    const def = ss.getSheetByName(nomePadrao);
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(def);
    }
  });
}

/**
 * Adiciona ao final da linha de cabeçalho quaisquer colunas novas
 * previstas em HEADERS que ainda não existam na planilha real, sem
 * mexer nas colunas já existentes (preserva dados já cadastrados).
 */
function migrarCabecalho_(sheet, headersEsperados) {
  const ultimaColuna = sheet.getLastColumn();
  const cabecalhoAtual = ultimaColuna > 0 ? sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0] : [];
  const faltando = headersEsperados.filter(function (h) { return cabecalhoAtual.indexOf(h) === -1; });
  if (faltando.length) {
    sheet.getRange(1, cabecalhoAtual.length + 1, 1, faltando.length).setValues([faltando]);
  }
}

function getSheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function sheetToObjects_(name) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map(function (row, idx) {
    const obj = { _row: idx + 2 };
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow_(name, obj) {
  const sheet = getSheet_(name);
  const headers = HEADERS[name];
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateRow_(name, rowIndex, obj) {
  const sheet = getSheet_(name);
  const headers = HEADERS[name];
  headers.forEach(function (h, i) {
    if (obj[h] !== undefined) sheet.getRange(rowIndex, i + 1).setValue(obj[h]);
  });
}

function deleteRow_(name, rowIndex) {
  getSheet_(name).deleteRow(rowIndex);
}

function limparObjeto_(o) {
  const out = {};
  Object.keys(o).forEach(function (k) {
    const v = o[k];
    out[k] = (v instanceof Date) ? v.toISOString() : v;
  });
  return out;
}

function sha256Hex_(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function (byte) {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// ---------------------------------------------------------------------
// Sessão / autenticação
// ---------------------------------------------------------------------

function criarSessao_(usuario, nome) {
  const token = Utilities.getUuid();
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000);
  appendRow_(SHEETS.SESSOES, { Token: token, Usuario: usuario, Nome: nome, ExpiraEm: expira });
  return token;
}

function validarSessao_(token) {
  if (!token) return null;
  const items = sheetToObjects_(SHEETS.SESSOES);
  const now = new Date();
  for (let i = 0; i < items.length; i++) {
    if (items[i].Token === token) {
      if (new Date(items[i].ExpiraEm) > now) return items[i];
      return null;
    }
  }
  return null;
}

function acaoLogin_(p) {
  const usuarios = sheetToObjects_(SHEETS.USUARIOS);
  const found = usuarios.find(function (u) {
    return String(u.Usuario).toLowerCase() === String(p.usuario || '').toLowerCase() && u.Ativo === true;
  });
  if (!found || found.SenhaHash !== p.senhaHash) {
    return { ok: false, error: 'credenciais_invalidas' };
  }
  const token = criarSessao_(found.Usuario, found.Nome);
  return { ok: true, token: token, nome: found.Nome, usuario: found.Usuario };
}

// ---------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------

function proximoIdEquipamento_() {
  const items = sheetToObjects_(SHEETS.EQUIPAMENTOS);
  let max = 0;
  items.forEach(function (it) {
    const m = String(it.ID).match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'EQ-' + String(max + 1).padStart(4, '0');
}

function listarEquipamentos_() {
  return sheetToObjects_(SHEETS.EQUIPAMENTOS).map(limparObjeto_);
}

function obterEquipamentoCompleto_(id) {
  const equipamentos = sheetToObjects_(SHEETS.EQUIPAMENTOS);
  const eq = equipamentos.find(function (x) { return x.ID === id; });
  if (!eq) return null;
  const preventivas = sheetToObjects_(SHEETS.PREVENTIVAS).filter(function (x) { return x.EquipamentoID === id; });
  const monitoramento = sheetToObjects_(SHEETS.MONITORAMENTO).filter(function (x) { return x.EquipamentoID === id; });
  const falhas = sheetToObjects_(SHEETS.FALHAS).filter(function (x) { return x.EquipamentoID === id; });
  return {
    equipamento: limparObjeto_(eq),
    preventivas: preventivas.map(limparObjeto_),
    monitoramento: monitoramento.map(limparObjeto_),
    falhas: falhas.map(limparObjeto_)
  };
}

function salvarEquipamento_(p) {
  const equipamentos = sheetToObjects_(SHEETS.EQUIPAMENTOS);
  if (p.id) {
    const eq = equipamentos.find(function (x) { return x.ID === p.id; });
    if (!eq) throw new Error('Equipamento não encontrado');
    updateRow_(SHEETS.EQUIPAMENTOS, eq._row, {
      Nome: p.nome, Descricao: p.descricao, Local: p.local,
      DataProximaIntervencao: p.dataProxima || '', AtualizadoEm: new Date()
    });
    return { id: p.id };
  }
  const novoId = proximoIdEquipamento_();
  appendRow_(SHEETS.EQUIPAMENTOS, {
    ID: novoId, Nome: p.nome, Descricao: p.descricao, Local: p.local,
    DataProximaIntervencao: p.dataProxima || '', CriadoEm: new Date(), AtualizadoEm: new Date()
  });
  return { id: novoId };
}

// ---------------------------------------------------------------------
// Preventivas / Monitoramento / Falhas
// ---------------------------------------------------------------------

function adicionarPreventiva_(p) {
  const id = new Date().getTime();
  appendRow_(SHEETS.PREVENTIVAS, { ID: id, EquipamentoID: p.equipamentoId, Descricao: p.descricao, Periodicidade: p.periodicidade, CriadoEm: new Date() });
  return { id: id };
}

function adicionarMonitoramento_(p) {
  const id = new Date().getTime();
  appendRow_(SHEETS.MONITORAMENTO, { ID: id, EquipamentoID: p.equipamentoId, Data: p.data, Responsavel: p.responsavel, Horimetro: p.horimetro, Observacoes: p.observacoes || '', CriadoEm: new Date() });
  return { id: id };
}

function adicionarFalha_(p) {
  const id = new Date().getTime();
  appendRow_(SHEETS.FALHAS, {
    ID: id,
    EquipamentoID: p.equipamentoId,
    Data: p.data,
    Descricao: p.descricao,
    RegistradoPor: p.registradoPor,
    CriadoEm: new Date(),
    ParadaProducao: p.paradaProducao === 'true',
    EquipeResponsavel: p.equipeResponsavel || '',
    EmpresaTerceirizada: p.empresaTerceirizada || '',
    Custo: p.custo || ''
  });
  return { id: id };
}

function removerLinha_(sheetName, row) {
  deleteRow_(sheetName, parseInt(row, 10));
  return { removido: true };
}

// ---------------------------------------------------------------------
// E-mails de alerta
// ---------------------------------------------------------------------

function adicionarAlertaEmail_(p) {
  appendRow_(SHEETS.ALERTAS, { Email: p.email, Ativo: true, CriadoEm: new Date() });
  return { ok: true };
}

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------

function listarUsuarios_() {
  return sheetToObjects_(SHEETS.USUARIOS).map(function (u) {
    return { _row: u._row, Nome: u.Nome, Usuario: u.Usuario, Ativo: u.Ativo };
  });
}

function adicionarUsuario_(p) {
  const usuarios = sheetToObjects_(SHEETS.USUARIOS);
  if (usuarios.some(function (u) { return String(u.Usuario).toLowerCase() === String(p.usuario).toLowerCase(); })) {
    throw new Error('Usuário já existe');
  }
  appendRow_(SHEETS.USUARIOS, { Nome: p.nome, Usuario: p.usuario, SenhaHash: p.senhaHash, Ativo: true, CriadoEm: new Date() });
  return { ok: true };
}

function alternarUsuario_(p) {
  const usuarios = sheetToObjects_(SHEETS.USUARIOS);
  const u = usuarios.find(function (x) { return String(x.Usuario) === String(p.usuario); });
  if (!u) throw new Error('Usuário não encontrado');
  updateRow_(SHEETS.USUARIOS, u._row, { Ativo: !u.Ativo });
  return { ok: true };
}

// ---------------------------------------------------------------------
// Roteador HTTP
// ---------------------------------------------------------------------

function doGet(e) { return handle_(e); }
function doPost(e) { return handle_(e); }

function handle_(e) {
  ensureSheets_();
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

function route_(action, p) {
  if (action === 'login') return acaoLogin_(p);

  const sessao = validarSessao_(p.token);
  if (!sessao) return { ok: false, error: 'sessao_invalida' };

  switch (action) {
    case 'listarEquipamentos': return { ok: true, data: listarEquipamentos_() };
    case 'obterEquipamento': return { ok: true, data: obterEquipamentoCompleto_(p.id) };
    case 'salvarEquipamento': return { ok: true, data: salvarEquipamento_(p) };
    case 'adicionarPreventiva': return { ok: true, data: adicionarPreventiva_(p) };
    case 'removerPreventiva': return { ok: true, data: removerLinha_(SHEETS.PREVENTIVAS, p.row) };
    case 'adicionarMonitoramento': return { ok: true, data: adicionarMonitoramento_(p) };
    case 'removerMonitoramento': return { ok: true, data: removerLinha_(SHEETS.MONITORAMENTO, p.row) };
    case 'adicionarFalha': return { ok: true, data: adicionarFalha_(p) };
    case 'listarAlertaEmails': return { ok: true, data: sheetToObjects_(SHEETS.ALERTAS) };
    case 'adicionarAlertaEmail': return { ok: true, data: adicionarAlertaEmail_(p) };
    case 'removerAlertaEmail': return { ok: true, data: removerLinha_(SHEETS.ALERTAS, p.row) };
    case 'listarUsuarios': return { ok: true, data: listarUsuarios_() };
    case 'adicionarUsuario': return { ok: true, data: adicionarUsuario_(p) };
    case 'alternarUsuario': return { ok: true, data: alternarUsuario_(p) };
    default: return { ok: false, error: 'acao_desconhecida' };
  }
}

// ---------------------------------------------------------------------
// Alerta diário por e-mail (véspera da intervenção programada)
// ---------------------------------------------------------------------

function verificarAlertasDiarios() {
  ensureSheets_();
  const equipamentos = sheetToObjects_(SHEETS.EQUIPAMENTOS);
  const emails = sheetToObjects_(SHEETS.ALERTAS)
    .filter(function (e) { return e.Ativo === true && e.Email; })
    .map(function (e) { return e.Email; });
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
