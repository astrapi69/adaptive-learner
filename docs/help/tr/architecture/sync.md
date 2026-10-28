# Sync mimarisi

Adaptive Learner yerel-önceliklidir. Sunucu depolama modunda (dahili
adı API) öğrenme verilerini masaüstü uygulamasının arka ucu kaydeder;
bu sırada tarayıcıda yalnızca az şey kalır, örneğin bazı ayarlar ve,
aktarılana kadar, çevrimdışı kaydedilen değişiklikler (bkz.
[Ayarlar](../user-guide/settings.md)). Dahili adı Dexie olan Yerel
(Tarayıcı) depolama modunda veriler, uygulamanın çalıştığı tarayıcının
IndexedDB'sinde bulunur. **Senkronizasyonun** ileride cihazları yerel
ağ üzerinden bağlaması planlanıyor; henüz kullanılabilir değil (bkz.
aşağıdaki SYNC-UI-GATE bölümü). Eksiksiz referans
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
içinde bulunur.

---

## Üç cihaz rolü

Sync arayüzü, cihazın rolüne göre farklı planlanmıştır:

| Rol | Depolama modu | Sync arayüzü |
|---|---|---|
| Masaüstü (Sunucu) | API | QR üret, durum, "Şimdi senkronize et" |
| Mobil (İstemci) | Dexie | QR tara / bağlantı yapıştır, eşleştirme sonrası durum |
| Yalnızca-PWA | Dexie | yok |

---

## SYNC-UI-GATE: ilke ve bugünkü durum

İlke şudur: yalnızca çalışanı göster. LAN modu (Aşama 1) yalnızca
kısmen uygulandı ve henüz kullanılabilir değil. Eşleştirme
görünümlerinden şu ana kadar yalnızca eşleştirme bağlantısı oluşturan
görünüme erişilebilir, ona da yalnızca masaüstü uygulamasının Sunucu
depolama modunda; bağlantıyı başka bir cihazda kullanan görünüm
(bağlantıyı yapıştırma, QR kodunu tarama) bilerek kapatılmıştır. Gate
depolama moduna göre belirlenir:

- Yalnızca masaüstü uygulamasında bulunan **Sunucu** depolama modunda
  (dahili adı API), *Ayarlar > Veri > Eşitleme* bölümü yalnızca bir
  eşleştirme bağlantısı oluşturmayı sunar: Host ve port için giriş
  alanlarını ve "Eşleştirme kodu oluştur" düğmesini gösterir; düğmeye
  tıklandıktan sonra bir QR kodu, eşleştirme bağlantısı ve bir
  kopyalama düğmesi görünür.
- Dahili adı Dexie olan **Yerel (Tarayıcı)** depolama modunda bölüm
  görünür kalır, ancak denetimler yerine "Yalnızca masaüstü
  uygulamasıyla kullanılabilir." bildirimini gösterir. Tarayıcı sürümü,
  yüklenmiş web uygulaması (PWA) olarak da, bu depolama modunu her
  zaman kullanır; masaüstü uygulamasında da seçilebilir. Yalnızca
  masaüstü uygulamasının arka ucuyla çalışan işlevler #335/#336'dan bu
  yana gizlenmek yerine bir bildirimle devre dışı bırakılır;
  senkronizasyonun devre dışı olup olmadığına burada uygulamanın türü
  değil, depolama modu karar verir.
- Bağlantıyı kullanan görünüm yalnızca bölümün devre dışı olduğu Yerel
  (Tarayıcı) depolama modunda görünürdü; bu yüzden hiçbir zaman
  görünmez.

Hiçbir cihaz eşleştirilemediği için eşleştirilmiş bir cihazın görünümü
de görünmez, dolayısıyla onun "Şimdi Senkronize Et" düğmesi de
görünmez; senkronizasyon hiçbir veri alışverişi yapmaz.

Eşitleme bölümü bugün ilkeden, başka noktaların yanı sıra şu
noktalarda sapar:

- Bölümün "Cihazları eşleştir ve verileri güncel tut." açıklaması
  eşleştirmeyi ve verilerin güncel tutulmasını vaat eder; ikisi de
  henüz yoktur.
- Sunucu depolama modunda masaüstü uygulaması, henüz hiçbir cihazın
  kullanamadığı bir eşleştirme bağlantısı oluşturmayı sunar.
- "Yalnızca masaüstü uygulamasıyla kullanılabilir." bildirimi, onunla
  da henüz senkronizasyon yapılamayan masaüstü uygulamasını işaret
  eder; masaüstü uygulamasının kendisinde, Yerel (Tarayıcı) depolama
  modunda görünür.

LAN modu uygulandığında ikili gate'in (API'ye karşı Dexie) yukarıdaki
tablodaki üç değerli gate'e dönüşmesi planlanıyor. Bağlantıyı kullanan
görünümün ancak bu gate ile yeniden açılması planlanıyor. İkili gate
hâlâ geçerliyken açılsaydı, Yerel (Tarayıcı) depolama modundaki her
cihazda görünürdü, çünkü bu gate "Mobil (İstemci)" ve "Yalnızca-PWA"
rollerini ayırt etmez. Orada ölü bir kontrol öğesi olurdu: LAN modu
uygulanmadığı sürece bu cihazların her birinde, uygulandıktan sonra da
ikili gate geçerli olduğu sürece "Yalnızca-PWA" rolündeki cihazlarda.

---

## İlgili sayfalar

- [Storage katmanı](../developer/storage-layer.md) - ikili depolama soyutlaması
- [Yedekleme ve geri yükleme](../features/backup.md) - Sync olmadan manuel veri aktarımı
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
