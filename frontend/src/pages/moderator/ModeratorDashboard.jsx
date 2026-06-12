import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, CheckCircle, XCircle, AlertTriangle, LogOut, MessageSquare, DollarSign } from 'lucide-react';
import {
  getModeratorStats, getInterviewSubmissions,
  approveSubmission, rejectSubmission,
  getSalaryContributions, validateContribution,
} from '../../api/adminApi.js';
import { logoutUser } from '../../api/authApi.js';
import useAuthStore from '../../store/authStore.js';
import { useNavigate } from 'react-router-dom';

const TABS = ['Overview', 'Interview Submissions', 'Salary Review'];

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="glass-card p-5 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-sm text-text-secondary font-medium">{label}</p>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + '22' }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
    <p className="text-3xl font-bold text-text-primary font-display">{value ?? '—'}</p>
  </div>
);

function RejectModal({ submission, onReject, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 w-full max-w-md space-y-4">
        <h3 className="font-display font-bold text-lg text-text-primary">Reject Submission</h3>
        <p className="text-sm text-text-secondary">
          Rejecting: <span className="text-text-primary font-medium">{submission.company} — {submission.role}</span>
        </p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection (required)..."
          rows={3} className="input-field resize-none" />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => { if (reason.trim()) { onReject(reason); onClose(); } }}
            disabled={!reason.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            Reject
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ModeratorDashboard() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const clearUser   = useAuthStore((s) => s.clearUser);
  const user        = useAuthStore((s) => s.user);
  const [tab,          setTab]          = useState('Overview');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: statsData }         = useQuery({ queryKey: ['mod-stats'],         queryFn: getModeratorStats,                             staleTime: 30000 });
  const { data: submissionsData }   = useQuery({ queryKey: ['mod-submissions'],   queryFn: () => getInterviewSubmissions({ limit: 15 }), staleTime: 30000 });
  const { data: contributionsData } = useQuery({ queryKey: ['mod-contributions'], queryFn: getSalaryContributions,                        staleTime: 30000 });

  const approveMutation  = useMutation({ mutationFn: approveSubmission,                                     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mod-submissions'] }) });
  const rejectMutation   = useMutation({ mutationFn: ({ id, reason }) => rejectSubmission(id, { reason }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mod-submissions'] }) });
  const validateMutation = useMutation({ mutationFn: ({ id, isOutlier }) => validateContribution(id, { isOutlier }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mod-contributions'] }) });
  const logoutMutation   = useMutation({ mutationFn: logoutUser, onSuccess: () => { clearUser(); navigate('/login'); } });

  const stats = statsData?.stats;

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="border-b border-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-moderator flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-text-primary">CareerPilot</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-moderator/20 text-moderator border border-moderator/30">Moderator</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">{user?.name}</span>
            <button onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-danger transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-text-primary">Moderator Dashboard</h1>
          <p className="text-text-secondary text-sm mt-1">Review and approve community submissions.</p>
        </div>

        <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl w-fit overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t ? 'bg-moderator text-white' : 'text-text-secondary hover:text-text-primary'
              }`}>{t}</button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Pending Submissions" value={stats?.pendingSubmissions}  icon={MessageSquare} color="#7c3aed" />
            <StatCard label="Approved"            value={stats?.approvedSubmissions} icon={CheckCircle}   color="#22c55e" />
            <StatCard label="Rejected"            value={stats?.rejectedSubmissions} icon={XCircle}       color="#ef4444" />
          </div>
        )}

        {tab === 'Interview Submissions' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-text-primary">Pending Review</h2>
            {submissionsData?.submissions?.length > 0 ? (
              <div className="space-y-3">
                {submissionsData.submissions.map((sub) => (
                  <div key={sub.id} className="glass-card p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-text-primary">{sub.company}</p>
                        <p className="text-sm text-text-secondary">{sub.role}</p>
                        <div className="flex items-center gap-2">
                          {sub.difficulty && <span className="badge badge-amber">{sub.difficulty}</span>}
                          {sub.outcome   && <span className="badge badge-blue">{sub.outcome}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => approveMutation.mutate(sub.id)} disabled={approveMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success/15 text-success border border-success/30 hover:bg-success/25 text-sm font-medium transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => setRejectTarget(sub)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 text-sm font-medium transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-success mx-auto opacity-50" />
                <p className="text-text-primary font-semibold">All caught up!</p>
                <p className="text-text-secondary text-sm">No pending submissions.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'Salary Review' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-text-primary">Unvalidated Salary Contributions</h2>
            {contributionsData?.contributions?.length > 0 ? (
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      {['User', 'Role', 'Location', 'Salary (BDT)', 'Experience', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contributionsData.contributions.map((c) => (
                      <tr key={c.id} className="hover:bg-bg-primary/30">
                        <td className="px-4 py-3 text-sm text-text-primary">{c.user_name}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{c.role}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{c.location || '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-success">৳{c.salary_bdt?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{c.experience_years ? `${c.experience_years} yrs` : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => validateMutation.mutate({ id: c.id, isOutlier: false })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors">
                              <CheckCircle className="w-3 h-3" /> Valid
                            </button>
                            <button onClick={() => validateMutation.mutate({ id: c.id, isOutlier: true })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning/15 text-warning text-xs font-medium hover:bg-warning/25 transition-colors">
                              <AlertTriangle className="w-3 h-3" /> Outlier
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="glass-card p-12 text-center space-y-3">
                <DollarSign className="w-12 h-12 text-success mx-auto opacity-50" />
                <p className="text-text-primary font-semibold">No pending salary contributions.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {rejectTarget && (
          <RejectModal
            submission={rejectTarget}
            onReject={(reason) => rejectMutation.mutate({ id: rejectTarget.id, reason })}
            onClose={() => setRejectTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
