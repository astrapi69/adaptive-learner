<!-- Translation: AI-generated, pending native review -->

# Tema sistemi

Aşama 58 (v1.41.0), tek bir `data-theme` boyutunda altı temalı
bir sistemle ve OS'yi izleyen `auto` seçeneğiyle eski açık/koyu
çiftini değiştirdi.

## Nasıl çalışır

- **Kanonik renk token'ları** `frontend/src/styles/themes/theme-<id>.css`
  dosyalarında, her `data-theme` değeri için bir blok olarak bulunur
  (`light`, `dark`, `ocean`, `forest`, `high-contrast`, `sepia`).
  Her dosya **tam** anlamsal token setini tanımlar — açık temanın
  varsayılan değeri yoktur.
- **Temadan bağımsız token'lar** (boşluk, yarıçap, yazı tipleri,
  marka yöntemi paleti) ve **eski diğer adlar** (`--bg`, `--surface`,
  `--fg`, `--danger`, ...) `styles/global.css :root` içinde yaşar.
  Diğer adlar, eski kuralların etkin temayı otomatik olarak izlemesi
  için kanonik token'lar *üzerinden* çözümlenir.
- Tema dosyaları `main.tsx`'ten içe aktarılır, **önce light**; böylece
  etkin tema `:root`'a karşı eşit özgünlük bağını kazanır.
- `frontend/src/lib/themes.ts` kayıt defterdir: `THEMES`, `ThemeId` /
  `ThemeChoice` türleri, `auto` eşlemesi için
  `resolveTheme(choice, prefersDark)` ve ön izleme kartı renkleri.
- `frontend/src/hooks/useTheme.ts`, uygulanan `data-theme` niteliğine
  sahip olur ve seçimi `adaptive-learner.theme` altında kalıcı kılar
  (eski `adaptive-learner-theme` anahtarını bir kez göçürür).
- `index.html`, **ilk boyamadan önce** kayıtlı temayı uygulayan küçük
  bir satır içi betik taşır (göz kırpma yok). Bu, hook'un çözümlemesini
  yansıtır; ikisini senkronize tutun.
- Grafikler (Recharts), SVG niteliklerinde CSS değişkenlerini okuyamaz,
  bu nedenle `lib/chartTheme.ts` + `useChartTheme` hesaplanan token
  değerlerini okur ve `data-theme` değiştiğinde yeniden okur.

## Token seti (her tema tarafından tanımlanır)

Arka planlar (`--bg-primary/secondary/surface/elevated/overlay`),
metin (`--fg-primary/secondary/muted/inverse`), kenarlıklar
(`--border-primary/subtle/accent`), etkileşimli
(`--interactive-bg/hover/active/disabled`), vurgu
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), durum çiftleri
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
alıştırma geri bildirimi (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, grafik serisi (`--chart-1..6`) ve gölgeler
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts`, herhangi bir temanın bunlardan birini
eksik bırakması veya ekstra bir tane eklemesi durumunda başarısız olur;
`styles/contrast.test.ts`, altı tema genelinde WCAG 2.1 AA uyumluluğunu
doğrular.

## Yeni tema ekleme

1. **Kopyalayın** mevcut bir dosyayı, örneğin
   `cp theme-dark.css theme-midnight.css` ve seçiciyi
   `[data-theme="midnight"]` olarak değiştirin. **Her** token'ı
   koruyun — yalnızca değerleri değiştirin. Burada bileşen stilleri
   eklemeyin.
2. **Kaydedin** `lib/themes.ts` içinde: `THEMES`'e bir `ThemeMeta`
   girişi ekleyin (id, İngilizce `label`, `family` light|dark, ve
   Ayarlar ön izlemesi için bir `swatch`) ve id'yi `ThemeId` union
   türüne ekleyin.
3. **İçe aktarın** `main.tsx`'te `theme-light.css`'in ardından
   (sıra yalnızca light'a göre önemlidir).
4. **Ön boyama korumasında izin verin**: `index.html`'deki satır içi
   `<script>` içindeki `valid` dizisine id'yi ekleyin.
5. **i18n**: `backend/config/i18n/*.yaml` altındaki sekiz kataloga
   `ui.themes.midnight` ekleyin, ardından `make sync-i18n` çalıştırın.
6. **Doğrulayın**: `npx vitest run src/styles/themes src/styles/contrast`
   — eksiksizlik + kontrast pinleri yeşil kalmalıdır (kontrastın yeni
   teminizde AA'yı geçmesi için değerleri düzeltin).

Hepsi bu — ThemePicker, ön boyama betiği, grafikler ve her bileşen,
hepsinin kanonik token'ları okuması nedeniyle yeni temayı otomatik
olarak alır.

## Kurallar

- **Bileşenlerde sabit kodlanmış renk yok.** `styles/no-hardcoded-colors.test.ts`
  bunu `.tsx` stilleri için uygular (belgelenmiş bir izin listesi grafik
  çözümleyicileri, dekoratif konfeti ve veri renklerini kapsar).
- **Her tema her token'ı tanımlar.** `inherit`-from-light boşlukları
  yok — bu, tanımsız token'ların koyu modda açık hex oluşturduğu F1
  denetim hatasıydı.
- **Tema değişimi anında** gerçekleşir — `data-theme` değişimi, asla
  yeniden yükleme değil.
