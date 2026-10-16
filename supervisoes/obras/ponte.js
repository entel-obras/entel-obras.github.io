/* =====================================================================
   Módulo da obra Ponte Preta · modelo 3D/4D/5D (painel original da obra)
   - o modelo fica no bucket PRIVADO da obra (privado/ponte-preta/modelo.html):
     só quem tem acesso à obra consegue abrir; não fica no GitHub
   - roda num quadro (iframe) dentro da Visão geral, sem nada retirado
   - o que o modelo guardava "no navegador" (histórico, cronograma real,
     registros) passa a ser salvo no banco da obra, para toda a equipe
   ===================================================================== */
(function () {
  'use strict';
  const API = window.PAINEL_API;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  let topo = null, carregado = false, db = null;
  const LS = {cache: {}, t: {}};
  // armazenamento do modelo -> banco (coleção modelo_ls, um registro por chave)
  window.PONTE_LS = {
    get: k => (k in LS.cache ? LS.cache[k] : null),
    set: (k, v) => { LS.cache[k] = v; clearTimeout(LS.t[k]); LS.t[k] = setTimeout(() => { if (db && API.podeEditar()) db.doc('modelo_ls/' + encodeURIComponent(k)).set({v, em: new Date().toISOString()}).catch(() => {}); }, 600); },
    del: k => { delete LS.cache[k]; if (db && API.podeEditar()) db.doc('modelo_ls/' + encodeURIComponent(k)).delete().catch(() => {}); },
    keys: () => Object.keys(LS.cache)
  };
  const SHIM = '<script>(function(){var P=null;try{P=parent&&parent.PONTE_LS}catch(e){}if(!P)return;var st={getItem:function(k){return P.get(String(k))},setItem:function(k,v){P.set(String(k),String(v))},removeItem:function(k){P.del(String(k))},clear:function(){P.keys().forEach(function(k){P.del(k)})},key:function(i){return P.keys()[i]||null}};Object.defineProperty(st,"length",{get:function(){return P.keys().length}});try{Object.defineProperty(window,"localStorage",{value:st,configurable:true})}catch(e){}})();<\/script>';
  function moldura() {
    if (topo) return topo;
    topo = document.createElement('section'); topo.id = 'obraTopo'; topo.className = 'wrap'; topo.hidden = true;
    topo.innerHTML = `<div class="card" style="margin-top:14px"><div class="card-h"><h2>Modelo 3D / 4D / 5D</h2><span class="sp" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="chip" type="button" data-pmtela>Tela cheia</button>${API.souGestor() ? '<label class="chip" style="cursor:pointer" title="Troca o modelo (arquivo .html)">Enviar nova versão<input type="file" id="pm_file" accept=".html,text/html" hidden></label>' : ''}</span></div>
      <div id="pmBox" style="position:relative;height:min(78vh,820px);border-radius:10px;overflow:hidden;background:#0b1d1c"><div class="empty-note" id="pmMsg" style="position:absolute;inset:0;display:grid;place-items:center">Carregando o modelo…</div></div>
      <p class="note" id="pmNota">Painel original da obra, sem alterações. O histórico e os registros feitos no modelo ficam salvos para toda a equipe da obra.</p></div>`;
    const main = document.getElementById('main'); main.parentNode.insertBefore(topo, main);
    topo.addEventListener('click', e => { if (e.target.closest('[data-pmtela]')) { const f = topo.querySelector('iframe'); if (f && f.requestFullscreen) f.requestFullscreen(); } });
    topo.addEventListener('change', async e => {
      if (e.target.id !== 'pm_file' || !e.target.files[0]) return;
      const f = e.target.files[0], m = topo.querySelector('#pmNota'); m.textContent = 'Enviando ' + f.name + '…';
      try { await API.enviarPrivado('modelo.html', new Blob([await f.arrayBuffer()], {type: 'text/html'})); m.textContent = 'Modelo atualizado.'; carregado = false; carregar(); }
      catch (er) { m.textContent = 'Não foi possível enviar: ' + er.message; }
      e.target.value = '';
    });
    return topo;
  }
  async function carregar() {
    if (carregado) return; carregado = true;
    const box = topo.querySelector('#pmBox'), msg = topo.querySelector('#pmMsg');
    try {
      db = await window.claude.use('db');
      try { const snap = await db.collection('modelo_ls').get(); snap.docs.forEach(d => { const v = d.data(); if (v && typeof v.v === 'string') LS.cache[decodeURIComponent(d.id)] = v.v; }); } catch (e) {}
      const blob = await API.lerPrivado('modelo.html');
      let html = await blob.text();
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + SHIM) : SHIM + html;
      const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
      const fr = document.createElement('iframe');
      fr.src = url; fr.title = 'Modelo 3D/4D/5D da Ponte Preta'; fr.allow = 'fullscreen'; fr.setAttribute('allowfullscreen', '');
      fr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      box.querySelectorAll('iframe').forEach(x => x.remove()); box.appendChild(fr);
      fr.onload = () => { if (msg) msg.remove(); };
    } catch (e) {
      carregado = false;
      if (msg) msg.innerHTML = /not.?found|Object not found|404/i.test(e.message || '') ? `Modelo 3D ainda não foi enviado para esta obra.${API.souGestor() ? '<br>Use "Enviar nova versão" acima.' : ''}` : 'Não foi possível abrir o modelo: ' + esc(e.message);
    }
  }
  window.OBRA_MOD = {
    geral: () => '',
    tab: t => { moldura().hidden = t !== 'geral'; if (t === 'geral') carregar(); }
  };
})();
