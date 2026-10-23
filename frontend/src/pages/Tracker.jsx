import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, ExternalLink, Trash2, Loader2, MapPin, CalendarClock,
  Send, MessageSquare, Trophy, BellRing, KanbanSquare, AlertCircle,
} from 'lucide-react';
import {
  fetchApplications, createApplication, updateApplication, deleteApplication,
  addInterview, deleteInterview,
} from '../api/applicationApi.js';

// ── Stages ────────────────────────────────────────────────────────
const STAGES = [
  { key: 'saved',      label: 'Saved',      color: 'text-slate-300 bg-fg/5 border-fg/10' },
  { key: 'applied',    label: 'Applied',    color: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
  { key: 'screening',  label: 'Screening',  color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  { key: 'assessment', label: 'Assessment', color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  { key: 'interview',  label: 'Interview',  color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  { key: 'offer',      label: 'Offer',      color: 'text-green-300 bg-green-500/10 border-green-500/20' },
  { key: 'closed',     label: 'Closed',     color: 'text-red-300 bg-red-500/10 border-red-500/20' },
];
const STATUS_OPTIONS = [
  ...STAGES.filter((s) => s.key !== 'closed').map(({ key, label }) => ({ key, label })),
  { key: 'rejected',  label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
];
const CLOSED = ['rejected', 'withdrawn'];
const stageOf  = (status) => (CLOSED.includes(status) ? 'closed' : status);
const labelOf  = (status) => STATUS_OPTIONS.find((s) => s.key === status)?.label || status;
const colorOf  = (status) => STAGES.find((s) => s.key === stageOf(status))?.color;

// ── Dates (DATE columns arrive as 'YYYY-MM-DD') ───────────────────
const toLocalDate = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysFromToday = (ymd) => {
  const d = toLocalDate(ymd);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};
const fmtDate = (ymd) => toLocalDate(ymd)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) || '';
const fmtBDT  = (n) => (n ? `৳${Number(n).toLocaleString('en-IN')}` : '');

const followUpBadge = (app) => {
  if (!app.follow_up_date || CLOSED.includes(app.status) || app.status === 'offer') return null;
  const days = daysFromToday(app.follow_up_date);
  if (days < 0)   return { text: `Follow up overdue ${-days}d`, cls: 'text-red-300 bg-red-500/10 border-red-500/20' };
  if (days === 0) return { text: 'Follow up today',             cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
  return            { text: `Follow up in ${days}d`,             cls: 'text-text-muted bg-fg/5 border-fg/10' };
};

// ── Stats strip ───────────────────────────────────────────────────
function StatsStrip({ stats }) {
  const items = [
    { label: 'Applied',        value: stats.applied,              icon: Send },
    { label: 'Response rate',  value: `${stats.response_rate}%`,  icon: MessageSquare },
    { label: 'Interviews',     value: stats.interviews,           icon: CalendarClock },
    { label: 'Offers',         value: stats.offers,               icon: Trophy },
    { label: 'Follow-ups due', value: stats.follow_ups_due,       icon: BellRing, warn: stats.follow_ups_due > 0 },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map(({ label, value, icon: Icon, warn }) => (
        <div key={label} className={`glass-card p-3 ${warn ? 'border-amber-500/30' : ''}`}>
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Icon className={`w-3.5 h-3.5 ${warn ? 'text-amber-400' : ''}`} /> {label}
          </div>
          <p className={`text-xl font-bold mt-1 ${warn ? 'text-amber-300' : 'text-text-primary'}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Application card ──────────────────────────────────────────────
function AppCard({ app, onOpen, onStatus }) {
  const badge = followUpBadge(app);
  return (
    <motion.div layout
      onClick={() => onOpen(app.id)}
      className="glass-card p-3 cursor-pointer border border-fg/8 hover:border-fg/20 transition-colors space-y-2"
    >
      <div>
        <p className="text-text-primary text-sm font-medium leading-snug">{app.job_title}</p>
        <p className="text-text-secondary text-xs mt-0.5">{app.company}</p>
        {app.location && (
          <p className="text-text-muted text-xs mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {app.applied_date && <span className="text-[11px] text-text-muted">Applied {fmtDate(app.applied_date)}</span>}
        {app.status === 'offer' && app.offer_salary_bdt && (
          <span className="text-[11px] px-1.5 py-0.5 rounded border text-green-300 bg-green-500/10 border-green-500/20">{fmtBDT(app.offer_salary_bdt)}</span>
        )}
        {badge && <span className={`text-[11px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.text}</span>}
        {app.is_expired && <span className="text-[11px] text-text-muted">· listing closed</span>}
      </div>
      <select
        value={app.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatus(app.id, e.target.value)}
        className="input-field w-full text-xs py-1.5"
        aria-label="Change status"
      >
        {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </motion.div>
  );
}

// ── Interviews (inside the detail panel) ──────────────────────────
const ROUNDS = [
  { key: 'phone',      label: 'Phone screen' },
  { key: 'technical',  label: 'Technical' },
  { key: 'assessment', label: 'Assessment / test' },
  { key: 'hr',         label: 'HR' },
  { key: 'final',      label: 'Final' },
  { key: 'other',      label: 'Other' },
];
const roundLabel = (k) => ROUNDS.find((r) => r.key === k)?.label || 'Interview';
const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
});

function InterviewsSection({ app }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ when: '', roundType: 'technical', prepNotes: '' });
  const interviews = Array.isArray(app.interviews) ? app.interviews : [];
  const now = Date.now();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['applications'] });
    qc.invalidateQueries({ queryKey: ['next-interview'] });
  };
  const addMut = useMutation({
    // datetime-local is the user's local time; send it as an absolute instant
    mutationFn: () => addInterview(app.id, {
      scheduledAt: new Date(form.when).toISOString(),
      roundType:   form.roundType,
      prepNotes:   form.prepNotes,
    }),
    onSuccess: () => { refresh(); setAdding(false); setForm({ when: '', roundType: 'technical', prepNotes: '' }); },
  });
  const delMut = useMutation({ mutationFn: deleteInterview, onSuccess: refresh });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-xs">Interviews</p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-brand-cyan flex items-center gap-1 hover:underline">
            <Plus className="w-3 h-3" /> Add interview
          </button>
        )}
      </div>

      {interviews.length === 0 && !adding && (
        <p className="text-text-muted text-xs">No interviews scheduled for this application.</p>
      )}
      {interviews.map((iv) => {
        const past = new Date(iv.scheduled_at).getTime() < now - 60 * 60 * 1000;
        return (
          <div key={iv.id} className={`flex items-start gap-2 p-2.5 rounded-lg border ${past ? 'border-fg/5 opacity-60' : 'border-amber-500/20 bg-amber-500/5'}`}>
            <CalendarClock className={`w-4 h-4 mt-0.5 shrink-0 ${past ? 'text-text-muted' : 'text-amber-300'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-xs font-medium">{roundLabel(iv.round_type)} · {fmtDateTime(iv.scheduled_at)}</p>
              {iv.prep_notes && <p className="text-text-muted text-xs mt-0.5 whitespace-pre-line">{iv.prep_notes}</p>}
            </div>
            <button type="button" title="Remove interview"
              onClick={() => { if (window.confirm('Remove this interview?')) delMut.mutate(iv.id); }}
              className="p-1 rounded text-red-400 hover:bg-red-500/10">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {adding && (
        <div className="p-3 rounded-lg border border-fg/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" className="input-field w-full text-xs" value={form.when}
              onChange={(e) => setForm((f) => ({ ...f, when: e.target.value }))} />
            <select className="input-field w-full text-xs" value={form.roundType}
              onChange={(e) => setForm((f) => ({ ...f, roundType: e.target.value }))}>
              {ROUNDS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <textarea rows={2} className="input-field w-full text-xs" placeholder="Prep notes (who, where, what to revise…)"
            value={form.prepNotes} onChange={(e) => setForm((f) => ({ ...f, prepNotes: e.target.value }))} />
          {addMut.isError && <p className="text-red-400 text-xs">Could not save the interview. Check the date and time.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAdding(false); addMut.reset(); }}
              className="flex-1 py-1.5 rounded-lg border border-fg/10 text-text-secondary text-xs">Cancel</button>
            <button type="button" disabled={!form.when || addMut.isPending} onClick={() => addMut.mutate()}
              className="flex-1 btn-primary py-1.5 text-xs flex items-center justify-center gap-1 disabled:opacity-50">
              {addMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Save interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────
function DetailPanel({ app, onClose, onSave, onDelete, saving }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    setForm({
      status:         app.status,
      appliedDate:    app.applied_date?.slice(0, 10) || '',
      followUpDate:   app.follow_up_date?.slice(0, 10) || '',
      offerSalaryBdt: app.offer_salary_bdt || '',
      notes:          app.notes || '',
    });
    // Only when a different application opens — a background refetch
    // (e.g. returning to the tab) must not wipe unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);
  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const history = Array.isArray(app.history) ? [...app.history].reverse() : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }}
        className="w-full max-w-md h-full bg-bg-secondary border-l border-fg/8 flex flex-col">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-fg/8">
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-bold leading-snug">{app.job_title}</p>
            <p className="text-text-secondary text-sm">{app.company}{app.location ? ` · ${app.location}` : ''}</p>
            {app.job_url && (
              <a href={app.job_url} target="_blank" rel="noopener noreferrer"
                className="text-brand-cyan text-xs inline-flex items-center gap-1 mt-1 hover:underline">
                View job posting <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-fg/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-text-secondary text-xs">Status</span>
            <select className="input-field w-full text-sm" value={form.status} onChange={set('status')}>
              {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-text-secondary text-xs">Applied on</span>
              <input type="date" className="input-field w-full text-sm" value={form.appliedDate} onChange={set('appliedDate')} />
            </label>
            <label className="block space-y-1">
              <span className="text-text-secondary text-xs">Follow up on</span>
              <input type="date" className="input-field w-full text-sm" value={form.followUpDate} onChange={set('followUpDate')} />
            </label>
          </div>
          {form.status === 'offer' && (
            <label className="block space-y-1">
              <span className="text-text-secondary text-xs">Offered salary (BDT / month)</span>
              <input type="number" min="0" className="input-field w-full text-sm" value={form.offerSalaryBdt}
                onChange={set('offerSalaryBdt')} placeholder="e.g. 60000" />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-text-secondary text-xs">Notes</span>
            <textarea rows={6} className="input-field w-full text-sm resize-y" value={form.notes} onChange={set('notes')}
              placeholder="Interview rounds, contact person, what they asked…" />
          </label>

          <InterviewsSection app={app} />

          {history.length > 0 && (
            <div className="space-y-2">
              <p className="text-text-secondary text-xs">Timeline</p>
              <ol className="space-y-1.5 border-l border-fg/10 pl-3">
                {history.map((h, i) => (
                  <li key={i} className="text-xs text-text-secondary">
                    <span className="text-text-primary font-medium">{labelOf(h.status)}</span>
                    <span className="text-text-muted"> · {new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-fg/8">
          <button onClick={() => { if (window.confirm('Remove this application from your tracker?')) onDelete(app.id); }}
            className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => onSave(app.id, { ...form, offerSalaryBdt: form.offerSalaryBdt ? Number(form.offerSalaryBdt) : null })}
            disabled={saving}
            className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
}

// ── Add (manual) modal ────────────────────────────────────────────
function AddModal({ onClose, onCreate, saving, error }) {
  const [form, setForm] = useState({ jobTitle: '', company: '', jobUrl: '', location: '', status: 'applied', notes: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSave = form.jobTitle.trim() && form.company.trim();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.form initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onSubmit={(e) => { e.preventDefault(); if (canSave) onCreate(form); }}
        className="glass-card w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-text-primary font-bold">Add an application</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-text-muted text-xs">For jobs you found outside CareerPilot. Jobs from your feed are added when you apply.</p>
        <input className="input-field w-full text-sm" placeholder="Job title *" value={form.jobTitle} onChange={set('jobTitle')} />
        <input className="input-field w-full text-sm" placeholder="Company *" value={form.company} onChange={set('company')} />
        <input className="input-field w-full text-sm" placeholder="Job link (optional)" value={form.jobUrl} onChange={set('jobUrl')} />
        <input className="input-field w-full text-sm" placeholder="Location (optional)" value={form.location} onChange={set('location')} />
        <select className="input-field w-full text-sm" value={form.status} onChange={set('status')}>
          {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <textarea rows={3} className="input-field w-full text-sm" placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={!canSave || saving}
          className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add to tracker
        </button>
      </motion.form>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function Tracker() {
  const qc = useQueryClient();
  const [openId, setOpenId]       = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [mobileStage, setMobileStage] = useState('applied');
  const [toast, setToast]         = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading, isError } = useQuery({ queryKey: ['applications'], queryFn: fetchApplications });
  const apps  = data?.applications || [];
  const stats = data?.stats || { applied: 0, response_rate: 0, interviews: 0, offers: 0, follow_ups_due: 0 };

  const byStage = useMemo(() => {
    const groups = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    for (const a of apps) groups[stageOf(a.status)]?.push(a);
    return groups;
  }, [apps]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['applications'] });
    qc.invalidateQueries({ queryKey: ['jobs'] });
    qc.invalidateQueries({ queryKey: ['next-interview'] }); // closing an application hides its interviews
    qc.invalidateQueries({ queryKey: ['closing-soon'] });
  };
  const errorMsg = (err, fallback) =>
    err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || fallback;

  const updateMut = useMutation({
    mutationFn: ({ id, fields }) => updateApplication(id, fields),
    onSuccess:  (_, { fromPanel }) => { refresh(); if (fromPanel) { setOpenId(null); showToast('Saved.'); } },
    onError:    (err) => showToast(errorMsg(err, 'Could not update. Please try again.'), 'error'),
  });
  const createMut = useMutation({
    mutationFn: createApplication,
    onSuccess:  () => { refresh(); setShowAdd(false); showToast('Added to your tracker.'); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteApplication,
    onSuccess:  () => { refresh(); setOpenId(null); showToast('Removed.'); },
  });

  // Moving a card to Interview opens it, so the date can be added right away
  const changeStatus = (id, status) => {
    updateMut.mutate({ id, fields: { status } });
    if (status === 'interview') setOpenId(id);
  };

  const openApp = apps.find((a) => a.id === openId);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-fg/8 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3 w-full">
          <div>
            <h1 className="text-text-primary font-bold text-xl">Application Tracker</h1>
            <p className="text-text-secondary text-xs mt-0.5">Every job you're pursuing, from saved to offer</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm shrink-0">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add application</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 py-6 space-y-6">
        <StatsStrip stats={stats} />

        {isLoading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-cyan" /></div>}
        {isError && (
          <div className="glass-card p-6 text-center text-red-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" /> Could not load your applications.
          </div>
        )}

        {!isLoading && !isError && apps.length === 0 && (
          <div className="glass-card p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mx-auto">
              <KanbanSquare className="w-6 h-6 text-brand-cyan" />
            </div>
            <p className="text-text-primary font-semibold">Nothing tracked yet</p>
            <p className="text-text-secondary text-sm max-w-sm mx-auto">
              Open a job and click <span className="text-text-primary">Apply Now</span> — it lands here automatically.
              Applied somewhere else? Add it manually.
            </p>
          </div>
        )}

        {!isLoading && apps.length > 0 && (
          <>
            {/* Mobile: one stage at a time */}
            <div className="md:hidden space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {STAGES.map((s) => (
                  <button key={s.key} onClick={() => setMobileStage(s.key)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors
                      ${mobileStage === s.key ? s.color : 'text-text-muted border-fg/10'}`}>
                    {s.label} · {byStage[s.key].length}
                  </button>
                ))}
              </div>
              {byStage[mobileStage].length === 0
                ? <p className="text-text-muted text-sm text-center py-8">No applications in this stage.</p>
                : byStage[mobileStage].map((a) => (
                    <AppCard key={a.id} app={a} onOpen={setOpenId}
                      onStatus={changeStatus} />
                  ))}
            </div>

            {/* Desktop: board */}
            <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((s) => (
                <div key={s.key} className="flex-1 min-w-[11.5rem] space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                    <span className="text-text-muted text-xs">{byStage[s.key].length}</span>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {byStage[s.key].map((a) => (
                      <AppCard key={a.id} app={a} onOpen={setOpenId}
                        onStatus={changeStatus} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {openApp && (
          <DetailPanel app={openApp} saving={updateMut.isPending}
            onClose={() => setOpenId(null)}
            onSave={(id, fields) => updateMut.mutate({ id, fields, fromPanel: true })}
            onDelete={(id) => deleteMut.mutate(id)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdd && (
          <AddModal saving={createMut.isPending}
            error={createMut.isError ? errorMsg(createMut.error, 'Could not add. Please try again.') : null}
            onClose={() => { setShowAdd(false); createMut.reset(); }}
            onCreate={(form) => createMut.mutate(form)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-24 md:bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium
              ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-green-500/20 border-green-500/30 text-green-400'}`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
