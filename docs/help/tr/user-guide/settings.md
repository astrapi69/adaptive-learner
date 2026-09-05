<!-- Translation: AI-generated, pending native review -->

# Ayarlar

Ayarlar sayfası, kod veya YAML'a dokunmadan değiştirebileceğiniz
her şeyi bir araya getirir. Bölümler, yukarıdan aşağıya:

1. **Dil** - arayüz dili (DE / EN / ES / FR / EL / PT / TR / JA,
   tümü tam çevrilmiş).
2. **Yapay zeka sağlayıcısı + model seçici** - mesajlarınızı hangi
   sağlayıcının gördüğü ve hangi modelin kullanılacağı.
3. **API anahtarları** - sağlayıcı başına anahtarlar, kaynak
   atıfıyla (env / `secrets.yaml` / Ayarlar).
4. **Depolama modu** - Sunucu (FastAPI + SQLite) ile Yerel
   (tarayıcı IndexedDB) karşılaştırması.
5. **Eşitleme** - bu cihazı yerel ağ üzerinden başka bir cihazla
   eşleştirin.
6. **Yedek** - dışa aktar / içe aktar / karşılaştır.
7. **Ses** - TTS + STT + telaffuz geçişleri.
8. **Arayüz** - tema + yoğunluk.
9. **Öğrenme** - beş alan: Temeller, Ders sırasında, Sesli okuma ve
   dikte, Dersten sonra, Motivasyon ve rutin.
10. **Oyunlaştırma** - XP / rozet bildirimleri + hafta sonu modu.
11. **Hakkında** - sürüm, sistem bilgisi, katkıda bulunanlar,
    bağışlar, lisans.

## Dil

`PATCH /api/settings/{user_id}` üzerinden bir sonraki render işleminde
her arayüz dizesini canlı olarak değiştirir. Tüm 8 dil birinci
sınıf - DE / EN / ES / FR / EL / PT / TR / JA - her biri tam
çevrilmiş bir kataloğa sahip. `localStorage` aracılığıyla yeniden
yüklemeler arasında kalıcıdır.

## Yapay zeka sağlayıcısı + model seçici

Sağlayıcı açılır menüsü `active_provider`'ı UserSettings'e yazar;
bir sonraki yapay zeka çağrısı yeni sağlayıcının eklentisinden
(Sunucu modu) veya yeni sağlayıcının HTTP istemcisinden (Yerel
mod) geçer.

**Model seçici** Önerilen / Tümü olarak
gruplandırılmış, her sağlayıcının canlı `/v1/models` uç noktasından
(1 saatlik önbellek) doldurulan aranabilir bir açılır menüdür. Her
satır insan adını + ham kimliği + bağlam penceresi rozetini gösterir.
Keşfedilen liste mevcut değilse (API anahtarı yok, ağ yok), seçici
statik varsayılanlara geri döner ve bir "çevrimdışı varsayılan
kullanılıyor" ipucu gösterir. Oturum başlığı `<Sağlayıcı>: <Model
adı>` okur; tam kimlik + bağlam penceresi araç ipucunda yer alır.

## API anahtarları

Her sağlayıcının kendi satırı vardır: anahtar girişi, Kaydet
düğmesi, Kaldır düğmesi, aktif sağlayıcı rozeti, artı yeni
**kaynak atıfı** rozeti:

- **Anahtar kaynağı: Ayarlar** - anahtar, veritabanında Fernet
  şifrelemeli (Sunucu modu) veya IndexedDB'de açık metin (Yerel
  mod) olarak saklanır. Serbestçe Kaydet / Kaldır yapabilirsiniz.
- **Anahtar kaynağı: secrets.yaml** - anahtar
  `~/.config/adaptive-learner/secrets.yaml` dosyasında yapılandırılmıştır.
  Kaydet düğmesi devre dışı; değiştirmek için dosyayı doğrudan
  düzenleyin. Satırın altında bir bilgi pankartı yolu hatırlatır.
- **Anahtar kaynağı: ortam** - anahtar
  `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` ortam değişkeni aracılığıyla
  yapılandırılmıştır. Kaydet devre dışı; env değişkeni gerçeğin
  kaynağıdır.
- **Anahtar yapılandırılmamış** - hiçbir yerde ayarlanmamış.
  Başlamak için yazın ve Kaydet'e basın.

Çözüm zinciri (en yüksek öncelik kazanır): env > secrets.yaml
> Veritabanı. Tam döküm için
[Yapılandırma belgelerine](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
bakın.

## Depolama modu

**Sunucu** ile **Yerel (Tarayıcı)** depolama arasındaki geçiş:

- **Sunucu** - her okuma ve yazma FastAPI arka ucuna çarpar.
  Çalışan bir arka uç gerektirir. Arka uç taraflı eşitleme ile
  çoklu cihaz kullanımı için en iyisi.
- **Yerel (Tarayıcı)** - her okuma ve yazma bu tarayıcıdaki
  IndexedDB'ye çarpar. Yapay zeka çağrıları doğrudan sağlayıcıya
  gider. Arka uç gerekmez. Özel, cihaza yerel kurulum için en iyisi.

Modları değiştirmek `localStorage`'a kaydeder ve bir "yeniden
yükleme gerekli" bildirim gösterir. Modlar arasında veri
EŞİTLENMEZ.

## Eşitleme

QR kodu tarayıcısını (arka kamera) kullanarak veya eşleştirme
URL'sini yapıştırarak bu cihazı yerel ağınız üzerinden başka bir
cihazla eşleştirin. Eşleştirildikten sonra, iter + çeker düğmeleri
veriyi çift yönlü olarak değiştirir. Çakışmalar arka uçta yapay
zeka birleştirme çözücüsünden geçer.

Kısıtlı tarayıcı geri dönüşü: diğer cihazınızdaki QR kodunun
ekran görüntüsünü yükleyin (`Html5Qrcode.scanFile`).

## Yedek

Bir bölümde üç şey: **Dışa Aktar** (zaman damgalı JSON indir),
**İçe Aktar** (dosyadan geri yükle) ve **Karşılaştır** (mevcut
durumla yan yana fark). API anahtarları her dışa aktarmadan
çıkarılır.

Geri yükleme bir ÜZERINE YAZMA değil, BİRLEŞTİRMEDİR: yeni
satırlar eklenir, değiştirilebilir satırlar daha yeni `updated_at`
ile güncellenir, geçmiş satırlar (oturumlar / commitler /
derecelendirmeler) UUID'ye göre tekilleştirilir. Karşılaştırma
önizlemesi, Geri Yükle'ye tıklamadan önce tablo başına eklenen /
kaldırılan / değiştirilen öğeleri gösterir; Geri Yükle düğmesi
etiketini fark oluştuktan sonra "Geri Yükle (N eklendi, M
güncellendi)" olarak okur.

Yerel modda bölüm ayrıca **Otomatik yedek** bloğunu da gösterir:
ayrı bir IndexedDB veritabanında 3 anlık görüntüden oluşan dönen
halka, her 10 oturumda BİR VEYA her 7 günde bir çalışır (her
hangisi önce gelirse). Her anlık görüntünün kendi Geri Yükle +
Sil + A/B Olarak Karşılaştır düğmeleri vardır.

### Düzenleme

İki veri yaşam döngüsü ayarı, Veri sekmesinde, ilgili oldukları depolamanın
hemen yanında bulunur:

- **Maksimum ders boyutu** (*Çevrimdışı önbellek* bölümünün hemen
  altında): uzun bir sohbet analizi çevrimdışı ders olarak kaydedildiğinde,
  bu sayıdan fazla adıma sahip dersler birden fazla parçaya bölünür. *Bölüm
  başına adım sayısı* 5 ile 20 arasında değer alır; varsayılan 10'dur.
- **Duraklatılmış ders saklama süresi** (yalnızca temizlenecek bir şey
  olduğunda görünen *Bağlantısı kesilen içerik* temizliğinin hemen
  üstünde): bundan daha eski duraklatılmış dersler, Gösterge Tablosu bir
  sonraki yüklendiğinde otomatik olarak terk edilir. 7, 14, 30 veya 60 gün
  ya da *Hiçbir zaman* seçin; varsayılan 30 gündür. Yaşına bakılmaksızın en
  fazla 10 duraklatılmış ders saklanır.

Her iki değer de bu tarayıcıda saklanır ve Sunucu modunda da Yerel modda da
geçerlidir.

## Ses

Üç geçiş:

- **TTS etkin** - yapay zeka yanıtları + Değerlendirme sonuçları
  yanında onları yüksek sesle okuyan bir ▶ düğmesi ekler.
  Mümkün olduğunda dille eşleşen sesi seçer; hız + perde
  [0,5, 2,0] arasında sınırlandırılır.
- **Yapay zekayı otomatik oynat** - her yapay zeka yanıtını
  otomatik olarak seslendirin (varsayılan KAPALI - sürpriz ses
  nadiren istenen şeydir).
- **STT etkin** - Oturum giriş alanına konuşmayı yakalayan ve
  alanı göndermeden önce ara dökümlerle dolduran bir 🎤 düğmesi
  ekler.
- **Telaffuz Pratiği etkin** - Diller etiketli projeler için
  Gösterge Tablosu hızlı başlatıcısından `/pronunciation`
  sayfasını açar.

Ses bölümü, Web Speech API'nin hiçbir tarafı (sentez veya tanıma)
tarayıcı tarafından desteklenmediğinde kendini gizler.

## Görünüm

*Genel > Görünüm* altındaki **Tema** seçici, otomatik bir mod
artı altı tema sunar:

- **Açık** - varsayılan, parlak ve yüksek kontrastlı.
- **Koyu** - düşük ışıklı kullanım için karartılmış yüzeyler.
- **Okyanus** - derin mavi tonlar, sakin ve geceleri göze hoş.
- **Orman** - sıcak yeşil ve kehribar toprak tonları.
- **Yüksek Kontrast** - önce erişilebilirlik: siyah, beyaz ve
  kalın sinyal renkleri, keskin kart kenarlarıyla. Maksimum
  okunabilirliğe ihtiyaç duyuyorsanız bunu kullanın.
- **Sepya** - sıcak kağıt tonları, uzun okumalar için rahat.
- **Otomatik (Sistem)** - işletim sisteminizin açık/koyu ayarını
  takip eder ve sistem değiştirdiğinde otomatik olarak geçiş yapar.

Tema, önizleme kartından seçin; değişiklik yeniden yükleme
olmadan anında uygulanır ve tercihiniz ziyaretler arasında
hatırlanır. Her tema WCAG 2.1 AA kontrastını karşılamak üzere
tasarlanmıştır; bu nedenle metin, grafikler, rozetler ve alıştırma
geri bildirimi tümünde okunabilir kalır.

## Arayüz

İki denetim: **düğme araç ipuçları** (simge düğmelerinin üzerine
gelindiğinde bir araç ipucu; ekran okuyucu etiketleri her durumda açık
kalır) ve **Menü konumu (mobil)** (üstte menü düğmesi olarak, varsayılan,
ya da altta başparmağın erişebildiği bir sekme çubuğu olarak). Kaydırma
hareketleri bir ders ayarıdır ve *Öğrenme > Ders sırasında > Etkileşim*
altında bulunur.

**Geliştirici Modu** (**Tanılama ve destek** sekmesinde): varsayılanı
derleme koluna bağlıdır: **Latest (önizleme) kolunda varsayılan olarak
AÇIK**, **Main'de KAPALI**; böylece önizleme test edenler tam teknik hata
ayrıntılarını görürken üretim kullanıcıları anlaşılır mesajlar alır.
İstediğiniz zaman değiştirebilirsiniz.

## Öğrenme

**Öğrenme** sekmesi kartlarını, bir dersin akış sırasına göre beş
etiketli alanda gruplar. Her alanın küçük bir başlığı ve tek satırlık bir
açıklaması vardır; içindeki kartlar kendi başlıklarını korur.

### Temeller

Kim öğreniyor ve hangi dillerde.

- **Öğrenme profili** - altı yöntem ağırlığının arkasındaki öğrenme
  profilini oluşturun, sürdürün veya yeniden yapın.
- **Ek kaynak diller** - içerik ağacının uygulama dilinizin yanı sıra
  hangi kaynak dilleri göstereceği.

### Ders sırasında

Siz yanıtlarken alıştırmaların nasıl davrandığı.

- **Ders modu** - **Varsayılan mod** (Alıştırma / Sınav / Süreli), sınavın
  **Geçme eşiği** ve **Süreli mod zorluğu** (Hızlı, Normal, Rahat);
  bkz. [Dersler ve tekrarlar](lessons.md).
- **İpuçları** - her alıştırmada kademeli bir ipucu düğmesinin görünüp
  görünmeyeceği ve **ipucu başına XP maliyeti** (ücretsiz ipuçları için 0).
- **Etkileşim** - **Kaydırma Hareketleri** (Değerlendirme, Oturum ve
  Müfredat'ta kaydırarak gezinme; dokunmatik cihazlarda varsayılan AÇIK),
  **Derslerde klavye kısayolları** (Enter cevabı kontrol eder, tekrar
  Enter ilerler), **Doğru cevapta otomatik ilerle** ve **Yapay zekâya sor**
  düğmesinin gösterilip gösterilmeyeceği.
- **Tercih edilen alıştırma yönü** - yönlü alıştırmaların hangi yönle
  açılacağı.
- **Çözme animasyonu** - çözülen bir eşleştirme alıştırmasının oynattığı
  efekt.

### Sesli okuma ve dikte

Sesler, hız, mikrofon ve telaffuz alıştırması.

- **Ses** - yukarıda *Ses* altında anlatılan geçişler: metin okuma,
  otomatik oynatma, konuşma tanıma ve telaffuz alıştırması.

Bu alan yalnızca tarayıcı Web Speech API'nin en az bir tarafını (sentez
veya tanıma) desteklediğinde görünür. Aksi halde başlığıyla birlikte
yoktur ve *Dersten sonra* doğrudan *Ders sırasında* bölümünün ardından
gelir.

### Dersten sonra

Tekrar oturumları, ders özeti ve hataların yeniden denenmesi.

- **Tekrar** - otomatik oluşturulan hata açıklamaları ve tekrar oturumu
  başına soru sayısı. Kart, salt okunur **Aralıklı tekrar** bloğuyla biter:
  aralık planı (art arda doğru cevaplara karşılık bir sonraki tekrara kadar
  geçen gün sayısı), bir öğenin ne zaman öğrenilmiş sayıldığı ve öğrenme
  yöntemine bir bağlantı.
- **Ders sonrası özet** - ders sonu özetinin hangi bölümleri hangi sırayla
  göstereceği.
- **Hataları tekrar et** - tekrar turunun hangi hataları alacağı.

### Motivasyon ve rutin

Oyun modu, geri bildirim, günlük görevler ve hatırlatıcılar.

- **Oyun modu** - oyunlaştırılmış dersler; **Maskot çeşidi** ile birlikte,
  seviye ve rozetlerle açılan ya da XP karşılığında alınan Lernfunke renk
  şemaları dahil (kilitli çeşitler koşullarını gösterir, satın almalar iki
  adımlı onay ister). Oyun modunun ayrıntıda neyi değiştirdiği
  [Övgü ve kutlamalar](celebrations.md) sayfasında anlatılır.
- **Geri bildirim** - geri bildirim yoğunluğu ve sesler (ses düzeyi, test
  düğmesi).
- **Günlük görevler** - görevlerin çalışıp çalışmadığı, günde kaç tane,
  zorluk karışımı ve bugünün görevlerinin yeniden karıştırılması.
- **Hatırlatıcılar** - hatırlatma saati ve geçerli olduğu günler.

Oyun modu kartı ana anahtarı, oyun modu seslerini ve ekstralardan kaçının
açık olduğunu sayan bir durum satırını gösterir. **Oyun modu ayrıntıları**
(kalpler, geri sayım, arcade, özel turlar, biletler, bonus dersler, seri XP
ve maskot) katlıdır ve seçiminizi hatırlar; **Oyunlaştırılmış dersler**
kapalıyken içindeki seçenekler soluk görünür.

Sekme hatırlatıcılarla biter. İki düzenleme ayarı - *Duraklatılmış ders
saklama süresi* ve *Maksimum ders boyutu* - veri yaşam döngüsü ayarlarıdır
ve **Veri** sekmesinde yer alır (bkz. Yedek altındaki *Düzenleme*).

**İçerik görünümü** (liste / ızgara) ve **İçerik sekmeleri sırası**,
**Genel** sekmesinde *Görünüm* altındadır.

## Oyunlaştırma

XP / rozet / seviye atlama bildirimleri için geçişler (kapalı
toast'ları susturur ama sistem durumu kaydetmeye devam eder),
**hafta sonu modu** (seri ısı haritasında Cmt/Paz boşluklarını
atlar), günlük oturum hedefi (1..10) ve **İlerlemeyi sıfırla**
(çift onay; `user_xp` + `user_badges` + `user_streaks` satırlarını
siler).

## Hakkında

Beş salt okunur blok: **Sürüm** (`pyproject.toml`'dan standart
sürüm, derleme karması, derleme tarihi), **Sistem** (depolama
modu, veri dizini, Sunucu modunda veritabanı yolu, Python +
platform bilgisi), **Katkıda bulunanlar** (yazar, bağımlılık
teşekkürleri), **Geliştirmeyi destekle** (Liberapay / GitHub
Sponsors / Ko-fi bağlantıları), **Lisans ve kaynaklar** (MIT
bağlantısı, depo, belgeler, sorun takipcisi).

Yerel modda panel yalnızca çalışan bir arka uç için anlamlı olan
satırları gizler (Python sürümü, FastAPI / SQLAlchemy / Pydantic /
PluginForge sürümleri, veritabanı yolu).
