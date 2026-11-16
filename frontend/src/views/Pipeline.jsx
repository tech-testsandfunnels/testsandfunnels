/* Pipeline.jsx — a board per pillar (Services, Production house, Training,
   Incube8). Open stages are columns; move a card forward or back, or close
   it as won or lost. Won and lost leads are listed below with "Reopen". */
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, Chip } from '../ui';
import { relD, dayOf, inr } from '../lib/format';

export default function Pipeline({ pillar, setPillar }) {
  const { S, saveLead } = useStore();
  const { open } = useDialog();
  const meta = S.meta, st = meta.pillars[pillar].stages;
  const ls = S.leads.filter((l) => l.pillar === pillar);
  const owner = (id) => (S.team.find((t) => t._id === id) || {}).name || 'Unassigned';
  const mv = (l, to) => saveLead(l.leadId, { stage: to }, l.name + ' moved to ' + st[to]);
  const closed = (i) => ls.filter((l) => l.stage === i);

  return (
    <>
      <Head title={meta.pillars[pillar].name + ' pipeline'} sub="Move a card along with the buttons. Click a name for the full lead.">
        <button className="btn primary" onClick={() => open('new-lead')}><Icon n="plus" /> New lead</button>
      </Head>
      <div className="chips" style={{ marginBottom: 16 }} role="group" aria-label="Choose a pipeline">
        {meta.pillarKeys.map((p) => <Chip key={p} p={p} on={p === pillar} onClick={() => setPillar(p)}>{meta.pillars[p].name}</Chip>)}
      </div>
      <div className="board" aria-label={meta.pillars[pillar].name + ' leads by stage'}>
        {[0, 1, 2, 3].map((i) => {
          const c = ls.filter((l) => l.stage === i);
          return (
            <div className="col" key={i}>
              <h4><i className="dot" style={{ '--pc': 'var(--c-' + pillar + ')' }} />{st[i]}<span className="n num">{c.length}</span></h4>
              {c.length ? c.map((l) => (
                <div className="kc" key={l.leadId}>
                  <b><button className="rowbtn" onClick={() => open('lead', { id: l.leadId })}>{l.name}</button></b>
                  <small>{l.company || l.phone || l.email}</small>
                  <div className="row"><span className="pill">{l.source}</span>{l.value ? <span className="pill num">{inr(l.value)}</span> : null}</div>
                  <small>Last touch: {relD(dayOf(l.lastTouchAt || l.updatedAt))} · {owner(l.owner)}</small>
                  {l.nextAction && <small>Next: {l.nextAction}</small>}
                  <div className="mv">
                    <button className="btn sm primary" onClick={() => mv(l, i + 1)}>{i === 3 ? st[4] : 'Move to ' + st[i + 1]} <Icon n="right" /></button>
                    {i > 0 && <button className="btn sm" onClick={() => mv(l, i - 1)} aria-label={'Move back to ' + st[i - 1]}><Icon n="left" /> Back</button>}
                    <button className="btn sm danger" onClick={() => mv(l, 5)}>{st[5]}</button>
                  </div>
                </div>
              )) : <p className="empty" style={{ padding: '6px 4px' }}>None</p>}
            </div>
          );
        })}
      </div>
      <div className="grid" style={{ marginTop: 16 }}>
        {[4, 5].map((i) => (
          <section className="card s6" key={i}>
            <div className="chead"><div><h3>{st[i]}</h3><p className="csub">{closed(i).length} {closed(i).length === 1 ? 'lead' : 'leads'}</p></div></div>
            <div className="list">
              {closed(i).length ? closed(i).map((l) => (
                <div className="li" key={l.leadId}>
                  <div className="mid"><b><button className="rowbtn" onClick={() => open('lead', { id: l.leadId })}>{l.name}</button></b><small>{l.company}{l.value ? ' · ' + inr(l.value) : ''}</small></div>
                  <button className="btn sm" onClick={() => mv(l, i === 4 ? 3 : 0)}>Reopen</button>
                </div>
              )) : <p className="empty">None yet.</p>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
