<!-- Translation: AI-generated, pending native review -->

# Felsefe

> En iyi öğrenme yöntemi, sabit bir yöntem değildir.

AdaptiveLearner'ın özündeki tez budur. Çoğu "öğrenme uygulaması"
tek bir yaklaşım seçer — flash kartlar, video dersler, oyunlaştırılmış
seriler — ve herkesin aynı şekilde öğrendiğini varsayar. Oysa öyle değil.

## Neden tek bir yöntem yetmez

Farklı konular, farklı yöntemleri gerektirir. *Aynı* konu bile,
*hakimiyet düzeyinin farklı aşamalarında*, farklı yöntemler gerektirir:

- Yeni bir dilbilgisi kuralını öğrenmeye yaklaşımınız, aksanınızı
  cilalamaya yaklaşımınızla aynı değildir.
- Yüksek riskli bir sınav için tekrar yapma biçiminiz, meraktan bir
  konuyu keşfetme biçiminizle aynı değildir.
- Bir aksiliktenten sonra toparlanma biçiminiz, sürdürdüğünüz bir seriyi
  devam ettirme biçiminizle aynı değildir.

Yöntemler arasında akıcı biçimde geçiş yapabilen bir öğrenci daha hızlı
öğrenir, daha uzun süre hatırlar ve daha az tükenir. AdaptiveLearner'ın
amacı Tek Gerçek Yönteminizi bulmak değil — yöntem değiştirmeyi kolay,
doğal ve pedagojik açıdan haklı kılmaktır.

## Altı yöntem

İnsanların gerçekten nasıl öğrendiğinin temel eksenlerini kapsayan
altı yöntem seçtik:

| Yöntem | Temel tutum |
|---|---|
| Tümdengelimli | Önce teori — kurallar, sonra örnekler |
| Tümevarımlı | Önce örnekler — kalıplardan kuralları türet |
| Hata tabanlı | Hataları tetikle, onlardan öğren |
| Diyalogsal | Konuşma alışverişi, düşük baskı |
| Bağlamsal | Gerçek yaşam senaryoları, yerleşik pratik |
| Yapay zeka uyumlu | Yapay zekanın her turda seçmesine izin ver |

İlk beş yöntem pedagojik açıdan klasiktir. Altıncısı ise yapay zekanın
insanların yapamadığı bir şeyi yapabildiğinin dürüst bir kabulüdür:
öğrenicinin yeni ne yaptığına göre *her bir alışveriş başına* yöntem seçmek.

[Yöntemlerin ayrıntısı](six-methods.md)

## Yedi adımlı döngü

Her oturum 7 adımlık bir öğrenme döngüsünden geçer: Girdi, Deneme,
Hata, Geri Bildirim, Uyum, Tekrar, Bütünleştirme. Öğrenmenin büyük
kısmı Hata ve Geri Bildirim arasında gerçekleşir (3-4. adımlar) —
gerçek bilişsel çalışma orada yaşar. Diğer adımlar, hatalara karşı
durabilecekleri bir zemin ve düşebilecekleri bir yer sağlamak için
vardır.

Döngü bir taşıyıcı bant değildir. Adımlar, materyali gerçekten kavrayıp
kavramadığınıza bağlı olarak tekrarlar, atlar ya da geri döner. Çift
istemli yapay zeka mimarisi (bkz.
[Yedi adımlı döngü](seven-steps.md)) her gidiş-dönüşte karar verir.

## Öğrenme için Git

İlerlemeyi takip etmek için Git'in zihinsel modelini ödünç alıyoruz:

- **Commit** = bir oturumun anlık görüntüsü (yöntem, puanlamalar, süre).
- **Diff** = aynı konudaki son oturumdan fark.
- **Branch** = bir yöntem değişikliği (7. oturumda tümdengelimli'den
  diyalogsal'a geçtiniz).
- **Geçmiş** = sorgulanabilir ve görselleştirilebilir tam öğrenme iziniz.

Git'i gerçek anlamda kullanmıyoruz; onun sürümlü, kurtarılabilir,
karşılaştırılabilir durum disiplinini kullanıyoruz. ChatGPT, sizi
sekmesi kapandığında anında unutur. AdaptiveLearner, haftalar ve aylar
içinde örüntülerin ortaya çıkması için her oturumun yapılandırılmış
bir anlık görüntüsünü saklar.

[Takip](tracking.md)

## Üç sütun

AdaptiveLearner oturumlarının yanında üç harici araç kategorisi yer alır —
onları yeniden icat etmeye çalışmıyoruz:

1. **Aralıklı tekrar** (Anki) — kuralların ve hata düzeltmelerinin
   uzun vadeli hatırlanması için.
2. **Aktif hatırlama** (NotebookLM) — kendi kaynaklarınızdan bilgi
   oluşturmak için.
3. **Uyumlu yapay zeka istemleri** (Claude / ChatGPT / Gemini) —
   tek seferlik açıklamalar ve esnek araştırma için.

Gösterge Tablosunun Araç Önerileri kartı bu beş aracı (artı Excalidraw
ve Obsidian) profilinize göre sıralar, böylece mevcut öğrenme şekliniz
için hangisine yaslanmanız gerektiğini görürsünüz.

[Araçlar](tools.md)

## Bu neden önemli

*Von Theorie zur Praxis* adlı Medium makale serisi entelektüel
temeli oluşturur. AdaptiveLearner mühendislik çevirisidir: makalenin
argümanlarını günlük bir pratiğe dönüştüren bir araç. Makaleler NEDEN
altı yöntem, NEDEN yedi adım, NEDEN uyumlu geçiş olduğunu açıklar.
Bu uygulama size gerçekten bunu yapabileceğiniz bir yer sunar.

Uygulamayı kullanmak için makaleleri okumak zorunlu değildir. Ancak
neden bu şekilde inşa ettiğimizi anlamak istiyorsanız kaynak oradadır.
Bağlantılar README'de bulunur.
