import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Download, Plus, Trash2, Loader2, Lightbulb, AlertCircle } from 'lucide-react';
import { getCVRewrite, updateCVRewrite } from '../../api/cvApi.js';

// ── PDF via the browser's print dialog ("Save as PDF") ────────────
const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildPrintHTML = (cv) => {
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, ...cv.contact.links].filter(Boolean);
  const section = (title, body) => (body ? `<h2>${title}</h2>${body}` : '');
  const bullets = (items) => (items.length ? `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cv.name || 'CV')}</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  h1 { font-size: 20pt; margin: 0; }
  .headline { font-size: 11.5pt; color: #333; margin-top: 2px; }
  .contact { font-size: 9.5pt; color: #444; margin-top: 4px; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #999; padding-bottom: 2px; margin: 14px 0 6px; }
  .row { display: flex; justify-content: space-between; gap: 12px; }
  .role { font-weight: 700; }
  .meta { color: #444; font-size: 9.5pt; white-space: nowrap; }
  .sub { color: #333; font-style: italic; }
  ul { margin: 3px 0 8px 18px; padding: 0; }
  li { margin-bottom: 2px; }
  .item { break-inside: avoid; }
  p { margin: 0 0 6px; }
</style></head><body>
  <h1>${esc(cv.name)}</h1>
  ${cv.headline ? `<div class="headline">${esc(cv.headline)}</div>` : ''}
  ${contact.length ? `<div class="contact">${contact.map(esc).join(' &nbsp;|&nbsp; ')}</div>` : ''}
  ${section('Professional Summary', cv.summary ? `<p>${esc(cv.summary)}</p>` : '')}
  ${section('Skills', cv.skills.length ? `<p>${cv.skills.map(esc).join(' • ')}</p>` : '')}
  ${section('Experience', cv.experience.map((e) => `<div class="item">
      <div class="row"><span class="role">${esc(e.title)}</span><span class="meta">${esc(e.dates)}</span></div>
      <div class="sub">${esc([e.company, e.location].filter(Boolean).join(', '))}</div>
      ${bullets(e.bullets)}</div>`).join(''))}
  ${section('Projects', cv.projects.map((p) => `<div class="item"><div class="role">${esc(p.name)}</div>${bullets(p.bullets)}</div>`).join(''))}
  ${section('Education', cv.education.map((ed) => `<div class="item">
      <div class="row"><span class="role">${esc(ed.degree)}</span><span class="meta">${esc(ed.dates)}</span></div>
      <div class="sub">${esc(ed.institution)}</div>${ed.details ? `<p>${esc(ed.details)}</p>` : ''}</div>`).join(''))}
  ${section('Certifications', bullets(cv.certifications))}
  ${section('Languages', cv.languages.length ? `<p>${cv.languages.map(esc).join(' • ')}</p>` : '')}
</body></html>`;
};

const downloadPDF = (cv) => {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(buildPrintHTML(cv));
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
  return true;
};

// ── Small form helpers ────────────────────────────────────────────
// Lists edit as one item per line (bullets) or comma-separated (skills)
const lines   = (arr) => (arr || []).join('\n');
const unlines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);
const commas   = (arr) => (arr || []).join(', ');
const uncommas = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

const Field = ({ label, value, onChange, placeholder, multiline = false, rows = 3, ...rest }) => (
  <label className="block space-y-1">
    {label && <span className="text-text-secondary text-xs">{label}</span>}
    {multiline ? (
      <textarea className="input-field w-full text-sm resize-y" rows={rows} value={value}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />
    ) : (
      <input className="input-field w-full text-sm" value={value}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />
    )}
  </label>
);

// Keeps the raw text while typing so a new empty line or a trailing comma
// isn't stripped mid-edit; the parsed list is still sent up on every change.
const ListField = ({ items, onChange, separator = 'lines', ...props }) => {
  const [join, split] = separator === 'lines' ? [lines, unlines] : [commas, uncommas];
  const [text, setText]       = useState(join(items));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(join(items)); }, [items, focused]);
  return (
    <Field multiline {...props} value={text}
      onChange={(v) => { setText(v); onChange(split(v)); }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  );
};

const SectionTitle = ({ children, onAdd }) => (
  <div className="flex items-center justify-between">
    <h3 className="text-text-primary font-semibold text-sm">{children}</h3>
    {onAdd && (
      <button type="button" onClick={onAdd}
        className="text-xs text-brand-cyan flex items-center gap-1 hover:underline">
        <Plus className="w-3 h-3" /> Add
      </button>
    )}
  </div>
);

const RemoveBtn = ({ onClick }) => (
  <button type="button" onClick={onClick} title="Remove"
    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
    <Trash2 className="w-3.5 h-3.5" />
  </button>
);

// ── Editor ────────────────────────────────────────────────────────
export default function CVRewriteEditor({ rewriteId, onClose }) {
  const qc = useQueryClient();
  const [cv, setCV]       = useState(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cv-rewrite', rewriteId],
    queryFn:  () => getCVRewrite(rewriteId),
  });
  const rewrite = data?.rewrite;

  useEffect(() => {
    if (rewrite?.content_json?.cv) { setCV(rewrite.content_json.cv); setDirty(false); }
  }, [rewrite]);

  const saveMut = useMutation({
    mutationFn: () => updateCVRewrite(rewriteId, cv),
    onSuccess:  (res) => {
      qc.setQueryData(['cv-rewrite', rewriteId], res);
      qc.invalidateQueries({ queryKey: ['cv-rewrites'] });
      setDirty(false);
      setNotice('Saved.');
      setTimeout(() => setNotice(null), 2500);
    },
    onError: () => setNotice('Could not save. Please try again.'),
  });

  const update = (patch) => { setCV((c) => ({ ...c, ...patch })); setDirty(true); };
  const updateIn = (key, idx, patch) =>
    update({ [key]: cv[key].map((item, i) => (i === idx ? { ...item, ...patch } : item)) });
  const removeAt = (key, idx) => update({ [key]: cv[key].filter((_, i) => i !== idx) });

  const handleDownload = () => {
    if (!downloadPDF(cv)) setNotice('Allow pop-ups for this site to download the PDF.');
  };

  const changes = rewrite?.content_json?.changes || [];
  const gaps    = rewrite?.content_json?.gaps || [];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !dirty) onClose(); }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="glass-card w-full max-w-4xl flex flex-col overflow-hidden sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-fg/8 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-bold truncate">{rewrite?.title || 'Rewritten CV'}</p>
            <p className="text-text-muted text-xs">Review every line before sending — you know your experience best.</p>
          </div>
          {notice && <span className="text-xs text-text-secondary hidden sm:inline">{notice}</span>}
          <button onClick={() => saveMut.mutate()} disabled={!cv || !dirty || saveMut.isPending}
            className="px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 bg-fg/5 border border-fg/10 text-text-primary hover:bg-fg/10 disabled:opacity-40 transition-colors">
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button onClick={handleDownload} disabled={!cv}
            className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) onClose(); }}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-fg/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {isLoading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-cyan" /></div>}
          {isError && <p className="text-red-400 text-sm text-center py-16">Could not load this CV.</p>}

          {cv && (
            <>
              {(changes.length > 0 || gaps.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {changes.length > 0 && (
                    <div className="p-3 rounded-xl bg-brand-cyan/5 border border-brand-cyan/20 space-y-1.5">
                      <p className="text-brand-cyan text-xs font-semibold flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> What was improved</p>
                      <ul className="space-y-1">{changes.map((c, i) => <li key={i} className="text-text-secondary text-xs">• {c}</li>)}</ul>
                    </div>
                  )}
                  {gaps.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                      <p className="text-amber-400 text-xs font-semibold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Gaps to work on (not added to your CV)</p>
                      <ul className="space-y-1">{gaps.map((g, i) => <li key={i} className="text-text-secondary text-xs">• {g}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Full name" value={cv.name} onChange={(v) => update({ name: v })} />
                <Field label="Headline" value={cv.headline} onChange={(v) => update({ headline: v })} />
                <Field label="Email" value={cv.contact.email} onChange={(v) => update({ contact: { ...cv.contact, email: v } })} />
                <Field label="Phone" value={cv.contact.phone} onChange={(v) => update({ contact: { ...cv.contact, phone: v } })} />
                <Field label="Location" value={cv.contact.location} onChange={(v) => update({ contact: { ...cv.contact, location: v } })} />
                <ListField label="Links (comma-separated)" separator="commas" rows={1} items={cv.contact.links}
                  onChange={(v) => update({ contact: { ...cv.contact, links: v } })} />
              </div>

              <Field label="Professional summary" multiline rows={4} value={cv.summary} onChange={(v) => update({ summary: v })} />
              <ListField label="Skills (comma-separated)" separator="commas" rows={2} items={cv.skills} onChange={(v) => update({ skills: v })} />

              <div className="space-y-3">
                <SectionTitle onAdd={() => update({ experience: [...cv.experience, { title: '', company: '', location: '', dates: '', bullets: [] }] })}>
                  Experience
                </SectionTitle>
                {cv.experience.map((e, i) => (
                  <div key={i} className="p-3 rounded-xl bg-fg/3 border border-fg/8 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 grid sm:grid-cols-2 gap-2">
                        <Field placeholder="Job title" value={e.title} onChange={(v) => updateIn('experience', i, { title: v })} />
                        <Field placeholder="Company" value={e.company} onChange={(v) => updateIn('experience', i, { company: v })} />
                        <Field placeholder="Location" value={e.location} onChange={(v) => updateIn('experience', i, { location: v })} />
                        <Field placeholder="Dates (e.g. Jan 2022 – Present)" value={e.dates} onChange={(v) => updateIn('experience', i, { dates: v })} />
                      </div>
                      <RemoveBtn onClick={() => removeAt('experience', i)} />
                    </div>
                    <ListField label="Bullet points (one per line)" rows={Math.max(3, e.bullets.length + 1)}
                      items={e.bullets} onChange={(v) => updateIn('experience', i, { bullets: v })} />
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <SectionTitle onAdd={() => update({ projects: [...cv.projects, { name: '', bullets: [] }] })}>Projects</SectionTitle>
                {cv.projects.map((p, i) => (
                  <div key={i} className="p-3 rounded-xl bg-fg/3 border border-fg/8 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1"><Field placeholder="Project name" value={p.name} onChange={(v) => updateIn('projects', i, { name: v })} /></div>
                      <RemoveBtn onClick={() => removeAt('projects', i)} />
                    </div>
                    <ListField label="Bullet points (one per line)" items={p.bullets}
                      onChange={(v) => updateIn('projects', i, { bullets: v })} />
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <SectionTitle onAdd={() => update({ education: [...cv.education, { degree: '', institution: '', dates: '', details: '' }] })}>Education</SectionTitle>
                {cv.education.map((ed, i) => (
                  <div key={i} className="p-3 rounded-xl bg-fg/3 border border-fg/8 flex gap-2">
                    <div className="flex-1 grid sm:grid-cols-2 gap-2">
                      <Field placeholder="Degree" value={ed.degree} onChange={(v) => updateIn('education', i, { degree: v })} />
                      <Field placeholder="Institution" value={ed.institution} onChange={(v) => updateIn('education', i, { institution: v })} />
                      <Field placeholder="Dates" value={ed.dates} onChange={(v) => updateIn('education', i, { dates: v })} />
                      <Field placeholder="Details (CGPA, thesis…)" value={ed.details} onChange={(v) => updateIn('education', i, { details: v })} />
                    </div>
                    <RemoveBtn onClick={() => removeAt('education', i)} />
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <ListField label="Certifications (one per line)" items={cv.certifications}
                  onChange={(v) => update({ certifications: v })} />
                <ListField label="Languages (comma-separated)" separator="commas" items={cv.languages}
                  onChange={(v) => update({ languages: v })} />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
