/* store.jsx
   One place that loads and holds every list the dashboard shows (leads,
   appointments, team, tasks, clients, attendance, settings, meta) and wraps
   each API change so the screen updates right after the server confirms it.
   Views read from useStore(); nothing is kept only in the browser. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const EMPTY = { leads: [], appts: [], team: [], tasks: [], clients: [], att: [], settings: null, meta: null };

export function StoreProvider({ children }) {
  const [S, setS] = useState(EMPTY);
  const [error, setError] = useState('');
  const [toastMsg, setToast] = useState('');
  const tt = useRef(null);

  const toast = useCallback((m) => {
    setToast(m);
    clearTimeout(tt.current);
    tt.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const load = useCallback(async () => {
    try {
      const [meta, leads, appts, team, tasks, clients, att, settings] = await Promise.all([
        api('/meta'), api('/leads'), api('/appointments'), api('/team'), api('/tasks'), api('/clients'), api('/attendance'), api('/settings'),
      ]);
      setS({ meta, leads: leads.leads, appts: appts.appointments, team: team.items, tasks: tasks.items, clients: clients.items, att: att.items, settings });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Refresh every minute so new website leads and bookings show up. */
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const [leads, appts] = await Promise.all([api('/leads'), api('/appointments')]);
        setS((s) => ({ ...s, leads: leads.leads, appts: appts.appointments }));
      } catch { /* keep showing what we have */ }
    }, 60000);
    return () => clearInterval(t);
  }, []);

  /* Run an API call, report errors as a toast, return the result (or null). */
  const run = useCallback(async (fn, okMsg) => {
    try {
      const r = await fn();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
      return r || true;
    } catch (e) {
      toast(e.message);
      return null;
    }
  }, [toast]);

  const upsert = (key, idKey, item) =>
    setS((s) => {
      const list = s[key];
      const i = list.findIndex((x) => x[idKey] === item[idKey]);
      return { ...s, [key]: i < 0 ? [item, ...list] : list.map((x, j) => (j === i ? item : x)) };
    });
  const drop = (key, idKey, id) => setS((s) => ({ ...s, [key]: s[key].filter((x) => x[idKey] !== id) }));

  const actions = useMemo(() => ({
    reload: load,
    /* leads */
    saveLead: async (id, patch, msg) => {
      const r = await run(() => (id ? api('/leads/' + id, { method: 'PUT', body: patch }) : api('/leads', { method: 'POST', body: patch })), msg);
      if (r && r.lead) upsert('leads', 'leadId', r.lead);
      return r && r.lead;
    },
    deleteLead: async (id) => {
      const r = await run(() => api('/leads/' + id, { method: 'DELETE' }), 'Lead deleted');
      if (r) { drop('leads', 'leadId', id); setS((s) => ({ ...s, appts: s.appts.filter((a) => !(a.lead && a.lead.leadId === id)) })); }
      return r;
    },
    /* appointments */
    saveAppt: async (id, patch, msg) => {
      const r = await run(() => (id ? api('/appointments/' + id, { method: 'PUT', body: patch }) : api('/appointments', { method: 'POST', body: patch })), msg);
      if (r && r.appointment) {
        upsert('appts', 'apptId', r.appointment);
        const l = r.appointment.lead;
        if (l) setS((s) => ({ ...s, leads: s.leads.map((x) => (x.leadId === l.leadId ? { ...x, lastTouchAt: new Date().toISOString() } : x)) }));
      }
      return r && r.appointment;
    },
    confirmAll: async () => {
      const r = await run(() => api('/appointments/confirm-all', { method: 'POST' }), (x) => x.confirmed + ' website appointment' + (x.confirmed === 1 ? '' : 's') + ' confirmed');
      if (r) load();
    },
    deleteAppt: async (id) => {
      const r = await run(() => api('/appointments/' + id, { method: 'DELETE' }), 'Appointment deleted');
      if (r) drop('appts', 'apptId', id);
    },
    /* generic lists: team, tasks, clients */
    save: async (key, path, id, body, msg) => {
      const r = await run(() => (id ? api(path + '/' + id, { method: 'PUT', body }) : api(path, { method: 'POST', body })), msg);
      if (r && r.item) upsert(key, '_id', r.item);
      return r && r.item;
    },
    remove: async (key, path, id, msg) => {
      const r = await run(() => api(path + '/' + id, { method: 'DELETE' }), msg);
      if (r) drop(key, '_id', id);
    },
    mark: async (member, status, date) => {
      const r = await run(() => api('/attendance', { method: 'PUT', body: { member, status, date } }));
      if (!r) return;
      const d = date || (S.meta && S.meta.today);
      setS((s) => ({ ...s, att: [...s.att.filter((a) => !(a.member === member && a.date === (r.item ? r.item.date : d))), ...(r.item ? [r.item] : [])] }));
    },
    saveSettings: async (body) => {
      const r = await run(() => api('/settings', { method: 'PUT', body }), 'Settings saved');
      if (r) setS((s) => ({ ...s, settings: { ...s.settings, ...body } }));
      return r;
    },
  }), [load, run, S.meta]);

  return <Ctx.Provider value={{ S, error, toast, toastMsg, ...actions }}>{children}</Ctx.Provider>;
}
