<!-- Translation: AI-generated, pending native review -->

# İçerik repoları - kendi reponu yayımlama

Adaptive Learner resmî bir içerik kitaplığıyla gelir, ancak içerik
sistemi açıktır: GitHub'da **kendi içerik reponu** çalıştırabilir,
onu uygulamada bağlayabilir ve diğer öğrenenlerin kullanımına
sunabilirsin. Bu sayfa genel bakıştır; adım adım tam talimatlar
**[İçerik Repo Kılavuzu](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**'nda
bulunur.

---

## İçerik reposu nedir?

İçerik reposu, Adaptive Learner formatında **içerik setleri** barındıran
bir GitHub reposudur. Bir set, tek bir dil çifti ve seviye için
(örneğin "Almanca konuşanlar için İspanyolca A1") ya da tek bir bilgi
alanı için (örneğin "Python temelleri") derslerden oluşan bir
koleksiyondur.

Resmî kitaplık ve tüm kullanıcı repoları **aynı formatı** kullanır -
ayrı bir "resmî" şema yoktur. Repon doğrulamadan geçtiği anda birinci
sınıf bir içerik kaynağıdır. Hiçbir zaman kendine ait bir sunucuya
ihtiyacın olmaz: içerik reposu, bir Git reposundaki dosyalardan
ibarettir.

---

## Ön koşullar

- Bir **GitHub reposu** (herkese açık; repo başına bir token ile özel
  de mümkündür).
- Setlerini listeleyen, kök dizinde bir **`manifest.yaml`**.
- **Ders formatında** dersler.
- Yayımlamadan önce yerel olarak doğrulamak için PyYAML ile Python 3.

Belirleyici format başvuruları resmî içerik reposunda bulunur:

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## Dizin yapısı

Bir içerik reposu sabit bir ağacı izler. Kaynak dil (açıklamaların
yazıldığı dil) en üst klasördür; hedef dil ve seviye bir sonrakini
oluşturur:

```
my-content-repo/
  manifest.yaml                  # root manifest: lists every set
  sets/
    de/                          # source language (German speakers)
      es-a1/                     # target language + level (Spanish A1)
        manifest.yaml            # set manifest: lists the lessons
        lessons/
          01-greetings.json      # one JSON file per lesson (NN-slug.json)
        assets/                  # optional: images / audio
  scripts/validate_content.py    # the validator (from the starter kit)
```

---

## Yerel olarak doğrula

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

Her set geçtiğinde çıkış kodu 0, aksi halde dosya başına bir raporla
birlikte 1'dir. Şemayı, dizin yapısını ve kalite alt sınırlarını
denetler (ders başına en az 5 alıştırma, 2 alıştırma türü ve 1 teori
adımı, boş olmayan kart alanları vb.).

---

## Uygulamada nasıl listelenir?

Repon doğrulandıktan sonra bir öğrenen onu
**Ayarlar > Veri > İçerik depoları** altında bağlar: URL'yi
yapıştırır, uygulama kök manifest'i çeker, teknik olarak doğrular,
setleri senkronize eder ve önbelleğe alır. Setler ardından **İçerik
tarayıcısı**'nda bir kaynak rozetiyle görünür. Repolar ayrıca bir
`/add-repo` bağlantısı ve bir QR kod ile de paylaşılabilir.

Bir repo, uygulama içindeki **Önerilen depolar** bölümüne yalnızca
proje ekibinin küratörlü `recommended-repos.json` dosyası üzerinden
ulaşır - resmî onayın kanalı budur (Trust 3).

---

## Güven seviyeleri

Güven seviyesi, öğrenene içeriğin ne kadar incelendiğini söyler.
Bir kalite hükmü değil, köken ve incelemeyle ilgilidir.

| Seviye | Ad | Anlamı |
|-------|------|---------|
| **1** | Onaylanmış | Şema doğru, kalite alt sınırları karşılanıyor - senkronizasyonda otomatik olarak. İçerik tek tek incelenmedi. |
| **2** | Doğrulanmış | Topluluk tarafından katkıda bulunuldu ve bir bakımcı tarafından içerik doğruluğu açısından incelendi. |
| **3** | Resmî | Proje ekibi tarafından derlendi ve kalitesi güvence altına alındı. |

Trust 2+ teknik alt sınırlardan fazlasını bekler: doğru çeviriler,
doğru artikeller/cinsiyetler, eksiksiz aksanlar, mantıklı bir
ilerleyiş, inandırıcı çeldiriciler ve kültürel doğruluk. İsteğe bağlı,
uygulama içi bir **yapay zeka incelemesi**, yazarların bu tür
sorunları paylaşmadan önce yakalamasına yardımcı olur (bkz. EXP-033);
tavsiye niteliğindedir ve paylaşmayı asla engellemez.

---

## Kurslar ve web siteleri için karşılıklılık (EXP-029)

Dersler ve alanlar **eşlik eden medya** (videolar, podcast'ler,
makaleler, kitaplar, kurslar, web siteleri) taşıyabilir. Ticari medya
için filtre **fiyat değil, karşılıklılıktır**: ücretsiz medyaya her
zaman izin verilir; ticari kurslara/web sitelerine ise yalnızca
sağlayıcı geri bağlantı verdiğinde, kendi içerik reposunu
işlettiğinde ya da belgelenmiş bir ortaklığı olduğunda izin verilir.
Bu, içerik yazarlarını reklamcılara değil, ekosistem ortaklarına
dönüştürür. Ayrıntılar
`docs/explorations/EXP-029-media-reciprocity.md` içinde.

---

## Şablon olarak Starter Kit

En hızlı başlangıç, hazır starter reposudur
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)**:
`docs/`, alan başına şablonlar, eksiksiz bir örnek ders (Inception
etkisi), çalıştırılabilir bir örnek set, `books.yaml` ve doğrulayıcıyı
içerir. Onu fork'la, örnek dersi kendi dersinle değiştir, bunu kök
`manifest.yaml` içine kaydet, doğrula ve repoyu uygulamada bağla.

---

## Ayrıca bakınız

- **[Tam İçerik Repo Kılavuzu](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
- [Ders oluşturma - genel bakış](overview.md)
- [Kitap önerileri](books.md)
