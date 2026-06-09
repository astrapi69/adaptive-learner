# Birden Çok İçerik Repository'si

Dersler **İçerik Repository'lerinden** gelir — yapılandırılmış ders
setlerini bir araya getiren herkese açık GitHub repolarından. Resmî
katalogla sınırlı değilsin: Adaptive Learner aynı anda birden çok
Repository yükleyebilir, kendi Repository'lerini bağlayabilir ve
küratörlü olanları önerebilir (EXP-023).

<!-- TODO: Ekran görüntüsü — Ayarlar → Veriler → İçerik Repository'leri bölümü; resmî repo + bir kendi repo -->

---

## Resmî Repository

Resmî repo
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
her zaman yüklüdür ve kaldırılamaz. Bakımı yapılan standart kataloğu
(dil kursları, Python temelleri, psikoloji ve daha fazlası) sunar.
Buradan gelen her set, İçerik Tarayıcısı'nda **Resmî** kaynak
rozetini taşır.

Ayrıca bir dizi ders doğrudan uygulamaya **gömülüdür** (Bundled),
böylece herkese açık GitHub Pages sayfası ağ bağlantısı olmadan da
hemen içerik gösterir. Bir set hem gömülü olarak hem de resmî repoda
varsa, daha yüksek sürüm kazanır; eşitlik durumunda GitHub varyantı
tercih edilir.

---

## Kendi Repository'ni bağlama

**Ayarlar → Veriler → İçerik Repository'leri** altında bir GitHub
repo URL'si eklersin. Uygulama repoyu otomatik denetler (aşağıdaki
*Trust seviyeleri*'ne bakın), ders kataloğunu senkronize eder ve
resmî içerikle aynı önbelleğe yerel olarak depolar (sunucu modunda
dosya sistemi, yalnızca tarayıcı modunda IndexedDB).

- **Manuel ve otomatik senkronizasyon.** İstediğin zaman "Şimdi
  senkronize et" düğmesine basabilirsin; ayrıca her repo her 24
  saatte bir otomatik olarak güncellenir.
- **Kaynak rozeti.** Reponun setleri İçerik Tarayıcısı'nda kendi
  kaynak rozetini taşır, böylece bir dersin nereden geldiğini her
  zaman görürsün.

---

## Birden çok Repository'yi yönetme

İstediğin kadar repo bağlayabilirsin. **Ayarlar → Veriler** altındaki
listede onları şöyle yapabilirsin:

- Repo URL'si üzerinden **ekleme**,
- **Kaldırma** (resmî repo korumalı kalır),
- **Yeniden sıralama** — sıra **önceliği** belirler. İki repo aynı
  seti taşıyorsa, daha üstte olan kazanır.

Yalnızca bir bağlı repoya sahip eski kurulumlar, otomatik olarak yeni
liste gösterimine aktarılır.

---

## Repository'leri paylaşma

Bir repoyu **derin bağlantı** ve **QR kod** ile paylaşabilirsin.
`/add-repo?...` biçimindeki bir bağlantı, alıcıda doğrudan URL'si
önceden doldurulmuş "Repository ekle" iletişim kutusunu açar; QR kod
aynısını akıllı telefonda yapar. Böylece bir kursu, manuel yazma
gerekmeden öğrenme grubunla paylaşırsın.

<!-- TODO: Ekran görüntüsü — QR kodlu paylaşma iletişim kutusu -->

---

## Trust seviyeleri

Bağlı her repo, her senkronizasyonda yeniden çalışan **otomatik bir
teknik doğrulamadan** geçer. Bundan bir Trust seviyesi doğar:

| Seviye | Anlamı |
|---|---|
| **0** | Henüz doğrulanmadı ya da denetim başarısız oldu. |
| **1** | Teknik olarak geçerli: en az bir ders, çalıştırılabilir içerik yok. |
| **3** | **Resmî olarak önerilen** — küratörlü öneri listesinden. |

Doğrulama tamamen tekniktir (yapı + güvenlik). İçeriğe/topluluğa
dayalı bir değerlendirme (Trust 2), ortak bir arka uç hizmeti
gerektirir ve şu anda ertelenmiştir.

---

## Önerilen Repository'ler

Resmî repo küratörlü bir liste (`recommended-repos.json`) tutar.
**Ayarlar → Veriler** altında buradan, önerilen Repository'leri **tek
tıkla** eklediğin bir keşfetme bölümü bulunur. Bunlar **Resmî olarak
önerilen** (Trust 3) rozetiyle görünür.

---

## Yerel değerlendirmeler

Her repoya yerel olarak **yıldız** verebilirsin. Bu değerlendirme
tamamen özeldir ve yalnızca cihazında saklanır — kendi kaynaklarını
düzenlemene yardımcı olur. Topluluk genelindeki değerlendirmeler de
ortak bir arka uç hizmeti gerektirir ve ertelenmiştir.

---

## Özel ve Coach Repository'leri

Bir repo özel olabilir (örneğin bir öğretmenden). Bunun için repo
başına bir **kişisel erişim token'ı** kaydedersin. Token yerel olarak
(localStorage) tutulur ve ayarları paylaşırken yanlışlıkla birlikte
verilmemesi için bilinçli olarak dışa aktarılabilir yapılandırmanın
**parçası değildir**.

---

## İlgili sayfalar

- [İçerik Tarayıcısı](content-browser.md) — set bulma, filtreleme, indirme
- [Ders oluşturma](../content-creation/overview.md) — kendi içeriklerini katkıla
- [Yedekleme ve geri yükleme](backup.md) — bağlı repolar snapshot'ın parçasıdır
