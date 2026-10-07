<!-- Translation: AI-generated, pending native review -->

# Portu değiştirme (ve verilerini koruma)

Masaüstü başlatıcısı, Adaptive Learner'ın çalıştığı portu
değiştirmene izin verir (varsayılan **8501**'dir). Bu, başka bir
uygulama o portu zaten kullanıyorsa işe yarar - ancak bunu yapmadan
önce bilmeye değer bir sonucu vardır.

## Port verilerin için neden önemli

Bir web uygulamasının depolaması, port dahil tam web adresine
bağlıdır. `http://localhost:8501` ve `http://localhost:8502`,
tarayıcın açısından iki **farklı** adrestir ve her biri kendi ayrı
depolamasını alır.

Bunun pratikte ne anlama geldiği, Adaptive Learner'ı nasıl
çalıştırdığına bağlıdır:

- **Sunucu modu** (masaüstü başlatıcısı için varsayılan). Setlerin,
  derslerin ve ilerlemen tarayıcıda değil, uygulamanın kendi arka
  ucunda bulunur. Port değişikliğinden **etkilenmezler** - uygulama
  onları yeni adreste otomatik olarak yeniden bulur.
- **Tarayıcı depolama modu** (*Ayarlar > Genel > Depolama modu*
  altında açabileceğin seçenek ve herkese açık web sürümünün
  kullandığı mod). Setlerin, ilerlemen ve kendi yazdığın
  alıştırmalar, geçerli adrese bağlı olarak **tarayıcıda** bulunur.
  Port değişikliğinden sonra uygulama yeni adreste boş tarayıcı
  depolamasıyla açılır, bu yüzden sıfırdan bir başlangıç gibi
  görünür. **Verilerin silinmez** - hâlâ önceki portun altında
  saklanır, yalnızca yenisinde görünmez.

## Verilerini yeni porta taşı

Tarayıcı depolama modunu kullanıyorsan ve portu zaten
değiştirdiysen, verilerin eski adreste bekliyor. Onları bir yedekle
taşı:

1. **Önceki porta geri dön** (örneğin `http://localhost:8501`).
   Verilerin yeniden görünür.
2. **Ayarlar > Veri > Yedek oluştur** yolunu izle ve `.alb`
   dosyasını kaydet.
3. **Yeni porta** geç.
4. Karşılama ekranında **Mevcut yedekten geri yükle**'yi seç ve `.alb`
   dosyasını belirle. Her şey - setler, ilerleme, alıştırmalar ve
   ayarların - geri yüklenir.

Yedekler hakkında daha fazlası için
[Yedekleme ve geri yükleme](../features/backup.md) sayfasına bak.

## Sürprizden kaçın: önce yedek al

En güvenli alışkanlık, **portu değiştirmeden önce bir yedek dışa
aktarmaktır**; böylece bir şey eksik çıkarsa onu yeni adreste geri
yükleyebilirsin. Düzenli bir yedek genel olarak da iyi bir
sigortadır - öğrenmeni cihazlar arasında taşımanı da sağlar.

## Portu değiştirmek uygulamayı ağa açmaz

Hangi portu seçersen seç, uygulama yalnızca `127.0.0.1` üzerinde
dinlemeye devam eder - bu bilgisayardan erişilebilir, diğer
cihazlardan değil. Bir oturum açma özelliği yoktur, bu yüzden ona
telefonundan ya da başka bir makineden erişmek ayrı, bilinçli bir
adımdır (`ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0`) ve yalnızca
güvendiğin bir ağda mantıklıdır - bkz.
[Masaüstü başlatıcısını çalıştırma](launcher.md) ("Uygulamaya kimler erişebilir").
