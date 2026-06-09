# Yenilikler (v1.61 – v1.69)

v1.61.0'dan bu yana çıkan sürümlere kullanıcı odaklı bir genel bakış.
Sürüm başına eksiksiz, teknik notlar
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases)
altında bulunur.

---

## v1.69.0 — Örnek bağlantılar + kitap önerileri

- **Teoride örnek bağlantılar:** Bir teori adımı, isteğe bağlı bir
  "Örneği görüntüle" bağlantısı taşıyabilir.
- İçerik Tarayıcısı'nda **alan başına kitap önerileri**
  ([Kitap önerileri](content-creation/books.md)).
- **Hata-Replay'inde de Enter kısayolu** ("Hatayı tekrarla").
- **Yedek düzeltmesi:** Set başlığı geri yükleme sırasında
  manifest'ten doğru okunur.

## v1.68.0 — Sonuç dışa aktarma + teori geri bağlantıları

- **Ders sonucunu dışa aktar:** "Sonucu kopyala" / "Dosya olarak
  kaydet" (yapay zeka asistanları için Markdown raporu).
- **Teori geri bağlantıları:** Bir alıştırmadan uygun teoriye atla ve
  geri dön.
- **Eşleştirme alıştırması yenilendi:** renkli çiftler + numara
  rozetleri (renk körlüğüne karşı güvenli).
- Birkaç yerde **Dark-Mode kontrastı** düzeltildi.

## v1.67.1 — Yedek geri yükleme + dağıtım kararlılığı

- Sistematik **yedek geri yükleme** düzeltmesi.
- Eski dağıtım chunk'ında otomatik yeniden yükleme.
- Subject filtre cilası (≤ 1 Subject'te gizlenir, en çok kullanılan
  önce).

## v1.65.0 — Sürdürülebilir Assessment + Enter kısayolu

- **Sürdürülebilir Assessment:** Testi yarıda bırak ve daha sonra
  kaldığın yerden devam et.
- **Enter kısayolu:** Enter, yanıtlanmış bir alıştırmayı denetler ve
  ilerler (Ayarlar → Öğrenme altında değiştirilebilir).
- Daha belirgin eşleştirme alıştırmaları + Design-Token geçişi.

## v1.64.0 — Onboarding yenilemesi

- **Yalnızca ad + konu ile hızlı başlangıç**; geri kalan varsayılanları
  alır.
- İsteğe bağlı **Onboarding yardımcısı** (ekran başına bir soru).
- **Assessment artık isteğe bağlı** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 — WCAG-AA tema ön ayarları

- **6 önerilen tema** (Catppuccin Latte/Mocha, Supabase, Graphite,
  Soft Pop, Amethyst Haze), hesaplamalı olarak AA uyumlu
  ([Tema sistemi](developer/themes.md)).
- Sistematik i18n denetimi; kullanıcı odaklı Dashboard filtresi.

## v1.62.0 — Yedek bütünlüğü + Build kökeni

- **Yedek geri yükleme**nin sertleştirilmesi (veri türü dönüşümü, FK
  sırası).
- About, "unknown" yerine gerçek Build bilgilerini gösterir.

## v1.61.0 — Düğme uyumluluğu + ders sürdürme

- Uygulama genelinde shadcn düğme uyumluluğu.
- **Duraklatılmış ders** tam olarak kaldığı adımda devam eder.
- Çapraz repo içerik doğrulaması.

---

## Dönemdeki büyük çalışma kolları

- **Birden Çok İçerik Repository'si (EXP-023):** kendi repolarını
  bağla, birden çoğunu yönet, bağlantı/QR ile paylaş, Trust
  seviyeleri, önerilen repolar, yerel değerlendirmeler
  ([Birden Çok İçerik Repository'si](features/content-repos.md)).
- **Cross-Identity içe aktarmalı eksiksiz snapshot olarak yedek**
  ([Yedekleme ve geri yükleme](features/backup.md)).

---

## İlgili sayfalar

- [İlk adımlar](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) — eksiksiz notlar
