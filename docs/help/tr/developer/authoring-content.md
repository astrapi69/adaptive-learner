<!-- Translation: AI-generated, pending native review -->

# Ders içeriği yazma

Bu kılavuz, Adaptive Learner içerik yükleyicisi için yeni bir ders
seti oluşturmayı adım adım anlatmaktadır. Kişisel kullanım için
veya genel içerik havuzuna katkı olarak bir dil ya da konu seti
göndermek isteyen herkes, herhangi bir ders yazmadan önce bunu
baştan sona okumalıdır.

## İçerik seti nedir?

Bir **içerik seti**, kullanıcının Set Tarayıcısı sayfasından
(`/content`) indirebileceği sürümlendirilmiş bir ders paketidir.
İçerik-Yükleyici eklentisi (v1.27.0'da gönderildi), her iki depolama
modunda da keşif, indirme, önbelleğe alma ve sürüm uzlaşmasını
yönetir.

Bir setin üç katmanı vardır:

1. **Kök manifest** (`manifest.yaml`) — deponun gönderdiği her seti
   listeler. Set Tarayıcısı tarafından kaynak katalogunu oluşturmak
   için kullanılır.
2. **Set manifesti** (`sets/{set-id}/manifest.yaml`) — kök
   manifestinin kardeşi, bu özel setin içindeki ders dosyalarını
   listeler.
3. **Ders dosyaları** (`sets/{set-id}/lessons/NN-slug.json`) — her
   ders başına bir JSON dosyası; her indirmede şema v1.0'a göre
   doğrulanır.

Adaptive Learner ile birlikte gönderilen pilot setler, ayrı bir
içerik deposunda yaşar
([`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
— `../adaptive-learner-content` kardeş olarak klonlanır ve
`frontend/scripts/copy-bundled-content.mjs` tarafından derlemeye
paketlenir) ve kopyalamak için iyi şablonlardır.

## Dil çiftleri (v1.44.0)

Her içerik seti öğrettiği dil ÇİFTİni bildirir:

- **`target_language`** — öğrencinin ÖĞRENDİĞİ dil (örn. `fr`).
- **`source_language`** — öğrencinin HALİHAZIRDA KONUŞTUĞU dil,
  yani kartın **`back`** alanlarının, **`notes`**'un ve **teori**
  metninin yazıldığı dil (örn. `de`).

Bu, "İngilizce konuşanlar için Fransızca"yı "Almanca konuşanlar
için Fransızca"dan farklı bir set yapar: aynı hedef (`fr`), farklı
kaynak (`en` ve `de`), farklı açıklama dili. Bir öğrenci yalnızca
`source_language`'ı konuştukları bir dille eşleşen setleri görür
(uygulama dilleri artı Ayarlar → Öğrenim'de ekstra seçilenler).

Set ID'leri çifti `{target}-{level}-from-{source}` olarak kodlar
(örn. `fr-a1-from-de`) ve her set, kaynak dil dizinini işaret eden
bir **`path`** bildirir (`sets/de/fr-a1`). Bir set ayrıca
**`title`** (kaynak dilde, öğrencinin okuduğu) ve **`title_native`**
(hedef dilde, ikincil etiket olarak gösterilen) taşır.

Her iki kod da 2 harfli ISO 639-1 olmalı ve `source_language`,
`target_language`'dan farklı olmalıdır. v1.2 öncesi bu alanlara
sahip olmayan setler yine de yüklenir: eski `language` anahtarı
`target_language` olarak kabul edilir ve `source_language`
varsayılan olarak `en`'dir.

## Dosya sistemi düzeni

Ağaç, KAYNAK dile, ardından hedef+seviyeye göre düzenlenir:

```
my-content-repo/
  manifest.yaml               # root: lists every set (with path + pair)
  sets/
    de/                       # source language: German
      fr-a1/                  # target French, level A1  -> id fr-a1-from-de
        manifest.yaml         # set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # source language: English
      fr-a1/                  # -> id fr-a1-from-en
        ...
```

## Manifest biçimi

Her iki manifest dosyası da (kök + set) aynı `schema_version:
'1.0'` şeklini kullanır. Zorunlu alanlar:

```yaml
schema_version: '1.0'
name: My English B1 set
description: >-
  Optional long-form description.
sets:
  - id: language-en-b1        # slug-safe, unique
    title: English B1 (Intermediate)
    language: en              # BCP-47 (e.g. en, fr, zh-Hans)
    level: B1                 # CEFR for languages, free-form otherwise
    version: '1.0.0'          # semver — bumped per set release
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optional set-level description.
    tags:
      - intermediate
      - business
metadata:
  author: Your Name
  license: CC-BY-SA-4.0       # or whatever
```

Set manifesti ek olarak her ders dosyasını listeler:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

İçerik-Yükleyici, `metadata.lessons`'ı sırayla yürütür; dizindeki
dosya sırası önemli değildir, yalnızca manifest sırası önemlidir.

## Ders şeması (v1.0)

Her ders tek bir JSON dosyasıdır. Üst düzey şekil:

```json
{
  "id": "01-greetings",
  "title": "Greetings",
  "description": "Optional 1-2 sentence summary.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Kartlar

Kart, en küçük öğrenilebilir birimdir — genellikle tek bir terim
veya kavram. Her kartın sabit bir id'si vardır (alıştırmalardan
referans alınır) ve bir ön/arka çifti:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "the (masculine singular)",
  "notes": "Used before consonant-starting masculine nouns. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

Notlar Markdown'ı destekler. Telaffuz ipuçları, yanlış-arkadaş
uyarıları, düzensiz biçim uyarıları için kullanın — uzun vadeli
hatırlama için yardımcı olan her şey. Etiketler SRS filtrelemesini
yönlendirir.

### Adımlar

Ders, her biri TEORI (bir Markdown bloğu) veya ALIŞTIRAMA (dört
alıştırma türünden biri) olan bir adım dizisidir:

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Why articles matter",
  "body": "# Articles in French\n\nEvery French noun has a gender..."
}
```

Veya bir alıştırma:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Match greetings",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Match each greeting to its translation.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hello"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Alıştırma türü referansı

### matching

Sürükle-eşleştir alıştırması. Oluşturucu, görüntülemeden önce karıştırır.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Match each French noun with its article.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Her çiftin tam olarak iki anahtarı olmalıdır: `left` + `right`.

### picture_choice

Resimlerle çoktan seçmeli. ≥ 2 resim, tam olarak biri doğru
işaretlenmiş.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Which is the evening greeting?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optional Markdown hint shown on demand.",
  "distractors": ["Bonjour"]
}
```

Not: `is_correct` bir JSON boolean değil, **dize** `"true"`'dur.

`src` mevcut olmayan bir kaynağı işaret ediyorsa, oluşturucu
`label` metnine geri döner — resim seçme alıştırmaları illüstrasyon
varlıkları olmadan bile işlevseldir.

### free_text

Cevabı yazın. Oluşturucu önce tam eşleşme, ardından Levenshtein
toleranslı geri dönüş yapar.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "How do you say 'Thank you' in French?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "It starts with M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]`, yanlış bir denemeden sonra gösterilen kanonik yanıttır.
Büyük/küçük harf ve noktalama işaretlerini kapsamak için ≥ 3
varyant ekleyin; oluşturucu boşlukları normalize eder.

### word_tiles

Karolarıörüsüyle sıraya dizin. Oluşturucu, görüntülemeden önce
karıştırır.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Arrange: I see a cat.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Same word order as English."
}
```

Birden fazla kelime sırası doğruysa, `accept_orderings` ekleyin:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Her sıralama, karo endekslerinin bir permütasyonudur.

### cloze (Aşama 52 / v1.35.0 — şema 1.1)

Cümlede görünür `___` işaretçileriyle boşluk doldurma.
Her `___`, `blanks[]`'taki bir girişe karşılık gelir (soldan sağa
eşleme; yükleyici `sentence.count("___") == len(blanks)` uygular).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Fill in the indefinite article.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "masculine indefinite article",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* is the masculine indefinite article."
}
```

**Oluşturma modları** — alıştırma başına `cloze_mode` aracılığıyla ayarlayın:

- `"type"` (atlandığında varsayılan): boşluk başına bir `<input>`.
  free_text'in kullandığı NFC + Levenshtein-≤-1 eşleştirici ile
  doğrulanır, bu nedenle yazarların yalnızca anlamsal varyantları
  numaralandırması gerekir (yazım hatalarını değil).
- `"select"`: boşluk başına bir `<select>`. Seçenekler
  `accept[0]` + alıştırmanın `distractors`'ından çizilir,
  sabit tohum ile boşluk başına karıştırılır.
  **Boş olmayan `distractors` gerektirir** — şema doğrulayıcısı,
  distraktörler olmadan `cloze_mode: "select"` alıştırmalarını reddeder.

**Çok boşluklu cloze** desteklenir: cümledeki her `___`, `blanks`'taki
bir sonraki girişe sırayla eşlenir. Her boşluğun kendi ipucu +
yer tutucu + kabul listesi olabilir. Element düzeyinde SRS, boşluk
başına bir ElementAttempt'e dönüşür.

**Kartlardaki token rolleri (Aşama 52I / v1.35.0)** — çalışma zamanı
cloze oluşturucusunun anlamsal olarak anlamlı bir boşluk hedeflemesine
izin veren Card'daki isteğe bağlı meta veri:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "a cat",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Kapalı rol enum'u: `article` / `verb` / `noun` / `adjective`
/ `preposition` / `gender_marker` / `tense_marker`. Rol eklemek
küçük bir schema_version artışıdır — yerinde genişletmeyin.

## Alıştırma yönü (v1.46.0 / EXP-018)

Her alıştırma, öğrencinin kartı hangi yönde çalıştırdığını söyleyen
isteğe bağlı bir `direction` alanını kabul eder:

- `target_to_source` (varsayılan) — ALICI: öğrenciye hedef dil
  gösterilir ve kaynak dili tanır (daha kolay).
- `source_to_target` — ÜRETİCİ: öğrenciye kaynak dil gösterilir
  ve hedefi üretir (daha zor).
- `both` / `random` — oluşturucunun / uyarlamalı oluşturucunun
  deneme başına somut bir yön seçmesine izin verin.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Alan katkı niteliğindedir — şema 1.2 sürümünde kalır ve `direction`
olmayan dersler tam olarak eskisi gibi davranır (alıcı).

### Uyarlamalı ders oluşturucusuna yardımcı olan ek açıklamalar (v1.36.0+)

Aşama 53 uyarlamalı ders oluşturucusu (`/adaptive-lesson/:setId`,
F-114), öğrencinin özel zayıflıklarını çalıştırmak için yazılı
alıştırmaları yeniden birleştirir. İki alan onu daha akıllı kılar:

1. **Kartlarda daha geniş `token_roles` kapsamı.** Oluşturucu
   `token_roles`'ü şunlar için kullanır:
   - Hatalardan cloze varyantları oluştururken anlamsal olarak
     anlamlı boşlukları seçmek
   - Hataları Gösterge Tablosu "Odak alanları" çipleri için
     `article_gender` / `verb_conjugation` olarak sınıflandırmak
   - Kullanıcı orijinali yanlış yaptığında aynı öğeyi test eden
     ALTERNATIF alıştırmaları bulmak

   Her grammatik birimi öğreten HER karta bir `token_roles` girişi
   ekleyin — makaleler, çekimlenmiş fiil biçimleri, cinsiyetli
   isimler. Maliyet, kart başına bir ekstra JSON girişidir.

2. **Kart düzeyinde gramer etiketleri** (`tags: ["article", "masculine"]` vb.)
   `token_roles` yokken hata sınıflandırıcısı tarafından geri dönüş
   olarak okunur.

## Varlıklar (bir setle paketlenen resimler) — v1.37.0+

Resim seçimi alıştırmaları ve kart kapak resimleri ya:
1. Set düzeyi manifestte bildirilen ve ders JSON'ının yanında gönderilen
   **Yazarlı varlık dosyalarından**, ya da
2. Çalışma zamanında hiçbir varlık yokken oluşturulan **Yer tutucu SVG'lerden**
   gelir (renk etiketi için renk örnekleri, rakamlar için büyük
   rakamlar, diğer her şey için avatar stili).

### Dizin düzeni

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

`path`, setin `assets/` dizinine göredir. Ders JSON içinde,
resim seçimi alıştırmaları varlıklara `assets/` önekiyle başvurur:

```json
{
  "type": "picture_choice",
  "prompt": "Which one is 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Cat", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Dog"}
  ]
}
```

### Boyut + biçim sınırları

- **Varlık başına sınır**: 500 KiB.
- **Set başına yumuşak sınır**: toplam 10 MiB varlık. Doğrulayıcı
  uyarır ama reddetmez.
- **Kabul edilen biçimler**: `.png` / `.jpg` / `.jpeg` / `.webp`
  / `.svg`. GIF yok (animasyonlu içerik dikkati dağıtır) ve
  BMP yok (sıkıştırma yok).

### Boyutlandırma önerileri

Resim seçimi karoları masaüstünde en fazla 150x150 px, mobilde
100x100 px olarak oluşturulur (`object-fit: contain`). 300x300 px
kaynak resimler, retina ekranlarda şişmeden en iyi sonucu verir.

## Kalite kontrol listesi

Yeni bir ders için PR açmadan önce doğrulayın:

- [ ] Ders başına **3-5 teori adımı** + **8-12 alıştırma**
- [ ] **En az 3 alıştırma türü** temsil ediliyor
- [ ] **Teori adımları ≤ 200 kelime** her biri
- [ ] **Free_text alıştırmaları**: ≥ 3 kabul varyantı + ≥ 3 distraktör
- [ ] **Word_tiles**: alıştırma başına ≥ 3 karo
- [ ] **estimated_minutes**: 10-15 (gerçekçi, özlemci değil)
- [ ] **Distraktörler yanlış-ama-makul** — anlamsal olarak ilişkili, asla rastgele
- [ ] **Kart notları** gerçek değer taşıyor
- [ ] **Aşamalı yapı**: sonraki kavramlar aynı setteki öncekiler üzerine inşa eder
- [ ] **Kültürel doğruluk**: gerçek dünya kullanımı, yalnızca ders kitabı ifadeler değil
- [ ] **Şema doğrulama**: ders `dict_to_lesson()` aracılığıyla temiz yüklenir
- [ ] **Kart id bütünlüğü**: her `exercise.card_ids[i]`, dersin `cards[]`'ında mevcuttur
- [ ] **Dil çifti**: `target_language` + `source_language` ayarlandı (ISO 639-1, farklı), `title_native` mevcut

## Doğrulama (iki katman, v1.44.0)

İçerik, aynı kontrolleri çalıştıran iki doğrulama katmanı tarafından
geçit uygulanır:

1. **Uygulama içi, paylaşmadan önce.** Bir öğrenci *Derslerim → Toplulukla Paylaş*
   aracılığıyla bir ders paylaştığında, önce kural tabanlı bir kontrol çalışır
   (her zaman, AI gerekmez). Aşağıdaki **minimumları** uygular.
2. **İçerik deposunun CI'sında.** `astrapi69/adaptive-learner-content`'e
   açılan bir PR, aynı kurallarla her seti yeniden kontrol eden
   `scripts/validate_content.py`'yi çalıştırır.

**Kalite minimumları (sert geçit):** Ders başına ≥ 5 alıştırma,
≥ 2 alıştırma türü, ≥ 1 teori adımı, free_text ≥ 2 kabul cevabı +
distraktörler, matching ≥ 3 çift, resim seçimi distraktörleri, boş
kart ön/arka yok.

## Yerel test

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} cards, {len(lesson.steps)} steps')
"
```

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

## PR iş akışı

Setiniz hazır olduğunda:

1. Ana adaptive-learner reposuna bir PR açın, ya da
2. GitHub hesabınız altında kendi içerik reponuzu oluşturun ve
   `backend/config/plugins/content-loader.yaml`'dan İçerik-Yükleyici'yi
   ona yönlendirin (`default_sources` altında).

## Yaygın tuzaklar

**Kart id referansları**: bir alıştırmadaki her `card_ids` girişi
dersin `cards[]`'ında mevcut olmalıdır.

**Slug güvenli id'ler**: tüm id'ler (ders, kart, adım, alıştırma)
`^[a-z0-9]+(-[a-z0-9]+)*$` ile eşleşmelidir. Alt çizgi yok,
kesme işareti yok, büyük harf yok, baş/sondaki kısa çizgi yok.

**`is_correct: "true"`**: bir JSON boolean değil, dizedir.

**Ekstra alanlar**: her modelin `extra="forbid"` vardır. Şemanın
bilmediği bir alan eklemek tüm dersi reddeder.

**Teori gövdesi**: teori adımları boş olmayan bir `body` alanı
(Markdown) gerektirir. Alıştırma adımları `body` taşımamalıdır —
bunun yerine alıştırmanın `prompt`'unu kullanın.

## Referans: pilot setler

Adaptive Learner ile gönderilen iki set kanonik referanslardır:

- `sets/en/fr-a1/` — İngilizce konuşanlar için Fransızca A1 (10 ders);
  `sets/de/fr-a1/` Almanca kaynaklı pilottur.
- `sets/en/es-a1/` + `sets/de/es-a1/` — İspanyolca A1, `adaptive-learner-content`
  deposunda.

---

## Topluluk katkı yolu (v1.42.0)

Sıfırdan ders yazmak zorunda değilsiniz. Katkıda bulunmanın
en hızlı yolu **uygulamada bir ders oluşturmak ve paylaşmaktır**:

1. Bir sohbet içe aktarın ve analiz edin, ardından **Çevrimdışı Ders
   Olarak Kaydet**'e tıklayın (veya uyarlamalı bir dersi bitirin ve
   **Bu dersi kaydet?**'e tıklayın). Ders, Set Tarayıcısı'ndaki
   **Derslerim** altında görünür.
2. Derslerim'den, bir içerik seti `.zip`'i (manifest + dersler)
   indirmek için **Set olarak dışa aktar**'a tıklayın.
3. İçerik deposunda önceden doldurulmuş bir GitHub sorunu açmak
   için **Toplulukla Paylaş**'a tıklayın. Dışa aktarılan `.zip`'i
   ekleyin.
4. Bir bakıcı dersi inceler, manifestini (id, başlık, dil, seviye,
   etiketler) yukarıdaki kurallara göre düzenler ve `sets/` altına
   ekler.

## Paylaşım sihirbazı, varyasyonlar ve yazar kredisi (Aşama 64)

**Derslerim**'den bir ders paylaşmak, doğrudan GitHub'a atlamak
yerine dört adımlı bir sihirbaz açar:

1. **Önizleme + yerleştirme.** Uygulama, dersin ağaçta tam olarak
   nereye düştüğünü hesaplar.
2. **Yineleme kontrolü.** Ders, o ağaç yolundaki mevcut derslerle
   kart örtüşümü ve alıştırma örtüşümü ile karşılaştırılır (danışman
   — hiçbir zaman engellemez). Benzer bir şey varsa şunları yapabilirsiniz:
   - **Bir varyasyon olarak paylaş** — ders `variation_of: "{original_id}"`
     etiketiyle etiketlenir.
   - **Yalnızca yeni alıştırmaları önerin** (neredeyse yinelenmiş) — sihirbaz
     yalnızca orijinalin eksik olduğu alıştırmaları çıkarır.
3. **Kalite özeti.** Kural tabanlı doğrulayıcı bulguları; uyarılar
   gösterilir ama hiçbir zaman engellemez.
4. **Paylaş + kutla.** Tek bir tıklama GitHub PR/sorununu açar.

### Varyasyon + kredi alanları (şema 1.3, hepsi isteğe bağlı)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "More exercises on agreement",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Dördü de katkı niteliğindedir ve isteğe bağlıdır; bunlar olmayan
dersler tam olarak eskisi gibi davranır.

### Katkı geçmişi ve boşluklar

Paylaşılan dersler, **Katkılarım** altında yerel olarak hatırlanır
(hesap gerekmez) ve beş paylaşımda *Topluluk Katkıcısı* tanıması
yapılır. Set Tarayıcısı ayrıca **Eksik Dersler**'i de gösterir —
mevcut bir çiftin bir sonraki CEFR seviyesi için teşvik edici
öneriler.
