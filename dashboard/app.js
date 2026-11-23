// Token Radar dashboard: renders window.RADAR (written by main.ts from the sealed snapshot).
// No fetch, no network, no links out. The board is sortable and filterable; a click opens a
// protocol's detail view with its model breakdown and farm plan. The model sandbox re-runs the
// same implied-value function as lib/model.ts and re-ranks the board live.

const D = window.RADAR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Money in whole dollars as $2.76B / $103.5M / $812K. */
function money(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}

/** A per-cent change as +5.77% / -4.00% / n/a. */
function pct(v) {
  if (v === null || v === undefined) return 'n/a';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

/** The implied value of one row under a model: the same function as lib/model.ts.
 *  The row carries its own calibrated base multiple; the sandbox's market scale multiplies it. */
function implied(row, m, days) {
  const growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null ? 0 : row.change_7d));
  const gMult = 1 + (growth / 100) * m.growth_weight;
  const age = row.age_days === null ? m.unknown_age_days : row.age_days;
  const mMult = m.maturity_floor + (Math.min(Math.max(age, 0), days) / days) * m.maturity_range;
  const bMult = 1 + m.breadth_step * Math.min(Math.max(row.chains.length - 1, 0), m.breadth_max_steps);
  return { value: Math.max(1, Math.round(row.tvl_usd * row.base_multiple * m.market_scale * gMult * mMult * bMult)), gMult, mMult, bMult, growth };
}

// Rows carry watch: true when their slug is on the snapshot's own watchlist.
const onWatch = new Set(D.rows.filter((r) => r.watch).map((r) => r.slug));

/** Current model, starting from the snapshot's own constants. */
let model = { ...D.model };
let days = D.model.maturity_days;
let selected = null;

function stateFromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  return {
    q: h.get('q') || '',
    cat: h.get('cat') || '',
    chain: h.get('chain') || '',
    watch: h.get('watch') === '1',
    detail: h.get('detail') || '',
  };
}

function stateToHash(s) {
  const h = new URLSearchParams();
  if (s.q) h.set('q', s.q);
  if (s.cat) h.set('cat', s.cat);
  if (s.chain) h.set('chain', s.chain);
  if (s.watch) h.set('watch', '1');
  if (s.detail) h.set('detail', s.detail);
  history.replaceState(null, '', h.toString() ? '#' + h.toString() : location.pathname);
}

function fillSelect(el, values, allLabel) {
  el.innerHTML = '<option value="">' + esc(allLabel) + '</option>' +
    values.map((v) => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
}

function renderMeta() {
  $('meta').innerHTML =
    'Snapshot <b>' + esc(D.as_of) + '</b> &middot; watchlist floor <b>' + money(D.floor_usd) + '</b> &middot; ' +
    esc(D.rows.length) + ' candidates &middot; source: ' + esc(D.source.replace(/^DefiLlama /, ''));
  $('model-ver').textContent = '(' + esc(D.model_version) + ')';
  $('model-line').textContent =
    'implied = TVL x category multiple x (1 + clamp(7d, ' + D.model.growth_floor + '%, ' + D.model.growth_cap + '%) / 100 x ' + D.model.growth_weight + ') x maturity(age) x breadth(chains)';
  const cal = D.calibration;
  $('calibration').innerHTML =
    '<p class="cal-note">Base multiple by category: the median market-cap/TVL of the ' + cal.global_live_count +
    ' live protocols in this snapshot. A category counts once it has ' + cal.min_live +
    ' live protocols; the rest use the whole-market median x' + cal.global_multiple.toFixed(3) +
    '. Multiples are clamped to ' + cal.floor + '&ndash;' + cal.cap + ', so one outlier cannot set one.</p>' +
    cal.by_category.map((c) =>
      '<span class="chip"><b>' + esc(c.category) + '</b> x' + c.multiple.toFixed(3) + ' <i>(' + c.live_count + ' live)</i></span>').join('') +
    '<span class="chip"><b>All other categories</b> x' + cal.global_multiple.toFixed(3) + ' <i>(whole-market median)</i></span>';
  const growths = D.rows.map((r) => r.change_7d).filter((v) => v !== null).sort((a, b) => a - b);
  const med = growths.length ? growths[Math.floor(growths.length / 2)] : 0;
  $('stats').innerHTML =
    '<div class="stat"><div class="n">' + D.watchlist_size + '</div><div class="l">watchlist protocols (&ge; ' + money(D.floor_usd) + ' TVL, no token)</div></div>' +
    '<div class="stat"><div class="n">' + D.board_size + '</div><div class="l">candidates ranked on the board</div></div>' +
    '<div class="stat"><div class="n">' + money(D.total_implied_usd) + '</div><div class="l">total implied value of the board</div></div>' +
    '<div class="stat"><div class="n">' + pct(med) + '</div><div class="l">median 7-day TVL change</div></div>';
  $('foot').textContent =
    'Snapshot ' + D.as_of + ', ' + D.source + '. Implied values are this radar\u2019s own model, not a prediction that a token is issued or when. Farm steps are generic DeFi actions with stated costs and times, not financial advice.';
}

/** Rows after the current filters, re-ranked under the current model. */
function visibleRows() {
  const s = {
    q: $('q').value.trim().toLowerCase(),
    cat: $('f-cat').value,
    chain: $('f-chain').value,
    tvl: Number($('f-tvl').value),
    watch: $('f-watch').checked,
    sort: $('f-sort').value,
  };
  let rows = D.rows.map((r) => ({ r, v: implied(r, model, days) }));
  if (s.watch) rows = rows.filter((x) => onWatch.has(x.r.slug));
  if (s.cat) rows = rows.filter((x) => x.r.category === s.cat);
  if (s.chain) rows = rows.filter((x) => x.r.chains.includes(s.chain));
  if (s.tvl) rows = rows.filter((x) => x.r.tvl_usd >= s.tvl);
  if (s.q) rows = rows.filter((x) => x.r.name.toLowerCase().includes(s.q) || x.r.slug.includes(s.q));
  const byValue = (a, b) => b.v.value - a.v.value || (a.r.slug < b.r.slug ? -1 : 1);
  if (s.sort === 'tvl') rows.sort((a, b) => b.r.tvl_usd - a.r.tvl_usd);
  else if (s.sort === 'growth') rows.sort((a, b) => (b.r.change_7d ?? -999) - (a.r.change_7d ?? -999));
  else if (s.sort === 'age') rows.sort((a, b) => (b.r.age_days ?? -1) - (a.r.age_days ?? -1));
  else rows.sort(byValue);
  return { rows, state: s };
}

function renderBoard() {
  const { rows, state } = visibleRows();
  const maxV = rows.length ? rows[0].v.value : 1;
  $('count').innerHTML = 'Showing <b>' + rows.length + '</b> of ' + D.board_size + ' candidates' +
    (state.watch ? ' (watchlist only)' : '') + '.';
  $('rows').innerHTML = rows.map((x, i) => {
    const r = x.r;
    const w = onWatch.has(r.slug);
    const cls = (selected === r.slug ? ' class="sel' + (w ? ' watch' : '') + '"' : w ? ' class="watch"' : '');
    return '<tr data-slug="' + esc(r.slug) + '"' + cls + '>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + esc(r.name) + (w ? '<span class="badge">WATCHLIST</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || 'n/a') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + (r.age_days === null ? 'n/a' : r.age_days + 'd') + '</td>' +
      '<td class="num"><span class="bar" style="width:' + Math.max(3, Math.round((x.v.value / maxV) * 90)) + 'px"></span>' + money(x.v.value) + '</td>' +
      '<td><button type="button" data-detail="' + esc(r.slug) + '">Detail</button></td>' +
      '</tr>';
  }).join('');
  document.querySelectorAll('#rows tr').forEach((tr) => {
    tr.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') openDetail(tr.dataset.slug);
    });
  });
  document.querySelectorAll('#rows [data-detail]').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); openDetail(b.dataset.detail); });
  });
}

function openDetail(slug) {
  const r = D.rows.find((x) => x.slug === slug);
  if (!r) return;
  selected = slug;
  const v = implied(r, model, days);
  const base = r.tvl_usd * r.base_multiple * model.market_scale;
  const el = $('detail');
  el.hidden = false;
  el.innerHTML =
    '<h2>' + esc(r.name) + (onWatch.has(r.slug) ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
    '<div class="facts"><span>Slug <b>' + esc(r.slug) + '</b></span>' +
    '<span>Category <b>' + esc(r.category || 'n/a') + '</b></span>' +
    '<span>Chains <b>' + esc(r.chains.join(', ')) + '</b></span>' +
    '<span>TVL <b>' + money(r.tvl_usd) + '</b></span>' +
    '<span>7-day <b>' + pct(r.change_7d) + '</b></span>' +
    '<span>Listed <b>' + esc(r.listed_at || 'n/a') + '</b> (' + (r.age_days === null ? 'age unknown' : r.age_days + ' days') + ')</span>' +
    '<span>Token <b>none recorded</b></span></div>' +
    '<div class="break">' +
    '<div class="cell"><div class="k">Base (TVL &times; ' + r.base_multiple.toFixed(3) + ' &middot; ' + esc(r.base_source) + ')' + (model.market_scale !== 1 ? ' &times; scale ' + model.market_scale.toFixed(2) : '') + '</div><div class="v">' + money(base) + '</div><div class="bar-wrap"><i style="width:100%"></i></div></div>' +
    '<div class="cell"><div class="k">Growth &times;' + v.gMult.toFixed(2) + ' (' + pct(v.growth) + ' clamped)</div><div class="v">' + money(base * v.gMult) + '</div><div class="bar-wrap"><i style="width:' + Math.min(100, Math.max(4, v.gMult * 55)) + '%"></i></div></div>' +
    '<div class="cell"><div class="k">Maturity &times;' + v.mMult.toFixed(2) + '</div><div class="v">' + money(base * v.gMult * v.mMult) + '</div><div class="bar-wrap"><i style="width:' + Math.round(v.mMult * 100) + '%"></i></div></div>' +
    '<div class="cell"><div class="k">Implied value</div><div class="v">' + money(v.value) + '</div><div class="bar-wrap"><i style="width:100%;background:var(--green)"></i></div></div>' +
    '</div>' +
    '<h2>Farm plan</h2>' +
    '<ol class="steps">' + r.farm_steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
  const s = stateFromHash();
  s.detail = slug;
  stateToHash(s);
  renderBoard();
  el.scrollIntoView({ block: 'start' });
}

function renderLive() {
  $('live-rows').innerHTML = D.live.map((p) =>
    '<tr><td>' + esc(p.name) + '<span class="slug">' + esc(p.slug) + '</span></td>' +
    '<td>' + esc(p.category || 'n/a') + '</td>' +
    '<td class="num">' + money(p.tvl_usd) + '</td>' +
    '<td class="num">' + (p.mcap_usd === null ? 'n/a' : money(p.mcap_usd)) + '</td>' +
    '<td class="num">' + (p.mcap_usd === null || p.tvl_usd === 0 ? 'n/a' : (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x') + '</td>' +
    '<td class="num ' + (p.change_7d === null ? '' : p.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(p.change_7d) + '</td></tr>'
  ).join('');
}

function syncSliders() {
  $('s-scale').value = model.market_scale;
  $('s-growth').value = model.growth_weight;
  $('s-days').value = days;
  $('v-scale').textContent = 'x' + model.market_scale.toFixed(2);
  $('v-growth').textContent = 'x' + model.growth_weight.toFixed(2);
  $('v-days').textContent = days + 'd';
}

function init() {
  renderMeta();
  const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(D.rows.flatMap((r) => r.chains))].sort();
  fillSelect($('f-cat'), cats, 'All categories');
  fillSelect($('f-chain'), chains, 'All chains');
  const h = stateFromHash();
  if (h.q) $('q').value = h.q;
  if (h.cat) $('f-cat').value = h.cat;
  if (h.chain) $('f-chain').value = h.chain;
  if (h.watch) $('f-watch').checked = true;
  ['q', 'f-cat', 'f-chain', 'f-tvl', 'f-watch', 'f-sort'].forEach((id) => {
    $(id).addEventListener('input', () => { renderBoard(); persist(); });
  });
  $('s-scale').addEventListener('input', () => { model.market_scale = Number($('s-scale').value); syncSliders(); renderBoard(); });
  $('s-growth').addEventListener('input', () => { model.growth_weight = Number($('s-growth').value); syncSliders(); renderBoard(); });
  $('s-days').addEventListener('input', () => { days = Number($('s-days').value); syncSliders(); renderBoard(); });
  $('reset-model').addEventListener('click', () => { model = { ...D.model }; days = D.model.maturity_days; syncSliders(); renderBoard(); });
  syncSliders();
  renderBoard();
  renderLive();
  if (h.detail) openDetail(h.detail);
}

function persist() {
  const s = stateFromHash();
  s.q = $('q').value.trim();
  s.cat = $('f-cat').value;
  s.chain = $('f-chain').value;
  s.watch = $('f-watch').checked;
  s.detail = selected || '';
  stateToHash(s);
}

init();
