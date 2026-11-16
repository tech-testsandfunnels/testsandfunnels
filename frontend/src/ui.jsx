/* ui.jsx — small shared pieces: icons, pills, status badges, the modal
   dialog, form fields, view header, KPI card and horizontal bars. Class names
   come from crm.css. */
import { useEffect, useRef } from 'react';

export const Icon = ({ n, cls, style }) => (
  <svg className={'ic' + (cls ? ' ' + cls : '')} aria-hidden="true" style={style}><use href={'#i-' + n} /></svg>
);

export const PillTag = ({ p, meta, go }) => (
  <span className={'pill p-' + p + (go ? ' go' : '')}><i className="dot" />{meta.pillars[p] ? meta.pillars[p].name : p}</span>
);

export const Avatar = ({ name }) => <span className="av" title={name}>{String(name || '?').replace(/^Dr\.?\s+/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>;

export const St = ({ k = 'neutral', children }) => <span className={'st ' + k}>{children}</span>;

export const APPT_BADGE = {
  requested: ['acc', 'Requested on website'],
  confirmed: ['good', 'Confirmed'],
  done: ['good', 'Done'],
  noshow: ['crit', 'No-show'],
  cancelled: ['neutral', 'Cancelled'],
};

export function Head({ title, sub, children }) {
  return (
    <div className="vhead">
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {children && <div className="acts">{children}</div>}
    </div>
  );
}

export function Kpi({ href, lab, val, sub, extra, span = 's2' }) {
  const Tag = href ? 'a' : 'div';
  return (
    <Tag className={'card kpi ' + span} href={href ? '#' + href : undefined}>
      <span className="lab">{lab}</span>
      <span className="val num">{val}</span>
      <span className="sub">{extra}{sub}</span>
    </Tag>
  );
}

export function Delta({ a, b }) {
  const d = a - b;
  return <span className={'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat')}>{d > 0 ? '+' + d : d}</span>;
}

export function HBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows.map((r) => (
    <div className="hbar" key={r[0]}>
      <span>{r[0]}</span>
      <div className="track" aria-hidden="true"><i style={{ width: Math.max(2, Math.round((r[1] * 100) / max)) + '%' }} /></div>
      <b className="num">{r[1]}</b>
    </div>
  ));
}

/* Native <dialog>: Esc and backdrop click close it. */
export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal ? d.showModal() : d.setAttribute('open', '');
    const f = d && d.querySelector('input:not([type=hidden]),select,textarea');
    if (f && matchMedia('(min-width:700px)').matches) f.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={typeof title === 'string' ? title : undefined}
      style={wide ? { width: 'min(760px, calc(100vw - 24px))' } : undefined}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="dlg">
        <button className="icon-btn x" type="button" onClick={onClose} aria-label="Close"><Icon n="x" /></button>
        <h3 style={{ paddingRight: 44 }}>{title}</h3>
        {children}
      </div>
    </dialog>
  );
}

export const Field = ({ label, full, children }) => (
  <label className={'field' + (full ? ' full' : '')}>{label}{children}</label>
);

export const Foot = ({ onCancel, label, busy }) => (
  <div className="foot full">
    <button className="btn" type="button" onClick={onCancel}>Cancel</button>
    <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : label}</button>
  </div>
);

export const Chip = ({ on, p, onClick, children }) => (
  <button type="button" className={'chip' + (p ? ' p-' + p : '')} aria-pressed={!!on} onClick={onClick}>
    {p && <i className="dot" />}{children}
  </button>
);
