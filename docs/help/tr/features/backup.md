# Yedekleme ve geri yükleme

Adaptive Learner, tüm öğrenme durumunu tek bir dosyaya yedekleyebilir
ve başka bir cihazda, yeni bir kurulumda ya da bir tarayıcı
değişikliğinden sonra geri yükleyebilir. Her şeyi **Ayarlar →
Veriler** altında bulursun.

<!-- TODO: Ekran görüntüsü - Ayarlar → Veriler, "Yedek oluştur" ve "Geri yükle" düğmeleriyle -->

---

## Yedekte ne var

Bir yedek, **eksiksiz bir snapshot'tır**: 30 veri tablosunun tümü
(öğrenme projeleri, oturumlar, ders ilerlemesi, öğe düzeyinde
hatalar, XP/Streak/Badge ile gamification, görevler, Anki kartları,
notlar ve daha fazlası) **artı indirdiğin İçerik Setlerin**. Önemli
hiçbir şey geride kalmaz.

Dışa aktarmadan önce uygulama, kaydetmeden önce neyin yedekleneceğini
görmen için bölüm başına veri kümesi sayılarıyla bir **"Yedeğin
şunları içeriyor…"** önizlemesi gösterir.

---

## Yedek oluşturma

1. **Ayarlar → Veriler**'i aç.
2. **Yedek oluştur**'a bas.
3. Yalnızca tarayıcı modunda, File System Access API üzerinden
   doğrudan bir kayıt konumu seçebilirsin ("Diske kaydet"); tarayıcı
   bunu desteklemiyorsa uygulama dosyayı bunun yerine indirir.

**Otomatik yedek:** İsteğe bağlı olarak uygulama, hiçbir zaman
yedeksiz kalmaman için son snapshot'lardan oluşan döngüsel bir halka
tutar.

---

## Geri yükleme

1. **Ayarlar → Veriler → Geri yükle**.
2. Yedek dosyasını seç.
3. Uygulama her tabloyu içe aktarır ve neyin yüklendiğini tam olarak
   görmen için **tablo başına bir özete** (eklendi / güncellendi /
   atlandı) yukarı kaydırır.

İçe aktarmada bir şey ters giderse, kendiliğinden kaybolmayan
**kalıcı bir hata uyarısı** (Toast) görünür - böylece hiçbir hatayı
gözden kaçırmazsın. Geliştirici modunda (Ayarlar → Arayüz), mesaj bir
GitHub Issue için teknik ayrıntıları içerir.

---

## Cross-Identity içe aktarma

Aynı cihazda aynı kullanıcı olmana **gerek yoktur**. Bir yedek, bir
**yeni kuruluma** ya da **başka bir kullanıcı profili** altına içe
aktarılabilir. Geri yükleme, verileri aktif profile atar ve bu
sırada dahili referansları (yabancı anahtarları) temiz biçimde
yeniden çözer, böylece ilerlemen bütünlüğünü korur - ders adım
ilerlemesi, Streak ve Badge'ler dahil.

---

## İlk girişte yedek

Uygulamayı yeniden başlattığında (ya da bir cihazda ilk kez)
Adaptive Learner, boş bir durumla başlamak yerine mevcut bir yedeği
yüklemeyi aktif olarak önerir. Böylece bir cihaz veya tarayıcı
değişikliğinden sonra öğrenme akışına hemen geri dönersin.

---

## Her iki depolama modu

Yedekleme ve geri yükleme **her iki** depolama modunda da çalışır -
sunucu (API) ve yalnızca tarayıcı (Dexie/IndexedDB). Format tek bir
JSON dosyasıdır; özel bir arşiv formatı yoktur.

!!! note "Gizlilik"
    Yedek tamamen senin elinde kalır. Yalnızca koyduğun yere
    kaydedilir - hiçbir şey bir sunucuya gönderilmez.

---

## İlgili sayfalar

- [Ayarlar](../user-guide/settings.md) - tüm veri eylemlerine genel bakış
- [Birden Çok İçerik Repository'si](content-repos.md) - bağlı repolar snapshot'ın parçasıdır
