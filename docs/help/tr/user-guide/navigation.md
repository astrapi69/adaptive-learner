<!-- Translation: AI-generated, pending native review -->

# Gezinme

Uygulamanın ana gezinmesi, küçük bir **gruplanmış girdiler** kümesidir
(EXP-037, Nielsen-Norman'ın "5-7 öğe" önerisine göre) ve **hiçbir
işlev kaybı yoktur** - her sayfaya ulaşılabilir ve eski bağlantılar
yönlendirmeler sayesinde çalışmaya devam eder.

<!-- TODO: Ekran görüntüsü - gruplanmış ana gezinme ve mobil alt sekme çubuğu -->

---

## Masaüstü: gruplanmış girdiler

Masaüstü gezinmesi, yeniden kullanılabilir bir `NavGroup` bileşeni
aracılığıyla etiketli gruplar halinde düzenlenmiştir:

- **Öğren** - Pano, Öğrenme yolu ve Oturum.
- **İçerik** - dört sekmeli **İçerik merkezi** (`/content`):
  *Keşfet* (katalog), *İçeriğim* (indirdiklerin), *İçe aktar* ve
  *Oluştur* (kendine ait yeni bir ders). Merkez, sıralamandaki ilk
  sekmede açılır; varsayılan olarak bu Keşfet'tir. Sırayı
  *Ayarlar > Genel > Görünüm* altında değiştirebilirsin.
- **İlerleme** - Genel bakış, İstatistikler ve Yollarım sekmeleriyle
  **ProgressHub** (`/progress`).
- **Ayarlar** ve **Yardım** çubuğu tamamlar.

Anki kendi başına bir girdi değildir; İçerik sayfasında bir eylemdir ve
`/anki` rotası çalışmaya devam eder.

### Görüntü alanı başına tek ana gezinme

Masaüstü genişliklerinde yatay üst çubuk **tek** ana gezinmedir -
hamburger düğmesi ve çekmece yoktur. Dar / mobil genişliklerde aynı
gruplanmış girdiler bir **hamburger çekmecesinin** arkasına taşınır.
Her iki sunum da tek bir ortak hedef listesinden oluşturulur; bu yüzden
her zaman aynı sayfalara götürür. Etkin öğe `aria-current` taşır, her
hedef en az 44px'tir ve tüm temalarda çalışır. (Ayarlar sayfasının
kendi sekmeleri için ayrı bir bölüm kenar çubuğu vardır - bunun ana
gezinmeyle ilgisi yoktur.)

---

## Mobil: alt sekme çubuğu (isteğe bağlı)

Telefonda gezinme varsayılan olarak üstte bir menü düğmesi olarak
durur. *Ayarlar > Genel > Arayüz* altında **Menü konumu (mobil)** onu
**Altta (sekme çubuğu)** konumuna geçirir: başparmak dostu beş sekmeli
bir çubuk - **Öğren / İçerik / Öğrenme yolu / İlerleme / Daha fazla**.
*Daha fazla*, Ayarlar ve Yardım içeren bir alt sayfa açar. Hamburger
çekmecesi her iki konumda da kullanılabilir kalır. Hedefler 44px'tir,
çubuk tüm temalara uyar ve hiçbir şey içeriği örtmesin diye onboarding
akışında ve bir ders sırasında gizlenir.

---

## Merkezler ve yönlendirmeler

İki sayfa, yalnızca etkin sekmeyi yükleyen **sekmeli merkezlerdir**:

- **ProgressHub** (`/progress`) İlerleme + Öğrenme İstatistikleri +
  Müfredat'ı içerir.
- **İçerik merkezi** (`/content`) Keşfet + İçeriğim + İçe aktar +
  Oluştur'u içerir.

Eski URL'ler yönlendirmelerle korunur, örn. `/statistics` →
`/progress?tab=stats`, `/curriculum` → `/progress?tab=paths`,
`/discover` → `/content?tab=discover`, `/import` →
`/content?tab=import`.

---

## İlgili sayfalar

- [İlerleme](progress.md) - ProgressHub sekmeleri
- [İçerik tarayıcısı](../features/content-browser.md) - İçeriğim
- [İçerik keşfet](../features/discover.md) - katalog
