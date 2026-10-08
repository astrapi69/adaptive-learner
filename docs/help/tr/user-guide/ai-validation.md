<!-- Translation: AI-generated, pending native review -->

# Yapay zekâ içerik denetimi

Adaptive Learner, indirilmiş bir ders setini **isteğe bağlı olarak bir
yapay zekâya inceletebilir** (EXP-033). Yapay zekâ setin kartlarını
çeviri, dil bilgisi ve seviye sorunları açısından tarar ve bulduklarını
bildirir - hiçbir şeyi engellemez, yalnızca tavsiyede bulunur. Bundan
ayrı olarak depolar, bir bakışta okuyabileceğin bir **güven seviyesi**
taşır.

<!-- TODO: Ekran görüntüsü - İçerik tarayıcısı, "Yapay zekâ ile denetle" düğmesi + "Yapay zekâ denetimli" rozetiyle set kartı -->

---

## Depo güven seviyeleri

Her ders seti, İçerik tarayıcısında güven seviyesi içeren bir kaynak
rozeti gösterir. Bu rozet içerik kalitesiyle değil, **kökenle**
ilgilidir:

- **Güven 0 - doğrulanmamış.** Otomatik denetimi (henüz) geçmemiş,
  yeni bağlanmış bir depo.
- **Güven 1 - teknik olarak doğrulanmış.** Depo en az bir ders içerir
  ve çalıştırılabilir kod içermez. Denetim her eşitlemede yeniden
  çalışır.
- **Güven 3 - resmî olarak önerilen.** Resmî öneri listesinden, özenle
  seçilmiş bir depo.

Topluluk değerlendirmeleri (Güven 2) ve merkezi bir dizin henüz
uygulanmadı.

---

## Yapay zekâ denetimi için ön koşullar

Yapay zekâ denetimi, bir yapay zekâ sağlayıcısını doğrudan tarayıcıdan
çağırır. Şunlara ihtiyacın var:

- sağlayıcılardan biri (Anthropic, OpenAI veya Gemini) için **kayıtlı
  bir API anahtarı** (Ayarlar > Yapay zeka);
- **tarayıcı modu** (Dexie) - denetim doğrudan tarayıcıdan çalışır;
- **indirilmiş bir set** (denetim, yerel olarak önbelleğe alınmış
  kartlar üzerinde çalışır).

Anahtar olmadan düğme görünür ama devre dışıdır; bir bildirim
Ayarlar'a bağlantı verir.

> **Maliyet:** denetim, kendi sağlayıcı hesabında token harcar ve o
> sağlayıcının ücretleriyle faturalandırılır. Başlamadan önce iletişim
> kutusu, onaylaman gereken bir **maliyet tahmini** gösterir.

---

## Bir seti denetle - adım adım

1. **İçerik tarayıcısını** aç ve indirilmiş bir set seç.
2. **"Yapay zekâ ile denetle"** düğmesine tıkla.
3. İletişim kutusu bir **maliyet tahmini** gösterir. Çalıştırmayı
   başlatmak için onu onayla.
4. Kartlar **gruplar** halinde denetlenir; bir ilerleme çubuğu bunu
   izler ve istediğin zaman **iptal** edebilirsin.
5. Sonunda **kart başına bir rapor** alırsın: yalnızca bulgu içeren
   kartlar listelenir, her biri ait olduğu ders ve yapay zekânın notuyla
   birlikte.

Yanlışlıkla iki kez faturalandırılmaman için iki çalıştırma arasında
kısa bir **bekleme süresi** (yaklaşık bir dakika) vardır.

---

## Önerileri uygula (kendi setlerin)

Kendi setlerini **İçerik > İçeriğim** altında denetlersin: oradaki her
set satırı aynı **Yapay zekâ ile denetle** düğmesini taşır. Kendin
oluşturduğun bir set için rapor **Önerileri uygula** düğmesini taşır.
Bu düğme, bir kart alanını (ön yüz, arka yüz, notlar) adlandıran her
öneri için bir satır içeren bir tablo açar: ders, kart, alan, mevcut
değer ve önerilen değer. Her satır işaretlidir; değer yerine açıklama
olanların işaretini kaldır. Uygulanabilir bir değeri olmayan bulgular
yalnızca sayılır, asla yazılmaz. Onay düğmesi, değiştireceği alan ve
kart sayısını belirtir.

Yazma işlemi düzenleyiciyle aynı yolu kullanır: tüm dersleriyle
birlikte setin tamamı; böylece başlık, diller, seviye ve açıklama
korunur, kart kimlikleri değişmez ve öğrenme ilerlemen korunur. Önceki
değerler kaydedilir ve **Son uygulamayı geri al** onları geri getirir.
Bir uygulamadan sonra kayıtlı rapor güncelliğini yitirir ve atılır;
yeni bir sonuç istediğinde seti yeniden denetle. İndirilmiş setlerde
düğme, yalnızca kendi derslerin için geçerli olduğunu belirten bir
notla devre dışıdır.

## Rapor, önbellek ve "Yapay zekâ denetimli" rozeti

- **Önbelleğe alınır.** Rapor yerel olarak (IndexedDB) saklanır ve bir
  sonraki sefer yeniden ödeme yapmadan tekrar gösterilir. Bir içerik
  karması ve bir imza taşır; böylece değişmiş bir set için yeni bir
  denetim önerilir.
- **Dışa aktarılabilir.** Raporu **Markdown** olarak indirebilirsin -
  bir ders revizyonuna ya da bir sorun kaydına yapıştırmak için
  kullanışlıdır.
- **Rozet.** Denetlenmiş bir set, bir denetimin var olduğunu görebilmen
  için İçerik tarayıcısında **"Yapay zekâ denetimli"** rozeti gösterir.

Yapay zekâ **tavsiye niteliğindedir**: olası sorunları vurgular ama bir
seti öğrenmeni, düzenlemeni ya da paylaşmanı asla engellemez. Karar
senindir.

---

Bunun arka planda nasıl çalıştığını öğrenmek için
[Yapay zekâ entegrasyonu](../developer/ai-integration.md) hakkındaki
geliştirici belgelerine bak.
