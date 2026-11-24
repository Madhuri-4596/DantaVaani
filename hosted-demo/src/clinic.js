// Mock clinic backend: slots, appointments, doctor alerts.
// Swap these functions for real Clinic-Assist / clinic API calls later.

const CLINIC = {
  name: 'Practice Sandbox',
  hours: 'No real operating schedule is connected.',
  hoursHi: 'Koi real clinic schedule connected nahi hai.',
};

// Non-operational test slots, only elapsed dates and safe counts stay in the sandbox.
const TIMES = ['17:30', '18:30'];

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isOpen(dateStr) { return parseYmd(dateStr).getDay() !== 0; } // Sunday closed

let slots = [];
let appointments = [];
let alerts = [];

function seed() {
  slots = []; appointments = []; alerts = [];
  const today = new Date();
  for (let i = 0; i < 10; i++) {
    const date = ymd(addDays(today, i));
    if (!isOpen(date)) continue;
    TIMES.forEach((time, j) => {
      // some slots pre-booked so the calendar looks real
      const taken = (i * 7 + j * 3) % 5 === 0;
      slots.push({ id: `${date}T${time}`, date, time, free: !taken });
    });
  }

}
seed();

function bucketOf(time) {
  const h = Number(time.split(':')[0]);
  if (h < 13) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
function minutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function notPast(slot) {
  const now = new Date();
  if (slot.date !== ymd(now)) return true;
  return minutes(slot.time) > now.getHours() * 60 + now.getMinutes() + 30;
}

// ---------- Tools (the "skills" the Action Agent uses) ----------

function check_slots({ date, time_pref }) {
  let free = slots.filter((s) => s.free && s.date === date && notPast(s));
  if (time_pref && /^\d{1,2}:\d{2}$/.test(time_pref)) {
    free = free.filter((s) => s.time === time_pref);
  } else if (['morning', 'afternoon', 'evening'].includes(time_pref)) {
    free = free.filter((s) => bucketOf(s.time) === time_pref);
  }
  return free.slice(0, 6);
}

function nearest_alternatives({ date, time_pref, count = 3 }) {
  const start = date ? parseYmd(date) : new Date();
  const out = [];
  for (let i = 0; i < 10 && out.length < count; i++) {
    const d = ymd(addDays(start, i));
    let found = check_slots({ date: d, time_pref });
    if (!found.length) found = check_slots({ date: d });
    for (const s of found) { if (out.length < count && !out.some((o) => o.date === s.date)) out.push(s); }
  }
  return out;
}

function book_appointment({ name, phone, slot_id, reason, status = 'confirmed' }) {
  const s = slots.find((x) => x.id === slot_id);
  if (!s || !s.free) return { error: 'slot_unavailable' };
  s.free = false;
  const appt = { id: 'A' + (1001 + appointments.length + Math.floor(Math.random() * 90)), name: name || 'Demo Visitor', phone, reason: reason || 'Practice appointment', date: s.date, time: s.time, slotId: s.id, status, source: 'DantaVaani', createdAt: new Date().toISOString() };
  appointments.push(appt);
  return appt;
}

function find_appointments({ phone }) {
  const today = ymd(new Date());
  return appointments.filter((a) => a.phone === phone && a.status !== 'cancelled' && a.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function cancel_appointment({ appointment_id }) {
  const a = appointments.find((x) => x.id === appointment_id);
  if (!a) return { error: 'not_found' };
  a.status = 'cancelled';
  const s = slots.find((x) => x.id === a.slotId); if (s) s.free = true;
  return { ok: true, appointment: a };
}

function reschedule_appointment({ appointment_id, new_slot_id }) {
  const a = appointments.find((x) => x.id === appointment_id);
  const ns = slots.find((x) => x.id === new_slot_id);
  if (!a) return { error: 'not_found' };
  if (!ns || !ns.free) return { error: 'slot_unavailable' };
  const old = slots.find((x) => x.id === a.slotId); if (old) old.free = true;
  ns.free = false;
  const from = { date: a.date, time: a.time };
  Object.assign(a, { date: ns.date, time: ns.time, slotId: ns.id, status: 'rescheduled' });
  return { ok: true, from, appointment: a };
}

function escalate_to_doctor({ summary, phone, severity, name }) {
  const alert = { id: 'E' + (101 + alerts.length), summary, phone: phone || null, name: name || null, severity, status: 'demo_callback_recorded', at: new Date().toISOString() };
  alerts.push(alert);
  return alert;
}

function update_alert({ alert_id, phone, name }) {
  const a = alerts.find((x) => x.id === alert_id);
  if (!a) return { error: 'not_found' };
  if (phone) { a.phone = phone; a.summary = a.summary.replace('phone: pending', `phone: ${phone}`); }
  if (name) { a.name = name; a.summary = a.summary.replace('name pending', name); }
  return a;
}

function clinic_info({ topics = [] }) {
  return { connected: false, topics };
}

function state() {
  return {
    clinic: CLINIC,
    appointments: [...appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    alerts: [...alerts].reverse(),
    freeSlotsNext3Days: slots.filter((s) => s.free && notPast(s) && s.date <= ymd(addDays(new Date(), 2))).length,
  };
}

module.exports = {
  CLINIC, ymd, parseYmd, addDays, isOpen, bucketOf, seed, state,
  tools: { check_slots, nearest_alternatives, book_appointment, find_appointments, cancel_appointment, reschedule_appointment, escalate_to_doctor, update_alert, clinic_info },
};
