<!-- Translation: AI-generated, pending native review -->

# Adaptive Learner

**Gerçekten öğrendiğiniz gibi öğrenin.**

Adaptive Learner, araştırmaya dayalı altı yöntem modeli üzerine
inşa edilmiş açık kaynaklı bir öğrenme yardımcısıdır. 12 soruluk
bir değerlendirme yaparsınız, uygulama size hangi yöntemlerin
uyduğunu keşfeder; ardından yapay zeka destekli oturumlar sizi
yedi adımlı bir öğrenme döngüsünde ilerletir. Uygulama, gerçekten
nasıl öğrendiğinize göre öğretme biçimini uyarlar. Sürekli
geliştirilmektedir - güncel sürüm için
[Releases sayfasına](https://github.com/astrapi69/adaptive-learner/releases) bakın.

[Şimdi deneyin](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }
[GitHub](https://github.com/astrapi69/adaptive-learner){ .md-button }

---

## Ne fark yaratır

### Bir değil, altı yöntem

Çoğu öğrenme uygulaması tek bir yaklaşım seçer - flash kartlar,
video, oyunlaştırılmış seriler - ve herkesin aynı şekilde
öğrendiğini varsayar. Adaptive Learner altı yöntemle gelir
(tümdengelimli, tümevarımlı, hata temelli, diyalogsal, bağlamsal,
yapay zeka uyumlu) ve büyüdükçe bunlar arasında geçiş yapmanıza
yardımcı olur.

[Altı yöntem →](concept/six-methods.md)

### Yedi adımlı bir öğrenme döngüsü

Her oturum Girdi → Deneme → Hata → Geri Bildirim → Uyum →
Tekrar → Bütünleştirme adımlarından geçer. Çift istemli bir
yapay zeka, her turda ilerlemeye, kalmaya veya geri adım atmaya
hazır olup olmadığınızı değerlendirir. Bant değil - gerçek
bilişsel tempolu ilerleme.

[Yedi adımlı döngü →](concept/seven-steps.md)

### Yerel öncelikli, yapay zeka destekli

**Yerel mod** (her şey tarayıcınızda, Anthropic / OpenAI / Gemini'ye
doğrudan yapay zeka çağrıları) ile **Sunucu modu** (FastAPI arka
ucu) arasında geçiş yapın. Kendi yapay zeka anahtarınızı getirin.
PWA olarak yükleyin - geçmiş oturumlar ve Kontrol Paneli için
çevrimdışı çalışır.

[Başlarken →](user-guide/getting-started.md)

### Öğrenme için Git

Oturumlar commit'tir. Eğilimler haftalar içinde ortaya çıkar.
Seriler önemlidir, ama asıl mesele bu değildir. Asıl mesele
örüntülerdir: hangi yöntemin hangi konu için işe yaradığı, bilişsel
zamanınızı nerede harcadığınız, hangi yöntem değişikliğinin
ilerlemeyi açığa çıkardığı.

[İzleme →](concept/tracking.md)

---

## Hızlı başlangıç

1. **Canlı uygulamayı açın**:
   [astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/).
2. **Dilinizi seçin** + **öğrenme projenizi oluşturun**
   (konu, hedef, zaman çerçevesi).
3. **12 soruluk değerlendirmeyi yapın** (~2 dakika).
4. **Yapay zeka API anahtarınızı ekleyin** (Anthropic, OpenAI
   veya Gemini - ücretsiz katmanlar çalışır).
5. **Kontrol Panelinden ilk oturumunuzu başlatın**.

[Tam başlangıç kılavuzu →](user-guide/getting-started.md)

---

## Belgeler

- [**Kullanıcı Kılavuzu**](user-guide/getting-started.md) -
  uygulamayı kullanan öğrenenler için.
- [**Kavram**](concept/philosophy.md) - pedagojik düşünce.
- [**Geliştirici Belgeleri**](developer/architecture.md) -
  katkıda bulunanlar ve eklenti yazarları için.
- [**API Referansı**](api/overview.md) - entegratörler için.

---

## Durum

Aktif geliştirme. Güncel sürüm ve öne çıkan yenilikler için
[GitHub Releases sayfasına](https://github.com/astrapi69/adaptive-learner/releases) bakın.

- **Binlerce otomatik test**: arka uç, eklentiler ve ön uç
  (Vitest), ayrıca Playwright duman testi ve Dexie modu sürüm kapısı
  paketi
- **11 arayüz dili, tamamı çevrilmiş** (DE / EL / EN / ES / FR /
  HI / ID / JA / KO / PT / TR)
- **Eklentiler**: değerlendirme, oturum, izleme, araçlar,
  oyunlaştırma, anki, notebooklm, learning-repo, content-loader ve
  görevler, ayrıca her yapay zeka sağlayıcısı için bir tane
  (Anthropic, OpenAI, Gemini, Perplexity)
- **Tek bir SQLAlchemy alan modeli** (`backend/app/models/__init__.py`),
  tablo tablo senkronize edilir (`sync_service.ALL_SYNC_TABLES`)
- **2 depolama modu** (Yerel IndexedDB / FastAPI arka ucu),
  ayrıca masaüstü başlatıcının `secrets.yaml` katmanı
- **MIT lisanslı**

Kaynak kod, sorunlar ve katkılar:
[github.com/astrapi69/adaptive-learner](https://github.com/astrapi69/adaptive-learner).
