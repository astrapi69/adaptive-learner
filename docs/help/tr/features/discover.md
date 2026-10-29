<!-- Translation: AI-generated, pending native review -->

# İçerik keşfetme

**Keşfet**, tüm kitaplıktaki yeni ders setlerini bulup indirdiğin
yerdir. **İçerik merkezindeki Keşfet sekmesi** (`/content`) olarak
yer alır; eski `/discover` bağlantısı hâlâ çalışır ve oraya
yönlendirir.

Bu ayrım bilinçlidir: **İçeriğim** yalnızca zaten indirdiklerini
gösterirken **Keşfet**, göz atıp içerik çektiğin katalogdur. Bu sayede
günlük öğrenme yüzeyin, henüz seçmediğin setlerden arınmış kalır.
**Keşfet, İçerik merkezinin varsayılan sekmesidir**, böylece ilk kez
gelen bir ziyaretçi boş bir "İçeriğim" sayfası yerine içerik bulmaya
yönlendirilir.

<!-- TODO: Ekran görüntüsü - arama/filtre çubuğu, görünüm geçişi ve set başına indirme düğmeleriyle Keşfet sekmesi -->

---

## Arama ve filtreler

Keşfet, katalog üzerinde bir **arama dizinine** dayanır. En üstte
**kompakt bir Ara/Filtrele geçiş çubuğu** bulunur: sorgu yazmak için
**Ara**'ya, kataloğu **birleştirilebilir filtrelerle** daraltmak için
**Filtrele**'ye dokun - **dil**, **seviye**, **alan**, **güven**
seviyesi ve **yapay zeka kontrollü**. Arama ve filtreler birlikte
çalışır ve çubuk kompakt kalır (yalnızca kullandığın kısmı
genişletir), böylece küçük ekranlarda sonuçları sıkıştırmaz.

Yazdıkça set başlıkları, açıklamalar, alanlar, ders başlıkları,
kartların ön ve arka yüzleri ile etiketler üzerinde anında filtreleme
yapılır. Arama, büyük/küçük harf ve aksanlara karşı toleranslıdır ve
Almanca digrafları (ae/oe/ue/ss) tanır. Dizin ilk etkileşimde,
ihtiyaç anında oluşturulur - arka uç çağrısı yoktur, her iki depolama
modunda da çalışır.

---

## Liste ve ızgara görünümü

Keşfet, *İçeriğim* ile aynı **genel içerik görünümü tercihine** uyar:
bir **görünüm geçişi**, kataloğu kompakt bir **liste** (varsayılan)
ile daha zengin bir kart **ızgarası** arasında değiştirir. Burada
yaptığın değişiklik *İçeriğim*'i de değiştirir ve seçim hatırlanır.
Bunu **Ayarlar > Genel > Görünüm** altından da ayarlayabilirsin.

---

## Set indirme

Her sonuç bir **İndir** eylemi taşır. İndirme, seti yerel önbelleğine
kopyalar (yalnızca tarayıcı modunda IndexedDB, sunucu modunda dosya
sistemi önbelleği); ardından set **İçeriğim** altında görünür ve
çevrimdışı oynatılabilir.

Her set bir **kaynak rozeti** gösterir - Resmî / Dahili, bağladığın
kendi repon ya da Resmî olarak önerilen. **Güven** filtresi (yukarıya
bak), kataloğu tek bir kaynağa ya da güven seviyesine daraltır. Kendi
kaynaklarını bağlamak ve yönetmek için
[Birden Çok İçerik Repository'si](content-repos.md) sayfasına bak.

---

## İçe aktar sekmesi

İçerik merkezi ayrıca bir sohbet dışa aktarımını ya da tek bir ders
dosyasını getirmek için bir **İçe aktar** sekmesi sunar. İçe
aktarma/oluşturma **eylem düğmeleri** ve **Derslerim** (oluşturduğun
ya da içe aktardığın dersler) de artık burada yer alır. Eski
`/import` bağlantıları buraya yönlendirir.

---

## İlgili sayfalar

- [İçerik Tarayıcısı](content-browser.md) - indirdiğin "İçeriğim"
- [Birden Çok İçerik Repository'si](content-repos.md) - kaynaklar ve güven seviyeleri
- [Dersler ve tekrarlar](../user-guide/lessons.md) - ders akışı
