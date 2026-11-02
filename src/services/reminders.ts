// Rappels : notifications du téléphone (APK) et ajout au calendrier (Google Agenda, fichier .ics).
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Category, ReminderSettings, State } from '../engine';
import { WEEKDAYS_FR, daysIn, goalPlanned, fmt, fmtN, monthKey, occurrences, pad, planOf, shiftMonth } from '../engine';
import { APP } from '../config';
import { isNative } from './native';

export const DEFAULT_REMINDERS: ReminderSettings = { dailyLog: true, logTime: '20:00', dues: true, dueTime: '08:00', dayBefore: false };
export const remindersOf = (s: State): ReminderSettings => ({ ...DEFAULT_REMINDERS, ...(s.settings.reminders ?? {}) });

export interface PlannedReminder { id: number; at: Date; title: string; body: string }

const atTime = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0, 0);
};

/** Liste des rappels à programmer sur les `days` prochains jours. */
export function buildSchedule(state: State, now: Date, days = 30): PlannedReminder[] {
  const r = remindersOf(state);
  const out: PlannedReminder[] = [];
  const end = new Date(now.getTime() + days * 864e5);
  if (r.dailyLog) {
    for (let i = 0; i <= days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const at = atTime(d, r.logTime);
      if (at > now) out.push({ id: 0, at, title: 'Tes dépenses du jour', body: 'Pense à noter ce que tu as dépensé aujourd’hui : quelques secondes suffisent.' });
    }
  }
  if (r.dues) {
    const months = [monthKey(now), shiftMonth(monthKey(now), 1)];
    for (const c of state.categories) {
      const p = planOf(c);
      if (c.hidden || !p?.remind) continue;
      for (const m of months) {
        const [y, mo] = m.split('-').map(Number);
        for (const o of occurrences(c, m)) {
          let d = new Date(y, mo - 1, o.day);
          if (r.dayBefore) d = new Date(y, mo - 1, o.day - 1);
          const at = atTime(d, r.dueTime);
          if (at <= now || at > end) continue;
          const fixed = c.kind === 'obligatory';
          out.push({
            id: 0, at,
            title: fixed ? `${c.name} : ${fmt(o.amount)} XOF à payer${r.dayBefore ? ' demain' : ' aujourd’hui'}` : `${c.name} : ${fmt(o.amount)} XOF prévus${r.dayBefore ? ' demain' : ''}`,
            body: fixed ? 'Ta charge arrive à échéance. Une fois payée, touche « ✓ Payé » dans « À régler ».' : 'Ton budget pour cette période. Note tes dépenses pour garder le cap.',
          });
        }
      }
    }
    // Versements prévus pour les projets (objectifs)
    for (const g of state.goals ?? []) {
      if (!g.day || g.remind === false || g.paused || g.doneAt) continue;
      for (const m of months) {
        if (m > g.deadline) continue;
        const [y, mo] = m.split('-').map(Number);
        let d = new Date(y, mo - 1, Math.min(g.day, daysIn(m)));
        if (r.dayBefore) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
        const at = atTime(d, r.dueTime);
        if (at <= now || at > end) continue;
        const src = state.wallets.find((w) => w.id === g.sourceWalletId)?.name;
        out.push({
          id: 0, at,
          title: `Projet « ${g.name} » : ${fmt(goalPlanned(g, m))} XOF à mettre de côté${r.dayBefore ? ' demain' : ''}`,
          body: `${src ? `Depuis ${src}. ` : ''}Une fois le virement fait, touche « ✓ Versé » dans « À régler ».`,
        });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 120).map((x, i) => ({ ...x, id: 1000 + i }));
}

export type PermState = 'granted' | 'denied' | 'prompt' | 'web';

export async function notificationPermission(ask = false): Promise<PermState> {
  if (!isNative()) return 'web';
  try {
    const p = ask ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  } catch { return 'denied'; }
}

/** Reprogramme tous les rappels sur le téléphone (APK). Renvoie le nombre programmé. */
export async function applyNativeReminders(state: State): Promise<number> {
  if (!isNative()) return 0;
  if ((await notificationPermission()) !== 'granted') return 0;
  try { await LocalNotifications.createChannel({ id: 'rappels', name: 'Rappels du budget', importance: 4, description: 'Échéances et rappel quotidien' } as any); } catch { /* déjà créé */ }
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  const list = buildSchedule(state, new Date());
  if (!list.length) return 0;
  await LocalNotifications.schedule({
    notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: 'rappels', schedule: { at: n.at, allowWhileIdle: true } })),
  } as any);
  return list.length;
}

// ---------------------------------------------------------------------
// Calendrier
// ---------------------------------------------------------------------
const RR_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

/** Règle de récurrence (RRULE) correspondant au rythme de l'enveloppe. */
export function rruleOf(c: Category): string | null {
  const p = planOf(c);
  if (!p) return null;
  if (p.freq === 'daily') return 'FREQ=DAILY';
  if (p.freq === 'weekly') return `FREQ=WEEKLY;BYDAY=${(p.weekdays?.length ? p.weekdays : [1]).map((d) => RR_DAYS[d]).join(',')}`;
  if (p.freq === 'monthly' && c.dueDay) return `FREQ=MONTHLY;BYMONTHDAY=${c.dueDay}`;
  if (p.freq === 'dates' && p.dates?.length) return `FREQ=MONTHLY;BYMONTHDAY=${[...p.dates].sort((a, b) => a - b).join(',')}`;
  return null;
}

export function describePlan(c: Category): string {
  const p = planOf(c);
  if (!p) return 'Pas de rythme';
  if (p.freq === 'daily') return 'Chaque jour';
  if (p.freq === 'weekly') return `Chaque ${(p.weekdays?.length ? p.weekdays : [1]).map((d) => WEEKDAYS_FR[d].toLowerCase()).join(', ')}`;
  if (p.freq === 'monthly') return c.dueDay ? `Le ${c.dueDay} de chaque mois` : 'Une fois par mois';
  return p.dates?.length ? `Le ${[...p.dates].sort((a, b) => a - b).join(', ')} du mois` : 'Dates à choisir';
}

function firstOccurrence(c: Category, now: Date, time: string): Date | null {
  for (const m of [monthKey(now), shiftMonth(monthKey(now), 1)]) {
    const [y, mo] = m.split('-').map(Number);
    for (const o of occurrences(c, m)) {
      const d = atTime(new Date(y, mo - 1, o.day), time);
      if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return d;
    }
  }
  return null;
}

/** Lien « Ajouter à Google Agenda » avec récurrence (s'ouvre dans l'appli Agenda du téléphone). */
export function googleCalendarUrl(state: State, c: Category, now = new Date()): string | null {
  const r = remindersOf(state);
  const rule = rruleOf(c);
  const start = firstOccurrence(c, now, r.dueTime);
  if (!rule || !start) return null;
  const per = occurrences(c, monthKey(start))[0]?.amount ?? c.budget;
  const end = new Date(start.getTime() + 30 * 60000);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${APP.name} · ${c.name} (${fmtN(per)} XOF)`,
    details: `${describePlan(c)} — budget ${fmtN(c.budget)} XOF par mois. Pense à noter la dépense dans ${APP.name}.`,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    recur: `RRULE:${rule}`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Fichier .ics avec tous les rappels (pour Agenda Samsung, Outlook, iPhone…). */
export function buildICS(state: State, now = new Date()): string {
  const r = remindersOf(state);
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP.name}//FR`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const stamp = utcStamp(now);
  for (const c of state.categories) {
    if (c.hidden || c.budget <= 0) continue;
    const rule = rruleOf(c);
    const start = firstOccurrence(c, now, r.dueTime);
    if (!rule || !start) continue;
    const per = occurrences(c, monthKey(start))[0]?.amount ?? c.budget;
    lines.push(
      'BEGIN:VEVENT', `UID:${c.id}@budget-ivoire`, `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + 30 * 60000))}`, `RRULE:${rule}`,
      `SUMMARY:${esc(`${APP.name} · ${c.name} (${fmtN(per)} XOF)`)}`,
      `DESCRIPTION:${esc(`${describePlan(c)} — budget ${fmtN(c.budget)} XOF par mois.`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(c.name)}`, `TRIGGER:${r.dayBefore ? '-P1D' : '-PT0M'}`, 'END:VALARM',
      'END:VEVENT',
    );
  }
  if (r.dailyLog) {
    const [h, m] = r.logTime.split(':').map(Number);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    lines.push(
      'BEGIN:VEVENT', 'UID:log@budget-ivoire', `DTSTAMP:${stamp}`, `DTSTART:${utcStamp(d)}`,
      `DTEND:${utcStamp(new Date(d.getTime() + 10 * 60000))}`, 'RRULE:FREQ=DAILY',
      `SUMMARY:${esc(`${APP.name} · Noter mes dépenses du jour`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Noter mes dépenses', 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
