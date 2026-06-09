# İlk adımlar

Adaptive Learner, araştırmaya dayalı altı-yöntemli bir modele
dayanan bir öğrenme arkadaşıdır. Hangi yöntemlerin sana uyduğunu
bulan kısa bir test yaparsın, ardından yapay zeka destekli öğrenme
oturumlarını yedi-adımlı bir döngüden geçirirsin. Uygulama seninle
birlikte öğrenir ve nasıl öğrettiğini uyarlar.

## Şimdi dene

Adaptive Learner'ı tanımanın en hızlı yolu, herkese açık çevrimiçi
sürümdür:

[**Uygulamayı aç**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Bu, **Yerel modda** çalışır — tüm verilerin tarayıcında (IndexedDB)
kalır ve yapay zeka çağrıları doğrudan sayfadan, kendi API anahtarınla
Anthropic, OpenAI ya da Google Gemini'ye gider. Aradan geçen bir arka
uç yok.

## Progressive Web App olarak kurma

Adaptive Learner kurulabilir. Modern tarayıcılar ilk ziyarette bir
"Kur" ya da "Ana ekrana ekle" istemi gösterir. Bunu kabul et ve
Adaptive Learner, akıllı telefonunda ya da masaüstünde, bir tarayıcı
sekmesi olmadan başlatılabilen bağımsız bir uygulamaya dönüşür.

Uygulama, Dashboard ve geçmiş oturumlar için çevrimdışı çalışır. Yeni
yapay zeka oturumları internet gerektirir, çünkü yapay zeka sağlayıcı
tarayıcının dışında bulunur.

## İhtiyacın olanlar

- **Modern bir tarayıcı** (Chrome 100+, Firefox 100+, Safari 17+,
  Edge 100+). Uygulama IndexedDB, Service Worker ve modern JavaScript
  kullanır.
- Desteklenen üç sağlayıcıdan en az biri için bir **yapay zeka API
  anahtarı** (Anthropic, OpenAI ya da Google Gemini). Ücretsiz
  kontenjanlar genellikle başlamak için yeterlidir; anahtar
  ayarlaması için [Ayarlar](settings.md)'a bak.

## İlk beş dakika

1. **Uygulamayı aç** ve dili seç. 8 arayüz dilinin tümü tam
   çevrilidir (DE, EN, ES, FR, EL, PT, TR, JA).
2. **Onboarding: yalnızca ad + konu.** Hızlı başlangıç yalnızca bu iki
   alanı ister, geri kalan her şey varsayılanları alır. Sonrasında
   "Hemen başla"yı seçebilir ya da isteğe bağlı olarak profilini
   yardımcıda daha ayrıntılı kurabilirsin. [Onboarding](onboarding.md)'a
   bak.
3. **İlk dersi başlat** — yapay zeka anahtarı olmadan en hızlı yol:
   `/content` altındaki
   [İçerik Tarayıcısı](../features/content-browser.md)'nı aç, bir ders
   seti seç ve bir ders başlat. Kısa teori okur ve alıştırmalar
   yaparsın; sonunda sonucunu yıldızlarla görürsün.
   [Dersler ve tekrarlar](lessons.md)'a bak.
4. **İsteğe bağlı: yapay zeka oturumları.** Bunun yerine yönlendirilmiş
   altı-yöntemli öğrenme sohbetini istiyorsan, bir **API anahtarı**
   kaydet (Ayarlar ya da
   `~/.config/adaptive-learner/secrets.yaml`), isteğe bağlı
   [öğrenme türü testini](assessment.md) yap ve bir
   [öğrenme oturumu](learning-session.md) başlat.
5. **Sonucunu yedekle.** Ders özetinden sonucu Markdown olarak
   kopyalayabilir ya da dosya olarak kaydedebilir ve **Ayarlar →
   Veriler** altında bir [yedek](../features/backup.md)
   oluşturabilirsin.

## Nasıl devam edilir

- [Dersler ve tekrarlar](lessons.md) — ders akışı ayrıntılı olarak
- [İçerik Tarayıcısı](../features/content-browser.md) — ders bulma ve filtreleme
- [Birden Çok İçerik Repository'si](../features/content-repos.md) — kendi içerik kaynaklarını bağla
- [Yedekleme ve geri yükleme](../features/backup.md)
- [Dashboard'unu anlama](dashboard.md) — ilerleme, Streak, XP, Badge'ler
- [SSS — sık sorulan sorular](faq.md)
- [Uygulamanın ardındaki pedagojik fikir](../concept/philosophy.md)
