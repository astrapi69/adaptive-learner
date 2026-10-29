<!-- Translation: AI-generated, pending native review -->

# Mentor modu: kendi derslerini oynarken iyileştir

Bir ders için en iyi kalite denetimi, onu kendin oynamaktır: yazar
olarak yazım hatalarını, belirsiz soruları ve yanlış değerlendirilen
yanıtları tam oluştukları yerde fark edersin. Mentor modu bu oynamayı
döngüsel bir iş akışına dönüştürür: **oynarken not al, düzenleyicide
hallet** - öğrenme akışını kesmeden ve öğrenme ilerlemenden hiçbir
şey kaybetmeden.

---

## Bu hangi dersler için geçerli?

Mentor özellikleri yalnızca **kendi derslerinde** görünür - uygulamada
oluşturduğun, içe aktardığın ya da indirilmiş bir setten "Kopya olarak
düzenle" ile türettiğin setler. İndirilmiş orijinal setlerde ve sohbet
içe aktarımından gelen analiz derslerinde ders oynatıcı değişmeden
kalır; bunları düzenlemek yine "İçeriklerim" üzerinden yapılır.

---

## İş akışının üç durağı

### 1. Oynarken: mentor notları topla

Kendi dersinin her adımının altında - ister teori ister alıştırma
olsun - göze batmayan **"Mentor notu"** düğmesi bulunur. Ona dokunmak küçük
bir form açar:

- **Kategori**: sorun ne? (aşağıdaki tabloya bak)
- **Serbest metin**: tam olarak ne iyileştirilmeli?

**"Notu kaydet"** seni doğrudan öğrenme akışına geri döndürür. Zaten
bir not taşıyan bir adım bunun yerine **"Mentor notunu düzenle"**
gösterir - not istediğin zaman değiştirilebilir ya da **"Notu sil"**
ile silinebilir.

Önemli: not, dersin kendisini **değiştirmez**. Yanıtların her zamanki
gibi değerlendirilir; ilerleme ve tekrar planlaması değişmeden devam
eder.

| Kategori | Ne için |
|---|---|
| Yazım hatası | Yazım, eksik karakterler, noktalama |
| Belirsiz ifade | Soru birden çok anlama geliyor ya da kolayca yanlış okunuyor |
| Çok kolay | Alıştırma zorlamıyor (örn. fazla belirgin çeldiriciler) |
| Çok zor | Alıştırma, dersin bu noktasında fazla zorluyor |
| Yanıt yanlış değerlendirildi | Doğru bir yanıt kabul edilmiyor (ya da tersi) |
| Diğer | Geri kalan her şey - örn. yeniden yapılandırılması gereken bir teori paragrafı |

### 2. Özette: yapılacaklar listesi

Dersin sonunda özet, **"Mentor notları (n)"** bloğunu gösterir: bu
oturumdaki her not, kategorisi ve metniyle birlikte. Her satır tek
tek kaldırılabilir - örneğin bir notu yeniden düşünüp vazgeçtiğinde.

Bunun altındaki **"Bu dersi düzenleyicide düzenle"**, tam olarak bu
set ve ders önceden yüklenmiş olarak doğrudan ders düzenleyicisine
götürür. Aynı düzenleyici bağlantısı oynarken de, oynatıcının açılır
kapanır **Seçenekler** panelinde zaten bulunur - önce dersi bitirmek
yerine bir hatayı hemen düzeltmek istersen diye.

### 3. Düzenleyicide: hallet

Mentor notları taşıyan kendi derslerinden birini düzenleyicide
açtığında, yardımcının üstünde **"Bu dersin mentor notları (n)"**
paneli görünür - yapılacaklar listen, tam düzelttiğin yerde. Her not
için:

- Kategori ve metin, düzenlediğin adımların hemen yanında durur.
- Çöp kutusu simgesi bir notu tamamlandı olarak işaretler ve
  kaldırır - oynatıcı ve özetle de eşzamanlı olarak.

Öğrenme ilerlemen kararlı alıştırma kimliklerine bağlı olduğu için
tekrar kartların düzeltmelerden sağ çıkar: düzeltilmiş bir yazım
hatası ya da yeniden ifade edilmiş bir soru, hiçbir SRS geçmişini
sahipsiz bırakmaz.

---

## Yapay zeka önerileri (isteğe bağlı, kendi anahtarınla)

Düzenleyici panelindeki her not **"Yapay zeka önerisi"** düğmesini
sunar. Bu düğme, notunu etkilenen alıştırmayla birlikte
yapılandırdığın yapay zeka sağlayıcısına gönderir ve uygulama dilinde
kısa, somut bir düzeltme önerisi döndürür.

- Öneri **yalnızca görüntülenir** - derse asla otomatik olarak
  uygulanmaz. Neyi dahil edeceğine elle sen karar verirsin.
- Her yapay zeka özelliği gibi bu da bir **BYOK** özelliğidir (bring
  your own key, kendi anahtarını getir): yapılandırılmış bir anahtar
  olmadan düğme gri görünür ve Ayarlar → Yapay zeka'ya yönlendirir.
- İşe yarar bir şey gelmediğinde uygulama bunu dürüstçe söyler -
  kötü bir öneri yerine hiç öneri olmaması daha iyidir.

Teori adımlarındaki notlar için istek, alıştırma JSON'u olmadan
gönderilir; öneri bu durumda notuna ve ders başlığına dayanır.

---

## Notlar nerede saklanır

Mentor notları, cihazındaki **yerel bir yazarlık yardımcısıdır** -
paylaşılan öğrenme içeriği değildir ve cihazlar arasında senkronize
edilmez. Bunun ötesinde:

- Her iki depolama modunda da (sunucu ve tarayıcı modu) aynı şekilde
  davranırlar.
- Sayfayı yeniden yüklemekten, uygulamayı yeniden başlatmaktan ve
  derse yeniden girmekten etkilenmezler.
- Yedeğinle birlikte taşınırlar: dışa aktarma → içe aktarma, açık
  mentor notlarını da geri yükler.

---

## Neden doğrudan oynatıcıda düzenlemiyoruz?

Tasarım gereği. Çalışan oynatıcının altında değişen bir ders, sahipsiz
kalan ilerlemenin ve tutarsız değerlendirmenin klasik bir kaynağıdır.
Mentor modu bu yüzden net bir ayrım yapar: oynatıcı gözlemleri
toplar, düzenleyici içeriği değiştirir - diğer her düzenlemeyle aynı,
kanıtlanmış yazma yolu üzerinden. Hiçbir şey kaybetmezsin: düzenleyici
bağlantısı seni istediğin zaman tek dokunuşla doğru yere götürür.

---

## Pratik ipuçları

- **Öğrenen gibi oyna, mentor gibi not al.** Ciddi yanıt ver - kendi
  yanlış denemelerin, hangi alıştırmaların gerçekten pürüzlü olduğunu
  sana gösterir.
- **Kısa bir not yeterlidir.** "B çeldiricisi yanıta fazla yakın" bir
  paragraftan daha değerlidir - ayrıntıları düzenleyicide eklersin.
- **Yapılacaklar listesini boşalt.** Bir notu ancak düzeltme
  kaydedildikten sonra kaldır - böylece liste, kalan işin dürüst
  hâli olarak kalır.
- **Ardından bir kez daha oyna.** Bir düzeltmenin işe yaradığının en
  hızlı kanıtı, hatayı bulduğun aynı yoldur.
