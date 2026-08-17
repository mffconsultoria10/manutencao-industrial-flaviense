// Cole aqui a URL do Apps Script publicado como "Aplicativo da Web".
const API_URL = 'https://script.google.com/macros/s/AKfycbw_jes_RNK88pxH2vr97pZpM9Rn5Pe9IK2GS2Xf0j9tgpm-hEBq3UWZHYzhNvzkxuM/exec';

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
  return s;
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

async function apiGet(action, params) {
  if (!verificarConfigApi()) return { ok: false, error: 'api_nao_configurada' };
  const sessao = getSessao();
  const qs = new URLSearchParams(Object.assign({ action: action, token: sessao ? sessao.token : '' }, params || {}));
  const resp = await fetch(API_URL + '?' + qs.toString());
  const json = await resp.json();
  if (!json.ok && json.error === 'sessao_invalida') { sair(); }
  return json;
}

async function apiPost(action, params) {
  if (!verificarConfigApi()) return { ok: false, error: 'api_nao_configurada' };
  const sessao = getSessao();
  const body = new URLSearchParams(Object.assign({ action: action, token: sessao ? sessao.token : '' }, params || {}));
  const resp = await fetch(API_URL, { method: 'POST', body: body });
  const json = await resp.json();
  if (!json.ok && json.error === 'sessao_invalida') { sair(); }
  return json;
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
