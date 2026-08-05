# Docker Desktop'ı kurma

Adaptive Learner, kendi bilgisayarında küçük bir konteyner grubu
olarak çalışır. Masaüstü başlatıcısı bu konteynerleri senin için
başlatır ve durdurur, ancak bunun için önce **Docker**'ın kurulu ve
çalışıyor olması gerekir. Bu kılavuz, seni Docker Desktop kurulumunda
adım adım yönlendirir.

## Neye ihtiyacın var

- Docker Desktop'ın kendisi için yaklaşık 800 MB indirme.
- İlk çalıştırmada Adaptive Learner imajı için yaklaşık 2 GB disk
  alanı (bu bir kez olur; sonraki başlatmalar hızlıdır).
- İlk yapılandırma (build) için birkaç dakika (5-10 dakika normaldir).

## Kurulum

1. Resmi Docker Desktop indirme sayfasını aç:
   [docs.docker.com/desktop](https://docs.docker.com/desktop/).
2. İşletim sistemin için (Windows, macOS ya da Linux) kurulum
   programını indir.
3. Kurulum programını çalıştır ve yönergeleri izle. Değiştirmek için
   bir nedenin yoksa varsayılanları olduğu gibi kabul et.
4. Docker Desktop'ı başlat ve balina simgesi
   "Docker Desktop is running" yazana kadar bekle.

## Başlatıcıyı çalıştır

Docker Desktop çalışmaya başlar başlamaz, Adaptive Learner
başlatıcısını yeniden çalıştır. Başlatıcı önce Docker'ı denetler,
ardından uygulamayı indirir, yapılandırır ve başlatır, en sonunda da
bir "Tarayıcıda aç" düğmesi sunar.

Başlatıcıyı çalıştırdığında Docker henüz çalışmıyorsa, başlatıcıdan
çıkmadan Docker'ı açabilmen için bir "Docker'ı başlat" düğmesi
bulunan bir uyarı gösterir.

Çalışan uygulamaya varsayılan olarak yalnızca bu bilgisayardan
erişilebilir (`127.0.0.1`). Oturum açma yoktur; uygulamayı başka
cihazlara açmak bilinçli bir adımdır - bkz.
[Masaüstü başlatıcısını çalıştır](launcher.md).

## Docker'ı kurmak güvenli mi?

Evet. Docker Desktop, iyi bilinen bir şirket olan Docker, Inc.
tarafından üretilir ve dünya çapında milyonlarca geliştirici
tarafından kullanılır. Kişisel bir bilgisayarda konteynerleştirilmiş
uygulamaları çalıştırmanın standart yoludur.

Adaptive Learner, Docker'ı yalnızca kendi konteynerlerini senin
bilgisayarında çalıştırmak için kullanır. Öğrenme verilerin yerel
kalır; Docker'ı kurmakla verilerine ilişkin hiçbir şey Docker, Inc.
şirketine gönderilmez. Docker Desktop'ı, tıpkı başka herhangi bir
uygulama gibi, dilediğin zaman işletim sisteminden kaldırabilirsin.

## Sorun giderme

- **Başlatıcı, Docker'ın çalışmadığını bildiriyor.** Docker
  Desktop'ı başlat, "running" durumunu bekle ve ardından
  "Yeniden dene"ye tıkla.
- **Port zaten kullanımda.** Başlatıcı bunu algılar ve alternatif bir
  port önerir; öneriyi kabul et.
- **Başka bir şey ters gitti.** Başlatıcıyı `--debug` bayrağıyla
  yeniden çalıştır ve oluşturulan `launcher-debug.log` dosyasını
  paylaş:

  ```bash
  python3 -m adaptive_learner_launcher --debug
  ```
