import { live, view, esc, score, mark, ready, hooks } from './app.js'

export default function leaderboard(slug, who) { // virtual scroll: ~30 of N rows in DOM
  mark('nl', slug)
  view.innerHTML = `<p class=crumb><a href=#/>board</a> / <a href="#/b/${esc(slug)}">${esc(slug)}</a> / leaderboard</p>
<h1 id=lt>Leaderboard</h1>
<div class=split><div>
<div class=bar><input id=q type=search placeholder="find an entrant or an entry ( / )" aria-label="Find an entrant or an entry"><span id=lc class=dim></span></div>
<div class="lrow hd"><span class=n>#</span><span>ENTRANT</span><span>ENTRY</span><span class=n id=lk>SCORE</span></div>
<div class=vl id=vl tabindex=0 role=list aria-label="Ranked entries"><div id=sp><div id=win></div></div></div>
</div><aside class=panel id=pk hidden></aside></div>`
  const $ = id => document.getElementById(id), box = $('vl'), ROW = 30
  let all = [], rows = [], col, best = 1, from = -1, to = -1, sel = who

  // Only the rows in view (plus a few each side) exist; scrolling swaps their text, 8,000 entries cost the same as 80.
  const draw = force => {
    if (!box.isConnected) return // a late scroll frame or resize after the view was left
    const a = Math.max(0, (box.scrollTop / ROW | 0) - 4), b = Math.min(rows.length, a + Math.ceil(box.clientHeight / ROW) + 8)
    if (!force && a == from && b == to) return
    from = a
    to = b
    $('win').style.transform = `translateY(${a * ROW}px)`
    $('win').innerHTML = rows.slice(a, b).map(e => `<a class=lrow role=listitem href="#/b/${esc(slug)}/leaderboard/${esc(e.handle)}"${e.handle == sel ? ' aria-current=true' : ''}>
<span class=n>${e.rank ?? '–'}</span><span>${esc(e.handle)}${e.house ? ' <small>house</small>' : ''}</span><span class=dim>${esc(e.title)}</span>
<span class="n score" style="--w:${e.v > 0 ? e.v / best * 100 : 0}%"><b>${esc(score(col, e.v, e.shown))}</b>${e.band ? ` <small>±${e.band}</small>` : ''}</span></a>`).join('')
  }
  const filter = () => {
    const need = $('q').value.trim().toLowerCase()
    rows = need ? all.filter(e => `${e.handle} ${e.title}`.toLowerCase().includes(need)) : all
    $('sp').style.height = rows.length * ROW + 'px'
    $('lc').textContent = `${rows.length.toLocaleString('en-US')} of ${all.length.toLocaleString('en-US')} entries`
    draw(true)
  }
  let frame = 0
  box.onscroll = () => { frame ||= requestAnimationFrame(() => { frame = 0; draw() }) }
  $('q').oninput = () => { box.scrollTop = 0; filter() }
  window.onresize = box.onscroll

  // The side pane shows an entrant's profile next to the table, so the list keeps its place while you look around.
  const show = handle => {
    sel = handle || ''
    draw(true)
    $('pk').hidden = !sel
    if (!sel) return
    import('./profile.js').then(m => m.card($('pk'), sel, true))
  }
  hooks.peek = show

  live(`/competitions/${slug}/leaderboard?rows=first`, d => {
    const key = d.rank_key
    col = d.columns?.find(k => k.key == key)
    document.title = `Leaderboard · ${d.competition.title} · Mission Control`
    $('lt').innerHTML = `Leaderboard <small class=dim>${esc(d.competition.title)} · ${esc(d.phase?.title ?? '')} phase</small>`
    $('lk').textContent = (col?.title ?? 'score').toUpperCase()
    // The first ten rows come whole and the rest slim: both become the same five fields.
    all = [...d.entries, ...d.rest ?? []].map(e => {
      const v = e.value ?? e.values?.[key], i = e.interval
      return { rank: e.rank, handle: e.handle, title: e.title, house: e.house, v, shown: e.display?.[key] ?? e.display, band: i?.high && /micro/.test(col?.source) ? ((i.high - i.low) / 2e4).toFixed(1) : '' }
    })
    best = Math.max(1, ...all.slice(0, 50).map(e => +e.v || 0))
    if (!all.length) $('win').innerHTML = '<p class=dim>No ranked entries yet: scores are held until this phase posts.</p>'
    filter()
    // With room for two columns the top entrant opens beside the table; on a phone the table comes first.
    if (sel === undefined && all[0]) show(matchMedia('(min-width:600px)').matches ? all[0].handle : '')
    ready()
  })
  if (sel !== undefined) show(sel)
}
