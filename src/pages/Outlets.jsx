import { db } from '@/lib/db';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Plus, Edit2, Trash2, Users, MapPin, Clock, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const PRESET_SHIFTS = {
  '24hr': [
    { name: 'Morning',   start_time: '06:00', end_time: '14:00' },
    { name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
    { name: 'Night',     start_time: '22:00', end_time: '06:00' },
  ],
  '16hr': [
    { name: 'Morning',   start_time: '06:00', end_time: '14:00' },
    { name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
  ],
  'custom': [],
};

const emptyOutlet = {
  name: '', location: '', staffing_threshold: 2,
  operating_hours: '16hr', shifts: [...PRESET_SHIFTS['16hr']],
  notes: '', is_active: true
};

export default function Outlets() {
  const { user: currentUser } = useAuth();
  const [outlets, setOutlets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyOutlet);
  const [saving, setSaving] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [outs, emps, deps] = await Promise.all([
      db.entities.Outlet.list(),
      db.entities.Employee.filter({ is_active: true }),
      db.entities.Deployment.filter({ date: today }),
    ]);
    setOutlets(outs);
    setEmployees(emps);
    setDeployments(deps);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyOutlet, shifts: PRESET_SHIFTS['16hr'].map(s => ({ ...s })) });
    setDialogOpen(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setForm({
      ...emptyOutlet,
      ...o,
      shifts: o.shifts ? o.shifts.map(s => ({ ...s })) : PRESET_SHIFTS['16hr'].map(s => ({ ...s })),
    });
    setDialogOpen(true);
  };

  const handleOperatingHoursChange = (v) => {
    setForm(f => ({
      ...f,
      operating_hours: v,
      shifts: v !== 'custom' ? PRESET_SHIFTS[v].map(s => ({ ...s })) : f.shifts,
    }));
  };

  const addShift = () => {
    setForm(f => ({
      ...f,
      shifts: [...(f.shifts || []), { name: '', start_time: '08:00', end_time: '16:00' }]
    }));
  };

  const updateShift = (idx, field, value) => {
    setForm(f => {
      const shifts = f.shifts.map((s, i) => i === idx ? { ...s, [field]: value } : s);
      return { ...f, shifts };
    });
  };

  const removeShift = (idx) => {
    setForm(f => ({ ...f, shifts: f.shifts.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.location) return;
    setSaving(true);
    const data = { ...form };

    if (editing) {
      await db.entities.Outlet.update(editing.id, data);
    } else {
      await db.entities.Outlet.create(data);
    }
    await db.entities.AuditLog.create({
      actor_email: currentUser.email, actor_name: currentUser.full_name,
      action: editing ? 'update' : 'create',
      target_type: 'Outlet', target_id: editing?.id || 'new',
      details: JSON.stringify({ name: form.name }), timestamp: new Date().toISOString()
    });
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (o) => {
    if (!confirm(`Deactivate outlet "${o.name}"?`)) return;
    await db.entities.Outlet.update(o.id, { is_active: false });
    load();
  };

  const shiftColor = (name) => {
    const n = name?.toLowerCase();
    if (n === 'morning') return 'bg-amber-100 text-amber-700';
    if (n === 'afternoon') return 'bg-blue-100 text-blue-700';
    if (n === 'night') return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Outlets</h1>
          <p className="text-sm text-slate-500 mt-1">{outlets.filter(o => o.is_active).length} active outlets</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus size={16} className="mr-1" /> Add Outlet
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {outlets.map(o => {
          const staffedToday = deployments.filter(d => d.outlet_id === o.id).length;
          const baseStaff = employees.filter(e => e.base_outlet_id === o.id).length;
          const ok = staffedToday >= o.staffing_threshold;
          return (
            <Card key={o.id} className={`border-0 shadow-sm ${!o.is_active ? 'opacity-50' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{o.name}</CardTitle>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={11} />{o.location}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(o)}>
                      <Edit2 size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(o)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Staffing status */}
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 text-slate-600">
                    <Users size={14} />
                    <span className="text-sm">
                      Today: <strong className={ok ? 'text-green-600' : 'text-red-600'}>{staffedToday}</strong> / min {o.staffing_threshold}
                    </span>
                  </div>
                  {!ok && <Badge variant="destructive" className="text-xs">Understaffed</Badge>}
                  {ok && <Badge className="text-xs bg-green-100 text-green-700 border-0">OK</Badge>}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Base staff: {baseStaff} · {o.operating_hours || '—'}
                </p>

                {/* Shift tags */}
                {o.shifts && o.shifts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {o.shifts.map((s, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${shiftColor(s.name)}`}>
                        <Clock size={9} />
                        {s.name} {s.start_time}–{s.end_time}
                      </span>
                    ))}
                  </div>
                )}

                {o.notes && <p className="text-xs text-slate-500 mt-2 italic">{o.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
        {outlets.length === 0 && (
          <p className="text-slate-400 text-sm col-span-3 text-center py-12">No outlets yet.</p>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Outlet' : 'Add Outlet'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Outlet Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Central Hub" />
            </div>
            <div>
              <Label>Location / Address *</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="mt-1" placeholder="Street address" />
            </div>
            <div>
              <Label>Min Staffing Threshold</Label>
              <Input type="number" min={1} value={form.staffing_threshold} onChange={e => setForm(f => ({ ...f, staffing_threshold: +e.target.value }))} className="mt-1 w-32" />
            </div>

            {/* ── Shift Configuration ────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={15} className="text-indigo-500" />
                <p className="text-sm font-semibold text-slate-800">Shift Configuration</p>
              </div>

              <div className="mb-3">
                <Label>Operating Hours</Label>
                <Select value={form.operating_hours} onValueChange={handleOperatingHoursChange}>
                  <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16hr">16-Hour Operation</SelectItem>
                    <SelectItem value="24hr">24-Hour Operation</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  {form.operating_hours === '24hr' && 'Presets: Morning / Afternoon / Night (8hrs each)'}
                  {form.operating_hours === '16hr' && 'Presets: Morning / Afternoon (8hrs each)'}
                  {form.operating_hours === 'custom' && 'Define your own shifts below'}
                </p>
              </div>

              {/* Shift list */}
              <div className="space-y-2">
                {(form.shifts || []).map((shift, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <Input
                      value={shift.name}
                      onChange={e => updateShift(idx, 'name', e.target.value)}
                      placeholder="Shift name"
                      className="flex-1 h-7 text-sm"
                    />
                    <input
                      type="time"
                      value={shift.start_time}
                      onChange={e => updateShift(idx, 'start_time', e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm w-24"
                    />
                    <span className="text-xs text-slate-400">–</span>
                    <input
                      type="time"
                      value={shift.end_time}
                      onChange={e => updateShift(idx, 'end_time', e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm w-24"
                    />
                    <button
                      type="button"
                      onClick={() => removeShift(idx)}
                      className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addShift}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  <PlusCircle size={14} /> Add Shift
                </button>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.location} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
