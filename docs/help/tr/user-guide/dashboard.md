<!-- Translation: AI-generated, pending native review -->

# Kontrol Paneli

Kontrol Paneli ana merkezinizdir. Birden fazla veri dilimini tek
bir görünümde sunar: bir öğrenci olarak kim olduğunuz (profil +
XP + rozetler), şu anda nasıl gittiği (seri ısı haritası + oturum
sayacı), neler yaptığınız (son oturumlar + yöntem dağılımı) ve
sırada ne yapacağınız (araç + aralıklı öneriler).

En üstte **Konular + Etiketler filtre çubuğu** bulunur - bir konu
(ör. Diller → İspanyolca) veya bir etiket seçerek aşağıdaki tüm
widget'ları o sınıflandırmaya sahip projelere kısıtlayabilirsiniz.
Filtreler URL sorgu parametreleri aracılığıyla paylaşılabilir.

## Profil radar grafiği

Üstteki radar grafiği, değerlendirmeden elde edilen 6 yöntemli
profilinizi gösterir. Değerlendirme sonrası Değerlendirme sayfasındaki
grafikle aynı şekil. Baskın yöntem grafiğin altında renkli bir
rozet olarak vurgulanır.

Değerlendirmeyi henüz yapmadıysanız radar sıfır şekli gösterir
ve Değerlendirme sayfasına bağlantı verir.

## XP + Seri + Rozetler

- **XP widget'ı** - mevcut seviye + toplam XP + sonraki seviyeye
  ilerleme çubuğu. Seviyeler üstel bir eğriyi izler
  (`threshold(n) = 50 * n * (n - 1)`); 1-5 seviyeleri 0 / 100 /
  300 / 600 / 1000 XP'dedir. Sonlanan her oturum için 50 temel
  XP, ayrıca döngü başına bonuslar + ilk yöntem bonusu + seri
  çarpanı (7 günlük seride 2,75×'e kadar).
- **Seri ısı haritası** (GitHub tarzı) - haftalık sütunlarda
  365 günlük etkinlik Pzt..Paz. `var(--accent)` üzerinde
  `color-mix` ile beş katman rengi. Cumartesi/Pazar boşluklarını
  atlamak için Ayarlar'da hafta sonu modunu açın; dondurma stoğu
  (her 7 seri gününde 1, maks 3), kaçırılan bir hafta içi günde
  sıfırlamak yerine duraklatır.
- **Rozet vitrini** - 5 kategoride 24 rozet (getting_started 3,
  consistency 4, method_explorer 7, depth 7, polyglot 3).
  Kazanılanlar renkli ve tarihli olarak yanar; kilitliler gri
  kalır.
- **Oturum sayacı** - oturumlar, dakikalar, mevcut seri,
  ortalama anlama, ortalama stres için karolar.

## İlerleme zaman çizelgesi

Radar grafiğinin altındaki iki satırlı grafik. Oturum başına iki
metrik: **anlama** puanınız ve **stres** puanınız, her ikisi de
1-5 girişinden 0-1 eksenine yeniden ölçeklenir. Varsayılan olarak
son beş oturum gösterilir; en eskisi solda en yenisi sağda.

Neye bakacaksınız: yükselen anlama çizgisi tam istenen şeydir.
Yükselen stresle birlikte sabit kalan anlama çizgisi, yöntem
değiştirme buluşsal yönteminin izlediği tam sinyaldir; yöntem
değiştirmenizi önerecektir.

## Yöntem dağılımı

Kullandığınız 6 yöntemden hangilerini kullandığınızı gösteren
yatay çubuk grafik. Her çubuğun uzunluğu, o yöntemi kullanan
oturumların yüzdesidir. Çubuklar azalan sıraya göre sıralanır;
eşitliklerde kurallı yöntem sırası korunur.

Bu grafiğin amacı kendiyle yarışmak değil; bir aynadır. Bazı
öğrenciler oturumlarının %80'ini tümdengelimli yapar ve bu
sorun değildir. Diğerleri bağlamsal yöntemi hiç kullanmadıklarını
fark eder ve denemek isterler.

## Son oturumlar

Son 5 oturum kompakt bir liste olarak: yöntem rozeti, oturumun
anlama puanı (küçük bir çubuk olarak) ve dakika cinsinden süre.
Bir satıra tıklamak, o oturuma göre filtrelenmiş İlerleme sayfasına
atlar - belirli bir oturum harika veya berbat geçmişse ve ne
olduğunu görmek istiyorsanız kullanışlıdır.

## Araç + aralıklı öneriler

Alt kenarda iki öneri kartı:

- **Araçlar** - profilinize göre özelleştirilmiş sıralı dış
  araçlar. Anki + NotebookLM artık birinci sınıf dışa aktarımlarla
  (manuel aktarım gerekmez). Her biri arayüz dilinizde tek satırlık
  "neden" açıklaması gösterir.
- **Aralıklı tekrar** - yakın zamanda pratiğini yapmadığınız
  yöntemler tarafından yönlendirilen kısa "sıradaki bu" eylem
  kartları. Beş bantlı politika (ilk / tazeleme / inceleme /
  pratik / koruma) aralık önerilerini yönlendirir.

Her iki liste de her Kontrol Paneli yüklemesinde güncellenir -
hesaplamaları ucuzdur ve son oturumu yansıtır.

## Oturum başlat

En üstteki büyük birincil düğme: "Oturum başlat". Yeni bir oturum
satırı oluşturulmuş, etkin yöntem profilinizden önceden seçilmiş
ve döngü 1. adımda olmak üzere Oturum sayfasını açar.
