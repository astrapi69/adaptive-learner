<!-- Translation: AI-generated, pending native review -->

# Öğrenme türü değerlendirmesi

Değerlendirme, yeni materyale nasıl yaklaşma eğiliminde
olduğunuzla ilgili 12 sorudan oluşur. Her soru yanıtlamak için
5-10 saniye alır; testin tamamı iki dakikanın altında tamamlanır.

## Nasıl çalışır

Her soru 3-4 olası yanıt gösterir. Soruların çoğu **tek seçimli**
(radyo düğmeleri — birini seçin). Birkaçı **çok seçimli** (onay
kutuları — geçerlilerin hepsini seçin). Uygulama her sorunun
hangi türde olduğunu gösterir.

Mobil ve dokunmatik ekranlarda sorular arasında gezinmek için
**sola veya sağa kaydırın**. Masaüstünde klavye ok tuşları da
aynı işi yapar. İlk soruda tek seferlik bir ipucu bunu vurgular.

Her yanıtın arkasında bir ağırlık vardır: bu yanıtı seçmek sizi
altı öğrenme yönteminden birine (tümdengelimli, tümevarımlı,
hata temelli, diyalogsal, bağlamsal, yapay zeka uyumlu) ne kadar
yönlendirir. Hesaplayıcı bu ağırlıkları toplar, soru sayısına göre
normalleştirir ve 6 yöntemli bir profil üretir.

## Altı yönteme bakış

| Yöntem | Güç |
|---|---|
| Tümdengelimli | Önce kurallar, sonra örnekler — teori odaklı |
| Tümevarımlı | Önce örnekler, kuralı çıkarın — örüntü odaklı |
| Hata temelli | Hataları tetikle, onlardan öğren — sürtünme odaklı |
| Diyalogsal | Düşük stresli konuşma — alışveriş odaklı |
| Bağlamsal | Gerçek dünya senaryoları — durum odaklı |
| Yapay zeka uyumlu | Yapay zeka her turda seçer — üst düzey odaklı |

[Altı yöntem derinlemesine](../concept/six-methods.md)

## Profiliniz

Son sorudan sonra bir **radar grafiği** görürsünüz: altı eksen,
her yöntemin ağırlığı ilgili eksende bir nokta olarak. Şekil size
çok şey anlatır:

- **Uzağa çıkan belirgin bir nokta** = baskın bir yöntem.
  Uygulama varsayılan olarak bu yönteme ağırlık verir.
- **Yuvarlak bir şekil** = dengeli öğrenci. Uygulama
  "tümdengelimli" varsayılanıyla başlar ancak oturumlar
  arasında yöntem değiştirmeye daha isteklidir.
- **Düşük değerlerde düz bir şekil** = güçlü tercihler
  seçmediniz. Bu sorun değildir; yapay zeka uyumlu yöntem
  burada özellikle iyi çalışır.

**Baskın yöntem** (en yüksek ağırlık, alfabetik eşitlik çözümü)
grafiğin üzerinde açıkça gösterilir. Sonucun yanındaki **Metinden
Konuşmaya** düğmesi özeti yüksek sesle okur (Web Speech API;
modern tarayıcılarda çalışır).

## Çok seçimli sorular

Bir soru birden fazla yanıta izin verdiğinde, seçtiğiniz her
birinin ağırlığı kaç tane seçtiğinize bölünür. İki yanıt seçmek,
bir yanıt seçmekle aynı toplam ağırlığı katkılar — dolayısıyla
her şeyi seçerek testi manipüle edemezsiniz.

## Değerlendirmeyi yeniden yapmak

Nasıl öğrendiğinize dair görüşünüz zamanla değişir.
Değerlendirme sayfasına her zaman Kontrol Panelindeki "Değerlendirmeyi
yeniden yap" bağlantısından ulaşabilirsiniz. Yeniden değerlendirme,
profilinizin `version` alanını artırır ve önceki ağırlıkların
üzerine yazar; yapay zekanın davranışı bir sonraki oturumdan
itibaren değişir.

## Değerlendirmeyi atlamak

Testi atlarsanız uygulama varsayılan yöntem olarak **tümdengelimli**
kullanır ve yine de faydalı oturumlar alırsınız. Hazır olduğunuzda
değerlendirmeyi yapın — geciktirmenin bir cezası yoktur.
