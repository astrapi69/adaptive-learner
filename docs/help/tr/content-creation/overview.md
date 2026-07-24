# Ders oluşturma — Genel bakış

Adaptive Learner içerikle yaşar. Kendi derslerini oluşturabilir —
doğrudan uygulamada ya da İçerik repo formatında bir dosya olarak —
ve bunları toplulukla paylaşabilirsin. Bu sayfa genel bakışı verir;
ayrıntılı format bilgileri bağlantılı kaynaklarda bulunur.

---

## Ders oluşturmanın iki yolu

### 1. Uygulamada: Ders Oluşturucu

`/create-lesson` altındaki **Ders Oluşturucu**, 4 adımlı bir
yardımcıdır (Üst veriler → Kart Düzenleyici → Alıştırma Düzenleyici →
Kaydet/Paylaş) ve **bir yapay zeka anahtarına ihtiyaç duymaz**:

- Kartları sürükle-bırak ile sırala ya da **CSV'den içe aktar**;
  kartlar **yüklenmiş bir resim** taşıyabilir.
- Üst veriler adımında **bilgi alanı** seçilebilir (örn. dil,
  programlama, psikoloji, köpek eğitimi, trafik bilgisi).
- Alıştırmaları kartlardan **otomatik üret** ya da 3. adımda
  **tamamen kendin düzenle**: tüm çekirdek alıştırma türleri
  oluşturulabilir, değiştirilebilir ve elle eklenebilir — belirgin
  bir **tekli/çoklu seçim** anahtarına sahip yerleşik **çoktan
  seçmeli (Multiple Choice)** dahil.
- **Dikte** (sesli dikte) doğrudan alıştırma türü seçicisinde yer
  alır; ses klibini dosya olarak yükle (derse gömülür) ya da bir
  asset yolu gir. Ders bu sırada otomatik olarak uzantıya bağımlı
  olarak işaretlenir.
- **Uzantı-yazma yardımcısı**, beş uzantı alıştırma türünün tümünü
  yapay zeka desteğiyle oluşturur (kategorilere ayırma, hata
  düzeltme, okuduğunu anlama, puanlı sınav, dikte).
- **Şablonlar** (Boş / Kelime / Gramer / Konuşma) ve **taslak
  otomatik kaydetme**.
- Kaydetmeden önce gerçek ders görüntüleyicide **önizleme**.
- **Yerel olarak kaydet** ya da **Pull Request ile paylaş**.

İçerik Tarayıcısı'nda ve Dashboard'da giriş noktaları bulunur.

#### Metinden bilgi dersi (kitap modu)

Beşinci şablon kartı **"Metinden bilgi dersi"**, özel bir 3 adımlı
akış başlatır (Üst veriler → Kitap metni → İnceleme): ders kitabının
bir kısmını (örn. bir bölümünü) yapıştır — yapay zeka onu **kendi
sözcükleriyle** teori adımları olarak yeniden yazar (asla kopya
olarak değil) ve teori adımlarına geri bağlanan uygun alıştırmalar
üretir. İsteğe bağlı olarak kitap bilgileri (başlık, yazar, URL,
ISBN/ASIN) eklenebilir; bunlar dersi daha sonra düzenlediğinde
korunur.

Metin yapıştırmak yerine bir **kitap dosyası da yükleyebilirsin**
(EPUB, DOCX, TXT veya Markdown, en fazla 20 MiB). Dosya tamamen
**tarayıcıda** ayrıştırılır — hiçbir şey bir sunucuya yüklenmez —
ve algılanan bölümler bir **onay kutusu listesi** olarak görünür.
Ön ya da son kısımlara benzeyen bölümler (önsöz, sözlük, dizin …)
sezgisel bir kuralla **varsayılan olarak işaretlenmemiştir**, ama
görünür ve seçilebilir kalır:

- **Tek kısım seçili** — metin alanına aktarılır (önizlemeyle; dolu
  bir alan önce sorar).
- **Birden çok kısım seçili** — **toplu üretim**, **kısım başına bir
  ders** oluşturur ve bunları birlikte çok dersli bir set olarak
  kaydeder.

Çok dersli bir seti **düzenlerken** bir **ders seçici**, hangi dersi
açmak istediğini sorar; kitap metni dersleri doğrudan Alıştırma
Düzenleyici'yi açar.

Kart tabanlı yoldan farklı olarak bu mod, **yapılandırılmış bir
yapay zeka anahtarı** gerektirir. Yalnızca haklarına sahip olduğun
ya da kişisel kullanım için tasarlanmış metinleri yapıştır.

### 2. Dosya olarak: İçerik repo formatı

Bir ders, bir **İçerik Setindeki** bir JSON dosyasıdır. Setler
herkese açık GitHub repolarında bulunur ve sabit bir dizin ağacını
izler (`sets/{kaynak-dil}/{hedef-dil-seviye}/`). Belirleyici
kılavuzlar İçerik Repository'sinde bulunur:

- **İlk adımlar:**
  [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- **Ders formatı:**
  [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

Bakıp kopyalamak için hazır bir **Starter Kit**
[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test).

---

## Pull Request ile paylaşma

Ders paylaşmak gerçek bir **Pull Request** üretir (Fork → Commit →
PR). Uygulama doğru yolu ve numaralandırılmış bir dosya adını
otomatik önerir ve yinelenenleri/varyantları tanır. İçerik reposunun
**doğrulama hattı**, gönderilen her dersi her PR'da denetler (şema,
dil çifti, kalite alt sınırları), böylece kataloğa yalnızca temiz
içerikler girer. İsteğe bağlı olarak yapay zeka destekli bir içerik
denetimi vardır; bu hiçbir zaman paylaşmayı engellemez.

---

## İlgili sayfalar

- [Ders içeriği oluşturma (Geliştirici)](../developer/authoring-content.md) — şema ayrıntıları, asset'ler, kod/formül kartları
- [Kitap önerileri](books.md) — `books.yaml` bakımı
- [Birden Çok İçerik Repository'si](../features/content-repos.md) — kendi repoyu bağla
