// Mission Control v2: the core. ETag cache, hash router, one-second ticker, and the board (the landing view).
const ROUTES = '#/ board · #/b/:slug bounty · #/b/:slug/leaderboard · #/u/:handle profile'
const API = 'https://make.fun/api', cache = new Map // ETag cache: 304 = no parse, no repaint
let rows // rows patched in place
const FRESH = 2e4, tel = { net: 0, same: 0, mem: 0 }
const $ = (sel, el = document) => el.querySelector(sel)

export const view = $('main'), hooks = {}, BOARD = '/competitions?status=open&activity=times'
export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt()};`)
export const usd = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })
export const when = iso => iso ? new Date(iso).toISOString().replace(/^\d+-(\d+)-(\d+)T(.{5}).*/, (_, m, d, t) => `${d} ${'JanFebMarAprMayJunJulAugSepOctNovDec'.substr(m * 3 - 3, 3)} ${t}Z`) : 'n/a'
export const open = c => Date.parse(c.deadline) > Date.now()
export const peek = path => cache.get(path)?.data
export const byId = id => document.getElementById(id)
export const ready = () => { window.__shotReady = true }

// A score as people read it: a judge win rate arrives in millionths, everything else as the API displays it.
export const score = (col, value, display) => value == null ? 'n/a' : /micro/.test(col?.source) ? (value / 1e4).toFixed(2) + '%' : display ?? value

export function left(iso) {
  let s = (Date.parse(iso) - Date.now()) / 1e3 | 0
  if (!(s > 0)) return 'closed'
  const d = s / 86400 | 0, h = s % 86400 / 3600 | 0, m = s % 3600 / 60 | 0, two = n => String(n).padStart(2, '0')
  return d ? `${d}d ${two(h)}h` : h ? `${h}h ${two(m)}m` : `${m}m ${two(s % 60)}s`
}

let seq = 0, subs = [], page = ''

// One request per path at a time. The browser revalidates with If-None-Match; an unchanged ETag skips the body.
function pull(path) {
  const c = cache.get(path) ?? cache.set(path, {}).get(path)
  return c.job ??= fetch(API + path, { cache: 'no-cache' }).then(async r => {
    tel.net++
    if (!r.ok) throw Error(r.status == 404 ? 'make.fun has nothing at this address (404).' : `make.fun answered ${r.status}.`)
    const tag = r.headers.get('etag')
    c.at = Date.now()
    if (tag && tag == c.tag) return tel.same++, false
    const text = await r.text()
    if (text === c.text) return tel.same++, false
    c.tag = tag
    c.text = tag ? '' : text
    c.data = JSON.parse(text)
    return true
  }).finally(() => { c.job = null; meter() })
}

// Paint from memory at once, revalidate when stale, and repaint only if the answer changed.
export function live(path, paint, lost = fail) {
  const c = cache.get(path), mine = seq
  const draw = () => mine == seq && paint(cache.get(path).data)
  subs.push({ path, draw })
  if (c?.data) {
    paint(c.data)
    if (Date.now() - c.at < FRESH) return tel.mem++, meter()
  }
  return pull(path).then(changed => changed && draw(), e => mine == seq && !c?.data && lost(e))
}

function poll() {
  if (document.hidden) return
  for (const s of subs) if (Date.now() - (cache.get(s.path).at || 0) > FRESH) pull(s.path).then(changed => changed && s.draw(), () => {})
}

function meter() {
  $('.tel').textContent = `NET ${tel.net} · 304 ${tel.same} · MEM ${tel.mem}`
}

function tick() {
  for (const el of document.querySelectorAll('[data-t]')) {
    const s = left(el.dataset.t)
    if (el.textContent != s) el.textContent = s
    el.classList.toggle('over', s == 'closed')
  }
}

export function fail(e) {
  view.innerHTML = `<div class=panel><h1 class=over>Signal lost</h1><p>${esc(e.message)}</p><button id=retry>Retry</button> <a href=#/>Back to the board</a></div>`
  ready()
}

// The nav keeps pointing at the bounty and the account last looked at, so every surface is one click away.
const last = { slug: '', who: '' }
export function mark(id, slug, who) {
  if (slug) last.slug = slug
  if (who) last.who = who
  $('#nb').href = `#/b/${last.slug}`
  $('#nl').href = `#/b/${last.slug}/leaderboard`
  $('#nu').href = `#/u/${last.who}`
  for (const a of $('#nav').children) a.id == id || (!id && !a.id) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')
}

function route() {
  let parts
  try { parts = location.hash.split('/').map(decodeURIComponent) } catch { parts = [0, '?'] }
  const [, a, slug, tab, who] = parts, next = [a, slug, tab].join('/')
  if (next == page && tab && hooks.peek) return hooks.peek(who)
  page = next
  seq++
  subs = []
  hooks.peek = null
  window.__shotReady = false
  scrollTo(0, 0)
  const mine = seq, lazy = (mod, ...args) => mod.then(m => mine == seq && m.default(...args), fail)
  if (!a) board()
  else if (a == 'b' && slug && !tab) lazy(import('./bounty.js'), slug)
  else if (a == 'b' && slug && tab == 'leaderboard') lazy(import('./leaderboard.js'), slug, who)
  else if (a == 'u' && !tab) lazy(import('./profile.js'), slug)
  else {
    mark('none')
    view.innerHTML = `<div class=panel><h1>No such screen</h1><p>Routes: ${esc(ROUTES)}</p><a href=#/>Back to the board</a></div>`
    ready()
  }
}

// The board. Rows are keyed by slug and patched in place: a refresh, a sort or a filter never rebuilds the list.
const SORTS = { pot: ['Pot', c => -c.potUsd], soon: ['Closing', c => Date.parse(c.deadline)], entries: ['Entries', c => -c.submissionCount], fresh: ['Newest', c => -Date.parse(c.publishedAt)] }
let sort = 'pot', find = '', items

function board() {
  mark()
  document.title = 'Mission Control · make.fun bounty board'
  view.innerHTML = `<h1>Bounty board <small id=sum class=dim></small></h1>
<div class=bar><input id=q type=search placeholder="filter bounties ( / )" aria-label="Filter bounties" value="${esc(find)}">
${Object.entries(SORTS).map(([k, [name]]) => `<button data-s=${k}>${name}</button>`).join('')}</div>
<div class="row hd"><span>BOUNTY</span><span class=n>POT</span><span class=n>FEE</span><span class=n>T-MINUS</span><span class=n>ENTRIES</span></div>
<div id=rows><p class=dim role=status>Acquiring signal…</p></div>`
  rows = new Map
  $('#q').oninput = e => { find = e.target.value; arrange() }
  $('.bar').onclick = e => { if (e.target.dataset.s) { sort = e.target.dataset.s; arrange() } }
  live(BOARD, data => {
    items = data.items
    if (!rows.size) $('#rows').textContent = ''
    for (const c of items) patch(c)
    for (const [slug, el] of rows) if (!items.some(c => c.slug == slug)) { el.remove(); rows.delete(slug) }
    arrange()
    ready()
  })
}

function patch(c) {
  let el = rows.get(c.slug)
  if (!el) {
    el = document.createElement('a')
    el.href = `#/b/${c.slug}`
    rows.set(c.slug, el)
  }
  const sig = [c.title, c.potUsd, c.entryFeeUsd, c.deadline, c.submissionCount].join()
  if (el.sig == sig) return
  el.sig = sig
  el.innerHTML = `<span><b>${esc(c.title)}</b> <small>${esc(c.category)}</small></span>
<span class="n pot">${usd(c.potUsd ?? c.rewardAmount)}</span>
<span class=n>${c.entryFeeUsd ? usd(c.entryFeeUsd) : '<small>free</small>'}</span>
<span class="n time" data-t="${esc(c.deadline)}">${left(c.deadline)}</span>
<span class=n>${c.submissionCount.toLocaleString('en-US')}</span>`
}

function arrange() {
  const box = $('#rows'), need = find.trim().toLowerCase()
  if (!box || !items) return
  let taking = 0, past = 0, pots = 0
  for (const c of [...items].sort((x, y) => open(y) - open(x) || SORTS[sort][1](x) - SORTS[sort][1](y))) {
    const el = rows.get(c.slug)
    el.className = open(c) ? 'row' : 'row late'
    el.hidden = !!need && !`${c.title} ${c.category} ${c.slug}`.toLowerCase().includes(need)
    if (!el.hidden) open(c) ? taking++ : past++, pots += +(c.potUsd ?? c.rewardAmount)
    box.append(el)
  }
  $('#sum').textContent = `${taking} taking entries · ${past} awaiting results · ${usd(pots)} in pots`
  for (const b of view.querySelectorAll('[data-s]')) b.setAttribute('aria-pressed', b.dataset.s == sort)
  if (!last.slug && items[0]) mark(0, [...box.children].find(el => !el.hidden)?.hash.slice(4))
}

addEventListener('hashchange', route)
addEventListener('visibilitychange', poll)
addEventListener('keydown', e => {
  if (e.key == '/' && !/INPUT/.test(e.target.tagName) && $('input', view)) { e.preventDefault(); $('input', view).focus() }
})
view.addEventListener('click', e => { if (e.target.id == 'retry') { page = ''; route() } })
setInterval(tick, 1e3)
setInterval(poll, 6e4)
route()
