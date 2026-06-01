<!-- Translation: AI-generated, pending native review -->

# Sürüm yayınlama iş akışı

AdaptiveLearner, her büyük alt aşama tamamlanmasında bir sürüm keser.
Tam süreç `make sync-versions` ve bir sürüm-geçidi CI işi tarafından
otomatize edilir; insana düşen adımlar yalnızca sürüm seçimi,
CHANGELOG ve etikettir.

## Sürüm oluşturma kuralı

Adaptive Learner, Anlamsal Sürüm Oluşturma 2.0.0'ı izler:

- **Major (X.0.0)** — API veya mimaride yıkıcı değişiklikler.
  Gelecekteki büyük değişimler için ayrılmıştır.
- **Minor (X.Y.0)** — geriye dönük uyumlu yeni özellikler.
  Her aşama tamamlanması için varsayılan.
- **Patch (X.Y.Z)** — geriye dönük uyumlu hata düzeltmeleri.
  Hotfix zincirleri.

Ön sürüm etiketleri (`-alpha`, `-beta`, `-rc`) kullanılmaz.
Sürümler her zaman kararlıdır.

## 8 adımlı sürüm

### 1. Durumu yakala

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

Son etiketten bu yana nelerin geldiğini inceleyin. Artış katmanına
karar verin.

### 2. Sürüm başına notları yaz

En son sürümün şeklini izleyerek bir `changelog/releases/vX.Y.Z.md`
dosyası ekleyin (Eklendi / Düzeltildi / Testler / Kapatılan
biriktirme öğeleri / Commit'ler / Yükseltme notları).

### 3. Kanonik sürümü el ile düzenle

Repodaki tek el ile düzenlenen sürüm alanı:

```toml
# backend/pyproject.toml
[tool.poetry]
version = "X.Y.Z"
```

### 4. Yay

```bash
make sync-versions
```

**18 dosyayı** otomatik olarak günceller:

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec` (CFBundle plist
  + CFBundleShortVersionString)
- 10× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- 3× eklenti `__init__.py` `__version__` değişmezleri
- `install.sh` (`install.sh.template`'den yeniden oluşturulur)
- `install.ps1` (`install.ps1.template`'den yeniden oluşturulur)

### 5. Doğrula

```bash
make sync-versions-check     # sapma durumunda sıfır dışı çıkar
make test                    # 2634 test geçmeli
cd frontend && npm run build # başarılı olmalı
```

### 6. Commit + etiket

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — phase headline + summary"
```

Etiket mesajları açıklamalı, çok satırlı ve sürümü özetler.
Bir sonraki adım çalıştığında GitHub Sürüm notları olurlar.

### 7. Push

```bash
git push origin main --tags
```

Tetikler:

- Yeni commit'te `ci.yml` (testler)
- Yeni etikette `release-gate.yml` (sürüm-pin sapma denetimi)
- Yeni commit'te `coverage.yml` (kapsam HTML)
- Yeni commit'te `deploy-gh-pages.yml` (genel siteyi yayınla)
- GitHub etiketten Release oluşturduğunda
  `launcher-{linux,macos,windows}.yml`

### 8. GitHub Release oluştur

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file`, GitHub Release sayfasının 2. adımda commit edilen
sürüm başına notlarla eşleşmesini sağlar.

## Eklenti sürümleri

Eklentiler, kanonik uygulama sürümüyle kilit adımı takip eder.
Tüm 10 eklenti `pyproject.toml` dosyasında ve üç eklenti
`__init__.py` `__version__` değişmezinde aynı sayı.

## Hotfix akışı

Yama düzeyi sürümler (0.X.1, 0.X.2) aynı 8 adımı izler. Sürüm
CHANGELOG'ının "Hotfix geçmişi" bölümü, birden fazla hotfix arka
arkaya geldiğinde zinciri kaydeder.

## Ayrık ön sürüm bağımlılık-tarama commit'leri

Sürüm döngüsü bağımlılıkları (Vite, React vb.) artırdığında,
her artışı kendi commit'i olarak tutun. Nedenler:

- **Bisect ayrıntı düzeyi** — bir regresyon tek bir artışa
  izole edilir.
- **CHANGELOG okunabilirliği** — okuyucular her artışın gerçek
  motivasyonunu görür.
- **Geri alma** — kötü bir artış bağımsız olarak geri alınabilir.

Tam desen `.claude/rules/release-workflow.md`'de belgelenmiştir.
