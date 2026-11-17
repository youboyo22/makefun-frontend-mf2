import { live, view, esc, usd, when, score, mark, ready } from './app.js'

export default function profile(handle) { // GET /profiles/:handle: record, entries, payouts
  if (!handle) return lookup()
  view.innerHTML = '<p class=crumb><a href=#/>board</a> / account</p><div id=pf><p class=dim role=status>Acquiring signal…</p></div>'
  card(view.lastChild, handle)
}

// One renderer, two places: the full page at #/u/:handle and the pane beside a leaderboard (compact).
export function card(el, handle, compact) { // compact: the pane beside a leaderboard
  mark(compact ? 'nl' : 'nu', 0, handle)
  if (el.dataset.who != handle) el.innerHTML = `<h2>Entrant</h2><p class=dim role=status>Hailing @${esc(handle)}…</p>`
  el.dataset.who = handle
  live(`/profiles/${encodeURIComponent(handle)}`, p => {
    if (el.dataset.who != handle) return
    const r = p.record ?? {}, src = p.avatar?.url_small ?? p.image
    const links = [
      p.github_login && `<a href="https://github.com/${esc(p.github_login)}" rel=noreferrer>github/${esc(p.github_login)}</a>`,
      p.x?.url && `<a href="${esc(p.x.url)}" rel=noreferrer>x/${esc(p.x.username)}</a>`,
      p.discord?.url && `<a href="${esc(p.discord.url)}" rel=noreferrer>discord/${esc(p.discord.username)}</a>`,
      p.wallet?.explorer_url && `<a href="${esc(p.wallet.explorer_url)}" rel=noreferrer>wallet ${esc(p.wallet.address.slice(0, 4))}…${esc(p.wallet.address.slice(-4))}</a>`,
    ].filter(Boolean).join(' · ')
    const stats = [['Entered', r.competitions_entered], ['Placed', r.competitions_placed], ['Won', r.competitions_won], ['Podiums', r.podium_finishes], ['Best place', r.best_placement ? '#' + r.best_placement : '–'], ['Prizes', usd(r.prize_usd ?? 0)]]
    const entries = (p.solutions ?? []).slice(0, compact ? 4 : 200)
    if (!compact) document.title = `@${p.handle} · Mission Control`
    el.innerHTML = `${compact ? '<h2>Entrant</h2>' : ''}<div class=who>${src ? `<img crossorigin=anonymous alt="" width=48 height=48 src="${esc(src.startsWith('/') ? 'https://make.fun' + src : src)}">` : ''}
<div><h1>@${esc(p.handle)}${p.house ? ' <span class="chip time">HOUSE</span>' : ''}</h1><small>${esc(p.display_name ?? '')} joined ${when(p.joined_at).slice(0, 6)}</small></div></div>
${p.bio ? `<p>${esc(p.bio)}</p>` : ''}${links ? `<p>${links}</p>` : ''}
${compact ? `<dl>${stats.map(([k, v]) => `<dt>${k}</dt><dd><b>${v ?? 0}</b></dd>`).join('')}</dl>` : `<div class=kpis>${stats.slice(0, 3).concat(stats.slice(4)).map(([k, v]) => `<div class=kpi><small>${k.toUpperCase()}</small><b${k == 'Prizes' ? ' class=pot' : ''}>${v ?? 0}</b></div>`).join('')}</div>`}
<h2 style=margin-top:10px>Entries · ${(p.solutions ?? []).length}</h2>
${entries.map(s => `<p><a href="#/b/${esc(s.competition.slug)}">${esc(s.competition.title)}</a>${compact ? '' : `<br><span class=dim>${esc(s.title)}</span>`}<br>
<small>${s.placement ? `<b class=time>#${s.placement}</b> · ` : ''}${s.score ? `${esc(s.score.column?.title ?? 'score')} <b>${esc(score(s.score.column, s.score.value, s.score.display))}</b> · ` : ''}${s.prize_usd ? `<b class=pot>${usd(s.prize_usd)}</b> · ` : ''}${when(s.entered_at).slice(0, compact ? 6 : 99)}</small></p>`).join('') || '<p class=dim>No public entries yet.</p>'}
${compact ? `<a href="#/u/${esc(p.handle)}">Open full profile →</a>` : payouts(p.payouts ?? [])}`
    ready()
  }, compact ? e => { el.innerHTML = `<h2>Entrant</h2><p class=over>${esc(e.message)}</p>` } : undefined)
}

const payouts = list => list.length ? `<h2 style=margin-top:14px>Payouts · ${list.length}</h2><table>${list.map(x => `<tr><td><b class=pot>${usd(x.amount_usd)}</b> <small>#${x.place ?? '–'}</small> <a href="#/b/${esc(x.competition?.slug)}">${esc(x.competition?.title)}</a></td><td class=wide><a href="${esc(x.explorer_url)}" rel=noreferrer>${when(x.paid_at)} ↗</a></td></tr>`).join('')}</table>` : ''

// #/u with no handle: ask for one instead of showing an empty page.
function lookup() {
  mark('nu')
  document.title = 'Find an account · Mission Control'
  view.innerHTML = `<div class=panel><h1>Find an account</h1><p class=dim>Type a make.fun handle, or pick an entrant from any leaderboard.</p>
<form class=bar><input name=h placeholder="handle ( / )" aria-label="make.fun handle" required><button>Open profile</button></form></div>`
  view.querySelector('form').onsubmit = e => {
    e.preventDefault()
    location.hash = `#/u/${encodeURIComponent(e.target.h.value.trim().replace(/^@/, ''))}`
  }
  ready()
}
