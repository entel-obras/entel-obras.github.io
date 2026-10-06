/* =====================================================================
   Painel Ramal da Arena · acesso, banco e arquivos (Supabase)
   Faz a ponte entre o painel (js/painel.js) e o Supabase:
   - tela de entrada (login, cadastro, senha esquecida)
   - perfis: pendente, diretoria, equipe, admin, bloqueado
   - banco de registros com atualização em tempo real
   - envio de fotos e PDFs
   - gestão de usuários (admin)
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.PAINEL_CONFIG || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const gate = $('#gate');

  if (!CFG.url || !CFG.chave || /COLE_AQUI/.test(CFG.url + CFG.chave)) {
    gate.innerHTML = card('<h2>Configuração pendente</h2><p class="g-note">Preencha <b>config.js</b> com o endereço e a chave pública do projeto Supabase.</p>');
    return;
  }
  const sb = window.supabase.createClient(CFG.url, CFG.chave, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}});
  window.BLOB = CFG.url.replace(/\/$/, '') + '/storage/v1/object/public/arquivos/';

  const PAPEL = {pendente: 'Aguardando aprovação', diretoria: 'Diretoria (só leitura)', equipe: 'Equipe de obra', admin: 'Administrador', bloqueado: 'Bloqueado'};
  let ME = null, started = false;

  /* ---------------- tela de entrada ---------------- */
  function card(inner) {
    return `<div class="g-card"><img src="logo.png" alt="" class="g-logo"><div class="g-eyebrow">Contrato 34/2025 · Consórcio Arena I</div><h1 class="g-title">Ramal da Arena</h1>${inner}</div>`;
  }
  function showGate(html) { gate.hidden = false; gate.innerHTML = card(html); document.body.classList.add('locked'); }
  function hideGate() { gate.hidden = true; gate.innerHTML = ''; document.body.classList.remove('locked'); }
  function msg(t, ok) { const m = $('#g_msg'); if (m) { m.className = 'g-msg' + (ok ? ' ok' : ' err'); m.textContent = t; } }
  const traduz = e => {
    const m = (e && (e.message || e.error_description || e.code)) || 'erro';
    if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem cadastro. Use "Entrar".';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
    return m;
  };

  function telaEntrar(aviso) {
    showGate(`<form id="g_form" class="g-form">
      <label>E-mail<input id="g_email" type="email" autocomplete="username" required></label>
      <label>Senha<input id="g_pass" type="password" autocomplete="current-password" required></label>
      <button class="g-btn" type="submit">Entrar</button>
      <div id="g_msg" class="g-msg">${esc(aviso || '')}</div>
      <div class="g-links"><a href="#" data-g="cadastro">Criar conta</a><a href="#" data-g="esqueci">Esqueci a senha</a></div>
    </form>`);
    $('#g_form').onsubmit = async e => {
      e.preventDefault(); msg('Entrando…', true);
      const {error} = await sb.auth.signInWithPassword({email: $('#g_email').value.trim(), password: $('#g_pass').value});
      if (error) msg(traduz(error)); else iniciar();
    };
  }
  function telaCadastro() {
    showGate(`<form id="g_form" class="g-form">
      <label>Nome<input id="g_nome" autocomplete="name" required maxlength="80"></label>
      <label>E-mail<input id="g_email" type="email" autocomplete="username" required></label>
      <label>Senha (mínimo 8 caracteres)<input id="g_pass" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="g-btn" type="submit">Criar conta</button>
      <div id="g_msg" class="g-msg"></div>
      <p class="g-note">Depois do cadastro, o administrador libera seu acesso como Equipe ou Diretoria.</p>
      <div class="g-links"><a href="#" data-g="entrar">Já tenho conta</a></div>
    </form>`);
    $('#g_form').onsubmit = async e => {
      e.preventDefault(); msg('Criando…', true);
      const {data, error} = await sb.auth.signUp({email: $('#g_email').value.trim(), password: $('#g_pass').value,
        options: {data: {nome: $('#g_nome').value.trim()}, emailRedirectTo: location.origin + location.pathname}});
      if (error) return msg(traduz(error));
      if (data.session) iniciar(); else telaEntrar('Conta criada. Abra o e-mail de confirmação que enviamos e depois entre aqui.');
    };
  }
  function telaEsqueci() {
    showGate(`<form id="g_form" class="g-form">
      <label>E-mail<input id="g_email" type="email" autocomplete="username" required></label>
      <button class="g-btn" type="submit">Enviar link para nova senha</button>
      <div id="g_msg" class="g-msg"></div>
      <div class="g-links"><a href="#" data-g="entrar">Voltar</a></div>
    </form>`);
    $('#g_form').onsubmit = async e => {
      e.preventDefault(); msg('Enviando…', true);
      const {error} = await sb.auth.resetPasswordForEmail($('#g_email').value.trim(), {redirectTo: location.origin + location.pathname});
      if (error) msg(traduz(error)); else msg('Se o e-mail tiver cadastro, o link chega em instantes.', true);
    };
  }
  function telaNovaSenha() {
    showGate(`<form id="g_form" class="g-form">
      <label>Nova senha (mínimo 8 caracteres)<input id="g_pass" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="g-btn" type="submit">Salvar nova senha</button>
      <div id="g_msg" class="g-msg"></div>
    </form>`);
    $('#g_form').onsubmit = async e => {
      e.preventDefault(); msg('Salvando…', true);
      const {error} = await sb.auth.updateUser({password: $('#g_pass').value});
      if (error) msg(traduz(error)); else { history.replaceState(null, '', location.pathname); iniciar(); }
    };
  }
  function telaEspera() {
    const bloq = ME && ME.papel === 'bloqueado';
    showGate(`<div class="g-form">
      <p class="g-wait">${bloq ? 'Seu acesso está bloqueado.' : 'Cadastro recebido. Seu acesso será liberado pelo administrador.'}</p>
      <p class="g-note">${esc(ME ? ME.email : '')}</p>
      <button class="g-btn" id="g_retry" type="button">${bloq ? 'Tentar de novo' : 'Já fui liberado'}</button>
      <div class="g-links"><a href="#" data-g="sair">Sair</a></div>
    </div>`);
    $('#g_retry').onclick = () => iniciar();
  }
  gate.addEventListener('click', e => {
    const a = e.target.closest('[data-g]'); if (!a) return; e.preventDefault();
    const g = a.dataset.g;
    if (g === 'cadastro') telaCadastro(); else if (g === 'esqueci') telaEsqueci(); else if (g === 'sair') sair(); else telaEntrar();
  });
  async function sair() { await sb.auth.signOut(); location.reload(); }

  /* ---------------- adaptador de banco ---------------- */
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
  const erro = e => {
    const c = e && e.code;
    if (c === '42501' || /row-level security|permission/i.test((e && e.message) || '')) return {code: 'not_granted', message: 'sem permissão'};
    if (c === 'PGRST301' || /JWT/i.test((e && e.message) || '')) return {code: 'revoked', message: 'sessão expirada'};
    return {code: 'unavailable', message: (e && e.message) || 'erro'};
  };
  const snapOf = rows => ({docs: rows.map(r => ({id: r.id, exists: true, data: () => r.data})), empty: !rows.length, size: rows.length});
  const watchers = new Map(); // colecao -> Set(fn)
  let canal = null, timers = {};
  function ouvir(colecao, fn) {
    if (!watchers.has(colecao)) watchers.set(colecao, new Set());
    watchers.get(colecao).add(fn);
    if (!canal) {
      canal = sb.channel('registros-' + rid())
        .on('postgres_changes', {event: '*', schema: 'public', table: 'registros'}, p => {
          const c = (p.new && p.new.colecao) || (p.old && p.old.colecao);
          const alvo = c ? [c] : [...watchers.keys()];
          alvo.forEach(k => { clearTimeout(timers[k]); timers[k] = setTimeout(() => (watchers.get(k) || []).forEach(f => f()), 150); });
        })
        .subscribe();
      // reconsulta ao voltar para a aba (cobre quedas de conexão)
      document.addEventListener('visibilitychange', () => { if (!document.hidden) watchers.forEach(set => set.forEach(f => f())); });
    }
    return () => { const s = watchers.get(colecao); if (s) s.delete(fn); };
  }
  class Doc {
    constructor(c, id) { this.c = c; this.id = id; this.path = c + '/' + id; }
    async get() {
      const {data, error} = await sb.from('registros').select('id,data').eq('colecao', this.c).eq('id', this.id).maybeSingle();
      if (error) throw erro(error);
      return {id: this.id, exists: !!data, data: () => (data ? data.data : undefined)};
    }
    async set(obj) {
      const {error} = await sb.from('registros').upsert({colecao: this.c, id: this.id, data: obj, atualizado: new Date().toISOString()});
      if (error) throw erro(error);
    }
    async update(patch) {
      const {error} = await sb.rpc('registro_mesclar', {p_colecao: this.c, p_id: this.id, p_patch: patch});
      if (error) throw erro(error);
    }
    async delete() {
      const {error} = await sb.from('registros').delete().eq('colecao', this.c).eq('id', this.id);
      if (error) throw erro(error);
    }
    onSnapshot(next, onErr) {
      let vivo = true;
      const load = async () => { try { const d = await this.get(); if (vivo) next(d); } catch (e) { if (vivo && onErr) onErr(e); } };
      load(); const off = ouvir(this.c, load);
      return () => { vivo = false; off(); };
    }
  }
  class Col {
    constructor(c) { this.c = c; this.path = c; }
    doc(id) { return new Doc(this.c, id || rid()); }
    async add(obj) { const d = this.doc(); await d.set(obj); return d; }
    async get() {
      const rows = []; let de = 0;
      for (;;) { // pagina de 1000 em 1000
        const {data, error} = await sb.from('registros').select('id,data').eq('colecao', this.c).order('criado').range(de, de + 999);
        if (error) throw erro(error);
        rows.push(...data); if (data.length < 1000) break; de += 1000;
      }
      return snapOf(rows);
    }
    onSnapshot(next, onErr) {
      let vivo = true, seq = 0;
      const load = async () => { const my = ++seq; try { const s = await this.get(); if (vivo && my === seq) next(s); } catch (e) { if (vivo && onErr) onErr(e); } };
      load(); const off = ouvir(this.c, load);
      return () => { vivo = false; off(); };
    }
  }
  const DB = Object.freeze({
    collection: p => new Col(String(p)),
    doc: p => { const i = String(p).indexOf('/'); return new Doc(p.slice(0, i), p.slice(i + 1)); }
  });

  /* ---------------- arquivos ---------------- */
  const EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'video/mp4': 'mp4'};
  const ASSETS = Object.freeze({
    async upload(blob) {
      if (blob.size > 20 * 1024 * 1024) throw {code: 'too_large', message: 'arquivo maior que 20 MB'};
      const tipo = blob.type || 'application/octet-stream';
      const nome = new Date().toISOString().slice(0, 7) + '/' + rid() + '.' + (EXT[tipo] || 'bin');
      const {error} = await sb.storage.from('arquivos').upload(nome, blob, {contentType: tipo, upsert: false, cacheControl: '31536000'});
      if (error) throw (/row-level|security|not authorized/i.test(error.message || '') ? {code: 'not_granted', message: 'sem permissão de envio'} : {code: 'unavailable', message: error.message});
      return {id: nome, url: window.BLOB + nome, sizeBytes: blob.size, contentType: tipo};
    },
    async list() { return {assets: [], usage: null}; },
    async delete(id) { const {error} = await sb.storage.from('arquivos').remove([id]); if (error) throw erro(error); }
  });

  /* ---------------- quem está usando ---------------- */
  const pode = () => ME && (ME.papel === 'equipe' || ME.papel === 'admin');
  const nomes = {};
  const USER = Object.freeze({
    id: async () => ME.id,
    me: async () => ({id: ME.id, name: ME.nome || ME.email, guest: false}),
    isOwner: async () => ME.papel === 'admin',
    canEdit: async () => ME.papel === 'admin',
    can: async n => (n === 'data.write' ? !!pode() : null),
    profiles: async ids => {
      const falta = ids.filter(i => /^[0-9a-f-]{36}$/i.test(i) && !(i in nomes));
      if (falta.length) {
        const {data} = await sb.from('perfis').select('id,nome,email').in('id', falta);
        (data || []).forEach(p => { nomes[p.id] = p.nome || p.email || ''; });
        falta.forEach(i => { if (!(i in nomes)) nomes[i] = ''; });
      }
      return Object.fromEntries(ids.map(i => [i, {id: i, name: nomes[i] || '', guest: false}]));
    },
    search: async () => []
  });

  window.claude = Object.freeze({
    use: async nome => {
      if (nome === 'db') return DB;
      if (nome === 'user') return USER;
      if (nome === 'assets') return pode() ? ASSETS : null;
      return null; // recursos de IA ficam desligados neste site
    }
  });

  /* ---------------- usuários (admin) ---------------- */
  async function abrirUsuarios() {
    const d = $('#dlg');
    d.innerHTML = '<div class="box"><div class="bh"><h3>Usuários</h3><button class="x" data-ux aria-label="Fechar">×</button></div><div id="u_list" class="note">Carregando…</div></div>';
    d.hidden = false; document.body.style.overflow = 'hidden';
    const {data, error} = await sb.from('perfis').select('id,nome,email,papel,criado').order('criado');
    if (error) { $('#u_list').textContent = 'Não foi possível carregar: ' + error.message; return; }
    const ord = {pendente: 0, equipe: 1, diretoria: 2, admin: 3, bloqueado: 4};
    data.sort((a, b) => (ord[a.papel] - ord[b.papel]) || String(a.nome).localeCompare(String(b.nome)));
    $('#u_list').innerHTML = `<div class="u-grid">${data.map(u => `
      <div class="u-row${u.papel === 'pendente' ? ' pend' : ''}">
        <div><b>${esc(u.nome || '—')}</b><div class="muted" style="font-size:12.5px">${esc(u.email)} · desde ${esc(String(u.criado).slice(0, 10).split('-').reverse().join('/'))}</div></div>
        <select data-uid="${esc(u.id)}" ${u.id === ME.id ? 'disabled title="Você não pode mudar o seu próprio perfil"' : ''}>
          ${Object.entries(PAPEL).map(([k, n]) => `<option value="${k}"${k === u.papel ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>`).join('')}</div>
      <p class="note" style="margin-top:12px">Equipe vê e edita tudo. Diretoria vê avanço, mapas, cronograma, fotos, conferência e projetos, sem pendências, não conformidades, lançamentos e serviços sem avanço. Quem está "Aguardando aprovação" ou "Bloqueado" não vê nada.</p>
      <div id="u_msg" class="status"></div>`;
  }
  document.addEventListener('change', async e => {
    const s = e.target.closest('select[data-uid]'); if (!s) return;
    const st = $('#u_msg'); s.disabled = true;
    const {error} = await sb.from('perfis').update({papel: s.value}).eq('id', s.dataset.uid);
    s.disabled = false;
    if (st) { st.className = 'status ' + (error ? 'err' : 'ok'); st.textContent = error ? 'Não salvou: ' + error.message : 'Perfil atualizado.'; }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-ux]')) { const d = $('#dlg'); d.hidden = true; d.innerHTML = ''; document.body.style.overflow = ''; }
    if (e.target.closest('[data-usuarios]')) abrirUsuarios();
    if (e.target.closest('[data-sair]')) sair();
  });

  function barraConta() {
    const r = document.querySelector('.band .right'); if (!r || $('#contaPills')) return;
    const span = document.createElement('span'); span.id = 'contaPills'; span.style.display = 'contents';
    span.innerHTML = (ME.papel === 'admin' ? '<button class="pill" data-usuarios style="cursor:pointer">Usuários</button>' : '') +
      `<button class="pill" data-sair style="cursor:pointer" title="${esc(ME.email)}">Sair · ${esc((ME.nome || ME.email).split(' ')[0])}</button>`;
    r.appendChild(span);
  }

  /* ---------------- início ---------------- */
  async function carregarDados() {
    const {data, error} = await sb.storage.from('privado').download('dados.json');
    if (error) throw new Error('dados do contrato indisponíveis (' + error.message + ')');
    const j = JSON.parse(await data.text());
    Object.values((j.D && j.D.plans) || {}).forEach(p => { if (p.img && !/^https?:/.test(p.img)) p.img = window.BLOB + p.img; });
    return j;
  }
  async function iniciar() {
    const {data: {session}} = await sb.auth.getSession();
    if (!session) return telaEntrar();
    const {data: perfil, error} = await sb.from('perfis').select('id,email,nome,papel').eq('id', session.user.id).maybeSingle();
    if (error) return telaEntrar('Não foi possível ler seu perfil: ' + error.message);
    ME = perfil || {id: session.user.id, email: session.user.email, nome: '', papel: 'pendente'};
    if (!['diretoria', 'equipe', 'admin'].includes(ME.papel)) return telaEspera();
    if (started) { hideGate(); return; }
    showGate('<p class="g-wait">Carregando o painel…</p>');
    try { window.__DADOS = await carregarDados(); }
    catch (e) { showGate(`<p class="g-wait">${esc(e.message)}</p><div class="g-links"><a href="#" data-g="sair">Sair</a></div>`); return; }
    started = true;
    const s = document.createElement('script'); s.src = 'painel.js?v=' + (CFG.versao || '1');
    s.onload = () => { hideGate(); barraConta(); };
    s.onerror = () => showGate('<p class="g-wait">Falha ao carregar o painel. Recarregue a página.</p>');
    document.body.appendChild(s);
  }
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'PASSWORD_RECOVERY') telaNovaSenha();
    if (ev === 'SIGNED_OUT' && started) location.reload();
  });
  if (/type=recovery/.test(location.hash)) telaNovaSenha(); else iniciar();
})();
