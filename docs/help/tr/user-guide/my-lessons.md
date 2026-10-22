<!-- Translation: AI-generated, pending native review -->

# Derslerim: oluştur, kaydet, paylaş

**Derslerim**, *sizin* oluşturduğunuz derslerdir - indirilen
içerik setleriyle aynı çevrimdışı oynanabilir biçime dönüştürülmüş.
Analiz edilmiş bir sohbetten ders oluşturabilir, iyi bir uyarlamalı
dersi tekrar oynatmak için kaydedebilir, bir dersi başkasıyla
paylaşmak üzere dışa aktarabilir ve başkalarının paylaştığı dersleri
içe aktarabilirsiniz. Her şey çevrimdışı çalışır; hiçbir şey
sunucuya yüklenmez.

Derslerimi, indirilen setlerin üzerinde **Set Tarayıcısı**'nın
(`/content`) en üstünde bulabilirsiniz.

---

## Sohbet analizinden ders oluşturma

1. Bir sohbet içe aktarın ve **Analiz Edin** (bkz. *İçe Aktarma*).
2. Analiz sonucunda **Çevrimdışı Ders Olarak Kaydet**'e tıklayın.
3. Bir önizleme dersin yapısını gösterir - kaç alıştırma ve teori
   adımı olduğunu, tahmini süreyi. İsterseniz başlığı ayarlayın.
4. **Kaydet**'e tıklayın. Ders **Derslerim** altında görünür.

Ders, analizin bulduklarından oluşturulur:

- Konu, özet, alt konular, güçlü ve zayıf yönleriniz, yaygın
  hata kalıpları ve önerilen müfredattan **Teori**.
- Çıkarılan kelime hazinesinden **Alıştırmalar** - her kelimeden
  eşleştirme ve çeviriyi yazma, artı örnek cümlelerden boşluk
  doldurma ve kelime sıralama alıştırmaları.

Analiz ne kadar zenginse (özellikle örnek cümleli kelime hazinesi),
ders de o kadar zengin olur. Yeterli kelime hazinesi öğesi yoksa,
**yalnızca teori çalışma kılavuzu** ve daha fazla pratik materyali
için daha uzun bir sohbet içe aktarmanızı öneren bir ipucu alırsınız.

Oluşturulan dersler, indirilen bir ders gibi tam puanlama ile normal
ders görüntüleyicisinde oynatılır.

---

## Oynat, düzenle, sil

Her Dersim şunlara sahiptir:

- **Oynat** - ders görüntüleyicide açın.
- **Düzenle** - dersin meta verileri, kartları ve alıştırmalarıyla
  **önceden doldurulmuş ders oluşturma sihirbazını** açar. Kendi
  setlerinizden biri **birden çok ders** içeriyorsa, önce bir
  **ders seçici** hangisini düzenlemek istediğinizi sorar. Kitap
  metni dersleri doğrudan alıştırma düzenleyicisini açar; eklenmiş
  kitap bilgileri korunur. Kaydederken seçim yaparsınız:
  **Değişiklikleri kaydet** (aynı dersin üzerine yazar; değişmeyen
  kartların öğrenme ilerlemesi korunur, değişenler sıfırdan başlar)
  ya da **Kopya olarak kaydet** (yeni bir ders oluşturur, orijinal
  dokunulmadan kalır). Analiz tabanlı dersler yine temelindeki
  sohbet analizini açar. İndirilen yabancı dersler salt okunur
  kalır.
- **Sil** - kaldırın (onay ile birlikte).

---

## Uyarlamalı ders kaydetme

**Uyarlamalı bir dersi** tamamladığınızda özette **Bu dersi
kaydet?** düğmesi görünür. Kaydetmek, Derslerimden daha sonra
tekrar oynatmanız için bir anlık görüntü tutar - özellikle
yararlı çıkan bir uyarlamalı oturumda kullanışlıdır. Anlık
görüntü, uyarlamalı oluşturucu sonraki bir sürümde değişse bile
oynanabilir kalır.

---

## Dışa aktarma ve paylaşma

Her Dersim paylaşılabilir. Dışa aktarma için hesap gerekmez; topluluğa
pull request için bir GitHub hesabı gerekir. Bir GitHub token'ı pull
request'i hızlandırır ve bütün bir seti kendi deponuz olarak paylaşmak
için gereklidir:

- **Dışa aktar** - dersi tek bir `.json` dosyası olarak indirin.
- **Set olarak dışa aktar** - bir içerik seti `.zip`'i
  (manifest + dersler) indirin.
- **Toplulukla paylaş** - resmi içerik deposunda bir **pull request**
  açar. Dersin JSON'u içerik ağacında doğru yola yerleşir ve deponun
  doğrulaması otomatik olarak çalışır; bir bakımcı PR'ı inceler ve
  birleştirir, böylece herkes dersi indirebilir. Pull request iki
  yoldan biriyle oluşturulur:
    - **Token olmadan** - tek bir ders, GitHub'ın dosya düzenleyicisini
      doğru yolda açar; PR başlığı ve açıklaması önceden doldurulmuştur.
      Küçük bir ders içeriğini de birlikte getirir; daha büyük bir dersi
      uygulama önce indirir ve siz onu düzenleyiciye yapıştırırsınız.
      Birden çok dersli bir set dosyaları indirir ve GitHub'ın yükleme
      sayfasını açar; dosyaları oraya sürüklersiniz. Siz orada
      onayladığınızda GitHub fork'u ve pull request'i oluşturur.
    - **GitHub token'ı ile** (Ayarlar > Entegrasyonlar, bkz.
      [Ayarlar](settings.md)) - tek bir dersi uygulamadan çıkmadan
      paylaşırsınız: uygulama depoyu fork'lar, dersi commit eder, pull
      request'i açar ve ardından size bağlantısını gösterir. Birden çok
      dersli bir set yine token'sız yolu izler. GitHub token'ı
      reddederse mesaj sizi Ayarlar > Entegrasyonlar'a yönlendirir.
- **Depo olarak paylaş** - bütün seti, içerik deposu biçiminde, tek bir
  commit ile size ait bir GitHub deposuna gönderir (depo henüz yoksa
  oluşturulur). Depoyu (`owner/name`), özel mi herkese açık mı olacağını
  ve dalı siz seçersiniz. Önce bir kalite denetimi çalışır: bir içerik
  deposunun denetimlerinin reddedeceği sorunlar bulursa bunları
  listeler ve düğme **Yine de dışa aktar** olur. Gönderilen depoyu
  ardından içerik kaynağı olarak bağlayabilirsiniz (bkz.
  [Birden Çok İçerik Repository'si](../features/content-repos.md)).
  Bunun için bir GitHub token'ı gerekir ve yalnızca uygulamanın
  tarayıcı sürümünde kullanılabilir; aksi halde düğme görünür kalır ama
  devre dışıdır, nedeni araç ipucunda yazar.

Dışa aktarılan dosyalar yalnızca ders içeriğini içerir - ilerleme,
hata geçmişi, hiçbir kişisel şey yoktur.

---

## Ders içe aktarma

**Ders İçe Aktar**'a tıklayın, bir `.json` dersi veya `.zip` seti
seçin ve uygulama doğrulayıp bir önizleme gösterir. Derslerrime
eklemek için onaylayın. Dosya geçersizse bozuk bir içe aktarma
yerine belirli bir neden göreceksiniz.

Bu döngüyü kapatır: bir öğrenci bir dersi dışa aktarır, bir diğeri
içe aktarıp oynatır - tamamen çevrimdışı.
