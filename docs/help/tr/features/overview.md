# Özelliklere genel bakış

Bu sayfa, "Adaptive Learner aslında neler yapabilir?" sorusunun
kanonik yanıtıdır. Uygulamanın kullanıcıya görünen tüm büyük
yeteneklerini tema tema gruplanmış olarak listeler ve her sürümle
güncel tutulur. Diğer yerler (README, tekil yardım sayfaları) bu
listenin kendi kopyalarını tutmak yerine buraya bağlantı verir.

## Öğrenme çekirdeği

- **Altı öğrenme yöntemi** (tümdengelimsel, tümevarımsal, hataya
  dayalı, diyaloğa dayalı, bağlamsal, YZ-uyarlanır), her yöntem ve
  adım için özel yapay zeka istemleriyle.
- **Yedi adımlı oturum döngüsü**: girdi, odak, deneme, geri bildirim,
  iyileştirme, transfer, entegrasyon. Çift istemli bir değerlendirici
  her turu değerlendirir ve ilerleme, tekrar, ileri atlama ya da geri
  dönme kararını verir.
- **Otomatik döngü**: bir konu entegre edildiğinde oturum yeni bir
  alt konu seçer ve taze bir döngü başlatır (oturum başına sınırlı).
- **Yöntem değiştirme**: durağanlaşma algılama, puanlar yataya
  döndüğünde farklı bir yöntem önerir; tek tıkla kabul.
- Altı yöntemli bir öğrenme profili hesaplayan **yerleştirme
  değerlendirmesi** (isteğe bağlı, kaldığın yerden sürdürülebilir);
  iki alanlı hızlı başlangıç onsuz da çalışır.

Bkz. [Öğrenme oturumları](../user-guide/learning-session.md) ve
[Öğrenme yöntemi](../concept/philosophy.md).

## Yapay zeka eğitmen sohbeti

- **assistant-ui üzerine kurulu oturum sohbeti**: token token akan
  yanıtlar, Markdown işleme, tema desteği ve tam yerelleştirme.
- **Ses**: sohbete mikrofonla dikte, yanıtlar için sesli okuma ve
  özel bir Telaffuz Alıştırması modu.
- **Kendi anahtarını getir**: ayrı sağlayıcı eklentileri olarak
  Anthropic Claude, OpenAI GPT ve Google Gemini; önerilen/tümü
  seçicisiyle canlı model keşfi; sağlayıcı başına anahtar testi ve
  geri alma destekli bir anahtar kasası.
- **İçe aktarılan konuşmalar eğitmen oturumu olarak devam eder**,
  özgün konu ve analiz bağlamı korunur.
- Teori bloklarında ve alıştırmalarda **"Yapay zekâya sor"**; yapay
  zeka yanıtları her zaman öğrenenin arayüz dilinde.

## Alıştırma türleri

Her setin kullanabileceği altı çekirdek tür, artı bir setin
beraberinde getirebileceği beş uzantı türü:

| Çekirdek tür | Öğrenen ne yapar |
|---|---|
| Eşleştirme | İki sütundaki terimleri eşleştirir (iki taraftan da başlanabilir) |
| Resim seçimi | Uyan görseli seçer |
| Serbest metin | Yanıtı yazar (yazım hatası toleransı, birden çok kabul edilen yanıt, isteğe bağlı yapay zeka ikinci görüşü) |
| Boşluk doldurma | Boşlukları yazarak, seçerek ya da çoklu seçimle doldurur |
| Kelime parçaları | Yanıtı karışık parçalardan oluşturur (dokunmatik sürükleme) |
| Çoktan seçmeli | Tek ya da çok yanıt seçer |

| Uzantı türü | Öğrenen ne yapar |
|---|---|
| Kategorilendirme | Öğeleri gruplara ayırır |
| Hata düzeltme | Cümledeki hatayı bulur ve düzeltir |
| Okuduğunu anlama | Bir metni okur, soruları yanıtlar |
| Notlu test | Puanlanan bir mini test çözer |
| Dikte | Dinler ve söyleneni yazar |

- Alıştırmalar **yön bilinçlidir** (tanıma - üretme), **alıştırma
  başına bir zorluk göstergesi** gösterir, sözdizimi vurgulamalı
  **kod ve formül içeriğini** destekler ve **önce dinle** ses
  varyantları sunar.
- Yanlış yanıtlar **token düzeyinde fark geri bildirimi** alır;
  ipuçları kademelidir ve XP'ye mal olur.

Öğrenen görünümü için bkz. [Dersler](../user-guide/lessons.md).

## Dersler ve öğrenme mekaniği

- **Bir dersi ya da seti oynamanın yedi yolu**: Alıştırma, Sınav
  (gecikmeli geri bildirim, Geçti/Geçmedi kararı, XP bonusu), Süreli,
  Ters, Karışık, Sonsuz ve yalnızca yanlış gidenleri yeniden oynatan,
  koşula bağlı "Hataları çalış" modu.
- Öğe başına hata geçmişi üzerinde **aralıklı tekrar (SRS)**: vadesi
  gelen tekrar kuyruğu, yön bilinçli hakimiyet, sınav modunda aralık
  artışı ve yapılandırılabilir tekrar oturumu uzunluğu.
- Kendi hata kalıplarından istek üzerine üretilen **uyarlamalı
  dersler** (kural tabanlı, çevrimdışı, API anahtarı gerekmez).
- Ders sonunda **hata tekrarı ve bir düzeltme turu**, tam olarak
  kaçırdığın kelimeleri çalıştırır.
- **Ders akış kontrolü**: duraklatma, tam adımdan devam etme,
  otomatik kayıt ve panoda duraklatılan dersler için bir bileşen.
- 0-3 yıldız değerlendirme, favoriler, sonraki adım önerileri, aşırı
  büyük derslerin otomatik bölünmesi ve alıştırmalardan teoriye geri
  bağlantılar.

## Ders oluşturma (Create-Lesson)

- **API anahtarı gerektirmeyen bir sihirbaz**, eksiksiz ve
  paylaşılabilir bir ders kurar: sürükle-bırak ve CSV içe aktarma
  destekli kart düzenleyici, kart başına görsel yükleme, şablonlar,
  taslak otomatik kaydı ve gerçek ders oynatıcısında önizleme.
- **Her alıştırma düzenlenebilir**: tüm çekirdek türler üretimden
  sonra düzenlenebilir, elle eklenebilir ve dengelenebilir; bir
  **uzantı hazırlama sihirbazı**, dikte için ses dosyası yükleme
  dahil beş uzantı türünün tümünü kapsar.
- **Kitap metni alma**: ders kitabı metni yapıştır ya da bir kitap
  dosyası yükle (EPUB, DOCX, TXT, Markdown); bölüm seçici, algılanan
  bölümlerin çoklu seçimi, ön ve arka bölümleri otomatik dışarıda
  bırakan bir sezgisel ve bölüm başına toplu ders üretimi.
- Deterministik bir kalite kapısıyla **yapay zeka alıştırma üretimi**
  (kendi anahtarınla), geri bildirimle yeniden üretme ve tüm bir set
  için toplu üretim.
- **Kendi derslerini yönetme**: çok dersli bir setin herhangi bir
  dersini ders seçici üzerinden düzenle, kendi derslerini bir sette
  birleştir ve bir içerik alanı seç (diller artı bilgi alanları).

Bkz. [Ders oluşturma](../content-creation/overview.md).

## İçe aktarma ve analiz

- ChatGPT, Claude, Gemini ile herhangi bir Markdown ya da
  yapıştırılan metinden **sohbet geçmişi içe aktarma**.
- **Yapay zeka analizi** konuyu, zayıflıkları, hata kalıplarını,
  önerilen yöntemi, kelime hazinesini ve önerilen bir müfredatı
  çıkarır.
- Tek tık bir **müfredat** oluşturur, **hedefli bir oturum** başlatır
  ya da analizi **yeniden oynanabilir bir çevrimdışı derse**
  dönüştürür.

## İçerik yönetimi

- Keşfet / İçerik / İçe aktar sekmeleri, liste ya da ızgara görünümü
  ve bir arama/filtre çubuğu (dil, düzey, alan, güven, yapay zekâ
  denetimi) olan bir **içerik merkezi**.
- Herkese açık GitHub içerik repository'lerinden **indirilebilir
  ders setleri**, çevrimdışı kullanım için önbelleğe alınır; setler
  bir manifest görünürlük bayrağıyla gizlenebilir.
- **Federe repository'ler**: birden çok kendi ya da üçüncü taraf
  içerik reposu bağlanabilir (özel repolar belirteçle), önerilen
  repolar bölümü ve kaynak başına güven rozetleri.
- **Toplulukla paylaşma**: dört adımlı bir paylaşım sihirbazı, akıllı
  yerleştirme ve kopya algılamayla bir içerik reposuna gerçek bir
  pull request açar; davet kodları, koçlar için özel paylaşımı
  destekler.
- **Set başına derin bağlantılar ve QR kodları**, set başına
  hakimiyet gösteren bir öğrenme yolu görünümü, alan başına kitap
  önerileri ve set başına bir kitap eki bölümü.

Bkz. [İçerik Tarayıcısı](content-browser.md),
[Keşfet](discover.md) ve
[İçerik repository'leri](content-repos.md).

## Oyunlaştırma

- Görünür bir XP rozeti ve ders başına ödüllerle **XP ve seviyeler**.
- **Kademeli rozet kataloğu** (bronz/gümüş/altın; kilitli rozetler
  bir açma ipucuyla görünür kalır).
- Isı haritalı **seriler** ve **günlük görevler** (günde en fazla üç
  uyarlamalı hedef).
- **Kutlamalar**: hak edilmiş, yoğunluğu ayarlanabilir övgü,
  kilometre taşı katmanları, isteğe bağlı sesler; hepsi azaltılmış
  hareket ayarına saygılı.

## Dışa aktarmalar ve yedekleme

- **Anki**: yapay zeka ile çıkarılan bilgi kartları uygulama içinde
  gözden geçirilir, `.apkg` ya da `.txt` olarak dışa aktarılır.
- **NotebookLM**: özet, kelime hazinesi, kurallar, hatalar, bilgi
  kartları ve oturumları içeren bir ZIP, artı etkin hatırlama
  soruları ve bir çalışma kılavuzu.
- **Öğrenme deposu**: proje başına Markdown çıktıları (README,
  istatistikler, kopya kağıdı, yol haritası), ZIP olarak indirilebilir
  ya da sunucu modunda git ile commit edilir.
- Markdown ya da PDF olarak **ilerleme raporları**; ders sonuçları
  yapay zeka destekli alıştırma için dışa aktarılabilir; sonuçlar
  için yerel paylaşım menüsü.
- **Yedekler**: tüm veri yüzeyini kapsayan `.alb` ZIP yedeği, diske
  kaydetme, ilk çalıştırmada geri yükleme, çevrimiçinden yerele
  geçiş ve yapay zeka anahtarları için parola ile şifrelenmiş ayrı
  bir `.alk` dışa aktarımı.

Bkz. [Yedekleme ve geri yükleme](backup.md).

## Platform

- **Progressive Web App (PWA)**: yüklenebilir, çevrimdışı
  çalışabilir, güncelleme bildirimli service worker güncellemeleri,
  tamamen tarayıcıda çalışır.
- **İki depolama modu**: önce yerel (her şey tarayıcı
  IndexedDB'sinde, yapay zeka çağrıları doğrudan sağlayıcıya gider,
  sunucu gerekmez) ya da sunucu modu (SQLite'lı FastAPI arka ucu,
  çoklu cihaz).
- QR kod eşleştirmeli ve çakışma çözümlü, cihazlar arası **yerel ağ
  eşitlemesi**.
- Linux, macOS ve Windows için **masaüstü başlatıcı**: bağlama
  duyarlı Docker algılama ve öz tanılamayla Docker tabanlı tek tık
  kendi kendine barındırma kurulumu.
- Aranabilir bir dil seçiciyle, tamamı çevrilmiş **on bir arayüz
  dili**.
- **Açık içerik biçimi**: dersler, yayımlanmış bir şemaya karşı
  doğrulanan düz JSON dosyalarıdır; uygulama içerik motorunu bir
  paket olarak kullanır.

Bkz. [Kurulum](../install/launcher.md).

## Erişilebilirlik ve UX

- Otomatik kontrast denetimleriyle güvence altına alınmış **WCAG AA
  doğrulamalı temalar** (açık, koyu, renkli hazır ayarlar, işletim
  sistemini izleyen otomatik mod).
- **Önce klavye**: yardım katmanı olan genel kısayollar, Enter
  dersleri ilerletir, Tab boşluk doldurma boşlukları arasında
  gezinir.
- **Ekran okuyucu desteği**: landmark'lar, ARIA etiketleri ve canlı
  bölgeler, grafikler için veri tabloları, iletişim kutusu odak
  yönetimi.
- **Azaltılmış hareket** her yerde dikkate alınır; dersler ve sohbet
  için sesli okuma (TTS).
- **Bağlama duyarlı uygulama içi yardım**: yardım paneli geçerli
  görünümün makalesini açar; her makale bu dokümantasyon sitesine
  bağlantı verir.
