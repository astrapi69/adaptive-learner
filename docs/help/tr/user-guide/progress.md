<!-- Translation: AI-generated, pending native review -->

# İlerleme

İlerleme sayfası, öğrenme verilerinizin ayrıntılı görünümüdür -
Gösterge Tablosunun özetlediği her şey, daha derine inebilmek
için grafikler ve tablolarla.

## Ne görürsünüz

Dört bölüm, yukarıdan aşağıya:

1. **Eğilim bilgileri** - ortalama anlayış, ortalama stres,
   toplam dakika, seri günleri. Gösterge Tablosunun kompakt
   bir kutucukta gösterdiği sayılar burada etiketlenmiş satırlar
   haline gelir.
2. **Yöntem dağılımı** - Gösterge Tablosuyla aynı yatay çubuk
   grafik; her yöntem için tam oturum sayısını gösteren fareyle
   üzerine gelme ipuçları ile.
3. **Adım değerlendirme bilgileri** - oturum rotasının
   ürettiği StepEvaluation satırlarından okur.
4. **Commit geçmişi** - her ProgressCommit satırı kronolojik sırada,
   en yenisi önde.

## Adım değerlendirme bilgileri

Çift istemli mimari, değerlendiricinin kararını
(`advance`, `confidence`, `suggested_step`, `fallback_used`,
`reason`) içeren her yapay zeka gidiş-dönüşü başına bir
`StepEvaluation` satırı yazar. Takip toplayıcı bunları okur
ve bakılmaya değer dört sayı üretir:

- **Toplam değerlendirme** - her yapay zeka gidiş-dönüşü her zaman
  bir tane üretir. Uzun süreli bir projede yüzlerce olacaktır.
- **Ortalama güven** - tüm değerlendirmeler genelinde. Düşük bir
  ortalama (< 0,5), yapay zekanın sizi ilerlemeye hazır olduğunuza
  nadiren emin olduğu anlamına gelir; bu genellikle materyalin
  sizin için gerçekten zor olduğunun sinyalidir. Kötü değil -
  bu bir bilgidir.
- **Tekrar sayısı** - değerlendiricinin sizi aynı adımda tutmayı
  ne sıklıkla seçtiği. Materyal yoğun olduğunda yoğun tekrar
  aşamaları normaldir.
- **Geri dönüş sayısı** - yapay zekanın JSON çıktısının
  ayrıştırılamadığı ve deterministik +1 ilerlemenin kullanıldığı
  kaç kez olduğu. Yüksek sayılar (değerlendirmelerin > %10'u)
  yapay zekanın JSON-çıktı biçimiyle mücadele ettiğini gösterir;
  genellikle bir model sorunu, sizin hatanız değil.

## Adım başına süre

Proje genelinde her döngü adımında geçirilen toplam saniyeleri
gösteren çubuk grafik. Toplayıcı 2 saatin üzerindeki boşlukları
sınırlandırır (ekrandan uzaklaştınız - gerçek öğrenme süresi
değil), böylece tek bir gece boyunca süren oturumlar baskın olmaz.

Hangi adımda en çok zaman harcadığınız çok şey anlatır. 3.
adımda (Hata) çok zaman, materyalin çok sayıda tuzağa sahip
olduğu anlamına gelir - bunu bilerek seçmiş olabilirsiniz. 1.
adımda (Girdi) çok zaman, materyalin yoğun olduğu ve yavaş
okuduğunuz anlamına gelir.

## Commit geçmişi

Her satır bir ProgressCommit'tir: yöntem, anlayış derecelendirmesi,
stres derecelendirmesi, dakika cinsinden süre, committed_at zaman
damgası, artı oturum sonu derecelendirme iletişim kutusunda yazılan
zengin metin oturum notu satır içinde işlenmiş (salt okunur TipTap).
Liste tarihe veya anlayışa göre sıralanabilir.

İşlenen notlar kalın / italik / listeler / sözdizimi vurgulu kod
blokları / bağlantılar gösterir - oturum sonu derecelendirme
iletişim kutusuna tam olarak yazıldığı şekilde. Eski düz metin
notlar değiştirilmeden aktarılır.

## Dışa aktarmalar

Ayarlar → Dışa Aktar üzerinden üç dışa aktarma türü; depolama
modları arasında tümü aynı biçimde:

- **İlerleme Raporu** - tam İlerleme sayfası Markdown veya PDF
  belgesine paketlenmiş.
- **Oturum Detayı** - tek bir oturumun dökümü + derecelendirme +
  adım değerlendirmeleri.
- **Müfredat Genel Bakışı** - tek bir müfredatın konu ağacı +
  ders özetleri.

Markdown istemci tarafında oluşturulur; PDF tarayıcının yazdırma-PDF
özelliğini kullanır (yazdırma için optimize edilmiş stil sayfasıyla
gizli bir iframe açılır, ardından `contentWindow.print()`). Harici
PDF kitaplığı yok, arka uca gidiş-dönüş yok.

## Filtreleme

Basit bir filtre şeridi şunlara göre daraltmanıza olanak tanır:

- **Yöntem** - yalnızca tümdengelimli (veya başka herhangi bir
  yöntem) kullanan commitler.
- **Tarih aralığı** - son 7 / 30 / 90 gün veya tüm zamanlar.

Filtreler dört bölümün tamamına uygulanır (eğilim bilgileri,
dağılım, adım değerlendirme toplamları, geçmiş).

## Gizlilik hatırlatması

Yerel modda İlerleme sayfası IndexedDB'den okur ve bu tarayıcıda
kalıcı hale getirdiğinizi gösterir. Sunucu modunda FastAPI arka
ucunun SQLite veritabanından okur. Her iki durumda da buradaki
hiçbir şey üçüncü taraf bir analitik hizmetine gönderilmez.
