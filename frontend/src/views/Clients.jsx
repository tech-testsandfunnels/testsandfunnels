/* Clients.jsx — active clients, their health (with the reason) and open tasks. */
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, PillTag } from '../ui';
import { HealthSt } from './Overview';
import { inr, sum, fDW, dayDiff, relD } from '../lib/format';

export default function Clients() {
  const { S } = useStore();
  const { open } = useDialog();
  const meta = S.meta;
  const owner = (id) => (S.team.find((t) => t._id === id) || {}).name || '–';
  return (
    <>
      <Head title="Clients" sub="Active clients, their health and what is open for them. Health is set by the account manager, with a reason.">
        <button className="btn primary" onClick={() => open('client')}><Icon n="plus" /> New client</button>
      </Head>
      <section className="card">
        {S.clients.length ? (
          <>
            <div className="tw">
              <table className="t rt">
                <thead><tr><th>Client</th><th>Pillar</th><th className="r">Monthly fee</th><th>Health</th><th>Why</th><th>Manager</th><th className="r">Open tasks</th><th>Last report</th><th>Next review</th></tr></thead>
                <tbody>
                  {S.clients.map((c) => (
                    <tr key={c._id}>
                      <td className="first"><button className="rowbtn" onClick={() => open('client', { client: c })}>{c.name}</button><span className="sub">{c.service}</span></td>
                      <td data-l="Pillar"><PillTag p={c.pillar} meta={meta} /></td>
                      <td data-l="Monthly fee" className="r num">{inr(c.monthlyFee)}</td>
                      <td data-l="Health"><HealthSt h={c.health} /></td>
                      <td data-l="Why">{c.healthWhy}</td>
                      <td data-l="Manager">{owner(c.manager)}</td>
                      <td data-l="Open tasks" className="r num">{S.tasks.filter((t) => t.area === c.name && t.status !== 'done').length}</td>
                      <td data-l="Last report">{c.lastReport ? relD(dayDiff(c.lastReport)) : '–'}</td>
                      <td data-l="Next review">{c.nextReview ? fDW(c.nextReview) : 'Not booked'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Total monthly fees across these {S.clients.length} clients: <b>{inr(sum(S.clients.map((c) => c.monthlyFee || 0)))}</b>. Tasks count as open for a client when the task's "Client or area" matches the client name.</p>
          </>
        ) : <p className="empty">No clients yet. Add one here, or open a won lead and press "Add as client".</p>}
      </section>
    </>
  );
}
