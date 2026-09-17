# Yenilikler (v1.61 – v2.15)

v1.61.0'dan bu yana çıkan sürümlere kullanıcı odaklı bir genel bakış.
Sürüm başına eksiksiz, teknik notlar
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases)
altında bulunur.

---

## v2.15.0 - Daha derin alıştırmalar, kısa ders özeti

- **Parametrik alıştırmalar**: Bir ders, değerleri her denemede yeniden
  belirlenen değişkenler tanımlayabilir; sayısal yanıtlar belirli bir
  tolerans içinde değerlendirilir.
- **Üç yeni alıştırma türü**: Hotspot, Parsons ve Sıralama; üçü de Ders
  Oluşturucu'da hazırlanabilir.
- **Yanıttan sonra açıklamalar**; metinden bir ders oluşturduğunda bunları
  yapay zeka senin için yazabilir.
- Özet bölümlerini özelleştirmediysen ders sonunda **kısa bir özet** (sonuç
  ve XP) görünür; **Ayrıntılı değerlendirme** tam incelemeyi açar.
- **Ayarlar yeniden düzenlendi**: **Öğrenme** ve **Veri** sekmelerinde bölüm
  çubuğuyla başlıklı bölümler; masaüstü uygulaması yüklü eklentilerini
  listeler.
- **İçeriklerim** altındaki **Yenile**, ilerlemeni etkileyecek olanlar hariç
  mevcut tüm set güncellemelerini tek seferde uygular; içerik merkezinin
  artık kendi **Oluştur** sekmesi var.
- Künye ve gizlilik politikası artık Almanca ve İngilizce; telefonda iOS
  klavyesi, kalabalık başlıklar ve merkez sayfalarının sekme çubukları için
  düzeltmeler.

## v2.14.0 - Oyun modu ve arcade

- **İsteğe bağlı oyun modu**: kombo serileri, uçuşan puanlar, kontrol
  noktaları, yanıt fiziği, kalpler ve geri sayım, ayrıca kendine ait bir ses
  seti.
- XP ile açılan **Arcade mini oyunları** (Öğrenme Hafıza Oyunu, Snake,
  TicTacToe, Simon) ve set tamamlandığında yıldırım turları.
- Maskot renk çeşitleri; seviyeye ve rozet kazanımlarına bağlı avatar ön
  ayarları ve çerçeveleri.
- **Set sayfaları** derslerini ilerlemeleriyle listeler, bir dersten çıkınca
  setine geri dönülür ve set tamamlandığında bir değerlendirme setteki tüm
  hataları bir araya getirir.
- Ayarlara **Tanılama ve destek** sekmesi eklendi.
- Oluşturma sihirbazında üç yeni uzantı türü: Konuş & kaydet, ses seçimi,
  ses karoları.

## v2.13.0 - Alıştırma türlerini dönüştürme

- Ders düzenleyicide **bir alıştırmanın türünü yerinde değiştir**; içerik
  korunabildiği ölçüde tekrar geçmişi aktarılır ve dönüştürmenin boş
  bıraktığı alanları yapay zeka doldurur.
- İndirilmiş bir sette doğrudan **Kopya olarak düzenle**; kopyan senin kendi
  düzenlemen olarak işaretlenir ve bir seti yeniden içe aktarmak, değişmeyen
  alıştırmaların tekrar geçmişini korur.
- Ders sonundaki düzeltme turu yanıtlarını yeniden kaydeder ve sesli okuma
  ekranı açık tutar.

## v2.12.0 - Bir seti baştan başlatma

- Tamamlanmış bir seti **yeni bir tur** olarak baştan başlat; aralıklı
  tekrar geçmişin kaldığı yerden devam eder.
- Sağlayıcı anahtarlarını bir Topos `.alk` dışa aktarımından içe aktar;
  **Perplexity** yapay zeka sağlayıcıları arasına katıldı.

## v2.11.0 - Kararlı ilerleme

- Öğrenme ilerlemesi **kalıcı alıştırma kimliklerine** bağlanır. İlk
  başlatmada bir kez çalışan yerel bir geçiş, mevcut ilerlemeyi yeni
  anahtarlara taşır; böylece içerik düzeltmeleri tekrar kartlarını artık
  sahipsiz bırakmaz.
- Eşleştirme alıştırmaları yeniden tasarlandı: yardım düğme satırında,
  ilerleme sayacı üstte.

## v2.10.0 - Güvenlik: varsayılan olarak yalnızca yerel

- **Güncelleme önerilir.** Masaüstü başlatıcısı ve compose dosyası
  uygulamayı artık `127.0.0.1` adresine bağlar. Önceden aynı ağdaki herkes,
  kayıtlı yapay zeka anahtarları dahil, uygulamayı kimlik doğrulaması
  olmadan açabiliyordu.
- Uygulamaya bilerek başka bir cihazdan erişmek istiyorsan `.env` içinde
  `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` ayarla; bunu yalnızca güvendiğin
  bir ağda yap.

## v2.9.0 - Başlatıcı yeniden kapatılabiliyor

- İndirilen başlatıcı, penceresini kapattığında sistem tepsisi olmayan
  masaüstlerinde de (örneğin Ubuntu GNOME) sonlanır. Uygulama Docker'da
  çalışmaya devam eder.
- Belirlediğin ders sırası artık öğrenme akışını yönlendirir ve düzenleme
  tek tek derse aittir.

## v2.7.0–v2.8.2 - Başlatıcı yayımlanmış bir imaj kullanıyor

- Masaüstü başlatıcısı, senin bilgisayarında derlemek yerine **yayımlanmış,
  doğrulanmış bir imajı indirir** (v2.7.0 etiketlendi, ancak değişiklikleri
  kullanıcılara ilk kez v2.8.0 ile ulaştı).
- Düzeltilen Japonca, Korece ve Çince A1 derslerindeki tekrar ilerlemesi
  sahipsiz kalan kullanıcılara bir kurtarma bildirimi yardımcı olur; önce
  bir yedek sunar ve hiçbir zaman kendiliğinden çalışmaz.
- **Güvenlik yaması v2.8.1/v2.8.2 (güncelleme önerilir)**: v2.8.0 imajı
  imaj modunda beyaz bir sayfa gösteriyordu, ayrıca yalın konteyner artık
  hata ayıklama modunda başlamıyor.

## v2.6.0–v2.6.1 - Yeni oturum sohbeti, kitaplardan dersler

- **Oturum sohbeti** assistant-ui üzerine yeniden kuruldu.
- **Bir kitaptan ders oluştur**: EPUB, TXT, MD veya DOCX yükle, bölümleri
  seç ve seçilen her kısım için bir ders üret.
- Dikte düzenleyicisi ses dosyası yüklemeyi kabul eder; içerik setleri
  manifestleri üzerinden gizlenebilir.
- Başlatıcı: bağlama duyarlı Docker algılama ve çevrilmiş bir başlatıcı
  arayüzü.

## v2.5.0 - Eksiksiz alıştırma hazırlama

- Her temel alıştırma türü **Ders Oluşturucu'da düzenlenebilir**,
  alıştırmalar elle eklenebilir ve çoktan seçmeli sorular tek veya çoklu
  yanıt moduyla hazırlanabilir.
- Bir **uzantı hazırlama sihirbazı** kategorilendirme, hata düzeltme,
  okuduğunu anlama ve notlu testi kapsar; **sesli dikte** bir uzantı türü
  olarak eklendi.

## v2.4.0 - Gelişmiş ders hazırlama

- **Yapıştırılan ders kitabı metninden** bir bilgi dersi oluştur, kendi
  derslerinden birini düzenle, kendi derslerini bir sette birleştir ve kart
  resimleri yükle.
- Serbest metin alıştırmaları **birden fazla yanıtı** kabul eder ve yanlış
  bir yanıtta **yapay zekadan ikinci görüş** sunar.
- Ayarlar'daki **Yapay zeka** sekmesi doğrudan anahtar içe aktarmaya
  yönlendirir.

## v2.3.0 - Ders oynatıcısı yenilendi

- Daraltılabilir seçenekler paneli, alt çubukta duraklatma düğmesi ve daha
  ince bir başlık alanı.
- **Önce dinlemeye dayalı sesli alıştırmalar**.
- Ders ve set dosyalarının daha sağlam içe ve dışa aktarımı.

## v2.2.0 - Uzantı alıştırmaları

- Yapay zekanın hazırladığı dört **uzantı alıştırma türü** ve yerleşik
  çoktan seçmeli.
- Depo kaydetme akışına sahip, federe bir **içerik deposu kayıt defteri**.
- Alt sekme çubuğu olmadan daha sade mobil gezinme.

## v2.1.0 - Yayından sonra ince ayar

- Bir içerik deposunu kaldırmak Pano'da, tekrar kuyruğunda veya
  duraklatılmış derslerde **artık hayalet ilerleme bırakmıyor**.
- Ayarlar yeniden düzenlendi; Öğrenme yolu düzeltmeleri, kolayca bulunan
  bir **Yapay zekâya sor** düğmesi ve daha sağlam içerik eşitlemesi.

## v2.0.0 - Herkese açık lansman

- Geniş bir kitle için ilk sürüm: ücretsiz ve açık kaynak (MIT), çevrimdışı
  öncelikli, hesap gerektirmez, aralıklı tekrar, kendi yapay zeka anahtarını
  kullan, kendi derslerini hazırla ve paylaş, PWA olarak kurulabilir.
- Teknik bir kırılma değil, bir lansman kilometre taşı: v1.99.0'a göre
  geriye dönük uyumsuz bir değişiklik yok.

## v1.99.0 - Mobil sağlamlaştırma

- **Dokunulabilir yanıt düğmeleri olarak çoktan seçmeli**; bu, iPhone'da
  yanlış algılanan dokunuşları giderir.
- Cihaz düzeltmeleri: iOS odak yakınlaştırması, iPhone silme menüsü ve
  hatırlanan arayüz dili.
- Keşfet'te içerik dili filtresi, İçeriklerim'de çoklu seçim, isteğe bağlı
  otomatik ilerleme ve satır içi çözümlü örnekler.

## v1.97.0–v1.98.0 - İçerik merkezi yeniden tasarlandı

- **İçeriklerim** yalnızca indirilmiş içeriği gösterir; içe aktarma ve
  oluşturma **İçe aktar** sekmesine taşındı; liste veya ızgara görünümü ve
  kompakt bir arama ve filtre çubuğu.
- Daraltılabilir masaüstü kenar çubuğu ve silme seçeneğiyle set başına durum
  (Etkin, Ertelendi, Tamamlandı).
- Dikey masaüstü gezinmesi ve tek bir sete doğrudan bağlantılar; boşluk
  doldurmada "Geçerli olanların tümünü seçin"; sınav yanıtları tekrar
  aralıklarını uzatır; yapay zeka anahtarlarının parolayla şifrelenmiş
  `.alk` dışa aktarımı.
- İspanyolca ve Fransızca çeviriler gözden geçirildi.

## v1.95.0–v1.96.0 - Ders modları

- Bir dersi veya seti **Alıştırma, Sınav, Süreli veya Karışık** modunda
  oyna, ayrıca "Hataları çalış"; gecikmeli geri bildirimli sınav modu,
  sonuç görünümü, geçti ya da kaldı bilgisi ve XP bonusu.
- **Ters ve Sonsuz** modları, içerik paylaşmak için davet kodları ve
  verileri çevrimiçi sürümden yerel bir kuruluma taşıma.
- Bir seti bir GitHub deposuna dışa aktarma.

## v1.92.0–v1.94.1 - Çevrimdışı ve başlatıcı sağlamlaştırması

- Kurulu PWA amaçlandığı gibi **tarayıcı depolama modunda** çalışır;
  çalışma kılavuzu, telaffuz ve kimlik için düzeltmeler de geldi.
- **Masaüstü başlatıcısı**: görünür ilerlemeli, Docker öncelikli akış,
  yapılandırılabilir portlar ve tek, kalıcı bir pencere; Windows başlatıcısı
  yeniden derleniyor.
- Yapay zeka içerik denetimi iletişim kutuları masaüstünde kaydırılabilir ve
  denetimi hangi sağlayıcı ile modelin yaptığını gösterir.

## v1.91.0 - Gezinmenin yeniden yapılandırılması

- **Ana gezinme 12'den fazla girişten 7 gruplu girişe indirildi**
  (Pano, Öğrenme yolu, İçeriğim, Keşfet, İlerleme, Ayarlar, Yardım);
  hiçbir işlev kaybolmadı, her sayfaya erişilebiliyor.
- **Mobil alt sekme çubuğu** (Öğren / İçerik / Keşfet / İlerleme /
  Daha fazla) ve bir "Daha fazla" alt sayfası.
- **ProgressHub** (`/progress`) Genel bakış / İstatistikler / Yollarım
  bölümlerini sekmelerde toplar; **DiscoverHub** (`/discover`) bir
  İçe aktar sekmesi kazanır. Eski bağlantılar yönlendirmeler sayesinde
  çalışmaya devam eder.
- PWA güncelleme bildirimi, bir güncellemeyi kabul ettikten sonra artık
  yeniden görünmüyor.

## v1.90.0 - Yapay zeka ile alıştırma üretimi + otomatik güncelleme

- **Yapay zeka alıştırma üretim hattı**: yalnızca teori içeren bir ders
  için kalite kontrolü, tür dengeleme, geri bildirimle yeniden üretme ve
  tüm set için toplu üretimle alıştırmalar üret.
- Eşleştirme alıştırmasında **animasyonlu çift çözümü**.
- Yapılandırılmış sağlayıcılar genel bakışında **sağlayıcı başına Test et
  düğmesi** ([Ayarlar](user-guide/settings.md)).
- GitHub Releases API üzerinden **masaüstü otomatik güncelleme
  denetleyicisi**.
- Yapay zeka oturum yanıtları artık arayüz dilinde geliyor.

## v1.87.0–v1.88.0 - İçerik keşfi + QR paylaşımı

- **İçerik keşfi (`/discover`)**: kütüphane üzerinde bir arama dizini; set
  başına indirme, yerel "İçeriklerim"den ayrı olarak buraya taşındı.
- **QR koduyla uygulama paylaşımı**: uygulamayı taranabilir bir QR koduyla
  paylaş (kopyala / PNG olarak indir / yerel paylaşım).
- **Müfredat oluşturucu** + günlük öğrenme hatırlatıcıları.
- **Korece + Endonezce arayüz** dil setine katıldı (artık 11 dil).

## v1.86.0–v1.87.0 - Yapay zeka içerik doğrulaması + `.alb` yedeği

- **Yapay zeka içerik doğrulaması**: rapor arayüzü, önbelleğe alınmış
  rapor + Markdown dışa aktarımı ve "Yapay zeka kontrollü" rozetiyle set
  genelinde kalite denetimleri.
- **Medya entegrasyonu**: "Konuyu derinleştir" adlı bir ders bölümü.
- **`.alb` ZIP yedek biçimi** tek JSON dökümünün yerini alır ve artık bir
  localStorage anlık görüntüsü de içerir
  ([Yedekleme ve geri yükleme](features/backup.md)).

## v1.70.0–v1.84.0 - Kullanıcı deneyimi, temalar ve TipTap 3

- **İlk çalıştırmada geri yükleme**: boş bir kurulum, başlangıç sürecinde
  "Mevcut yedekten geri yükle" seçeneği sunar.
- **Belgeler elden geçirildi** + bağlama duyarlı uygulama içi yardım.
- **TipTap düzenleyicisi v2 → v3'e taşındı** (tüm `@tiptap/*` yığını).
- **Özellik stratejisine dayalı erişim denetimi**: yapay zeka özellikleri
  yeniden yükleme gerekmeden etkin / devre dışı / gizli arasında geçiş
  yapar.
- Koyu temada kapsamlı kontrast iyileştirmeleri + mobil düzen
  sağlamlaştırması.

## v1.69.0 - Örnek bağlantılar + kitap önerileri

- **Teoride örnek bağlantılar:** Bir teori adımı, isteğe bağlı bir
  "Örneği görüntüle" bağlantısı taşıyabilir.
- İçerik Tarayıcısı'nda **alan başına kitap önerileri**
  ([Kitap önerileri](content-creation/books.md)).
- **Hata-Replay'inde de Enter kısayolu** ("Hatayı tekrarla").
- **Yedek düzeltmesi:** Set başlığı geri yükleme sırasında
  manifest'ten doğru okunur.

## v1.68.0 - Sonuç dışa aktarma + teori geri bağlantıları

- **Ders sonucunu dışa aktar:** "Sonucu kopyala" / "Dosya olarak
  kaydet" (yapay zeka asistanları için Markdown raporu).
- **Teori geri bağlantıları:** Bir alıştırmadan uygun teoriye atla ve
  geri dön.
- **Eşleştirme alıştırması yenilendi:** renkli çiftler + numara
  rozetleri (renk körlüğüne karşı güvenli).
- Birkaç yerde **Dark-Mode kontrastı** düzeltildi.

## v1.67.1 - Yedek geri yükleme + dağıtım kararlılığı

- Sistematik **yedek geri yükleme** düzeltmesi.
- Eski dağıtım chunk'ında otomatik yeniden yükleme.
- Subject filtre cilası (≤ 1 Subject'te gizlenir, en çok kullanılan
  önce).

## v1.65.0 - Sürdürülebilir Assessment + Enter kısayolu

- **Sürdürülebilir Assessment:** Testi yarıda bırak ve daha sonra
  kaldığın yerden devam et.
- **Enter kısayolu:** Enter, yanıtlanmış bir alıştırmayı denetler ve
  ilerler (Ayarlar → Öğrenme altında değiştirilebilir).
- Daha belirgin eşleştirme alıştırmaları + Design-Token geçişi.

## v1.64.0 - Onboarding yenilemesi

- **Yalnızca ad + konu ile hızlı başlangıç**; geri kalan varsayılanları
  alır.
- İsteğe bağlı **Onboarding yardımcısı** (ekran başına bir soru).
- **Assessment artık isteğe bağlı** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 - WCAG-AA tema ön ayarları

- **6 önerilen tema** (Catppuccin Latte/Mocha, Supabase, Graphite,
  Soft Pop, Amethyst Haze), hesaplamalı olarak AA uyumlu
  ([Tema sistemi](developer/themes.md)).
- Sistematik i18n denetimi; kullanıcı odaklı Dashboard filtresi.

## v1.62.0 - Yedek bütünlüğü + Build kökeni

- **Yedek geri yükleme**nin sertleştirilmesi (veri türü dönüşümü, FK
  sırası).
- About, "unknown" yerine gerçek Build bilgilerini gösterir.

## v1.61.0 - Düğme uyumluluğu + ders sürdürme

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
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - eksiksiz notlar
