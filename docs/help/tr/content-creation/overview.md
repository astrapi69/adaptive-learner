# Ders oluşturma — Genel bakış

Adaptive Learner içerikle yaşar. Kendi derslerini oluşturabilir —
doğrudan uygulamada ya da İçerik repo formatında bir dosya olarak —
ve bunları toplulukla paylaşabilirsin. Bu sayfa genel bakışı verir;
ayrıntılı format bilgileri bağlantılı kaynaklarda bulunur.

---

## Ders oluşturmanın iki yolu

### 1. Uygulamada: Ders Oluşturucu

`/create-lesson` altındaki **Ders Oluşturucu**, 4 adımlı bir
yardımcıdır (Üst veriler → Kart Düzenleyici → Alıştırma Üreteci →
Kaydet/Paylaş) ve **bir yapay zeka anahtarına ihtiyaç duymaz**:

- Kartları sürükle-bırak ile sırala ya da **CSV'den içe aktar**.
- Alıştırmaları kartlardan **otomatik üret** (beş alıştırma türünün
  tümü) ya da elle ince ayar yap.
- **Şablonlar** (Boş / Kelime / Gramer / Konuşma) ve **taslak
  otomatik kaydetme**.
- Kaydetmeden önce gerçek ders görüntüleyicide **önizleme**.
- **Yerel olarak kaydet** ya da **Pull Request ile paylaş**.

İçerik Tarayıcısı'nda ve Dashboard'da giriş noktaları bulunur.

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
