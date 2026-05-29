import { db } from '@/lib/db';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { hashPassword } from '@/lib/db';
import { Plus, Edit2, UserX, UserCheck, Users, ShieldCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const emptyForm = { full_name: '', email: '', password: '', role: 'manager', notes: '', is_active: true };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const list = await db.entities.AppUser.list('-created_date');
    setUsers(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ full_name: u.full_name, email: u.email, password: '', role: u.role, notes: u.notes || '', is_active: u.is_active });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!editing && !form.password.trim()) {
      setError('Password is required for new users.');
      return;
    }

    // Check email uniqueness
    const all = await db.entities.AppUser.list();
    const dup = all.find(u => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.id !== editing?.id);
    if (dup) { setError('This email is already in use.'); return; }

    setSaving(true);
    try {
      const data = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        notes: form.notes,
        is_active: form.is_active,
      };
      if (form.password.trim()) {
        data.password_hash = hashPassword(form.password.trim());
      }

      if (editing) {
        await db.entities.AppUser.update(editing.id, data);
        await db.entities.AuditLog.create({
          actor_email: currentUser.email,
          actor_name: currentUser.full_name,
          action: 'update',
          target_type: 'AppUser',
          target_id: editing.id,
          details: JSON.stringify({ email: data.email, role: data.role }),
          timestamp: new Date().toISOString(),
        });
      } else {
        const created = await db.entities.AppUser.create(data);
        await db.entities.AuditLog.create({
          actor_email: currentUser.email,
          actor_name: currentUser.full_name,
          action: 'create',
          target_type: 'AppUser',
          target_id: created.id,
          details: JSON.stringify({ email: data.email, role: data.role }),
          timestamp: new Date().toISOString(),
        });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === currentUser.id) return; // can't deactivate yourself
    await db.entities.AppUser.update(u.id, { is_active: !u.is_active });
    await db.entities.AuditLog.create({
      actor_email: currentUser.email,
      actor_name: currentUser.full_name,
      action: 'update',
      target_type: 'AppUser',
      target_id: u.id,
      details: JSON.stringify({ is_active: !u.is_active }),
      timestamp: new Date().toISOString(),
    });
    load();
  };

  const roleColor = (role) =>
    role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage portal access for your team</p>
        </div>
        <Button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus size={15} className="mr-2" /> Add User
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: Users },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: ShieldCheck },
          { label: 'Active', value: users.filter(u => u.is_active).length, icon: UserCheck },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                <stat.icon size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User list */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                            {u.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-slate-900">
                            {u.full_name}
                            {u.id === currentUser?.id && <span className="text-xs text-slate-400 ml-1">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>
                          {u.role === 'admin' ? <ShieldCheck size={11} /> : <Shield size={11} />}
                          {u.role === 'admin' ? 'Admin' : 'Manager'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(u)} className="text-slate-500 hover:text-indigo-600 transition-colors p-1 rounded">
                            <Edit2 size={14} />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => toggleActive(u)}
                              className={`transition-colors p-1 rounded ${u.is_active ? 'text-slate-500 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}`}
                              title={u.is_active ? 'Deactivate' : 'Reactivate'}
                            >
                              {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input
                  className="mt-1"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Sarah Lee"
                />
              </div>
              <div className="col-span-2">
                <Label>Email *</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </div>
              <div className="col-span-2">
                <Label>{editing ? 'New Password (leave blank to keep current)' : 'Password *'}</Label>
                <Input
                  className="mt-1"
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? '••••••••' : 'Min. 6 characters'}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={String(form.is_active)} onValueChange={v => setForm(f => ({ ...f, is_active: v === 'true' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea
                  className="mt-1"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create User')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
