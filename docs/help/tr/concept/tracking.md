<!-- Translation: AI-generated, pending native review -->

# Takip: öğrenme için Git

Çoğu öğrenme uygulaması "tamamlanma yüzdesi" ya da "seri günleri"
takip eder. Bu sayılar hesaplaması kolaydır ama gerçekte nasıl
öğrendiğiniz hakkında neredeyse hiçbir şey söylemez. AdaptiveLearner
bunun yerine Git'in zihinsel modelini ödünç alır.

## Git analojisi

| Git | Öğrenme |
|---|---|
| Commit | Bir oturumun anlık görüntüsü (yöntem, puanlamalar, süre) |
| Diff | Aynı konudaki önceki oturumdan fark |
| Branch | Bir yöntem değişikliği (tümdengelimli → diyalogsal) |
| Log | Commit'lerin tam kronolojik geçmişi |
| Blame | Belirli bir kalıbı hangi oturumun getirdiği |
| Bisect | Anlayışın büyümeyi durduğu oturumu bulmak |

Git'i gerçek anlamda kullanmıyoruz. Onun sürümlü, kurtarılabilir,
karşılaştırılabilir durum disiplinini kullanıyoruz. Oturumlar kalıcıdır;
sekme kapandığında kaybolmazlar. Geriye bakabilir, karşılaştırabilir
ve kalıpları bulabilirsiniz.

## Ne commit edilir

Derecelendirmeyle biten her oturum bir `ProgressCommit` satırı üretir:

| Sütun | Neyi yakalar |
|---|---|
| method | Bu oturumun kullandığı altı yöntemden hangisi |
| understanding | 1-5 derecelendirmeniz, 0,0-1,0'a yeniden ölçeklendirilmiş |
| stress | Aynı yeniden ölçeklendirme |
| error_rate | 0,0-1,0 (şu anda her zaman 0,0; gelecekteki adım başına hata oranı için ayrılmış) |
| duration_minutes | started_at ile ended_at arasındaki geçen süre |
| committed_at | Commit'in yazıldığı zaman |
| project_id | Hangi öğrenme projesi |
| session_id | Hangi oturum |

Bu kadar. Yedi alan, NULL yok (derecelendirme değerleri bitiş için
zorunlu). Oturum başına yalnızca birkaç bayt.

## Bununla neler yapabilirsiniz

### Eğilim çizgileri

Gösterge Tablosunun İlerleme Zaman Çizelgesi, son 5 anlayış + stres
derecelendirmesini çizer. Beş nokta yönü anlamak için yeterlidir:

- Her ikisi de yükselse: ilerleme + güven ikisi de artıyor. Devam edin.
- Anlayış yükseliyor, stres yükseliyor: kendinizi zorluyorsunuz.
  Bu iyidir ama yalnızca belirli bir süre sürdürülebilir.
- Anlayış düz, stres yüksek: durgunluk. Yöntem değiştirme buluşsal
  yöntemi burada tetiklenir.
- Anlayış düşüyor: bir şey değişti. Konu mu zorlaştı? Yöntem mi
  uymuyor? Geçmişe bakma zamanı.

### Yöntem dağılımı

Gerçekte hangi yöntemleri kullandınız? Pek çok öğrenci kendisini
varsayılan olarak tek bir yönteme (çoğunlukla tümdengelimli) kilitlediğini
ve diğerlerini hiç denemediğini keşfeder. Gösterge Tablosundaki çubuk
grafik bir aynadır - bir yarışma değil.

### Seri

En az bir oturumla arka arkaya takvim günleri. Bir gün oturum olmadan
geçtiğinde sıfırlanır. Bu, AdaptiveLearner'daki tek "oyunlaştırma"
metriğidir ve kasıtlı olarak göze çarpmaz. Grafiğin diğer tarafı
daha önemlidir.

### Adım değerlendirme toplamları

Çift istemli değerlendirici, yapay zeka gidiş-dönüşü başına bir
`StepEvaluation` satırı yazar. Takip toplayıcı bunları şunlara dönüştürür:

- **Ortalama güven** - yapay zekanın sizi ilerlemeye hazır olduğunuz
  konusunda ortalama ne kadar emin olduğu. Düşük (< 0,5), materyalin
  gerçekten sizin için zor olduğu anlamına gelir. Bu bir bilgidir,
  karar değil.
- **Tekrar sayısı** - değerlendirici kaç kez "burada kal" dedi. Yoğun
  konular için yoğun tekrar aşamaları normaldir.
- **Adım başına süre** - proje genelinde her adımda geçirilen toplam
  duvar saati saniyesi (> 2s boşlukları hariç tutmak için sınırlandırılmış).
  En fazla zamanı alan adım, sizin için bilişsel çalışmanın gerçekleştiği
  yerdir.

İlerleme sayfası tüm bunları çubuk grafikler olarak gösterir.

## Neyi takip ETMİYORUZ

Kasıtlı olarak:

- **Katılım metrikleri yok** - "günde kaç dakika" suçlaması yok,
  bildirim yok, günlük hatırlatma yok. Adaptive Learner dikkatiniz
  için savaşmaz.
- **Diğer kullanıcılarla karşılaştırma yok** - Yerel modda verilerinizle
  tek başınıza, Sunucu modunda arka uçla tek başınıza. Lider tahtası
  yok, eş karşılaştırması yok.
- **"Tamamlanan dersler" yok** - tamamlanacak sabit bir müfredat
  yoktur. Kendi konunuzu siz belirlersiniz.
- **"Hakimiyet yüzdesi" yok** - bir öğrenme konusu için %100 ne
  anlama gelirdi ki? Hakimiyet bir duruştur, bir bitiş çizgisi değil.

## Oyunlaştırma katmanı

ProgressCommit-as-Git altyapısının üzerine üç motivasyonel katman gelir:

- **XP + Seviyeler** - sona eren oturum başına temel 50 XP, artı
  tamamlanan döngü başına +10, döngü adım-7 başına +25, ilk-yöntem
  bonusu +50, tümü seri çarpanıyla çarpılır (7 günlük seride en fazla
  2,75×). Seviyeler `eşik(n) = 50 * n * (n - 1)` formülünü izler;
  1-5 seviyeleri 0 / 100 / 300 / 600 / 1000 XP'dedir.
- `badges.yaml`'dan ilk başlatmada tohumlanan 5 kategoride
  **24 rozet** (getting_started 3 / consistency 4 / method_explorer 7 /
  depth 7 / polyglot 3). Tahminler her oturumdan sonra değerlendirilir.
- **Seri ısı haritası** - 365 gün, GitHub tarzı, haftalık sütunlar.
  Dondurma: her 7 seri günü için 1, en fazla 3 stoklanmış, duraklatma-değil-sıfırlama
  semantiği. Hafta sonu modu değişkeni Cmt/Paz boşluklarını atlar.

Oyunlaştırma **isteğe bağlıdır**. Ayarlar → Oyunlaştırma'da bildirim
toast'larını devre dışı bırakmak istemleri susturur; sistem yine de
durumu kaydeder. Adım değerlendirme içgörüleri + Git tarzı commit
geçmişi yükü taşıyan analitiği olmaya devam eder.

## Gizlilik

Yerel modda veriler cihazınızdaki IndexedDB'dedir. Tarayıcı DevTools
aracılığıyla okuyun ya da yedekleme için dışa aktarın. Bu tarayıcı
profiline erişimi olan başka biri görmedikçe kimse göremez.

Sunucu modunda veriler, arka uç ana bilgisayarındaki SQLite'tadır.
Şifreli API anahtarları bir yana, satır verilerinin hiçbiri olağan
anlamda hassas değildir - bunlar yalnızca yöntem adları, tamsayı
puanlamalar, zaman damgaları. Ama *sizin*. Adaptive Learner bunların
hiçbirini herhangi bir üçüncü taraf analitik ya da telemetri hizmetine
göndermez.

## Bu öğrenme için neden önemli

Çoğu uygulamadaki seri sayaçları bağımlılık yaratır ama yüzeyseldir.
*Ne* öğrendiğiniz hakkında 90 günlük Duolingo serisinden hiçbir şey
öğrenmezsiniz. Git modeli size kalıplar verir:

- "10 Mayıs'ta tümdengelimli'den diyalogsal'a geçtim ve o hafta anlayış
  çizgim yükseldi."
- "Zamanımın %40'ını adım 3'te (Hata) geçirdim. Konunun beklediğimden
  fazla tuzağı var."
- "Üç haftadır bağlamsal bir oturum yapmadım; aralıklı öneri kartı beni
  haklı olarak dürtüyor."

Bunlar ciddi bir öğrenicinin kendine sorduğu sorulardır. Adaptive Learner
size bunları sorabilmeniz için altyapıyı sunar; oyunlaştırma katmanı
bunun üzerinde, ruhta varsayılan olarak kapalı, şekerdir.
