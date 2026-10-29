<!-- Translation: AI-generated, pending native review -->

# Yapay zeka ile alıştırma üretimi

Yalnızca teoriden oluşan (alıştırma içermeyen) bir ders, yapay
zekanın kartlarından **alıştırma üretmesiyle** pratik yapılabilir bir
derse dönüştürülebilir. Bu, EXP-036 hattıdır. Yapılandırılmış bir
yapay zeka anahtarı gerektirir (Ayarlar → Yapay zeka); anahtar
olmadan düğme görünür ama devre dışıdır ve nedeni araç ipucunda
yazar.

<!-- TODO: Ekran görüntüsü - yalnızca teoriden oluşan bir derste "Alıştırma oluştur" düğmesi -->

---

## Hat

Üretim tek bir yapay zeka çağrısı değildir - bir
**üret → kalite kapısı → dengele → geri bildirim** hattıdır:

1. **Üret.** Bir üretim istemi, modelden desteklenen türlerde
   alıştırmalar ister; savunmacı bir JSON ayrıştırıcı, modellerin
   alışılmış biçimlendirme tuhaflıklarını tolere eder.
2. **Kalite kapısı.** Deterministik bir kapı, bozuk, önemsiz ya da
   mevcut alıştırmaların kopyası olan alıştırmaları reddeder - sen
   onları görmeden önce.
3. **Dengele.** Üretilen alıştırmalar, bir ders tek bir biçimden
   oluşmasın diye alıştırma türleri arasında dengelenir.
4. **Geri bildirimle yeniden üret.** Sonuç doğru değilse, bir
   sonraki denemeyi yönlendirmek için geri bildirimle yeniden
   üretebilirsin.

---

## Ders başına ve set başına

- **Tek ders:** yalnızca teoriden oluşan derslerde bir
  **"Alıştırma oluştur"** düğmesi görünür.
- **Tüm set:** toplu üretim, bir setteki yalnızca teoriden oluşan
  her derse tek bir çalıştırmada alıştırma ekler.

---

## Kalite ve güven

Kalite kapısı deterministik olduğu için üretilen alıştırmalar, elle
yazılmış olanlarla aynı asgari çıtayı karşılar (yeterli alıştırma,
birden fazla tür, boş kart yok). Üretim, elle yazılmış içeriği
tamamlar - mevcut alıştırmalarının üzerine asla sessizce yazmaz.

*Mevcut* içeriğin kalitesini (elle yazılmış ya da üretilmiş)
denetlemek için [Yapay zekâ içerik denetimi](../user-guide/ai-validation.md)
sayfasına bak.

---

## İlgili sayfalar

- [Yapay zekâ içerik denetimi](../user-guide/ai-validation.md) - set genelinde kalite denetimleri
- [Ders oluşturma](../content-creation/overview.md) - dersleri kendin oluştur
- [Dersler ve tekrarlar](../user-guide/lessons.md) - alıştırma türleri
