<!-- Translation: AI-generated, pending native review -->

# Müfredat

Müfredat sayfası, yapılandırılmış öğrenme materyalinizdir —
oturumlarınızın gerçekleştiği "kitap". Serbest akışlı yapay zeka
oturumlarının üzerine eklenen isteğe bağlı ama güçlü bir katmandır.

## Müfredat nedir

Müfredat, bir öğrenciye ait **konu** ağacı ve düz bir **ders**
listesinden oluşur. Yan yana birden fazla müfredatınız olabilir
("İspanyolca dilbilgisi", "Java geliştiricileri için Spring Boot",
"Ritim gitarı temelleri").

- **Konular** bir ağaç oluşturur — bölümler ve alt bölümler. Her
  konunun bir başlığı, isteğe bağlı açıklaması ve üst referansı
  vardır. "Alt konu ekle" düğmesi bir alt öğe oluşturur.
- **Dersler** müfredatın altında düz biçimde yer alır. Her birinin
  bir başlığı ve zengin metin içerik gövdesi vardır. Yazılı
  materyal için kullanın: notlar, özetler, alıştırma sayfaları.

## Müfredat oluşturma

Müfredat sayfası sahip olduğunuz her müfredatı listeler. "Müfredat
oluştur" formu başlık + isteğe bağlı açıklama + isteğe bağlı dil
alır; Oluştur'a basmak yeni müfredat görünümünü hemen açar.

## Konu ağacı

Müfredat görünümünün sol tarafı, sürükle-bırak ile yeniden
sıralanabilen (mobilde dokunmayı destekler) konu ağacını gösterir.
Bir konuya tıklamak derinleşmeyi sağlar; başlığın altındaki içerik
haritası köke geri yolu gösterir.

- **Kök düzeyinde konu ekle** — mevcut her üst düzey konunun
  kardeşi olarak.
- **Alt konu ekle** — mevcut odaklı konunun altına.
- **Yeniden adlandır** — düzenleme modunda başlığa tıklayarak.
- **Sil** — konuyu VE alt öğelerini kaldırır (Dexie modu basamakları
  tek bir işlemde yönetir; API modu arka uca devreder).

Ağaç yalnızca meta veridir; konuların kendi içerikleri yoktur.
İçerik derslerde yaşar.

## Dersler

Müfredat görünümünün sağ tarafı, `order_index` ile sıralanan ders
listesidir. Her satır ders başlığını ve içeriğinin bir parçasını
gösterir; tıklamak ders düzenleyiciyi açar.

Ders düzenleyici **TipTap zengin metin** kullanır:
kalın / italik / altı çizili / üzeri çizili, başlıklar
(H1-H3), madde işaretli + sıralı + görev listeleri, alıntı,
satır içi kod, 11 dilde `lowlight` sözdizimi vurgulamalı çitli
kod blokları (bash / css / html / java / javascript / json /
markdown / python / sql / typescript / yaml), bağlantılar, metin
hizalama, vurgulama, geri al / yinele, karakter sayısı. Araç çubuğu
yatay kaydırma + 40 piksel dokunma hedefleriyle mobil uyumludur.

Müfredat açıklamaları, oturum notları ve ders içeriği aynı
düzenleyiciyi kullanır. Markdown / PDF dışa aktarımları TipTap
belge ağacında yürüyen ve GFM Markdown yayan `renderStoredContent`
üzerinden geçer; eski düz metin içerik değişmeden
geçer.

## Müfredatların oturumlara bağlantısı

Oturumlar bir sohbet geçmişi içe aktarımından veya sıfırdan
başlatılabilir. Konuşma analizörü (`/api/imports`) bir
`suggested_curriculum` alanı çıkarır; analiz edilmiş içe aktarımda
tek tıklama, yapay zekanın tespit ettiği boşluklarla eşleşen
konular + derslerle bir Müfredat başlatır.

Oturum yapay zekası, bireysel ders içeriğini henüz otomatik olarak
sistem istemine çekmez — bu, müfredat-yapay zeka entegrasyon şekli
yerleşene kadar kasıtlı olarak beklemeye alınmıştır.

## Depolama modu başına davranış

Hem ApiStorage hem DexieStorage müfredat CRUD'unu uygular. Yerel
modda veriler IndexedDB'de yaşar ve site verilerini temizlemediğiniz
sürece tarayıcı yeniden yüklemelerinde hayatta kalır. Sunucu modunda
veriler FastAPI arka ucunun SQLite veritabanında yaşar.

[Depolama modları nasıl çalışır](settings.md#storage-mode)
