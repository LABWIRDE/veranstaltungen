# Veranstaltungen – WIR.DE

Öffentliche Veranstaltungsseite unter **https://veranstaltungen.lab-wir.de**.

## So funktioniert es
- Quelle ist der Google-Kalender „WIR Veranstaltungen (intern)“. Seine geheime iCal-Adresse liegt als Secret `KALENDER_ICS` im Repository (nie in Dateien eintragen!).
- Die GitHub Action `.github/workflows/deploy.yml` holt den Kalender stündlich und veröffentlicht die Seite.
- Angezeigt werden nur Termine mit `Публичное: Да` **und** `Статус: Подтверждено`; Termine mit „(план)“ im Titel nie.
- Interne Angaben (Ответственный, Link zum Register) werden nicht übernommen.

## Filter-Links (z. B. für Tilda)
- Nur ein Projekt: `https://veranstaltungen.lab-wir.de/?projekt=FF26`
- Nur ein Ort: `https://veranstaltungen.lab-wir.de/?ort=KultSchule`
- Ohne Kopfzeile zum Einbetten: `…/?embed=1&projekt=FF26`

## Projektnamen
Lesbare Namen für die Projektcodes stehen in `projekte.json`.
