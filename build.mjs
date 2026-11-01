// Holt den Google-Kalender (geheime iCal-Adresse aus dem Secret KALENDER_ICS),
// filtert öffentliche + bestätigte Termine und baut die Seite in den Ordner _site.
// Interne Felder (Verantwortlich, Link zum Register) werden NICHT übernommen.

import fs from "node:fs";
import path from "node:path";
import ical from "node-ical";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "_site");
const MONATE_VORAUS = 6;

function htmlZuText(s = "") {
  return String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "");
}

function feld(text, name) {
  const m = text.match(new RegExp("^\\s*" + name + "\\s*:\\s*(.*)$", "mi"));
  return m ? m[1].trim() : "";
}

function titelBereinigen(summary = "") {
  return String(summary)
    .replace(/^\s*\(план\)\s*/i, "")
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .trim();
}

function projekteAusTitel(summary = "") {
  const m = String(summary).match(/\[([^\]]+)\]/);
  return m ? m[1].split(/[+,]/).map((s) => s.trim()).filter(Boolean) : [];
}

function istOeffentlich(ev, text) {
  if (/^\s*\(план\)/i.test(ev.summary || "")) return false;
  const pub = feld(text, "Публичное").toLowerCase();
  const status = feld(text, "Статус").toLowerCase();
  return pub.startsWith("да") && status.startsWith("подтвержд");
}

function eintrag(ev, start, end) {
  const text = htmlZuText(ev.description);
  const projekteFeld = feld(text, "Проекты");
  const projekte = projekteFeld
    ? projekteFeld.split(/[,+]/).map((s) => s.trim()).filter(Boolean)
    : projekteAusTitel(ev.summary);
  const ort = String(ev.location || "").trim();
  return {
    id: (feld(text, "ID") || ev.uid) + "@" + start.toISOString(),
    titel: titelBereinigen(ev.summary),
    start: start.toISOString(),
    ende: end ? end.toISOString() : null,
    ganztags: ev.datetype === "date",
    ort,
    ortKurz: ort.split(",")[0].trim(),
    projekte,
    typ: feld(text, "Тип"),
  };
}

async function termineLaden() {
  const url = process.env.KALENDER_ICS;
  if (!url) {
    console.warn("WARNUNG: Secret KALENDER_ICS fehlt – Seite wird ohne Termine gebaut.");
    return [];
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kalender nicht abrufbar: HTTP " + res.status);
  const daten = ical.sync.parseICS(await res.text());

  const von = new Date();
  von.setDate(von.getDate() - 1);
  const bis = new Date();
  bis.setMonth(bis.getMonth() + MONATE_VORAUS);

  const liste = [];
  for (const ev of Object.values(daten)) {
    if (!ev || ev.type !== "VEVENT") continue;
    const dauer = ev.end ? ev.end - ev.start : 0;

    const pruefen = (e, start) => {
      const text = htmlZuText(e.description);
      if (!istOeffentlich(e, text)) return;
      const ende = e.end && e !== ev ? e.end : new Date(start.getTime() + dauer);
      if (ende < von || start > bis) return;
      liste.push(eintrag(e, start, ende));
    };

    if (ev.rrule) {
      const ausnahmen = new Set(Object.keys(ev.exdate || {}).map((k) => new Date(ev.exdate[k]).toISOString()));
      for (const d of ev.rrule.between(von, bis, true)) {
        const start = new Date(d);
        if (ausnahmen.has(start.toISOString())) continue;
        const key = start.toISOString().slice(0, 10);
        const abweichung = ev.recurrences && (ev.recurrences[key] || ev.recurrences[start.toISOString()]);
        if (abweichung) pruefen(abweichung, abweichung.start);
        else pruefen(ev, start);
      }
    } else {
      pruefen(ev, ev.start);
    }
  }
  liste.sort((a, b) => a.start.localeCompare(b.start));
  return liste;
}

const termine = await termineLaden();
const projekte = JSON.parse(fs.readFileSync(path.join(ROOT, "projekte.json"), "utf8"));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, "index.html"), path.join(OUT, "index.html"));
fs.writeFileSync(
  path.join(OUT, "events.json"),
  JSON.stringify({ aktualisiert: new Date().toISOString(), projekte, termine }, null, 1)
);
console.log(`Fertig: ${termine.length} öffentliche Termine.`);
