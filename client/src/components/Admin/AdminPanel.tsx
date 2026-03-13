import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Ticket,
  TrendingUp,
  Settings,
  Search,
  Ban,
  VolumeX,
  Volume2,
  ShieldCheck,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { api } from '@/services/api';

/* ──────────── Shared ──────────── */

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'promos', label: 'Promos', icon: Ticket },
  { key: 'finance', label: 'Finance', icon: TrendingUp },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type Tab = (typeof TABS)[number]['key'];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--color-surface)] border border-white/5 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
    </div>
  );
}

/* ──────────── Dashboard Tab ──────────── */

function DashboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data.totalUsers ?? 0} />
        <StatCard label="Online Now" value={data.onlineCount ?? 0} />
        <StatCard label="Total Games" value={data.totalGames ?? 0} />
        <StatCard label="Today Volume" value={`$${(data.todayVolume ?? 0).toLocaleString()}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Today Profit" value={`$${(data.todayProfit ?? 0).toLocaleString()}`} />
        <StatCard
          label="Week Volume"
          value={`$${(data.weekVolume ?? 0).toLocaleString()}`}
        />
        <StatCard
          label="Week Profit"
          value={`$${(data.weekProfit ?? 0).toLocaleString()}`}
        />
      </div>
    </div>
  );
}

/* ──────────── Users Tab ──────────── */

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.admin.users(page, search).then((res: any) => {
      setUsers(res.users ?? []);
      setTotalPages(res.totalPages ?? 1);
    }).finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const action = async (fn: () => Promise<any>) => {
    await fn();
    load();
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by username or email..."
            className="w-full bg-[var(--color-surface-light)] text-sm text-white placeholder-gray-500 pl-9 pr-3 py-2.5 rounded-lg border border-white/5 focus:outline-none focus:border-[var(--color-accent)]/50"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? <Spinner /> : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-white/5">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3 text-right text-white">${u.balance?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-1">
                    {u.banned && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Banned</span>}
                    {u.muted && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Muted</span>}
                    {!u.banned && !u.muted && <span className="text-xs text-gray-600">OK</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.banned ? (
                        <button onClick={() => action(() => api.admin.unbanUser(u.id))} title="Unban" className="p-1.5 rounded hover:bg-green-500/20 text-green-400 transition-colors">
                          <ShieldCheck size={15} />
                        </button>
                      ) : (
                        <button onClick={() => action(() => api.admin.banUser(u.id))} title="Ban" className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors">
                          <Ban size={15} />
                        </button>
                      )}
                      {u.muted ? (
                        <button onClick={() => action(() => api.admin.unmuteUser(u.id))} title="Unmute" className="p-1.5 rounded hover:bg-green-500/20 text-green-400 transition-colors">
                          <Volume2 size={15} />
                        </button>
                      ) : (
                        <button onClick={() => action(() => api.admin.muteUser(u.id))} title="Mute" className="p-1.5 rounded hover:bg-yellow-500/20 text-yellow-400 transition-colors">
                          <VolumeX size={15} />
                        </button>
                      )}
                      {adjustId === u.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const amt = parseFloat(adjustAmount);
                            if (!isNaN(amt)) action(() => api.admin.adjustBalance(u.id, amt));
                            setAdjustId(null);
                            setAdjustAmount('');
                          }}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="number"
                            step="0.01"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            placeholder="±$"
                            autoFocus
                            className="w-20 bg-[var(--color-bg)] text-xs text-white px-2 py-1 rounded border border-white/10 focus:outline-none"
                          />
                        </form>
                      ) : (
                        <button onClick={() => setAdjustId(u.id)} title="Adjust balance" className="p-1.5 rounded hover:bg-purple-500/20 text-purple-400 transition-colors">
                          <DollarSign size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="p-2 rounded-lg bg-[var(--color-surface-light)] text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-400">{page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="p-2 rounded-lg bg-[var(--color-surface-light)] text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ──────────── Promos Tab ──────────── */

function PromosTab() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', amount: '', maxUses: '', expiresAt: '' });

  const load = () => {
    setLoading(true);
    api.admin.getPromos().then((res: any) => setPromos(res.promos ?? res ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.admin.createPromo({
      code: form.code,
      amount: parseFloat(form.amount),
      maxUses: parseInt(form.maxUses, 10),
      expiresAt: form.expiresAt || undefined,
    });
    setForm({ code: '', amount: '', maxUses: '', expiresAt: '' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.admin.deletePromo(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Promo Codes</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Promo
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <form onSubmit={handleCreate} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    required
                    className="w-full bg-[var(--color-bg)] text-sm text-white px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Bonus Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full bg-[var(--color-bg)] text-sm text-white px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Uses</label>
                  <input
                    type="number"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    required
                    className="w-full bg-[var(--color-bg)] text-sm text-white px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expiry (optional)</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full bg-[var(--color-bg)] text-sm text-white px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
                <div className="col-span-full flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Create Promo
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promo list */}
      {loading ? <Spinner /> : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-white/5">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Uses / Max</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-8">No promos yet</td></tr>
              )}
              {promos.map((p: any) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-white font-mono font-semibold">{p.code}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-accent)]">${p.amount}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{p.usedCount ?? 0} / {p.maxUses}</td>
                  <td className="px-4 py-3 text-gray-400">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ──────────── Finance Tab ──────────── */

function FinanceTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getFinance(14).then((res: any) => setData(res.days ?? res ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const maxVolume = Math.max(...data.map((d: any) => d.volume ?? 0), 1);
  const maxProfit = Math.max(...data.map((d: any) => Math.abs(d.profit ?? 0)), 1);

  return (
    <div className="space-y-6">
      {/* Volume chart */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">Daily Volume (14 days)</h3>
        <div className="flex items-end gap-1.5 h-40">
          {data.map((d: any, i: number) => {
            const h = ((d.volume ?? 0) / maxVolume) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500">${d.volume ?? 0}</span>
                <div
                  className="w-full rounded-t bg-[var(--color-accent)]/60 hover:bg-[var(--color-accent)] transition-colors"
                  style={{ height: `${Math.max(h, 2)}%` }}
                />
                <span className="text-[9px] text-gray-600 truncate w-full text-center">
                  {d.date ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Profit chart */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">Daily Profit (14 days)</h3>
        <div className="flex items-end gap-1.5 h-40">
          {data.map((d: any, i: number) => {
            const profit = d.profit ?? 0;
            const h = (Math.abs(profit) / maxProfit) * 100;
            const isNeg = profit < 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className={`text-[10px] ${isNeg ? 'text-red-400' : 'text-green-400'}`}>
                  {isNeg ? '-' : '+'}${Math.abs(profit)}
                </span>
                <div
                  className={`w-full rounded-t transition-colors ${isNeg ? 'bg-[var(--color-danger)]/60 hover:bg-[var(--color-danger)]' : 'bg-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]'}`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                />
                <span className="text-[9px] text-gray-600 truncate w-full text-center">
                  {d.date ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ──────────── Settings Tab ──────────── */

function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.admin.getSettings().then((res: any) => setSettings(res)).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.admin.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  const fields = [
    { key: 'house_edge', label: 'House Edge (%)', step: '0.01' },
    { key: 'min_bet', label: 'Min Bet ($)', step: '0.01' },
    { key: 'max_bet', label: 'Max Bet ($)', step: '1' },
    { key: 'wait_time', label: 'Wait Time (seconds)', step: '1' },
  ];

  return (
    <Card className="max-w-lg">
      <h3 className="text-lg font-semibold text-white mb-6">Game Settings</h3>
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-wide">{f.label}</label>
            <input
              type="number"
              step={f.step}
              value={settings[f.key] ?? ''}
              onChange={(e) => setSettings({ ...settings, [f.key]: parseFloat(e.target.value) })}
              className="w-full bg-[var(--color-bg)] text-sm text-white px-3 py-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-[var(--color-accent)]/50"
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-[var(--color-accent)]">Saved!</span>}
      </div>
    </Card>
  );
}

/* ──────────── Main Panel ──────────── */

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center">
            <ShieldCheck size={18} className="text-[var(--color-accent)]" />
          </div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-[var(--color-surface)] rounded-xl p-1 border border-white/5 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="admin-tab-bg"
                    className="absolute inset-0 bg-[var(--color-surface-light)] rounded-lg"
                    transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={16} />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'dashboard' && <DashboardTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'promos' && <PromosTab />}
            {tab === 'finance' && <FinanceTab />}
            {tab === 'settings' && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
