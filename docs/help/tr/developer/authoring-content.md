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
   başına bir JSON dosyası, her indirmede ders şemasına karşı
   doğrulanır (aşağıdaki *Şema tek doğruluk kaynağıdır* bölümüne bak).

Adaptive Learner ile gönderilen setler, ayrı içerik reposunda
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
bulunur (kardeş checkout olarak `../adaptive-learner-content` ile
check-out edilir ve GitHub Pages build'ine
`frontend/scripts/copy-bundled-content.mjs` üzerinden çevrimdışı
paketlenir) ve şablon olarak iyi işe yarar. Kütüphanenin güncel boyutu
(ders / set / alan sayıları, set başına tablo ve etkin alanlar), proje
[`README.md`](https://github.com/astrapi69/adaptive-learner#readme)
içindeki CONTENT-STATS bloğudur — o blok tek doğruluk kaynağıdır, taze
bir içerik checkout'undan üretilir, bu yüzden bu kılavuz sayıları
yinelemez.

## Şema tek doğruluk kaynağıdır (EXP-039)

Ders/alıştırma formatının **tek bir kanonik tanımı** vardır:
[learn-content-engine](https://github.com/astrapi69/learn-content-engine)
npm paketinin gönderdiği ders JSON Schema'sı (yayımlanan release
başına değişmez). Bu uygulamanın içinde, içerik yükleyici eklentideki
**yapısal** Pydantic katmanı
(`adaptive_learner_content_loader.schema`) bu aynadan **yeniden
üretilir** (`scripts/generate_pydantic_models.py`); yalnızca anlamsal,
alanlar arası doğrulayıcılar elle yazılır. `make sync-schema` aynayı
tazeler ve türetilmiş artefact'ları yeniden üretir; byte parite
kapıları da `schema/*.json`'ın sabitlenmiş engine release'ine eşit
olduğunu kanıtlar. Eskiden sapabilen yerler artık sapamaz:

- `schema/lesson.schema.json` (+ kardeş dosyalar): makine tarafından
  okunabilir JSON Schema (Draft 2020-12). IDE otomatik tamamlama ve
  satır içi doğrulama için, bir ders `.json`'ından en üst düzey bir
  `"$schema"` anahtarıyla referans ver.
- `schema/quality-rules.json`: paylaşılan kalite alt sınırları
  (örn. alıştırma sayıları, free-text kabul edilen yanıt sayıları);
  elle tutulan ikinci bir kopya yerine istemci tarafındaki içerik
  doğrulayıcısı tarafından kullanılır.
- Frontend'in TypeScript ders tipleri ve
  [Lesson format reference](lesson-format-reference.md) MkDocs sayfası
  da üretilir (**elle düzenleme yapma**); engine aynasını takip
  ederler, bu yüzden her re-pin'den sonra üreteci yeniden çalıştır.

Bir sapma kapısı (`make sync-schema-check`, `release-test`'in
parçası, artı `make test` içindeki
`backend/tests/test_lesson_schema_drift.py`), üretilen herhangi bir
artefact sabitlenmiş engine aynasından saparsa başarısız olur.
Zinciri kapatan, uygulama-engine byte parite kapısıdır:
`make engine-parity-check` (`scripts/check_engine_schema_parity.py`),
çevrimdışı pin `engine-schema-parity.test.ts` ve pin tutarlılık testi
`engine-pin.test.ts` (`frontend/package.json` bağımlılığı ==
`schema/engine-version.txt`). İçerik repoları (bu repoyu değil)
**sabitlenmiş engine release'ini** yansıtır ve kendi CI'larında bu
aynaya karşı doğrular.

**Format değişikliği prosedürü (şema otoritesi engine'dedir):** ders
formatındaki bir değişiklik engine'de başlar veya orada onaylanır:
önce engine PR'ı + npm release; sonra bu uygulama engine pin'ini
(`frontend/package.json` + `schema/engine-version.txt`) yükseltir ve
`make sync-schema`'yı yeniden çalıştırır; bu, aynayı tazeler ve
yapısal Pydantic katmanını yeniden üretir; yalnızca yeni anlamsal
doğrulayıcılar elle yazılır; ardından içerik repoları
`engine-version.txt` pin'lerini günceller. Aynada yapılan bir el
düzenlemesi (veya bayat bir pin) byte parite kapılarını kırmızıya
çevirir; unutulan adım görünür olur, asla sessiz sapma olmaz.

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

Her iki kod da ISO 639-1 (iki harf) olmalıdır ve `source_language`,
`target_language`'dan farklı olmalıdır. Bu alanlar olmadan v1.2
öncesi setler yine de yüklenir: eski `language` anahtarı
`target_language` olarak kabul edilir ve `source_language` `en`'e
geri döner.

## Dizin düzeni

Ağaç önce BAŞLANGIÇ DİLİNE, ardından hedef+seviyeye göre
düzenlenmiştir:

```
my-content-repo/
  manifest.yaml               # Root: lists every set (with path + pair)
  sets/
    de/                       # Source language: German
      fr-a1/                  # Target French, level A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # Source language: English
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

### Arama dizini (`search-index.json`)

İçerik keşfi ve arama (*Keşfet* yüzeyi), repo kökünde yayımlanan yalın
bir `search-index.json` ile yönlendirilir (~4 KB, yalnızca üst veri —
kart içeriği yok). Resmi içerik reposu bunu sağlar ve uygulama,
yapılandırılmış her reponun dizinlerini istemci tarafında getirir
(CORS-güvenli, localStorage'da 24 saatlik bir stale-while-revalidate
TTL ile önbelleklenir), böylece bir öğrenen bir seti indirmeden önce
BULABİLİR. Her giriş, setin `id`, `name`, `description`,
`source_language` / `target_language`, `level`, `domain`,
`lesson_count`, `card_count`, `tags`, bir `ai_validated` bayrağı, bir
`trust_level`, isteğe bağlı bir eşlik eden `book` ve bir `updated_at`
zaman damgasını duyurur. Onu set manifest'leriyle senkronize tut;
resmi repoya bir PR onu yeniden üretir.

## Manifest formatı

Manifest alan şeması (reponun setlerini listeleyen root `manifest.yaml`
ve her zorunlu ve isteğe bağlı alan: `schema_version`, `name` ve set
başına `id`, `title`, `title_native`, `target_language`,
`source_language`, `level`, `version`, `lesson_count`, `path`,
`domain`, `tags`, `book`, `visibility`) engine referansında bulunur:
[learn-content-engine, Manifest format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md#manifest-format).
Engine'in katı şeması (bilinmeyen alanlar reddedilir) bunu doğrular,
bu yüzden yukarıdaki alan listesi sapamaz. Dil çifti alanlarını
(`target_language` / `source_language`)
[Dil çiftleri](#dil-ciftleri-v1440) altında açıklandığı gibi yaz; v1.2
öncesi `language` takma adı hala yüklenir ancak yeni setler için
önerilmez.

İsteğe bağlı **`visibility`** alanı (engine 0.14.0+, belirtilmezse
`visible`), tüketici uygulamalar için bir **görüntüleme ipucudur**:
`visibility: hidden`, uygulamadan seti öğrenenlere göstermemesini
ister — engine doğrulaması için repoda kalması gereken ama öğrenme
içeriği olmayan referans/uygunluk fixture'ları için düşünülmüştür.
Uygulama, gizli setleri tarama ve Keşfet yüzeylerinden filtreler
(zaten önbelleğe alınmış olsalar bile); engine onları doğrulamaya
devam eder. Uygulama tarafında bakımı yapılacak bir gizli set
listesi artık yoktur.

Akılda tutulması gereken uygulamaya özgü yükleyici davranışı:

- Set manifest, her ders dosyasını `metadata.lessons` altında listeler
  ve içerik yükleyici bu listeyi **verilen sırayla** yineler:
  diskteki dosya adları önemsizdir, yalnızca manifest sırası sayılır:

  ```yaml
  metadata:
    lessons:
      - 01-intro.json
      - 02-articles.json
      - ...
  ```

## Ders şeması

Her ders tek bir JSON dosyasıdır: üst düzey üst veri (`id`, `title`,
`description`, `estimated_minutes`), bir **cards** listesi (en küçük
öğrenilebilir birimler — kararlı id'ler, front/back çiftleri, Markdown
`notes`, SRS için `tags`) ve bir **steps** listesi; her adım ya bir
THEORY adımıdır (bir Markdown `body`, isteğe bağlı bir `example_url`
bağlantısı veya satır içi `examples`) ya da bir EXERCISE adımıdır (tam
olarak bir alıştırma).

Eksiksiz, alan alan format referansı — her alan, her alıştırma türü,
her cloze modu, engine'in test paketi tarafından doğrulanan JSON
örnekleriyle — **engine referansında** bulunur:

- [learn-content-engine — `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
  — yazarlar ve üçüncü taraf doğrulayıcılar için kanonik ders-format
  referansı (uygulama checkout'u gerekmez)
- her engine release'iyle paketlenen makine tarafından okunabilir şema:
  `import schema from "learn-content-engine/schema/lesson.schema.json"`
- uygulama içi ikizi: üretilen
  [Lesson format reference](lesson-format-reference.md)

Engine'in paketlenmiş şeması, bu reponun üretilen
`schema/lesson.schema.json`'ıyla byte-özdeştir (`make
engine-parity-check` tarafından zorunlu kılınır), bu yüzden "engine'e
karşı doğrular" ve "uygulamada doğrular" aynı ifadedir.

## Hangi öğrenme hedefi için hangi alıştırma türü

Alıştırma türünü çeşitliliğe göre değil, **öğrenme hedefine** göre seç.
Kelime kelime tam-eşleşme puanlama — tüm cümlelik bir `word_tiles` ya
da tam cümlelik bir `free_text` — **serbest üretim** için başarısız
olur: bir kavram birçok doğru şekilde ifade edilebilir, bu yüzden
içerik olarak doğru bir öğrenen kelime kelime yanlış işaretlenir. Bu,
yazılmış bir dersin üretebileceği en cesaret kırıcı andır. Bunun yerine
türü hedefe eşleştir:

| Öğrenme hedefi | Doğru tür |
|---|---|
| Tek yanıtlı bir olgu | `cloze` (bir boşluk) |
| Bir kavramı tanıma | çoktan seçmeli (`select` modunda `cloze`) / `matching` |
| Bir kavramı tanımlama | anahtar terim boşluklu `cloze` |
| Serbest açıklama / aktarım / karşılaştırma | henüz tam-eşleşme türü yok — şimdilik `cloze` / çoktan seçmeli kullan; öz değerlendirme planlanıyor |
| Tek, belirsizliği olmayan kelime sıralı cümle (dil öğrenme) | `word_tiles` |

Pratik kural: `word_tiles`'ı yalnızca kelime sırası gerçekten benzersiz
olan cümleler için sakla (bir çeviri alıştırması) ve tanımları ve
olguları `cloze` olarak (veya `cloze` `select` modu üzerinden çoktan
seçmeli olarak) yaz. Serbest biçimli bir tanımı asla `word_tiles`'a
veya tam cümlelik `free_text`'e koyma — onun için adil bir tam-eşleşme
puanlaması yoktur. Tam analiz: EXP-041'e bak
(`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`).

## Alıştırma türü kataloğu (durum)

Her alıştırma türünün tek referansı: ne gönderiliyor, yeni bir tür
olmadan neler ifade edilebilir, ne aday ve ne kasıtlı olarak dışlanmış.
Kanonik model spec üzerine **genişletilmez** — bir tür yalnızca kendi
render eden'iyle gönderilir (`SUPPORTED_EXERCISE_TYPES` kaydı
`ExerciseType` enum'una eşit olmalıdır; bir parite testi bunu zorunlu
kılar, v1.4-preview / `picture_choice` vakalarından öğrenilen ders).
Yeni türler, [Yeni bir alıştırma türü ekleme](adding-exercise-type.md)
reçetesi üzerinden somut içerik talebiyle eklenir.

### Uygulanmış (the `ExerciseType` enum)

| Tür | Ne için (öğrenme hedefi, EXP-041) | Not |
|------|-----------------------------------|------|
| `matching` | Kavramları tanıma / eşleştirme | Çift-sürükle, ≥ 3 çift. |
| `picture_choice` | Gerçek bir **resimden** tanıma | ≥ 2 resim, tam olarak biri doğru. Metin çoktan seçmeli için değil. |
| `free_text` | Kısa, olgu biçimli bir yanıt üretme | Tam-eşleşme, ardından Levenshtein ≤ 1. |
| `word_tiles` | Tek, belirsizliği olmayan kelime sırası (dil) | Karolar karıştırılır; varyantlar için `accept_orderings`. |
| `cloze` (`type`) | Tek yanıtlı bir olgu | Boşluk başına bir `<input>`. |
| `cloze` (`select`) | Tekli çoktan seçmeli (legacy araç) | Dokunulabilir düğmeler olarak render edilir (#1342). `accept[0]` doğru + `distractors`. |
| `cloze` (`multiselect`) | "Uyanların hepsini seç" (legacy araç) | `accept` (tümü doğru) + `distractors` üzerinde tam küme eşleşmesi (#1195). |
| `multiple_choice` | **Yerleşik metin çoktan seçmeli** (şema v1.6, #1525) | `options` (`{text, correct?}`, benzersiz metinler) + `multiple`. Tekli = tam olarak bir doğru; çoklu = tam küme eşleşmesi, kısmi puan yok. |

Şema v1.6'dan beri yerleşik bir `multiple_choice` türü vardır. Bu tür,
`cloze` `select`/`multiselect` aracıyla **bir arada yaşar** (EXP-036
§4.3, #890) — mevcut cloze tabanlı çoktan seçmeli geçerli kalır, hiçbir
şey deprecated olmaz. Yeni metin çoktan seçmeli içeriği için
`multiple_choice`'u tercih et: doğruluk, seçenek başına bir bayraktır,
böylece accept/distractor ayrıklığı tuzağı yaşanamaz.
[Çoktan seçmeli yazımı](#coktan-secmeli-yazm)'na bak.

### Uzantı katmanı (the `ext:` namespace)

Kapalı çekirdek enum'unun ötesinde, `ext:<vendor>-<name>` alan adında
alıştırma türleri vardır. Bunlar çekirdek şemaya yapısal olarak
opaktır: bunları kullanan bir ders onları `requires_extensions`
içinde bildirir ve yük, çekirdek şema tarafından değil, kayıtlı uzantı
tarafından doğrulanır. Mekanizma engine referansında açıklanmıştır
[learn-content-engine — `docs/extensions.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/extensions.md).
Uygulama beş uzantı türünü benimsemiştir (`ExerciseDispatcher`'daki
`SUPPORTED_EXT_EXERCISE_TYPES`; bir parite kapısı dispatcher ve yükleme
korumasını senkronize tutar, böylece yüklenebilen her şey render
edilebilir):

| Tür | Ne için | Yük (`ext_payload`) | Benimsendi |
|------|----------|-------------------------|---------|
| `ext:al-categorization` | Terimleri gruplara ayır | `categories: [{name, items[]}]`, en az 2 kova | #1591 (ilk uzantı türü, envanter #1579) |
| `ext:al-error-correction` | Hatalı bir metni düzelt | `tokens[]` + `error_index` + `accept[]` | #1593 |
| `ext:al-reading-comprehension` | Okuduğunu anlama (metin + sorular) | `passage` + `questions[]` (her biri bir `multiple_choice` / `free_text` alt sorusu) | #1603 |
| `ext:al-graded-quiz` | Puanlı sınav | `questions[]` (her biri `points` ile) + isteğe bağlı `pass_threshold` | #1616; demo referans seti Keşfet / İçeriğim'den gizlidir (#1702) |
| `ext:al-dictation` | Sesli dikte (dinle, sonra yazıya dök) | `audio` (bir `assets/` klibi ya da editör yüklemesiyle gömülmüş bir data URI'si, #1911) + `accept[]` (toleranslı yazıya döküm eşleşmesi) | #1881 (beşinci benimseme) |

**İki yazım yolu.** Uzantı alıştırmaları (a) doğrudan içerik-repo JSON'ı
olarak (kanonik yol, engine referansında açıklanmıştır) veya (b)
uygulamada yazılabilir. Ders Oluşturucu, adım 1'deki *Gelişmiş alıştırma
türleri* şablonundan erişilen ve beş türün tümünü kapsayan bir
**uzantı-yazma yardımcısı** (#1852) kazandı (#1859 categorization +
error-correction, #1865 reading-comprehension + graded-quiz, #1887
dictation). Dictation ayrıca, genelleştirilmiş bir
`requires_extensions` kapısının arkasında, adım 3'teki çekirdek
alıştırma-türü seçicisinden de erişilebilir (#1895). Her iki yol da
aynı ders JSON'ını üretir ve `requires_extensions`'ı ayarlar
(sürümlenmiş, örn. `ext:al-dictation@1`).

#### Uzantı türü başına örnek

Her blok, bir ders `.json`'ında göründüğü haliyle alıştırma nesnesidir;
türe özgü veri `ext_payload` altında bulunur. Kanonik alan referansı,
engine'in `docs/extensions.md`'sidir.

```json
{
  "type": "ext:al-categorization",
  "prompt": "Sort each word into fruit or vegetable.",
  "ext_payload": {
    "categories": [
      {"name": "Fruit", "items": ["apple", "banana"]},
      {"name": "Vegetable", "items": ["carrot", "potato"]}
    ]
  }
}
```

```json
{
  "type": "ext:al-error-correction",
  "prompt": "One word is wrong. Correct it.",
  "ext_payload": {
    "tokens": ["The", "two", "child", "are", "playing"],
    "error_index": 2,
    "accept": ["children"]
  }
}
```

```json
{
  "type": "ext:al-reading-comprehension",
  "prompt": "Read the text and answer.",
  "ext_payload": {
    "passage": "Marie is sitting in a café. She orders a coffee and reads a book.",
    "questions": [
      {
        "prompt": "Where is Marie?",
        "type": "multiple_choice",
        "options": [
          {"text": "In a café", "correct": true},
          {"text": "At home"},
          {"text": "At the station"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-graded-quiz",
  "prompt": "Greetings quiz.",
  "ext_payload": {
    "pass_threshold": 60,
    "questions": [
      {
        "prompt": "How do you say 'hello' in French?",
        "type": "multiple_choice",
        "points": 1,
        "options": [
          {"text": "Bonjour", "correct": true},
          {"text": "Merci"},
          {"text": "Au revoir"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-dictation",
  "prompt": "Listen and type what you hear.",
  "ext_payload": {
    "audio": "assets/audio/comment-ca-va.mp3",
    "accept": ["Comment ça va ?", "Comment ca va"]
  }
}
```

### Ders yardımcısı kullanılabilirliği

Oynanabilir (bir render eden var), üretilebilir (AI karışımı onu
üretebilir) ve elle eklenebilir (adım 3'te elle bir tane ekleyip
düzenlersin) üç farklı şeydir. Altı çekirdek türün tümü oynanabilir VE
üretilebilir: ders-oluşturma yardımcısındaki tür seçicisi
(`ExerciseGenerator.tsx`'teki `ALL_TYPES`) her çekirdek türü sunar ve
adım-3'teki her alıştırma satır içi düzenlenebilir ve yeniden
sıralanabilir, bir de manuel bir **+ Alıştırma ekle** düğmesiyle
(#1849, #1853).

| Tür | Oynanabilir | Üretilebilir (AI karışımı) | Elle eklenebilir (adım 3) |
|------|----------|----------------------|---------------------------|
| `matching` | evet | evet | evet |
| `free_text` | evet | evet | evet |
| `cloze` | evet | evet | evet |
| `word_tiles` | evet | evet | evet |
| `picture_choice` | evet | evet | evet |
| `multiple_choice` | evet | evet (#1853; tekli/çoklu mod kontrolü #1888) | evet |
| `ext:al-dictation` | evet | hayır | evet, çekirdek seçici (#1895) veya uzantı yardımcısı (#1887) üzerinden |
| `ext:al-categorization` | evet | hayır | uzantı yardımcısı üzerinden (#1859) |
| `ext:al-error-correction` | evet | hayır | uzantı yardımcısı üzerinden (#1859) |
| `ext:al-reading-comprehension` | evet | hayır | uzantı yardımcısı üzerinden (#1865) |
| `ext:al-graded-quiz` | evet | hayır | uzantı yardımcısı üzerinden (#1865) |

Dictation dışındaki dört uzantı türü, uzantı yardımcısında (veya
içerik-repo JSON'ı olarak) yazılır, asla çekirdek AI üretimine
karıştırılmaz.

**Önce-dinle bir moddur, bir tür değil.** #1687'den beri (karar #1600,
seçenek A) `free_text` ve `matching` alıştırmaları ses-öncelikli bir
öğe taşıyabilir (önce dinle, sonra yanıtla). Alıştırmanın türü
değişmez. Aynı kararın B seçeneği, bir dictation türü,
`ext:al-dictation` uzantısı olarak gönderildi (#1881), yukarıdaki
uzantı katmanında belgelenmiştir.

### Bir yazım aracı olarak Ders Oluşturucu

Uygulama içi Ders Oluşturucu (`/create-lesson`), yalnızca bir
AI-üret düğmesi değil, tam bir yazım yüzeyidir:

- **Her adım-3 alıştırması yerinde düzenlenebilir.** Üretilen veya
  eklenen her alıştırma satır içi bir düzenleyicide açılır (altı çekirdek
  türün tümü, artı uzantı düzenleyicileri); sürükleyerek yeniden sırala,
  sil veya tüm karışımı yeniden üret (#1845).
- **Bir alıştırmayı elle ekle.** **+ Alıştırma ekle** düğmesi bir tür
  seçer ve doğrudan satır içi düzenleyiciye boş bir alıştırma ekler,
  böylece herhangi bir AI üretimi olmadan yazabilirsin (#1849, #1853).
  Seçici, altı çekirdek türü artı dictation'ı listeler (#1895).
- **Örnek cümle üretimi yönlendirir.** Bir kart (adım 2) isteğe bağlı
  bir **örnek cümle** taşıyabilir. O kart için `cloze` ve `word_tiles`
  üretimini mümkün kılan şey budur (cloze için, cümle, boşluk
  bırakılabilmesi için kartın front terimini içermelidir) ve bir kart
  resmi `picture_choice`'u mümkün kılar. Onlar olmadan bu türler sessizce
  atlanır ve adım 3, seçilen hangi türün hiçbir şey üretmediğini açıklar
  (#1847, #1848).
- **Üretilen prompt'lar UI diline uyar.** Alıştırma talimatı şablonları
  üretim zamanında yerelleştirilir (#1857), böylece Almanca bir UI'daki
  bir yazar İngilizce varsayılanlar değil Almanca prompt'lar alır. Bir
  dersi düzenlemek için açtığında, bir legacy İngilizce varsayılanına
  hala byte-özdeş olan herhangi bir alıştırma prompt'u, fırsatçı biçimde
  UI-dili şablonuna taşınır (yalnızca düzenleme durumu, yalnızca
  kaydedersen kalıcı olur) (#1861).

### Yeni bir tür olmadan ifade edilebilir (türler değil, konvansiyonlar)

| Kavram | Nasıl |
|---------|-----|
| Doğru/Yanlış, Evet/Hayır | İki seçenekli `multiple_choice` (veya iki seçenekli bir `cloze` `select`) |
| Açılır liste / radyo / onay kutusu | `multiple_choice` / cloze select sunumu — ayrı türler değil |

### Gerekirse planlanan (adaylar — bir taahhüt DEĞİL)

| Aday | Yakın | Ne zaman |
|-----------|------|------|
| Sıralama / dizme | `word_tiles` | Yalnızca somut içerik talebiyle, sonra reçete üzerinden. |
| Sayı alanı (sayısal karşılaştırma) | `free_text` | Yalnızca somut içerik talebiyle, sonra reçete üzerinden. |

### Kasıtlı olarak dışlanan

| Hariç tutulan | Neden (tek satır) |
|----------|----------------|
| Makale / uzun metin / çizim / formül / akran değerlendirmesi / serbest öz değerlendirme | İkili olarak SRS-puanlanabilir değil; öz değerlendirme ertelendi (#1268). |
| Ses / video / dosya yükleme | Depolama + altyapı; çevrimdışı-öncelikli ile çelişir. Tek istisna: alıştırma düzenleyicisinin data URI'si olarak derse gömdüğü kısa dikte ses klipleri. |
| Hotspot / simülasyon / hafıza / bulmaca | SRS değeri olmadan yapım eforu (varsa daha sonra ayrı bir karar). |
| Matris / Likert / kaydırıcı | Anket türleri, öğrenme türleri değil. |
| Tarih / saat seçicileri | Form türleri, öğrenme türleri değil. |

## Alıştırma türü referansı

Tür başına alan referansı — `matching`, `picture_choice`, `free_text`,
`word_tiles`, `multiple_choice` ve `type` / `select` / `multiselect`
modlarıyla `cloze`: zorunlu alanlar, JSON örnekleri ve anlamsal kurallar
(cloze `___` işaretleri == `blanks`, `card_ids` referans bütünlüğü,
multiselect accept/distractor ayrıklığı, picture-choice tam-olarak-bir-
doğru) — engine referansında bulunur:
[learn-content-engine — `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md).
Oradaki her JSON örneği, engine'in test paketi tarafından çıkarılır ve
doğrulanır, bu yüzden referans çürüyemez. Aşağıdaki uygulamaya özgü
yazım konvansiyonları burada kalır.

### Çoktan seçmeli yazımı

**Tercih edilen (şema v1.6+, #1525): yerleşik `multiple_choice`
türü.** Seçenekler kendi `correct` bayraklarını taşır, bu yüzden ayrık
tutulacak ayrı accept/distractor listeleri yoktur. `multiple: false`
(varsayılan) tekli seçimdir (tam olarak bir doğru); `multiple: true`
"uyanların hepsini seç"tir (tam küme puanlama, kısmi puan yok):

```json
{
  "id": "ex-capital",
  "type": "multiple_choice",
  "prompt": "What is the capital of France?",
  "card_ids": ["card-paris"],
  "options": [
    {"text": "Paris", "correct": true},
    {"text": "Berlin"},
    {"text": "Madrid"},
    {"text": "Rome"}
  ]
}
```

**Legacy araç (hala tamamen geçerli — bir arada yaşama, hiçbir şey
deprecated değil):** v1.6'dan önce metin çoktan seçmeli, `cloze`
`select` modu olarak yazılırdı (EXP-036 §4.3, #890). Tek yanıtlı bir
soru, tek boşluklu bir cloze'dur: `sentence` (`___` ile biter) sorudur,
boşluğun `accept[0]`'ı doğru seçenektir ve `distractors` yanlış
seçeneklerdir. Örnek:
`"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

Sorunun tamamını `prompt`'a koyup yalın bir `"sentence": "___"` de
kullanabilirsin — render eden, doğru yanıt + çeldiricilerden oluşan bir
`<select>` gösterir, seçimi puanlar, geri bildirim verir ve SRS'i
besler:

```json
{
  "id": "ex-hook-state",
  "type": "cloze",
  "prompt": "Which hook manages local state in a function component?",
  "card_ids": ["card-usestate"],
  "sentence": "___",
  "blanks": [{"accept": ["useState"]}],
  "cloze_mode": "select",
  "distractors": ["useEffect", "useContext", "useRef"]
}
```

> **Metin çoktan seçmeliyi asla `picture_choice` olarak yazma.** Bu tür
> yalnızca gerçek resim asset'leri içindir; metin seçeneklerinde
> kullanılabilir bir kontrol değil, yer tutucu karolar render eder (krş.
> astrapi69/adaptive-learner-content-test#10). Metin çoktan seçmeli,
> `multiple_choice` (tercih edilen) veya `cloze` `select` modudur,
> yukarıdaki gibi.

**"Uyanların hepsini seç"** (iki veya daha fazla doğru yanıt, örn. bir
ehliyet sınavı sorusu) `cloze_mode: "multiselect"` kullanır:

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Which cities are in Germany?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Vienna", "Zurich"]
}
```

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

Kapalı rol enum'u: `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` / `tense_marker`. Bir rol
eklemek bir minor şema sürüm artışıdır — onu satır içi genişletme.

## Latin olmayan yazılar: transliterasyon konvansiyonu

Hedef dili Latin olmayan bir yazı kullanan setler için (Japonca,
Çince, Korece, Yunanca, Hintçe, ...) bağlayıcı kurallar. İçerik
reposunda oluşturuldu ve uygulandı — emsaller:
[content#90](https://github.com/astrapi69/adaptive-learner-content/issues/90),
[content#91](https://github.com/astrapi69/adaptive-learner-content/issues/91);
kalan-eksik taramaları:
[content#106](https://github.com/astrapi69/adaptive-learner-content/issues/106),
[content#107](https://github.com/astrapi69/adaptive-learner-content/issues/107).

**1. Yön kuralı.** Transliterasyon yalnızca kaynak dil Latin yazı
yazdığında Latin olmayan **hedef** dil içindir (de→ja, de→zh, de→ko,
...). Latin yazı hedefli Latin olmayan bir **kaynak** dil (hi→en,
el→fr) transliterasyon almaz — öğrenen zaten kendi yazısını okur.

**2. Format.** Orijinalin hemen ardından yuvarlak parantez:
こんにちは (konnichiwa). Teori adımlarında her zaman; seçeneklerde ve
prompt'larda yalnızca zararsız olduğu yerde (ele-vermeme kuralına bak).

**3. Ele-vermeme kuralı (çekirdek).** Transliterasyon asla çözümü ele
vermemelidir. Yazı-okuma görevleri, ton tanıma, `word_tiles` karoları
ve cloze cümle bağlamları, sorgulanan öğede transliterasyon OLMADAN
kalır; anlam görevleri onu alır. Şüphe duyduğunda, dışarıda bırak.

- Olumlu örnek (anlam eşleştirme, content#91): matching çifti
  `{"left": "妈 (mā)", "right": "Mama / Mutter"}` — sorgulanan bilgi
  anlamdır, bu yüzden okuma yardımı hiçbir şeyi ele vermez.
- Olumsuz örnek (yazı okuma, content#91):
  `ko-a1/01-hangul-lesen` yazı-okuma alıştırmaları transliterasyon
  olmadan kalır, çünkü romanizasyon yanıtın TA KENDİSİDİR (karakter →
  ses); prompt'taki `가 (ga)` öğrenene çözümü verirdi.

**4. Dil başına standart romanizasyon, bir set içinde tutarlı:**
Japonca Hepburn, Çince ton işaretleri OLAN Pinyin, Korece Revised
Romanization, Yunanca/Hintçe yaygın basitleştirilmiş bir
transliterasyon. Bir set içinde asla sistemleri karıştırma.

**5. Yazma görevleri** (`free_text` / cloze `type` modu): `accept[0]`
kanonik romanize formdur; ayrıca yaygın varyantları da kabul et —
Japonca: Kunrei yazımları (si/ti/tu/hu/zi, örn. `konnichiwa` yanında
`konnitiwa`); Çince: tonsuz Pinyin (`nǐ hǎo` yanında `nihao`); Korece:
yaygın alternatifler (örn. `annyeong haseyo`). Bellek çengeli: **bir
alıştırma öğrenenin klavyesinde asla başarısız olmamalıdır.** Emsal (IME
engeli, content#107): yalnızca 가'yı kabul eden bir cloze, Korece bir
IME olmadan çözülemezdi — romanize `ga`'nın da kabul edilmesi gerekti.

Hangi türün hangi öğrenme hedefini taşıdığı: bkz.
[alıştırma türü kataloğu](#alstrma-turu-katalogu-durum).

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
   reposuna bir Pull Request, kendi `scripts/validate_content.py`'sini
   çalıştırır (vendored, engine-pinli şema aynasına karşı yapı + kalite
   alt sınırları) artı bir engine-uygunluk kapısı (`learn-content-engine`
   `validate()` her ders üzerinde), böylece manuel bir PR kapıyı
   atlayamaz.

**Kalite alt sınırları (sert kapı):** ders başına ≥ 5 alıştırma, ≥ 2
alıştırma türü, ≥ 1 teori adımı, Free-Text ≥ 2 kabul edilen yanıt +
distractor'lar, Matching ≥ 3 çift, distractor'lı Picture-Choice, boş
kart ön/arka yüzleri yok ve (Latin olmayan başlangıç yazıları için)
başlangıç yazısında kart arka yüzleri. Bunlar alt sınırlardır, hedef
değil — yukarıdaki kontrol listesi daha fazlasını ister.

### Set genelinde AI içerik denetimi (isteğe bağlı)

Paylaşma zamanı denetiminin yanı sıra, indirilen bir set *Yapay zeka
ile denetle* üzerinden set genelinde incelenebilir. Bu tamamen isteğe
bağlıdır ve öğrenenin yapılandırdığı **sağlayıcı + modeli** kullanır
(Anthropic / OpenAI / Gemini); kartlar inceleme için o sağlayıcıya
gruplar halinde gönderilir. Akış bir maliyet tahmini gösterir, bir
ilerleme çubuğu + iptal ile çalışır ve tarayıcıda önbelleklenen ve
**Markdown** olarak dışa aktarılabilen (hangi sağlayıcı + modelin
denetimi çalıştırdığını kaydeden bir satırla) bir **kart başına rapor**
üretir. Rapor geçtiğinde, set bir içerik hash'i + bir imza ile
desteklenen bir **"AI-Checked" rozeti** kazanır, böylece kartlara
sonradan yapılan bir düzenleme, set yeniden denetlenene kadar rozeti
geçersiz kılar. AI denetimi asla bir kapı değildir — bir yayımlama
gereksinimi değil, danışmanlık niteliğinde bir köken bilgisidir.

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
teori adımı, free-text accept'leri + distractor'lar, matching çiftleri,
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

## Referans: paketlenmiş setler

Adaptive Learner, birkaç alan boyunca (diller, programlama, psikoloji,
yapay zeka, teknoloji — canlı sayılar + tam set-başına tablo için
README CONTENT-STATS bloğuna bak) hatırı sayılır bir kütüphane gönderir.
`adaptive-learner-content` reposunda birkaç iyi kanonik referans:

- `sets/en/fr-a1/` — İngilizce konuşanlar için Fransızca A1;
  `sets/de/fr-a1/` Almanca-kaynaklı karşılığıdır.
- `sets/en/es-a1/` + `sets/de/es-a1/` — İspanyolca A1 (kaynak dil
  başına bir tane).
- `sets/de/` altındaki "Python — Grundlagen" seti bir
  `domain: programming` örneğidir (Almanca kaynak == hedef), dil-dışı
  bir referans olarak yararlıdır.

Hepsi bu kılavuzda açıklanan konvansiyonları izler. Eksiksiz bir dersi
okumak, yapıyı içselleştirmenin en hızlı yoludur.

---

## Topluluk katılımına giden yol (v1.42.0)

> **Ekran görüntülü adım adım anlatım:**
> [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f)
> (Medium), uygulama içi Ders Oluşturucu'yu ilk karttan bitmiş dersi
> paylaşmaya kadar baştan sona anlatır.

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
- [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f) — ekran görüntülü harici Medium anlatımı
