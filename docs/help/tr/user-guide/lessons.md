<!-- Translation: AI-generated, pending native review -->

# İçerik dersleri ve incelemeler

**İçerik dersi**, genel bir içerik setinden indirilen küçük,
elle hazırlanmış bir öğrenme birimidir (genellikle 5-10
dakika). Yapay zeka sohbet oturumunda değil, özel bir
görüntüleyicide çalışır. Ders tamamlandıktan sonra uygulama,
hangi kelime, çift veya ifadeyi yanlış yaptığınızı tam olarak
hatırlar ve bunları daha sonraki odaklı bir inceleme oturumu
için zamanlar.

Dersler, yapay zeka API anahtarı gerektirmeyen **alternatif bir
öğrenme yoludur** — uygulamayı denemek veya seçilmiş materyalin
serbest biçimli sohbetten daha iyi olduğu içerikler için
mükemmeldir.

---

## Dersler nereden geliyor

Dersler, genel GitHub depolarına yayımlanan küçük paketler olan
**içerik setleri** içinde yer alır. `/content` adresindeki
uygulamanın **Set Tarayıcısı** mevcut tüm setleri listeler;
birini indirmek için tıklayın. Set yerel olarak önbelleğe alınır
(arka uçla çalışıyorsanız dosya sisteminde, yalnızca tarayıcı
dağıtımında IndexedDB'de), böylece ilk indirmenin ardından
çevrimdışı çalışabilirsiniz.

Pilot v1.27.0 seti **Fransızca A1**'dir (2 ders, 14 kart, tüm
dört alıştırma türünü kapsayan 9 alıştırma). O tarihten bu yana
her sürümde daha fazlası eklenmektedir — güncel katalog için
[set deposuna](https://github.com/astrapi69/adaptive-learner-content)
bakın.

---

## Ders akışı

Bir set açın, bir ders seçin ve **ders görüntüleyici** sizi her
kart ve alıştırmada adım adım götürür:

1. **Kartlar** okunacak materyal sunar. Hazır olduğunuzda
   "İleri"ye tıklayın.
2. **Alıştırmalar** ne hatırladığınızı kontrol eder. Dört tür
   mevcuttur:
   - **Eşleştirme** — çiftleri sürükleyin (kelime ↔ çeviri).
   - **Resim seçimi** — bir komutla eşleşen resmi seçin.
   - **Serbest metin** — cevabı yazın.
   - **Kelime kutuları** — kutulardan bir cümle oluşturun.

Üstteki ilerleme çubuğu derste ne kadar ilerlediğinizi
gösterir. İstediğiniz zaman ayrılabilirsiniz — ilerlemeniz
adım adım kaydedilir ve kaldığınız yerden devam eder.

### Özet ekranı

Son alıştırma tamamlandığında **ders özeti** görünür:

- Puanınıza göre **0-3 yıldız** derecelendirmesi:
  - **3 yıldız** ≥ %90 doğru
  - **2 yıldız** ≥ %75
  - **1 yıldız** ≥ %50
  - **0 yıldız** %50'nin altı
- **Alıştırma başına döküm**, hangi alıştırmaları geçtiğinizi
  ve hangilerinde hata yaptığınızı gösterir (yanlış olanlar
  için doğru cevap gösterilir).
- **Sonraki ders**, **Tekrar** ve **Sete dön** düğmeleri
  sayesinde bir sonraki eylem tek tıklama uzaklığındadır.

İlk denemede 3 yıldız alırsanız yıldızlar küçük bir kutlama
animasyonu oynatır. (İşletim sisteminin "hareketi azalt"
ayarını etkinleştirdiyseniz animasyon buna uyar.)

---

## Öğe düzeyinde hata takibi

Her alıştırma türündeki her yanlış cevap, **kaçırdığınız belirli
öğeye** — tek kelimeye, çifte veya ifadeye — bağlı bir satır
yazar. Uygulama sadece "3. derste 6/10 aldınız" diye hatırlamaz;
"*bonjour* ve *merci* ile özellikle mücadele ettiniz" diye
hatırlar.

Aynı öğeyi **arka arkaya 3 kez** doğru yaparsanız **ustalaşıldı**
olarak işaretlenir — inceleme kuyruğundan çıkarılır. Ustalaşılmış
bir öğeyi daha sonra yanlış yaparsanız **geri düşer** ve kuyruğa
geri döner. Başarısız bir ustalık unutulmuş bir ustalıktır.

---

## İnceleme kuyruğu

İnceleme gerektiren bir veya daha fazla öğeniz olduğunda
**İnceleme kuyruğu kartı** Gösterge Tablosunda görünür. Şunları
gösterir:

- Kaç öğenin sırada beklediği
- Kaç tanesinin **gecikmiş** olduğu (planlanan inceleme
  tarihini geçmiş)
- `/review/:setId` adresinde odaklı bir mini oturum açan
  bir **Şimdi İncele** düğmesi

Zamanlama, öğeyi arka arkaya kaç kez doğru yaptığınıza göre
üç bant kullanır:

| Doğru serisi | Sonraki inceleme |
|---|---|
| 0 | 1 gün sonra |
| 1 | 3 gün sonra |
| 2 | 7 gün sonra |
| 3 (ustalaşıldı) | kuyruktan çıkarılır |

Kuyruk içinde öğeler şu sırayla sıralanır: **önce gecikmiş**,
ardından **hata sayısına göre azalan**, ardından **en son
başarısızlık önce**. Böylece en çok zorlandığınız öğeler öne
çıkar.

---

## İnceleme oturumları

`/review/:setId` adresindeki bir inceleme oturumu, kuyruğunuzdaki
üst öğelerden **anında mini bir ders** oluşturur. **v1.35.0**
itibarıyla karma strateji:

- Bir kelimeyi **eşleştirme** veya **resim seçimi** alıştırmasında
  yanlış yaptıysanız, o alıştırmayı yeniden yapacaksınız (yeni
  karıştırma ile, saf kas hafızası olmasın diye).
- **Serbest metin** veya **kelime kutularında** bir şeyi yanlış
  yaptıysanız, inceleme tam olarak yanlış yaptığınız kelimeyi
  hedefleyen bir **boşluk doldurma** (cloze) oluşturmaya çalışır.
  Farklı bir biçimde aynı bilgi — sadece bir alıştırma biçimini
  hatırlamanız değil, esnekliğiniz test edilir.
- Boşluk doldurma, o öğe için temiz bir boşluk oluşturamazsa
  (örneğin kaynak komut cevabı satır içinde taşımıyorsa),
  inceleme sessizce orijinalini tekrar oynatmaya geri döner.
  Hiçbir zaman bozuk veya boş bir adım görmezsiniz.

Bir inceleme oturumunu tamamladığınızda aynı puanlama + yıldız
derecelendirmesi + öğe takip mekanizması çalışır. İncelemeler
aracılığıyla 50 öğeye ulaşırsanız **İnceleme Ustası** rozetini
kazanırsınız.

## Her dersin sonunda düzeltme turu

**v1.35.0**'da yeni: Yanlış cevaplarınız olan bir dersi
tamamladığınızda özet sayfası, puanınız ile "Sonraki ders"
düğmesi arasında küçük bir **düzeltme turu** gösterir. Bu
dersten en fazla beş özel hatanızı alır ve her birini tam
olarak yanlış yaptığınız kelimeye veya makaleye yönelik yeni
bir boşluk doldurma olarak sunar.

- **İstediğiniz zaman atlayabilirsiniz.** "Sonraki ders"
  düğmesi boyunca görünür kalır — düzeltme turu isteğe bağlı
  bir pratiktir, zorunlu bir geçit değildir.
- **Yalnızca düzeltilecek bir şey olduğunda görünür.**
  Mükemmel puanlı dersler tamamen atlar. Hataları temiz bir
  boşluk doldurmaya dönüştürülemeyen dersler (nadir) de atlar.
- **Tamamlanan her boşluk doldurma ustalığa doğru sayılır.**
  Düzeltme turu, ana ders ile aynı öğe takip satırlarını yazar;
  o belirli öğelerdeki seriniz 3 doğru ustalık eşiğine doğru
  ilerler.

Turun sonunda kısa bir "{n} öğe iyileştirildi" satırı görünür,
böylece ekstra pratiğinizin ne kadar etki ettiğini görebilirsiniz.

## Görsel fark geri bildirimi

Ayrıca **v1.35.0**'da yeni: Yanlış serbest metin ve kelime
kutusu cevapları artık yazdıklarınız ile standart cevap arasındaki
**token düzeyinde farkı** gösterir. Üç renk, asla yalnızca renk
değil:

- **Kırmızı üstü çizili** — yazdığınız ama ait olmayan (ekran
  okuyucular ve renk körü kullanıcılar için × işaretiyle).
- **Yeşil** — standardın içerdiği ama sizin atladığınız (+
  işaretiyle).
- **Sarı** ok ile → — biraz yanlış yaptığınız bir kelime,
  `yazdığınız` → `beklenen` olarak gösterilir.

Aynı fark, ders özetinin alıştırma başına döküm satırlarında,
v1.35.0+ deposunda kullanıcı cevabının bulunduğu serbest metin
veya kelime kutusu denemesi için görünür.

---

## XP ve rozetler

Tamamlanan her ders, yıldız başına formül altında XP kazanır:

- **30 XP** temel
- Kazanılan her yıldız için **+10 XP** (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP bonusu** ilk denemede 3 yıldız alırsanız
  (her adım 1 denemede, yeniden deneme yok)
- Sohbet oturumlarıyla aynı **günlük seri çarpanı**
  (etkinlik için arka arkaya gün başına +%25, 7 günle sınırlı)

Dersler etrafında dört yeni rozet açılır:

- **İlk Ders** — ilk içerik dersini tamamlayın.
- **10 Ders Tamamlandı** — 10 içerik dersini tamamlayın.
- **3 Yıldız Serisi** — arka arkaya üç derste 3 yıldız kazanın.
- **İnceleme Ustası** — aralıklı tekrar yoluyla 50 öğeye
  ulaşın.

Ders tamamlamaları **günlük serinize** de sayılır, böylece içerik
dersleriyle çalışmak ısı haritasını sohbet oturumları gibi
doldurar.

---

## Depolama modları

Dersler **her iki** depolama modunda da çalışır — API (arka uç)
ve Dexie (yalnızca tarayıcı / GitHub Pages). Öğe düzeyinde hata
takibi ve SRS zamanlaması, yalnızca tarayıcı dağıtımında
IndexedDB'ye karşı aynı şekilde çalışır; bu nedenle genel
GitHub Pages sitesini ziyaret eden kullanıcılar arka uç olmadan
tam inceleme döngüsünü alır.

Yalnızca tarayıcı modunda *farklı* olan: XP ödülü / rozet kazanma
yan etkileri yalnızca API modunda gerçekleşir (arka ucun
oyunlaştırma kancalarına ihtiyaç duyarlar). Dexie modunda sohbet
oturumu yoluyla XP ve rozetler kazanmaya devam edersiniz; ders
tamamlama bu toplamı henüz artırmaz.

---

## Gizlilik

Tüm ders ilerlemesi, öğe hata satırları, inceleme kuyruğu durumu
ve zamanlama verileri API modunda (dosya sistemi) veya tarayıcı
(IndexedDB) **kendi cihazınızda** kalır. Hangi kelimelerle
mücadele ettiğiniz hiçbir yere gönderilmez.
