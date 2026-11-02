import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, buildICS, googleCalendarUrl, rruleOf } from '../src/services/reminders';
import { initialState } from '../src/data';

const state = () => {
  const s = initialState();
  s.categories = s.categories.map((c) =>
    c.id === 'c_rent' ? { ...c, budget: 60000 } :
    c.id === 'c_transport' ? { ...c, budget: 100000, plan: { freq: 'weekly' as const, weekdays: [1, 3], remind: true } } : c);
  return s;
};

test('rappels : quotidien + loyer + transport hebdo', () => {
  const now = new Date(2026, 10, 2, 9, 0); // lundi 2 novembre, 9 h
  const list = buildSchedule(state(), now, 10);
  const titles = list.map((x) => x.title);
  assert.ok(titles.some((t) => t.startsWith('Loyer : 60 000 XOF à payer')), 'loyer le 5');
  assert.ok(titles.some((t) => t.startsWith('Transport')), 'transport');
  // 11 rappels du soir : les jours avec une prévision en donnent le détail
  assert.equal(titles.filter((t) => t === 'Tes dépenses du jour' || t.startsWith('Prévision du jour')).length, 11);
  const mon = list.find((x) => x.title.startsWith('Prévision du jour') && x.at.getDate() === 2)!;
  assert.match(mon.body, /Transport/);
  // Boutons Oui / Non / Autre montant sur les rappels de dépense
  const tr = list.find((x) => x.title.startsWith('Transport'))!;
  assert.equal(tr.actionTypeId, 'DEPENSE_PREVUE');
  assert.equal((tr.extra as any).key, 'c_transport@2026-11-04');
  assert.ok(list.every((x) => x.at > now));
  // le transport du lundi 2 à 8 h est déjà passé : premier rappel = mercredi 4
  const firstTransport = list.find((x) => x.title.startsWith('Transport'))!;
  assert.equal(firstTransport.at.getDate(), 4);
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
});

test('calendrier : règles de récurrence, lien Google Agenda et fichier .ics', () => {
  const s = state();
  const tr = s.categories.find((c) => c.id === 'c_transport')!;
  assert.equal(rruleOf(tr), 'FREQ=WEEKLY;BYDAY=MO,WE');
  assert.equal(rruleOf(s.categories.find((c) => c.id === 'c_rent')!), 'FREQ=MONTHLY;BYMONTHDAY=5');
  const url = googleCalendarUrl(s, tr, new Date(2026, 10, 2, 9))!;
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  assert.match(decodeURIComponent(url), /recur=RRULE:FREQ=WEEKLY;BYDAY=MO,WE/);
  const ics = buildICS(s, new Date(2026, 10, 2, 9));
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3); // loyer, transport, rappel quotidien
});
