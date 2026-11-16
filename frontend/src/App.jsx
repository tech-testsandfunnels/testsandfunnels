/* App.jsx
   Top-level shell: checks the stored token and shows Login, or the dashboard
   (sidebar nav, top bar with search / new lead / theme, and the current view).
   Views are picked from the URL hash (#leads, #pipeline/training, ...), so
   the browser back button and bookmarks work. */
import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from './api';
import { StoreProvider, useStore } from './store';
import { DialogProvider, useDialog } from './dialogs';
import { Icon } from './ui';
import { metrics, isOpen } from './lib/derive';
import Overview from './views/Overview.jsx';
import Leads from './views/Leads.jsx';
import Pipeline from './views/Pipeline.jsx';
import Appointments from './views/Appointments.jsx';
import Team from './views/Team.jsx';
import Clients from './views/Clients.jsx';
import Reports from './views/Reports.jsx';
import Website from './views/Website.jsx';
import Settings from './views/Settings.jsx';

const TITLES = { overview: 'Overview', leads: 'Leads', pipeline: 'Pipelines', appointments: 'Appointments', clients: 'Clients', team: 'Team', reports: 'Reports', website: 'Website forms', settings: 'Settings' };
const LEAD_FILTER = { p: 'all', status: 'all', owner: 'all', src: 'all', sort: 'new', q: '' };

const parseHash = () => {
  const [v, arg] = location.hash.replace(/^#/, '').split('/');
  return { view: TITLES[v] ? v : 'overview', arg: arg || '' };
};

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { username, password } });
      setToken(token);
      onLogin();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <form onSubmit={submit}>
        <span className="logo">t<b>&amp;</b>f <small>CRM</small></span>
        <label className="field">Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label className="field">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </div>
  );
}

function Shell({ onLogout }) {
  const { S, error, toastMsg, reload } = useStore();
  const { open } = useDialog();
  const [route, setRoute] = useState(parseHash);
  const [navOpen, setNavOpen] = useState(false);
  const [leadFilter, setLeadFilter] = useState(LEAD_FILTER);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  useEffect(() => {
    const on = () => { setRoute(parseHash()); setNavOpen(false); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('tf-crm-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  /* Jump to a view, optionally with a leads filter ("idle", "call"). */
  const go = useCallback((v, f) => {
    if (v === 'leads' && f) setLeadFilter({ ...LEAD_FILTER, status: f });
    location.hash = '#' + v;
  }, []);

  if (!S.meta) {
    return (
      <div className="loading">
        {error ? <><p className="err">{error}</p><p><button className="btn" onClick={reload}>Try again</button> <button className="btn" onClick={onLogout}>Log out</button></p></> : 'Loading the CRM…'}
      </div>
    );
  }

  const m = metrics(S);
  const nav = [
    ['overview', 'grid'], ['h', 'Pipeline'],
    ['leads', 'funnel', S.leads.filter(isOpen).length],
    ['appointments', 'cal', m.req.length || m.apToday.length, m.req.length > 0],
    ['pipeline', 'rocket', m.decide.length],
    ['h', 'Delivery'], ['clients', 'brief', m.risk.length], ['team', 'users', m.overdue.length, true],
    ['h', 'Insights'], ['reports', 'chart'], ['website', 'screen'], ['settings', 'lock'],
  ];
  const pillar = S.meta.pillarKeys.includes(route.arg) ? route.arg : 'services';
  const V = route.view;

  return (
    <div className="app">
      <aside className={'side' + (navOpen ? ' open' : '')} aria-label="Main navigation">
        <a className="logo" href="#overview">t<b>&amp;</b>f <small>CRM</small></a>
        <nav className="nav">
          {nav.map((i, k) => (i[0] === 'h' ? <h6 key={k}>{i[1]}</h6> : (
            <a key={i[0]} href={'#' + i[0]} aria-current={V === i[0] ? 'page' : undefined}>
              <Icon n={i[1]} /><span>{TITLES[i[0]]}</span>
              {i[2] ? <span className={'cnt' + (i[3] ? ' hot' : '')}>{i[2]}</span> : null}
            </a>
          )))}
        </nav>
        <div className="me">
          <span className="av" aria-hidden="true">AD</span>
          <div><b>Admin</b><small><button className="link" style={{ color: 'inherit', background: 'none', border: 0, padding: 0 }} onClick={onLogout}>Log out</button></small></div>
        </div>
      </aside>
      <div className={'scrim' + (navOpen ? ' on' : '')} onClick={() => setNavOpen(false)} />
      <div className="main">
        <header className="top">
          <button className="icon-btn burger" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><Icon n="menu" /></button>
          <h1>{TITLES[V]}</h1>
          <span className="sp" />
          <label className="search">
            <span className="sr">Search leads</span><Icon n="search" />
            <input type="search" placeholder="Search leads, companies" autoComplete="off" value={leadFilter.q}
              onChange={(e) => { setLeadFilter({ ...leadFilter, q: e.target.value }); if (V !== 'leads') location.hash = '#leads'; }} />
          </label>
          <button className="btn primary" onClick={() => open('new-lead')}><Icon n="plus" /><span className="lbl">New lead</span></button>
          <button className="icon-btn" aria-label="Switch light or dark theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon n={theme === 'dark' ? 'sun' : 'moon'} /></button>
        </header>
        <main className="content" tabIndex={-1}>
          {error && <div className="banner-err">{error} <button className="btn sm" onClick={reload}>Retry</button></div>}
          {V === 'overview' && <Overview go={go} />}
          {V === 'leads' && <Leads filter={leadFilter} setFilter={setLeadFilter} />}
          {V === 'pipeline' && <Pipeline pillar={pillar} setPillar={(p) => { location.hash = '#pipeline/' + p; }} />}
          {V === 'appointments' && <Appointments />}
          {V === 'clients' && <Clients />}
          {V === 'team' && <Team />}
          {V === 'reports' && <Reports />}
          {V === 'website' && <Website />}
          {V === 'settings' && <Settings key={S.settings ? 'loaded' : 'empty'} />}
        </main>
      </div>
      <div className="toast" role="status" aria-live="polite" hidden={!toastMsg}>{toastMsg}</div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  const logout = useCallback(() => { clearToken(); setAuthed(false); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api('/auth/verify').then(() => setAuthed(true)).catch(() => clearToken()).finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="loading">Loading…</div>;
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return (
    <StoreProvider>
      <DialogProvider>
        <Shell onLogout={logout} />
      </DialogProvider>
    </StoreProvider>
  );
}
