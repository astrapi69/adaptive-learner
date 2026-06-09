# Ders içeriği oluşturma

Bu kılavuz, Adaptive Learner içerik yükleyicisi için yeni bir ders
setinin nasıl kurulacağını adım adım açıklar. İster kendi kullanımı
için ister herkese açık içerik havuzuna katkı olarak bir dil ya da
konu seti oluşturmak isteyen kişi, ilk dersten önce bunu bir kez
baştan sona okumalıdır.

## İçerik Seti nedir?

Bir **İçerik Seti**, bir kullanıcının Set Tarayıcısı sayfası
(`/content`) üzerinden indirebileceği, sürümlenmiş bir ders
paketidir. İçerik yükleyici eklentisi (v1.27.0), her iki depolama
modunda keşif, indirme, önbellekleme ve sürüm karşılaştırmasını üstlenir.

Bir setin üç katmanı vardır:

1. **Root manifest** (`manifest.yaml`) — reponun her setini listeler.
   Set Tarayıcısı tarafından kaynak kataloğu için okunur.
2. **Set manifest** (`sets/{set-id}/manifest.yaml`) — root
   manifest'in kardeşi, ilgili setin ders dosyalarını listeler.
3. **Ders dosyaları** (`sets/{set-id}/lessons/NN-slug.json`) — ders
   başına bir JSON dosyası, her indirmede Şema v1.0'a karşı doğrulanır.

Adaptive Learner ile gönderilen pilot setler, ayrı içerik reposunda
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
bulunur (kardeş checkout olarak `../adaptive-learner-content` ile
check-out edilir ve build tarafından
`frontend/scripts/copy-bundled-content.mjs` üzerinden paketlenir) ve
şablon olarak iyi işe yarar.

## Dil çiftleri (v1.44.0)

Her İçerik Seti, aktardığı dil ÇİFTİNİ bildirir:

- **`target_language`** — öğrenenin ÖĞRENDİĞİ (örn. `fr`).
- **`source_language`** — öğrenenin halihazırda KONUŞTUĞU, yani
  kartların **`back`** alanlarının, **`notes`** ve **teori**
  metninin yazıldığı dil (örn. `de`).

İşte bu, "İngilizce konuşanlar için Fransızca"yı, "Almanca
konuşanlar için Fransızca"dan *farklı* bir set yapar: aynı hedef
(`fr`), farklı başlangıç dili (`en` ya da `de`), farklı açıklama
dili. Bir öğrenen yalnızca `source_language`'ı konuştuğu bir dile
uyan setleri görür (uygulama dili artı Ayarlar → Öğrenme altındaki
isteğe bağlı ek diller).

Set ID'leri çifti `{hedef}-{seviye}-from-{kaynak}` olarak kodlar
(örn. `fr-a1-from-de`) ve her set, başlangıç dili dizinine işaret
eden bir **`path`** bildirir (`sets/de/fr-a1`). Bir set ayrıca
**`title`** (başlangıç dilinde, öğrenenin okuduğu) ve
**`title_native`** (hedef dilde, ikinci başlık olarak) taşır.

Her iki kod da ISO-639-1 (iki harf) olmalıdır ve `source_language`,
`target_language`'dan farklı olmalıdır. Bu alanlar olmadan v1.2
öncesi setler yine de yüklenir: eski `language` anahtarı
`target_language` olarak kabul edilir ve `source_language` `en`'e
geri döner.

## Dizin düzeni

Ağaç önce BAŞLANGIÇ DİLİNE, ardından hedef+seviyeye göre
düzenlenmiştir:

```
mein-content-repo/
  manifest.yaml               # Root: listet jedes Set (mit path + Paar)
  sets/
    de/                       # Ausgangssprache: Deutsch
      fr-a1/                  # Ziel Französisch, Niveau A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: listet die Lektionen
        lessons/
          01-begruessung.json
          ...
        assets/               # optionale Bilder / Audio
    en/                       # Ausgangssprache: Englisch
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

## Manifest formatı

Her iki manifest dosyası da (root + set) `schema_version: '1.0'` ile
aynı biçimi kullanır. Zorunlu alanlar:

```yaml
schema_version: '1.0'
name: Mein Englisch-B1-Set
description: >-
  Optionale Langbeschreibung.
sets:
  - id: language-en-b1        # slug-sicher, eindeutig
    title: Englisch B1 (Fortgeschrittene)
    language: en              # BCP-47 (z.B. en, fr, zh-Hans)
    level: B1                 # CEFR für Sprachen, frei für andere Domänen
    version: '1.0.0'          # Semver — pro Set-Release erhöht
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optionale Set-Beschreibung.
    tags:
      - intermediate
      - business
metadata:
  author: Dein Name
  license: CC-BY-SA-4.0       # oder die Lizenz deiner Wahl
```

Set manifest ayrıca her ders dosyasını listeler:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

İçerik yükleyici, `metadata.lessons` üzerinde verilen sırayla
yineler; diskteki dosya adları önemsizdir — yalnızca manifest sırası
sayılır.

## Ders şeması (v1.0)

Her ders tek bir JSON dosyasıdır. Üst düzey yapı:

```json
{
  "id": "01-greetings",
  "title": "Begrüßungen",
  "description": "Optionale 1-2-Satz-Zusammenfassung.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

Bir Card en küçük öğrenilebilir birimdir — tipik olarak tek bir
terim ya da bir kavram. Her Card'ın kararlı bir id'si (alıştırmalardan
referanslanır) ve bir front/back çifti vardır:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` Markdown kabul eder. Bunu telaffuz kuralları, yanlış-dost
uyarıları, istisna ipuçları için kullan — uzun süreli belleği
iyileştiren her şey. `tags`, SRS filtrelemesini yönlendirir.

### Steps

Bir ders, adım adım bir dizidir; her adım ya THEORY (bir Markdown
bloğu) ya da EXERCISE (dört alıştırma türünden biri):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

Bir teori adımı isteğe bağlı olarak bir **örnek bağlantısı**
taşıyabilir (Şema v1.4, additif — mevcut dersler onsuz geçerli kalır).
Varsa, görüntüleyici altına örneği açan bir düğme render eder:

```json
{
  "id": "intro",
  "type": "theory",
  "body": "Die Korrelation misst den Zusammenhang...",
  "example_url": "https://example.com/correlation-visualizer",
  "example_label": "Interaktive Visualisierung"
}
```

- `example_url` (isteğe bağlı): bir `http(s)` URL'si olmalıdır.
- `example_label` (isteğe bağlı): bağlantı metni; boş, yerelleştirilmiş
  bir "Örneği görüntüle" olur.

Ya da bir alıştırma:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Begrüßungen zuordnen",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Ordne jede Begrüßung ihrer Übersetzung zu.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hallo"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Alıştırma türü referansı

### matching

Çift-sürükle alıştırması. Render eden, göstermeden önce karıştırır.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Ordne jedem französischen Nomen seinen Artikel zu.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Her Pair'in tam olarak iki anahtarı olmalıdır: `left` + `right`.

### picture_choice

Resimlerle çoktan seçmeli. ≥ 2 resim, tam olarak biri doğru olarak
işaretlenir.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Welche Begrüßung passt zum Abend?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optionaler Markdown-Tipp auf Knopfdruck.",
  "distractors": ["Bonjour"]
}
```

Önemli: `is_correct` bir **String** `"true"`'dur, bir JSON boolean
değil.

`src` yolu var olmayan bir dosyaya işaret ediyorsa, render eden
`label`'a geri döner — yani picture_choice, illüstrasyon asset'leri
olmadan da çalışır.

### free_text

Yanıtı yaz. Render eden önce tam, ardından Levenshtein-toleranslı
eşleştirir.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Wie sagt man 'Danke' auf Französisch?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Beginnt mit M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]`, yanlış bir denemede gösterilen kanonik yanıttır.
Büyük/küçük harf + noktalama işaretlerini kapsamak için ≥ 3 varyant
listele; boşluk, render eden tarafından normalleştirilir.

### word_tiles

Karoları doğru sıraya getir. Render eden, göstermeden önce karıştırır.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Bring die Kacheln in die Reihenfolge: Ich sehe eine Katze.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Gleiche Wortreihenfolge wie im Deutschen."
}
```

Birden çok kelime sırası doğruysa, `accept_orderings` ekle:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Her sıra, karo indekslerinin bir permütasyonudur.

### cloze (Faz 52 / v1.35.0 — Şema 1.1)

Cümlede görünür `___` işaretleriyle boşluk doldurma. Her `___`,
`blanks[]` içindeki bir girişe karşılık gelir (soldan sağa
eşleme; yükleyici `sentence.count("___") == len(blanks)`'i denetler).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Setze den unbestimmten Artikel ein.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "männlicher unbestimmter Artikel",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* ist der männliche unbestimmte Artikel."
}
```

**Render modları** — alıştırma başına `cloze_mode` ile ayarlanır:

- `"type"` (ayarlanmadıysa varsayılan): boşluk başına bir `<input>`.
  free-text ile aynı NFC + Levenshtein-≤-1 eşleştiriciyle doğrulanır,
  böylece yazarların yalnızca anlamsal varyantları listelemesi gerekir
  (yazım hatası yok).
- `"select"`: boşluk başına bir `<select>`. Seçenekler, alıştırmanın
  `accept[0]` + `distractors`'ından, boşluk başına kararlı bir tohumla
  karıştırılır. **Boş olmayan `distractors` gerektirir** — şema
  doğrulayıcısı, onlar olmadan `cloze_mode: "select"`'i reddeder.

**Cloze başına birden çok boşluk** desteklenir: cümledeki her `___`,
sırayla `blanks` içindeki bir sonraki girişe eşlenir. Her boşluğun
kendi ipucu + yer tutucu + accept listesi olabilir. Öğe-SRS, boşluk
başına bir ElementAttempt açar — boşluk A'yı akıcı dolduran ancak
boşluk B'yi sürekli kaçıran, boşluk düzeyinde bir mastery izleme alır.

**Kartlarda Token rolleri (Faz 52I / v1.35.0)** — cloze üretecinin
çalışma zamanında (tekrar oturumları + ders sonu düzeltme turu)
anlamsal olarak anlamlı bir boşluk seçebilmesini sağlayan isteğe bağlı
kart üst verileri:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "eine Katze",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Kapalı rol enum'u: `article` / `verb` / `noun` / `adjective` /
`preposition` / `gender_marker` / `tense_marker`. Bir rol eklemek bir
minor şema sürüm artışıdır — satır içi genişletme.

## Alıştırma yönü (v1.46.0 / EXP-018)

Her alıştırma, öğrenenlerin kartı hangi yönde çalıştığını belirten
isteğe bağlı bir `direction` alanı kabul eder:

- `target_to_source` (varsayılan) — REZEPTİF: hedef dil gösterilir,
  kaynak dil tanınır (daha kolay).
- `source_to_target` — ÜRETKEN: kaynak dil gösterilir, hedef dil
  üretilir (daha zor).
- `both` / `random` — render eden / adaptif üretece deneme başına
  somut bir yön seçimini bırakır.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Alan additiftir — şema Sürüm 1.2'de kalır ve `direction` olmayan
dersler tam olarak öncekisi gibi davranır (rezeptif). SRS, ustalığı
yön başına izler: rezeptif olarak ustalaşılmış bir kart henüz üretken
olarak ustalaşılmış değildir. Cloze alıştırmaları bağlama bağlıdır ve
`direction`'ı yok sayar. Bir zorluk ilerlemesi için erken dersleri
rezeptif tutar ve sonraki derslerde `source_to_target`'i eklersin (tam
olarak paketlenmiş pilot içeriğin yaptığı budur).

### Adaptif ders üreteci için ek açıklamalar (v1.36.0+)

Faz 53'ten adaptif ders üreteci (`/adaptive-lesson/:setId`, F-114),
öğrenenlerin belirli zayıflıklarını hedefli olarak ele almak için
mevcut alıştırmaları yeniden birleştirir. Üreteç ek açıklamalar
olmadan çalışır, ancak iki alan onu belirgin biçimde daha akıllı yapar:

1. **Kartlarda daha geniş `token_roles` kapsamı.** Üreteç,
   `token_roles`'u şunlar için kullanır:
   - Hatalardan cloze varyantları üretilirken anlamsal olarak anlamlı
     boşluklar seçmek (zaten v1.35.0'da)
   - Dashboard'daki "alıştırma odağı" çipleri için hataları
     `article_gender` / `verb_conjugation` olarak sınıflandırmak (53E)
   - Orijinal alıştırma yanlışsa, aynı öğeyi test eden ALTERNATİF
     alıştırmalar bulmak (53D varyasyon mantığı — kartı uygun bir
     `token_roles` girişine sahip adayları bulur)

   Kendi gramatik birimini öğreten HER kartı (artikeller, çekimli fiil
   formları, cinsiyetli isimler) bir `token_roles` girişiyle ekle.
   Maliyet: kart başına ek bir JSON girişi; fayda: belirgin biçimde
   daha zengin adaptif üretim.

2. **`tags: ["article", "masculine"]` gibi kart etiketleri**,
   `token_roles` eksik olduğunda hata sınıflandırıcısı tarafından geri
   dönüş olarak okunur. `token_roles`'un yerini almazlar — ucuz, yarı
   yolda bir ek açıklamadır.

Henüz İHTİYAÇ DUYMADIKLARIMIZ (gelecekteki bir şema artışına
ertelendi):

- Farklı derslerdeki kartlar arasında `related_cards` çapraz
  referansları
- Alıştırma başına zorluk derecelendirmeleri (üreteç şu anda zorluğu
  `exercise.type`'tan tahmin eder)
- Alternatif cloze bağlamları olarak ayrıştırılabilir, `notes` içinde
  kart başına örnek cümleler (cloze üreteci yalnızca `front`'u kullanır)

Pratik kural: gramatik bir Token öğreten her karta `token_roles` ekle.
Bu, adaptif sistem için açık ara en etkili yazar alışkanlığıdır.

## Asset'ler (bir setin getirdiği resimler) — v1.37.0+

Picture-Choice alıştırmaları ve kart kapak resimleri iki kaynaktan
gelir:
1. Set manifest'inde bildirilen ve ders JSON'ının yanında gönderilen
   **yazar asset dosyaları**
2. Hiçbir asset yoksa çalışma zamanında üretilen **yer tutucu SVG'ler**
   (renk kelimeleri için renk tabloları, sayılar için büyük rakamlar,
   diğer her şey için avatar stili)

Asset'siz bir set yayınlarsan, Picture-Choice yine de çalışır — yer
tutucu SVG üreteci renkleri + sayıları otomatik kapsar ve diğer her
şey için deterministik bir avatara geri döner.

### Dizin düzeni

Set dizini içinde asset'ler `assets/` altında bulunur:

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
      02-numbers.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### Manifest bildirimi

İndiren neyi alacağını bilsin diye her asset, set manifest'inde
bildirilmelidir:

```yaml
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 10
    assets:
      - path: img/chat.png
        size_kb: 45
      - path: img/chien.png
        size_kb: 38
```

`path`, setin `assets/` dizinine görelidir (ders JSON'ına DEĞİL).
Ders JSON'ında Picture-Choice alıştırmaları asset'leri `assets/`
önekiyle referanslar:

```json
{
  "type": "picture_choice",
  "prompt": "Welches ist 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Katze", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Hund"}
  ]
}
```

Frontend, asset çözücüyü çağırırken `assets/` önekini otomatik
kaldırır, böylece ders JSON'ı yazarlar için sezgisel biçimde kalır.

### Boyut + format sınırları

- **Asset başına sınır**: 500 KiB. Manifest doğrulayıcısı, bildirilen
  `size_kb`'si bu sınırı aşan asset'leri reddeder. İndiren ayrıca
  gerçek bayt boyutu bildirimi %10'dan fazla aşan asset'leri de
  reddeder — manifest'i dürüst tutar.
- **Set başına soft sınır**: toplam 10 MiB boyut. Doğrulayıcı uyarır,
  ancak reddetmez.
- **Kabul edilen formatlar**: `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. GIF yok (animasyonlu içerik dikkat dağıtır), BMP yok
  (sıkıştırma yok). Fotoğraflar için WebP tercih edilir — karşılaştırma
  kalitesinde PNG'den belirgin biçimde daha küçük. Simgeler +
  diyagramlar için SVG tercih edilir — temiz ölçeklenir + minik dosya
  boyutu.

### Boyut önerileri

Picture-Choice karoları masaüstünde en fazla 150x150 px ve mobilde
100x100 px render edilir (`object-fit: contain`). 300x300 px kaynak
resimler, gereksiz veri ihtiyacı olmadan Retina ekranlarda en iyi
sonucu verir. 150 KiB üzeri PNG'ler, yarı boyutlu iyi sıkıştırılmış bir
WebP'den nadiren daha iyi görünür.

### Çalışma zamanı yer tutucusu ne zaman yeterli olur

Çalışma zamanı yer tutucusunun yazar resimlerinin öğrenme kazancı
sağlamayacağı kadar iyi olduğu üç ders türü:

- **Renk dersleri** (`rouge` / `rojo` / `rot` / `red`): yer tutucu
  üreteci, renk adına uyan renkli bir hex karo üretir. Yazar karoları
  gereksizdir.
- **Sayı dersleri** (`7` / `42` / `1492`): yer tutucu rakamları büyük +
  ortalanmış render eder. Yazar resimleri yalnızca Arap olmayan rakam
  sistemlerinde anlamlı olurdu.
- **Soyut kavramlar**, bariz bir görsel temsili olmayanlar (`patience`,
  `liberté`): avatar yer tutucusu, tartışmalı bir simge seçimini
  zorlamadan net bir görsel çapa sağlar.

Diğer her şey için (hayvanlar, nesneler, yiyecek, yerler, vücut
parçaları) yazar resimleri tanıma + hatırlamaya ölçülebilir biçimde
yardımcı olur.

## Kalite kontrol listesi

Yeni bir ders için PR'dan önce kontrol et:

- [ ] Ders başına **3-5 teori adımı** + **8-12 alıştırma**
- [ ] **En az 3 alıştırma türü** temsil edilmiş (matching, picture-choice, free-text, word-tiles ya da cloze — cloze v1.35.0'dan itibaren)
- [ ] **Teori adımları her adımda ≤ 200 kelime**
- [ ] **Free-Text alıştırmaları**: ≥ 3 accept varyantı + ≥ 3 distractor
- [ ] **Word-Tiles**: alıştırma başına ≥ 3 karo
- [ ] **estimated_minutes**: 10-15 (gerçekçi, idealize değil)
- [ ] **Distractor'lar yanlış-ama-makul** — anlamsal olarak ilişkili, asla rastgele değil
- [ ] **Card-Notes** gerçek katma değer sağlar (telaffuz, yanlış dostlar, istisna bayrağı)
- [ ] **Progresif yapı**: sonraki kavramlar aynı setteki öncekilerin üzerine kurulur
- [ ] **Kültürel doğruluk**: gerçek dil kullanımı, yalnızca ders kitabı kalıpları değil
- [ ] **Şema doğrulaması**: ders `dict_to_lesson()` üzerinden temiz yüklenir (Yerel Test'e bak)
- [ ] **Card-ID bütünlüğü**: her `exercise.card_ids[i]`, dersin `cards[]`'ında var
- [ ] **Dil çifti**: `target_language` + `source_language` ayarlı (ISO 639-1, farklı), `title_native` mevcut

## Doğrulama (iki katman, v1.44.0)

İçerikler, AYNI denetimlere sahip iki doğrulama katmanıyla güvence
altına alınır:

1. **Uygulamada, paylaşmadan önce.** *Derslerim → Topluluğa sun*
   üzerinden paylaşırken, önce kural tabanlı bir denetim çalışır
   (her zaman, yapay zekasız). Aşağıdaki **alt sınırları** zorunlu
   kılar; bunun altındaki bir set paylaşılamaz. Geçerse ve bir yapay
   zeka anahtarı yapılandırılmışsa, öğrenen İSTEĞE BAĞLI olarak
   tamamlayıcı bir yapay zeka denetimi başlatabilir (çeviri doğruluğu,
   distractor makullüğü, gramer, seviye, kültürel duyarlılık,
   doğallık). Yapay zeka adımı asla otomatik değildir, açık bir onay
   gerektirir (ders içeriği yapılandırılmış sağlayıcıya gönderilir) ve
   paylaşmayı asla engellemez — kural tabanlı denetim kapıdır.
2. **İçerik reposunun CI'sında.** `astrapi69/adaptive-learner-content`
   reposuna bir Pull Request, `scripts/validate_content.py`'yi çalıştırır
   (`docs/ci/adaptive-learner-content/` altında yansıtılmıştır) ve her
   seti aynı kurallarla denetler, böylece manuel bir PR kapıyı atlamaz.

**Kalite alt sınırları (sert kapı):** ders başına ≥ 5 alıştırma, ≥ 2
alıştırma türü, ≥ 1 teori adımı, Free-Text ≥ 2 kabul edilen yanıt +
distractor'lar, Matching ≥ 3 çift, distractor'lı Picture-Choice, boş
kart ön/arka yüzleri yok ve (Latin olmayan başlangıç yazıları için)
başlangıç yazısında kart arka yüzleri. Bunlar alt sınırlardır, hedef
değil — yukarıdaki kontrol listesi daha fazlasını ister.

## Yerel test

İçerik yükleyicisinin şema doğrulayıcısı `make test` kapsamında
çalışır. Tek bir dersi elle doğrulamak için:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Bir içerik reposunun tüm derslerini tek seferde doğrula — içerik
reposunun doğrulayıcısıyla (CI'sının her PR'da çalıştırdığı aynı
script):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Her seti `sets/{source}/{target-level}/` altında bulur ve şemayı artı
kalite alt sınırlarını denetler (≥5 alıştırma, ≥2 alıştırma türü, ≥1
teori adımı, Freitext accept'leri + distractor'lar, Matching çiftleri,
boş kart yok, kart-ID bütünlüğü). Yeni dersler otomatik tanınır — test
değişikliği gerekmez.

## PR iş akışı

Setin hazır olur olmaz:

1. Ana repoya bir PR aç (uygulamayla gönderilecek setler için), YA DA
2. GitHub hesabın altında kendi içerik reponu oluştur ve içerik
   yükleyiciyi `backend/config/plugins/content-loader.yaml` üzerinden
   (`default_sources` altında) yapılandır.

İçerik yükleyici, herhangi bir herkese açık GitHub repoyu kaynak
olarak destekler. Özel repolar, üç katmanlı anahtar yönetimi üzerinden
ayarlanan bir Personal Access Token gerektirir
(`~/.config/adaptive_learner/secrets.yaml`).

## Sık karşılaşılan tuzaklar

**Card-ID referansları**: Bir alıştırmadaki her `card_ids` girişi,
dersin `cards[]`'ında var olmalıdır. Bir alıştırmayı dersler arasında
kopyalar ve ilgili Card'ı birlikte almayı unutursan, doğrulama
başarısız olur.

**Slug-güvenli ID'ler**: Tüm ID'ler (Lesson, Card, Step, Exercise)
`^[a-z0-9]+(-[a-z0-9]+)*$` ile eşleşmelidir. Alt çizgi yok, kesme
işareti yok, büyük harf yok, başında/sonunda tire yok.

**`is_correct: "true"`**: Bu bir String'dir, bir JSON boolean değil.
Şema açıkça `"true"` ister, çünkü picture_choice alanları dahili olarak
dict[str, str] olarak modellenmiştir.

**Ek alanlar**: Her modelin `extra="forbid"` özelliği vardır.
Belgelenmemiş bir alan, tüm dersin reddedilmesine yol açar. Belgelenmiş
alanlara bağlı kal.

**Theory-Body**: Theory adımları boş olmayan bir `body` alanı
(Markdown) gerektirir. Exercise adımları bir `body` taşıyamaz — bunun
yerine alıştırmanın `prompt`'unu kullan.

## Referans: pilot setler

Adaptive Learner ile gönderilen iki set, kanonik referanslardır:

- `sets/en/fr-a1/` — İngilizce konuşanlar için Fransızca A1 (10 ders,
  ~2 saat); `sets/de/fr-a1/` Almanca pilot settir.
- `sets/en/es-a1/` + `sets/de/es-a1/` — İspanyolca A1 (kaynak dil
  başına 15 ders), `adaptive-learner-content` reposunda.

Her ikisi de bu kılavuzda açıklanan konvansiyonları izler. Eksiksiz
bir dersi okumak, yapıyı içselleştirmenin en hızlı yoludur.

---

## Topluluk katılımına giden yol (v1.42.0)

Dersleri sıfırdan elle oluşturmana gerek yok. Katkıda bulunmanın en
hızlı yolu, **uygulamada bir ders oluşturmak ve paylaşmaktır**:

1. Bir sohbeti içe aktar ve analiz et, ardından **Çevrimdışı ders
   olarak kaydet** (ya da adaptif bir dersi bitir ve **Bu dersi
   kaydet?**). Ders, Set Tarayıcısı'nda **Derslerim** altında görünür.
2. "Derslerim"de **İçerik Seti olarak dışa aktar**'a tıklayarak bir
   içerik setini `.zip` olarak indir (manifest + dersler). Dışa
   aktarmalar yalnızca ders içeriğini içerir — ilerleme yok, hata
   geçmişi yok, kişisel bir şey yok.
3. **Topluluğa sun**'a tıklayarak içerik repository'sinde önceden
   doldurulmuş bir **Pull Request** aç — ders JSON'ı ağaçtaki doğru
   yola commit edilir, `.zip` eki gerekmez.
4. Reponun CI'sı PR'ı otomatik doğrular; bir maintainer dersi
   inceler, manifest'i (id, title, language, level, tags) yukarıdaki
   konvansiyonlarla uyumlu hale getirir ve onu `sets/` altında
   birleştirir. Merge'den sonra herkes onu Set Tarayıcısı'ndan
   indirebilir.

Bu, sosyal yoldur: İnceleme **manuel**'dir (bir maintainer her eklemeyi
küratörler — hiçbir şey otomatik yayınlanmaz) ve tüm akış yalnızca
GitHub gerektirir. Üretilen dersler zaten şemaya karşı doğrulanır,
böylece katkıda bulunulan bir ders genellikle yalnızca biraz manifest
ince ayarına ihtiyaç duyar.

## Paylaşma yardımcısı, varyasyonlar ve yazar Credit'i (Faz 64)

**Derslerim**'den bir dersi paylaşmak, doğrudan GitHub'a atlamak
yerine dört adımlı bir yardımcı açar:

1. **Önizleme + yerleştirme.** Uygulama, dersin ağaçta tam olarak
   nereye düşeceğini (`sets/{kaynak}/{hedef}-{seviye}/`) ve otomatik
   numaralandırılmış bir dosya adını (`{nn}-{slug}.json`, mevcut
   derslerden sonraki numara) hesaplar. Tamamen yeni bir çift + seviye,
   *"Yeni set! İlk sensin."* gösterir.
2. **Yineleme denetimi.** Ders, bu yolda zaten var olan derslerle
   karşılaştırılır (kart ve alıştırma örtüşmesi — danışmanlık niteliğinde,
   asla engelleyici değil). Benzer bir şey varsa şunları yapabilirsin:
   - **Varyasyon olarak paylaş** — ders, `variation_of:
     "{original_id}"` artı isteğe bağlı bir `variation_note` ("Senin
     sürümün nasıl farklı?") ile işaretlenir.
   - **Yalnızca yeni alıştırmaları öner** (neredeyse yinelemelerde) —
     yardımcı, orijinalin eksik olduğu alıştırmaları, ilgili kartlarıyla
     birlikte bir tamamlama varyasyonu olarak çıkarır.
3. **Kalite özeti.** Kural tabanlı doğrulayıcının bulguları (artı
   isteğe bağlı yapay zeka denetimi); uyarılar gösterilir ancak asla
   engellemez.
4. **Paylaş + kutla.** Bir tık GitHub Pull Request'ini açar (küçük
   dersler için dosya düzenleyici, büyükler için yükleme sayfası) ve
   uygulama küçük bir kutlamayla teşekkür eder.

### Varyasyon ve Credit alanları (Şema 1.3, hepsi isteğe bağlı)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Dördü de additif ve isteğe bağlıdır; onlar olmadan dersler tam olarak
öncekisi gibi davranır. `contributed_by`, yazar paylaşırken Credit'i
etkinleştirdiğinde ayarlanır (bir sonraki sefer için yerel olarak
hatırlanan *"Adın (isteğe bağlı)"* alanı). Varsa, görüntüleyici başlığın
altında ölçülü bir *"{name} tarafından sağlandı"* satırı gösterir ve
Pull Request metni yazarı üst veri tablosunda listeler.

### Katkı geçmişi ve eksikler

Paylaşılan dersler yerel olarak hatırlanır (hesap gerekmez)
**Katkılarım** altında, bir sayaç ve beş paylaşılan dersten itibaren
bir *Topluluk Katkıcısı* ödülüyle. Set Tarayıcısı ayrıca **Eksik
dersler** gösterir — mevcut bir çiftin bir sonraki CEFR seviyesi ya da
bir başlangıç dili için var olan ancak başka biri için eksik olan bir
hedef dil için cesaretlendirici öneriler ("Yardım edebilir misin?").

---

## İlgili sayfalar

- [Ders oluşturma — Genel bakış](../content-creation/overview.md) — giriş + uygulamada Ders Oluşturucu
- [Kitap önerileri](../content-creation/books.md) — alan başına `books.yaml` bakımı
- [Birden Çok İçerik Repository'si](../features/content-repos.md) — kendi repoyu bağla
