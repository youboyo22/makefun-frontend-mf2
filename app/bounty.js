import { live, peek, view, byId as $, esc, usd, left, when, open, score, mark, ready, BOARD } from './app.js'

export default function bounty(slug) { // rewards table + live pot, dates, rules, top 5
  mark('nb', slug)
  view.innerHTML = `<div id=hd><p class=dim role=status>Acquiring signal…</p></div>
<div class=cols>
<section class=panel><h2>Rewards · live pot</h2><table id=rw></table></section>
<section class=panel><h2>Dates · status</h2><dl id=dt></dl></section>
<section class=panel><h2>Leaderboard · top 5</h2><table id=t5></table><a href="#/b/${esc(slug)}/leaderboard">Full leaderboard →</a></section>
</div>
<section class="panel md" id=ds></section>
<details class="panel md" id=ru><summary>Rules</summary><div></div></details>`
  const seed = peek(BOARD)?.items.find(c => c.slug == slug)
  if (seed) head(seed) // the board already knows the pot, the fee and the deadline: show them before the page answers
  live(`/competitions/${slug}?submissions=summary`, c => {
    head(c)
    body(c)
    ready()
  })
  live(`/competitions/${slug}/leaderboard?rows=first`, top)
}

const nth = n => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')

function head(c) {
  document.title = `${c.title} · Mission Control`
  const state = c.status != 'open' ? ['dim', c.status.toUpperCase()] : open(c) ? ['pot', 'OPEN · taking entries'] : ['time', 'CLOSED · awaiting results']
  const fees = +c.entryFeesUsd || 0
  $('hd').innerHTML = `<p class=crumb><a href=#/>board</a> / ${esc(c.slug)} · ${esc(c.category)} · by ${esc(c.sponsor?.name)}</p>
<h1>${esc(c.title)} <span class="chip ${state[0]}">${state[1]}</span></h1>
<p class="dim clamp">${esc(c.summary)}</p>
<div class=kpis>
<div class=kpi><small>LIVE POT</small><b class=pot>${usd(c.potUsd ?? c.rewardAmount)}</b><small>${usd(c.rewardAmount)} + ${usd(fees)} fees</small></div>
<div class=kpi><small>ENTRY FEE</small><b>${c.entryFeeUsd ? usd(c.entryFeeUsd) : 'free'}</b><small>${c.entryFeeUsd ? `${c.entryFeePayers} accounts paid` : 'no fee to enter'}</small></div>
<div class=kpi><small>T-MINUS</small><b class=time data-t="${esc(c.deadline)}">${left(c.deadline)}</b><small>to ${when(c.deadline)}</small></div>
<div class=kpi><small>ENTRIES</small><b>${c.submissionCount.toLocaleString('en-US')}</b><small>${c.submissionsPassed != null ? `${c.submissionsPassed.toLocaleString('en-US')} passed` : esc(c.harnessKind)}</small></div>
</div>`
}

function body(c) {
  // Places that pay the same collapse into one row: 4th to 10th, 11th to 20th.
  const now = c.rewardsNow ?? Object.entries(c.rewards ?? {}).map(([place, usd]) => ({ place: +place, baseUsd: usd, amountUsd: usd }))
  const bands = []
  for (const r of now) {
    const b = bands.at(-1)
    if (b && b.amountUsd == r.amountUsd) b.to = r.place
    else bands.push({ ...r, to: r.place })
  }
  $('rw').innerHTML = bands.map(b => `<tr><td>${nth(b.place)}${b.to > b.place ? '–' + nth(b.to) : ''}</td><td class="x wide"><small>${usd(b.baseUsd)}${+b.feeShareUsd ? ' + ' + usd(b.feeShareUsd) : ''}</small></td><td><b class=pot>${usd(b.amountUsd)}</b></td></tr>`).join('') || '<tr><td class=dim>No reward table published.</td></tr>'
  const final = c.phases?.find(p => p.key == 'final')
  $('dt').innerHTML = [
    ['Opens', when(c.opensAt ?? c.publishedAt)],
    ['Closes', when(c.deadline)],
    ['Left', `<span class=time data-t="${esc(c.deadline)}">${left(c.deadline)}</span>`],
    ['Results', c.resolvedAt ? when(c.resolvedAt) : final?.finalizedAt ? when(final.finalizedAt) : 'after final'],
    ['Status', c.status == 'open' && !open(c) ? 'past deadline' : esc(c.status)],
    ['Method', esc(c.resolution?.method ?? 'n/a')],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  $('ds').innerHTML = `<h2>Brief</h2>${md(c.description)}${c.resolution?.summary ? `<h3>How it is decided</h3><p>${esc(c.resolution.summary)}</p>` : ''}`
  // The rules run to tens of kilobytes: render them only when they are opened.
  const rules = $('ru')
  rules.hidden = !c.rules
  rules.ontoggle = () => { if (rules.open && !rules.done) rules.done = rules.lastChild.innerHTML = md(c.rules) }
  if (rules.open) rules.lastChild.innerHTML = md(c.rules)
}

function top(d) {
  const col = d.columns?.find(k => k.key == d.rank_key)
  $('t5').innerHTML = d.entries.slice(0, 5).map(e => `<tr><td>${e.rank ?? '–'} <a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a></td><td><b>${esc(score(col, e.values?.[d.rank_key], e.display?.[d.rank_key]))}</b></td></tr>`).join('') || '<tr><td class=dim>Scores are held until results post.</td></tr>'
}

// Markdown, the small subset make.fun writes: headings, lists, fences, code, bold and links. Everything is escaped first.
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel=noreferrer>$1</a>')

function md(text) {
  let out = '', list = '', fence = false
  const close = () => { if (list) out += `</${list}>`, list = '' }
  for (const line of String(text ?? '').split('\n')) {
    const t = line.trim(), item = /^([-*]|\d+\.)\s+(.*)/.exec(t)
    if (t.startsWith('```')) close(), out += fence ? '</pre>' : '<pre>', fence = !fence
    else if (fence) out += esc(line) + '\n'
    else if (item) {
      const kind = item[1].length > 1 ? 'ol' : 'ul'
      if (list != kind) close(), out += `<${kind}>`, list = kind
      out += `<li>${inline(item[2])}</li>`
    }
    else if (/^#+\s/.test(t)) close(), out += `<h3>${inline(t.replace(/^#+\s+/, ''))}</h3>`
    else if (t) close(), out += `<p>${inline(t)}</p>`
  }
  close()
  return out + (fence ? '</pre>' : '')
}
