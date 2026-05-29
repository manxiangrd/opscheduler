/**
 * Seed data — written to localStorage on first load only.
 * Run seedIfEmpty() once at app startup (in main.jsx).
 */

import { db, hashPassword } from '@/lib/db';

const KEY = 'ops_seeded_v4';

export async function seedIfEmpty() {
  if (localStorage.getItem(KEY)) return; // already seeded

  // ── AppUsers ───────────────────────────────────────────────────────────────
  await db.entities.AppUser.create({
    full_name: 'Admin',
    email: 'admin@ops.local',
    password_hash: hashPassword('Admin1234'),
    role: 'admin',
    is_active: true,
    notes: 'Default administrator account',
  });
  await db.entities.AppUser.create({
    full_name: 'Manager',
    email: 'manager@ops.local',
    password_hash: hashPassword('Manager1234'),
    role: 'manager',
    is_active: true,
    notes: 'Default manager test account',
  });

  // ── Outlets ────────────────────────────────────────────────────────────────
  const outlet1 = await db.entities.Outlet.create({
    name: 'Central Hub',
    location: '12 Orchard Road, #03-01',
    staffing_threshold: 2,
    operating_hours: '16hr',
    shifts: [
      { name: 'Morning', start_time: '06:00', end_time: '14:00' },
      { name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
    ],
    notes: 'Main downtown outlet',
    is_active: true,
  });
  const outlet2 = await db.entities.Outlet.create({
    name: 'West Wing',
    location: '88 Jurong East St 21, #01-05',
    staffing_threshold: 2,
    operating_hours: '24hr',
    shifts: [
      { name: 'Morning', start_time: '06:00', end_time: '14:00' },
      { name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
      { name: 'Night', start_time: '22:00', end_time: '06:00' },
    ],
    notes: 'High footfall on weekends',
    is_active: true,
  });
  const outlet3 = await db.entities.Outlet.create({
    name: 'North Point',
    location: '930 Yishun Ave 2, #B1-02',
    staffing_threshold: 1,
    operating_hours: '16hr',
    shifts: [
      { name: 'Morning', start_time: '08:00', end_time: '16:00' },
      { name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
    ],
    notes: 'Smaller outlet',
    is_active: true,
  });

  // ── Employees ──────────────────────────────────────────────────────────────
  const emp1 = await db.entities.Employee.create({
    name: 'Alice Tan',
    role: 'Operations Manager',
    base_outlet_id: outlet1.id,
    base_outlet_name: outlet1.name,
    contact: '+65 9111 2233',
    hire_date: '2021-03-15',
    al_entitlement: 11,
    al_taken: 5,
    ml_taken: 0,
    al_balance: 6,
    is_runner: false,
    contracted_hours: 8,
    notes: 'Senior OM',
    is_active: true,
  });
  const emp2 = await db.entities.Employee.create({
    name: 'Ben Lim',
    role: 'Crew Lead',
    base_outlet_id: outlet1.id,
    base_outlet_name: outlet1.name,
    contact: '+65 9222 3344',
    hire_date: '2022-07-01',
    al_entitlement: 9,
    al_taken: 3,
    ml_taken: 2,
    al_balance: 6,
    is_runner: false,
    contracted_hours: 8,
    notes: '',
    is_active: true,
  });
  const emp3 = await db.entities.Employee.create({
    name: 'Clara Wong',
    role: 'Crew',
    base_outlet_id: outlet2.id,
    base_outlet_name: outlet2.name,
    contact: '+65 9333 4455',
    hire_date: '2023-01-10',
    al_entitlement: 8,
    al_taken: 7,
    ml_taken: 0,
    al_balance: 1,
    is_runner: false,
    contracted_hours: 8,
    notes: 'Handles West Wing weekends',
    is_active: true,
  });
  const emp4 = await db.entities.Employee.create({
    name: 'David Ng',
    role: 'Crew',
    base_outlet_id: outlet2.id,
    base_outlet_name: outlet2.name,
    contact: '+65 9444 5566',
    hire_date: '2023-05-20',
    al_entitlement: 8,
    al_taken: 2,
    ml_taken: 1,
    al_balance: 6,
    is_runner: false,
    contracted_hours: 8,
    notes: '',
    is_active: true,
  });
  const emp5 = await db.entities.Employee.create({
    name: 'Eva Koh',
    role: 'Runner',
    base_outlet_id: null,
    base_outlet_name: '',
    contact: '+65 9555 6677',
    hire_date: '2024-02-01',
    al_entitlement: 7,
    al_taken: 1,
    ml_taken: 0,
    al_balance: 6,
    is_runner: true,
    contracted_hours: 8,
    notes: 'Covers all outlets',
    is_active: true,
  });
  const emp6 = await db.entities.Employee.create({
    name: 'Felix Ong',
    role: 'Runner',
    base_outlet_id: null,
    base_outlet_name: '',
    contact: '+65 9666 7788',
    hire_date: '2023-09-01',
    al_entitlement: 7,
    al_taken: 0,
    ml_taken: 0,
    al_balance: 7,
    is_runner: true,
    contracted_hours: 8,
    notes: 'Weekend runner',
    is_active: true,
  });

  // ── Deployments (this week) ────────────────────────────────────────────────
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  const fmt = (d) => d.toISOString().split('T')[0];

  const deployDays = [0, 1, 2, 3, 4]; // Mon–Fri
  const assignments = [
    { emp: emp1, outlet: outlet1, shift: 'Morning' },
    { emp: emp2, outlet: outlet1, shift: 'Afternoon' },
    { emp: emp3, outlet: outlet2, shift: 'Morning' },
    { emp: emp4, outlet: outlet2, shift: 'Afternoon' },
  ];

  for (const offset of deployDays) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    const dateStr = fmt(date);
    for (const { emp, outlet, shift } of assignments) {
      await db.entities.Deployment.create({
        employee_id: emp.id,
        employee_name: emp.name,
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        date: dateStr,
        shift,
        notes: '',
      });
    }
    // Runner assigned Mon/Wed/Fri
    if (offset % 2 === 0) {
      await db.entities.Deployment.create({
        employee_id: emp5.id,
        employee_name: emp5.name,
        outlet_id: outlet3.id,
        outlet_name: outlet3.name,
        date: dateStr,
        shift: 'Morning',
        notes: 'Covering North Point',
      });
    }
  }

  // ── Leaves ─────────────────────────────────────────────────────────────────
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  await db.entities.Leave.create({
    employee_id: emp3.id,
    employee_name: emp3.name,
    type: 'Annual Leave',
    start_date: fmt(nextMonday),
    end_date: fmt(new Date(nextMonday.getTime() + 2 * 86400000)),
    days: 3,
    reason: 'Family trip',
    status: 'Pending',
    outlet_id: outlet2.id,
    notes: '',
  });

  await db.entities.Leave.create({
    employee_id: emp4.id,
    employee_name: emp4.name,
    type: 'Medical Leave',
    start_date: fmt(new Date(today.getTime() - 2 * 86400000)),
    end_date: fmt(new Date(today.getTime() - 1 * 86400000)),
    days: 2,
    reason: 'Flu',
    status: 'Approved',
    outlet_id: outlet2.id,
    notes: 'MC submitted',
  });

  // Off day for today
  await db.entities.Leave.create({
    employee_id: emp2.id,
    employee_name: emp2.name,
    type: 'Off Day',
    start_date: fmt(today),
    end_date: fmt(today),
    days: 1,
    reason: '',
    status: 'Approved',
    outlet_id: outlet1.id,
    notes: 'Scheduled off day',
  });

  // Compassionate Leave — pending (upcoming)
  await db.entities.Leave.create({
    employee_id: emp1.id,
    employee_name: emp1.name,
    type: 'Compassionate Leave',
    start_date: fmt(new Date(today.getTime() + 3 * 86400000)),
    end_date: fmt(new Date(today.getTime() + 4 * 86400000)),
    days: 2,
    reason: 'Immediate family bereavement',
    status: 'Pending',
    notes: '',
  });

  // Hospitalisation Leave — approved (recent)
  await db.entities.Leave.create({
    employee_id: emp2.id,
    employee_name: emp2.name,
    type: 'Hospitalisation Leave',
    start_date: fmt(new Date(today.getTime() - 10 * 86400000)),
    end_date: fmt(new Date(today.getTime() - 6 * 86400000)),
    days: 5,
    reason: 'Minor surgery',
    status: 'Approved',
    notes: 'Hospital letter submitted',
  });

  // ── Alerts ─────────────────────────────────────────────────────────────────
  await db.entities.Alert.create({
    type: 'Upcoming Leave',
    message: `${emp3.name} applied for Annual Leave (${fmt(nextMonday)} to ${fmt(new Date(nextMonday.getTime() + 2 * 86400000))}, 3 day(s)).`,
    recipient_roles: ['admin', 'manager'],
    related_employee_id: emp3.id,
    related_outlet_id: outlet2.id,
    status: 'New',
    triggered_at: new Date().toISOString(),
  });

  // Mark as seeded
  localStorage.setItem(KEY, '1');
  console.log('[OpScheduler] Seed data v2 loaded successfully.');
}
