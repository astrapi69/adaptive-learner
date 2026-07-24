# İçerik Tarayıcısı

`/content` altındaki **İçerik Tarayıcısı**, ders setlerini bulmak,
indirmek ve başlatmak için merkezi başvuru noktandır. Öğrenme
akışına göre kurgulanmıştır: önce arama, sonra devam etme, ardından
katalog.

<!-- TODO: Ekran görüntüsü - Arama alanı, devam-etme bölümü ve set ağacıyla İçerik Tarayıcısı -->

---

## Arama

En üstte **tam genişlikte bir arama alanı** bulunur. Set başlıkları,
açıklamalar, alan, ders başlıkları, kartların ön ve arka yüzleri ile
etiketler üzerinde anında filtreleme yapar (geri sektirmeli, yerel
olarak önbelleğe alınmış kataloğa karşı). Arama, büyük/küçük harf ve
aksanlara karşı **toleranslıdır** ve Almanca digrafları (ae/oe/ue/ss)
tanır. Eşleşmeler, vurgulama, eşleşme sayısı ve boş durumla birlikte
katalog ağacının yerini alır. `Cmd/Ctrl + K` doğrudan arama alanına
atlar.

---

## Devam etme

Aramanın hemen altında **Devam etme**, set başına en son dokunulan
dersi gösterir; her birinde tam olarak bir eylem vardır:
**sürdür** (devam eden/duraklatılmış ders, n. adım / toplam),
bir tamamlamadan sonra yıldızlarıyla birlikte **sonraki** ders, ya da
**set tamamlandı**.

---

## Diller ve Bilgi

Katalog iki ağaca ayrılır:

- **Diller** - *Kaynak dil → Hedef dil → Seviye* ağacı olarak,
  uygulama diline göre filtrelenir (ek kaynak dilleri Ayarlar →
  Öğrenme altında etkinleştirebilirsin).
- **Bilgi** - kendi simgeleriyle dil-dışı alanlar (örn.
  programlama, psikoloji).

---

## Kaynak Rozetleri ve Kaynak Filtresi

İndirilen her set, nereden geldiğini gösteren bir **kaynak rozeti**
taşır:

- **Resmî** / **Bundled** - resmî katalogdan ya da uygulamaya gömülü.
- **Kendi repom** - bağladığın bir Repository'den.
- **Resmî olarak önerilen** - küratörlü öneri listesinden.

Bir **kaynak filtresi**, gerektiğinde yalnızca belirli bir kaynaktan
gelen setleri gösterir. Daha fazlası için
[Birden Çok İçerik Repository'si](content-repos.md).

---

## Kitap önerileri

Katalog bir alan için önerilen kitaplar tutuyorsa (`books.yaml`),
İçerik Tarayıcısı bunları ilgili alana ait **ileri okuma** olarak
gösterir. Bu, her iki depolama modunda da çalışır ve bir arka uca
ihtiyaç duymaz. Format ve bakım:
[Kitap önerileri](../content-creation/books.md).

---

## Subject filtresi

Öğrenme projelerine Subject (uzmanlık alanı) atadıysan,
**Dashboard** yalnızca **kendi** Subject'lerini listeleyen (hiç
yoksa gizlenir), **en sık kullanıma** göre sıralayan ve beşten fazla
girişten itibaren kategoriye göre gruplayan bir Subject filtresi
gösterir.

---

## Derslerim

Kendin oluşturduğun veya içe aktardığın dersler **Derslerim**
bölümünde oynatma, düzenleme, silme, dışa aktarma ve paylaşma
eylemleriyle görünür. Kendi derslerini nasıl oluşturacağını
[Ders oluşturma](../content-creation/overview.md) altında bulabilirsin.

---

## İlgili sayfalar

- [Dersler ve tekrarlar](../user-guide/lessons.md) - ders akışı
- [Birden Çok İçerik Repository'si](content-repos.md) - kaynakları bağlama ve yönetme
- [Derslerim](../user-guide/my-lessons.md)
