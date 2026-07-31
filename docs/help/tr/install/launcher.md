# Masaüstü başlatıcısını çalıştırma

!!! tip "Çoğu kullanıcının başlatıcıya ihtiyacı yoktur"
    Adaptive Learner doğrudan tarayıcıda çalışır - kurulum yok, Docker
    yok, başlatıcı yok:
    **[astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/)**.
    Masaüstü başlatıcısı yalnızca uygulamayı kendin barındırmak ya da
    arka uç özelliklerini (sunucu modu, yerel senkronizasyon) yerel
    olarak çalıştırmak istiyorsan sana yöneliktir.

Masaüstü başlatıcısı, Adaptive Learner'ı kendi bilgisayarında **kendi
arka ucuyla** çalıştırmanın en kolay yoludur. Diğer her şeyi senin
için hallederek çalışan küçük bir penceredir: Docker'ın çalışıp
çalışmadığını denetler, ilk başlatmada uygulama imajını indirir ve
yapılandırır (bir kez, 5-10 dakika normaldir), konteynerleri başlatır
ve ardından uygulamayı tarayıcında `http://localhost:8501` adresinde
açar. Aynı pencereden uygulamayı durdurabilir, portu değiştirebilir ya
da her şeyi kaldırabilirsin.

Port varsayılan olarak **8501**'dir ve başlatıcı penceresinden
değiştirilebilir; port kullanımdaysa başlatıcı boş bir porta geçer.

## Uygulamaya kimler erişebilir

Uygulama varsayılan olarak **yalnızca bu bilgisayardan** erişilebilir
(`127.0.0.1`). Bu bilinçli bir tercihtir: uygulamada oturum açma yoktur
ve yapay zekâ sağlayıcı anahtarların onun içinde durur. Ağda görünür
olsaydı, aynı ağdaki her cihaz - bir ofis yerel ağı, otel veya konferans
kablosuz ağı - onu kolayca açıp kullanabilirdi.

Uygulamaya başka bir cihazdan, örneğin kendi kablosuz ağındaki
telefonundan erişmek hâlâ mümkün, ama artık bilinçli bir karar: `.env`
dosyasında `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` ayarla. Bunu yalnızca
güvendiğin bir ağda yap ve unutma ki o ağdaki herkes o andan itibaren
seninle aynı erişime sahip olur.

## Ön koşul: Docker - başlatıcı bunu kendisi denetler

Başlatıcı, çalışan bir Docker gerektirir, çünkü uygulamanın kendisi bir
konteyner grubu olarak çalışır. Bunun için elle hiçbir şeyi
**denetlemene gerek yoktur**: başlatıcı çalıştığında Docker'ın kurulu
olup olmadığını ve çalışıp çalışmadığını kendisi denetler, farklı bir
Docker bağlamı altında çalışan bir Docker'ı da bulur (örneğin Linux
için Docker Desktop ya da rootless Docker) ve bir şey eksik olduğunda
çözümüyle birlikte açık bir mesaj gösterir. Docker henüz hiç kurulu
değilse: [Docker Desktop'ı kurma](docker-desktop.md).

Başlatıcının mesajları ve anlamları:

| Mesaj | Anlamı | Çözüm |
|-------|--------|-------|
| "Docker kurulu değil (docker PATH içinde yok)." | `docker` komutu bulunamadı. | [Docker Desktop'ı kurma](docker-desktop.md). Başlatıcı, kurulum bağlantısını doğrudan gösterir. |
| "Docker kurulu ama başlatılmamış." ya da "Docker çalışmıyor. Denetlenen bağlam '...' (...): ..." | Docker hizmeti şu anda çalışmıyor; ayrıntılı biçim, denetlenen bağlamı, soketi ve Docker'ın özgün hatasını belirtir. | Başlatıcıdaki **"Docker'ı başlat"** düğmesine tıkla (Linux) ya da Docker Desktop'ı aç (macOS/Windows), ardından **"Yeniden dene"**. |
| "Docker kurulu ama iznin yok." | Kullanıcın `docker` grubunda değil (Linux). | Başlatıcı, doğru komutu doğrudan gösterir; sonrasında bir kez oturumu kapatıp yeniden aç. |
| "Docker yanıt vermiyor." | Docker büyük olasılıkla hâlâ başlıyor (Docker Desktop'ı açtıktan hemen sonra tipiktir). | Bir an bekle, ardından **"Yeniden dene"**. |
| "Docker '...' bağlamı üzerinden çalışıyor - etkin bağlama erişilemedi, başlatıcı otomatik olarak bağlandı." | Yalnızca bilgilendirme: Docker farklı bir bağlam altında çalışıyordu, başlatıcı onu buldu ve kullanıyor. | Yapılacak bir şey yok. |
| "Docker Desktop kurulu ama PATH içinde değil." | Docker Desktop uygulaması var, ancak komut satırı aracı (henüz) erişilebilir değil. | Docker Desktop'ı başlatıcı düğmesinden başlat ve kısa bir süre bekle. |

Ayrıntılı mesajlarla birlikte bağlam algılama, docker-app-launcher#26
sonrasındaki başlatıcı sürümüyle gelir; daha eski sürümler aynı
tablodaki daha kısa mesajları gösterir.

## İndirme

Üç başlatıcının tümü her sürümle birlikte
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases)
adresinde yer alır:

| Platform | Dosya | Sağlama toplamı |
|----------|-------|-----------------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

### Neyin doğrulandığı ve neyin doğrulanmadığı

Bu programların her biri, derlenirken tam olarak hedeflendiği işletim
sisteminde bir kez başlatılır. Böylece başladığı kanıtlanmıştır: Linux
üzerinde, Windows üzerinde ve Apple Silicon'lu macOS üzerinde. Uygulama
imajı her sürümde doğrulanır: anonim bir indirme (oturum açmadan) ve
sağlık denetimiyle gerçek bir başlatma, iki işlemci türü (Intel/AMD ve
ARM) için ayrı ayrı, o türdeki makinelerde. Henüz ölçülmemiş olan, çok
eski Docker motorlarında (20.10 dönemi) kayıt defterinden indirmedir;
motor zincirinin kendisi böyle bir motorda başka bir kayıt defterine
karşı kanıtlanmıştır ve GitHub kayıt defterine karşı ölçüm upstream
takip edilmektedir.

Kanıtlanmamış olan, işletim sisteminin **indirilen** bir dosyaya nasıl
tepki verdiğidir: programlar ücretli bir imza taşımaz, bu yüzden macOS
ilk açılışta uyarır ("tanımlanamayan geliştirici") ve Windows
SmartScreen bildirimini gösterir. Bu bir uyarıdır, kusur değildir; bir
kereliğine nasıl onaylayacağın aşağıda [macOS](#macos) ve
[Windows](#windows) bölümlerinde anlatılır. Önce sağlama toplamını
doğrula: herhangi bir iletişim kutusundan daha güvenilir bir kanıttır.

## Linux

1. Sağlama toplamını doğrula (her iki dosya da aynı klasörde):

    ```bash
    sha256sum -c adaptive-learner-launcher.sha256
    ```

2. Çalıştırma iznini ver. Tarayıcı indirmeleri bu izni ikili dosyadan
   her zaman alır, bu yüzden bu adım **her zaman** gereklidir:

    ```bash
    chmod +x adaptive-learner-launcher
    ```

3. Başlat, en kolayı terminalden:

    ```bash
    ./adaptive-learner-launcher
    ```

    Dosya yöneticisinde çift tıklama da ortamına bağlı olarak
    çalışabilir; GNOME/Nautilus bunun için Özellikler > İzinler
    altında "Dosyanın program olarak çalıştırılmasına izin ver"
    seçeneğini gerektirir. Terminalden başlatmanın avantajı, hata
    mesajlarını doğrudan görmendir.

Bilinen tuzaklar:

- **"Permission denied"**: 2. adım atlanmış (`chmod +x`).
- **Başlatmada GLIBC hatası**: ikili dosya Ubuntu 22.04 üzerinde
  yapılandırılır ve glibc 2.35 ya da daha yenisini gerektirir
  (Ubuntu 22.04+, Debian 12+, Fedora 36+). Daha eski dağıtımlarda
  uygulamayı bunun yerine `install.sh` ya da doğrudan Docker Compose
  ile çalıştır.
- **Uygulamaya tarayıcıdan erişilemiyor**: uygulama yalnızca yerel
  olarak (`localhost`) çalışır, bu yüzden bir güvenlik duvarı kuralı
  gerekmez. Tarayıcı otomatik olarak açılmazsa, `http://localhost:8501`
  adresini elle aç (ya da başlatıcı penceresinde gösterilen portu).

## macOS

1. Sağlama toplamını doğrula ve ZIP'i aç:

    ```bash
    shasum -a 256 -c adaptive-learner-launcher-macos.zip.sha256
    unzip adaptive-learner-launcher-macos.zip
    ```

2. İlk açılışta Gatekeeper, ikili dosyayı "kimliği doğrulanmamış
   geliştirici"den geliyor diye engeller. Bunu aşmanın iki yolu:

    - İkili dosyaya sağ tıkla (ya da Ctrl-tıkla) > **Aç** > iletişim
      kutusunda **Aç**'ı onayla. macOS bunu sonraki tüm başlatmalar
      için hatırlar.
    - Ya da: Sistem Ayarları > **Gizlilik ve Güvenlik** > aşağı kaydırıp
      engellenen uygulamada **Yine de Aç**'a tıkla.

## Windows

1. Sağlama toplamını doğrula (PowerShell, her iki dosya da aynı
   klasörde):

    ```powershell
    Get-FileHash .\adaptive-learner-launcher.exe -Algorithm SHA256
    Get-Content .\adaptive-learner-launcher.exe.sha256
    ```

    İki hash değeri eşleşmelidir.

2. `adaptive-learner-launcher.exe` dosyasına çift tıkla. İlk başlatmada
   SmartScreen bir uyarı verir ("Windows bilgisayarınızı korudu"):
   **Ek bilgi**'ye, ardından **Yine de çalıştır**'a tıkla.

## Bir şeyler ters giderse

- Docker çalışmadığında başlatıcının kendisi bir uyarı iletişim kutusu
  gösterir ve Docker Desktop'ı başlatmayı önerir.
- İlk başlatma, uygulama imajını indirir ve yapılandırır; başlatıcı
  penceresindeki adım listesi (Check Docker / Download / Build /
  Start / Ready) ilerlemeyi gösterir. Sonraki başlatmalar hızlıdır.
- Uygulama çalışırken ona her zaman `http://localhost:8501` adresinden
  (ya da değiştirdiğin porttan) erişebilirsin; başlatıcıdaki
  "Tarayıcıda aç" düğmesi de aynı işi yapar.
