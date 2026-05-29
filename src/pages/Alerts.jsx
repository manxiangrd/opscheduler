import { db } from '@/lib/db';

import { useState, useEffect } from 'react';

import { format } from 'date-fns';
import { Bell, CheckCheck, Trash2, AlertTriangle, TrendingDown, CalendarClock, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const typeIcons = {
  'Upcoming Leave': CalendarClock,
  'Low AL Balance': TrendingDown,
  'Understaffing': Users,
  'Leave Approved': CheckCheck,
  'Leave Rejected': AlertTriangle,
  'System': Info,
};

const typeColors = {
  'Upcoming Leave': 'text-blue-600 bg-blue-50',
  'Low AL Balance': 'text-amber-600 bg-amber-50',
  'Understaffing': 'text-red-600 bg-red-50',
  'Leave Approved': 'text-green-600 bg-green-50',
  'Leave Rejected': 'text-red-600 bg-red-50',
  'System': 'text-slate-600 bg-slate-50',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const alts = await db.entities.Alert.list('-triggered_at', 200);
    setAlerts(alts);
    setLoading(false);
  };

  const markRead = async (a) => {
    await db.entities.Alert.update(a.id, { status: 'Read' });
    load();
  };

  const dismiss = async (a) => {
    await db.entities.Alert.update(a.id, { status: 'Dismissed' });
    load();
  };

  const markAllRead = async () => {
    const news = alerts.filter(a => a.status === 'New');
    await Promise.all(news.map(a => db.entities.Alert.update(a.id, { status: 'Read' })));
    load();
  };

  const filtered = alerts.filter(a => filter === 'all' || a.status === filter);
  const newCount = alerts.filter(a => a.status === 'New').length;

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Alerts
            {newCount > 0 && <Badge className="bg-red-500 text-white">{newCount} new</Badge>}
          </h1>
          <p className="text-sm text-slate-500 mt-1">In-app notifications for your operations</p>
        </div>
        {newCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck size={15} className="mr-1" /> Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        {['all', 'New', 'Read', 'Dismissed'].map(s => (
          <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}
            className={filter === s ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
            {s === 'all' ? 'All' : s}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(a => {
          const Icon = typeIcons[a.type] || Bell;
          const colorCls = typeColors[a.type] || 'text-slate-600 bg-slate-50';
          return (
            <Card key={a.id} className={`border-0 shadow-sm ${a.status === 'New' ? 'border-l-4 border-l-indigo-500' : 'opacity-70'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorCls}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{a.type}</Badge>
                      <Badge className={`text-xs border-0 ${
                        a.status === 'New' ? 'bg-red-100 text-red-700' :
                        a.status === 'Read' ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{a.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-800 mt-1">{a.message}</p>
                    {a.triggered_at && (
                      <p className="text-xs text-slate-400 mt-1">
                        {format(new Date(a.triggered_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {a.status === 'New' && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => markRead(a)}>Mark read</Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => dismiss(a)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Bell size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400">No alerts found.</p>
          </div>
        )}
      </div>
    </div>
  );
}