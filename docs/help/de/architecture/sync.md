# Sync-Architektur

Adaptive Learner ist lokal-first: Server-Modus (API) hält die
Daten im Dateisystem, reiner Browser-Modus (Dexie) in IndexedDB.
Die **Synchronisierung** soll diese Geräte über das lokale Netz
verbinden. Die vollständige Referenz steht in
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Drei Geräte-Rollen

Die Sync-Oberfläche sieht je nach Rolle des Geräts
unterschiedlich aus — und wird nur dort gezeigt, wo sie nutzbar
ist:

| Rolle | Speichermodus | Sync-UI |
|---|---|---|
| Desktop (Server) | API | QR erzeugen, Status, „Jetzt synchronisieren" |
| Mobil (Client) | Dexie | QR scannen / Link einfügen, Status nach Pairing |
| Nur-PWA | Dexie | keine |

---

## SYNC-UI-GATE: nur anzeigen, was funktioniert

Eine nicht verfügbare Funktion wird **nicht angeboten** — keine
toten Knöpfe, keine ausgegrauten Platzhalter. Aktuell (die
LAN-Pairing-Phase ist noch nicht implementiert) ist der
Sync-Bereich daher **API-only** sichtbar; ohne funktionierenden
Pairing-Fluss würde die Mobil-Client-UI ins Leere laufen.

Wenn der LAN-Modus landet, wird das binäre Gate (API vs. Dexie)
zum dreiwertigen Gate aus der Tabelle oben umgebaut. Die Pairing-
UI wird **nicht** vorher im Dexie-Modus reaktiviert, damit auf der
Nur-PWA-Deployment kein totes Bedienelement entsteht.

---

## Verwandte Seiten

- [Storage-Layer](../developer/storage-layer.md) — die duale Speicher-Abstraktion
- [Backup und Wiederherstellung](../features/backup.md) — manueller Datentransfer ohne Sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
