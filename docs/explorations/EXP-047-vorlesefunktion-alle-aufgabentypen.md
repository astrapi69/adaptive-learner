# CCW-Prompt: Exploration Vorlesefunktion (EXP-047) für alle Aufgabentypen

## Auftrag

Explorationsdokument nach etablierter Praxis (EXP), **kein Produktionscode** außer einem eng begrenzten Prototyp am Ende. Ziel: eine Vorlesefunktion für alle Aufgabentypen entwerfen, bevor irgendetwas gebaut wird.

Beispiel aus der Anforderung: Bei Zuordnung werden zuerst die Einträge der einen Seite vorgelesen, dann die der anderen, danach fragt die Übung, was zusammengehört.

## Teil 1: Zielklärung (entscheidet alles Weitere)

Zwei Features werden leicht verwechselt und brauchen unterschiedliche Architekturen:

- **Barrierefreiheit:** Alle Inhalte müssen für Screenreader zugänglich sein. Zuständig ist der Screenreader des Systems (VoiceOver, NVDA, TalkBack), nicht ein eigener Player. Ein selbstgebauter Vorleser kann mit dem Screenreader konkurrieren und die Nutzung verschlechtern. Lösung wäre hier korrekte Semantik, ARIA und Fokusführung.
- **Lernhilfe:** Aussprache hören, Hörverstehen üben, gezielt wiederholen, Tempo regeln. Das ist ein sichtbares Feature mit Bedienelementen und Einstellungen.

Beide Ziele benennen, den Unterschied ausformulieren, eine begründete Empfehlung geben, was gebaut werden soll. Falls beides: klar trennen, welcher Teil zu welchem Ziel gehört. Diese Entscheidung steht am Anfang des Dokuments.

## Teil 2: Technologiewahl (Library-First-Hierarchie anwenden)

- **Native zuerst:** Web Speech API (SpeechSynthesis). Passt zur Produktphilosophie (offline, kostenlos, kein Schlüssel, kein Server). Zu erheben: Verfügbarkeit und Stimmenqualität je Plattform, insbesondere iOS Safari/WKWebView im Standalone-Modus, Chrome und Firefox unter Linux (dort ist oft keine brauchbare Stimme installiert), macOS, Windows, Android. Konkret prüfen, nicht aus Erfahrung behaupten: welche Stimmen sind je Zielsprache vorhanden, wie verhält sich `getVoices()` beim ersten Aufruf, was passiert ohne installierte Stimme.
- **Bestehendes prüfen (Reusability-Policy):** Für Diktat existiert bereits ein Audio-Weg (Data-URI). Erheben, was dort vorhanden ist und ob Teile davon tragen. Kein zweiter Audio-Stack.
- **Vorgenerierte Audiodateien** als Alternative bewerten: Qualität planbar, aber Größe der Content-Repositories, Erzeugungskosten, Abhängigkeit von externen Diensten und Widerspruch zur Unabhängigkeitsphilosophie. Aufwand und Folgen nennen, Empfehlung begründen.
- Autoplay-Beschränkungen: Wiedergabe braucht auf mobilen Browsern eine Nutzergeste. Klären, welche Interaktionsmuster dadurch ausscheiden.

## Teil 3: Sprachmischung (hartes Entwurfsproblem)

Eine Übung enthält häufig zwei Sprachen: Aufgabentext in der Nutzersprache, Zielinhalt in der Lernsprache. Wird der Zielinhalt mit der falschen Stimme gelesen, ist die Ausgabe für Aussprachelernen wertlos oder irreführend.

- Prüfen, ob das Content-Schema heute überhaupt markiert, welches Feld in welcher Sprache vorliegt. Das ist Hoheit von `learn-content-engine`. Falls die Information fehlt: als Schema-Frage ausweisen und Abstimmung mit engine-cc vorschlagen, **nicht** app-seitig am Schema vorbei improvisieren.
- Entwurf für segmentweise Sprachzuweisung skizzieren (welche Stimme für welches Segment, Fallback wenn keine Stimme der Zielsprache existiert).
- Sonderfall festhalten: Die Sets für Japanisch, Koreanisch und Chinesisch sind KI-erzeugt und unverifiziert. Vorlesen ändert daran nichts, aber sie dürfen in keiner Bewerbung des Features als geprüfte Inhalte auftauchen.

## Teil 4: Vorleseregeln je Aufgabentyp (der Kern)

Für **jeden** existierenden Aufgabentyp festlegen: Was wird gelesen, in welcher Reihenfolge, mit welchen Pausen, und vor allem: **was darf nicht gelesen werden, weil es die Lösung verrät.**

Mindestens zu behandeln:
- **Zuordnung:** die vorgeschlagene Sequenz (erst eine Seite, dann die andere, dann Aufforderung). Prüfen, ob die Vorlesereihenfolge die korrekte Paarung verraten kann, und wie das verhindert wird.
- **Lückentext:** Wie wird eine Lücke hörbar gemacht (Pause, Signalton, gesprochenes Wort)? Die Lösung darf nicht gelesen werden.
- **Multiple Choice:** Frage, dann Optionen mit hörbarer Kennzeichnung, damit die Auswahl ohne Blick möglich ist.
- **Freitext:** nur die Aufgabenstellung.
- **Wort-Kacheln:** Zielsatz oder nur die Aufgabenstellung? Wenn der Zielsatz gelesen wird, ist die Aufgabe gelöst. Entscheidung begründen.
- **Diktat:** Sonderfall. Zuhören ist hier die Aufgabe. Ein allgemeiner Vorleser würde sie zerstören. Festlegen, dass die Funktion hier entweder deaktiviert ist oder ausschließlich die Aufgabenstellung liest.
- Alle weiteren vorhandenen Typen und Erweiterungstypen ebenfalls erfassen. Vollständigkeit vor Tiefe: kein Typ darf fehlen.

Zusätzlich: Verhalten nach dem Antworten (Lösung vorlesen zur Kontrolle?) und ob die Funktion je Übung, je Element oder als durchgehende Wiedergabe angeboten wird.

## Teil 5: Bedienung und Einstellungen

- Bedienelemente: Wiedergabe je Element, Wiederholung, Tempo, Abbrechen. Wo im Layout, ohne die Übungsfläche zu überladen.
- Persistente Einstellungen: Funktion an/aus, Tempo, Stimmenwahl je Sprache. Speicherort beachten: Regel #2053 (beide Speichermodi) und Backup-Verhalten, falls die Einstellung mitgesichert werden soll.
- Verhalten bei fehlender Stimme: klare, ehrliche Meldung statt stiller Untätigkeit. Die Funktion darf nicht sichtbar sein, wenn sie auf dem Gerät nicht funktionieren kann.

## Teil 6: Umsetzungsvorschlag

- Priorisierte Reihenfolge: **ein** Aufgabentyp als Nachweis zuerst (Vorschlag: Zuordnung, weil er die Sequenzfrage stellt), danach die übrigen. Nicht alle gleichzeitig.
- Aufwandsschätzung je Stufe, Testbarkeit (was ist automatisiert prüfbar, was braucht Gerätetests, insbesondere iOS-Standalone).
- Risiken benannt, inklusive der Möglichkeit, dass die Stimmenqualität auf den Zielplattformen das Feature entwertet.

## Prototyp (eng begrenzt, am Ende)

Ein wegwerfbarer Prototyp, der ausschließlich klärt, was das Dokument nicht beantworten kann: Sind auf den Zielplattformen brauchbare Stimmen der relevanten Sprachen vorhanden und wie klingt segmentweise Sprachumschaltung. Kein Produktionscode, keine Integration in Übungen, klar als Prototyp gekennzeichnet.

## Regeln

- Exploration vor Umsetzung. GITHUB-ISSUE-PFLICHT: Sammel-Issue für die Exploration, Folge-Issues erst nach Freigabe.
- Keine Schema-Änderungen an `learn-content-engine` in diesem Auftrag, nur Bedarfsanmeldung.
- Autonome Ausführung, keine Zwischenfragen. Stopp nur bei kritischem Blocker.
- Kein Em-Dash, echte UTF-8-Umlaute, bilinguale Doku nach etablierter Praxis.

## Endbericht

- Pfad des Explorationsdokuments
- Empfehlung zu Teil 1 (Barrierefreiheit, Lernhilfe oder beides getrennt) mit Begründung
- Technologie-Empfehlung mit Plattform-Befunden, insbesondere iOS-Standalone und Linux
- Befund zur Sprachmarkierung im Content-Schema und ob eine Engine-Abstimmung nötig ist
- Tabelle der Vorleseregeln je Aufgabentyp
- Priorisierter Umsetzungsvorschlag mit Aufwand, Prototyp-Ergebnis
