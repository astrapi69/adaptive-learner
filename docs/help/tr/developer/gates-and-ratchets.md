<!-- Translation: AI-generated, pending native review -->

# Kapılar, ratchet'ler ve dal koruması

Bu proje alışılmadık derecede katıdır: onlarca CI kapısı, dondurulmuş
baseline'lara sahip bir ratchet ailesi, zorunlu issue'lar ve pull
request'ler, bir kapı-test sözleşmesi ve yöneticileri de bağlayan bir
dal koruması. Bunların neredeyse hiçbiri bir insanın okuyacağı yere
yazılmadı - hepsi
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules)
altındaki, ajanlara yönelik kural dosyalarında yaşar. Bu sayfa insanlar
için haritadır: her mekanizmanın ne olduğu, neden var olduğu ve -
engellendiğinde gerçekten önemli olan kısım - ne yapman gerektiği.

Burada hiçbir norm yeniden ifade edilmez. Bir kural bağlayıcı ifadeyi
taşıyorsa, bu sayfa ona bağlantı verir ve onu açıklar. Kurallar tek
doğruluk kaynağıdır; ikinci bir kopya sapar ve bu kod tabanı bunun
olduğunu birden fazla kez yakalamıştır.

## İki tempo: PR kapıları ve gece vardiyası

Yeşil bir pull request, `develop`'un yeşil olduğu anlamına **gelmez**.
PR CI'ı yalnızca doğruluk kapılarını çalıştırır - başarısızlığı bir
merge'ü engellemesi gerekenleri. Bilgilendirici, yalnızca uyarı veren
ya da harici duruma bağlı her şey gece vardiyasında çalışır (gecelik
bir zamanlama artı `workflow_dispatch`).

| Her PR'da çalışır | Gece + release'te çalışır |
|---|---|
| arka uç / eklenti / frontend testleri, ruff + mypy, pre-commit, docs-drift doğrulayıcısı | güvenlik taraması (pip-audit / bun audit / bandit) |
| karmaşıklık ratchet'i, klasör boyutu + dosya boyutu korumaları | kapsam raporu (bir rapor, kapı değil) |
| görsel baseline kapısı, testid referans kapısı | Dexie modu E2E, görsel regresyon, mutasyon testleri |
| docker-build-smoke (yol filtreli) | content-stats sapması, WebKit kapısı |

Sonuç: yalnızca gece vardiyasının kapsadığı bir yüzeydeki değişiklik,
temiz bir PR ile merge edilip bir sonraki gece koşusunu kırmızıya
çevirebilir. Bu, tek seferlik değil, bilinen ve tekrar eden bir risk
sınıfıdır. Yetkili tablo ve gerekçe
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md)
içinde bulunur.

## Bir kapı nedir - ve ne değildir

Bir kapı, **kapalı başarısız olan** bir denetimdir. Projenin kapı-test
sözleşmesi (kapı başına beş test)
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md)
içinde açıkça yazılıdır. Katkıda bulunan biri olarak hissedeceğin iki
kural:

- **Denetleyemeyen bir kapı asla yeşil raporlamamalıdır.** "Çalışamadım"
  ile "bulunacak bir şey yok" aynı şey değildir. Bir kapının dayanağı
  eksikse (olmayan baseline, çöken yardımcı, build edilmemiş frontend),
  kapı başarısız olur, geçmez.
- **Bir kapı neyi ölçtüğünü raporlar.** "0 bulgu" ile "0 dosyaya
  bakıldı" aynı sonuç değildir ve kapı, ikisini ayırt edebileceğin
  şekilde kurulmuştur.

Yani bir kapı seni engellediğinde, yanlış olduğunu varsaymadan önce neyi
ölçtüğünü söylediğini oku. "Yanlış" kapı başarısızlıklarının çoğu,
kapının beklemediğin gerçek bir sapmayı doğru biçimde raporlamasıdır.

## Ratchet'ler ve baseline'lar

Bir **ratchet**, güncel bir ölçümü ağaçta yaşayan dondurulmuş bir
baseline ile karşılaştırır. Ölçüm serbestçe iyileşebilir; sessizce
gerileyemez. İki yarı da - sayı ve baseline - commit edilir, bu yüzden
ikisi de sapabilir.

Ratchet ailesi ve her baseline'ın bulunduğu yer:

| Ratchet | Baseline dosyası | Yerel hedef |
|---|---|---|
| Döngüsel karmaşıklık | `.complexity-baseline` | `make check-complexity-gate` |
| Dosya boyutu (satır) | `.filesize-baseline` | `make check-file-sizes` |
| Klasör boyutu (dizin başına düz dosya) | `.dirsize-baseline` | `make check-folder-size` |
| `global.css` boyutu | `.css-size-baseline` | `make check-css-size` |
| Tema token'ları / kontrast | `.theme-baseline.json` | `make verify-theme` |
| Kural korpusu boyutu | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Belgelerdeki umlaut yerine geçenler | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Kırık belge referansları | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Yayımlanan imaj boyutu | (`verify-image-size` içinde) | `make verify-image-size` |

### Bir ratchet seni engellediğinde

1. **Önce `develop`'u merge et, sonra yeniden ölç.** Bir ratchet güncel
   ağacı bir baseline ile karşılaştırır; tabanının gerisinde kalan bir
   dal, *yeni* merge edilmiş içeriğe karşı *eski* bir baseline taşır,
   bu yüzden yerelde okuduğun sayı CI'ın okuduğu sayı değildir. Bir
   şeye dokunmadan önce dalını güncelle. Bunun neden can yaktığı
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
   içinde belgelenmiştir.

2. **Artış meşruysa, baseline'ı bilinçli olarak yükselt - ve nedenini
   söyle.** Her ratchet'in açık bir yükseltme/güncelleme hedefi vardır,
   böylece yeni tavan diff'ine incelenebilir biçimde, commit mesajında
   bir gerekçeyle düşer:

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **Bir ratchet'in kendini düşürmesini bekleme.** Bazı ratchet'ler
   gerçek bir azalmayı otomatik olarak kaydeder (sıfır olması gereken
   bir hata sayacı); bir *bütçe* ratchet'i azalmayı pay olarak tutar ve
   yalnızca bilinçli bir eylemle hareket eder; *kayan kâhin* ratchet'i
   (karmaşıklık, build edilmiş Tailwind CSS) asla otomatik düşmez,
   çünkü bir düşüş gerçek bir kazanç değil, araç kayması olabilir. Bu
   üç yollu karar, kapı-test sözleşmesinin 5. maddesinde açıklanır. Bir
   ratchet bir sayı *küçüldüğü* için başarısız olduysa, bu da bir
   bulgudur, serbest geçiş değil.

Yerel bir kırmızıyı yeşile çevirmek için asla bir tavanı düşürme. Sayı,
tasarım gereği her yerde aynı anlama gelir; onu sessizce oynatmak, tam
olarak ratchet'in önlemek için var olduğu hatadır.

### Uygulamalı bir örnek: kural korpusu ratchet'i

Diyelim ki `.claude/rules/` altındaki bir kural dosyasına bir bölüm
ekledin. Bu tür her dosya her prompt'a enjekte edilir, bu yüzden korpus
ratchet'i toplam boyutunu korur. Onu çalıştırırsın ve engeller:

```
$ make verify-rule-corpus-size
rule corpus: 24 files, 292314 chars (~73078 tokens per prompt)
rule corpus is 58 chars over the ceiling (292314 > 292256).
  - condense or delete elsewhere in the corpus (see the condensation rule
  - raise the ceiling deliberately:
      make verify-rule-corpus-size-raise
    and say in the commit what the corpus bought for the space.
make: *** [Makefile:899: verify-rule-corpus-size] Error 1
```

Kapı iki meşru çıkış yolunu yazdırır, yalnızca bu ikisini: toplam
yeniden sığsın diye başka bir şeyi yoğunlaştır ya da sil, veya tavanı
`make verify-rule-corpus-size-raise` ile bilerek yükselt ve commit'te
gerekçelendir. Sıfırdan farklı bir kodla çıkar (`Error 1`), bu yüzden
sen bunlardan birini yapana kadar build'i başarısız kılar - eklemenin
öylece içeri sızdığı üçüncü bir yol yoktur. Yukarıdaki tablodaki her
ratchet aynı biçimde engeller: neyi ölçtüğünü adlandıran bir satır,
güncel değerin tavana karşı durumu ve kendi yükseltme/güncelleme hedefi.

Yalnızca push'tan sonra ısıran bir kapı bir gidiş-dönüşe mal olur.
Build gerektirmeyen kapıları tek bir komutla CI sırasıyla çalıştır:

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

`make ci` sırasıyla şunları çalıştırır: docs sapması, docs hijyeni, belge
referansları, kapı<->kural bağlantıları, denetim envanteri, lessons
envanteri, normatif değişiklikler, kural korpusu boyutu, karmaşıklık
ratchet'i, testid referansları, docker bağlamı, dosya boyutları ve
OpenAPI snapshot'ı. İki kapı kurulu + build edilmiş bir frontend
gerektirir (Tailwind sınıf kâhinini build ederler), bu yüzden
`make ci` içinde değil `make ci-full` içinde yer alırlar. Test takımları
ayrıdır: `make test`.

## Kapılar kurallara bağlıdır ve değişiklikler bildirilir

İki manifest, uygulamayı dürüst tutar ve bir kural dosyasını ya da bir
workflow'u düzenleyerek herhangi birini tetikleyebilirsin:

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  kural uygulayan her kapıyı uyguladığı kural bölümüne bağlar.
  `make verify-gate-rule-links` her iki yönde başarısız olur: kuralı
  olmayan bir kapı ya da artık var olmayan bir workflow'a atıfta
  bulunan bir kural. Bağlı her kapı ayrıca kural bölümünün bir
  `body_sha`'sını taşır, böylece başlığı korunurken bir kural gövdesinin
  içinin boşaltılması yakalanır.
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  her denetimin envanterini tutar. `make verify-check-inventory`,
  `active` bir denetimin gerçekten bağlı olduğunu ve etkisiz bir
  işleme dönüşmediğini kanıtlar. Bir denetimi kapatmaya yalnızca bir
  gerekçeyle `status: disabled` bildirilerek izin verilir - diff bunu
  gösterir. İmkânsız hale gelen şey sessiz devre dışı bırakmadır.

PR'ın bir kural dosyasına bağlayıcı ifade ekliyor ya da çıkarıyorsa veya
bir kapının durumunu değiştiriyorsa, `make verify-normative-changes`
bunu **bildirmeni** isteyecektir: `rule-change-declared` etiketi ya da PR
gövdesinde veya bir commit mesajında `RULE-CHANGE DECLARED: <what and why>`
satırı. Bildirim kasıtlı olarak geçilebilir, asla kazara değil ve makine
tarafından
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
içinde toplanır. Tam gerekçe:
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md)
içindeki #2075 / #2077 / #2079 / #2081 / #2087 serisi.

Kural korpusunun somut bir nedenle bir tavanı vardır: her
`.claude/rules/**/*.md` dosyası her ajan oturumunun her prompt'una
enjekte edilir, bu yüzden yeni bir kural bölümü bir ekleme değil bir
takastır - önce bir şeyi yoğunlaştır ya da kaldır, veya commit'te
korpusun bu alanla ne satın aldığını söyle.

## Dal koruması yöneticileri de bağlar

`develop`, bir merge'den önce güncel bir dal ve yeşil zorunlu
denetimler gerektirir. 2026-08-06'dan beri `develop` için
`enforce_admins` **açıktır**, bu yüzden zorunlu denetimler repo
yöneticilerini de bağlar - onları kapatmak bilinçli, görünür bir
eylemdir, asla rutin bir merge'ün parçası değildir. Bu, release ve
hotfix geri merge'leri bir zamanlar `develop`'a kapısız ulaşıp bir insan
fark edene kadar onu her dal için kırmızı bıraktığı için vardır;
geçmişi
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
ve
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md)
içindedir.

Pratik etki: kimse kırmızı bir kapının etrafından dolaşarak merge etmez.
PR'ın `develop`'un gerisindeyse, merge edilebilmeden önce CI birleşik
duruma karşı yeniden çalışsın diye onu güncelle.

## Yükümlülükler: issue, PR, test planı, tek konu

Kapıların üzerinde dört kalıcı yükümlülük durur. Bunlar CI denetimleri
değil normlardır ve bir görevin onları isteyip istemediğinden bağımsız
olarak bağlayıcıdır:

- **Önce issue** (`GITHUB-ISSUE-PFLICHT`): her hata ya da değişiklik,
  düzeltmeden *önce* bir GitHub issue'su gerektirir ve commit/PR ona
  bir kapatma anahtar sözcüğüyle atıfta bulunur (`Closes #NN`).
- **Her zaman PR** (`PR-PFLICHT`): push edilen her kod değişikliği,
  istenip istenmediğine bakılmaksızın `develop`'a karşı bir pull
  request açar. PR'ı olmayan push edilmiş bir dal bitmemiş iştir.
- **Kullanıcıya görünür değişiklik için test planı**
  (`TESTPLAN-PFLICHT`): kullanıcıya görünür davranıştaki bir değişiklik,
  manuel test planını (Almanca ve İngilizce) aynı PR'da günceller. Saf
  refactor'lar, altyapı ve belgeler muaftır.
- **PR başına tek konu**: her PR tek, tutarlı bir değişiklik taşır.

Bağlayıcı ifade
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) ve
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md)
içinde bulunur.

## Bunun yeri

Bu sayfa, klondan merge edilmiş PR'a kadar adım adım yol olan
[Başlangıç rehberi](onboarding.md) için "kapı neden orada" eşlikçisidir.
Test iş akışının kendisi için (Red-Green-Refactor ve uygulamalı bir
örnek) [Test](testing.md) sayfasına bak. Release zamanı kapıları için
[Sürüm yayınlama iş akışı](release.md) sayfasına bak.
