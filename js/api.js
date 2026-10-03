// Cole aqui a URL do Apps Script publicado como "Aplicativo da Web".
const API_URL = 'https://script.google.com/macros/s/AKfycbygStaQCXvcPnxSkS_-4dXBQDQQHqomJnC5HEqaoZTMkN4JxpyGvm3JAdVeITueowU/exec';

function getSessao() {
  const raw = localStorage.getItem('mnt_sessao');
  return raw ? JSON.parse(raw) : null;
}

function salvarSessao(sessao) {
  localStorage.setItem('mnt_sessao', JSON.stringify(sessao));
}

function exigirLogin() {
  const s = getSessao();
  if (!s || !s.token) {
    window.location.href = 'index.html';
    return null;
  }
  const navConfig = document.getElementById('nav-config');
  if (navConfig && s.papel !== 'admin') navConfig.style.display = 'none';
  return s;
}

function ehAdmin(sessao) {
  return !!sessao && sessao.papel === 'admin';
}

function exigirAdmin(sessao) {
  if (!ehAdmin(sessao)) {
    alert('Esta área é restrita a administradores.');
    window.location.href = 'equipamentos.html';
    return false;
  }
  return true;
}

function sair() {
  localStorage.removeItem('mnt_sessao');
  window.location.href = 'index.html';
}

async function sha256Hex(texto) {
  const enc = new TextEncoder().encode(texto);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function verificarConfigApi() {
  if (!API_URL || API_URL.indexOf('COLE_AQUI') !== -1) {
    alert('Configuração pendente: defina API_URL em js/api.js com a URL do Apps Script publicado.');
    return false;
  }
  return true;
}

let contadorRequisicoes = 0;

function elementoCarregando_() {
  let el = document.getElementById('indicador-carregando');
  if (!el) {
    el = document.createElement('div');
    el.id = 'indicador-carregando';
    el.className = 'indicador-carregando no-print';
    el.innerHTML = '<span class="spinner"></span><span>Processando...</span>';
    document.body.appendChild(el);
  }
  return el;
}

function mostrarCarregando() {
  contadorRequisicoes++;
  elementoCarregando_().classList.add('ativo');
}

function esconderCarregando() {
  contadorRequisicoes = Math.max(0, contadorRequisicoes - 1);
  if (contadorRequisicoes === 0) {
    const el = document.getElementById('indicador-carregando');
    if (el) el.classList.remove('ativo');
  }
}

async function apiGet(action, params) {
  if (!verificarConfigApi()) return { ok: false, error: 'api_nao_configurada' };
  mostrarCarregando();
  try {
    const sessao = getSessao();
    const qs = new URLSearchParams(Object.assign({ action: action, token: sessao ? sessao.token : '' }, params || {}));
    const resp = await fetch(API_URL + '?' + qs.toString());
    const json = await resp.json();
    if (!json.ok && json.error === 'sessao_invalida') { sair(); }
    return json;
  } catch (err) {
    return { ok: false, error: 'falha_conexao' };
  } finally {
    esconderCarregando();
  }
}

async function apiPost(action, params) {
  if (!verificarConfigApi()) return { ok: false, error: 'api_nao_configurada' };
  mostrarCarregando();
  try {
    const sessao = getSessao();
    const body = new URLSearchParams(Object.assign({ action: action, token: sessao ? sessao.token : '' }, params || {}));
    const resp = await fetch(API_URL, { method: 'POST', body: body });
    const json = await resp.json();
    if (!json.ok && json.error === 'sessao_invalida') { sair(); }
    return json;
  } catch (err) {
    return { ok: false, error: 'falha_conexao' };
  } finally {
    esconderCarregando();
  }
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('pt-BR');
}

function escapeHtml(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
