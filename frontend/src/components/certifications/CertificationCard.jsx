import { ExternalLink, BadgeCheck, FileSearch, Award } from 'lucide-react';

// One certification: what it is, why it matters (real ad evidence or
// "recognised in your field"), and the issuer's official link.
export default function CertificationCard({ cert, role, compact = false }) {
  const ev = cert.evidence;
  return (
    <div className={`rounded-xl border border-fg/10 bg-fg/[0.02] ${compact ? 'p-3' : 'p-4'} space-y-2`}>
      <div className="flex items-start gap-3">
        <Award className="w-5 h-5 text-brand-purple shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm font-semibold leading-snug">{cert.name}</p>
          <p className="text-text-muted text-xs">{cert.issuer}</p>
        </div>
        {cert.has && (
          <span className="text-[11px] px-2 py-0.5 rounded-full border text-green-300 bg-green-500/10 border-green-500/20 inline-flex items-center gap-1 shrink-0">
            <BadgeCheck className="w-3 h-3" /> On your CV
          </span>
        )}
      </div>

      {!compact && <p className="text-text-secondary text-xs">{cert.proves}</p>}

      {ev ? (
        <p className="text-xs text-text-primary flex items-start gap-1.5">
          <FileSearch className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
          <span>
            Asked for in <strong>{ev.ads} of {ev.of}</strong> {role} job ads ({ev.percent}%)
            {ev.required > 0 && <> · <strong>required</strong> in {ev.required}</>}
          </span>
        </p>
      ) : (
        <p className="text-xs text-text-muted">Recognised in your field. Not requested in the job ads we've seen yet.</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <a href={cert.url} target="_blank" rel="noopener noreferrer"
          className="text-brand-cyan text-xs inline-flex items-center gap-1 hover:underline">
          Official site — how to apply <ExternalLink className="w-3 h-3" />
        </a>
        {!cert.url_verified && (
          <span className="text-[11px] text-text-muted">(we couldn't check this link automatically)</span>
        )}
      </div>
    </div>
  );
}
