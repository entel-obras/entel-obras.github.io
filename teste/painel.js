const D = window.__DADOS.D;
const CICLO = window.__DADOS.CICLO;
const DREN = window.__DADOS.DREN;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BRL = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const BRLm = v => 'R$ ' + ((v || 0) / 1e6).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' mi';
const PCT = (v, d = 1) => (v * 100).toLocaleString('pt-BR', {minimumFractionDigits: d, maximumFractionDigits: d}) + '%';
const NUM = (v, d = 2) => (v || 0).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: d});
const SVGNS = 'http://www.w3.org/2000/svg';

/* ---------- stakes ---------- */
function estStr(m) {
  const k = Math.floor(m / 20 + 1e-9), r = Math.round((m - k * 20) * 100) / 100;
  return r ? `${k}+${String(r).replace('.', ',')}` : `${k}`;
}
function parseEst(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/^est\.?\s*/i, '').replace(',', '.');
  if (!t) return NaN;
  const m = t.match(/^(\d+)(?:\s*\+\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return NaN;
  return (+m[1]) * 20 + (m[2] ? +m[2] : 0);
}
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const wd = iso => WD[new Date(iso + 'T12:00:00').getDay()];

/* ---------- fronts ---------- */
const FRONT_KEYS = ['ramal', 'e5000', 'e7000', 'e10000', 'cbarra'];
const Z = Object.fromEntries(D.zones.map(z => [z.key, z]));
const PHOTO_POINTS = {cbarra: [0, 100, 200, 300, 400, 500], e5000: [100000, 100100, 100200, 100300, 100380], ramal: [0, 400, 800, 1200, 1600, 2000], e10000: [0, 100, 200, 2000, 2100, 2200, 2300]};
const LEN = {cbarra: 531.35, e5000: 387.5, ramal: 2031.9};
const DOM = {cbarra: [[0, 531.35]], ramal: [[0, 2031.9]], e5000: [[100000, 100387.5], [280000, 280084.58]]};
const MODE = 'admin';
const BMN = D.meta.bm;
/* ---------- perfis de acesso ----------
   equipe    = Colaborador/Editor no compartilhamento: vê e edita tudo
   diretoria = Leitor/Comentarista: não vê pendências, NCs, espinha de peixe,
               serviços sem avanço, o que falta e lançamentos de campo.
   O bloqueio real está nas regras do banco (rnc, sem_avanco, faltas, lancamentos
   exigem nível 'interact'); a tela só acompanha. Antes de saber quem é, fica restrito. */
const DIR_HIDE = ['pend', 'lancar', 'diario'];
let PREVIEW = false; try { PREVIEW = localStorage.getItem('ra_preview') === '1'; } catch (e) {}
const isDir = () => S.role !== 'equipe' || PREVIEW;
const KUULA = [['L68qJ','DJI_0308'],['L68qK','DJI_0309'],['L68q1','DJI_0310'],['L68qD','DJI_0311'],['L68qM','DJI_0312'],['L68qT','DJI_0313'],['L68qd','DJI_0319']];
const kuulaUrl = p => /^https?:/.test(p) ? p : `https://kuula.co/post/${p}/collection/7d0mq`;
const kuulaName = p => { const k = KUULA.find(x => x[0] === p); return k ? k[1] : 'Panorama'; };
const inDom = (key, r) => !DOM[key] || DOM[key].some(d => r.fim >= d[0] - 1 && r.ini <= d[1] + 1);
const recsOf = key => D.recs.filter(r => r[0].split('.')[0] === Z[key].code && (!S.tl || r[1] <= S.tl)).map(r => ({item: r[0], bm: r[1], ini: r[2], fim: r[3], txt: r[4], obs: r[5], lado: r[6], q: r[7]}));
const itemName = code => { for (const z of D.zones) { const i = z.items.find(x => x.c === code); if (i) return i; } return null; };
const groupOf = code => code.split('.').slice(0, 2).join('.');
const short = s => { s = String(s || ''); const t = s.charAt(0) + s.slice(1).toLowerCase(); return t.length > 92 ? t.slice(0, 90) + '…' : t; };
const title = s => { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ---------- state ---------- */
const S = {
  tab: 'geral', fotos: [], lancs: [], db: null, assets: null, user: null, myId: null, names: {},
  layers: {pav: true, dren: true, mf: true, cal: true, fotos: true, ctx: true},
  stake: null, photoFront: 'cbarra', photoDate: null, ready: false
};
try { const t = localStorage.getItem('ra_tab'); if (t && !(t === 'lancar' && MODE !== 'admin')) S.tab = t; } catch (e) {}

/* ---------- tabs ---------- */
/* abas em dois níveis: grupo (linha de cima) e sub-abas (linha de baixo) */
const NAV = () => [
  {k: 'geral', n: 'Visão geral', tabs: [['geral', 'Visão geral']]},
  {k: 'lancar', n: 'Avanço', tabs: MODE === 'admin' ? [['lancar', 'Avanço']] : []},
  {k: 'trechos', n: 'Trechos', tabs: FRONT_KEYS.map(k => [k, Z[k].name])},
  {k: 'campo', n: 'Campo', tabs: [['diario', 'Diário'], ['fotos', 'Fotos']].concat(typeof viewTour === 'function' ? [['tour', 'Tour 360°']] : [])},
  {k: 'controle', n: 'Controle', tabs: [['pend', 'Pendências'], ['conf', 'Conferência']]},
  {k: 'plan', n: 'Planejamento', tabs: [['crono', 'Cronograma'], ['docs', 'Projetos']]}
].map(g => Object.assign(g, {tabs: g.tabs.filter(([k]) => !(isDir() && DIR_HIDE.includes(k)))})).filter(g => g.tabs.length);
S.navSub = {}; try { S.navSub = JSON.parse(localStorage.getItem('ra_navsub') || '{}') || {}; } catch (e) {}
function renderTabs() {
  renderRole();
  const gs = NAV(), cur = gs.find(g => g.tabs.some(([k]) => k === S.tab)) || gs[0];
  const nOp = (S.rnc || []).filter(r => r.st !== 'fechada').length;
  const badge = (k) => { const z = Z[k]; if (z) return `<span class="pct">${PCT(z.acum / z.total, 0)}</span>`; if (k === 'pend' && nOp) return `<span class="pct" style="color:var(--danger)">${nOp}</span>`; return ''; };
  const top = gs.map(g => `<button class="tab${g.k === 'lancar' ? ' act' : ''}" role="tab" data-grp="${g.k}" aria-selected="${g === cur}">${esc(g.tabs.length === 1 ? g.tabs[0][1] : g.n)}${g.k === 'controle' && nOp ? `<span class="pct" style="color:var(--danger)">${nOp}</span>` : ''}${g.tabs.length > 1 ? '<span class="caret">▾</span>' : ''}</button>`).join('');
  const sub = cur && cur.tabs.length > 1 ? `<div class="subrow" role="tablist" aria-label="${esc(cur.n)}">${cur.tabs.map(([k, n]) => `<button class="stab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${esc(n)}${badge(k)}</button>`).join('')}</div>` : '';
  $('#tabs').innerHTML = `<div class="tabrow">${top}</div>${sub}`;
  document.querySelectorAll('#tabs .tabrow, #tabs .subrow').forEach(row => { const a = row.querySelector('[aria-selected="true"]'); if (a) row.scrollLeft = Math.max(0, a.offsetLeft - row.offsetLeft - (row.clientWidth - a.offsetWidth) / 2); });
  if (cur) { S.navSub[cur.k] = S.tab; try { localStorage.setItem('ra_navsub', JSON.stringify(S.navSub)); } catch (e) {} }
}
$('#tabs').addEventListener('click', e => {
  const t = e.target.closest('[data-tab]'); if (t) { go(t.dataset.tab); return; }
  const g = e.target.closest('[data-grp]'); if (!g) return;
  const grp = NAV().find(x => x.k === g.dataset.grp); if (!grp) return;
  const last = S.navSub[grp.k]; go(grp.tabs.some(([k]) => k === last) ? last : grp.tabs[0][0]);
});
function go(t) {
  S.tab = t; S.stake = null;
  try { localStorage.setItem('ra_tab', t); } catch (e) {}
  renderTabs(); render();
  window.scrollTo({top: 0});
}

/* ---------- render root ---------- */
function render() {
  const m = $('#main');
  if (isDir() && DIR_HIDE.includes(S.tab)) S.tab = 'geral';
  if (S.tab === 'geral') m.innerHTML = viewGeral();
  else if (S.tab === 'fotos') m.innerHTML = viewFotos();
  else if (S.tab === 'lancar') m.innerHTML = viewLancar();
  else if (S.tab === 'crono') m.innerHTML = viewCrono();
  else if (S.tab === 'pend') m.innerHTML = viewPend();
  else if (S.tab === 'conf') m.innerHTML = viewConf();
  else if (S.tab === 'docs') m.innerHTML = viewDocs();
  else if (S.tab === 'diario') m.innerHTML = viewDiario();
  else if (S.tab === 'tour') m.innerHTML = viewTour();
  else if (Z[S.tab]) m.innerHTML = viewFront(S.tab);
  else m.innerHTML = viewGeral();
  afterRender();
}
function afterRender() {
  if (hasMap(S.tab)) drawMap();
  if (D.secoes && D.secoes[S.tab] && $('#perfSvg')) drawPerfil(S.tab);
  if (Z[S.tab]) drawLinear(S.tab);
  if (S.tab === 'geral') drawCurve();
  if (S.tab === 'lancar') { bindForms(); renderBulk(); }
  if (S.tab === 'diario') bindDiario();
  if (S.tab === 'tour') tourInit();
}

/* ---------- overview ---------- */
function meter(a, p, t) {
  const pa = Math.max(0, (a - p) / t * 100), pp = Math.max(0, p / t * 100);
  return `<div class="meter"><i style="width:${pa}%"></i><i class="p" style="width:${pp}%"></i></div>`;
}
function frontRow(z) {
  return `<button class="front" data-go="${z.key}">
    <div><div class="n">${esc(z.name)}</div><div class="d">${esc(z.sub || '')}</div></div>
    <div class="pc">${PCT(tlZ(z).acum / z.total)}</div>
    <div class="d num">${BRLm(tlZ(z).acum)} de ${BRLm(z.total)}${tlZ(z).per ? ` · BM ${S.tl || BMN}: ${BRL(tlZ(z).per)}` : ''}</div>
    ${meter(tlZ(z).acum, tlZ(z).per, z.total)}
  </button>`;
}
function viewGeral() {
  const M = D.meta;
  const nF = S.fotos.length, last = latestDate('cbarra');
  return `
  <section class="kpis" aria-label="Resumo do contrato">
    <div class="kpi"><div class="eyebrow">Executado acumulado</div><div class="v">${PCT(M.acum / M.total)}</div><div class="s num">${BRLm(M.acum)} de ${BRLm(M.total)}</div>${meter(M.acum, M.per, M.total)}</div>
    <div class="kpi"><div class="eyebrow">Medido no BM ${BMN}</div><div class="v">${BRLm(M.per)}</div><div class="s">${PCT(M.per / M.total)} do contrato · ${esc(M.periodo)}</div></div>
    <div class="kpi"><div class="eyebrow">Saldo do contrato</div><div class="v">${BRLm(M.saldo)}</div><div class="s">${PCT(M.saldo / M.total)} a executar</div></div>
    <div class="kpi" data-go="crono" style="cursor:pointer"><div class="eyebrow">Conclusão prevista</div><div class="v">${dBR(D.crono.tasks.find(t => t.id === 67).f)}</div><div class="s">${(() => { const n = daysTo(D.crono.tasks.find(t => t.id === 67).f); return n >= 0 ? 'faltam ' + n + ' dias · ' : ''; })()}${nF} fotos de campo</div></div>
  </section>
  ${isDir() ? '' : attnCard()}
  ${isDir() ? '' : previsaoCard()}
  ${tlCard('geral')}
  ${aditivoCard()}
  <div class="grid g2">
    <section class="card">
      <div class="card-h"><h2>Avanço por frente</h2><span class="sp legend"><span><i class="sw" style="background:var(--accent)"></i>até BM ${BMN - 1}</span><span><i class="sw" style="background:var(--warn)"></i>BM ${BMN}</span></span></div>
      <div class="fronts">${FRONT_KEYS.map(k => frontRow(Z[k])).join('')}
        <div class="sep"></div>
        <div class="eyebrow" style="padding:4px 10px">Itens gerais do contrato</div>
        ${['adm', 'canteiro', 'ilum', 'paisag'].map(k => frontRow(Z[k])).join('')}
      </div>
    </section>
    <div class="grid" style="align-content:start">
      <section class="card">
        <div class="card-h"><h2>Mapa de situação</h2><span class="sp muted" style="font-size:13px">Frentes com traçado · clique para abrir</span></div>
        ${overviewMap()}
      </section>
      <section class="card chart">
        <div class="card-h"><h2>Curva de medição</h2><span class="sp muted" style="font-size:13px">BM 01 a BM ${String(BMN).padStart(2, "0")}</span></div>
        <div id="curve"></div>
      </section>
      <section class="card">
        <div class="card-h"><h2>Conceição da Barra hoje</h2><button class="sp chip" data-go="fotos">Ver fotos por data</button></div>
        ${recentStrip()}
      </section>
    </div>
  </div>`;
}
function recentStrip() {
  const d = latestDate('cbarra');
  if (!d) return `<div class="empty-note">As fotos diárias das estacas 0, 5, 10, 15, 20 e 25 aparecem aqui. Use a aba <b>Lançar</b> para enviar as do dia.</div>`;
  const ps = S.fotos.filter(f => f.frente === 'cbarra' && f.data === d).sort((a, b) => a.est - b.est).slice(0, 6);
  return `<div class="muted" style="font-size:13px;margin-bottom:8px">${wd(d)}, ${dBR(d)}</div><div class="pgrid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));margin-top:0">${ps.map(photoCard).join('')}</div>`;
}
function drawCurve() {
  const el = $('#curve'); if (!el) return;
  const W = 560, H = 250, L = 46, R = 12, T = 14, B = 34;
  const n = D.bms.length; let acc = 0;
  const pts = D.bms.map(b => (acc += b.v, {n: b.n, v: b.v, a: acc / D.meta.total}));
  const x = i => L + (W - L - R) * (i + .5) / n;
  const y = p => T + (H - T - B) * (1 - p);
  const maxV = Math.max(...pts.map(p => p.v));
  const bh = v => (H - T - B) * 0.32 * v / maxV;
  let s = '';
  [0, .25, .5, .75, 1].forEach(g => { s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g * 100}%</text>`; });
  const bw = (W - L - R) / n * .56;
  pts.forEach((p, i) => {
    const h = bh(p.v), last = i === n - 1;
    s += `<rect x="${x(i) - bw / 2}" y="${y(0) - h}" width="${bw}" height="${h}" rx="2" fill="${last ? 'var(--warn)' : 'var(--line-2)'}"><title>BM ${String(p.n).padStart(2, '0')}: ${BRL(p.v)}</title></rect>`;
    s += `<text x="${x(i)}" y="${H - B + 16}" text-anchor="middle">${String(p.n).padStart(2, '0')}</text>`;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.a).toFixed(1)}`).join('');
  s += `<path d="${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)}Z" fill="var(--accent-soft)"/>`;
  s += `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
  pts.forEach((p, i) => { s += `<circle cx="${x(i)}" cy="${y(p.a)}" r="${i === n - 1 ? 4.5 : 2.6}" fill="var(--accent)"><title>BM ${p.n}: acumulado ${PCT(p.a)}</title></circle>`; });
  const lp = pts[n - 1];
  s += `<text x="${x(n - 1) - 8}" y="${y(lp.a) - 10}" text-anchor="end" style="fill:var(--fg);font-weight:600;font-size:12px">${PCT(lp.a)}</text>`;
  s += `<text x="${L}" y="${H - 4}" style="font-size:10px">Linha: acumulado (% do contrato) · Barras: valor medido em cada BM</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva acumulada de medição por boletim">${s}</svg>`;
}

/* ---------- front view ---------- */
function viewFront(key) {
  const z = Z[key];
  const withMap = hasMap(key);
  const recs = recsOf(key);
  const groups = z.groups;
  return `
  <section class="fh">
    <div><div class="eyebrow">${key === 'cbarra' ? 'Zona 05' : esc(z.full.split(':')[0].split(' - ')[0])}</div><h2>${esc(z.name)}</h2><div class="muted" style="margin-top:6px">${esc(z.sub)}</div></div>
    <div class="big">${PCT(tlZ(z).acum / z.total)}</div>
    <div class="facts"><span>Executado <b class="num">${BRL(tlZ(z).acum)}</b></span><span>Previsto <b class="num">${BRL(z.total)}</b></span><span>BM ${S.tl || BMN} <b class="num">${BRL(tlZ(z).per)}</b></span><span>Saldo <b class="num">${BRL(z.total - tlZ(z).acum)}</b></span>${withMap ? `<span>Extensão <b class="num">${esc(MAPCFG[key].ext)}</b></span>` : ''}</div>
  </section>
  ${tlCard(key)}
  ${withMap ? mapCard(key) + (D.secoes && D.secoes[key] ? perfilCard(key) : '') : D.plans && D.plans[key] ? planCard(key) : `<section class="card"><div class="card-h"><h2>Traçado</h2></div><div class="empty-note">${ND()} O traçado desta frente ainda não foi enviado. Com o DXF ou KMZ, ela ganha a planta com estacas e pontos de foto, como a R. Conceição da Barra.</div></section>`}
  <section class="card lin">
    <div class="card-h"><h2>Diagrama por estaca</h2><span class="sp legend"><span><i class="sw" style="background:var(--accent)"></i>Medido em BM anterior</span><span><i class="sw" style="background:var(--warn)"></i>Medido no BM ${BMN}</span><span><i class="sw" style="background:var(--water)"></i>Lançamento de campo</span><span><i class="sw" style="background:var(--conf);height:5px"></i>Conferido pela fiscalização</span><span><i class="sw" style="background:var(--danger);transform:rotate(45deg) scale(.7)"></i>Pendência não fechada</span></span></div>
    <div class="tbl" id="lin"></div>
    <p class="note">Trechos tirados da memória de cálculo do BM ${BMN} (MC ${BMN}) e dos lançamentos da equipe. Passe o mouse sobre uma barra para ver o registro.</p>
  </section>
  ${frontPend(key)}
  <section class="card">
    <div class="card-h"><h2>Avanço por serviço</h2><span class="sp muted" style="font-size:13px">Financeiro acumulado sobre o previsto</span></div>
    <div class="svc">${groups.map(g => `<div class="it"><div class="row"><b>${esc(title(g.name))}</b><span class="p">${g.total ? PCT(g.acum / g.total) : '—'}</span></div>${meter(g.acum, g.per, g.total || 1)}<div class="s num">${BRL(g.acum)} de ${BRL(g.total)}</div></div>`).join('')}</div>
  </section>
  <section class="card">
    <div class="card-h"><h2>Itens do boletim</h2><span class="sp muted" style="font-size:13px">${z.items.length} itens · clique no grupo para abrir</span></div>
    <div class="tbl"><table><thead><tr><th>Item</th><th>Serviço</th><th>Und</th><th class="r">Previsto</th><th class="r">Acumulado</th><th class="r">BM ${BMN}</th><th class="r">Físico</th><th class="r">Para concluir</th></tr></thead><tbody id="itens">${itemsRows(z)}</tbody></table></div>
  </section>
  ${adFrontCard(key)}
  ${isDir() ? '' : faltasCard(key)}
  ${frontCrono(key)}
  ${isDir() ? '' : frontLogs(key)}`;
}
function itemsRows(z) {
  let h = ''; const fa = faltaAgg(z.key);
  z.groups.forEach(g => {
    const its = z.items.filter(i => groupOf(i.c) === g.code || (z.groups.length === 1));
    h += `<tr class="grp" data-g="${g.code}"><td>${g.code}</td><td colspan="5">${esc(title(g.name))}</td><td class="r">${g.total ? PCT(g.acum / g.total) : ''}</td><td class="r">${(() => { const v = Object.values(fa).filter(x => groupOf(x.c) === g.code).reduce((a, x) => a + x.v, 0); return v ? BRL(v) : ''; })()}</td></tr>`;
    its.forEach(i => {
      const f = i.q ? i.aq / i.q : 0;
      h += `<tr data-in="${g.code}" hidden><td class="mono">${i.c}</td><td class="desc">${esc(short(i.n))}</td><td>${esc(i.u)}</td><td class="r">${NUM(i.q)}</td><td class="r">${NUM(i.aq)}</td><td class="r">${i.pq ? NUM(i.pq) : '—'}</td><td class="r">${PCT(Math.min(f, 9.99), 0)}<span class="bar-mini"><i style="width:${Math.min(100, f * 100)}%"></i></span></td><td class="r">${fa[i.c] ? `<span title="${esc(NUM(fa[i.c].q, 2) + ' ' + i.u + ' informados como faltando')}" style="${fa[i.c].excesso > .005 ? 'color:var(--danger);font-weight:600' : ''}">${BRL(fa[i.c].v)}</span>` : '—'}</td></tr>`;
    });
  });
  return h;
}
document.addEventListener('click', e => {
  const g = e.target.closest('tr.grp');
  if (g) { const open = !g.classList.contains('open'); g.classList.toggle('open', open); document.querySelectorAll(`tr[data-in="${g.dataset.g}"]`).forEach(r => r.hidden = !open); return; }
  const t = e.target.closest('[data-go]'); if (t) { go(t.dataset.go); return; }
});
function pano360(key) {
  const ps = S.p360.filter(p => p.frente === key).sort((a, b) => a.est - b.est);
  if (!ps.length && MODE !== 'admin') return '';
  return `<section class="card"><div class="card-h"><h2>Panoramas 360°</h2><span class="sp muted" style="font-size:13px">Abre o tour do Kuula na vista do trecho</span></div>
    ${ps.length ? `<div class="maptools" style="margin-top:0">${ps.map(p => hasPano(p) ? `<button class="chip" data-pano="${esc(p.id)}"><b class="mono">360°</b> Est. ${esc(estStr(p.est))}${p.titulo ? ' · ' + esc(p.titulo) : ''}</button>` : `<a class="chip" href="${esc(kuulaUrl(p.post))}" target="_blank" rel="noopener"><b class="mono">360°</b> Est. ${esc(estStr(p.est))}${p.titulo ? ' · ' + esc(p.titulo) : ''} ↗</a>`).join('')}</div>` : `<div class="empty-note">Nenhum panorama ligado a este trecho. Ligue um na aba <b>Lançar</b>.</div>`}</section>`;
}
function frontLogs(key) {
  const ls = S.lancs.filter(l => l.frente === key).sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 12);
  return `<section class="card"><div class="card-h"><h2>Lançamentos de campo</h2><button class="sp chip" data-go="lancar">Novo lançamento</button></div>
    ${ls.length ? `<div class="logs">${ls.map(logRow).join('')}</div>` : `<div class="empty-note">Nenhum lançamento ainda. A equipe registra serviço, trecho e quantidade na aba <b>Lançar</b>, e o trecho aparece no diagrama acima.</div>`}</section>`;
}
function logRow(l) {
  const it = itemName(l.item);
  const mine = S.myId && l.autor === S.myId;
  return `<div class="log"><div class="dt">${dBR(l.data).slice(0, 5)}</div><div><b>${esc(l.item)}</b> ${esc(it ? short(it.n) : '')}<div class="muted">Est. ${esc(estStr(l.ini))}${l.fim > l.ini ? ' a ' + esc(estStr(l.fim)) : ''}${l.lado ? ' · ' + esc(l.lado) : ''}${l.qtd ? ' · ' + esc(NUM(l.qtd)) + ' ' + esc(it ? it.u : '') : ''}${l.obs ? ' · ' + esc(l.obs) : ''}${l.autor ? ' · ' + esc(S.names[l.autor] || '') : ''}</div></div>${mine ? `<button class="del" data-dellanc="${esc(l.id)}">Excluir</button>` : '<span></span>'}</div>`;
}

/* ---------- map config per front ---------- */
const MAPCFG = {
  cbarra: {zone: '8', len: [0, 531.35], ext: '531,35 m · Est. 0 a 26+11,35', side0: 'lado do rio',
    sub: ['8.4.1'], bgs: ['8.4.2'], bgtc: ['8.4.3'], cbuq: ['8.4.5', '8.4.9', '8.4.7'], mf: ['8.3.1', '8.3.2'], cal: ['8.5.4'], bl: ['8.3.3'], drenItems: ['8.3.4'],
    drenRe: /ADUELA|REDE|TRAVESSIA/i},
  e5000: {zone: '5', len: [100000, 100387.5], ext: '387,5 m · Est. 5000 a 5019+7,5 · alça E14000 com 84,6 m', side0: 'junto à alça E14000',
    streets: [[100000, 100387.5, 'Eixo 5.000'], [280000, 280084.58, 'Alça E14000 (Est. 14000 a 14004+4,58)'], [20858.0, 21018.0, 'Ciclovia · eixo 1000']],
    sub: ['5.2.2'], bgs: ['5.5.1', '5.5.9'], bgtc: ['5.5.2', '5.5.10'], cbuq: ['5.5.4', '5.5.12', '5.5.8', '5.5.16'], mf: ['5.4.1'], cal: ['5.6.3'], bl: ['5.4.2'], drenItems: ['5.4.3', '5.4.4'],
    drenRe: /TUBO|REDE|TRAVESSIA|PEAD/i},
  e10000: {zone: '6', len: [0, 2340], ext: '3 ruas · Est. 0 a 10 e 100 a 117', side0: 'na R. Jacinto Freire (sul)',
    sub: ['6.2.2'], bgs: ['6.5.1'], bgtc: ['6.5.2'], cbuq: ['6.5.4', '6.5.8'], mf: ['6.4.1', '6.4.2', '6.6.1'], cal: ['6.6.4'], bl: ['6.4.5', '6.4.6', '6.4.7'], drenItems: ['6.4.3'],
    drenRe: /TUBO|REDE|TRAVESSIA|PEAD/i,
    streets: [[0, 120, 'R. Jacinto Freire de Andrade'], [120, 200, 'R. Dom Antônio de Macedo'], [2000, 2340, 'R. Frei Amador']]},
  ramal: {zone: '7', len: [0, 2031.9], ext: '2.031,9 m · Est. 0 a 101+11,9', side0: 'na ponte sobre o Capibaribe (leste)',
    sub: [], bgs: ['7.7.1'], bgtc: [], cbuq: ['7.7.6', '7.7.8'], mf: ['7.8.1', '7.6.3', '7.6.1'], cal: ['7.8.4'], cic: ['7.8.10'], bl: [], drenItems: [],
    drenRe: /TUBO|REDE|TRAVESSIA|PEAD|DRENAG/i}
};
const hasMap = key => !!(MAPCFG[key] && D.geos[key]);

/* ---------- coverage ---------- */
function covers(list, m) { return list.some(r => m >= r.ini - 1e-6 && m <= r.fim + 1e-6); }
function mapLayers(key) {
  const C = MAPCFG[key];
  const recs = recsOf(key).filter(r => inDom(key, r)).concat(S.lancs.filter(l => l.frente === key && tlLanc(l)).map(l => ({item: l.item, ini: l.ini, fim: l.fim, lado: l.lado || '', txt: 'Lançamento de campo', campo: true, bm: 0})));
  const dr = r => C.drenRe.test(r.txt || '');
  const by = codes => recs.filter(r => codes.includes(r.item) && r.fim > r.ini && !dr(r));
  return {
    sub: by(C.sub), bgs: by(C.bgs), bgtc: by(C.bgtc), cbuq: by(C.cbuq),
    dren: recs.filter(r => r.item.split('.')[0] === C.zone && dr(r) && r.fim >= r.ini).concat(recs.filter(r => C.drenItems.includes(r.item))),
    bl: recs.filter(r => C.bl.includes(r.item)),
    mf: by(C.mf), cal: by(C.cal), cic: by(C.cic || []), all: recs
  };
}
const side = (list, s) => list.filter(r => !r.lado || r.lado === s);

/* ---------- map ---------- */
function mapCard(key) {
  const C = MAPCFG[key];
  const lay = [['pav', 'Pavimento'], ['dren', 'Drenagem'], ['mf', 'Meio-fio'], ['cal', 'Calçada'], ['fotos', 'Pontos de foto'], ['ctx', 'Entorno']];
  return `<section class="card">
    <div class="card-h"><h2>Planta da obra</h2><span class="muted" style="font-size:13px">${D.geos[key].rot === false ? 'Norte para cima' : 'Eixo girado para leitura'} · estaca inicial ${esc(C.side0)}</span></div>
    <div class="mapbox"><div class="mapscroll"><svg id="map" data-key="${key}" role="img" aria-label="Planta de ${esc(Z[key].name)} com estacas, camadas executadas e pontos de foto"></svg></div><div class="mapzoom" role="group" aria-label="Zoom da planta"><button data-mz="in" aria-label="Aproximar" title="Aproximar (ou role o mouse)">+</button><button data-mz="out" aria-label="Afastar" title="Afastar">−</button><button data-mz="reset" aria-label="Vista inteira" title="Vista inteira">⟲</button><button data-mz="full" aria-label="Tela cheia" title="Tela cheia">⛶</button></div></div>
    <div class="maptools">
      <div class="legend"><span><i class="sw" style="background:var(--l-none)"></i>A executar</span><span><i class="sw" style="background:var(--l-sub)"></i>Subleito</span><span><i class="sw" style="background:var(--l-bgs)"></i>Base BGS</span><span><i class="sw" style="background:var(--l-bgtc)"></i>Base BGTC</span><span><i class="sw" style="background:var(--l-cbuq)"></i>CBUQ</span>${CICLO[key] ? '<span><i class="sw" style="background:#e58f86"></i>Ciclovia (projeto)</span><span><i class="sw" style="background:#c9c9c4"></i>Calçada da ciclovia</span>' : ''}${DREN[key] ? '<span><i class="sw" style="background:var(--water)"></i>Drenagem do projeto</span><span><i class="sw" style="background:var(--surface);border:1.5px solid var(--water)"></i>Caixa · clique para fotos e pendências</span>' : '<span><i class="sw" style="background:var(--water)"></i>Drenagem</span>'}<span><i class="sw" style="background:var(--l-cal)"></i>Calçada</span>${C.cic ? '<span><i class="sw" style="background:var(--l-cic)"></i>Ciclovia</span>' : ''}<span><i class="sw" style="background:var(--warn);border-radius:6px"></i>360°</span></div>
    </div>
    <div class="maptools" role="group" aria-label="Camadas">${lay.map(([k, n]) => `<button class="chip" data-layer="${k}" aria-pressed="${S.layers[k]}">${n}</button>`).join('')}</div>
    <div class="stakeinfo" id="stakeinfo"><div class="muted">Clique na via para ver o que já foi feito em cada estaca. Clique numa câmera para abrir a foto${DREN[key] ? ' ou numa caixa de drenagem para abrir a ficha dela' : ''}.</div></div>
  </section>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-layer]');
  if (b) { S.layers[b.dataset.layer] = !S.layers[b.dataset.layer]; b.setAttribute('aria-pressed', S.layers[b.dataset.layer]); drawMap(); }
});
function idxAt(key, m) { const cl = D.geos[key].cl; let b = 0, bd = 1e9; for (let i = 0; i < cl.length; i++) { const d = Math.abs(cl[i][0] - m); if (d < bd) { bd = d; b = i; } } return b; }
function drawMap() {
  const svg = $('#map'); if (!svg) return;
  const key = svg.dataset.key, G = D.geos[key], C = MAPCFG[key], cl = G.cl, W = G.W || 8;
  const [bw0, bh0] = [G.vb[2], G.vb[3]], [vx, vy, vw, vh] = (S.mapView[key] || G.vb);
  svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
  const K = Math.max(.3, Math.min(3.2, vw / 654));
  svg.style.setProperty('--k', K);
  svg.style.minWidth = bw0 / bh0 < 1.3 ? '0' : (bw0 / bh0 > 3 ? '980px' : '720px');
  svg.style.maxHeight = bw0 / bh0 < 1.3 ? '640px' : '';
  const Ls = mapLayers(key);
  const nrm = i => { const a = cl[Math.max(0, i - 1)], b = cl[Math.min(cl.length - 1, i + 1)]; const dx = b[1] - a[1], dy = b[2] - a[2], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  const off = (i, d) => { const n = nrm(i); return [cl[i][1] + n[0] * d, cl[i][2] + n[1] * d]; };
  const runs = (fn, d = 0) => {
    const out = []; let cur = null;
    for (let i = 0; i < cl.length - 1; i++) {
      if (Math.abs(cl[i + 1][0] - cl[i][0]) > 8) { cur = null; continue; }
      if (CICLO[key] && cl[i][0] >= CICLO[key].ini - 1 && cl[i][0] <= CICLO[key].fim + 1) { cur = null; continue; }
      const k = fn((cl[i][0] + cl[i + 1][0]) / 2);
      const p0 = off(i, d), p1 = off(i + 1, d);
      if (!cur || cur.k !== k) { cur = {k, pts: [p0]}; out.push(cur); }
      cur.pts.push(p1);
    }
    return out.map(r => ({k: r.k, d: 'M' + r.pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L')}));
  };
  let s = '';
  if (S.layers.ctx) {
    const P = G.paths, cls = {edif: 'ctx-1', meiofio_ex: 'ctx-2', muro: 'ctx-2', ferrea: 'ctx-1', agua: 'ctx-w', ponte: 'ctx-1', calcada: 'ctx-2', proj_bordo: 'ctx-p', proj_passeio: 'ctx-p', proj_dren: 'ctx-d', cb_dren: 'none', cb_rio: 'ctx-w', cb_ferrea: 'ctx-1', cb_torre: 'ctx-1', cb_passeio: 'ctx-2', e5_topo: 'ctx-2', e5_canteiro: 'ctx-1', e5_bordo: 'ctx-1', ri_mf: 'ctx-1', ri_bordo: 'ctx-2', ri_cic: 'ctx-2', ri_lpp: 'ctx-2', e10_edif: 'ctx-1', e10_ctx: 'ctx-2', e10_dren: 'ctx-d', e10_cal: 'ctx-2', e10_mf: 'ctx-1', e10_agua: 'ctx-d', e10_bordo: 'ctx-1', dr_tubo: 'none', dr_caixa: 'none', dr_aduela: 'none', dr_galeria: 'none', dr_bueiro: 'none'};
    for (const k in cls) if (P[k] && cls[k] !== 'none' && !(DREN[key] && /dren/.test(k))) s += `<path class="${cls[k]}" d="${P[k]}"/>`;
    (G.roads || []).forEach(([n, d]) => {
      const other = Object.keys(MAPCFG).find(k => Z[k].name === n);
      s += `<path d="${d}" fill="none" stroke="var(--line-2)" stroke-width="${W * .8}" stroke-linecap="round" opacity=".55"${other ? ` data-go="${other}" style="cursor:pointer"` : ''}><title>${esc(n)} · abrir</title></path>`;
    });
    (G.labels || []).forEach(l => { s += `<text class="maplab" x="${l[1]}" y="${l[2]}" text-anchor="middle">${esc(l[0])}</text>`; });
  }
  // pavement: two half-bands (LE above/left of travel, LD below/right)
  const lvl = sd => m => { const f = l => covers(side(l, sd), m); return f(Ls.cbuq) ? 'cbuq' : f(Ls.bgtc) ? 'bgtc' : f(Ls.bgs) ? 'bgs' : f(Ls.sub) ? 'sub' : 'none'; };
  wZones(key, W).forEach(([za, zb, zw]) => [['LE', zw / 4], ['LD', -zw / 4]].forEach(([sd, d]) => runs(m => (m < za || m > zb) ? null : (S.layers.pav ? lvl(sd)(m) : 'none'), d).forEach(r => { if (r.k != null) s += `<path class="seg" d="${r.d}" stroke="var(--l-${r.k})" stroke-width="${zw / 2 + .05}"/>`; })));
  s += runs(() => 0, 0).map(r => `<path d="${r.d}" fill="none" stroke="var(--bg)" stroke-width=".25" stroke-dasharray="2 2" opacity=".6"/>`).join('');
  if (S.layers.dren && G.paths && !DREN[key]) {
    const DRN = [['dr_galeria', 'Galeria / aduelas 1,50 × 1,50 m', 2.6, ''], ['dr_aduela', 'Aduelas (galeria celular pré-moldada)', 1.4, ''], ['dr_tubo', 'Rede tubular (manilhas / PEAD)', 1.1, ''], ['dr_bueiro', 'Bueiro', 1.6, ''], ['dr_caixa', 'Caixa / boca de lobo', .9, 'fill']];
    DRN.forEach(([k, n, w, f]) => { if (G.paths[k]) s += `<path d="${G.paths[k]}" fill="${f ? 'var(--water)' : 'none'}" fill-opacity="${f ? .35 : 0}" stroke="var(--water)" stroke-width="${w * Math.max(1, K * .8)}" stroke-linecap="round" stroke-linejoin="round" class="drn"><title>${esc(n)} · projeto de drenagem (DXF)</title></path>`; });
  }
  if (CICLO[key]) s += cicloSvg(key, K);
  if (S.layers.dren && DREN[key]) s += drenSvg(key, K, 'links');
  if (S.layers.dren && !DREN[key]) {
    runs(m => covers(Ls.dren.filter(r => r.fim > r.ini), m) ? 1 : 0, 0).forEach(r => { if (r.k) s += `<path class="seg" d="${r.d}" stroke="var(--water)" stroke-width="1.6" stroke-dasharray="3 1.5"/>`; });
    Ls.dren.filter(r => r.fim <= r.ini).forEach(r => { const i = idxAt(key, r.ini), a = off(i, W / 2 + 1), b = off(i, -W / 2 - 1); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--water)" stroke-width="1.2"><title>${esc(r.txt)}</title></line>`; });
    Ls.bl.filter(r => r.ini).forEach(r => { const i = idxAt(key, r.ini); const p = off(i, W / 2 - 1); s += `<rect x="${p[0] - 1}" y="${p[1] - 1}" width="2" height="2" fill="var(--water)"><title>Boca de lobo · Est. ${estStr(r.ini)}</title></rect>`; });
  }
  if (S.layers.mf) {
    [['LE', W / 2 + .4], ['LD', -W / 2 - .4]].forEach(([sd, d]) => runs(m => covers(side(Ls.mf, sd), m) ? 1 : 0, d).forEach(r => {
      s += `<path class="seg" d="${r.d}" stroke="${r.k ? 'var(--fg)' : 'var(--faint)'}" stroke-width="${r.k ? .8 : .4}" ${r.k ? '' : 'stroke-dasharray="1.5 1.5"'}/>`;
    }));
  }
  if (S.layers.cal) {
    [['LE', W / 2 + 2], ['LD', -W / 2 - 2]].forEach(([sd, d]) => runs(m => covers(side(Ls.cal, sd), m) ? 1 : 0, d).forEach(r => {
      if (r.k) s += `<path class="seg" d="${r.d}" stroke="var(--l-cal)" stroke-width="2.4"/>`;
    }));
  }
  if (S.layers.cal && C.cic) {
    [['LE', W / 2 + 4.6], ['LD', -W / 2 - 4.6]].forEach(([sd, d]) => runs(m => covers(side(Ls.cic, sd), m) ? 1 : 0, d).forEach(r => {
      if (r.k) s += `<path class="seg" d="${r.d}" stroke="var(--l-cic)" stroke-width="2"/>`;
    }));
  }
  if (S.layers.dren && DREN[key]) s += drenSvg(key, K, 'nodes');
  // stakes
  const [m0, m1] = C.len;
  const stakesAt = []; { let a = cl[0][0]; for (let i = 1; i <= cl.length; i++) { if (i === cl.length || Math.abs(cl[i][0] - cl[i - 1][0]) > 8) { const b = cl[i - 1][0]; for (let m = Math.ceil((a - .5) / 20) * 20; m <= b + .5; m += 20) stakesAt.push(m); if (i < cl.length) a = cl[i][0]; } } }
  for (const m of stakesAt) {
    const i = idxAt(key, m); if (Math.abs(cl[i][0] - m) > 3) continue;
    const a = off(i, W / 2 + 4.2 * K), b = off(i, -W / 2 - 4.2 * K), k = Math.round(m / 20);
    const every = K > 2 ? 5 : 1; if (k % every) continue;
    s += `<line class="tick" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    const t = off(i, -W / 2 - (k % 5 === 0 ? 10 : 8.5) * K);
    s += `<text class="tlab${k % 5 === 0 ? ' big' : ''}" x="${t[0]}" y="${t[1] + 2}" text-anchor="middle"${k % 5 ? ' opacity=".7"' : ''}>${k}</text>`;
  }
  // north arrow + scale
  const [nx, ny] = G.northVec; const cx = vx + vw - 22 * K, cy = vy + 24 * K;
  s += `<g transform="translate(${cx},${cy}) scale(${K})"><circle r="11" fill="var(--surface)" stroke="var(--line-2)" stroke-width=".6"/><path d="M${nx * 8},${ny * 8} L${-ny * 3.2},${nx * 3.2} L${ny * 3.2},${-nx * 3.2}Z" fill="var(--accent)"/><text x="${nx * 15}" y="${ny * 15 + 2.4}" text-anchor="middle" class="tlab big">N</text></g>`;
  { const Lb = [5, 10, 20, 50, 100, 200, 500, 1000].find(v => v >= vw / 9) || 1000, x0 = vx + 14 * K, y0 = vy + vh - 12 * K, hh = 1.6 * K; s += `<g><rect x="${x0}" y="${y0}" width="${Lb / 2}" height="${hh}" fill="var(--muted)"/><rect x="${x0 + Lb / 2}" y="${y0}" width="${Lb / 2}" height="${hh}" fill="none" stroke="var(--muted)" stroke-width="${.3 * K}"/><text class="sbt" x="${x0}" y="${y0 - 2 * K}">0</text><text class="sbt" x="${x0 + Lb}" y="${y0 - 2 * K}" text-anchor="middle">${Lb} m</text></g>`; }
  s += `<line id="hx" class="hover-x" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/>`;
  // panoramas that no photo camera claims get their own 360° marker
  if (S.layers.fotos) {
    const pts = PHOTO_POINTS[key] || [];
    S.p360.filter(p => p.frente === key && !pts.some(m => p360For(key, m) === p)).forEach(p => {
      const i = idxAt(key, p.est); if (Math.abs(cl[i][0] - p.est) > 25) return;
      const base = off(i, -W / 2 - 4.5 * K), q = off(i, -W / 2 - 15 * K);
      s += `<line x1="${base[0]}" y1="${base[1]}" x2="${q[0]}" y2="${q[1]}" stroke="var(--warn)" stroke-width="${.5 * K}"/>`;
      s += `<g class="cam" tabindex="0" role="button" aria-label="Panorama 360° da estaca ${estStr(p.est)}" data-cam="${p.est}" transform="translate(${q[0]},${q[1]}) scale(${K})"><circle r="5.5" fill="var(--warn)" stroke="var(--surface)" stroke-width=".8"/><text y="1.6" text-anchor="middle" style="fill:var(--accent-ink);font:700 3.9px var(--font-mono)">360</text><text y="9.5" text-anchor="middle" style="fill:var(--fg);font:600 4.6px var(--font-mono)">${estStr(p.est)}</text></g>`;
    });
  }
  // cameras
  if (S.layers.fotos && PHOTO_POINTS[key]) {
    const date = S.photoDate || latestDate(key);
    PHOTO_POINTS[key].forEach(m => {
      const i = idxAt(key, m), base = off(i, W / 2 + 4.5 * K), p = off(i, W / 2 + 17 * K);
      const list = photosAt(key, m), has = list.length > 0, today = date && list.some(f => f.data === date), p3 = p360For(key, m);
      s += `<line x1="${base[0]}" y1="${base[1]}" x2="${p[0]}" y2="${p[1]}" stroke="var(--accent)" stroke-width=".5"/>`;
      s += `<g class="cam${has ? ' has' : ''}" tabindex="0" role="button" aria-label="Fotos${p3 ? ' e 360°' : ''} da estaca ${estStr(m)}" data-cam="${m}" transform="translate(${p[0]},${p[1]}) scale(${K})">
        <circle class="o" r="6.5"/><path d="M-3.4,-1.6h1.4l.8,-1.2h2.4l.8,1.2h1.4v4.4h-6.8z M0,-.6a1.5,1.5 0 1,0 .01,0z" fill-rule="evenodd"/>
        ${today ? '<circle r="1.6" cx="5" cy="-5" fill="var(--warn)"/>' : ''}
        ${p3 ? '<g transform="translate(6.5,5)"><rect x="-5.2" y="-3" width="10.4" height="6" rx="3" fill="var(--warn)"/><text y="1.7" text-anchor="middle" style="fill:var(--accent-ink);font:700 3.8px var(--font-mono)">360°</text></g>' : ''}
        <text y="-9" text-anchor="middle">Est. ${estStr(m)}</text></g>`;
    });
  }
  svg.innerHTML = s;
  const pick = ev => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return null;
    const q = pt.matrixTransform(ctm.inverse());
    let best = -1, bd = 1e9;
    for (let i = 0; i < cl.length; i++) { const d = (cl[i][1] - q.x) ** 2 + (cl[i][2] - q.y) ** 2; if (d < bd) { bd = d; best = i; } }
    return bd < (22 * K) ** 2 ? best : null;
  };
  const hx = $('#hx');
  svg.onmousemove = ev => {
    if (ev.target.closest && ev.target.closest('.cam,[data-go],[data-node]')) return;
    const i = pick(ev); if (i == null) { hx.setAttribute('visibility', 'hidden'); return; }
    const a = off(i, W / 2 + 2 * K), b = off(i, -W / 2 - 2 * K);
    hx.setAttribute('x1', a[0]); hx.setAttribute('y1', a[1]); hx.setAttribute('x2', b[0]); hx.setAttribute('y2', b[1]); hx.setAttribute('visibility', 'visible');
  };
  svg.onmouseleave = () => hx.setAttribute('visibility', 'hidden');
  svg.onclick = ev => {
    if (S.mapDrag) return;
    if (ev.target.closest && ev.target.closest('[data-go],a')) return;
    const nd = ev.target.closest && ev.target.closest('[data-node]'); if (nd) { openNode(key, nd.dataset.node); return; }
    const c = ev.target.closest && ev.target.closest('[data-cam]');
    if (c) { openStake(key, +c.dataset.cam); return; }
    const i = pick(ev); if (i != null) { S.stake = cl[i][0]; stakeInfo(key); }
  };
  svg.onkeydown = ev => { const c = ev.target.closest && ev.target.closest('[data-cam]'); if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openStake(key, +c.dataset.cam); } };
  if (S.stake != null) stakeInfo(key);
  mapZoomBind(svg, key);
}
function stakeInfo(key) {
  const el = $('#stakeinfo'); if (!el) return;
  const m = S.stake, i = idxAt(key, m), c = D.geos[key].cl[i];
  const Ls = mapLayers(key);
  const hit = Ls.all.filter(r => m >= r.ini - 2 && m <= r.fim + 2);
  const byItem = {}; let fichaVal = 0;
  hit.forEach(r => { (byItem[r.item] = byItem[r.item] || []).push(r); });
  const rows = Object.keys(byItem).sort((a, b) => a.localeCompare(b, 'pt', {numeric: true})).map(code => {
    const it = itemName(code), rs = byItem[code];
    const bms = [...new Set(rs.filter(r => r.bm).map(r => r.bm))].sort((a, b) => a - b);
    const campo = rs.some(r => r.campo);
    const lados = [...new Set(rs.map(r => r.lado).filter(Boolean))];
    const vq = rs.filter(r => !r.campo && typeof r.q === 'number').reduce((a, r) => a + r.q, 0), vv = it && vq ? vq * it.pu : 0;
    fichaVal += vv;
    return `<li><span class="mono" style="color:var(--accent)">${code}</span><span>${esc(it ? short(it.n) : '')}${vq ? `<span class="num"> · ${fmtQ(vq)} ${esc(it.u)} · <b>${BRL(vv)}</b></span>` : ''}<span class="muted"> · ${bms.length ? 'BM ' + bms.join(', ') : ''}${campo ? (bms.length ? ' · ' : '') + 'campo' : ''}${lados.length ? ' · ' + lados.join('/') : ''}</span></span></li>`;
  }).join('');
  const p3 = S.p360.filter(p => p.frente === key).sort((a, b) => Math.abs(a.est - m) - Math.abs(b.est - m))[0];
  const near = S.fotos.filter(f => f.frente === key && Math.abs(f.est - m) <= 30);
  const m0 = MAPCFG[key].len[0];
  const st = (MAPCFG[key].streets || []).find(x => m >= x[0] - 1 && m <= x[1] + 1);
  el.innerHTML = `<div><h3>Est. ${estStr(Math.round(m))} <span class="muted mono" style="font-size:13px;font-weight:400">· ${st ? esc(st[2]) : Math.round(m - m0) + ' m do início'}</span></h3>
    ${rows ? `<ul>${rows}</ul>${fichaVal ? `<div class="muted" style="font-size:13px;margin-top:6px">Valor dos trechos medidos que passam por esta estaca: <b class="num" style="color:var(--fg)">${BRL(fichaVal)}</b></div>` : ''}` : `<p class="muted">Nenhum serviço medido com estaca neste ponto até o BM ${S.tl || BMN}.</p>`}
    ${fichaAvanco(key, m)}
    <div class="muted" style="font-size:12.5px;margin-top:6px">Medições dos BMs 01 a ${String(RECS_MIN - 1).padStart(2, '0')} neste ponto: ${ND()} (as memórias desses boletins não trazem estacas).</div></div>
    <div style="display:grid;gap:8px;align-content:start;justify-items:end"><a class="chip" href="https://www.google.com/maps?q=${c[4]},${c[5]}" target="_blank" rel="noopener">Abrir no Google Maps ↗</a>${p3 ? (hasPano(p3) ? `<button class="chip" data-pano="${esc(p3.id)}">360° mais próximo · Est. ${esc(estStr(p3.est))}</button>` : `<a class="chip" href="${esc(kuulaUrl(p3.post))}" target="_blank" rel="noopener">360° mais próximo · Est. ${esc(estStr(p3.est))} ↗</a>`) : ''}${near.length ? `<button class="chip" data-near="${Math.round(m)}" data-nk="${key}">Fotos próximas (${near.length})</button>` : ''}</div>`;
  stakeExtra(el, key, m);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-near]'); if (b) { const m = +b.dataset.near, k = b.dataset.nk; const list = S.fotos.filter(f => f.frente === k && Math.abs(f.est - m) <= 30).sort((a, b) => a.data.localeCompare(b.data)); openList(list, list.length - 1, 'Fotos perto da Est. ' + estStr(m)); } });

/* ---------- situation map (overview) ---------- */
function overviewMap() {
  const O = D.overview; if (!O) return '';
  const [x, y, w, h] = O.vb;
  let s = O.ctx.map(([k, d]) => `<path class="${k === 'agua' ? 'ctx-w' : k === 'proj_bordo' ? 'ctx-p' : 'ctx-1'}" d="${d}" style="stroke-width:2.2"/>`).join('');
  for (const k in O.roads) {
    const z = Z[k], p = z.acum / z.total;
    if (k === 'e10000') { s += `<g data-go="${k}" style="cursor:pointer"><path d="${O.roads[k]}" fill="var(--accent)" fill-opacity="${.2 + .6 * p}" stroke="var(--accent)" stroke-width="5"><title>${esc(z.name)} · ${PCT(p)}</title></path></g>`; continue; }
    s += `<g data-go="${k}" style="cursor:pointer"><path d="${O.roads[k]}" fill="none" stroke="var(--l-none)" stroke-width="30" stroke-linecap="round"/><path d="${O.roads[k]}" fill="none" stroke="var(--accent)" stroke-width="18" stroke-linecap="round" opacity="${.35 + .65 * p}"><title>${esc(z.name)} · ${PCT(p)}</title></path></g>`;
  }
  const lab = O.lab || {};
  if (O.arena) s += `<g transform="translate(${O.arena[0]},${O.arena[1]})"><ellipse rx="70" ry="55" fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="8 6"/><text y="8" text-anchor="middle" class="maplab" style="font-size:26px">Arena</text></g>`;
  for (const k in lab) if (lab[k]) s += `<text x="${lab[k][0]}" y="${lab[k][1]}" text-anchor="${k === 'ramal' || k === 'e10000' ? 'middle' : 'end'}" class="tlab big" style="font-size:58px;fill:var(--fg)" data-go="${k}">${esc(Z[k].name)}</text><text x="${lab[k][0]}" y="${lab[k][1] + 58}" text-anchor="${k === 'ramal' || k === 'e10000' ? 'middle' : 'end'}" class="tlab" style="font-size:50px;fill:var(--accent)">${PCT(Z[k].acum / Z[k].total)}</text>`;
  s += `<g transform="translate(${w - 60},60) scale(2.6)"><circle r="14" fill="var(--surface)" stroke="var(--line-2)"/><path d="M0,-10 L4,4 L-4,4Z" fill="var(--accent)"/><text y="-17" text-anchor="middle" class="tlab big" style="font-size:11px">N</text></g>`;
  return `<svg viewBox="${x} ${y} ${w} ${h}" role="img" aria-label="Mapa de situação das frentes com traçado" style="width:100%;max-height:520px;display:block">${s}</svg>`;
}

/* ---------- schedule (MS Project) ---------- */
const DAY = 864e5;
const dt = iso => new Date(iso + 'T12:00:00').getTime();
const dShort = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function taskState(t, today) { if (t.ms) return t.f < today ? 'ms-past' : 'ms'; if (t.f < today) return 'past'; if (t.s > today) return 'future'; return 'now'; }
function daysTo(iso) { return Math.round((dt(iso) - dt(todayISO())) / DAY); }
function bmPeriods() { return D.bms.map(b => { const m = b.per.match(/(\d\d)\/(\d\d)\/(\d{4}).*?(\d\d)\/(\d\d)\/(\d{4})/); return m ? {n: b.n, s: `${m[3]}-${m[2]}-${m[1]}`, f: `${m[6]}-${m[5]}-${m[4]}`} : null; }).filter(Boolean); }
function gantt(tasks, opts = {}) {
  const today = todayISO();
  const all = D.crono.tasks;
  const t0 = dt(all.reduce((a, t) => t.s < a ? t.s : a, '9999')) - 10 * DAY;
  const t1 = dt(all.reduce((a, t) => t.f > a ? t.f : a, '0000')) + 20 * DAY;
  const W = 1100, LBL = opts.compact ? 250 : 320, R = 20, RH = 24, TOP = opts.compact ? 34 : 54;
  const X = ms => LBL + (W - LBL - R) * (ms - t0) / (t1 - t0);
  const H = TOP + tasks.length * RH + 14;
  let s = '';
  // month grid
  const d = new Date(t0); d.setDate(1); d.setMonth(d.getMonth() + 1);
  for (; d.getTime() < t1; d.setMonth(d.getMonth() + 1)) {
    const x = X(d.getTime());
    s += `<line x1="${x}" x2="${x}" y1="${TOP - 16}" y2="${H - 8}" stroke="var(--line)"/>`;
    s += `<text class="ax" x="${x + 3}" y="${TOP - 6}">${MES[d.getMonth()]}${d.getMonth() === 0 || x < LBL + 30 ? '/' + String(d.getFullYear()).slice(2) : ''}</text>`;
  }
  // BM strip
  if (!opts.compact) bmPeriods().forEach((b, i) => {
    const a = X(dt(b.s)), z = X(dt(b.f) + DAY);
    s += `<rect x="${a}" y="6" width="${Math.max(1, z - a - 1)}" height="16" rx="2" fill="${b.n === D.meta.bm ? 'var(--warn)' : 'var(--surface-2)'}" stroke="var(--line)"><title>BM ${String(b.n).padStart(2, '0')}: ${dBR(b.s)} a ${dBR(b.f)}</title></rect>`;
    if (z - a > 18) s += `<text class="ax" x="${(a + z) / 2}" y="18" text-anchor="middle" style="${b.n === D.meta.bm ? 'fill:var(--accent-ink);font-weight:600' : ''}">${String(b.n).padStart(2, '0')}</text>`;
  });
  if (!opts.compact) s += `<text class="ax" x="${LBL - 8}" y="18" text-anchor="end">Boletins</text>`;
  tasks.forEach((t, i) => {
    const y = TOP + i * RH, st = taskState(t, today), ind = Math.max(0, t.l - (opts.base || 3)) * 14;
    if (i % 2) s += `<rect x="0" y="${y}" width="${W}" height="${RH}" fill="var(--surface-2)" opacity=".45"/>`;
    const nm = t.n.length > 44 ? t.n.slice(0, 42) + '…' : t.n;
    s += `<text x="${6 + ind}" y="${y + 16}" class="${t.sum ? 'rowlab b' : 'rowlab'}"${t.fr && t.l === 3 && !opts.compact ? ` data-go="${t.fr}" style="cursor:pointer"` : ''}>${esc(nm)}</text>`;
    const a = X(dt(t.s)), z = X(dt(t.f) + DAY);
    const tip = `<title>${esc(t.n)}\n${t.ms ? dBR(t.s) : dBR(t.s) + ' a ' + dBR(t.f) + ' · ' + (Math.round((dt(t.f) - dt(t.s)) / DAY) + 1) + ' dias'}</title>`;
    if (t.ms) {
      const c = X(dt(t.s) + DAY / 2);
      s += `<path d="M${c},${y + 5} l7,7 l-7,7 l-7,-7z" fill="${st === 'ms-past' ? 'var(--muted)' : 'var(--warn)'}">${tip}</path><text class="ax" x="${c + 11}" y="${y + 16}">${dShort(t.s)}</text>`;
    } else if (t.sum) {
      s += `<path d="M${a},${y + 7} H${z} V${y + 15} l-4,-3 H${a + 4} l-4,3 Z" fill="var(--fg)" opacity=".8">${tip}</path>`;
    } else {
      const fill = st === 'past' ? 'var(--line-2)' : st === 'now' ? 'var(--accent)' : 'none';
      const stroke = st === 'future' ? 'var(--accent)' : 'none';
      s += `<rect x="${a}" y="${y + 6}" width="${Math.max(3, z - a)}" height="${RH - 12}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.2">${tip}</rect>`;
      if (st === 'now') { const p = Math.min(1, (dt(today) - dt(t.s)) / (dt(t.f) - dt(t.s) + DAY)); s += `<rect x="${a}" y="${y + 6}" width="${(z - a) * p}" height="${RH - 12}" rx="3" fill="var(--accent-ink)" opacity=".22"/>`; }
      const lx = z + 6 + 60 < W ? z + 6 : a - 6;
      s += `<text class="ax" x="${lx}" y="${y + 16}" text-anchor="${lx === z + 6 ? 'start' : 'end'}">${dShort(t.s)} → ${dShort(t.f)}</text>`;
    }
  });
  const xt = X(dt(today) + DAY / 2);
  s += `<line x1="${xt}" x2="${xt}" y1="${TOP - 20}" y2="${H - 6}" stroke="var(--danger)" stroke-width="1.6"/><rect x="${xt - 26}" y="${TOP - 34 + (opts.compact ? 14 : 0)}" width="52" height="15" rx="3" fill="var(--danger)"/><text x="${xt}" y="${TOP - 23 + (opts.compact ? 14 : 0)}" text-anchor="middle" style="fill:#fff;font:600 10px var(--font-mono)">hoje ${dShort(today)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="min-width:860px" role="img" aria-label="Cronograma em barras">${s}</svg>`;
}
const ganttLegend = `<span class="sp legend"><span><i class="sw" style="background:var(--accent)"></i>Em andamento</span><span><i class="sw" style="border:1.5px solid var(--accent)"></i>A iniciar</span><span><i class="sw" style="background:var(--line-2)"></i>Prazo encerrado</span><span><i class="sw" style="background:var(--warn);transform:rotate(45deg) scale(.8)"></i>Marco</span><span><i class="sw" style="background:var(--danger);width:3px"></i>Hoje</span></span>`;
S.cronoFront = 'todas';
function viewCrono() {
  const fr = S.cronoFront, today = todayISO();
  const ts = D.crono.tasks.filter(t => fr === 'todas' ? t.l >= 3 || t.id === 67 : t.fr === fr);
  const fim = D.crono.tasks.find(t => t.id === 67);
  const fronts = FRONT_KEYS.map(k => { const top = D.crono.tasks.find(t => t.fr === k && t.l === 3); const end = D.crono.tasks.filter(t => t.fr === k && t.ms).pop(); return {k, top, end}; });
  const now = D.crono.tasks.filter(t => !t.sum && !t.ms && taskState(t, today) === 'now');
  const next = D.crono.tasks.filter(t => !t.sum && t.s > today).sort((a, b) => a.s.localeCompare(b.s)).slice(0, 6);
  return `
  <section class="kpis" aria-label="Prazos">
    <div class="kpi"><div class="eyebrow">Conclusão das obras</div><div class="v">${dBR(fim.f)}</div><div class="s">${daysTo(fim.f) >= 0 ? 'faltam ' + daysTo(fim.f) + ' dias' : 'prazo vencido há ' + (-daysTo(fim.f)) + ' dias'}</div></div>
    ${fronts.filter(f => f.end).slice(0, 3).map(f => `<div class="kpi"><div class="eyebrow">${esc(Z[f.k].name)}</div><div class="v">${dBR(f.end.f)}</div><div class="s">${daysTo(f.end.f) >= 0 ? 'faltam ' + daysTo(f.end.f) + ' dias' : 'há ' + (-daysTo(f.end.f)) + ' dias'} · ${PCT(Z[f.k].acum / Z[f.k].total, 0)} medido</div></div>`).join('')}
  </section>
  <section class="card lin">
    <div class="card-h"><h2>Cronograma</h2>${ganttLegend}</div>
    <div class="maptools" style="margin:0 0 12px" role="group" aria-label="Frente">${[['todas', 'Todas as frentes']].concat(FRONT_KEYS.map(k => [k, Z[k].name])).map(([k, n]) => `<button class="chip" data-cfr="${k}" aria-pressed="${fr === k}">${esc(n)}</button>`).join('')}</div>
    <div class="tbl">${gantt(ts, {base: fr === 'todas' ? 3 : 3})}</div>
    <p class="note">Datas do arquivo ${esc(D.crono.nome)}. As barras dos grupos foram recalculadas a partir das atividades. O arquivo não traz linha de base nem % concluído, então o avanço real vem dos boletins de medição.</p>
  </section>
  <div class="grid g2">
    <section class="card"><div class="card-h"><h2>Em andamento pelo cronograma</h2><span class="sp muted" style="font-size:13px">${now.length} atividades</span></div>
      <div class="logs">${now.map(t => `<div class="log"><div class="dt">${dShort(t.f)}</div><div><b>${esc(t.n)}</b><div class="muted">${esc(t.fr ? Z[t.fr].name : '')} · ${dBR(t.s)} a ${dBR(t.f)} · ${daysTo(t.f) >= 0 ? 'termina em ' + daysTo(t.f) + ' dias' : 'terminou'}</div></div><span></span></div>`).join('') || '<div class="empty-note">Nenhuma atividade em andamento hoje.</div>'}</div></section>
    <section class="card"><div class="card-h"><h2>Próximos inícios</h2></div>
      <div class="logs">${next.map(t => `<div class="log"><div class="dt">${dShort(t.s)}</div><div><b>${esc(t.n)}</b><div class="muted">${esc(t.fr ? Z[t.fr].name : '')} · em ${daysTo(t.s)} dias</div></div><span></span></div>`).join('')}</div></section>
  </div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-cfr]'); if (b) { S.cronoFront = b.dataset.cfr; render(); } });
function frontCrono(key) {
  const ts = D.crono.tasks.filter(t => t.fr === key);
  if (!ts.length) return '';
  const end = ts.filter(t => t.ms).pop();
  return `<section class="card lin"><div class="card-h"><h2>Cronograma da frente</h2>${end ? `<span class="muted" style="font-size:14px">Conclusão prevista <b style="color:var(--fg)">${dBR(end.f)}</b> · ${daysTo(end.f) >= 0 ? 'faltam ' + daysTo(end.f) + ' dias' : 'há ' + (-daysTo(end.f)) + ' dias'}</span>` : ''}${ganttLegend}</div>
    <div class="tbl">${gantt(ts, {compact: true})}</div></section>`;
}
function planCard(key) {
  const P = D.plans && D.plans[key]; if (!P) return '';
  const p3 = S.p360.filter(p => p.frente === key);
  return `<section class="card"><div class="card-h"><h2>Planta da obra</h2><span class="muted" style="font-size:13px">${esc(P.nota)}</span></div>
    <div class="mapbox" style="background:var(--surface-2)"><div class="mapscroll" data-stage style="overflow:auto"><img src="${esc(P.img)}" alt="Projeto de ${esc(Z[key].name)} sobre ortofoto" style="display:block;width:100%;height:auto;cursor:zoom-in" title="Clique para ampliar"></div></div>
    <div class="maptools">${p3.map(p => hasPano(p) ? `<button class="chip" style="border-color:var(--warn)" data-pano="${esc(p.id)}"><b class="mono" style="color:var(--warn)">360°</b> ${esc(p.titulo || 'Panorama')}</button>` : `<a class="chip" style="border-color:var(--warn)" href="${esc(kuulaUrl(p.post))}" target="_blank" rel="noopener"><b class="mono" style="color:var(--warn)">360°</b> ${esc(p.titulo || 'Panorama')} ↗</a>`).join('')}<span class="muted" style="font-size:13px">Sem estaqueamento no arquivo: a planta serve de referência visual. Clique na imagem para ampliar.</span></div>
  </section>`;
}

/* ---------- longitudinal profile, layer quantities and 3D section ---------- */
function wAt(key, g, m) { const f = (g.faixas || []).find(z => m >= z[0] && m <= z[1]); return f ? f[2] : g.larg; }
function wMean(key, g, a, b) { if (!(g.faixas || []).length || b <= a) return g.larg; let t = 0; const st = Math.max(.5, (b - a) / 400); for (let m = a; m < b; m += st) t += wAt(key, g, Math.min(b, m + st / 2)) * Math.min(st, b - m); return t / (b - a); }
function secFor(key, seg) { const b = D.secoes[key], o = b && b.segs && b.segs[seg]; return o ? Object.assign({}, b, o) : b; }
function cicloSvg(key, K) { const C = CICLO[key]; if (!C) return ''; return `<g opacity=".95">${C.polys.map(q => `<path d="M${q.p.map(v => v[0] + ',' + v[1]).join('L')}Z" fill="${q.t === 'cic' ? '#e58f86' : '#c9c9c4'}" stroke="none"/>`).join('')}</g>`; }
function wZones(key, W) { const sc = D.secoes[key], g = sc && sc.grupos.find(x => x.off === 0); if (!g || !(g.faixas || []).length) return [[-1e9, 1e9, W]]; const z = []; let a = -1e9; g.faixas.slice().sort((p, q) => p[0] - q[0]).forEach(f => { z.push([a, f[0], W]); z.push([f[0], f[1], f[2]]); a = f[1]; }); z.push([a, 1e9, W]); return z; }
const LCOL = {cbuq: '#141516', cbuq2: '#2b2d30', bgtc: '#8a9296', bgs: '#b8aa8c', sub: '#9a5a33', cal: '#dadad6', lastro: '#bdb8ad', cic: '#d2604a'};
S.perf = {};
function interp(arr, m) {
  if (!arr || !arr.length) return null;
  if (m < arr[0][0] - 25 || m > arr[arr.length - 1][0] + 25) return null;
  if (m <= arr[0][0]) return arr[0][1];
  for (let i = 1; i < arr.length; i++) if (m <= arr[i][0]) { const [a, za] = arr[i - 1], [b, zb] = arr[i]; return za + (zb - za) * (m - a) / (b - a || 1); }
  return arr[arr.length - 1][1];
}
function interpStrict(arr, m) { if (!arr || !arr.length || m < arr[0][0] || m > arr[arr.length - 1][0]) return null; return interp(arr, m); }
function refZ(key, m) { const P = D.perfis[key] || {}; const g = interpStrict(P.greide, m); if (g != null) return g; return interp(P.tn, m); }
function perfState(key) {
  const sc = D.secoes[key];
  if (!S.perf[key]) { const r = sc.len[0]; S.perf[key] = {seg: 0, a: r[0], b: r[1]}; }
  return S.perf[key];
}
function perfilCard(key) {
  const sc = D.secoes[key]; if (!sc) return '';
  const st = perfState(key), C = MAPCFG[key];
  const segName = r => { const s = (C.streets || []).find(x => r[0] >= x[0] - 1 && r[1] <= x[1] + 1); return s ? s[2] : `Est. ${estStr(r[0])} a ${estStr(r[1])}`; };
  const P = D.perfis[key] || {};
  const has = (P.tn && P.tn.length) || (P.greide && P.greide.length);
  return `<section class="card" id="perfCard">
    <div class="card-h"><h2>Perfil, camadas e quantitativos</h2><span class="sp muted" style="font-size:13px">Arraste no perfil para escolher um trecho</span></div>
    ${sc.len.length > 1 ? `<div class="maptools" style="margin:0 0 10px">${sc.len.map((r, i) => `<button class="chip" data-pseg="${i}" aria-pressed="${st.seg === i}">${esc(segName(r))}</button>`).join('')}</div>` : ''}
    <div class="legend" style="margin-bottom:6px"><span><i class="sw" style="background:#9a6b3f"></i>Terreno natural (levantamento)</span><span><i class="sw" style="background:var(--accent)"></i>Greide de projeto</span><span><i class="sw" style="background:var(--warn)"></i>Trecho selecionado</span></div>
    <div class="tbl" id="perfSvg"></div>
    <p class="note" id="perfNote">${has ? '' : 'Sem levantamento topográfico deste trecho nos arquivos recebidos: as camadas aparecem sobre uma linha de referência plana.'}${P.fonte ? ' ' + esc(P.fonte) : P.greide && P.greide.length ? ' Greide pelos PIVs do projeto (curvas verticais simplificadas).' : (P.tn && P.tn.length ? ' O greide de projeto ainda não foi enviado; as camadas aparecem apoiadas no terreno levantado.' : '')} As camadas estão fora de escala vertical para ficarem legíveis; passe o mouse para ver espessura e preço.</p>
    <div class="fgrid" style="margin-top:6px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      <label class="f">Estaca inicial<input id="pf_a" value="${estStr(st.a)}"></label>
      <label class="f">Estaca final<input id="pf_b" value="${estStr(st.b)}"></label>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div style="min-width:0"><h3 style="margin-bottom:8px">Material para executar o trecho</h3><div class="tbl" id="perfQt"></div>${sc.nota ? `<p class="note">${esc(sc.nota)}</p>` : ''}</div>
      <div style="min-width:0"><h3 style="margin-bottom:8px">Raio-X 3D do trecho <span class="muted" style="font-size:12.5px;font-weight:400">arraste para girar · botão direito, Shift ou dois dedos para mover · role para aproximar · duplo clique para centralizar</span></h3>
        <div id="p3d" style="position:relative;height:440px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;overflow:hidden"></div>
        <div class="maptools" style="margin-top:8px"><label class="walk">Percorrer<input type="range" id="p3walk" aria-label="Percorrer o trecho"><span id="p3walkLb" class="mono"></span></label><button class="chip" id="p3dExplode" aria-pressed="${P3.explode}">Separar camadas</button></div><p class="note" style="margin-top:6px">Espessuras ampliadas 6× e relevo 2× para leitura. Camadas mais claras = a executar. No Raio-X o pavimento fica transparente e a drenagem do projeto aparece em azul; clique numa caixa para abrir a ficha. No eixo da via, a <b style="color:#0047ff">linha azul</b> é o greide de projeto e o <b style="color:#ff1a1a">tracejado vermelho</b> é o terreno natural. Setas ou WASD também andam pelo trecho.</p>
      </div>
    </div>
  </section>`;
}
function layerCoverage(key, code, a, b, lados) {
  const recs = mapLayers(key).all.filter(r => r.item === code && r.fim > r.ini);
  if (b <= a) return 0;
  const frac = side => { const iv = recs.filter(r => !side || !r.lado || r.lado === side).map(r => [Math.max(a, r.ini), Math.min(b, r.fim)]).filter(x => x[1] > x[0]).sort((x, y) => x[0] - y[0]); let tot = 0, cur = null; iv.forEach(x => { if (!cur || x[0] > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = x.slice(); } else cur[1] = Math.max(cur[1], x[1]); }); if (cur) tot += cur[1] - cur[0]; return tot / (b - a); };
  return lados === 2 ? (frac('LE') + frac('LD')) / 2 : frac('');
}
function perfQuant(key) {
  const st = perfState(key), sc = secFor(key, st.seg), Lm = Math.max(0, st.b - st.a);
  let rows = '', tot = 0, totExe = 0;
  sc.grupos.forEach(g => {
    const n = g.lados || 1, wm = wMean(key, g, st.a, st.b), area = wm * Lm * n;
    rows += `<tr class="grp" style="cursor:default"><td colspan="6">${esc(g.nome)} <span class="muted" style="font-weight:400">· ${NUM(wm, 2)} m${n > 1 ? ' por lado' : ''}${(g.faixas || []).length && Math.abs(wm - g.larg) > .005 ? ' em média no trecho' : ''} · ${NUM(area, 0)} m²</span></td></tr>`;
    g.camadas.forEach(c => {
      const m3 = /3|³/.test(c.un), qtd = m3 ? area * c.esp : area, custo = qtd * (m3 ? c.custo : c.pu);
      const ex = layerCoverage(key, c.cod, st.a, st.b, n);
      tot += custo; totExe += custo * ex;
      rows += `<tr><td><i class="sw" style="background:${LCOL[c.cor] || '#999'};vertical-align:-1px"></i> ${esc(c.nome)}<div class="muted mono" style="font-size:11px">${c.cod}${c.capCod ? ' + CAP ' + c.capCod : ''}${c.esp ? ' · ' + NUM(c.esp * 100) + ' cm' : ''}</div></td>
        <td class="r">${NUM(qtd, 1)} ${m3 ? 'm³' : 'm²'}</td><td class="r">${BRL(m3 ? c.custo : c.pu)}<div class="muted" style="font-size:11px">por ${m3 ? 'm³' : 'm²'}</div></td><td class="r">${BRL(custo)}</td>
        <td class="r">${PCT(ex, 0)}<span class="bar-mini"><i style="width:${ex * 100}%"></i></span></td><td class="r">${BRL(custo * (1 - ex))}</td></tr>`;
    });
  });
  (sc.mf || []).forEach(c => { const len = Lm * 2, custo = len * c.pu * (c.q / (sc.mf.reduce((a, x) => a + x.q, 0) || 1)); const ex = layerCoverage(key, c.cod, st.a, st.b, 2); tot += custo; totExe += custo * ex;
    rows += `<tr><td>${esc(c.nome)}<div class="muted mono" style="font-size:11px">${c.cod} · rateado pela quantidade prevista</div></td><td class="r">${NUM(len * (c.q / (sc.mf.reduce((a, x) => a + x.q, 0) || 1)), 0)} m</td><td class="r">${BRL(c.pu)}<div class="muted" style="font-size:11px">por m</div></td><td class="r">${BRL(custo)}</td><td class="r">${PCT(ex, 0)}</td><td class="r">${BRL(custo * (1 - ex))}</td></tr>`; });
  $('#perfQt').innerHTML = `<div class="muted" style="margin-bottom:6px">Trecho Est. <b class="mono" style="color:var(--fg)">${estStr(st.a)}</b> a <b class="mono" style="color:var(--fg)">${estStr(st.b)}</b> · ${NUM(Lm, 1)} m</div>
    <table style="min-width:640px"><thead><tr><th>Camada</th><th class="r">Quantidade</th><th class="r">Preço unit.</th><th class="r">Custo</th><th class="r">Executado</th><th class="r">A executar</th></tr></thead>
    <tbody>${rows}<tr><td><b>Total do trecho</b></td><td></td><td></td><td class="r"><b>${BRL(tot)}</b></td><td class="r">${tot ? PCT(totExe / tot, 0) : '—'}</td><td class="r"><b>${BRL(tot - totExe)}</b></td></tr></tbody></table>
    <p class="note">Preços unitários com BDI do BM ${BMN}; no CBUQ o custo por m³ inclui o CAP (item indicado). Executado pela memória de cálculo e lançamentos de campo no trecho.</p>`;
}
function drawPerfil(key) {
  const el = $('#perfSvg'); if (!el) return;
  const st = perfState(key), sc = secFor(key, st.seg), R0 = sc.len[st.seg], P = D.perfis[key] || {};
  const [a0, b0] = R0;
  const W = 1000, LBL = 92, RT = 14, T = 16, PH = 170, LH = 17;
  const lay = sc.grupos[0].camadas.filter(c => c.esp > 0);
  const H = T + PH + 18 + lay.length * LH + 30;
  const xs = []; for (let m = a0; m <= b0 + .01; m += Math.max(2, (b0 - a0) / 200)) xs.push(m);
  const tn = xs.map(m => [m, interp(P.tn, m)]).filter(p => p[1] != null);
  const gr = xs.map(m => [m, interpStrict(P.greide, m)]).filter(p => p[1] != null);
  const zs = tn.concat(gr).map(p => p[1]);
  let zmin = zs.length ? Math.min(...zs) : 0, zmax = zs.length ? Math.max(...zs) : 1; if (zmax - zmin < 2) { const c = (zmax + zmin) / 2; zmin = c - 1; zmax = c + 1; } zmin -= .6; zmax += .6;
  const X = m => LBL + (W - LBL - RT) * (m - a0) / (b0 - a0 || 1), Y = z => T + PH * (1 - (z - zmin) / (zmax - zmin));
  const ref = m => { const z = refZ(key, m); return z == null ? (zmin + zmax) / 2 : z; };
  let s = '';
  const zstep = (zmax - zmin) > 12 ? 5 : (zmax - zmin) > 5 ? 2 : 1;
  for (let z = Math.ceil(zmin / zstep) * zstep; z <= zmax; z += zstep) s += `<line x1="${LBL}" x2="${W - RT}" y1="${Y(z)}" y2="${Y(z)}" stroke="var(--line)"/><text class="ax" x="${LBL - 6}" y="${Y(z) + 4}" text-anchor="end">${z} m</text>`;
  const stp = (b0 - a0) > 1000 ? 200 : (b0 - a0) > 300 ? 100 : 20;
  for (let m = Math.ceil(a0 / stp) * stp; m <= b0 + .01; m += stp) s += `<line x1="${X(m)}" x2="${X(m)}" y1="${T}" y2="${T + PH}" stroke="var(--line)"/><text class="ax" x="${X(m)}" y="${T + PH + 13}" text-anchor="middle">${estStr(m)}</text>`;
  // selection
  const sa = Math.max(a0, st.a), sb = Math.min(b0, st.b);
  s += `<rect id="pfSel" x="${X(sa)}" y="${T}" width="${Math.max(0, X(sb) - X(sa))}" height="${H - T - 8}" fill="var(--warn)" opacity=".13"/><line id="pfSa" x1="${X(sa)}" x2="${X(sa)}" y1="${T}" y2="${H - 8}" stroke="var(--warn)" stroke-width="1.5"/><line id="pfSb" x1="${X(sb)}" x2="${X(sb)}" y1="${T}" y2="${H - 8}" stroke="var(--warn)" stroke-width="1.5"/>`;
  if (tn.length) { const d = tn.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(''); s += `<path d="${d} L${X(tn[tn.length - 1][0])},${T + PH} L${X(tn[0][0])},${T + PH}Z" fill="#9a6b3f" opacity=".18"/><path d="${d}" fill="none" stroke="#9a6b3f" stroke-width="2"><title>Terreno natural (levantamento topográfico)</title></path>`; }
  if (gr.length) { const d = gr.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(''); s += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.4"><title>Greide de projeto</title></path>`; (P.piv || P.greide || []).filter(p => p[0] >= a0 && p[0] <= b0).forEach(p => { s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="var(--accent)"><title>PIV Est. ${estStr(p[0])} · cota ${NUM(p[1], 3)} m</title></circle>`; }); }
  // layer bands (schematic) below the plot, following station
  const by = T + PH + 22;
  lay.forEach((c, li) => {
    const y = by + li * LH;
    s += `<text class="ax" x="${LBL - 6}" y="${y + 12}" text-anchor="end" style="font-size:10.5px">${esc(c.nome.replace('Base / sub-base ', '').replace('Regularização do ', '').slice(0, 13))}</text>`;
    // executed runs
    const recs = mapLayers(key).all.filter(r => r.item === c.cod && r.fim > r.ini);
    s += `<rect x="${LBL}" y="${y}" width="${W - LBL - RT}" height="${LH - 2}" fill="${LCOL[c.cor]}" opacity=".28" data-lay="${li}"/>`;
    recs.forEach(r => { const xa = X(Math.max(a0, r.ini)), xb = X(Math.min(b0, r.fim)); if (xb > xa) s += `<rect x="${xa}" y="${r.lado === 'LD' ? y + (LH - 2) / 2 : y}" width="${xb - xa}" height="${r.lado ? (LH - 2) / 2 : LH - 2}" fill="${LCOL[c.cor]}" data-lay="${li}"/>`; });
  });
  s += `<rect id="pfHit" x="${LBL}" y="${T}" width="${W - LBL - RT}" height="${H - T - 8}" fill="transparent" style="cursor:crosshair"/>`;
  el.innerHTML = `<svg id="pfS" viewBox="0 0 ${W} ${H}" style="min-width:680px;touch-action:none" role="img" aria-label="Perfil longitudinal com terreno, greide e camadas">${s}</svg><div id="pfTip" hidden style="position:fixed;z-index:30;pointer-events:none;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;font-size:12.5px;max-width:280px;box-shadow:0 6px 20px rgba(0,0,0,.25)"></div>`;
  const svg = $('#pfS'), tip = $('#pfTip');
  const toM = ev => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return {m: a0 + (q.x - LBL) / (W - LBL - RT) * (b0 - a0), y: q.y}; };
  let drag = null;
  svg.addEventListener('pointerdown', ev => { const {m} = toM(ev); drag = Math.max(a0, Math.min(b0, m)); svg.setPointerCapture(ev.pointerId); });
  svg.addEventListener('pointermove', ev => {
    const {m, y} = toM(ev), mm = Math.max(a0, Math.min(b0, m));
    if (drag != null) { st.a = Math.round(Math.min(drag, mm)); st.b = Math.round(Math.max(drag, mm)); if (st.b - st.a < 2) st.b = Math.min(b0, st.a + 2); $('#pf_a').value = estStr(st.a); $('#pf_b').value = estStr(st.b);
      const xa = X(st.a), xb = X(st.b); $('#pfSel').setAttribute('x', xa); $('#pfSel').setAttribute('width', Math.max(0, xb - xa)); ['x1', 'x2'].forEach(k => { $('#pfSa').setAttribute(k, xa); $('#pfSb').setAttribute(k, xb); }); tip.hidden = true; return; }
    const li = Math.floor((y - by) / LH);
    let html = '';
    if (y >= by && li >= 0 && li < lay.length) {
      const c = lay[li], m3 = /3|³/.test(c.un);
      const done = mapLayers(key).all.some(r => r.item === c.cod && mm >= r.ini && mm <= r.fim);
      html = `<b>${esc(c.nome)}</b><br>Espessura ${NUM(c.esp * 100)} cm · ${esc(D.secoes[key].grupos[0].nome)} ${NUM(D.secoes[key].grupos[0].larg)} m<br>${BRL(m3 ? c.custo : c.pu)} por ${m3 ? 'm³' : 'm²'}${c.capCod ? ' (com CAP)' : ''}<br>Est. ${estStr(Math.round(mm))}: <b style="color:${done ? 'var(--accent)' : 'var(--warn)'}">${done ? 'executado' : 'a executar'}</b><br><span class="muted">Previsto no contrato ${NUM(c.q, 1)} ${esc(c.un)} · executado ${NUM(c.aq, 1)}</span>`;
    } else if (y <= T + PH) {
      const zt = interp(P.tn, mm), zg = interpStrict(P.greide, mm);
      html = `<b>Est. ${estStr(Math.round(mm))}</b>${zt != null ? `<br>Terreno natural: ${NUM(zt, 2)} m` : ''}${zg != null ? `<br>Greide: ${NUM(zg, 2)} m` : ''}${zt != null && zg != null ? `<br>${zg >= zt ? 'Aterro' : 'Corte'}: ${NUM(Math.abs(zg - zt), 2)} m` : ''}${zt == null && zg == null ? '<br>Sem cota neste ponto' : ''}`;
    }
    if (html) { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(window.innerWidth - 290, ev.clientX + 14) + 'px'; tip.style.top = (ev.clientY + 14) + 'px'; } else tip.hidden = true;
  });
  const end = () => { if (drag != null) { drag = null; perfQuant(key); draw3D(key); } };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  const ia = $('#pf_a'), ib = $('#pf_b'); if (ia) { ia.value = estStr(st.a); ib.value = estStr(st.b); }
  perfQuant(key); draw3D(key);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pseg]'); if (b) { const key = S.tab, sc = D.secoes[key], i = +b.dataset.pseg; S.perf[key] = {seg: i, a: sc.len[i][0], b: sc.len[i][1]}; document.querySelectorAll('[data-pseg]').forEach(x => x.setAttribute('aria-pressed', x === b)); drawPerfil(key); return; }
  if (e.target.closest('#p3dExplode')) { const t = e.target.closest('#p3dExplode'); const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); P3.explode = on; draw3D(S.tab); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'pf_a' || e.target.id === 'pf_b') {
    const key = S.tab, st = perfState(key), sc = D.secoes[key];
    const a = parseEst($('#pf_a').value), b = parseEst($('#pf_b').value);
    if (!isNaN(a) && !isNaN(b) && b > a) { const i = sc.len.findIndex(r => a >= r[0] - 1 && a <= r[1] + 1); if (i >= 0) st.seg = i; const r = sc.len[st.seg]; st.a = Math.max(r[0], a); st.b = Math.min(r[1], b); drawPerfil(key); }
  }
});
/* 3D · raio-X do trecho */
const P3 = {explode: false, xray: true, alive: null, focus: null, view: null};
const DCOL = {aduela: 0x3f8fd8, tubo: 0x5cb6ee, lig: 0x7fc6f2, bl: 0x9fd4f7, cx: 0x2a6fb0, pend: 0xe8705a};
async function draw3D(key) {
  const host = $('#p3d'); if (!host) return;
  if (P3.alive) { P3.alive(); P3.alive = null; }
  host.innerHTML = '<div style="display:grid;place-items:center;height:100%" class="muted">Carregando 3D…</div>';
  try { await loadThree(); } catch (e) { host.innerHTML = '<div style="display:grid;place-items:center;height:100%" class="muted">Não foi possível carregar o 3D.</div>'; return; }
  const T = window.THREE, st = perfState(key), sc = secFor(key, st.seg), G = D.geos[key], NET = DREN[key];
  const cl = G.cl.filter(c => c[0] >= st.a - .5 && c[0] <= st.b + .5);
  if (cl.length < 2) { host.innerHTML = '<div style="display:grid;place-items:center;height:100%" class="muted">Selecione um trecho com traçado.</div>'; return; }
  const step = Math.max(1, Math.floor(cl.length / 140)); let smp = cl.filter((c, i) => i % step === 0 || i === cl.length - 1);
  // alças e ramos ligados ao trecho escolhido (ex.: alça E14000 do Eixo 5.000)
  const smp0 = smp, extras = [], extrasR = [];
  const cur0 = sc.len[st.seg] || [st.a, st.b], fullSeg = Math.abs(st.a - cur0[0]) < 1 && Math.abs(st.b - cur0[1]) < 1;
  sc.len.forEach((r, i) => { if (i === st.seg) return; const ec = G.cl.filter(c => c[0] >= r[0] - .5 && c[0] <= r[1] + .5); if (ec.length < 2) return; if (!fullSeg && !ec.some(c => smp0.some(q => Math.hypot(q[1] - c[1], q[2] - c[2]) < 45))) return; const stp = Math.max(1, Math.floor(ec.length / 100)), arr = ec.filter((c, k) => k % stp === 0 || k === ec.length - 1); arr._seg = i; extras.push(arr); extrasR.push(r); });
  const VEX = 2, LEX = 6;
  const z0 = (() => { const zs = smp.map(c => refZ(key, c[0])).filter(z => z != null); return zs.length ? Math.min(...zs) : 0; })();
  const cx = smp.reduce((a, c) => a + c[1], 0) / smp.length, cy = smp.reduce((a, c) => a + c[2], 0) / smp.length;
  const nrm = i => { const a = smp[Math.max(0, i - 1)], b = smp[Math.min(smp.length - 1, i + 1)]; const dx = b[1] - a[1], dy = b[2] - a[2], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  const curR = sc.len[st.seg] || [st.a, st.b], mainCl = G.cl.filter(c => c[0] >= curR[0] - .5 && c[0] <= curR[1] + .5);
  const nearZ = c => { const q = mainCl.reduce((b, k) => Math.hypot(k[1] - c[1], k[2] - c[2]) < Math.hypot(b[1] - c[1], b[2] - c[2]) ? k : b, mainCl[0]); const z = refZ(key, q[0]); return z == null ? z0 : z; };
  const extraZ = extras.map(e => ({m0: e[0][0], m1: e[e.length - 1][0], za: nearZ(e[0]), zb: nearZ(e[e.length - 1])}));
  const surf = m => { const z = refZ(key, m); if (z != null) return z; const x = extraZ.find(q => m >= q.m0 - 1 && m <= q.m1 + 1); return x ? x.za + (x.zb - x.za) * (m - x.m0) / ((x.m1 - x.m0) || 1) : z0; };
  const zAt = m => (surf(m) - z0) * VEX;
  const center = sc.grupos.find(g => g.off === 0), STK = center ? sum(center.camadas, c => c.esp) : .4;
  const DVX = 1.3, D3 = d => d <= 0 ? d * VEX : d <= STK ? d * LEX : STK * LEX + (d - STK) * DVX;   // real depth → scene depth
  const yEl = (m, el) => zAt(m) - D3(surf(m) - el);
  host.innerHTML = '';
  const r = new T.WebGLRenderer({antialias: true, alpha: true}); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); host.appendChild(r.domElement);
  r.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:none;outline:none';
  r.domElement.tabIndex = 0; r.domElement.setAttribute('aria-label', 'Vista 3D do trecho. Arraste para girar, botão direito ou dois dedos para mover, setas ou WASD para andar.');
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, .3, 6000);
  scene.add(new T.AmbientLight(0xffffff, .62)); const dl = new T.DirectionalLight(0xffffff, .65); dl.position.set(60, 120, 40); scene.add(dl);
  const meshes = [], layerMeshes = [], drenMeshes = [];
  const cov = (code, m, side) => mapLayers(key).all.some(r => r.item === code && m >= r.ini && m <= r.fim && (!side || !r.lado || r.lado === side));
  const opa = ex => P3.xray ? (ex ? .3 : .12) : (ex ? 1 : .35);
  const slab = (u0, u1, d0, d1, col, info, code, side) => {
    let run = null; const runs = [];
    smp.forEach((c, i) => { const ex = cov(code, c[0], side); if (!run || run.ex !== ex) { if (run) run.idx.push(i); run = {ex, idx: [i]}; runs.push(run); } else run.idx.push(i); });
    runs.forEach(rn => {
      if (rn.idx.length < 2) return;
      const pos = [], ind = [];
      rn.idx.forEach((i, k) => {
        const c = smp[i], n = nrm(i), z = zAt(c[0]), ex = P3.explode ? info.gap : 0;
        const P = (u, d) => [c[1] - cx + n[0] * u, z - d * LEX - ex, c[2] - cy + n[1] * u];
        const a0 = typeof u0 === 'function' ? u0(c[0]) : u0, a1 = typeof u1 === 'function' ? u1(c[0]) : u1;
        [P(a0, d0), P(a1, d0), P(a1, d1), P(a0, d1)].forEach(p => pos.push(...p));
        if (k) { const b = (k - 1) * 4, a = k * 4; [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([p, q]) => ind.push(b + p, a + p, a + q, b + p, a + q, b + q)); }
      });
      const n = rn.idx.length; ind.push(0, 1, 2, 0, 2, 3); const e = (n - 1) * 4; ind.push(e, e + 2, e + 1, e, e + 3, e + 2);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals();
      const o = opa(rn.ex), mat = new T.MeshLambertMaterial({color: col, transparent: o < 1, opacity: o, side: T.DoubleSide, depthWrite: o >= 1});
      const mesh = new T.Mesh(g, mat); mesh.userData = Object.assign({ex: rn.ex}, info); scene.add(mesh); meshes.push(mesh); layerMeshes.push(mesh);
    });
  };
  [smp0, ...extras].forEach(path => { smp = path; const scP = path._seg != null ? secFor(key, path._seg) : sc, centerP = scP.grupos.find(g => g.off === 0);
  let outerF = m => centerP ? wAt(key, centerP, m) / 2 : 0;
  scP.grupos.forEach(g => {
    const o0 = outerF, gl = g.larg;
    const bands = g.off === 0 ? [[m => -wAt(key, g, m) / 2, m => wAt(key, g, m) / 2, '']] : [[m => o0(m) + .15, m => o0(m) + .15 + gl, 'LE'], [m => -o0(m) - .15 - gl, m => -o0(m) - .15, 'LD']];
    if (g.off !== 0) outerF = m => o0(m) + .15 + gl;
    let d = 0;
    g.camadas.forEach((c, li) => {
      const e = Math.max(c.esp, .012);
      bands.forEach(([u0, u1, side]) => slab(u0, u1, d, d + e, LCOL[c.cor] || '#999', {nome: c.nome, grupo: g.nome, esp: c.esp, custo: /3|³/.test(c.un) ? c.custo : c.pu, un: /3|³/.test(c.un) ? 'm³' : 'm²', cap: !!c.capCod, gap: li * .9, cod: c.cod}, c.cod, side));
      d += e;
    });
  });
  // terreno (barro)
  const P = D.perfis[key] || {};
  if (P.tn && P.tn.length) {
    const half = outerF(st.a) + 18, pos = [], ind = [];
    smp.forEach((c, i) => { const n = nrm(i), z = interp(P.tn, c[0]); const zz = ((z == null ? surf(c[0]) - .3 : z) - z0) * VEX - .6; pos.push(c[1] - cx + n[0] * half, zz, c[2] - cy + n[1] * half, c[1] - cx - n[0] * half, zz, c[2] - cy - n[1] * half); if (i) { const b = (i - 1) * 2, a = i * 2; ind.push(b, a, a + 1, b, a + 1, b + 1); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals();
    const tm = new T.Mesh(g, new T.MeshLambertMaterial({color: LCOL.sub, transparent: true, opacity: .3, side: T.DoubleSide, depthWrite: false})); tm.userData = {terreno: true}; tm.visible = !P3.xray; scene.add(tm); meshes.push(tm);
  }
  });
  smp = smp0;
  // ---------- linhas de referência no eixo: greide (azul) e terreno natural (vermelho tracejado) ----------
  {
    const PF = D.perfis[key] || {};
    const li = (arr, m) => { if (!arr || arr.length < 2 || m < arr[0][0] - .5 || m > arr[arr.length - 1][0] + .5) return null; let k = 1; while (k < arr.length - 1 && arr[k][0] < m) k++; const a = arr[k - 1], b = arr[k]; if (b[0] - a[0] > 60 && !(m >= a[0] && m <= b[0] && b[0] - a[0] <= 60)) return null; return a[1] + (b[1] - a[1]) * (m - a[0]) / ((b[0] - a[0]) || 1); };
    const mkLine = (arr, col, dash, info) => {
      const mat = new T.MeshBasicMaterial({color: col, depthTest: false, transparent: true, opacity: .97});
      const add = g => { const mm = new T.Mesh(g, mat); mm.renderOrder = 10; mm.userData = info; scene.add(mm); meshes.push(mm); };
      [smp0, ...extras].forEach(path => {
        const runs = []; let cur = [];
        path.forEach(c => { const z = li(arr, c[0]); if (z == null) { if (cur.length > 1) runs.push(cur); cur = []; return; } cur.push(new T.Vector3(c[1] - cx, (z - z0) * VEX + .1, c[2] - cy)); });
        if (cur.length > 1) runs.push(cur);
        runs.forEach(pts => {
          const curve = new T.CatmullRomCurve3(pts);
          if (!dash) { add(new T.TubeGeometry(curve, Math.min(600, pts.length * 3), .16, 8, false)); return; }
          const L = curve.getLength(), DS = 2.2, GP = 1.5;
          for (let s0 = 0; s0 < L; s0 += DS + GP) { const a = s0 / L, b = Math.min(1, (s0 + DS) / L), sub = []; for (let q = 0; q <= 4; q++) sub.push(curve.getPointAt(a + (b - a) * q / 4)); add(new T.TubeGeometry(new T.CatmullRomCurve3(sub), 4, .13, 6, false)); }
        });
      });
    };
    if (PF.greide && PF.greide.length > 1) mkLine(PF.greide, 0x0047ff, false, {dren: true, nome: 'Greide de projeto', sub: 'linha azul no eixo da via'});
    if (PF.tn && PF.tn.length > 1) mkLine(PF.tn, 0xff1a1a, true, {dren: true, nome: 'Terreno natural', sub: 'tracejado vermelho no eixo da via'});
  }
  // ---------- drenagem do projeto (seções em escala real) ----------
  if (NET) {
    const inR = m => (m >= st.a - 6 && m <= st.b + 6) || extrasR.some(r => m >= r[0] - 6 && m <= r[1] + 6);
    const fprof = NET.nodes.filter(n => n.F != null && Math.abs(n.off || 0) < 8).map(n => [n.est, n.F]).sort((a, b) => a[0] - b[0]);
    const Fat = m => { if (!fprof.length) return surf(m) - 2; if (m <= fprof[0][0]) { const [a, fa] = fprof[0], [b, fb] = fprof[1] || fprof[0]; return fa + (fb - fa) * (m - a) / ((b - a) || 1); } return interp(fprof, m); };
    const smooth = pts => {
      if (pts.length < 3) return pts;
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const L = cum[cum.length - 1], n = Math.max(2, Math.round(L)), out = []; let j = 0;
      for (let k = 0; k <= n; k++) { const sv = L * k / n; while (j < cum.length - 2 && cum[j + 1] < sv) j++; const t = (sv - cum[j]) / ((cum[j + 1] - cum[j]) || 1), a = pts[j], b = pts[j + 1]; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
      const W = 4; return out.map((q, i) => { if (!i || i === out.length - 1) return q; let sx = 0, sy = 0, c = 0; for (let k = Math.max(0, i - W); k <= Math.min(out.length - 1, i + W); k++) { sx += out[k][0]; sy += out[k][1]; c++; } return [sx / c, sy / c, q[2]]; });
    };
    const acc = () => ({pos: [], ind: []});
    const quad = (Gm, a, b, c, d) => { const o = Gm.pos.length / 3; [a, b, c, d].forEach(v => Gm.pos.push(v[0], v[1], v[2])); Gm.ind.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    const emit = (Gm, col, info, extra) => { if (!Gm.pos.length) return; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(Gm.pos, 3)); g.setIndex(Gm.ind); g.computeVertexNormals(); const mm = new T.Mesh(g, new T.MeshLambertMaterial(Object.assign({color: col, side: T.DoubleSide}, extra || {}))); mm.userData = info; scene.add(mm); meshes.push(mm); drenMeshes.push(mm); };
    const frames = (pts, baseEl) => pts.map((q, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, m = Math.max(0, q[2]); return {x: q[0] - cx, z: q[1] - cy, nx: dy / l, nz: -dx / l, tx: dx / l, tz: dy / l, y: yEl(m, baseEl(m))}; });
    const sweep = (Gm, F, u0, u1, v0, v1) => { const P = (f, u, v) => [f.x + f.nx * u, f.y + v, f.z + f.nz * u]; for (let k = 1; k < F.length; k++) { const A = F[k - 1], B = F[k]; quad(Gm, P(A, u0, v1), P(B, u0, v1), P(B, u1, v1), P(A, u1, v1)); quad(Gm, P(A, u0, v0), P(A, u1, v0), P(B, u1, v0), P(B, u0, v0)); quad(Gm, P(A, u0, v0), P(B, u0, v0), P(B, u0, v1), P(A, u0, v1)); quad(Gm, P(A, u1, v0), P(A, u1, v1), P(B, u1, v1), P(B, u1, v0)); } };
    const ring = (Gm, f, w, h, e, th) => { const f0 = Object.assign({}, f, {x: f.x - f.tx * th, z: f.z - f.tz * th}), f1 = Object.assign({}, f, {x: f.x + f.tx * th, z: f.z + f.tz * th}), F = [f0, f1]; sweep(Gm, F, -w - e, w + e, -e, 0); sweep(Gm, F, -w - e, w + e, h, h + e); sweep(Gm, F, -w - e, -w, 0, h); sweep(Gm, F, w, w + e, 0, h); };
    NET.links.forEach(l => {
      const raw = l.pts.filter(q => inR(q[2])); if (raw.length < 2) return;
      if (l.tipo === 'aduela') {
        const pts = smooth(raw), F = frames(pts, m => Fat(m) - .15), Gw = acc(), Gj = acc(), Ga = acc(), w = .9, t = .15, H = 1.8;
        sweep(Gw, F, -w, w, 0, t); sweep(Gw, F, -w, w, H - t, H); sweep(Gw, F, -w, -w + t, t, H - t); sweep(Gw, F, w - t, w, t, H - t);
        sweep(Ga, F, -w + t, w - t, t, t + .05);
        let run = 0; for (let k = 1; k < F.length; k++) { run += Math.hypot(F[k].x - F[k - 1].x, F[k].z - F[k - 1].z); if (run >= 1) { run = 0; ring(Gj, F[k], w, H, .025, .03); } }
        const info = {dren: true, nome: l.dim, sub: `Galeria celular pré-moldada · interna 1,50 × 1,50 m · paredes de 15 cm · peças de 1 m · ${NUM(l.L, 0)} m no projeto`};
        emit(Gw, 0x8fa9bf, info); emit(Gj, 0x4b6a85, info); emit(Ga, 0x2f86d6, info, {emissive: 0x0b2a4a});
      } else if (l.tipo === 'tubo') {
        const pts = smooth(raw), dm = /1500/.test(l.dim) ? 1.5 : /1200/.test(l.dim) ? 1.2 : /1000/.test(l.dim) ? 1 : /800/.test(l.dim) ? .8 : .6, ro = dm / 2 + (dm >= 1 ? .1 : .06);
        const curve = new T.CatmullRomCurve3(pts.map(q => { const m = Math.max(0, q[2]); return new T.Vector3(q[0] - cx, yEl(m, Fat(m)) + ro, q[1] - cy); }), false, 'centripetal');
        const mm = new T.Mesh(new T.TubeGeometry(curve, Math.min(800, pts.length * 3), ro, 28, false), new T.MeshLambertMaterial({color: DCOL.tubo, side: T.DoubleSide}));
        mm.userData = {dren: true, nome: l.dim, sub: `Diâmetro interno ${NUM(dm * 1000, 0)} mm · ${NUM(l.L, 0)} m no projeto`}; scene.add(mm); meshes.push(mm); drenMeshes.push(mm);
        const cap = new T.MeshLambertMaterial({color: 0x2c6e9c, side: T.DoubleSide});
        [0, 1].forEach(tt => { const pnt = curve.getPointAt(tt), tg = curve.getTangentAt(tt), rg = new T.Mesh(new T.RingGeometry(dm / 2, ro, 28), cap); rg.position.copy(pnt); rg.lookAt(pnt.clone().add(tg)); rg.userData = mm.userData; scene.add(rg); meshes.push(rg); drenMeshes.push(rg); });
      } else {
        const dm = /1000/.test(l.dim) ? 1 : .8, r0 = dm / 2 + .05;
        const curve = new T.LineCurve3(...raw.slice(0, 2).map(q => { const m = Math.max(0, q[2]); return new T.Vector3(q[0] - cx, yEl(m, surf(m) - 1.6) + r0, q[1] - cy); }));
        const mm = new T.Mesh(new T.TubeGeometry(curve, 8, r0, 18, false), new T.MeshLambertMaterial({color: DCOL.lig, side: T.DoubleSide})); mm.userData = {dren: true, nome: l.dim, sub: `${NUM(l.L, 1)} m`}; scene.add(mm); meshes.push(mm); drenMeshes.push(mm);
      }
    });
    NET.nodes.forEach(n => {
      if (n.est == null || !inR(n.est) || n.tipo === 'MURO') return;
      const m = Math.max(0, n.est), top = n.T != null ? n.T : surf(m), bot = n.F != null ? n.F - .2 : top - 1.8;
      const ac = n.tipo === 'CX' ? (/1,50/.test(n.nome) ? 1.8 : 1.5) : n.tipo === 'BOCA' ? 1.2 : 1.0, al = n.tipo === 'CX' ? ac : n.tipo === 'BOCA' ? 1.2 : 1.4;
      const yt = yEl(m, top), yb = yEl(m, bot), h = Math.max(.6, yt - yb), stt = nodeState(key, n.id);
      const i = smp.reduce((bi, c, k) => Math.abs(c[0] - m) < Math.abs(smp[bi][0] - m) ? k : bi, 0), nn = nrm(i), rot = Math.atan2(-nn[1], nn[0]);
      const info = {dren: true, node: n.id, nome: n.nome, sub: [n.T != null ? 'topo ' + NUM(n.T, 2) : '', n.F != null ? 'fundo ' + NUM(n.F, 2) : '', n.h != null ? 'prof. ' + NUM(n.h, 2) + ' m' : '', stt.fotos ? stt.fotos + ' foto(s)' : '', stt.pend ? stt.pend + ' pendência(s)' : ''].filter(Boolean).join(' · ')};
      const body = new T.Mesh(new T.BoxGeometry(ac, h, al), new T.MeshLambertMaterial({color: stt.pend ? DCOL.pend : 0xb7c4ce, emissive: stt.pend ? 0x551a10 : 0x000000}));
      body.position.set(n.x - cx, yb + h / 2, n.y - cy); body.rotation.y = rot; body.userData = info;
      const lid = new T.Mesh(new T.BoxGeometry(ac * .78, .07, al * .7), new T.MeshLambertMaterial({color: n.tipo === 'CX' ? 0x55606a : 0x2b3136}));
      lid.position.set(n.x - cx, yt + .04, n.y - cy); lid.rotation.y = rot; lid.userData = info;
      [body, lid].forEach(o => { scene.add(o); meshes.push(o); drenMeshes.push(o); });
    });
  }
  // ---------- câmera e navegação livre ----------
  const bx = new T.Box3(); meshes.forEach(m => bx.expandByObject(m)); const size = bx.getSize(new T.Vector3()), ctr = bx.getCenter(new T.Vector3());
  const home = {th: -0.9, ph: 0.95, dist: Math.min(Math.max(size.x, size.z, size.y * 1.5) * 1.35 + 20, 2500), tgt: ctr.clone()};
  let th = home.th, ph = home.ph, dist = home.dist; const tgt = home.tgt.clone(); let anim = null;
  if (P3.view && P3.view.key === key) { ({th, ph, dist} = P3.view); tgt.copy(P3.view.tgt); }
  if (NET && P3.focus && P3.focus.key === key) { const n = nodeById(key, P3.focus.id); const mm = drenMeshes.find(x => x.userData.node === P3.focus.id); if (n && mm) { tgt.copy(mm.position); dist = 28; ph = .9; } P3.focus = null; }
  const place = () => { cam.position.set(tgt.x + dist * Math.sin(ph) * Math.cos(th), tgt.y + dist * Math.cos(ph), tgt.z + dist * Math.sin(ph) * Math.sin(th)); cam.lookAt(tgt); P3.view = {key, th, ph, dist, tgt: tgt.clone()}; };
  const sizeR = () => { const w = host.clientWidth || 500, h = host.clientHeight || 380; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  sizeR(); place();
  const pan = (dx, dy) => { const k = dist * .0016; const right = new T.Vector3(Math.sin(th), 0, -Math.cos(th)), fwd = new T.Vector3(-Math.cos(th), 0, -Math.sin(th)); tgt.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k); };
  const tip = document.createElement('div'); tip.style.cssText = 'position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:7px 9px;font-size:12px;max-width:250px;display:none;z-index:2'; host.appendChild(tip);
  const hud = document.createElement('div'); hud.className = 'p3hud';
  hud.innerHTML = `<button class="chip" data-p3="home" title="Voltar à vista inicial">⟲ Inicial</button><button class="chip" data-p3="top" title="Ver de cima">De cima</button><button class="chip" data-p3="xray" aria-pressed="${P3.xray}" title="Pavimento transparente para ver a drenagem">Raio-X</button><button class="chip" data-p3="in" title="Aproximar" aria-label="Aproximar">+</button><button class="chip" data-p3="out" title="Afastar" aria-label="Afastar">−</button><button class="chip" data-p3="full" title="Tela cheia" aria-pressed="${host.classList.contains('full')}">${host.classList.contains('full') ? '✕ Sair' : '⛶ Tela cheia'}</button>`;
  host.appendChild(hud);
  const ray = new T.Raycaster(), mv = new T.Vector2(); let dirty = true;
  const cv = r.domElement, pts = new Map(); let g0 = null, moved = 0;
  const pick = e => { const rc = cv.getBoundingClientRect(); mv.x = (e.clientX - rc.left) / rc.width * 2 - 1; mv.y = -(e.clientY - rc.top) / rc.height * 2 + 1; ray.setFromCamera(mv, cam); return ray.intersectObjects(meshes.filter(m => m.visible))[0]; };
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, {x: e.clientX, y: e.clientY}); moved = 0; anim = null;
    g0 = {mode: (e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'orbit', th, ph, dist};
    if (pts.size === 2) { const [a, b] = [...pts.values()]; g0 = {mode: 'two', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist}; }
    cv.style.cursor = 'grabbing'; tip.style.display = 'none';
  });
  cv.addEventListener('pointermove', e => {
    const rc = cv.getBoundingClientRect();
    if (pts.has(e.pointerId) && g0) {
      const pr = pts.get(e.pointerId), dx = e.clientX - pr.x, dy = e.clientY - pr.y; pts.set(e.pointerId, {x: e.clientX, y: e.clientY}); moved += Math.abs(dx) + Math.abs(dy);
      if (g0.mode === 'two' && pts.size === 2) { const [a, b] = [...pts.values()], dd = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; dist = Math.max(4, Math.min(4000, g0.dist * g0.d / (dd || 1))); pan(mx - g0.mx, my - g0.my); g0.mx = mx; g0.my = my; }
      else if (g0.mode === 'pan') pan(dx, dy);
      else if (g0.mode === 'orbit') { th += dx * .008; ph = Math.max(.08, Math.min(1.55, ph - dy * .006)); }
      place(); dirty = true; return;
    }
    const hit = pick(e);
    if (hit && !hit.object.userData.terreno) { const u = hit.object.userData;
      tip.innerHTML = u.dren ? `<b>${esc(u.nome)}</b>${u.sub ? '<br>' + esc(u.sub) : ''}${u.node ? '<br><span class="muted">clique para abrir a ficha</span>' : ''}` : `<b>${esc(u.nome)}</b> · ${esc(u.grupo)}<br>${u.esp ? NUM(u.esp * 100) + ' cm · ' : ''}${BRL(u.custo)} por ${u.un}${u.cap ? ' (com CAP)' : ''}<br><b style="color:${u.ex ? 'var(--accent)' : 'var(--warn)'}">${u.ex ? 'Executado' : 'A executar'}</b>`;
      tip.style.display = 'block'; tip.style.left = Math.min(rc.width - 255, e.clientX - rc.left + 12) + 'px'; tip.style.top = (e.clientY - rc.top + 12) + 'px'; cv.style.cursor = u.node ? 'pointer' : 'grab'; }
    else if (hit) { tip.innerHTML = 'Terreno natural (levantamento)'; tip.style.display = 'block'; tip.style.left = (e.clientX - rc.left + 12) + 'px'; tip.style.top = (e.clientY - rc.top + 12) + 'px'; cv.style.cursor = 'grab'; }
    else { tip.style.display = 'none'; cv.style.cursor = 'grab'; }
  });
  const up = e => {
    const wasTap = pts.size === 1 && moved < 6 && g0 && g0.mode !== 'two';
    pts.delete(e.pointerId); if (pts.size < 2 && g0 && g0.mode === 'two') g0 = null; if (!pts.size) g0 = null; cv.style.cursor = 'grab';
    if (wasTap && e.type === 'pointerup') { const hit = pick(e); if (hit && hit.object.userData.node) openNode(key, hit.object.userData.node); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
  cv.addEventListener('dblclick', e => { const hit = pick(e); if (hit) { anim = {to: hit.point.clone(), d: Math.max(10, Math.min(dist, 45))}; dirty = true; } });
  cv.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(4, Math.min(4000, dist * (1 + e.deltaY * .001))); place(); dirty = true; }, {passive: false});
  cv.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(), s = 40;
    if (k === 'arrowup' || k === 'w') pan(0, s); else if (k === 'arrowdown' || k === 's') pan(0, -s); else if (k === 'arrowleft' || k === 'a') pan(s, 0); else if (k === 'arrowright' || k === 'd') pan(-s, 0);
    else if (k === 'q') th -= .08; else if (k === 'e') th += .08; else if (k === '+' || k === '=') dist = Math.max(4, dist * .88); else if (k === '-') dist = Math.min(4000, dist * 1.14); else if (k === 'r') { th = home.th; ph = home.ph; dist = home.dist; tgt.copy(home.tgt); } else return;
    e.preventDefault(); place(); dirty = true;
  });
  hud.addEventListener('click', e => {
    const b = e.target.closest('[data-p3]'); if (!b) return;
    if (b.dataset.p3 === 'home') { th = home.th; ph = home.ph; dist = home.dist; tgt.copy(home.tgt); place(); dirty = true; }
    if (b.dataset.p3 === 'top') { ph = .08; place(); dirty = true; }
    if (b.dataset.p3 === 'xray') { P3.xray = !P3.xray; draw3D(key); }
    if (b.dataset.p3 === 'in' || b.dataset.p3 === 'out') { dist = Math.max(4, Math.min(4000, dist * (b.dataset.p3 === 'in' ? .7 : 1.4))); place(); dirty = true; }
    if (b.dataset.p3 === 'full') { const on = host.classList.toggle('full'); b.setAttribute('aria-pressed', on); b.textContent = on ? '✕ Sair' : '⛶ Tela cheia'; document.body.style.overflow = on ? 'hidden' : ''; setTimeout(() => { sizeR(); dirty = true; }, 30); }
  });
  // percorrer o trecho
  const walk = $('#p3walk');
  if (walk) { walk.min = st.a; walk.max = st.b; walk.step = 1; walk.value = Math.round((st.a + st.b) / 2); walk.oninput = () => { const m = +walk.value, c = smp.reduce((p, q) => Math.abs(q[0] - m) < Math.abs(p[0] - m) ? q : p, smp[0]); tgt.set(c[1] - cx, zAt(c[0]), c[2] - cy); dist = Math.min(dist, 55); place(); dirty = true; const lb = $('#p3walkLb'); if (lb) lb.textContent = 'Est. ' + estStr(m); }; }
  const ro = new ResizeObserver(() => { sizeR(); dirty = true; }); ro.observe(host);
  let stop = false; P3.alive = () => { stop = true; ro.disconnect(); r.dispose(); };
  const loop = () => {
    if (stop || !host.isConnected) { ro.disconnect(); return; }
    if (anim) { tgt.lerp(anim.to, .18); dist += (anim.d - dist) * .18; place(); dirty = true; if (tgt.distanceTo(anim.to) < .05) anim = null; }
    if (dirty) { r.render(scene, cam); dirty = false; }
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- linear diagram ---------- */
function drawLinear(key) {
  const el = $('#lin'); if (!el) return;
  const z = Z[key];
  const recs = recsOf(key).filter(r => r.fim >= r.ini && inDom(key, r));
  const field = S.lancs.filter(l => l.frente === key && tlLanc(l)).map(l => ({item: l.item, ini: l.ini, fim: l.fim, bm: 0, txt: 'Lançamento de campo ' + dBR(l.data), campo: true}));
  const all = recs.concat(field);
  if (!all.length) { el.innerHTML = `<div class="empty-note">O BM ${BMN} não traz estacas para esta frente. Os trechos aparecem aqui assim que a equipe lançar serviços com estaca inicial e final.</div>`; return; }
  const RG = DOM[key] ? DOM[key] : [[Math.floor(Math.min(...all.map(r => r.ini)) / 100) * 100, Math.ceil((Math.max(...all.map(r => r.fim)) + 1) / 100) * 100]];
  const confs = S.conf.filter(c => c.frente === key && typeof c.ini === 'number');
  const confG = c => [...new Set((c.serv === 'item' ? [c.item] : svcItems(key, c.serv)).map(groupOf))];
  const pendL = S.rnc.filter(r => r.frente === key && isOpen(r) && typeof r.ini === 'number');
  const groups = z.groups.filter(g => all.some(r => groupOf(r.item) === g.code) || confs.some(c => confG(c).includes(g.code)));
  const W = 1000, LBL = 210, R = 16, RH = 26, T = 26, GAP = 26;
  const H = T + (groups.length + (pendL.length ? 1 : 0)) * RH + 8;
  const tot = RG.reduce((a, r) => a + (r[1] - r[0]), 0), px = (W - LBL - R - GAP * (RG.length - 1)) / tot;
  const segs = []; let acc = LBL; RG.forEach(r => { segs.push({a: r[0], b: r[1], x: acc}); acc += (r[1] - r[0]) * px + GAP; });
  const X = m => { const sg = segs.find(s => m >= s.a - 1e-6 && m <= s.b + 1e-6) || segs.reduce((p, s) => Math.abs(m - (s.a + s.b) / 2) < Math.abs(m - (p.a + p.b) / 2) ? s : p); return sg.x + (Math.max(sg.a, Math.min(sg.b, m)) - sg.a) * px; };
  let s = `<defs><pattern id="hatchL" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--water)" opacity=".35"/><rect width="2.4" height="6" fill="var(--water)"/></pattern></defs>`;
  segs.forEach((sg, si) => {
    const span = sg.b - sg.a, stepSt = span * px < 120 ? 2 : span > 1200 ? 10 : span > 400 ? 5 : 1;
    for (let m = Math.ceil(sg.a / 20) * 20; m <= sg.b + .01; m += 20 * stepSt) s += `<line x1="${X(m)}" x2="${X(m)}" y1="${T - 6}" y2="${H - 6}" stroke="var(--line)" stroke-width="1"/><text class="ax" x="${X(m)}" y="${T - 10}" text-anchor="middle">${estStr(m)}</text>`;
    if (si) s += `<text class="ax" x="${sg.x - GAP / 2}" y="${T + 10}" text-anchor="middle">//</text>`;
  });
  groups.forEach((g, gi) => {
    const y = T + gi * RH;
    s += `<text class="rowlab" x="0" y="${y + RH / 2 + 4}">${esc(title(g.name).slice(0, 30))}</text>`;
    segs.forEach(sg => { s += `<rect class="bg" x="${sg.x}" y="${y + 5}" width="${(sg.b - sg.a) * px}" height="${RH - 10}" rx="3"/>`; });
    all.filter(r => groupOf(r.item) === g.code).sort((a, b) => (a.bm || 99) - (b.bm || 99)).forEach(r => {
      const a = X(r.ini), b = X(r.fim), w = Math.max(3, b - a);
      const fill = r.campo ? 'url(#hatchL)' : r.bm === D.meta.bm ? 'var(--warn)' : 'var(--accent)';
      const it = itemName(r.item);
      s += `<rect x="${a - (w === 3 ? 1.5 : 0)}" y="${y + 5}" width="${w}" height="${RH - 10}" rx="2" fill="${fill}" opacity="${r.campo ? 1 : r.bm === D.meta.bm ? 1 : .55 + .03 * r.bm}"><title>${esc(r.item)} ${esc(it ? short(it.n) : '')}\nEst. ${estStr(r.ini)}${r.fim > r.ini ? ' a ' + estStr(r.fim) : ''}${r.bm ? ' · BM ' + r.bm : ''}\n${esc(r.txt)}${r.obs ? ' · ' + esc(r.obs) : ''}</title></rect>`;
    });
  });
  groups.forEach((g, gi) => {
    const y = T + gi * RH;
    confs.filter(c => confG(c).includes(g.code)).forEach(c => { const a = X(c.ini), b = X(cEnd(c)), w = Math.max(3, b - a); s += `<rect x="${a - (w === 3 ? 1.5 : 0)}" y="${y + RH - 9}" width="${w}" height="4" rx="1.5" fill="var(--conf)"><title>Conferido pela fiscalização · ${esc(confLabel(c))}\n${esc(trecho(c.ini, c.fim))}${c.lado ? ' · ' + esc(c.lado) : ''} · ${esc(dBR(c.data))}</title></rect>`; });
  });
  if (pendL.length) {
    const y = T + groups.length * RH;
    s += `<text class="rowlab b" x="0" y="${y + RH / 2 + 4}" style="fill:var(--danger)">Pendências não fechadas</text>`;
    segs.forEach(sg => { s += `<rect class="bg" x="${sg.x}" y="${y + 5}" width="${(sg.b - sg.a) * px}" height="${RH - 10}" rx="3" opacity=".5"/>`; });
    pendL.forEach(r => { const x0 = X(r.ini), x1 = typeof r.fim === 'number' && r.fim > r.ini ? X(r.fim) : x0, col = r.grav === 'critica' ? 'var(--danger)' : r.grav === 'alta' ? 'var(--warn)' : 'var(--water)';
      if (x1 - x0 > 4) s += `<rect x="${x0}" y="${y + 10}" width="${x1 - x0}" height="${RH - 20}" fill="${col}" opacity=".45"/>`;
      s += `<path d="M${x0},${y + 4} l6,9 l-6,9 l-6,-9z" fill="${col}" stroke="var(--surface)" stroke-width="1" style="cursor:pointer" data-go="pend"><title>${esc(r.num)} · ${esc(GRAV[r.grav] ? GRAV[r.grav][0] : '')} · ${esc(RST[r.st] || '')}\n${esc(trecho(r.ini, r.fim))}\n${esc((r.desc || '').slice(0, 140))}</title></path>`; });
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="min-width:680px" role="img" aria-label="Diagrama de serviços por estaca">${s}</svg>`;
}

/* ---------- photos ---------- */
const imgSrc = f => f.url || (BLOB + f.asset);
function photosAt(front, m) { return S.fotos.filter(f => f.frente === front && Math.abs(f.est - m) < 10).sort((a, b) => a.data.localeCompare(b.data) || (a.criado || '').localeCompare(b.criado || '')); }
function datesOf(front) { return [...new Set(S.fotos.filter(f => f.frente === front).map(f => f.data))].sort().reverse(); }
function latestDate(front) { return datesOf(front)[0] || null; }
function photoCard(f) {
  return `<button class="ph" data-ph="${esc(f.id)}"><img loading="lazy" src="${esc(imgSrc(f))}" alt="Est. ${esc(estStr(f.est))}, ${esc(dBR(f.data))}"><div class="cap"><b class="mono">Est. ${esc(estStr(f.est))}</b><span class="muted">${esc(dBR(f.data).slice(0, 5))}</span></div></button>`;
}
function viewFotos() {
  const fr = S.photoFront;
  const dates = datesOf(fr);
  if (!S.photoDate || !dates.includes(S.photoDate)) S.photoDate = dates[0] || null;
  const d = S.photoDate;
  const pts = PHOTO_POINTS[fr];
  let grid = '';
  if (!dates.length) grid = `<div class="empty-note">Ainda não há fotos desta frente. Envie as do dia na aba <b>Lançar</b>.</div>`;
  else {
    const day = S.fotos.filter(f => f.frente === fr && f.data === d).sort((a, b) => a.est - b.est);
    if (pts) {
      grid = `<div class="pgrid">${pts.map(m => { const f = day.find(x => Math.abs(x.est - m) < 10); return f ? photoCard(f) : `<div class="ph empty">Est. ${estStr(m)}<br>sem foto neste dia</div>`; }).join('')}</div>`;
      const extra = day.filter(f => !pts.some(m => Math.abs(f.est - m) < 10));
      if (extra.length) grid += `<h3 style="margin-top:20px">Outras fotos do dia</h3><div class="pgrid">${extra.map(photoCard).join('')}</div>`;
    } else grid = `<div class="pgrid">${day.map(photoCard).join('')}</div>`;
  }
  return `<section class="card">
    <div class="card-h"><h2>Fotos por data</h2>
      <label class="sp f" style="grid-template-columns:auto auto;align-items:center"><span>Frente</span><select id="pfront">${FRONT_KEYS.map(k => `<option value="${k}" ${k === fr ? 'selected' : ''}>${esc(Z[k].name)}</option>`).join('')}</select></label></div>
    ${dates.length ? `<div class="dates" role="group" aria-label="Datas">${dates.map(x => `<button class="dchip" data-date="${x}" aria-pressed="${x === d}"><span>${wd(x)}</span><b>${x.slice(8, 10)}/${x.slice(5, 7)}</b><span>${S.fotos.filter(f => f.frente === fr && f.data === x).length} fotos</span></button>`).join('')}</div>` : ''}
    ${grid}
    ${pts ? `<p class="note" style="margin-top:14px">Pontos fixos: estacas ${pts.map(estStr).join(', ')}. Ao abrir uma foto, use as setas para ver a mesma estaca em outros dias.</p>` : ''}
  </section>`;
}
document.addEventListener('change', e => { if (e.target.id === 'pfront') { S.photoFront = e.target.value; S.photoDate = null; render(); } });
document.addEventListener('click', e => {
  const dc = e.target.closest('[data-date]'); if (dc) { S.photoDate = dc.dataset.date; render(); return; }
  const ph = e.target.closest('[data-ph]');
  if (ph) { const f = S.fotos.find(x => x.id === ph.dataset.ph); if (f) { if (PHOTO_POINTS[f.frente] && PHOTO_POINTS[f.frente].some(m => Math.abs(f.est - m) < 10)) openStake(f.frente, PHOTO_POINTS[f.frente].find(m => Math.abs(f.est - m) < 10), f.id); else { const list = S.fotos.filter(x => x.frente === f.frente && x.data === f.data); openList(list, list.indexOf(f), Z[f.frente].name); } } }
});

function p360For(key, m) {
  const pts = PHOTO_POINTS[key] || [m];
  if (!pts.includes(m)) return S.p360.find(p => p.frente === key && Math.abs(p.est - m) < 1) || null;
  const cand = S.p360.filter(p => p.frente === key && Math.abs(p.est - m) <= 60);
  // each panorama belongs to the camera point closest to it
  return cand.filter(p => pts.reduce((best, q) => Math.abs(q - p.est) < Math.abs(best - p.est) ? q : best, pts[0]) === m).sort((a, b) => Math.abs(a.est - m) - Math.abs(b.est - m))[0] || null;
}
/* ---------- 360° viewer (three.js, loaded on demand) ---------- */
const panoSrc = p => p.url || (p.img ? BLOB + p.img : '');
const hasPano = p => !!(p && (p.url || p.img));
let THREEp = null;
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (!THREEp) THREEp = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = res; s.onerror = () => { THREEp = null; rej(new Error('three')); }; document.head.appendChild(s); });
  return THREEp;
}
async function mountPano(el, src) {
  el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#bfe9dc">Carregando panorama…</div>';
  try { await loadThree(); } catch (e) { el.innerHTML = '<div style="display:grid;place-items:center;height:100%">Não foi possível carregar o visualizador 360°.</div>'; return; }
  const T = window.THREE;
  let tex;
  try { tex = await new Promise((res, rej) => new T.TextureLoader().load(src, res, undefined, rej)); } catch (e) { el.innerHTML = '<div style="display:grid;place-items:center;height:100%">Não foi possível abrir esta imagem 360°.</div>'; return; }
  el.innerHTML = '';
  const r = new T.WebGLRenderer({antialias: true}); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.outputEncoding = T.sRGBEncoding; tex.encoding = T.sRGBEncoding;
  el.appendChild(r.domElement); r.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:none;border-radius:6px';
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(75, 1, 1, 1100);
  const geo = new T.SphereGeometry(500, 64, 40); geo.scale(-1, 1, 1);
  scene.add(new T.Mesh(geo, new T.MeshBasicMaterial({map: tex})));
  let lon = 0, lat = 0, fov = 75, idle = 0; const ptrs = new Map(); let drag = null, pinch = null;
  const size = () => { const w = el.clientWidth || 600, h = el.clientHeight || 400; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  size(); const ro = new ResizeObserver(size); ro.observe(el);
  const cv = r.domElement;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, e); idle = 0; if (ptrs.size === 1) drag = {x: e.clientX, y: e.clientY, lon, lat}; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), fov}; drag = null; } cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, e);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; fov = Math.max(30, Math.min(100, pinch.fov * pinch.d / Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)))); }
    else if (drag) { const k = .12 * fov / 75; lon = drag.lon - (e.clientX - drag.x) * k; lat = Math.max(-85, Math.min(85, drag.lat + (e.clientY - drag.y) * k)); } });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { drag = null; cv.style.cursor = 'grab'; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); idle = 0; fov = Math.max(30, Math.min(100, fov + e.deltaY * .05)); }, {passive: false});
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    if (!el.isConnected) { ro.disconnect(); r.dispose(); geo.dispose(); tex.dispose(); return; }
    if (!drag && !pinch && !reduce && ++idle > 180) lon += .03;
    cam.fov = fov; cam.updateProjectionMatrix();
    const phi = (90 - lat) * Math.PI / 180, th = lon * Math.PI / 180;
    cam.lookAt(500 * Math.sin(phi) * Math.cos(th), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(th));
    r.render(scene, cam); requestAnimationFrame(tick);
  };
  tick();
}
function openPano(p) {
  const el = $('#lb');
  el.innerHTML = `<div class="top"><div><div class="eyebrow" style="color:#bfe9dc">Panorama 360° · arraste para olhar em volta, role ou pince para aproximar</div><h3>${esc(p.titulo || (Z[p.frente] ? Z[p.frente].name + ' · Est. ' + estStr(p.est) : 'Panorama'))}</h3></div>
    ${p.post ? `<a class="lbtn" style="margin-left:auto;text-decoration:none" href="${esc(kuulaUrl(p.post))}" target="_blank" rel="noopener">Abrir no Kuula ↗</a>` : ''}<button class="lbtn x" data-lbx${p.post ? ' style="margin-left:0"' : ''}>Fechar ✕</button></div>
    <div class="stage" style="padding-block:10px"><div id="panoView" style="width:100%;height:calc(100vh - 150px);height:calc(100dvh - 150px);background:#000;border-radius:6px"></div></div><div></div>`;
  el.hidden = false;
  mountPano($('#panoView'), panoSrc(p));
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pano]'); if (b) { e.preventDefault(); const p = S.p360.find(x => x.id === b.dataset.pano); if (p) openPano(p); } });
async function shrinkPano(file) {
  const bmp = await createImageBitmap(file);
  const w = Math.min(4096, bmp.width), h = Math.round(w / 2);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('compressão')), 'image/jpeg', .85));
}

/* ---------- lightbox ---------- */
const LB = {list: [], i: 0, title: '', p3: null};
function openStake(front, m, id) {
  const list = photosAt(front, m);
  LB.p3 = p360For(front, m);
  if (!list.length) { LB.list = []; LB.title = `${Z[front].name} · Est. ${estStr(m)}`; LB.i = 0; showLB(); return; }
  let i = list.length - 1;
  if (id) i = Math.max(0, list.findIndex(f => f.id === id));
  else if (S.photoDate) { const j = list.findIndex(f => f.data === S.photoDate); if (j >= 0) i = j; }
  openList(list, i, `${Z[front].name} · Est. ${estStr(m)}`, true);
}
function openList(list, i, t, keep) { if (!keep) LB.p3 = null; LB.list = list; LB.i = Math.max(0, i); LB.title = t; showLB(); }
function showLB() {
  const el = $('#lb'), f = LB.list[LB.i];
  el.innerHTML = `<div class="top"><div><div class="eyebrow" style="color:#bfe9dc">${f ? esc(wd(f.data)) + ', ' + esc(dBR(f.data)) : 'Sem foto'}</div><h3>${esc(LB.title)}</h3></div>${LB.p3 ? (hasPano(LB.p3) ? `<button class="lbtn" data-pano="${esc(LB.p3.id)}" style="margin-left:auto;background:#e8b04b;color:#04221c;border-color:#e8b04b;font-weight:600">Ver 360° · Est. ${esc(estStr(LB.p3.est))}</button>` : `<a class="lbtn" style="margin-left:auto;background:#e8b04b;color:#04221c;border-color:#e8b04b;text-decoration:none;font-weight:600" href="${esc(kuulaUrl(LB.p3.post))}" target="_blank" rel="noopener">Ver 360° · Est. ${esc(estStr(LB.p3.est))} ↗</a>`) : ''}<button class="lbtn x" data-lbx${LB.p3 ? ' style="margin-left:0"' : ''}>Fechar ✕</button></div>
    <div class="stage" data-stage>${f ? `<img src="${esc(imgSrc(f))}" alt="${esc(LB.title)} em ${esc(dBR(f.data))}" title="Clique para ampliar">` : `<p>Esta estaca ainda não tem foto.${LB.p3 ? ' Use o botão acima para abrir o panorama 360°.' : ' Envie pela aba Lançar.'}</p>`}</div>
    <div class="nav">${f ? `<button class="lbtn" data-lbm="-1" ${LB.i ? '' : 'disabled'}>← Dia anterior</button>
      <div class="strip">${LB.list.map((x, k) => `<button data-lbi="${k}" aria-current="${k === LB.i}">${x.data.slice(8, 10)}/${x.data.slice(5, 7)}</button>`).join('')}</div>
      <button class="lbtn" data-lbm="1" ${LB.i < LB.list.length - 1 ? '' : 'disabled'}>Dia seguinte →</button>` : ''}
      ${f && f.legenda ? `<div style="flex-basis:100%;text-align:center;font-size:13px;opacity:.85">${esc(f.legenda)}</div>` : ''}${f ? '<div class="hint" style="flex-basis:100%;text-align:center">Clique na foto para ver em tamanho real</div>' : ''}</div>`;
  el.hidden = false;
  const x = el.querySelector('[data-lbx]'); x && x.focus();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-lbx]') || e.target.id === 'lb') { $('#lb').hidden = true; return; }
  const mv = e.target.closest('[data-lbm]'); if (mv) { LB.i = Math.min(LB.list.length - 1, Math.max(0, LB.i + +mv.dataset.lbm)); showLB(); return; }
  const j = e.target.closest('[data-lbi]'); if (j) { LB.i = +j.dataset.lbi; showLB(); return; }
  const im = e.target.closest('[data-stage] img'); if (im) { const st = im.parentElement; st.classList.toggle('zoom'); if (st.classList.contains('mapscroll')) { const z = st.classList.contains('zoom'); im.style.width = z ? '260%' : '100%'; im.style.maxWidth = 'none'; im.style.cursor = z ? 'zoom-out' : 'zoom-in'; } }
});
document.addEventListener('keydown', e => {
  if ($('#lb').hidden) return;
  if (e.key === 'Escape') $('#lb').hidden = true;
  if (e.key === 'ArrowLeft' && LB.i > 0) { LB.i--; showLB(); }
  if (e.key === 'ArrowRight' && LB.i < LB.list.length - 1) { LB.i++; showLB(); }
});

/* ---------- bulk photo folder ---------- */
const BULK = {rows: [], busy: false};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function frontFromText(t) {
  const s = norm(t);
  if (/concei|barra|\bcb\b/.test(s)) return 'cbarra';
  if (/jacinto|frei amador|amador|macedo|10\.?000|e10/.test(s)) return 'e10000';
  if (/7\.?000|cosme|damiao|e7\b/.test(s)) return 'e7000';
  if (/5\.?000|e5\b|rotator|viaduto/.test(s)) return 'e5000';
  if (/ramal|arena|ciclovia/.test(s)) return 'ramal';
  return '';
}
function estFromText(t) {
  const s = norm(t).replace(/,/g, '.');
  const m = s.match(/est(?:aca)?[^0-9]{0,3}(\d{1,5})(?:\s*\+\s*(\d+(?:\.\d+)?))?/);
  if (m) return (+m[1]) * 20 + (m[2] ? +m[2] : 0);
  return NaN;
}
function dateFromText(t) {
  const s = String(t || '');
  let m = s.match(/(20\d\d)[-_.]?(\d\d)[-_.]?(\d\d)/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d\d)[-_.](\d\d)[-_.](20\d\d)/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}
const MESES = {jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12};
function addBulkFiles(files) {
  [...files].filter(f => /^image\//.test(f.type)).forEach(f => {
    const name = f.webkitRelativePath || f.name;
    const fr = frontFromText(name), est = estFromText(name), dt0 = dateFromText(name);
    const lm = new Date(f.lastModified); lm.setMinutes(lm.getMinutes() - lm.getTimezoneOffset());
    const row = {file: f, name, url: URL.createObjectURL(f), frente: fr || $('#bk_front').value, est: isNaN(est) ? '' : estStr(fr === 'e5000' && est < 100000 ? 100000 + est : est), data: dt0 || lm.toISOString().slice(0, 10), fonte: fr || !isNaN(est) || dt0 ? 'nome do arquivo' : '', status: '', pano: false};
    BULK.rows.push(row);
    createImageBitmap(f).then(b => { const k = b.width / b.height; if (k > 1.9 && k < 2.1) { row.pano = true; renderBulk(); } b.close && b.close(); }).catch(() => {});
  });
  renderBulk();
}
function renderBulk() {
  const box = $('#bk_rows'); if (!box) return;
  if (!BULK.rows.length) { box.innerHTML = ''; $('#bk_actions').hidden = true; return; }
  $('#bk_actions').hidden = false;
  const ok = BULK.rows.filter(r => r.frente && !isNaN(parseEst(r.est)) && r.data).length;
  $('#bk_count').textContent = `${BULK.rows.length} fotos · ${ok} prontas para enviar`;
  box.innerHTML = `<div class="tbl"><table style="min-width:720px"><thead><tr><th></th><th>Arquivo</th><th>Frente</th><th>Estaca</th><th>Data</th><th>Situação</th><th></th></tr></thead><tbody>${BULK.rows.map((r, i) => {
    const bad = !r.frente || isNaN(parseEst(r.est)) || !r.data;
    return `<tr><td><img src="${r.url}" alt="" style="width:72px;height:54px;object-fit:cover;border-radius:4px"></td>
      <td class="desc" style="max-width:220px;word-break:break-all">${r.pano ? '<b class="mono" style="color:var(--warn)">360° </b>' : ''}${esc(r.name)}<div class="muted" style="font-size:11.5px">${esc(r.fonte)}</div></td>
      <td><select data-bk="${i}" data-f="frente" style="background:var(--surface-2);border:1px solid var(--line-2);border-radius:6px;padding:5px;color:var(--fg)"><option value="">—</option>${FRONT_KEYS.map(k => `<option value="${k}" ${r.frente === k ? 'selected' : ''}>${esc(Z[k].name)}</option>`).join('')}</select></td>
      <td><input data-bk="${i}" data-f="est" value="${esc(r.est)}" placeholder="ex.: 12+10" style="width:90px;background:var(--surface-2);border:1px solid ${isNaN(parseEst(r.est)) ? 'var(--danger)' : 'var(--line-2)'};border-radius:6px;padding:5px;color:var(--fg)"></td>
      <td><input type="date" data-bk="${i}" data-f="data" value="${esc(r.data)}" style="background:var(--surface-2);border:1px solid var(--line-2);border-radius:6px;padding:5px;color:var(--fg)"></td>
      <td style="white-space:nowrap">${r.status ? esc(r.status) : bad ? '<span style="color:var(--danger)">falta dado</span>' : '<span style="color:var(--accent)">pronta</span>'}</td>
      <td><button class="del" data-bkdel="${i}" style="background:none;border:0;color:var(--muted);cursor:pointer">Remover</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
document.addEventListener('input', e => { const el = e.target.closest('[data-bk]'); if (!el) return; BULK.rows[+el.dataset.bk][el.dataset.f] = el.value; clearTimeout(BULK.t); BULK.t = setTimeout(() => { const c = $('#bk_count'); if (c) { const ok = BULK.rows.filter(r => r.frente && !isNaN(parseEst(r.est)) && r.data).length; c.textContent = `${BULK.rows.length} fotos · ${ok} prontas para enviar`; } }, 200); });
document.addEventListener('change', e => { if (e.target.closest('[data-bk]')) renderBulk(); if (e.target.id === 'bk_files' || e.target.id === 'bk_dir') { addBulkFiles(e.target.files); e.target.value = ''; } });
document.addEventListener('click', e => { const b = e.target.closest('[data-bkdel]'); if (b) { BULK.rows.splice(+b.dataset.bkdel, 1); renderBulk(); } });
async function stampCrop(file) {
  const bmp = await createImageBitmap(file);
  const sx = Math.round(bmp.width * .45), sy = Math.round(bmp.height * .72), w = bmp.width - sx, h = bmp.height - sy;
  const k = Math.min(1, 900 / w);
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, sx, sy, w, h, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
}
async function readStamps() {
  const st = $('#bk_st');
  const sample = await claude.use('sample');
  if (!sample) { st.className = 'status err'; st.textContent = 'A leitura de carimbo não está disponível nesta visualização.'; return; }
  const caps = await sample.limits().catch(() => null);
  if (!caps || !caps.images) { st.className = 'status err'; st.textContent = 'A leitura de imagens não está disponível nesta visualização.'; return; }
  const todo = BULK.rows.filter(r => !r.frente || isNaN(parseEst(r.est)) || r.fonte !== 'carimbo');
  let n = 0;
  for (const r of todo) {
    n++; st.className = 'status'; st.textContent = `Lendo carimbo ${n} de ${todo.length}…`; r.status = 'lendo…'; renderBulk();
    try {
      const blob = await stampCrop(r.file);
      const j = await sample.json('A imagem é o canto inferior direito de uma foto de obra com um carimbo de texto (data, hora, coordenadas, nome da rua e "Est: N"). Leia o carimbo e responda só com JSON: {"data":"AAAA-MM-DD ou vazio","rua":"texto da rua ou trecho","estaca":"número da estaca como aparece, ex. 5, 12+10, 5010; vazio se não houver"}. Meses em português abreviados: jan fev mar abr mai jun jul ago set out nov dez.', {images: blob, modelTier: 'quick'});
      if (j && typeof j === 'object') {
        const fr = frontFromText(j.rua || '');
        if (fr) r.frente = fr;
        if (j.estaca) { let m = parseEst(String(j.estaca).replace(/^est\.?\s*/i, '')); if (!isNaN(m)) { if (r.frente === 'e5000' && m < 100000) m += 100000; r.est = estStr(m); } }
        if (/^\d{4}-\d\d-\d\d$/.test(j.data || '')) r.data = j.data;
        r.fonte = 'carimbo'; r.status = '';
      } else r.status = 'carimbo ilegível';
    } catch (err) {
      r.status = err && err.code === 'not_granted' ? 'sem permissão' : 'carimbo ilegível';
      if (err && (err.code === 'not_granted' || err.code === 'rate_limited')) { renderBulk(); st.className = 'status err'; st.textContent = err.code === 'rate_limited' ? 'Muitas leituras seguidas. Aguarde um pouco e tente de novo.' : 'A leitura de carimbo não foi autorizada.'; return; }
    }
    renderBulk();
  }
  st.className = 'status ok'; st.textContent = 'Carimbos lidos. Confira a tabela antes de enviar.';
}
async function sendBulk() {
  const st = $('#bk_st'); if (BULK.busy) return;
  const ready = BULK.rows.filter(r => r.frente && !isNaN(parseEst(r.est)) && r.data && r.status !== 'enviada');
  if (!ready.length) { st.className = 'status err'; st.textContent = 'Nenhuma foto pronta. Preencha frente, estaca e data.'; return; }
  BULK.busy = true; let ok = 0;
  for (const r of ready) {
    st.className = 'status'; st.textContent = `Enviando ${ok + 1} de ${ready.length}…`; r.status = 'enviando…'; renderBulk();
    try {
      if (r.pano) {
        const up = await S.assets.upload(await shrinkPano(r.file));
        await S.db.collection('pontos360').add({frente: r.frente, est: parseEst(r.est), post: '', img: up.id, titulo: `${Z[r.frente].name} · Est. ${r.est} · ${dBR(r.data)}`, data: r.data, autor: S.myId || '', criado: new Date().toISOString()});
        r.status = 'enviada'; ok++; renderBulk(); continue;
      }
      const up = await S.assets.upload(await shrink(r.file));
      await S.db.collection('fotos').add({frente: r.frente, est: parseEst(r.est), data: r.data, asset: up.id, legenda: '', autor: S.myId || '', criado: new Date().toISOString(), origem: r.name.slice(0, 120)});
      r.status = 'enviada'; ok++;
    } catch (err) { r.status = 'falhou'; }
    renderBulk();
  }
  BULK.busy = false;
  BULK.rows = BULK.rows.filter(r => r.status !== 'enviada'); renderBulk();
  st.className = ok === ready.length ? 'status ok' : 'status err';
  st.textContent = ok === ready.length ? `${ok} fotos enviadas e colocadas nas estacas.` : `${ok} de ${ready.length} enviadas. As que falharam continuam na tabela.`;
}
document.addEventListener('click', e => {
  if (e.target.closest('#bk_read')) readStamps();
  if (e.target.closest('#bk_send')) sendBulk();
  if (e.target.closest('#bk_clear')) { BULK.rows = []; renderBulk(); }
});
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('#bk_drop'); if (z) { e.preventDefault(); z.style.borderColor = 'var(--accent)'; } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#bk_drop'); if (z) z.style.borderColor = ''; });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('#bk_drop'); if (z) { e.preventDefault(); z.style.borderColor = ''; addBulkFiles(e.dataTransfer.files); } });
function bulkCard(canPhotos) {
  return `<section class="card">
    <div class="card-h"><h2>Pasta de fotos</h2><span class="sp muted" style="font-size:13px">Jogue todas as fotos de uma vez; o painel coloca cada uma na sua estaca</span></div>
    <div ${canPhotos ? '' : 'inert style="opacity:.55"'}>
      <div id="bk_drop" style="border:2px dashed var(--line-2);border-radius:10px;padding:22px;text-align:center;display:grid;gap:10px;justify-items:center">
        <b style="font:600 18px var(--font-display)">Arraste as fotos ou uma pasta para cá</b>
        <span class="muted" style="font-size:13px">O painel lê frente, estaca e data pelo nome do arquivo (ex.: <span class="mono">Conceicao_Est05_2026-10-05.jpg</span>). Fotos 360° (formato 2:1) são reconhecidas e viram panoramas no site.</span>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <label class="btn ghost" style="cursor:pointer">Escolher fotos<input id="bk_files" type="file" accept="image/*" multiple hidden></label>
          <label class="btn ghost" style="cursor:pointer">Escolher pasta<input id="bk_dir" type="file" webkitdirectory multiple hidden></label>
        </div>
        <label class="f" style="grid-template-columns:auto auto;align-items:center;gap:8px">Frente padrão para fotos sem nome identificável<select id="bk_front">${FRONT_KEYS.map(k => `<option value="${k}" ${k === 'cbarra' ? 'selected' : ''}>${esc(Z[k].name)}</option>`).join('')}</select></label>
      </div>
      <div id="bk_rows" style="margin-top:14px"></div>
      <div id="bk_actions" hidden style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <span class="muted" id="bk_count"></span>
        <button class="btn" id="bk_send" type="button">Enviar fotos prontas</button>
        <button class="btn ghost" id="bk_clear" type="button">Limpar</button>
        <span class="status" id="bk_st" role="status"></span>
      </div>
    </div>
  </section>`;
}

/* ---------- forms ---------- */
function viewLancar() {
  const canPhotos = !!S.assets, canDb = !!S.db;
  const opts = key => Z[key].groups.map(g => `<optgroup label="${esc(g.code + ' ' + title(g.name))}">${Z[key].items.filter(i => groupOf(i.c) === g.code).map(i => `<option value="${i.c}">${i.c} · ${esc(short(i.n).slice(0, 70))} (${esc(i.u)})</option>`).join('')}</optgroup>`).join('');
  return `
  ${S.canEdit ? `<div class="ra" style="justify-content:flex-end"><button class="btn ghost" type="button" data-impbm>Importar BM (PDF ou Excel)</button></div>` : ''}
  ${avancoCard(canDb)}
  ${avancoLista()}
  ${bulkCard(canPhotos)}
  <section class="card">
    <div class="card-h"><h2>Fotos do dia</h2><span class="sp muted" style="font-size:13px">Uma foto por ponto fixo. As fotos ficam visíveis para todos que abrem o painel.</span></div>
    ${canPhotos ? '' : `<div class="empty-note" style="margin-bottom:14px">${canDb ? 'O envio de fotos está liberado para quem tem permissão de edição neste painel.' : 'Entre com sua conta para enviar fotos e lançamentos.'}</div>`}
    <form class="form" id="fFotos" ${canPhotos ? '' : 'inert style="opacity:.55"'}>
      <div class="fgrid">
        <label class="f">Frente<select id="ff_front">${FRONT_KEYS.map(k => `<option value="${k}" ${k === 'cbarra' ? 'selected' : ''}>${esc(Z[k].name)}</option>`).join('')}</select></label>
        <label class="f">Data das fotos<input type="date" id="ff_date" value="${todayISO()}" required></label>
      </div>
      <div class="slots" id="slots"></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit" id="ff_go">Enviar fotos</button><span class="status" id="ff_st" role="status"></span></div>
    </form>
  </section>
  <section class="card">
    <div class="card-h"><h2>Panoramas 360° (Kuula)</h2><span class="sp muted" style="font-size:13px">Liga um panorama do tour a uma estaca</span></div>
    <form class="form" id="fP360" ${canDb ? '' : 'inert style="opacity:.55"'}>
      <div class="fgrid">
        <label class="f">Frente<select id="fp_front">${FRONT_KEYS.map(k => `<option value="${k}" ${k === 'cbarra' ? 'selected' : ''}>${esc(Z[k].name)}</option>`).join('')}</select></label>
        <label class="f">Estaca<input id="fp_est" placeholder="ex.: 10" required></label>
        <label class="f">Panorama<select id="fp_post">${KUULA.map(k => `<option value="${k[0]}">${k[1]}</option>`).join('')}<option value="">Outro (colar link)</option><option value="-">Sem Kuula (só a foto 360°)</option></select></label>
        <label class="f">Link do Kuula (se outro)<input id="fp_link" placeholder="https://kuula.co/post/…"></label>
        <label class="f">Título<input id="fp_tit" placeholder="opcional, ex.: Vista aérea do início"></label>
        <label class="f">Foto 360° (opcional, imagem 2:1)<input id="fp_img" type="file" accept="image/*" ${S.assets ? '' : 'disabled'}></label>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit">Ligar panorama</button><span class="status" id="fp_st" role="status"></span></div>
    </form>
    ${S.p360.length ? `<div class="logs" style="margin-top:14px">${S.p360.slice().sort((a, b) => a.frente.localeCompare(b.frente) || a.est - b.est).map(p => `<div class="log"><div class="dt">360°</div><div><b>${esc(frNome(p.frente))}</b> · Est. ${esc(estStr(p.est))} · <a href="${esc(kuulaUrl(p.post))}" target="_blank" rel="noopener">${esc(kuulaName(p.post))}</a>${p.titulo ? ' · ' + esc(p.titulo) : ''}</div>${p.db ? `<button class="del" data-del360="${esc(p.id)}">Remover</button>` : '<span></span>'}</div>`).join('')}</div>` : ''}
  </section>
`;
}
function renderSlots() {
  const fr = $('#ff_front').value, pts = PHOTO_POINTS[fr];
  const box = $('#slots');
  if (pts) box.innerHTML = pts.map(m => `<div class="slot"><b>Est. ${estStr(m)}</b><input type="file" accept="image/*" data-slot="${m}" aria-label="Foto da estaca ${estStr(m)}"><div class="prev"></div></div>`).join('');
  else box.innerHTML = [0, 1, 2, 3].map(k => `<div class="slot"><label class="f">Estaca<input data-est="${k}" placeholder="ex.: 5012+10"></label><input type="file" accept="image/*" data-slot="free${k}" aria-label="Foto ${k + 1}"><div class="prev"></div></div>`).join('');
}
function bindForms() {
  const ff = $('#fFotos'); if (!ff) return;
  renderSlots();
  $('#ff_front').onchange = renderSlots;
  $('#slots').onchange = e => {
    const inp = e.target.closest('input[type=file]'); if (!inp) return;
    const pv = inp.parentElement.querySelector('.prev'); pv.innerHTML = '';
    if (inp.files[0]) { const u = URL.createObjectURL(inp.files[0]); pv.innerHTML = `<img src="${u}" alt="Prévia">`; }
  };
  ff.onsubmit = async e => {
    e.preventDefault();
    const st = $('#ff_st'), btn = $('#ff_go');
    const fr = $('#ff_front').value, data = $('#ff_date').value;
    const jobs = [];
    ff.querySelectorAll('input[type=file]').forEach(inp => {
      if (!inp.files[0]) return;
      let m;
      if (inp.dataset.slot.startsWith('free')) { m = parseEst(inp.parentElement.querySelector('[data-est]').value); }
      else m = +inp.dataset.slot;
      jobs.push({file: inp.files[0], m});
    });
    if (!jobs.length) { st.className = 'status err'; st.textContent = 'Escolha pelo menos uma foto.'; return; }
    if (jobs.some(j => isNaN(j.m))) { st.className = 'status err'; st.textContent = 'Informe a estaca de cada foto (ex.: 12 ou 12+10).'; return; }
    btn.disabled = true; let ok = 0;
    for (const j of jobs) {
      st.className = 'status'; st.textContent = `Enviando ${ok + 1} de ${jobs.length}…`;
      try {
        const blob = await shrink(j.file);
        const up = await S.assets.upload(blob);
        await S.db.collection('fotos').add({frente: fr, est: j.m, data, asset: up.id, legenda: '', autor: S.myId || '', criado: new Date().toISOString()});
        ok++;
      } catch (err) { st.className = 'status err'; st.textContent = 'Não foi possível enviar uma foto (' + (err && (err.code || err.message) || 'erro') + '). Tente de novo.'; btn.disabled = false; return; }
    }
    st.className = 'status ok'; st.textContent = `${ok} foto${ok > 1 ? 's' : ''} enviada${ok > 1 ? 's' : ''}.`;
    btn.disabled = false; ff.querySelectorAll('input[type=file]').forEach(i => { i.value = ''; i.parentElement.querySelector('.prev').innerHTML = ''; });
  };
  const fp = $('#fP360');
  fp.onsubmit = async e => {
    e.preventDefault();
    const st = $('#fp_st'); const m = parseEst($('#fp_est').value);
    let post = $('#fp_post').value === '-' ? '' : ($('#fp_post').value || $('#fp_link').value.trim());
    const pf = $('#fp_img').files[0];
    if (isNaN(m)) { st.className = 'status err'; st.textContent = 'Informe a estaca (ex.: 10 ou 10+5).'; return; }
    if (!pf && (!post || (!$('#fp_post').value && !/^https:\/\/kuula\.co\//.test(post)))) { st.className = 'status err'; st.textContent = 'Cole um link do Kuula que comece com https://kuula.co/'; return; }
    let img = '';
    if (pf) { try { st.className = 'status'; st.textContent = 'Enviando a foto 360°…'; img = (await S.assets.upload(await shrinkPano(pf))).id; } catch (err) { st.className = 'status err'; st.textContent = 'Não foi possível enviar a foto 360° (' + (err && (err.code || err.message) || 'erro') + ').'; return; } }
    try { await S.db.collection('pontos360').add({frente: $('#fp_front').value, est: m, post, img, titulo: $('#fp_tit').value.trim().slice(0, 80), autor: S.myId || '', criado: new Date().toISOString()}); st.className = 'status ok'; st.textContent = 'Panorama ligado.'; }
    catch (err) { st.className = 'status err'; st.textContent = 'Não foi possível salvar (' + (err && (err.code || err.message) || 'erro') + ').'; }
  };
  bindAvanco();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-del360]'); if (!b || !S.db) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar'; return; }
  try { await S.db.doc('pontos360/' + b.dataset.del360).delete(); } catch (err) { b.textContent = 'Sem permissão'; }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-dellanc]'); if (!b || !S.db) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar exclusão'; return; }
  try { await S.db.doc('lancamentos/' + b.dataset.dellanc).delete(); } catch (err) { b.textContent = 'Sem permissão'; }
});
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('compressão')), 'image/jpeg', .84));
  } catch (e) { return file; }
}

/* ---------- live data ---------- */
async function resolveNames() {
  if (!S.user) return;
  const ids = [...new Set(S.lancs.concat(S.avanco || [], S.diario || []).map(l => l.autor).concat([S.myId], (S.rnc || []).flatMap(r => [r.autor].concat((r.hist || []).map(h => h.por))), (S.conf || []).map(c => c.autor), (S.docs || []).map(d => d.autor)).filter(Boolean))].filter(id => !(id in S.names));
  if (!ids.length) return;
  try { const ps = await S.user.profiles(ids); ids.forEach(id => { S.names[id] = (ps[id] && ps[id].name) || ''; }); } catch (e) {}
}
let rr = null;
function rerender() {
  clearTimeout(rr);
  rr = setTimeout(() => {
    const active = document.activeElement;
    if (active && active.id === 'docq') return;
    if (S.tab === 'lancar' && ((active && active.closest && active.closest('form,#bk_rows')) || BULK.busy)) {
      // keep the form intact while someone is typing; refresh only the log list
      return;
    }
    render();
  }, 120);
}
S.pubFotos = []; S.dbFotos = []; S.pubLancs = []; S.dbLancs = []; S.pub360 = []; S.db360 = []; S.p360 = [];
function merge360() { const seen = new Set(S.db360.map(p => p.id)); S.p360 = S.db360.map(p => Object.assign({db: true}, p)).concat(S.pub360.filter(p => !seen.has(p.id))); }
function mergeFotos() { const seen = new Set(); S.fotos = S.dbFotos.concat(S.pubFotos).filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; }); }
function mergeLancs() { const seen = new Set(S.dbLancs.map(l => l.id)); S.lancs = S.dbLancs.concat((S.pubLancs || []).filter(l => !seen.has(l.id))); }
async function boot() {
  $('#kuula').href = D.meta.kuula;
  $('#bmPill').textContent = 'BM ' + String(BMN).padStart(2, '0') + ' · ' + String(D.meta.periodo).replace(/\/\d{4}(?= a )/, '');
  $('#foot').textContent = `Dados financeiros e físicos: Boletim de Medição nº ${BMN} (${D.meta.periodo}) e Memória de Cálculo MC ${BMN}. Planta: DXF da R. Conceição da Barra, SIRGAS 2000 / UTM 25S.`;
  renderTabs(); render();
  if (MODE !== 'admin' || !window.claude || !window.claude.use) return;
  const [db, assets, user] = await Promise.all([claude.use('db'), claude.use('assets'), claude.use('user')]);
  S.db = db; S.assets = assets; S.user = user;
  if (user) { try { S.myId = await user.id(); } catch (e) {} try { S.canEdit = !!(await user.canEdit()); } catch (e) {} try { const w = await user.can('data.write'); S.canDb = w == null ? null : !!w; } catch (e) {} }
  claude.use('sample').then(x => { S.hasSample = !!x; }).catch(() => {});
  if (db) {
    db.collection('fotos').onSnapshot(snap => { S.dbFotos = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(f => f.frente && f.data && (f.asset || f.url) && typeof f.est === 'number'); mergeFotos(); rerender(); }, () => {});
    db.collection('pontos360').onSnapshot(snap => { S.db360 = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(p => p.frente && (p.post || p.img || p.url) && typeof p.est === 'number'); merge360(); rerender(); }, () => {});
    S.role = S.canDb === false ? 'diretoria' : 'equipe';
    loadEquipe().then(() => { if (S.tab === 'pend') render(); });
    if (!isDir()) subPrivate();
    renderTabs();
    db.collection('conferencias').onSnapshot(async snap => { S.conf = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(c => c.frente && c.serv && typeof c.ini === 'number'); await resolveNames(); rerender(); }, () => {});
    db.collection('fotos_caixas').onSnapshot(snap => { S.cxFotos = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(f => f.frente && f.no && f.asset); rerender(); }, () => {});
    db.collection('docs').onSnapshot(async snap => { S.docs = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(d => d.cod); await resolveNames(); rerender(); }, () => {});
  }
  if (S.tab === 'lancar') render();
}
const PRIV = {};
function subPrivate() {
  const db = S.db; if (!db) return;
    PRIV.lanc = db.collection('lancamentos').onSnapshot(async snap => { S.avanco = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(l => l.frente && l.item); S.dbLancs = S.avanco.filter(l => typeof l.ini === 'number'); mergeLancs(); await resolveNames(); rerender(); }, () => {});
    PRIV.rnc = db.collection('rnc').onSnapshot(async snap => { S.rnc = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(r => r.frente && r.desc); await resolveNames(); renderTabs(); rerender(); }, () => {});
    PRIV.faltas = db.collection('faltas').onSnapshot(snap => { S.faltas = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(f => f.frente && f.pac); rerender(); }, () => {});
    PRIV.semav = db.collection('sem_avanco').onSnapshot(snap => { S.semAv = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); rerender(); }, () => {});
}
function unsubPrivate() {
  Object.keys(PRIV).forEach(k => { try { typeof PRIV[k] === 'function' && PRIV[k](); } catch (e) {} delete PRIV[k]; });
  S.rnc = []; S.dbLancs = []; S.avanco = []; mergeLancs(); S.faltas = []; S.semAv = {};
}
function setPreview(on) {
  PREVIEW = on; try { localStorage.setItem('ra_preview', on ? '1' : '0'); } catch (e) {}
  if (on) unsubPrivate(); else subPrivate();
  renderTabs(); render();
}
function renderRole() {
  const el = $('#rolePill'); if (!el) return;
  if (S.role === 'equipe') el.innerHTML = PREVIEW
    ? '<button class="pill" data-preview="0" style="cursor:pointer;background:var(--warn);color:#04221c;border-color:var(--warn)">Vendo como visitante · voltar</button>'
    : '<button class="pill" data-preview="1" style="cursor:pointer">Equipe · ver como visitante</button>';
  else if (S.role === 'diretoria') el.innerHTML = '<span class="pill">Visitante · acompanhamento</span>';
  else el.innerHTML = '';
}
document.addEventListener('click', e => { const b = e.target.closest('[data-preview]'); if (b) setPreview(b.dataset.preview === '1'); });

/* =====================================================================
   GESTÃO DA FISCALIZAÇÃO: pendências (RNC), conferência × medição,
   projetos em uso (lista mestra) e alertas de IA
   ===================================================================== */
S.rnc = []; S.conf = []; S.docs = []; S.canEdit = false; S.hasSample = false;
const PEND_F0 = {frente: '', st: 'abertas', grav: '', serv: '', resp: '', ret: '', causa: '', autor: '', de: '', ate: '', eIni: '', eFim: '', q: '', ord: 'padrao', quem: ''};
S.pendF = Object.assign({}, PEND_F0);
S.confF = {frente: 'e5000', bm: 'atual'};
S.docsF = {subst: false, q: ''};
const GRAV = {baixa: ['Baixa', 1], media: ['Média', 2], alta: ['Alta', 3], critica: ['Crítica', 4]};
const RST = {aberta: 'Aberta', correcao: 'Em correção', corrigida: 'Corrigida · aguardando verificação', fechada: 'Fechada'};
const PFX = {ramal: 'RI', e5000: 'E5', e7000: 'E7', e10000: 'E10', cbarra: 'CB', canteiro: 'CS', ilum: 'IP', paisag: 'PS', adm: 'AD'};
const PEND_FRONTS = FRONT_KEYS.concat(['canteiro', 'ilum', 'paisag']);
const SVC = {sub: 'Regularização do subleito', bgs: 'Base BGS', bgtc: 'Base BGTC', cbuq: 'Revestimento (CBUQ e pintura)', mf: 'Meio-fio', cal: 'Calçada', bl: 'Boca de lobo', dren: 'Drenagem', cic: 'Ciclovia'};
const SVC_ORDER = ['sub', 'bgs', 'bgtc', 'cbuq', 'mf', 'cal', 'bl', 'dren', 'cic'];
const DISC = ['Geométrico', 'Terraplenagem', 'Pavimentação', 'Drenagem', 'Sinalização', 'Iluminação', 'OAE / Estrutural', 'Interferências', 'Paisagismo', 'Desapropriação', 'Outros'];
const canWrite = () => !!S.db && S.canDb !== false && !isDir();
function accessNote() {
  if (!S.db || isDir()) return '';
  if (S.canDb === false) return '<div class="al medio" style="margin-bottom:12px"><span class="src">Acesso</span>Seu acesso é só de visualização. Para lançar e atualizar pendências, peça ao administrador do painel para mudar seu perfil para <b>Equipe de obra</b>.</div>';
  if (!S.assets) return '<div class="al" style="margin-bottom:12px"><span class="src">Acesso</span>Você pode lançar e atualizar pendências. O envio de fotos não está disponível no seu tipo de acesso: registre sem foto e alguém da equipe anexa depois.</div>';
  return '';
}
const gv = r => (GRAV[r.grav] || [0, 0])[1];
const isOpen = r => r.st !== 'fechada';
const isLate = r => (r.st === 'aberta' || r.st === 'correcao') && !!r.prazo && r.prazo < todayISO();
const canClose = r => S.canEdit || (!!S.myId && r.autor === S.myId);
const pendSort = (a, b) => (isOpen(b) - isOpen(a)) || (isLate(b) - isLate(a)) || (gv(b) - gv(a)) || String(a.prazo || '9').localeCompare(String(b.prazo || '9'));
const num0 = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const trecho = (a, b) => num0(a) == null ? 'Sem estaca' : 'Est. ' + estStr(a) + (num0(b) != null && b > a ? ' a ' + estStr(b) : '');
const nm = id => (id && S.names[id]) || '';
const frontName = k => (Z[k] ? Z[k].name : (k === 'geral' ? 'Geral' : k));
const isoLocal = ms => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fixEst = (key, m) => (key === 'e5000' && !isNaN(m) && m >= 0 && m < 100000) ? m + 100000 : m;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

/* ---------- serviços × itens ---------- */
const recsIn = key => recsOf(key).filter(r => inDom(key, r));
function svcOfRec(key, r) {
  const C = MAPCFG[key]; if (!C) return null;
  if ((C.drenItems || []).includes(r.item) || (r.item.split('.')[0] === C.zone && C.drenRe.test(r.txt || ''))) return 'dren';
  for (const k of SVC_ORDER) if (k !== 'dren' && (C[k] || []).includes(r.item)) return k;
  const sc = D.secoes[key]; if (sc) for (const g of sc.grupos) if (g.lados && g.camadas.some(c => c.cod === r.item)) for (const k of ['cal', 'cic']) if ((C[k] || []).some(cd => g.camadas.some(c => c.cod === cd))) return k;
  return null;
}
function svcList(key) {
  const C = MAPCFG[key]; if (!C) return [];
  const rs = recsIn(key);
  return SVC_ORDER.filter(k => k === 'dren' ? ((C.drenItems || []).length || rs.some(r => svcOfRec(key, r) === 'dren')) : (C[k] || []).length);
}
function svcItems(key, svc) {
  const C = MAPCFG[key]; if (!C) return [];
  if (svc === 'dren') return [...new Set((C.drenItems || []).concat(recsIn(key).filter(r => svcOfRec(key, r) === 'dren').map(r => r.item)))];
  return C[svc] || [];
}
const confLabel = c => c.serv === 'item' ? (c.item + ' · ' + (itemName(c.item) ? short(itemName(c.item).n).slice(0, 60) : '')) : (SVC[c.serv] || c.serv);
const cEnd = c => (num0(c.fim) != null && c.fim > c.ini) ? c.fim : c.ini;

/* ---------- conferência × medição ---------- */
function unionLen(iv) {
  iv = iv.filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]);
  let tot = 0, cur = null;
  iv.forEach(x => { if (!cur || x[0] > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = x.slice(); } else cur[1] = Math.max(cur[1], x[1]); });
  if (cur) tot += cur[1] - cur[0];
  return tot;
}
function confCover(key, r, svc) {
  const cs = S.conf.filter(c => c.frente === key && ((svc && c.serv === svc) || (c.serv === 'item' && c.item === r.item)));
  if (!cs.length) return 0;
  const point = !(r.fim > r.ini + .01);
  const fr = lados => {
    const L = cs.filter(c => lados.includes(c.lado || ''));
    if (point) return L.some(c => r.ini >= c.ini - 1 && r.ini <= cEnd(c) + 1) ? 1 : 0;
    return Math.min(1, unionLen(L.map(c => [Math.max(r.ini, c.ini), Math.min(r.fim, cEnd(c))])) / (r.fim - r.ini));
  };
  if (r.lado === 'LE') return fr(['', 'LE']);
  if (r.lado === 'LD') return fr(['', 'LD']);
  return (fr(['', 'LE']) + fr(['', 'LD'])) / 2;
}
function confAudit(key, scope) {
  const itemConf = new Set(S.conf.filter(c => c.frente === key && c.serv === 'item').map(c => c.item));
  const rows = [];
  recsIn(key).forEach(r => {
    if (scope === 'atual' && r.bm !== D.meta.bm) return;
    const svc = svcOfRec(key, r);
    if (!svc && !itemConf.has(r.item)) return;
    const it = itemName(r.item); if (!it) return;
    const val = (r.q || 0) * (it.pu || 0);
    const f = confCover(key, r, svc);
    rows.push({key, r, svc, it, val, f, sem: val * (1 - f)});
  });
  return rows;
}
function confNaoMedido(key) {
  return S.conf.filter(c => c.frente === key && cEnd(c) > c.ini).map(c => {
    const rs = recsIn(key).filter(r => (c.serv === 'item' ? r.item === c.item : svcOfRec(key, r) === c.serv) && r.fim > r.ini && (!c.lado || !r.lado || r.lado === c.lado));
    const med = unionLen(rs.map(r => [Math.max(c.ini, r.ini), Math.min(cEnd(c), r.fim)]));
    return {c, falta: (cEnd(c) - c.ini) - med};
  }).filter(x => x.falta > 5);
}
const AUDIT_FRONTS = () => FRONT_KEYS.filter(k => MAPCFG[k]);
function semConfBM() {
  let tot = 0, sem = 0;
  AUDIT_FRONTS().forEach(k => { const a = confAudit(k, 'atual'); tot += sum(a, x => x.val); sem += sum(a, x => x.sem); });
  return {tot, sem};
}

/* ---------- dialog ---------- */
function openDlg(html) { const d = $('#dlg'); d.innerHTML = `<div class="box">${html}</div>`; d.hidden = false; document.body.style.overflow = 'hidden'; const f = d.querySelector('input,select,textarea'); if (f && window.innerWidth > 700) f.focus(); return d; }
function closeDlg() { const d = $('#dlg'); d.hidden = true; d.innerHTML = ''; document.body.style.overflow = ''; }
document.addEventListener('click', e => { if (e.target.closest('[data-dlgx]')) { e.preventDefault(); closeDlg(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#dlg').hidden && $('#lb').hidden) closeDlg(); });
const noWriteDlg = t => openDlg(`<div class="bh"><h3>${esc(t)}</h3><button class="x" data-dlgx aria-label="Fechar">✕</button></div><p>Para registrar, entre na sua conta Claude com permissão de edição neste painel.</p>`);
function alertsHtml(list) { return list.map(a => `<div class="al ${a.nivel === 'alto' ? 'alto' : a.nivel === 'medio' ? 'medio' : ''}"><span class="src">${a.src === 'ia' ? 'IA' : 'Painel'}</span>${esc(a.texto)}</div>`).join(''); }
async function upImg(file) { return (await S.assets.upload(await shrink(file))).id; }
const upErr = err => { const c = err && (err.code || err.message) || 'erro'; return c === 'too_large' ? 'arquivo maior que 20 MB' : c === 'not_granted' ? 'sem permissão de envio' : c; };

/* ---------- options ---------- */
const frontOpts = (list, sel) => list.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(frontName(k))}</option>`).join('');
function svcOpts(key, sel, mode) {
  const l = svcList(key);
  return `<option value="">${l.length ? 'Escolha…' : '—'}</option>` + l.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(SVC[k])}</option>`).join('') +
    (mode === 'rnc' ? `<option value="outro"${sel === 'outro' ? ' selected' : ''}>Outro / não se aplica</option>` : `<option value="item"${sel === 'item' ? ' selected' : ''}>Item específico do boletim</option>`);
}
function itemOpts(key, sel, opt) {
  const z = Z[key]; if (!z) return '<option value="">—</option>';
  return `<option value="">${opt ? '— (opcional)' : 'Escolha…'}</option>` + z.groups.map(g => `<optgroup label="${esc(g.code + ' ' + title(g.name))}">${z.items.filter(i => groupOf(i.c) === g.code || z.groups.length === 1).map(i => `<option value="${i.c}"${i.c === sel ? ' selected' : ''}>${i.c} · ${esc(short(i.n).slice(0, 70))} (${esc(i.u)})</option>`).join('')}</optgroup>`).join('');
}

/* ===================== PENDÊNCIAS (RNC) ===================== */
function rncPhotos(r) {
  const out = (r.fotos || []).map((a, i) => ({id: r.id + '-a' + i, data: (r.criado || todayISO()).slice(0, 10), asset: a, legenda: 'Abertura · ' + (r.desc || '').slice(0, 120)}));
  (r.hist || []).forEach((h, j) => (h.fotos || []).forEach((a, i) => out.push({id: r.id + '-h' + j + '-' + i, data: (h.em || '').slice(0, 10) || todayISO(), asset: a, legenda: (RST[h.st] || h.st) + (h.obs ? ' · ' + h.obs.slice(0, 120) : '')})));
  return out;
}
function rncCard(r) {
  const late = isLate(r), ph = rncPhotos(r);
  const gl = GRAV[r.grav] ? GRAV[r.grav][0] : '—';
  const it = r.item ? itemName(r.item) : null;
  const serv = r.serv && SVC[r.serv] ? SVC[r.serv] : '';
  let act = '';
  if (r.no && nodeById(r.frente, r.no)) act += `<button class="btn sm ghost" data-opennode="${esc(r.frente)}|${esc(r.no)}">Ficha da caixa ${esc(r.no)}</button>`;
  if (canWrite() && isOpen(r)) act += `<button class="btn sm${r.causa ? ' ghost' : ''}" data-masp="rnc|${esc(r.id)}">${r.causa ? 'Rever análise (MASP)' : 'Analisar a causa (MASP)'}</button>`;
  if (canWrite()) {
    if (r.st === 'aberta') act += `<button class="btn sm" data-rst="${esc(r.id)}|correcao">Iniciar correção</button>`;
    if (r.st === 'aberta' || r.st === 'correcao') act += `<button class="btn sm${r.st === 'aberta' ? ' ghost' : ''}" data-rst="${esc(r.id)}|corrigida">Marcar como corrigida</button>`;
    if (r.st === 'corrigida') act += canClose(r) ? `<button class="btn sm" data-rst="${esc(r.id)}|fechada">Fechar · verificado</button><button class="btn sm ghost" data-rst="${esc(r.id)}|correcao">Devolver para correção</button>` : `<span class="muted" style="font-size:13px">Aguardando verificação de quem abriu ou do fiscal.</span>`;
    if (r.st === 'fechada' && canClose(r)) act += `<button class="btn sm ghost" data-rst="${esc(r.id)}|aberta">Reabrir</button>`;
    if (canClose(r)) act += `<button class="btn sm ghost" data-rdel="${esc(r.id)}" style="margin-left:auto">Excluir</button>`;
  }
  return `<article class="rnc g-${esc(r.grav)}${late ? ' late' : ''}${r.st === 'fechada' ? ' closed' : ''}">
    <div class="rh"><b class="mono">${esc(r.num || 'RNC')}</b><span class="tag ${esc(r.grav)}">${esc(gl)}</span><span class="tag s-${esc(r.st)}">${esc(RST[r.st] || r.st)}</span>${r.retem && isOpen(r) ? '<span class="tag ret">Retém medição</span>' : ''}${late ? `<span class="tag lt">Vencida há ${-daysTo(r.prazo)} dia${-daysTo(r.prazo) > 1 ? 's' : ''}</span>` : ''}</div>
    <div class="rt">${esc(frontName(r.frente))} · ${esc(trecho(r.ini, r.fim))}${r.lado ? ' · ' + esc(r.lado) : ''}${serv ? ' · ' + esc(serv) : ''}${r.no ? ' · ' + esc(r.no) : ''}</div>
    <p>${esc(r.desc)}</p>
    ${r.exig ? `<p class="muted"><b>Exigência:</b> ${esc(r.exig)}</p>` : ''}
    ${it ? `<div class="muted" style="font-size:13px">Item do boletim: <span class="mono">${esc(r.item)}</span> ${esc(short(it.n).slice(0, 80))}</div>` : ''}
    <div class="muted" style="font-size:13px">Responsável: ${r.respId ? `<b style="color:var(--fg)">${esc(respNome(r))}</b>` : '<span class="tag lt">sem responsável</span>'}${canWrite() && isOpen(r) ? ` <button class="del" type="button" data-rresp="${esc(r.id)}">${r.respId ? 'trocar' : 'definir'}</button>` : ''} · Empresa: ${esc(r.resp || '—')} · Prazo: <b>${esc(dBR(r.prazo) || '—')}</b> · Aberta em ${esc(dBR((r.criado || '').slice(0, 10)))}${nm(r.autor) ? ' por ' + esc(nm(r.autor)) : ''}</div>
    ${ph.length ? `<div class="thumbs">${ph.map((p, i) => `<button data-rph="${esc(r.id)}|${i}" title="${esc(p.legenda)}"><img loading="lazy" src="${esc(BLOB + p.asset)}" alt="Foto ${i + 1}"></button>`).join('')}</div>` : ''}
    ${(r.ia && r.ia.length) || (r.hist && r.hist.length > 1) ? `<details><summary>Histórico${r.ia && r.ia.length ? ' e alertas da abertura' : ''}</summary>
      ${r.ia && r.ia.length ? `<div class="alerts" style="margin-top:8px">${alertsHtml(r.ia)}</div>` : ''}
      <ul class="hist">${(r.hist || []).map(h => `<li>${esc(dBR((h.em || '').slice(0, 10)))} · <b>${esc(RST[h.st] || h.st)}</b>${nm(h.por) ? ' · ' + esc(nm(h.por)) : ''}${h.obs ? ' · ' + esc(h.obs) : ''}${h.fotos && h.fotos.length ? ` · ${h.fotos.length} foto(s)` : ''}</li>`).join('')}</ul></details>` : ''}
    ${isOpen(r) ? causaHtml(r.causa, (r.num || '') + ' não resolvida', 'rnc', r.id) : ''}
    ${act ? `<div class="ra">${act}</div>` : ''}
  </article>`;
}
function viewPend() {
  const all = S.rnc, F = S.pendF;
  const ab = all.filter(isOpen), crit = ab.filter(r => r.grav === 'critica'), late = all.filter(isLate), ret = ab.filter(r => r.retem);
  // vencidas: pendência com prazo vencido + serviço parado com previsão/ação vencida + ação de pendência vencida
  const saLate = semAvanco().filter(x => x.st === 'atrasado'), acLate = ab.filter(r => !isLate(r) && r.causa && acaoLate(r.causa));
  const nVenc = late.length + saLate.length + acLate.length;
  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const sel = (k, opts, lbl) => `<select data-pf="${k}" aria-label="${esc(lbl || 'Filtro')}">${opts.map(([v, t]) => `<option value="${esc(v)}"${F[k] === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  return `${accessNote()}
  <section class="kpis" aria-label="Resumo das pendências">
    <div class="kpi"><div class="eyebrow">Abertas</div><div class="v">${ab.length}</div><div class="s">${all.length} registradas no total</div></div>
    <div class="kpi"><div class="eyebrow">Críticas</div><div class="v" style="${crit.length ? 'color:var(--danger)' : ''}">${crit.length}</div><div class="s">sobem para os pontos de atenção</div></div>
    <div class="kpi"><div class="eyebrow">Vencidas</div><div class="v" style="${nVenc ? 'color:var(--danger)' : ''}">${nVenc}</div><div class="s">${nVenc ? [late.length ? pl(late.length, 'pendência', 'pendências') : '', saLate.length ? pl(saLate.length, 'serviço parado', 'serviços parados') : '', acLate.length ? pl(acLate.length, 'ação de pendência', 'ações de pendências') : ''].filter(Boolean).join(' · ') : 'nada com prazo vencido'}</div></div>
    <div class="kpi"><div class="eyebrow">Retêm medição</div><div class="v" style="${ret.length ? 'color:var(--warn)' : ''}">${ret.length}</div><div class="s">trechos a segurar no BM</div></div>
  </section>
  <section class="card pbusca">
    <div class="filt" style="margin-bottom:0">
      <input type="search" data-pf="q" value="${esc(F.q)}" placeholder="Buscar pendência: número, texto, estaca, responsável…" aria-label="Buscar pendência" class="pf-busca">
      ${sel('st', [['abertas', 'Não fechadas'], ['vencidas', 'Vencidas'], ['aberta', 'Abertas'], ['correcao', 'Em correção'], ['corrigida', 'Aguardando verificação'], ['fechada', 'Fechadas'], ['todas', 'Todos os status']], 'Status')}
      ${sel('frente', [['', 'Todas as frentes']].concat(PEND_FRONTS.map(k => [k, frontName(k)])), 'Frente')}
      ${sel('grav', [['', 'Todas as gravidades']].concat(Object.entries(GRAV).map(([k, v]) => [k, v[0]])), 'Gravidade')}
      ${sel('quem', [['', 'Todos os responsáveis'], ['eu', 'Minhas pendências'], ['sem', 'Sem responsável']].concat(S.equipe.map(p => [p.id, p.nome || p.email || 'sem nome'])), 'Responsável')}
    </div>
  </section>
  <section class="card">
    <div class="card-h"><h2>Pendências e não conformidades</h2>${canWrite() ? '<button class="sp btn" data-newrnc="">+ Nova pendência</button>' : '<span class="sp muted" style="font-size:13px">Entre com permissão de edição para registrar</span>'}</div>
    <div id="pendList">${pendListHtml()}</div>
    <p class="note">Ciclo: Aberta → Em correção → Corrigida (com foto) → Fechada. Só quem abriu ou um editor do painel fecha a pendência. Crítica ou vencida aparece na Visão geral.</p>
  </section>
  ${ishAggCard()}
  ${semAvCard()}`;
}
/* ---------- filtros das pendências ---------- */
function pendFiltrosExtra() { const F = S.pendF; return ['serv', 'resp', 'autor', 'ret', 'causa', 'de', 'ate', 'eIni', 'eFim'].filter(k => F[k]).length + (F.ord !== 'padrao' ? 1 : 0); }
function pendFiltrar(all) {
  const F = S.pendF, q = F.q.trim().toLowerCase();
  const pe = t => { if (!t) return NaN; const v = parseEst(t); return isNaN(v) ? NaN : (F.frente ? fixEst(F.frente, v) : v); };
  const ea = pe(F.eIni), eb = pe(F.eFim), temEst = !isNaN(ea) || !isNaN(eb);
  const lo = isNaN(ea) ? -Infinity : ea, hi = isNaN(eb) ? Infinity : eb;
  return all.filter(r => {
    if (F.frente && r.frente !== F.frente) return false;
    if (F.grav && r.grav !== F.grav) return false;
    if (!(F.st === 'todas' || (F.st === 'abertas' ? isOpen(r) : F.st === 'vencidas' ? isLate(r) : r.st === F.st))) return false;
    if (F.quem === 'eu' && r.respId !== S.myId) return false;
    if (F.quem === 'sem' && r.respId) return false;
    if (F.quem && F.quem !== 'eu' && F.quem !== 'sem' && r.respId !== F.quem) return false;
    if (F.serv && r.serv !== F.serv) return false;
    if (F.resp && (r.resp || '').trim() !== F.resp) return false;
    if (F.autor && r.autor !== F.autor) return false;
    if (F.ret === 'sim' && !r.retem) return false;
    if (F.ret === 'nao' && r.retem) return false;
    if (F.causa === 'sem' && r.causa) return false;
    if (F.causa && F.causa !== 'sem' && !(r.causa && (r.causa.raiz === F.causa || (!r.causa.raiz && (r.causa.cats || []).includes(F.causa))))) return false;
    const dia = String(r.criado || '').slice(0, 10);
    if (F.de && (!dia || dia < F.de)) return false;
    if (F.ate && (!dia || dia > F.ate)) return false;
    if (temEst) { if (r.ini == null || isNaN(r.ini)) return false; const a = r.ini, b = r.fim != null && !isNaN(r.fim) ? r.fim : r.ini; if (b < lo || a > hi) return false; }
    if (q) {
      const txt = [r.num, r.desc, r.exig, r.resp, respNome(r), SVC[r.serv], r.item, frontName(r.frente), r.ini != null ? 'est ' + estStr(r.ini) : '', S.names[r.autor], GRAV[r.grav] && GRAV[r.grav][0]].filter(Boolean).join(' ').toLowerCase();
      if (!q.split(/\s+/).every(w => txt.includes(w))) return false;
    }
    return true;
  });
}
function pendOrdenar(l) {
  const o = S.pendF.ord;
  if (o === 'prazo') return l.sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
  if (o === 'recentes') return l.sort((a, b) => String(b.criado || '').localeCompare(String(a.criado || '')));
  if (o === 'antigas') return l.sort((a, b) => String(a.criado || '').localeCompare(String(b.criado || '')));
  if (o === 'estaca') return l.sort((a, b) => frontName(a.frente).localeCompare(frontName(b.frente)) || ((a.ini == null ? 1e12 : a.ini) - (b.ini == null ? 1e12 : b.ini)));
  return l.sort(pendSort);
}
function pendListHtml() {
  const all = S.rnc, list = pendOrdenar(pendFiltrar(all));
  const ativo = JSON.stringify(Object.assign({}, S.pendF)) !== JSON.stringify(PEND_F0);
  const topo = all.length ? `<div class="pf-cont"><span><b>${list.length}</b> de ${all.length} pendência${all.length > 1 ? 's' : ''}</span>${ativo ? '<button class="chip" type="button" data-pflimpa>Limpar filtros</button>' : ''}</div>` : '';
  return topo + (list.length ? `<div class="rlist">${list.map(rncCard).join('')}</div>` : `<div class="empty-note">${all.length ? 'Nenhuma pendência com esses filtros.' : 'Nenhuma pendência registrada ainda. Use <b>+ Nova pendência</b>, ou clique numa estaca da planta e escolha <b>+ Pendência aqui</b>.'}</div>`);
}
function pendRefresh() { const el = $('#pendList'); if (!el) return render(); const h = pendListHtml(); if (el._h !== h) { el.innerHTML = h; el._h = h; } const b = $('[data-pfmais]'); if (b) { const n = pendFiltrosExtra(); b.innerHTML = (S.pendMais ? 'Menos filtros' : 'Mais filtros') + (n ? ` <b>(${n})</b>` : ''); } }
document.addEventListener('change', e => { const s = e.target.closest('[data-pf]'); if (s) { S.pendF[s.dataset.pf] = s.value; pendRefresh(); } });
document.addEventListener('input', e => { const s = e.target.closest('input[data-pf]'); if (s && (s.dataset.pf === 'q' || s.dataset.pf === 'eIni' || s.dataset.pf === 'eFim')) { S.pendF[s.dataset.pf] = s.value; clearTimeout(S._pft); S._pft = setTimeout(pendRefresh, 250); } });
document.addEventListener('click', e => {
  if (e.target.closest('[data-pfmais]')) { S.pendMais = !S.pendMais; const m = $('#pfMais'); if (m) m.hidden = !S.pendMais; e.target.closest('[data-pfmais]').setAttribute('aria-expanded', S.pendMais); pendRefresh(); return; }
  if (e.target.closest('[data-pflimpa]')) { S.pendF = Object.assign({}, PEND_F0); render(); }
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-rph]'); if (!b) return;
  const [id, i] = b.dataset.rph.split('|'); const r = S.rnc.find(x => x.id === id); if (!r) return;
  openList(rncPhotos(r), +i, (r.num || 'Pendência') + ' · ' + frontName(r.frente) + ' · ' + trecho(r.ini, r.fim));
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-rdel]'); if (!b || !S.db) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar exclusão'; return; }
  try { await S.db.doc('rnc/' + b.dataset.rdel).delete(); } catch (err) { b.textContent = 'Sem permissão'; }
});

/* nova pendência */
document.addEventListener('click', e => { const b = e.target.closest('[data-newrnc]'); if (b) { e.preventDefault(); openRncForm({frente: b.dataset.newrnc, est: b.dataset.est, no: b.dataset.no}); } });
function openRncForm(pre = {}) {
  if (!canWrite()) { noWriteDlg('Nova pendência'); return; }
  const fr = pre.frente && Z[pre.frente] ? pre.frente : (S.pendF.frente || (PEND_FRONTS.includes(S.tab) ? S.tab : 'e5000'));
  const est = pre.est != null && pre.est !== '' && !isNaN(+pre.est) ? estStr(+pre.est) : '';
  openDlg(`
    <div class="bh"><div><div class="eyebrow">Pendência / não conformidade</div><h3>Nova pendência</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <form class="form" id="fRnc" novalidate data-no="${esc(pre.no || '')}">
      <div class="fgrid">
        <label class="f">Frente<select id="rn_front">${frontOpts(PEND_FRONTS, fr)}</select></label>
        <label class="f">Estaca inicial<input id="rn_ini" inputmode="decimal" placeholder="ex.: 5012 ou 10+5" value="${esc(est)}"></label>
        <label class="f">Estaca final (se for trecho)<input id="rn_fim" inputmode="decimal" placeholder="opcional"></label>
        <label class="f">Lado<select id="rn_lado"><option value="">Pista toda / não se aplica</option><option value="LE">LE</option><option value="LD">LD</option></select></label>
        <label class="f">Serviço<select id="rn_serv">${svcOpts(fr, pre.no ? 'dren' : '', 'rnc')}</select></label>
        <label class="f">Gravidade<select id="rn_grav"><option value="">Escolha…</option>${Object.entries(GRAV).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
      </div>
      ${pre.no ? `<div class="al"><span class="src">Caixa</span>${esc((nodeById(fr, pre.no) || {}).nome || pre.no)} · a pendência fica ligada à ficha da caixa</div>` : ''}
      <label class="f">Item do boletim afetado (opcional)<select id="rn_item">${itemOpts(fr, '', true)}</select></label>
      <label class="f">Descrição do problema<textarea id="rn_desc" placeholder="O que está errado e onde"></textarea></label>
      <label class="f">Exigência (o que precisa ser feito)<textarea id="rn_exig" placeholder="ex.: fresar e refazer a emenda com junta reta"></textarea></label>
      <div class="fgrid">
        <label class="f">Responsável (equipe)<select id="rn_respId"><option value="">Escolha…</option>${equipeOpts(S.myId)}</select></label>
        <label class="f">Empresa que corrige<input id="rn_resp" value="${esc(D.meta.contratada || '')}"></label>
        <label class="f">Prazo<input type="date" id="rn_prazo" value="${isoLocal(Date.now() + 7 * DAY)}" min="${todayISO()}"></label>
        <label class="chk" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="rn_ret"> Retém medição deste trecho</label>
      </div>
      ${S.assets ? '<label class="f">Fotos do problema (obrigatório · até 4)<input type="file" id="rn_fotos" accept="image/*" multiple></label>' : '<p class="note" style="margin:0">O envio de fotos não está disponível no seu acesso. Registre a pendência e peça a alguém da equipe para anexar as fotos.</p><input type="file" id="rn_fotos" hidden>'}
      <div class="alerts" id="rn_alerts" aria-live="polite"></div>
      <div class="ra"><button class="btn" id="rn_go" type="submit">Verificar e salvar</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="rn_st" role="status"></span></div>
      <p class="note">Antes de salvar, o painel confere duplicidade, prazo do cronograma e medição do trecho${S.hasSample ? ', e a IA faz uma revisão rápida (usa a cota do seu plano Claude)' : ''}. Se houver alerta, você confere e confirma.</p>
    </form>`);
  $('#rn_front').onchange = () => { const k = $('#rn_front').value; $('#rn_serv').innerHTML = svcOpts(k, '', 'rnc'); $('#rn_item').innerHTML = itemOpts(k, '', true); };
  $('#fRnc').onsubmit = e => { e.preventDefault(); rncSubmit(); };
}
function readRnc() {
  const v = id => ($('#' + id).value || '').trim();
  const fr = v('rn_front');
  return {frente: fr, ini: fixEst(fr, parseEst(v('rn_ini'))), fim: fixEst(fr, parseEst(v('rn_fim'))), iniTxt: v('rn_ini'), fimTxt: v('rn_fim'), lado: v('rn_lado'), serv: v('rn_serv'), item: v('rn_item'), desc: v('rn_desc'), exig: v('rn_exig'), grav: v('rn_grav'), resp: v('rn_resp'), respId: v('rn_respId'), prazo: v('rn_prazo'), retem: $('#rn_ret').checked, no: $('#fRnc').dataset.no || '', files: [...$('#rn_fotos').files].slice(0, 4)};
}
function rncValidate(d) {
  if (d.iniTxt && isNaN(d.ini)) return 'Estaca inicial inválida. Use 5012, 10 ou 10+5.';
  if (d.fimTxt && isNaN(d.fim)) return 'Estaca final inválida.';
  if (!isNaN(d.fim) && !isNaN(d.ini) && d.fim < d.ini) return 'A estaca final precisa ser maior que a inicial.';
  if (d.fimTxt && !d.iniTxt) return 'Informe a estaca inicial.';
  if (d.desc.length < 8) return 'Descreva o problema.';
  if (!d.grav) return 'Escolha a gravidade.';
  if (!d.respId) return 'Escolha o responsável da equipe.';
  if (!d.prazo) return 'Informe o prazo.';
  if (d.prazo < todayISO()) return 'O prazo não pode ser uma data passada.';
  if (!d.files.length && S.assets) return 'Anexe ao menos uma foto do problema.';
  return '';
}
function rncLocalChecks(d) {
  const out = [], key = d.frente, hasE = !isNaN(d.ini), b = !isNaN(d.fim) ? d.fim : d.ini;
  if (hasE) {
    S.rnc.filter(r => r.frente === key && isOpen(r) && num0(r.ini) != null && r.ini <= b + 40 && (num0(r.fim) != null && r.fim > r.ini ? r.fim : r.ini) >= d.ini - 40 && (!d.serv || !r.serv || r.serv === d.serv))
      .slice(0, 3).forEach(r => out.push({nivel: 'medio', src: 'local', texto: `Já existe ${r.num} não fechada perto daqui (${trecho(r.ini, r.fim)}${r.serv && SVC[r.serv] ? ', ' + SVC[r.serv] : ''}): "${(r.desc || '').slice(0, 70)}". Confira se não é a mesma.`}));
    if (!d.retem && MAPCFG[key]) {
      const med = recsIn(key).filter(r => ((d.serv && SVC[d.serv] && svcOfRec(key, r) === d.serv) || (d.item && r.item === d.item)) && r.fim >= d.ini - 1 && r.ini <= b + 1);
      if (med.length) { const bms = [...new Set(med.map(r => r.bm))].sort((x, y) => x - y); out.push({nivel: 'alto', src: 'local', texto: `Este trecho já foi medido para ${d.serv && SVC[d.serv] ? SVC[d.serv] : 'o item ' + d.item} (BM ${bms.join(', ')}). Avalie marcar "Retém medição".`}); }
    }
  }
  const ends = D.crono.tasks.filter(t => t.fr === key && !t.ms).map(t => t.f).sort(), end = ends[ends.length - 1];
  if (end && d.prazo > end) out.push({nivel: 'medio', src: 'local', texto: `O prazo (${dBR(d.prazo)}) passa do término previsto da frente no cronograma (${dBR(end)}).`});
  if (d.grav === 'critica' && daysTo(d.prazo) > 7) out.push({nivel: 'medio', src: 'local', texto: `Pendência crítica com prazo de ${daysTo(d.prazo)} dias. Confirme se o prazo está adequado.`});
  if (!d.exig) out.push({nivel: 'info', src: 'local', texto: 'Sem exigência descrita. Dizer o que precisa ser feito evita discussão na hora de fechar.'});
  return out;
}
async function rncIA(d) {
  const sample = await claude.use('sample'); if (!sample) return null;
  const key = d.frente, hasE = !isNaN(d.ini), b = !isNaN(d.fim) ? d.fim : d.ini;
  const near = r => hasE && num0(r.ini) != null && r.ini <= b + 60 && (r.fim > r.ini ? r.fim : r.ini) >= d.ini - 60;
  const ctx = {
    nova: {frente: frontName(key), trecho: hasE ? trecho(d.ini, b) : 'sem estaca', lado: d.lado || 'pista toda', servico: SVC[d.serv] || d.serv || '', item_boletim: d.item ? d.item + ' ' + (itemName(d.item) ? short(itemName(d.item).n) : '') : '', descricao: d.desc, exigencia: d.exig, gravidade: d.grav, responsavel: d.resp, prazo: d.prazo, retem_medicao: d.retem},
    pendencias_nao_fechadas_na_frente: S.rnc.filter(r => r.frente === key && isOpen(r)).slice(0, 30).map(r => ({num: r.num, trecho: trecho(r.ini, r.fim), servico: SVC[r.serv] || '', descricao: (r.desc || '').slice(0, 160), status: RST[r.st], prazo: r.prazo, gravidade: r.grav})),
    cronograma_da_frente: D.crono.tasks.filter(t => t.fr === key && !t.sum).slice(0, 30).map(t => ({tarefa: t.n, inicio: t.s, fim: t.f})),
    medicoes_no_trecho: recsIn(key).filter(near).slice(0, 25).map(r => ({item: r.item, servico: itemName(r.item) ? short(itemName(r.item).n).slice(0, 70) : '', trecho: trecho(r.ini, r.fim), lado: r.lado, bm: r.bm})),
    conferencias_no_trecho: S.conf.filter(c => c.frente === key && hasE && c.ini <= b + 60 && cEnd(c) >= d.ini - 60).slice(0, 15).map(c => ({servico: confLabel(c), trecho: trecho(c.ini, c.fim), lado: c.lado, data: c.data}))
  };
  const prompt = `Você apoia a fiscalização de uma obra viária pública (contrato ${D.meta.contrato}, ${D.meta.objeto}, ${D.meta.local}). Hoje é ${dBR(todayISO())}. Alguém da equipe está registrando uma nova pendência/não conformidade. Avalie com olhar de fiscal experiente e aponte apenas alertas úteis e concretos: possível duplicidade com pendência já aberta, prazo incoerente com o cronograma, trecho já medido em que talvez a medição deva ser retida, gravidade incoerente com a descrição, exigência vaga ou ausente, informação importante faltando, risco de segurança. Cada alerta com no máximo 2 frases, em português do Brasil, sem repetir os dados de volta. Use só os dados abaixo; não invente fatos. Se não houver nada relevante, devolva a lista vazia.

DADOS:
${JSON.stringify(ctx)}

Responda só com JSON neste formato: {"alertas":[{"nivel":"alto"|"medio"|"info","texto":"..."}],"gravidade_sugerida":"baixa"|"media"|"alta"|"critica"|"","motivo_gravidade":"frase curta ou vazio"}`;
  return await sample.json(prompt, {modelTier: 'quick'});
}
async function rncSubmit() {
  const st = $('#rn_st'), btn = $('#rn_go'), form = $('#fRnc'); if (!form || btn.disabled) return;
  const d = readRnc(), err = rncValidate(d);
  if (err) { st.className = 'status err'; st.textContent = err; return; }
  if (!form.dataset.checked) {
    btn.disabled = true; st.className = 'status'; st.textContent = S.hasSample ? 'Verificando com o painel e a IA…' : 'Verificando…';
    const al = rncLocalChecks(d);
    if (S.hasSample) {
      try {
        const j = await rncIA(d);
        if (j && Array.isArray(j.alertas)) j.alertas.filter(a => a && a.texto).slice(0, 5).forEach(a => al.push({nivel: ['alto', 'medio', 'info'].includes(a.nivel) ? a.nivel : 'info', src: 'ia', texto: String(a.texto).slice(0, 400)}));
        if (j && GRAV[j.gravidade_sugerida] && j.gravidade_sugerida !== d.grav) al.push({nivel: 'medio', src: 'ia', texto: `Gravidade sugerida: ${GRAV[j.gravidade_sugerida][0]}.${j.motivo_gravidade ? ' ' + String(j.motivo_gravidade).slice(0, 200) : ''}`});
      } catch (er) { if (er && er.code === 'not_granted') S.hasSample = false; al.push({nivel: 'info', src: 'local', texto: er && er.code === 'rate_limited' ? 'A IA está ocupada agora; a verificação do painel foi feita.' : 'A revisão da IA não ficou disponível desta vez; a verificação do painel foi feita.'}); }
    }
    form._al = al; form.dataset.checked = '1'; btn.disabled = false;
    $('#rn_alerts').innerHTML = al.length ? `<div class="eyebrow">Confira antes de salvar</div>${alertsHtml(al)}` : '';
    if (al.some(a => a.nivel !== 'info')) { btn.textContent = 'Salvar pendência'; st.className = 'status'; st.textContent = 'Revise os alertas. Ajuste o que precisar e clique em Salvar.'; return; }
  }
  btn.disabled = true; st.className = 'status';
  try {
    const ids = [];
    for (let i = 0; i < d.files.length; i++) { st.textContent = `Enviando foto ${i + 1} de ${d.files.length}…`; ids.push(await upImg(d.files[i])); }
    const pfx = PFX[d.frente] || 'G', base = 'RNC-' + pfx + '-';
    const n = 1 + Math.max(0, ...S.rnc.filter(r => (r.num || '').startsWith(base)).map(r => parseInt(r.num.slice(base.length), 10) || 0));
    const now = new Date().toISOString();
    st.textContent = 'Salvando…';
    await S.db.collection('rnc').add({num: base + String(n).padStart(3, '0'), frente: d.frente, ini: isNaN(d.ini) ? null : d.ini, fim: isNaN(d.fim) ? null : d.fim, lado: d.lado, serv: d.serv, item: d.item, desc: d.desc.slice(0, 2000), exig: d.exig.slice(0, 1500), grav: d.grav, resp: d.resp.slice(0, 120), respId: d.respId || '', prazo: d.prazo, retem: d.retem, no: d.no || '', fotos: ids, st: 'aberta', hist: [{st: 'aberta', em: now, por: S.myId || '', obs: '', fotos: []}], ia: (form._al || []).slice(0, 8), autor: S.myId || '', criado: now});
    closeDlg();
  } catch (er) { btn.disabled = false; st.className = 'status err'; st.textContent = 'Não foi possível salvar (' + upErr(er) + ').'; }
}

/* mudança de status */
document.addEventListener('click', e => { const b = e.target.closest('[data-rst]'); if (b) { const [id, to] = b.dataset.rst.split('|'); openTransition(id, to); } });
function openTransition(id, to) {
  const r = S.rnc.find(x => x.id === id); if (!r) return;
  if (!canWrite()) { noWriteDlg('Atualizar pendência'); return; }
  const back = to === 'correcao' && r.st === 'corrigida';
  if ((to === 'fechada' || to === 'aberta' || back) && !canClose(r)) { openDlg(`<div class="bh"><h3>Sem permissão</h3><button class="x" data-dlgx>✕</button></div><p>Só quem abriu a pendência ou um editor do painel pode fechar, reabrir ou devolver.</p>`); return; }
  const ttl = back ? 'Devolver para correção' : {correcao: 'Iniciar correção', corrigida: 'Marcar como corrigida', fechada: 'Fechar pendência (verificada em campo)', aberta: 'Reabrir pendência'}[to];
  const needPhoto = to === 'corrigida' && !!S.assets, needObs = back || to === 'aberta';
  openDlg(`<div class="bh"><div><div class="eyebrow">${esc(r.num)} · ${esc(frontName(r.frente))} · ${esc(trecho(r.ini, r.fim))}</div><h3>${esc(ttl)}</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <p class="muted" style="margin:0">${esc(r.desc)}</p>
    <form class="form" id="fTr" novalidate>
      <label class="f">${back ? 'O que ainda falta (obrigatório)' : to === 'aberta' ? 'Motivo da reabertura (obrigatório)' : to === 'fechada' ? 'Observação da verificação' : 'Observação'}<textarea id="tr_obs"></textarea></label>
      ${needPhoto ? '<label class="f">Foto do serviço corrigido (obrigatório)<input type="file" id="tr_fotos" accept="image/*" multiple></label>' : ''}
      <div class="ra"><button class="btn" type="submit" id="tr_go">Confirmar</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="tr_st" role="status"></span></div>
    </form>`);
  $('#fTr').onsubmit = async e => {
    e.preventDefault();
    const st = $('#tr_st'), btn = $('#tr_go'), obs = ($('#tr_obs').value || '').trim();
    const files = needPhoto ? [...$('#tr_fotos').files].slice(0, 4) : [];
    if (needObs && obs.length < 4) { st.className = 'status err'; st.textContent = 'Escreva o motivo.'; return; }
    if (needPhoto && !files.length) { st.className = 'status err'; st.textContent = 'Anexe a foto do serviço corrigido.'; return; }
    btn.disabled = true; st.className = 'status';
    try {
      const ids = []; for (let i = 0; i < files.length; i++) { st.textContent = `Enviando foto ${i + 1} de ${files.length}…`; ids.push(await upImg(files[i])); }
      const cur = S.rnc.find(x => x.id === id) || r;
      const upd = {st: to, hist: (cur.hist || []).concat([{st: to, em: new Date().toISOString(), por: S.myId || '', obs: obs.slice(0, 1000), fotos: ids}])};
      if (to === 'fechada' && cur.causa && cur.causa.metodo === 'masp') upd.causa = Object.assign({}, cur.causa, {verif: {ok: true, em: new Date().toISOString(), obs: obs.slice(0, 300), por: S.myId || ''}});
      await S.db.doc('rnc/' + id).update(upd);
      closeDlg();
    } catch (er) { btn.disabled = false; st.className = 'status err'; st.textContent = 'Não foi possível salvar (' + upErr(er) + ').'; }
  };
}

/* ===================== CONFERÊNCIA × MEDIÇÃO ===================== */
function viewConf() {
  const F = S.confF, fronts = AUDIT_FRONTS();
  if (!fronts.includes(F.frente)) F.frente = fronts[0];
  const key = F.frente, bmTxt = F.bm === 'atual' ? 'BM ' + D.meta.bm : 'todos os BMs';
  const rows = confAudit(key, F.bm), tot = sum(rows, x => x.val), cf = sum(rows, x => x.val * x.f), sem = sum(rows, x => x.sem);
  const pend = rows.filter(x => x.sem > .5).sort((a, b) => b.sem - a.sem);
  const nao = confNaoMedido(key);
  const lanc = S.conf.filter(c => c.frente === key).sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criado || '').localeCompare(a.criado || ''));
  const res = fronts.map(k => { const a = confAudit(k, F.bm); return {k, tot: sum(a, x => x.val), sem: sum(a, x => x.sem)}; });
  const bySvc = {}; pend.forEach(x => { const s = x.svc ? SVC[x.svc] : 'Item ' + x.r.item; bySvc[s] = (bySvc[s] || 0) + x.sem; });
  return `
  <section class="card">
    <div class="card-h"><h2>Conferência da fiscalização × medição</h2>${canWrite() ? `<button class="sp btn" data-newconf="${key}">+ Nova conferência</button>` : ''}</div>
    <p class="note" style="margin-top:-6px">Cada trecho medido pela construtora é comparado com os trechos que a fiscalização conferiu (checklist assinado). O que foi medido sem conferência aparece abaixo, com metros e valor. Os trechos de medição vêm da memória de cálculo do BM ${D.meta.bm}.</p>
    <div class="maptools" style="margin-top:4px">${fronts.map(k => `<button class="chip" data-cff="${k}" aria-pressed="${k === key}">${esc(Z[k].name)}</button>`).join('')}<span style="flex:1"></span><button class="chip" data-cfb="atual" aria-pressed="${F.bm === 'atual'}">BM ${D.meta.bm}</button><button class="chip" data-cfb="todos" aria-pressed="${F.bm === 'todos'}">Todos os BMs</button></div>
    <div class="tbl" style="margin-top:14px"><table style="min-width:560px"><thead><tr><th>Frente</th><th class="r">Medido (serviços conferíveis)</th><th class="r">Conferido</th><th class="r">Sem conferência</th></tr></thead><tbody>
      ${res.map(x => `<tr data-cff="${x.k}" style="cursor:pointer${x.k === key ? ';background:var(--accent-soft)' : ''}"><td><b>${esc(Z[x.k].name)}</b></td><td class="r">${BRL(x.tot)}</td><td class="r">${x.tot ? PCT((x.tot - x.sem) / x.tot, 0) : '—'}</td><td class="r" style="${x.sem > 1 ? 'color:var(--danger);font-weight:600' : ''}">${BRL(x.sem)}</td></tr>`).join('')}
    </tbody></table></div>
  </section>
  <section class="kpis" aria-label="Resumo da conferência">
    <div class="kpi"><div class="eyebrow">Medido · ${esc(bmTxt)}</div><div class="v">${BRLm(tot)}</div><div class="s">${esc(Z[key].name)} · serviços conferíveis</div></div>
    <div class="kpi"><div class="eyebrow">Conferido</div><div class="v" style="color:var(--conf)">${tot ? PCT(cf / tot, 0) : '—'}</div><div class="s">${BRL(cf)}</div></div>
    <div class="kpi"><div class="eyebrow">Medido sem conferência</div><div class="v" style="${sem > 1 ? 'color:var(--danger)' : ''}">${BRLm(sem)}</div><div class="s">${pend.length} trecho${pend.length === 1 ? '' : 's'} a cobrar o checklist</div></div>
    <div class="kpi"><div class="eyebrow">Conferido e não medido</div><div class="v">${NUM(sum(nao, x => x.falta), 0)} m</div><div class="s">${nao.length} trecho${nao.length === 1 ? '' : 's'} pronto${nao.length === 1 ? '' : 's'} para BM futuro</div></div>
  </section>
  <section class="card">
    <div class="card-h"><h2>Medido sem conferência</h2><span class="sp muted" style="font-size:13px">${esc(Z[key].name)} · ${esc(bmTxt)} · maior valor primeiro</span></div>
    ${Object.keys(bySvc).length ? `<div class="legend" style="margin-bottom:12px">${Object.entries(bySvc).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<span><b style="color:var(--fg)">${esc(s)}</b> ${BRL(v)}</span>`).join('')}</div>` : ''}
    ${pend.length ? `<div class="tbl"><table><thead><tr><th>Serviço</th><th>Item</th><th>Trecho medido</th><th>BM</th><th class="r">Medido</th><th class="r">Sem conf.</th><th class="r">Valor sem conf.</th>${canWrite() ? '<th></th>' : ''}</tr></thead><tbody>
      ${pend.slice(0, 150).map(x => `<tr><td>${esc(x.svc ? SVC[x.svc] : 'Item')}</td><td><span class="mono">${esc(x.r.item)}</span> <span class="muted">${esc(short(x.it.n).slice(0, 48))}</span></td><td class="mono" style="white-space:nowrap">${esc(trecho(x.r.ini, x.r.fim))}${x.r.lado ? ' · ' + esc(x.r.lado) : ''}</td><td class="r">${x.r.bm}</td><td class="r">${NUM(x.r.q)} ${esc(x.it.u)}</td><td class="r">${PCT(1 - x.f, 0)}</td><td class="r" style="font-weight:600">${BRL(x.sem)}</td>${canWrite() ? `<td><button class="chip" data-newconf="${key}" data-cs="${esc(x.svc || 'item')}" data-cit="${esc(x.r.item)}" data-ci="${x.r.ini}" data-cf="${x.r.fim}" data-cl="${esc(x.r.lado || '')}">Conferir</button></td>` : ''}</tr>`).join('')}
    </tbody></table></div>${pend.length > 150 ? `<p class="note">Mostrando os 150 trechos de maior valor de ${pend.length}.</p>` : ''}` : `<div class="empty-note">${tot ? 'Tudo o que foi medido nesta frente tem conferência registrada.' : 'Nenhum serviço conferível medido nesta frente neste período.'}</div>`}
    <p class="note">Use <b>Conferir</b> para lançar a conferência de um trecho já existente: os dados do trecho vêm preenchidos, basta anexar o checklist.</p>
  </section>
  ${nao.length ? `<section class="card"><div class="card-h"><h2>Conferido e ainda não medido</h2><span class="sp muted" style="font-size:13px">Serviço liberado que deve aparecer num próximo BM</span></div>
    <div class="logs">${nao.map(x => `<div class="log"><div class="dt">${esc(dBR(x.c.data).slice(0, 5))}</div><div><b>${esc(confLabel(x.c))}</b><div class="muted">${esc(trecho(x.c.ini, x.c.fim))}${x.c.lado ? ' · ' + esc(x.c.lado) : ''} · ${NUM(x.falta, 0)} m sem medição</div></div><span></span></div>`).join('')}</div></section>` : ''}
  <section class="card">
    <div class="card-h"><h2>Conferências lançadas</h2><span class="sp muted" style="font-size:13px">${esc(Z[key].name)} · ${lanc.length} registro${lanc.length === 1 ? '' : 's'}</span></div>
    ${lanc.length ? `<div class="logs">${lanc.map(confRow).join('')}</div>` : `<div class="empty-note">Nenhuma conferência lançada nesta frente. Comece pelos trechos do BM ${D.meta.bm} na tabela acima.</div>`}
  </section>`;
}
function confRow(c) {
  const mine = canClose(c);
  return `<div class="log"><div class="dt">${esc(dBR(c.data).slice(0, 5))}</div><div><b>${esc(confLabel(c))}</b><div class="muted">${esc(trecho(c.ini, c.fim))}${c.lado ? ' · ' + esc(c.lado) : ' · ambos os lados'}${nm(c.autor) ? ' · ' + esc(nm(c.autor)) : ''}${c.obs ? ' · ' + esc(c.obs) : ''}</div>
    <div class="ra" style="margin-top:6px">${c.anexo ? `<button class="chip" data-cfa="${esc(c.id)}">${c.anexoTipo === 'pdf' ? 'Checklist (PDF)' : 'Checklist'}</button>` : ''}${(c.fotos || []).length ? `<button class="chip" data-cfp="${esc(c.id)}">Fotos (${c.fotos.length})</button>` : ''}</div></div>
    ${mine && S.db ? `<button class="del" data-cdel="${esc(c.id)}">Excluir</button>` : '<span></span>'}</div>`;
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-cff]'); if (f) { S.confF.frente = f.dataset.cff; render(); return; }
  const b = e.target.closest('[data-cfb]'); if (b) { S.confF.bm = b.dataset.cfb; render(); return; }
  const a = e.target.closest('[data-cfa]'); if (a) { const c = S.conf.find(x => x.id === a.dataset.cfa); if (!c) return; if (c.anexoTipo === 'pdf') openPdf(c.anexo, 'Checklist · ' + confLabel(c) + ' · ' + trecho(c.ini, c.fim)); else openList([{id: c.id, data: c.data, asset: c.anexo, legenda: 'Checklist · ' + confLabel(c)}], 0, 'Checklist · ' + trecho(c.ini, c.fim)); return; }
  const p = e.target.closest('[data-cfp]'); if (p) { const c = S.conf.find(x => x.id === p.dataset.cfp); if (c) openList(c.fotos.map((x, i) => ({id: c.id + i, data: c.data, asset: x, legenda: confLabel(c)})), 0, confLabel(c) + ' · ' + trecho(c.ini, c.fim)); }
});
document.addEventListener('click', e => { const t = e.target.closest('[data-cff2]'); if (t) S.confF.frente = t.dataset.cff2; }, true);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-cdel]'); if (!b || !S.db) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar exclusão'; return; }
  try { await S.db.doc('conferencias/' + b.dataset.cdel).delete(); } catch (err) { b.textContent = 'Sem permissão'; }
});

/* nova conferência */
document.addEventListener('click', e => { const b = e.target.closest('[data-newconf]'); if (b) { e.preventDefault(); openConfForm({frente: b.dataset.newconf, serv: b.dataset.cs, item: b.dataset.cit, ini: b.dataset.ci, fim: b.dataset.cf, lado: b.dataset.cl}); } });
function openConfForm(pre = {}) {
  if (!canWrite()) { noWriteDlg('Nova conferência'); return; }
  const fronts = FRONT_KEYS;
  const fr = pre.frente && Z[pre.frente] ? pre.frente : S.confF.frente;
  const sv = pre.serv || '', ini = pre.ini != null && pre.ini !== '' ? estStr(+pre.ini) : '', fim = pre.fim != null && pre.fim !== '' && +pre.fim > +pre.ini ? estStr(+pre.fim) : '';
  openDlg(`
    <div class="bh"><div><div class="eyebrow">Conferência da fiscalização</div><h3>Registrar trecho conferido</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <p class="note" style="margin:0">Registre o trecho em que a fiscalização verificou o serviço e anexe o checklist assinado. É esse registro que o painel cruza com a medição.</p>
    <form class="form" id="fConf" novalidate>
      <div class="fgrid">
        <label class="f">Frente<select id="cf_front">${frontOpts(fronts, fr)}</select></label>
        <label class="f">Serviço conferido<select id="cf_serv">${svcOpts(fr, sv, 'conf')}</select></label>
        <label class="f">Estaca inicial<input id="cf_ini" inputmode="decimal" placeholder="ex.: 5012" value="${esc(ini)}"></label>
        <label class="f">Estaca final<input id="cf_fim" inputmode="decimal" placeholder="vazio se for um ponto" value="${esc(fim)}"></label>
        <label class="f">Lado<select id="cf_lado"><option value="">Ambos os lados / pista toda</option><option value="LE"${pre.lado === 'LE' ? ' selected' : ''}>LE</option><option value="LD"${pre.lado === 'LD' ? ' selected' : ''}>LD</option></select></label>
        <label class="f">Data da conferência<input type="date" id="cf_data" value="${todayISO()}" max="${todayISO()}"></label>
      </div>
      <label class="f" id="cf_itemw"${sv === 'item' ? '' : ' hidden'}>Item do boletim<select id="cf_item">${itemOpts(fr, pre.item || '', false)}</select></label>
      ${S.assets ? '<label class="f">Checklist assinado (foto ou PDF · obrigatório)<input type="file" id="cf_anexo" accept="image/*,application/pdf"></label><label class="f">Fotos do serviço (opcional)<input type="file" id="cf_fotos" accept="image/*" multiple></label>' : '<p class="note" style="margin:0">O envio de arquivos não está disponível no seu acesso. A conferência fica registrada sem o checklist; alguém da equipe pode anexar depois.</p><input type="file" id="cf_anexo" hidden><input type="file" id="cf_fotos" hidden>'}
      <label class="f">Observação<textarea id="cf_obs" placeholder="opcional" style="min-height:52px"></textarea></label>
      <div class="alerts" id="cf_info" aria-live="polite"></div>
      <div class="ra"><button class="btn" type="submit" id="cf_go">Salvar conferência</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="cf_st" role="status"></span></div>
    </form>`);
  const info = () => {
    const k = $('#cf_front').value, s = $('#cf_serv').value, a = fixEst(k, parseEst($('#cf_ini').value)), bb = fixEst(k, parseEst($('#cf_fim').value)), b = isNaN(bb) ? a : bb, it = $('#cf_item').value;
    $('#cf_itemw').hidden = s !== 'item';
    if (!s || isNaN(a) || (s === 'item' && !it)) { $('#cf_info').innerHTML = ''; return; }
    const rs = recsIn(k).filter(r => (s === 'item' ? r.item === it : svcOfRec(k, r) === s) && r.fim >= a - 1 && r.ini <= b + 1);
    const ja = S.conf.filter(c => c.frente === k && (c.serv === s && (s !== 'item' || c.item === it)) && c.ini <= b + 1 && cEnd(c) >= a - 1);
    const out = [];
    out.push(rs.length ? {nivel: 'info', src: 'local', texto: `Neste trecho há ${rs.length} registro${rs.length > 1 ? 's' : ''} de medição deste serviço (BM ${[...new Set(rs.map(r => r.bm))].sort((x, y) => x - y).join(', ')}).`} : {nivel: 'info', src: 'local', texto: 'Este trecho ainda não aparece medido para este serviço. Ele ficará como "conferido e não medido".'});
    if (ja.length) out.push({nivel: 'medio', src: 'local', texto: `Já existe conferência deste serviço que se sobrepõe a este trecho (${ja.map(c => trecho(c.ini, c.fim) + ' em ' + dBR(c.data)).slice(0, 3).join('; ')}).`});
    $('#cf_info').innerHTML = alertsHtml(out);
  };
  $('#cf_front').onchange = () => { const k = $('#cf_front').value; $('#cf_serv').innerHTML = svcOpts(k, '', 'conf'); $('#cf_item').innerHTML = itemOpts(k, '', false); info(); };
  ['cf_serv', 'cf_ini', 'cf_fim', 'cf_item'].forEach(id => { $('#' + id).addEventListener('change', info); $('#' + id).addEventListener('input', info); });
  info();
  $('#fConf').onsubmit = async e => {
    e.preventDefault();
    const st = $('#cf_st'), btn = $('#cf_go'), v = id => ($('#' + id).value || '').trim();
    const k = v('cf_front'), s = v('cf_serv'), it = v('cf_item'), a = fixEst(k, parseEst(v('cf_ini'))), bb = fixEst(k, parseEst(v('cf_fim'))), data = v('cf_data');
    const anexo = $('#cf_anexo').files[0], fotos = [...$('#cf_fotos').files].slice(0, 6);
    const fail = t => { st.className = 'status err'; st.textContent = t; };
    if (!s) return fail('Escolha o serviço conferido.');
    if (s === 'item' && !it) return fail('Escolha o item do boletim.');
    if (isNaN(a)) return fail('Informe a estaca inicial (ex.: 5012 ou 10+5).');
    if (v('cf_fim') && isNaN(bb)) return fail('Estaca final inválida.');
    if (!isNaN(bb) && bb < a) return fail('A estaca final precisa ser maior que a inicial.');
    if (!data) return fail('Informe a data da conferência.');
    if (!anexo && S.assets) return fail('Anexe o checklist assinado (foto ou PDF).');
    const isPdf = !!anexo && (anexo.type === 'application/pdf' || /\.pdf$/i.test(anexo.name));
    if (isPdf && anexo.size > 20 * 1024 * 1024) return fail('O PDF passa de 20 MB. Reduza o arquivo ou fotografe o checklist.');
    btn.disabled = true; st.className = 'status';
    try {
      st.textContent = 'Enviando checklist…';
      const anexoId = !anexo ? '' : isPdf ? (await S.assets.upload(anexo)).id : await upImg(anexo);
      const ids = []; for (let i = 0; i < fotos.length; i++) { st.textContent = `Enviando foto ${i + 1} de ${fotos.length}…`; ids.push(await upImg(fotos[i])); }
      st.textContent = 'Salvando…';
      await S.db.collection('conferencias').add({frente: k, serv: s, item: s === 'item' ? it : '', ini: a, fim: isNaN(bb) ? a : bb, lado: v('cf_lado'), data, anexo: anexoId, anexoTipo: isPdf ? 'pdf' : 'img', fotos: ids, obs: v('cf_obs').slice(0, 600), autor: S.myId || '', criado: new Date().toISOString()});
      S.confF.frente = AUDIT_FRONTS().includes(k) ? k : S.confF.frente;
      closeDlg();
    } catch (er) { btn.disabled = false; fail('Não foi possível salvar (' + upErr(er) + ').'); }
  };
}

/* ===================== PROJETOS EM USO (LISTA MESTRA) ===================== */
const DST = {uso: ['Em uso', 'uso'], analise: ['Em análise', 'analise'], subst: ['Substituído', 'subst']};
const normCod = s => norm(s).replace(/\s+/g, '');
function viewDocs() {
  return `<section class="card">
    <div class="card-h"><h2>Projetos em uso</h2><span class="muted" style="font-size:13px">Lista mestra · revisão vigente de cada prancha</span>${canWrite() ? '<button class="sp btn" data-newdoc="">+ Adicionar projeto</button>' : ''}</div>
    <div class="filt"><input id="docq" type="search" placeholder="Buscar por código, título ou disciplina" value="${esc(S.docsF.q)}" style="flex:1;min-width:220px;background:var(--surface-2);border:1px solid var(--line-2);border-radius:8px;padding:8px 10px"><label class="chk"><input type="checkbox" id="docsub"${S.docsF.subst ? ' checked' : ''}> Mostrar revisões substituídas</label></div>
    <div id="docsTbl">${docsTable()}</div>
    <p class="note">PDF de até 20 MB fica guardado aqui no painel e abre direto na tela. DWG, planilhas e volumes maiores: guarde no SharePoint ou OneDrive e cole o link no cadastro. Ao cadastrar uma revisão nova "em uso", a anterior com o mesmo código passa a "substituída" automaticamente.</p>
  </section>`;
}
function docsTable() {
  const q = norm(S.docsF.q);
  const ds = S.docs.filter(d => (S.docsF.subst || d.st !== 'subst') && (!q || norm([d.cod, d.titulo, d.disc, d.obs, frontName(d.frente)].join(' ')).includes(q)));
  if (!ds.length) return `<div class="empty-note">${S.docs.length ? 'Nenhum projeto encontrado com esse filtro.' : 'Nenhum projeto cadastrado ainda. Comece pelas pranchas que a equipe usa hoje em campo.'}</div>`;
  const discs = [...new Set(ds.map(d => d.disc || 'Outros'))].sort((a, b) => (DISC.indexOf(a) + 99) % 100 - (DISC.indexOf(b) + 99) % 100);
  return `<div class="tbl"><table><thead><tr><th>Código</th><th>Título</th><th>Frente</th><th>Rev.</th><th>Data</th><th>Status</th><th>Arquivo</th>${canWrite() ? '<th></th>' : ''}</tr></thead><tbody>
    ${discs.map(dc => `<tr class="dgrp"><td colspan="${canWrite() ? 8 : 7}">${esc(dc)}</td></tr>` + ds.filter(d => (d.disc || 'Outros') === dc).sort((a, b) => String(a.cod).localeCompare(String(b.cod), 'pt', {numeric: true}) || String(b.rev).localeCompare(String(a.rev), 'pt', {numeric: true})).map(d => `
      <tr${d.st === 'subst' ? ' class="subst"' : ''}><td class="mono" style="white-space:nowrap">${esc(d.cod)}</td><td>${esc(d.titulo)}${d.obs ? `<div class="muted" style="font-size:12px">${esc(d.obs)}</div>` : ''}</td><td>${esc(frontName(d.frente))}</td><td class="mono">${esc(d.rev)}</td><td style="white-space:nowrap">${esc(dBR(d.data))}</td><td><span class="tag ds-${esc(d.st)}">${esc((DST[d.st] || [d.st])[0])}</span></td>
      <td style="white-space:nowrap">${d.asset ? `<button class="chip" data-dpdf="${esc(d.id)}">Abrir PDF</button> ` : ''}${d.link ? `<a class="chip" href="${esc(d.link)}" target="_blank" rel="noopener">Pasta ↗</a>` : ''}${!d.asset && !d.link ? '<span class="muted">—</span>' : ''}</td>
      ${canWrite() ? `<td style="white-space:nowrap"><button class="chip" data-newdoc="${esc(d.id)}">Nova revisão</button>${d.st !== 'subst' ? ` <button class="chip" data-dsub="${esc(d.id)}">Substituído</button>` : ''}${canClose(d) ? ` <button class="del" data-ddel="${esc(d.id)}">Excluir</button>` : ''}</td>` : ''}</tr>`).join('')).join('')}
  </tbody></table></div>`;
}
document.addEventListener('input', e => { if (e.target.id === 'docq') { S.docsF.q = e.target.value; const t = $('#docsTbl'); if (t) t.innerHTML = docsTable(); } });
document.addEventListener('change', e => { if (e.target.id === 'docsub') { S.docsF.subst = e.target.checked; const t = $('#docsTbl'); if (t) t.innerHTML = docsTable(); } });
document.addEventListener('click', async e => {
  const p = e.target.closest('[data-dpdf]'); if (p) { const d = S.docs.find(x => x.id === p.dataset.dpdf); if (d) openPdf(d.asset, d.cod + ' · ' + d.titulo + ' · ' + d.rev); return; }
  const s = e.target.closest('[data-dsub]'); if (s && S.db) { if (s.dataset.confirm !== '1') { s.dataset.confirm = '1'; s.textContent = 'Confirmar'; return; } try { await S.db.doc('docs/' + s.dataset.dsub).update({st: 'subst', substEm: todayISO()}); } catch (err) { s.textContent = 'Sem permissão'; } return; }
  const x = e.target.closest('[data-ddel]'); if (x && S.db) { if (x.dataset.confirm !== '1') { x.dataset.confirm = '1'; x.textContent = 'Confirmar exclusão'; return; } try { await S.db.doc('docs/' + x.dataset.ddel).delete(); } catch (err) { x.textContent = 'Sem permissão'; } }
});
document.addEventListener('click', e => { const b = e.target.closest('[data-newdoc]'); if (b) { e.preventDefault(); openDocForm(S.docs.find(x => x.id === b.dataset.newdoc)); } });
function openDocForm(base) {
  if (!canWrite()) { noWriteDlg('Adicionar projeto'); return; }
  const b = base || {};
  openDlg(`
    <div class="bh"><div><div class="eyebrow">Lista mestra de projetos</div><h3>${base ? 'Nova revisão de ' + esc(b.cod) : 'Adicionar projeto'}</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <form class="form" id="fDoc" novalidate>
      <div class="fgrid">
        <label class="f">Código / nº da prancha<input id="dc_cod" value="${esc(b.cod || '')}" placeholder="ex.: E5-PAV-003"></label>
        <label class="f">Revisão<input id="dc_rev" placeholder="ex.: R02" value=""></label>
        <label class="f">Data da revisão<input type="date" id="dc_data" value="${todayISO()}"></label>
        <label class="f">Disciplina<select id="dc_disc">${DISC.map(x => `<option${x === (b.disc || 'Pavimentação') ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="f">Frente<select id="dc_front"><option value="geral">Geral</option>${frontOpts(PEND_FRONTS, b.frente || '')}</select></label>
        <label class="f">Status<select id="dc_st"><option value="uso">Em uso (liberado para obra)</option><option value="analise">Em análise</option></select></label>
      </div>
      <label class="f">Título<input id="dc_tit" value="${esc(b.titulo || '')}" placeholder="ex.: Planta de pavimentação · Est. 5000 a 5019"></label>
      <label class="f">PDF da prancha (opcional · até 20 MB)<input type="file" id="dc_pdf" accept="application/pdf"></label>
      <label class="f">Link da pasta ou do arquivo no SharePoint/OneDrive (opcional)<input id="dc_link" type="url" placeholder="https://…" value="${esc(b.link || '')}"></label>
      <label class="f">Observação<input id="dc_obs" placeholder="ex.: revisão após compatibilização com a Compesa"></label>
      <div class="ra"><button class="btn" type="submit" id="dc_go">Salvar</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="dc_st" role="status"></span></div>
    </form>`);
  $('#fDoc').onsubmit = async e => {
    e.preventDefault();
    const st = $('#dc_st'), btn = $('#dc_go'), v = id => ($('#' + id).value || '').trim(), fail = t => { st.className = 'status err'; st.textContent = t; };
    const cod = v('dc_cod'), rev = v('dc_rev'), tit = v('dc_tit'), link = v('dc_link'), pdf = $('#dc_pdf').files[0], sts = v('dc_st');
    if (!cod) return fail('Informe o código da prancha.');
    if (!rev) return fail('Informe a revisão.');
    if (!tit) return fail('Informe o título.');
    if (link && !/^https:\/\//i.test(link)) return fail('O link precisa começar com https://');
    if (pdf && pdf.size > 20 * 1024 * 1024) return fail('O PDF passa de 20 MB. Guarde no SharePoint e cole o link.');
    if (S.docs.some(d => normCod(d.cod) === normCod(cod) && norm(d.rev) === norm(rev))) return fail(`A revisão ${rev} de ${cod} já está cadastrada.`);
    btn.disabled = true; st.className = 'status';
    try {
      let asset = '';
      if (pdf && S.assets) { st.textContent = 'Enviando PDF…'; asset = (await S.assets.upload(pdf)).id; }
      st.textContent = 'Salvando…';
      if (sts === 'uso') for (const d of S.docs.filter(d => normCod(d.cod) === normCod(cod) && d.st === 'uso')) { try { await S.db.doc('docs/' + d.id).update({st: 'subst', substEm: todayISO(), substPor: rev}); } catch (er) {} }
      await S.db.collection('docs').add({cod, rev, titulo: tit, disc: v('dc_disc'), frente: v('dc_front'), data: v('dc_data'), st: sts, asset, link, obs: v('dc_obs').slice(0, 300), autor: S.myId || '', criado: new Date().toISOString()});
      closeDlg();
    } catch (er) { btn.disabled = false; fail('Não foi possível salvar (' + upErr(er) + ').'); }
  };
}

/* ---------- visualizador de PDF (pdf.js) ---------- */
let PDFJSp = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!PDFJSp) PDFJSp = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {} res(); }; s.onerror = () => { PDFJSp = null; rej(new Error('pdfjs')); }; document.head.appendChild(s); });
  return PDFJSp;
}
async function openPdf(id, t) {
  const el = $('#lb'); LB.list = []; LB.i = 0;
  const tok = String(Math.random());
  el.dataset.tok = tok;
  el.innerHTML = `<div class="top"><div><div class="eyebrow" style="color:#bfe9dc">PDF</div><h3>${esc(t)}</h3></div><a class="lbtn" style="margin-left:auto;text-decoration:none" href="${BLOB}${esc(id)}" target="_blank" rel="noopener">Abrir em nova aba ↗</a><button class="lbtn x" data-lbx style="margin-left:0">Fechar ✕</button></div>
    <div class="pdfv" id="pdfv"><p>Carregando PDF…</p></div><div></div>`;
  el.hidden = false;
  try {
    await loadPdfJs();
    const pdf = await window.pdfjsLib.getDocument({url: BLOB + id}).promise;
    const box = $('#pdfv'); if (!box || el.dataset.tok !== tok) return; box.innerHTML = '';
    const w = Math.max(280, Math.min(box.clientWidth - 8, 1600)), dpr = Math.min(2, window.devicePixelRatio || 1);
    const N = Math.min(pdf.numPages, 40);
    for (let p = 1; p <= N; p++) {
      if (el.hidden || el.dataset.tok !== tok) return;
      const page = await pdf.getPage(p), v1 = page.getViewport({scale: 1}), vp = page.getViewport({scale: w / v1.width * dpr});
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.style.width = w + 'px';
      box.appendChild(c);
      await page.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
    }
    if (pdf.numPages > N) box.insertAdjacentHTML('beforeend', `<p>Mostrando ${N} de ${pdf.numPages} páginas. Use "Abrir em nova aba" para ver o restante.</p>`);
  } catch (e) { const box = $('#pdfv'); if (box) box.innerHTML = '<p>Não foi possível mostrar o PDF aqui. Use "Abrir em nova aba".</p>'; }
}

/* ===================== Ligações com as telas existentes ===================== */
function attnCard() {
  const top = S.rnc.filter(r => isOpen(r) && (r.grav === 'critica' || isLate(r))).sort(pendSort).slice(0, 5);
  const ab = S.rnc.filter(isOpen).length, rt = S.rnc.filter(r => isOpen(r) && r.retem).length;
  const {tot, sem} = semConfBM();
  return `<section class="card">
    <div class="card-h"><h2>Pontos de atenção</h2><span class="sp" style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" data-go="pend">${ab} pendência${ab === 1 ? '' : 's'} aberta${ab === 1 ? '' : 's'}</button><button class="chip" data-go="conf">Conferência × medição</button></span></div>
    <div class="attn">
      ${top.map(r => `<button class="arow" data-go="pend"><span class="tag ${esc(r.grav)}">${esc(GRAV[r.grav] ? GRAV[r.grav][0] : '')}</span><span><b>${esc(r.num)}</b> · ${esc(frontName(r.frente))} · ${esc(trecho(r.ini, r.fim))}<span class="muted"> · ${esc((r.desc || '').slice(0, 90))}</span></span><span class="${isLate(r) ? 'lt-t' : 'muted'}" style="font-size:13px;white-space:nowrap">${isLate(r) ? 'vencida há ' + (-daysTo(r.prazo)) + ' d' : 'prazo ' + esc(dBR(r.prazo).slice(0, 5))}</span></button>`).join('')}
      ${!top.length ? `<div class="muted" style="font-size:14px;padding:4px 2px">Nenhuma pendência crítica ou vencida${ab ? ` · ${ab} em acompanhamento` : ''}.</div>` : ''}
      ${tot ? `<button class="arow" data-go="conf"><span class="tag" style="border-color:var(--conf);color:var(--conf)">BM ${D.meta.bm}</span><span><b>${BRL(sem)}</b> medidos sem conferência registrada<span class="muted"> · ${PCT(sem / tot, 0)} do medido em serviços conferíveis</span></span><span class="muted" style="font-size:13px">ver trechos →</span></button>` : ''}
      ${(() => { const av = ishTodas().filter(x => acaoLate(x.c)); return av.length ? `<button class="arow" data-go="pend"><span class="tag lt">Ação</span><span><b>${av.length}</b> ${av.length > 1 ? 'ações combinadas' : 'ação combinada'} com prazo vencido<span class="muted"> · ${esc(av.slice(0, 2).map(x => x.c.acao).join('; '))}</span></span><span class="muted" style="font-size:13px">cobrar →</span></button>` : ''; })()}
      ${(() => { const sa = semAvanco().filter(x => x.st !== 'ok'); return sa.length ? `<button class="arow" data-go="pend"><span class="tag alta">0%</span><span><b>${sa.length}</b> grupo${sa.length === 1 ? '' : 's'} do boletim sem avanço e sem previsão confirmada<span class="muted"> · ${esc(sa.slice(0, 3).map(x => title(x.g.name) + ' (' + x.z.name + ')').join(', '))}${sa.length > 3 ? '…' : ''}</span></span><span class="muted" style="font-size:13px">responder →</span></button>` : ''; })()}
      ${rt ? `<button class="arow" data-go="pend"><span class="tag ret">Retém</span><span><b>${rt}</b> pendência${rt === 1 ? '' : 's'} com medição retida</span><span></span></button>` : ''}
    </div>
  </section>`;
}
function frontPend(key) {
  const rs = S.rnc.filter(r => r.frente === key && isOpen(r)).sort(pendSort);
  let semTxt = '';
  if (MAPCFG[key]) { const a = confAudit(key, 'atual'), tot = sum(a, x => x.val), sem = sum(a, x => x.sem); if (tot) semTxt = `<button class="arow" data-go="conf" data-cff2="${key}" style="margin-bottom:12px"><span class="tag" style="border-color:var(--conf);color:var(--conf)">BM ${D.meta.bm}</span><span><b>${BRL(sem)}</b> medidos nesta frente sem conferência<span class="muted"> · ${PCT(1 - sem / tot, 0)} conferido</span></span><span class="muted" style="font-size:13px">ver trechos →</span></button>`; }
  if (isDir()) return `<section class="card"><div class="card-h"><h2>Medição e conferência</h2></div>${medidoHtml(key)}${semTxt}</section>`;
  return `<section class="card">
    <div class="card-h"><h2>Pendências e conferência</h2>${canWrite() ? `<span class="sp" style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" data-newrnc="${key}">+ Pendência</button>${MAPCFG[key] ? `<button class="chip" data-newconf="${key}">+ Conferência</button>` : ''}</span>` : ''}</div>
    ${medidoHtml(key)}
    ${semTxt}
    ${rs.length ? `<div class="rlist">${rs.slice(0, 5).map(rncCard).join('')}</div>${rs.length > 5 ? `<button class="chip" data-go="pend" style="margin-top:10px">Ver todas (${rs.length})</button>` : ''}` : '<div class="empty-note">Nenhuma pendência aberta nesta frente.</div>'}
  </section>`;
}
function stakeExtra(el, key, m) {
  const rn = S.rnc.filter(r => r.frente === key && isOpen(r) && num0(r.ini) != null && m >= r.ini - 25 && m <= (num0(r.fim) != null && r.fim > r.ini ? r.fim : r.ini) + 25);
  const cf = S.conf.filter(c => c.frente === key && m >= c.ini - 2 && m <= cEnd(c) + 2);
  const left = el.children[0], right = el.children[1];
  const nds = DREN[key] ? DREN[key].nodes.filter(n => n.est != null && Math.abs(n.est - m) <= 14 && Math.abs(n.off || 0) < 10) : [];
  if (right && nds.length) right.insertAdjacentHTML('beforeend', nds.map(n => `<button class="chip" data-opennode="${key}|${esc(n.id)}">Caixa ${esc(n.id)}</button>`).join(''));
  if (left && (cf.length || rn.length)) left.insertAdjacentHTML('beforeend', `${cf.length ? `<div class="eyebrow" style="margin-top:12px">Conferido pela fiscalização</div><ul>${cf.map(c => `<li><span class="mono" style="color:var(--conf)">✔</span><span>${esc(confLabel(c))}<span class="muted"> · ${esc(trecho(c.ini, c.fim))}${c.lado ? ' · ' + esc(c.lado) : ''} · ${esc(dBR(c.data))}</span></span></li>`).join('')}</ul>` : ''}${rn.length ? `<div class="eyebrow" style="margin-top:12px;color:var(--danger)">Pendências não fechadas</div><ul>${rn.map(r => `<li><span class="mono" style="color:var(--danger)">${esc(r.num)}</span><span>${esc((r.desc || '').slice(0, 90))}<span class="muted"> · ${esc(GRAV[r.grav] ? GRAV[r.grav][0] : '')} · ${esc(RST[r.st] || '')}</span></span></li>`).join('')}</ul>` : ''}`);
  if (right && canWrite()) right.insertAdjacentHTML('beforeend', `<button class="chip" data-newrnc="${key}" data-est="${Math.round(m)}">+ Pendência aqui</button><button class="chip" data-newconf="${key}" data-ci="${Math.round(m)}">+ Conferência aqui</button>`);
}


/* =====================================================================
   MÓDULO 2 · drenagem do projeto (planta + 3D), caixas com fotos,
   "o que foi medido", "o que falta para concluir", serviços sem avanço
   ===================================================================== */
S.cxFotos = []; S.faltas = []; S.semAv = {}; S.medScope = 'atual';

/* ---------- drenagem: estado das caixas ---------- */
const nodeById = (key, id) => (DREN[key] ? DREN[key].nodes.find(n => n.id === id) : null);
function nodeState(key, id) {
  return {fotos: S.cxFotos.filter(f => f.frente === key && f.no === id).length, pend: S.rnc.filter(r => r.frente === key && r.no === id && isOpen(r)).length};
}
const nodeTipo = n => ({BLS: 'Boca de lobo simples', BLC: 'Boca de lobo combinada', CX: 'Caixa', BOCA: 'Boca de lançamento', MURO: 'Muro de ala'}[n.tipo] || n.tipo);
function drenSvg(key, K, part) {
  const N = DREN[key]; let s = '';
  if (part !== 'nodes') {
  const pth = pts => 'M' + pts.map(p => (+p[0]).toFixed(2) + ',' + (+p[1]).toFixed(2)).join('L');
  N.links.filter(l => l.tipo !== 'ligacao').forEach(l => {
    const w = l.tipo === 'aduela' ? 2.2 : /1200/.test(l.dim) ? 1.6 : 1.1;
    s += `<path d="${pth(l.pts)}" fill="none" stroke="var(--water)" stroke-width="${Math.max(w, .7 * K)}" stroke-linejoin="round" opacity="${l.tipo === 'aduela' ? .8 : .95}"><title>${esc(l.dim)} · projeto · ${NUM(l.L, 0)} m · Est. ${estStr(Math.max(0, l.ini))} a ${estStr(l.fim)}</title></path>`;
    if (l.tipo === 'aduela') s += `<path d="${pth(l.pts)}" fill="none" stroke="var(--surface)" stroke-width="${Math.max(.25, .18 * K)}" opacity=".85" pointer-events="none"/>`;
  });
  N.links.filter(l => l.tipo === 'ligacao').forEach(l => { s += `<path d="${pth(l.pts)}" fill="none" stroke="var(--water)" stroke-width="${Math.max(.45, .32 * K)}" stroke-dasharray="1.6 1"><title>${esc(l.dim)} · ${NUM(l.L, 1)} m</title></path>`; });
  return s; }
  N.nodes.forEach(n => {
    const st = nodeState(key, n.id), z = Math.max(1.55, K * 1.1);
    const fill = st.pend ? 'var(--danger)' : st.fotos ? 'var(--water)' : 'var(--surface)';
    const ttl = `${n.nome}${n.est != null ? ' · Est. ' + estStr(Math.max(0, n.est)) : ''}${n.T != null ? ' · topo ' + NUM(n.T, 2) : ''}${n.F != null ? ' · fundo ' + NUM(n.F, 2) : ''}${st.fotos ? ' · ' + st.fotos + ' foto(s)' : ''}${st.pend ? ' · ' + st.pend + ' pendência(s)' : ''} · clique para abrir`;
    let shp;
    if (n.tipo === 'BOCA') shp = `<circle r="${1.1 * z}" fill="${fill}" stroke="var(--water)" stroke-width="${.4 * z}"/>`;
    else if (n.tipo === 'MURO') shp = `<path d="M${-1.6 * z},${-1.6 * z} L${1.6 * z},0 L${-1.6 * z},${1.6 * z}Z" fill="${fill}" stroke="var(--water)" stroke-width="${.4 * z}"/>`;
    else { const h = (n.tipo === 'CX' ? 1.35 : 1.05) * z; shp = `<rect x="${-h}" y="${-h}" width="${2 * h}" height="${2 * h}" rx="${.25 * z}" fill="${fill}" stroke="var(--water)" stroke-width="${.42 * z}"/>${n.cx ? `<circle r="${.38 * z}" fill="var(--water)"/>` : ''}`; }
    s += `<g class="dnode" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.nome)}" transform="translate(${n.x},${n.y})"><circle r="${2.8 * z}" fill="transparent"/>${shp}<text class="nlab" y="${(n.tipo === 'CX' ? -2.4 : -1.9) * z}" text-anchor="middle">${esc(n.id.replace('CX-', 'CX').replace('BOCA-', 'B'))}</text><title>${esc(ttl)}</title></g>`;
  });
  return s;
}
document.addEventListener('keydown', e => { const g = e.target.closest && e.target.closest('[data-node]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const svg = g.closest('svg'); openNode(svg && svg.dataset.key || S.tab, g.dataset.node); } });

/* ---------- caixa: ficha com fotos e pendências ---------- */
function openNode(key, id, msg) {
  const n = nodeById(key, id); if (!n) return;
  const fotos = S.cxFotos.filter(f => f.frente === key && f.no === id).sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.criado || '').localeCompare(b.criado || ''));
  const pend = S.rnc.filter(r => r.frente === key && r.no === id).sort(pendSort);
  const prj = S.docs.find(d => d.st === 'uso' && d.frente === key && /dren/i.test((d.disc || '') + ' ' + (d.cod || '') + ' ' + (d.titulo || '')));
  const fact = (k, v) => v == null || v === '' ? '' : `<div><div class="eyebrow">${esc(k)}</div><div class="mono" style="font-size:15px">${v}</div></div>`;
  const recs = n.est != null ? recsIn(key).filter(r => svcOfRec(key, r) === 'dren' && Math.abs((r.fim > r.ini ? Math.max(r.ini, Math.min(r.fim, n.est)) : r.ini) - n.est) <= 12) : [];
  openDlg(`
    <div class="bh"><div><div class="eyebrow">Drenagem · ${esc(nodeTipo(n))} · projeto</div><h3>${esc(n.nome)}</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    ${msg ? `<div class="al"><span class="src">Painel</span>${esc(msg)}</div>` : ''}
    <div class="nfacts">
      ${fact('Estaca', n.est != null ? estStr(Math.max(0, n.est)) : '')}
      ${fact('Afastamento do eixo', n.off != null ? NUM(Math.abs(n.off), 1) + ' m · ' + (n.off >= 0 ? 'LE' : 'LD') : '')}
      ${fact(n.tipo === 'CX' ? 'Cota da tampa' : 'Cota do topo', n.T != null ? NUM(n.T, 2) + ' m' : '')}
      ${fact('Cota de fundo', n.F != null ? NUM(n.F, 2) + ' m' : '')}
      ${fact('Profundidade', n.h != null ? NUM(n.h, 2) + ' m' : '')}
      ${fact('Coordenadas UTM', n.E ? `E ${NUM(n.E, 3)}<br>N ${NUM(n.N, 3)}` : '')}
    </div>
    ${n.cx ? '<p class="note" style="margin:0">Boca de lobo combinada com caixa de ligação na rede tubular.</p>' : ''}
    ${recs.length ? `<p class="note" style="margin:0">Medição de drenagem perto daqui: ${recs.slice(0, 3).map(r => esc(r.txt) + ' (BM ' + r.bm + ')').join(' · ')}${recs.length > 3 ? ' …' : ''}</p>` : ''}
    <div>
      <div class="card-h" style="margin-bottom:8px"><h3>Fotos da caixa</h3>${canWrite() && S.assets ? `<button class="sp chip" id="cx_addbtn">+ Adicionar fotos</button>` : ''}</div>
      ${fotos.length ? `<div class="thumbs">${fotos.map((f, i) => `<button data-cxph="${esc(key)}|${esc(id)}|${i}" title="${esc(dBR(f.data) + (f.legenda ? ' · ' + f.legenda : ''))}"><img loading="lazy" src="${esc(BLOB + f.asset)}" alt="Foto ${i + 1}"></button>`).join('')}</div>` : '<div class="empty-note" style="padding:12px">Nenhuma foto desta caixa ainda.</div>'}
      <form class="form" id="fCx" hidden style="margin-top:12px" novalidate>
        <div class="fgrid"><label class="f">Data<input type="date" id="cx_data" value="${todayISO()}" max="${todayISO()}"></label><label class="f" style="grid-column:span 2">Legenda (opcional)<input id="cx_leg" placeholder="ex.: grelha assentada, tampa sem rejunte"></label></div>
        <label class="f">Fotos<input type="file" id="cx_files" accept="image/*" multiple></label>
        <div class="ra"><button class="btn sm" id="cx_go" type="submit">Salvar fotos</button><span class="status" id="cx_st" role="status"></span></div>
      </form>
    </div>
    <div>
      <div class="card-h" style="margin-bottom:8px"><h3>Pendências desta caixa</h3>${canWrite() ? `<button class="sp chip" data-newrnc="${esc(key)}" data-est="${n.est != null ? Math.max(0, n.est) : ''}" data-no="${esc(id)}">+ Pendência nesta caixa</button>` : ''}</div>
      ${pend.length ? `<div class="logs">${pend.map(r => `<div class="log"><div class="dt">${esc(r.num.replace('RNC-', ''))}</div><div><b>${esc((r.desc || '').slice(0, 110))}</b><div class="muted">${esc(GRAV[r.grav] ? GRAV[r.grav][0] : '')} · ${esc(RST[r.st] || '')} · prazo ${esc(dBR(r.prazo))}</div></div><span class="tag ${esc(r.grav)}">${esc(GRAV[r.grav] ? GRAV[r.grav][0] : '')}</span></div>`).join('')}</div>` : '<div class="muted" style="font-size:14px">Nenhuma pendência ligada. Se faltar grelha, tampa, rejunte ou limpeza, registre aqui.</div>'}
    </div>
    <div class="ra">${D.secoes[key] && n.est != null && Math.abs(n.off || 0) < 30 ? `<button class="btn sm ghost" data-n3d="${esc(key)}|${esc(id)}">Ver no 3D</button>` : ''}${prj && prj.asset ? `<button class="btn sm ghost" data-dpdf="${esc(prj.id)}">Prancha de drenagem</button>` : ''}<span class="muted" style="font-size:12.5px;margin-left:auto">${esc(DREN[key].fonte)}</span></div>`);
  const ab = $('#cx_addbtn'); if (ab) ab.onclick = () => { $('#fCx').hidden = false; ab.hidden = true; };
  const f = $('#fCx'); if (f) f.onsubmit = async e => {
    e.preventDefault();
    const st = $('#cx_st'), btn = $('#cx_go'), files = [...$('#cx_files').files].slice(0, 8), data = $('#cx_data').value, leg = ($('#cx_leg').value || '').trim();
    if (!files.length) { st.className = 'status err'; st.textContent = 'Escolha ao menos uma foto.'; return; }
    if (!data) { st.className = 'status err'; st.textContent = 'Informe a data.'; return; }
    btn.disabled = true;
    try {
      for (let i = 0; i < files.length; i++) { st.className = 'status'; st.textContent = `Enviando foto ${i + 1} de ${files.length}…`; const a = await upImg(files[i]); await S.db.collection('fotos_caixas').add({frente: key, no: id, est: n.est != null ? Math.max(0, n.est) : null, data, asset: a, legenda: leg.slice(0, 200), autor: S.myId || '', criado: new Date().toISOString()}); }
      setTimeout(() => openNode(key, id, `${files.length} foto${files.length > 1 ? 's' : ''} salva${files.length > 1 ? 's' : ''}.`), 250);
    } catch (er) { btn.disabled = false; st.className = 'status err'; st.textContent = 'Não foi possível enviar (' + upErr(er) + ').'; }
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cxph]'); if (b) { const [k, id, i] = b.dataset.cxph.split('|'); const n = nodeById(k, id); const list = S.cxFotos.filter(f => f.frente === k && f.no === id).sort((a, c) => (a.data || '').localeCompare(c.data || '') || (a.criado || '').localeCompare(c.criado || '')); openList(list, +i, n ? n.nome : id); return; }
  const v = e.target.closest('[data-n3d]'); if (v) { const [k, id] = v.dataset.n3d.split('|'); const n = nodeById(k, id); if (!n) return; closeDlg(); const sc = D.secoes[k]; let seg = sc.len.findIndex(r => n.est >= r[0] - 1 && n.est <= r[1] + 1); if (seg < 0) seg = 0; const r = sc.len[seg]; S.perf[k] = {seg, a: Math.max(r[0], Math.round(n.est - 45)), b: Math.min(r[1], Math.round(n.est + 45))}; P3.focus = {key: k, id}; if (S.tab !== k) go(k); else drawPerfil(k); setTimeout(() => { const c = $('#perfCard'); if (c) c.scrollIntoView({behavior: 'smooth', block: 'start'}); }, 80); }
});

/* ---------- o que foi medido neste trecho ---------- */
function medidoResumo(key, scope) {
  const by = {};
  recsIn(key).forEach(r => {
    if (scope === 'atual' && r.bm !== D.meta.bm) return;
    const it = itemName(r.item); if (!it) return;
    const svc = svcOfRec(key, r), val = (r.q || 0) * (it.pu || 0);
    const g = by[r.item] = by[r.item] || {item: r.item, it, svc, q: 0, val: 0, cf: 0, tr: [], bms: new Set()};
    g.q += r.q || 0; g.val += val; g.bms.add(r.bm);
    const itemConf = S.conf.some(c => c.frente === key && c.serv === 'item' && c.item === r.item);
    if (svc || itemConf) g.cf += val * confCover(key, r, svc);
    g.conferivel = g.conferivel || !!(svc || itemConf);
    if (num0(r.ini) != null) g.tr.push(trecho(r.ini, r.fim) + (r.lado ? ' ' + r.lado : ''));
  });
  return Object.values(by).sort((a, b) => b.val - a.val);
}
function layerNome(key, code) { const sc = D.secoes[key]; if (sc) { for (const g of sc.grupos) { const c = g.camadas.find(c => c.cod === code); if (c) return c.nome; } const m = (sc.mf || []).find(c => c.cod === code); if (m) return m.nome; } return ''; }
function medNome(key, x) { const ln = layerNome(key, x.item), base = title(short(x.it.n).split(/[,(]| - /)[0].trim()).slice(0, 52); if (!x.svc) return ln || base; const sv = SVC[x.svc]; return ln && !norm(sv).includes(norm(ln).slice(0, 8)) && !norm(ln).includes(norm(sv).slice(0, 8)) ? sv + ' · ' + ln : sv; }
function medidoHtml(key) {
  const sc = S.medScope, rows = medidoResumo(key, sc), tot = sum(rows, x => x.val), cfv = sum(rows.filter(x => x.conferivel), x => x.cf), cft = sum(rows.filter(x => x.conferivel), x => x.val);
  const lbl = sc === 'atual' ? `no BM ${D.meta.bm}` : 'até hoje (todos os BMs)';
  const row = x => { const tr = [...new Set(x.tr)]; return `<div class="mrow">
      <div style="min-width:0"><b>${esc(medNome(key, x))}</b> <span class="muted mono" style="font-size:11.5px">${esc(x.item)}</span>
        <div class="muted" style="font-size:13px">${NUM(x.q, 2)} ${esc(x.it.u)}${tr.length ? ' · ' + esc(tr.slice(0, 3).join(' · ')) + (tr.length > 3 ? ` · +${tr.length - 3} trecho${tr.length - 3 > 1 ? 's' : ''}` : '') : ''}${sc !== 'atual' && x.bms.size ? ' · BM ' + [...x.bms].sort((a, b) => a - b).join(', ') : ''}</div></div>
      <div class="r"><b>${BRL(x.val)}</b>${x.conferivel ? `<div class="cfb" title="Conferido pela fiscalização"><i style="width:${Math.round(x.cf / (x.val || 1) * 100)}%"></i></div><div class="muted" style="font-size:11.5px">conferido ${PCT(x.cf / (x.val || 1), 0)}</div>` : '<div class="muted" style="font-size:11.5px">sem conferência por trecho</div>'}</div></div>`; };
  return `<div class="medbox">
    <div class="card-h" style="margin-bottom:8px"><h3>O que foi medido ${esc(lbl)}</h3><span class="sp" style="display:flex;gap:6px"><button class="chip" data-mres="atual" aria-pressed="${sc === 'atual'}">BM ${D.meta.bm}</button><button class="chip" data-mres="todos" aria-pressed="${sc !== 'atual'}">Acumulado</button></span></div>
    ${rows.length ? `<div class="medsum"><span><b>${BRL(tot)}</b> medidos em ${rows.length} ite${rows.length === 1 ? 'm' : 'ns'}</span>${cft ? `<span><b style="color:var(--conf)">${PCT(cfv / cft, 0)}</b> do medido em serviços conferíveis tem conferência registrada</span>` : ''}</div>
      <div class="mlist">${rows.slice(0, 6).map(row).join('')}</div>${rows.length > 6 ? `<details><summary>Ver os outros ${rows.length - 6} itens</summary><div class="mlist" style="margin-top:8px">${rows.slice(6).map(row).join('')}</div></details>` : ''}`
      : `<div class="empty-note" style="padding:12px">Nada medido nesta frente ${esc(lbl)} com trecho na memória de cálculo.</div>`}
  </div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-mres]'); if (b) { S.medScope = b.dataset.mres; render(); } });

/* ---------- o que falta para concluir ---------- */
const PAC = {pista: 'Pavimento da pista (todas as camadas)', calcada: 'Calçada completa', meiofio: 'Meio-fio', escav: 'Escavação com carga, transporte e destinação', aterro: 'Aterro', item: 'Item do boletim (quantidade direta)'};
const findItem = (key, re, un) => (Z[key] ? Z[key].items.filter(i => re.test(i.n) && (!un || un.test(i.u))) : []);
function pacotes(key) {
  const sc = D.secoes[key], out = [];
  if (sc && sc.grupos.find(g => g.off === 0)) out.push('pista');
  if (sc && sc.grupos.find(g => g.lados)) out.push('calcada');
  if (sc && (sc.mf || []).length) out.push('meiofio');
  if (findItem(key, /ESCAVA/).length) out.push('escav');
  if (findItem(key, /ATERRO/).length) out.push('aterro');
  out.push('item');
  return out;
}
function parseTrechos(key, txt) {
  const out = [], bad = [];
  String(txt || '').split(/[;\n]|\s+e\s+/i).map(s => s.trim()).filter(Boolean).forEach(s => {
    const m = s.replace(/^est\.?\s*/i, '').match(/^([\d+.,\s]+?)\s*(?:-|–|a|até)\s*(?:est\.?\s*)?([\d+.,\s]+)$/i);
    if (!m) { bad.push(s); return; }
    const a = fixEst(key, parseEst(m[1].replace(/\s/g, ''))), b = fixEst(key, parseEst(m[2].replace(/\s/g, '')));
    if (isNaN(a) || isNaN(b) || b <= a) bad.push(s); else out.push([a, b]);
  });
  return {tr: out, bad};
}
const trLen = tr => sum(tr || [], t => t[1] - t[0]);
const trOf = f => (f.trechos || []).map(t => Array.isArray(t) ? t : [t.a, t.b]);
function faltaLines(key, f) {
  const sc = D.secoes[key], L = trLen(trOf(f)), out = [];
  const add = (code, q, pu, nota) => { const it = itemName(code); if (!it || !(q > 0)) return; out.push({c: code, n: it.n, u: it.u, q, pu: pu == null ? it.pu : pu, v: q * (pu == null ? it.pu : pu), nota: nota || ''}); };
  const layersOf = (g, area) => g.camadas.forEach(c => { const m3 = /3|³/.test(c.un); add(c.cod, m3 ? area * c.esp : area, m3 ? c.custo : c.pu, c.capCod ? 'inclui o CAP (' + c.capCod + ')' : ''); });
  if (f.pac === 'pista' && sc) {
    const g = sc.grupos.find(x => x.off === 0), area = sum(trOf(f), t => wMean(key, g, t[0], t[1]) * (t[1] - t[0])) * (f.lado ? .5 : 1); layersOf(g, area);
    const ref = g.camadas.find(c => !c.esp && /2/.test(c.un)), refIt = ref ? itemName(ref.cod) : null, used = new Set(g.camadas.flatMap(c => [c.cod, c.capCod]).filter(Boolean));
    const grp = groupOf(g.camadas[0].cod);
    (Z[key].items || []).filter(i => groupOf(i.c) === grp && !used.has(i.c) && /PINTURA DE LIGA|EMULS|IMPRIMA|ASFALTO DILU/.test(i.n)).forEach(i => add(i.c, area * (refIt && refIt.q ? i.q / refIt.q : 1), null, 'proporcional à área, pela planilha'));
  } else if (f.pac === 'calcada' && sc) {
    const g = sc.grupos.find(x => x.lados); layersOf(g, g.larg * (f.lado ? 1 : 2) * L);
  } else if (f.pac === 'meiofio' && sc) {
    const tq = sum(sc.mf, x => x.q) || 1, len = L * (f.lado ? 1 : 2);
    sc.mf.forEach(c => add(c.cod, len * c.q / tq, c.pu, 'rateado entre os tipos de meio-fio pela planilha'));
  } else if (f.pac === 'escav') {
    const vol = f.vol > 0 ? f.vol : L * (f.larg || 0) * (f.prof || 0);
    const esc_ = findItem(key, /ESCAVA.*MEC/), e1 = esc_[0] || findItem(key, /ESCAVA/)[0]; if (!e1) return out;
    add(e1.c, vol);
    const escQ = sum(esc_.length ? esc_ : [e1], i => i.q) || 1, carga = findItem(key, /^CARGA, MANOBRA/, /^T$/)[0];
    if (carga) { const t = vol * carga.q / escQ; add(carga.c, t, null, NUM(carga.q / escQ, 2) + ' t/m³ pela planilha');
      const tr = findItem(key, /^TRANSPORTE COM CAMINH/, /TKM/)[0]; if (tr) add(tr.c, t * tr.q / carga.q, null, 'DMT ' + NUM(tr.q / carga.q, 1) + ' km pela planilha');
      const ds = findItem(key, /^DESTINA/, /^T$/)[0]; if (ds) add(ds.c, t * ds.q / carga.q); }
  } else if (f.pac === 'aterro') {
    const a = findItem(key, /ATERRO/)[0], vol = f.vol > 0 ? f.vol : L * (f.larg || 0) * (f.prof || 0); if (a) add(a.c, vol);
  } else if (f.pac === 'item' && f.item) add(f.item, +f.q || 0);
  return out;
}
function faltaDesc(key, f) {
  const tr = trOf(f).map(t => trecho(t[0], t[1])).join(' · ');
  const extra = (f.pac === 'escav' || f.pac === 'aterro') ? (f.vol > 0 ? NUM(f.vol, 1) + ' m³' : NUM(trLen(trOf(f)) * (f.larg || 0) * (f.prof || 0), 1) + ' m³ (' + NUM(f.larg || 0) + ' m × ' + NUM(f.prof || 0) + ' m)') : f.pac === 'item' ? NUM(+f.q || 0) + ' ' + ((itemName(f.item) || {}).u || '') : '';
  return {tit: f.pac === 'item' ? (f.item + ' · ' + title(short((itemName(f.item) || {}).n || '').slice(0, 60))) : PAC[f.pac], sub: [tr, f.lado ? 'só ' + f.lado : (['pista', 'item', 'escav', 'aterro'].includes(f.pac) ? '' : 'os dois lados'), extra, f.obs].filter(Boolean).join(' · ')};
}
function faltaAgg(key) {
  const by = {};
  S.faltas.filter(f => f.frente === key).forEach(f => faltaLines(key, f).forEach(l => { const g = by[l.c] = by[l.c] || {c: l.c, n: l.n, u: l.u, q: 0, v: 0}; g.q += l.q; g.v += l.v; }));
  Object.values(by).forEach(g => { const it = itemName(g.c); g.saldo = Math.max(0, it.q - it.aq); g.excesso = Math.max(0, g.q - g.saldo); g.vex = g.v * (g.q ? g.excesso / g.q : 0); });
  return by;
}
function faltasCard(key) {
  const fs = S.faltas.filter(f => f.frente === key).sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  const agg = Object.values(faltaAgg(key)).sort((a, b) => b.v - a.v), tot = sum(agg, x => x.v), ex = sum(agg, x => x.vex);
  return `<section class="card" id="faltaCard">
    <div class="card-h"><h2>O que falta para concluir</h2>${canWrite() ? `<button class="sp btn" data-newfalta="${key}">+ Informar o que falta</button>` : ''}</div>
    <p class="note" style="margin-top:-6px">Informe o serviço e os trechos que faltam. O painel calcula as quantidades pela seção-tipo, puxa os itens complementares (carga, transporte, destinação, pintura de ligação…) nas proporções da planilha e compara com o saldo do contrato.</p>
    ${fs.length ? `<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:14px">
        <div class="kpi"><div class="eyebrow">Total para concluir</div><div class="v">${BRL(tot)}</div><div class="s">${fs.length} registro${fs.length === 1 ? '' : 's'} · preços do BM ${D.meta.bm}</div></div>
        <div class="kpi"><div class="eyebrow">Dentro do saldo</div><div class="v" style="color:var(--accent)">${BRL(tot - ex)}</div><div class="s">cabe nas quantidades contratadas</div></div>
        <div class="kpi"><div class="eyebrow">Acima do saldo</div><div class="v" style="${ex > 1 ? 'color:var(--danger)' : ''}">${BRL(ex)}</div><div class="s">${ex > 1 ? 'precisaria de aditivo' : 'nenhum item estoura'}</div></div></div>
      <div class="logs">${fs.map(f => { const d = faltaDesc(key, f), ls = faltaLines(key, f); return `<div class="log"><div class="dt">${esc(BRL(sum(ls, l => l.v)).replace('R$ ', 'R$\u00a0'))}</div><div><b>${esc(d.tit)}</b><div class="muted">${esc(d.sub)}</div>
          <details style="margin-top:4px"><summary>${ls.length} ite${ls.length === 1 ? 'm' : 'ns'} do boletim</summary><table style="min-width:520px;margin-top:6px"><tbody>${ls.map(l => `<tr><td class="mono">${esc(l.c)}</td><td>${esc(short(l.n).slice(0, 60))}${l.nota ? `<div class="muted" style="font-size:11.5px">${esc(l.nota)}</div>` : ''}</td><td class="r">${NUM(l.q, 2)} ${esc(l.u)}</td><td class="r">${BRL(l.v)}</td></tr>`).join('')}</tbody></table></details></div>
          ${canClose(f) ? `<button class="del" data-fdel="${esc(f.id)}">Excluir</button>` : '<span></span>'}</div>`; }).join('')}</div>
      <h3 style="margin:16px 0 8px">Necessidade × saldo do contrato</h3>
      <div class="tbl"><table><thead><tr><th>Item</th><th>Serviço</th><th class="r">Necessário</th><th class="r">Saldo contratual</th><th class="r">Acima do saldo</th><th class="r">Valor</th></tr></thead><tbody>
        ${agg.map(g => `<tr><td class="mono">${esc(g.c)}</td><td class="desc">${esc(short(g.n).slice(0, 70))}</td><td class="r">${NUM(g.q, 2)} ${esc(g.u)}</td><td class="r">${NUM(g.saldo, 2)}</td><td class="r" style="${g.excesso > .005 ? 'color:var(--danger);font-weight:600' : ''}">${g.excesso > .005 ? NUM(g.excesso, 2) : '—'}</td><td class="r"><b>${BRL(g.v)}</b></td></tr>`).join('')}
        <tr><td colspan="5"><b>Total</b></td><td class="r"><b>${BRL(tot)}</b></td></tr></tbody></table></div>`
      : `<div class="empty-note">Nada informado ainda. Exemplo: "falta calçada nos trechos 5004 a 5010 e 5013 a 5017, lado LE" e, se precisar, "escavação de 0,40 m nos mesmos trechos".</div>`}
  </section>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-fdel]'); if (!b || !S.db) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar exclusão'; return; }
  try { await S.db.doc('faltas/' + b.dataset.fdel).delete(); } catch (err) { b.textContent = 'Sem permissão'; }
});
document.addEventListener('click', e => { const b = e.target.closest('[data-newfalta]'); if (b) { e.preventDefault(); openFaltaForm(b.dataset.newfalta); } });
function openFaltaForm(key) {
  if (!canWrite()) { noWriteDlg('Informar o que falta'); return; }
  const ps = pacotes(key);
  openDlg(`
    <div class="bh"><div><div class="eyebrow">${esc(Z[key].name)} · para concluir</div><h3>Informar o que falta</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <form class="form" id="fFal" novalidate>
      <div class="fgrid">
        <label class="f" style="grid-column:1/-1">O que falta<select id="fa_pac">${ps.map(k => `<option value="${k}">${esc(PAC[k])}</option>`).join('')}</select></label>
        <label class="f" style="grid-column:1/-1" id="fa_trw">Trechos<input id="fa_tr" placeholder="ex.: 5004 a 5010; 5013+10 a 5017"><span class="note">Separe os trechos com ponto e vírgula.</span></label>
        <label class="f" id="fa_ladow">Lado<select id="fa_lado"><option value="">Os dois lados / pista toda</option><option value="LE">Só LE</option><option value="LD">Só LD</option></select></label>
        <label class="f" id="fa_volw" hidden>Volume (m³) · ou use largura × profundidade<input id="fa_vol" inputmode="decimal" placeholder="opcional"></label>
        <label class="f" id="fa_largw" hidden>Largura (m)<input id="fa_larg" inputmode="decimal" placeholder="ex.: 1,48"></label>
        <label class="f" id="fa_profw" hidden>Profundidade média (m)<input id="fa_prof" inputmode="decimal" placeholder="ex.: 0,40"></label>
        <label class="f" id="fa_itemw" hidden style="grid-column:1/-1">Item do boletim<select id="fa_item">${itemOpts(key, '', false)}</select></label>
        <label class="f" id="fa_qw" hidden>Quantidade<input id="fa_q" inputmode="decimal"></label>
      </div>
      <label class="f">Observação<input id="fa_obs" placeholder="opcional · ex.: calçada quebrada pela Compesa"></label>
      <div id="fa_prev" class="faprev"></div>
      <div class="ra"><button class="btn" type="submit" id="fa_go">Salvar</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="fa_st" role="status"></span></div>
    </form>`);
  const num = id => { const v = String($('#' + id).value || '').replace(/\./g, '').replace(',', '.'); return v ? +v : 0; };
  const read = () => { const pac = $('#fa_pac').value, t = parseTrechos(key, $('#fa_tr').value); return {pac, trechos: t.tr, bad: t.bad, lado: $('#fa_lado').value, vol: num('fa_vol'), larg: num('fa_larg'), prof: num('fa_prof'), item: $('#fa_item').value, q: num('fa_q'), obs: ($('#fa_obs').value || '').trim()}; };
  const upd = () => {
    const f = read(), p = f.pac, vol = p === 'escav' || p === 'aterro', it = p === 'item';
    $('#fa_trw').hidden = it; $('#fa_ladow').hidden = it || vol; $('#fa_volw').hidden = $('#fa_largw').hidden = $('#fa_profw').hidden = !vol; $('#fa_itemw').hidden = $('#fa_qw').hidden = !it;
    const ls = faltaLines(key, f), tot = sum(ls, l => l.v), L = trLen(f.trechos);
    $('#fa_prev').innerHTML = (f.bad.length ? `<div class="al medio"><span class="src">Painel</span>Não entendi: ${esc(f.bad.join('; '))}. Use "5004 a 5010".</div>` : '') +
      (ls.length ? `<div class="eyebrow" style="margin-bottom:6px">Prévia${L ? ' · ' + NUM(L, 1) + ' m de trecho' : ''}</div><table style="min-width:0"><tbody>${ls.map(l => `<tr><td class="mono">${esc(l.c)}</td><td>${esc(short(l.n).slice(0, 52))}${l.nota ? `<div class="muted" style="font-size:11.5px">${esc(l.nota)}</div>` : ''}</td><td class="r">${NUM(l.q, 2)} ${esc(l.u)}</td><td class="r">${BRL(l.v)}</td></tr>`).join('')}<tr><td colspan="3"><b>Total</b></td><td class="r"><b>${BRL(tot)}</b></td></tr></tbody></table>` : '<div class="muted" style="font-size:13px">Preencha os campos para ver os itens e o valor.</div>');
  };
  $('#fFal').addEventListener('input', upd); $('#fFal').addEventListener('change', upd); upd();
  $('#fFal').onsubmit = async e => {
    e.preventDefault();
    const st = $('#fa_st'), btn = $('#fa_go'), f = read(), fail = t => { st.className = 'status err'; st.textContent = t; };
    if (f.pac !== 'item' && !f.trechos.length && !(['escav', 'aterro'].includes(f.pac) && f.vol > 0)) return fail('Informe ao menos um trecho válido (ex.: 5004 a 5010).');
    if (f.bad.length) return fail('Corrija os trechos que o painel não entendeu.');
    if (['escav', 'aterro'].includes(f.pac) && !(f.vol > 0) && !(f.larg > 0 && f.prof > 0)) return fail('Informe o volume ou a largura e a profundidade.');
    if (f.pac === 'item' && (!f.item || !(f.q > 0))) return fail('Escolha o item e a quantidade.');
    if (!faltaLines(key, f).length) return fail('Não há itens deste serviço nesta frente.');
    btn.disabled = true;
    try { await S.db.collection('faltas').add({frente: key, pac: f.pac, trechos: f.trechos.map(t => ({a: t[0], b: t[1]})), lado: f.lado, vol: f.vol || 0, larg: f.larg || 0, prof: f.prof || 0, item: f.item || '', q: f.q || 0, obs: f.obs.slice(0, 300), autor: S.myId || '', criado: new Date().toISOString()}); closeDlg(); }
    catch (er) { btn.disabled = false; fail('Não foi possível salvar (' + upErr(er) + ').'); }
  };
}

/* ---------- serviços sem avanço (perguntas) ---------- */
const SA_MOT = ['Aguardando definição de projeto', 'Aguardando aprovação da fiscalização ou do cliente', 'É serviço de fim de obra (aguardando frente)', 'Cotação ou contratação em andamento', 'Questão financeira / fluxo de caixa', 'Outro'];
function semAvanco() {
  const out = [], today = todayISO();
  D.zones.filter(z => z.key !== 'adm').forEach(z => z.groups.forEach(g => {
    if (!(g.total > 0) || g.acum > 0 || /LIMPEZA FINAL/i.test(g.name)) return;
    const kw = norm(g.name).split(/\s+/).filter(w => w.length > 4)[0] || norm(g.name);
    const tk = D.crono.tasks.filter(t => (t.fr === z.key || !FRONT_KEYS.includes(z.key)) && !t.sum && norm(t.n).includes(kw.slice(0, 7))).sort((a, b) => a.s.localeCompare(b.s))[0];
    const id = z.key + '__' + g.code.replace(/\./g, '_'), r = S.semAv[id];
    let st = 'semresp';
    if (r && r.comprado) st = r.comprado === 'sim' ? ((r.entrega && r.entrega < today && !r.entregue) || (r.inicio && r.inicio < today) ? 'atrasado' : 'ok') : r.comprado === 'nao' ? 'nao' : ((r.inicio && r.inicio < today) ? 'atrasado' : 'ok');
    if (st === 'semresp' && r && r.causa) st = acaoLate(r.causa) ? 'atrasado' : 'ok';
    out.push({id, z, g, tk, late: tk && tk.s <= today, r, st});
  }));
  const ord = {atrasado: 0, nao: 1, semresp: 2, ok: 3};
  return out.sort((a, b) => ord[a.st] - ord[b.st] || b.g.total - a.g.total);
}
function semAvCard() {
  const list = semAvanco(); if (!list.length) return '';
  const tag = x => x.st === 'semresp' ? '<span class="tag alta">Sem resposta</span>' : x.st === 'atrasado' ? '<span class="tag lt">Previsão vencida</span>' : x.st === 'nao' ? '<span class="tag lt">Não comprado</span>' : '<span class="tag s-fechada">Com previsão</span>';
  const resp = x => { const r = x.r; if (!r || !r.comprado) return x.late ? `O cronograma previa início em ${dBR(x.tk.s)}.` : x.tk ? `Início previsto no cronograma: ${dBR(x.tk.s)}.` : 'Sem tarefa correspondente no cronograma.';
    return [r.comprado === 'sim' ? `Comprado${r.fornecedor ? ' · ' + r.fornecedor : ''}${r.entrega ? ' · entrega ' + dBR(r.entrega) : ''}` : r.comprado === 'nao' ? `Não comprado · ${r.motivo || ''}${r.detalhe ? ' (' + r.detalhe + ')' : ''}${r.compraAte ? ' · comprar até ' + dBR(r.compraAte) : ''}` : 'Não depende de compra', r.inicio ? 'início ' + dBR(r.inicio) : '', r.resp ? 'resp. ' + r.resp : '', 'atualizado em ' + dBR((r.em || '').slice(0, 10))].filter(Boolean).join(' · '); };
  return `<section class="card">
    <div class="card-h"><h2>Serviços sem avanço</h2><span class="sp muted" style="font-size:13px">grupos do boletim ainda em 0%</span></div>
    <div class="logs">${list.map(x => `<div class="log"><div class="dt" style="font-size:13px">${esc(BRL(x.g.total)).replace('R$ ', 'R$\u00a0')}</div><div><b>${esc(title(x.g.name))}</b> · ${esc(x.z.name)} ${tag(x)}<div class="muted">${esc(resp(x))}</div>${x.r && x.r.causa ? causaHtml(x.r.causa, title(x.g.name) + ' parado', 'sav', x.id) : ''}</div>${canWrite() ? `<div class="savb"><button class="btn sm${x.r && x.r.causa ? ' ghost' : ''}" data-masp="sav|${esc(x.id)}">${x.r && x.r.causa ? 'Rever análise (MASP)' : 'Analisar a causa (MASP)'}</button><button class="btn sm ghost" data-sav="${esc(x.id)}">${x.r && x.r.comprado ? 'Atualizar compra' : 'Compra e prazo'}</button></div>` : '<span></span>'}</div>`).join('')}</div>
    <p class="note">Cada grupo parado recebe três perguntas: já foi comprado? se sim, qual o prazo de entrega? se não, por qual motivo? Sem resposta ou com previsão vencida, ele aparece nos pontos de atenção.</p>
  </section>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-sav]'); if (b) openSemAv(b.dataset.sav); });
function openSemAv(id) {
  if (!canWrite()) { noWriteDlg('Serviço sem avanço'); return; }
  const x = semAvanco().find(y => y.id === id); if (!x) return;
  const r = x.r || {};
  openDlg(`
    <div class="bh"><div><div class="eyebrow">${esc(x.z.name)} · ${esc(x.g.code)} · ${BRL(x.g.total)} · 0% executado</div><h3>${esc(title(x.g.name))}</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    ${x.tk ? `<p class="note" style="margin:0">Cronograma: "${esc(x.tk.n)}" de ${dBR(x.tk.s)} a ${dBR(x.tk.f)}.</p>` : ''}
    <form class="form" id="fSa" novalidate>
      <fieldset class="rq"><legend>O material ou serviço já foi comprado / contratado?</legend>
        <label class="chk"><input type="radio" name="sa_c" value="sim"${r.comprado === 'sim' ? ' checked' : ''}> Sim</label>
        <label class="chk"><input type="radio" name="sa_c" value="nao"${r.comprado === 'nao' ? ' checked' : ''}> Não</label>
        <label class="chk"><input type="radio" name="sa_c" value="na"${r.comprado === 'na' ? ' checked' : ''}> Não depende de compra</label></fieldset>
      <div class="fgrid" id="sa_sim" hidden>
        <label class="f">Previsão de entrega<input type="date" id="sa_ent" value="${esc(r.entrega || '')}"></label>
        <label class="f">Fornecedor<input id="sa_forn" value="${esc(r.fornecedor || '')}"></label>
        <label class="chk" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="sa_entregue"${r.entregue ? ' checked' : ''}> Já foi entregue</label>
      </div>
      <div class="fgrid" id="sa_nao" hidden>
        <label class="f">Por qual motivo?<select id="sa_mot"><option value="">Escolha…</option>${SA_MOT.map(m => `<option${r.motivo === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="f">Detalhe<input id="sa_det" value="${esc(r.detalhe || '')}"></label>
        <label class="f">Quando deve ser comprado?<input type="date" id="sa_ate" value="${esc(r.compraAte || '')}"></label>
      </div>
      <div class="fgrid">
        <label class="f">Previsão de início do serviço<input type="date" id="sa_ini" value="${esc(r.inicio || '')}"></label>
        <label class="f">Responsável<input id="sa_resp" value="${esc(r.resp || D.meta.contratada || '')}"></label>
      </div>
      <label class="f">Observação<input id="sa_obs" value="${esc(r.obs || '')}"></label>
      <div class="ra"><button class="btn" type="submit" id="sa_go">Salvar resposta</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="sa_st" role="status"></span></div>
    </form>`);
  const sync = () => { const c = (document.querySelector('input[name=sa_c]:checked') || {}).value; $('#sa_sim').hidden = c !== 'sim'; $('#sa_nao').hidden = c !== 'nao'; };
  $('#fSa').addEventListener('change', sync); sync();
  $('#fSa').onsubmit = async e => {
    e.preventDefault();
    const st = $('#sa_st'), btn = $('#sa_go'), v = id => ($('#' + id).value || '').trim(), c = (document.querySelector('input[name=sa_c]:checked') || {}).value, fail = t => { st.className = 'status err'; st.textContent = t; };
    if (!c) return fail('Responda se já foi comprado.');
    if (c === 'sim' && !v('sa_ent') && !$('#sa_entregue').checked) return fail('Informe a previsão de entrega.');
    if (c === 'nao' && !v('sa_mot')) return fail('Escolha o motivo.');
    btn.disabled = true;
    try { await S.db.doc('sem_avanco/' + id)[S.semAv[id] ? 'update' : 'set']({frente: x.z.key, grupo: x.g.code, comprado: c, entrega: c === 'sim' ? v('sa_ent') : '', fornecedor: c === 'sim' ? v('sa_forn').slice(0, 120) : '', entregue: c === 'sim' && $('#sa_entregue').checked, motivo: c === 'nao' ? v('sa_mot') : '', detalhe: c === 'nao' ? v('sa_det').slice(0, 300) : '', compraAte: c === 'nao' ? v('sa_ate') : '', inicio: v('sa_ini'), resp: v('sa_resp').slice(0, 120), obs: v('sa_obs').slice(0, 400), por: S.myId || '', em: new Date().toISOString()}); closeDlg(); }
    catch (er) { btn.disabled = false; fail('Não foi possível salvar (' + upErr(er) + ').'); }
  };
}

document.addEventListener('click', e => { const b = e.target.closest('[data-opennode]'); if (b) { e.preventDefault(); const [k, id] = b.dataset.opennode.split('|'); openNode(k, id); } });

/* ---------- zoom e tela cheia da planta ---------- */
S.mapView = {}; S.mapDrag = false;
function mapZoomBind(svg, key) {
  const base = D.geos[key].vb;
  const cur = () => (S.mapView[key] || base).slice();
  const geo = () => { const r = svg.getBoundingClientRect(), vb = cur(), sc = Math.min(r.width / vb[2], r.height / vb[3]); return {r, vb, sc, ox: (r.width - vb[2] * sc) / 2, oy: (r.height - vb[3] * sc) / 2}; };
  const setVB = vb => { const bw = base[2]; vb[2] = Math.max(bw / 30, Math.min(bw * 1.3, vb[2])); vb[3] = vb[2] * base[3] / base[2]; S.mapView[key] = vb; svg.setAttribute('viewBox', vb.join(' ')); svg.style.touchAction = (vb[2] < bw * .98 || svg.closest('.full')) ? 'none' : 'pan-x pan-y'; clearTimeout(S.mzT); S.mzT = setTimeout(() => { if (svg.isConnected) drawMap(); }, 170); };
  const zoomAt = (f, cxp, cyp) => { const g = geo(), px = g.vb[0] + (cxp - g.r.left - g.ox) / g.sc, py = g.vb[1] + (cyp - g.r.top - g.oy) / g.sc; setVB([px - (px - g.vb[0]) * f, py - (py - g.vb[1]) * f, g.vb[2] * f, g.vb[3] * f]); };
  svg._zoomAt = zoomAt;
  svg.style.touchAction = (S.mapView[key] && S.mapView[key][2] < base[2] * .98) || svg.closest('.full') ? 'none' : 'pan-x pan-y';
  svg.onwheel = e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * .0016), e.clientX, e.clientY); };
  const P = new Map(); let g = null;
  svg.onpointerdown = e => { P.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (P.size === 2) { const [a, b] = [...P.values()]; g = {pinch: Math.hypot(a.x - b.x, a.y - b.y)}; } else g = {moved: 0, can: e.pointerType === 'mouse' || svg.style.touchAction === 'none'}; };
  svg.onpointermove = e => {
    if (!P.has(e.pointerId) || !g) return;
    const pr = P.get(e.pointerId); P.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (P.size === 2 && g.pinch) { const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt(g.pinch / (d || 1), (a.x + b.x) / 2, (a.y + b.y) / 2); g.pinch = d; S.mapDrag = true; return; }
    if (!g.can) return;
    const dx = e.clientX - pr.x, dy = e.clientY - pr.y; g.moved += Math.abs(dx) + Math.abs(dy); if (g.moved < 6) return;
    S.mapDrag = true; svg.style.cursor = 'grabbing'; const q = geo(); setVB([q.vb[0] - dx / q.sc, q.vb[1] - dy / q.sc, q.vb[2], q.vb[3]]);
  };
  const end = e => { P.delete(e.pointerId); if (!P.size) { g = null; svg.style.cursor = ''; setTimeout(() => { S.mapDrag = false; }, 0); } };
  svg.onpointerup = end; svg.onpointercancel = end;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mz]'); if (!b) return;
  const svg = $('#map'); if (!svg) return; const key = svg.dataset.key, box = svg.closest('.mapbox'), r = svg.getBoundingClientRect();
  if (b.dataset.mz === 'in' || b.dataset.mz === 'out') svg._zoomAt(b.dataset.mz === 'in' ? .6 : 1.6, r.left + r.width / 2, r.top + r.height / 2);
  if (b.dataset.mz === 'reset') { delete S.mapView[key]; drawMap(); }
  if (b.dataset.mz === 'full') { const on = box.classList.toggle('full'); b.textContent = on ? '✕' : '⛶'; b.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia'); document.body.style.overflow = on ? 'hidden' : ''; drawMap(); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !$('#dlg').hidden || !$('#lb').hidden) return;
  const mb = document.querySelector('.mapbox.full'); if (mb) { mb.classList.remove('full'); const b = mb.querySelector('[data-mz=full]'); if (b) b.textContent = '⛶'; document.body.style.overflow = ''; drawMap(); }
  const h3 = document.querySelector('#p3d.full'); if (h3) { const b = h3.querySelector('[data-p3=full]'); if (b) b.click(); }
});


/* =====================================================================
   ESPINHA DE PEIXE (Ishikawa) · perguntas encadeadas → causa → ação
   ===================================================================== */
const ISH = [
  {k: 'material', n: 'Material', q: [
    {id: 'mat_qual', t: 'Qual material está faltando ou com problema?', tipo: 'text', ph: 'ex.: meio-fio pré-moldado, CBUQ, grelha'},
    {id: 'mat_comp', t: 'Já foi comprado?', tipo: 'radio', op: ['Sim', 'Não']},
    {id: 'mat_ent', t: 'Qual a data de entrega prometida?', tipo: 'date', se: 'mat_comp=Sim'},
    {id: 'mat_conf', t: 'O fornecedor confirmou essa data por escrito?', tipo: 'radio', op: ['Sim', 'Não'], se: 'mat_comp=Sim'},
    {id: 'mat_imp', t: 'O que impede a compra?', tipo: 'select', op: ['Cotação em andamento', 'Aguardando aprovação interna', 'Falta de recurso', 'Especificação indefinida', 'Ninguém ficou responsável'], se: 'mat_comp=Não'},
    {id: 'mat_ate', t: 'Até quando a compra precisa sair para não atrasar mais?', tipo: 'date', se: 'mat_comp=Não'}]},
  {k: 'mao', n: 'Mão de obra', q: [
    {id: 'mo_nec', t: 'Quantas pessoas a atividade precisa?', tipo: 'num'},
    {id: 'mo_hoje', t: 'Quantas estão nela hoje?', tipo: 'num'},
    {id: 'mo_onde', t: 'Onde está a equipe que deveria estar aqui?', tipo: 'select', op: ['Em outra frente desta obra', 'Em outra obra', 'Ainda não foi contratada', 'Falta profissional especializado']},
    {id: 'mo_quando', t: 'Em que data a equipe completa chega?', tipo: 'date'}]},
  {k: 'maquina', n: 'Máquina', q: [
    {id: 'mq_qual', t: 'Qual equipamento?', tipo: 'text', ph: 'ex.: vibroacabadora, rolo, retroescavadeira'},
    {id: 'mq_sit', t: 'Qual a situação dele?', tipo: 'select', op: ['Quebrado / em manutenção', 'Em outra frente', 'Não foi locado', 'Locado, mas não chegou']},
    {id: 'mq_prev', t: 'Quando estará disponível na frente?', tipo: 'date'}]},
  {k: 'metodo', n: 'Método', q: [
    {id: 'me_dep', t: 'Depende de outra etapa terminar antes?', tipo: 'radio', op: ['Sim', 'Não']},
    {id: 'me_qual', t: 'Qual etapa?', tipo: 'text', se: 'me_dep=Sim', ph: 'ex.: base BGTC, drenagem, meio-fio'},
    {id: 'me_lib', t: 'Essa etapa depende de liberação da fiscalização?', tipo: 'radio', op: ['Sim', 'Não'], se: 'me_dep=Sim'},
    {id: 'me_sol', t: 'A conferência já foi pedida à fiscalização?', tipo: 'radio', op: ['Sim', 'Não'], se: 'me_lib=Sim'},
    {id: 'me_ret', t: 'Houve retrabalho ou erro de execução?', tipo: 'radio', op: ['Sim', 'Não']},
    {id: 'me_retq', t: 'O que deu errado?', tipo: 'text', se: 'me_ret=Sim'}]},
  {k: 'projeto', n: 'Projeto', q: [
    {id: 'pj_q', t: 'Qual a dúvida ou divergência do projeto?', tipo: 'text'},
    {id: 'pj_quem', t: 'Quem precisa responder?', tipo: 'select', op: ['Projetista', 'Fiscalização', 'Prefeitura / contratante', 'Concessionária']},
    {id: 'pj_form', t: 'Já foi formalizado (ofício, RDO ou e-mail)?', tipo: 'radio', op: ['Sim', 'Não']},
    {id: 'pj_data', t: 'Quando foi enviado?', tipo: 'date', se: 'pj_form=Sim'},
    {id: 'pj_ate', t: 'Até quando vai formalizar?', tipo: 'date', se: 'pj_form=Não'}]},
  {k: 'meio', n: 'Interferências', q: [
    {id: 'mi_q', t: 'O que está impedindo no local?', tipo: 'select', op: ['Chuva / clima', 'Rede da Compesa', 'Rede elétrica / Neoenergia', 'Moradores / acesso de veículos', 'Desapropriação / ocupação', 'Outra']},
    {id: 'mi_acion', t: 'O responsável pela interferência já foi acionado?', tipo: 'radio', op: ['Sim', 'Não', 'Não se aplica']},
    {id: 'mi_prot', t: 'Protocolo ou data do acionamento', tipo: 'text', se: 'mi_acion=Sim'},
    {id: 'mi_prev', t: 'Previsão para liberar a frente', tipo: 'date'}]},
  {k: 'gestao', n: 'Gestão', q: [
    {id: 'ge_q', t: 'Qual é o bloqueio?', tipo: 'select', op: ['Pagamento / medição', 'Aditivo de quantidade ou prazo', 'Contratação de terceiro', 'Prioridade dada a outra frente', 'Outro']},
    {id: 'ge_quem', t: 'Quem decide?', tipo: 'text'},
    {id: 'ge_ate', t: 'Até quando a decisão precisa sair?', tipo: 'date'}]}
];
const ISHK = Object.fromEntries(ISH.map(c => [c.k, c]));
const dd = v => v ? dBR(v).slice(0, 5) : '';
function ishCausa(k, a) {
  a = a || {};
  if (k === 'material') return `${a.mat_qual || 'material'}${a.mat_comp === 'Não' ? ' não comprado' + (a.mat_imp ? ' · ' + a.mat_imp.toLowerCase() : '') : a.mat_comp === 'Sim' ? ' aguardando entrega' + (a.mat_ent ? ' ' + dd(a.mat_ent) : '') : ''}`;
  if (k === 'mao') return `equipe ${a.mo_hoje || 0} de ${a.mo_nec || '?'}${a.mo_onde ? ' · ' + a.mo_onde.toLowerCase() : ''}`;
  if (k === 'maquina') return `${a.mq_qual || 'equipamento'}${a.mq_sit ? ' · ' + a.mq_sit.toLowerCase() : ''}`;
  if (k === 'metodo') return [a.me_dep === 'Sim' ? 'aguarda ' + (a.me_qual || 'etapa anterior') + (a.me_sol === 'Não' ? ' (conferência não pedida)' : '') : '', a.me_ret === 'Sim' ? 'retrabalho' + (a.me_retq ? ': ' + a.me_retq : '') : ''].filter(Boolean).join(' · ') || 'método';
  if (k === 'projeto') return `${a.pj_q || 'dúvida de projeto'}${a.pj_form === 'Não' ? ' (não formalizado)' : ''}`;
  if (k === 'meio') return `${a.mi_q || 'interferência'}${a.mi_acion === 'Não' ? ' (não acionado)' : ''}`;
  if (k === 'gestao') return `${a.ge_q || 'decisão pendente'}${a.ge_quem ? ' · decide: ' + a.ge_quem : ''}`;
  return '';
}
function ishSugestao(k, a) {
  a = a || {};
  if (k === 'material') return a.mat_comp === 'Não' ? `Emitir o pedido de compra de ${a.mat_qual || 'material'}${a.mat_ate ? ' até ' + dBR(a.mat_ate) : ''} e informar a data de entrega` : `Confirmar por escrito com o fornecedor a entrega de ${a.mat_qual || 'material'}${a.mat_ent ? ' em ' + dBR(a.mat_ent) : ''}`;
  if (k === 'mao') return `Mobilizar ${Math.max(1, (+a.mo_nec || 0) - (+a.mo_hoje || 0))} pessoa(s) para a frente${a.mo_quando ? ' até ' + dBR(a.mo_quando) : ''}`;
  if (k === 'maquina') return `Garantir ${a.mq_qual || 'o equipamento'} na frente${a.mq_prev ? ' em ' + dBR(a.mq_prev) : ''}${a.mq_sit === 'Não foi locado' ? ' (fechar a locação)' : ''}`;
  if (k === 'metodo') return a.me_dep === 'Sim' ? (a.me_sol === 'Não' ? `Pedir hoje a conferência de ${a.me_qual || 'etapa anterior'} à fiscalização` : `Concluir ${a.me_qual || 'a etapa anterior'} e liberar a sequência`) : `Corrigir o retrabalho e registrar a causa${a.me_retq ? ': ' + a.me_retq : ''}`;
  if (k === 'projeto') return a.pj_form === 'Não' ? `Formalizar a consulta (${(a.pj_quem || 'responsável').toLowerCase()})${a.pj_ate ? ' até ' + dBR(a.pj_ate) : ''}: ${a.pj_q || 'dúvida de projeto'}` : `Cobrar resposta (${(a.pj_quem || 'responsável').toLowerCase()}) sobre: ${a.pj_q || 'a dúvida de projeto'}`;
  if (k === 'meio') return a.mi_acion === 'Não' ? `Acionar formalmente o responsável (${a.mi_q || 'interferência'}) e registrar o protocolo` : `Cobrar a liberação da frente (${a.mi_q || 'interferência'})${a.mi_prev ? ' até ' + dBR(a.mi_prev) : ''}`;
  if (k === 'gestao') return `Levar a decisão (${a.ge_q || 'bloqueio'}) a ${a.ge_quem || 'quem decide'}${a.ge_ate ? ' até ' + dBR(a.ge_ate) : ''}`;
  return '';
}
/* ---------- desenho da espinha ---------- */
function fishSvg(cnt, opts) {
  opts = opts || {};
  const W = 820, H = opts.small ? 230 : 320, sy = H / 2, x0 = 30, xh = W - 190;
  const top = ISH.slice(0, 4), bot = ISH.slice(4), step = (xh - x0 - 40) / 4;
  let s = `<line x1="${x0}" y1="${sy}" x2="${xh}" y2="${sy}" stroke="var(--fg)" stroke-width="3"/>`;
  const bone = (c, i, up) => {
    const xb = x0 + 40 + step * i + (up ? 0 : step / 2), yE = up ? 34 : H - 34, n = (cnt[c.k] || {}).n || 0, root = (cnt[c.k] || {}).root;
    const col = root ? 'var(--danger)' : n ? 'var(--warn)' : 'var(--line-2)';
    s += `<line x1="${xb}" y1="${yE}" x2="${xb + step * .55}" y2="${sy}" stroke="${col}" stroke-width="${n ? 3 : 2}"/>`;
    s += `<text x="${xb}" y="${up ? yE - 10 : yE + 20}" text-anchor="middle" style="font:600 ${opts.small ? 15 : 14}px var(--font-display);fill:${n ? 'var(--fg)' : 'var(--muted)'}">${esc(c.n)}${n && !opts.single ? ' · ' + n : ''}</text>`;
    if (!opts.small) ((cnt[c.k] || {}).txt || []).slice(0, 3).forEach((t, j) => { const fy = up ? 62 + j * 26 : H - 62 - j * 26, fx = xb + (fy - yE) / (sy - yE) * step * .55; s += `<line x1="${fx}" y1="${fy}" x2="${fx + 8}" y2="${fy}" stroke="${col}"/><text x="${fx + 11}" y="${fy + 4}" style="font:11.5px var(--font-body);fill:var(--muted)">${esc(t.length > 21 ? t.slice(0, 20) + '…' : t)}<title>${esc(t)}</title></text>`; });
  };
  top.forEach((c, i) => bone(c, i, true)); bot.forEach((c, i) => bone(c, i, false));
  const lines = String(opts.efeito || 'Atraso').match(/.{1,22}(\s|$)/g) || [''];
  s += `<path d="M${xh},${sy - 46} L${W - 12},${sy - 46} Q${W - 2},${sy} ${W - 12},${sy + 46} L${xh},${sy + 46}Z" fill="var(--surface-2)" stroke="var(--fg)" stroke-width="2"/>`;
  lines.slice(0, 3).forEach((l, i) => { s += `<text x="${xh + 12}" y="${sy - (Math.min(3, lines.length) - 1) * 9 + i * 18 + 5}" style="font:600 14px var(--font-display);fill:var(--fg)">${esc(l.trim())}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" class="fish${opts.small ? ' sm' : ''}" role="img" aria-label="Espinha de peixe: ${esc(opts.efeito || '')}">${s}</svg>`;
}
const causaTxt = (k, c) => c.metodo === 'masp' ? (c.raizTxt || '') : ishCausa(k, c.ans);
const causaCnt = c => { const o = {}; (c.cats || []).forEach(k => { o[k] = {n: 1, root: k === c.raiz, txt: [causaTxt(k, c)]}; }); return o; };
const acaoLate = c => c && c.prazo && c.prazo < todayISO() && !c.feito;
function causaHtml(c, efeito, orig, id) {
  if (!c) return '';
  if (c.metodo === 'masp') return maspHtml(c, orig, id);
  return `<div class="causa">
    <div class="ca"><div><span class="eyebrow">Causa principal</span> <b>${esc((ISHK[c.raiz] || {}).n || '')}</b> · ${esc(ishCausa(c.raiz, c.ans))}${c.porque ? `<div class="muted" style="font-size:13px">Por quê? ${esc(c.porque)}</div>` : ''}</div>
      <div class="acao${acaoLate(c) ? ' late' : c.feito ? ' done' : ''}"><span class="eyebrow">Ação</span> ${esc(c.acao)} · <b>${esc(c.quem || '')}</b> · até ${esc(dBR(c.prazo))}${c.prev ? ` · conclusão prevista ${esc(dBR(c.prev))}` : ''}${acaoLate(c) ? ' <span class="tag lt">Ação vencida</span>' : c.feito ? ' <span class="tag s-fechada">Ação feita</span>' : ''}</div></div>
  </div>`;
}
/* ---------- consolidado da obra ---------- */
function ishTodas() {
  const out = [];
  S.rnc.filter(r => r.causa && isOpen(r)).forEach(r => out.push({orig: 'rnc', id: r.id, tit: r.num + ' · ' + (r.desc || '').slice(0, 60), fr: r.frente, c: r.causa}));
  Object.entries(S.semAv).filter(([, v]) => v && v.causa).forEach(([id, v]) => { const z = Z[v.frente], g = z && z.groups.find(x => x.code === v.grupo); out.push({orig: 'sav', id, tit: (g ? title(g.name) : v.grupo) + ' · ' + (z ? z.name : ''), fr: v.frente, c: v.causa}); });
  return out;
}
function causaRank(cnt) {
  const rows = Object.entries(cnt).map(([k, o]) => ({k, n: o.n, r: o.roots})).sort((a, b) => (b.r - a.r) || (b.n - a.n));
  const mx = Math.max(1, ...rows.map(x => x.n));
  return `<div class="crank">${rows.map((x, i) => `<div class="cr-row${i === 0 && x.r ? ' top' : ''}">
    <div class="cr-n"><b>${esc((ISHK[x.k] || {}).n || x.k)}</b></div>
    <div class="cr-bar"><i style="width:${x.n / mx * 100}%"></i><i class="r" style="width:${x.r / mx * 100}%"></i></div>
    <div class="cr-v num">${x.n} ${x.n === 1 ? 'vez' : 'vezes'}${x.r ? ` · <b>${x.r} como principal</b>` : ''}</div></div>`).join('')}</div>
  <p class="note" style="margin-top:6px">Barra clara: quantas análises citam a causa. Barra escura: em quantas ela foi a causa principal. A primeira da lista é onde agir primeiro.</p>`;
}
function ishAggCard() {
  const all = ishTodas();
  const cnt = {}; all.forEach(x => (x.c.cats || []).forEach(k => { const o = cnt[k] = cnt[k] || {n: 0, txt: [], roots: 0}; o.n++; if (x.c.raiz === k) o.roots++; o.txt.push(causaTxt(k, x.c)); }));
  const mx = Math.max(0, ...Object.values(cnt).map(o => o.roots)); Object.values(cnt).forEach(o => { o.root = mx > 0 && o.roots === mx; });
  const acoes = all.filter(x => x.c.acao && !x.c.feito).sort((a, b) => (a.c.prazo || '9').localeCompare(b.c.prazo || '9'));
  return `<section class="card">
    <div class="card-h"><h2>Causas mais frequentes</h2><span class="sp muted" style="font-size:13px">${all.length ? `${all.length} análise${all.length > 1 ? 's' : ''} em aberto · da mais para a menos frequente` : 'causas dos atrasos e pendências'}</span></div>
    ${all.length ? causaRank(cnt) : `<div class="empty-note">Nenhuma análise ainda. Em cada pendência ou serviço parado, use <b>Analisar a causa</b>. As respostas montam este ranking e geram uma ação com responsável e prazo.</div>`}
    ${acoes.length ? `<h3 style="margin:14px 0 8px">Ações combinadas</h3><div class="logs">${acoes.map(x => `<div class="log"><div class="dt" style="${acaoLate(x.c) ? 'color:var(--danger)' : ''}">${esc(dd(x.c.prazo))}</div><div><b>${esc(x.c.acao)}</b><div class="muted">${esc(x.c.quem || '')} · ${esc(x.tit)} · causa: ${esc((ISHK[x.c.raiz] || {}).n || '')}${acaoLate(x.c) ? ' · <b style="color:var(--danger)">vencida</b>' : ''}</div></div>${canWrite() ? `<button class="btn sm ghost" ${x.c.metodo === 'masp' ? `data-mspok="${x.orig}|${esc(x.id)}|${(x.c.acoes || []).findIndex(a => !a.feito)}"` : `data-ishok="${x.orig}|${esc(x.id)}"`}>Feita</button>` : '<span></span>'}</div>`).join('')}</div>` : ''}
  </section>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-ishok]'); if (!b || !S.db) return;
  const [o, id] = b.dataset.ishok.split('|'), doc = o === 'rnc' ? S.rnc.find(r => r.id === id) : S.semAv[id]; if (!doc || !doc.causa) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar'; return; }
  try { await S.db.doc((o === 'rnc' ? 'rnc/' : 'sem_avanco/') + id).update({causa: Object.assign({}, doc.causa, {feito: todayISO(), feitoPor: S.myId || ''})}); } catch (er) { b.textContent = 'Sem permissão'; }
});
/* ---------- assistente de perguntas ---------- */
document.addEventListener('click', e => { const b = e.target.closest('[data-ish]'); if (b) { const [o, id] = b.dataset.ish.split('|'); openIsh(o, id); } });
function openIsh(orig, id) {
  if (!canWrite()) { noWriteDlg('Por que não está pronto?'); return; }
  let tit, efeito, prev = null, ctx = '';
  if (orig === 'rnc') { const r = S.rnc.find(x => x.id === id); if (!r) return; tit = r.num + ' · ' + frontName(r.frente) + ' · ' + trecho(r.ini, r.fim); efeito = r.num + ' não resolvida'; prev = r.causa; ctx = r.desc; }
  else { const x = semAvanco().find(y => y.id === id); if (!x) return; tit = title(x.g.name) + ' · ' + x.z.name + ' · ' + BRL(x.g.total); efeito = title(x.g.name) + ' parado'; prev = x.r && x.r.causa; ctx = '0% executado' + (x.tk ? ` · cronograma previa início em ${dBR(x.tk.s)}` : ''); }
  const A = (prev && prev.ans) || {}, has = k => !!(prev && (prev.cats || []).includes(k));
  const field = q => {
    const v = A[q.id] || '';
    let inp;
    if (q.tipo === 'radio') inp = `<div class="ropts">${q.op.map(o => `<label class="chk"><input type="radio" name="ia_${q.id}" value="${esc(o)}"${v === o ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
    else if (q.tipo === 'select') inp = `<select id="ia_${q.id}"><option value="">Escolha…</option>${q.op.map(o => `<option${v === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else inp = `<input id="ia_${q.id}" type="${q.tipo === 'date' ? 'date' : q.tipo === 'num' ? 'number' : 'text'}"${q.tipo === 'num' ? ' min="0" inputmode="numeric"' : ''} value="${esc(v)}" placeholder="${esc(q.ph || '')}">`;
    return `<div class="iq"${q.se ? ` data-se="${q.se}"` : ''}><label class="f">${esc(q.t)}${inp}</label></div>`;
  };
  openDlg(`
    <div class="bh"><div><div class="eyebrow">Análise de causa · ${esc(tit)}</div><h3>Por que ainda não está pronto?</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    ${ctx ? `<p class="muted" style="margin:0">${esc(ctx)}</p>` : ''}
    <form class="form" id="fIsh" novalidate>
      <div><div class="istep">1</div><b>Marque tudo o que está atrapalhando</b></div>
      <div class="icats">${ISH.map(c => `<label class="icat"><input type="checkbox" value="${c.k}"${has(c.k) ? ' checked' : ''}><span>${esc(c.n)}</span></label>`).join('')}</div>
      <div id="ia_secs">${ISH.map(c => `<fieldset class="isec" data-cat="${c.k}" hidden><legend>${esc(c.n)}</legend>${c.q.map(field).join('')}</fieldset>`).join('')}</div>
      <div id="ia_raizw" hidden>
        <div><div class="istep">2</div><b>Qual destes é o que mais pesa?</b></div>
        <div class="ropts" id="ia_raiz"></div>
        <label class="f" style="margin-top:8px">E por que isso aconteceu? <input id="ia_pq" value="${esc((prev && prev.porque) || '')}" placeholder="vá um nível abaixo: a causa da causa"></label>
      </div>
      <div id="ia_planw" hidden>
        <div><div class="istep">3</div><b>O que será feito para concluir</b></div>
        <div class="fgrid">
          <label class="f" style="grid-column:1/-1">Ação<input id="ia_acao" value="${esc((prev && prev.acao) || '')}" placeholder="uma ação concreta, com verbo"></label>
          <label class="f">Responsável<input id="ia_quem" value="${esc((prev && prev.quem) || D.meta.contratada || '')}"></label>
          <label class="f">Prazo da ação<input type="date" id="ia_prazo" value="${esc((prev && prev.prazo) || isoLocal(Date.now() + 3 * DAY))}" min="${todayISO()}"></label>
          <label class="f">Nova previsão de conclusão<input type="date" id="ia_prev" value="${esc((prev && prev.prev) || '')}" min="${todayISO()}"></label>
        </div>
        <div class="ra" style="margin-top:6px"><button class="chip" type="button" id="ia_sug">Sugerir ação pelas respostas</button>${S.hasSample ? '<button class="chip" type="button" id="ia_ai">Pedir sugestão à IA</button>' : ''}<span class="status" id="ia_aist" role="status"></span></div>
      </div>
      <div class="ra"><button class="btn" type="submit" id="ia_go">Salvar análise</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="ia_st" role="status"></span></div>
    </form>`);
  const form = $('#fIsh');
  const val = qid => { const r = form.querySelector(`input[name="ia_${qid}"]:checked`); if (r) return r.value; const el = form.querySelector('#ia_' + qid); return el ? (el.value || '').trim() : ''; };
  const cats = () => [...form.querySelectorAll('.icats input:checked')].map(i => i.value);
  const ans = () => { const o = {}; cats().forEach(k => ISHK[k].q.forEach(q => { const w = form.querySelector(`.isec[data-cat="${k}"] .iq [id="ia_${q.id}"], .isec[data-cat="${k}"] .iq [name="ia_${q.id}"]`); const box = w && w.closest('.iq'); if (box && !box.hidden) { const v = val(q.id); if (v) o[q.id] = v; } })); return o; };
  let raiz = prev && prev.raiz;
  const sync = () => {
    const cs = cats();
    form.querySelectorAll('.isec').forEach(f => { f.hidden = !cs.includes(f.dataset.cat); });
    form.querySelectorAll('.iq[data-se]').forEach(q => { const [k, v] = q.dataset.se.split('='); const parent = form.querySelector(`[name="ia_${k}"], #ia_${k}`); const pBox = parent && parent.closest('.iq'); q.hidden = !(val(k) === v && (!pBox || !pBox.hidden)); });
    $('#ia_raizw').hidden = !cs.length; $('#ia_planw').hidden = !cs.length;
    if (!cs.includes(raiz)) raiz = cs.length === 1 ? cs[0] : (cs.includes(raiz) ? raiz : '');
    $('#ia_raiz').innerHTML = cs.map(k => `<label class="chk"><input type="radio" name="ia_raizr" value="${k}"${raiz === k ? ' checked' : ''}> ${esc(ISHK[k].n)} <span class="muted">· ${esc(ishCausa(k, ans()))}</span></label>`).join('');
    const c = {cats: cs, ans: ans(), raiz};
  };
  form.addEventListener('change', e => { if (e.target.name === 'ia_raizr') { raiz = e.target.value; } sync(); });
  form.addEventListener('input', e => { if (e.target.closest('.isec')) { clearTimeout(form._t); form._t = setTimeout(sync, 250); } });
  sync();
  $('#ia_sug').onclick = () => { if (!raiz) { $('#ia_aist').className = 'status err'; $('#ia_aist').textContent = 'Escolha primeiro o que mais pesa.'; return; } $('#ia_acao').value = ishSugestao(raiz, ans()); const d = {material: ans().mat_comp === 'Não' ? ans().mat_ate : ans().mat_ent, mao: ans().mo_quando, maquina: ans().mq_prev, projeto: ans().pj_ate, meio: ans().mi_prev, gestao: ans().ge_ate}[raiz]; if (d && d >= todayISO()) $('#ia_prazo').value = d; $('#ia_aist').className = 'status ok'; $('#ia_aist').textContent = 'Ação sugerida. Ajuste se precisar.'; };
  const ai = $('#ia_ai'); if (ai) ai.onclick = async () => {
    const st = $('#ia_aist'); if (!cats().length) { st.className = 'status err'; st.textContent = 'Marque ao menos uma causa.'; return; }
    st.className = 'status'; st.textContent = 'Pensando…'; ai.disabled = true;
    try {
      const sample = await claude.use('sample'); if (!sample) throw {code: 'not_granted'};
      const j = await sample.json(`Você apoia a fiscalização de uma obra viária pública (${D.meta.objeto}). Hoje é ${dBR(todayISO())}. Um serviço não está pronto: "${tit}" (${ctx}). A equipe respondeu a uma análise de espinha de peixe: ${JSON.stringify({causas: cats().map(k => ({categoria: ISHK[k].n, resumo: ishCausa(k, ans())})), causa_principal: raiz ? ISHK[raiz].n : '', por_que: $('#ia_pq').value, respostas: ans()})}. Proponha UMA ação concreta e verificável que ataque a causa principal e destrave a conclusão, quem deve executá-la e em quantos dias. Português do Brasil, frase curta começando por verbo. Responda só com JSON: {"acao":"...","responsavel":"...","dias":N}`, {modelTier: 'quick'});
      if (j && j.acao) { $('#ia_acao').value = String(j.acao).slice(0, 240); if (j.responsavel) $('#ia_quem').value = String(j.responsavel).slice(0, 120); if (+j.dias > 0) $('#ia_prazo').value = isoLocal(Date.now() + Math.min(60, +j.dias) * DAY); st.className = 'status ok'; st.textContent = 'Sugestão da IA aplicada. Confira antes de salvar.'; }
      else { st.className = 'status err'; st.textContent = 'A IA não trouxe sugestão.'; }
    } catch (er) { st.className = 'status err'; st.textContent = er && er.code === 'rate_limited' ? 'A IA está ocupada; tente em instantes.' : 'A sugestão da IA não ficou disponível.'; }
    ai.disabled = false;
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const st = $('#ia_st'), btn = $('#ia_go'), fail = t => { st.className = 'status err'; st.textContent = t; };
    const cs = cats(); if (!cs.length) return fail('Marque ao menos uma causa.');
    if (!raiz) return fail('Escolha qual causa mais pesa.');
    const acao = $('#ia_acao').value.trim(), quem = $('#ia_quem').value.trim(), prazo = $('#ia_prazo').value, nprev = $('#ia_prev').value;
    if (acao.length < 6) return fail('Descreva a ação que vai destravar o serviço.');
    if (!quem) return fail('Informe o responsável pela ação.');
    if (!prazo) return fail('Informe o prazo da ação.');
    if (!nprev) return fail('Informe a nova previsão de conclusão.');
    if (nprev < prazo) return fail('A conclusão não pode ser antes do prazo da ação.');
    const causa = {cats: cs, ans: ans(), raiz, porque: $('#ia_pq').value.trim().slice(0, 300), acao: acao.slice(0, 240), quem: quem.slice(0, 120), prazo, prev: nprev, em: new Date().toISOString(), por: S.myId || ''};
    btn.disabled = true;
    try {
      if (orig === 'rnc') await S.db.doc('rnc/' + id).update({causa});
      else { const cur = S.semAv[id]; if (cur) await S.db.doc('sem_avanco/' + id).update({causa}); else { const x = semAvanco().find(y => y.id === id); await S.db.doc('sem_avanco/' + id).set({frente: x.z.key, grupo: x.g.code, causa, em: new Date().toISOString(), por: S.myId || ''}); } }
      closeDlg();
    } catch (er) { btn.disabled = false; fail('Não foi possível salvar (' + upErr(er) + ').'); }
  };
}

/* =====================================================================
   MASP SIMPLIFICADO · análise de pendências e serviços parados
   1 Problema · 2 Contenção · 3 Causa raiz (5 porquês guiados)
   4 Plano de ação (5W2H) · 5 Verificação (no fechamento da pendência)
   A causa raiz é classificada no 6M para o gráfico de espinha de peixe.
   ===================================================================== */
const MASP_BANCO = {
  material: ['Material não foi comprado', 'Fornecedor atrasou a entrega', 'Material chegou fora da especificação', 'Pedido de compra feito tarde', 'Quantidade insuficiente em estoque'],
  mao: ['Equipe insuficiente na frente', 'Equipe deslocada para outra frente', 'Falta profissional especializado', 'Equipe não foi orientada sobre o serviço', 'Faltou acompanhamento do encarregado'],
  maquina: ['Equipamento quebrado', 'Equipamento em outra frente', 'Equipamento não foi locado', 'Manutenção preventiva não foi feita'],
  metodo: ['Etapa anterior não foi concluída', 'Execução fora do procedimento', 'Não houve conferência antes de seguir', 'Sequência do serviço mal planejada', 'Retrabalho por erro de execução'],
  projeto: ['Projeto com divergência ou dúvida', 'Revisão de projeto não chegou à obra', 'Consulta ao projetista não foi formalizada', 'Projeto não compatível com o local'],
  meio: ['Chuva', 'Interferência de rede (Compesa / Neoenergia)', 'Acesso de moradores ou veículos', 'Ocupação ou desapropriação pendente'],
  gestao: ['Prioridade dada a outra frente', 'Aguardando decisão ou aprovação', 'Pagamento ou medição atrasada', 'Planejamento da semana não previu', 'Ninguém ficou responsável']
};
const MASP_ACAO = {
  material: r => `Garantir o material (${r}): emitir ou confirmar o pedido com data de entrega por escrito`,
  mao: r => `Recompor a equipe da frente (${r}) e definir o encarregado responsável pelo serviço`,
  maquina: r => `Disponibilizar o equipamento na frente (${r}) e programar a manutenção`,
  metodo: r => `Ajustar o procedimento (${r}): orientar a equipe e conferir antes de seguir para a próxima etapa`,
  projeto: r => `Formalizar a consulta sobre o projeto (${r}) e cobrar resposta com prazo`,
  meio: r => `Acionar formalmente o responsável pela interferência (${r}) e registrar o protocolo`,
  gestao: r => `Levar a decisão (${r}) a quem decide, com prazo definido`
};
const lc1 = s => { s = String(s || '').trim(); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
function maspSync(c) {
  // mantém os campos usados pelo resumo da obra (ação pendente mais próxima)
  const pend = (c.acoes || []).filter(a => !a.feito).sort((a, b) => (a.prazo || '9').localeCompare(b.prazo || '9'));
  const p = pend[0];
  c.acao = p ? p.oque : (c.acoes && c.acoes[0] ? c.acoes[0].oque : '');
  c.quem = p ? p.quem : (c.acoes && c.acoes[0] ? c.acoes[0].quem : '');
  c.prazo = p ? p.prazo : '';
  c.feito = (c.acoes || []).length && !pend.length ? todayISO() : '';
  c.cats = c.raiz ? [c.raiz] : []; c.ans = c.ans || {};
  return c;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-masp]'); if (b) { const [o, id] = b.dataset.masp.split('|'); openMasp(o, id); } });
function openMasp(orig, id) {
  if (!canWrite()) { noWriteDlg('Analisar a causa'); return; }
  let tit, prev = null, onde = '', oque = '';
  if (orig === 'rnc') { const r = S.rnc.find(x => x.id === id); if (!r) return; tit = r.num + ' · ' + frontName(r.frente) + ' · ' + trecho(r.ini, r.fim); prev = r.causa; onde = frontName(r.frente) + ' · ' + trecho(r.ini, r.fim) + (r.lado ? ' · ' + r.lado : ''); oque = r.desc || ''; }
  else { const x = semAvanco().find(y => y.id === id); if (!x) return; tit = title(x.g.name) + ' · ' + x.z.name; prev = x.r && x.r.causa; onde = x.z.name; oque = title(x.g.name) + ' sem avanço (0% executado)'; }
  const P = prev && prev.metodo === 'masp' ? JSON.parse(JSON.stringify(prev)) : null;
  const M = {
    problema: (P && P.problema) || {oque, onde, quando: todayISO(), quanto: ''},
    contencao: (P && P.contencao) || {tem: '', oque: ''},
    porques: (P && P.porques && P.porques.length ? P.porques : [{t: '', cat: ''}]),
    raizIdx: P && P.raizIdx != null ? P.raizIdx : -1,
    acoes: (P && P.acoes && P.acoes.length ? P.acoes : [{oque: '', quem: D.meta.contratada || '', prazo: isoLocal(Date.now() + 3 * DAY), como: '', custo: ''}]),
    prev: (P && P.prev) || ''
  };
  const ask = i => i === 0 ? `Por que isso aconteceu? <span class="muted">(${esc(lc1(M.problema.oque).slice(0, 80) || 'o problema')})</span>` : `E por que <b>“${esc(lc1(M.porques[i - 1].t).slice(0, 90))}”</b>?`;
  const chips = i => `<div class="mchips">${Object.keys(MASP_BANCO).map(k => `<details class="mcat"><summary>${esc(ISHK[k].n)}</summary><div>${MASP_BANCO[k].map(t => `<button type="button" class="chip" data-mpick="${i}|${k}|${esc(t)}">${esc(t)}</button>`).join('')}</div></details>`).join('')}</div>`;
  const porqueHtml = () => M.porques.map((p, i) => `<div class="mwhy${M.raizIdx === i ? ' raiz' : ''}" data-wi="${i}">
      <div class="mq"><span class="mn">${i + 1}º</span> ${ask(i)}</div>
      <input class="mwhy-in" data-why="${i}" value="${esc(p.t)}" placeholder="Responda com um fato, não com um culpado">
      <div class="ra" style="gap:6px 12px">
        <select data-whycat="${i}" class="chip"><option value="">Tipo de causa…</option>${Object.keys(MASP_BANCO).map(k => `<option value="${k}"${p.cat === k ? ' selected' : ''}>${esc(ISHK[k].n)}</option>`).join('')}</select>
        <label class="chk" style="font-size:13px"><input type="radio" name="mraiz" value="${i}"${M.raizIdx === i ? ' checked' : ''}> Esta é a causa raiz</label>
        ${i === M.porques.length - 1 && i < 4 && M.raizIdx !== i ? `<button type="button" class="chip" data-wmore>Perguntar “por quê?” de novo</button>` : ''}
        ${i > 0 && i === M.porques.length - 1 ? '<button type="button" class="chip" data-wless>Remover</button>' : ''}
      </div>
      ${p.t ? '' : `<div class="note" style="margin:4px 0 0">Sugestões:</div>${chips(i)}`}
    </div>`).join('');
  const acoesHtml = () => M.acoes.map((a, i) => `<div class="macao" data-ai="${i}">
      <label class="f" style="grid-column:1/-1">O quê (ação)<input data-a="oque" value="${esc(a.oque)}" placeholder="uma ação concreta, com verbo"></label>
      <label class="f">Quem<input data-a="quem" value="${esc(a.quem)}"></label>
      <label class="f">Quando (prazo)<input type="date" data-a="prazo" value="${esc(a.prazo)}"></label>
      <label class="f">Como<input data-a="como" value="${esc(a.como || '')}" placeholder="opcional"></label>
      <label class="f">Quanto custa<input data-a="custo" value="${esc(a.custo || '')}" placeholder="opcional"></label>
      ${a.feito ? `<div class="tag s-fechada" style="align-self:end">feita em ${esc(dBR(a.feito))}</div>` : ''}
      ${M.acoes.length > 1 ? `<button type="button" class="chip" data-arem="${i}" style="align-self:end">Remover ação</button>` : ''}
    </div>`).join('');
  openDlg(`
    <div class="bh"><div><div class="eyebrow">MASP · ${esc(tit)}</div><h3>Analisar e resolver</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <form class="form" id="fMasp" novalidate>
      <fieldset class="msec"><legend><span class="istep">1</span>O problema</legend>
        <label class="f">O que aconteceu?<textarea id="mp_oque" rows="2">${esc(M.problema.oque)}</textarea></label>
        <div class="fgrid">
          <label class="f">Onde<input id="mp_onde" value="${esc(M.problema.onde)}"></label>
          <label class="f">Quando foi percebido<input type="date" id="mp_quando" value="${esc(M.problema.quando)}"></label>
          <label class="f">Quanto (extensão, quantidade, impacto)<input id="mp_quanto" value="${esc(M.problema.quanto)}" placeholder="ex.: 40 m de meio-fio"></label>
        </div>
      </fieldset>
      <fieldset class="msec"><legend><span class="istep">2</span>Contenção</legend>
        <div class="ropts"><span style="font-size:14px">Já foi feito algo agora para o problema não piorar?</span>${['Sim', 'Não', 'Não precisa'].map(o => `<label class="chk"><input type="radio" name="mc_tem" value="${o}"${M.contencao.tem === o ? ' checked' : ''}> ${o}</label>`).join('')}</div>
        <label class="f" id="mc_box"${M.contencao.tem === 'Sim' ? '' : ' hidden'}>O que foi feito<input id="mc_oque" value="${esc(M.contencao.oque)}" placeholder="ex.: trecho isolado com cones"></label>
      </fieldset>
      <fieldset class="msec"><legend><span class="istep">3</span>Causa raiz · 5 porquês</legend>
        <p class="note" style="margin:0">Responda e pergunte “por quê?” de novo até chegar na causa que, se resolvida, impede o problema de voltar. Normalmente aparece entre o 3º e o 5º porquê.</p>
        <div id="m_whys">${porqueHtml()}</div>
      </fieldset>
      <fieldset class="msec"><legend><span class="istep">4</span>Plano de ação · 5W2H</legend>
        <div class="ra"><span class="muted" style="font-size:13px" id="m_raiztxt"></span><button type="button" class="chip" id="m_sug">Sugerir ação pela causa raiz</button></div>
        <div id="m_acoes">${acoesHtml()}</div>
        <div class="ra"><button type="button" class="chip" id="m_addacao">+ Outra ação</button></div>
        <label class="f" style="max-width:280px">Nova previsão para resolver a pendência<input type="date" id="m_prev" value="${esc(M.prev)}" min="${todayISO()}"></label>
        <p class="note" style="margin:0">Por quê e onde vêm da análise acima. <b>5. Verificação:</b> acontece ao fechar a pendência, quando se confirma em campo que resolveu e não voltou.</p>
      </fieldset>
      <div class="ra"><button class="btn" type="submit" id="m_go">Salvar análise</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="m_st" role="status"></span></div>
    </form>`);
  const form = $('#fMasp');
  const readWhys = () => form.querySelectorAll('[data-why]').forEach(el => { M.porques[+el.dataset.why].t = el.value.trim(); });
  const readAcoes = () => form.querySelectorAll('.macao').forEach(box => { const a = M.acoes[+box.dataset.ai]; box.querySelectorAll('[data-a]').forEach(el => { a[el.dataset.a] = el.value.trim(); }); });
  const raizTxt = () => { const r = M.porques[M.raizIdx]; return r ? r.t : ''; };
  const drawWhys = (ler = true) => { if (ler) readWhys(); $('#m_whys').innerHTML = porqueHtml(); showRaiz(); };
  const drawAcoes = (ler = true) => { if (ler) readAcoes(); $('#m_acoes').innerHTML = acoesHtml(); };
  const showRaiz = () => { const r = M.porques[M.raizIdx]; $('#m_raiztxt').innerHTML = r && r.t ? `Causa raiz: <b>${esc(r.t)}</b>${r.cat ? ' · ' + esc(ISHK[r.cat].n) : ''}` : 'Marque a causa raiz no passo 3.'; };
  showRaiz();
  form.addEventListener('click', e => {
    const pk = e.target.closest('[data-mpick]');
    if (pk) { const [i, k, t] = pk.dataset.mpick.split('|'); readWhys(); M.porques[+i] = {t, cat: k}; drawWhys(false); const nx = form.querySelector(`[data-why="${i}"]`); if (nx) nx.focus(); return; }
    if (e.target.closest('[data-wmore]')) { readWhys(); const last = M.porques[M.porques.length - 1]; if (!last.t) { $('#m_st').className = 'status err'; $('#m_st').textContent = 'Responda o porquê atual antes de perguntar de novo.'; return; } $('#m_st').textContent = ''; M.porques.push({t: '', cat: last.cat || ''}); drawWhys(false); return; }
    if (e.target.closest('[data-wless]')) { readWhys(); M.porques.pop(); if (M.raizIdx >= M.porques.length) M.raizIdx = -1; drawWhys(false); return; }
    if (e.target.id === 'm_addacao') { readAcoes(); M.acoes.push({oque: '', quem: '', prazo: isoLocal(Date.now() + 7 * DAY), como: '', custo: ''}); drawAcoes(false); return; }
    const rm = e.target.closest('[data-arem]'); if (rm) { readAcoes(); M.acoes.splice(+rm.dataset.arem, 1); drawAcoes(false); return; }
    if (e.target.id === 'm_sug') {
      readWhys(); const r = M.porques[M.raizIdx];
      if (!r || !r.t) { $('#m_st').className = 'status err'; $('#m_st').textContent = 'Marque primeiro a causa raiz no passo 3.'; return; }
      const cat = r.cat || 'metodo'; readAcoes();
      const vazio = M.acoes.find(a => !a.oque); const sug = MASP_ACAO[cat](lc1(r.t));
      if (vazio) vazio.oque = sug; else M.acoes.push({oque: sug, quem: '', prazo: isoLocal(Date.now() + 7 * DAY), como: '', custo: ''});
      drawAcoes(false); $('#m_st').textContent = '';
    }
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'mc_tem') { $('#mc_box').hidden = e.target.value !== 'Sim'; }
    if (e.target.name === 'mraiz') { M.raizIdx = +e.target.value; drawWhys(); }
    if (e.target.dataset.whycat != null) { M.porques[+e.target.dataset.whycat].cat = e.target.value; showRaiz(); }
  });
  form.addEventListener('input', e => { if (e.target.dataset.why != null) { M.porques[+e.target.dataset.why].t = e.target.value.trim(); if (+e.target.dataset.why === M.raizIdx) showRaiz(); } });
  form.onsubmit = async e => {
    e.preventDefault(); readWhys(); readAcoes();
    const st = $('#m_st'), fail = t => { st.className = 'status err'; st.textContent = t; };
    const problema = {oque: $('#mp_oque').value.trim(), onde: $('#mp_onde').value.trim(), quando: $('#mp_quando').value, quanto: $('#mp_quanto').value.trim()};
    const tem = (form.querySelector('input[name="mc_tem"]:checked') || {}).value || '';
    if (problema.oque.length < 6) return fail('Descreva o problema (passo 1).');
    if (!tem) return fail('Responda se houve contenção (passo 2).');
    const whys = M.porques.filter(p => p.t);
    if (!whys.length) return fail('Responda ao menos o 1º porquê (passo 3).');
    if (M.raizIdx < 0 || !M.porques[M.raizIdx] || !M.porques[M.raizIdx].t) return fail('Marque qual resposta é a causa raiz (passo 3).');
    if (!M.porques[M.raizIdx].cat) return fail('Escolha o tipo da causa raiz (material, método…).');
    const acoes = M.acoes.filter(a => a.oque);
    if (!acoes.length) return fail('Inclua ao menos uma ação (passo 4).');
    for (const a of acoes) { if (a.oque.length < 6) return fail('Descreva cada ação com um verbo.'); if (!a.quem) return fail('Informe quem faz cada ação.'); if (!a.prazo) return fail('Informe o prazo de cada ação.'); }
    const nprev = $('#m_prev').value;
    if (!nprev) return fail('Informe a nova previsão para resolver.');
    const raiz = M.porques[M.raizIdx];
    const causa = maspSync({metodo: 'masp', problema, contencao: {tem, oque: tem === 'Sim' ? $('#mc_oque').value.trim().slice(0, 300) : ''},
      porques: M.porques.filter(p => p.t).map(p => ({t: p.t.slice(0, 240), cat: p.cat || ''})), raizIdx: M.porques.filter(p => p.t).indexOf(raiz),
      raiz: raiz.cat, raizTxt: raiz.t.slice(0, 240), porque: raiz.t.slice(0, 240),
      acoes: acoes.map(a => ({oque: a.oque.slice(0, 240), quem: a.quem.slice(0, 120), prazo: a.prazo, como: (a.como || '').slice(0, 200), custo: (a.custo || '').slice(0, 60), feito: a.feito || ''})),
      prev: nprev, verif: P && P.verif || null, em: new Date().toISOString(), por: S.myId || ''});
    $('#m_go').disabled = true;
    try {
      if (orig === 'rnc') await S.db.doc('rnc/' + id).update({causa});
      else { const cur = S.semAv[id]; if (cur) await S.db.doc('sem_avanco/' + id).update({causa}); else { const x = semAvanco().find(y => y.id === id); await S.db.doc('sem_avanco/' + id).set({frente: x.z.key, grupo: x.g.code, causa, em: new Date().toISOString()}); } }
      closeDlg();
    } catch (er) { $('#m_go').disabled = false; fail('Não foi possível salvar (' + upErr(er) + ').'); }
  };
}
function maspHtml(c, orig, id) {
  const late = a => a.prazo && a.prazo < todayISO() && !a.feito;
  return `<div class="masp">
    <div class="mrow2"><span class="eyebrow">Problema</span> ${esc(c.problema.oque)}${c.problema.quanto ? ' · ' + esc(c.problema.quanto) : ''}</div>
    ${c.contencao && c.contencao.tem ? `<div class="mrow2"><span class="eyebrow">Contenção</span> ${c.contencao.tem === 'Sim' ? esc(c.contencao.oque || 'feita') : esc(c.contencao.tem)}</div>` : ''}
    <ol class="mchain">${(c.porques || []).map((p, i) => `<li${i === c.raizIdx ? ' class="raiz"' : ''}>${esc(p.t)}${i === c.raizIdx ? ` <span class="tag lt">causa raiz · ${esc((ISHK[p.cat] || {}).n || '')}</span>` : ''}</li>`).join('')}</ol>
    <div class="mrow2"><span class="eyebrow">Plano de ação</span></div>
    ${(c.acoes || []).map((a, i) => `<div class="acao${late(a) ? ' late' : a.feito ? ' done' : ''}" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span>${esc(a.oque)} · <b>${esc(a.quem)}</b> · até ${esc(dBR(a.prazo))}${a.como ? ' · ' + esc(a.como) : ''}${a.custo ? ' · ' + esc(a.custo) : ''}</span>
      ${a.feito ? `<span class="tag s-fechada">feita ${esc(dBR(a.feito))}</span>` : late(a) ? '<span class="tag lt">vencida</span>' : ''}
      ${!a.feito && canWrite() && orig ? `<button class="chip" data-mspok="${esc(orig)}|${esc(id)}|${i}">Marcar feita</button>` : ''}
    </div>`).join('')}
    ${c.prev ? `<div class="muted" style="font-size:13px">Previsão para resolver: ${esc(dBR(c.prev))}</div>` : ''}
    ${c.verif ? `<div class="mrow2"><span class="eyebrow">Verificação</span> ${c.verif.ok ? 'resolvido' : 'não resolvido'} em ${esc(dBR(String(c.verif.em).slice(0, 10)))}${c.verif.obs ? ' · ' + esc(c.verif.obs) : ''}</div>` : (c.feito ? '<div class="note" style="margin:0">Todas as ações feitas: confira em campo e feche a pendência para registrar a verificação.</div>' : '')}
  </div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mspok]'); if (!b || !S.db) return;
  const [o, id, i] = b.dataset.mspok.split('|'), doc = o === 'rnc' ? S.rnc.find(r => r.id === id) : S.semAv[id]; if (!doc || !doc.causa) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar'; return; }
  const c = JSON.parse(JSON.stringify(doc.causa)); c.acoes[+i].feito = todayISO(); c.acoes[+i].feitoPor = S.myId || ''; maspSync(c);
  try { await S.db.doc((o === 'rnc' ? 'rnc/' : 'sem_avanco/') + id).update({causa: c}); } catch (er) { b.textContent = 'Sem permissão'; }
});

/* =====================================================================
   AVANÇO · produção de campo com valor, antes da medição
   - a equipe escolhe a atividade principal (ex.: escavação) e a quantidade
   - o painel puxa os serviços ligados (carga, transporte, destinação,
     reciclagem...) com as mesmas regras da memória de cálculo
   - cada lançamento tem BM, período e planilha (Original, Aditivo 01, 02)
   - a previsão do próximo BM (obra e supervisão) fica na Visão geral
   Grava na coleção 'lancamentos' (a diretoria não lê essa coleção).
   ===================================================================== */
const PLAN = {original: 'BM (contrato original)', ad01: 'Aditivo 01', ad02: 'Aditivo 02'};
const PLAN_CURTO = {original: 'Original', ad01: 'Aditivo 01', ad02: 'Aditivo 02'};
const AV_ZONES = D.zones.map(z => z.key);
const AV_COEF0 = {dens: 1.5, empol: 1.3, dmt: 6.6, esp: 0.05, dAsf: 2.4, dmtAsf: 6.6, espBloco: 0.08, dBloco: 2.4, dmtInt: 1};
const AV = {
  frente: 'ramal', planilha: 'original', item: '', qtd: '', novo: null,
  bm: BMN + 1, pIni: '', pFim: '', coef: Object.assign({}, AV_COEF0), linhas: [], over: {},
  fPlan: 'todas', fBm: String(BMN + 1), prevBm: BMN + 1, prevPlan: 'todas'
};
S.avanco = [];
const num = v => { const n = parseFloat(String(v == null ? '' : v).trim().replace(/\./g, '').replace(',', '.')); return isNaN(n) ? NaN : n; };
const n2 = v => (Math.round((v || 0) * 100) / 100);
const fmtQ = v => (v || 0).toLocaleString('pt-BR', {maximumFractionDigits: 2});

/* ---------- serviços ligados ---------- */
function avItemsOf(zk) { return AV.planilha === 'ad01' && ADV ? adItens(zk).concat(zk === 'ad01x' ? [] : adItens('ad01x')) : (Z[zk] ? Z[zk].items : []); }
const avFrentes = () => AV_ZONES;
function avFind(zk, re, not) { return avItemsOf(zk).find(i => re.test(i.n) && i.c !== not) || null; }
function avDerive(zk, main, q, c) {
  if (!main || !(q > 0)) return [];
  const u = String(main.u).toUpperCase(), n = main.n, out = [];
  const add = (re, qtd, formula) => { const it = avFind(zk, re, main.c); if (it && qtd > 0) out.push({c: it.c, qtd: n2(qtd), formula}); };
  if (/ESCAVA/.test(n) && /M3|M³/.test(u)) {
    const t = q * c.dens * c.empol;
    add(/CARGA, MANOBRA E DESCARGA DE AGREGADOS OU SOLOS/, t, `${fmtQ(q)} m³ × dens. ${c.dens} × empol. ${c.empol}`);
    add(/TRANSPORTE COM CAMINH.*RODOVIA PAVIMENTADA/, t * c.dmt, `${fmtQ(n2(t))} t × DMT ${c.dmt} km`);
    add(/DESTINA.{0,4}O FINAL/, t, `${fmtQ(q)} m³ × ${c.dens} × ${c.empol}`);
  } else if (/DEMOLI.*ASF|FRESAGEM/.test(n)) {
    const vol = /M2|M²/.test(u) ? q * c.esp : q, v2 = vol * c.empol, t = v2 * c.dAsf;
    const volTxt = /M2|M²/.test(u) ? `${fmtQ(q)} m² × esp. ${c.esp}` : `${fmtQ(q)} m³`;
    if (avFind(zk, /CARGA, MANOBRA E DESCARGA DE MATERIAL FRESADO/)) add(/CARGA, MANOBRA E DESCARGA DE MATERIAL FRESADO/, t, `${volTxt} × empol. ${c.empol} × dens. ${c.dAsf}`);
    else add(/CARGA MEC/, v2, `${volTxt} × empol. ${c.empol}`);
    add(/TRANSPORTE COM CAMINH.*RODOVIA PAVIMENTADA/, t * c.dmtAsf, `${fmtQ(n2(t))} t × DMT ${c.dmtAsf} km`);
    if (avFind(zk, /RECICLAGEM.*ASF/)) add(/RECICLAGEM.*ASF/, t, `${volTxt} × ${c.empol} × ${c.dAsf}`);
    else add(/DESTINA.{0,4}O FINAL/, t, `${volTxt} × ${c.empol} × ${c.dAsf}`);
  } else if (/REMO.{0,4}O DE BLOCO|INTERTRAVADO/.test(n) && /M2|M²/.test(u) && /REMO/.test(n)) {
    const t = q * c.espBloco * c.dBloco;
    add(/CARGA, MANOBRA E DESCARGA DE BLOCOS/, t, `${fmtQ(q)} m² × esp. ${c.espBloco} × dens. ${c.dBloco}`);
    add(/VIA INTERNA/, t * c.dmtInt, `${fmtQ(n2(t))} t × DMT ${c.dmtInt} km`);
  }
  return out;
}
function avDmt(zk) {
  const its = avItemsOf(zk), car = its.find(i => /CARGA, MANOBRA E DESCARGA DE AGREGADOS OU SOLOS/.test(i.n)), tr = its.find(i => /TRANSPORTE COM CAMINH.*RODOVIA PAVIMENTADA/.test(i.n));
  if (!car || !tr) return null;
  const bmTxt = AV.planilha === 'ad01' && ADV ? 'BM ' + String(ADV.bm).padStart(2, '0') + ' do Aditivo 01' : 'BM ' + String(BMN).padStart(2, '0');
  if (car.aq > 0 && tr.aq > 0) return {v: Math.round(tr.aq / car.aq * 100) / 100, src: `medido nesta frente até o ${bmTxt}: ${fmtQ(tr.aq)} tkm ÷ ${fmtQ(car.aq)} t`};
  if (car.q > 0) return {v: Math.round(tr.q / car.q * 100) / 100, src: `planilha desta frente: ${fmtQ(tr.q)} tkm ÷ ${fmtQ(car.q)} t`};
  return null;
}
function avTipo(main) {
  if (!main) return '';
  if (/ESCAVA/.test(main.n) && /M3|M³/.test(main.u)) return 'esc';
  if (/DEMOLI.*ASF|FRESAGEM/.test(main.n)) return 'asf';
  if (/REMO/.test(main.n) && /INTERTRAVADO|BLOCO/.test(main.n)) return 'bloco';
  return '';
}

/* ---------- monta as linhas do lançamento em edição ---------- */
function avLinhas() {
  const zk = AV.frente, q = num(AV.qtd);
  let main = AV.item === '__novo' ? null : avItemsOf(zk).find(i => i.c === AV.item) || null;
  const ls = [];
  if (AV.item === '__novo') {
    const nv = AV.novo || {};
    if (nv.desc && q > 0) ls.push({c: nv.cod || 'NOVO', n: nv.desc, u: nv.und || '', pu: num(nv.pu) || 0, qtd: q, formula: 'informado', principal: true, novo: true});
  } else if (main && q > 0) {
    ls.push({c: main.c, n: main.n, u: main.u, pu: main.pu, qtd: q, formula: AV.med && AV.med.q === q ? AV.med.txt : 'informado', principal: true});
    avDerive(zk, main, q, AV.coef).forEach(d => { const it = avItemsOf(zk).find(i => i.c === d.c); ls.push({c: d.c, n: it.n, u: it.u, pu: it.pu, qtd: d.qtd, formula: d.formula}); });
  }
  ls.forEach(l => {
    const o = AV.over[l.c] || {};
    if (o.qtd != null && !isNaN(o.qtd)) { l.qtd = o.qtd; l.editada = true; }
    if (o.pu != null && !isNaN(o.pu)) { l.pu = o.pu; l.puEditado = true; }
    if (o.fora) l.fora = true;
    l.valor = n2(l.qtd * l.pu);
  });
  AV.linhas = ls;
  return ls;
}

/* ---------- formulário ---------- */
function avItemOpts(zk, sel) {
  if (AV.planilha === 'ad01' && ADV) {
    const its = avItemsOf(zk), gs = [...new Set(its.map(i => i.zona + '|' + i.g))];
    return `<option value="">Escolha a atividade do aditivo…</option>${gs.map(k => { const li = its.filter(i => i.zona + '|' + i.g === k); return `<optgroup label="${esc(li[0].g + ' ' + (li[0].z === 'ad01x' ? 'Itens novos do aditivo (piso tátil, laboratórios, BSTC…)' : title(li[0].gn)))}">${li.map(i => `<option value="${esc(i.c)}"${i.c === sel ? ' selected' : ''}>${esc(i.c)} · ${esc(short(i.n).slice(0, 72))} (${esc(i.u)})</option>`).join('')}</optgroup>`; }).join('')}<option value="__novo"${sel === '__novo' ? ' selected' : ''}>+ Item fora da planilha</option>`;
  }
  const z = Z[zk]; if (!z) return '';
  const groups = (z.groups && z.groups.length ? z.groups : [{code: '', name: ''}]);
  const body = groups.map(g => {
    const its = z.items.filter(i => !g.code || groupOf(i.c) === g.code);
    if (!its.length) return '';
    const o = its.map(i => `<option value="${i.c}"${i.c === sel ? ' selected' : ''}>${i.c} · ${esc(short(i.n).slice(0, 72))} (${esc(i.u)})</option>`).join('');
    return g.code ? `<optgroup label="${esc(g.code + ' ' + title(g.name))}">${o}</optgroup>` : o;
  }).join('');
  return `<option value="">Escolha a atividade…</option>${body}<option value="__novo"${sel === '__novo' ? ' selected' : ''}>+ Item novo (aditivo / fora da planilha)</option>`;
}
function avancoCard(canDb) {
  return `<section class="card" id="avCard">
    <div class="card-h"><h2>Lançar avanço</h2><span class="sp muted" style="font-size:13px">Escolha a atividade e a quantidade; o painel puxa os serviços ligados e calcula o valor</span></div>
    <form class="form" id="fAv" autocomplete="off" ${canDb ? '' : 'inert style="opacity:.55"'}>
      <div class="fgrid">
        <label class="f">Planilha<select id="av_plan">${Object.entries(PLAN).map(([k, n]) => `<option value="${k}"${k === AV.planilha ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f">BM<input id="av_bm" type="number" min="1" step="1" value="${AV.bm}" required></label>
        <label class="f">Período · início<input id="av_pini" type="date" value="${AV.pIni}"></label>
        <label class="f">Período · fim<input id="av_pfim" type="date" value="${AV.pFim}"></label>
      </div>
      <div class="fgrid">
        <label class="f">Frente / grupo do boletim<select id="av_front">${avFrontOpts()}</select></label>
        <label class="f">Data do serviço<input id="av_data" type="date" value="${todayISO()}" required></label>
      </div>
      <div class="fgrid" style="grid-template-columns:minmax(0,3fr) minmax(140px,1fr)">
        <label class="f">Atividade principal<select id="av_item">${avItemOpts(AV.frente, AV.item)}</select></label>
        <label class="f">Quantidade <span id="av_und" class="mono"></span><input id="av_qtd" inputmode="decimal" placeholder="ex.: 460,00" value="${esc(AV.qtd)}"></label>
      </div>
      <div class="medbox">
        <div class="eyebrow" style="margin-bottom:6px">Calcular pela medida <span class="muted" style="text-transform:none;letter-spacing:0">· preencha e o painel calcula a quantidade</span></div>
        <div class="fgrid">
          <label class="f">Bordo<select id="av_lado"><option value="">Pista toda / eixo (×1)</option><option value="LE">Bordo esquerdo (LE)</option><option value="LD">Bordo direito (LD)</option><option value="AMB">Ambos os bordos (×2)</option></select></label>
          <label class="f">Estaca inicial<input id="av_ini" placeholder="ex.: 12+10"></label>
          <label class="f">Estaca final<input id="av_fim" placeholder="ex.: 15"></label>
          <label class="f">Comprimento (m)<input id="avm_c" inputmode="decimal" placeholder="sai das estacas"></label>
          <label class="f">Largura (m)<input id="avm_l" inputmode="decimal" placeholder="ex.: 3,50"></label>
          <label class="f">Espessura / altura (m)<input id="avm_e" inputmode="decimal" placeholder="ex.: 0,05"></label>
          <label class="f" id="avm_dbox" hidden>Densidade (t/m³)<input id="avm_d" inputmode="decimal" placeholder="ex.: 2,40"></label>
        </div>
        <div id="avm_res" class="note" style="margin:6px 0 0"></div>
      </div>
      <div id="av_novo" hidden class="fgrid">
        <label class="f">Código<input id="avn_cod" placeholder="ex.: AD01-3.2"></label>
        <label class="f" style="grid-column:span 2">Descrição<input id="avn_desc" placeholder="Descrição do serviço"></label>
        <label class="f">Unidade<input id="avn_und" placeholder="M3, M2, T…"></label>
        <label class="f">Preço unitário (R$)<input id="avn_pu" inputmode="decimal" placeholder="0,00"></label>
      </div>
      <details id="av_coefbox"><summary>Parâmetros dos serviços ligados (densidade, empolamento, DMT)</summary><div class="fgrid" id="av_coef" style="margin-top:10px"></div></details>
      <div id="av_prev"></div>
      <label class="f">Observação<textarea id="av_obs" placeholder="Equipe, equipamento, ocorrência…"></textarea></label>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit" id="av_go">Salvar avanço</button><button class="btn ghost" type="button" id="av_clear">Limpar</button><span class="status" id="av_st" role="status"></span></div>
    </form>
  </section>`;
}
function avFrontOpts() { AV.planOpts = AV.planilha; const fs = avFrentes(); if (!fs.includes(AV.frente)) { AV.frente = fs[0]; AV.item = ''; } return fs.map(k => `<option value="${k}"${k === AV.frente ? ' selected' : ''}>${esc(frNome(k))}</option>`).join(''); }
const COEF_LBL = {
  esc: [['dens', 'Densidade solo (t/m³)'], ['empol', 'Empolamento'], ['dmt', 'DMT bota-fora (km)']],
  asf: [['esp', 'Espessura demolida (m)'], ['empol', 'Empolamento'], ['dAsf', 'Densidade asfalto (t/m³)'], ['dmtAsf', 'DMT (km)']],
  bloco: [['espBloco', 'Espessura do bloco (m)'], ['dBloco', 'Densidade (t/m³)'], ['dmtInt', 'DMT interna (km)']]
};
function avRenderPrev() {
  const box = $('#av_prev'); if (!box) return;
  const zk = AV.frente, main = avItemsOf(zk).find(i => i.c === AV.item);
  $('#av_und').textContent = AV.item === '__novo' ? (AV.novo && AV.novo.und ? '(' + AV.novo.und + ')' : '') : main ? '(' + main.u + ')' : '';
  $('#av_novo').hidden = AV.item !== '__novo';
  const tipo = avTipo(main), cb = $('#av_coefbox');
  cb.hidden = !tipo;
  if (tipo === 'esc' && !(AV.coefEdit && AV.coefEdit.dmt)) { const dm = avDmt(zk); AV.dmtSrc = dm ? dm.src : ''; if (dm) AV.coef.dmt = dm.v; }
  if (tipo) $('#av_coef').innerHTML = (tipo === 'esc' ? `<p class="note" style="grid-column:1/-1;margin:0">DMT usada: <b>${fmtQ(AV.coef.dmt)} km</b> · ${AV.coefEdit && AV.coefEdit.dmt ? 'corrigida à mão' : AV.dmtSrc ? esc(AV.dmtSrc) : 'DADO NÃO DISPONÍVEL nesta frente: confira'}</p>` : '') + COEF_LBL[tipo].map(([k, l]) => `<label class="f">${l}<input data-coef="${k}" inputmode="decimal" value="${String(AV.coef[k]).replace('.', ',')}"></label>`).join('');
  const ls = avLinhas();
  if (!ls.length) { box.innerHTML = AV.item ? '<div class="empty-note">Informe a quantidade para ver os serviços e valores.</div>' : ''; return; }
  const tot = ls.filter(l => !l.fora).reduce((s, l) => s + l.valor, 0);
  box.innerHTML = `<div class="tbl"><table class="avt" style="min-width:680px">
    <thead><tr><th style="width:28px"></th><th>Item</th><th>Serviço</th><th>Cálculo</th><th class="r">Quantidade</th><th class="r">Preço unit.</th><th class="r">Valor</th></tr></thead>
    <tbody>${ls.map(l => `<tr${l.fora ? ' style="opacity:.45"' : ''}>
      <td>${l.principal ? '<span title="Atividade principal">●</span>' : `<input type="checkbox" data-avon="${esc(l.c)}" ${l.fora ? '' : 'checked'} title="Incluir este serviço">`}</td>
      <td class="mono">${esc(l.c)}</td>
      <td class="desc">${esc(short(l.n))}${l.principal ? '' : ' <span class="tag">ligado</span>'}</td>
      <td class="muted" style="font-size:12px">${esc(l.formula)}</td>
      <td class="r">${l.principal ? `<span class="num">${fmtQ(l.qtd)}</span>` : `<input data-avq="${esc(l.c)}" inputmode="decimal" value="${fmtQ(l.qtd)}" style="width:110px;text-align:right${l.editada ? ';border-color:var(--warn)' : ''}">`} ${esc(l.u)}</td>
      <td class="r"><input data-avpu="${esc(l.c)}" inputmode="decimal" value="${(l.pu || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" style="width:100px;text-align:right${l.puEditado ? ';border-color:var(--warn)' : ''}"></td>
      <td class="r num"><b>${BRL(l.valor)}</b></td></tr>`).join('')}</tbody>
    <tfoot><tr><td></td><td colspan="5" style="text-align:right;font-weight:600;padding-top:10px">Total deste lançamento${AV.planilha !== 'original' ? ' · ' + PLAN_CURTO[AV.planilha] : ''}</td><td class="r num" style="padding-top:10px"><b style="font-size:16px;color:var(--accent)">${BRL(tot)}</b></td></tr></tfoot>
  </table></div>
  <p class="note">Quantidades dos serviços ligados calculadas pelos parâmetros acima (os mesmos da memória de cálculo). Você pode corrigir qualquer número antes de salvar; o que foi alterado fica marcado em amarelo.</p>`;
}
function bindAvanco() {
  const f = $('#fAv'); if (!f) return;
  const sync = () => { AV.planilha = $('#av_plan').value; AV.bm = parseInt($('#av_bm').value, 10) || AV.bm; AV.pIni = $('#av_pini').value; AV.pFim = $('#av_pfim').value; AV.qtd = $('#av_qtd').value; AV.novo = {cod: $('#avn_cod').value.trim(), desc: $('#avn_desc').value.trim(), und: $('#avn_und').value.trim(), pu: $('#avn_pu').value}; };
  $('#av_front').onchange = () => { AV.frente = $('#av_front').value; AV.item = ''; AV.over = {}; AV.coefEdit = {}; $('#av_item').innerHTML = avItemOpts(AV.frente, ''); avRenderPrev(); };
  $('#av_item').onchange = () => { AV.item = $('#av_item').value; AV.over = {}; sync(); avRenderPrev(); };
  f.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.coef) { const v = num(t.value); if (!isNaN(v)) { AV.coef[t.dataset.coef] = v; AV.over = {}; (AV.coefEdit = AV.coefEdit || {})[t.dataset.coef] = true; } clearTimeout(AV._t); AV._t = setTimeout(avRenderPrevKeep, 400); return; }
    if (t.dataset.avq) { (AV.over[t.dataset.avq] = AV.over[t.dataset.avq] || {}).qtd = num(t.value); clearTimeout(AV._t); AV._t = setTimeout(avRenderPrevKeep, 600); return; }
    if (t.dataset.avpu) { (AV.over[t.dataset.avpu] = AV.over[t.dataset.avpu] || {}).pu = num(t.value); clearTimeout(AV._t); AV._t = setTimeout(avRenderPrevKeep, 600); return; }
    if (['av_qtd', 'avn_cod', 'avn_desc', 'avn_und', 'avn_pu'].includes(t.id)) { sync(); clearTimeout(AV._t); AV._t = setTimeout(avRenderPrevKeep, 300); return; }
    if (['av_plan', 'av_bm', 'av_pini', 'av_pfim'].includes(t.id)) sync();
  });
  f.addEventListener('change', e => { const t = e.target; if (t.dataset.avon) { (AV.over[t.dataset.avon] = AV.over[t.dataset.avon] || {}).fora = !t.checked; avRenderPrevKeep(); } if (t.id === 'av_plan') { sync(); if ((AV.planOpts === 'ad01') !== (AV.planilha === 'ad01')) { AV.item = ''; AV.over = {}; $('#av_front').innerHTML = avFrontOpts(); $('#av_item').innerHTML = avItemOpts(AV.frente, ''); avRenderPrev(); } else avRenderPrevKeep(); } });
  $('#av_clear').onclick = () => { AV.item = ''; AV.qtd = ''; AV.over = {}; AV.novo = null; $('#av_item').value = ''; $('#av_qtd').value = ''; ['avn_cod', 'avn_desc', 'avn_und', 'avn_pu', 'av_ini', 'av_fim', 'av_obs', 'avm_c', 'avm_l', 'avm_e', 'avm_d'].forEach(id => { $('#' + id).value = ''; }); AV.med = null; $('#avm_res').innerHTML = ''; $('#av_st').textContent = ''; avRenderPrev(); };
  f.onsubmit = async e => {
    e.preventDefault(); sync();
    const st = $('#av_st'), ls = avLinhas().filter(l => !l.fora);
    const bad = m => { st.className = 'status err'; st.textContent = m; };
    if (!ls.length) return bad('Escolha a atividade e informe a quantidade.');
    if (!(AV.bm > 0)) return bad('Informe o número do BM.');
    if (AV.pIni && AV.pFim && AV.pFim < AV.pIni) return bad('O fim do período está antes do início.');
    const ei = $('#av_ini').value.trim(), ef = $('#av_fim').value.trim();
    let ini = ei ? parseEst(ei) : null, fim = ef ? parseEst(ef) : ini;
    if (ei && isNaN(ini)) return bad('Use estacas no formato 12 ou 12+10.');
    if (ini != null) { ini = fixEst(AV.frente, ini); fim = fim == null || isNaN(fim) ? ini : fixEst(AV.frente, fim); if (fim < ini) [ini, fim] = [fim, ini]; }
    const pacote = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const base = {frente: AV.frente, planilha: AV.planilha, bm: AV.bm, perIni: AV.pIni, perFim: AV.pFim, data: $('#av_data').value, ini, fim, lado: $('#av_lado').value, medidas: AV.med || null, obs: $('#av_obs').value.trim().slice(0, 500), pacote, autor: S.myId || '', criado: new Date().toISOString(), origem: 'avanco'};
    $('#av_go').disabled = true; st.className = 'status'; st.textContent = 'Salvando…';
    try {
      for (const l of ls) await S.db.collection('lancamentos').add(Object.assign({}, base, {item: l.c, desc: (l.novo || AV.planilha === 'ad01') ? l.n : '', und: l.u, qtd: l.qtd, pu: l.pu, valor: l.valor, principal: !!l.principal, calculo: l.formula}));
      st.className = 'status ok'; st.textContent = `Avanço salvo: ${ls.length} serviço${ls.length > 1 ? 's' : ''}, ${BRL(ls.reduce((s, l) => s + l.valor, 0))}.`;
      AV.qtd = ''; AV.over = {}; AV.med = null; $('#av_qtd').value = ''; ['avm_c', 'avm_l', 'avm_e'].forEach(id => { $('#' + id).value = ''; }); $('#avm_res').innerHTML = ''; $('#av_obs').value = ''; $('#av_ini').value = ''; $('#av_fim').value = ''; avRenderPrev();
    } catch (err) { bad('Não foi possível salvar (' + (err && (err.code || err.message) || 'erro') + ').'); }
    $('#av_go').disabled = false;
  };
  avRenderPrev();
}
/* ---------- calcular a quantidade pela medida ---------- */
function avUnTipo(u) { u = String(u || '').toUpperCase().replace('²', '2').replace('³', '3').replace(/\s/g, ''); if (u === 'M' || u === 'ML') return 'm'; if (u === 'M2') return 'm2'; if (u === 'M3') return 'm3'; if (u === 'T') return 't'; return ''; }
function avUnAtual() { if (AV.item === '__novo') return AV.novo && AV.novo.und || ''; const it = avItemsOf(AV.frente).find(i => i.c === AV.item); return it ? it.u : ''; }
function avMedida(origem) {
  const res = $('#avm_res'); if (!res) return;
  const tipo = avUnTipo(avUnAtual()), u = avUnAtual(); AV.med = null;
  $('#avm_dbox').hidden = tipo !== 't';
  // comprimento pelas estacas, se não foi digitado
  const ei = $('#av_ini').value.trim(), ef = $('#av_fim').value.trim(), cEl = $('#avm_c');
  const ea = ei ? parseEst(ei) : NaN, eb = ef ? parseEst(ef) : NaN, porEst = !isNaN(ea) && !isNaN(eb) && ea !== eb;
  if (porEst) { cEl.value = fmtQ(Math.abs(eb - ea)); cEl.dataset.auto = '1'; cEl.readOnly = true; cEl.title = 'Calculado pelas estacas (Est. ' + estStr(Math.min(ea, eb)) + ' a ' + estStr(Math.max(ea, eb)) + ')'; }
  else { if (cEl.dataset.auto === '1') cEl.value = ''; cEl.dataset.auto = ''; cEl.readOnly = false; cEl.title = ''; }
  const C = num(cEl.value), L = num($('#avm_l').value), E = num($('#avm_e').value), Dd = num($('#avm_d').value), lado = $('#av_lado').value, k = lado === 'AMB' ? 2 : 1;
  const nada = [C, L, E].every(isNaN);
  if (!AV.item) { res.innerHTML = ''; return; }
  if (!tipo) { res.innerHTML = u ? `Unidade <b>${esc(u)}</b> não é calculada por medida: informe a quantidade direto.` : ''; return; }
  if (nada) { res.innerHTML = `Unidade <b>${esc(u)}</b>: ${{m: 'informe o comprimento', m2: 'informe comprimento e largura', m3: 'informe comprimento, largura e espessura', t: 'informe comprimento, largura, espessura e densidade'}[tipo]}.`; return; }
  const precisa = {m: [C], m2: [C, L], m3: [C, L, E], t: [C, L, E, Dd]}[tipo];
  if (precisa.some(v => isNaN(v) || v <= 0)) { res.innerHTML = `Falta medida para ${esc(u)}: ${{m: 'comprimento', m2: 'comprimento e largura', m3: 'comprimento, largura e espessura', t: 'comprimento, largura, espessura e densidade'}[tipo]}.`; return; }
  const partes = [porEst ? `C ${fmtQ(C)} m (Est. ${estStr(Math.min(ea, eb))} a ${estStr(Math.max(ea, eb))})` : `C ${fmtQ(C)} m`]; let q = C;
  if (tipo !== 'm') { partes.push(`L ${fmtQ(L)} m`); q *= L; }
  if (tipo === 'm3' || tipo === 't') { partes.push(`E ${fmtQ(E)} m`); q *= E; }
  if (tipo === 't') { partes.push(`dens. ${fmtQ(Dd)} t/m³`); q *= Dd; }
  if (k > 1) { partes.push('2 bordos'); q *= 2; }
  q = n2(q);
  const txt = partes.join(' × ') + ` = ${fmtQ(q)} ${u}`;
  AV.med = {q, txt, c: C, l: isNaN(L) ? null : L, e: isNaN(E) ? null : E, d: isNaN(Dd) ? null : Dd, bordos: k};
  $('#av_qtd').value = fmtQ(q); AV.qtd = $('#av_qtd').value;
  res.innerHTML = `<b>Quantidade calculada:</b> <span class="num">${esc(txt)}</span>`;
  avRenderPrevKeep();
}
document.addEventListener('input', e => {
  const id = e.target.id; if (!id) return;
  if (['avm_c', 'avm_l', 'avm_e', 'avm_d'].includes(id)) { if (id === 'avm_c') e.target.dataset.auto = ''; clearTimeout(AV._m); AV._m = setTimeout(() => avMedida('med'), 250); }
  else if (id === 'av_ini' || id === 'av_fim') { clearTimeout(AV._m); AV._m = setTimeout(() => avMedida('est'), 400); }
  else if (id === 'av_qtd') { AV.med = null; }
});
document.addEventListener('change', e => { if (['av_lado', 'av_item', 'av_front'].includes(e.target.id)) setTimeout(() => avMedida('med'), 0); });
function avRenderPrevKeep() { const a = document.activeElement, id = a && (a.id || (a.dataset && (a.dataset.avq ? 'q:' + a.dataset.avq : a.dataset.avpu ? 'p:' + a.dataset.avpu : a.dataset.coef ? 'c:' + a.dataset.coef : ''))); const pos = a && a.selectionStart; avRenderPrev(); if (id && id.includes(':')) { const [k, c] = id.split(':'); const el = document.querySelector(k === 'q' ? `[data-avq="${c}"]` : k === 'p' ? `[data-avpu="${c}"]` : `[data-coef="${c}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } } }

/* ---------- lista com filtros ---------- */
const avDe = l => l.origem === 'avanco';
function avValor(l) { if (l.valor != null) return l.valor; const it = itemName(l.item); return it && l.qtd ? n2(l.qtd * it.pu) : 0; }
function avFiltrar(lst, plan, bm) { return lst.filter(l => (plan === 'todas' || (l.planilha || 'original') === plan) && (bm === 'todos' || String(l.bm || '') === String(bm))); }
function avancoLista() {
  const all = S.avanco.slice().sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  const bms = [...new Set(all.map(l => l.bm).filter(Boolean))].sort((a, b) => b - a);
  const sel = avFiltrar(all, AV.fPlan, AV.fBm);
  const pac = {}; sel.forEach(l => { const k = l.pacote || l.id; (pac[k] = pac[k] || []).push(l); });
  const grupos = Object.values(pac);
  const tot = sel.reduce((s, l) => s + avValor(l), 0);
  const porPlan = {}; sel.forEach(l => { const k = l.planilha || 'original'; porPlan[k] = (porPlan[k] || 0) + avValor(l); });
  return `<section class="card" id="avLista">
    <div class="card-h"><h2>Avanços lançados</h2><span class="sp" style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" type="button" data-avexp="xlsx" title="Baixa o que está filtrado abaixo em Excel">Exportar Excel</button><button class="chip" type="button" data-avexp="pdf" title="Abre o relatório para salvar em PDF">Exportar PDF</button></span></div>
    <div class="filt">
      <label class="f" style="display:flex;align-items:center;gap:8px">Planilha<select id="avf_plan"><option value="todas">Todas</option>${Object.entries(PLAN).map(([k, n]) => `<option value="${k}"${k === AV.fPlan ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f" style="display:flex;align-items:center;gap:8px">BM<select id="avf_bm"><option value="todos"${AV.fBm === 'todos' ? ' selected' : ''}>Todos</option>${[...new Set([BMN + 1].concat(bms))].sort((a, b) => b - a).map(b => `<option value="${b}"${String(b) === String(AV.fBm) ? ' selected' : ''}>BM ${String(b).padStart(2, '0')}</option>`).join('')}</select></label>
      <span class="muted" style="margin-left:auto">${grupos.length} lançamento${grupos.length === 1 ? '' : 's'} · <b class="num" style="color:var(--fg)">${BRL(tot)}</b>${Object.keys(porPlan).length > 1 ? ' · ' + Object.entries(porPlan).map(([k, v]) => `${PLAN_CURTO[k]} ${BRL(v)}`).join(' · ') : ''}</span>
    </div>
    ${grupos.length ? `<div class="logs">${grupos.map(g => {
      const p = g.find(l => l.principal) || g[0], it = itemName(p.item), v = g.reduce((s, l) => s + avValor(l), 0), mine = S.myId && p.autor === S.myId;
      return `<div class="log"><div class="dt">${dBR(p.data).slice(0, 5)}</div><div>
        <div><span class="tag">${esc(PLAN_CURTO[p.planilha || 'original'])}</span> <span class="tag">BM ${p.bm ? String(p.bm).padStart(2, '0') : '—'}</span> <b>${esc(p.item)}</b> ${esc(p.desc || (it ? short(it.n) : ''))}</div>
        <div class="muted" style="font-size:12.5px">${esc(frNome(p.frente))}${p.ini != null ? ' · Est. ' + esc(estStr(p.ini)) + (p.fim > p.ini ? ' a ' + esc(estStr(p.fim)) : '') : ''}${p.lado ? ' · ' + esc({AMB: 'ambos os bordos', LE: 'bordo esquerdo', LD: 'bordo direito'}[p.lado] || p.lado) : ''} · ${fmtQ(p.qtd)} ${esc(p.und || (it ? it.u : ''))}${p.perIni ? ' · período ' + dBR(p.perIni) + (p.perFim ? ' a ' + dBR(p.perFim) : '') : ''}${S.names[p.autor] ? ' · ' + esc(S.names[p.autor]) : ''}</div>
        ${g.length > 1 ? `<div class="muted" style="font-size:12px">+ ${g.filter(l => l !== p).map(l => `${esc(l.item)} ${fmtQ(l.qtd)} ${esc(l.und || '')}`).join(' · ')}</div>` : ''}
        ${p.calculo && p.calculo !== 'informado' && p.medidas ? `<div class="muted" style="font-size:12px">Medida: ${esc(p.calculo)}</div>` : ''}
        ${p.obs ? `<div style="font-size:12.5px">${esc(p.obs)}</div>` : ''}
      </div><div style="text-align:right"><b class="num">${BRL(v)}</b>${mine || S.canEdit ? `<br><button class="del" data-delpac="${esc(p.pacote || '')}" data-dellanc="${p.pacote ? '' : esc(p.id)}">excluir</button>` : ''}</div></div>`;
    }).join('')}</div>` : '<div class="empty-note">Nenhum avanço com esses filtros.</div>'}
  </section>`;
}
document.addEventListener('change', e => {
  if (e.target.id === 'avf_plan') { AV.fPlan = e.target.value; const l = $('#avLista'); if (l) l.outerHTML = avancoLista(); }
  if (e.target.id === 'avf_bm') { AV.fBm = e.target.value; const l = $('#avLista'); if (l) l.outerHTML = avancoLista(); }
  if (e.target.id === 'pv_bm') { AV.prevBm = e.target.value; const c = $('#prevCard'); if (c) c.outerHTML = previsaoCard(); }
  if (e.target.id === 'pv_plan') { AV.prevPlan = e.target.value; const c = $('#prevCard'); if (c) c.outerHTML = previsaoCard(); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-delpac]'); if (!b || !S.db || !b.dataset.delpac) return;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'confirmar exclusão'; return; }
  b.disabled = true;
  try { for (const l of S.avanco.filter(x => x.pacote === b.dataset.delpac)) await S.db.doc('lancamentos/' + l.id).delete(); }
  catch (err) { b.textContent = 'sem permissão'; }
});

/* ---------- previsão do BM (Visão geral, só equipe) ---------- */
function previsaoCard() {
  if (isDir()) return '';
  const bm = AV.prevBm, sel = avFiltrar(S.avanco, AV.prevPlan, bm);
  const tot = sel.reduce((s, l) => s + avValor(l), 0);
  const fr = {}; sel.forEach(l => { fr[l.frente] = (fr[l.frente] || 0) + avValor(l); });
  const M = D.meta, pct = tot / M.total, SP = D.supervisao;
  const sup = SP ? pct * SP.fator + (tot > 0 ? SP.fixo || 0 : 0) : 0;
  const bms = [...new Set([BMN + 1].concat(S.avanco.map(l => l.bm).filter(Boolean)))].sort((a, b) => b - a);
  const rows = Object.entries(fr).sort((a, b) => b[1] - a[1]);
  return `<section class="card" id="prevCard">
    <div class="card-h"><h2>Previsão de medição</h2>
      <span class="sp" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="pv_bm" class="chip">${bms.map(b => `<option value="${b}"${String(b) === String(bm) ? ' selected' : ''}>BM ${String(b).padStart(2, '0')}</option>`).join('')}</select>
        <select id="pv_plan" class="chip"><option value="todas">Todas as planilhas</option>${Object.entries(PLAN).map(([k, n]) => `<option value="${k}"${k === AV.prevPlan ? ' selected' : ''}>${n}</option>`).join('')}</select>
        <button class="chip" data-go="lancar">Lançar avanço</button>
      </span></div>
    <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:12px">
      <div class="kpi"><div class="eyebrow">Obra · a medir</div><div class="v">${BRLm(tot)}</div><div class="s">${PCT(pct, 2)} do contrato 34/2025</div></div>
      <div class="kpi"><div class="eyebrow">Acumulado previsto</div><div class="v">${PCT((M.acum + tot) / M.total)}</div><div class="s">${BRLm(M.acum + tot)} após o BM ${String(bm).padStart(2, '0')}</div></div>
      <div class="kpi"><div class="eyebrow">Supervisão · estimativa</div><div class="v">${SP ? BRLm(sup) : ND()}</div><div class="s">${SP ? `contrato ${esc(SP.contrato)} · ${PCT(pct, 2)} × base do ${esc(SP.base)}` : 'falta o BM da supervisão'}</div></div>
    </div>
    ${rows.length ? `<div class="mlist">${rows.map(([k, v]) => `<div class="mrow"><div><b>${esc(frNome(k))}</b></div><div class="r num">${BRL(v)}</div></div>`).join('')}</div>` : `<div class="empty-note">Nenhum avanço lançado para o BM ${String(bm).padStart(2, '0')} ainda. A equipe lança na aba <b>Avanço</b>.</div>`}
    <p class="note">Soma dos avanços lançados pela equipe para este BM, a preços do contrato. A supervisão é estimada pela regra do BM dela: equipe e equipamentos medidos na mesma proporção que a obra mede no mês, mais as impressões.</p>
  </section>`;
}


/* =====================================================================
   LINHA DO TEMPO (4D) · a obra BM a BM
   S.tl = número do BM (mostra só o que foi medido até ele) ou null (hoje)
   Regra de fidelidade: o que não existe nos documentos aparece como
   "DADO NÃO DISPONÍVEL" — nada é suposto.
   ===================================================================== */
S.tl = null;
const RECS_MIN = D.recs.length ? Math.min(...D.recs.map(r => r[1])) : BMN + 1;
const ND = (t = 'DADO NÃO DISPONÍVEL') => `<span class="nd">${esc(t)}</span>`;
function bmFim(n) { const b = D.bms[n - 1]; const m = b && String(b.per).match(/(\d\d)\/(\d\d)\/(\d{4})\s*$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; }
const tlLanc = l => !S.tl || (l.bm ? l.bm <= S.tl : (l.data || '') <= bmFim(S.tl));
const TLZ = {};
function tlZ(z) {
  if (!S.tl) return {acum: z.acum, per: z.per};
  const k = z.key + '|' + S.tl; if (TLZ[k]) return TLZ[k];
  let acum = 0, per = 0;
  z.items.forEach(i => { const b = i.bm || []; for (let j = 0; j < S.tl && j < b.length; j++) acum += (b[j] || 0) * i.pu; per += (b[S.tl - 1] || 0) * i.pu; });
  return (TLZ[k] = {acum, per});
}
function tlCard(scope) {
  const n = S.tl || BMN, b = D.bms[n - 1] || {}, z = Z[scope];
  const tot = z ? z.total : D.meta.total;
  const ac = z ? tlZ(z).acum : D.zones.reduce((a, x) => a + tlZ(x).acum, 0);
  const pr = z ? tlZ(z).per : D.zones.reduce((a, x) => a + tlZ(x).per, 0);
  const semEst = z && hasMap(scope) && n < RECS_MIN;
  return `<section class="card tl" id="tlCard">
    <div class="card-h"><h2>Linha do tempo da obra</h2><span class="sp muted" style="font-size:13px">${S.tl ? `Mostrando o que foi medido até o BM ${String(n).padStart(2, '0')}` : 'Mostrando a situação de hoje'}</span></div>
    <div class="tlbar">
      <button class="btn sm" type="button" data-tlplay>${S.tlTimer ? '❚❚ Pausar' : '▶ Reproduzir'}</button>
      <input type="range" id="tl_r" min="1" max="${BMN}" step="1" value="${n}" aria-label="Boletim de medição">
      <button class="btn sm ghost" type="button" data-tlhoje ${S.tl ? '' : 'disabled'}>Hoje</button>
    </div>
    <div class="tlticks">${D.bms.map(x => `<span${x.n === n ? ' class="on"' : ''}>${String(x.n).padStart(2, '0')}</span>`).join('')}</div>
    <div class="tlinfo">
      <div><span class="eyebrow">BM ${String(n).padStart(2, '0')}</span> <span class="muted">${esc(b.per || '')}</span></div>
      <div>Medido no BM <b class="num">${BRL(pr)}</b></div>
      <div>Acumulado <b class="num">${BRL(ac)}</b> · <b>${PCT(ac / tot)}</b>${z ? ' desta frente' : ' do contrato'}</div>
    </div>
    ${semEst ? `<div class="al medio" style="margin-top:10px"><span class="src">Mapa</span>Localização por estaca das medições do BM ${String(n).padStart(2, '0')}: ${ND()}. As memórias dos BMs 01 a ${String(RECS_MIN - 1).padStart(2, '0')} não trazem estacas; o valor acima vem do boletim.</div>` : ''}
  </section>`;
}
function tlGo(n) {
  S.tl = n && n < BMN + 1 ? n : null;
  if (S.tl === BMN && !S.tlTimer) S.tl = BMN;
  const y = window.scrollY; render(); window.scrollTo(0, y);
}
document.addEventListener('input', e => { if (e.target.id === 'tl_r') { clearTimeout(S.tlT); const v = +e.target.value; S.tlT = setTimeout(() => tlGo(v), 120); } });
document.addEventListener('click', e => {
  if (e.target.closest('[data-tlhoje]')) { clearInterval(S.tlTimer); S.tlTimer = null; tlGo(null); return; }
  if (e.target.closest('[data-tlplay]')) {
    if (S.tlTimer) { clearInterval(S.tlTimer); S.tlTimer = null; tlGo(S.tl); return; }
    let n = S.tl && S.tl < BMN ? S.tl : 0;
    S.tlTimer = setInterval(() => { n++; if (n > BMN) { clearInterval(S.tlTimer); S.tlTimer = null; tlGo(null); return; } tlGo(n); }, 1400);
    tlGo(n || 1);
  }
});
function fichaAvanco(key, m) {
  const av = (S.avanco || []).filter(l => l.frente === key && typeof l.ini === 'number' && m >= l.ini - 2 && m <= (l.fim > l.ini ? l.fim : l.ini) + 2 && tlLanc(l));
  if (!av.length) return '';
  const v = av.reduce((a, l) => a + (typeof avValor === 'function' ? avValor(l) : 0), 0);
  return `<div class="eyebrow" style="margin-top:12px">Avanço lançado pela equipe</div><ul>${av.slice(0, 8).map(l => { const it = itemName(l.item); return `<li><span class="mono" style="color:var(--warn)">${esc(l.item)}</span><span>${esc(l.desc || (it ? short(it.n) : ''))}<span class="muted"> · ${fmtQ(l.qtd)} ${esc(l.und || (it ? it.u : ''))} · ${dBR(l.data)}${l.bm ? ' · BM ' + l.bm : ''}</span></span></li>`; }).join('')}</ul>${v ? `<div class="muted" style="font-size:13px">Valor do avanço neste ponto: <b class="num" style="color:var(--fg)">${BRL(v)}</b></div>` : ''}`;
}

/* =====================================================================
   IMPORTAR BM (administrador) · arraste o boletim em PDF ou Excel
   Cada linha só entra se: o código existe na planilha do contrato e
   quantidade do período × preço unitário bate com o valor do período.
   O resto é listado como não reconhecido / não conferido.
   ===================================================================== */
const IMP = {};
const ITEMS_ALL = () => { const o = {}; D.zones.forEach(z => z.items.forEach(i => { o[i.c] = {it: i, z}; })); return o; };
const numBR = t => { t = String(t).trim(); if (!/^-?[\d.]*\d(,\d+)?$/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) return NaN; if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.')); return parseFloat(t); };
const loadXlsx = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('leitor de Excel não carregou')); document.head.appendChild(s); });
async function lerPdfLinhas(file) {
  await loadPdfJs();
  const pdf = await window.pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const rows = [];
    tc.items.forEach(t => { if (!t.str.trim()) return; const y = t.transform[5], x = t.transform[4]; let r = rows.find(q => Math.abs(q.y - y) < 2.2); if (!r) rows.push(r = {y, it: []}); r.it.push({x, s: t.str.trim()}); });
    rows.sort((a, b) => b.y - a.y).forEach(r => linhas.push(r.it.sort((a, b) => a.x - b.x).map(o => o.s)));
  }
  return linhas;
}
async function lerXlsxLinhas(file) {
  await loadXlsx();
  const wb = window.XLSX.read(await file.arrayBuffer(), {type: 'array'});
  const linhas = [];
  wb.SheetNames.forEach(n => { window.XLSX.utils.sheet_to_json(wb.Sheets[n], {header: 1, raw: true, defval: ''}).forEach(r => linhas.push(r.map(v => v == null ? '' : v))); });
  return linhas;
}
function analisarBM(linhas) {
  const IT = ITEMS_ALL(), ok = {}, naoConf = [], naoRec = [];
  const texto = linhas.map(l => l.join(' ')).join('\n');
  const mBm = texto.match(/N[°ºo]\s*BM:?\s*(\d{1,3})/i), mPer = texto.match(/(\d\d\/\d\d\/\d{4})\s*[ÀAà]\s*(\d\d\/\d\d\/\d{4})/);
  const mTot = texto.match(/Valor Medido no per[ií]odo:?\s*R\$\s*([\d.]+,\d{2})/i);
  linhas.forEach(cells => {
    const toks = cells.flatMap(c => typeof c === 'number' ? [c] : String(c).split(/\s+/)).filter(x => x !== '');
    const code = toks.find(t => typeof t === 'string' && /^\d+(\.\d+){1,4}$/.test(t));
    if (!code) return;
    const nums = toks.slice(toks.indexOf(code) + 1).map(t => typeof t === 'number' ? t : numBR(t.replace(/^R\$/, ''))).filter(v => !isNaN(v));
    if (!IT[code]) { if (nums.length >= 8 && !/^\d+$/.test(code)) naoRec.push(code); return; }
    if (nums.length < 8) return;
    const pu = IT[code].it.pu, q = nums[nums.length - 7], v = nums[nums.length - 3], vac = nums[nums.length - 2];
    const tol = Math.max(0.06, Math.abs(v) * 0.006);
    if (Math.abs(q * pu - v) <= tol) ok[code] = {q, v, vac};
    else if (!ok[code]) naoConf.push({code, q, v, pu});
  });
  return {ok, naoConf: naoConf.filter(x => !ok[x.code]), naoRec: [...new Set(naoRec)], bm: mBm ? +mBm[1] : null, per: mPer ? `${mPer[1]} A ${mPer[2]}` : '', totDoc: mTot ? numBR(mTot[1]) : null};
}
function novoD(r, n, per) {
  const D2 = JSON.parse(JSON.stringify(D));
  const zsum = {};
  D2.zones.forEach(z => {
    z.items.forEach(i => {
      const x = r.ok[i.c]; i.bm = i.bm || []; while (i.bm.length < n) i.bm.push(0);
      i.bm[n - 1] = x ? x.q : 0;
      i.pq = i.bm[n - 1]; i.p = x ? x.v : 0;
      i.aq = Math.round(i.bm.slice(0, n).reduce((a, b) => a + (b || 0), 0) * 1e4) / 1e4;
      i.a = Math.round(i.aq * i.pu * 100) / 100;
    });
    z.per = Math.round(z.items.reduce((a, i) => a + i.p, 0) * 100) / 100;
    z.acum = Math.round(z.items.reduce((a, i) => a + i.a, 0) * 100) / 100;
    z.ant = Math.round((z.acum - z.per) * 100) / 100;
    (z.groups || []).forEach(g => { const its = z.items.filter(i => groupOf(i.c) === g.code || i.c.startsWith(g.code + '.')); g.acum = Math.round(its.reduce((a, i) => a + i.a, 0) * 100) / 100; g.per = Math.round(its.reduce((a, i) => a + i.p, 0) * 100) / 100; });
    zsum[z.code] = z.per;
  });
  const v = Math.round(D2.zones.reduce((a, z) => a + z.per, 0) * 100) / 100;
  const bm = {n, per, v, z: zsum};
  D2.bms = D2.bms.filter(b => b.n !== n).concat([bm]).sort((a, b) => a.n - b.n);
  const acum = Math.round(D2.zones.reduce((a, z) => a + z.acum, 0) * 100) / 100;
  Object.assign(D2.meta, {bm: n, periodo: per.replace(' A ', ' a '), per: v, acum, ant: Math.round((acum - v) * 100) / 100, saldo: Math.round((D2.meta.total - acum) * 100) / 100});
  return D2;
}
function abrirImportBM() {
  openDlg(`<div class="bh"><div><div class="eyebrow">Administrador</div><h3>Importar boletim de medição</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <div id="imp_drop" class="impdrop"><b>Arraste o BM aqui (PDF ou Excel)</b><span class="muted">ou</span><label class="btn ghost sm" style="cursor:pointer">Escolher arquivo<input type="file" id="imp_file" accept=".pdf,.xlsx,.xls,.csv" hidden></label></div>
    <div id="imp_res"></div>`);
}
async function processarImport(file) {
  const box = $('#imp_res'); if (!box) return;
  box.innerHTML = '<p class="muted">Lendo o arquivo…</p>';
  try {
    const linhas = /\.pdf$/i.test(file.name) ? await lerPdfLinhas(file) : await lerXlsxLinhas(file);
    const r = analisarBM(linhas); IMP.r = r; IMP.nome = file.name;
    const n = r.bm || BMN + 1, codes = Object.keys(r.ok);
    const soma = Math.round(codes.reduce((a, c) => a + r.ok[c].v, 0) * 100) / 100;
    const bate = r.totDoc != null && Math.abs(soma - r.totDoc) < 1;
    const IT = ITEMS_ALL(), difAc = codes.filter(c => { const it = IT[c].it, b = it.bm || []; const ant = b.slice(0, n - 1).reduce((x, y) => x + (y || 0), 0); return r.ok[c].vac != null && Math.abs((ant + r.ok[c].q) * it.pu - r.ok[c].vac) > Math.max(1, r.ok[c].vac * 0.005); });
    box.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin:10px 0">
        <div class="kpi"><div class="eyebrow">Itens conferidos</div><div class="v">${codes.length}</div><div class="s">quantidade × preço = valor</div></div>
        <div class="kpi"><div class="eyebrow">Soma do período</div><div class="v">${BRLm(soma)}</div><div class="s">${r.totDoc != null ? `boletim diz ${BRL(r.totDoc)} ${bate ? '✓' : '✗'}` : 'total do boletim: ' + ND()}</div></div>
        <div class="kpi"><div class="eyebrow">Não usados</div><div class="v">${r.naoConf.length + r.naoRec.length}</div><div class="s">${r.naoConf.length} sem conferência · ${r.naoRec.length} fora da planilha</div></div></div>
      <div class="fgrid"><label class="f">Número do BM<input id="imp_bm" type="number" min="1" value="${n}"></label><label class="f">Período<input id="imp_per" value="${esc(r.per)}" placeholder="dd/mm/aaaa A dd/mm/aaaa"></label></div>
      ${r.bm ? '' : `<p class="note">Número do BM no arquivo: ${ND()} — confira o campo acima.</p>`}
      ${D.bms.some(b => b.n === n) ? `<div class="al medio"><span class="src">Atenção</span>O BM ${n} já existe no painel: os valores dele serão substituídos pelos deste arquivo.</div>` : ''}
      ${!bate ? `<div class="al alto"><span class="src">Conferir</span>${r.totDoc != null ? `A soma dos itens conferidos (${BRL(soma)}) não bate com o total do boletim (${BRL(r.totDoc)}). Veja os itens não usados abaixo antes de gravar.` : 'Não encontrei o total do período no arquivo para conferir a soma.'}</div>` : ''}
      ${difAc.length ? `<div class="al medio"><span class="src">Histórico</span>Em ${difAc.length} ite${difAc.length > 1 ? 'ns' : 'm'} o acumulado do boletim não bate com a soma dos BMs anteriores que o painel tem (${difAc.slice(0, 8).map(esc).join(', ')}${difAc.length > 8 ? '…' : ''}). O painel grava a quantidade do período; confira se algum BM anterior foi revisado.</div>` : ''}
      ${r.naoConf.length ? `<details><summary>${r.naoConf.length} itens com quantidade × preço que não bate (não serão gravados)</summary><div class="tbl"><table style="min-width:0"><tr><th>Item</th><th class="r">Qtd. lida</th><th class="r">Preço</th><th class="r">Valor lido</th></tr>${r.naoConf.slice(0, 80).map(x => `<tr><td class="mono">${esc(x.code)}</td><td class="r">${fmtQ(x.q)}</td><td class="r">${BRL(x.pu)}</td><td class="r">${BRL(x.v)}</td></tr>`).join('')}</table></div></details>` : ''}
      ${r.naoRec.length ? `<details><summary>${r.naoRec.length} códigos que não existem na planilha do contrato (ex.: aditivo)</summary><p class="mono" style="font-size:12.5px">${r.naoRec.map(esc).join(' · ')}</p></details>` : ''}
      <p class="note">A localização por estaca deste BM fica ${ND()} até a memória de cálculo ser importada. Nada é preenchido por suposição.</p>
      <div class="ra"><button class="btn" id="imp_go" ${codes.length ? '' : 'disabled'}>Gravar no painel</button><span class="status" id="imp_st"></span></div>`;
  } catch (e) { box.innerHTML = `<div class="al alto"><span class="src">Erro</span>Não consegui ler o arquivo (${esc((e && e.message) || 'erro')}).</div>`; }
}
document.addEventListener('change', e => { if (e.target.id === 'imp_file' && e.target.files[0]) processarImport(e.target.files[0]); });
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('#imp_drop')) e.preventDefault(); });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('#imp_drop'); if (z && e.dataTransfer.files[0]) { e.preventDefault(); processarImport(e.dataTransfer.files[0]); } });
document.addEventListener('click', async e => {
  if (e.target.closest('[data-impbm]')) { abrirImportBM(); return; }
  if (e.target.id !== 'imp_go' || !IMP.r) return;
  const st = $('#imp_st'), n = +$('#imp_bm').value, per = $('#imp_per').value.trim();
  if (!(n > 0)) { st.className = 'status err'; st.textContent = 'Informe o número do BM.'; return; }
  if (!/^\d\d\/\d\d\/\d{4} A \d\d\/\d\d\/\d{4}$/i.test(per)) { st.className = 'status err'; st.textContent = 'Período no formato dd/mm/aaaa A dd/mm/aaaa.'; return; }
  e.target.disabled = true; st.className = 'status'; st.textContent = 'Gravando…';
  try {
    const D2 = novoD(IMP.r, n, per.toUpperCase().replace(' A ', ' A '));
    const pacote = Object.assign({}, window.__DADOS, {D: D2});
    const r = await window.PAINEL_API.salvarDados(pacote, n);
    st.className = 'status ok'; st.textContent = `BM ${n} gravado (${r}). Recarregando…`;
    setTimeout(() => location.reload(), 1500);
  } catch (er) { e.target.disabled = false; st.className = 'status err'; st.textContent = 'Não foi possível gravar (' + ((er && er.message) || 'erro') + ').'; }
});


/* =====================================================================
   TOUR 360° (protótipo) · andar entre os pontos 360° da obra
   Visualizador: Pannellum (MIT). Caminho montado pela equipe:
   em cada ponto, gira-se a vista até o próximo ponto e grava-se a seta.
   Sem caminho gravado não há setas: nada é suposto.
   Coleção 'tour': id = id do ponto 360 · {links:[{to,yaw,pitch}], norte}
   ===================================================================== */
S.tour = {};
const TOUR = {viewer: null, cena: null, sub: null, monta: false, tick: null};
function tourCenas() {
  return (S.p360 || []).filter(p => p.img).map(p => ({id: p.id, img: BLOB + p.img, titulo: p.titulo || '', est: p.est, frente: p.frente}))
    .sort((a, b) => a.frente.localeCompare(b.frente) || a.est - b.est);
}
const tourNome = c => `${Z[c.frente] ? Z[c.frente].name : c.frente} · Est. ${estStr(c.est)}`;
function viewTour() {
  const cs = tourCenas();
  if (!cs.length) return `<section class="card"><div class="card-h"><h2>Tour 360°</h2></div><div class="empty-note">${ND()} Nenhuma foto 360° (formato 2:1) no painel ainda. Envie pela aba Avanço → Pasta de fotos.</div></section>`;
  return `<section class="card">
    <div class="card-h"><h2>Tour 360°</h2><span class="sp muted" style="font-size:13px">Arraste para olhar em volta · clique nas setas para andar</span></div>
    <div class="tourwrap"><div id="pano" class="pano"></div><div id="tourmap" class="tourmap"></div><div id="tourhud" class="tourhud"></div></div>
    <div class="ra" style="margin-top:10px">
      <label class="f" style="display:flex;gap:8px;align-items:center">Ponto<select id="tour_sel">${cs.map(c => `<option value="${esc(c.id)}"${c.id === TOUR.cena ? ' selected' : ''}>${esc(tourNome(c))}${c.titulo ? ' · ' + esc(c.titulo) : ''}</option>`).join('')}</select></label>
      ${canWrite() ? `<button class="chip" type="button" data-tmonta aria-pressed="${TOUR.monta}">${TOUR.monta ? 'Fechar montagem' : 'Montar caminho'}</button>` : ''}
      <span class="status" id="tour_st"></span>
    </div>
    <div id="tour_monta"${TOUR.monta ? '' : ' hidden'}></div>
  </section>`;
}
const carregarArq = (src, css) => new Promise((ok, no) => {
  if (css) { if (document.querySelector(`link[href="${src}"]`)) return ok(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = src; l.onload = ok; l.onerror = no; document.head.appendChild(l); return; }
  if (document.querySelector(`script[src="${src}"]`)) return window.pannellum ? ok() : setTimeout(ok, 300);
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('não carregou ' + src)); document.head.appendChild(s);
});
async function tourInit() {
  if (S.tab !== 'tour' || !$('#pano')) return;
  try { await carregarArq('pannellum.css', true); await carregarArq('pannellum.js'); } catch (e) { $('#pano').innerHTML = `<div class="empty-note">Não foi possível carregar o visualizador 360°.</div>`; return; }
  if (!TOUR.sub && S.db) TOUR.sub = S.db.collection('tour').onSnapshot(snap => { S.tour = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); if (S.tab === 'tour') tourMontar(true); }, () => {});
  tourMontar(false);
}
function tourMontar(manter) {
  const cs = tourCenas(); if (!cs.length || !$('#pano')) return;
  let yaw = 0, pitch = -10, hfov = 100;
  if (manter && TOUR.viewer) { try { yaw = TOUR.viewer.getYaw(); pitch = TOUR.viewer.getPitch(); hfov = TOUR.viewer.getHfov(); } catch (e) {} }
  if (TOUR.viewer) { try { TOUR.viewer.destroy(); } catch (e) {} TOUR.viewer = null; }
  if (!TOUR.cena || !cs.some(c => c.id === TOUR.cena)) TOUR.cena = cs[0].id;
  const scenes = {};
  cs.forEach(c => {
    const t = S.tour[c.id] || {};
    scenes[c.id] = {
      type: 'equirectangular', panorama: c.img, title: tourNome(c), pitch: -10, hfov: 100,
      hotSpots: (t.links || []).filter(l => cs.some(x => x.id === l.to)).map(l => {
        const alvo = cs.find(x => x.id === l.to);
        return {pitch: l.pitch, yaw: l.yaw, type: 'custom', cssClass: 'tour-seta', createTooltipFunc: (div) => { div.innerHTML = `<span class="ts-ar">➜</span><span class="ts-lb">Est. ${esc(estStr(alvo.est))}</span>`; }, clickHandlerFunc: () => tourAndar(c.id, l)};
      })
    };
    if (typeof t.norte === 'number') { scenes[c.id].northOffset = t.norte; }
  });
  TOUR.viewer = window.pannellum.viewer('pano', {default: {firstScene: TOUR.cena, sceneFadeDuration: 900, autoLoad: true, showFullscreenCtrl: true, compass: !!(S.tour[TOUR.cena] && typeof S.tour[TOUR.cena].norte === 'number'), yaw, pitch, hfov}, scenes, strings: {loadingLabel: 'Carregando…'}});
  TOUR.viewer.on('scenechange', id => { TOUR.cena = id; const s = $('#tour_sel'); if (s) s.value = id; tourHud(); tourMapa(); if (TOUR.monta) tourPainel(); });
  TOUR.viewer.on('load', () => { tourHud(); tourMapa(); });
  clearInterval(TOUR.tick); TOUR.tick = setInterval(() => { if (S.tab !== 'tour' || !$('#tourmap')) { clearInterval(TOUR.tick); return; } tourMapa(); }, 400);
  tourHud(); tourMapa(); if (TOUR.monta) tourPainel();
}
function tourAndar(de, l) {
  const v = TOUR.viewer; if (!v) return;
  const a = S.tour[de] || {}, b = S.tour[l.to] || {};
  // mantém o rumo de quem anda se os dois pontos tiverem o Norte marcado; senão usa a vista padrão do ponto
  let yaw = 'same';
  if (typeof a.norte === 'number' && typeof b.norte === 'number') yaw = ((l.yaw + a.norte - b.norte + 540) % 360) - 180;
  v.lookAt(l.pitch, l.yaw, 45, 700, () => { v.loadScene(l.to, -10, yaw === 'same' ? 'same' : yaw, 100); });
}
function tourHud() {
  const h = $('#tourhud'), cs = tourCenas(), c = cs.find(x => x.id === TOUR.cena); if (!h || !c) return;
  const t = S.tour[c.id] || {}, n = (t.links || []).length;
  h.innerHTML = `<b>${esc(tourNome(c))}</b>${c.titulo ? `<span>${esc(c.titulo)}</span>` : ''}${n ? `<span>${n} caminho${n > 1 ? 's' : ''} a partir daqui</span>` : `<span>Caminho a partir deste ponto: ${ND()}</span>`}`;
}
function tourMapa() {
  const el = $('#tourmap'), cs = tourCenas(), c = cs.find(x => x.id === TOUR.cena); if (!el || !c) return;
  const g = D.geos[c.frente]; if (!g) { el.innerHTML = `<div class="muted" style="padding:10px;font-size:12px">Traçado: ${ND()}</div>`; return; }
  const segs = []; let cur = [];
  g.cl.forEach((p, i) => { if (i && Math.abs(p[0] - g.cl[i - 1][0]) > 6) { segs.push(cur); cur = []; } cur.push(p); }); segs.push(cur);
  const pos = est => { const p = g.cl[idxAt(c.frente, est)]; return [p[1], p[2]]; };
  const [vx, vy, vw, vh] = g.vb, k = Math.max(vw, vh) / 160;
  let s = segs.map(sg => `<polyline points="${sg.map(p => p[1] + ',' + p[2]).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="${2.2 * k}" stroke-linecap="round" opacity=".55"/>`).join('');
  cs.filter(x => x.frente === c.frente).forEach(x => {
    const [px, py] = pos(x.est), on = x.id === c.id;
    (S.tour[x.id] && S.tour[x.id].links || []).forEach(l => { const y = cs.find(z => z.id === l.to); if (y && y.frente === c.frente) { const [qx, qy] = pos(y.est); s += `<line x1="${px}" y1="${py}" x2="${qx}" y2="${qy}" stroke="#fff" stroke-width="${1.2 * k}" stroke-dasharray="${3 * k} ${2 * k}" opacity=".7"/>`; } });
    if (on && S.tour[x.id] && typeof S.tour[x.id].norte === 'number' && TOUR.viewer && g.northVec) {
      let yaw = 0; try { yaw = TOUR.viewer.getYaw(); } catch (e) {}
      const head = (yaw + S.tour[x.id].norte) * Math.PI / 180, na = Math.atan2(g.northVec[1], g.northVec[0]);
      const ang = na + head, r = 18 * k, w = 0.45;
      s += `<path d="M${px},${py} L${px + r * Math.cos(ang - w)},${py + r * Math.sin(ang - w)} A${r},${r} 0 0 1 ${px + r * Math.cos(ang + w)},${py + r * Math.sin(ang + w)} Z" fill="var(--warn)" opacity=".55"/>`;
    }
    s += `<circle cx="${px}" cy="${py}" r="${(on ? 5 : 3.6) * k}" fill="${on ? 'var(--warn)' : '#fff'}" stroke="#04221c" stroke-width="${k}" data-tgo="${esc(x.id)}" style="cursor:pointer"><title>${esc(tourNome(x))}</title></circle>`;
  });
  el.innerHTML = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">${s}</svg>`;
}
function tourPainel() {
  const box = $('#tour_monta'), cs = tourCenas(), c = cs.find(x => x.id === TOUR.cena); if (!box || !c) return;
  const t = S.tour[c.id] || {}, outros = cs.filter(x => x.id !== c.id);
  box.hidden = false;
  box.innerHTML = `<div class="tmonta">
    <div><span class="istep">1</span><b>Norte deste ponto</b> <span class="muted">(opcional; liga a bússola e o cone no mapa)</span><br>
      Gire a vista até o Norte e clique: <button class="chip" type="button" data-tnorte>Aqui é o Norte</button> ${typeof t.norte === 'number' ? '<span class="tag s-fechada">marcado</span>' : ND()}</div>
    <div><span class="istep">2</span><b>Ligar a outro ponto</b><br>
      Gire a vista até onde fica o outro ponto (o centro da tela vira a seta), escolha o ponto e clique:
      <select id="tl_to">${outros.map(x => `<option value="${esc(x.id)}">${esc(tourNome(x))}</option>`).join('')}</select>
      <button class="chip" type="button" data-tlink>A seta vai aqui</button></div>
    ${(t.links || []).length ? `<div><b>Setas deste ponto</b><ul style="margin:6px 0 0;padding-left:18px">${t.links.map((l, i) => { const y = cs.find(z => z.id === l.to); return `<li>${esc(y ? tourNome(y) : l.to)} <button class="del" type="button" data-tunlink="${i}">remover</button></li>`; }).join('')}</ul></div>` : ''}
    <p class="note" style="margin:0">Faça o mesmo no outro ponto para a volta. Se os dois pontos tiverem o Norte marcado, ao andar a vista continua virada para o mesmo lado.</p>
  </div>`;
}
async function tourGravar(id, patch, msg) {
  const st = $('#tour_st');
  try {
    const cur = Object.assign({links: []}, S.tour[id] || {}, patch);
    await S.db.doc('tour/' + id).set(cur);
    S.tour[id] = cur; st.className = 'status ok'; st.textContent = msg; tourMontar(true);
  } catch (e) { st.className = 'status err'; st.textContent = 'Não foi possível salvar (' + ((e && (e.code || e.message)) || 'erro') + ').'; }
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-tmonta]')) { TOUR.monta = !TOUR.monta; const b = e.target.closest('[data-tmonta]'); b.textContent = TOUR.monta ? 'Fechar montagem' : 'Montar caminho'; b.setAttribute('aria-pressed', TOUR.monta); if (TOUR.monta) tourPainel(); else $('#tour_monta').hidden = true; return; }
  const g = e.target.closest('[data-tgo]'); if (g && TOUR.viewer) { TOUR.viewer.loadScene(g.dataset.tgo); return; }
  if (!TOUR.viewer || !TOUR.cena) return;
  if (e.target.closest('[data-tnorte]')) { tourGravar(TOUR.cena, {norte: Math.round(-TOUR.viewer.getYaw() * 10) / 10}, 'Norte marcado.'); return; }
  if (e.target.closest('[data-tlink]')) {
    const to = $('#tl_to').value; if (!to) return;
    const links = ((S.tour[TOUR.cena] || {}).links || []).filter(l => l.to !== to).concat([{to, yaw: Math.round(TOUR.viewer.getYaw() * 10) / 10, pitch: Math.round(TOUR.viewer.getPitch() * 10) / 10}]);
    tourGravar(TOUR.cena, {links}, 'Seta gravada.'); return;
  }
  const u = e.target.closest('[data-tunlink]'); if (u) { const links = ((S.tour[TOUR.cena] || {}).links || []).filter((l, i) => i !== +u.dataset.tunlink); tourGravar(TOUR.cena, {links}, 'Seta removida.'); }
});
document.addEventListener('change', e => { if (e.target.id === 'tour_sel' && TOUR.viewer) TOUR.viewer.loadScene(e.target.value); });

/* =====================================================================
   ADITIVO 01 · 1º Termo Aditivo com 1º Reflexo Financeiro
   Dados em D.aditivos.ad01, tirados da planilha do aditivo e do BM do
   aditivo (quantidade, preço, BM 01, BM 02). Nada é suposto: o que não
   está nos documentos aparece como DADO NÃO DISPONÍVEL.
   ===================================================================== */
const ADV = (D.aditivos && D.aditivos.ad01) || null;
const frNome = k => Z[k] ? Z[k].name : k === 'ad01x' ? 'Itens extras (Aditivo 01)' : k;
const adItens = zk => ADV ? ADV.itens.filter(i => i.z === zk) : [];
const adZonasKeys = () => ADV ? [...new Set(ADV.itens.map(i => i.z))] : [];
function adRows(its, pref) {
  const gs = []; its.forEach(i => { const k = i.zona + '|' + i.g; if (!gs.some(g => g.k === k)) gs.push({k, g: i.g, gn: i.z === 'ad01x' ? 'Itens novos' : i.gn, zona: i.zona}); });
  return gs.map(g => {
    const li = its.filter(i => i.zona === g.zona && i.g === g.g);
    const t = li.reduce((s, i) => s + i.t, 0), a = li.reduce((s, i) => s + i.a, 0), p = li.reduce((s, i) => s + i.p, 0), id = pref + g.k;
    return `<tr class="grp" data-g="${esc(id)}"><td>${esc(g.g)}</td><td colspan="5">${esc(title(g.gn))}</td><td class="r">${t ? PCT(a / t) : ''}</td><td class="r num">${BRL(t - a)}</td></tr>` +
      li.map(i => `<tr data-in="${esc(id)}" hidden><td class="mono">${esc(i.c)}${i.novo ? ' <span class="tag">novo</span>' : ''}</td><td class="desc">${esc(short(i.n))}</td><td>${esc(i.u)}</td><td class="r">${NUM(i.q)}</td><td class="r">${NUM(i.aq)}</td><td class="r">${i.pq ? NUM(i.pq) : '—'}</td><td class="r">${PCT(i.q ? Math.min(i.aq / i.q, 9.99) : 0, 0)}</td><td class="r num">${BRL(i.t - i.a)}</td></tr>`).join('');
  }).join('');
}
const adHead = () => `<thead><tr><th>Item</th><th>Serviço</th><th>Und</th><th class="r">Aditivo</th><th class="r">Acumulado</th><th class="r">BM ${String(ADV.bm).padStart(2, '0')}</th><th class="r">Físico</th><th class="r">Saldo R$</th></tr></thead>`;
function aditivoCard() {
  if (!ADV) return '';
  const R = ADV.resumo, bmS = String(ADV.bm).padStart(2, '0');
  return `<section class="card" id="adCard">
    <div class="card-h"><h2>${esc(ADV.nome)} · ${esc(ADV.titulo)}</h2><span class="sp muted" style="font-size:13px">BM ${bmS} do aditivo · ${esc(ADV.periodo)}</span></div>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="eyebrow">Valor do aditivo</div><div class="v">${BRLm(ADV.total)}</div><div class="s">itens novos ${BRLm(R.novos)} · acréscimos ${BRLm(R.acresc)}</div></div>
      <div class="kpi"><div class="eyebrow">Medido acumulado</div><div class="v">${PCT(ADV.acum / ADV.total)}</div><div class="s num">${BRLm(ADV.acum)} até o BM ${bmS}</div>${meter(ADV.acum, ADV.per, ADV.total)}</div>
      <div class="kpi"><div class="eyebrow">Medido no BM ${bmS}</div><div class="v">${BRLm(ADV.per)}</div><div class="s">${PCT(ADV.per / ADV.total)} do aditivo</div></div>
      <div class="kpi"><div class="eyebrow">Saldo do aditivo</div><div class="v">${BRLm(ADV.saldo)}</div><div class="s">${PCT(ADV.saldo / ADV.total)} a executar</div></div>
    </div>
    <div class="fronts">${ADV.zonas.map(z => `<div class="front" style="cursor:default"><div><div class="n">${esc(frNome(z.z))}</div><div class="d">${esc(title(z.nome))}</div></div><div class="pc">${PCT(z.a / z.t)}</div><div class="d num">${BRLm(z.a)} de ${BRLm(z.t)}${z.per ? ` · BM ${bmS}: ${BRL(z.per)}` : ''}</div>${meter(z.a, z.per, z.t)}</div>`).join('')}</div>
    <details style="margin-top:12px"><summary>Itens do aditivo (${ADV.itens.length}) · clique no grupo para abrir</summary>
      <div class="tbl" style="margin-top:8px"><table>${adHead()}<tbody>${adRows(ADV.itens, 'adg:')}</tbody></table></div></details>
    <details style="margin-top:8px"><summary>Resumo do termo aditivo</summary>
      <div class="mlist" style="margin-top:8px">
        <div class="mrow"><div>Valor do contrato atualizado (reajustado)</div><div class="r num">${BRL(R.reajustado)}</div></div>
        <div class="mrow"><div>Acréscimo de itens novos</div><div class="r num">${BRL(R.novos)}</div></div>
        <div class="mrow"><div>Acréscimo de quantidades</div><div class="r num">${BRL(R.acresc)}</div></div>
        <div class="mrow"><div>Redução de quantidades (exclusão)</div><div class="r num">${BRL(R.exclusao)}</div></div>
        <div class="mrow"><div><b>1º reflexo financeiro</b> (${PCT(R.pctReflexo, 2)})</div><div class="r num"><b>${BRL(R.reflexo)}</b></div></div>
        <div class="mrow"><div><b>Novo valor contratual</b></div><div class="r num"><b>${BRL(R.novoValor)}</b></div></div>
        ${ADV.bms.map(b => `<div class="mrow"><div>BM ${String(b.n).padStart(2, '0')} do aditivo · período ${b.periodo ? esc(b.periodo) : ND()}</div><div class="r num">${BRL(b.v)}</div></div>`).join('')}
      </div>
      ${(ADV.obs || []).map(o => `<p class="note">${esc(o)}</p>`).join('')}
    </details>
    <p class="note">Preços reajustados, data-base ${esc(R.dataBase)}. Os números do contrato original (acima) não incluem o aditivo. Fonte: ${esc(ADV.fonte)}.</p>
  </section>`;
}
function adFrontCard(key) {
  const its = adItens(key); if (!its.length) return '';
  const t = its.reduce((s, i) => s + i.t, 0), a = its.reduce((s, i) => s + i.a, 0), p = its.reduce((s, i) => s + i.p, 0);
  return `<section class="card">
    <div class="card-h"><h2>Itens do ${esc(ADV.nome)}</h2><span class="sp muted" style="font-size:13px">${its.length} itens · ${PCT(a / t)} medido · ${BRL(a)} de ${BRL(t)}${p ? ` · BM ${String(ADV.bm).padStart(2, '0')}: ${BRL(p)}` : ''}</span></div>
    <div class="tbl"><table>${adHead()}<tbody>${adRows(its, 'adf:')}</tbody></table></div>
    <p class="note">Planilha do aditivo, a preços reajustados (data-base ${esc(ADV.resumo.dataBase)}). Não entra no "Avanço por serviço" acima, que é do contrato original.</p>
  </section>`;
}

/* =====================================================================
   EXPORTAR AVANÇO · Excel (.xlsx) e PDF (impressão do navegador)
   Exporta exatamente o que está filtrado na lista "Avanços lançados".
   ===================================================================== */
const codNat = (a, b) => { const x = String(a).split(/[.\s]/), y = String(b).split(/[.\s]/); for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = parseFloat(x[i]), q = parseFloat(y[i]); if (isNaN(p) || isNaN(q)) { const c = String(x[i] || '').localeCompare(String(y[i] || '')); if (c) return c; } else if (p !== q) return p - q; } return 0; };
const LADO_TXT = {AMB: 'Ambos os bordos', LE: 'Bordo esquerdo', LD: 'Bordo direito'};
function avExpDados() {
  const sel = avFiltrar(S.avanco, AV.fPlan, AV.fBm).slice().sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || String(a.pacote || '').localeCompare(String(b.pacote || '')) || (b.principal ? 1 : 0) - (a.principal ? 1 : 0));
  const linhas = sel.map(l => {
    const it = itemName(l.item);
    return {data: l.data || '', frente: frNome(l.frente), planilha: PLAN_CURTO[l.planilha || 'original'] || l.planilha, bm: l.bm || '', periodo: l.perIni ? dBR(l.perIni) + (l.perFim ? ' a ' + dBR(l.perFim) : '') : '',
      est: l.ini != null ? 'Est. ' + estStr(l.ini) + (l.fim > l.ini ? ' a ' + estStr(l.fim) : '') : '', bordo: LADO_TXT[l.lado] || '', item: l.item, desc: l.desc || (it ? it.n : ''), und: l.und || (it ? it.u : ''),
      qtd: +l.qtd || 0, pu: +l.pu || (it ? it.pu : 0), valor: avValor(l), tipo: l.principal ? 'principal' : 'ligado', calculo: l.calculo && l.calculo !== 'informado' ? l.calculo : '', autor: S.names[l.autor] || '', obs: l.obs || '', pacote: l.pacote || l.id};
  });
  const res = {};
  linhas.forEach(r => { const k = r.planilha + '|' + r.frente + '|' + r.item + '|' + r.pu; const o = res[k] = res[k] || {planilha: r.planilha, frente: r.frente, item: r.item, desc: r.desc, und: r.und, pu: r.pu, qtd: 0, valor: 0, n: 0}; o.qtd += r.qtd; o.valor += r.valor; o.n++; });
  const resumo = Object.values(res).sort((a, b) => a.planilha.localeCompare(b.planilha) || a.frente.localeCompare(b.frente) || codNat(a.item, b.item));
  const filtro = `${AV.fPlan === 'todas' ? 'Todas as planilhas' : PLAN[AV.fPlan]} · ${AV.fBm === 'todos' ? 'todos os BMs' : 'BM ' + String(AV.fBm).padStart(2, '0')}`;
  return {linhas, resumo, filtro, total: linhas.reduce((s, r) => s + r.valor, 0), nLanc: new Set(linhas.map(r => r.pacote)).size};
}
const avExpNome = ext => `avanco_${AV.fBm === 'todos' ? 'todos-BMs' : 'BM' + String(AV.fBm).padStart(2, '0')}_${AV.fPlan}_${todayISO()}.${ext}`;
async function avExportXlsx(btn) {
  const x = avExpDados(); if (!x.linhas.length) { btn.textContent = 'Nada para exportar'; setTimeout(() => { btn.textContent = 'Exportar Excel'; }, 2000); return; }
  btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    await loadXlsx();
    const X = window.XLSX, M = D.meta, quem = S.names[S.myId] || '', agora = new Date().toLocaleString('pt-BR');
    const cab = [[`Contrato ${M.contrato} · ${M.contratada}`], [M.objeto], [`Avanço lançado · ${x.filtro}`], [`Gerado em ${agora}${quem ? ' por ' + quem : ''} · Painel Ramal da Arena`], []];
    const r1 = cab.concat([['Planilha', 'Frente', 'Item', 'Descrição', 'Und', 'Quantidade', 'Preço unit. (R$)', 'Valor (R$)', 'Nº de lançamentos']]);
    let fr = null, sub = 0; const subs = [];
    x.resumo.forEach((r, i) => {
      if (fr !== null && fr !== r.planilha + '|' + r.frente) { r1.push(['', '', '', 'Subtotal ' + fr.split('|')[1], '', '', '', sub, '']); subs.push(r1.length - 1); sub = 0; }
      fr = r.planilha + '|' + r.frente; sub += r.valor;
      r1.push([r.planilha, r.frente, r.item, r.desc, r.und, n2(r.qtd), r.pu, n2(r.valor), r.n]);
    });
    if (fr !== null) { r1.push(['', '', '', 'Subtotal ' + fr.split('|')[1], '', '', '', n2(sub), '']); subs.push(r1.length - 1); }
    r1.push([]); r1.push(['', '', '', 'TOTAL', '', '', '', n2(x.total), x.nLanc]);
    const s1 = X.utils.aoa_to_sheet(r1);
    s1['!cols'] = [{wch: 12}, {wch: 24}, {wch: 10}, {wch: 70}, {wch: 7}, {wch: 13}, {wch: 15}, {wch: 16}, {wch: 10}];
    const fmt = (ws, cols, z) => { const rg = X.utils.decode_range(ws['!ref']); for (let R = 0; R <= rg.e.r; R++) cols.forEach(C => { const c = ws[X.utils.encode_cell({r: R, c: C})]; if (c && c.t === 'n') c.z = z; }); };
    fmt(s1, [5], '#,##0.00'); fmt(s1, [6, 7], '"R$" #,##0.00');
    const r2 = cab.concat([['Data', 'Frente', 'Planilha', 'BM', 'Período', 'Trecho', 'Bordo', 'Item', 'Descrição', 'Und', 'Quantidade', 'Preço unit. (R$)', 'Valor (R$)', 'Tipo', 'Cálculo / medida', 'Lançado por', 'Observação']]);
    x.linhas.forEach(r => r2.push([r.data ? dBR(r.data) : '', r.frente, r.planilha, r.bm, r.periodo, r.est, r.bordo, r.item, r.desc, r.und, n2(r.qtd), r.pu, n2(r.valor), r.tipo, r.calculo, r.autor, r.obs]));
    r2.push([]); r2.push(['', '', '', '', '', '', '', '', 'TOTAL', '', '', '', n2(x.total)]);
    const s2 = X.utils.aoa_to_sheet(r2);
    s2['!cols'] = [{wch: 11}, {wch: 22}, {wch: 11}, {wch: 5}, {wch: 23}, {wch: 18}, {wch: 15}, {wch: 10}, {wch: 60}, {wch: 7}, {wch: 12}, {wch: 14}, {wch: 15}, {wch: 10}, {wch: 50}, {wch: 18}, {wch: 40}];
    fmt(s2, [10], '#,##0.00'); fmt(s2, [11, 12], '"R$" #,##0.00');
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, s1, 'Resumo por item'); X.utils.book_append_sheet(wb, s2, 'Lançamentos');
    X.writeFile(wb, avExpNome('xlsx'));
    btn.textContent = 'Exportar Excel';
  } catch (e) { btn.textContent = 'Erro ao gerar'; setTimeout(() => { btn.textContent = 'Exportar Excel'; }, 2500); }
  btn.disabled = false;
}
function avExportPdf(btn) {
  const x = avExpDados(); if (!x.linhas.length) { btn.textContent = 'Nada para exportar'; setTimeout(() => { btn.textContent = 'Exportar PDF'; }, 2000); return; }
  const w = window.open('', '_blank'); if (!w) { btn.textContent = 'Libere pop-ups'; setTimeout(() => { btn.textContent = 'Exportar PDF'; }, 2500); return; }
  const M = D.meta, quem = S.names[S.myId] || '', agora = new Date().toLocaleString('pt-BR'), e = esc;
  const brl = v => BRL(v), q = v => (v || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  let res = '', fr = null, sub = 0;
  const fecha = () => { if (fr !== null) res += `<tr class="sub"><td colspan="6">Subtotal · ${e(fr.split('|')[1])} (${e(fr.split('|')[0])})</td><td class="r">${brl(sub)}</td></tr>`; };
  x.resumo.forEach(r => { const k = r.planilha + '|' + r.frente; if (k !== fr) { fecha(); fr = k; sub = 0; res += `<tr class="grp"><td colspan="7">${e(r.frente)} · ${e(r.planilha)}</td></tr>`; } sub += r.valor; res += `<tr><td class="m">${e(r.item)}</td><td>${e(r.desc)}</td><td>${e(r.und)}</td><td class="r">${q(r.qtd)}</td><td class="r">${brl(r.pu)}</td><td class="r">${r.n}</td><td class="r">${brl(r.valor)}</td></tr>`; });
  fecha();
  const det = x.linhas.map(r => `<tr><td>${r.data ? e(dBR(r.data)) : ''}</td><td>${e(r.frente)}<div class="s">${e([r.est, r.bordo].filter(Boolean).join(' · '))}</div></td><td class="m">${e(r.item)}</td><td>${e(r.desc)}${r.calculo ? `<div class="s">${e(r.calculo)}</div>` : ''}${r.obs ? `<div class="s">Obs.: ${e(r.obs)}</div>` : ''}</td><td>${e(r.und)}</td><td class="r">${q(r.qtd)}</td><td class="r">${brl(r.pu)}</td><td class="r">${brl(r.valor)}</td><td>${e(r.autor)}</td></tr>`).join('');
  const logo = new URL('logo.png', location.href).href;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${e(avExpNome('pdf').replace('.pdf', ''))}</title>
  <style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:11px/1.35 Arial,Helvetica,sans-serif;color:#111;margin:0}
  .top{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0a6b5a;padding-bottom:8px;margin-bottom:10px}.top img{height:30px;background:#0a4743;padding:4px 8px;border-radius:4px}
  h1{font-size:16px;margin:0}h2{font-size:13px;margin:16px 0 6px;color:#0a4743}.meta{color:#444;font-size:10.5px}
  .k{display:flex;gap:10px;margin:8px 0}.k div{border:1px solid #ccc;border-radius:4px;padding:6px 10px}.k b{display:block;font-size:14px}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 5px;vertical-align:top}th{background:#e8f1ef;text-align:left;font-size:10px}
  .r{text-align:right;white-space:nowrap}.m{font-family:monospace;white-space:nowrap}.s{color:#555;font-size:9.5px}
  tr.grp td{background:#f3f6f5;font-weight:bold}tr.sub td{font-weight:bold;text-align:right;background:#fafafa}tr.tot td{font-weight:bold;font-size:12px;background:#e8f1ef}
  thead{display:table-header-group}tr{page-break-inside:avoid}.ass{margin-top:40px;display:flex;gap:60px}.ass div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center}
  .bar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:6px}@media print{.bar{display:none}}</style></head><body>
  <div class="bar"><button onclick="print()" style="font-size:14px;padding:8px 16px">Salvar como PDF / Imprimir</button> <span class="meta">Na janela de impressão, escolha "Salvar como PDF".</span></div>
  <div class="top"><img src="${e(logo)}" alt=""><div><h1>Relatório de avanço · ${e(x.filtro)}</h1><div class="meta">Contrato ${e(M.contrato)} · ${e(M.contratada)} · ${e(M.local || '')}</div><div class="meta">${e(M.objeto)}</div></div></div>
  <div class="k"><div>Valor total<b>${brl(x.total)}</b></div><div>Lançamentos<b>${x.nLanc}</b></div><div>Serviços (linhas)<b>${x.linhas.length}</b></div><div>Gerado em<b style="font-size:11px">${e(agora)}${quem ? ' · ' + e(quem) : ''}</b></div></div>
  <h2>Resumo por item</h2>
  <table><thead><tr><th>Item</th><th>Descrição</th><th>Und</th><th class="r">Quantidade</th><th class="r">Preço unit.</th><th class="r">Lanç.</th><th class="r">Valor</th></tr></thead><tbody>${res}<tr class="tot"><td colspan="6" class="r">TOTAL</td><td class="r">${brl(x.total)}</td></tr></tbody></table>
  <h2>Lançamentos</h2>
  <table><thead><tr><th>Data</th><th>Frente / trecho</th><th>Item</th><th>Serviço · cálculo</th><th>Und</th><th class="r">Quantidade</th><th class="r">Preço unit.</th><th class="r">Valor</th><th>Lançado por</th></tr></thead><tbody>${det}<tr class="tot"><td colspan="7" class="r">TOTAL</td><td class="r">${brl(x.total)}</td><td></td></tr></tbody></table>
  <div class="ass"><div>Fiscalização / Supervisão</div><div>Contratada</div></div>
  <script>window.onload=function(){setTimeout(function(){print()},400)}<\/script></body></html>`);
  w.document.close();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-avexp]'); if (!b) return;
  if (b.dataset.avexp === 'xlsx') avExportXlsx(b); else avExportPdf(b);
});

/* ---------- responsável (pessoa da equipe) de cada pendência ---------- */
S.equipe = [];
async function loadEquipe() {
  try { if (window.PAINEL_API && window.PAINEL_API.equipe) { S.equipe = await window.PAINEL_API.equipe(); S.equipe.forEach(p => { if (p.nome || p.email) S.names[p.id] = p.nome || p.email; }); } } catch (e) {}
  if (!S.equipe.length && S.myId) S.equipe = [{id: S.myId, nome: nm(S.myId) || 'Eu'}];
}
const respNome = r => r.respId ? (nm(r.respId) || ((S.equipe.find(p => p.id === r.respId) || {}).nome) || 'sem nome') : '';
const equipeOpts = sel => S.equipe.map(p => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.nome || p.email || 'sem nome')}</option>`).join('');
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rresp]'); if (!b) return;
  const r = S.rnc.find(x => x.id === b.dataset.rresp); if (!r || !canWrite()) return;
  openDlg(`<div class="bh"><div><div class="eyebrow">${esc(r.num || 'Pendência')}</div><h3>Responsável pela pendência</h3></div><button class="x" data-dlgx aria-label="Fechar">✕</button></div>
    <form class="form" id="fResp"><label class="f">Pessoa da equipe<select id="rr_id"><option value="">Escolha…</option>${equipeOpts(r.respId || '')}</select></label>
    <div class="ra"><button class="btn" type="submit">Salvar</button><button class="btn ghost" type="button" data-dlgx>Cancelar</button><span class="status" id="rr_st"></span></div></form>`);
  $('#fResp').onsubmit = async ev => {
    ev.preventDefault(); const id = $('#rr_id').value, st = $('#rr_st');
    if (!id) { st.className = 'status err'; st.textContent = 'Escolha uma pessoa.'; return; }
    try { await S.db.doc('rnc/' + r.id).update({respId: id}); closeDlg(); } catch (er) { st.className = 'status err'; st.textContent = 'Não foi possível salvar.'; }
  };
});

/* =====================================================================
   DIÁRIO · atividades do dia por empresa (o que cada empresa fez no dia)
   Coleção 'diario': {data, empresa, frente, ini, fim, ativ, efetivo, equip,
   climaM, climaT, ocorr, fotos[], autor, criado}
   ===================================================================== */
S.diario = []; S.diarioSub = null;
const CLIMA = ['Bom', 'Nublado', 'Chuvoso', 'Chuva forte (impraticável)'];
const DIA = {de: '', ate: '', frente: '', emp: '', q: ''};
(() => { const d = new Date(Date.now() - 6 * 864e5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); DIA.de = d.toISOString().slice(0, 10); })();
function diarioSub() {
  if (S.diarioSub || !S.db) return;
  S.diarioSub = S.db.collection('diario').onSnapshot(async snap => { S.diario = snap.docs.map(d => Object.assign({id: d.id}, d.data())).filter(x => x.data && x.ativ); await resolveNames(); if (S.tab === 'diario') diarioRefresh(); }, () => {});
}
const empresas = () => [...new Set([D.meta.contratada, 'Entel (supervisão)'].concat(S.diario.map(x => x.empresa)).filter(Boolean))];
function diarioFiltrar() {
  const q = DIA.q.trim().toLowerCase();
  return S.diario.filter(x => (!DIA.de || x.data >= DIA.de) && (!DIA.ate || x.data <= DIA.ate) && (!DIA.frente || x.frente === DIA.frente) && (!DIA.emp || x.empresa === DIA.emp) &&
    (!q || q.split(/\s+/).every(w => [x.ativ, x.ocorr, x.equip, x.empresa, frontName(x.frente), nm(x.autor)].join(' ').toLowerCase().includes(w))))
    .sort((a, b) => b.data.localeCompare(a.data) || String(a.empresa).localeCompare(String(b.empresa)) || String(a.criado).localeCompare(String(b.criado)));
}
function diarioListaHtml() {
  const l = diarioFiltrar();
  if (!S.diario.length) return '<div class="empty-note">Nenhuma atividade registrada ainda.</div>';
  if (!l.length) return '<div class="empty-note">Nenhum registro com esses filtros.</div>';
  const dias = [...new Set(l.map(x => x.data))];
  return `<div class="muted" style="font-size:13px;margin-bottom:8px"><b style="color:var(--fg)">${l.length}</b> registro${l.length > 1 ? 's' : ''} em ${dias.length} dia${dias.length > 1 ? 's' : ''}</div>` + dias.map(d => `<div class="dia">
    <h3 class="dia-h">${esc(wd(d))}, ${esc(dBR(d))}</h3>
    ${l.filter(x => x.data === d).map(x => {
      const pode = S.canEdit || (S.myId && x.autor === S.myId);
      const cl = [x.climaM ? 'manhã: ' + x.climaM : '', x.climaT ? 'tarde: ' + x.climaT : ''].filter(Boolean).join(' · ');
      return `<article class="dreg">
        <div class="rh"><b>${esc(x.empresa || '—')}</b><span class="tag">${esc(frontName(x.frente))}${x.ini != null ? ' · Est. ' + esc(estStr(x.ini)) + (x.fim > x.ini ? ' a ' + esc(estStr(x.fim)) : '') : ''}</span>${x.efetivo ? `<span class="tag">${x.efetivo} pessoa${x.efetivo > 1 ? 's' : ''}</span>` : ''}${cl ? `<span class="tag">${esc(cl)}</span>` : ''}</div>
        <p style="white-space:pre-line;margin:6px 0">${esc(x.ativ)}</p>
        ${x.equip ? `<div class="muted" style="font-size:13px">Equipamentos: ${esc(x.equip)}</div>` : ''}
        ${x.ocorr ? `<div style="font-size:13px;margin-top:4px"><b>Ocorrências:</b> ${esc(x.ocorr)}</div>` : ''}
        ${(x.fotos || []).length ? `<div class="thumbs">${x.fotos.map((a, i) => `<button data-dph="${esc(x.id)}|${i}"><img loading="lazy" src="${esc(BLOB + a)}" alt="Foto ${i + 1}"></button>`).join('')}</div>` : ''}
        <div class="muted" style="font-size:12px;margin-top:4px;display:flex;gap:10px;align-items:center">Registrado${nm(x.autor) ? ' por ' + esc(nm(x.autor)) : ''}${pode ? `<button class="del" data-ddel="${esc(x.id)}" style="margin-left:auto">excluir</button>` : ''}</div>
      </article>`;
    }).join('')}</div>`).join('');
}
function diarioRefresh() { const el = $('#diaLista'); if (el) el.innerHTML = diarioListaHtml(); const dl = $('#dia_emps'); if (dl) dl.innerHTML = empresas().map(e => `<option value="${esc(e)}">`).join(''); const fe = $('[data-df="emp"]'); if (fe) { const v = fe.value; fe.innerHTML = `<option value="">Todas as empresas</option>${empresas().map(e => `<option${e === v ? ' selected' : ''}>${esc(e)}</option>`).join('')}`; } }
function viewDiario() {
  const frs = ['geral'].concat(PEND_FRONTS);
  const fsel = (id, sel, todas) => `<select ${id}>${todas ? `<option value="">${todas}</option>` : ''}${frs.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(frontName(k))}</option>`).join('')}</select>`;
  const csel = id => `<select id="${id}"><option value="">—</option>${CLIMA.map(c => `<option>${c}</option>`).join('')}</select>`;
  return `${canWrite() ? `<section class="card">
    <div class="card-h"><h2>Atividades do dia</h2><span class="sp muted" style="font-size:13px">Um registro por empresa e frente: o que foi feito no dia</span></div>
    <form class="form" id="fDia" autocomplete="off">
      <div class="fgrid">
        <label class="f">Data<input type="date" id="di_data" value="${todayISO()}" max="${todayISO()}" required></label>
        <label class="f">Empresa<input id="di_emp" list="dia_emps" value="${esc(D.meta.contratada || '')}" required><datalist id="dia_emps">${empresas().map(e => `<option value="${esc(e)}">`).join('')}</datalist></label>
        <label class="f">Frente${fsel('id="di_front"', S.tab && PEND_FRONTS.includes(S.tab) ? S.tab : 'geral')}</label>
        <label class="f">Estaca inicial<input id="di_ini" placeholder="opcional"></label>
        <label class="f">Estaca final<input id="di_fim" placeholder="opcional"></label>
      </div>
      <label class="f">Atividades executadas<textarea id="di_ativ" placeholder="ex.: Escavação da vala da drenagem entre as estacas 10 e 14; assentamento de 24 m de tubo PEAD 600" required></textarea></label>
      <div class="fgrid">
        <label class="f">Efetivo (pessoas)<input id="di_efet" type="number" min="0" step="1" inputmode="numeric"></label>
        <label class="f" style="grid-column:span 2">Equipamentos<input id="di_equip" placeholder="ex.: 1 escavadeira, 2 caminhões basculantes, 1 rolo"></label>
        <label class="f">Clima · manhã${csel('di_cm')}</label>
        <label class="f">Clima · tarde${csel('di_ct')}</label>
      </div>
      <label class="f">Ocorrências / observações<textarea id="di_ocorr" placeholder="Paralisações, interferências, visitas, acidentes…"></textarea></label>
      ${S.assets ? '<label class="f">Fotos (opcional · até 6)<input type="file" id="di_fotos" accept="image/*" multiple></label>' : ''}
      <div class="ra"><button class="btn" type="submit" id="di_go">Salvar atividades</button><span class="status" id="di_st" role="status"></span></div>
    </form>
  </section>` : ''}
  <section class="card">
    <div class="card-h"><h2>Diário de atividades</h2><span class="sp" style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" type="button" data-diaexp="xlsx">Exportar Excel</button><button class="chip" type="button" data-diaexp="pdf">Exportar PDF</button></span></div>
    <div class="filt pbusca" style="padding:0;margin-bottom:12px">
      <input type="search" data-df="q" value="${esc(DIA.q)}" placeholder="Buscar nas atividades…" class="pf-busca">
      <label class="pf-l">De<input type="date" data-df="de" value="${esc(DIA.de)}"></label>
      <label class="pf-l">até<input type="date" data-df="ate" value="${esc(DIA.ate)}"></label>
      ${fsel('data-df="frente"', DIA.frente, 'Todas as frentes')}
      <select data-df="emp"><option value="">Todas as empresas</option>${empresas().map(e => `<option${e === DIA.emp ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select>
    </div>
    <div id="diaLista">${diarioListaHtml()}</div>
  </section>`;
}
function bindDiario() {
  diarioSub();
  const f = $('#fDia'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const st = $('#di_st'), v = id => ($('#' + id).value || '').trim(), bad = m => { st.className = 'status err'; st.textContent = m; };
    const fr = v('di_front'), ei = v('di_ini'), ef = v('di_fim');
    let ini = ei ? parseEst(ei) : null, fim = ef ? parseEst(ef) : ini;
    if (ei && isNaN(ini)) return bad('Estaca inicial inválida (use 12 ou 12+10).');
    if (ef && isNaN(fim)) return bad('Estaca final inválida.');
    if (ini != null && Z[fr]) { ini = fixEst(fr, ini); fim = fixEst(fr, fim); if (fim < ini) [ini, fim] = [fim, ini]; }
    if (!v('di_data')) return bad('Informe a data.');
    if (!v('di_emp')) return bad('Informe a empresa.');
    if (v('di_ativ').length < 5) return bad('Descreva as atividades do dia.');
    const files = [...(($('#di_fotos') || {}).files || [])].slice(0, 6);
    $('#di_go').disabled = true;
    try {
      const fotos = [];
      for (let i = 0; i < files.length; i++) { st.className = 'status'; st.textContent = `Enviando foto ${i + 1} de ${files.length}…`; fotos.push(await upImg(files[i])); }
      st.textContent = 'Salvando…';
      await S.db.collection('diario').add({data: v('di_data'), empresa: v('di_emp').slice(0, 80), frente: fr, ini: ini == null || isNaN(ini) ? null : ini, fim: fim == null || isNaN(fim) ? null : fim,
        ativ: v('di_ativ').slice(0, 3000), efetivo: parseInt(v('di_efet'), 10) || 0, equip: v('di_equip').slice(0, 300), climaM: v('di_cm'), climaT: v('di_ct'), ocorr: v('di_ocorr').slice(0, 1500), fotos, autor: S.myId || '', criado: new Date().toISOString()});
      st.className = 'status ok'; st.textContent = 'Atividades salvas.';
      ['di_ativ', 'di_ocorr', 'di_ini', 'di_fim', 'di_efet', 'di_equip'].forEach(id => { $('#' + id).value = ''; }); if ($('#di_fotos')) $('#di_fotos').value = '';
    } catch (err) { bad('Não foi possível salvar (' + ((err && (err.code || err.message)) || 'erro') + ').'); }
    $('#di_go').disabled = false;
  };
}
document.addEventListener('change', e => { const s = e.target.closest('[data-df]'); if (s) { DIA[s.dataset.df] = s.value; diarioRefresh(); } });
document.addEventListener('input', e => { const s = e.target.closest('input[data-df="q"]'); if (s) { DIA.q = s.value; clearTimeout(DIA._t); DIA._t = setTimeout(diarioRefresh, 250); } });
document.addEventListener('click', async e => {
  const p = e.target.closest('[data-dph]'); if (p) { const [id, i] = p.dataset.dph.split('|'), x = S.diario.find(y => y.id === id); if (x) openList(x.fotos.map((a, k) => ({id: id + '-' + k, data: x.data, asset: a, legenda: x.empresa + ' · ' + (x.ativ || '').slice(0, 100)})), +i, (x.empresa || '') + ' · ' + dBR(x.data)); return; }
  const d = e.target.closest('[data-ddel]'); if (d && S.db) { if (d.dataset.confirm !== '1') { d.dataset.confirm = '1'; d.textContent = 'confirmar exclusão'; return; } try { await S.db.doc('diario/' + d.dataset.ddel).delete(); } catch (err) { d.textContent = 'sem permissão'; } return; }
  const x = e.target.closest('[data-diaexp]'); if (x) diarioExport(x.dataset.diaexp, x);
});
async function diarioExport(tipo, btn) {
  const l = diarioFiltrar().slice().reverse(); const lbl = btn.textContent;
  if (!l.length) { btn.textContent = 'Nada para exportar'; setTimeout(() => { btn.textContent = lbl; }, 2000); return; }
  const per = `${DIA.de ? dBR(DIA.de) : 'início'} a ${DIA.ate ? dBR(DIA.ate) : dBR(todayISO())}`, M = D.meta, agora = new Date().toLocaleString('pt-BR'), quem = nm(S.myId);
  const linha = x => ({data: dBR(x.data), dia: wd(x.data), emp: x.empresa || '', fr: frontName(x.frente), est: x.ini != null ? 'Est. ' + estStr(x.ini) + (x.fim > x.ini ? ' a ' + estStr(x.fim) : '') : '', ativ: x.ativ || '', efet: x.efetivo || '', equip: x.equip || '', clima: [x.climaM ? 'M: ' + x.climaM : '', x.climaT ? 'T: ' + x.climaT : ''].filter(Boolean).join(' / '), ocorr: x.ocorr || '', autor: nm(x.autor), fotos: (x.fotos || []).length});
  const nome = `diario_${(DIA.de || 'inicio')}_a_${(DIA.ate || todayISO())}`;
  if (tipo === 'xlsx') {
    btn.disabled = true; btn.textContent = 'Gerando…';
    try {
      await loadXlsx(); const X = window.XLSX;
      const r = [[`Contrato ${M.contrato} · ${M.contratada}`], [`Diário de atividades · ${per}`], [`Gerado em ${agora}${quem ? ' por ' + quem : ''} · Painel Ramal da Arena`], [],
        ['Data', 'Dia', 'Empresa', 'Frente', 'Trecho', 'Atividades executadas', 'Efetivo', 'Equipamentos', 'Clima', 'Ocorrências', 'Registrado por', 'Fotos']];
      l.map(linha).forEach(o => r.push([o.data, o.dia, o.emp, o.fr, o.est, o.ativ, o.efet, o.equip, o.clima, o.ocorr, o.autor, o.fotos]));
      const ws = X.utils.aoa_to_sheet(r); ws['!cols'] = [{wch: 11}, {wch: 9}, {wch: 22}, {wch: 20}, {wch: 16}, {wch: 70}, {wch: 8}, {wch: 35}, {wch: 22}, {wch: 45}, {wch: 18}, {wch: 6}];
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Diário'); X.writeFile(wb, nome + '.xlsx');
      btn.textContent = lbl;
    } catch (er) { btn.textContent = 'Erro ao gerar'; setTimeout(() => { btn.textContent = lbl; }, 2500); }
    btn.disabled = false; return;
  }
  const w = window.open('', '_blank'); if (!w) { btn.textContent = 'Libere pop-ups'; setTimeout(() => { btn.textContent = lbl; }, 2500); return; }
  const dias = [...new Set(l.map(x => x.data))];
  const corpo = dias.map(d => `<h2>${esc(wd(d))}, ${esc(dBR(d))}</h2><table><thead><tr><th style="width:16%">Empresa / frente</th><th>Atividades executadas</th><th style="width:7%">Efetivo</th><th style="width:16%">Equipamentos</th><th style="width:12%">Clima</th></tr></thead><tbody>${l.filter(x => x.data === d).map(linha).map(o => `<tr><td><b>${esc(o.emp)}</b><div class="s">${esc(o.fr)}${o.est ? ' · ' + esc(o.est) : ''}</div></td><td style="white-space:pre-line">${esc(o.ativ)}${o.ocorr ? `<div class="s"><b>Ocorrências:</b> ${esc(o.ocorr)}</div>` : ''}<div class="s">${o.autor ? 'Registrado por ' + esc(o.autor) : ''}${o.fotos ? ' · ' + o.fotos + ' foto(s) no painel' : ''}</div></td><td class="r">${esc(String(o.efet))}</td><td>${esc(o.equip)}</td><td>${esc(o.clima)}</td></tr>`).join('')}</tbody></table>`).join('');
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nome)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px/1.4 Arial,Helvetica,sans-serif;color:#111;margin:0}
  .top{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0a6b5a;padding-bottom:8px;margin-bottom:6px}.top img{height:30px;background:#0a4743;padding:4px 8px;border-radius:4px}h1{font-size:16px;margin:0}
  h2{font-size:12.5px;margin:14px 0 5px;color:#0a4743}.meta{color:#444;font-size:10.5px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#e8f1ef;text-align:left;font-size:10px}
  .r{text-align:right}.s{color:#555;font-size:9.5px;margin-top:3px}tr{page-break-inside:avoid}thead{display:table-header-group}.bar{padding:8px 0}@media print{.bar{display:none}}.ass{margin-top:40px;display:flex;gap:60px}.ass div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center}</style></head><body>
  <div class="bar"><button onclick="print()" style="font-size:14px;padding:8px 16px">Salvar como PDF / Imprimir</button></div>
  <div class="top"><img src="${esc(new URL('logo.png', location.href).href)}" alt=""><div><h1>Diário de atividades · ${esc(per)}</h1><div class="meta">Contrato ${esc(M.contrato)} · ${esc(M.contratada)} · ${esc(M.local || '')} · gerado em ${esc(agora)}${quem ? ' por ' + esc(quem) : ''}</div></div></div>
  ${corpo}<div class="ass"><div>Fiscalização / Supervisão</div><div>Contratada</div></div>
  <script>window.onload=function(){setTimeout(function(){print()},400)}<\/script></body></html>`);
  w.document.close();
}

boot();
