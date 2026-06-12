import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Search, CheckCircle, AlertTriangle, Ban, LogOut } from 'lucide-react';
import { getAdminStats, getAdminUsers, suspendUser, unsuspendUser, getAdminScrapers, getAdminAuditLogs } from '../../api/adminApi.js';
import { logoutUser } from '../../api/authApi.js';
import useAuthStore from '../../store/authStore.js';
import { useNavigate } from 'react-router-dom';

const TABS = ['Overview', 'Users', 'Scrapers', 'Audit Logs'];

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

export default function AdminDashboard() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const clearUser   = useAuthStore((s) => s.clearUser);
  const user        = useAuthStore((s) => s.user);
  const [tab,    setTab]    = useState('Overview');
  const [search, setSearch] = useState('');

  const { data: statsData }    = useQuery({ queryKey: ['admin-stats'],          queryFn: getAdminStats,                              staleTime: 30000 });
  const { data: usersData }    = useQuery({ queryKey: ['admin-users', search],  queryFn: () => getAdminUsers({ search, limit: 20 }), staleTime: 30000 });
  const { data: scrapersData } = useQuery({ queryKey: ['admin-scrapers'],       queryFn: getAdminScrapers,                           staleTime: 30000 });
  const { data: auditData }    = useQuery({ queryKey: ['admin-audit'],          queryFn: () => getAdminAuditLogs({ limit: 30 }),     staleTime: 30000 });

  const suspendMutation   = useMutation({ mutationFn: suspendUser,   onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }) });
  const unsuspendMutation = useMutation({ mutationFn: unsuspendUser, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }) });
  const logoutMutation    = useMutation({ mutationFn: logoutUser, onSuccess: () => { clearUser(); navigate('/login'); } });

  const stats = statsData?.stats;

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="border-b border-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-admin flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-text-primary">CareerPilot</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-admin/20 text-admin border border-admin/30">
              Admin Mode
            </span>
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
          <h1 className="font-display font-bold text-2xl text-text-primary">Admin Dashboard</h1>
          <p className="text-text-secondary text-sm mt-1">User management and platform monitoring.</p>
        </div>

        <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl w-fit">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-admin text-white' : 'text-text-secondary hover:text-text-primary'
              }`}>{t}</button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users"  value={stats?.totalUsers}  icon={Search}       color="#ea580c" />
            <StatCard label="Active Today" value={stats?.activeToday} icon={CheckCircle}  color="#22c55e" />
            <StatCard label="New Today"    value={stats?.newToday}    icon={Zap}          color="#06b6d4" />
            <StatCard label="Admins"       value={stats?.totalAdmins} icon={AlertTriangle} color="#f59e0b" />
          </div>
        )}

        {tab === 'Users' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" placeholder="Search users..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
            </div>
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    {['Name', 'Email', 'Plan', 'Role', 'Verified', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersData?.users?.map((u) => (
                    <tr key={u.id} className="hover:bg-bg-primary/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-text-primary">{u.name}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${u.plan === 'pro' ? 'badge-purple' : 'badge-blue'}`}>{u.plan}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          u.admin_role === 'superadmin' ? 'bg-superadmin/15 text-superadmin badge' :
                          u.admin_role === 'admin'      ? 'bg-admin/15 text-admin badge' :
                          u.admin_role === 'moderator'  ? 'badge-purple' : 'badge-blue'
                        }`}>{u.admin_role || 'user'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_verified
                          ? <CheckCircle className="w-4 h-4 text-success" />
                          : <AlertTriangle className="w-4 h-4 text-warning" />}
                      </td>
                      <td className="px-4 py-3">
                        {u.admin_role === 'superadmin' || u.admin_role === 'admin' ? (
                          <span className="text-xs text-text-muted italic px-2">Protected</span>
                        ) : u.is_verified ? (
                          <button onClick={() => suspendMutation.mutate(u.id)}
                            className="p-1.5 rounded-lg hover:bg-warning/10 text-warning transition-colors" title="Suspend">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => unsuspendMutation.mutate(u.id)}
                            className="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors" title="Unsuspend">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!usersData?.users || usersData.users.length === 0) && (
                <p className="text-center text-text-muted py-8 text-sm">No users found.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'Scrapers' && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-text-primary">Scraper Health</h2>
            <div className="space-y-3">
              {scrapersData?.scrapers?.length > 0 ? scrapersData.scrapers.map((s) => (
                <div key={s.source} className="flex items-center justify-between p-4 rounded-xl bg-bg-primary/60 border border-border">
                  <div>
                    <p className="text-sm font-semibold text-text-primary capitalize">{s.source}</p>
                    <p className="text-xs text-text-muted">{s.jobs_found ?? 0} jobs · {s.consecutive_failures} failures</p>
                  </div>
                  <span className={`badge ${s.status === 'success' ? 'badge-green' : s.status === 'running' ? 'badge-amber' : 'badge-red'}`}>
                    {s.status || 'unknown'}
                  </span>
                </div>
              )) : <p className="text-text-muted text-sm text-center py-8">No scraper data yet.</p>}
            </div>
          </div>
        )}

        {tab === 'Audit Logs' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-text-primary">Your Actions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-bg-primary/30">
                  <tr>
                    {['Action', 'Target', 'IP', 'Time'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditData?.logs?.map((log) => (
                    <tr key={log.id} className="hover:bg-bg-primary/20">
                      <td className="px-4 py-3 text-sm font-mono text-brand-cyan">{log.action}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">{log.target_type}</td>
                      <td className="px-4 py-3 text-xs text-text-muted font-mono">{log.ip_address}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!auditData?.logs || auditData.logs.length === 0) && (
                <p className="text-center text-text-muted py-8 text-sm">No actions logged yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
