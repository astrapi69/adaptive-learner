<!-- Translation: AI-generated, pending native review -->

# Başlangıç Kurulumu

Giriş sayfasındaki dil seçicisinin ardından Başlangıç Kurulumu
akışı dört zorunlu alan ve isteğe bağlı taksonomi toplar:

1. **Konu** — ne öğrenmek istediğiniz. "İspanyolca dilbilgisi",
   "Makine öğrenmesi temelleri", "Ritim gitarı doğaçlama".
   Özgül olun; yapay zeka her oturumu buna dayandıracaktır.
2. **Hedef** — başarının nasıl göründüğü. "B2 sınavını geç",
   "Uçtan uca bir öneri motoru oluştur", "Tempo kaybetmeden
   bir yedek parça üzerinde 12 ölçülük blues solo çal."
   Somut hedefler daha yararlı yapay zeka rehberliği üretir.
3. **Zaman çerçevesi** — hedefe ne zaman ulaşmak istediğiniz.
   "6 hafta", "Yazın sonu", "3. çeyreğe kadar". Beklentileri
   ayarlamak ve seri izleme hedefini belirlemek için kullanılır.
4. **Günlük dakika** — gerçekçi olarak ne kadar zaman
   ayırabilirsiniz. 15-45 dakika, uyarlamalı öğrenme için
   en uygun aralıktır; uygulama maraton oturumlarını ödüllendirmez.

**Konu taksonomisi** (isteğe bağlı, v1.9.0'dan itibaren) — belirsiz
bir öneri aracı, konunuzu Diller / Matematik / Programlama /
Bilimler / Müzik / Beşeri Bilimler / Sosyal Bilimler / Beceriler
altındaki 80'den fazla düğümlü eklenmiş taksonomiyle eşleştirir.
Bir Diller konusu seçmek, proje için daha sonra Telaffuz Pratiğini
açar.

**Etiketler** (isteğe bağlı) — virgülle ayrılmış serbest metin
etiketleri ("sınav-hazırlık", "günlük", "kendi-tempomda") daha
sonra Kontrol Paneli filtre çubuğunda gösterilir.

Formu tamamen atlayabilirsiniz — varsayılan bir kullanıcı oluşturulur
ve doğrudan Kontrol Paneline ulaşırsınız.

Ayrıca proje için bir **dil** seçersiniz. Bu, yapay zekanın
oturumlar sırasında yanıt vereceği dildir; arayüz dilinden farklı
olabilir (arayüzü kendi ana dilinizde tercih edebilir, ama
İspanyolcayı İspanyolca olarak öğrenebilirsiniz).

## İsteğe bağlı: mevcut problem

"Mevcut problem" alanı, projeye hemen açık bir soru getirmenizi
sağlar. Doldurursanız ilk oturum, açık uçlu "Ne üzerinde çalışmak
istiyorsunuz?" istemi yerine bu somut engelle başlar.

## Sonra ne olur

Formu gönderdiğinizde tek bir gidiş-dönüşte üç şey gerçekleşir:

1. Bir `User` kaydı oluşturulur (veya yeniden kullanılır — yerel
   tarayıcınız oturumlar arasında aynı kullanıcıyı tutar).
2. Bir `LearningProject` satırına konu / hedef / zaman çerçevesi /
   günlük dakika / dil verileriniz kaydedilir.
3. Değerlendirme sayfası otomatik olarak açılır. Buradan
   atlayabilirsiniz, ancak yapay zeka onu yapana kadar varsayılan
   olarak "tümdengelimli" öğrenme yöntemini kullanır.

## Projenizi düzenlemek

Proje ayrıntıları değişmez değildir. Müfredat sayfası, gerçekte
ne öğrenmek istediğinizi keşfettikçe konu ve hedefi ayarlamanıza
olanak tanır. Ayarlar sayfası dil değişikliklerini yönetir.

## Saklanmayanlar

- **E-posta yok**, şifre yok, hesap yok.
- **Analitik yok**, üçüncü taraf izleyici yok.
- **Telemetri yok**: Yerel modda cihazınızdan dışarı gönderilmez.

Yapay zeka sağlayıcınız mesajlarınızı görür (yapay zekaya sormanın
tüm amacı budur). Adaptive Learner'ın kendisi yalnızca yazdıklarınızı
depolar — [depolama moduna](settings.md#storage-mode) göre yerel
olarak veya FastAPI arka ucunda.
