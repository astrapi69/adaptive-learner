# i18n review — part 03/09

Namespaces: `settings`, `methods`, `cycle_steps`, `errors`, `toast`
Keys in this part: 375

> Source of truth: **DE** (assumed correct). EN = key reference. Verify each language against DE; placeholders like `{name}` must match DE exactly. Please check: correct translation, idiomatic phrasing, swallowed/renamed placeholders, tone & terminology consistency — especially JA/KO/HI/ID/TR/PT (less verified).

## `settings`

### `settings.key_export_link.heading`
- **de**: KI-Schlüssel — verschlüsselter Export
- **en**: AI keys — encrypted export
- **el**: Κλειδιά AI — κρυπτογραφημένη εξαγωγή
- **es**: Claves de IA: exportación cifrada
- **fr**: Clés IA — export chiffré
- **hi**: AI कुंजियाँ — एन्क्रिप्टेड निर्यात
- **id**: Kunci AI — ekspor terenkripsi
- **ja**: AIキー — 暗号化エクスポート
- **ko**: AI 키 — 암호화 내보내기
- **pt**: Chaves de IA — exportação cifrada
- **tr**: Yapay zeka anahtarları — şifreli dışa aktarma

### `settings.key_export_link.hint`
- **de**: Exportiere oder importiere deine KI-Schlüssel als eine verschlüsselte Datei. Sie liegt bei den anderen Backups im Daten-Tab.
- **en**: Export or import your AI keys as a single encrypted file. It lives with the other backups in the Data tab.
- **el**: Εξαγάγετε ή εισαγάγετε τα κλειδιά AI σε ένα κρυπτογραφημένο αρχείο. Βρίσκεται μαζί με τα άλλα αντίγραφα ασφαλείας στην καρτέλα Δεδομένα.
- **es**: Exporta o importa tus claves de IA en un único archivo cifrado. Está junto a las demás copias de seguridad en la pestaña Datos.
- **fr**: Exportez ou importez vos clés IA dans un seul fichier chiffré. Il se trouve avec les autres sauvegardes dans l'onglet Données.
- **hi**: अपनी AI कुंजियों को एक एन्क्रिप्टेड फ़ाइल के रूप में निर्यात या आयात करें। यह डेटा टैब में अन्य बैकअप के साथ मौजूद है।
- **id**: Ekspor atau impor kunci AI Anda sebagai satu berkas terenkripsi. Berada bersama cadangan lain di tab Data.
- **ja**: AIキーを1つの暗号化ファイルとしてエクスポートまたはインポートします。データタブの他のバックアップと同じ場所にあります。
- **ko**: AI 키를 하나의 암호화된 파일로 내보내거나 가져옵니다. 데이터 탭의 다른 백업과 함께 있습니다.
- **pt**: Exporte ou importe as suas chaves de IA num único ficheiro cifrado. Fica junto das outras cópias de segurança no separador Dados.
- **tr**: Yapay zeka anahtarlarınızı tek bir şifreli dosya olarak dışa veya içe aktarın. Veri sekmesindeki diğer yedeklerle birlikte bulunur.

### `settings.key_export_link.button`
- **de**: Zum Schlüssel-Export (Daten-Tab)
- **en**: Go to key export (Data tab)
- **el**: Μετάβαση στην εξαγωγή κλειδιών (καρτέλα Δεδομένα)
- **es**: Ir a la exportación de claves (pestaña Datos)
- **fr**: Aller à l'export des clés (onglet Données)
- **hi**: कुंजी निर्यात पर जाएँ (डेटा टैब)
- **id**: Buka ekspor kunci (tab Data)
- **ja**: キーのエクスポートへ移動（データタブ）
- **ko**: 키 내보내기로 이동 (데이터 탭)
- **pt**: Ir para a exportação de chaves (separador Dados)
- **tr**: Anahtar dışa aktarmaya git (Veri sekmesi)

### `settings.key_vault.title`
- **de**: KI-Schlüssel — verschlüsselter Export
- **en**: AI keys — encrypted export
- **el**: Κλειδιά AI — κρυπτογραφημένη εξαγωγή
- **es**: Claves de IA — exportación cifrada
- **fr**: Clés d'IA — export chiffré
- **hi**: AI कुंजियाँ — एन्क्रिप्टेड निर्यात
- **id**: Kunci AI — ekspor terenkripsi
- **ja**: AIキー — 暗号化エクスポート
- **ko**: AI 키 — 암호화 내보내기
- **pt**: Chaves de IA — exportação criptografada
- **tr**: Yapay zekâ anahtarları — şifreli dışa aktarma

### `settings.key_vault.intro`
- **de**: Übertrage deine KI-Schlüssel in einer verschlüsselten Datei auf ein anderes Gerät — getrennt vom normalen Backup (das nie Schlüssel enthält).
- **en**: Move your AI keys to another device in one encrypted file, separate from the normal backup (which never contains keys).
- **el**: Μεταφέρετε τα κλειδιά AI σε άλλη συσκευή σε ένα κρυπτογραφημένο αρχείο, ξεχωριστά από το κανονικό αντίγραφο ασφαλείας (που δεν περιέχει ποτέ κλειδιά).
- **es**: Lleva tus claves de IA a otro dispositivo en un único archivo cifrado, separado de la copia de seguridad normal (que nunca contiene claves).
- **fr**: Transférez vos clés d'IA vers un autre appareil dans un seul fichier chiffré, séparé de la sauvegarde normale (qui ne contient jamais de clés).
- **hi**: अपनी AI कुंजियाँ एक एन्क्रिप्टेड फ़ाइल में दूसरे डिवाइस पर ले जाएँ, सामान्य बैकअप से अलग (जिसमें कभी कुंजियाँ नहीं होतीं)।
- **id**: Pindahkan kunci AI Anda ke perangkat lain dalam satu berkas terenkripsi, terpisah dari cadangan biasa (yang tidak pernah berisi kunci).
- **ja**: AIキーを1つの暗号化ファイルで別のデバイスに移行します。通常のバックアップ（キーを含みません）とは別です。
- **ko**: AI 키를 하나의 암호화 파일로 다른 기기로 옮기세요. 일반 백업(키를 포함하지 않음)과는 별개입니다.
- **pt**: Leve suas chaves de IA para outro dispositivo em um único arquivo criptografado, separado do backup normal (que nunca contém chaves).
- **tr**: Yapay zekâ anahtarlarınızı tek bir şifreli dosyada başka bir cihaza taşıyın; normal yedekten (anahtar içermez) ayrıdır.

### `settings.key_vault.api_disabled`
- **de**: Im Server-Modus werden deine Schlüssel serverseitig verwaltet, daher gibt es hier nichts zu exportieren.
- **en**: In server mode your keys are managed by the server, so there is nothing to export here.
- **el**: Σε λειτουργία διακομιστή τα κλειδιά σας διαχειρίζονται από τον διακομιστή, οπότε δεν υπάρχει κάτι για εξαγωγή εδώ.
- **es**: En modo servidor tus claves las gestiona el servidor, así que aquí no hay nada que exportar.
- **fr**: En mode serveur, vos clés sont gérées par le serveur ; il n'y a donc rien à exporter ici.
- **hi**: सर्वर मोड में आपकी कुंजियाँ सर्वर द्वारा प्रबंधित होती हैं, इसलिए यहाँ निर्यात करने के लिए कुछ नहीं है।
- **id**: Dalam mode server, kunci Anda dikelola oleh server, jadi tidak ada yang bisa diekspor di sini.
- **ja**: サーバーモードではキーはサーバーで管理されるため、ここにエクスポートするものはありません。
- **ko**: 서버 모드에서는 키가 서버에서 관리되므로 여기서 내보낼 것이 없습니다.
- **pt**: No modo servidor, suas chaves são gerenciadas pelo servidor, então não há nada para exportar aqui.
- **tr**: Sunucu modunda anahtarlarınız sunucu tarafından yönetilir, bu yüzden burada dışa aktarılacak bir şey yok.

### `settings.key_vault.export_heading`
- **de**: Exportieren
- **en**: Export
- **el**: Εξαγωγή
- **es**: Exportar
- **fr**: Exporter
- **hi**: निर्यात
- **id**: Ekspor
- **ja**: エクスポート
- **ko**: 내보내기
- **pt**: Exportar
- **tr**: Dışa aktar

### `settings.key_vault.passphrase_hint`
- **de**: Wähle eine starke Passphrase. Sie kann nicht wiederhergestellt werden — ohne sie lässt sich die Datei nicht öffnen.
- **en**: Choose a strong passphrase. It cannot be recovered — without it the file cannot be opened.
- **el**: Επιλέξτε μια ισχυρή φράση πρόσβασης. Δεν μπορεί να ανακτηθεί — χωρίς αυτήν το αρχείο δεν ανοίγει.
- **es**: Elige una frase de contraseña fuerte. No se puede recuperar: sin ella no se puede abrir el archivo.
- **fr**: Choisissez une phrase secrète forte. Elle ne peut pas être récupérée : sans elle, le fichier ne peut pas être ouvert.
- **hi**: एक मज़बूत पासफ़्रेज़ चुनें। इसे पुनर्प्राप्त नहीं किया जा सकता — इसके बिना फ़ाइल नहीं खुलेगी।
- **id**: Pilih frasa sandi yang kuat. Frasa ini tidak dapat dipulihkan — tanpanya berkas tidak dapat dibuka.
- **ja**: 強力なパスフレーズを選んでください。復元できません。これがないとファイルを開けません。
- **ko**: 강력한 암호문구를 선택하세요. 복구할 수 없으며, 없으면 파일을 열 수 없습니다.
- **pt**: Escolha uma frase-senha forte. Ela não pode ser recuperada — sem ela o arquivo não pode ser aberto.
- **tr**: Güçlü bir parola ifadesi seçin. Kurtarılamaz — onsuz dosya açılamaz.

### `settings.key_vault.passphrase_label`
- **de**: Passphrase
- **en**: Passphrase
- **el**: Φράση πρόσβασης
- **es**: Frase de contraseña
- **fr**: Phrase secrète
- **hi**: पासफ़्रेज़
- **id**: Frasa sandi
- **ja**: パスフレーズ
- **ko**: 암호문구
- **pt**: Frase-senha
- **tr**: Parola ifadesi

### `settings.key_vault.confirm_label`
- **de**: Passphrase bestätigen
- **en**: Confirm passphrase
- **el**: Επιβεβαίωση φράσης πρόσβασης
- **es**: Confirmar frase de contraseña
- **fr**: Confirmer la phrase secrète
- **hi**: पासफ़्रेज़ की पुष्टि करें
- **id**: Konfirmasi frasa sandi
- **ja**: パスフレーズの確認
- **ko**: 암호문구 확인
- **pt**: Confirmar frase-senha
- **tr**: Parola ifadesini onayla

### `settings.key_vault.no_keys`
- **de**: Es gibt noch keine KI-Schlüssel zum Exportieren.
- **en**: There are no AI keys to export yet.
- **el**: Δεν υπάρχουν ακόμη κλειδιά AI για εξαγωγή.
- **es**: Todavía no hay claves de IA para exportar.
- **fr**: Aucune clé d'IA à exporter pour le moment.
- **hi**: अभी निर्यात करने के लिए कोई AI कुंजी नहीं है।
- **id**: Belum ada kunci AI untuk diekspor.
- **ja**: エクスポートするAIキーはまだありません。
- **ko**: 아직 내보낼 AI 키가 없습니다.
- **pt**: Ainda não há chaves de IA para exportar.
- **tr**: Henüz dışa aktarılacak yapay zekâ anahtarı yok.

### `settings.key_vault.busy`
- **de**: Wird verarbeitet…
- **en**: Working…
- **el**: Επεξεργασία…
- **es**: Procesando…
- **fr**: Traitement…
- **hi**: काम जारी है…
- **id**: Memproses…
- **ja**: 処理中…
- **ko**: 처리 중…
- **pt**: Processando…
- **tr**: İşleniyor…

### `settings.key_vault.export_button`
- **de**: Verschlüsselte Datei exportieren
- **en**: Export encrypted file
- **el**: Εξαγωγή κρυπτογραφημένου αρχείου
- **es**: Exportar archivo cifrado
- **fr**: Exporter le fichier chiffré
- **hi**: एन्क्रिप्टेड फ़ाइल निर्यात करें
- **id**: Ekspor berkas terenkripsi
- **ja**: 暗号化ファイルをエクスポート
- **ko**: 암호화 파일 내보내기
- **pt**: Exportar arquivo criptografado
- **tr**: Şifreli dosyayı dışa aktar

### `settings.key_vault.import_heading`
- **de**: Importieren
- **en**: Import
- **el**: Εισαγωγή
- **es**: Importar
- **fr**: Importer
- **hi**: आयात
- **id**: Impor
- **ja**: インポート
- **ko**: 가져오기
- **pt**: Importar
- **tr**: İçe aktar

### `settings.key_vault.import_button`
- **de**: Schlüsseldatei importieren
- **en**: Import key file
- **el**: Εισαγωγή αρχείου κλειδιών
- **es**: Importar archivo de claves
- **fr**: Importer le fichier de clés
- **hi**: कुंजी फ़ाइल आयात करें
- **id**: Impor berkas kunci
- **ja**: キーファイルをインポート
- **ko**: 키 파일 가져오기
- **pt**: Importar arquivo de chaves
- **tr**: Anahtar dosyasını içe aktar

### `settings.key_vault.success_export`
- **de**: Verschlüsselte Schlüsseldatei heruntergeladen.
- **en**: Encrypted key file downloaded.
- **el**: Το κρυπτογραφημένο αρχείο κλειδιών λήφθηκε.
- **es**: Archivo de claves cifrado descargado.
- **fr**: Fichier de clés chiffré téléchargé.
- **hi**: एन्क्रिप्टेड कुंजी फ़ाइल डाउनलोड हो गई।
- **id**: Berkas kunci terenkripsi diunduh.
- **ja**: 暗号化キーファイルをダウンロードしました。
- **ko**: 암호화된 키 파일을 다운로드했습니다.
- **pt**: Arquivo de chaves criptografado baixado.
- **tr**: Şifreli anahtar dosyası indirildi.

### `settings.key_vault.success_import`
- **de**: Schlüssel importiert. KI-Funktionen sind wieder bereit.
- **en**: Keys imported. AI features are ready again.
- **el**: Τα κλειδιά εισήχθησαν. Οι λειτουργίες AI είναι ξανά έτοιμες.
- **es**: Claves importadas. Las funciones de IA están listas de nuevo.
- **fr**: Clés importées. Les fonctions d'IA sont à nouveau prêtes.
- **hi**: कुंजियाँ आयात हो गईं। AI सुविधाएँ फिर से तैयार हैं।
- **id**: Kunci diimpor. Fitur AI siap kembali.
- **ja**: キーをインポートしました。AI機能が再び利用可能です。
- **ko**: 키를 가져왔습니다. AI 기능을 다시 사용할 수 있습니다.
- **pt**: Chaves importadas. Os recursos de IA estão prontos novamente.
- **tr**: Anahtarlar içe aktarıldı. Yapay zekâ özellikleri yeniden hazır.

### `settings.key_vault.min_length`
- **de**: Mindestens {n} Zeichen.
- **en**: At least {n} characters.
- **el**: Τουλάχιστον {n} χαρακτήρες.
- **es**: Al menos {n} caracteres.
- **fr**: Au moins {n} caractères.
- **hi**: कम से कम {n} वर्ण।
- **id**: Minimal {n} karakter.
- **ja**: {n}文字以上で入力してください。
- **ko**: 최소 {n}자 이상이어야 합니다.
- **pt**: Pelo menos {n} caracteres.
- **tr**: En az {n} karakter.

### `settings.key_vault.error_mismatch`
- **de**: Die Passphrasen stimmen nicht überein.
- **en**: The passphrases do not match.
- **el**: Οι φράσεις πρόσβασης δεν ταιριάζουν.
- **es**: Las frases de contraseña no coinciden.
- **fr**: Les phrases secrètes ne correspondent pas.
- **hi**: पासफ़्रेज़ मेल नहीं खाते।
- **id**: Frasa sandi tidak cocok.
- **ja**: パスフレーズが一致しません。
- **ko**: 암호문구가 일치하지 않습니다.
- **pt**: As frases-senha não coincidem.
- **tr**: Parola ifadeleri eşleşmiyor.

### `settings.key_vault.error_export`
- **de**: Export konnte nicht erstellt werden.
- **en**: Could not create the export.
- **el**: Δεν ήταν δυνατή η δημιουργία της εξαγωγής.
- **es**: No se pudo crear la exportación.
- **fr**: Impossible de créer l'export.
- **hi**: निर्यात नहीं बनाया जा सका।
- **id**: Tidak dapat membuat ekspor.
- **ja**: エクスポートを作成できませんでした。
- **ko**: 내보내기를 만들 수 없습니다.
- **pt**: Não foi possível criar a exportação.
- **tr**: Dışa aktarma oluşturulamadı.

### `settings.key_vault.error_decrypt`
- **de**: Passphrase falsch oder Datei beschädigt.
- **en**: Passphrase incorrect or file corrupted.
- **el**: Λάθος φράση πρόσβασης ή κατεστραμμένο αρχείο.
- **es**: Frase de contraseña incorrecta o archivo dañado.
- **fr**: Phrase secrète incorrecte ou fichier endommagé.
- **hi**: पासफ़्रेज़ गलत है या फ़ाइल क्षतिग्रस्त है।
- **id**: Frasa sandi salah atau berkas rusak.
- **ja**: パスフレーズが間違っているか、ファイルが破損しています。
- **ko**: 암호문구가 틀렸거나 파일이 손상되었습니다.
- **pt**: Frase-senha incorreta ou arquivo corrompido.
- **tr**: Parola ifadesi yanlış veya dosya bozuk.

### `settings.key_vault.error_import`
- **de**: Schlüsseldatei konnte nicht importiert werden.
- **en**: Could not import the key file.
- **el**: Δεν ήταν δυνατή η εισαγωγή του αρχείου κλειδιών.
- **es**: No se pudo importar el archivo de claves.
- **fr**: Impossible d'importer le fichier de clés.
- **hi**: कुंजी फ़ाइल आयात नहीं की जा सकी।
- **id**: Tidak dapat mengimpor berkas kunci.
- **ja**: キーファイルをインポートできませんでした。
- **ko**: 키 파일을 가져올 수 없습니다.
- **pt**: Não foi possível importar o arquivo de chaves.
- **tr**: Anahtar dosyası içe aktarılamadı.

### `settings.lesson_mode.title`
- **de**: Lektionsmodus
- **en**: Lesson mode
- **el**: Λειτουργία μαθήματος
- **es**: Modo de lección
- **fr**: Mode de leçon
- **hi**: पाठ मोड
- **id**: Mode pelajaran
- **ja**: レッスンモード
- **ko**: 레슨 모드
- **pt**: Modo de lição
- **tr**: Ders modu

### `settings.lesson_mode.hint`
- **de**: Im Übungsmodus bleiben alle Hilfen an. Im Prüfungsmodus werden Tipps, Theorie-Wiederholung, Vorlesen und die Auflösung ausgeblendet, damit du unter realistischen Bedingungen abrufst.
- **en**: Practice keeps every learning aid on. Exam hides hints, theory recap, auto-read and the solution reveal so you retrieve under realistic conditions.
- **el**: Η εξάσκηση διατηρεί όλα τα βοηθήματα. Η εξέταση κρύβει υποδείξεις, επανάληψη θεωρίας, αυτόματη ανάγνωση και τη λύση ώστε να ανακαλείς σε ρεαλιστικές συνθήκες.
- **es**: El modo práctica mantiene todas las ayudas. El modo examen oculta las pistas, el repaso de teoría, la lectura automática y la solución para que recuperes en condiciones realistas.
- **fr**: Le mode entraînement garde toutes les aides. Le mode examen masque les indices, le rappel de théorie, la lecture automatique et la solution pour réviser dans des conditions réalistes.
- **hi**: अभ्यास मोड में सभी सहायताएँ चालू रहती हैं। परीक्षा मोड संकेत, सिद्धांत पुनरावलोकन, स्वतः वाचन और समाधान छिपा देता है ताकि आप वास्तविक परिस्थितियों में याद करें।
- **id**: Mode latihan mempertahankan semua bantuan. Mode ujian menyembunyikan petunjuk, ulasan teori, baca otomatis, dan solusi agar Anda mengingat dalam kondisi realistis.
- **ja**: 練習モードではすべての補助が有効です。試験モードではヒント、理論の復習、自動読み上げ、解答の表示を隠し、現実的な条件で思い出せるようにします。
- **ko**: 연습 모드는 모든 학습 보조 기능을 유지합니다. 시험 모드는 힌트, 이론 복습, 자동 읽기, 정답 표시를 숨겨 현실적인 조건에서 회상하도록 합니다.
- **pt**: O modo prática mantém todas as ajudas. O modo exame oculta dicas, revisão de teoria, leitura automática e a solução para que você recupere em condições realistas.
- **tr**: Alıştırma modu tüm yardımları açık tutar. Sınav modu ipuçlarını, teori tekrarını, otomatik okumayı ve çözümü gizler; böylece gerçekçi koşullarda hatırlarsın.

### `settings.lesson_mode.default_label`
- **de**: Standardmodus
- **en**: Default mode
- **el**: Προεπιλεγμένη λειτουργία
- **es**: Modo predeterminado
- **fr**: Mode par défaut
- **hi**: डिफ़ॉल्ट मोड
- **id**: Mode bawaan
- **ja**: 既定のモード
- **ko**: 기본 모드
- **pt**: Modo padrão
- **tr**: Varsayılan mod

### `settings.lesson_mode.threshold_label`
- **de**: Bestehens-Grenze
- **en**: Exam pass threshold
- **el**: Όριο επιτυχίας
- **es**: Umbral para aprobar
- **fr**: Seuil de réussite
- **hi**: उत्तीर्ण सीमा
- **id**: Ambang kelulusan
- **ja**: 合格基準
- **ko**: 합격 기준
- **pt**: Limite para aprovação
- **tr**: Geçme eşiği

### `settings.lesson_mode.timed_difficulty_label`
- **de**: Zeitmodus-Schwierigkeit
- **en**: Timed mode difficulty
- **el**: Δυσκολία λειτουργίας με χρόνο
- **es**: Dificultad del modo con tiempo
- **fr**: Difficulté du mode chronométré
- **hi**: समयबद्ध मोड कठिनाई
- **id**: Tingkat kesulitan mode berwaktu
- **ja**: タイム制モードの難易度
- **ko**: 시간 제한 모드 난이도
- **pt**: Dificuldade do modo cronometrado
- **tr**: Süreli mod zorluğu

### `settings.lesson_mode.timed_relaxed`
- **de**: Entspannt (2× Zeit)
- **en**: Relaxed (2× time)
- **el**: Χαλαρό (2× χρόνος)
- **es**: Relajado (2× tiempo)
- **fr**: Détendu (2× temps)
- **hi**: आरामदायक (2× समय)
- **id**: Santai (2× waktu)
- **ja**: ゆったり（2倍）
- **ko**: 여유 (2× 시간)
- **pt**: Relaxado (2× tempo)
- **tr**: Rahat (2× süre)

### `settings.lesson_mode.timed_normal`
- **de**: Normal
- **en**: Normal
- **el**: Κανονικό
- **es**: Normal
- **fr**: Normal
- **hi**: सामान्य
- **id**: Normal
- **ja**: ふつう
- **ko**: 보통
- **pt**: Normal
- **tr**: Normal

### `settings.lesson_mode.timed_fast`
- **de**: Schnell (0,7× Zeit)
- **en**: Fast (0.7× time)
- **el**: Γρήγορο (0,7× χρόνος)
- **es**: Rápido (0,7× tiempo)
- **fr**: Rapide (0,7× temps)
- **hi**: तेज़ (0.7× समय)
- **id**: Cepat (0,7× waktu)
- **ja**: はやい（0.7倍）
- **ko**: 빠름 (0.7× 시간)
- **pt**: Rápido (0,7× tempo)
- **tr**: Hızlı (0,7× süre)

### `settings.updates.title`
- **de**: Updates
- **en**: Updates
- **el**: Ενημερώσεις
- **es**: Actualizaciones
- **fr**: Mises à jour
- **hi**: अपडेट
- **id**: Pembaruan
- **ja**: アップデート
- **ko**: 업데이트
- **pt**: Atualizações
- **tr**: Güncellemeler

### `settings.updates.auto_check`
- **de**: Automatische Update-Prüfung
- **en**: Automatic update check
- **el**: Αυτόματος έλεγχος ενημερώσεων
- **es**: Comprobación automática de actualizaciones
- **fr**: Vérification automatique des mises à jour
- **hi**: स्वचालित अपडेट जाँच
- **id**: Pemeriksaan pembaruan otomatis
- **ja**: 自動アップデート確認
- **ko**: 자동 업데이트 확인
- **pt**: Verificação automática de atualizações
- **tr**: Otomatik güncelleme denetimi

### `settings.updates.interval`
- **de**: Prüfintervall
- **en**: Check interval
- **el**: Διάστημα ελέγχου
- **es**: Intervalo de comprobación
- **fr**: Intervalle de vérification
- **hi**: जाँच अंतराल
- **id**: Interval pemeriksaan
- **ja**: 確認間隔
- **ko**: 확인 주기
- **pt**: Intervalo de verificação
- **tr**: Denetim aralığı

### `settings.updates.interval_daily`
- **de**: Täglich
- **en**: Daily
- **el**: Καθημερινά
- **es**: Diario
- **fr**: Quotidien
- **hi**: दैनिक
- **id**: Harian
- **ja**: 毎日
- **ko**: 매일
- **pt**: Diário
- **tr**: Günlük

### `settings.updates.interval_weekly`
- **de**: Wöchentlich
- **en**: Weekly
- **el**: Εβδομαδιαία
- **es**: Semanal
- **fr**: Hebdomadaire
- **hi**: साप्ताहिक
- **id**: Mingguan
- **ja**: 毎週
- **ko**: 매주
- **pt**: Semanal
- **tr**: Haftalık

### `settings.updates.interval_monthly`
- **de**: Monatlich
- **en**: Monthly
- **el**: Μηνιαία
- **es**: Mensual
- **fr**: Mensuel
- **hi**: मासिक
- **id**: Bulanan
- **ja**: 毎月
- **ko**: 매월
- **pt**: Mensal
- **tr**: Aylık

### `settings.updates.interval_never`
- **de**: Nie
- **en**: Never
- **el**: Ποτέ
- **es**: Nunca
- **fr**: Jamais
- **hi**: कभी नहीं
- **id**: Tidak pernah
- **ja**: しない
- **ko**: 안 함
- **pt**: Nunca
- **tr**: Asla

### `settings.updates.last_check`
- **de**: Letzte Prüfung: {when}
- **en**: Last check: {when}
- **el**: Τελευταίος έλεγχος: {when}
- **es**: Última comprobación: {when}
- **fr**: Dernière vérification : {when}
- **hi**: पिछली जाँच: {when}
- **id**: Pemeriksaan terakhir: {when}
- **ja**: 前回の確認: {when}
- **ko**: 마지막 확인: {when}
- **pt**: Última verificação: {when}
- **tr**: Son denetim: {when}

### `settings.updates.never_checked`
- **de**: Noch nie geprüft
- **en**: Never checked
- **el**: Δεν έχει ελεγχθεί ποτέ
- **es**: Nunca comprobado
- **fr**: Jamais vérifié
- **hi**: कभी जाँच नहीं की
- **id**: Belum pernah diperiksa
- **ja**: 未確認
- **ko**: 확인한 적 없음
- **pt**: Nunca verificado
- **tr**: Hiç denetlenmedi

### `settings.updates.current_version`
- **de**: Aktuelle Version: v{version}
- **en**: Current version: v{version}
- **el**: Τρέχουσα έκδοση: v{version}
- **es**: Versión actual: v{version}
- **fr**: Version actuelle : v{version}
- **hi**: वर्तमान संस्करण: v{version}
- **id**: Versi saat ini: v{version}
- **ja**: 現在のバージョン: v{version}
- **ko**: 현재 버전: v{version}
- **pt**: Versão atual: v{version}
- **tr**: Geçerli sürüm: v{version}

### `settings.install.heading`
- **de**: App installieren
- **en**: Install app
- **el**: Εγκατάσταση εφαρμογής
- **es**: Instalar aplicación
- **fr**: Installer l'application
- **hi**: ऐप इंस्टॉल करें
- **id**: Pasang aplikasi
- **ja**: アプリをインストール
- **ko**: 앱 설치
- **pt**: Instalar aplicativo
- **tr**: Uygulamayı yükle

### `settings.install.description`
- **de**: Installiere Adaptive Learner als App für Offline-Zugriff und eine Vollbild-Erfahrung.
- **en**: Install Adaptive Learner as an app for offline access and a full-screen experience.
- **el**: Εγκαταστήστε το Adaptive Learner ως εφαρμογή για πρόσβαση εκτός σύνδεσης και πλήρη οθόνη.
- **es**: Instala Adaptive Learner como app para acceso sin conexión y pantalla completa.
- **fr**: Installez Adaptive Learner comme application pour un accès hors ligne et un mode plein écran.
- **hi**: ऑफ़लाइन उपयोग और फ़ुल-स्क्रीन अनुभव के लिए Adaptive Learner को ऐप के रूप में इंस्टॉल करें।
- **id**: Pasang Adaptive Learner sebagai aplikasi untuk akses luring dan pengalaman layar penuh.
- **ja**: オフラインアクセスと全画面表示のために Adaptive Learner をアプリとしてインストールします。
- **ko**: Adaptive Learner를 앱으로 설치하여 오프라인 접근과 전체 화면 환경을 누리세요.
- **pt**: Instale o Adaptive Learner como app para acesso offline e tela cheia.
- **tr**: Çevrimdışı erişim ve tam ekran deneyimi için Adaptive Learner'ı uygulama olarak yükleyin.

### `settings.install.button`
- **de**: App installieren
- **en**: Install app
- **el**: Εγκατάσταση εφαρμογής
- **es**: Instalar aplicación
- **fr**: Installer l'application
- **hi**: ऐप इंस्टॉल करें
- **id**: Pasang aplikasi
- **ja**: アプリをインストール
- **ko**: 앱 설치
- **pt**: Instalar aplicativo
- **tr**: Uygulamayı yükle

### `settings.install.already`
- **de**: Bereits installiert
- **en**: Already installed
- **el**: Ήδη εγκατεστημένη
- **es**: Ya instalada
- **fr**: Déjà installée
- **hi**: पहले से इंस्टॉल है
- **id**: Sudah terpasang
- **ja**: インストール済み
- **ko**: 이미 설치됨
- **pt**: Já instalado
- **tr**: Zaten yüklü

### `settings.install.unavailable`
- **de**: Dein Browser hat die Installation noch nicht angeboten.
- **en**: Your browser hasn't offered installation yet.
- **el**: Το πρόγραμμα περιήγησής σας δεν έχει προσφέρει ακόμη εγκατάσταση.
- **es**: Tu navegador aún no ha ofrecido la instalación.
- **fr**: Votre navigateur n'a pas encore proposé l'installation.
- **hi**: आपके ब्राउज़र ने अभी तक इंस्टॉल का विकल्प नहीं दिया है।
- **id**: Peramban Anda belum menawarkan pemasangan.
- **ja**: ブラウザがまだインストールを提案していません。
- **ko**: 브라우저가 아직 설치를 제안하지 않았습니다.
- **pt**: Seu navegador ainda não ofereceu a instalação.
- **tr**: Tarayıcınız henüz kurulum sunmadı.

### `settings.install.installed`
- **de**: App installiert.
- **en**: App installed.
- **el**: Η εφαρμογή εγκαταστάθηκε.
- **es**: Aplicación instalada.
- **fr**: Application installée.
- **hi**: ऐप इंस्टॉल हो गया।
- **id**: Aplikasi terpasang.
- **ja**: アプリをインストールしました。
- **ko**: 앱이 설치되었습니다.
- **pt**: Aplicativo instalado.
- **tr**: Uygulama yüklendi.

### `settings.section_review`
- **de**: Wiederholung
- **en**: Review
- **el**: Επανάληψη
- **es**: Repaso
- **fr**: Révision
- **hi**: समीक्षा
- **id**: Ulasan
- **ja**: 復習
- **ko**: 복습
- **pt**: Revisão
- **tr**: Tekrar

### `settings.explanations_enabled`
- **de**: Fehlererklärungen anzeigen
- **en**: Show error explanations
- **el**: Εμφάνιση εξηγήσεων λαθών
- **es**: Mostrar explicaciones de errores
- **fr**: Afficher les explications d'erreur
- **hi**: त्रुटि स्पष्टीकरण दिखाएँ
- **id**: Tampilkan penjelasan kesalahan
- **ja**: エラーの説明を表示
- **ko**: 오류 설명 표시
- **pt**: Mostrar explicações de erros
- **tr**: Hata açıklamalarını göster

### `settings.explanations_enabled_desc`
- **de**: Zeigt nach einer Lektion zu jedem Fehler einen kurzen Regeltipp.
- **en**: After a lesson, show a short rule tip for each mistake.
- **el**: Μετά από ένα μάθημα, εμφανίζει μια σύντομη συμβουλή κανόνα για κάθε λάθος.
- **es**: Tras una lección, muestra un breve consejo de regla por cada error.
- **fr**: Après une leçon, affiche un court conseil de règle pour chaque erreur.
- **hi**: पाठ के बाद हर गलती के लिए एक संक्षिप्त नियम सुझाव दिखाता है।
- **id**: Setelah pelajaran, tampilkan kiat aturan singkat untuk setiap kesalahan.
- **ja**: レッスン後に各間違いへ短いルールのヒントを表示します。
- **ko**: 레슨 후 각 오답에 대해 짧은 규칙 팁을 표시합니다.
- **pt**: Após uma lição, mostra uma breve dica de regra para cada erro.
- **tr**: Bir dersten sonra her hata için kısa bir kural ipucu gösterir.

### `settings.section_hints`
- **de**: Tipps
- **en**: Hints
- **el**: Υποδείξεις
- **es**: Pistas
- **fr**: Indices
- **hi**: संकेत
- **id**: Petunjuk
- **ja**: ヒント
- **ko**: 힌트
- **pt**: Dicas
- **tr**: İpuçları

### `settings.hints_enabled`
- **de**: Tipps in Übungen anzeigen
- **en**: Show hints during exercises
- **el**: Εμφάνιση υποδείξεων στις ασκήσεις
- **es**: Mostrar pistas en los ejercicios
- **fr**: Afficher des indices pendant les exercices
- **hi**: अभ्यास के दौरान संकेत दिखाएँ
- **id**: Tampilkan petunjuk selama latihan
- **ja**: 練習中にヒントを表示
- **ko**: 연습 중 힌트 표시
- **pt**: Mostrar dicas nos exercícios
- **tr**: Alıştırmalarda ipucu göster

### `settings.hints_enabled_desc`
- **de**: Bietet bei jeder Übung einen gestuften Tipp-Button.
- **en**: Offer a staged hint button on each exercise.
- **el**: Προσφέρει ένα κουμπί κλιμακωτής υπόδειξης σε κάθε άσκηση.
- **es**: Ofrece un botón de pista por niveles en cada ejercicio.
- **fr**: Propose un bouton d'indice par paliers sur chaque exercice.
- **hi**: हर अभ्यास पर एक क्रमिक संकेत बटन देता है।
- **id**: Tawarkan tombol petunjuk bertahap pada setiap latihan.
- **ja**: 各練習で段階的なヒントボタンを表示します。
- **ko**: 각 연습 문제에 단계별 힌트 버튼을 제공합니다.
- **pt**: Oferece um botão de dica por níveis em cada exercício.
- **tr**: Her alıştırmada kademeli bir ipucu düğmesi sunar.

### `settings.hint_xp_cost`
- **de**: XP-Kosten pro Tipp
- **en**: XP cost per hint
- **el**: Κόστος XP ανά υπόδειξη
- **es**: Coste de XP por pista
- **fr**: Coût en XP par indice
- **hi**: प्रति संकेत XP लागत
- **id**: Biaya XP per petunjuk
- **ja**: ヒント1回あたりのXPコスト
- **ko**: 힌트당 XP 비용
- **pt**: Custo de XP por dica
- **tr**: İpucu başına XP maliyeti

### `settings.hint_xp_cost_desc`
- **de**: Wird auf dem Tipp-Button angezeigt. 0 = kostenlos.
- **en**: Shown on the hint button. Set to 0 for free hints.
- **el**: Εμφανίζεται στο κουμπί υπόδειξης. 0 = δωρεάν.
- **es**: Se muestra en el botón de pista. 0 = gratis.
- **fr**: Affiché sur le bouton d'indice. 0 = gratuit.
- **hi**: संकेत बटन पर दिखाया जाता है। 0 = निःशुल्क।
- **id**: Ditampilkan pada tombol petunjuk. Atur ke 0 untuk petunjuk gratis.
- **ja**: ヒントボタンに表示されます。0で無料。
- **ko**: 힌트 버튼에 표시됩니다. 무료 힌트는 0으로 설정하세요.
- **pt**: Mostrado no botão de dica. 0 = grátis.
- **tr**: İpucu düğmesinde gösterilir. 0 = ücretsiz.

### `settings.section_reminders`
- **de**: Erinnerungen
- **en**: Reminders
- **el**: Υπενθυμίσεις
- **es**: Recordatorios
- **fr**: Rappels
- **hi**: अनुस्मारक
- **id**: Pengingat
- **ja**: リマインダー
- **ko**: 알림
- **pt**: Lembretes
- **tr**: Hatırlatıcılar

### `settings.reminders_enabled`
- **de**: Tägliche Lern-Erinnerungen
- **en**: Daily learning reminders
- **el**: Καθημερινές υπενθυμίσεις μάθησης
- **es**: Recordatorios diarios de aprendizaje
- **fr**: Rappels d'apprentissage quotidiens
- **hi**: दैनिक सीखने के अनुस्मारक
- **id**: Pengingat belajar harian
- **ja**: 毎日の学習リマインダー
- **ko**: 매일 학습 알림
- **pt**: Lembretes diários de aprendizagem
- **tr**: Günlük öğrenme hatırlatıcıları

### `settings.reminders_enabled_desc`
- **de**: Erhalte eine Browser-Benachrichtigung, wenn Wiederholungen fällig sind. Funktioniert nur, solange die App geöffnet ist.
- **en**: Get a browser notification when reviews are due. Fires only while the app is open.
- **el**: Λάβετε ειδοποίηση του προγράμματος περιήγησης όταν υπάρχουν επαναλήψεις σε εκκρεμότητα. Λειτουργεί μόνο όσο η εφαρμογή είναι ανοιχτή.
- **es**: Recibe una notificación del navegador cuando haya repasos pendientes. Solo funciona mientras la app está abierta.
- **fr**: Recevez une notification du navigateur lorsque des révisions sont dues. Ne fonctionne que lorsque l'application est ouverte.
- **hi**: जब समीक्षाएँ देय हों तो ब्राउज़र सूचना प्राप्त करें। यह केवल तभी काम करता है जब ऐप खुला हो।
- **id**: Dapatkan notifikasi browser saat ada tinjauan yang jatuh tempo. Hanya aktif saat aplikasi terbuka.
- **ja**: 復習の時期になるとブラウザ通知を受け取ります。アプリが開いている間のみ機能します。
- **ko**: 복습할 항목이 있을 때 브라우저 알림을 받습니다. 앱이 열려 있을 때만 작동합니다.
- **pt**: Receba uma notificação do navegador quando houver revisões pendentes. Funciona apenas enquanto o app está aberto.
- **tr**: Tekrarların zamanı geldiğinde tarayıcı bildirimi alın. Yalnızca uygulama açıkken çalışır.

### `settings.reminders_time`
- **de**: Erinnerungszeit
- **en**: Reminder time
- **el**: Ώρα υπενθύμισης
- **es**: Hora del recordatorio
- **fr**: Heure du rappel
- **hi**: अनुस्मारक समय
- **id**: Waktu pengingat
- **ja**: リマインダーの時刻
- **ko**: 알림 시간
- **pt**: Horário do lembrete
- **tr**: Hatırlatma saati

### `settings.reminders_time_desc`
- **de**: Wann du täglich erinnert werden möchtest.
- **en**: When to remind you each day.
- **el**: Πότε να σας υπενθυμίζουμε κάθε μέρα.
- **es**: Cuándo recordártelo cada día.
- **fr**: Quand vous le rappeler chaque jour.
- **hi**: हर दिन आपको कब याद दिलाना है।
- **id**: Kapan harus mengingatkan Anda setiap hari.
- **ja**: 毎日いつ通知するか。
- **ko**: 매일 언제 알림을 받을지.
- **pt**: Quando lembrar você todos os dias.
- **tr**: Her gün sizi ne zaman hatırlatalım.

### `settings.reminders_weekdays`
- **de**: Tage
- **en**: Days
- **el**: Ημέρες
- **es**: Días
- **fr**: Jours
- **hi**: दिन
- **id**: Hari
- **ja**: 曜日
- **ko**: 요일
- **pt**: Dias
- **tr**: Günler

### `settings.reminders_weekdays_desc`
- **de**: An welchen Tagen erinnert werden soll.
- **en**: Which days to remind you.
- **el**: Ποιες ημέρες να σας υπενθυμίζουμε.
- **es**: Qué días recordártelo.
- **fr**: Quels jours vous le rappeler.
- **hi**: किन दिनों में आपको याद दिलाना है।
- **id**: Hari apa saja untuk mengingatkan Anda.
- **ja**: 通知する曜日。
- **ko**: 어떤 요일에 알림을 받을지.
- **pt**: Em quais dias lembrar você.
- **tr**: Hangi günlerde hatırlatalım.

### `settings.reminders_permission_request`
- **de**: Benachrichtigungen aktivieren
- **en**: Enable notifications
- **el**: Ενεργοποίηση ειδοποιήσεων
- **es**: Activar notificaciones
- **fr**: Activer les notifications
- **hi**: सूचनाएँ सक्षम करें
- **id**: Aktifkan notifikasi
- **ja**: 通知を有効にする
- **ko**: 알림 사용
- **pt**: Ativar notificações
- **tr**: Bildirimleri etkinleştir

### `settings.reminders_permission_denied`
- **de**: Benachrichtigungen sind blockiert. Aktiviere sie in den Website-Einstellungen deines Browsers, um Erinnerungen zu erhalten.
- **en**: Notifications are blocked. Enable them in your browser's site settings to receive reminders.
- **el**: Οι ειδοποιήσεις είναι αποκλεισμένες. Ενεργοποιήστε τις στις ρυθμίσεις ιστότοπου του προγράμματος περιήγησης για να λαμβάνετε υπενθυμίσεις.
- **es**: Las notificaciones están bloqueadas. Actívalas en la configuración del sitio de tu navegador para recibir recordatorios.
- **fr**: Les notifications sont bloquées. Activez-les dans les paramètres du site de votre navigateur pour recevoir des rappels.
- **hi**: सूचनाएँ अवरुद्ध हैं। अनुस्मारक प्राप्त करने के लिए उन्हें अपने ब्राउज़र की साइट सेटिंग में सक्षम करें।
- **id**: Notifikasi diblokir. Aktifkan di pengaturan situs browser Anda untuk menerima pengingat.
- **ja**: 通知がブロックされています。リマインダーを受け取るには、ブラウザのサイト設定で有効にしてください。
- **ko**: 알림이 차단되어 있습니다. 알림을 받으려면 브라우저의 사이트 설정에서 사용 설정하세요.
- **pt**: As notificações estão bloqueadas. Ative-as nas configurações do site do seu navegador para receber lembretes.
- **tr**: Bildirimler engellendi. Hatırlatıcı almak için tarayıcınızın site ayarlarından etkinleştirin.

### `settings.reminders_unsupported`
- **de**: Dein Browser unterstützt keine Benachrichtigungen.
- **en**: Your browser does not support notifications.
- **el**: Το πρόγραμμα περιήγησής σας δεν υποστηρίζει ειδοποιήσεις.
- **es**: Tu navegador no admite notificaciones.
- **fr**: Votre navigateur ne prend pas en charge les notifications.
- **hi**: आपका ब्राउज़र सूचनाओं का समर्थन नहीं करता।
- **id**: Browser Anda tidak mendukung notifikasi.
- **ja**: お使いのブラウザは通知に対応していません。
- **ko**: 브라우저가 알림을 지원하지 않습니다.
- **pt**: Seu navegador não oferece suporte a notificações.
- **tr**: Tarayıcınız bildirimleri desteklemiyor.

### `settings.reminders_notification_title`
- **de**: Zeit zum Wiederholen
- **en**: Time to review
- **el**: Ώρα για επανάληψη
- **es**: Hora de repasar
- **fr**: C'est l'heure de réviser
- **hi**: समीक्षा का समय
- **id**: Waktunya meninjau
- **ja**: 復習の時間です
- **ko**: 복습할 시간입니다
- **pt**: Hora de revisar
- **tr**: Tekrar zamanı

### `settings.reminders_notification_body`
- **de**: {n} Wiederholungen sind fällig. Bleib an deiner Serie dran!
- **en**: {n} reviews are due. Keep your streak going!
- **el**: {n} επαναλήψεις είναι σε εκκρεμότητα. Διατηρήστε το σερί σας!
- **es**: Tienes {n} repasos pendientes. ¡Mantén tu racha!
- **fr**: {n} révisions sont dues. Gardez votre série !
- **hi**: {n} समीक्षाएँ देय हैं। अपनी श्रृंखला बनाए रखें!
- **id**: {n} tinjauan jatuh tempo. Pertahankan rangkaian Anda!
- **ja**: {n}件の復習が期限を迎えています。連続記録を続けましょう！
- **ko**: 복습 {n}건이 예정되어 있습니다. 연속 기록을 이어가세요!
- **pt**: {n} revisões estão pendentes. Mantenha sua sequência!
- **tr**: {n} tekrar bekliyor. Serini sürdür!

### `settings.support.heading`
- **de**: Support
- **en**: Support
- **el**: Υποστήριξη
- **es**: Soporte
- **fr**: Assistance
- **hi**: सहायता
- **id**: Dukungan
- **ja**: サポート
- **ko**: 지원
- **pt**: Suporte
- **tr**: Destek

### `settings.support.description`
- **de**: Etwas funktioniert nicht wie erwartet? Erstelle einen Bericht deiner letzten Aktionen, damit die Entwicklung das Problem nachvollziehen kann. Du prüfst alles, bevor es deinen Browser verlässt.
- **en**: Something not working as expected? Create a report of your recent actions to help the developer reproduce it. You review everything before it leaves your browser.
- **el**: Κάτι δεν λειτουργεί όπως περιμένατε; Δημιουργήστε μια αναφορά των πρόσφατων ενεργειών σας για να βοηθήσετε τον προγραμματιστή να την αναπαράγει. Ελέγχετε τα πάντα πριν φύγουν από το πρόγραμμα περιήγησής σας.
- **es**: ¿Algo no funciona como esperabas? Crea un informe de tus acciones recientes para ayudar al desarrollador a reproducirlo. Revisas todo antes de que salga de tu navegador.
- **fr**: Quelque chose ne fonctionne pas comme prévu ? Créez un rapport de vos actions récentes pour aider le développeur à le reproduire. Vous vérifiez tout avant que cela ne quitte votre navigateur.
- **hi**: कुछ उम्मीद के मुताबिक काम नहीं कर रहा? डेवलपर को समस्या दोहराने में मदद के लिए अपनी हाल की क्रियाओं की एक रिपोर्ट बनाएँ। आपके ब्राउज़र से बाहर जाने से पहले आप हर चीज़ की समीक्षा करते हैं।
- **id**: Ada yang tidak berfungsi seperti yang diharapkan? Buat laporan tindakan terakhir Anda untuk membantu pengembang mereproduksinya. Anda meninjau semuanya sebelum keluar dari peramban Anda.
- **ja**: 想定どおりに動作しませんか？最近の操作のレポートを作成すると、開発者が問題を再現しやすくなります。ブラウザから送信される前にすべてを確認できます。
- **ko**: 예상대로 작동하지 않나요? 최근 작업 내역에 대한 보고서를 만들어 개발자가 문제를 재현하도록 도울 수 있습니다. 브라우저를 벗어나기 전에 모든 내용을 직접 검토합니다.
- **pt**: Algo não está funcionando como esperado? Crie um relatório das suas ações recentes para ajudar o desenvolvedor a reproduzir o problema. Você revisa tudo antes de sair do seu navegador.
- **tr**: Bir şey beklediğiniz gibi çalışmıyor mu? Geliştiricinin sorunu yeniden oluşturmasına yardımcı olmak için son işlemlerinizin bir raporunu oluşturun. Tarayıcınızdan çıkmadan önce her şeyi gözden geçirirsiniz.

### `settings.support.create_report`
- **de**: Fehlerbericht erstellen
- **en**: Create error report
- **el**: Δημιουργία αναφοράς σφάλματος
- **es**: Crear informe de error
- **fr**: Créer un rapport d'erreur
- **hi**: त्रुटि रिपोर्ट बनाएँ
- **id**: Buat laporan kesalahan
- **ja**: エラーレポートを作成
- **ko**: 오류 보고서 만들기
- **pt**: Criar relatório de erro
- **tr**: Hata raporu oluştur

### `settings.support.report_default_message`
- **de**: Vom Nutzer ausgelöster Bericht
- **en**: User-initiated report
- **el**: Αναφορά με πρωτοβουλία χρήστη
- **es**: Informe iniciado por el usuario
- **fr**: Rapport initié par l'utilisateur
- **hi**: उपयोगकर्ता-आरंभित रिपोर्ट
- **id**: Laporan yang dimulai pengguna
- **ja**: ユーザーが開始したレポート
- **ko**: 사용자가 시작한 보고서
- **pt**: Relatório iniciado pelo usuário
- **tr**: Kullanıcı tarafından başlatılan rapor

### `settings.tab_integrations`
- **de**: Integrationen
- **en**: Integrations
- **el**: Ενσωματώσεις
- **es**: Integraciones
- **fr**: Intégrations
- **hi**: एकीकरण
- **id**: Integrasi
- **ja**: 連携
- **ko**: 연동
- **pt**: Integrações
- **tr**: Entegrasyonlar

### `settings.github.title`
- **de**: GitHub-Integration
- **en**: GitHub Integration
- **el**: Ενσωμάτωση GitHub
- **es**: Integración con GitHub
- **fr**: Intégration GitHub
- **hi**: GitHub एकीकरण
- **id**: Integrasi GitHub
- **ja**: GitHub 連携
- **ko**: GitHub 연동
- **pt**: Integração com o GitHub
- **tr**: GitHub Entegrasyonu

### `settings.github.intro`
- **de**: Wird benötigt, um Lektionen als Pull Request zu teilen. Erstelle einen Token mit der Berechtigung 'repo'.
- **en**: Needed to share lessons as a pull request. Create a token with the 'repo' permission.
- **el**: Απαιτείται για κοινή χρήση μαθημάτων ως pull request. Δημιούργησε ένα token με δικαίωμα 'repo'.
- **es**: Necesario para compartir lecciones como pull request. Crea un token con el permiso 'repo'.
- **fr**: Nécessaire pour partager des leçons via une pull request. Crée un token avec l'autorisation 'repo'.
- **hi**: पाठों को पुल रिक्वेस्ट के रूप में साझा करने के लिए ज़रूरी। 'repo' अनुमति के साथ एक टोकन बनाएँ।
- **id**: Diperlukan untuk membagikan pelajaran sebagai pull request. Buat token dengan izin 'repo'.
- **ja**: レッスンをプルリクエストとして共有するために必要です。'repo' 権限を持つトークンを作成してください。
- **ko**: 레슨을 풀 리퀘스트로 공유하는 데 필요합니다. 'repo' 권한이 있는 토큰을 생성하세요.
- **pt**: Necessário para partilhar lições como pull request. Cria um token com a permissão 'repo'.
- **tr**: Dersleri pull request olarak paylaşmak için gereklidir. 'repo' iznine sahip bir token oluştur.

### `settings.github.token`
- **de**: GitHub-Token
- **en**: GitHub token
- **el**: Token GitHub
- **es**: Token de GitHub
- **fr**: Token GitHub
- **hi**: GitHub टोकन
- **id**: Token GitHub
- **ja**: GitHub トークン
- **ko**: GitHub 토큰
- **pt**: Token do GitHub
- **tr**: GitHub belirteci

### `settings.github.format_invalid`
- **de**: Ein GitHub-Token beginnt mit 'ghp_' oder 'github_pat_'.
- **en**: A GitHub token starts with 'ghp_' or 'github_pat_'.
- **el**: Ένα token GitHub ξεκινά με 'ghp_' ή 'github_pat_'.
- **es**: Un token de GitHub empieza por 'ghp_' o 'github_pat_'.
- **fr**: Un token GitHub commence par 'ghp_' ou 'github_pat_'.
- **hi**: GitHub टोकन 'ghp_' या 'github_pat_' से शुरू होता है।
- **id**: Token GitHub diawali dengan 'ghp_' atau 'github_pat_'.
- **ja**: GitHub トークンは 'ghp_' または 'github_pat_' で始まります。
- **ko**: GitHub 토큰은 'ghp_' 또는 'github_pat_'로 시작합니다.
- **pt**: Um token do GitHub começa por 'ghp_' ou 'github_pat_'.
- **tr**: Bir GitHub belirteci 'ghp_' veya 'github_pat_' ile başlar.

### `settings.github.test`
- **de**: Testen
- **en**: Test
- **el**: Δοκιμή
- **es**: Probar
- **fr**: Tester
- **hi**: परीक्षण
- **id**: Uji
- **ja**: テスト
- **ko**: 테스트
- **pt**: Testar
- **tr**: Test et

### `settings.github.testing`
- **de**: Wird getestet...
- **en**: Testing...
- **el**: Δοκιμή...
- **es**: Probando...
- **fr**: Test en cours...
- **hi**: परीक्षण हो रहा है...
- **id**: Menguji...
- **ja**: テスト中...
- **ko**: 테스트 중...
- **pt**: A testar...
- **tr**: Test ediliyor...

### `settings.github.save`
- **de**: Speichern
- **en**: Save
- **el**: Αποθήκευση
- **es**: Guardar
- **fr**: Enregistrer
- **hi**: सहेजें
- **id**: Simpan
- **ja**: 保存
- **ko**: 저장
- **pt**: Guardar
- **tr**: Kaydet

### `settings.github.remove`
- **de**: Entfernen
- **en**: Remove
- **el**: Αφαίρεση
- **es**: Eliminar
- **fr**: Supprimer
- **hi**: निकालें
- **id**: Hapus
- **ja**: 削除
- **ko**: 제거
- **pt**: Remover
- **tr**: Kaldır

### `settings.github.saved`
- **de**: GitHub-Token gespeichert.
- **en**: GitHub token saved.
- **el**: Το token GitHub αποθηκεύτηκε.
- **es**: Token de GitHub guardado.
- **fr**: Token GitHub enregistré.
- **hi**: GitHub टोकन सहेजा गया।
- **id**: Token GitHub disimpan.
- **ja**: GitHub トークンを保存しました。
- **ko**: GitHub 토큰이 저장되었습니다.
- **pt**: Token do GitHub guardado.
- **tr**: GitHub belirteci kaydedildi.

### `settings.github.removed`
- **de**: GitHub-Token entfernt.
- **en**: GitHub token removed.
- **el**: Το token GitHub αφαιρέθηκε.
- **es**: Token de GitHub eliminado.
- **fr**: Token GitHub supprimé.
- **hi**: GitHub टोकन हटाया गया।
- **id**: Token GitHub dihapus.
- **ja**: GitHub トークンを削除しました。
- **ko**: GitHub 토큰이 제거되었습니다.
- **pt**: Token do GitHub removido.
- **tr**: GitHub belirteci kaldırıldı.

### `settings.github.test_success`
- **de**: Verbunden als {username}
- **en**: Connected as {username}
- **el**: Συνδεδεμένος ως {username}
- **es**: Conectado como {username}
- **fr**: Connecté en tant que {username}
- **hi**: {username} के रूप में जुड़े
- **id**: Terhubung sebagai {username}
- **ja**: {username} として接続しました
- **ko**: {username}(으)로 연결되었습니다
- **pt**: Ligado como {username}
- **tr**: {username} olarak bağlanıldı

### `settings.github.test_invalid`
- **de**: Token ungültig.
- **en**: Token invalid.
- **el**: Μη έγκυρο token.
- **es**: Token no válido.
- **fr**: Token invalide.
- **hi**: टोकन अमान्य है।
- **id**: Token tidak valid.
- **ja**: トークンが無効です。
- **ko**: 토큰이 유효하지 않습니다.
- **pt**: Token inválido.
- **tr**: Belirteç geçersiz.

### `settings.github.test_rate_limit`
- **de**: GitHub-Ratenlimit erreicht. Versuche es später erneut.
- **en**: GitHub rate limit reached. Try again later.
- **el**: Συμπληρώθηκε το όριο GitHub. Δοκίμασε αργότερα.
- **es**: Límite de GitHub alcanzado. Inténtalo más tarde.
- **fr**: Limite de débit GitHub atteinte. Réessaie plus tard.
- **hi**: GitHub दर सीमा पहुँच गई। बाद में फिर कोशिश करें।
- **id**: Batas laju GitHub tercapai. Coba lagi nanti.
- **ja**: GitHub のレート制限に達しました。後でもう一度お試しください。
- **ko**: GitHub 요청 한도에 도달했습니다. 나중에 다시 시도하세요.
- **pt**: Limite do GitHub atingido. Tenta mais tarde.
- **tr**: GitHub hız sınırına ulaşıldı. Daha sonra tekrar dene.

### `settings.github.test_network`
- **de**: GitHub konnte nicht erreicht werden.
- **en**: Could not reach GitHub.
- **el**: Δεν ήταν δυνατή η σύνδεση με το GitHub.
- **es**: No se pudo conectar con GitHub.
- **fr**: Impossible de joindre GitHub.
- **hi**: GitHub तक नहीं पहुँच सके।
- **id**: Tidak dapat menjangkau GitHub.
- **ja**: GitHub に接続できませんでした。
- **ko**: GitHub에 연결할 수 없었습니다.
- **pt**: Não foi possível contactar o GitHub.
- **tr**: GitHub'a ulaşılamadı.

### `settings.github.test_no_token`
- **de**: Kein Token zum Testen.
- **en**: No token to test.
- **el**: Δεν υπάρχει token για δοκιμή.
- **es**: No hay token para probar.
- **fr**: Aucun token à tester.
- **hi**: परीक्षण के लिए कोई टोकन नहीं।
- **id**: Tidak ada token untuk diuji.
- **ja**: テストするトークンがありません。
- **ko**: 테스트할 토큰이 없습니다.
- **pt**: Não há token para testar.
- **tr**: Test edilecek belirteç yok.

### `settings.github.source_file`
- **de**: In secrets.yaml gespeichert
- **en**: Stored in secrets.yaml
- **el**: Αποθηκεύτηκε στο secrets.yaml
- **es**: Guardado en secrets.yaml
- **fr**: Enregistré dans secrets.yaml
- **hi**: secrets.yaml में संग्रहीत
- **id**: Disimpan di secrets.yaml
- **ja**: secrets.yaml に保存
- **ko**: secrets.yaml에 저장됨
- **pt**: Guardado em secrets.yaml
- **tr**: secrets.yaml içinde saklanıyor

### `settings.github.source_env`
- **de**: Über Umgebungsvariable verwaltet
- **en**: Managed via environment
- **el**: Διαχειρίζεται μέσω μεταβλητής περιβάλλοντος
- **es**: Gestionado por variable de entorno
- **fr**: Géré par variable d'environnement
- **hi**: एनवायरनमेंट के माध्यम से प्रबंधित
- **id**: Dikelola melalui lingkungan
- **ja**: 環境変数で管理
- **ko**: 환경 변수로 관리됨
- **pt**: Gerido por variável de ambiente
- **tr**: Ortam değişkeniyle yönetiliyor

### `settings.github.source_browser`
- **de**: In diesem Browser gespeichert
- **en**: Stored in this browser
- **el**: Αποθηκεύτηκε σε αυτό το πρόγραμμα περιήγησης
- **es**: Guardado en este navegador
- **fr**: Enregistré dans ce navigateur
- **hi**: इस ब्राउज़र में संग्रहीत
- **id**: Disimpan di peramban ini
- **ja**: このブラウザに保存
- **ko**: 이 브라우저에 저장됨
- **pt**: Guardado neste navegador
- **tr**: Bu tarayıcıda saklanıyor

### `settings.title`
- **de**: Einstellungen
- **en**: Settings
- **el**: Ρυθμίσεις
- **es**: Ajustes
- **fr**: Parametres
- **hi**: सेटिंग्स
- **id**: Pengaturan
- **ja**: 設定
- **ko**: 설정
- **pt**: Configurações
- **tr**: Ayarlar

### `settings.help_intro`
- **de**: Durchsuche das integrierte Glossar. Klicke auf einen Eintrag, um den vollständigen Artikel zu öffnen.
- **en**: Browse and search the in-app glossary. Click any entry for the full article.
- **el**: Περιηγηθείτε και αναζητήστε στο ενσωματωμένο γλωσσάρι. Κάντε κλικ σε οποιαδήποτε καταχώριση για το πλήρες άρθρο.
- **es**: Explora y busca en el glosario integrado. Haz clic en cualquier entrada para ver el artículo completo.
- **fr**: Parcourez et recherchez dans le glossaire intégré. Cliquez sur une entrée pour l’article complet.
- **hi**: ऐप के अंदर मौजूद शब्दावली ब्राउज़ करें और खोजें। पूरा लेख देखने के लिए किसी भी प्रविष्टि पर क्लिक करें।
- **id**: Telusuri dan cari glosarium dalam aplikasi. Klik entri mana pun untuk artikel lengkap.
- **ja**: アプリ内の用語集を閲覧・検索できます。各エントリをクリックすると詳しい記事が開きます。
- **ko**: 앱 내 용어집을 둘러보고 검색하세요. 전체 문서를 보려면 항목을 클릭하세요.
- **pt**: Navegue e pesquise o glossário integrado. Clique em qualquer entrada para abrir o artigo completo.
- **tr**: Uygulama içi sözlüğü gözden geçir ve ara. Tam makaleyi açmak için bir girdiye tıkla.

### `settings.section_language`
- **de**: Sprache
- **en**: Language
- **el**: Γλώσσα
- **es**: Idioma
- **fr**: Langue
- **hi**: भाषा
- **id**: Bahasa
- **ja**: 言語
- **ko**: 언어
- **pt**: Idioma
- **tr**: Dil

### `settings.mode_title`
- **de**: Modus
- **en**: Mode
- **el**: Λειτουργία
- **es**: Modo
- **fr**: Mode
- **hi**: मोड
- **id**: Mode
- **ja**: モード
- **ko**: 모드
- **pt**: Modo
- **tr**: Mod

### `settings.mode_solo`
- **de**: Solo-Modus
- **en**: Solo Mode
- **el**: Ατομική λειτουργία
- **es**: Modo en solitario
- **fr**: Mode solo
- **hi**: एकल मोड
- **id**: Mode Solo
- **ja**: ソロモード
- **ko**: 솔로 모드
- **pt**: Modo individual
- **tr**: Tek kişilik mod

### `settings.mode_solo_desc`
- **de**: Lerne für dich selbst. Alle Funktionen verfügbar.
- **en**: Learn for yourself. All features available.
- **el**: Μάθε για τον εαυτό σου. Όλες οι λειτουργίες διαθέσιμες.
- **es**: Aprende para ti. Todas las funciones disponibles.
- **fr**: Apprends pour toi. Toutes les fonctionnalités disponibles.
- **hi**: अपने लिए सीखें। सभी सुविधाएँ उपलब्ध।
- **id**: Belajar untuk diri sendiri. Semua fitur tersedia.
- **ja**: 自分のために学ぶ。すべての機能が利用可能。
- **ko**: 스스로 학습합니다. 모든 기능을 사용할 수 있습니다.
- **pt**: Aprenda para si. Todos os recursos disponíveis.
- **tr**: Kendin için öğren. Tüm özellikler mevcut.

### `settings.mode_multiplayer`
- **de**: Mehrspieler-Modus
- **en**: Multiplayer Mode
- **el**: Λειτουργία πολλαπλών παικτών
- **es**: Modo multijugador
- **fr**: Mode multijoueur
- **hi**: मल्टीप्लेयर मोड
- **id**: Mode Multipemain
- **ja**: マルチプレイヤーモード
- **ko**: 멀티플레이어 모드
- **pt**: Modo multijogador
- **tr**: Çok oyunculu mod

### `settings.mode_multiplayer_desc`
- **de**: Ranglisten, Turniere, Freunde. Kommt in einer zukünftigen Version.
- **en**: Leaderboards, tournaments, friends. Coming in a future version.
- **el**: Πίνακες κατάταξης, τουρνουά, φίλοι. Έρχεται σε μελλοντική έκδοση.
- **es**: Clasificaciones, torneos, amigos. Próximamente en una versión futura.
- **fr**: Classements, tournois, amis. À venir dans une version future.
- **hi**: लीडरबोर्ड, टूर्नामेंट, मित्र। किसी भविष्य के संस्करण में आ रहा है।
- **id**: Papan peringkat, turnamen, teman. Hadir di versi mendatang.
- **ja**: ランキング、トーナメント、フレンド。将来のバージョンで登場。
- **ko**: 리더보드, 토너먼트, 친구. 향후 버전에서 제공됩니다.
- **pt**: Rankings, torneios, amigos. Em breve numa versão futura.
- **tr**: Skor tabloları, turnuvalar, arkadaşlar. Gelecek bir sürümde geliyor.

### `settings.mode_coming_soon`
- **de**: Kommt bald
- **en**: Coming Soon
- **el**: Έρχεται σύντομα
- **es**: Próximamente
- **fr**: Bientôt
- **hi**: जल्द आ रहा है
- **id**: Segera Hadir
- **ja**: 近日公開
- **ko**: 출시 예정
- **pt**: Em breve
- **tr**: Yakında

### `settings.section_provider`
- **de**: KI-Anbieter
- **en**: AI provider
- **el**: Πάροχος AI
- **es**: Proveedor de IA
- **fr**: Fournisseur IA
- **hi**: एआई प्रदाता
- **id**: Penyedia AI
- **ja**: AI プロバイダー
- **ko**: AI 제공자
- **pt**: Provedor de IA
- **tr**: YZ sağlayıcısı

### `settings.section_api_keys`
- **de**: API-Keys
- **en**: API keys
- **el**: Κλειδιά API
- **es**: Claves API
- **fr**: Cles API
- **hi**: एपीआई कुंजियाँ
- **id**: Kunci API
- **ja**: API キー
- **ko**: API 키
- **pt**: Chaves de API
- **tr**: API anahtarları

### `settings.section_danger`
- **de**: Konto
- **en**: Account
- **el**: Λογαριασμός
- **es**: Cuenta
- **fr**: Compte
- **hi**: खाता
- **id**: Akun
- **ja**: アカウント
- **ko**: 계정
- **pt**: Conta
- **tr**: Hesap

### `settings.section_ui`
- **de**: Oberfläche
- **en**: Interface
- **el**: Διεπαφή
- **es**: Interfaz
- **fr**: Interface
- **hi**: इंटरफ़ेस
- **id**: Antarmuka
- **ja**: インターフェース
- **ko**: 인터페이스
- **pt**: Interface
- **tr**: Arayüz

### `settings.section_appearance`
- **de**: Darstellung
- **en**: Appearance
- **el**: Εμφάνιση
- **es**: Apariencia
- **fr**: Apparence
- **hi**: रूप-रंग
- **id**: Tampilan
- **ja**: 外観
- **ko**: 외관
- **pt**: Aparencia
- **tr**: Gorunum

### `settings.content_view`
- **de**: Ansicht der Inhalte
- **en**: Content view
- **el**: Προβολή περιεχομένου
- **es**: Vista de contenidos
- **fr**: Affichage du contenu
- **hi**: सामग्री दृश्य
- **id**: Tampilan konten
- **ja**: コンテンツの表示
- **ko**: 콘텐츠 보기
- **pt**: Visualização de conteúdo
- **tr**: İçerik görünümü

### `settings.content_view_description`
- **de**: Wie heruntergeladene Inhalte in den Inhalte-Tabs angezeigt werden. Der Schnellumschalter in der Inhalte-Ansicht ändert dieselbe Einstellung.
- **en**: How downloaded content is shown across the content tabs. The quick toggle in the content view changes the same setting.
- **el**: Πώς εμφανίζεται το ληφθέν περιεχόμενο στις καρτέλες περιεχομένου. Η γρήγορη εναλλαγή στην προβολή περιεχομένου αλλάζει την ίδια ρύθμιση.
- **es**: Cómo se muestra el contenido descargado en las pestañas de contenido. El conmutador rápido de la vista de contenido cambia la misma opción.
- **fr**: Comment le contenu téléchargé est affiché dans les onglets de contenu. Le commutateur rapide de la vue de contenu modifie le même réglage.
- **hi**: डाउनलोड की गई सामग्री को सामग्री टैब में कैसे दिखाया जाए। सामग्री दृश्य में त्वरित टॉगल वही सेटिंग बदलता है।
- **id**: Bagaimana konten yang diunduh ditampilkan di seluruh tab konten. Sakelar cepat di tampilan konten mengubah pengaturan yang sama.
- **ja**: ダウンロードしたコンテンツをコンテンツタブでどのように表示するか。コンテンツ表示内のクイック切り替えも同じ設定を変更します。
- **ko**: 다운로드한 콘텐츠를 콘텐츠 탭에서 표시하는 방식입니다. 콘텐츠 보기의 빠른 전환도 동일한 설정을 변경합니다.
- **pt**: Como o conteúdo baixado é exibido nas abas de conteúdo. O alternador rápido na visualização de conteúdo altera a mesma configuração.
- **tr**: İndirilen içeriğin içerik sekmelerinde nasıl gösterileceği. İçerik görünümündeki hızlı geçiş aynı ayarı değiştirir.

### `settings.section_profile`
- **de**: Profil
- **en**: Profile
- **el**: Προφίλ
- **es**: Perfil
- **fr**: Profil
- **hi**: प्रोफ़ाइल
- **id**: Profil
- **ja**: プロフィール
- **ko**: 프로필
- **pt**: Perfil
- **tr**: Profil

### `settings.username_label`
- **de**: Anzeigename
- **en**: Display name
- **el**: Εμφανιζόμενο όνομα
- **es**: Nombre visible
- **fr**: Nom affiché
- **hi**: प्रदर्शित नाम
- **id**: Nama tampilan
- **ja**: 表示名
- **ko**: 표시 이름
- **pt**: Nome de exibição
- **tr**: Görünen ad

### `settings.username_placeholder`
- **de**: Dein Name
- **en**: Your name
- **el**: Το όνομά σου
- **es**: Tu nombre
- **fr**: Votre nom
- **hi**: आपका नाम
- **id**: Nama Anda
- **ja**: あなたの名前
- **ko**: 이름
- **pt**: O teu nome
- **tr**: Adınız

### `settings.username_save`
- **de**: Speichern
- **en**: Save
- **el**: Αποθήκευση
- **es**: Guardar
- **fr**: Enregistrer
- **hi**: सहेजें
- **id**: Simpan
- **ja**: 保存
- **ko**: 저장
- **pt**: Guardar
- **tr**: Kaydet

### `settings.username_empty`
- **de**: Der Name darf nicht leer sein.
- **en**: Name cannot be empty.
- **el**: Το όνομα δεν μπορεί να είναι κενό.
- **es**: El nombre no puede estar vacío.
- **fr**: Le nom ne peut pas être vide.
- **hi**: नाम खाली नहीं हो सकता।
- **id**: Nama tidak boleh kosong.
- **ja**: 名前を空にできません。
- **ko**: 이름은 비워둘 수 없습니다.
- **pt**: O nome não pode estar vazio.
- **tr**: Ad boş olamaz.

### `settings.avatar_upload`
- **de**: Bild hochladen
- **en**: Upload picture
- **el**: Μεταφόρτωση εικόνας
- **es**: Subir imagen
- **fr**: Importer une image
- **hi**: चित्र अपलोड करें
- **id**: Unggah gambar
- **ja**: 画像をアップロード
- **ko**: 사진 업로드
- **pt**: Carregar imagem
- **tr**: Resim yükle

### `settings.avatar_remove`
- **de**: Entfernen
- **en**: Remove
- **el**: Αφαίρεση
- **es**: Quitar
- **fr**: Retirer
- **hi**: निकालें
- **id**: Hapus
- **ja**: 削除
- **ko**: 제거
- **pt**: Remover
- **tr**: Kaldır

### `settings.avatar_crop_title`
- **de**: Bild anpassen
- **en**: Adjust your picture
- **el**: Προσαρμόστε την εικόνα σας
- **es**: Ajusta tu imagen
- **fr**: Ajustez votre photo
- **hi**: अपना चित्र समायोजित करें
- **id**: Sesuaikan gambar Anda
- **ja**: 画像を調整
- **ko**: 사진 조정
- **pt**: Ajuste a sua imagem
- **tr**: Resmini ayarla

### `settings.avatar_crop_instructions`
- **de**: Zum Verschieben ziehen, mit Scrollrad oder Fingern zoomen.
- **en**: Drag to reposition, scroll or pinch to zoom.
- **el**: Σύρετε για επανατοποθέτηση, κυλήστε ή τσιμπήστε για ζουμ.
- **es**: Arrastra para reposicionar, usa la rueda o pellizca para ampliar.
- **fr**: Faites glisser pour repositionner, molette ou pincement pour zoomer.
- **hi**: स्थान बदलने के लिए खींचें, ज़ूम के लिए स्क्रॉल या पिंच करें।
- **id**: Seret untuk memposisikan ulang, gulir atau cubit untuk memperbesar.
- **ja**: ドラッグして位置を調整、スクロールまたはピンチでズーム。
- **ko**: 드래그하여 위치를 옮기고, 스크롤하거나 핀치하여 확대/축소하세요.
- **pt**: Arraste para reposicionar, role ou faça pinça para ampliar.
- **tr**: Konumlandırmak için sürükle, yakınlaştırmak için kaydır veya parmaklarını kıstır.

### `settings.avatar_crop_apply`
- **de**: Übernehmen
- **en**: Apply
- **el**: Εφαρμογή
- **es**: Aplicar
- **fr**: Appliquer
- **hi**: लागू करें
- **id**: Terapkan
- **ja**: 適用
- **ko**: 적용
- **pt**: Aplicar
- **tr**: Uygula

### `settings.avatar_crop_cancel`
- **de**: Abbrechen
- **en**: Cancel
- **el**: Άκυρο
- **es**: Cancelar
- **fr**: Annuler
- **hi**: रद्द करें
- **id**: Batal
- **ja**: キャンセル
- **ko**: 취소
- **pt**: Cancelar
- **tr**: İptal

### `settings.avatar_crop_zoom`
- **de**: Zoom
- **en**: Zoom
- **el**: Ζουμ
- **es**: Zoom
- **fr**: Zoom
- **hi**: ज़ूम
- **id**: Perbesar
- **ja**: ズーム
- **ko**: 확대/축소
- **pt**: Zoom
- **tr**: Yakınlaştır

### `settings.avatar_preview_title`
- **de**: Profilbild
- **en**: Profile picture
- **el**: Εικόνα προφίλ
- **es**: Foto de perfil
- **fr**: Photo de profil
- **hi**: प्रोफ़ाइल चित्र
- **id**: Gambar profil
- **ja**: プロフィール画像
- **ko**: 프로필 사진
- **pt**: Foto de perfil
- **tr**: Profil resmi

### `settings.avatar_change`
- **de**: Bild ändern
- **en**: Change picture
- **el**: Αλλαγή εικόνας
- **es**: Cambiar foto
- **fr**: Changer la photo
- **hi**: चित्र बदलें
- **id**: Ubah gambar
- **ja**: 画像を変更
- **ko**: 사진 변경
- **pt**: Alterar foto
- **tr**: Resmi değiştir

### `settings.avatar_button_label`
- **de**: Profilbild ansehen oder ändern
- **en**: View or change profile picture
- **el**: Προβολή ή αλλαγή εικόνας προφίλ
- **es**: Ver o cambiar la foto de perfil
- **fr**: Voir ou changer la photo de profil
- **hi**: प्रोफ़ाइल चित्र देखें या बदलें
- **id**: Lihat atau ubah gambar profil
- **ja**: プロフィール画像を表示または変更
- **ko**: 프로필 사진 보기 또는 변경
- **pt**: Ver ou alterar a foto de perfil
- **tr**: Profil resmini görüntüle veya değiştir

### `settings.theme`
- **de**: Farbschema
- **en**: Theme
- **el**: Θέμα
- **es**: Tema
- **fr**: Thème
- **hi**: थीम
- **id**: Tema
- **ja**: テーマ
- **ko**: 테마
- **pt**: Tema
- **tr**: Tema

### `settings.theme_description`
- **de**: Lege fest, wie die App aussieht. Automatisch folgt der Hell-/Dunkel-Einstellung deines Systems.
- **en**: Choose how the app looks. Auto follows your system light/dark setting.
- **el**: Επίλεξε πώς φαίνεται η εφαρμογή. Το αυτόματο ακολουθεί τη ρύθμιση φωτεινό/σκούρο του συστήματος.
- **es**: Elige el aspecto de la aplicacion. Automatico sigue la configuracion clara/oscura del sistema.
- **fr**: Choisissez l'apparence de l'application. Auto suit le reglage clair/sombre du systeme.
- **hi**: चुनें कि ऐप कैसा दिखे। ऑटो आपके सिस्टम की लाइट/डार्क सेटिंग का पालन करता है।
- **id**: Pilih tampilan aplikasi. Otomatis mengikuti pengaturan terang/gelap sistem Anda.
- **ja**: アプリの見た目を選びます。自動はシステムのライト/ダーク設定に従います。
- **ko**: 앱의 모양을 선택하세요. 자동은 시스템의 밝게/어둡게 설정을 따릅니다.
- **pt**: Escolha a aparencia do aplicativo. Automatico segue a configuracao clara/escura do sistema.
- **tr**: Uygulamanin nasil gorunecegini secin. Otomatik, sisteminizin acik/koyu ayarini izler.

### `settings.theme_group_recommended`
- **de**: Empfohlen
- **en**: Recommended
- **el**: Προτεινόμενα
- **es**: Recomendados
- **fr**: Recommandés
- **hi**: अनुशंसित
- **id**: Direkomendasikan
- **ja**: おすすめ
- **ko**: 추천
- **pt**: Recomendados
- **tr**: Önerilen

### `settings.theme_group_classic`
- **de**: Klassisch
- **en**: Classic
- **el**: Κλασικά
- **es**: Clásicos
- **fr**: Classiques
- **hi**: क्लासिक
- **id**: Klasik
- **ja**: クラシック
- **ko**: 클래식
- **pt**: Clássicos
- **tr**: Klasik

### `settings.theme_groups`
- **de**: Theme-Gruppen
- **en**: Theme groups
- **el**: Ομάδες θεμάτων
- **es**: Grupos de temas
- **fr**: Groupes de thèmes
- **hi**: थीम समूह
- **id**: Grup tema
- **ja**: テーマグループ
- **ko**: 테마 그룹
- **pt**: Grupos de temas
- **tr**: Tema grupları

### `settings.tab_general`
- **de**: Allgemein
- **en**: General
- **el**: Γενικά
- **es**: General
- **fr**: Général
- **hi**: सामान्य
- **id**: Umum
- **ja**: 一般
- **ko**: 일반
- **pt**: Geral
- **tr**: Genel

### `settings.group_general`
- **de**: Allgemein
- **en**: General
- **el**: Γενικά
- **es**: General
- **fr**: Général
- **hi**: सामान्य
- **id**: Umum
- **ja**: 一般
- **ko**: 일반
- **pt**: Geral
- **tr**: Genel

### `settings.group_learning`
- **de**: Lernen & KI
- **en**: Learning & AI
- **el**: Μάθηση & AI
- **es**: Aprendizaje e IA
- **fr**: Apprentissage et IA
- **hi**: अधिगम और एआई
- **id**: Pembelajaran & AI
- **ja**: 学習と AI
- **ko**: 학습 & AI
- **pt**: Aprendizagem e IA
- **tr**: Öğrenme ve Yapay Zekâ

### `settings.group_data`
- **de**: Daten & Integrationen
- **en**: Data & integrations
- **el**: Δεδομένα & ενσωματώσεις
- **es**: Datos e integraciones
- **fr**: Données et intégrations
- **hi**: डेटा और एकीकरण
- **id**: Data & integrasi
- **ja**: データと連携
- **ko**: 데이터 & 연동
- **pt**: Dados e integrações
- **tr**: Veri ve entegrasyonlar

### `settings.group_info`
- **de**: Info
- **en**: Info
- **el**: Πληροφορίες
- **es**: Info
- **fr**: Infos
- **hi**: जानकारी
- **id**: Info
- **ja**: 情報
- **ko**: 정보
- **pt**: Info
- **tr**: Bilgi

### `settings.nav_aria`
- **de**: Einstellungs-Navigation
- **en**: Settings navigation
- **el**: Πλοήγηση ρυθμίσεων
- **es**: Navegación de ajustes
- **fr**: Navigation des paramètres
- **hi**: सेटिंग्स नेविगेशन
- **id**: Navigasi pengaturan
- **ja**: 設定ナビゲーション
- **ko**: 설정 탐색
- **pt**: Navegação de configurações
- **tr**: Ayarlar gezinmesi

### `settings.tab_ai`
- **de**: KI
- **en**: AI
- **el**: ΤΝ
- **es**: IA
- **fr**: IA
- **hi**: एआई
- **id**: AI
- **ja**: AI
- **ko**: AI
- **pt**: IA
- **tr**: Yapay zeka

### `settings.tab_learning`
- **de**: Lernen
- **en**: Learning
- **el**: Μάθηση
- **es**: Aprendizaje
- **fr**: Apprentissage
- **hi**: अधिगम
- **id**: Pembelajaran
- **ja**: 学習
- **ko**: 학습
- **pt**: Aprendizagem
- **tr**: Öğrenme

### `settings.tab_plugins`
- **de**: Plugins
- **en**: Plugins
- **el**: Πρόσθετα
- **es**: Complementos
- **fr**: Extensions
- **hi**: प्लगइन्स
- **id**: Plugin
- **ja**: プラグイン
- **ko**: 플러그인
- **pt**: Plugins
- **tr**: Eklentiler

### `settings.tab_data`
- **de**: Daten
- **en**: Data
- **el**: Δεδομένα
- **es**: Datos
- **fr**: Données
- **hi**: डेटा
- **id**: Data
- **ja**: データ
- **ko**: 데이터
- **pt**: Dados
- **tr**: Veri

### `settings.tab_help`
- **de**: Hilfe
- **en**: Help
- **el**: Βοήθεια
- **es**: Ayuda
- **fr**: Aide
- **hi**: सहायता
- **id**: Bantuan
- **ja**: ヘルプ
- **ko**: 도움말
- **pt**: Ajuda
- **tr**: Yardım

### `settings.tab_about`
- **de**: Über
- **en**: About
- **el**: Σχετικά
- **es**: Acerca de
- **fr**: À propos
- **hi**: परिचय
- **id**: Tentang
- **ja**: 情報
- **ko**: 정보
- **pt**: Sobre
- **tr**: Hakkında

### `settings.tabs_aria`
- **de**: Einstellungsbereiche
- **en**: Settings sections
- **el**: Ενότητες ρυθμίσεων
- **es**: Secciones de ajustes
- **fr**: Sections des paramètres
- **hi**: सेटिंग्स अनुभाग
- **id**: Bagian pengaturan
- **ja**: 設定セクション
- **ko**: 설정 섹션
- **pt**: Seções de configurações
- **tr**: Ayar bölümleri

### `settings.section_feedback`
- **de**: Feedback
- **en**: Feedback
- **el**: Ανατροφοδότηση
- **es**: Comentarios
- **fr**: Retour
- **hi**: प्रतिक्रिया
- **id**: Umpan balik
- **ja**: フィードバック
- **ko**: 피드백
- **pt**: Feedback
- **tr**: Geri bildirim

### `settings.section_interaction`
- **de**: Interaktion
- **en**: Interaction
- **el**: Αλληλεπίδραση
- **es**: Interacción
- **fr**: Interaction
- **hi**: अंतःक्रिया
- **id**: Interaksi
- **ja**: 操作
- **ko**: 상호작용
- **pt**: Interação
- **tr**: Etkileşim

### `settings.missions_title`
- **de**: Tägliche Missionen
- **en**: Daily Missions
- **el**: Καθημερινές αποστολές
- **es**: Misiones diarias
- **fr**: Missions quotidiennes
- **hi**: दैनिक मिशन
- **id**: Misi Harian
- **ja**: デイリーミッション
- **ko**: 일일 미션
- **pt**: Missões diárias
- **tr**: Günlük görevler

### `settings.missions_enabled`
- **de**: Tägliche Missionen
- **en**: Daily missions
- **el**: Καθημερινές αποστολές
- **es**: Misiones diarias
- **fr**: Missions quotidiennes
- **hi**: दैनिक मिशन
- **id**: Misi harian
- **ja**: デイリーミッション
- **ko**: 일일 미션
- **pt**: Missões diárias
- **tr**: Günlük görevler

### `settings.missions_enabled_hint`
- **de**: Zeigt jeden Tag ein paar erreichbare Ziele auf der Startseite. Optional - die App funktioniert auch ohne sie.
- **en**: Show a few achievable goals on the Dashboard each day. Optional - the app works the same without them.
- **el**: Εμφανίζει λίγους εφικτούς στόχους στον πίνακα κάθε μέρα. Προαιρετικό - η εφαρμογή λειτουργεί το ίδιο χωρίς αυτές.
- **es**: Muestra cada día unos objetivos alcanzables en el panel. Opcional: la app funciona igual sin ellas.
- **fr**: Affiche chaque jour quelques objectifs atteignables sur le tableau de bord. Facultatif : l'app fonctionne sans.
- **hi**: हर दिन डैशबोर्ड पर कुछ हासिल करने योग्य लक्ष्य दिखाएँ। वैकल्पिक - इनके बिना भी ऐप वैसे ही काम करता है।
- **id**: Tampilkan beberapa sasaran yang dapat dicapai di Dasbor setiap hari. Opsional - aplikasi bekerja sama tanpanya.
- **ja**: 毎日、達成可能な目標をダッシュボードに表示します。任意 - なくてもアプリは同じように動作します。
- **ko**: 매일 대시보드에 달성 가능한 목표 몇 가지를 표시합니다. 선택 사항이며 없어도 앱은 동일하게 작동합니다.
- **pt**: Mostra alguns objetivos alcançáveis no painel a cada dia. Opcional - o app funciona igual sem elas.
- **tr**: Her gün panoda birkaç ulaşılabilir hedef gösterir. İsteğe bağlı - uygulama bunlarsız da aynı çalışır.

### `settings.missions_count`
- **de**: Missionen pro Tag
- **en**: Missions per day
- **el**: Αποστολές ανά ημέρα
- **es**: Misiones por día
- **fr**: Missions par jour
- **hi**: प्रति दिन मिशन
- **id**: Misi per hari
- **ja**: 1日のミッション数
- **ko**: 하루 미션 수
- **pt**: Missões por dia
- **tr**: Günlük görev sayısı

### `settings.missions_difficulty`
- **de**: Schwierigkeitsmix
- **en**: Difficulty mix
- **el**: Μείγμα δυσκολίας
- **es**: Mezcla de dificultad
- **fr**: Mélange de difficulté
- **hi**: कठिनाई मिश्रण
- **id**: Campuran kesulitan
- **ja**: 難易度の構成
- **ko**: 난이도 구성
- **pt**: Mistura de dificuldade
- **tr**: Zorluk karışımı

### `settings.missions_difficulty_balanced`
- **de**: Ausgewogen
- **en**: Balanced
- **el**: Ισορροπημένο
- **es**: Equilibrada
- **fr**: Équilibré
- **hi**: संतुलित
- **id**: Seimbang
- **ja**: バランス
- **ko**: 균형
- **pt**: Equilibrada
- **tr**: Dengeli

### `settings.missions_difficulty_easy`
- **de**: Einfach
- **en**: Easy
- **el**: Εύκολο
- **es**: Fácil
- **fr**: Facile
- **hi**: आसान
- **id**: Mudah
- **ja**: やさしい
- **ko**: 쉬움
- **pt**: Fácil
- **tr**: Kolay

### `settings.missions_difficulty_challenging`
- **de**: Anspruchsvoll
- **en**: Challenging
- **el**: Απαιτητικό
- **es**: Exigente
- **fr**: Exigeant
- **hi**: चुनौतीपूर्ण
- **id**: Menantang
- **ja**: 高難度
- **ko**: 도전적
- **pt**: Desafiadora
- **tr**: Zorlu

### `settings.missions_reset`
- **de**: Heutige Missionen zurücksetzen
- **en**: Reset today's missions
- **el**: Επαναφορά σημερινών αποστολών
- **es**: Restablecer las misiones de hoy
- **fr**: Réinitialiser les missions du jour
- **hi**: आज के मिशन रीसेट करें
- **id**: Atur ulang misi hari ini
- **ja**: 今日のミッションをリセット
- **ko**: 오늘의 미션 초기화
- **pt**: Redefinir missões de hoje
- **tr**: Bugünün görevlerini sıfırla

### `settings.missions_reset_confirm`
- **de**: Zurücksetzen bestätigen
- **en**: Confirm reset
- **el**: Επιβεβαίωση
- **es**: Confirmar
- **fr**: Confirmer
- **hi**: रीसेट की पुष्टि करें
- **id**: Konfirmasi atur ulang
- **ja**: 確認
- **ko**: 초기화 확인
- **pt**: Confirmar
- **tr**: Onayla

### `settings.missions_reset_done`
- **de**: Heutige Missionen neu gemischt.
- **en**: Today's missions reshuffled.
- **el**: Οι σημερινές αποστολές ανανεώθηκαν.
- **es**: Misiones de hoy regeneradas.
- **fr**: Missions du jour régénérées.
- **hi**: आज के मिशन फिर से बदल दिए गए।
- **id**: Misi hari ini diacak ulang.
- **ja**: 今日のミッションを再生成しました。
- **ko**: 오늘의 미션이 다시 섞였습니다.
- **pt**: Missões de hoje recriadas.
- **tr**: Bugünün görevleri yenilendi.

### `settings.missions_reset_failed`
- **de**: Missionen konnten nicht zurückgesetzt werden.
- **en**: Could not reset missions.
- **el**: Αδυναμία επαναφοράς αποστολών.
- **es**: No se pudieron restablecer las misiones.
- **fr**: Impossible de réinitialiser les missions.
- **hi**: मिशन रीसेट नहीं हो सके।
- **id**: Tidak dapat mengatur ulang misi.
- **ja**: ミッションをリセットできませんでした。
- **ko**: 미션을 초기화할 수 없었습니다.
- **pt**: Não foi possível redefinir as missões.
- **tr**: Görevler sıfırlanamadı.

### `settings.gestures`
- **de**: Wischgesten
- **en**: Swipe Gestures
- **el**: Κινήσεις σάρωσης
- **es**: Gestos de deslizamiento
- **fr**: Gestes de balayage
- **hi**: स्वाइप जेस्चर
- **id**: Gestur Geser
- **ja**: スワイプジェスチャー
- **ko**: 스와이프 제스처
- **pt**: Gestos de deslizar
- **tr**: Kaydırma Hareketleri

### `settings.gestures_description`
- **de**: Wischen zum Navigieren in Assessment, Session und Curriculum.
- **en**: Swipe to navigate in Assessment, Session, and Curriculum.
- **el**: Σαρώστε για πλοήγηση στην Αξιολόγηση, τη Συνεδρία και το Πρόγραμμα σπουδών.
- **es**: Desliza para navegar en Evaluación, Sesión y Plan de estudios.
- **fr**: Balayez pour naviguer dans l’Évaluation, la Session et le Programme.
- **hi**: मूल्यांकन, सत्र और पाठ्यक्रम में नेविगेट करने के लिए स्वाइप करें।
- **id**: Geser untuk menavigasi di Asesmen, Sesi, dan Kurikulum.
- **ja**: 評価、セッション、カリキュラムをスワイプして移動します。
- **ko**: 평가, 세션, 커리큘럼에서 스와이프로 이동합니다.
- **pt**: Deslize para navegar na Avaliação, Sessão e Currículo.
- **tr**: Değerlendirme, Oturum ve Müfredat'ta gezinmek için kaydır.

### `settings.profile_title`
- **de**: Lernprofil
- **en**: Learning profile
- **el**: Προφίλ μάθησης
- **es**: Perfil de aprendizaje
- **fr**: Profil d'apprentissage
- **hi**: अधिगम प्रोफ़ाइल
- **id**: Profil pembelajaran
- **ja**: 学習プロファイル
- **ko**: 학습 프로필
- **pt**: Perfil de aprendizagem
- **tr**: Öğrenme profili

### `settings.profile_resume`
- **de**: Lernprofil fortsetzen
- **en**: Continue learning profile
- **el**: Συνέχεια προφίλ μάθησης
- **es**: Continuar perfil de aprendizaje
- **fr**: Continuer le profil d'apprentissage
- **hi**: अधिगम प्रोफ़ाइल जारी रखें
- **id**: Lanjutkan profil pembelajaran
- **ja**: 学習プロファイルを続ける
- **ko**: 학습 프로필 계속하기
- **pt**: Continuar perfil de aprendizagem
- **tr**: Öğrenme profiline devam et

### `settings.profile_redo`
- **de**: Lernprofil erneut machen
- **en**: Retake learning profile
- **el**: Επανάληψη προφίλ μάθησης
- **es**: Rehacer perfil de aprendizaje
- **fr**: Refaire le profil d'apprentissage
- **hi**: अधिगम प्रोफ़ाइल फिर से लें
- **id**: Ulangi profil pembelajaran
- **ja**: 学習プロファイルをやり直す
- **ko**: 학습 프로필 다시 받기
- **pt**: Refazer perfil de aprendizagem
- **tr**: Öğrenme profilini yeniden yap

### `settings.profile_create`
- **de**: Lernprofil erstellen
- **en**: Create learning profile
- **el**: Δημιουργία προφίλ μάθησης
- **es**: Crear perfil de aprendizaje
- **fr**: Créer le profil d'apprentissage
- **hi**: अधिगम प्रोफ़ाइल बनाएँ
- **id**: Buat profil pembelajaran
- **ja**: 学習プロファイルを作成
- **ko**: 학습 프로필 만들기
- **pt**: Criar perfil de aprendizagem
- **tr**: Öğrenme profili oluştur

### `settings.profile_incomplete_hint`
- **de**: Du hast eine unvollständige Einstufung.
- **en**: You have an unfinished assessment.
- **el**: Έχετε μια ημιτελή αξιολόγηση.
- **es**: Tienes una evaluación sin terminar.
- **fr**: Vous avez une évaluation inachevée.
- **hi**: आपके पास एक अधूरा मूल्यांकन है।
- **id**: Anda memiliki asesmen yang belum selesai.
- **ja**: 未完了の診断があります。
- **ko**: 완료하지 않은 평가가 있습니다.
- **pt**: Você tem uma avaliação inacabada.
- **tr**: Tamamlanmamış bir değerlendirmeniz var.

### `settings.profile_redo_hint`
- **de**: Mache die Einstufung erneut, um dein Lernprofil zu aktualisieren.
- **en**: Retake the assessment to update your learning profile.
- **el**: Επαναλάβετε την αξιολόγηση για να ενημερώσετε το προφίλ μάθησής σας.
- **es**: Rehaz la evaluación para actualizar tu perfil de aprendizaje.
- **fr**: Refaites l'évaluation pour mettre à jour votre profil d'apprentissage.
- **hi**: अपनी लर्निंग प्रोफ़ाइल अपडेट करने के लिए मूल्यांकन फिर से दें।
- **id**: Ulangi asesmen untuk memperbarui profil pembelajaran Anda.
- **ja**: 学習プロファイルを更新するには診断をやり直してください。
- **ko**: 평가를 다시 받아 학습 프로필을 업데이트하세요.
- **pt**: Refaça a avaliação para atualizar o seu perfil de aprendizagem.
- **tr**: Öğrenme profilinizi güncellemek için değerlendirmeyi yeniden yapın.

### `settings.profile_create_hint`
- **de**: Mach eine kurze Einstufung für ein persönliches Lernprofil.
- **en**: Take a short assessment to get a personalised learning profile.
- **el**: Κάντε μια σύντομη αξιολόγηση για ένα εξατομικευμένο προφίλ μάθησης.
- **es**: Haz una breve evaluación para obtener un perfil de aprendizaje personalizado.
- **fr**: Faites une courte évaluation pour obtenir un profil d'apprentissage personnalisé.
- **hi**: वैयक्तिकृत लर्निंग प्रोफ़ाइल पाने के लिए एक छोटा मूल्यांकन दें।
- **id**: Ikuti asesmen singkat untuk mendapatkan profil pembelajaran yang dipersonalisasi.
- **ja**: 短い診断を受けて、パーソナライズされた学習プロファイルを取得しましょう。
- **ko**: 짧은 평가를 받아 개인 맞춤 학습 프로필을 얻으세요.
- **pt**: Faça uma breve avaliação para obter um perfil de aprendizagem personalizado.
- **tr**: Kişiselleştirilmiş bir öğrenme profili için kısa bir değerlendirme yapın.

### `settings.lesson_shortcuts`
- **de**: Tastenkürzel in Lektionen
- **en**: Lesson keyboard shortcuts
- **el**: Συντομεύσεις πληκτρολογίου στα μαθήματα
- **es**: Atajos de teclado en las lecciones
- **fr**: Raccourcis clavier dans les leçons
- **hi**: पाठ कीबोर्ड शॉर्टकट
- **id**: Pintasan papan ketik pelajaran
- **ja**: レッスンのキーボードショートカット
- **ko**: 레슨 키보드 단축키
- **pt**: Atalhos de teclado nas lições
- **tr**: Derslerde klavye kısayolları

### `settings.lesson_shortcuts_description`
- **de**: Drücke die Eingabetaste, um deine Antwort zu prüfen, und erneut, um zum nächsten Schritt zu gehen.
- **en**: Press Enter to check your answer, then Enter again to go to the next step.
- **el**: Πατήστε Enter για να ελέγξετε την απάντησή σας και ξανά Enter για να προχωρήσετε στο επόμενο βήμα.
- **es**: Pulsa Enter para comprobar tu respuesta y Enter de nuevo para ir al siguiente paso.
- **fr**: Appuyez sur Entrée pour vérifier votre réponse, puis à nouveau pour passer à l'étape suivante.
- **hi**: अपना उत्तर जाँचने के लिए Enter दबाएँ, फिर अगले चरण पर जाने के लिए दोबारा Enter दबाएँ।
- **id**: Tekan Enter untuk memeriksa jawaban Anda, lalu Enter lagi untuk ke langkah berikutnya.
- **ja**: Enterキーで回答を確認し、もう一度Enterキーで次のステップに進みます。
- **ko**: Enter를 눌러 답을 확인하고, 다시 Enter를 눌러 다음 단계로 이동하세요.
- **pt**: Pressione Enter para verificar a sua resposta e Enter novamente para ir para o próximo passo.
- **tr**: Cevabınızı kontrol etmek için Enter'a, sonraki adıma geçmek için tekrar Enter'a basın.

### `settings.button_tooltips`
- **de**: Button-Tooltips anzeigen
- **en**: Show button tooltips
- **el**: Εμφάνιση επεξηγήσεων κουμπιών
- **es**: Mostrar descripciones de botones
- **fr**: Afficher les infobulles des boutons
- **hi**: बटन टूलटिप दिखाएँ
- **id**: Tampilkan tooltip tombol
- **ja**: ボタンのツールチップを表示
- **ko**: 버튼 툴팁 표시
- **pt**: Mostrar dicas dos botões
- **tr**: Buton ipuçlarını göster

### `settings.button_tooltips_description`
- **de**: Zeigt beim Überfahren von Icon-Buttons einen Tooltip mit der Funktion. Screenreader-Beschriftungen bleiben unabhängig davon immer aktiv.
- **en**: Show a hover tooltip on icon buttons explaining what they do. Screen-reader labels stay on regardless.
- **el**: Εμφάνιση επεξήγησης κατά την αιώρηση πάνω σε εικονίδια-κουμπιά. Οι ετικέτες αναγνώστη οθόνης παραμένουν ενεργές ανεξάρτητα.
- **es**: Muestra una descripción al pasar el cursor sobre los botones de iconos. Las etiquetas para lectores de pantalla siguen activas igualmente.
- **fr**: Affiche une infobulle au survol des boutons à icône. Les libellés pour lecteurs d’écran restent actifs quoi qu’il arrive.
- **hi**: आइकन बटनों पर होवर टूलटिप दिखाएँ जो बताए कि वे क्या करते हैं। स्क्रीन-रीडर लेबल वैसे भी चालू रहते हैं।
- **id**: Tampilkan tooltip arahkan kursor pada tombol ikon yang menjelaskan fungsinya. Label pembaca layar tetap aktif terlepas dari ini.
- **ja**: アイコンボタンにカーソルを合わせたとき、その機能を説明するツールチップを表示します。スクリーンリーダー用のラベルは、この設定に関わらず常に有効です。
- **ko**: 아이콘 버튼 위에 마우스를 올리면 기능을 설명하는 툴팁을 표시합니다. 화면 낭독기 레이블은 관계없이 항상 유지됩니다.
- **pt**: Mostra uma dica ao passar o cursor sobre botões com ícones explicando o que fazem. As legendas para leitores de ecrã permanecem ativas independentemente.
- **tr**: Simge butonlarının üzerine gelindiğinde ne yaptıklarını açıklayan bir ipucu gösterir. Ekran okuyucu etiketleri ayardan bağımsız olarak her zaman açık kalır.

### `settings.developer_mode`
- **de**: Entwicklermodus
- **en**: Developer Mode
- **el**: Λειτουργία προγραμματιστή
- **es**: Modo Desarrollador
- **fr**: Mode développeur
- **hi**: डेवलपर मोड
- **id**: Mode Pengembang
- **ja**: 開発者モード
- **ko**: 개발자 모드
- **pt**: Modo desenvolvedor
- **tr**: Geliştirici Modu

### `settings.developer_mode_description`
- **de**: Zeigt vollständige technische Details (Statuscode, Endpunkt, Stack-Trace) in Fehlermeldungen. Bei aktivem Modus erscheint ein 'DEV'-Hinweis in der Navigationsleiste. Standardmäßig aus; nur zum Debugging einschalten.
- **en**: Show full technical detail (status code, endpoint, stack trace) in error toasts. A 'DEV' badge appears in the navigation bar while this is on. Off by default; opt-in for debugging.
- **el**: Εμφανίζει όλες τις τεχνικές λεπτομέρειες (κωδικός κατάστασης, endpoint, ίχνος στοίβας) στα μηνύματα σφάλματος. Όταν είναι ενεργό, εμφανίζεται μια ένδειξη 'DEV' στη γραμμή πλοήγησης. Απενεργοποιημένο από προεπιλογή· ενεργοποιήστε το μόνο για αποσφαλμάτωση.
- **es**: Muestra todos los detalles técnicos (código de estado, endpoint, traza) en los avisos de error. Aparece una etiqueta 'DEV' en la barra de navegación mientras está activo. Desactivado por defecto; actívalo solo para depurar.
- **fr**: Affiche tous les détails techniques (code d'état, point de terminaison, trace) dans les notifications d'erreur. Un badge 'DEV' apparaît dans la barre de navigation. Désactivé par défaut ; activez-le uniquement pour le débogage.
- **hi**: एरर टोस्ट में पूरा तकनीकी विवरण (स्टेटस कोड, एंडपॉइंट, स्टैक ट्रेस) दिखाएँ। यह चालू रहने पर नेविगेशन बार में एक 'DEV' बैज दिखता है। डिफ़ॉल्ट रूप से बंद; डिबगिंग के लिए ऑप्ट-इन।
- **id**: Tampilkan detail teknis lengkap (kode status, titik akhir, jejak tumpukan) dalam toast kesalahan. Lencana 'DEV' muncul di bilah navigasi saat ini aktif. Nonaktif secara bawaan; ikut serta untuk debugging.
- **ja**: エラー通知に技術的な詳細（ステータスコード、エンドポイント、スタックトレース）をすべて表示します。有効中はナビゲーションバーに 'DEV' バッジが表示されます。既定は無効。デバッグ用にのみ有効化してください。
- **ko**: 오류 알림에 전체 기술 정보(상태 코드, 엔드포인트, 스택 트레이스)를 표시합니다. 이 기능이 켜져 있는 동안 탐색 막대에 'DEV' 배지가 나타납니다. 기본값은 꺼짐이며, 디버깅용으로 선택해 사용하세요.
- **pt**: Mostra todos os detalhes técnicos (código de estado, endpoint, rastreio) nas notificações de erro. Aparece uma etiqueta 'DEV' na barra de navegação enquanto estiver ativo. Desativado por defeito; ativar apenas para depuração.
- **tr**: Hata bildirimlerinde tüm teknik ayrıntıları (durum kodu, uç nokta, yığın izi) gösterir. Etkinken gezinme çubuğunda 'DEV' rozeti görünür. Varsayılan olarak kapalı; yalnızca hata ayıklama için açın.

### `settings.feedback_intensity`
- **de**: Feedback-Intensität
- **en**: Feedback Intensity
- **el**: Ένταση ανατροφοδότησης
- **es**: Intensidad del feedback
- **fr**: Intensité du retour
- **hi**: फ़ीडबैक तीव्रता
- **id**: Intensitas Umpan Balik
- **ja**: フィードバックの強さ
- **ko**: 피드백 강도
- **pt**: Intensidade do feedback
- **tr**: Geri bildirim yoğunluğu

### `settings.feedback_intensity_description`
- **de**: Wie ausgiebig die App deinen Fortschritt feiert.
- **en**: How loudly the app celebrates your progress.
- **el**: Πόσο έντονα γιορτάζει η εφαρμογή την πρόοδό σας.
- **es**: Con cuánta efusividad celebra la app tu progreso.
- **fr**: À quel point l'application célèbre vos progrès.
- **hi**: ऐप आपकी प्रगति का कितने ज़ोर से जश्न मनाता है।
- **id**: Seberapa meriah aplikasi merayakan kemajuan Anda.
- **ja**: アプリがあなたの進歩をどれだけ盛大に祝うか。
- **ko**: 앱이 당신의 진행을 얼마나 크게 축하할지 정합니다.
- **pt**: Com quanta efusividade o app celebra o seu progresso.
- **tr**: Uygulamanın ilerlemeni ne kadar coşkuyla kutladığı.

### `settings.feedback_intensity_subtle`
- **de**: Dezent
- **en**: Subtle
- **el**: Διακριτικό
- **es**: Discreto
- **fr**: Discret
- **hi**: सूक्ष्म
- **id**: Halus
- **ja**: 控えめ
- **ko**: 은은하게
- **pt**: Discreto
- **tr**: Sade

### `settings.feedback_intensity_subtle_desc`
- **de**: Nur die Richtig/Falsch-Farbe. Keine Phrasen, kein Konfetti, keine Meilenstein-Einblendungen.
- **en**: Only the correct/wrong colour. No phrases, confetti, or milestone overlays.
- **el**: Μόνο το χρώμα σωστού/λάθους. Χωρίς φράσεις, κομφετί ή ειδοποιήσεις οροσήμων.
- **es**: Solo el color de acierto/error. Sin frases, confeti ni avisos de hitos.
- **fr**: Seulement la couleur correct/incorrect. Aucune phrase, aucun confetti, aucune annonce de jalon.
- **hi**: केवल सही/गलत का रंग। कोई वाक्यांश, कन्फ़ेटी, या माइलस्टोन ओवरले नहीं।
- **id**: Hanya warna benar/salah. Tanpa frasa, konfeti, atau hamparan tonggak pencapaian.
- **ja**: 正誤の色のみ。フレーズ、紙吹雪、マイルストーン表示なし。
- **ko**: 정답/오답 색상만 표시합니다. 문구, 컨페티, 마일스톤 오버레이는 없습니다.
- **pt**: Apenas a cor de certo/errado. Sem frases, confete ou avisos de marcos.
- **tr**: Yalnızca doğru/yanlış rengi. İfade, konfeti veya kilometre taşı bildirimi yok.

### `settings.feedback_intensity_normal`
- **de**: Normal
- **en**: Normal
- **el**: Κανονικό
- **es**: Normal
- **fr**: Normale
- **hi**: सामान्य
- **id**: Normal
- **ja**: 標準
- **ko**: 보통
- **pt**: Normal
- **tr**: Normal

### `settings.feedback_intensity_normal_desc`
- **de**: Animationen, Lob-Phrasen und Konfetti bei voller Punktzahl.
- **en**: Animations, praise phrases, and confetti on a perfect score.
- **el**: Κινήσεις, φράσεις επιβράβευσης και κομφετί σε τέλειο σκορ.
- **es**: Animaciones, frases de elogio y confeti con puntuación perfecta.
- **fr**: Animations, phrases d'encouragement et confettis pour un score parfait.
- **hi**: एनिमेशन, प्रशंसा वाक्य, और पूर्ण स्कोर पर कन्फ़ेटी।
- **id**: Animasi, frasa pujian, dan konfeti pada skor sempurna.
- **ja**: アニメーション、称賛フレーズ、満点での紙吹雪。
- **ko**: 애니메이션, 칭찬 문구, 만점 시 컨페티를 표시합니다.
- **pt**: Animações, frases de elogio e confete em pontuação perfeita.
- **tr**: Animasyonlar, övgü ifadeleri ve tam puanda konfeti.

### `settings.feedback_intensity_enthusiastic`
- **de**: Ausführlich
- **en**: Enthusiastic
- **el**: Ενθουσιώδες
- **es**: Entusiasta
- **fr**: Enthousiaste
- **hi**: उत्साही
- **id**: Antusias
- **ja**: にぎやか
- **ko**: 열정적으로
- **pt**: Entusiasmado
- **tr**: Coşkulu

### `settings.feedback_intensity_enthusiastic_desc`
- **de**: Alles, plus Meilenstein-Einblendungen und Lob bei jeder richtigen Antwort.
- **en**: Everything, plus milestone overlays and praise on every correct answer.
- **el**: Τα πάντα, συν ειδοποιήσεις οροσήμων και επιβράβευση σε κάθε σωστή απάντηση.
- **es**: Todo, además de avisos de hitos y elogio en cada respuesta correcta.
- **fr**: Tout, plus les annonces de jalons et un encouragement à chaque bonne réponse.
- **hi**: सब कुछ, साथ ही माइलस्टोन ओवरले और हर सही उत्तर पर प्रशंसा।
- **id**: Semuanya, ditambah hamparan tonggak pencapaian dan pujian pada setiap jawaban benar.
- **ja**: すべて、さらにマイルストーン表示と正解ごとの称賛。
- **ko**: 모든 것에 더해 마일스톤 오버레이와 모든 정답 시 칭찬을 표시합니다.
- **pt**: Tudo, mais avisos de marcos e elogio a cada resposta correta.
- **tr**: Her şey, ayrıca kilometre taşı bildirimleri ve her doğru yanıtta övgü.

### `settings.feedback_intensity_reduced_motion_hint`
- **de**: In deinem System ist 'Bewegung reduzieren' aktiv, daher bleibt das Feedback unabhängig von dieser Einstellung dezent.
- **en**: Reduced-motion is on in your system, so feedback is kept subtle regardless of this setting.
- **el**: Στο σύστημά σας είναι ενεργή η μειωμένη κίνηση, οπότε η ανατροφοδότηση παραμένει διακριτική.
- **es**: Tu sistema tiene activado 'reducir movimiento', así que el feedback se mantiene discreto.
- **fr**: Le mode 'réduire les animations' est actif sur votre système ; le retour reste donc discret.
- **hi**: आपके सिस्टम में कम-गति (reduced-motion) चालू है, इसलिए इस सेटिंग के बावजूद फ़ीडबैक संयमित रखा जाता है।
- **id**: Gerakan-tereduksi aktif di sistem Anda, jadi umpan balik tetap halus terlepas dari pengaturan ini.
- **ja**: システムで「視差効果を減らす」が有効なため、この設定に関わらずフィードバックは控えめになります。
- **ko**: 시스템에서 모션 줄이기가 켜져 있어, 이 설정과 관계없이 피드백이 은은하게 유지됩니다.
- **pt**: Seu sistema está com 'reduzir movimento' ativo, então o feedback permanece discreto.
- **tr**: Sisteminde 'hareketi azalt' açık, bu yüzden geri bildirim bu ayardan bağımsız olarak sade kalır.

### `settings.sounds`
- **de**: Töne
- **en**: Sounds
- **el**: Ήχοι
- **es**: Sonidos
- **fr**: Sons
- **hi**: ध्वनियाँ
- **id**: Suara
- **ja**: サウンド
- **ko**: 소리
- **pt**: Sons
- **tr**: Sesler

### `settings.sounds_description`
- **de**: Kurze synthetische Klänge bei richtigen Antworten, Sternen und Meilensteinen. Standardmäßig aus; Töne enthalten nie Informationen, die nicht auch sichtbar sind.
- **en**: Play short synthesized chimes on correct answers, stars, and milestones. Off by default; sounds never carry information that isn't also shown.
- **el**: Αναπαραγωγή σύντομων συνθετικών ήχων σε σωστές απαντήσεις, αστέρια και ορόσημα. Απενεργοποιημένο από προεπιλογή· οι ήχοι δεν μεταφέρουν ποτέ πληροφορίες που δεν εμφανίζονται και οπτικά.
- **es**: Reproduce breves sonidos sintetizados en aciertos, estrellas e hitos. Desactivado por defecto; los sonidos nunca aportan información que no se muestre también.
- **fr**: Joue de brefs sons synthétisés sur les bonnes réponses, les étoiles et les jalons. Désactivé par défaut ; les sons n'apportent jamais d'information non affichée.
- **hi**: सही उत्तरों, सितारों, और माइलस्टोन पर छोटी सिंथेसाइज़्ड घंटियाँ बजाएँ। डिफ़ॉल्ट रूप से बंद; ध्वनियाँ कभी ऐसी जानकारी नहीं देतीं जो दिखाई भी न देती हो।
- **id**: Mainkan dentingan tersintesis singkat pada jawaban benar, bintang, dan tonggak pencapaian. Nonaktif secara bawaan; suara tidak pernah membawa informasi yang tidak juga ditampilkan.
- **ja**: 正解、スター、マイルストーンで短い合成音を鳴らします。既定はオフ。音は視覚的に示されない情報を伝えることはありません。
- **ko**: 정답, 별, 마일스톤에서 짧은 합성 차임을 재생합니다. 기본값은 꺼짐이며, 소리는 화면에도 함께 표시되지 않는 정보를 결코 전달하지 않습니다.
- **pt**: Reproduz breves sons sintetizados em acertos, estrelas e marcos. Desativado por padrão; os sons nunca trazem informações que não sejam também exibidas.
- **tr**: Doğru yanıtlarda, yıldızlarda ve kilometre taşlarında kısa sentezlenmiş sesler çalar. Varsayılan olarak kapalı; sesler asla gösterilmeyen bir bilgi taşımaz.

### `settings.sounds_volume`
- **de**: Lautstärke
- **en**: Volume
- **el**: Ένταση
- **es**: Volumen
- **fr**: Volume
- **hi**: वॉल्यूम
- **id**: Volume
- **ja**: 音量
- **ko**: 음량
- **pt**: Volume
- **tr**: Ses düzeyi

### `settings.sounds_test`
- **de**: Test
- **en**: Test
- **el**: Δοκιμή
- **es**: Probar
- **fr**: Tester
- **hi**: परीक्षण
- **id**: Uji
- **ja**: テスト
- **ko**: 테스트
- **pt**: Testar
- **tr**: Dene

### `settings.section_storage_mode`
- **de**: Speicher-Modus
- **en**: Storage mode
- **el**: Λειτουργία αποθήκευσης
- **es**: Modo de almacenamiento
- **fr**: Mode de stockage
- **hi**: संग्रहण मोड
- **id**: Mode penyimpanan
- **ja**: ストレージモード
- **ko**: 저장소 모드
- **pt**: Modo de armazenamento
- **tr**: Depolama modu

### `settings.storage_mode_help`
- **de**: Waehle, wo deine Daten liegen. Lokal speichert alles in diesem Browser; Server verbindet sich mit dem AdaptiveLearner-Backend.
- **en**: Choose where your data lives. Local mode keeps everything in this browser; Server mode talks to the AdaptiveLearner backend.
- **el**: Διάλεξε πού ζουν τα δεδομένα σου. Η τοπική λειτουργία κρατά τα πάντα σε αυτόν τον περιηγητή· η λειτουργία Server μιλά με το backend του AdaptiveLearner.
- **es**: Elige donde viven tus datos. El modo local guarda todo en este navegador; el modo Servidor habla con el backend de AdaptiveLearner.
- **fr**: Choisis ou tes donnees vivent. Le mode Local garde tout dans ce navigateur ; le mode Serveur parle au backend AdaptiveLearner.
- **hi**: चुनें कि आपका डेटा कहाँ रहेगा। लोकल मोड सब कुछ इसी ब्राउज़र में रखता है; सर्वर मोड AdaptiveLearner बैकएंड से संवाद करता है।
- **id**: Pilih tempat data Anda tinggal. Mode lokal menyimpan semuanya di peramban ini; mode Server berkomunikasi dengan backend AdaptiveLearner.
- **ja**: データの保存場所を選択してください。ローカルモードはすべてをこの ブラウザに保存します。サーバーモードは AdaptiveLearner のバックエンドと 通信します。
- **ko**: 데이터가 어디에 저장될지 선택하세요. 로컬 모드는 모든 것을 이 브라우저에 보관하고, 서버 모드는 AdaptiveLearner 백엔드와 통신합니다.
- **pt**: Escolha onde seus dados ficam. O modo Local mantém tudo neste navegador; o modo Servidor se comunica com o backend do AdaptiveLearner.
- **tr**: Verilerinin nerede yaşayacağını seç. Yerel mod her şeyi bu tarayıcıda tutar; Sunucu modu AdaptiveLearner arka uçuyla iletişim kurar.

### `settings.storage_mode_api`
- **de**: Server
- **en**: Server
- **el**: Διακομιστής
- **es**: Servidor
- **fr**: Serveur
- **hi**: सर्वर
- **id**: Server
- **ja**: サーバー
- **ko**: 서버
- **pt**: Servidor
- **tr**: Sunucu

### `settings.storage_mode_api_hint`
- **de**: Benoetigt ein laufendes AdaptiveLearner-Backend.
- **en**: Requires a running AdaptiveLearner backend.
- **el**: Απαιτεί ενεργό backend AdaptiveLearner.
- **es**: Requiere un backend de AdaptiveLearner en ejecucion.
- **fr**: Necessite un backend AdaptiveLearner actif.
- **hi**: एक चालू AdaptiveLearner बैकएंड की आवश्यकता है।
- **id**: Memerlukan backend AdaptiveLearner yang berjalan.
- **ja**: 実行中の AdaptiveLearner バックエンドが必要です。
- **ko**: 실행 중인 AdaptiveLearner 백엔드가 필요합니다.
- **pt**: Requer um backend do AdaptiveLearner em execução.
- **tr**: Çalışan bir AdaptiveLearner arka ucu gerektirir.

### `settings.storage_mode_dexie`
- **de**: Lokal (Browser)
- **en**: Local (Browser)
- **el**: Τοπικό (Περιηγητής)
- **es**: Local (Navegador)
- **fr**: Local (Navigateur)
- **hi**: लोकल (ब्राउज़र)
- **id**: Lokal (Peramban)
- **ja**: ローカル (ブラウザ)
- **ko**: 로컬 (브라우저)
- **pt**: Local (Navegador)
- **tr**: Yerel (Tarayıcı)

### `settings.storage_mode_dexie_hint`
- **de**: Daten und API-Keys leben in diesem Browser; KI-Aufrufe gehen direkt aus der Seite raus.
- **en**: Data + API keys live in this browser; AI calls fire direct from the page.
- **el**: Δεδομένα και κλειδιά API ζουν σε αυτόν τον περιηγητή· οι κλήσεις AI γίνονται απευθείας από τη σελίδα.
- **es**: Datos y claves API viven en este navegador; las llamadas de IA salen directamente desde la pagina.
- **fr**: Donnees et cles API vivent dans ce navigateur ; les appels IA partent directement depuis la page.
- **hi**: डेटा + API कुंजियाँ इसी ब्राउज़र में रहती हैं; AI कॉल सीधे पेज से होते हैं।
- **id**: Data + kunci API tinggal di peramban ini; panggilan AI berjalan langsung dari halaman.
- **ja**: データと API キーはこのブラウザに保存され、AI 呼び出しはこのページから 直接実行されます。
- **ko**: 데이터와 API 키가 이 브라우저에 저장되며, AI 호출은 페이지에서 직접 이루어집니다.
- **pt**: Dados e chaves de API ficam neste navegador; as chamadas de IA são feitas diretamente desta página.
- **tr**: Veri ve API anahtarları bu tarayıcıda kalır; YZ çağrıları doğrudan sayfadan yapılır.

### `settings.storage_mode_warning`
- **de**: Daten werden zwischen den Modi NICHT synchronisiert. Synchronisation ist fuer eine spaetere Version geplant.
- **en**: Data is NOT synced between modes. Sync is planned for a future version.
- **el**: Τα δεδομένα ΔΕΝ συγχρονίζονται μεταξύ των λειτουργιών. Ο συγχρονισμός σχεδιάζεται για μελλοντική έκδοση.
- **es**: Los datos NO se sincronizan entre modos. La sincronizacion esta planeada para una version futura.
- **fr**: Les donnees ne sont PAS synchronisees entre les modes. La synchronisation est prevue pour une future version.
- **hi**: मोड के बीच डेटा सिंक नहीं होता। सिंक भविष्य के संस्करण के लिए योजनाबद्ध है।
- **id**: Data TIDAK disinkronkan antar mode. Sinkronisasi direncanakan untuk versi mendatang.
- **ja**: データはモード間で同期されません。同期は将来のバージョンで予定されて います。
- **ko**: 데이터는 모드 간에 동기화되지 않습니다. 동기화는 향후 버전에 계획되어 있습니다.
- **pt**: Os dados NÃO são sincronizados entre os modos. A sincronização está planejada para uma versão futura.
- **tr**: Veriler modlar arasında SENKRONİZE EDİLMEZ. Senkronizasyon gelecek bir sürüm için planlanıyor.

### `settings.storage_mode_switch_notice`
- **de**: Speicher-Modus gespeichert. Seite neu laden, um den neuen Modus zu aktivieren.
- **en**: Storage mode saved. Reload the page to switch to the new backend.
- **el**: Η λειτουργία αποθήκευσης αποθηκεύτηκε. Φόρτωσε ξανά τη σελίδα για να ενεργοποιήσεις τη νέα.
- **es**: Modo de almacenamiento guardado. Recarga la pagina para activarlo.
- **fr**: Mode de stockage enregistre. Recharge la page pour activer le nouveau backend.
- **hi**: संग्रहण मोड सहेजा गया। नए बैकएंड पर स्विच करने के लिए पेज पुनः लोड करें।
- **id**: Mode penyimpanan disimpan. Muat ulang halaman untuk beralih ke backend baru.
- **ja**: ストレージモードを保存しました。新しいバックエンドに切り替えるには ページを再読み込みしてください。
- **ko**: 저장소 모드가 저장되었습니다. 새 백엔드로 전환하려면 페이지를 새로고침하세요.
- **pt**: Modo de armazenamento salvo. Recarregue a página para trocar para o novo backend.
- **tr**: Depolama modu kaydedildi. Yeni arka uca geçmek için sayfayı yeniden yükle.

### `settings.language_label`
- **de**: Anzeigesprache
- **en**: Display language
- **el**: Γλώσσα εμφάνισης
- **es**: Idioma de la interfaz
- **fr**: Langue d'affichage
- **hi**: प्रदर्शन भाषा
- **id**: Bahasa tampilan
- **ja**: 表示言語
- **ko**: 표시 언어
- **pt**: Idioma de exibição
- **tr**: Görüntüleme dili

### `settings.language_search_placeholder`
- **de**: Sprachen suchen…
- **en**: Search languages…
- **el**: Αναζήτηση γλωσσών…
- **es**: Buscar idiomas…
- **fr**: Rechercher des langues…
- **hi**: भाषाएँ खोजें…
- **id**: Cari bahasa…
- **ja**: 言語を検索…
- **ko**: 언어 검색…
- **pt**: Pesquisar idiomas…
- **tr**: Dil ara…

### `settings.language_no_results`
- **de**: Keine Sprachen gefunden
- **en**: No languages found
- **el**: Δεν βρέθηκαν γλώσσες
- **es**: No se encontraron idiomas
- **fr**: Aucune langue trouvée
- **hi**: कोई भाषा नहीं मिली
- **id**: Tidak ada bahasa ditemukan
- **ja**: 言語が見つかりません
- **ko**: 언어를 찾을 수 없습니다
- **pt**: Nenhum idioma encontrado
- **tr**: Dil bulunamadı

### `settings.language_search_label`
- **de**: Sprachen suchen
- **en**: Search languages
- **el**: Αναζήτηση γλωσσών
- **es**: Buscar idiomas
- **fr**: Rechercher des langues
- **hi**: भाषाएँ खोजें
- **id**: Cari bahasa
- **ja**: 言語を検索
- **ko**: 언어 검색
- **pt**: Pesquisar idiomas
- **tr**: Dil ara

### `settings.provider_label`
- **de**: Aktiver Anbieter
- **en**: Active provider
- **el**: Ενεργός πάροχος
- **es**: Proveedor activo
- **fr**: Fournisseur actif
- **hi**: सक्रिय प्रदाता
- **id**: Penyedia aktif
- **ja**: アクティブなプロバイダー
- **ko**: 활성 제공자
- **pt**: Provedor ativo
- **tr**: Aktif sağlayıcı

### `settings.provider_anthropic`
- **de**: Anthropic Claude
- **en**: Anthropic Claude
- **el**: Anthropic Claude
- **es**: Anthropic Claude
- **fr**: Anthropic Claude
- **hi**: Anthropic Claude
- **id**: Anthropic Claude
- **ja**: Anthropic Claude
- **ko**: Anthropic Claude
- **pt**: Anthropic Claude
- **tr**: Anthropic Claude

### `settings.provider_openai`
- **de**: OpenAI GPT
- **en**: OpenAI GPT
- **el**: OpenAI GPT
- **es**: OpenAI GPT
- **fr**: OpenAI GPT
- **hi**: OpenAI GPT
- **id**: OpenAI GPT
- **ja**: OpenAI GPT
- **ko**: OpenAI GPT
- **pt**: OpenAI GPT
- **tr**: OpenAI GPT

### `settings.provider_gemini`
- **de**: Google Gemini
- **en**: Google Gemini
- **el**: Google Gemini
- **es**: Google Gemini
- **fr**: Google Gemini
- **hi**: Google Gemini
- **id**: Google Gemini
- **ja**: Google Gemini
- **ko**: Google Gemini
- **pt**: Google Gemini
- **tr**: Google Gemini

### `settings.providers.title`
- **de**: Konfigurierte KI-Anbieter
- **en**: Configured AI providers
- **el**: Διαμορφωμένοι πάροχοι AI
- **es**: Proveedores de IA configurados
- **fr**: Fournisseurs d'IA configurés
- **hi**: कॉन्फ़िगर किए गए AI प्रदाता
- **id**: Penyedia AI yang dikonfigurasi
- **ja**: 設定済みのAIプロバイダー
- **ko**: 구성된 AI 공급자
- **pt**: Provedores de IA configurados
- **tr**: Yapılandırılmış yapay zekâ sağlayıcıları

### `settings.providers.hint`
- **de**: Gespeicherte Schlüssel bleiben erhalten. Es wird nur eine maskierte Vorschau angezeigt, niemals der vollständige Schlüssel.
- **en**: Keys you have saved stay stored. Only a masked preview is shown — never the full key.
- **el**: Τα αποθηκευμένα κλειδιά διατηρούνται. Εμφανίζεται μόνο μια καλυμμένη προεπισκόπηση, ποτέ ολόκληρο το κλειδί.
- **es**: Las claves guardadas se conservan. Solo se muestra una vista previa enmascarada, nunca la clave completa.
- **fr**: Les clés enregistrées sont conservées. Seul un aperçu masqué est affiché, jamais la clé complète.
- **hi**: आपके द्वारा सहेजी गई कुंजियाँ संग्रहीत रहती हैं। केवल मास्क किया गया पूर्वावलोकन दिखाया जाता है, पूरी कुंजी कभी नहीं।
- **id**: Kunci yang Anda simpan tetap tersimpan. Hanya pratinjau yang disamarkan yang ditampilkan, tidak pernah kunci lengkapnya.
- **ja**: 保存したキーは保持されます。マスクされたプレビューのみが表示され、完全なキーは表示されません。
- **ko**: 저장한 키는 그대로 유지됩니다. 전체 키는 표시되지 않으며 마스킹된 미리 보기만 표시됩니다.
- **pt**: As chaves guardadas permanecem armazenadas. Apenas é mostrada uma pré-visualização mascarada, nunca a chave completa.
- **tr**: Kaydettiğiniz anahtarlar saklanır. Yalnızca maskelenmiş bir önizleme gösterilir, anahtarın tamamı asla gösterilmez.

### `settings.providers.status_active`
- **de**: Aktiv
- **en**: Active
- **el**: Ενεργό
- **es**: Activo
- **fr**: Actif
- **hi**: सक्रिय
- **id**: Aktif
- **ja**: 有効
- **ko**: 활성
- **pt**: Ativo
- **tr**: Etkin

### `settings.providers.status_empty`
- **de**: Leer
- **en**: Empty
- **el**: Κενό
- **es**: Vacío
- **fr**: Vide
- **hi**: खाली
- **id**: Kosong
- **ja**: 未設定
- **ko**: 비어 있음
- **pt**: Vazio
- **tr**: Boş

### `settings.providers.status_desktop_only`
- **de**: Nur Desktop
- **en**: Desktop only
- **el**: Μόνο για υπολογιστή
- **es**: Solo escritorio
- **fr**: Bureau uniquement
- **hi**: केवल डेस्कटॉप
- **id**: Hanya desktop
- **ja**: デスクトップのみ
- **ko**: 데스크톱 전용
- **pt**: Apenas computador
- **tr**: Yalnızca masaüstü

### `settings.providers.status_external`
- **de**: Extern
- **en**: External
- **el**: Εξωτερικό
- **es**: Externo
- **fr**: Externe
- **hi**: बाहरी
- **id**: Eksternal
- **ja**: 外部
- **ko**: 외부
- **pt**: Externo
- **tr**: Harici

### `settings.providers.set_active`
- **de**: Als aktiven Anbieter verwenden
- **en**: Use as active provider
- **el**: Χρήση ως ενεργού παρόχου
- **es**: Usar como proveedor activo
- **fr**: Utiliser comme fournisseur actif
- **hi**: सक्रिय प्रदाता के रूप में उपयोग करें
- **id**: Gunakan sebagai penyedia aktif
- **ja**: アクティブなプロバイダーとして使用
- **ko**: 활성 공급자로 사용
- **pt**: Usar como provedor ativo
- **tr**: Etkin sağlayıcı olarak kullan

### `settings.providers.edit`
- **de**: Bearbeiten
- **en**: Edit
- **el**: Επεξεργασία
- **es**: Editar
- **fr**: Modifier
- **hi**: संपादित करें
- **id**: Edit
- **ja**: 編集
- **ko**: 편집
- **pt**: Editar
- **tr**: Düzenle

### `settings.providers.add`
- **de**: Schlüssel hinzufügen
- **en**: Add key
- **el**: Προσθήκη κλειδιού
- **es**: Añadir clave
- **fr**: Ajouter une clé
- **hi**: कुंजी जोड़ें
- **id**: Tambah kunci
- **ja**: キーを追加
- **ko**: 키 추가
- **pt**: Adicionar chave
- **tr**: Anahtar ekle

### `settings.providers.test`
- **de**: Testen
- **en**: Test
- **el**: Δοκιμή
- **es**: Probar
- **fr**: Tester
- **hi**: परीक्षण करें
- **id**: Uji
- **ja**: テスト
- **ko**: 테스트
- **pt**: Testar
- **tr**: Test et

### `settings.providers.testing`
- **de**: Teste…
- **en**: Testing…
- **el**: Δοκιμή…
- **es**: Probando…
- **fr**: Test en cours…
- **hi**: परीक्षण हो रहा है…
- **id**: Menguji…
- **ja**: テスト中…
- **ko**: 테스트 중…
- **pt**: A testar…
- **tr**: Test ediliyor…

### `settings.providers.test_connection_ok`
- **de**: Verbindung ok
- **en**: Connection ok
- **el**: Σύνδεση εντάξει
- **es**: Conexión correcta
- **fr**: Connexion OK
- **hi**: कनेक्शन ठीक है
- **id**: Koneksi oke
- **ja**: 接続OK
- **ko**: 연결 정상
- **pt**: Ligação OK
- **tr**: Bağlantı tamam

### `settings.providers.test_key_invalid`
- **de**: Key ungültig
- **en**: Key invalid
- **el**: Μη έγκυρο κλειδί
- **es**: Clave no válida
- **fr**: Clé invalide
- **hi**: कुंजी अमान्य
- **id**: Kunci tidak valid
- **ja**: キーが無効です
- **ko**: 키가 잘못됨
- **pt**: Chave inválida
- **tr**: Anahtar geçersiz

### `settings.providers.test_network_error`
- **de**: Netzwerkfehler
- **en**: Network error
- **el**: Σφάλμα δικτύου
- **es**: Error de red
- **fr**: Erreur réseau
- **hi**: नेटवर्क त्रुटि
- **id**: Kesalahan jaringan
- **ja**: ネットワークエラー
- **ko**: 네트워크 오류
- **pt**: Erro de rede
- **tr**: Ağ hatası

### `settings.providers.test_backend_only`
- **de**: Nur mit Backend testbar
- **en**: Only testable with the backend
- **el**: Δοκιμάζεται μόνο με το backend
- **es**: Solo se puede probar con el backend
- **fr**: Testable uniquement avec le backend
- **hi**: केवल बैकएंड के साथ परीक्षण योग्य
- **id**: Hanya dapat diuji dengan backend
- **ja**: バックエンドでのみテスト可能
- **ko**: 백엔드에서만 테스트 가능
- **pt**: Só pode ser testado com o backend
- **tr**: Yalnızca arka uç ile test edilebilir

### `settings.api_key_label`
- **de**: API-Key
- **en**: API key
- **el**: Κλειδί API
- **es**: Clave API
- **fr**: Cle API
- **hi**: API कुंजी
- **id**: Kunci API
- **ja**: API キー
- **ko**: API 키
- **pt**: Chave de API
- **tr**: API anahtarı

### `settings.api_key_placeholder`
- **de**: Hier einfügen …
- **en**: Paste here…
- **el**: Επικόλληση εδώ...
- **es**: Pegar aqui...
- **fr**: Coller ici...
- **hi**: यहाँ पेस्ट करें…
- **id**: Tempel di sini…
- **ja**: ここに貼り付け…
- **ko**: 여기에 붙여넣으세요…
- **pt**: Cole aqui…
- **tr**: Buraya yapıştır…

### `settings.api_key_placeholder_replace`
- **de**: Neuen Schlüssel einfügen, um den gespeicherten zu ersetzen …
- **en**: Paste a new key to replace the stored one…
- **el**: Επικολλήστε νέο κλειδί για να αντικαταστήσετε το αποθηκευμένο…
- **es**: Pega una clave nueva para reemplazar la guardada…
- **fr**: Colle une nouvelle cle pour remplacer celle enregistree…
- **hi**: सहेजी गई कुंजी को बदलने के लिए नई कुंजी पेस्ट करें…
- **id**: Tempel kunci baru untuk mengganti yang tersimpan…
- **ja**: 保存済みのキーを置き換える新しいキーを貼り付けてください…
- **ko**: 저장된 키를 교체하려면 새 키를 붙여넣으세요…
- **pt**: Cole uma nova chave para substituir a armazenada…
- **tr**: Saklanan anahtarı değiştirmek için yeni bir anahtar yapıştırın…

### `settings.api_key.test`
- **de**: Testen
- **en**: Test
- **el**: Δοκιμή
- **es**: Probar
- **fr**: Tester
- **hi**: परीक्षण
- **id**: Uji
- **ja**: テスト
- **ko**: 테스트
- **pt**: Testar
- **tr**: Test et

### `settings.api_key.testing`
- **de**: Teste…
- **en**: Testing…
- **el**: Δοκιμή…
- **es**: Probando…
- **fr**: Test en cours…
- **hi**: परीक्षण हो रहा है…
- **id**: Menguji…
- **ja**: テスト中…
- **ko**: 테스트 중…
- **pt**: Testando…
- **tr**: Test ediliyor…

### `settings.api_key.test_success`
- **de**: Schlüssel funktioniert!
- **en**: Key works!
- **el**: Το κλειδί λειτουργεί!
- **es**: ¡La clave funciona!
- **fr**: La cle fonctionne !
- **hi**: कुंजी काम करती है!
- **id**: Kunci berfungsi!
- **ja**: キーは有効です！
- **ko**: 키가 작동합니다!
- **pt**: A chave funciona!
- **tr**: Anahtar çalışıyor!

### `settings.api_key.test_invalid`
- **de**: Schlüssel ungültig oder abgelaufen.
- **en**: Key invalid or expired.
- **el**: Μη έγκυρο ή ληγμένο κλειδί.
- **es**: Clave no válida o caducada.
- **fr**: Cle invalide ou expiree.
- **hi**: कुंजी अमान्य या समाप्त।
- **id**: Kunci tidak valid atau kedaluwarsa.
- **ja**: キーが無効または期限切れです。
- **ko**: 키가 유효하지 않거나 만료되었습니다.
- **pt**: Chave inválida ou expirada.
- **tr**: Anahtar geçersiz veya süresi dolmuş.

### `settings.api_key.test_network`
- **de**: Verbindung fehlgeschlagen. Prüfe deine Internetverbindung.
- **en**: Connection failed. Check your internet connection.
- **el**: Η σύνδεση απέτυχε. Ελέγξτε τη σύνδεσή σας.
- **es**: Conexión fallida. Comprueba tu conexión a internet.
- **fr**: Connexion echouee. Verifie ta connexion internet.
- **hi**: कनेक्शन विफल। अपना इंटरनेट कनेक्शन जाँचें।
- **id**: Koneksi gagal. Periksa koneksi internet Anda.
- **ja**: 接続に失敗しました。インターネット接続を確認してください。
- **ko**: 연결에 실패했습니다. 인터넷 연결을 확인하세요.
- **pt**: Falha na conexão. Verifique sua internet.
- **tr**: Bağlantı başarısız. İnternet bağlantını kontrol et.

### `settings.api_key.test_error`
- **de**: Test fehlgeschlagen. Der Anbieter hat die Anfrage abgelehnt.
- **en**: Test failed. The provider rejected the request.
- **el**: Η δοκιμή απέτυχε. Ο πάροχος απέρριψε το αίτημα.
- **es**: La prueba falló. El proveedor rechazó la solicitud.
- **fr**: Échec du test. Le fournisseur a rejeté la requête.
- **hi**: परीक्षण विफल। प्रदाता ने अनुरोध को अस्वीकार कर दिया।
- **id**: Pengujian gagal. Penyedia menolak permintaan.
- **ja**: テストに失敗しました。プロバイダーがリクエストを拒否しました。
- **ko**: 테스트에 실패했습니다. 제공업체가 요청을 거부했습니다.
- **pt**: Falha no teste. O provedor rejeitou a solicitação.
- **tr**: Test başarısız oldu. Sağlayıcı isteği reddetti.

### `settings.api_key.test_rate_limit`
- **de**: Rate-Limit erreicht. Versuche es später.
- **en**: Rate limit hit. Try later.
- **el**: Συμπληρώθηκε το όριο. Δοκιμάστε αργότερα.
- **es**: Límite de uso alcanzado. Inténtalo más tarde.
- **fr**: Limite de debit atteinte. Reessaie plus tard.
- **hi**: दर सीमा तक पहुँच गई। बाद में प्रयास करें।
- **id**: Batas laju tercapai. Coba lagi nanti.
- **ja**: レート制限に達しました。後でお試しください。
- **ko**: 요청 한도에 도달했습니다. 나중에 다시 시도하세요.
- **pt**: Limite de uso atingido. Tente mais tarde.
- **tr**: Hız sınırına ulaşıldı. Daha sonra dene.

### `settings.api_key.test_no_key`
- **de**: Kein Schlüssel zum Testen.
- **en**: No key to test.
- **el**: Δεν υπάρχει κλειδί για δοκιμή.
- **es**: No hay clave para probar.
- **fr**: Aucune cle a tester.
- **hi**: परीक्षण के लिए कोई कुंजी नहीं।
- **id**: Tidak ada kunci untuk diuji.
- **ja**: テストするキーがありません。
- **ko**: 테스트할 키가 없습니다.
- **pt**: Nenhuma chave para testar.
- **tr**: Test edilecek anahtar yok.

### `settings.api_key.format_invalid`
- **de**: Ungültiges Format.
- **en**: Invalid format.
- **el**: Μη έγκυρη μορφή.
- **es**: Formato no válido.
- **fr**: Format invalide.
- **hi**: अमान्य प्रारूप।
- **id**: Format tidak valid.
- **ja**: 形式が無効です。
- **ko**: 형식이 유효하지 않습니다.
- **pt**: Formato inválido.
- **tr**: Geçersiz biçim.

### `settings.api_key.rollback_warning`
- **de**: Der neue Schlüssel funktioniert nicht. Alten Schlüssel behalten?
- **en**: The new key doesn't work. Keep the old key?
- **el**: Το νέο κλειδί δεν λειτουργεί. Διατήρηση του παλιού;
- **es**: La nueva clave no funciona. ¿Mantener la anterior?
- **fr**: La nouvelle cle ne fonctionne pas. Garder l'ancienne ?
- **hi**: नई कुंजी काम नहीं करती। पुरानी कुंजी रखें?
- **id**: Kunci baru tidak berfungsi. Pertahankan kunci lama?
- **ja**: 新しいキーが機能しません。古いキーを保持しますか？
- **ko**: 새 키가 작동하지 않습니다. 이전 키를 유지할까요?
- **pt**: A nova chave não funciona. Manter a antiga?
- **tr**: Yeni anahtar çalışmıyor. Eski anahtar korunsun mu?

### `settings.api_key.rollback_keep_old`
- **de**: Alten behalten
- **en**: Keep old key
- **el**: Διατήρηση παλιού
- **es**: Mantener la anterior
- **fr**: Garder l'ancienne
- **hi**: पुरानी कुंजी रखें
- **id**: Pertahankan kunci lama
- **ja**: 古いキーを保持
- **ko**: 이전 키 유지
- **pt**: Manter a antiga
- **tr**: Eskiyi koru

### `settings.api_key.rollback_save_anyway`
- **de**: Trotzdem speichern
- **en**: Save anyway
- **el**: Αποθήκευση ούτως ή άλλως
- **es**: Guardar de todos modos
- **fr**: Enregistrer quand meme
- **hi**: फिर भी सहेजें
- **id**: Simpan saja
- **ja**: それでも保存
- **ko**: 그래도 저장
- **pt**: Salvar mesmo assim
- **tr**: Yine de kaydet

### `settings.api_key.rollback_cancel`
- **de**: Abbrechen
- **en**: Cancel
- **el**: Άκυρο
- **es**: Cancelar
- **fr**: Annuler
- **hi**: रद्द करें
- **id**: Batal
- **ja**: キャンセル
- **ko**: 취소
- **pt**: Cancelar
- **tr**: İptal

### `settings.api_key.rollback_restore`
- **de**: Letzten funktionierenden Schlüssel wiederherstellen
- **en**: Restore last working key
- **el**: Επαναφορά τελευταίου λειτουργικού κλειδιού
- **es**: Restaurar la última clave que funcionó
- **fr**: Restaurer la derniere cle fonctionnelle
- **hi**: अंतिम काम करने वाली कुंजी पुनर्स्थापित करें
- **id**: Pulihkan kunci terakhir yang berfungsi
- **ja**: 最後に動作したキーを復元
- **ko**: 마지막으로 작동한 키 복원
- **pt**: Restaurar a última chave que funcionou
- **tr**: Son çalışan anahtarı geri yükle

### `settings.api_key.format_hint.anthropic`
- **de**: Beginnt mit sk-ant-
- **en**: Starts with sk-ant-
- **el**: Ξεκινά με sk-ant-
- **es**: Empieza con sk-ant-
- **fr**: Commence par sk-ant-
- **hi**: sk-ant- से शुरू होती है
- **id**: Diawali dengan sk-ant-
- **ja**: sk-ant- で始まります
- **ko**: sk-ant-로 시작합니다
- **pt**: Começa com sk-ant-
- **tr**: sk-ant- ile başlar

### `settings.api_key.format_hint.openai`
- **de**: Beginnt mit sk-
- **en**: Starts with sk-
- **el**: Ξεκινά με sk-
- **es**: Empieza con sk-
- **fr**: Commence par sk-
- **hi**: sk- से शुरू होती है
- **id**: Diawali dengan sk-
- **ja**: sk- で始まります
- **ko**: sk-로 시작합니다
- **pt**: Começa com sk-
- **tr**: sk- ile başlar

### `settings.api_key.format_hint.gemini`
- **de**: Mindestens 20 Zeichen
- **en**: At least 20 characters
- **el**: Τουλάχιστον 20 χαρακτήρες
- **es**: Al menos 20 caracteres
- **fr**: Au moins 20 caractères
- **hi**: कम से कम 20 अक्षर
- **id**: Minimal 20 karakter
- **ja**: 20文字以上
- **ko**: 20자 이상
- **pt**: Pelo menos 20 caracteres
- **tr**: En az 20 karakter

### `settings.api_key_saved`
- **de**: Key gespeichert
- **en**: Key stored
- **el**: Το κλειδί αποθηκεύτηκε
- **es**: Clave almacenada
- **fr**: Cle enregistree
- **hi**: कुंजी संग्रहीत
- **id**: Kunci disimpan
- **ja**: キーを保存しました
- **ko**: 키가 저장됨
- **pt**: Chave salva
- **tr**: Anahtar saklandı

### `settings.api_key_missing`
- **de**: Nicht gesetzt
- **en**: Not set
- **el**: Δεν έχει οριστεί
- **es**: No configurada
- **fr**: Non definie
- **hi**: सेट नहीं
- **id**: Belum disetel
- **ja**: 未設定
- **ko**: 설정 안 됨
- **pt**: Não definida
- **tr**: Ayarlanmadı

### `settings.api_key_set`
- **de**: Key speichern
- **en**: Save key
- **el**: Αποθήκευση κλειδιού
- **es**: Guardar clave
- **fr**: Enregistrer la cle
- **hi**: कुंजी सहेजें
- **id**: Simpan kunci
- **ja**: キーを保存
- **ko**: 키 저장
- **pt**: Salvar chave
- **tr**: Anahtarı kaydet

### `settings.api_key_delete`
- **de**: Key entfernen
- **en**: Remove key
- **el**: Αφαίρεση κλειδιού
- **es**: Eliminar clave
- **fr**: Supprimer la cle
- **hi**: कुंजी हटाएँ
- **id**: Hapus kunci
- **ja**: キーを削除
- **ko**: 키 제거
- **pt**: Remover chave
- **tr**: Anahtarı kaldır

### `settings.api_key_confirm_delete`
- **de**: Diesen API-Key wirklich entfernen?
- **en**: Really remove this API key?
- **el**: Όντως να αφαιρεθεί αυτό το κλειδί API;
- **es**: Realmente eliminar esta clave API?
- **fr**: Vraiment supprimer cette cle API ?
- **hi**: क्या वाकई यह API कुंजी हटानी है?
- **id**: Yakin ingin menghapus kunci API ini?
- **ja**: 本当にこの API キーを削除しますか?
- **ko**: 정말 이 API 키를 제거하시겠습니까?
- **pt**: Remover mesmo esta chave de API?
- **tr**: Bu API anahtarı gerçekten kaldırılsın mı?

### `settings.saved`
- **de**: Gespeichert.
- **en**: Saved.
- **el**: Αποθηκεύτηκε.
- **es**: Guardado.
- **fr**: Enregistre.
- **hi**: सहेजा गया।
- **id**: Tersimpan.
- **ja**: 保存しました。
- **ko**: 저장되었습니다.
- **pt**: Salvo.
- **tr**: Kaydedildi.

### `settings.save_failed`
- **de**: Speichern fehlgeschlagen.
- **en**: Save failed.
- **el**: Η αποθήκευση απέτυχε.
- **es**: Error al guardar.
- **fr**: Echec de l'enregistrement.
- **hi**: सहेजना विफल।
- **id**: Gagal menyimpan.
- **ja**: 保存に失敗しました。
- **ko**: 저장에 실패했습니다.
- **pt**: Falha ao salvar.
- **tr**: Kaydetme başarısız oldu.

### `settings.provider_active`
- **de**: Aktiv
- **en**: Active
- **el**: Ενεργό
- **es**: Activo
- **fr**: Actif
- **hi**: सक्रिय
- **id**: Aktif
- **ja**: アクティブ
- **ko**: 활성
- **pt**: Ativo
- **tr**: Aktif

### `settings.active_provider_missing_key`
- **de**: Dies ist dein aktiver Anbieter, aber kein API-Key ist gespeichert. KI-Antworten werden übersprungen, bis ein Key hinterlegt ist.
- **en**: This is your active provider but no API key is stored. AI replies will be skipped until a key is saved.
- **el**: Αυτός είναι ο ενεργός πάροχος αλλά δεν είναι αποθηκευμένο κλειδί API. Οι απαντήσεις AI θα παραλείπονται μέχρι να αποθηκευτεί κλειδί.
- **es**: Este es tu proveedor activo pero no hay clave API guardada. Las respuestas de IA se omitiran hasta que se guarde una clave.
- **fr**: C'est ton fournisseur actif mais aucune cle API n'est enregistree. Les reponses IA seront ignorees jusqu'a ce qu'une cle soit enregistree.
- **hi**: यह आपका सक्रिय प्रदाता है पर कोई API कुंजी संग्रहीत नहीं है। कुंजी सहेजे जाने तक AI उत्तर छोड़ दिए जाएँगे।
- **id**: Ini adalah penyedia aktif Anda tetapi tidak ada kunci API yang tersimpan. Balasan AI akan dilewati hingga kunci disimpan.
- **ja**: これはアクティブなプロバイダーですが、API キーが保存されていません。 キーが保存されるまで AI の応答はスキップされます。
- **ko**: 활성 제공자이지만 저장된 API 키가 없습니다. 키가 저장될 때까지 AI 응답은 건너뜁니다.
- **pt**: Este é o seu provedor ativo, mas nenhuma chave de API está armazenada. As respostas da IA serão ignoradas até que uma chave seja salva.
- **tr**: Bu senin aktif sağlayıcın ama saklı bir API anahtarı yok. Bir anahtar kaydedilene kadar YZ cevapları atlanacak.

### `settings.api_key_source_file`
- **de**: Schlüssel aus: secrets.yaml
- **en**: Key from: secrets.yaml
- **el**: Κλειδί από: secrets.yaml
- **es**: Clave desde: secrets.yaml
- **fr**: Cle depuis: secrets.yaml
- **hi**: कुंजी स्रोत: secrets.yaml
- **id**: Kunci dari: secrets.yaml
- **ja**: キーの出所: secrets.yaml
- **ko**: 키 출처: secrets.yaml
- **pt**: Chave de: secrets.yaml
- **tr**: Anahtar kaynağı: secrets.yaml

### `settings.api_key_source_env`
- **de**: Schlüssel aus: Umgebungsvariable
- **en**: Key from: environment
- **el**: Κλειδί από: μεταβλητή περιβάλλοντος
- **es**: Clave desde: variable de entorno
- **fr**: Cle depuis: variable d'environnement
- **hi**: कुंजी स्रोत: environment
- **id**: Kunci dari: lingkungan
- **ja**: キーの出所: 環境変数
- **ko**: 키 출처: 환경 변수
- **pt**: Chave de: variável de ambiente
- **tr**: Anahtar kaynağı: ortam değişkeni

### `settings.api_key_source_settings`
- **de**: Schlüssel aus: Einstellungen
- **en**: Key from: Settings
- **el**: Κλειδί από: Ρυθμίσεις
- **es**: Clave desde: Ajustes
- **fr**: Cle depuis: Parametres
- **hi**: कुंजी स्रोत: सेटिंग्स
- **id**: Kunci dari: Pengaturan
- **ja**: キーの出所: 設定
- **ko**: 키 출처: 설정
- **pt**: Chave de: Configurações
- **tr**: Anahtar kaynağı: Ayarlar

### `settings.api_key_source_none`
- **de**: Kein Schlüssel konfiguriert
- **en**: No key configured
- **el**: Δεν υπάρχει κλειδί
- **es**: Ninguna clave configurada
- **fr**: Aucune cle configuree
- **hi**: कोई कुंजी कॉन्फ़िगर नहीं
- **id**: Tidak ada kunci dikonfigurasi
- **ja**: キーが設定されていません
- **ko**: 설정된 키 없음
- **pt**: Nenhuma chave configurada
- **tr**: Yapılandırılmış anahtar yok

### `settings.api_key_external_hint_file`
- **de**: Gespeichert in ~/.config/adaptive_learner/secrets.yaml. Speichern überschreibt sie.
- **en**: Stored in ~/.config/adaptive_learner/secrets.yaml. Saving here overwrites it.
- **el**: Αποθηκευμένο στο ~/.config/adaptive_learner/secrets.yaml. Η αποθήκευση εδώ το αντικαθιστά.
- **es**: Guardada en ~/.config/adaptive_learner/secrets.yaml. Guardar aquí la sobrescribe.
- **fr**: Enregistree dans ~/.config/adaptive_learner/secrets.yaml. Enregistrer ici la remplace.
- **hi**: ~/.config/adaptive_learner/secrets.yaml में संग्रहीत। यहाँ सहेजने से वह अधिलेखित हो जाएगी।
- **id**: Disimpan di ~/.config/adaptive_learner/secrets.yaml. Menyimpan di sini akan menimpanya.
- **ja**: ~/.config/adaptive_learner/secrets.yaml に保存されています。ここで保存すると上書きされます。
- **ko**: ~/.config/adaptive_learner/secrets.yaml에 저장되어 있습니다. 여기서 저장하면 덮어씁니다.
- **pt**: Armazenada em ~/.config/adaptive_learner/secrets.yaml. Salvar aqui a substitui.
- **tr**: ~/.config/adaptive_learner/secrets.yaml içinde saklanır. Burada kaydetmek üzerine yazar.

### `settings.api_key_external_hint_env`
- **de**: Dieser Schlüssel wird über die Umgebungsvariable ADAPTIVE_LEARNER_{PROVIDER}_API_KEY konfiguriert.
- **en**: This key is configured via the ADAPTIVE_LEARNER_{PROVIDER}_API_KEY environment variable.
- **el**: Αυτό το κλειδί ρυθμίζεται μέσω της μεταβλητής περιβάλλοντος ADAPTIVE_LEARNER_{PROVIDER}_API_KEY.
- **es**: Esta clave se configura mediante la variable de entorno ADAPTIVE_LEARNER_{PROVIDER}_API_KEY.
- **fr**: Cette cle est configuree via la variable d'environnement ADAPTIVE_LEARNER_{PROVIDER}_API_KEY.
- **hi**: यह कुंजी ADAPTIVE_LEARNER_{PROVIDER}_API_KEY environment variable के माध्यम से कॉन्फ़िगर है।
- **id**: Kunci ini dikonfigurasi melalui variabel lingkungan ADAPTIVE_LEARNER_{PROVIDER}_API_KEY.
- **ja**: このキーは ADAPTIVE_LEARNER_{PROVIDER}_API_KEY 環境変数で設定されています。
- **ko**: 이 키는 ADAPTIVE_LEARNER_{PROVIDER}_API_KEY 환경 변수로 설정되어 있습니다.
- **pt**: Esta chave é configurada pela variável de ambiente ADAPTIVE_LEARNER_{PROVIDER}_API_KEY.
- **tr**: Bu anahtar ADAPTIVE_LEARNER_{PROVIDER}_API_KEY ortam değişkeniyle yapılandırılmıştır.

### `settings.section_model_overrides`
- **de**: Modellüberschreibungen
- **en**: Model overrides
- **el**: Παρακάμψεις μοντέλου
- **es**: Modelos personalizados
- **fr**: Surcharges de modele
- **hi**: मॉडल ओवरराइड
- **id**: Penggantian model
- **ja**: モデルの上書き
- **ko**: 모델 재정의
- **pt**: Substituições de modelo
- **tr**: Model geçersiz kılmaları

### `settings.model_overrides_hint`
- **de**: Leer lassen, um das Standardmodell pro Anbieter zu nutzen. Ein nicht-leerer Wert ersetzt das Standardmodell beim Chat.
- **en**: Leave blank to use the default model for each provider. A non-empty value replaces the default at chat time.
- **el**: Άφησε κενό για να χρησιμοποιηθεί το προεπιλεγμένο μοντέλο για κάθε πάροχο. Μη κενή τιμή αντικαθιστά το προεπιλεγμένο κατά τη συνομιλία.
- **es**: Deja en blanco para usar el modelo predeterminado por proveedor. Un valor no vacio reemplaza el predeterminado al chatear.
- **fr**: Laisse vide pour utiliser le modele par defaut de chaque fournisseur. Une valeur non vide remplace la valeur par defaut lors du chat.
- **hi**: प्रत्येक प्रदाता के लिए डिफ़ॉल्ट मॉडल उपयोग करने हेतु खाली छोड़ें। गैर-खाली मान चैट के समय डिफ़ॉल्ट को बदल देता है।
- **id**: Biarkan kosong untuk menggunakan model bawaan setiap penyedia. Nilai yang tidak kosong menggantikan bawaan saat obrolan.
- **ja**: 各プロバイダーのデフォルトモデルを使う場合は空のままにしてください。 空でない値はチャット時にデフォルトを置き換えます。
- **ko**: 각 제공자의 기본 모델을 사용하려면 비워 두세요. 비어 있지 않은 값은 대화 시 기본값을 대체합니다.
- **pt**: Deixe em branco para usar o modelo padrão de cada provedor. Um valor não vazio substitui o padrão durante o chat.
- **tr**: Her sağlayıcı için varsayılan modeli kullanmak istiyorsan boş bırak. Boş olmayan bir değer sohbet sırasında varsayılanın yerine geçer.

### `settings.model_override_placeholder`
- **de**: Modellbezeichner (z. B. claude-3-5-haiku-latest)
- **en**: Model identifier (e.g. claude-3-5-haiku-latest)
- **el**: Αναγνωριστικό μοντέλου (π.χ. claude-3-5-haiku-latest)
- **es**: Identificador del modelo (p. ej. claude-3-5-haiku-latest)
- **fr**: Identifiant du modele (p. ex. claude-3-5-haiku-latest)
- **hi**: मॉडल पहचानकर्ता (जैसे claude-3-5-haiku-latest)
- **id**: Pengidentifikasi model (mis. claude-3-5-haiku-latest)
- **ja**: モデル識別子 (例: claude-3-5-haiku-latest)
- **ko**: 모델 식별자 (예: claude-3-5-haiku-latest)
- **pt**: Identificador do modelo (ex. claude-3-5-haiku-latest)
- **tr**: Model tanımlayıcısı (ör. claude-3-5-haiku-latest)

### `settings.model_override_set`
- **de**: Überschreibung aktiv
- **en**: Override active
- **el**: Ενεργή παράκαμψη
- **es**: Anulacion activa
- **fr**: Surcharge active
- **hi**: ओवरराइड सक्रिय
- **id**: Penggantian aktif
- **ja**: 上書きが有効
- **ko**: 재정의 활성
- **pt**: Substituição ativa
- **tr**: Geçersiz kılma aktif

### `settings.model_override_default`
- **de**: Standardmodell
- **en**: Default model
- **el**: Προεπιλεγμένο μοντέλο
- **es**: Modelo predeterminado
- **fr**: Modele par defaut
- **hi**: डिफ़ॉल्ट मॉडल
- **id**: Model bawaan
- **ja**: デフォルトモデル
- **ko**: 기본 모델
- **pt**: Modelo padrão
- **tr**: Varsayılan model

### `settings.model_override_save`
- **de**: Modell speichern
- **en**: Save model
- **el**: Αποθήκευση μοντέλου
- **es**: Guardar modelo
- **fr**: Enregistrer le modele
- **hi**: मॉडल सहेजें
- **id**: Simpan model
- **ja**: モデルを保存
- **ko**: 모델 저장
- **pt**: Salvar modelo
- **tr**: Modeli kaydet

### `settings.model_override_clear`
- **de**: Standard nutzen
- **en**: Use default
- **el**: Χρήση προεπιλογής
- **es**: Usar predeterminado
- **fr**: Utiliser la valeur par defaut
- **hi**: डिफ़ॉल्ट उपयोग करें
- **id**: Gunakan bawaan
- **ja**: デフォルトを使用
- **ko**: 기본값 사용
- **pt**: Usar padrão
- **tr**: Varsayılanı kullan

### `settings.model_picker_placeholder`
- **de**: Modell auswählen oder eingeben
- **en**: Select or type a model id
- **el**: Επιλέξτε ή πληκτρολογήστε ένα αναγνωριστικό μοντέλου
- **es**: Selecciona o escribe un id de modelo
- **fr**: Sélectionnez ou saisissez un identifiant de modèle
- **hi**: कोई मॉडल आईडी चुनें या टाइप करें
- **id**: Pilih atau ketik id model
- **ja**: モデル ID を選択または入力
- **ko**: 모델 ID를 선택하거나 입력하세요
- **pt**: Selecione ou digite um ID de modelo
- **tr**: Bir model kimliği seç veya yaz

### `settings.model_picker_open`
- **de**: Modellliste öffnen
- **en**: Open model list
- **el**: Άνοιγμα λίστας μοντέλων
- **es**: Abrir lista de modelos
- **fr**: Ouvrir la liste des modèles
- **hi**: मॉडल सूची खोलें
- **id**: Buka daftar model
- **ja**: モデル一覧を開く
- **ko**: 모델 목록 열기
- **pt**: Abrir lista de modelos
- **tr**: Model listesini aç

### `settings.model_picker_default_hint`
- **de**: Standard:
- **en**: Uses default:
- **el**: Χρησιμοποιεί το προεπιλεγμένο:
- **es**: Usa el predeterminado:
- **fr**: Utilise la valeur par défaut :
- **hi**: डिफ़ॉल्ट उपयोग करता है:
- **id**: Menggunakan bawaan:
- **ja**: デフォルトを使用:
- **ko**: 기본값 사용:
- **pt**: Usa o padrão:
- **tr**: Varsayılan kullanılıyor:

### `settings.model_picker_loading`
- **de**: Modelle werden geladen...
- **en**: Loading models...
- **el**: Φόρτωση μοντέλων...
- **es**: Cargando modelos...
- **fr**: Chargement des modèles...
- **hi**: मॉडल लोड हो रहे हैं...
- **id**: Memuat model...
- **ja**: モデルを読み込み中...
- **ko**: 모델 불러오는 중...
- **pt**: Carregando modelos...
- **tr**: Modeller yükleniyor...

### `settings.model_picker_error`
- **de**: Modelle konnten nicht geladen werden. API-Schlüssel prüfen.
- **en**: Could not load models. Check your API key.
- **el**: Δεν ήταν δυνατή η φόρτωση των μοντέλων. Ελέγξτε το κλειδί API σας.
- **es**: No se pudieron cargar los modelos. Comprueba tu clave de API.
- **fr**: Impossible de charger les modèles. Vérifiez votre clé API.
- **hi**: मॉडल लोड नहीं हो सके। अपनी API कुंजी जाँचें।
- **id**: Tidak dapat memuat model. Periksa kunci API Anda.
- **ja**: モデルを読み込めませんでした。API キーを確認してください。
- **ko**: 모델을 불러올 수 없었습니다. API 키를 확인하세요.
- **pt**: Não foi possível carregar os modelos. Verifique sua chave de API.
- **tr**: Modeller yüklenemedi. API anahtarını kontrol et.

### `settings.model_picker_retry`
- **de**: Erneut versuchen
- **en**: Retry
- **el**: Επανάληψη
- **es**: Reintentar
- **fr**: Réessayer
- **hi**: पुनः प्रयास करें
- **id**: Coba lagi
- **ja**: 再試行
- **ko**: 다시 시도
- **pt**: Tentar novamente
- **tr**: Tekrar dene

### `settings.model_picker_no_key`
- **de**: API-Schlüssel speichern, um die verfügbaren Modelle zu laden.
- **en**: Save an API key for this provider to load the available models.
- **el**: Αποθηκεύστε ένα κλειδί API για αυτόν τον πάροχο για να φορτωθούν τα διαθέσιμα μοντέλα.
- **es**: Guarda una clave de API para este proveedor para cargar los modelos disponibles.
- **fr**: Enregistrez une clé API pour ce fournisseur afin de charger les modèles disponibles.
- **hi**: उपलब्ध मॉडल लोड करने के लिए इस प्रदाता हेतु एक API कुंजी सहेजें।
- **id**: Simpan kunci API untuk penyedia ini agar memuat model yang tersedia.
- **ja**: 利用可能なモデルを読み込むには、このプロバイダーの API キーを保存してください。
- **ko**: 사용 가능한 모델을 불러오려면 이 제공자의 API 키를 저장하세요.
- **pt**: Salve uma chave de API para este provedor para carregar os modelos disponíveis.
- **tr**: Mevcut modelleri yüklemek için bu sağlayıcıya bir API anahtarı kaydet.

### `settings.model_picker_recommended`
- **de**: Empfohlen
- **en**: Recommended
- **el**: Συνιστάται
- **es**: Recomendado
- **fr**: Recommandé
- **hi**: अनुशंसित
- **id**: Direkomendasikan
- **ja**: 推奨
- **ko**: 추천
- **pt**: Recomendados
- **tr**: Önerilen

### `settings.model_picker_all`
- **de**: Alle Modelle
- **en**: All models
- **el**: Όλα τα μοντέλα
- **es**: Todos los modelos
- **fr**: Tous les modèles
- **hi**: सभी मॉडल
- **id**: Semua model
- **ja**: すべてのモデル
- **ko**: 모든 모델
- **pt**: Todos os modelos
- **tr**: Tüm modeller

### `settings.model_picker_suggestions`
- **de**: Vorschläge (offline)
- **en**: Suggested (offline)
- **el**: Προτεινόμενα (εκτός σύνδεσης)
- **es**: Sugeridos (sin conexión)
- **fr**: Suggérés (hors ligne)
- **hi**: सुझाए गए (ऑफ़लाइन)
- **id**: Disarankan (luring)
- **ja**: 候補 (オフライン)
- **ko**: 추천 (오프라인)
- **pt**: Sugeridos (offline)
- **tr**: Önerilen (çevrimdışı)

### `settings.section_gamification`
- **de**: Gamification
- **en**: Gamification
- **el**: Παιχνιδοποίηση
- **es**: Gamificación
- **fr**: Ludification
- **hi**: गेमिफ़िकेशन
- **id**: Gamifikasi
- **ja**: ゲーミフィケーション
- **ko**: 게이미피케이션
- **pt**: Gamificação
- **tr**: Oyunlaştırma

### `settings.xp_notifications`
- **de**: XP-Benachrichtigungen anzeigen
- **en**: Show XP notifications
- **el**: Εμφάνιση ειδοποιήσεων XP
- **es**: Mostrar notificaciones de XP
- **fr**: Afficher les notifications XP
- **hi**: XP सूचनाएँ दिखाएँ
- **id**: Tampilkan notifikasi XP
- **ja**: XP通知を表示
- **ko**: XP 알림 표시
- **pt**: Mostrar notificações de XP
- **tr**: XP bildirimlerini göster

### `settings.xp_notifications_help`
- **de**: Schwebende „+50 XP"-Animation beim Verdienen.
- **en**: Floating ‘+50 XP’ animation when you earn XP.
- **el**: Αναδυόμενη κίνηση «+50 XP» όταν κερδίζεις.
- **es**: Animación flotante «+50 XP» al ganar.
- **fr**: Animation flottante « +50 XP » à chaque gain.
- **hi**: XP कमाने पर तैरता हुआ ‘+50 XP’ एनिमेशन।
- **id**: Animasi mengambang ‘+50 XP’ saat Anda mendapatkan XP.
- **ja**: XP獲得時の「+50 XP」フローティングアニメーション。
- **ko**: XP를 얻을 때 떠오르는 '+50 XP' 애니메이션을 표시합니다.
- **pt**: Animação flutuante «+50 XP» ao ganhar.
- **tr**: XP kazanırken yüzen «+50 XP» animasyonu.

### `settings.badge_notifications`
- **de**: Abzeichen-Benachrichtigungen anzeigen
- **en**: Show badge notifications
- **el**: Εμφάνιση ειδοποιήσεων σημάτων
- **es**: Mostrar notificaciones de insignias
- **fr**: Afficher les notifications de badge
- **hi**: बैज सूचनाएँ दिखाएँ
- **id**: Tampilkan notifikasi lencana
- **ja**: バッジ通知を表示
- **ko**: 배지 알림 표시
- **pt**: Mostrar notificações de emblemas
- **tr**: Rozet bildirimlerini göster

### `settings.badge_notifications_help`
- **de**: Toast, wenn ein neues Abzeichen verdient wurde.
- **en**: Toast when a new badge is earned.
- **el**: Ειδοποίηση όταν κερδίζεις νέο σήμα.
- **es**: Aviso cuando se gana una insignia nueva.
- **fr**: Notification lorsqu'un nouveau badge est gagné.
- **hi**: नया बैज मिलने पर टोस्ट।
- **id**: Toast saat lencana baru diperoleh.
- **ja**: 新しいバッジを獲得したときの通知。
- **ko**: 새 배지를 얻으면 알림을 표시합니다.
- **pt**: Aviso quando um novo emblema é ganho.
- **tr**: Yeni rozet kazandığında bildirim.

### `settings.daily_session_goal`
- **de**: Tägliches Sitzungsziel
- **en**: Daily session goal
- **el**: Ημερήσιος στόχος συνεδριών
- **es**: Meta diaria de sesiones
- **fr**: Objectif quotidien de sessions
- **hi**: दैनिक सत्र लक्ष्य
- **id**: Sasaran sesi harian
- **ja**: 1日のセッション目標
- **ko**: 일일 세션 목표
- **pt**: Meta diária de sessões
- **tr**: Günlük oturum hedefi

### `settings.daily_session_goal_help`
- **de**: Sitzungen pro Tag als Fortschrittshinweis.
- **en**: Sessions per day shown as a progress hint.
- **el**: Συνεδρίες ανά ημέρα ως ένδειξη προόδου.
- **es**: Sesiones por día como indicador de progreso.
- **fr**: Sessions par jour comme indicateur de progression.
- **hi**: प्रगति संकेत के रूप में दिखाए जाने वाले प्रति दिन सत्र।
- **id**: Sesi per hari ditampilkan sebagai petunjuk kemajuan.
- **ja**: 進捗の目安として1日あたりのセッション数。
- **ko**: 진행 힌트로 표시되는 하루 세션 수입니다.
- **pt**: Sessões por dia como indicador de progresso.
- **tr**: İlerleme göstergesi olarak gün başına oturum.

### `settings.reset_progress`
- **de**: Fortschritt zurücksetzen
- **en**: Reset progress
- **el**: Επαναφορά προόδου
- **es**: Reiniciar progreso
- **fr**: Réinitialiser la progression
- **hi**: प्रगति रीसेट करें
- **id**: Atur ulang kemajuan
- **ja**: 進捗をリセット
- **ko**: 진행도 초기화
- **pt**: Redefinir progresso
- **tr**: İlerlemeyi sıfırla

### `settings.reset_progress_help`
- **de**: Löscht XP, Abzeichen und Serie unwiderruflich.
- **en**: Permanently delete XP, badges, and streak. Cannot be undone.
- **el**: Διαγράφει οριστικά XP, σήματα και σερί.
- **es**: Elimina XP, insignias y racha. No se puede deshacer.
- **fr**: Supprime XP, badges et série. Irréversible.
- **hi**: XP, बैज, और स्ट्रीक स्थायी रूप से हटाएँ। पूर्ववत नहीं किया जा सकता।
- **id**: Hapus XP, lencana, dan rentetan secara permanen. Tidak dapat dibatalkan.
- **ja**: XP、バッジ、ストリークを完全に削除。元に戻せません。
- **ko**: XP, 배지, 연속 기록을 영구히 삭제합니다. 되돌릴 수 없습니다.
- **pt**: Apaga XP, emblemas e sequência. Não pode ser desfeito.
- **tr**: XP, rozet ve seriyi kalıcı olarak siler. Geri alınamaz.

### `settings.reset_confirm_first`
- **de**: Erneut klicken zum Bestätigen
- **en**: Click again to confirm
- **el**: Πάτησε ξανά για επιβεβαίωση
- **es**: Haz clic de nuevo para confirmar
- **fr**: Clique encore pour confirmer
- **hi**: पुष्टि के लिए फिर से क्लिक करें
- **id**: Klik lagi untuk mengonfirmasi
- **ja**: 確認のためもう一度クリック
- **ko**: 확인하려면 다시 클릭하세요
- **pt**: Clique de novo para confirmar
- **tr**: Onaylamak için tekrar tıkla

### `settings.reset_confirm_second`
- **de**: Noch einmal klicken — endgültig löschen
- **en**: Click once more to delete forever
- **el**: Πάτησε ξανά για οριστική διαγραφή
- **es**: Haz clic una vez más para eliminar para siempre
- **fr**: Clique une dernière fois pour supprimer définitivement
- **hi**: हमेशा के लिए हटाने हेतु एक बार और क्लिक करें
- **id**: Klik sekali lagi untuk menghapus selamanya
- **ja**: 完全削除するにはもう一度クリック
- **ko**: 영구 삭제하려면 한 번 더 클릭하세요
- **pt**: Clique mais uma vez para apagar para sempre
- **tr**: Kalıcı silmek için bir kez daha tıkla

### `settings.section_voice`
- **de**: Sprache
- **en**: Voice
- **el**: Φωνή
- **es**: Voz
- **fr**: Voix
- **hi**: आवाज़
- **id**: Suara
- **ja**: 音声
- **ko**: 음성
- **pt**: Voz
- **tr**: Ses

### `settings.voice.tts_enabled`
- **de**: Sprechschaltflächen anzeigen
- **en**: Show speech buttons
- **el**: Εμφάνιση κουμπιών ομιλίας
- **es**: Mostrar botones de voz
- **fr**: Afficher les boutons de lecture
- **hi**: वाणी बटन दिखाएँ
- **id**: Tampilkan tombol ucapan
- **ja**: 音声ボタンを表示
- **ko**: 말하기 버튼 표시
- **pt**: Mostrar botões de voz
- **tr**: Konuşma düğmelerini göster

### `settings.voice.tts_enabled_help`
- **de**: Liest KI-Antworten vor, wenn du auf das Lautsprecher-Symbol klickst.
- **en**: Reads AI responses aloud when you click the speaker icon.
- **el**: Διαβάζει τις απαντήσεις της ΤΝ φωναχτά.
- **es**: Lee respuestas de IA en voz alta.
- **fr**: Lit les réponses IA à voix haute.
- **hi**: स्पीकर आइकन पर क्लिक करने पर AI उत्तरों को ज़ोर से पढ़ता है।
- **id**: Membacakan respons AI dengan keras saat Anda mengklik ikon pengeras suara.
- **ja**: スピーカーアイコンをクリックするとAI応答を読み上げます。
- **ko**: 스피커 아이콘을 클릭하면 AI 응답을 소리 내어 읽습니다.
- **pt**: Lê respostas da IA em voz alta.
- **tr**: YZ yanıtlarını sesli okur.

### `settings.voice.auto_play`
- **de**: KI-Antworten automatisch vorlesen
- **en**: Auto-play AI responses
- **el**: Αυτόματη αναπαραγωγή απαντήσεων ΤΝ
- **es**: Reproducir respuestas IA automáticamente
- **fr**: Lire automatiquement les réponses IA
- **hi**: AI उत्तर स्वतः चलाएँ
- **id**: Putar otomatis respons AI
- **ja**: AI応答を自動再生
- **ko**: AI 응답 자동 재생
- **pt**: Reproduzir respostas da IA automaticamente
- **tr**: YZ yanıtlarını otomatik oynat

### `settings.voice.auto_play_help`
- **de**: Spricht jede KI-Antwort automatisch (Standard aus).
- **en**: Speak each AI response automatically (default off).
- **el**: Διαβάζει αυτόματα κάθε απάντηση (από προεπιλογή ανενεργό).
- **es**: Habla cada respuesta automáticamente (predeterminado: desactivado).
- **fr**: Lit chaque réponse automatiquement (désactivé par défaut).
- **hi**: हर AI उत्तर को स्वचालित रूप से बोलें (डिफ़ॉल्ट रूप से बंद)।
- **id**: Ucapkan setiap respons AI secara otomatis (bawaan nonaktif).
- **ja**: 各AI応答を自動的に読み上げます（デフォルトはオフ）。
- **ko**: 각 AI 응답을 자동으로 소리 내어 읽습니다 (기본값은 꺼짐).
- **pt**: Fala cada resposta automaticamente (padrão: desativado).
- **tr**: Her yanıtı otomatik okur (varsayılan kapalı).

### `settings.voice.tts_voice`
- **de**: Stimme
- **en**: Voice
- **el**: Φωνή
- **es**: Voz
- **fr**: Voix
- **hi**: आवाज़
- **id**: Suara
- **ja**: 音声
- **ko**: 음성
- **pt**: Voz
- **tr**: Ses

### `settings.voice.tts_voice_help`
- **de**: Standard wählt die beste Übereinstimmung für deine Projektsprache.
- **en**: Default uses the closest match for your project language.
- **el**: Προεπιλογή: καλύτερη αντιστοίχιση με τη γλώσσα σου.
- **es**: Predeterminado: mejor coincidencia con tu idioma.
- **fr**: Par défaut : meilleure correspondance avec ta langue.
- **hi**: डिफ़ॉल्ट आपकी प्रोजेक्ट भाषा के लिए सबसे निकट मेल उपयोग करता है।
- **id**: Bawaan menggunakan kecocokan terdekat untuk bahasa proyek Anda.
- **ja**: デフォルトはプロジェクトの言語に最も近い音声。
- **ko**: 기본값은 프로젝트 언어에 가장 가까운 음성을 사용합니다.
- **pt**: Padrão: melhor correspondência com seu idioma.
- **tr**: Varsayılan: projenin diline en yakın eşleşme.

### `settings.voice.voice_default`
- **de**: Standard (auto)
- **en**: Default (auto-pick)
- **el**: Προεπιλογή (αυτόματο)
- **es**: Predeterminado (auto)
- **fr**: Défaut (auto)
- **hi**: डिफ़ॉल्ट (स्वतः-चयन)
- **id**: Bawaan (pilih otomatis)
- **ja**: デフォルト（自動）
- **ko**: 기본값 (자동 선택)
- **pt**: Padrão (auto)
- **tr**: Varsayılan (oto)

### `settings.voice.tts_rate`
- **de**: Tempo
- **en**: Rate
- **el**: Ταχύτητα
- **es**: Velocidad
- **fr**: Vitesse
- **hi**: गति
- **id**: Laju
- **ja**: 速度
- **ko**: 속도
- **pt**: Velocidade
- **tr**: Hız

### `settings.voice.tts_pitch`
- **de**: Tonhöhe
- **en**: Pitch
- **el**: Τόνος
- **es**: Tono
- **fr**: Hauteur
- **hi**: पिच
- **id**: Nada
- **ja**: ピッチ
- **ko**: 음높이
- **pt**: Tom
- **tr**: Perde

### `settings.voice.stt_enabled`
- **de**: Mikrofon-Schaltfläche anzeigen
- **en**: Show microphone button
- **el**: Εμφάνιση κουμπιού μικροφώνου
- **es**: Mostrar botón de micrófono
- **fr**: Afficher le bouton micro
- **hi**: माइक्रोफ़ोन बटन दिखाएँ
- **id**: Tampilkan tombol mikrofon
- **ja**: マイクボタンを表示
- **ko**: 마이크 버튼 표시
- **pt**: Mostrar botão do microfone
- **tr**: Mikrofon düğmesini göster

### `settings.voice.stt_enabled_help`
- **de**: Diktiere Antworten über die Spracherkennung des Browsers.
- **en**: Dictate your replies via the browser's speech recognition.
- **el**: Υπαγόρευσε απαντήσεις μέσω του προγράμματος περιήγησης.
- **es**: Dicta respuestas vía el navegador.
- **fr**: Dicte tes réponses via le navigateur.
- **hi**: ब्राउज़र की वाक् पहचान के माध्यम से अपने उत्तर बोलकर लिखें।
- **id**: Diktekan balasan Anda melalui pengenalan ucapan peramban.
- **ja**: ブラウザの音声認識で返信を口述します。
- **ko**: 브라우저의 음성 인식을 통해 답변을 받아쓰세요.
- **pt**: Dite respostas via o navegador.
- **tr**: Yanıtları tarayıcı üzerinden dikte et.

### `settings.voice.stt_lang`
- **de**: Diktiersprache überschreiben
- **en**: Dictation language override
- **el**: Παράκαμψη γλώσσας υπαγόρευσης
- **es**: Idioma de dictado
- **fr**: Langue de dictée
- **hi**: डिक्टेशन भाषा ओवरराइड
- **id**: Penggantian bahasa dikte
- **ja**: 音声入力言語の上書き
- **ko**: 받아쓰기 언어 재정의
- **pt**: Idioma de ditado
- **tr**: Dikte dili geçersiz kıl

### `settings.voice.stt_lang_help`
- **de**: Leer lassen für Projekt-/UI-Sprache. Format: BCP-47 (z.B. de-DE).
- **en**: Leave empty to use the project / UI language. Format: BCP-47 (e.g. en-US, es-ES).
- **el**: Κενό = γλώσσα έργου/UI. Μορφή: BCP-47 (el-GR).
- **es**: Vacío = idioma del proyecto/UI. Formato: BCP-47 (es-ES).
- **fr**: Vide = langue projet/UI. Format : BCP-47 (fr-FR).
- **hi**: प्रोजेक्ट / UI भाषा उपयोग करने हेतु खाली छोड़ें। प्रारूप: BCP-47 (जैसे en-US, es-ES)।
- **id**: Biarkan kosong untuk menggunakan bahasa proyek / UI. Format: BCP-47 (mis. en-US, es-ES).
- **ja**: 空 = プロジェクト/UI言語。形式: BCP-47 (ja-JP)。
- **ko**: 프로젝트 / UI 언어를 사용하려면 비워 두세요. 형식: BCP-47 (예: en-US, es-ES).
- **pt**: Vazio = idioma do projeto/UI. Formato: BCP-47 (pt-BR).
- **tr**: Boş = proje/UI dili. Biçim: BCP-47 (tr-TR).

### `settings.voice.pronunciation_enabled`
- **de**: Aussprachetraining
- **en**: Pronunciation Practice
- **el**: Εξάσκηση Προφοράς
- **es**: Práctica de Pronunciación
- **fr**: Pratique de Prononciation
- **hi**: उच्चारण अभ्यास
- **id**: Latihan Pengucapan
- **ja**: 発音練習
- **ko**: 발음 연습
- **pt**: Prática de Pronúncia
- **tr**: Telaffuz Alıştırması

### `settings.voice.pronunciation_enabled_help`
- **de**: Zeigt einen Schalter „Aussprachetraining" auf Dashboards von Sprach-Lernprojekten.
- **en**: Surfaces a 'Pronunciation Practice' button on language-learning project dashboards.
- **el**: Εμφανίζει κουμπί σε έργα γλωσσών.
- **es**: Muestra un botón en proyectos de idiomas.
- **fr**: Affiche un bouton sur les projets de langues.
- **hi**: भाषा-सीखने वाले प्रोजेक्ट डैशबोर्ड पर एक 'उच्चारण अभ्यास' बटन दिखाता है।
- **id**: Menampilkan tombol 'Latihan Pengucapan' di dasbor proyek pembelajaran bahasa.
- **ja**: 言語学習プロジェクトのダッシュボードに発音練習ボタンを表示します。
- **ko**: 언어 학습 프로젝트 대시보드에 '발음 연습' 버튼을 표시합니다.
- **pt**: Mostra um botão em projetos de idiomas.
- **tr**: Dil öğrenme projelerinde bir düğme gösterir.

### `settings.source_languages.title`
- **de**: Weitere Ausgangssprachen
- **en**: Additional source languages
- **el**: Επιπλέον γλώσσες προέλευσης
- **es**: Idiomas de origen adicionales
- **fr**: Langues source supplémentaires
- **hi**: अतिरिक्त स्रोत भाषाएँ
- **id**: Bahasa sumber tambahan
- **ja**: 追加の出発言語
- **ko**: 추가 출처 언어
- **pt**: Idiomas de origem adicionais
- **tr**: Ek kaynak diller

### `settings.source_languages.hint`
- **de**: Sprachen, die du auch sprichst. Lektionen für diese Ausgangssprachen erscheinen in deiner Hauptliste.
- **en**: Languages you also speak. Lessons written for these source languages appear in your main content list.
- **el**: Γλώσσες που επίσης μιλάς. Τα μαθήματα για αυτές τις γλώσσες προέλευσης εμφανίζονται στην κύρια λίστα σου.
- **es**: Idiomas que también hablas. Las lecciones escritas para estos idiomas de origen aparecen en tu lista principal.
- **fr**: Langues que vous parlez aussi. Les leçons écrites pour ces langues source apparaissent dans votre liste principale.
- **hi**: वे भाषाएँ जो आप भी बोलते हैं। इन स्रोत भाषाओं के लिए लिखे पाठ आपकी मुख्य सामग्री सूची में दिखाई देते हैं।
- **id**: Bahasa yang juga Anda gunakan. Pelajaran yang ditulis untuk bahasa sumber ini muncul di daftar konten utama Anda.
- **ja**: あなたが話せる他の言語。これらの出発言語向けのレッスンがメインの一覧に表示されます。
- **ko**: 당신이 함께 구사하는 언어입니다. 이 출처 언어로 작성된 레슨이 메인 콘텐츠 목록에 표시됩니다.
- **pt**: Idiomas que você também fala. As lições escritas para esses idiomas de origem aparecem na sua lista principal.
- **tr**: Ayrıca konuştuğunuz diller. Bu kaynak diller için yazılan dersler ana listenizde görünür.

### `settings.source_languages.app_language`
- **de**: App-Sprache
- **en**: app language
- **el**: γλώσσα εφαρμογής
- **es**: idioma de la app
- **fr**: langue de l'app
- **hi**: ऐप भाषा
- **id**: bahasa aplikasi
- **ja**: アプリの言語
- **ko**: 앱 언어
- **pt**: idioma do app
- **tr**: uygulama dili

### `settings.direction.title`
- **de**: Bevorzugte Übungsrichtung
- **en**: Preferred exercise direction
- **el**: Προτιμώμενη κατεύθυνση άσκησης
- **es**: Dirección de ejercicio preferida
- **fr**: Direction d'exercice préférée
- **hi**: पसंदीदा अभ्यास दिशा
- **id**: Arah latihan yang disukai
- **ja**: 優先する練習の方向
- **ko**: 선호 연습 방향
- **pt**: Direção de exercício preferida
- **tr**: Tercih edilen alıştırma yönü

### `settings.direction.hint`
- **de**: Wie adaptive Lektionen Erkennen (Zielsprache -> deine Sprache) und Produzieren (deine Sprache -> Zielsprache) ausbalancieren. Produzieren ist schwerer; Automatisch führt es ein, sobald das Erkennen sitzt.
- **en**: How adaptive lessons balance recognising (target -> your language) vs producing (your language -> target). Producing is harder; Automatic introduces it once recognition is solid.
- **el**: Πώς τα προσαρμοστικά μαθήματα ισορροπούν την αναγνώριση (γλώσσα-στόχος -> η γλώσσα σας) και την παραγωγή (η γλώσσα σας -> στόχος). Η παραγωγή είναι δυσκολότερη· η Αυτόματη την εισάγει όταν η αναγνώριση είναι στέρεη.
- **es**: Cómo las lecciones adaptativas equilibran reconocer (idioma de destino -> tu idioma) y producir (tu idioma -> destino). Producir es más difícil; Automático lo introduce cuando el reconocimiento es sólido.
- **fr**: Comment les leçons adaptatives équilibrent reconnaître (langue cible -> votre langue) et produire (votre langue -> cible). Produire est plus difficile ; Automatique l'introduit une fois la reconnaissance solide.
- **hi**: अनुकूली पाठ पहचानने (लक्ष्य -> आपकी भाषा) बनाम उत्पादन (आपकी भाषा -> लक्ष्य) को कैसे संतुलित करते हैं। उत्पादन कठिन है; पहचान मज़बूत होने पर स्वचालित इसे प्रस्तुत करता है।
- **id**: Bagaimana pelajaran adaptif menyeimbangkan mengenali (target -> bahasa Anda) vs memproduksi (bahasa Anda -> target). Memproduksi lebih sulit; Otomatis memperkenalkannya setelah pengenalan mantap.
- **ja**: 適応レッスンが認識（対象言語→あなたの言語）と産出（あなたの言語→対象言語）をどうバランスするか。産出はより難しく、自動は認識が定着してから導入します。
- **ko**: 적응형 레슨이 인식(목표어 -> 당신의 언어)과 산출(당신의 언어 -> 목표어)을 어떻게 균형 잡을지 정합니다. 산출이 더 어렵습니다. 자동은 인식이 탄탄해지면 산출을 도입합니다.
- **pt**: Como as lições adaptativas equilibram reconhecer (idioma de destino -> seu idioma) e produzir (seu idioma -> destino). Produzir é mais difícil; Automático o introduz quando o reconhecimento está sólido.
- **tr**: Uyarlanabilir derslerin tanımayı (hedef dil -> sizin diliniz) ve üretmeyi (sizin diliniz -> hedef) nasıl dengelediği. Üretmek daha zordur; Otomatik, tanıma sağlamlaştığında bunu devreye sokar.

### `settings.direction.label`
- **de**: Richtung
- **en**: Direction
- **el**: Κατεύθυνση
- **es**: Dirección
- **fr**: Direction
- **hi**: दिशा
- **id**: Arah
- **ja**: 方向
- **ko**: 방향
- **pt**: Direção
- **tr**: Yön

### `settings.direction.auto`
- **de**: Automatisch
- **en**: Automatic
- **el**: Αυτόματη
- **es**: Automático
- **fr**: Automatique
- **hi**: स्वचालित
- **id**: Otomatis
- **ja**: 自動
- **ko**: 자동
- **pt**: Automático
- **tr**: Otomatik

### `settings.direction.receptive_first`
- **de**: Zuerst erkennen
- **en**: Recognise first
- **el**: Πρώτα αναγνώριση
- **es**: Reconocer primero
- **fr**: Reconnaître d'abord
- **hi**: पहले पहचानें
- **id**: Kenali dulu
- **ja**: まず認識
- **ko**: 인식 먼저
- **pt**: Reconhecer primeiro
- **tr**: Önce tanıma

### `settings.direction.productive_focus`
- **de**: Produzieren
- **en**: Produce
- **el**: Παραγωγή
- **es**: Producir
- **fr**: Produire
- **hi**: उत्पादन करें
- **id**: Produksi
- **ja**: 産出
- **ko**: 산출
- **pt**: Produzir
- **tr**: Üretme

### `settings.direction.balanced`
- **de**: Ausgeglichen
- **en**: Balanced
- **el**: Ισορροπημένη
- **es**: Equilibrado
- **fr**: Équilibré
- **hi**: संतुलित
- **id**: Seimbang
- **ja**: バランス
- **ko**: 균형
- **pt**: Equilibrado
- **tr**: Dengeli

### `settings.matching_resolve.title`
- **de**: Auflösungs-Effekt
- **en**: Solve animation
- **el**: Εφέ επίλυσης
- **es**: Animación al resolver
- **fr**: Animation de résolution
- **hi**: हल एनिमेशन
- **id**: Animasi penyelesaian
- **ja**: 解答アニメーション
- **ko**: 정답 애니메이션
- **pt**: Animação de resolução
- **tr**: Çözme animasyonu

### `settings.matching_resolve.hint`
- **de**: Wie die Zuordnungsübung die korrekten Paare zeigt, wenn du nach dem Prüfen auf 'Auflösen' tippst.
- **en**: How the matching exercise reveals the correct pairs when you press 'Solve' after checking.
- **el**: Πώς η άσκηση αντιστοίχισης εμφανίζει τα σωστά ζεύγη όταν πατάτε 'Επίλυση' μετά τον έλεγχο.
- **es**: Cómo el ejercicio de emparejamiento muestra los pares correctos al pulsar 'Resolver' tras comprobar.
- **fr**: Comment l'exercice d'association révèle les paires correctes lorsque vous appuyez sur 'Résoudre' après vérification.
- **hi**: जाँचने के बाद 'हल दिखाएँ' दबाने पर मिलान अभ्यास सही जोड़े कैसे दिखाता है।
- **id**: Cara latihan menjodohkan menampilkan pasangan yang benar saat Anda menekan 'Selesaikan' setelah memeriksa.
- **ja**: 確認後に「解答を表示」を押したとき、マッチング演習が正しいペアをどのように表示するか。
- **ko**: 확인 후 '정답 보기'를 누르면 짝맞추기 연습이 올바른 짝을 어떻게 표시하는지.
- **pt**: Como o exercício de correspondência revela os pares corretos ao tocar em 'Resolver' após verificar.
- **tr**: Eşleştirme alıştırması, kontrolden sonra 'Çöz'e bastığınızda doğru çiftleri nasıl gösterir.

### `settings.matching_resolve.label`
- **de**: Effekt
- **en**: Effect
- **el**: Εφέ
- **es**: Efecto
- **fr**: Effet
- **hi**: प्रभाव
- **id**: Efek
- **ja**: 効果
- **ko**: 효과
- **pt**: Efeito
- **tr**: Efekt

### `settings.matching_resolve.slide`
- **de**: Gleiten
- **en**: Slide
- **el**: Ολίσθηση
- **es**: Deslizar
- **fr**: Glisser
- **hi**: स्लाइड
- **id**: Geser
- **ja**: スライド
- **ko**: 슬라이드
- **pt**: Deslizar
- **tr**: Kaydır

### `settings.matching_resolve.color`
- **de**: Farbe
- **en**: Color
- **el**: Χρώμα
- **es**: Color
- **fr**: Couleur
- **hi**: रंग
- **id**: Warna
- **ja**: 色
- **ko**: 색상
- **pt**: Cor
- **tr**: Renk

### `settings.matching_resolve.connect`
- **de**: Verbinden
- **en**: Connect
- **el**: Σύνδεση
- **es**: Conectar
- **fr**: Relier
- **hi**: जोड़ें
- **id**: Hubungkan
- **ja**: 線でつなぐ
- **ko**: 연결
- **pt**: Conectar
- **tr**: Bağla

### `settings.matching_resolve.stack`
- **de**: Stapeln
- **en**: Stack
- **el**: Στοίβαξη
- **es**: Apilar
- **fr**: Empiler
- **hi**: ढेर
- **id**: Tumpuk
- **ja**: 重ねる
- **ko**: 쌓기
- **pt**: Empilhar
- **tr**: Yığ

### `settings.paused_retention.title`
- **de**: Pausierte Lektionen aufbewahren
- **en**: Paused lesson retention
- **el**: Διατήρηση παυσαρισμένων μαθημάτων
- **es**: Retención de lecciones pausadas
- **fr**: Conservation des leçons en pause
- **hi**: रोके गए पाठ की अवधारण
- **id**: Retensi pelajaran yang dijeda
- **ja**: 一時停止中のレッスンの保持期間
- **ko**: 일시 정지된 레슨 보관
- **pt**: Retenção de aulas pausadas
- **tr**: Duraklatılmış ders saklama süresi

### `settings.paused_retention.hint`
- **de**: Pausierte Lektionen, die älter als dieser Zeitraum sind, werden automatisch aufgegeben. Bis zu 10 pausierte Lektionen werden unabhängig vom Alter behalten.
- **en**: Paused lessons older than this are automatically abandoned. Up to 10 paused lessons are kept regardless of age.
- **el**: Τα παυσαρισμένα μαθήματα που είναι παλαιότερα από αυτή την περίοδο εγκαταλείπονται αυτόματα. Διατηρούνται έως 10 παυσαρισμένα μαθήματα ανεξάρτητα από την ηλικία τους.
- **es**: Las lecciones pausadas más antiguas que este período se abandonan automáticamente. Se conservan hasta 10 lecciones pausadas independientemente de su antigüedad.
- **fr**: Les leçons en pause plus anciennes que cette période sont automatiquement abandonnées. Jusqu'à 10 leçons en pause sont conservées quel que soit leur âge.
- **hi**: इससे पुराने रोके गए पाठ स्वचालित रूप से छोड़ दिए जाते हैं। आयु की परवाह किए बिना अधिकतम 10 रोके गए पाठ रखे जाते हैं।
- **id**: Pelajaran yang dijeda lebih lama dari ini secara otomatis ditinggalkan. Hingga 10 pelajaran yang dijeda tetap disimpan terlepas dari usianya.
- **ja**: この期間より古い一時停止中のレッスンは自動的に放棄されます。年齢に関係なく、最大10件の一時停止中のレッスンが保持されます。
- **ko**: 이 기간보다 오래된 일시 정지 레슨은 자동으로 중단됩니다. 나이와 관계없이 일시 정지 레슨 최대 10개는 보관됩니다.
- **pt**: As aulas pausadas mais antigas que este período são automaticamente abandonadas. Até 10 aulas pausadas são mantidas independentemente da idade.
- **tr**: Bu süreden daha eski duraklatılmış dersler otomatik olarak terk edilir. Yaşa bakılmaksızın en fazla 10 duraklatılmış ders saklanır.

### `settings.paused_retention.label`
- **de**: Pausierte Lektionen behalten für
- **en**: Keep paused lessons for
- **el**: Διατήρηση παυσαρισμένων μαθημάτων για
- **es**: Conservar lecciones pausadas por
- **fr**: Conserver les leçons en pause pendant
- **hi**: रोके गए पाठ इतने समय तक रखें
- **id**: Simpan pelajaran yang dijeda selama
- **ja**: 一時停止中のレッスンを保持する期間
- **ko**: 일시 정지 레슨 보관 기간
- **pt**: Manter aulas pausadas por
- **tr**: Duraklatılmış dersleri şu süre boyunca sakla

### `settings.paused_retention.7_days`
- **de**: 7 Tage
- **en**: 7 days
- **el**: 7 ημέρες
- **es**: 7 días
- **fr**: 7 jours
- **hi**: 7 दिन
- **id**: 7 hari
- **ja**: 7日間
- **ko**: 7일
- **pt**: 7 dias
- **tr**: 7 gün

### `settings.paused_retention.14_days`
- **de**: 14 Tage
- **en**: 14 days
- **el**: 14 ημέρες
- **es**: 14 días
- **fr**: 14 jours
- **hi**: 14 दिन
- **id**: 14 hari
- **ja**: 14日間
- **ko**: 14일
- **pt**: 14 dias
- **tr**: 14 gün

### `settings.paused_retention.30_days`
- **de**: 30 Tage
- **en**: 30 days
- **el**: 30 ημέρες
- **es**: 30 días
- **fr**: 30 jours
- **hi**: 30 दिन
- **id**: 30 hari
- **ja**: 30日間
- **ko**: 30일
- **pt**: 30 dias
- **tr**: 30 gün

### `settings.paused_retention.60_days`
- **de**: 60 Tage
- **en**: 60 days
- **el**: 60 ημέρες
- **es**: 60 días
- **fr**: 60 jours
- **hi**: 60 दिन
- **id**: 60 hari
- **ja**: 60日間
- **ko**: 60일
- **pt**: 60 dias
- **tr**: 60 gün

### `settings.paused_retention.never`
- **de**: Nie
- **en**: Never
- **el**: Ποτέ
- **es**: Nunca
- **fr**: Jamais
- **hi**: कभी नहीं
- **id**: Tidak pernah
- **ja**: 無期限
- **ko**: 안 함
- **pt**: Nunca
- **tr**: Hiçbir zaman

### `settings.review_limit.label`
- **de**: Fragen pro Wiederholung
- **en**: Questions per review
- **el**: Ερωτήσεις ανά επανάληψη
- **es**: Preguntas por repaso
- **fr**: Questions par révision
- **hi**: प्रति समीक्षा प्रश्न
- **id**: Pertanyaan per ulasan
- **ja**: 復習あたりの問題数
- **ko**: 복습당 문제 수
- **pt**: Perguntas por revisão
- **tr**: Tekrar başına soru

### `settings.review_limit.desc`
- **de**: Wie viele Elemente eine Wiederholungssitzung zeigt, bevor sie endet. Weitere fällige Elemente kommen in die nächste Runde.
- **en**: How many elements one review session presents before it ends. More due items roll over to the next round.
- **el**: Πόσα στοιχεία παρουσιάζει μια συνεδρία επανάληψης πριν τελειώσει. Τα υπόλοιπα μεταφέρονται στον επόμενο γύρο.
- **es**: Cuántos elementos muestra una sesión de repaso antes de terminar. Los elementos pendientes pasan a la siguiente ronda.
- **fr**: Combien d'éléments une session de révision présente avant de se terminer. Les éléments restants passent au tour suivant.
- **hi**: एक समीक्षा सत्र समाप्त होने से पहले कितने तत्व दिखाता है। शेष तत्व अगले राउंड में चले जाते हैं।
- **id**: Berapa banyak elemen yang ditampilkan satu sesi ulasan sebelum berakhir. Item jatuh tempo lainnya dialihkan ke putaran berikutnya.
- **ja**: 1回の復習セッションで終了前に出題する要素数。残りの要素は次のラウンドに回ります。
- **ko**: 복습 세션이 끝나기 전에 제시하는 요소 수입니다. 남은 항목은 다음 회차로 넘어갑니다.
- **pt**: Quantos elementos uma sessão de revisão apresenta antes de terminar. Os restantes passam para a ronda seguinte.
- **tr**: Bir tekrar oturumunun bitmeden önce kaç öğe gösterdiği. Kalan öğeler sonraki tura aktarılır.

### `settings.max_lesson_size.title`
- **de**: Maximale Lektionsgröße
- **en**: Maximum lesson size
- **el**: Μέγιστο μέγεθος μαθήματος
- **es**: Tamaño máximo de lección
- **fr**: Taille maximale de leçon
- **hi**: अधिकतम पाठ आकार
- **id**: Ukuran pelajaran maksimum
- **ja**: レッスンの最大サイズ
- **ko**: 최대 레슨 크기
- **pt**: Tamanho máximo de aula
- **tr**: Maksimum ders boyutu

### `settings.max_lesson_size.hint`
- **de**: Wenn eine lange Chat-Analyse als Offline-Lektion gespeichert wird, werden Lektionen mit mehr als dieser Anzahl an Schritten automatisch in mehrere Teile aufgeteilt.
- **en**: When saving a long chat analysis as an offline lesson, lessons with more than this many steps are automatically split into multiple parts.
- **el**: Κατά την αποθήκευση μιας μεγάλης ανάλυσης συνομιλίας ως μάθημα εκτός σύνδεσης, τα μαθήματα με περισσότερα βήματα από αυτόν τον αριθμό χωρίζονται αυτόματα σε πολλά μέρη.
- **es**: Al guardar un análisis de chat largo como lección sin conexión, las lecciones con más pasos que este número se dividen automáticamente en varias partes.
- **fr**: Lors de l'enregistrement d'une longue analyse de chat comme leçon hors ligne, les leçons avec plus d'étapes que ce nombre sont automatiquement divisées en plusieurs parties.
- **hi**: किसी लंबे चैट विश्लेषण को ऑफ़लाइन पाठ के रूप में सहेजते समय, इससे अधिक चरणों वाले पाठ स्वचालित रूप से कई भागों में विभाजित हो जाते हैं।
- **id**: Saat menyimpan analisis obrolan panjang sebagai pelajaran luring, pelajaran dengan langkah lebih dari ini secara otomatis dibagi menjadi beberapa bagian.
- **ja**: 長いチャット分析をオフラインレッスンとして保存する場合、このステップ数を超えるレッスンは自動的に複数のパートに分割されます。
- **ko**: 긴 채팅 분석을 오프라인 레슨으로 저장할 때, 이 단계 수를 초과하는 레슨은 자동으로 여러 부분으로 나뉩니다.
- **pt**: Ao salvar uma longa análise de chat como aula offline, as aulas com mais etapas que este número são automaticamente divididas em várias partes.
- **tr**: Uzun bir sohbet analizini çevrimdışı ders olarak kaydederken, bu sayıdan fazla adıma sahip dersler otomatik olarak birden fazla parçaya bölünür.

### `settings.max_lesson_size.label`
- **de**: Schritte pro Teil
- **en**: Steps per part
- **el**: Βήματα ανά μέρος
- **es**: Pasos por parte
- **fr**: Étapes par partie
- **hi**: प्रति भाग चरण
- **id**: Langkah per bagian
- **ja**: パートあたりのステップ数
- **ko**: 부분당 단계 수
- **pt**: Etapas por parte
- **tr**: Bölüm başına adım sayısı

### `settings.max_lesson_size.range_hint`
- **de**: (Standard {default}, Bereich {min}–{max})
- **en**: (default {default}, range {min}–{max})
- **el**: (προεπιλογή {default}, εύρος {min}–{max})
- **es**: (predeterminado {default}, rango {min}–{max})
- **fr**: (défaut {default}, plage {min}–{max})
- **hi**: (डिफ़ॉल्ट {default}, श्रेणी {min}–{max})
- **id**: (bawaan {default}, rentang {min}–{max})
- **ja**: （デフォルト {default}、範囲 {min}–{max}）
- **ko**: (기본값 {default}, 범위 {min}–{max})
- **pt**: (padrão {default}, intervalo {min}–{max})
- **tr**: (varsayılan {default}, aralık {min}–{max})

### `settings.danger_zone_backup_button`
- **de**: Backup erstellen
- **en**: Create backup
- **el**: Δημιουργία αντιγράφου ασφαλείας
- **es**: Crear copia de seguridad
- **fr**: Créer une sauvegarde
- **hi**: बैकअप बनाएँ
- **id**: Buat cadangan
- **ja**: バックアップを作成
- **ko**: 백업 만들기
- **pt**: Criar backup
- **tr**: Yedek oluştur

### `settings.danger_zone_backup_offer`
- **de**: Zuerst ein Backup erstellen?
- **en**: Create a backup first?
- **el**: Δημιουργία αντιγράφου ασφαλείας πρώτα;
- **es**: ¿Crear primero una copia de seguridad?
- **fr**: Créer d'abord une sauvegarde ?
- **hi**: पहले बैकअप बनाएँ?
- **id**: Buat cadangan dulu?
- **ja**: 先にバックアップを作成しますか？
- **ko**: 먼저 백업을 만들까요?
- **pt**: Criar um backup primeiro?
- **tr**: Önce bir yedek oluşturulsun mu?

### `settings.danger_zone_cancel`
- **de**: Abbrechen
- **en**: Cancel
- **el**: Άκυρο
- **es**: Cancelar
- **fr**: Annuler
- **hi**: रद्द करें
- **id**: Batal
- **ja**: キャンセル
- **ko**: 취소
- **pt**: Cancelar
- **tr**: İptal

### `settings.danger_zone_complete_toast`
- **de**: Alle Daten wurden gelöscht.
- **en**: All data has been deleted.
- **el**: Όλα τα δεδομένα διαγράφηκαν.
- **es**: Se han eliminado todos los datos.
- **fr**: Toutes les données ont été supprimées.
- **hi**: सभी डेटा हटा दिया गया है।
- **id**: Semua data telah dihapus.
- **ja**: すべてのデータが削除されました。
- **ko**: 모든 데이터가 삭제되었습니다.
- **pt**: Todos os dados foram excluídos.
- **tr**: Tüm veriler silindi.

### `settings.danger_zone_confirm_prompt`
- **de**: Zum Bestätigen RESET eingeben
- **en**: Type RESET to confirm
- **el**: Πληκτρολογήστε RESET για επιβεβαίωση
- **es**: Escribe RESET para confirmar
- **fr**: Tapez RESET pour confirmer
- **hi**: पुष्टि के लिए RESET टाइप करें
- **id**: Ketik RESET untuk mengonfirmasi
- **ja**: 確認のため RESET と入力
- **ko**: 확인하려면 RESET을 입력하세요
- **pt**: Digite RESET para confirmar
- **tr**: Onaylamak için RESET yazın

### `settings.danger_zone_continue`
- **de**: Weiter
- **en**: Continue
- **el**: Συνέχεια
- **es**: Continuar
- **fr**: Continuer
- **hi**: जारी रखें
- **id**: Lanjutkan
- **ja**: 続行
- **ko**: 계속
- **pt**: Continuar
- **tr**: Devam

### `settings.danger_zone_failed_toast`
- **de**: Zurücksetzen fehlgeschlagen:
- **en**: Reset failed:
- **el**: Η επαναφορά απέτυχε:
- **es**: Error al restablecer:
- **fr**: Échec de la réinitialisation :
- **hi**: रीसेट विफल:
- **id**: Atur ulang gagal:
- **ja**: リセットに失敗しました：
- **ko**: 초기화 실패:
- **pt**: Falha ao redefinir:
- **tr**: Sıfırlama başarısız:

### `settings.danger_zone_final_button`
- **de**: Endgültig löschen
- **en**: Delete permanently
- **el**: Οριστική διαγραφή
- **es**: Eliminar permanentemente
- **fr**: Supprimer définitivement
- **hi**: स्थायी रूप से हटाएँ
- **id**: Hapus permanen
- **ja**: 完全に削除
- **ko**: 영구 삭제
- **pt**: Excluir permanentemente
- **tr**: Kalıcı olarak sil

### `settings.danger_zone_heading`
- **de**: Gefahrenzone
- **en**: Danger Zone
- **el**: Ζώνη κινδύνου
- **es**: Zona de peligro
- **fr**: Zone de danger
- **hi**: ख़तरा क्षेत्र
- **id**: Zona Berbahaya
- **ja**: 危険ゾーン
- **ko**: 위험 구역
- **pt**: Zona de perigo
- **tr**: Tehlikeli bölge

### `settings.danger_zone_input_placeholder`
- **de**: RESET
- **en**: RESET
- **el**: RESET
- **es**: RESET
- **fr**: RESET
- **hi**: RESET
- **id**: RESET
- **ja**: RESET
- **ko**: RESET
- **pt**: RESET
- **tr**: RESET

### `settings.danger_zone_intro`
- **de**: Lösche dauerhaft jeden Teil des Lernzustands auf diesem Gerät.
- **en**: Permanently delete every piece of learner state on this device.
- **el**: Διαγράψτε οριστικά κάθε στοιχείο της κατάστασης μάθησης σε αυτή τη συσκευή.
- **es**: Elimina permanentemente todo el estado de aprendizaje en este dispositivo.
- **fr**: Supprimez définitivement tout l'état d'apprentissage sur cet appareil.
- **hi**: इस डिवाइस पर शिक्षार्थी की हर स्थिति स्थायी रूप से हटाएँ।
- **id**: Hapus permanen setiap bagian status pembelajar di perangkat ini.
- **ja**: このデバイス上のすべての学習状態を完全に削除します。
- **ko**: 이 기기의 모든 학습자 상태를 영구히 삭제합니다.
- **pt**: Exclua permanentemente todo o estado de aprendizagem neste dispositivo.
- **tr**: Bu cihazdaki tüm öğrenme durumunu kalıcı olarak silin.

### `settings.danger_zone_reset_button`
- **de**: Alles zurücksetzen
- **en**: Reset Everything
- **el**: Επαναφορά όλων
- **es**: Restablecer todo
- **fr**: Tout réinitialiser
- **hi**: सब कुछ रीसेट करें
- **id**: Atur Ulang Semuanya
- **ja**: すべてリセット
- **ko**: 전체 초기화
- **pt**: Redefinir tudo
- **tr**: Her şeyi sıfırla

### `settings.danger_zone_warning`
- **de**: Dies löscht ALLE deine Lerndaten dauerhaft — Sitzungen, Fortschritt, Profile, Lehrpläne, Importe, Anki-Karten, Einstellungen und API-Schlüssel. Diese Aktion kann NICHT rückgängig gemacht werden.
- **en**: This deletes ALL your learning data permanently — sessions, progress, profiles, curricula, imports, Anki cards, settings and API keys. This action CANNOT be undone.
- **el**: Αυτό διαγράφει ΟΛΑ τα δεδομένα μάθησής σας οριστικά — συνεδρίες, πρόοδο, προφίλ, προγράμματα σπουδών, εισαγωγές, κάρτες Anki, ρυθμίσεις και κλειδιά API. Αυτή η ενέργεια ΔΕΝ μπορεί να αναιρεθεί.
- **es**: Esto elimina TODOS tus datos de aprendizaje de forma permanente: sesiones, progreso, perfiles, currículos, importaciones, tarjetas Anki, ajustes y claves de API. Esta acción NO se puede deshacer.
- **fr**: Cela supprime DÉFINITIVEMENT toutes vos données d'apprentissage — sessions, progression, profils, programmes, imports, cartes Anki, paramètres et clés d'API. Cette action est IRRÉVERSIBLE.
- **hi**: यह आपका सभी सीखने का डेटा स्थायी रूप से हटा देता है — सत्र, प्रगति, प्रोफ़ाइल, पाठ्यक्रम, आयात, Anki कार्ड, सेटिंग्स और API कुंजियाँ। यह क्रिया पूर्ववत नहीं की जा सकती।
- **id**: Ini menghapus SEMUA data pembelajaran Anda secara permanen — sesi, kemajuan, profil, kurikulum, impor, kartu Anki, pengaturan, dan kunci API. Tindakan ini TIDAK DAPAT dibatalkan.
- **ja**: これにより、すべての学習データ（セッション、進捗、プロファイル、カリキュラム、インポート、Anki カード、設定、API キー）が完全に削除されます。この操作は元に戻せません。
- **ko**: 이 작업은 모든 학습 데이터 — 세션, 진행도, 프로필, 커리큘럼, 가져오기, Anki 카드, 설정, API 키 —를 영구히 삭제합니다. 이 작업은 되돌릴 수 없습니다.
- **pt**: Isto exclui TODOS os seus dados de aprendizagem permanentemente — sessões, progresso, perfis, currículos, importações, cartões Anki, configurações e chaves de API. Esta ação NÃO pode ser desfeita.
- **tr**: Bu, TÜM öğrenme verilerinizi kalıcı olarak siler — oturumlar, ilerleme, profiller, müfredatlar, içe aktarmalar, Anki kartları, ayarlar ve API anahtarları. Bu işlem GERİ ALINAMAZ.

### `settings.section_sync`
- **de**: Sync
- **en**: Sync
- **el**: Συγχρονισμός
- **es**: Sincronización
- **fr**: Synchronisation
- **hi**: सिंक
- **id**: Sinkronisasi
- **ja**: 同期
- **ko**: 동기화
- **pt**: Sincronização
- **tr**: Eşitleme

## `methods`

### `methods.deductive.label`
- **de**: Deduktiv
- **en**: Deductive
- **el**: Παραγωγική (από γενικό)
- **es**: Deductivo
- **fr**: Deductif
- **hi**: निगमनात्मक
- **id**: Deduktif
- **ja**: 演繹的
- **ko**: 연역적
- **pt**: Dedutivo
- **tr**: Tümdengelimsel

### `methods.deductive.summary`
- **de**: Vom Allgemeinen zum Besonderen — Regeln zuerst, Beispiele danach.
- **en**: General to specific — rules first, examples after.
- **el**: Από το γενικό στο ειδικό — πρώτα οι κανόνες, μετά τα παραδείγματα.
- **es**: De lo general a lo particular — primero las reglas, luego los ejemplos.
- **fr**: Du general au particulier — d'abord les regles, puis les exemples.
- **hi**: सामान्य से विशिष्ट — पहले नियम, बाद में उदाहरण।
- **id**: Umum ke khusus — aturan dulu, contoh kemudian.
- **ja**: 一般から具体へ — まず規則、次に例。
- **ko**: 일반에서 구체로 — 규칙을 먼저, 예시는 나중에.
- **pt**: Do geral ao específico — regras primeiro, exemplos depois.
- **tr**: Genelden özele — önce kurallar, sonra örnekler.

### `methods.inductive.label`
- **de**: Induktiv
- **en**: Inductive
- **el**: Επαγωγική (από ειδικό)
- **es**: Inductivo
- **fr**: Inductif
- **hi**: आगमनात्मक
- **id**: Induktif
- **ja**: 帰納的
- **ko**: 귀납적
- **pt**: Indutivo
- **tr**: Tümevarımsal

### `methods.inductive.summary`
- **de**: Vom Besonderen zum Allgemeinen — Beispiele zuerst, Regeln ableiten.
- **en**: Specific to general — examples first, derive the rule.
- **el**: Από το ειδικό στο γενικό — πρώτα τα παραδείγματα, μετά ο κανόνας.
- **es**: De lo particular a lo general — primero los ejemplos, luego la regla.
- **fr**: Du particulier au general — d'abord les exemples, puis la regle.
- **hi**: विशिष्ट से सामान्य — पहले उदाहरण, फिर नियम निकालें।
- **id**: Khusus ke umum — contoh dulu, turunkan aturannya.
- **ja**: 具体から一般へ — まず例、規則は自分で導く。
- **ko**: 구체에서 일반으로 — 예시를 먼저, 규칙을 도출.
- **pt**: Do específico ao geral — exemplos primeiro, deduza a regra.
- **tr**: Özelden genele — önce örnekler, sonra kuralı çıkar.

### `methods.error_based.label`
- **de**: Fehlerzentriert
- **en**: Error-based
- **el**: Με βάση το λάθος
- **es**: Basado en errores
- **fr**: Centre sur l'erreur
- **hi**: त्रुटि-आधारित
- **id**: Berbasis kesalahan
- **ja**: 誤りベース
- **ko**: 오류 기반
- **pt**: Baseado em erros
- **tr**: Hataya dayalı

### `methods.error_based.summary`
- **de**: Aus Fehlern lernen — Korrektur mit Erklärung.
- **en**: Learn from mistakes — correction plus explanation.
- **el**: Μάθηση από τα λάθη — διόρθωση με εξήγηση.
- **es**: Aprender de los errores — correccion con explicacion.
- **fr**: Apprendre des erreurs — correction avec explication.
- **hi**: गलतियों से सीखें — सुधार के साथ व्याख्या।
- **id**: Belajar dari kesalahan — koreksi ditambah penjelasan.
- **ja**: 間違いから学ぶ — 訂正と説明をセットで。
- **ko**: 실수에서 배우기 — 교정과 설명.
- **pt**: Aprenda com os erros — correção com explicação.
- **tr**: Hatalardan öğren — düzeltme ve açıklama birlikte.

### `methods.dialogic.label`
- **de**: Dialogisch
- **en**: Dialogic
- **el**: Διαλογική
- **es**: Dialogico
- **fr**: Dialogique
- **hi**: संवादात्मक
- **id**: Dialogis
- **ja**: 対話的
- **ko**: 대화적
- **pt**: Dialógico
- **tr**: Diyaloğa dayalı

### `methods.dialogic.summary`
- **de**: Im Gespräch denken — Stress senken, Motivation aufbauen.
- **en**: Think in conversation — lower stress, build motivation.
- **el**: Σκέψη μέσα από διάλογο — μείωση άγχους, χτίσιμο κινήτρου.
- **es**: Pensar en conversacion — bajar el estres, construir motivacion.
- **fr**: Penser en conversation — reduire le stress, batir la motivation.
- **hi**: बातचीत में सोचें — कम तनाव, प्रेरणा बढ़ाएँ।
- **id**: Berpikir dalam percakapan — kurangi stres, bangun motivasi.
- **ja**: 会話の中で考える — ストレスを下げ、動機を高める。
- **ko**: 대화 속에서 생각하기 — 스트레스를 낮추고 동기를 키웁니다.
- **pt**: Pensar em conversa — menos estresse, mais motivação.
- **tr**: Sohbet içinde düşün — daha az stres, daha çok motivasyon.

### `methods.contextual.label`
- **de**: Kontextuell
- **en**: Contextual
- **el**: Πλαισιωμένη
- **es**: Contextual
- **fr**: Contextuel
- **hi**: प्रासंगिक
- **id**: Kontekstual
- **ja**: 文脈的
- **ko**: 맥락적
- **pt**: Contextual
- **tr**: Bağlamsal

### `methods.contextual.summary`
- **de**: Im echten Kontext anwenden — Transfer üben.
- **en**: Apply in a real context — practice transfer.
- **el**: Εφαρμογή σε πραγματικό πλαίσιο — εξάσκηση μεταφοράς.
- **es**: Aplicar en contexto real — practicar la transferencia.
- **fr**: Appliquer en contexte reel — pratiquer le transfert.
- **hi**: वास्तविक संदर्भ में लागू करें — स्थानांतरण का अभ्यास।
- **id**: Terapkan dalam konteks nyata — latih transfer.
- **ja**: 実際の文脈で応用する — 転移を練習する。
- **ko**: 실제 맥락에서 적용하기 — 전이를 연습합니다.
- **pt**: Aplicar em um contexto real — transferir na prática.
- **tr**: Gerçek bir bağlamda uygula — aktarımı pratik et.

### `methods.ai_adaptive.label`
- **de**: KI-adaptiv
- **en**: AI-adaptive
- **el**: Προσαρμοστική AI
- **es**: IA adaptativa
- **fr**: IA adaptative
- **hi**: AI-अनुकूली
- **id**: Adaptif-AI
- **ja**: AI 適応型
- **ko**: AI 적응형
- **pt**: Adaptativo por IA
- **tr**: YZ-uyarlanır

### `methods.ai_adaptive.summary`
- **de**: Die KI wählt für dich die jeweils beste Methode.
- **en**: The AI picks the method that fits you best.
- **el**: Η AI επιλέγει τη μέθοδο που σου ταιριάζει καλύτερα.
- **es**: La IA elige el metodo que mejor te encaja.
- **fr**: L'IA choisit la methode qui te convient le mieux.
- **hi**: AI वह विधि चुनता है जो आपके लिए सबसे उपयुक्त हो।
- **id**: AI memilih metode yang paling cocok untuk Anda.
- **ja**: AI があなたに最適な方法を選びます。
- **ko**: AI가 당신에게 가장 잘 맞는 학습법을 선택합니다.
- **pt**: A IA escolhe o método que melhor se encaixa em você.
- **tr**: YZ sana en uygun yöntemi seçer.

## `cycle_steps`

### `cycle_steps.input.label`
- **de**: Eingabe
- **en**: Input
- **el**: Είσοδος
- **es**: Entrada
- **fr**: Entree
- **hi**: इनपुट
- **id**: Masukan
- **ja**: インプット
- **ko**: 입력
- **pt**: Entrada
- **tr**: Girdi

### `cycle_steps.input.description`
- **de**: Information, Beispiel oder Aufgabe wird vorgestellt.
- **en**: Information, example or task is presented.
- **el**: Παρουσιάζεται πληροφορία, παράδειγμα ή εργασία.
- **es**: Se presenta informacion, ejemplo o tarea.
- **fr**: Information, exemple ou tache presentes.
- **hi**: जानकारी, उदाहरण या कार्य प्रस्तुत किया जाता है।
- **id**: Informasi, contoh, atau tugas disajikan.
- **ja**: 情報、例、または課題が提示されます。
- **ko**: 정보, 예시 또는 과제가 제시됩니다.
- **pt**: Informação, exemplo ou tarefa é apresentado.
- **tr**: Bilgi, örnek veya görev sunulur.

### `cycle_steps.attempt.label`
- **de**: Versuch
- **en**: Attempt
- **el**: Προσπάθεια
- **es**: Intento
- **fr**: Tentative
- **hi**: प्रयास
- **id**: Percobaan
- **ja**: 試行
- **ko**: 시도
- **pt**: Tentativa
- **tr**: Deneme

### `cycle_steps.attempt.description`
- **de**: Erste Anwendung ohne Sicherheitsnetz.
- **en**: First application without a safety net.
- **el**: Πρώτη εφαρμογή χωρίς δίχτυ ασφαλείας.
- **es**: Primera aplicacion sin red de seguridad.
- **fr**: Premiere application sans filet.
- **hi**: बिना किसी सुरक्षा जाल के पहला अनुप्रयोग।
- **id**: Penerapan pertama tanpa jaring pengaman.
- **ja**: セーフティネットなしでの最初の適用。
- **ko**: 안전망 없이 처음으로 적용합니다.
- **pt**: Primeira aplicação sem rede de proteção.
- **tr**: Güvenlik ağı olmadan ilk uygulama.

### `cycle_steps.error.label`
- **de**: Fehler
- **en**: Error
- **el**: Λάθος
- **es**: Error
- **fr**: Erreur
- **hi**: त्रुटि
- **id**: Kesalahan
- **ja**: エラー
- **ko**: 오류
- **pt**: Erro
- **tr**: Hata

### `cycle_steps.error.description`
- **de**: Abweichung zwischen Erwartung und Ergebnis.
- **en**: Mismatch between expectation and result.
- **el**: Απόκλιση ανάμεσα σε προσδοκία και αποτέλεσμα.
- **es**: Discrepancia entre expectativa y resultado.
- **fr**: Ecart entre attente et resultat.
- **hi**: अपेक्षा और परिणाम के बीच बेमेल।
- **id**: Ketidakcocokan antara harapan dan hasil.
- **ja**: 期待と結果の不一致。
- **ko**: 기대와 결과 사이의 불일치.
- **pt**: Discrepância entre a expectativa e o resultado.
- **tr**: Beklenti ile sonuç arasındaki uyumsuzluk.

### `cycle_steps.feedback.label`
- **de**: Feedback
- **en**: Feedback
- **el**: Ανατροφοδότηση
- **es**: Comentarios
- **fr**: Retour
- **hi**: प्रतिक्रिया
- **id**: Umpan balik
- **ja**: フィードバック
- **ko**: 피드백
- **pt**: Feedback
- **tr**: Geri bildirim

### `cycle_steps.feedback.description`
- **de**: Korrektur mit Erklärung.
- **en**: Correction with explanation.
- **el**: Διόρθωση με εξήγηση.
- **es**: Correccion con explicacion.
- **fr**: Correction avec explication.
- **hi**: व्याख्या के साथ सुधार।
- **id**: Koreksi dengan penjelasan.
- **ja**: 説明を伴う訂正。
- **ko**: 설명과 함께 교정합니다.
- **pt**: Correção com explicação.
- **tr**: Açıklama ile düzeltme.

### `cycle_steps.adapt.label`
- **de**: Anpassung
- **en**: Adapt
- **el**: Προσαρμογή
- **es**: Adaptar
- **fr**: Adapter
- **hi**: अनुकूलित करें
- **id**: Adaptasi
- **ja**: 適応
- **ko**: 적응
- **pt**: Adaptar
- **tr**: Uyarla

### `cycle_steps.adapt.description`
- **de**: Methode, Tempo oder Fokus ändern.
- **en**: Adjust method, pace or focus.
- **el**: Αλλαγή μεθόδου, ρυθμού ή εστίασης.
- **es**: Ajustar metodo, ritmo o foco.
- **fr**: Ajuster methode, rythme ou focus.
- **hi**: विधि, गति या फ़ोकस समायोजित करें।
- **id**: Sesuaikan metode, laju, atau fokus.
- **ja**: 方法、ペース、焦点を調整。
- **ko**: 학습법, 속도 또는 초점을 조정합니다.
- **pt**: Ajustar método, ritmo ou foco.
- **tr**: Yöntemi, hızı veya odağı ayarla.

### `cycle_steps.repeat.label`
- **de**: Wiederholung
- **en**: Repeat
- **el**: Επανάληψη
- **es**: Repetir
- **fr**: Repeter
- **hi**: दोहराएँ
- **id**: Ulangi
- **ja**: 繰り返し
- **ko**: 반복
- **pt**: Repetir
- **tr**: Tekrarla

### `cycle_steps.repeat.description`
- **de**: Erneuter Versuch.
- **en**: Try again.
- **el**: Νέα προσπάθεια.
- **es**: Intentar de nuevo.
- **fr**: Reessayer.
- **hi**: फिर से प्रयास करें।
- **id**: Coba lagi.
- **ja**: もう一度試す。
- **ko**: 다시 시도합니다.
- **pt**: Tentar de novo.
- **tr**: Tekrar dene.

### `cycle_steps.integrate.label`
- **de**: Integration
- **en**: Integrate
- **el**: Ενσωμάτωση
- **es**: Integrar
- **fr**: Integrer
- **hi**: एकीकृत करें
- **id**: Integrasi
- **ja**: 統合
- **ko**: 통합
- **pt**: Integrar
- **tr**: Bütünleştir

### `cycle_steps.integrate.description`
- **de**: Wissen bleibt durch Erfahrung.
- **en**: Knowledge sticks through experience.
- **el**: Η γνώση μένει μέσα από την εμπειρία.
- **es**: El conocimiento queda a traves de la experiencia.
- **fr**: Le savoir reste par l'experience.
- **hi**: अनुभव के माध्यम से ज्ञान स्थायी होता है।
- **id**: Pengetahuan melekat melalui pengalaman.
- **ja**: 経験を通じて知識が定着する。
- **ko**: 경험을 통해 지식이 자리 잡습니다.
- **pt**: O conhecimento se fixa pela experiência.
- **tr**: Bilgi deneyimle yerleşir.

## `errors`

### `errors.network`
- **de**: Verbindung zum Server fehlgeschlagen.
- **en**: Could not reach the server.
- **el**: Αδυναμία σύνδεσης με τον διακομιστή.
- **es**: No se pudo conectar con el servidor.
- **fr**: Impossible de joindre le serveur.
- **hi**: सर्वर तक नहीं पहुँच सके।
- **id**: Tidak dapat menjangkau server.
- **ja**: サーバーに接続できませんでした。
- **ko**: 서버에 연결할 수 없었습니다.
- **pt**: Não foi possível alcançar o servidor.
- **tr**: Sunucuya ulaşılamadı.

### `errors.not_found`
- **de**: Eintrag nicht gefunden.
- **en**: Not found.
- **el**: Δεν βρέθηκε.
- **es**: No encontrado.
- **fr**: Non trouve.
- **hi**: नहीं मिला।
- **id**: Tidak ditemukan.
- **ja**: 見つかりませんでした。
- **ko**: 찾을 수 없습니다.
- **pt**: Não encontrado.
- **tr**: Bulunamadı.

### `errors.validation`
- **de**: Eingabe ungültig.
- **en**: Invalid input.
- **el**: Μη έγκυρη εισαγωγή.
- **es**: Entrada invalida.
- **fr**: Entree invalide.
- **hi**: अमान्य इनपुट।
- **id**: Masukan tidak valid.
- **ja**: 入力が無効です。
- **ko**: 잘못된 입력입니다.
- **pt**: Entrada inválida.
- **tr**: Geçersiz giriş.

### `errors.conflict`
- **de**: Eintrag existiert bereits.
- **en**: Entry already exists.
- **el**: Το στοιχείο υπάρχει ήδη.
- **es**: El elemento ya existe.
- **fr**: L'element existe deja.
- **hi**: प्रविष्टि पहले से मौजूद है।
- **id**: Entri sudah ada.
- **ja**: エントリーは既に存在します。
- **ko**: 항목이 이미 존재합니다.
- **pt**: O registro já existe.
- **tr**: Kayıt zaten var.

### `errors.server`
- **de**: Serverfehler — bitte später erneut versuchen.
- **en**: Server error — please try again later.
- **el**: Σφάλμα διακομιστή — δοκίμασε ξανά αργότερα.
- **es**: Error del servidor — intentalo mas tarde.
- **fr**: Erreur serveur — reessaie plus tard.
- **hi**: सर्वर त्रुटि — कृपया बाद में पुनः प्रयास करें।
- **id**: Kesalahan server — silakan coba lagi nanti.
- **ja**: サーバーエラー — しばらくしてからもう一度お試しください。
- **ko**: 서버 오류 — 나중에 다시 시도하세요.
- **pt**: Erro no servidor — por favor, tente novamente mais tarde.
- **tr**: Sunucu hatası — lütfen daha sonra tekrar dene.

## `toast`

### `toast.project_created`
- **de**: Projekt angelegt.
- **en**: Project created.
- **el**: Το έργο δημιουργήθηκε.
- **es**: Proyecto creado.
- **fr**: Projet cree.
- **hi**: प्रोजेक्ट बनाया गया।
- **id**: Proyek dibuat.
- **ja**: プロジェクトを作成しました。
- **ko**: 프로젝트가 생성되었습니다.
- **pt**: Projeto criado.
- **tr**: Proje oluşturuldu.

### `toast.assessment_saved`
- **de**: Profil gespeichert.
- **en**: Profile saved.
- **el**: Το προφίλ αποθηκεύτηκε.
- **es**: Perfil guardado.
- **fr**: Profil enregistre.
- **hi**: प्रोफ़ाइल सहेजी गई।
- **id**: Profil disimpan.
- **ja**: プロフィールを保存しました。
- **ko**: 프로필이 저장되었습니다.
- **pt**: Perfil salvo.
- **tr**: Profil kaydedildi.

### `toast.session_started`
- **de**: Session gestartet.
- **en**: Session started.
- **el**: Η συνεδρία ξεκίνησε.
- **es**: Sesion iniciada.
- **fr**: Session demarree.
- **hi**: सत्र शुरू हुआ।
- **id**: Sesi dimulai.
- **ja**: セッションを開始しました。
- **ko**: 세션이 시작되었습니다.
- **pt**: Sessão iniciada.
- **tr**: Oturum başladı.

### `toast.session_ended`
- **de**: Session beendet.
- **en**: Session ended.
- **el**: Η συνεδρία τερματίστηκε.
- **es**: Sesion terminada.
- **fr**: Session terminee.
- **hi**: सत्र समाप्त हुआ।
- **id**: Sesi diakhiri.
- **ja**: セッションを終了しました。
- **ko**: 세션이 종료되었습니다.
- **pt**: Sessão encerrada.
- **tr**: Oturum bitti.

### `toast.rating_saved`
- **de**: Bewertung gespeichert.
- **en**: Rating saved.
- **el**: Η αξιολόγηση αποθηκεύτηκε.
- **es**: Valoracion guardada.
- **fr**: Evaluation enregistree.
- **hi**: रेटिंग सहेजी गई।
- **id**: Penilaian disimpan.
- **ja**: 評価を保存しました。
- **ko**: 평가가 저장되었습니다.
- **pt**: Avaliação salva.
- **tr**: Değerlendirme kaydedildi.

### `toast.api_key_saved`
- **de**: API-Key gespeichert.
- **en**: API key saved.
- **el**: Το κλειδί API αποθηκεύτηκε.
- **es**: Clave API guardada.
- **fr**: Cle API enregistree.
- **hi**: API key सहेजी गई।
- **id**: Kunci API disimpan.
- **ja**: API キーを保存しました。
- **ko**: API 키가 저장되었습니다.
- **pt**: Chave de API salva.
- **tr**: API anahtarı kaydedildi.

### `toast.api_key_restored`
- **de**: Letzter funktionierender Schlüssel wiederhergestellt.
- **en**: Last working key restored.
- **el**: Το τελευταίο λειτουργικό κλειδί επαναφέρθηκε.
- **es**: Se restauró la última clave que funcionó.
- **fr**: La derniere cle fonctionnelle a ete restauree.
- **hi**: अंतिम कार्यशील key पुनर्स्थापित की गई।
- **id**: Kunci terakhir yang berfungsi dipulihkan.
- **ja**: 最後に動作したキーを復元しました。
- **ko**: 마지막으로 작동한 키가 복원되었습니다.
- **pt**: A última chave que funcionou foi restaurada.
- **tr**: Son çalışan anahtar geri yüklendi.

### `toast.api_key_deleted`
- **de**: API-Key entfernt.
- **en**: API key removed.
- **el**: Το κλειδί API αφαιρέθηκε.
- **es**: Clave API eliminada.
- **fr**: Cle API supprimee.
- **hi**: API key हटाई गई।
- **id**: Kunci API dihapus.
- **ja**: API キーを削除しました。
- **ko**: API 키가 제거되었습니다.
- **pt**: Chave de API removida.
- **tr**: API anahtarı kaldırıldı.

### `toast.method_switched`
- **de**: Methode gewechselt.
- **en**: Method switched.
- **el**: Η μέθοδος άλλαξε.
- **es**: Metodo cambiado.
- **fr**: Methode changee.
- **hi**: विधि बदली गई।
- **id**: Metode diganti.
- **ja**: 方法を切り替えました。
- **ko**: 학습법이 전환되었습니다.
- **pt**: Método trocado.
- **tr**: Yöntem değiştirildi.
