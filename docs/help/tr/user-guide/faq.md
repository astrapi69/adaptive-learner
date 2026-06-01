<!-- Translation: AI-generated, pending native review -->

# SSS

## Verilerim güvende mi?

**Yerel modda** tüm verileriniz kendi cihazınızdaki IndexedDB'de bulunur.
Arka uç yok, üçüncü taraf hizmet yok. Tarayıcı sekmesini kapatmak onu
silmez; site verilerini temizlemek siler. Cihazı paylaşıyorsanız,
bu tarayıcı profiline erişimi olan herkes okuyabilir.

**Sunucu modunda** veriler, FastAPI arka ucunun yönettiği SQLite
veritabanında bulunur. API anahtarları, `ADAPTIVE_LEARNER_SECRET_KEY`
ortam değişkeni aracılığıyla ya da `~/.config/adaptive-learner/secrets.yaml`
içindeki `secret_key:` ile belirlediğiniz bir sır kullanılarak Fernet ile
dinlenme sırasında şifrelenir.

Her iki mod da seçtiğiniz yapay zeka sağlayıcısı dışında herhangi bir
üçüncü tarafa telemetri, analitik ya da mesajlarınızı göndermez — ve
bu sağlayıcı yalnızca beklediğiniz mesaj içeriğini görür (sistem istemi +
metniniz + oturumdaki yapay zekanın önceki yanıtları).

## API anahtarına ihtiyacım var mı?

Yapay zeka oturumları için evet. Uygulama desteklenen üç sağlayıcının
tümü için **kendi anahtarınızı getirin** modelini kullanır: Anthropic
Claude, OpenAI GPT, Google Gemini. Ücretsiz katman sınırları genellikle
başlamak için yeterlidir.

Anahtarı koyabileceğiniz üç yer (en yüksek öncelik kazanır):
`ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` ortam değişkeni,
`~/.config/adaptive-learner/secrets.yaml` içindeki
`ai.<provider>.api_key` alanı ya da Ayarlar arayüzü. Arayüz her sağlayıcı
için kaynağı gösterir, böylece anahtarınızın nereden geldiğini her zaman
bilirsiniz.

Müfredatı gezebilir, Değerlendirmeyi yapabilir, Gösterge Tablonuzu
görüntüleyebilir ve hatta API anahtarı olmadan sohbet geçmişi
İçe Aktarma'yı çalıştırabilirsiniz. Oturum sayfası + analiz adımı +
yapay zeka çıkarma özellikleri anahtar gerektiren olanlardır.

## Çevrimdışı kullanabilir miyim?

Kısmen. PWA hizmet çalışanı statik varlıkları (HTML, JS, CSS, simgeler)
önbelleğe alır, bu nedenle uygulama internet olmadan başlatılır. Geçmiş
oturumlar ve Gösterge Tablosu verileri de yerel depolamadan yüklenir,
dolayısıyla eski materyalleri okumak sorunsuz çalışır.

**Canlı oturumlar hâlâ internet gerektirir** çünkü yapay zeka sağlayıcısı
tarayıcınızın dışında bulunur. Oturum sayfası "çevrimdışı" durumunu
algılar ve sessizce başarısız olmak yerine açık bir satır içi mesaj
gösterir.

## Yöntem değişikliği ne anlama gelir?

Arka arkaya üç oturumda anlayışınız durağan VE stresiniz yüksekse,
uygulama bir pankart gösterir: "Sonraki oturum için [diğer yöntem]i
denemek ister misiniz?". Öneri, son zamanlarda kullanmadığınız
değerlendirmedeki ikinci en güçlü yönteminizi tercih eder.

Bu bir *öneri*, emir değil. Pankartı kapatıp mevcut yönteminize devam
edebilirsiniz; durgunluk kalıbı devam ederse pankart yeniden görünür.
Yöntem değişiklikleri `method_switches` tablosuna kaydedilir ve İlerleme
sayfası dağılımında görünür.

## Otomatik döngü nedir?

Bir oturum 7. adıma (Bütünleştirme) ulaştığında ve konu-geçiş
değerlendirici konunun bütünleştirildiğine hükmedip devam etmeyi
önerdiğinde, yeni bir alt konuyla otomatik olarak yeni bir döngü başlar.
Oturum başına en fazla 5 döngü (sonsuz döngü koruması). Sohbet geçmişi,
her geçişte kesik kenarlı "Döngü N" kartları gösterir. Oturum sonu
derecelendirme iletişim kutusu, `cycle_count > 1` olduğunda çok döngülü
yolculuğu özetler.

## Verilerimi dışa aktarabilir miyim?

Evet. Üç dışa aktarma yolu geldi:

- **Yedek**: Ayarlar → Yedek → Yedek Oluştur. Hesabınızdaki her
  satırla zaman damgalı bir JSON indirir. API anahtarları çıkarılır.
  Her iki depolama modunda da çalışır.
- **İlerleme / Oturum / Müfredat raporları**: Ayarlar → Dışa Aktar.
  Markdown + PDF (tarayıcı yazdırma-PDF).
- **Anki .apkg**: `/anki` sayfasında yapay zeka tarafından çıkarılan
  flash kartları inceleyin, beğendiklerinizi kabul edin, Dışa Aktar'a
  tıklayın. Dosya doğrudan Anki masaüstünde çalışır.
- **NotebookLM ZIP**: İlerleme sayfasından, NotebookLM'nin kaynak
  yüklemesi için biçimlendirilmiş yapılandırılmış bir ZIP (özet +
  kelime hazinesi + kurallar + hatalar + flash kartlar + oturumlar)
  indirin.

## Ses özelliği nedir?

Üç Web Speech API entegrasyonu (v1.18.0'dan beri):

- **Yapay zeka yanıtlarında + Değerlendirme sonuçlarında Metinden
  Sese** — her birinin yanındaki ▶ düğmesi dil eşleştirmesiyle
  yüksek sesle okur.
- **Oturum girişinde Sesten Metne** — 🎤 düğmesi sesinizi yakalar ve
  göndermeden önce alanı ara dökümlerle doldurur.
- **Dil projeleri için Telaffuz Pratiği** — `/pronunciation` sayfasını
  ziyaret edin, yapay zeka bir hedef cümle oluşturur, siz konuşun ve
  yargıç yapay zeka benzerliği puanlar + geliştirmeler önerir.

Ses geçişleri Ayarlar → Ses bölümünde bulunur. API'yi desteklemeyen
tarayıcılarda bölüm kendini gizler.

## Sohbet geçmişi içe aktarma nedir?

İçe Aktarma sayfası (`/import`) ChatGPT, Claude.ai (hem JSON toplu dışa
aktarma hem de tek konuşma Markdown dışa aktarma), Gemini ve keyfi
Markdown'dan yapıştırılan ya da yüklenen sohbet dökümlerini kabul eder.
Analizci konunuzu, zayıf noktalarınızı, hata kalıplarınızı, önerilen
yöntemi, kelime hazinesini (dil konuşmaları için) ve önerilen bir
müfredatı çıkarır. Bir tıklamayla analizden Müfredat oluşturulur +
hedefli bir oturum başlatılır.

## Cihazlar arasında senkronizasyon?

v1.0.0'dan beri yerel ağ çift yönlü senkronizasyonu. Ayarlar → Senkronizasyon →
"Bu cihazı eşleştir": diğer cihazın ekranındaki QR kodunu tarayın (arka
kamera) ya da eşleştirme URL'sini yapıştırın. Eşleştirildikten sonra
iter + çeker düğmeleri veri alışverişi yapar; çakışmalar yapay zeka
birleştirme çözücüden geçer. v1.19.0 itibarıyla senkronizasyon
yüzeyinde 28 tablo (konular + etiketler + çalışma soruları dahil).

## Bu ChatGPT'den nasıl farklı?

ChatGPT, tek bir modele sohbet arayüzüdür. Adaptive Learner, arka planda
yapay zeka kullanan ama şunları ekleyen *yapılandırılmış bir öğrenme
sistemidir*:

1. **6 yöntem × 7 adım matrisinden** özel sistem istemleri.
2. **Tur başına adım değerlendirme** — ikinci bir yapay zeka çağrısı
   hazırlığı değerlendirir ve sizi ileri / geri taşıyabilir.
3. **Konu bütünleştirildiğinde yeni döngülere otomatik döngü**.
4. **12 sorulu değerlendirmeden** öğrenme tercihlerinizin **profili**.
5. **Uzun vadeli takip** — ProgressCommits, seri ısı haritası, XP,
   rozetler, adım başına süre grafikleri. ChatGPT sekmeyi kapattığınızda
   unutur.
6. **Sağlayıcı özgürlüğü** — Anthropic, OpenAI ya da Gemini.
7. **Yerel öncelikli seçenek** — her şey tarayıcınızda, hiçbir şey
   bir sunucuya gönderilmez (yapay zeka çağrılarınız hariç).

## Yapay zeka yanlış giderse ne olur?

Sistem görünür biçimde başarısız olur:

- **Yanlış API anahtarı**: yapay zeka çağrısı sohbette satır içi
  gösterilen açık bir hata mesajı döndürür.
- **Sağlayıcı çevrimdışı**: aynı — hata, sağlayıcının API'sindeki
  HTTP durumunu gösterir.
- **Değerlendiricide JSON ayrıştırma hatası**: deterministik +1 ilerleme
  devreye girer (7. adımda sınırlanır), biçimle mücadele eden modellerin
  gelecekteki denetimlerde görülebilmesi için `fallback_used: true`
  kaydedilir.
- **Akış yanıt ortasında kesildi**: kısmi yanıt kaydedilir; bir sonraki
  mesaj oradan devam eder.
- **Eski ya da tuhaf yapay zeka yanıtı**: oturumu sonlandırın, düşük
  bir derecelendirme verin, yeniden başlayın. Kalıp devam ederse yöntem
  değiştirme buluşsal yöntemi farklı bir yöntem önerecektir.
