<!-- Translation: AI-generated, pending native review -->

# Sürüm yayınlama iş akışı

Bir sürümü elle değil, iki workflow çıkarır. `release.yml` sürüm dalını keser, sürüm numarasını yazar ve herhangi bir şey göndermeden önce tam denetimi çalıştırır. `release-finish.yml` `main` dalına birleştirir, etiketi koyar ve sürümü taslak olarak oluşturur. Bağlayıcı, adım adım anlatım `.claude/rules/release-workflow.md` dosyasındadır; bu sayfa genel bakıştır.

## Sürüm oluşturma kuralı

Adaptive Learner, Anlamsal Sürüm Oluşturma 2.0.0'ı izler:

- **Major (X.0.0)** - API veya mimaride yıkıcı değişiklikler.
  Gelecekteki büyük değişimler için ayrılmıştır.
- **Minor (X.Y.0)** - geriye dönük uyumlu yeni özellikler.
  Her aşama tamamlanması için varsayılan.
- **Patch (X.Y.Z)** - geriye dönük uyumlu hata düzeltmeleri.
  Hotfix zincirleri.

Ön sürüm etiketleri (`-alpha`, `-beta`, `-rc`) kullanılmaz.
Sürümler her zaman kararlıdır.

## Yol

1. **develop üzerinde, pull request ile**: sürüm notları `changelog/releases/vX.Y.Z.md`, yardım sayfalarının "Yenilikler" bölümü ve bağımlılık güncellemeleri. Not dosyası olmadan workflow başlamaz.
2. **Prova**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` dalı keser, sürümü yazar ve runner üzerinde denetler; hiçbir şey göndermez.
3. **Kesme**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`. Denetim yeşilse `release/X.Y.Z` dalı gönderilir; o andan itibaren develop dondurulur.
4. **Dalı denetleme**: imaj derlemesi, güvenlik taraması, WebKit denetimi, görsel karşılaştırma ve üç launcher derlemesi sürüm dalında elle başlatılır. Bir workflow'un gönderdiği dal bunların hiçbirini kendiliğinden başlatmaz.
5. **Bitirme**: `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` fast-forward olmadan `main` dalına birleştirir, birleştirme commit'ine etiketi koyar, sürümü develop'a geri taşıyan pull request'i açar ve GitHub sürümünü taslak olarak oluşturur.
6. **Yayınlama**: `publish-image.yml` imajı yayınlar ve doğrular, yeşil `main` derlemelerinin launcher dosyaları eklenir ve taslak ancak bundan sonra görünür olur.

### Sürüm numarası tek yerde yazılır

`backend/pyproject.toml` tek kaynaktır. Kesme adımı onu yazar ve `make sync-versions` sürüm alanı taşıyan diğer tüm dosyaları günceller (tam küme `scripts/sync_versions.py` içindeki `collect_targets()` fonksiyonundadır). Kimse bir sürüm alanını elle değiştirmez. `release-gate.yml` etikette sürümleri bir kez daha denetler.

### Ne neyi başlatır

- `main` dalına push: `ci.yml`, `deploy-gh-pages.yml` ve launcher derlemeleri
- etiket: `release-gate.yml`
- taslak sürüm: hiçbir şey; imaj ve dosyalar yayınlama adımından gelir

`coverage.yml` push ile çalışmaz; her gece ve istek üzerine çalışır (`gh workflow run coverage.yml --ref main`).

## Eklenti sürümleri

Eklentiler, kanonik uygulama sürümüyle kilit adımı takip eder.
Her eklentinin `pyproject.toml` dosyasında ve eklentilerin
`__init__.py` `__version__` değişmezlerinde aynı sayı.

## Hotfix akışı

Hotfix, elle yapılan tek sürümdür: iki workflow da `main` dalından kesemez. `main` dalından `hotfix/vX.Y.Z` dalı, düzeltme, sürümü yazma ve notları hazırlama, dalı `release-prepare.yml` ile denetleme, ardından `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` ve `make release-publish VERSION=X.Y.Z`.

Gönderilmiş bir etiket asla silinmez ve taşınmaz. Hatalı bir sürümü bir sonraki sürüm düzeltir.

## Ayrık ön sürüm bağımlılık-tarama commit'leri

Sürüm döngüsü bağımlılıkları (Vite, React vb.) artırdığında,
her artışı kendi commit'i olarak tutun. Nedenler:

- **Bisect ayrıntı düzeyi** - bir regresyon tek bir artışa
  izole edilir.
- **CHANGELOG okunabilirliği** - okuyucular her artışın gerçek
  motivasyonunu görür.
- **Geri alma** - kötü bir artış bağımsız olarak geri alınabilir.

Tam desen `.claude/rules/release-workflow.md`'de belgelenmiştir.
