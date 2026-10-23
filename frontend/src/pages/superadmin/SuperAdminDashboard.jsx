import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Shield, Activity, Zap, Settings,
  ToggleLeft, ToggleRight, Wrench, Search,
  AlertTriangle, CheckCircle, Clock, LogOut,
  ChevronRight, Eye, Ban, Trash2, RefreshCw
} from 'lucide-react';
import {
  getSuperAdminStats, getSuperAdminUsers, getSuperAdminFlags,
  getMaintenance, setMaintenance, updateFeatureFlag,
  superAdminSuspendUser as suspendUser, superAdminUnsuspendUser as unsuspendUser, superAdminDeleteUser as deleteUser,
  getSuperAdminAuditLogs, getSuperAdminScrapers,
} from '../../api/adminApi.js';
import { logoutUser } from '../../api/authApi.js';
import useAuthStore from '../../store/authStore.js';
import { useNavigate } from 'react-router-dom';

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-sm text-text-secondary font-medium">{label}</p>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: color + '22' }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
    <p className="text-3xl font-bold text-text-primary font-display">{value ?? '—'}</p>
  </motion.div>
);

const TABS = ['Overview', 'Users', 'Feature Flags', 'Maintenance', 'Scrapers', 'Audit Logs'];

export default function SuperAdminDashboard() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const clearUser    = useAuthStore((s) => s.clearUser);
  const user         = useAuthStore((s) => s.user);
  const [tab,        setTab]        = useState('Overview');
  const [search,     setSearch]     = useState('');
  const [maintMsg,   setMaintMsg]   = useState('');

  const { data: statsData }   = useQuery({ queryKey: ['sa-stats'],    queryFn: getSuperAdminStats,   staleTime: 30000 });
  const { data: usersData }   = useQuery({ queryKey: ['sa-users', search], queryFn: () => getSuperAdminUsers({ search, limit: 20 }), staleTime: 30000 });
  const { data: flagsData }   = useQuery({ queryKey: ['sa-flags'],    queryFn: getSuperAdminFlags,   staleTime: 60000 });
  const { data: maintData }   = useQuery({ queryKey: ['sa-maint'],    queryFn: getMaintenance,       staleTime: 30000 });
  const { data: scrapersData }= useQuery({ queryKey: ['sa-scrapers'], queryFn: getSuperAdminScrapers,staleTime: 30000 });

  // Regen limit config
  const [regenLimit, setRegenLimit]       = useState(5);
  const [regenLimitInput, setRegenLimitInput] = useState(5);
  const [regenLimitSaving, setRegenLimitSaving] = useState(false);
  const [regenLimitMsg, setRegenLimitMsg] = useState('');

  useEffect(() => {
    fetch('/api/v1/superadmin/config/regen-limit', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) { setRegenLimit(d.limit); setRegenLimitInput(d.limit); } })
      .catch(() => {});
  }, []);

  const saveRegenLimit = async () => {
    const val = parseInt(regenLimitInput);
    if (isNaN(val) || val < 2 || val > 30) { setRegenLimitMsg('Must be between 2 and 30.'); return; }
    setRegenLimitSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/config/regen-limit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: val }),
      });
      const data = await res.json();
      if (data.success) { setRegenLimit(val); setRegenLimitMsg(`Saved! Limit set to ${val}/day.`); }
      else setRegenLimitMsg(data.error || 'Failed to save.');
    } catch { setRegenLimitMsg('Network error.'); }
    setRegenLimitSaving(false);
    setTimeout(() => setRegenLimitMsg(''), 4000);
  };
  const { data: auditData }   = useQuery({ queryKey: ['sa-audit'],    queryFn: () => getSuperAdminAuditLogs({ limit: 30 }), staleTime: 30000 });

  const maintMutation = useMutation({
    mutationFn: setMaintenance,
    onSuccess: () => queryClient.invalidateQueries(['sa-maint']),
  });

  const flagMutation = useMutation({
    mutationFn: ({ name, data }) => updateFeatureFlag(name, data),
    onSuccess: () => queryClient.invalidateQueries(['sa-flags']),
  });

  const suspendMutation  = useMutation({ mutationFn: suspendUser,  onSuccess: () => queryClient.invalidateQueries(['sa-users']) });
  const unsuspendMutation= useMutation({ mutationFn: unsuspendUser,onSuccess: () => queryClient.invalidateQueries(['sa-users']) });
  const deleteMutation   = useMutation({ mutationFn: deleteUser,   onSuccess: () => queryClient.invalidateQueries(['sa-users']) });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => { clearUser(); navigate('/login'); },
  });

  const stats = statsData?.stats;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Top bar */}
      <div className="border-b border-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-superadmin flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-text-primary">CareerPilot</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-superadmin/20 text-superadmin border border-superadmin/30">
              SuperAdmin Mode
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
        {/* Page header */}
        <div>
          <h1 className="font-display font-bold text-2xl text-text-primary">SuperAdmin Dashboard</h1>
          <p className="text-text-secondary text-sm mt-1">Full platform control and oversight.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl w-fit overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t
                  ? 'bg-superadmin text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────── */}
        {tab === 'Overview' && (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users"   value={stats?.totalUsers}  icon={Users}    color="#dc2626" />
              <StatCard label="Active Today"  value={stats?.activeToday} icon={Activity} color="#22c55e" />
              <StatCard label="New Today"     value={stats?.newToday}    icon={Zap}      color="#06b6d4" />
              <StatCard label="Total Admins"  value={stats?.totalAdmins} icon={Shield}   color="#f59e0b" />
            </div>

            {/* Scraper health summary */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <Activity className="w-4 h-4 text-superadmin" /> Scraper Health
              </h2>
              <div className="grid md:grid-cols-3 gap-3">
                {scrapersData?.scrapers?.length > 0 ? scrapersData.scrapers.map((s) => (
                  <div key={s.source} className="flex items-center justify-between p-3 rounded-xl bg-bg-primary/60 border border-border">
                    <div>
                      <p className="text-sm font-semibold text-text-primary capitalize">{s.source}</p>
                      <p className="text-xs text-text-muted">{s.jobs_found ?? 0} jobs found</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      s.status === 'success' ? 'bg-success' :
                      s.status === 'running' ? 'bg-warning animate-pulse' : 'bg-danger'
                    }`} />
                  </div>
                )) : (
                  <p className="text-text-muted text-sm col-span-3">No scraper runs yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Users ────────────────────────────────────────────── */}
        {tab === 'Users' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" placeholder="Search users..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10" />
            </div>
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    {['Name', 'Email', 'Plan', 'Role', 'Verified', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
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
                          u.admin_role === 'superadmin' ? 'bg-superadmin/15 text-superadmin' :
                          u.admin_role === 'admin'      ? 'bg-admin/15 text-admin' :
                          u.admin_role === 'moderator'  ? 'badge-purple' : 'badge-blue'
                        } badge`}>{u.admin_role || 'user'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_verified
                          ? <CheckCircle className="w-4 h-4 text-success" />
                          : <AlertTriangle className="w-4 h-4 text-warning" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.admin_role === 'superadmin' ? (
                            <span className="text-xs text-text-muted px-2">Protected</span>
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
                          <button
                            onClick={() => { if (window.confirm('Permanently delete this user?')) deleteMutation.mutate(u.id); }}
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

        {/* ── Feature Flags ─────────────────────────────────────── */}
        {tab === 'Feature Flags' && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-text-primary flex items-center gap-2">
              <Settings className="w-4 h-4 text-superadmin" /> Feature Flags
            </h2>
            <p className="text-sm text-text-secondary">Toggle Pro restrictions. All flags are open at launch.</p>
            <div className="space-y-3">
              {flagsData?.flags?.map((flag) => (
                <div key={flag.feature_name} className="flex items-center justify-between p-4 rounded-xl bg-bg-primary/60 border border-border">
                  <div>
                    <p className="text-sm font-semibold text-text-primary capitalize">
                      {flag.feature_name.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-text-muted">
                      {flag.is_pro_only ? 'Pro only' : 'Free'} · {flag.is_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => flagMutation.mutate({ name: flag.feature_name, data: { isProOnly: !flag.is_pro_only, isEnabled: flag.is_enabled } })}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        flag.is_pro_only
                          ? 'bg-brand-purple/15 text-brand-purple border-brand-purple/30'
                          : 'bg-bg-primary text-text-muted border-border'
                      }`}>
                      {flag.is_pro_only ? 'Pro Only' : 'Free'}
                    </button>
                    <button onClick={() => flagMutation.mutate({ name: flag.feature_name, data: { isProOnly: flag.is_pro_only, isEnabled: !flag.is_enabled } })}>
                      {flag.is_enabled
                        ? <ToggleRight className="w-8 h-8 text-success" />
                        : <ToggleLeft  className="w-8 h-8 text-text-muted" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Maintenance ───────────────────────────────────────── */}
        {tab === 'Maintenance' && (
          <div className="glass-card p-6 space-y-6 max-w-lg">
            <h2 className="font-semibold text-text-primary flex items-center gap-2">
              <Wrench className="w-4 h-4 text-superadmin" /> Maintenance Mode
            </h2>
            <div className="flex items-center justify-between p-4 rounded-xl bg-bg-primary/60 border border-border">
              <div>
                <p className="text-sm font-semibold text-text-primary">Platform Status</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {maintData?.maintenance?.is_enabled ? '⚠️ Maintenance mode ON — users see maintenance page' : '✅ Platform is live'}
                </p>
              </div>
              <button
                onClick={() => maintMutation.mutate({ enabled: !maintData?.maintenance?.is_enabled, message: maintMsg || undefined })}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  maintData?.maintenance?.is_enabled
                    ? 'bg-success/15 text-success border border-success/30 hover:bg-success/25'
                    : 'bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25'
                }`}>
                {maintData?.maintenance?.is_enabled ? 'Disable Maintenance' : 'Enable Maintenance'}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary font-medium">Custom maintenance message</label>
              <textarea
                value={maintMsg}
                onChange={(e) => setMaintMsg(e.target.value)}
                placeholder="We'll be back shortly..."
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Scrapers ──────────────────────────────────────────── */}
        {tab === 'Scrapers' && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-text-primary flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-superadmin" /> Scraper Health Monitor
            </h2>
            <div className="space-y-3">
              {scrapersData?.scrapers?.length > 0 ? scrapersData.scrapers.map((s) => (
                <div key={s.source} className="p-4 rounded-xl bg-bg-primary/60 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-text-primary capitalize">{s.source}</p>
                    <span className={`badge ${
                      s.status === 'success' ? 'badge-green' :
                      s.status === 'running' ? 'badge-amber' : 'badge-red'
                    }`}>{s.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary">
                    <span>Jobs found: <span className="text-text-primary font-medium">{s.jobs_found ?? 0}</span></span>
                    <span>Failures: <span className={`font-medium ${s.consecutive_failures > 0 ? 'text-danger' : 'text-text-primary'}`}>{s.consecutive_failures}</span></span>
                    <span>Last run: <span className="text-text-primary font-medium">{s.finished_at ? new Date(s.finished_at).toLocaleTimeString() : 'Never'}</span></span>
                  </div>
                  {s.error_message && (
                    <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{s.error_message}</p>
                  )}
                </div>
              )) : (
                <p className="text-text-muted text-sm text-center py-8">No scraper data yet. Scrapers will run automatically in Phase 6.</p>
              )}
            </div>

            {/* Force Scrape Button */}
            <div className="pt-2 border-t border-border mt-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/v1/jobs/trigger-scrape', { method: 'POST', credentials: 'include' });
                    const data = await res.json();
                    if (data.success) alert('✅ Force scrape triggered! Jobs will update in the background.');
                    else alert('❌ Failed: ' + (data.error || 'Unknown error'));
                  } catch (err) {
                    alert('❌ Error: ' + err.message);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-superadmin/20 hover:bg-superadmin/30 border border-superadmin/40 text-superadmin font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <span>⚡</span> Force Scrape All Jobs Now
              </button>
              <p className="text-text-muted text-xs text-center mt-2">Bypasses the 12-hour schedule. Scrapes all sources immediately in the background.</p>
            </div>
          </div>
        )}


        {/* ── Regeneration Rate Limit Config ─────────────────────── */}
        <div className="glass-card p-5 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-superadmin font-semibold text-sm">⚡ User Regeneration Limit</span>
            <span className="text-text-muted text-xs">(how many times a user can click Regenerate per day)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm">Daily limit:</span>
              <input
                type="number"
                min={2}
                max={30}
                value={regenLimitInput}
                onChange={(e) => setRegenLimitInput(e.target.value)}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-superadmin/50 text-center"
              />
              <span className="text-text-muted text-xs">times/day (2–30)</span>
            </div>
            <button
              onClick={saveRegenLimit}
              disabled={regenLimitSaving}
              className="px-4 py-1.5 rounded-lg bg-superadmin/20 border border-superadmin/30 text-superadmin text-sm font-medium hover:bg-superadmin/30 transition-colors disabled:opacity-50"
            >
              {regenLimitSaving ? 'Saving…' : 'Save'}
            </button>
            <span className="text-xs font-medium text-green-400">{regenLimitMsg}</span>
          </div>
          <p className="text-text-muted text-xs mt-3">
            Current limit: <span className="text-text-primary font-medium">{regenLimit} regenerations/day</span> per user. Resets at midnight.
          </p>
        </div>

        {/* ── Audit Logs ────────────────────────────────────────── */}
        {tab === 'Audit Logs' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-text-primary">All Admin Actions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-bg-primary/30">
                  <tr>
                    {['Performed By', 'Role', 'Action', 'Target', 'IP', 'Time'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditData?.logs?.map((log) => (
                    <tr key={log.id} className="hover:bg-bg-primary/20 transition-colors">
                      <td className="px-4 py-3 text-sm text-text-primary">{log.performer_name || 'System'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          log.performed_by_role === 'superadmin' ? 'bg-superadmin/15 text-superadmin badge' :
                          log.performed_by_role === 'admin'      ? 'bg-admin/15 text-admin badge' : 'badge-purple'
                        }`}>{log.performed_by_role}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-brand-cyan">{log.action}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">{log.target_type}</td>
                      <td className="px-4 py-3 text-xs text-text-muted font-mono">{log.ip_address}</td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!auditData?.logs || auditData.logs.length === 0) && (
                <p className="text-center text-text-muted py-8 text-sm">No audit logs yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
