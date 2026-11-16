/* Leads.jsx — every lead from all four pillars in one list. Filter by
   pillar/status/owner/source, search, change the stage inline, open a lead
   for details, export the filtered list as CSV. */
import { useState } from 'react';
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, PillTag, St, Chip } from '../ui';
import { isOpen, isIdle, idleDays } from '../lib/derive';
import { inr, relD, dayOf, istDate, download } from '../lib/format';

const STATUS = [['all', 'All statuses'], ['open', 'Open'], ['idle', 'Idle 3+ days'], ['call', 'Website: call them'], ['won', 'Won, enrolled or onboarded'], ['lost', 'Lost or declined']];

export default function Leads({ filter, setFilter }) {
  const { S, saveLead, toast } = useStore();
  const { open } = useDialog();
  const meta = S.meta, P = meta.pillars;
  const f = filter;
  const [limit, setLimit] = useState(25);
  const set = (k, v) => { setFilter({ ...f, [k]: v }); setLimit(25); };
  const owner = (id) => (S.team.find((t) => t._id === id) || {}).name || 'Unassigned';
  const sources = Array.from(new Set([...meta.sources, ...S.leads.map((l) => l.source)])).filter(Boolean);

  const q = (f.q || '').trim().toLowerCase();
  let r = S.leads.filter((l) => (f.p === 'all' || l.pillar === f.p) && (f.owner === 'all' || (f.owner === 'none' ? !l.owner : l.owner === f.owner)) && (f.src === 'all' || l.source === f.src));
  if (f.status === 'open') r = r.filter(isOpen);
  else if (f.status === 'idle') r = r.filter(isIdle);
  else if (f.status === 'call') r = r.filter((l) => isOpen(l) && l.appointmentSkipped);
  else if (f.status === 'won') r = r.filter((l) => l.stage === 4);
  else if (f.status === 'lost') r = r.filter((l) => l.stage === 5);
  if (q) r = r.filter((l) => [l.name, l.company, l.leadId, l.source, l.phone, l.email, l.industry].join(' ').toLowerCase().includes(q));
  r = r.slice();
  if (f.sort === 'idle') r.sort((a, b) => isOpen(b) - isOpen(a) || idleDays(b) - idleDays(a));
  else if (f.sort === 'value') r.sort((a, b) => (b.value || 0) - (a.value || 0));
  const shown = r.slice(0, limit);

  function exportCsv() {
    const c = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = r.map((l) => {
      const a = l.attribution || {};
      return [l.leadId, l.name, l.company, l.phone, l.email, P[l.pillar].name, l.source, P[l.pillar].stages[l.stage], l.value || 0, owner(l.owner), istDate(l.createdAt), istDate(l.lastTouchAt || l.updatedAt), l.nextAction, a.utm_source, a.utm_medium, a.utm_campaign, a.source_page].map(c).join(',');
    });
    download('tf-leads-' + istDate() + '.csv', ['ID,Name,Company,Phone,Email,Pillar,Source,Stage,Value,Owner,Created,Last touch,Next action,UTM source,UTM medium,UTM campaign,Form page'].concat(rows).join('\n'), 'text/csv');
    toast('Exported ' + r.length + ' leads');
  }

  return (
    <>
      <Head title="Leads" sub="Every lead from all four pillars in one list. Change the stage right in the row; click a name for details.">
        <button className="btn" onClick={exportCsv}><Icon n="down" /> Export CSV</button>
        <button className="btn primary" onClick={() => open('new-lead')}><Icon n="plus" /> New lead</button>
      </Head>
      <section className="card">
        <div className="chips" style={{ marginBottom: 12 }} role="group" aria-label="Filter by pillar">
          <Chip on={f.p === 'all'} onClick={() => set('p', 'all')}>All <span className="num" style={{ opacity: 0.8 }}>{S.leads.length}</span></Chip>
          {meta.pillarKeys.map((p) => (
            <Chip key={p} p={p} on={f.p === p} onClick={() => set('p', p)}>{P[p].name} <span className="num" style={{ opacity: 0.8 }}>{S.leads.filter((l) => l.pillar === p).length}</span></Chip>
          ))}
        </div>
        <div className="tools">
          <label className="search"><span className="sr">Search leads</span><Icon n="search" /><input type="search" placeholder="Search name, company, phone, ID" value={f.q} onChange={(e) => set('q', e.target.value)} autoComplete="off" /></label>
          <select className="sel" aria-label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUS.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select>
          <select className="sel" aria-label="Owner" value={f.owner} onChange={(e) => set('owner', e.target.value)}>
            <option value="all">All owners</option><option value="none">Unassigned</option>
            {S.team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <select className="sel" aria-label="Source" value={f.src} onChange={(e) => set('src', e.target.value)}>
            <option value="all">All sources</option>{sources.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="sel" aria-label="Sort" value={f.sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="new">Newest first</option><option value="idle">Longest idle</option><option value="value">Highest value</option>
          </select>
        </div>
        {r.length === 0 ? (
          <p className="empty">{S.leads.length ? 'No leads match these filters.' : 'No leads yet. Website form submissions land here, or add one with "New lead".'}</p>
        ) : (
          <>
            <div className="tw">
              <table className="t rt">
                <thead><tr><th>Lead</th><th>Pillar</th><th>Source</th><th>Stage</th><th className="r">Value</th><th>Owner</th><th>Last touch</th></tr></thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.leadId}>
                      <td className="first">
                        <button className="rowbtn" onClick={() => open('lead', { id: l.leadId })}>{l.name}</button>
                        <span className="sub">{l.company || l.phone || l.email}{l.nextAction && isOpen(l) ? ' · ' + l.nextAction : ''}</span>
                      </td>
                      <td data-l="Pillar"><PillTag p={l.pillar} meta={meta} /></td>
                      <td data-l="Source">{l.source}</td>
                      <td data-l="Stage">
                        <select className="sel" aria-label={'Stage for ' + l.name} value={l.stage} onChange={(e) => saveLead(l.leadId, { stage: +e.target.value }, l.name + ' moved to ' + P[l.pillar].stages[+e.target.value])}>
                          {P[l.pillar].stages.map((s, i) => <option key={s} value={i}>{s}</option>)}
                        </select>
                      </td>
                      <td data-l="Value" className="r num">{l.value ? inr(l.value) : '–'}</td>
                      <td data-l="Owner">{owner(l.owner)}</td>
                      <td data-l="Last touch">{isIdle(l) ? <St k="warn">{idleDays(l)} days idle</St> : relD(dayOf(l.lastTouchAt || l.updatedAt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Showing {shown.length} of {r.length}.{r.length > shown.length && <> <button className="link" onClick={() => setLimit(limit + 25)}>Show 25 more</button></>}</p>
          </>
        )}
      </section>
    </>
  );
}
