import { db } from '@/lib/db';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { format, addDays, subDays, startOfWeek, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Edit2, Zap, Calendar, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Outlet-color palette for Runner Roster
const OUTLET_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-violet-100 text-violet-700',
];

const FALLBACK_SHIFTS = ['Full Day', 'Morning', 'Afternoon', 'Night'];

export default function Deployments() {
  const { user: currentUser } = useAuth();
  const [view, setView] = useState('weekly'); // 'weekly' | 'runner'
  const [deployments, setDeployments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rosterMonth, setRosterMonth] = useState(new Date());
  const [filterOutlet, setFilterOutlet] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ employee_id: '', outlet_id: '', date: '', shift: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => { load(); }, [currentDate, rosterMonth]);

  const load = async () => {
    const [emps, outs, deps, lvs] = await Promise.all([
      db.entities.Employee.filter({ is_active: true }),
      db.entities.Outlet.filter({ is_active: true }),
      db.entities.Deployment.list('-date', 1000),
      db.entities.Leave.filter({ status: 'Approved' }),
    ]);
    setEmployees(emps);
    setOutlets(outs);
    setDeployments(deps);
    setLeaves(lvs);
  };

  // Map outlet id → color index
  const outletColorMap = useMemo(() => {
    const map = {};
    outlets.forEach((o, i) => { map[o.id] = OUTLET_COLORS[i % OUTLET_COLORS.length]; });
    return map;
  }, [outlets]);

  // Get shifts for selected outlet (or fallback)
  const getOutletShifts = (outletId) => {
    const o = outlets.find(x => x.id === outletId);
    if (o?.shifts && o.shifts.length > 0) return o.shifts.map(s => s.name);
    return FALLBACK_SHIFTS;
  };

  const weekDeployments = deployments.filter(d => {
    const inWeek = d.date >= format(weekDays[0], 'yyyy-MM-dd') && d.date <= format(weekDays[6], 'yyyy-MM-dd');
    const outletMatch = filterOutlet === 'all' || d.outlet_id === filterOutlet;
    const empMatch = filterEmployee === 'all' || d.employee_id === filterEmployee;
    return inWeek && outletMatch && empMatch;
  });

  const isOnLeave = (empId, dateStr) => leaves.some(l =>
    l.employee_id === empId && dateStr >= l.start_date && dateStr <= l.end_date
  );

  const getLeaveAbbr = (empId, dateStr) => {
    const l = leaves.find(lv => lv.employee_id === empId && dateStr >= lv.start_date && dateStr <= lv.end_date);
    if (!l) return null;
    if (l.type === 'Annual Leave') return { abbr: 'AL', color: 'bg-blue-50 text-blue-600' };
    if (l.type === 'Medical Leave') return { abbr: 'ML', color: 'bg-red-50 text-red-600' };
    if (l.type === 'Off Day') return { abbr: 'OFF', color: 'bg-gray-100 text-gray-500' };
    if (l.type === 'Hospitalisation Leave') return { abbr: 'HL', color: 'bg-red-100 text-red-700' };
    return { abbr: 'LV', color: 'bg-slate-50 text-slate-500' };
  };

  const shiftColor = (shiftName) => {
    const n = shiftName?.toLowerCase();
    if (n === 'morning') return 'bg-amber-100 text-amber-700';
    if (n === 'afternoon') return 'bg-blue-100 text-blue-700';
    if (n === 'night') return 'bg-purple-100 text-purple-700';
    if (n === 'full day') return 'bg-indigo-100 text-indigo-700';
    return 'bg-slate-100 text-slate-700';
  };

  const openCreate = (date = '', empId = '') => {
    setEditing(null);
    setForm({ employee_id: empId, outlet_id: '', date: date || format(new Date(), 'yyyy-MM-dd'), shift: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (dep) => {
    setEditing(dep);
    setForm({ ...dep });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.outlet_id || !form.date) return;
    setSaving(true);
    const emp = employees.find(e => e.id === form.employee_id);
    const outlet = outlets.find(o => o.id === form.outlet_id);
    const shiftName = form.shift || getOutletShifts(form.outlet_id)[0] || 'Full Day';
    const data = { ...form, shift: shiftName, employee_name: emp?.name || '', outlet_name: outlet?.name || '' };

    if (editing) {
      await db.entities.Deployment.update(editing.id, data);
    } else {
      await db.entities.Deployment.create(data);
    }
    await db.entities.AuditLog.create({
      actor_email: currentUser.email, actor_name: currentUser.full_name,
      action: editing ? 'update' : 'create',
      target_type: 'Deployment', target_id: editing?.id || 'new',
      details: JSON.stringify({ employee: emp?.name, date: form.date, outlet: outlet?.name, shift: shiftName }),
      timestamp: new Date().toISOString()
    });
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (dep) => {
    if (!confirm('Delete this deployment?')) return;
    await db.entities.Deployment.delete(dep.id);
    await db.entities.AuditLog.create({
      actor_email: currentUser.email, actor_name: currentUser.full_name, action: 'delete',
      target_type: 'Deployment', target_id: dep.id,
      details: JSON.stringify({ employee: dep.employee_name, date: dep.date }),
      timestamp: new Date().toISOString()
    });
    load();
  };

  const displayEmployees = filterEmployee === 'all' ? employees : employees.filter(e => e.id === filterEmployee);
  const runners = employees.filter(e => e.is_runner);

  // ─── Runner Roster ─────────────────────────────────────────────────────────
  const rosterDays = useMemo(() => {
    const count = getDaysInMonth(rosterMonth);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(rosterMonth.getFullYear(), rosterMonth.getMonth(), i + 1);
      return { date: d, str: format(d, 'yyyy-MM-dd'), day: i + 1, dow: format(d, 'EEE') };
    });
  }, [rosterMonth]);

  const rosterDeployments = useMemo(() =>
    deployments.filter(d => d.date >= rosterDays[0]?.str && d.date <= rosterDays[rosterDays.length - 1]?.str),
    [deployments, rosterDays]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deployments</h1>
          <p className="text-sm text-slate-500 mt-1">Assign employees to outlets</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'weekly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Calendar size={14} /> Weekly
            </button>
            <button
              onClick={() => setView('runner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'runner' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Zap size={14} /> Runner Roster
            </button>
          </div>
          <Button onClick={() => openCreate()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus size={16} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* ══ WEEKLY VIEW ══════════════════════════════════════════════════════ */}
      {view === 'weekly' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCurrentDate(d => subDays(d, 7))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium text-slate-700 min-w-48 text-center">
                {format(weekDays[0], 'dd MMM')} – {format(weekDays[6], 'dd MMM yyyy')}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCurrentDate(d => addDays(d, 7))}>
                <ChevronRight size={16} />
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setCurrentDate(new Date())}>Today</Button>
            </div>
            <Select value={filterOutlet} onValueChange={setFilterOutlet}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All Outlets" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}{e.is_runner ? ' (Runner)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold w-36">Employee</th>
                  {weekDays.map(d => (
                    <th key={d} className={`px-2 py-3 text-center font-semibold w-24 ${format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                      <div>{format(d, 'EEE')}</div>
                      <div className="text-xs font-normal">{format(d, 'd MMM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayEmployees.map((emp, idx) => (
                  <tr key={emp.id} className={`${idx % 2 === 0 ? 'bg-slate-50/50' : ''} ${emp.is_runner ? 'border-l-2 border-orange-300' : ''}`}>
                    <td className="px-4 py-2 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {emp.is_runner && <Zap size={11} className="text-orange-500 flex-shrink-0" />}
                        <div>
                          <div className="font-medium text-slate-900 text-xs leading-tight">{emp.name}</div>
                          <div className="text-xs text-slate-400">{emp.role}</div>
                        </div>
                      </div>
                    </td>
                    {weekDays.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const dep = weekDeployments.find(dep => dep.employee_id === emp.id && dep.date === dateStr);
                      const leaveInfo = getLeaveAbbr(emp.id, dateStr);
                      return (
                        <td key={dateStr} className="px-1 py-1.5 border-r border-slate-50 align-top">
                          {leaveInfo && !dep && (
                            <div className={`rounded px-1.5 py-1 text-xs text-center font-medium ${leaveInfo.color}`}>
                              {leaveInfo.abbr}
                            </div>
                          )}
                          {dep ? (
                            <div
                              className={`rounded px-1.5 py-1 text-xs cursor-pointer group relative ${shiftColor(dep.shift)}`}
                              onClick={() => openEdit(dep)}
                            >
                              <div className="font-medium truncate">{dep.outlet_name}</div>
                              <div className="text-xs opacity-70">{dep.shift}</div>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(dep); }}
                                className="absolute top-0.5 right-0.5 hidden group-hover:block text-red-400 hover:text-red-600 font-bold"
                              >×</button>
                            </div>
                          ) : !leaveInfo && (
                            <button
                              onClick={() => openCreate(dateStr, emp.id)}
                              className="w-full h-8 flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap text-xs text-slate-500">
            {['Morning', 'Afternoon', 'Night', 'Full Day'].map(s => (
              <span key={s} className={`px-2 py-0.5 rounded ${shiftColor(s)}`}>{s}</span>
            ))}
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600">AL</span>
            <span className="px-2 py-0.5 rounded bg-red-50 text-red-600">ML</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">OFF</span>
            <span className="px-2 py-0.5 rounded border-l-2 border-orange-300 pl-1.5 text-orange-600">Runner</span>
          </div>
        </>
      )}

      {/* ══ RUNNER ROSTER VIEW ═══════════════════════════════════════════════ */}
      {view === 'runner' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRosterMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium text-slate-700 min-w-36 text-center">
                {format(rosterMonth, 'MMMM yyyy')}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRosterMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                <ChevronRight size={16} />
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setRosterMonth(new Date())}>This Month</Button>
            </div>
            {/* Outlet color legend */}
            <div className="flex gap-2 flex-wrap">
              {outlets.map((o, i) => (
                <span key={o.id} className={`px-2 py-0.5 rounded text-xs font-medium ${OUTLET_COLORS[i % OUTLET_COLORS.length]}`}>
                  {o.name}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">OFF/Leave</span>
            </div>
          </div>

          {runners.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Zap size={32} className="mx-auto mb-2 text-orange-300" />
              <p>No runners assigned yet.</p>
              <p className="text-sm mt-1">Go to Employees and enable the Runner toggle for floating staff.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="text-xs min-w-max">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="sticky left-0 bg-slate-50 text-left px-4 py-3 font-semibold text-slate-600 w-36 z-10">Runner</th>
                    {rosterDays.map(({ day, dow, str }) => (
                      <th key={str} className={`px-1.5 py-2 text-center font-medium min-w-[38px] ${str === format(new Date(), 'yyyy-MM-dd') ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}>
                        <div>{dow}</div>
                        <div className="font-bold text-slate-700">{day}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runners.map((runner, idx) => (
                    <tr key={runner.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                      <td className="sticky left-0 bg-inherit px-4 py-2 border-r border-slate-100 z-10">
                        <div className="flex items-center gap-1.5">
                          <Zap size={11} className="text-orange-500 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-800 whitespace-nowrap">{runner.name}</p>
                            <p className="text-slate-400">{runner.contracted_hours ?? 8}h/day</p>
                          </div>
                        </div>
                      </td>
                      {rosterDays.map(({ str, date }) => {
                        const dep = rosterDeployments.find(d => d.employee_id === runner.id && d.date === str);
                        const leaveInfo = getLeaveAbbr(runner.id, str);
                        const isToday = str === format(new Date(), 'yyyy-MM-dd');
                        const isSun = date.getDay() === 0;
                        const isSat = date.getDay() === 6;

                        return (
                          <td key={str} className={`px-0.5 py-0.5 border-r border-slate-50 ${isSun || isSat ? 'bg-slate-50' : ''} ${isToday ? 'bg-indigo-50/40' : ''}`}>
                            {dep ? (
                              <button
                                onClick={() => openEdit(dep)}
                                className={`w-full rounded px-1 py-1 text-center font-medium leading-tight truncate ${outletColorMap[dep.outlet_id] || 'bg-slate-100 text-slate-700'}`}
                                title={`${dep.outlet_name} · ${dep.shift}`}
                              >
                                {dep.outlet_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)}
                              </button>
                            ) : leaveInfo ? (
                              <div className={`rounded px-1 py-1 text-center font-medium ${leaveInfo.color}`}>
                                {leaveInfo.abbr}
                              </div>
                            ) : (
                              <button
                                onClick={() => openCreate(str, runner.id)}
                                className="w-full h-7 flex items-center justify-center text-slate-200 hover:text-orange-400 hover:bg-orange-50 rounded transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ DEPLOYMENT DIALOG ════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Deployment' : 'Add Deployment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Employee *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-1.5">
                        {e.is_runner && <Zap size={11} className="text-orange-500" />}
                        {e.name}{e.is_runner ? ' (Runner)' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outlet *</Label>
              <Select value={form.outlet_id} onValueChange={v => {
                const shifts = getOutletShifts(v);
                setForm(f => ({ ...f, outlet_id: v, shift: shifts[0] || '' }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select outlet" /></SelectTrigger>
                <SelectContent>
                  {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Shift</Label>
              <Select
                value={form.shift}
                onValueChange={v => setForm(f => ({ ...f, shift: v }))}
                disabled={!form.outlet_id}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder={form.outlet_id ? 'Select shift' : 'Select outlet first'} /></SelectTrigger>
                <SelectContent>
                  {getOutletShifts(form.outlet_id).map(s => {
                    const outlet = outlets.find(o => o.id === form.outlet_id);
                    const shiftObj = outlet?.shifts?.find(sh => sh.name === s);
                    return (
                      <SelectItem key={s} value={s}>
                        {s}{shiftObj ? ` (${shiftObj.start_time}–${shiftObj.end_time})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.employee_id || !form.outlet_id || !form.date} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
