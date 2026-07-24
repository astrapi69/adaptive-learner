<!-- Translation: AI-generated, pending native review -->

# Öğrenme oturumu

Oturum, yapay zeka ile yedi adımlı öğrenme döngüsü boyunca
sürdürülen, odaklı bir konuşmadır. Oturumlar kısadır - tipik olarak
15-45 dakika sürer. Kontrol Panelindeki "Oturum başlat" düğmesi yeni
bir tane oluşturur; uygulama öğrenme yöntemini (değerlendirmenizdeki
baskın yöntem) ve döngünün başlangıç adımını (genellikle 1 = Girdi)
seçer.

## Yedi adım

| # | Adım | Ne olur |
|---|---|---|
| 1 | Girdi | Yapay zeka etkin yöntemin stilinde yeni materyal sunar |
| 2 | Deneme | Az önce öğrendiklerinizi uygularsınız - yapay zeka bir görev verir |
| 3 | Hata | Bir hata ortaya çıkar; yapay zeka onu tam olarak işaretler |
| 4 | Geri Bildirim | Yapay zeka düzeltmeyi derinlemesine açıklar |
| 5 | Uyum | Yaklaşımınızı ayarlarsınız; yapay zeka yeniden çerçeveleyebilir |
| 6 | Tekrar | Aynı kavramı uygulayan yeni bir görev |
| 7 | Bütünleştirme | Yapay zeka bugünkü materyali daha geniş bağlama bağlar |

Döngü bir *çerçevedir*, bantlı taşıma değil. Adımlar tekrarlanabilir,
ileriye atlayabilir, hatta son turunuz kafa karışıklığı gösterdiğinde
geri adım atılabilir. Yapay zeka her gidiş-dönüşte karar verir ve
uygulamanın ilerleme çubuğu buna göre güncellenir.

[Döngü ayrıntılı](../concept/seven-steps.md)

## Yapay zeka sizi nasıl yönlendirir

Gönderdiğiniz her mesaj en fazla üç yapay zeka çağrısı tetikler:

1. **Öğrenme yanıtı** - SSE aracılığıyla token token yayınlanır.
   Asistan düşünürken satır içi imleç (▍) görürsünüz; tokenlar
   geldikçe balonun içine yerleşir ("Düşünülüyor..." yer tutucusu
   yoktur). Sistem istemi 42 hücreli bir matris (6 yöntem × 7 adım)
   üzerinden oluşturulur; bu nedenle tümdengelimli bir Girdi,
   bağlamsal bir Tekrardan çok farklı hissettirirler.
2. **Adım değerlendiricisi** - ikinci bir yapay zeka çağrısı
   alışverişi okur ve ilerlemeye hazır olup olmadığınıza karar
   verir. `advance`, `confidence`, `reason`, `suggested_step`
   yayar. Güven ≥ 0,6 olduğunda uygulama öneriyi uygular.
3. **Konu geçiş değerlendiricisi** (yalnızca adım 7'de) -
   üçüncü bir yapay zeka çağrısı konunun bütünleşip
   bütünleşmediğine karar verir. Evet VE `continue_recommended`
   ise yeni bir döngü, yeni bir alt konuyla otomatik olarak başlar
   (otomatik döngü, oturum başına en fazla 5 döngü).

Karar, gerçekten geçerli olduğunda sohbetin üzerinde ayrık
biçimde "Adım X'ten Y'ye taşındı çünkü…" bildirimi olarak
gösterilir. Döngü geçiş kartları, sohbet geçmişinde kesik kenarlı
"Döngü N" kartları olarak işlenir.

**Ses açık / kapalı** - her yapay zeka yanıtının yanındaki TTS
düğmesi (▶) onu yüksek sesle okur; giriş alanındaki bir mikrofon
düğmesi (🎤) dikte etmenizi sağlar; geçici transkriptler göndermeden
önce inceleyebilmeniz için metin alanını doldurur. Her ikisi de
Web Speech API'dir; Ayarlar → Ses bölümünden açılıp kapatılabilir.

## Döngü ilerleme göstergesi

Oturum sayfasının üstünde 7 daireli bir ilerleme şeridi bulunur.
Mevcut adım projenizin vurgu rengiyle doldurulur; geçilen adımlar
daha soluk renkte doldurulur; gelecekteki adımlar boştur.
Değerlendirici sizi ileri (veya geri!) taşıdığında şerit geçişi
görünür kılmak için animasyon yapar.

Mobilde (≤768 piksel) şerit, dikey alanı korumak için küçük
dairelerin tek yatay satırına dönüşür.

## Yöntem değişikliği önerileri

Bazen etkin yöntem tutmaz. Anlama puanınızın artmadığı ve stres
puanınızın yüksek kaldığı üç oturumun ardından uygulama bir
**MethodSwitchBanner** gösterir: "Bir sonraki oturum için [diğer
yöntem]'i denemek ister misiniz?". Kabul edin ve bir sonraki oturum
yeni yöntemle etkin biçimde başlar.

Öneri profilinizi okur ve yakın zamanda kullanmadığınız ikinci en
güçlü yönteminizi tercih eder. Başlığı kapatabilirsiniz; durağanlık
örüntüsü devam ederse geri döner.

Her iki depolama modu da (Sunucu + Yerel) yöntem değiştirme
önerilerini destekler.

## Değerlendirme + oturumu sonlandırma

Oturum sayfasında bir "Oturumu sonlandır" düğmesi bulunur. Oturum
kapanmadan önce kısa bir değerlendirme doldurursunuz: anlama,
stres ve yönteme uyum 1-5 ölçeğinde, ayrıca isteğe bağlı bir
**zengin metin notu** (TipTap: kalın, italik, listeler, sözdizimi
vurgulamalı kod blokları, bağlantılar). Not size aittir - yapay
zeka onu okumaz.

Değerlendirmeler + çok döngülü yolculuk özeti bir `ProgressCommit`
satırına dönüşür - bir oturumun Git tarzı anlık görüntüsü. Bir
oturumu tamamlamak XP kazandırır (50 taban × seri çarpanı, artı
döngü başına bonuslar), yeni kazanılan rozetleri kontrol eder ve
serinizi günceller. Bkz. [İlerleme](progress.md),
[Kontrol Paneli](dashboard.md) ve [İzleme kavramı](../concept/tracking.md).
