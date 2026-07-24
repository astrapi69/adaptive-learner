<!-- Translation: AI-generated, pending native review -->

# Yedi adımlı döngü

Her oturum 7 adımlık bir öğrenme döngüsünden geçer. Adımlar,
*Von Theorie zur Praxis* makale serisinden gelmekte olup yeni bir
beceri edinmenin gerçek bilişsel yolculuğunu yansıtır.

## Yolculuk

| # | Adım | Bilişsel açıdan neler oluyor |
|---|---|---|
| 1 | Girdi | Yeni materyalle ilk kez karşılaşmak |
| 2 | Deneme | Onu uygulamaya çalışmak |
| 3 | Hata | Uygulamanın tutmadığını fark etmek |
| 4 | Geri Bildirim | Hatanın neden oluştuğunu işlemek |
| 5 | Uyum | Zihinsel modelinizi ayarlamak |
| 6 | Tekrar | Ayarlanmış modelle pratik yapmak |
| 7 | Bütünleştirme | Daha geniş bağlamla ilişkilendirmek |

## Neden bu sıra

Bu yalnızca uygun değil - her adım bir öncekine bağlıdır:

- **Girdi → Deneme** önemsiz değildir. Pek çok öğrenci Deneme adımını
  atlayıp doğrudan girdiden "Daha sonra denerim"e geçer. Bu gecikme
  hatırayı aşındırır. 2. adım anında uygulamayı zorlar.
- **Deneme → Hata** üretken sürtünmedir. Hata *bilgidir*. Yalnızca
  kolay sorular vererek hatalardan kaçınan bir öğrenme oturumu
  anlayışınız hakkında hiçbir şey söylemez.
- **Hata → Geri Bildirim** en derin öğrenmenin gerçekleştiği yerdir.
  Aynı hata, sizin spesifik denemenize atıfla anında açıklandığında
  etkili olur; aynı hata bir ders kitabından bir saat sonra
  açıklandığında etki yaratmaz.
- **Geri Bildirim → Uyum** içseldir. Yapay zeka bu adımın gerçekleştiğini
  göremez; bunu kafanızda siz yaparsınız. Yapay zeka istemindeki 5.
  adım, yaklaşımınızda neyi değiştirdiğinizi dile getirmeniz için
  sizi bilinçli olarak davet eder.
- **Uyum → Tekrar** uyumu doğrular. Yeni pratik görevi aynı ilkeyi
  biraz farklı bir biçimde kullanır; böylece uyumun genellenmesi
  gerekir.
- **Tekrar → Bütünleştirme** beceriyi yalıtılmış pratikten kaldırır ve
  bildiğiniz diğer şeylerle ilişkilendirir. Bu, öğrenmeyi kalıcı kılar.

## Bir adımı atlarsanız ne olur

Atlanan her adımın bir bedeli vardır:

- **Girdiyı atlarsanız**: hiç açıklanmamış bir şeyi uygulamaya
  çalışırsınız. Genellikle çırpınmak gibi hissettirir.
- **Denemeyi atlarsanız**: kuralı okur ve anladığınızı varsayarsınız.
  Aylarca sonra anlamadığınızı göreceksiniz.
- **Hatayı atlarsanız**: yapay zekanın teşhis edebileceği bir hata
  üretmezsiniz. Öğrenme damlaya damlaya azalır.
- **Geri bildirimi atlarsanız**: bir hata aldınız ama açıklamayı
  işlemdiniz. Bir sonraki oturumda aynı hatayı yapacaksınız.
- **Uyumu atlarsanız**: geri bildirime başınızla onay verdiniz ama
  zihinsel modelinizi gerçekten değiştirmediniz. Bir sonraki Deneme
  bunu ortaya çıkaracak.
- **Tekrarı atlarsanız**: bir kez uyum sağladınız ama uyumun
  genellendiğini doğrulamadınız. Beceri farklı bir yüzey formuna
  aktarılmayacak.
- **Bütünleştirmeyi atlarsanız**: beceri silolaşır. Pratik sorularda
  yapabilirsiniz ama gerçek bir durumda yapamayabilirsiniz.

Çift istemli yapay zeka değerlendirici, alışverişlerinizi izler ve bilişsel
bir ritmi atladığınızda mevcut adımda kalmayı önerebilir. "Kal" önerileri
bunun için vardır - yapay zekanın sinir bozucu olduğundan değil.

## Yapay zeka nasıl karar verir

Her `kullanıcı` mesajı + yapay zeka yanıtından sonra, bu sistem isteciyle
(özetlenmiş) ikinci bir yapay zeka çağrısı yapılır:

> Alışverişi oku. Öğrenci mevcut döngü adımını tamamladı mı? JSON
> yayımla: `{advance, confidence, reason, suggested_step}`.

Şema tek bir JSON nesnesi ister; yapay zeka ayrıştırılamaz metin
döndürürse deterministik +1 yedek devreye girer (7. adımda sınırlanır).

Önerilen_adım şu olabilir:

- `current + 1` - normal ilerleme (en yaygın).
- `current` - kal; öğrencinin burada daha fazla zamana ihtiyacı var.
- İleri atlama (ör. 1 → 3) - öğrenci girdiyi zaten kavramış.
- Geri adım (ör. 4 → 2) - öğrenci kafası karışmış ve yeniden
  denemesi gerekiyor.

Rota öneriyi yalnızca `confidence >= 0.6` olduğunda uygular
(app.yaml'daki varsayılan `step_evaluation.confidence_threshold`).
Yedek kararlar her zaman +1 ilerlemesi uygular.

## Neden tek istem yerine çift istem

Aynı yapay zeka çağrısı hem öğrenme yanıtını hem de adım kararını
çıkarabilirdi. Bunu yapmıyoruz çünkü:

1. **Kaygıların ayrılması** - öğrenme istemi (yöntem, adım) başına
   oluşturulur. Değerlendirici istem yönteme duyarlı ama adımdan
   bağımsızdır.
2. **Token bütçeleri** - öğrenme yanıtı 1024 tokenden yararlanır;
   karar yalnızca 256 gerektirir.
3. **JSON ayrıştırma sağlamlığı** - yapay zekadan tek yanıtta hem
   düzyazı hem JSON kuyruğu üretmesini istemek kırılgandır. İki kez
   sorarız, temiz ayrıştırırız.
4. **Yeniden oynatılabilirlik** - bir şeyler ters gittiğinde iki yanıt
   ayrı olarak günlüğe alınmıştır ve denetlenebilir.

Bedeli, her gidiş-dönüşte iki API çağrısıdır. Ucuz katman fiyatlandırmasında
(claude-haiku, gpt-4o-mini, gemini-flash) bu, alışveriş başına bir kuruşun
küçük bir bölümüdür.

## Döngü ilerleme göstergesi

Oturum sayfası üstte 7 daireli bir şerit gösterir. Doldu = tamamlandı;
mevcut adımın dairesi projenin vurgu rengindedir ve yapay zeka düşünürken
hafifçe nabız atar. Adım geçişlerinde (ileri veya geri), şerit animasyon
yaparak döngünün canlı olduğu hissini verir.

Mobil cihazlarda (≤768px) şerit, dikey alanı korumak için tek yatay
küçük daireler satırına dönüşür. Şerit üzerinde kaydırma-ile-gözetleme,
önceki / sonraki döngü adımını açıklayan bilgilendirici bir bindirme
gösterir.

## Otomatik döngü + konu geçişleri

7. adım artık bir çıkmaz sokak değildir. Adım değerlendirici sizi
`advance=true` ile 7. adıma taşıdıktan sonra, üçüncü bir yapay zeka
çağrısı - konu-geçiş değerlendirici - konunun bütünleştirilip
bütünleştirilmediğini ve yeni bir döngüye başlanıp başlanmaması
gerektiğini değerlendirir.

```
       adım 1..7 (normal döngü)
                ↓
         7. adıma ulaşıldı
                ↓
   konu-geçiş yapay zeka çağrısı:
       bütünleştirildi mi?  devam öneriliyor mu?
                ↓                    ↓
              evet ∧ evet          diğer
                ↓                    ↓
   cycle_step ← 1                cycle_step 7'de kalır
   cycle_count += 1              (oturum sona hazır)
   cycle_topics ← [..., özet]
   yeni alt konu seçildi
```

Oturum başına `max_cycles=5` sabit sınırı sonsuz döngüleri önler.
Deterministik bir yedek, yapay zeka / ayrıştırma hatasında
7'de-sınırla davranışını korur.

Sohbet, döngü geçişlerini oturum geçmişinde kesik kenarlı "Döngü N"
kartları olarak gösterir. Derecelendirme iletişim kutusu, `cycle_count > 1`
olduğunda çok döngülü yolculuğu özetler.

## Paralel döngü sınırı değerlendirmesi

6. → 7. adım geçişinde hem adım değerlendirici hem de konu-geçiş
değerlendirici `asyncio.gather` (`app.yaml`'da `async_evaluation: true`)
aracılığıyla eş zamanlı olarak tetiklenir. Bu, döngü sınırında ~T₂
gecikmesini ortadan kaldırır.

Mesaj yanıtı, `timings` bloğunda şunları taşır: `learning_ms` /
`evaluation_ms` / `topic_transition_ms` / `total_ms` /
`parallel_saved_ms`.
