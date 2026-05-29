import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { differenceInCalendarDays, differenceInMonths, parseISO, format } from 'date-fns';
import {
  Plus, Search, CheckCircle, XCircle, FileText,
  CalendarDays, Info, AlertTriangle, Coffee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ─── Constants ───────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  'Annual Leave',
  'Medical Leave',
  'Hospitalisation Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Compassionate Leave',
  'Off Day',
];

const OFF_DAY = 'Off Day';

// Types that require 3 months continuous service
const REQUIRES_3M_SERVICE = [
  'Medical Leave',
  'Hospitalisation Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Compassionate Leave',
];

const statusColors = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const typeColors = {
  'Annual Leave':        'bg-blue-100 text-blue-700',
  'Medical Leave':       'bg-red-100 text-red-700',
  'Hospitalisation Leave': 'bg-rose-100 text-rose-700',
  'Maternity Leave':     'bg-pink-100 text-pink-700',
  'Paternity Leave':     'bg-violet-100 text-violet-700',
  'Compassionate Leave': 'bg-orange-100 text-orange-700',
  'Off Day':             'bg-slate-100 text-slate-600',
};

const typeAbbr = {
  'Annual Leave':        'AL',
  'Medical Leave':       'ML',
  'Hospitalisation Leave': 'HL',
  'Maternity Leave':     'MatL',
  'Paternity Leave':     'PatL',
  'Compassionate Leave': 'CL',
  'Off Day':             'OD',
};

// Tab options
const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending Approval' },
  { key: 'approved',  label: 'Approved' },
  { key: 'offday',    label: 'Off Days' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDays(start, end) {
  if (!start || !end) return 0;
  return Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)) + 1);
}

/**
 * Returns Singapore-law entitlement info for a leave type + hire_date.
 * Returns null if no warning needed.
 * Returns { level: 'warning'|'info', message: string } otherwise.
 */
function getEligibilityInfo(type, hireDate) {
  if (!hireDate || type === OFF_DAY || type === 'Annual Leave') return null;

  let monthsOfService;
  try {
    monthsOfService = differenceInMonths(new Date(), parseISO(hireDate));
  } catch {
    return null;
  }

  if (REQUIRES_3M_SERVICE.includes(type)) {
    if (monthsOfService < 3) {
      return {
        level: 'warning',
        message: `Employee has < 3 months of service. ${type} typically requires 3 months continuous service under Singapore Employment Act.`,
      };
    }

    // Pro-rated Medical / Hospitalisation (months 3–6)
    if ((type === 'Medical Leave' || type === 'Hospitalisation Leave') && monthsOfService < 6) {
      // At month 3: 15 days ML / 15 days total incl HL. Full entitlement (14ML + 46HL = 60 total) at month 6.
      // Linear interpolation: at m months (3≤m<6): (m-3)/(6-3) * (60-15) + 15 days total
      const totalDays = Math.round(((monthsOfService - 3) / 3) * (60 - 15) + 15);
      const mlDays = Math.min(14, Math.round(((monthsOfService - 3) / 3) * (14 - 5) + 5));
      return {
        level: 'info',
        message: `Pro-rated entitlement (${monthsOfService} months service): ~${mlDays} Medical Leave days, ~${totalDays} total (incl. Hospitalisation Leave).`,
      };
    }
  }

  return null;
}

/**
 * Annual Leave entitlement: starts 7 days, +1/year, capped at 14.
 */
function calcALEntitlement(hireDate) {
  if (!hireDate) return 7;
  try {
    const years = Math.floor(differenceInCalendarDays(new Date(), parseISO(hireDate)) / 365);
    return Math.min(7 + years, 14);
  } catch {
    return 7;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Leaves() {
  const { user: currentUser } = useAuth();

  const [leaves, setLeaves]       = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({
    employee_id: '', type: 'Annual Leave',
    start_date: '', end_date: '',
    reason: '', doc_url: '',
    status: 'Pending', notes: '',
  });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [lvs, emps] = await Promise.all([
      db.entities.Leave.list('-created_date', 300),
      db.entities.Employee.filter({ is_active: true }),
    ]);
    setLeaves(lvs);
    setEmployees(emps);
  };

  // ─── Computed ───────────────────────────────────────────────────────────

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === form.employee_id) || null,
    [employees, form.employee_id]
  );

  const eligibilityInfo = useMemo(
    () => getEligibilityInfo(form.type, selectedEmployee?.hire_date),
    [form.type, selectedEmployee]
  );

  // AL entitlement for selected employee (shown when type = AL)
  const alEntitlement = useMemo(
    () => selectedEmployee ? calcALEntitlement(selectedEmployee.hire_date) : 7,
    [selectedEmployee]
  );

  const filtered = useMemo(() => {
    return leaves.filter(l => {
      const searchMatch = !search || l.employee_name?.toLowerCase().includes(search.toLowerCase());
      const typeMatch   = filterType === 'all' || l.type === filterType;
      let tabMatch = true;
      if (tab === 'pending')  tabMatch = l.status === 'Pending';
      if (tab === 'approved') tabMatch = l.status === 'Approved' && l.type !== OFF_DAY;
      if (tab === 'offday')   tabMatch = l.type === OFF_DAY;
      return searchMatch && typeMatch && tabMatch;
    });
  }, [leaves, search, filterType, tab]);

  const pendingCount = useMemo(
    () => leaves.filter(l => l.status === 'Pending' && l.type !== OFF_DAY).length,
    [leaves]
  );
  const approvedCount = useMemo(
    () => leaves.filter(l => l.status === 'Approved' && l.type !== OFF_DAY).length,
    [leaves]
  );
  const offDayCount = useMemo(
    () => leaves.filter(l => l.type === OFF_DAY).length,
    [leaves]
  );

  // ─── Dialog ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm({
      employee_id: '', type: 'Annual Leave',
      start_date: '', end_date: '',
      reason: '', doc_url: '',
      status: 'Pending', notes: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (l) => {
    setEditing(l);
    setForm({ ...l });
    setDialogOpen(true);
  };

  // Auto-set status + clear reason when type changes to Off Day
  const handleTypeChange = (v) => {
    setForm(f => ({
      ...f,
      type: v,
      status: v === OFF_DAY ? 'Approved' : (f.status === 'Approved' ? 'Pending' : f.status),
      reason: v === OFF_DAY ? '' : f.reason,
    }));
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) return;
    setSaving(true);

    const emp  = employees.find(e => e.id === form.employee_id);
    const days = calcDays(form.start_date, form.end_date);
    const isOffDay = form.type === OFF_DAY;

    const data = {
      ...form,
      employee_name: emp?.name || '',
      days,
      // Off Day is always Approved
      status: isOffDay ? 'Approved' : form.status,
      reason: isOffDay ? '' : form.reason,
    };

    if (editing) {
      await db.entities.Leave.update(editing.id, data);
    } else {
      await db.entities.Leave.create(data);
      // Only create alert for non-Off Day leaves
      if (!isOffDay) {
        await db.entities.Alert.create({
          type: 'Upcoming Leave',
          message: `${emp?.name} applied for ${form.type} (${form.start_date} to ${form.end_date}, ${days} day(s)).`,
          recipient_roles: ['admin', 'manager'],
          related_employee_id: form.employee_id,
          status: 'New',
          triggered_at: new Date().toISOString(),
        });
      }
    }

    await db.entities.AuditLog.create({
      actor_email: currentUser?.email || '',
      actor_name:  currentUser?.full_name || '',
      action:      editing ? 'update' : 'create',
      target_type: 'Leave',
      target_id:   editing?.id || 'new',
      details: JSON.stringify({ employee: emp?.name, type: form.type, days }),
      timestamp: new Date().toISOString(),
    });

    setSaving(false);
    setDialogOpen(false);
    load();
  };

  // ─── Approve / Reject ───────────────────────────────────────────────────

  const handleApprove = async (l) => {
    const emp = employees.find(e => e.id === l.employee_id);
    await db.entities.Leave.update(l.id, { status: 'Approved' });

    // Update relevant leave balance counters (no Low AL Alert per spec)
    if (emp) {
      if (l.type === 'Annual Leave') {
        const newTaken   = (emp.al_taken || 0) + (l.days || 0);
        const entitlement = calcALEntitlement(emp.hire_date);
        const newBalance = entitlement - newTaken;
        await db.entities.Employee.update(emp.id, { al_taken: newTaken, al_balance: newBalance });
      } else if (l.type === 'Medical Leave') {
        await db.entities.Employee.update(emp.id, { ml_taken: (emp.ml_taken || 0) + (l.days || 0) });
      } else if (l.type === 'Hospitalisation Leave') {
        await db.entities.Employee.update(emp.id, { hl_taken: (emp.hl_taken || 0) + (l.days || 0) });
      }
    }

    await db.entities.AuditLog.create({
      actor_email: currentUser?.email || '',
      actor_name:  currentUser?.full_name || '',
      action: 'approve',
      target_type: 'Leave', target_id: l.id,
      details: JSON.stringify({ employee: l.employee_name, type: l.type }),
      timestamp: new Date().toISOString(),
    });
    load();
  };

  const handleReject = async (l) => {
    await db.entities.Leave.update(l.id, { status: 'Rejected' });
    await db.entities.AuditLog.create({
      actor_email: currentUser?.email || '',
      actor_name:  currentUser?.full_name || '',
      action: 'reject',
      target_type: 'Leave', target_id: l.id,
      details: JSON.stringify({ employee: l.employee_name, type: l.type }),
      timestamp: new Date().toISOString(),
    });
    load();
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pendingCount > 0
              ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}`
              : 'No pending approvals'}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus size={16} className="mr-1" /> Log Leave / Off Day
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => {
          const countMap = {
            all:      leaves.length,
            pending:  pendingCount,
            approved: approvedCount,
            offday:   offDayCount,
          };
          const badgeColors = {
            all:      'bg-slate-200 text-slate-600',
            pending:  'bg-amber-500 text-white',
            approved: 'bg-green-100 text-green-700',
            offday:   'bg-teal-100 text-teal-700',
          };
          const count = countMap[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${badgeColors[t.key]}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="pl-9"
          />
        </div>
        {tab === 'all' && (
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Leave Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {LEAVE_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Leave List */}
      <div className="space-y-3">
        {filtered.map(l => {
          const isOD = l.type === OFF_DAY;
          return (
            <Card key={l.id} className={`border-0 shadow-sm ${isOD ? 'bg-slate-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isOD ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
                    {isOD ? <Coffee size={16} /> : (l.employee_name?.charAt(0) || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{l.employee_name}</span>
                      <Badge className={`text-xs border-0 ${typeColors[l.type] || 'bg-slate-100 text-slate-700'}`}>
                        {typeAbbr[l.type] || l.type}
                      </Badge>
                      {!isOD && (
                        <Badge className={`text-xs border-0 ${statusColors[l.status] || 'bg-slate-100 text-slate-700'}`}>
                          {l.status}
                        </Badge>
                      )}
                      {isOD && (
                        <Badge className="text-xs border-0 bg-green-100 text-green-700">Auto-Approved</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {l.start_date} → {l.end_date}
                      <span className="ml-2 font-medium text-slate-900">
                        ({l.days || calcDays(l.start_date, l.end_date)} day{(l.days || 1) !== 1 ? 's' : ''})
                      </span>
                    </p>
                    {l.reason && <p className="text-xs text-slate-500 mt-1 italic">"{l.reason}"</p>}
                    {l.doc_url && (
                      <a
                        href={l.doc_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <FileText size={12} /> Supporting doc
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isOD && l.status === 'Pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-2"
                          onClick={() => handleApprove(l)}
                        >
                          <CheckCircle size={15} className="mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                          onClick={() => handleReject(l)}
                        >
                          <XCircle size={15} className="mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-slate-500"
                      onClick={() => openEdit(l)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-12">No leave records found.</p>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays size={18} className="text-indigo-600" />
              {editing ? 'Edit Leave Record' : 'Log New Leave / Off Day'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Employee */}
            <div>
              <Label>Employee *</Label>
              <Select
                value={form.employee_id}
                onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                      {e.is_runner ? ' 🔸' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Leave Type */}
            <div>
              <Label>Leave Type *</Label>
              <Select value={form.type} onValueChange={handleTypeChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Eligibility Info Banner */}
            {eligibilityInfo && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                eligibilityInfo.level === 'warning'
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}>
                {eligibilityInfo.level === 'warning'
                  ? <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  : <Info size={15} className="mt-0.5 shrink-0" />
                }
                <span>{eligibilityInfo.message}</span>
              </div>
            )}

            {/* AL Entitlement Info */}
            {form.type === 'Annual Leave' && selectedEmployee && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-blue-50 border border-blue-200 text-blue-800">
                <Info size={15} className="mt-0.5 shrink-0" />
                <span>
                  AL entitlement: <strong>{alEntitlement} days</strong>
                  {selectedEmployee.al_taken ? ` · ${selectedEmployee.al_taken} taken · ${alEntitlement - (selectedEmployee.al_taken || 0)} remaining` : ''}
                </span>
              </div>
            )}

            {/* Off Day notice */}
            {form.type === OFF_DAY && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-slate-50 border border-slate-200 text-slate-700">
                <Coffee size={15} className="mt-0.5 shrink-0" />
                <span>Off Day is mandatory rest — automatically approved, no reason required.</span>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {form.start_date && form.end_date && (
              <p className="text-sm text-indigo-700 font-medium">
                Duration: {calcDays(form.start_date, form.end_date)} day(s)
              </p>
            )}

            {/* Reason (hidden for Off Day) */}
            {form.type !== OFF_DAY && (
              <div>
                <Label>Reason</Label>
                <Textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  className="mt-1"
                  placeholder="Optional — e.g. family emergency, medical appointment..."
                />
              </div>
            )}

            {/* Supporting Doc (hidden for Off Day) */}
            {form.type !== OFF_DAY && (
              <div>
                <Label>Supporting Document URL</Label>
                <Input
                  value={form.doc_url}
                  onChange={e => setForm(f => ({ ...f, doc_url: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            )}

            {/* Status (hidden for Off Day — always Approved) */}
            {form.type !== OFF_DAY && (
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>Internal Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="Optional internal notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.employee_id || !form.start_date || !form.end_date}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? 'Saving...' : (form.type === OFF_DAY ? 'Log Off Day' : 'Save Leave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
