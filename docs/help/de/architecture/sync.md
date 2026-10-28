# Sync-Architektur

Adaptive Learner ist lokal-first. Im Speichermodus Server (intern API)
speichert das Backend der Desktop-App die Lerndaten; nur weniges bleibt
dabei im Browser, etwa einige Einstellungen und, bis sie übertragen sind,
offline gespeicherte Änderungen (siehe [Einstellungen](../user-guide/settings.md)).
Im Speichermodus Lokal (Browser), intern Dexie genannt, liegen sie in der
IndexedDB des Browsers, in dem die App läuft. Die
**Synchronisation** soll künftig Geräte über das lokale Netz verbinden;
nutzbar ist sie noch nicht (siehe den Abschnitt SYNC-UI-GATE unten). Die vollständige Referenz steht in
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Drei Geräte-Rollen

Die Sync-Oberfläche ist je nach Rolle des Geräts unterschiedlich
geplant:

| Rolle | Speichermodus | Sync-UI |
|---|---|---|
| Desktop (Server) | API | QR erzeugen, Status, „Jetzt synchronisieren" |
| Mobil (Client) | Dexie | QR scannen / Link einfügen, Status nach Pairing |
| Nur-PWA | Dexie | keine |

---

## SYNC-UI-GATE: Grundsatz und heutiger Stand

Der Grundsatz lautet: nur anzeigen, was funktioniert. Der LAN-Modus
(Phase 1) ist erst teilweise umgesetzt und noch nicht nutzbar. Von den
Kopplungsansichten ist bisher nur die erreichbar, die einen
Kopplungslink erzeugt, und auch sie nur im Speichermodus Server der
Desktop-App; die Ansicht, die den Link auf einem anderen Gerät einlöst
(Link einfügen, QR-Code scannen), ist bewusst abgeschaltet. Das Gate
richtet sich nach dem Speichermodus:

- Im Speichermodus **Server** (intern API), den es nur in der Desktop-App
  gibt, bietet der Bereich *Einstellungen > Daten > Synchronisation* nur
  das Erzeugen eines Kopplungslinks an: Er zeigt Eingabefelder für Host
  und Port und die Schaltfläche „Kopplungscode erzeugen“; nach einem
  Klick darauf erscheinen ein QR-Code, der Kopplungslink und eine
  Kopierschaltfläche.
- Im Speichermodus **Lokal (Browser)**, intern Dexie genannt, bleibt der Bereich
  sichtbar, zeigt aber keine Bedienelemente, sondern den Hinweis „Nur mit
  der Desktop-App verfügbar.“ Diesen Speichermodus nutzt die
  Browser-Version immer, auch als installierte Web-App (PWA); in der
  Desktop-App kann man ihn ebenfalls wählen. Funktionen, die nur mit dem
  Backend der Desktop-App arbeiten, werden seit #335/#336 mit Hinweis
  deaktiviert statt ausgeblendet; ob die Synchronisation deaktiviert ist,
  entscheidet dabei der Speichermodus, nicht die Art der App.
- Die Ansicht zum Einlösen würde nur im Speichermodus Lokal (Browser)
  erscheinen, wo der Bereich deaktiviert ist; sie erscheint deshalb nie.

Weil sich kein Gerät koppeln lässt, erscheint auch die Ansicht für ein
gekoppeltes Gerät nicht und damit auch nicht ihre Schaltfläche „Jetzt
synchronisieren“; die Synchronisation tauscht keine Daten aus.

Heute weicht der Bereich vom Grundsatz ab, unter anderem so:

- Seine Beschreibung „Geräte koppeln und Daten abgleichen.“ verspricht
  ein Koppeln und einen Abgleich, die es beide noch nicht gibt.
- Im Speichermodus Server bietet die Desktop-App das Erzeugen eines
  Kopplungslinks an, den noch kein Gerät einlösen kann.
- Der Hinweis „Nur mit der Desktop-App verfügbar.“ verweist auf die
  Desktop-App, mit der sich ebenfalls noch nicht synchronisieren lässt;
  in der Desktop-App selbst erscheint er im Speichermodus Lokal
  (Browser).

Sobald der LAN-Modus umgesetzt ist, soll das binäre Gate (API vs. Dexie)
zum dreiwertigen Gate aus der Tabelle oben werden. Die Ansicht zum
Einlösen soll erst mit diesem Gate wieder eingeschaltet werden. Würde man
sie einschalten, solange noch das binäre Gate gilt, erschiene sie auf
jedem Gerät im Speichermodus Lokal (Browser), denn dieses Gate
unterscheidet die Rollen „Mobil (Client)“ und „Nur-PWA“ nicht. Dort wäre
sie ein totes Bedienelement: solange der LAN-Modus nicht umgesetzt ist,
auf jedem dieser Geräte, und auch nach seiner Umsetzung noch auf Geräten
in der Rolle „Nur-PWA“, solange das binäre Gate gilt.

---

## Verwandte Seiten

- [Storage-Layer](../developer/storage-layer.md) - die duale Speicher-Abstraktion
- [Backup und Wiederherstellung](../features/backup.md) - manueller Datentransfer ohne Sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
