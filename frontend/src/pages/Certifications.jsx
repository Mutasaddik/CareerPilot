import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Award, Loader2, FileSearch, BookOpen } from 'lucide-react';
import { fetchMyCertifications } from '../api/certificationApi.js';
import CertificationCard from '../components/certifications/CertificationCard.jsx';

export default function Certifications() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ['certifications'], queryFn: fetchMyCertifications, staleTime: 10 * 60 * 1000 });
  const certs = data?.certifications || [];
  const fromAds = certs.filter((c) => c.kind === 'ads');
  const recognised = certs.filter((c) => c.kind === 'recognised');

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-fg/8 px-4 sm:px-6 py-4">
        <div className="w-full">
          <h1 className="text-text-primary font-bold text-xl">Certifications</h1>
          <p className="text-text-secondary text-xs mt-0.5">
            {data?.role
              ? <>For <strong>{data.role}</strong> — based on {data.ads_considered} live job ads in your field</>
              : 'Certifications that employers ask for in your field'}
          </p>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 py-6 space-y-8">
        {isLoading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-cyan" /></div>}
        {isError && <p className="text-danger text-sm text-center py-10">Couldn't load certifications. Please try again.</p>}

        {!isLoading && !isError && !data?.role && (
          <div className="glass-card p-10 text-center space-y-3">
            <Award className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-text-primary font-semibold">We don't know your profession yet</p>
            <p className="text-text-secondary text-sm">Upload your CV or confirm your profession, and we'll show the certifications for your field.</p>
            <button onClick={() => navigate('/cv')} className="btn-primary px-5 py-2 text-sm">Upload CV</button>
          </div>
        )}

        {data?.role && (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-success" />
                <h2 className="text-text-primary font-bold">Asked for in job ads</h2>
              </div>
              <p className="text-text-muted text-xs">
                Counted from real {data.role} job ads — only where the ad actually asks for the certification.
              </p>
              {fromAds.length === 0
                ? <p className="text-text-secondary text-sm glass-card p-4">No certifications requested in your field's ads yet. This fills in as more ads arrive.</p>
                : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{fromAds.map((c) => <CertificationCard key={c.id} cert={c} role={data.role} />)}</div>}
            </section>

            {recognised.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-purple" />
                  <h2 className="text-text-primary font-bold">Recognised in your field</h2>
                </div>
                <p className="text-text-muted text-xs">
                  Well-known certifications for {data.role}. Not requested in the ads we've seen yet — a plus, not a must.
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{recognised.map((c) => <CertificationCard key={c.id} cert={c} role={data.role} />)}</div>
              </section>
            )}

            <p className="text-text-muted text-xs">
              Links go to each issuer's official website. Fees, exam formats and eligibility are set by the issuer — check there before applying.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
