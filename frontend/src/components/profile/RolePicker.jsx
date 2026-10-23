import { useState } from 'react';
import { Plus, X } from 'lucide-react';

// Roles grouped by career track. Names match the role families the job
// matcher understands, so picking one gives correctly matched jobs.
// (Before, only tech roles were offered, so non-tech users picked
// "Software Engineer" and got software jobs.)
export const ROLE_GROUPS = [
  { track: 'Software & IT', roles: ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Mobile Developer', 'QA Engineer', 'DevOps Engineer', 'Data Analyst'] },
  { track: 'Business & Management', roles: ['Business Analyst', 'Project Manager', 'Management Trainee', 'Operations Executive'] },
  { track: 'Marketing & Sales', roles: ['Marketing Executive', 'Digital Marketer', 'Sales Executive', 'Business Development Executive'] },
  { track: 'Banking & Finance', roles: ['Banking Officer', 'Relationship Officer', 'Accountant'] },
  { track: 'Customer Service & HR', roles: ['Customer Service Executive', 'HR Executive'] },
  { track: 'Creative & Content', roles: ['Graphic Designer', 'Content Writer'] },
  { track: 'Garments & Events', roles: ['Merchandiser', 'Event Coordinator'] },
];

const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles);
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const Chip = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap ${
      active
        ? 'bg-brand-purple/15 border-brand-purple/40 text-brand-purple'
        : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
    }`}>{children}</button>
);

// selected: string[]; onToggle(role) adds or removes a role
export default function RolePicker({ selected = [], onToggle }) {
  const [custom, setCustom] = useState('');
  const isSelected = (role) => selected.some((s) => same(s, role));
  // Roles the user picked that aren't in the list (typed in, or older values)
  const extra = selected.filter((s) => !ALL_ROLES.some((r) => same(r, s)));

  const addCustom = () => {
    const role = custom.trim();
    if (role && !isSelected(role)) onToggle(role);
    setCustom('');
  };

  return (
    <div className="space-y-3">
      {extra.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {extra.map((role) => (
            <Chip key={role} active onClick={() => onToggle(role)}>
              <span className="inline-flex items-center gap-1 capitalize">{role} <X className="w-3 h-3" /></span>
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {ROLE_GROUPS.map(({ track, roles }) => (
          <div key={track}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">{track}</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <Chip key={role} active={isSelected(role)}
                  onClick={() => onToggle(selected.find((s) => same(s, role)) || role)}>{role}</Chip>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input className="input-field flex-1 text-sm py-2" placeholder="Not listed? Type your role, e.g. Supply Chain Officer"
          value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <button type="button" onClick={addCustom} disabled={!custom.trim()}
          className="btn-secondary text-xs px-3 py-2 disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}
