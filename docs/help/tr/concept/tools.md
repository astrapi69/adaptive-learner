<!-- Translation: AI-generated, pending native review -->

# Araçlar: üç sütun

AdaptiveLearner tek öğrenme aracınız olmaya çalışmaz. Şu anda
ne yaptığınız için sizi doğru harici araca yönlendiren orkestratör
olmaya çalışır. Katalogda yer alan beş araç üç sütunla eşleştirilmiştir.

## Üç sütun

### 1. Aralıklı tekrar

Bilişsel bilim yerleşmiştir: uzun vadeli hafıza için yoğunlaştırılmış
tekrar yerine aralıklı tekrar daha etkilidir. Tekrarlar arasındaki
aralık önemlidir; Anki gibi araçlar bunu bir disipline dönüştürür.

**Önerilen araç**: [Anki](https://apps.ankiweb.net/).
Masaüstünde ücretsiz, iOS'ta ücretli, zamanlama algoritması iyi
ayarlanmıştır ve fiilen standart haline gelmiştir. Bu alandaki diğer
uygulamaların çoğu Anki'nin aralıklarını kopyalar.

**Şunlar için kullanın**: uzun vadede hatırlanması gereken her şey.
Kelime hazinesi, formüller, adlandırılmış varlıklar, hata düzeltme
tarifleri. AdaptiveLearner oturumları anlamak için harikadır; Anki
unutmamak için harikadır.

Adaptive Learner profili "tümdengelimli" ve "hata_tabanlı"yı Anki'ye
en güçlü şekilde yönlendirir, çünkü her iki yöntem de kart haline
getirmeye değer materyal üretir.

### 2. Kendi kaynaklarınızdan aktif hatırlama

İkinci sütun, sağladığınız belgelerden bilgi oluşturmaktır. Modern
araçlar, PDF'ler, notlar ve transkriptler yüklemenize ve ardından
kendinizi test etmenize ya da o spesifik korpusa dayalı sorular sormanıza
olanak tanır.

**Önerilen araç**: [NotebookLM](https://notebooklm.google.com/).
Google'ın kaynaklarınızı etkileşimli bir bilgi grafiğine dönüştüren
aracı. Bu amaç için ChatGPT'den daha iyidir çünkü yapay zekanın yanıtları
sağladığınız belgelere bağlıdır.

**Ayrıca yararlı**:
[Excalidraw](https://excalidraw.com/) bilgi yapınızı taslak olarak
çizmek için,
[Obsidian](https://obsidian.md/) aylarca büyüyen bağlantılı notlar
bilgi grafikleri için.

**Şunlar için kullanın**: mevcut materyallerinizin (araştırma makaleleri,
dahili belgeler, ders slaytları) olduğu alana özgü öğrenme ve onlardan
bilgi yapısı çıkarmak istediğinizde.

### 3. Uyumlu yapay zeka istemleri

Üçüncü sütun, diğer iki sütuna uymayan tek seferlik sorular için
doğrudan yapay zeka erişimidir. Bazen yalnızca bir açıklamaya ihtiyacınız
vardır. Bazen beyin fırtınası yapmak istersiniz.

**Önerilen araç**:
[Claude](https://claude.ai/),
[ChatGPT](https://chat.openai.com/) ya da
[Gemini](https://gemini.google.com/). AdaptiveLearner aynı API'ları
dahili olarak kullanır; daha az yapılandırılmış keşif için web
arayüzlerinde doğrudan konuşabilirsiniz de.

**Şunlar için kullanın**: açık uçlu sorular, beyin fırtınası, "Bu paragrafı
açıkla", "Bu probleme üç farklı çerçeveleme ver". Yapılandırılmamış
sohbet diverjant düşünce için parlar; AdaptiveLearner oturumları odaklı
konverjant pratik için parlar.

## AdaptiveLearner araçları nasıl sıralar

Gösterge Tablosunun Araç Önerileri kartı basit bir puanlama çalıştırır:

```
puan(araç) = toplam(profil_ağırlığı[k] for k in araç.ağırlık_anahtarları)
```

Her araç en iyi hizmet ettiği 1-2 yöntem eksenini bildirir:

| Araç | Ağırlık anahtarları | Neden |
|---|---|---|
| Anki | deductive, error_based | Kartlar kuralları + düzeltmeleri kodlar |
| NotebookLM | inductive, contextual | Örnekler + bağlamsal materyal |
| Uyumlu yapay zeka istemi | ai_adaptive, dialogic | Uyumlu konuşma |
| Excalidraw | contextual, inductive | Örneklerden görsel yapı |
| Obsidian | deductive, inductive | Tek grafikte teori + örnekler |

Değerlendirmedeki profil ağırlıkları her aracın ağırlık_anahtarlarına
göre toplanır ve sıralı liste Gösterge Tablosunun yüzeylendirdiği
şeydir. Sıralama, profiliniz değiştiğinde güncellenir (değerlendirmeyi
yeniden yaparak).

## Aralıklı öneriler

Gösterge Tablosundaki ikinci bir takip yüzeyi: **Aralıklı** kartı.
Bu bir araç önerisi değildir; bir eylem önerisidir. Sistem, her yöntemde
en son ne zaman bir oturum yaptığınızı takip eder, ardından önerir:

| Son commit'ten bu yana geçen süre | Kart türü | Aralık |
|---|---|---|
| Hiçbir zaman | ilk | 1 gün |
| > 14 gün | yenile | 1 gün |
| 7-14 gün | gözden geçir | 3 gün |
| 3-7 gün | pratik yap | 7 gün |
| < 3 gün | sürdür | 14 gün |

Dolayısıyla iki haftadır dokunmadığınız bir yöntem "1 günde Yenile"
kartı alır. Dün kullandığınız bir yöntem "14 günde Sürdür" alır (ya
da liste 5 ile sınırlı olduğu için hiç görünmez).

Kartlar aciliyet sırasına göre sıralanır (düşük aralık × daha güçlü
ağırlık = daha yüksek öncelik). Bunları takip etmek zorunda değilsiniz
— bunlar emirler değil, dürtmecelerdir.

## Birinci sınıf gönderilen entegrasyonlar (v1.17.0'dan beri)

Üç araç, v1.17.0 ile v1.20.0 arasında "harici öneri"den "yerleşik
dışa aktarma"ya taşındı:

- **Anki .apkg dışa aktarma** (v1.17.0 / Aşama 30) — `/anki` sayfasında
  yapay zeka tarafından çıkarılan flash kartları inceleyin, istediğiniz
  olanları kabul edin, Dışa Aktar'a tıklayın. `.apkg`, Anki masaüstünde
  doğrudan çalışan sql.js + JSZip aracılığıyla istemci tarafında oluşturulur.
  Manuel aktarım gerekmez.
- **NotebookLM ZIP paketi** (v1.19.0 / Aşama 32) — İlerleme sayfası
  → Çalışma paketini indir. ZIP, NotebookLM'nin kaynak yüklemesi için
  biçimlendirilmiş `summary.md`, `vocabulary.md`, `rules.md`, `errors.md`,
  `flashcards.md` ve `sessions/*.md` içerir. NotebookLM'nin herkese açık
  API'sı olmadığından bu en iyi yoldur.
- **Ses (TTS + STT + Telaffuz Pratiği)** (v1.18.0 / Aşama 31) — Web
  Speech API entegrasyonları doğrudan Oturum + Değerlendirme'de ve
  Diller olarak etiketlenmiş projeler için özel `/pronunciation` sayfasında.
  Harici araç gerekmez.

## Katalogda YER ALMAYAN şeyler

Kasıtlı olarak dışlananlar:

- **Duolingo / Babbel / benzer oyunlaştırılmış uygulamalar** — felsefeyle
  çelişirler. Adaptive Learner XP + rozetler + seriler (v1.16.0) ile
  birlikte gelir, ancak bunlar oyunlaştırılmamış içerik üzerinde bir
  motivasyon katmanı olarak kullanılır, birincil döngü olarak değil.
- **Khan Academy / Coursera** — bunlar ders tamamlamaya yönelik, beceri
  edinmeye değil. Farklı sorun alanı.
- **Memrise** — Anki'ye çok benziyor; katalog her niş için bir araç
  tutar.
- **Notion** — "bağlantılı notlar" nişi için abartılmış; Obsidian
  bulut kilitlenmesi olmadan temiz biçimde uyar.

Katalog kasıtlı olarak küçüktür. Daha fazlasını eklemek sinyali
zayıflatır.
