# Datenschutzerklärung

Stand: 20. Oktober 2026

Diese Erklärung gilt für die öffentliche Web-Version von Adaptive Learner unter
`astrapi69.github.io/adaptive-learner`, für die öffentliche Vorschau der
nächsten Version unter `astrapi69.github.io/adaptive-learner-content-test` und
für diese Dokumentationsseiten. Wer Adaptive Learner selbst installiert
(Desktop-Launcher oder Docker), betreibt die App auf dem eigenen Gerät; der
Betreiber dieser Seiten erhält dann nur, was du ihm selbst schickst, etwa eine
geteilte Lektion oder einen Fehlerbericht. Auch dann fragen die App und der
Launcher bei `api.github.com` nach neuen Versionen, die Lerninhalte kommen von
GitHub, und KI-Anfragen schickt der eigene Server an den gewählten Anbieter.

## Verantwortlicher

Asterios Raptis, Seestraße 68, 71638 Ludwigsburg, Deutschland

E-Mail: asterios.raptis@web.de

## Das Wichtigste in Kürze

Adaptive Learner hat keinen eigenen Server. Die App und diese Seiten setzen
keine Cookies, nutzen keine Analyse- oder Tracking-Dienste und laden keine
Schriften oder Skripte von Dritten. Dein Lernfortschritt, deine Statistiken
und deine Einstellungen bleiben in deinem Browser, für dich. Der Betreiber
erhält davon nur, was du ihm selbst schickst, und andere erhalten Teile davon
nur, wenn eine Funktion sie braucht, die du nutzt, etwa die KI mit deinem
eigenen Schlüssel.

Daten verlassen dein Gerät nur in diesen Fällen, die die Abschnitte unten
genauer beschreiben:

- Beim Aufruf der App und dieser Seiten verarbeitet GitHub als Hoster deine
  IP-Adresse.
- Die App lädt Lerninhalte von GitHub und prüft dort auch von selbst, ob es
  Neues gibt.
- Wenn du eine Lektion mit der Community teilst oder GitHub-Funktionen mit
  deinem eigenen Zugangstoken nutzt, gehen die Daten an GitHub; geteilte
  Beiträge erhält auch der Betreiber.
- Einen Fehlerbericht erhält GitHub erst, wenn du ihn selbst auf GitHub
  öffnest.
- KI-Funktionen schicken deine Anfragen mit deinem eigenen Schlüssel direkt an
  den Anbieter, den du gewählt hast.
- Für Spracheingabe und Vorlesen nutzt dein Browser je nach Hersteller einen
  Onlinedienst.
- Teilen-Schaltflächen und externe Links öffnen fremde Seiten erst nach deinem
  Klick.
- Du schreibst dem Betreiber eine E-Mail.

## Hosting bei GitHub Pages

Die App, die Vorschau und diese Dokumentation werden von GitHub Pages
ausgeliefert, einem Dienst der GitHub, Inc., 88 Colin P. Kelly Jr. Street, San
Francisco, CA 94107, USA. Bei jedem Aufruf verarbeitet GitHub die IP-Adresse
deines Geräts und die üblichen Verbindungsdaten (Zeitpunkt, aufgerufene Datei,
Browsertyp); die IP-Adresse protokolliert und speichert GitHub nach eigenen
Angaben aus Sicherheitsgründen. Der Betreiber erhält diese Daten nicht.

Rechtsgrundlage ist das berechtigte Interesse an einer sicheren und
performanten Auslieferung (Art. 6 Abs. 1 lit. f DSGVO). GitHub ist unter dem
EU-US Data Privacy Framework zertifiziert; damit besteht ein
Angemessenheitsbeschluss für die Übermittlung in die USA (Art. 45 DSGVO).
Weitere Informationen:
[GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Diese Dokumentationsseiten laden darüber hinaus nichts von anderen Servern:
Sie nutzen die Schriften deines Systems, und die Suche läuft in deinem
Browser, ohne dass deine Suchbegriffe ihn verlassen.

## Laden von Lerninhalten

Lerninhalte liegen in Inhalte-Repositorys auf GitHub. Dein Browser lädt sie
direkt von `raw.githubusercontent.com`, Repositorys mit eigenem Zugangstoken
über `api.github.com`. Verantwortlicher Empfänger ist die GitHub, Inc. (siehe
oben). Die App lädt:

- beim Öffnen, Herunterladen oder Aktualisieren eines Sets dessen Lektionen
  und Bilder,
- beim Öffnen der Seite Inhalte den Katalog: empfohlene Repositorys,
  Suchverzeichnisse, Medien- und Buchlisten und Buchcover,
- am Ende jeder Lektion die Liste weiterführender Medien,
- wenn du ein Repository hinzufügst oder prüfst, einen Einladungscode einlöst
  oder einen geteilten Link zu einem Set, einer Einladung oder einem
  Repository öffnest, die dafür nötigen Dateien.

Außerdem prüft die App von selbst, ohne dass du etwas anklickst, ob deine Sets
neue Versionen haben und welche Wiederholungen fällig sind. Dafür liest sie
die Manifest-Dateien des offiziellen Katalogs und deiner verbundenen
Repositorys, beim Start, beim Wechsel zwischen Seiten und wenn das Fenster
wieder in den Vordergrund kommt; verbundene Repositorys gleicht sie beim Start
höchstens einmal am Tag ab. Wiederholte Abrufe kurz hintereinander beantwortet
dein Browser in der Regel aus seinem Zwischenspeicher. Die Prüfung läuft auf
jeder Seite der App außer der Startseite, dem Anlegen des ersten Lernprojekts
und dem Lerntyp-Assessment, also auch schon beim ersten Besuch über einen
geteilten oder direkten Link und auf der Fehlerseite für eine falsch
geschriebene Adresse, auch unter /docs/.

GitHub erhält dabei deine IP-Adresse, übliche Browserdaten (Browsertyp und
-version, Betriebssystem, Spracheinstellung), in der Regel die Herkunft der
Anfrage (`astrapi69.github.io`) und den Pfad der angefragten Datei. Der Pfad
zeigt, welche Repositorys, Sets und Lektionen du nutzt, auch Repositorys, die
du selbst hinzugefügt hast, und beim Einlösen den Einladungscode. Cookies
werden dabei weder gesetzt noch gesendet.

Rechtsgrundlage ist für Inhalte, die du anforderst, die Bereitstellung der
Funktion (Art. 6 Abs. 1 lit. b DSGVO) und für die automatische Prüfung das
berechtigte Interesse, dir aktuelle Inhalte und fällige Wiederholungen
anzuzeigen (Art. 6 Abs. 1 lit. f DSGVO). Zur Übermittlung in die USA siehe
oben.

## GitHub-Funktionen mit eigenem Zugangstoken

Einige Funktionen nutzen die GitHub-API (`api.github.com`) mit einem
persönlichen Zugangstoken, das du selbst einträgst, in den Einstellungen unter
Integrationen oder für ein einzelnes Repository. Das Token bleibt in deinem
Browser und wird nur an GitHub gesendet. Mit ihm handelt die App in deinem
Namen:

- Sie prüft das Token und liest dabei deinen GitHub-Benutzernamen.
- Sie liest private Repositorys, die du verbunden hast, auch bei der
  automatischen Prüfung oben.
- Sie teilt eine Lektion mit der Community: als Pull Request an das
  öffentliche Repository `astrapi69/adaptive-learner-content` des Betreibers,
  über eine Kopie (Fork) in deinem Konto.
- Sie reicht dein eigenes Inhalte-Repository für die Suche ein, ebenfalls als
  Pull Request an `astrapi69/adaptive-learner-content`.
- Sie exportiert ein Set in ein neues Repository in deinem Konto, das
  standardmäßig privat ist.
- Für Coaches legt sie Einladungscodes im Ordner `codes/` des eigenen
  Repositorys an, listet und deaktiviert sie.

Ohne Token öffnet "Mit der Community teilen" stattdessen die
Bearbeitungsseite von GitHub (`github.com`); passt die Lektion in die Adresse
dieser Seite, steht ihr Inhalt darin. "Einreichung vorbereiten"
(Einstellungen > Daten > Eigenes Repository registrieren) fragt bei
`api.github.com` den letzten Stand des Repositorys ab, das du angibst, mit
dessen Token, falls du eines gespeichert hast.

GitHub erhält dabei das Token, deine IP-Adresse, übliche Browserdaten, die
Namen der Repositorys und Dateien und alles, was du teilst oder exportierst:
die Lektion oder die Dateien des Sets, Commit-Nachricht, Titel und
Beschreibung des Pull Requests mit den Angaben zur Lektion, den
Registereintrag und, wenn du ihn angibst, deinen Namen als Autorin oder Autor.
Ein Einladungscode enthält Code, Repository, Branch, maximale Nutzungen,
Ablaufdatum, Notiz und, falls du es einbettest, ein Lese-Token; dieses Token
kann jeder lesen, der die Code-Datei lesen kann.

Was du an `astrapi69/adaptive-learner-content` schickst, wird ein öffentlicher
Pull Request mit deinem GitHub-Benutzernamen und, falls angegeben, deinem
Autorennamen. Der Betreiber erhält ihn, prüft ihn und übernimmt den Beitrag
gegebenenfalls in die Inhalte (Art. 6 Abs. 1 lit. b und f DSGVO). Der Pull
Request und die Versionsgeschichte des Repositorys bleiben gespeichert,
solange das Repository besteht. Für die übrigen Funktionen ist die
Rechtsgrundlage deine Anfrage (Art. 6 Abs. 1 lit. b DSGVO). Empfänger ist die
GitHub, Inc. (siehe oben).

## Fehlerberichte

Einen Fehlerbericht bereitest du über die Schaltfläche einer Fehlermeldung
("Problem melden"), über "Fehler melden", wenn sich eine Ansicht nicht laden
ließ, oder mit "Fehlerbericht erstellen" in den Einstellungen unter
"Diagnose & Support" vor. Du siehst den Bericht vorher. Erst wenn du auf
"Auf GitHub öffnen" klickst, öffnet die App in einem neuen Tab ein vorausgefülltes Formular für ein neues Issue im
Repository `astrapi69/adaptive-learner` auf `github.com`. Der Bericht steht in
der Adresse dieser Seite, deshalb erhält GitHub ihn schon beim Öffnen des
Tabs, bevor du dort etwas abschickst. Bei einer internen Fehlermeldung beim
Erstellen einer Lektion öffnet "Problem melden" ein solches Formular direkt,
nur mit dieser Fehlermeldung.

Der Bericht enthält die Fehlermeldung mit technischen Angaben (etwa
Statuscode, Endpunkt, Zeitpunkt oder Stacktrace) und deine eigene
Beschreibung. Umgebungsangaben (App-Version, Browser, Betriebssystem, aktuelle
Seite) und den Aktionsverlauf (siehe Speicherung auf deinem Gerät) fügt die
App nur hinzu, wenn du das jeweilige Kästchen ankreuzt; beide sind zunächst
nicht angekreuzt.

Schickst du das Issue auf GitHub ab, ist es öffentlich und mit deinem
GitHub-Konto verbunden. Der Betreiber erhält es und nutzt es, um den Fehler zu
beheben (Art. 6 Abs. 1 lit. f DSGVO); es bleibt gespeichert, solange das Issue
besteht. Empfänger ist die GitHub, Inc. (siehe oben).

## KI-Funktionen mit eigenem Schlüssel

KI-gestützte Funktionen gibt es nur, wenn du in den Einstellungen unter KI
einen eigenen API-Schlüssel eines Anbieters hinterlegst. Dein Browser schickt
die Anfragen dann direkt an diesen Anbieter; der Betreiber erhält diese Daten
nicht. Mit dem Anbieter hast du einen eigenen Vertrag, und es gelten seine
Bedingungen und Datenschutzhinweise. Empfänger ist der Anbieter, dessen
Schlüssel du nutzt:

- Anthropic (`api.anthropic.com`): für Kunden im EWR die Anthropic Ireland,
  Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04 TR29,
  Irland. Der Schlüssel steht im Kopf der Anfrage.
- OpenAI (`api.openai.com`): für Kunden im EWR die OpenAI Ireland Limited,
  1st Floor, The Liffey Trust Centre, 117-126 Sheriff Street Upper, Dublin 1,
  D01 YC43, Irland. Der Schlüssel steht im Kopf der Anfrage.
- Google (`generativelanguage.googleapis.com`, die Gemini-API): bei
  kostenpflichtiger Nutzung mit Rechnungsadresse im EWR die Google Cloud EMEA
  Limited, 70 Sir John Rogerson's Quay, Dublin 2, Irland (mit Rechnungsadresse
  in Frankreich, Italien oder Polen die dortige Google-Cloud-Gesellschaft), bei
  kostenloser Nutzung die Google LLC, 1600 Amphitheatre Parkway, Mountain View,
  CA 94043, USA. Der Schlüssel steht hier in der Adresse der Anfrage, nicht in
  ihrem Kopf.

Anfragen entstehen, wenn du eine KI-Funktion nutzt: Lernsitzungen
(einschließlich der automatischen Bewertung jedes Schritts), "KI fragen" in
Lektionen, die KI-Prüfung deiner Antworten, das Erzeugen von Übungen und
Lektionen, die Analyse importierter Chats, Lernkarten und Lernleitfaden, das
Aussprachetraining sowie die KI-Prüfung und -Erzeugung von Inhalten. Ohne dass
du etwas eintippst, schickt die App außerdem:

- eine Abfrage der verfügbaren Modelle, wenn du die Seite Sitzung oder die
  Modellauswahl in den Einstellungen öffnest,
- eine Testanfrage an den Anbieter eines Schlüssels, wenn du den Schlüssel
  speicherst, eine Schlüssel-Sicherung wiederherstellst oder auf "Testen"
  klickst, auch wenn dieser Anbieter gerade nicht aktiv ist,
- einmal die ersten Anfragen einer Lernsitzung, die du aus einem importierten
  Chat startest; sie enthalten den eingefügten Chat.

Mit jeder Anfrage gehen dein Schlüssel, deine IP-Adresse und übliche
Browserdaten mit, auch die Herkunft der Anfrage (`astrapi69.github.io`).
Modellabfrage und Testanfrage sind dieselbe Abfrage der Modellliste und
enthalten sonst nichts; für denselben Schlüssel schickt die App sie höchstens
einmal pro Stunde und Tab. Die übrigen Anfragen enthalten je nach Funktion:

- deine Nachrichten, Fragen und Antworten und den bisherigen Verlauf der
  Sitzung,
- die betroffenen Lerninhalte (Lektionen, Übungen, Karten),
- Thema und Ziel deines Lernprojekts und deine bevorzugte Lernmethode mit
  ihrem Gewicht,
- Titel und Ergebnisse deiner abgeschlossenen Lektionen, die Lektion, an der
  du gerade arbeitest, und deine letzten Fehler mit deiner und der erwarteten
  Antwort,
- für den Lernleitfaden zusätzlich Zeitrahmen, Minuten pro Tag, alle
  Methodengewichte, Vokabeln aus analysierten Chats und bis zu zehn deiner
  letzten abgeschlossenen Sitzungen mit Startzeit und Methode,
- bei importierten Chats deren Titel und den vollständigen eingefügten Text,
- im Aussprachetraining den Zielsatz und den erkannten Text deines Versuchs,
- die Sprache, in der die KI antworten soll.

Rechtsgrundlage ist die von dir genutzte Funktion (Art. 6 Abs. 1 lit. b
DSGVO); für Modellabfrage und Testanfrage das berechtigte Interesse, dir die
verfügbaren Modelle anzuzeigen und einen ungültigen Schlüssel sofort zu melden
(Art. 6 Abs. 1 lit. f DSGVO).

Die Anbieter können die Daten auch außerhalb der EU verarbeiten, insbesondere
in den USA. Anthropic stützt Übermittlungen in Drittländer nach seinen
Vertragsbedingungen auf Standardvertragsklauseln der EU-Kommission (Art. 46
Abs. 2 lit. c DSGVO), OpenAI auf Standardvertragsklauseln oder einen
Angemessenheitsbeschluss; die Google LLC ist unter dem EU-US Data Privacy
Framework zertifiziert (Art. 45 DSGVO). Datenschutzhinweise der Anbieter:

- [Anthropic](https://www.anthropic.com/legal/privacy)
- [OpenAI](https://openai.com/policies/eu-privacy-policy/)
- [Google](https://policies.google.com/privacy) und
  [Nutzungsbedingungen der Gemini-API](https://ai.google.dev/gemini-api/terms)

## Spracheingabe

Tippst du auf das Mikrofon (im Eingabefeld der Lernsitzung und im
Aussprachetraining), nutzt die App die Spracherkennung deines Browsers.
Aufgenommen wird erst nach dem Tippen, und dein Browser fragt vorher nach der
Erlaubnis für das Mikrofon. Die Erkennung übernimmt der Browser, nicht die
App: Google Chrome schickt dafür die Aufnahme und die gewählte Sprache an
einen Dienst von Google (`www.google.com`); andere Browser verfahren je nach
Hersteller. Für diese Verarbeitung ist der Hersteller des Browsers
verantwortlich, und es gelten seine Datenschutzhinweise. Bei Chrome ist das
Google, für Nutzer im EWR nach der
[Datenschutzerklärung von Google](https://policies.google.com/privacy) die
Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland; Google
kann die Daten auch in den USA verarbeiten, die Google LLC ist unter dem EU-US
Data Privacy Framework zertifiziert.

Die App erhält nur den erkannten Text. In der Lernsitzung landet er im
Eingabefeld, im Aussprachetraining in deinem Versuch; wenn du ihn abschickst,
geht er an deinen KI-Anbieter. Rechtsgrundlage für das Starten der Erkennung
ist deine Anfrage (Art. 6 Abs. 1 lit. b DSGVO). In den Einstellungen unter
Lernen blendest du mit "Mikrofon-Schaltfläche anzeigen" die Spracheingabe aus.
Aufnahmen in Sprechübungen macht die App dagegen selbst; sie bleiben in deinem
Browser.

## Vorlesen

Vorlesen startest du mit den Vorlese-Schaltflächen, mit der Taste R oder mit
"Alle vorlesen"; das automatische Vorlesen läuft nur, wenn du es einschaltest.
Vorgelesen werden Lektionstexte, Aufgaben, Fragen des Lerntyp-Assessments,
KI-Antworten und Sätze im Aussprachetraining. Dafür nutzt die App die
Sprachausgabe deines Browsers oder Betriebssystems. Sie wählt eine Stimme, die
auf deinem Gerät arbeitet, und greift nur dann auf eine Online-Stimme zurück,
wenn es für die Sprache keine lokale Stimme gibt oder wenn du in den
Einstellungen selbst eine Online-Stimme gewählt hast.

Eine Online-Stimme schickt den vorzulesenden Text an ihren Anbieter. In Google
Chrome sind das Stimmen von Google; der Text steht dann in der Adresse der
Anfrage an `www.google.com`. Chrome unter Linux bietet in der Regel nur solche
Stimmen an. Verantwortlich ist der Anbieter der Stimme, bei Chrome Google
(siehe Spracheingabe). Rechtsgrundlage ist deine Anfrage (Art. 6 Abs. 1 lit. b
DSGVO).

## Teilen-Schaltflächen

Eine Teilen-Schaltfläche steht auf dem Dashboard in den Zeilen von
"Weitermachen", sobald du eine Lektion mit Ergebnis abgeschlossen hast, und am
Ende einer Lektion, wenn du sie in den Einstellungen unter Lernen bei
"Zusammenfassung nach Lektionen" einschaltest. Bietet dein Gerät einen eigenen
Teilen-Dialog, öffnet die App diesen, und du wählst dort, womit du teilst.
Sonst zeigt sie Links zu Facebook, LinkedIn, X und WhatsApp und eine
Möglichkeit zum Kopieren.

Erst wenn du einen dieser Links anklickst, öffnet dein Browser die Seite des
Netzwerks; das Netzwerk erhält dann deine IP-Adresse, übliche Browserdaten und
die Cookies, die es selbst bei dir gesetzt hat. Facebook und LinkedIn bekommen
nur die Adresse der App, X und WhatsApp einen vorausgefüllten Text mit dem
Titel der Lektion, deinem Ergebnis (Prozent und Zahl der richtigen Antworten)
und der Adresse der App, den du vor dem Absenden noch ändern kannst. Die App
bindet keine Skripte oder Schaltflächen dieser Netzwerke ein; ab dem Klick
gelten deren Datenschutzhinweise. Rechtsgrundlage ist deine Anfrage (Art. 6
Abs. 1 lit. b DSGVO).

## Externe Links

Die App und diese Seiten enthalten Links zu externen Angeboten (unter anderem
GitHub, Amazon, YouTube, AnkiWeb, Spendenplattformen). Auch Videos und Bilder
aus Lerninhalten oder KI-Antworten, die auf andere Server verweisen, zeigt die
App als Link; geladen wird erst nach deinem Klick. Mit dem Klick verlässt du
die App oder diese Seiten; ab dann gelten die Datenschutzhinweise des
jeweiligen Anbieters. Es sind keine Skripte, Schaltflächen oder eingebetteten
Inhalte dieser Anbieter eingebunden.

## Speicherung auf deinem Gerät

Was du in der App anlegst, speichert dein Browser lokal in IndexedDB und
localStorage: Profil, Lernprojekte, Fortschritt und Statistiken, Notizen,
importierte Chats, heruntergeladene Lektionen, Sprachaufnahmen aus
Sprechübungen, automatische Sicherungen und deine Einstellungen, auch deine
API-Schlüssel und dein GitHub-Token, dazu zwischengespeicherte Kataloge.
Außerdem nutzt die App:

- den sessionStorage, den dein Browser beim Schließen des Tabs löscht, für den
  Aktionsverlauf für Fehlerberichte (deine letzten Aktionen in der App, etwa
  angeklickte Schaltflächen, Seitenwechsel, gewählte Optionen, Meldungen und
  Fehler, aber keine Tastatureingaben) und, wenn du einen KI-Schlüssel
  hinterlegt hast, für die Modellliste deines Anbieters, eine Stunde lang und
  abgelegt unter einem kurzen Prüfwert deines Schlüssels statt des Schlüssels
  selbst,
- den Cache Storage für die Dateien der App und heruntergeladene Lektionen,
  damit sie auch offline läuft.

Diese Dokumentationsseiten speichern nur die gewählte Farbdarstellung im
localStorage. Die öffentliche Vorschau liegt auf derselben Domain
(`astrapi69.github.io`) wie die App, deshalb teilen sich beide den Speicher
deines Browsers.

Diese Speicherung ist für die Funktionen, die du nutzt, unbedingt erforderlich
und fällt unter die Ausnahme in § 25 Abs. 2 Nr. 2 TDDDG; eine Einwilligung ist
nicht nötig. Die Speicherung selbst überträgt nichts; wann Daten dein Gerät
verlassen, steht in den Abschnitten oben. Du kannst die Daten jederzeit in den
Einstellungen exportieren oder löschen oder die Website-Daten in deinem
Browser entfernen.

## Kontakt per E-Mail

Wenn du dem Betreiber eine E-Mail schreibst, werden deine Angaben zur
Bearbeitung der Anfrage gespeichert (Art. 6 Abs. 1 lit. b und f DSGVO) und
gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen
Aufbewahrungspflichten entgegenstehen.

## Deine Rechte

Du hast gegenüber dem Verantwortlichen das Recht auf Auskunft (Art. 15 DSGVO),
Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
(Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen
auf Grundlage berechtigter Interessen (Art. 21). Außerdem kannst du dich bei
einer Datenschutzaufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel bei
der Behörde deines Wohnorts oder des Sitzes des Verantwortlichen.

Da der Betreiber deine Lerndaten nicht besitzt, richten sich Auskunfts- und
Löschbegehren zu diesen Daten an dein eigenes Gerät: Einstellungen, Daten,
Exportieren oder Löschen. Für Beiträge, Fehlerberichte und E-Mails, die der
Betreiber von dir erhalten hat, wende dich an die oben genannte E-Mail-Adresse.

## Änderungen

Diese Erklärung wird angepasst, wenn sich die App oder die Rechtslage ändert.
Das Datum der jeweils aktuellen Fassung steht oben.

Siehe auch das [Impressum](imprint.md).
