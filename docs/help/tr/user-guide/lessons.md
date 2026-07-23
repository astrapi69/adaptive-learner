# İçerik dersleri ve tekrarlar

Bir **içerik dersi**, herkese açık bir ders setinden indirilen küçük,
elle hazırlanmış bir öğrenme birimidir (genellikle 5–10 dakika).
Yapay zeka sohbet oturumunda değil, kendi görüntüleyicisinde çalışır.
Dersten sonra uygulama, hangi kelimeleri, çiftleri ya da kalıpları
yanlış yanıtladığını tam olarak hatırlar ve bunları daha sonra hedefli
bir tekrar oturumu için planlar.

Dersler, bir yapay zeka API anahtarına ihtiyaç duymayan **alternatif
bir öğrenme yoludur** — uygulamayı denemek ya da küratörlü materyalin
serbest sohbetten daha iyi işlediği içerikler için idealdir.

---

## Dersler nereden gelir

Dersler **içerik setlerinde** bulunur — herkese açık GitHub
repolarında yayınlanmış küçük paketler. `/content` altındaki
**Set Tarayıcısı**, mevcut her seti listeler; indirmek için birine
tıkla. Set yerel olarak önbelleğe alınır (arka uçla çalışırken dosya
sisteminde, yalnızca tarayıcı modunda IndexedDB'de), böylece ilk
indirmeden sonra çevrimdışı öğrenebilirsin.

Yerleşik kitaplık, farklı diller ve alanlarda birden çok içerik
seti içerir. Her sürüm yenilerini ekler — güncel katalog için
[Set reposuna](https://github.com/astrapi69/adaptive-learner-content)
bak.

---

## Ders akışı

Bir set aç, bir ders seç ve **Ders Görüntüleyici** seni her kart ve
alıştırmadan adım adım geçirir:

1. **Kartlar** okumak için materyal sunar. Hazır olduğunda
   "Devam"a tıkla.
2. **Alıştırmalar** neyi hatırladığını sınar. Dört tür mevcuttur:
   - **Eşleştirme** — çiftleri sürükle (kelime ↔ çeviri). Bulunan bir
     çiftin her iki karosu **kendi rengini** ve bir **numara
     rozetini** paylaşır, böylece eşleştirme renk körlüğüne karşı
     güvenli biçimde tanınır (yalnızca renkle değil).
   - **Resim seçimi** — ipucuna uyan resmi seç.
   - **Serbest metin** — yanıtı yaz.
   - **Kelime karoları** — karolardan bir cümle oluştur.
   - **Boşluk doldurma** — cümledeki bir boşluğu doldur (hatalarından
     hedefli olarak oluşur, aşağıya bak).

Üstteki bir ilerleme göstergesi, derste ne kadar ilerlediğini izler.
İstediğin zaman durabilirsin — ilerlemen adım başına kaydedilir ve
kaldığın yerden devam eder.

### Enter kısayolu

Tüm dersi klavyeyle kullanabilirsin: **Enter**, yanıtlanmış bir
alıştırmayı denetler ve ardından sonraki adıma geçer; serbest metin ve
boşluk doldurma alanları Enter'da gönderir (satır sonu yok). Enter'ın
kendisine ihtiyaç duyan kontrol öğeleri önceliklerini korur. Kısayol
**Ayarlar → Öğrenme** altında değiştirilebilir (varsayılan olarak
açık) ve Hata-Replay'inde de ("Hatayı tekrarla") geçerlidir.

### Örnek ve teori bağlantıları

- **Örneği görüntüle:** Bir teori adımı, "Örneği görüntüle" düğmesi
  olarak görünen, ayrıntılı bir örneğe isteğe bağlı bir bağlantı
  taşıyabilir.
- **Teoriyi tekrar oku:** Bir alıştırma, en yakın önceki teoriye
  ölçülü bir bağlantı gösterir; oradan "Alıştırmaya geri dön" seni
  tekrar göreve getirir. Böylece, ipi kaybetmeden bir kuralı ararsın.

### Özet

Son alıştırma tamamlandığında **ders özeti** görünür:

- Sonucuna dayalı **0–3 arası yıldız değerlendirmesi**:
  - **3 yıldız** ≥ %90 doğru
  - **2 yıldız** ≥ %75
  - **1 yıldız** ≥ %50
  - **0 yıldız** %50'nin altında
- Hangi alıştırmaları geçtiğini ve hangilerinin hata içerdiğini
  (yanlışlar için doğru yanıtla birlikte) gösteren bir
  **alıştırma-alıştırma dökümü**.
- Sonraki eylemin bir tık uzakta olması için **Sonraki ders**,
  **Tekrarla** ve **Sete geri dön** düğmeleri.

İlk denemede 3 yıldız alırsan küçük bir kutlama animasyonu oynar.
(İşletim sistemi ayarı "Hareketleri azalt" etkinleştirilmişse,
animasyon buna saygı gösterir.)

### Sonucu dışa aktarma

Özet, **"Sonucu kopyala"** ve **"Dosya olarak kaydet"** sunar. Her
ikisi de puanını, hata-hata bir döküm (senin yanıtın + doğru yanıt)
ve hâlâ zayıf olan alanları içeren bir **Markdown raporu** üretir.
Rapor, sana hedefli olarak yardımcı olacak bir yapay zeka asistanına
yapıştırmak için uygundur. Dışa aktarma, arka uç olmadan saf bir
üreteçtir ve her iki depolama modunda da çalışır.

---

## Öğe düzeyinde hata izleme

Her alıştırma türündeki her yanlış yanıt, **kaçırdığın somut öğeye**
işaret eden bir satır yazar — tek kelime, çift ya da kalıp. Uygulama
SADECE "Ders 3'te 6/10 aldın" demez; "özellikle *bonjour* ve *merci*
ile zorlandın" der.

Aynı öğeyi **üç kez arka arkaya** doğru yanıtlarsan, o **ustalaşıldı**
olarak işaretlenir — ve tekrar kuyruğundan çıkarılır. Ustalaşılmış bir
öğeyi daha sonra yanlış yanıtlarsan, **geri kayar**. Kaçırılmış bir
ustalık, unutulmuş bir ustalıktır.

---

## Tekrar kuyruğu

Tekrar gerektiren bir veya daha çok öğen varsa, Dashboard'da
**tekrar kartı** görünür. Şunları gösterir:

- Kaç öğenin vakti geldiğini
- Kaç tanesinin **gecikmiş** olduğunu (planlanan tekrar tarihinden
  sonra)
- `/review/:setId` altında odaklı bir mini-oturum açan bir **Şimdi
  tekrarla** düğmesi

Planlama, öğeyi arka arkaya kaç kez doğru yanıtladığına dayalı üç
seviye kullanır:

| Doğru serisi | Sonraki tekrar |
|---|---|
| 0 | 1 gün sonra |
| 1 | 3 gün sonra |
| 2 | 7 gün sonra |
| 3 (ustalaşıldı) | kuyruktan çıkarıldı |

Kuyruk içinde girişler kendiliğinden sıralanır: **gecikmiş olanlar
önce**, ardından **hata sayısına göre azalan**, ardından **en son
hata önce**. Böylece en çok zorlandığın öğeler yukarı çıkar.

---

## Tekrar oturumları

`/review/:setId` altındaki bir tekrar oturumu, kuyruğunun üst
girişlerinden uçuş anında bir **mini-ders** sentezler. Karma
strateji:

- Bir kelimeyi başlangıçta bir **eşleştirme** ya da **resim seçimi**
  alıştırmasında kaçırdıysan, tam olarak bu alıştırmayı yeniden
  yaparsın (taze karıştırmayla — saf kas hafızası değil).
- Bir şeyi **serbest metin** ya da **kelime karolarında**
  kaçırdıysan, tekrar tam olarak kaçırılan kelimeyi hedefleyen bir
  **boşluk doldurma** alıştırması üretmeye çalışır. Aynı bilgi farklı
  biçimde — yalnızca belirli bir alıştırma formatının tekrarı değil,
  esneklik eğitilir.
- Bir öğe için temiz bir boşluk doldurma oluşturulamıyorsa (örneğin
  orijinal prompt yanıtı cümlede içermiyorsa), tekrar sessizce orijinal
  alıştırmayı oynatır. Asla bozuk ya da boş bir adım almazsın.

Bir tekrar oturumunu tamamladığında aynı değerlendirme + yıldız +
öğe izleme mekanizması çalışır. Tekrarlar yoluyla 50 öğeye ustalaş ve
**Tekrar Ustası** rozetini kazan.

## Ders sonu düzeltme turu

Bir dersi hatalarla tamamladığında, özet sayfası
puanın ile "Sonraki ders" düğmesi arasında küçük bir **düzeltme turu**
gösterir. Bu turdan dersteki en fazla beş somut hatayı alır ve her
birini tam olarak kaçırılan kelimeyi / kaçırılan artikeli hedefleyen
taze bir boşluk doldurma olarak sunar.

- **İstediğin zaman atlanabilir.** "Sonraki ders" düğmesi görünür
  kalır — düzeltme turu gönüllü bir alıştırmadır, bir gate değil.
- **Yalnızca düzeltilecek bir şey varsa görünür.** Kusursuz puanlı
  dersler onu tamamen atlar. Hataları temiz bir boşluk doldurmaya
  dönüştürülemeyen dersler (nadiren) de.
- **Tamamlanan her boşluk doldurma, ustalığa sayılır.** Düzeltme turu,
  ana dersle aynı öğe-izleme veri kayıtlarını yazar; bu öğelerdeki
  serin 3-doğru ustalık eşiğine doğru ilerler.

Sonunda, ek alıştırmanın etkisini görmen için kısa bir "{n} öğe
iyileştirildi" satırı görünür.

## Görsel diff geri bildirimi

Yanlış serbest metin ve kelime karosu
yanıtları artık girdin ile kanonik yanıt arasında **Token düzeyinde
bir diff** gösterir. Üç renk, asla yalnızca renk değil:

- **Kırmızı üstü çizili** — yazdığın ve oraya ait olmayan (ekran
  okuyucular ve renk körü kullanıcılar için bir × işaretiyle).
- **Yeşil** — kanonik yanıtın içerdiği ve senin gözden kaçırdığın (bir
  + işaretiyle).
- **Sarı** ok ile → — hafifçe yanlış bir kelime, `senin-kelimen` →
  `beklenen` olarak gösterilir.

Aynı diff, ders özetinde her alıştırmanın dökümünde görünür — kullanıcı
girdisi deposunun bildiği her serbest metin veya kelime karosu
yanıtı için.

---

## XP ve rozetler

Tamamlanan her ders, bir yıldız formülüne göre XP kazandırır:

- **30 XP** taban
- Kazanılan **her yıldız için +10 XP** (0 → 0, 1 → +10, 2 → +20,
  3 → +30)
- İlk denemede 3 yıldız alırsan **+20 XP bonus** (her adım deneme = 1
  ile, tekrar yok)
- Sohbet oturumlarındaki ile aynı **günlük seri çarpanı** (arka arkaya
  her gün +%25, 7 günde sınırlanır)

Dersler etrafında dört yeni rozet açılır:

- **İlk ders** — ilk içerik dersini tamamla.
- **10 ders tamamlandı** — 10 içerik dersini tamamla.
- **3-yıldız serisi** — arka arkaya üç dersi 3 yıldızla geç.
- **Tekrar Ustası** — dağıtık tekrar yoluyla 50 öğeye ustalaş.

Ders tamamlamaları **günlük serine** de sayılır, böylece içerik
dersleriyle öğrenmek, ısı haritasını sohbet oturumlarıyla aynı şekilde
doldurur.

---

## Depolama modları

Dersler **her iki** depolama modunda da çalışır — API (arka uç) ve
Dexie (yalnızca tarayıcı / GitHub Pages). Öğe düzeyinde hata izleme ve
SRS planlaması, yalnızca tarayıcı modunda IndexedDB'ye karşı aynı
şekilde çalışır, böylece herkese açık GitHub Pages sayfasını ziyaret
eden kullanıcılar, arka uç olmadan tam tekrar döngüsünü alır.

Gamification de eşitlenmiştir: Yalnızca tarayıcı
modunda, tamamlanan dersler için sunucu modundaki ile **aynı XP ve
ders rozetlerini** kazanırsın — yıldız, Streak ve rozet mantığı
TypeScript'e taşınmış ve aynı altın değerlere karşı güvence altına
alınmıştır. Ders tamamlamada modlar arasında artık işlevsel bir fark
yoktur.

---

## Gizlilik

Tüm ders ilerlemeleri, öğe-hata satırları, tekrar-kuyruğu durumları ve
planlama verileri **kendi cihazında** kalır — dosya sisteminde (API
modu) ya da tarayıcıda (IndexedDB). Hangi kelimelerle zorlandığına dair
hiçbir şey herhangi bir yere gönderilmez.
