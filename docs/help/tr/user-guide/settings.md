<!-- Translation: AI-generated, pending native review -->

# Ayarlar

Ayarlar sayfası, kod veya YAML'a dokunmadan değiştirebileceğin her
şeyi bir araya getirir. Sayfa **sekmeli** düzenlenmiştir: bir sekme
seçersin ve onun paneli açılır, böylece tek bir uzun listeyi yukarıdan
aşağıya kaydırmazsın. Geniş ekranda sekmeler solda bir kenar çubuğunda
durur; telefonda panelin üstündeki bir menü düğmesinden açılır. Adres
açık sekmeyi adlandırır (`/settings?tab=data`), böylece bir bağlantı ya
da yeniden yükleme aynı sekmeye gelir; adreste sekme yoksa sayfa
**Genel** sekmesinde açılır.

Sekmeler dört gruba ayrılır:

- **Genel**
    - **Genel**: profil (görünen ad, avatar, avatar çerçeveleri),
      görünüm (tema, içerik görünümü, İçerik sekmelerinin sırası),
      görüntüleme dili, arayüz (buton ipuçları, telefonda menü konumu),
      depolama modu, güncelleme tercihleri, uygulamanın yüklenmesi ve
      mod göstergesi.
- **Öğrenme ve Yapay Zekâ**
    - **Öğrenme**: derslerin nasıl davrandığı; öğrenme profilinden
      motivasyon ve rutine uzanan beş alanda, ses ayarları ve
      oyunlaştırma dahil.
    - **Yapay zeka**: sağlayıcı ve model seçici, kaynak atfıyla
      sağlayıcı başına API anahtarları ve yapılandırılmış sağlayıcılara
      genel bakış.
    - **Eklentiler**: yüklü eklentiler ve Öğrenme deposu ayarları.
- **Veri ve entegrasyonlar**
    - **Veri**: içerik kaynakları, eşitleme, çevrimdışı içerik,
      yedekleme ve dışa aktarma (şifreli anahtar dışa aktarma dahil),
      temizlik ve tehlike bölgesi; üstte bir bölüm çubuğuyla.
    - **Entegrasyonlar**: GitHub entegrasyonu (dersleri pull request
      olarak paylaşmak için token).
- **Bilgi**
    - **Yardım**: aranabilir uygulama içi sözlük.
    - **Tanılama ve destek**: hata raporu, Geliştirici Modu ve dokunma
      ve görüntü alanı sondası.
    - **Hakkında**: sürüm, sistem bilgisi, katkılar, uygulamayı
      paylaşma, bağışlar, lisans.

## Profil

*Genel > Profil* altında **görünen adını** belirler ve **avatarını**
biçimlendirirsin:

- **Resim yükle** kırpma iletişim kutusunu açar; sonuç gezinmenin sağ
  üst köşesinde görünür.
- **Ya da bir figür seç**: kendi fotoğrafına alternatif olarak sekiz
  hazır figür; tek tıklama yeterlidir. Yüklenmiş bir fotoğraf etkinse,
  figür onu değiştirmeden önce bir iletişim kutusu sorar; fotoğraf bir
  kenara alınır ve **Fotoğrafı geri getir** ile istediğin zaman geri
  getirilebilir (yeni bir fotoğraf yüklenene kadar).
- **Avatar çerçevesi**: avatarın etrafında süs halkaları. Bronz, gümüş
  ve altın seviyenle açılır, alev 3 günlük seri rozetiyle; yıldız ve
  vurgu XP karşılığında alınır (iki adımlı onay, bedel düğmenin
  üzerinde yazar). Kilitli çerçeveler koşullarını gösterir.

Seçimin ve satın aldığın çerçeveler kalıcıdır ve
[yedeğinle](backup.md) birlikte taşınır.

## Görünüm

*Genel > Görünüm* altındaki **Tema** seçici temaları iki sekmede
toplar:

- **Önerilen** - Catppuccin Latte, Supabase ve Graphite (açık),
  Catppuccin Mocha, **Soft Pop** ve Amethyst Haze (koyu). Yeni
  kullanıcılar **Soft Pop** ile başlar ve seçici bu sekmede açılır.
- **Klasik** - özgün temalar: Açık, Koyu, Okyanus, Orman, Yüksek
  Kontrast (siyah, beyaz ve kalın sinyal renkleri, keskin kart
  kenarlarıyla, maksimum okunabilirlik için) ve Sepya (uzun okumalar
  için sıcak kağıt tonları). Etkin temanız klasik bir temaysa seçici
  bunun yerine bu sekmede açılır.

İki sekme de ayrıca **Otomatik (Sistem)** sunar: işletim sisteminin
açık/koyu ayarını takip eder ve sistem değiştiğinde otomatik olarak
geçiş yapar.

Temayı önizleme kartından seç; değişiklik yeniden yükleme olmadan
anında uygulanır ve tercihin ziyaretler arasında hatırlanır. Her tema
WCAG 2.1 AA kontrastını karşılamak üzere tasarlanmıştır; bu nedenle
metin, grafikler, rozetler ve alıştırma geri bildirimi tümünde
okunabilir kalır.

Bu kartta ayrıca **İçerik görünümü** bulunur: İçerik alanı için genel
*liste / ızgara* tercihi (varsayılan **liste**). Bu, *İçeriğim* /
*Keşfet* üzerindeki sekme içi görünüm düğmesiyle aynı tercihtir; ikisinden
birinde değiştirmek ikisini de eşit tutar. Kartın hemen altında
**İçerik sekmeleri sırası** belirlenir (Keşfet / İçeriğim / İçe aktar /
Oluştur), böylece İçerik alanı en çok kullandığın sekmede açılır.

## Dil

*Genel > Dil*, `PATCH /api/settings/{user_id}` üzerinden bir sonraki
render işleminde her arayüz dizesini canlı olarak değiştirir. 11 dilin
tümü birinci sınıftır - DE / EL / EN / ES / FR / HI / ID / JA / KO /
PT / TR - her biri tam çevrilmiş bir kataloğa sahiptir. `localStorage`
aracılığıyla yeniden yüklemeler arasında kalıcıdır.

## Arayüz

*Genel > Arayüz* iki denetim içerir: **Buton ipuçlarını göster**
(simge düğmelerinin üzerine gelindiğinde bir araç ipucu; ekran okuyucu
etiketleri her durumda açık kalır) ve **Menü konumu (mobil)** (üstte
menü düğmesi olarak, varsayılan, ya da altta başparmağın erişebildiği
bir sekme çubuğu olarak). Kaydırma hareketleri bir ders ayarıdır ve
*Öğrenme > Ders sırasında > Etkileşim* altında bulunur. Geliştirici
Modu **Tanılama ve destek** sekmesindedir (aşağıya bak).

## Depolama modu

*Genel > Depolama modu*, **Sunucu** ile **Yerel (Tarayıcı)** depolama
arasında geçiş yapar:

- **Sunucu** - her okuma ve yazma FastAPI arka ucuna gider. Çalışan
  bir arka uç gerektirir. Arka uç taraflı eşitleme ile çoklu cihaz
  kullanımı için en iyisi.
- **Yerel (Tarayıcı)** - her okuma ve yazma bu tarayıcıdaki
  IndexedDB'ye gider. Yapay zeka çağrıları doğrudan sağlayıcıya
  gider. Arka uç gerekmez. Özel, cihaza yerel kurulum için en iyisi.

Modu değiştirmek seçimi `localStorage`'a kaydeder ve bir "yeniden
yükleme gerekli" bildirimi gösterir. Modlar arasında veri EŞİTLENMEZ.

Herkese açık web sürümünün ve yüklenmiş web uygulamasının arka ucu
yoktur; bu yüzden orada kart görünmez ve uygulama her zaman Yerel
(Tarayıcı) modunu kullanır.

## Güncellemeler ve uygulamayı yükleme

**Genel** sekmesinin geri kalanı uygulamanın nasıl çalıştığıyla
ilgilidir:

- **Güncellemeler** (yalnızca Sunucu modu): **Otomatik güncelleme
  denetimi** ve **Denetim aralığı** (günlük, haftalık, aylık ya da
  asla), ayrıca son denetimin zamanı ve geçerli sürüm. Elle
  **Güncellemeleri denetle** düğmesi **Hakkında** sekmesindedir.
- **Uygulamayı yükle**: Adaptive Learner'ı bağımsız bir uygulama olarak
  yükler (kendi penceresi, ana ekran simgesi, ağ olmadan başlar).
  Yüklendikten sonra düğmede **Zaten yüklü** yazar.
- **Mod**: Tek kişilik mod etkindir; Çok oyunculu mod yakında gelecek
  olarak işaretlidir.

## Öğrenme

**Öğrenme** sekmesi kartlarını, bir dersin akış sırasına göre beş
etiketli alanda gruplar. Her alanın küçük bir başlığı ve tek satırlık
bir açıklaması vardır; içindeki kartlar kendi başlıklarını korur.

Alanların üstündeki bir **bölüm çubuğu** onları çipler olarak listeler:
birine tıklayınca o alana atlarsın. Masaüstünde çubuk, sen kaydırırken
uygulama başlığının altında görünür kalır; telefonda sayfayla birlikte
kayar ve satır yana doğru kaydırılabilir. Çubuk adresi yansıtır:
`/settings?tab=learning&section=review` sekmeyi *Dersten sonra*
alanına kaydırılmış olarak açar (kimlikler: `basics`, `lessons`,
`voice`, `review`, `motivation`) ve bir çipe tıklamak adresi geçmişe
yeni bir kayıt eklemeden günceller. Başka bir sekmeye geçmek bölümü
yeniden kaldırır. Gösterilmeyen bir alanın (Web Speech olmayan bir
tarayıcıda ses alanı) çipi yoktur ve bilinmeyen bir bölüm yok sayılır.
Sen kaydırırken vurgulanan çip ekrandaki alanı takip eder.

### Temeller

Kim öğreniyor ve hangi dillerde.

- **Öğrenme profili** - altı yöntem ağırlığının arkasındaki öğrenme
  profilini oluştur, sürdür veya yeniden yap.
- **Ek kaynak diller** - içerik ağacının uygulama dilinin yanı sıra
  hangi kaynak dilleri göstereceği.

### Ders sırasında

Sen yanıtlarken alıştırmaların nasıl davrandığı.

- **Ders modu** - **Varsayılan mod** (Alıştırma / Sınav / Süreli),
  sınavın **Geçme eşiği** ve **Süreli mod zorluğu** (Hızlı, Normal,
  Rahat); bkz. [Dersler ve tekrarlar](lessons.md).
- **İpuçları** - her alıştırmada kademeli bir ipucu düğmesinin görünüp
  görünmeyeceği ve **İpucu başına XP maliyeti** (ücretsiz ipuçları
  için 0).
- **Etkileşim** - **Kaydırma Hareketleri** (Değerlendirme, Oturum ve
  Müfredat'ta kaydırarak gezinme; dokunmatik cihazlarda varsayılan
  AÇIK), **Derslerde klavye kısayolları** (Enter cevabı kontrol eder,
  tekrar Enter ilerler), **Doğru cevapta otomatik ilerle** ve
  **Yapay zekâya sor** düğmesinin gösterilip gösterilmeyeceği.
- **Tercih edilen alıştırma yönü** - yönlü alıştırmaların hangi yönle
  açılacağı.
- **Eşleştirme alıştırması** - **Düzeltmeyi ayrı görünümde göster**
  (varsayılan AÇIK): kontrol ettikten sonra "Cevaplarım" yalnızca kendi
  çiftlerini hatalarınla gösterir, doğru cevaplar "Düzeltme" altında,
  çözüm ise "Çöz" altında bulunur. Kapalıyken doğru cevap "Cevaplarım"
  içinde her hatanın hemen altında durur. Ayrıca **Çözme animasyonu**:
  çözülen bir eşleştirme alıştırmasının oynattığı efekt.

### Sesli okuma ve dikte

Sesler, hız, mikrofon ve telaffuz alıştırması. Alan **Ses** kartını
içerir:

- **Konuşma düğmelerini göster** - yapay zeka yanıtlarının ve
  Değerlendirme sonuçlarının yanına onları yüksek sesle okuyan bir
  hoparlör düğmesi ekler.
- **YZ yanıtlarını otomatik oynat** - her yapay zeka yanıtını
  otomatik olarak seslendirir (varsayılan KAPALI - sürpriz ses nadiren
  istenen şeydir).
- **Konuşma sesi** - okumada kullanılan ses; varsayılan, proje dilin
  için en yakın eşleşmeyi seçer.
- **Hız** ve **Perde** - 0,5 ile 2 arasında kaydırıcılar.
- **Mikrofon düğmesini göster** - Oturum giriş alanına konuşmayı
  yakalayan ve sen göndermeden önce metin alanını ara dökümlerle
  dolduran bir mikrofon düğmesi ekler.
- **Dikte dili geçersiz kıl** - bir BCP-47 kodu (örneğin `en-US`);
  proje veya arayüz dilini kullanmak için boş bırak.
- **Telaffuz Alıştırması** - dil öğrenme projelerinin panolarında bir
  *Telaffuz Alıştırması* düğmesi gösterir.

Sesli okuma denetimleri (ilk beşi) yalnızca tarayıcı konuşma sentezini
desteklediğinde, iki dikte denetimi yalnızca konuşma tanımayı
desteklediğinde görünür. Tarayıcı Web Speech API'nin hiçbir tarafını
desteklemediğinde alanın tamamı, başlığıyla birlikte yoktur ve
*Dersten sonra* doğrudan *Ders sırasında* bölümünün ardından gelir.

### Dersten sonra

Tekrar oturumları, ders özeti ve hataların yeniden denenmesi.

- **Tekrar** - cevaptan sonra açıklamalar (bir alıştırma yazarının
  yazdığı ve alıştırma kontrol edildikten sonra altında gösterilen
  açıklama ile bir dersten sonra otomatik oluşturulan kural ipuçları)
  ve tekrar oturumu başına soru sayısı. **Hatasız öğeleri de tekrar et**
  anahtarı (varsayılan kapalı), tekrarın yalnızca hatalı öğeleri mi
  içereceğine yoksa hiç yanlış yapmadığın öğeleri de 3 ve 7 gün sonra
  geri mi getireceğine karar verir. Kart, salt okunur **Aralıklı
  tekrar** bloğuyla biter: aralık planı (art arda doğru cevaplara
  karşılık bir sonraki tekrara kadar geçen gün sayısı), bir öğenin ne
  zaman öğrenilmiş sayıldığı ve öğrenme yöntemine bir bağlantı.
- **Ders sonrası özet** - ders sonu özetinin hangi bölümleri hangi
  sırayla göstereceği. Varsayılan olarak yalnızca *Sonuç ve
  istatistikler* ve *XP ödülü* açıktır; bu, tek bir telefon ekranına
  sığan kompakt görünümdür. Geri kalan her şeyi bir dersin sonundaki
  *Ayrıntılı değerlendirme* düğmesi gösterir ya da burada kalıcı olarak
  işaretlersin. *Bunları neden kaçırdın* bu bölümlerden biridir; ana
  anahtarı *Tekrar* altındaki *Açıklamaları göster* olarak kalır.
- **Hataları tekrar et** - tekrar turunun hangi hataları alacağı.

### Motivasyon ve rutin

Oyun modu, geri bildirim, günlük görevler ve hatırlatıcılar.

- **Oyun modu** - oyunlaştırılmış dersler; **Maskot çeşidi** ile
  birlikte, seviye ve rozetlerle açılan ya da XP karşılığında alınan
  Lernfunke renk şemaları dahil (kilitli çeşitler koşullarını gösterir,
  satın almalar iki adımlı onay ister). Oyun modunun ayrıntıda neyi
  değiştirdiği [Övgü ve kutlamalar](celebrations.md) sayfasında
  anlatılır.
- **Geri bildirim** - geri bildirim yoğunluğu ve sesler (ses düzeyi,
  test düğmesi).
- **Günlük görevler** - görevlerin çalışıp çalışmadığı, günde kaç
  tane, zorluk karışımı ve bugünün görevlerinin yeniden karıştırılması.
- **Hatırlatıcılar** - hatırlatma saati ve geçerli olduğu günler.
- **Oyunlaştırma** - XP / rozet bildirimleri, hafta sonu modu, günlük
  oturum hedefi ve *İlerlemeyi sıfırla*; son kart, aşağıya bak.

Oyun modu kartı ana anahtarı, oyun modu seslerini ve ekstralardan
kaçının açık olduğunu sayan bir durum satırını gösterir. **Oyun modu
ayrıntıları** (kalpler, geri sayım, arcade, özel turlar, biletler,
bonus dersler, seri XP ve maskot) katlıdır ve seçimini hatırlar;
**Oyunlaştırılmış dersler** kapalıyken içindeki seçenekler soluk
görünür.

Sekme **Oyunlaştırma** ile biter (*İlerlemeyi sıfırla* o kartta olduğu
için bir ayırıcı çizginin altında). İki temizlik ayarı -
*Panodaki duraklatılmış dersler* ve *Maksimum ders boyutu* - veri yaşam
döngüsü ayarlarıdır ve **Veri** sekmesinde yer alır (bkz. aşağıda
*Çevrimdışı içerik* ve *Temizlik*).

**İçerik görünümü** (liste / ızgara) ve **İçerik sekmeleri sırası**,
**Genel** sekmesinde *Görünüm* altındadır.

### Oyunlaştırma

XP / rozet / seviye atlama bildirimleri için anahtarlar (kapalıyken
bildirimler susar ama sistem durumu kaydetmeye devam eder), **Hafta
sonu modu** (seri ısı haritasında Cmt/Paz boşluklarını atlar),
**Günlük oturum hedefi** (1..10) ve **İlerlemeyi sıfırla** (çift onay;
`user_xp` + `user_badges` + `user_streaks` satırlarını siler).

## Yapay zeka sağlayıcısı + model seçici

**Yapay zeka** sekmesinde sağlayıcı açılır menüsü `active_provider`'ı
UserSettings'e yazar; bir sonraki yapay zeka çağrısı yeni sağlayıcının
eklentisinden (Sunucu modu) veya yeni sağlayıcının HTTP istemcisinden
(Yerel mod) geçer.

**Model seçici**, Önerilen / Tümü olarak gruplandırılmış, her
sağlayıcının canlı `/v1/models` uç noktasından (1 saatlik önbellek)
doldurulan aranabilir bir açılır menüdür. Her satır okunabilir adı +
ham kimliği + bağlam penceresi rozetini gösterir. Keşfedilen liste
mevcut değilse (API anahtarı yok, ağ yok), seçici statik varsayılanlara
geri döner ve bir "çevrimdışı varsayılan kullanılıyor" ipucu gösterir.
Oturum başlığında `<Sağlayıcı>: <Model adı>` yazar; tam kimlik + bağlam
penceresi araç ipucunda yer alır.

## API anahtarları

Her sağlayıcının kendi satırı vardır: bir anahtar giriş alanı, Kaydet
düğmesi, Kaldır düğmesi, etkin sağlayıcı rozeti, ayrıca yeni **kaynak
atfı** rozeti:

- **Anahtar kaynağı: secrets.yaml** - anahtar
  `~/.config/adaptive_learner/secrets.yaml` içinde Fernet ile şifreli
  olarak saklanır. Sunucu modu burada girdiğin her anahtarı buraya
  kaydeder; bu yüzden Kaydet'ten sonra satır bu rozeti gösterir.
  Kaydet ve Kaldır kullanılabilir kalır; kaydetmek saklanan anahtarın
  üzerine yazar. Satırın altındaki bir bilgi satırı yolu belirtir.
- **Anahtar kaynağı: Ayarlar** - anahtarlar `secrets.yaml`'a
  taşınmadan önceki zamandan kalma, hâlâ veritabanında duran eski bir
  anahtar; bir sonraki başlatmada oraya taşınır. Yerel modda
  (tarayıcı) anahtar IndexedDB'de durur ve o da bu rozeti gösterir.
  Serbestçe Kaydet / Kaldır yapabilirsin.
- **Anahtar kaynağı: ortam değişkeni** - anahtar
  `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` ortam değişkeni aracılığıyla
  yapılandırılmıştır. Kaydet ve Kaldır devre dışıdır; ortam değişkeni
  gerçeğin kaynağıdır.
- **Yapılandırılmış anahtar yok** - hiçbir yerde ayarlanmamış.
  Başlamak için yaz ve Kaydet'e bas.

Çözüm zinciri (en yüksek öncelik kazanır): ortam değişkeni > secrets.yaml > veritabanı.
Tam döküm için
[Yapılandırma belgesine](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
bak.

Anahtar giriş alanları maskelenmiş bir **gizli giriş** kullanır
(göster/gizle düğmesiyle) ve tarayıcının parola yöneticisini
tetiklemez.

API anahtarları normal yedekten (`.alb`) bilerek **çıkarılır**.
Anahtarlarını başka bir cihaza veya tarayıcıya taşımak için ayrı
**şifreli anahtar dışa aktarmayı (`.alk`)** kullan: burada, Yapay zeka
sekmesinde, seni doğrudan **Veri sekmesindeki** bu dışa aktarmaya
götüren bir **yönlendirme düğmesi** vardır (bkz. aşağıda *Şifreli
anahtar dışa aktarma (.alk)*).

## Yapılandırılmış sağlayıcılar

**Yapılandırılmış sağlayıcılara genel bakış**, kurduğun yapay zeka
sağlayıcılarını her biri **maskelenmiş bir anahtar önizlemesiyle**
listeler; böylece hangi sağlayıcıların hazır olduğunu bir bakışta
görürsün. Her satırda, sağlayıcının model listesi uç noktasını çağıran
ve tamam / geçersiz anahtar / hız sınırı / ağ hatası olarak sonuç
bildiren bir **Test düğmesi** vardır; bu, üretim token'ı harcamayan
güvenli bir denetimdir.

## Eklentiler

**Eklentiler** sekmesinde iki kart vardır. **Yüklü eklentiler**,
masaüstü uygulamasının yüklediği her eklentiyi listeler: ad, sürüm,
kaynak (paket ya da doğrudan kaydedilmiş) ve etkinleştirme zamanı. Bir
yükleme hatası ya da bir keşif filtresi, etkinleştirmeden sonraki bir
yapılandırma değişikliği gibi, satırda bir işaret olarak görünür.
Tarayıcı modunda kart, yalnızca masaüstü uygulamasının bir eklenti
barındırıcısı olduğunu belirten bir bildirimle görünür kalır.
**Öğrenme deposu** bu eklentinin ayarlarını içerir (git kalıcılığı,
depo dizini).

## Veri

**Veri** sekmesi kartlarını sabit bir sırayla altı alanda gruplar:
içeriğin nereden geldiği, onunla ne olduğu, ne ortaya çıktığı, onu
nasıl güvenceye aldığın, neyi temizleyebileceğin ve son olarak neyin
geri alınamayacağı. Her alanın küçük bir başlığı ve tek satırlık bir
açıklaması vardır.

Alanların üstündeki bir **bölüm çubuğu** onları çipler olarak listeler:
*Kaynaklar*, *Eşitleme*, *Çevrimdışı içerik*, *Yedekleme ve dışa
aktarma*, *Temizlik* ve *Tehlike bölgesi*. Öğrenme sekmesindeki gibi
çalışır: bir tıklama alana atlar, masaüstünde çubuk uygulama başlığının
altında görünür kalır, vurgulanan çip ekrandaki alanı takip eder ve
adres bunu yansıtır (`/settings?tab=data&section=backup`; kimlikler:
`sources`, `sync`, `offline`, `backup`, `cleanup`, `danger`).

### Kaynaklar

- **İçerik depoları** - derslerinin geldiği depolar; bkz.
  [İçerik depoları](../features/content-repos.md).
- **Deponuzu kaydedin** - kendi içerik deponu, depolar arası aramanın
  kullandığı ortak dizine önerir.

### Eşitleme

QR kodu tarayıcısını (arka kamera) kullanarak veya eşleştirme URL'sini
yapıştırarak bu cihazı yerel ağın üzerinden başka bir cihazla eşleştir.
Eşleştirildikten sonra gönder + çek düğmeleri veriyi çift yönlü olarak
değiş tokuş eder. Çakışmalar arka uçta bir yapay zeka birleştirme
çözücüsünden geçer.

Kısıtlı tarayıcılar için yedek yol: diğer cihazındaki QR kodunun ekran
görüntüsünü yükle (`Html5Qrcode.scanFile`).

Eşitleme masaüstü uygulamasını gerektirir. Tarayıcı modunda alan
görünür kalır, ancak denetimlerinin yerini "Yalnızca masaüstü
uygulamasıyla kullanılabilir." bildirimi alır.

### Çevrimdışı içerik

- **Çevrimdışı önbellek** - çevrimdışı ders önbelleğinin boyutu ve
  ders sayısı, onu temizlemek için bir düğmeyle (onay ister).
- **Maksimum ders boyutu** - uzun bir sohbet analizi çevrimdışı ders
  olarak kaydedildiğinde, bu sayıdan fazla adıma sahip dersler birden
  fazla parçaya bölünür. *Bölüm başına adım sayısı* 5 ile 20 arasında
  değer alır; varsayılan 10'dur.

### Yedekleme ve dışa aktarma

**Yedek** üç şey sunar: **Yedek oluştur** (bir `.alb` yedek dosyası
indirir), **Yedekten geri yükle** (bir dosyadan geri yükler) ve
**Yedekleri karşılaştır** (mevcut durumla yan yana fark). API
anahtarları her dışa aktarmadan çıkarılır.

Geri yükleme bir ÜZERİNE YAZMA değil, BİRLEŞTİRMEDİR: yeni satırlar
eklenir, değiştirilebilir satırlar daha yeni bir `updated_at` ile
güncellenir, geçmiş satırları (oturumlar / commit'ler /
değerlendirmeler) UUID'ye göre tekilleştirilir. Karşılaştırma
önizlemesi, Geri yükle'ye tıklamadan önce tablo başına eklenen /
kaldırılan / değişen öğeleri gösterir; fark oluştuktan sonra Geri yükle
düğmesinde "Geri yükle (N eklendi, M güncellendi)" yazar.

Yerel modda kart ayrıca **Otomatik yedek** bloğunu da gösterir: ayrı
bir IndexedDB veritabanında 3 anlık görüntüden oluşan dönen bir halka;
her 10 oturumda VEYA her 7 günde bir çalışır (hangisi önce gelirse).
Her anlık görüntünün kendi Geri yükle + Sil + A/B olarak karşılaştır
düğmeleri vardır.

Bu alandaki diğer kartlar:

- **Kimlik dosyası** (yalnızca Sunucu modu) - arka ucun tuttuğu
  kurtarma dosyasının salt okunur görünümü; böylece var olup olmadığını
  ve nerede durduğunu görürsün.
- **Yapay zekâ anahtarları - şifreli dışa aktarma** - aşağıya bak.
- **Veri dışa aktarımı** - tek tıklamayla tam yedek ya da dahil
  edilecek veri kategorilerini işaretlediğin seçmeli bir dışa aktarma;
  ikisi de aynı içe aktarılabilir yedek dosyasını üretir.
- **Dışa aktar** - üç rapor: *Öğrenme ilerlemesi*, *Oturum detayı* ve
  *Müfredat*; her biri Markdown olarak ya da PDF olarak (tarayıcının
  yazdırma iletişim kutusu üzerinden).

#### Şifreli anahtar dışa aktarma (.alk)

Normal yedek API anahtarlarını çıkarır; bu güvenlidir ama bir cihaz
veya tarayıcı değişikliğinde aksi halde her anahtarı elle yeniden
girmen gerekir. **Şifreli anahtar dışa aktarma** bu boşluğu ayrı,
parola ifadesiyle korunan bir dosyayla kapatır:

- Dosya **yalnızca** hassas kimlik bilgilerini taşır: **API
  anahtarlarını** ve sağlayıcı ayarlarını (etkin sağlayıcı, model
  geçersiz kılmaları). Uygulama verilerinin geri kalanını İÇERMEZ (o
  `.alb` yedeğinde kalır).
- **Dışa aktar** bir parola ifadesi (artı onay) ister ve ayrı bir
  **`.alk`** dosyası indirir. İçindeki anahtarlar **AES-GCM-256** ile
  şifrelenir; anahtar parola ifadenden **PBKDF2** ile türetilir. Dosya
  hiçbir zaman açık metin bir anahtar içermez.
- **İçe aktar** bir `.alk` dosyasını okur, parola ifadesini sorar,
  şifreyi çözer ve anahtarları + sağlayıcı ayarlarını elle girişin
  kullandığı aynı güvenli depolamaya geri yazar (dosyada bulunan
  sağlayıcıların üzerine yazılır, bulunmayanlara dokunulmaz).
- **Yanlış bir parola ifadesi ya da değiştirilmiş bir dosya** tek bir
  mesajla düzgünce reddedilir ve **kısmi içe aktarma olmaz**: hiçbir
  şey yarım yazılmaz.
- Parola ifadesi alanları sen yazarken **satır içinde** doğrulanır: çok
  kısa bir parola ifadesi ya da eşleşmeyen bir onay, tıkladıktan sonra
  bir hata bildirimi göstermek yerine doğrudan alanda gösterilir (ve
  gönder düğmesi devre dışı kalır). API anahtarı giriş alanları gibi bu
  parola ifadesi alanları da tarayıcının parola yöneticisini
  **tetiklemez**.

Bu dışa aktarma **Veri sekmesinde**, normal yedeğin yanında bulunur;
**Yapay zeka sekmesi** yalnızca seni buraya getiren bir yönlendirme
düğmesi taşır. **Yerel (tarayıcı) modda** anahtarlar IndexedDB'de
durur; bu yüzden dışa aktarma tamamen kullanılabilir (ve asıl kullanım
durumu budur). **Sunucu modunda** anahtarlar sunucu tarafında tutulur
ve istemci açık metni hiç görmez; bu yüzden giriş **bir ipucuyla
devre dışıdır**. Henüz dışa aktarılabilir bir anahtar yapılandırılmamışsa
da dışa aktarma devre dışıdır.

### Temizlik

- **Panodaki duraklatılmış dersler**: Panodaki duraklatılmış dersler
  kartı yalnızca bu süre içinde duraklatılan dersleri gösterir (*Şundan
  eski duraklatılmış dersleri gizle* 7, 14, 30 veya 60 gün ya da *Hiçbir
  zaman*; varsayılan 30 gündür). Daha eski bir ders yalnızca karttan
  kalkar: hiçbir şey terk edilmez, konumu ve cevapları korunur. Kart en
  son duraklatılan beş dersi gösterir.
- **Bağlantısı kesilen içerik** (tarayıcı modu): içerik deposu artık
  bağlı olmayan ilerleme, sen burada silene kadar gizli kalır. Kart
  yalnızca temizlenecek bir şey olduğunda görünür.

*Maksimum ders boyutu* ve *Panodaki duraklatılmış dersler* bu
tarayıcıda saklanır ve Sunucu modunda da Yerel modda da geçerlidir.

### Tehlike bölgesi

Görsel olarak ayrılmış son alan: **Her şeyi sıfırla** tüm verilerini
siler (Sunucu modunda arka uçta, tarayıcı modunda bu tarayıcıda). Önce
bir yedek oluşturmayı önerir, sonra onay ister ve son **Kalıcı olarak
sil** düğmesi ancak `RESET` yazdıktan sonra etkinleşir.

## Entegrasyonlar

**Entegrasyonlar** sekmesi **GitHub Entegrasyonu**'nu içerir: uygulamanın
dersleri pull request olarak paylaşmasını sağlayan bir GitHub token'ı
(`repo` izniyle). Token alanı sen yazarken biçimi denetler, **Test et**
token'ı doğrular ve ait olduğu hesabı gösterir; bir kaynak satırı
token'ın nerede saklandığını söyler (secrets.yaml, bir ortam değişkeni
ya da bu tarayıcı) ve **Kaldır** onu siler. Bir ortam değişkeninden
gelen token burada düzenlenemez.

## Yardım

**Yardım** sekmesi uygulama içi sözlüğü içerir: bir arama alanı
girdileri başlığa ve metne göre süzer ve girdiler *Temel kavramlar*,
*Öğrenme yöntemleri*, *Döngü adımları* ve *Uygulama özellikleri*
olarak gruplanır. Bir girdiye tıklamak tam makaleyi yardım
çekmecesinde açar.

## Tanılama ve destek

**Tanılama ve destek** sekmesi, geliştiricinin cihazında ne olduğunu
görmesine yardımcı olan şeyleri bir araya getirir:

- **Destek** - **Hata raporu oluştur**, son işlemlerini, tarayıcından
  bir şey çıkmadan önce gözden geçirdiğin bir raporda toplar.
- **Geliştirici Modu** - hata bildirimlerinde tüm teknik ayrıntıları
  (durum kodu, uç nokta, yığın izi) ve açıkken gezinme çubuğunda bir
  "DEV" rozeti gösterir. Varsayılanı derleme koluna bağlıdır:
  **Latest (önizleme) kolunda varsayılan olarak AÇIK**, **Main'de
  KAPALI**; böylece önizleme test edenler tam teknik hata ayrıntılarını
  görürken üretim kullanıcıları anlaşılır mesajlar alır. İki yönde de
  değiştirebilirsin.
- **Dokunma ve görüntü alanı sondası** - açıkken dokunma konumlarını ve
  görüntü alanı değişikliklerini kalıcı bir protokole kaydeder; böylece
  yeniden üretilmesi zor görüntüleme hataları belirlenebilir. **Ölçüm
  çubuğunu göster**, kayıt sürerken üstteki çubuğu gösterir ya da
  gizler; **Ölçüm çubuğu için sabit düğme**, çubuğu açıp kapatan yüzen
  bir düğme ekler (köşe seçilebilir). **Protokolü kopyala** ve
  **Protokolü temizle** kaydedilen olaylar üzerinde çalışır; bir sayaç
  kaç olay olduğunu gösterir.

## Hakkında

Beş salt okunur blok: **Sürüm** (`pyproject.toml`'dan kanonik sürüm,
derleme karması, derleme tarihi), **Sistem** (depolama modu, veri
dizini, Sunucu modunda veritabanı yolu, Python + platform bilgisi),
**Katkılar** (yazar, bağımlılıklara teşekkür), **Geliştirmeyi
destekle** (Liberapay / GitHub Sponsors / Ko-fi bağlantıları),
**Lisans ve kaynaklar** (MIT bağlantısı, depo, belgeler, sorun
takipçisi).

Yerel modda panel yalnızca çalışan bir arka uç için anlamlı olan
satırları gizler (Python sürümü, FastAPI / SQLAlchemy / Pydantic /
PluginForge sürümleri, veritabanı yolu).

### Derleme kolu: Main ve Latest

Adaptive Learner iki dağıtım kolunda çalışır ve Hakkında sekmesi
hangisinde olduğunu söyler:

- **Main** - kararlı üretim sitesi
  (`https://astrapi69.github.io/adaptive-learner/`). Uyarı stili
  olmadan, göze batmayan bir rozetle gösterilir.
- **Latest** - `develop` dalından derlenen önizleme/hazırlık sitesi
  (`https://astrapi69.github.io/adaptive-learner-content-test/`).
  Hata içerebileceğini bilmen için açık bir **test sürümü** rozetiyle
  gösterilir.

Rozet, kolu dal ve kısa commit karmasıyla birlikte gösterir. Derleme
sırasında gömülen derleme bilgisine dayanır; bir URL sezgisi yalnızca
açıkça işaretlenmiş bir yedek yoldur ve eksik bilgi tahmin edilmek
yerine "bilinmiyor" olarak okunur.

### Uygulamayı paylaş

Hakkında sekmesinde, herkese açık uygulama URL'sinin taranabilir bir
**QR kodunu** kopyalama / PNG indirme / yerel paylaşım eylemleriyle
gösteren bir **Uygulamayı paylaş** girdisi vardır; uygulamayı bir
telefona almak için kullanışlıdır.

**Latest** kolundayken paylaşım, önizleme URL'sini bir kararsızlık
uyarısıyla birlikte **yalnızca bağlantı olarak, QR kodu olmadan**
sunar; böylece taranan bir kod hiç kimseyi sessizce kararsız test
sürümüne göndermez. **Main** kolunda paylaşım, üretim URL'si için QR
koduyla eskisi gibi çalışır.

### Güncellemeleri denetle

Sürüm bloğundaki bir **Güncellemeleri denetle** düğmesi sürümünü en son
GitHub sürümüyle karşılaştırır. Masaüstü derlemesi ayrıca GitHub
Releases API'si üzerinden bir **otomatik güncelleme denetleyicisi**
çalıştırır ve daha yeni bir sürüm olduğunda sana haber verir; aralığı
**Genel** sekmesinde *Güncellemeler* altında ayarlanır. Bir PWA
güncellemesinden sonra "yeni sürüm mevcut" başlığı, bir kez kabul
ettiğinde kapalı kalır (artık her yeniden yüklemede yeniden görünmez).
