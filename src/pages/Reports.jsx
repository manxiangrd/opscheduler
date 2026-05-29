import { db } from '@/lib/db';

import { useState, useEffect, useRef } from 'react';

import { format, endOfMonth } from 'date-fns';
import { Eye, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const months = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: format(new Date(2024, i, 1), 'MMMM')
}));

const years = ['2024', '2025', '2026'];

export default function Reports() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    const monthStart = `${year}-${month}-01`;
    const monthEnd = format(endOfMonth(new Date(+year, +month - 1, 1)), 'yyyy-MM-dd');

    const [employees, leaves, deployments] = await Promise.all([
      db.entities.Employee.filter({ is_active: true }),
      db.entities.Leave.list('-start_date', 500),
      db.entities.Deployment.list('-date', 1000),
    ]);

    const monthLeaves = leaves.filter(l => l.start_date >= monthStart && l.start_date <= monthEnd);
    const monthDeployments = deployments.filter(d => d.date >= monthStart && d.date <= monthEnd);

    const rows = employees.map(emp => {
      const empLeaves = monthLeaves.filter(l => l.employee_id === emp.id && l.status === 'Approved');
      const empDeps = monthDeployments.filter(d => d.employee_id === emp.id);
      const alDays = empLeaves.filter(l => l.type === 'Annual Leave').reduce((s, l) => s + (l.days || 0), 0);
      const mlDays = empLeaves.filter(l => l.type === 'Medical Leave').reduce((s, l) => s + (l.days || 0), 0);
      const odDays = empLeaves.filter(l => l.type === 'Off Day').reduce((s, l) => s + (l.days || 0), 0);
      return { emp, deployments: empDeps, leaves: empLeaves, alDays, mlDays, odDays, deploymentCount: empDeps.length };
    });

    setReportData({ rows, monthStart, monthEnd, generatedAt: new Date() });
    setLoading(false);
  };

  const monthLabel = months.find(m => m.value === month)?.label;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monthly Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Generate HR-ready PDF summaries for any month</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Month</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Year</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generateReport} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading ? <RefreshCw size={15} className="mr-2 animate-spin" /> : <Eye size={15} className="mr-2" />}
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
            {reportData && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={15} className="mr-2" /> Print / Save PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-700 text-white px-8 py-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold">Monthly HR Summary Report</h2>
                <p className="text-indigo-200 mt-1">{monthLabel} {year}</p>
              </div>
              <div className="text-right text-sm text-indigo-200">
                <p>Generated: {format(reportData.generatedAt, 'dd MMM yyyy HH:mm')}</p>
                <p>Period: {reportData.monthStart} to {reportData.monthEnd}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label: 'Total Staff', value: reportData.rows.length },
              { label: 'Total AL Days', value: reportData.rows.reduce((s, r) => s + r.alDays, 0) },
              { label: 'Total ML Days', value: reportData.rows.reduce((s, r) => s + r.mlDays, 0) },
              { label: 'Total Deployments', value: reportData.rows.reduce((s, r) => s + r.deploymentCount, 0) },
            ].map(stat => (
              <div key={stat.label} className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="p-6 space-y-8">
            {/* Summary Table */}
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-4">Employee Leave &amp; Deployment Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      {['Employee','Role','Deployments','AL Days','ML Days','Off Days','AL Balance','Notes'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-700 border border-slate-200 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, idx) => (
                      <tr key={row.emp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-3 py-2 border border-slate-200 font-medium whitespace-nowrap">{row.emp.name}</td>
                        <td className="px-3 py-2 border border-slate-200 text-slate-600">{row.emp.role}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center">{row.deploymentCount}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center text-blue-700 font-medium">{row.alDays}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center text-red-700 font-medium">{row.mlDays}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center">{row.odDays}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center">
                          <span className={`font-semibold ${(row.emp.al_balance ?? row.emp.al_entitlement) <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                            {row.emp.al_balance ?? row.emp.al_entitlement}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-slate-200 text-slate-500 text-xs">{row.emp.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Leave Detail */}
            {reportData.rows.some(r => r.leaves.length > 0) && (
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-4">Leave Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        {['Employee','Type','Start','End','Days','Reason'].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-700 border border-slate-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.flatMap(r => r.leaves).map((l, idx) => (
                        <tr key={l.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-3 py-2 border border-slate-200 font-medium">{l.employee_name}</td>
                          <td className="px-3 py-2 border border-slate-200">{l.type}</td>
                          <td className="px-3 py-2 border border-slate-200">{l.start_date}</td>
                          <td className="px-3 py-2 border border-slate-200">{l.end_date}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center">{l.days}</td>
                          <td className="px-3 py-2 border border-slate-200 text-slate-600">{l.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Signature Block */}
            <div className="pt-6 border-t border-slate-200">
              <div className="grid grid-cols-3 gap-8">
                {['Prepared by (OM)', 'Reviewed by (OM)', 'Approved by (Admin/Boss)'].map(label => (
                  <div key={label} className="text-center">
                    <div className="border-b-2 border-slate-400 mb-2 h-12"></div>
                    <p className="text-xs text-slate-600">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Name / Date</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}