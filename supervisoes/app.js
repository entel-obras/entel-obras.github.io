/* =====================================================================
   Supervisões ENTEL · acesso, obras, banco e arquivos (Supabase)
   - tela de entrada (login, cadastro, senha esquecida)
   - portal com os cartões das obras: entra só quem foi liberado na obra
   - papéis por obra: pendente, diretoria (visitante), equipe, gestor, bloqueado
   - desenvolvedor (perfis.dev): tudo, em todas as obras
   - banco de registros por obra, com atualização em tempo real
   - fotos/PDFs em pastas por obra; dados do contrato no bucket privado
   ===================================================================== */
(function () {
  'use strict';
  // não deixa o painel ser aberto dentro de outro site (proteção contra páginas falsas)
  if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.innerHTML = ''; } return; }
  const CFG = window.PAINEL_CONFIG || {};
  const checarVersao = () => fetch('config.js?t=' + Date.now(), {cache: 'no-store'}).then(r => r.text()).then(t => {
    const m = t.match(/versao:\s*'([^']+)'/); if (!m || !CFG.versao || m[1] === CFG.versao) return;
    const u = new URL(location.href); if (u.searchParams.get('v') === m[1]) return;
    u.searchParams.set('v', m[1]); location.replace(u.toString());
  }).catch(() => {});
  checarVersao(); setInterval(checarVersao, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checarVersao(); });
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const gate = $('#gate');
  if (!CFG.url || !CFG.chave) { gate.innerHTML = '<div class="g-card"><h2>Configuração pendente</h2></div>'; return; }
  const sb = window.supabase.createClient(CFG.url, CFG.chave, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sup-entel-auth'}});
  window.BLOB = CFG.url.replace(/\/$/, '') + '/storage/v1/object/public/arquivos/';

  const PAPEL = {pendente: 'Aguardando aprovação', diretoria: 'Visitante (só leitura)', equipe: 'Equipe', gestor: 'Gestor da obra', bloqueado: 'Bloqueado'};
  const ACESSA = ['diretoria', 'equipe', 'gestor'];
  let ME = null, OBRAS = [], MEUS = {}, OBRA = null, PAPEL_OBRA = null, started = false;
  const obraParam = () => new URLSearchParams(location.search).get('obra') || '';
  const irPara = id => { const u = new URL(location.href); if (id) u.searchParams.set('obra', id); else u.searchParams.delete('obra'); location.href = u.toString(); };

  /* ---------------- tela de entrada ---------------- */
  function card(inner, larga) {
    return `<div class="g-card${larga ? ' g-larga' : ''}"><img src="logo.png" alt="" class="g-logo"><div class="g-eyebrow">ENTEL · Supervisão de obras</div><h1 class="g-title">Supervisões</h1>${inner}</div>`;
  }
  function showGate(html, larga) { gate.hidden = false; gate.innerHTML = card(html, larga); document.body.classList.add('locked'); }
  function hideGate() { gate.hidden = true; gate.innerHTML = ''; document.body.classList.remove('locked'); }
  function msg(t, ok) { const m = $('#g_msg'); if (m) { m.className = 'g-msg' + (ok ? ' ok' : ' err'); m.textContent = t; } }
  const traduz = e => {
    const m = (e && (e.message || e.error_description || e.code)) || 'erro';
    if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem cadastro. Use "Entrar".';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/email rate limit/i.test(m)) return 'O servidor atingiu o limite de e-mails. Aguarde alguns minutos.';
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
      <p class="g-note">Depois do cadastro, escolha a obra e peça acesso. O gestor da obra libera como Equipe ou Visitante.</p>
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
      if (error) msg(traduz(error)); else { history.replaceState(null, '', location.pathname + location.search); iniciar(); }
    };
  }
  gate.addEventListener('click', e => {
    const a = e.target.closest('[data-g]'); if (!a) return; e.preventDefault();
    const g = a.dataset.g;
    if (g === 'cadastro') telaCadastro(); else if (g === 'esqueci') telaEsqueci(); else if (g === 'sair') sair(); else if (g === 'portal') irPara(''); else telaEntrar();
  });
  async function sair() { await sb.auth.signOut(); location.href = location.pathname; }

  /* ---------------- portal: cartões das obras ---------------- */
  // "ver como": o desenvolvedor simula gestor, equipe ou visitante dentro de uma obra (só a tela muda)
  let VER = null; try { VER = sessionStorage.getItem('sup_vercomo') || null; } catch (e) {}
  const VER_NOME = {gestor: 'Gestor da obra', equipe: 'Equipe', diretoria: 'Visitante'};
  const ehDev = () => !!(ME && ME.dev);
  const souDev = () => ehDev() && !(OBRA && VER && VER_NOME[VER]);
  const gestorReal = () => !ehDev() && !!OBRA && MEUS[OBRA.id] === 'gestor';
  let VER_ATIVO = false;
  const papelEm = id => souDev() ? 'gestor' : (MEUS[id] || null);
  async function carregarObras() {
    const [o, m] = await Promise.all([sb.from('obras').select('*').order('ordem').order('nome'), sb.from('membros').select('obra,papel').eq('usuario', ME.id)]);
    if (o.error) throw o.error;
    OBRAS = o.data || []; MEUS = Object.fromEntries((m.data || []).map(x => [x.obra, x.papel]));
  }
  async function portal(aviso) {
    let pend = {};
    try { const {data} = await sb.rpc('pendentes_por_obra'); (data || []).forEach(r => { pend[r.obra] = r.n; }); } catch (e) {}
    const btn = o => {
      const p = papelEm(o.id);
      if (souDev() || ACESSA.includes(p)) return `<button class="g-btn" type="button" data-entrar="${esc(o.id)}">Entrar</button>`;
      if (p === 'pendente') return '<span class="g-tag">Aguardando o gestor liberar</span>';
      if (p === 'bloqueado') return '<span class="g-tag err">Acesso bloqueado</span>';
      return `<button class="g-btn ghost" type="button" data-pedir="${esc(o.id)}">Pedir acesso</button>`;
    };
    const papTxt = o => souDev() ? 'Desenvolvedor' : (MEUS[o.id] ? PAPEL[MEUS[o.id]] : '');
    showGate(`<div class="g-portal">
      <p class="g-note" style="margin:0 0 10px">Olá, <b>${esc((ME.nome || ME.email).split(' ')[0])}</b>. Escolha a supervisão.</p>
      ${aviso ? `<div class="g-msg err">${esc(aviso)}</div>` : ''}
      <div class="g-obras">${OBRAS.map(o => `<article class="g-obra">
        <div class="g-obra-h"><b>${esc(o.nome)}</b>${pend[o.id] ? `<span class="g-badge" title="Pedidos de acesso aguardando">${pend[o.id]}</span>` : ''}</div>
        <div class="g-obra-s">${esc(o.sub || '')}</div><div class="g-obra-s">${esc(o.local || '')}</div>
        <div class="g-obra-p">${esc(papTxt(o))}</div>
        <div class="g-obra-a">${btn(o)}${papelEm(o.id) === 'gestor' ? `<button class="g-btn ghost" type="button" data-membros="${esc(o.id)}">Usuários</button>` : ''}</div>
      </article>`).join('')}</div>
      ${souDev() ? '<div class="g-links" style="justify-content:flex-start;gap:16px"><a href="#" data-novaobra>+ Nova obra</a></div>' : ''}
      <div class="g-links"><a href="#" data-g="sair">Sair · ${esc(ME.email)}</a></div>
    </div>`, true);
  }
  gate.addEventListener('click', async e => {
    const en = e.target.closest('[data-entrar]'); if (en) { irPara(en.dataset.entrar); return; }
    const pe = e.target.closest('[data-pedir]'); if (pe) {
      pe.disabled = true; pe.textContent = 'Enviando…';
      const {error} = await sb.from('membros').insert({obra: pe.dataset.pedir, usuario: ME.id, papel: 'pendente'});
      if (error) { pe.textContent = 'Não foi possível'; return; }
      MEUS[pe.dataset.pedir] = 'pendente'; portal(); return;
    }
    const mb = e.target.closest('[data-membros]'); if (mb) { abrirUsuarios(mb.dataset.membros); return; }
    if (e.target.closest('[data-novaobra]')) { e.preventDefault(); novaObra(); }
  });
  function novaObra() {
    const d = $('#dlg');
    d.innerHTML = `<div class="box" style="max-width:520px"><div class="bh"><h3>Nova obra</h3><button class="x" data-ux aria-label="Fechar">×</button></div>
      <form id="no_form" class="form"><div class="fgrid">
        <label class="f">Código (sem espaço)<input id="no_id" required pattern="[a-z0-9-]{2,40}" placeholder="ex.: br-232"></label>
        <label class="f">Nome<input id="no_nome" required placeholder="ex.: BR-232"></label>
        <label class="f" style="grid-column:1/-1">Descrição<input id="no_sub" placeholder="ex.: Duplicação · Contrato 12/2026"></label>
        <label class="f">Local<input id="no_local" placeholder="Cidade – UF"></label>
        <label class="f">Ordem<input id="no_ord" type="number" value="${OBRAS.length}"></label>
      </div><div class="ra"><button class="btn" type="submit">Criar</button><span id="no_st" class="status"></span></div></form></div>`;
    d.hidden = false;
    $('#no_form').onsubmit = async ev => {
      ev.preventDefault();
      const {error} = await sb.from('obras').insert({id: $('#no_id').value.trim(), nome: $('#no_nome').value.trim(), sub: $('#no_sub').value.trim(), local: $('#no_local').value.trim(), ordem: +$('#no_ord').value || 0});
      if (error) { $('#no_st').className = 'status err'; $('#no_st').textContent = error.message; return; }
      d.hidden = true; d.innerHTML = ''; await carregarObras(); portal();
    };
  }

  /* ---------------- usuários da obra (gestor / desenvolvedor) ---------------- */
  async function abrirUsuarios(obraId) {
    const o = OBRAS.find(x => x.id === obraId) || OBRA || {id: obraId, nome: obraId};
    const d = $('#dlg');
    d.innerHTML = `<div class="box"><div class="bh"><div><div class="eyebrow">${esc(o.nome)}</div><h3>Usuários da obra</h3></div><button class="x" data-ux aria-label="Fechar">×</button></div><div id="u_list" class="note">Carregando…</div></div>`;
    d.hidden = false; document.body.style.overflow = 'hidden';
    const {data: ms, error} = await sb.from('membros').select('usuario,papel,criado').eq('obra', obraId).order('criado');
    if (error) { $('#u_list').textContent = 'Não foi possível carregar: ' + error.message; return; }
    const ids = ms.map(m => m.usuario);
    const {data: ps} = ids.length ? await sb.from('perfis').select('id,nome,email').in('id', ids) : {data: []};
    const P = Object.fromEntries((ps || []).map(p => [p.id, p]));
    const ord = {pendente: 0, gestor: 1, equipe: 2, diretoria: 3, bloqueado: 4};
    ms.sort((a, b) => (ord[a.papel] - ord[b.papel]) || String((P[a.usuario] || {}).nome).localeCompare(String((P[b.usuario] || {}).nome)));
    const opcoes = atual => Object.entries(PAPEL).filter(([k]) => souDev() || k !== 'gestor' || atual === 'gestor').map(([k, n]) => `<option value="${k}"${k === atual ? ' selected' : ''}>${n}</option>`).join('');
    $('#u_list').innerHTML = `<div class="u-grid">${ms.map(m => { const p = P[m.usuario] || {}; const trava = m.usuario === ME.id || (m.papel === 'gestor' && !souDev()); return `
      <div class="u-row${m.papel === 'pendente' ? ' pend' : ''}">
        <div><b>${esc(p.nome || '—')}</b><div class="muted" style="font-size:12.5px">${esc(p.email || '')} · desde ${esc(String(m.criado).slice(0, 10).split('-').reverse().join('/'))}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <select data-uobra="${esc(obraId)}" data-uid="${esc(m.usuario)}" ${trava ? 'disabled' : ''}>${opcoes(m.papel)}</select>
          ${trava ? '' : `<button class="btn ghost sm" type="button" data-utira="${esc(m.usuario)}" data-uobra="${esc(obraId)}">Remover</button>`}
        </div></div>`; }).join('') || '<div class="muted">Ninguém nesta obra ainda.</div>'}</div>
      <form id="u_add" class="fgrid" style="margin-top:14px;align-items:end"><label class="f" style="grid-column:span 2">Adicionar pelo e-mail (a pessoa já precisa ter criado a conta)<input id="u_email" type="email" required placeholder="nome@empresa.com.br"></label>
        <label class="f">Como<select id="u_pap">${opcoes('equipe')}</select></label><button class="btn" type="submit">Adicionar</button></form>
      <p class="note" style="margin-top:12px">Equipe vê e edita tudo da obra. Visitante vê avanço, mapas, cronograma, fotos e projetos, sem pendências, lançamentos e orçamentos. Aguardando aprovação e Bloqueado não veem nada. ${souDev() ? 'Só você (desenvolvedor) define quem é Gestor.' : 'Só o desenvolvedor define gestores.'}</p>
      <div id="u_msg" class="status"></div>`;
    $('#u_add').onsubmit = async ev => {
      ev.preventDefault(); const st = $('#u_msg');
      const {data, error: e2} = await sb.rpc('adicionar_por_email', {o: obraId, e: $('#u_email').value, pp: $('#u_pap').value});
      if (e2) { st.className = 'status err'; st.textContent = e2.message; return; }
      if (data === 'nao_cadastrado') { st.className = 'status err'; st.textContent = 'Este e-mail ainda não criou conta. Peça para a pessoa clicar em "Criar conta" primeiro.'; return; }
      abrirUsuarios(obraId);
    };
  }
  document.addEventListener('change', async e => {
    const vc = e.target.closest('select[data-vercomo]'); if (vc) { try { if (vc.value) sessionStorage.setItem('sup_vercomo', vc.value); else sessionStorage.removeItem('sup_vercomo'); } catch (er) {} location.reload(); return; }
    const s = e.target.closest('select[data-uid][data-uobra]'); if (!s) return;
    const st = $('#u_msg'); s.disabled = true;
    const {error} = await sb.from('membros').update({papel: s.value, atualizado: new Date().toISOString(), por: ME.id}).eq('obra', s.dataset.uobra).eq('usuario', s.dataset.uid);
    s.disabled = false;
    if (st) { st.className = 'status ' + (error ? 'err' : 'ok'); st.textContent = error ? 'Não salvou: ' + error.message : 'Acesso atualizado.'; }
  });
  document.addEventListener('click', async e => {
    if (e.target.closest('[data-ux]')) { const d = $('#dlg'); d.hidden = true; d.innerHTML = ''; document.body.style.overflow = ''; }
    const t = e.target.closest('[data-utira]'); if (t) {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = 'Confirmar'; return; }
      const {error} = await sb.from('membros').delete().eq('obra', t.dataset.uobra).eq('usuario', t.dataset.utira);
      if (error) { t.textContent = 'Sem permissão'; return; } abrirUsuarios(t.dataset.uobra);
    }
    if (e.target.closest('[data-usuarios]')) abrirUsuarios(OBRA.id);
    if (e.target.closest('[data-minhasenha]')) minhaSenha();
    if (e.target.closest('[data-backup]')) fazerBackup(e.target.closest('[data-backup]'));
    if (e.target.closest('[data-sair]')) sair();
    if (e.target.closest('[data-portal]')) irPara('');
    if (e.target.closest('[data-vercomosair]')) { e.preventDefault(); try { sessionStorage.removeItem('sup_vercomo'); } catch (er) {} location.reload(); }
  });
  function minhaSenha() {
    const d = $('#dlg');
    d.innerHTML = `<div class="box" style="max-width:420px"><div class="bh"><h3>Minha senha</h3><button class="x" data-ux aria-label="Fechar">×</button></div>
      <form id="ms_form" class="form"><label class="f">Nova senha (mínimo 8 caracteres)<input id="ms_pass" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="f">Repita a nova senha<input id="ms_pass2" type="password" autocomplete="new-password" minlength="8" required></label>
      <div class="ra"><button class="btn" type="submit">Salvar</button><span id="ms_st" class="status"></span></div></form></div>`;
    d.hidden = false; document.body.style.overflow = 'hidden';
    $('#ms_form').onsubmit = async ev => {
      ev.preventDefault(); const st = $('#ms_st');
      if ($('#ms_pass').value !== $('#ms_pass2').value) { st.className = 'status err'; st.textContent = 'As senhas não são iguais.'; return; }
      const {error} = await sb.auth.updateUser({password: $('#ms_pass').value});
      st.className = 'status ' + (error ? 'err' : 'ok'); st.textContent = error ? traduz(error) : 'Senha alterada.';
    };
  }

  /* ---------------- adaptador de banco (sempre dentro da obra aberta) ---------------- */
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
  const erro = e => {
    const c = e && e.code;
    if (c === '42501' || /row-level security|permission/i.test((e && e.message) || '')) return {code: 'not_granted', message: 'sem permissão'};
    if (c === 'PGRST301' || /JWT/i.test((e && e.message) || '')) return {code: 'revoked', message: 'sessão expirada'};
    return {code: 'unavailable', message: (e && e.message) || 'erro'};
  };
  const snapOf = rows => ({docs: rows.map(r => ({id: r.id, exists: true, data: () => r.data})), empty: !rows.length, size: rows.length});
  const watchers = new Map(); let canal = null; const timers = {};
  function ouvir(colecao, fn) {
    if (!watchers.has(colecao)) watchers.set(colecao, new Set());
    watchers.get(colecao).add(fn);
    if (!canal) {
      canal = sb.channel('reg-' + OBRA.id + '-' + rid())
        .on('postgres_changes', {event: '*', schema: 'public', table: 'registros', filter: 'obra=eq.' + OBRA.id}, p => {
          const c = (p.new && p.new.colecao) || (p.old && p.old.colecao);
          const alvo = c ? [c] : [...watchers.keys()];
          alvo.forEach(k => { clearTimeout(timers[k]); timers[k] = setTimeout(() => (watchers.get(k) || []).forEach(f => f()), 150); });
        }).subscribe();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) watchers.forEach(set => set.forEach(f => f())); });
    }
    return () => { const s = watchers.get(colecao); if (s) s.delete(fn); };
  }
  class Doc {
    constructor(c, id) { this.c = c; this.id = id; this.path = c + '/' + id; }
    async get() {
      const {data, error} = await sb.from('registros').select('id,data').eq('obra', OBRA.id).eq('colecao', this.c).eq('id', this.id).maybeSingle();
      if (error) throw erro(error);
      return {id: this.id, exists: !!data, data: () => (data ? data.data : undefined)};
    }
    async set(obj) { const {error} = await sb.from('registros').upsert({obra: OBRA.id, colecao: this.c, id: this.id, data: obj, atualizado: new Date().toISOString()}); if (error) throw erro(error); }
    async update(patch) { const {error} = await sb.rpc('registro_mesclar', {p_obra: OBRA.id, p_colecao: this.c, p_id: this.id, p_patch: patch}); if (error) throw erro(error); }
    async delete() { const {error} = await sb.from('registros').delete().eq('obra', OBRA.id).eq('colecao', this.c).eq('id', this.id); if (error) throw erro(error); }
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
      for (;;) {
        const {data, error} = await sb.from('registros').select('id,data').eq('obra', OBRA.id).eq('colecao', this.c).order('criado').range(de, de + 999);
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
  const DB = Object.freeze({collection: p => new Col(String(p)), doc: p => { const i = String(p).indexOf('/'); return new Doc(p.slice(0, i), p.slice(i + 1)); }});

  /* ---------------- arquivos (pasta da obra) ---------------- */
  const EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'application/json': 'json', 'text/html': 'html'};
  const podeEditar = () => souDev() || ['equipe', 'gestor'].includes(PAPEL_OBRA);
  const souGestor = () => souDev() || PAPEL_OBRA === 'gestor';
  const ASSETS = Object.freeze({
    async upload(blob) {
      if (blob.size > 20 * 1024 * 1024) throw {code: 'too_large', message: 'arquivo maior que 20 MB'};
      const tipo = blob.type || 'application/octet-stream';
      const nome = OBRA.id + '/' + new Date().toISOString().slice(0, 7) + '/' + rid() + rid() + '.' + (EXT[tipo] || 'bin');
      const {error} = await sb.storage.from('arquivos').upload(nome, blob, {contentType: tipo, upsert: false, cacheControl: '31536000'});
      if (error) throw (/row-level|security|not authorized/i.test(error.message || '') ? {code: 'not_granted', message: 'sem permissão de envio'} : {code: 'unavailable', message: error.message});
      return {id: nome, url: window.BLOB + nome, sizeBytes: blob.size, contentType: tipo};
    },
    async list() { return {assets: [], usage: null}; },
    async delete(id) { const {error} = await sb.storage.from('arquivos').remove([id]); if (error) throw erro(error); }
  });
  const nomes = {};
  const USER = Object.freeze({
    id: async () => ME.id,
    me: async () => ({id: ME.id, name: ME.nome || ME.email, guest: false}),
    isOwner: async () => souGestor(),
    canEdit: async () => souGestor(),
    can: async n => (n === 'data.write' ? podeEditar() : null),
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
      if (nome === 'assets') return podeEditar() ? ASSETS : null;
      return null;
    }
  });

  /* ---------------- dados do contrato da obra ---------------- */
  let arquivoDados = '';
  const VAZIO = o => ({D: {meta: {contrato: o.contrato || '', objeto: o.sub || o.nome, local: o.local || '', contratada: '', bm: 0, periodo: '', total: 0, ant: 0, per: 0, acum: 0, saldo: 0, kuula: ''},
    zones: [], bms: [], recs: [], geos: {}, overview: {vb: [0, 0, 100, 100], roads: {}, ctx: {}, lab: {}}, secoes: {}, perfis: {}, plans: {}, crono: {nome: '', tasks: []}}, CICLO: {}, DREN: {}});
  async function carregarDados() {
    try {
      const {data: cfg} = await sb.from('registros').select('data').eq('obra', OBRA.id).eq('colecao', 'config').eq('id', 'dados').maybeSingle();
      if (cfg && cfg.data && cfg.data.arquivo) arquivoDados = cfg.data.arquivo;
    } catch (e) {}
    if (!arquivoDados) return VAZIO(OBRA);
    const {data, error} = await sb.storage.from('privado').download(arquivoDados);
    if (error) throw new Error('dados do contrato indisponíveis (' + error.message + ')');
    const j = JSON.parse(await data.text());
    Object.values((j.D && j.D.plans) || {}).forEach(p => { if (p.img && !/^https?:/.test(p.img)) p.img = window.BLOB + p.img; });
    return j;
  }
  window.PAINEL_API = Object.freeze({
    async equipe() {
      const {data, error} = await sb.rpc('equipe_da_obra', {o: OBRA.id});
      if (error) throw new Error(error.message);
      return (data || []).filter(p => p.papel !== 'diretoria').map(p => ({id: p.id, nome: p.nome || p.email || '', email: p.email})).sort((a, b) => a.nome.localeCompare(b.nome));
    },
    async salvarDados(pacote, bm) {
      if (!souGestor()) throw new Error('apenas o gestor da obra');
      const nome = `${OBRA.id}/dados-bm${String(bm).padStart(2, '0')}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}.json`;
      const {error} = await sb.storage.from('privado').upload(nome, new Blob([JSON.stringify(pacote)], {type: 'application/json'}), {contentType: 'application/json', upsert: false});
      if (error) throw new Error(error.message);
      const {error: e2} = await sb.from('registros').upsert({obra: OBRA.id, colecao: 'config', id: 'dados', data: {arquivo: nome, anterior: arquivoDados, bm, em: new Date().toISOString(), por: ME.id}, atualizado: new Date().toISOString()});
      if (e2) throw new Error(e2.message);
      return nome;
    },
    arquivoDados: () => arquivoDados,
    // arquivos privados da obra (modelo 3D, planilhas): só membros leem, só gestor envia
    async lerPrivado(nome) { const {data, error} = await sb.storage.from('privado').download(OBRA.id + '/' + nome); if (error) throw new Error(error.message); return data; },
    async enviarPrivado(nome, blob) { if (!souGestor()) throw new Error('apenas o gestor da obra'); const {error} = await sb.storage.from('privado').upload(OBRA.id + '/' + nome, blob, {contentType: blob.type || 'application/octet-stream', upsert: true}); if (error) throw new Error(error.message); return true; },
    obra: () => OBRA, papel: () => (souDev() ? 'dev' : PAPEL_OBRA), podeEditar, souGestor
  });

  /* ---------------- cópia de segurança da obra (gestor) ---------------- */
  const carregarJs = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('não carregou ' + src)); document.head.appendChild(s); });
  async function listarTudo(bucket, prefixo) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      const {data, error} = await sb.storage.from(bucket).list(prefixo, {limit: 1000, offset: de, sortBy: {column: 'name', order: 'asc'}});
      if (error) throw error;
      for (const it of data) { const c = prefixo ? prefixo + '/' + it.name : it.name; if (it.id == null) out.push(...await listarTudo(bucket, c)); else out.push(c); }
      if (data.length < 1000) break;
    }
    return out;
  }
  async function fazerBackup(btn) {
    if (btn.dataset.busy) return; btn.dataset.busy = '1';
    const rot = t => { btn.textContent = t; };
    try {
      rot('Preparando…'); if (!window.JSZip) await carregarJs('jszip.min.js');
      const zip = new window.JSZip(), hoje = new Date().toISOString().slice(0, 10), regs = [];
      for (let de = 0; ; de += 1000) { const {data, error} = await sb.from('registros').select('obra,colecao,id,data,autor,criado,atualizado').eq('obra', OBRA.id).order('criado').range(de, de + 999); if (error) throw error; regs.push(...data); if (data.length < 1000) break; }
      zip.file('dados/registros.json', JSON.stringify(regs, null, 1));
      const priv = await listarTudo('privado', OBRA.id);
      for (const a of priv) { const {data} = await sb.storage.from('privado').download(a); if (data) zip.file('privado/' + a, data); }
      const arqs = await listarTudo('arquivos', OBRA.id); let n = 0;
      for (const a of arqs) { n++; rot(`Fotos ${n}/${arqs.length}…`); try { const r = await fetch(window.BLOB + a.split('/').map(encodeURIComponent).join('/')); if (r.ok) zip.file('arquivos/' + a, await r.blob()); } catch (e) {} }
      rot('Compactando…');
      const blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `backup-${OBRA.id}-${hoje}.zip`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000); rot('Cópia baixada ✓');
    } catch (e) { rot('Falhou: ' + ((e && e.message) || 'erro').slice(0, 40)); }
    setTimeout(() => { delete btn.dataset.busy; btn.textContent = 'Cópia de segurança'; }, 6000);
  }
  function barraConta() {
    const r = document.querySelector('.band .right'); if (!r || $('#contaPills')) return;
    const span = document.createElement('span'); span.id = 'contaPills'; span.style.display = 'contents';
    span.innerHTML = '<button class="pill" data-portal style="cursor:pointer" title="Voltar aos cartões das obras">◂ Obras</button>' +
      (ehDev() || gestorReal() ? `<label class="pill" style="cursor:pointer;display:inline-flex;gap:6px;align-items:center" title="Veja a obra como outra pessoa veria (só a tela muda)">Ver como<select data-vercomo style="background:transparent;color:inherit;border:0;font:inherit;cursor:pointer">${(ehDev() ? [['', 'Desenvolvedor'], ['gestor', 'Gestor da obra'], ['equipe', 'Equipe'], ['diretoria', 'Visitante']] : [['', 'Gestor (você)'], ['equipe', 'Equipe'], ['diretoria', 'Visitante']]).map(([k, n]) => `<option value="${k}"${(VER_ATIVO ? VER : '') === k ? ' selected' : ''} style="color:#000">${n}</option>`).join('')}</select></label>` : '') +
      (souGestor() ? '<button class="pill" data-usuarios style="cursor:pointer">Usuários</button><button class="pill" data-backup style="cursor:pointer" title="Baixa um .zip com os dados e arquivos desta obra">Cópia de segurança</button>' : '') +
      '<button class="pill" data-minhasenha style="cursor:pointer">Minha senha</button>' +
      `<button class="pill" data-sair style="cursor:pointer" title="${esc(ME.email)}">Sair · ${esc((ME.nome || ME.email).split(' ')[0])}</button>`;
    r.appendChild(span);
  }

  /* ---------------- início ---------------- */
  async function iniciar() {
    const {data: {session}} = await sb.auth.getSession();
    if (!session) return telaEntrar();
    const {data: perfil, error} = await sb.from('perfis').select('id,email,nome,dev').eq('id', session.user.id).maybeSingle();
    if (error) return telaEntrar('Não foi possível ler seu perfil: ' + error.message);
    ME = perfil || {id: session.user.id, email: session.user.email, nome: '', dev: false};
    try { await carregarObras(); } catch (e) { return showGate(`<p class="g-wait">Não foi possível carregar as obras (${esc(e.message || e)}).</p><div class="g-links"><a href="#" data-g="sair">Sair</a></div>`); }
    const id = obraParam();
    if (!id) return portal();
    OBRA = OBRAS.find(o => o.id === id);
    if (!OBRA) return portal('Obra não encontrada.');
    PAPEL_OBRA = MEUS[id] || null;
    if (VER && VER_NOME[VER] && (ehDev() || (PAPEL_OBRA === 'gestor' && VER !== 'gestor'))) { PAPEL_OBRA = VER; VER_ATIVO = true; }
    if (!ehDev() && !ACESSA.includes(PAPEL_OBRA)) return portal(PAPEL_OBRA === 'pendente' ? 'Seu pedido de acesso a ' + OBRA.nome + ' ainda não foi liberado.' : 'Você não tem acesso a ' + OBRA.nome + '.');
    if (started) { hideGate(); return; }
    showGate(`<p class="g-wait">Carregando ${esc(OBRA.nome)}…</p>`);
    window.__OBRA = OBRA;
    document.title = OBRA.nome + ' · Supervisões ENTEL';
    const eb = $('.band .eyebrow'), h1 = $('.band h1');
    if (eb) eb.textContent = [OBRA.sub, OBRA.local].filter(Boolean).join(' · ');
    if (h1) h1.textContent = OBRA.nome;
    try { window.__DADOS = await carregarDados(); }
    catch (e) { showGate(`<p class="g-wait">${esc(e.message)}</p><div class="g-links"><a href="#" data-g="portal">Voltar às obras</a><a href="#" data-g="sair">Sair</a></div>`); return; }
    started = true;
    const mod = (OBRA.config || {}).modulo;
    const carrega = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src + '?v=' + (CFG.versao || '1'); s.onload = ok; s.onerror = no; document.body.appendChild(s); });
    try {
      if (mod && mod !== 'ramal') { try { await carrega('obras/' + mod + '.js'); } catch (e) {} }
      await carrega('painel.js');
      hideGate(); barraConta();
      if (VER_ATIVO) { const v = document.createElement('div'); v.className = 'teste-faixa'; v.style.background = '#5aaee8'; v.innerHTML = `VOCÊ ESTÁ VENDO COMO <b>${esc(VER_NOME[VER].toUpperCase())}</b> · só a tela muda · <a href="#" data-vercomosair>voltar para ${ehDev() ? 'desenvolvedor' : 'gestor'}</a>`; document.body.prepend(v); }
      if (CFG.teste) { const t = document.createElement('div'); t.className = 'teste-faixa'; t.innerHTML = 'VERSÃO DE TESTE · Supervisões (banco de testes separado)'; document.body.prepend(t); }
    } catch (e) { showGate('<p class="g-wait">Falha ao carregar o painel. Recarregue a página.</p>'); }
  }
  sb.auth.onAuthStateChange(ev => {
    if (ev === 'PASSWORD_RECOVERY') telaNovaSenha();
    if (ev === 'SIGNED_OUT' && started) location.href = location.pathname;
  });
  if (/type=recovery/.test(location.hash)) telaNovaSenha(); else iniciar();
})();
