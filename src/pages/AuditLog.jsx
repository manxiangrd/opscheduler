import { db } from '@/lib/db';

import { useState, useEffect } from 'react';

import { format } from 'date-fns';
import { Shield, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const actionColors = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-rose-100 text-rose-700',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.entities.AuditLog.list('-timestamp', 200).then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const filtered = logs.filter(l =>
    l.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.actor_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.target_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Shield size={22} /> Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">Full history of all changes and actions</p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, type, action..." className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            let details = {};
            try { details = JSON.parse(log.details || '{}'); } catch {}
            return (
              <Card key={log.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                      {log.actor_name?.charAt(0) || log.actor_email?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 text-sm">{log.actor_name || log.actor_email || 'Unknown'}</span>
                        <Badge className={`text-xs border-0 ${actionColors[log.action] || 'bg-slate-100 text-slate-600'}`}>{log.action}</Badge>
                        <Badge variant="outline" className="text-xs">{log.target_type}</Badge>
                      </div>
                      {Object.keys(details).length > 0 && (
                        <p className="text-sm text-slate-600 mt-0.5">
                          {Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                        </p>
                      )}
                      {log.timestamp && (
                        <p className="text-xs text-slate-400 mt-1">
                          {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-slate-400 py-12">No audit logs found.</p>}
        </div>
      )}
    </div>
  );
}