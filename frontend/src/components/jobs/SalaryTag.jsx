// Shows a job's salary as resolved by the backend (`job.salary`):
//   job_post    — listed in the job ad
//   similar_ads — what other employers posted for the same role
//   betonkemon  — imported benchmark for the role
// Renders nothing when there is no real data.
const SOURCE_NAMES = { betonkemon: 'Betonkemon' };

const k = (n) => `${Math.round(n / 1000)}k`;

export const formatSalary = (salary) =>
  `৳${k(salary.min)}${salary.max ? `–${k(salary.max)}` : '+'}`;

const describe = (salary) => {
  const scope = salary.level ? `${salary.level}-level ${salary.role_family}` : `${salary.role_family} (all levels)`;
  const n = salary.sample_size;
  if (salary.source === 'similar_ads') {
    return {
      tag:   `est. · ${n} similar ads`,
      title: `Not listed in this ad. Typical pay posted in ${n} other job ads for ${scope}.`,
    };
  }
  const name = SOURCE_NAMES[salary.source] || salary.source;
  return {
    tag:   `est. · ${name}`,
    title: `Not listed in this ad. Typical salary for ${scope} from ${name} (${n} report${n === 1 ? '' : 's'}).`,
  };
};

export default function SalaryTag({ salary, className = '', showUnit = true }) {
  if (!salary?.min) return null;
  const estimated = salary.source !== 'job_post';
  const info = estimated ? describe(salary) : { title: 'Salary listed in the job ad' };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={info.title}>
      <span>{formatSalary(salary)}{showUnit ? ' BDT' : ''}</span>
      {estimated && (
        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 whitespace-nowrap">
          {info.tag}
        </span>
      )}
    </span>
  );
}
