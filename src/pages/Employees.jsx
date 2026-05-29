import { db } from '@/lib/db';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { Plus, Search, Edit2, Trash2, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const emptyEmp = {
  name: '', role: '', base_outlet_id: '', base_outlet_name: '', contact: '',
  hire_date: '', al_entitlement: 7, al_taken: 0, ml_taken: 0, al_balance: 7,
  is_runner: false, contracted_hours: 8, notes: '', is_active: true
};

const CONTRACT_HOURS = [4, 6, 8, 10, 12];

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEmp);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [emps, outs] = await Promise.all([
      db.entities.Employee.list('-created_date'),
      db.entities.Outlet.filter({ is_active: true }),
    ]);
    setEmployees(emps);
    setOutlets(outs);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyEmp);
    setDialogOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      ...emptyEmp,
      ...emp,
      contracted_hours: emp.contracted_hours ?? 8,
      is_runner: emp.is_runner ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.role.trim()) return;
    setSaving(true);

    const data = {
      ...form,
      al_balance: form.al_entitlement - form.al_taken,
      // If runner, clear base_outlet fields
      base_outlet_id: form.is_runner ? '' : form.base_outlet_id,
      base_outlet_name: form.is_runner ? '' : form.base_outlet_name,
    };

    if (editing) {
      await db.entities.Employee.update(editing.id, data);
      await db.entities.AuditLog.create({
        actor_email: currentUser.email, actor_name: currentUser.full_name, action: 'update',
        target_type: 'Employee', target_id: editing.id,
        details: JSON.stringify({ name: data.name }), timestamp: new Date().toISOString()
      });
    } else {
      const created = await db.entities.Employee.create(data);
      await db.entities.AuditLog.create({
        actor_email: currentUser.email, actor_name: currentUser.full_name, action: 'create',
        target_type: 'Employee', target_id: created.id,
        details: JSON.stringify({ name: data.name }), timestamp: new Date().toISOString()
      });
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (emp) => {
    if (!confirm(`Deactivate ${emp.name}? They will no longer appear in scheduling.`)) return;
    await db.entities.Employee.update(emp.id, { is_active: false });
    await db.entities.AuditLog.create({
      actor_email: currentUser.email, actor_name: currentUser.full_name, action: 'delete',
      target_type: 'Employee', target_id: emp.id,
      details: JSON.stringify({ name: emp.name }), timestamp: new Date().toISOString()
    });
    load();
  };

  const handleOutletChange = (id) => {
    const outlet = outlets.find(o => o.id === id);
    setForm(f => ({ ...f, base_outlet_id: id, base_outlet_name: outlet?.name || '' }));
  };

  const filtered = employees
    .filter(e => {
      if (filterStatus === 'active') return e.is_active !== false;
      if (filterStatus === 'inactive') return e.is_active === false;
      return true;
    })
    .filter(e =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.role?.toLowerCase().includes(search.toLowerCase()) ||
      e.base_outlet_name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">
            {employees.filter(e => e.is_active !== false).length} active ·{' '}
            {employees.filter(e => e.is_runner).length} runners
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus size={16} className="mr-1" /> Add Employee
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, outlet..." className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="all">All Staff</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(emp => (
            <Card key={emp.id} className={`border-0 shadow-sm ${!emp.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${emp.is_runner ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {emp.is_runner ? <Zap size={18} /> : (emp.name?.charAt(0) || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{emp.name}</p>
                      <Badge variant="outline" className="text-xs">{emp.role}</Badge>
                      {emp.is_runner && (
                        <Badge className="text-xs bg-orange-500 text-white border-0">Runner</Badge>
                      )}
                      {!emp.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {emp.is_runner
                        ? <span className="text-orange-600 text-xs font-medium">Floats across all outlets</span>
                        : emp.base_outlet_name || 'No base outlet'
                      }
                      {emp.contact && ` · ${emp.contact}`}
                    </p>
                    <div className="flex gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-slate-600">
                        AL: <strong className={emp.al_balance <= 3 ? 'text-red-600' : 'text-green-600'}>
                          {emp.al_balance ?? emp.al_entitlement} / {emp.al_entitlement} days
                        </strong>
                      </span>
                      <span className="text-xs text-slate-600">ML Taken: <strong>{emp.ml_taken ?? 0}</strong></span>
                      <span className="text-xs text-slate-600">
                        <strong>{emp.contracted_hours ?? 8} hrs/day</strong>
                      </span>
                      {emp.hire_date && (
                        <span className="text-xs text-slate-600">Hired: <strong>{emp.hire_date}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(emp)}>
                      <Edit2 size={15} />
                    </Button>
                    {emp.is_active !== false && (
                      <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(emp)}>
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 py-12">No employees found.</p>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Runner toggle — full width */}
              <div className="col-span-2 flex items-center justify-between bg-orange-50 rounded-lg px-4 py-3 border border-orange-100">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-orange-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Runner (Floater)</p>
                    <p className="text-xs text-slate-500">Covers multiple outlets, no fixed base</p>
                  </div>
                </div>
                <Switch
                  checked={form.is_runner}
                  onCheckedChange={v => setForm(f => ({ ...f, is_runner: v, base_outlet_id: v ? '' : f.base_outlet_id, base_outlet_name: v ? '' : f.base_outlet_name }))}
                />
              </div>

              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className="mt-1" />
              </div>
              <div>
                <Label>Role / Position *</Label>
                <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Crew, Crew Lead" className="mt-1" />
              </div>
              <div>
                <Label>Contact</Label>
                <Input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="+65 9xxx xxxx" className="mt-1" />
              </div>

              {/* Base outlet — hidden when runner */}
              {!form.is_runner && (
                <div>
                  <Label>Base Outlet</Label>
                  <Select value={form.base_outlet_id || ''} onValueChange={handleOutletChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select outlet" /></SelectTrigger>
                    <SelectContent>
                      {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Hire Date</Label>
                <Input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className="mt-1" />
              </div>

              {/* Contracted Hours */}
              <div className="col-span-2">
                <Label>Contracted Hours / Day</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {CONTRACT_HOURS.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, contracted_hours: h }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.contracted_hours === h ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'}`}
                    >
                      {h} hrs
                    </button>
                  ))}
                  <input
                    type="number"
                    value={CONTRACT_HOURS.includes(form.contracted_hours) ? '' : form.contracted_hours}
                    onChange={e => setForm(f => ({ ...f, contracted_hours: +e.target.value }))}
                    placeholder="Custom"
                    className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                    min={1}
                    max={24}
                  />
                </div>
              </div>

              {/* Leave entitlements */}
              <div className="col-span-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Leave Entitlements</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>AL Entitlement</Label>
                    <Input type="number" value={form.al_entitlement} onChange={e => setForm(f => ({ ...f, al_entitlement: +e.target.value, al_balance: +e.target.value - (f.al_taken || 0) }))} className="mt-1" min={0} />
                  </div>
                  <div>
                    <Label>AL Taken</Label>
                    <Input type="number" value={form.al_taken} onChange={e => setForm(f => ({ ...f, al_taken: +e.target.value, al_balance: (f.al_entitlement || 7) - +e.target.value }))} className="mt-1" min={0} />
                  </div>
                  <div>
                    <Label>ML Taken</Label>
                    <Input type="number" value={form.ml_taken} onChange={e => setForm(f => ({ ...f, ml_taken: +e.target.value }))} className="mt-1" min={0} />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  AL Balance: <strong className={form.al_entitlement - form.al_taken <= 3 ? 'text-red-600' : 'text-green-600'}>{form.al_entitlement - form.al_taken} days</strong>
                  {' · '}AL starts at 7 days, +1/year up to 14.
                </p>
              </div>

              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" placeholder="Optional notes..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.role} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
