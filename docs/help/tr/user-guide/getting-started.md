<!-- Translation: AI-generated, pending native review -->

# Başlarken

Adaptive Learner, araştırmaya dayalı altı yöntem modeli üzerine
inşa edilmiş bir öğrenme yardımcısıdır. Size en uygun yöntemleri
keşfetmek için kısa bir değerlendirme yaparsınız, ardından yedi
adımlı bir döngü aracılığıyla yapay zeka destekli oturumlar
yürütürsünüz. Uygulama sizinle birlikte öğrenir ve öğretme
biçimini uyarlar.

## Şimdi deneyin

Adaptive Learner'ı denemenin en hızlı yolu genel dağıtımdır:

[**Canlı uygulamayı açın**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Bu **Yerel modda** çalışır — tüm verileriniz tarayıcınızda kalır
(IndexedDB) ve yapay zeka çağrıları, kendi API anahtarınızı
kullanarak sayfadan doğrudan Anthropic, OpenAI veya Google
Gemini'ye gönderilir. Arka uç söz konusu değildir.

## Aşamalı Web Uygulaması (PWA) olarak yükleyin

Adaptive Learner yüklenebilir. Modern tarayıcılarda siteyi ilk açtığınızda
bir "Yükle" veya "Ana ekrana ekle" istemi göreceksiniz. Kabul edin,
Adaptive Learner telefonunuzda veya masaüstünüzde tarayıcı sekmesi
gerektirmeden başlatılabilen bağımsız bir uygulama haline gelir.

Uygulama ayrıca Kontrol Paneli ve geçmiş oturumlar için çevrimdışı
çalışır. Yeni yapay zeka oturumları hâlâ internet gerektirir çünkü
yapay zeka sağlayıcısı tarayıcının dışındadır.

## Neye ihtiyacınız var

- **Modern bir tarayıcı** (Chrome 100+, Firefox 100+, Safari 17+,
  Edge 100+). Uygulama IndexedDB, service worker'lar ve modern
  JavaScript kullanır.
- **Desteklenen sağlayıcılardan en az biri için yapay zeka API
  anahtarı** (Anthropic, OpenAI veya Google Gemini). Ücretsiz
  katmanlar başlamak için genellikle yeterlidir; bir anahtar nasıl
  ekleneceği için [Ayarlar](settings.md) sayfasına bakın.

## İlk beş dakika

1. **Uygulamayı açın** ve dilinizi seçin. 8 arayüz dilinin
   tamamı çevrilmiştir (DE, EN, ES, FR, EL, PT, TR, JA).
2. **Öğrenme projenizi oluşturun**: konu, hedef, zaman çerçevesi,
   günlük dakika, ayrıca isteğe bağlı konu taksonomisi ve
   etiketler. Bkz. [Başlangıç Kurulumu](onboarding.md).
3. **12 soruluk değerlendirmeyi yapın**; böylece uygulama hangi
   öğrenme yöntemlerine ağırlık vereceğini bilir. Mobilde sorular
   arasında sola/sağa kaydırın. Bkz. [Değerlendirme](assessment.md).
4. **Yapay zeka API anahtarınızı Ayarlar'a ekleyin** VEYA masaüstü
   başlatıcıyı çalıştırıyorsanız
   `~/.config/adaptive-learner/secrets.yaml` dosyasına girin.
   Ayarlar arayüzü anahtarınızın hangi katmandan geldiğini gösterir.
5. **İlk oturumunuzu başlatın**. Kontrol Panelindeki "Oturum
   başlat" düğmesi sizi bir öğrenme konuşmasına yönlendirir.
   Yapay zeka yanıtları token token akar; çift istem değerlendiricisi
   her döngü adımına karar verir. Bkz. [Öğrenme oturumu](learning-session.md).

## Sıradaki adımlar

- [7 adımlı öğrenme döngüsü açıklandı](learning-session.md)
- [Kontrol Panelini okuyun](dashboard.md)
- [SSS — sık sorulan sorular](faq.md)
- [Uygulamanın arkasındaki pedagojik kavram](../concept/philosophy.md)
