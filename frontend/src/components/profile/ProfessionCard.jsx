import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Info, Loader2, Search } from 'lucide-react';
import { getMyRole, confirmRole, searchRoles } from '../../api/userApi.js';

// Everything built on the user's profession — refreshed after they change it
const DEPENDENT_QUERIES = [['user-role'], ['market'], ['jobs'], ['dashboard-job-stats'], ['dashboard-top-jobs']];

// "We read your CV as X — is that right?" (dashboard) or a "Your profession"
// row with Change (settings). Confirming makes it the ground truth for matching.
export default function ProfessionCard({ variant = 'dashboard' }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['user-role'], queryFn: getMyRole });
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  const { data: suggestions } = useQuery({
    queryKey: ['role-search', debounced],
    queryFn:  () => searchRoles(debounced),
    enabled:  editing && debounced.length >= 2,
  });

  const saveMut = useMutation({
    mutationFn: (role) => confirmRole(role),
    onSuccess: () => {
      setEditing(false); setText('');
      DEPENDENT_QUERIES.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    },
  });

  if (!data?.success) return null;
  const { confirmed, matched, note, has_cv: hasCV } = data;

  // Dashboard only asks while nothing is confirmed (and there's something to confirm)
  if (variant === 'dashboard' && (confirmed || (!matched && !hasCV))) return null;

  const editor = (
    <div className="space-y-2 mt-3">
      <div className="relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input autoFocus className="input-field pl-9 text-sm" placeholder="Type your profession, e.g. Fashion Designer"
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim().length >= 2) saveMut.mutate(text.trim()); }} />
      </div>
      {suggestions?.roles?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.roles.map((r) => (
            <button key={r} type="button" onClick={() => saveMut.mutate(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:border-brand-purple/50 hover:text-text-primary">
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={text.trim().length < 2 || saveMut.isPending} onClick={() => saveMut.mutate(text.trim())}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
          {saveMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
        <button type="button" onClick={() => { setEditing(false); setText(''); }} className="btn-ghost text-xs px-4 py-2">Cancel</button>
      </div>
      {saveMut.isError && <p className="text-danger text-xs">Couldn't save. Please try again.</p>}
    </div>
  );

  if (variant === 'settings') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Your profession</label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-text-primary text-sm flex items-center gap-1.5">
            {confirmed ? <><BadgeCheck className="w-4 h-4 text-success" /> {confirmed}</>
              : matched ? <>{matched} <span className="text-text-muted text-xs">(read from your CV — not confirmed)</span></>
              : <span className="text-text-muted">Not set — upload your CV or type your profession</span>}
          </p>
          {!editing && <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-xs px-3 py-1.5">Change</button>}
        </div>
        <p className="text-text-muted text-xs">Jobs are matched to this profession.</p>
        {editing && editor}
      </div>
    );
  }

  return (
    <div className="glass-card p-4 border-amber-500/30">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="text-text-primary">
            {matched
              ? <>We read your CV as <strong>{matched}</strong>. Is that right?</>
              : <>We couldn't tell your profession from your CV. What do you do?</>}
          </p>
          {note && (
            <p className="text-text-secondary text-xs mt-1">
              Your target role "{note.chosen_role}" doesn't appear in your CV, so jobs follow your CV until you confirm.
            </p>
          )}
          <p className="text-text-muted text-xs mt-1">Your answer decides which jobs you see.</p>
          {editing ? editor : (
            <div className="flex gap-2 mt-3">
              {matched && (
                <button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate(matched)}
                  className="btn-primary text-xs px-4 py-2">
                  {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                  Yes, that's me
                </button>
              )}
              <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-xs px-4 py-2">
                {matched ? 'No, change it' : 'Tell us'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
