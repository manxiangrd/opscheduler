import { db } from '@/lib/db';
import { useState, useEffect, useMemo } from 'react';
import { format, addDays, isWithinInterval, parseISO } from 'date-fns';
import {
  Users, Building2, AlertTriangle, CalendarOff,
  Coffee, Clock, CheckCircle, Bell, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

// ─── Type colour / abbr maps ──────────────────────────────────────────────────

const typeColors = {
  'Annual Leave':          'bg-blue-100 text-blue-700',
  'Medical Leave':         'bg-red-100 text-red-700',
  'Hospitalisation Leave': 'bg-rose-100 text-rose-700',
  'Maternity Leave':       'bg-pink-100 text-pink-700',
  'Paternity Leave':       'bg-violet-100 text-violet-700',
  'Compassionate Leave':   'bg-orange-100 text-orange-700',
  'Off Day':               'bg-slate-100 text-slate-600',
};

const typeAbbr = {
  'Annual Leave':          'AL',
  'Medical Leave':         'ML',
  'Hospitalisation Leave': 'HL',
  'Maternity Leave':       'MatL',
  'Paternity Leave':       'PatL',
  'Compassionate Leave':   'CL',
  'Off Day':               'OD',
};

// ─── Small section divider used inside FOR YOUR ACTION card ──────────────────

function ActionSection({ icon: Icon, iconColor, title, count, children, emptyText }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className={iconColor} />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
        {count > 0 && (
          <span className="ml-1 bg-slate-100 text-slate-600 text-xs rounded-full px-1.5 py-0.5 font-medium">
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="text-xs text-green-600 flex items-center gap-1 py-1">
          <CheckCircle size={12} /> {emptyText}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [employees,     setEmployees]     = useState([]);
  const [outlets,       setOutlets]       = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [pendingLeaves,  setPendingLeaves]  = useState([]);
  const [deployments,   setDeployments]   = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [loading,       setLoading]       = useState(true);

  const today    = format(new Date(), 'yyyy-MM-dd');
  const in14Days = format(addDays(new Date(), 14), 'yyyy-MM-dd');

  useEffect(() => {
    const load = async () => {
      const [emps, outs, apprvd, pend, deps, alts] = await Promise.all([
        db.entities.Employee.filter({ is_active: true }),
        db.entities.Outlet.filter({ is_active: true }),
        db.entities.Leave.filter({ status: 'Approved' }),
        db.entities.Leave.filter({ status: 'Pending' }),
        db.entities.Deployment.list('-date', 500),
        db.entities.Alert.filter({ status: 'New' }),
      ]);
      setEmployees(emps);
      setOutlets(outs);
      setApprovedLeaves(apprvd);
      setPendingLeaves(pend.filter(l => l.type !== 'Off Day'));
      setDeployments(deps);
      setAlerts(alts);
      setLoading(false);
    };
    load();
  }, []);

  // ─── Derived data ─────────────────────────────────────────────────────

  const onLeaveTodayList = useMemo(() => {
    return approvedLeaves
      .filter(l => l.type !== 'Off Day')
      .filter(l => {
        try {
          return isWithinInterval(new Date(), {
            start: parseISO(l.start_date),
            end:   parseISO(l.end_date),
          });
        } catch { return false; }
      })
      .map(l => ({ name: l.employee_name, type: l.type }));
  }, [approvedLeaves]);

  const onOffDayTodayList = useMemo(() => {
    return approvedLeaves
      .filter(l => l.type === 'Off Day')
      .filter(l => {
        try {
          return isWithinInterval(new Date(), {
            start: parseISO(l.start_date),
            end:   parseISO(l.end_date),
          });
        } catch { return false; }
      })
      .map(l => ({ name: l.employee_name }));
  }, [approvedLeaves]);

  const upcomingLeaves = useMemo(() => {
    return approvedLeaves
      .filter(l => l.type !== 'Off Day' && l.start_date >= today && l.start_date <= in14Days)
      .sort((a, b) => (a.start_date > b.start_date ? 1 : -1))
      .slice(0, 8);
  }, [approvedLeaves, today, in14Days]);

  const outletStaffToday = useMemo(() => {
    const todayDeps = deployments.filter(d => d.date === today);
    return outlets.map(o => ({
      ...o,
      staffed: todayDeps.filter(d => d.outlet_id === o.id).length,
    }));
  }, [outlets, deployments, today]);

  const understaffedToday = outletStaffToday.filter(
    o => o.staffed < (o.staffing_threshold || 0)
  );

  // Total action items for the FOR YOUR ACTION badge
  const actionCount = pendingLeaves.length + alerts.length + understaffedToday.length;

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* ── 1. OVERVIEW card ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Overview</p>
          <div className="flex items-center divide-x divide-slate-100">
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
                <p className="text-xs text-slate-500">Active Staff</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-8">
              <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{outlets.length}</p>
                <p className="text-xs text-slate-500">Active Outlets</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-8">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                <CalendarOff size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{onLeaveTodayList.length}</p>
                <p className="text-xs text-slate-500">On Leave Today</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-8">
              <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
                <Coffee size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{onOffDayTodayList.length}</p>
                <p className="text-xs text-slate-500">On Off-Day Today</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. On Leave Today + On Off-Day Today ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* On Leave Today */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarOff size={15} className="text-amber-500" />
                On Leave Today
                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                  {onLeaveTodayList.length}
                </Badge>
              </span>
              <Link to="/leaves" className="text-xs text-indigo-600 font-normal hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {onLeaveTodayList.length === 0 ? (
              <p className="text-sm text-slate-400">No one on leave today.</p>
            ) : (
              <div className="space-y-2">
                {onLeaveTodayList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-1 border-b border-slate-50 last:border-0">
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                      {item.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-sm font-medium text-slate-900 flex-1 truncate">{item.name}</span>
                    <Badge className={`text-xs border-0 shrink-0 ${typeColors[item.type] || 'bg-slate-100 text-slate-700'}`}>
                      {typeAbbr[item.type] || item.type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* On Off-Day Today */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Coffee size={15} className="text-teal-500" />
                On Off-Day Today
                <Badge className="bg-teal-100 text-teal-700 border-0 text-xs">
                  {onOffDayTodayList.length}
                </Badge>
              </span>
              <Link to="/leaves" className="text-xs text-indigo-600 font-normal hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {onOffDayTodayList.length === 0 ? (
              <p className="text-sm text-slate-400">No off-days scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {onOffDayTodayList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-1 border-b border-slate-50 last:border-0">
                    <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 shrink-0">
                      <Coffee size={13} />
                    </div>
                    <span className="text-sm font-medium text-slate-900 flex-1 truncate">{item.name}</span>
                    <Badge className="text-xs border-0 shrink-0 bg-teal-100 text-teal-700">Off Day</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Outlet Staffing + FOR YOUR ACTION ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Outlet Staffing Today */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Outlet Staffing — Today</span>
              <Link to="/outlets" className="text-xs text-indigo-600 font-normal hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {outletStaffToday.length === 0 && (
                <p className="text-sm text-slate-400">No outlets found.</p>
              )}
              {outletStaffToday.map(o => {
                const threshold = o.staffing_threshold || 0;
                const pct = threshold > 0 ? Math.min((o.staffed / threshold) * 100, 100) : 100;
                const ok  = threshold === 0 || o.staffed >= threshold;
                return (
                  <div key={o.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800 truncate">{o.name}</span>
                        <span className={`text-xs font-semibold ${ok ? 'text-green-600' : 'text-red-600'}`}>
                          {o.staffed}{threshold > 0 ? `/${threshold}` : ''}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ok ? 'bg-green-500' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {!ok && <Badge variant="destructive" className="text-xs shrink-0">Under</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* FOR YOUR ACTION */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap size={15} className="text-indigo-500" />
                For Your Action
                {actionCount > 0 && (
                  <Badge className="bg-rose-500 text-white border-0 text-xs">{actionCount}</Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pending Approvals */}
            <ActionSection
              icon={Clock}
              iconColor="text-amber-500"
              title="Pending Approvals"
              count={pendingLeaves.length}
              emptyText="All caught up"
            >
              <div className="space-y-1.5">
                {pendingLeaves.slice(0, 5).map(l => (
                  <div key={l.id} className="flex items-center gap-2 py-1 border-b border-slate-50 last:border-0">
                    <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                      {l.employee_name?.charAt(0) || '?'}
                    </div>
                    <span className="text-sm text-slate-800 flex-1 truncate">{l.employee_name}</span>
                    <Badge className={`text-xs border-0 shrink-0 ${typeColors[l.type] || 'bg-slate-100 text-slate-700'}`}>
                      {typeAbbr[l.type] || l.type}
                    </Badge>
                  </div>
                ))}
                {pendingLeaves.length > 5 && (
                  <Link to="/leaves" className="text-xs text-indigo-600 hover:underline block pt-1">
                    +{pendingLeaves.length - 5} more — View all
                  </Link>
                )}
                {pendingLeaves.length <= 5 && (
                  <Link to="/leaves" className="text-xs text-indigo-600 hover:underline block pt-1">
                    Go to Leave Management →
                  </Link>
                )}
              </div>
            </ActionSection>

            <div className="border-t border-slate-100" />

            {/* Notifications */}
            <ActionSection
              icon={Bell}
              iconColor="text-purple-500"
              title="Notifications"
              count={alerts.length}
              emptyText="No new notifications"
            >
              <div className="space-y-1.5">
                {alerts.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                    <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 leading-relaxed">{a.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{a.type}</p>
                    </div>
                  </div>
                ))}
                {alerts.length > 4 && (
                  <Link to="/alerts" className="text-xs text-indigo-600 hover:underline block pt-1">
                    +{alerts.length - 4} more — View all alerts →
                  </Link>
                )}
                {alerts.length <= 4 && alerts.length > 0 && (
                  <Link to="/alerts" className="text-xs text-indigo-600 hover:underline block pt-1">
                    View all alerts →
                  </Link>
                )}
              </div>
            </ActionSection>

            {/* Understaffing (conditional) */}
            {understaffedToday.length > 0 && (
              <>
                <div className="border-t border-slate-100" />
                <ActionSection
                  icon={AlertTriangle}
                  iconColor="text-red-500"
                  title="Understaffing"
                  count={understaffedToday.length}
                  emptyText=""
                >
                  <div className="p-2.5 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-700">
                      {understaffedToday
                        .map(o => `${o.name} (${o.staffed}/${o.staffing_threshold})`)
                        .join(', ')} — below minimum staffing threshold.
                    </p>
                  </div>
                </ActionSection>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Upcoming Leaves full-width ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Upcoming Leaves (14 days)</span>
            <Link to="/leaves" className="text-xs text-indigo-600 font-normal hover:underline">View all</Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingLeaves.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming leaves in the next 14 days.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {upcomingLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 shadow-sm">
                    {l.employee_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{l.employee_name}</p>
                    <p className="text-xs text-slate-500">{l.start_date} → {l.end_date}</p>
                  </div>
                  <Badge className={`text-xs border-0 shrink-0 ${typeColors[l.type] || 'bg-slate-100 text-slate-700'}`}>
                    {typeAbbr[l.type] || l.type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
