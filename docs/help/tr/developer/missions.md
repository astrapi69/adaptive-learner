<!-- Translation: AI-generated, pending native review -->

# Günlük görevler mimarisi

Günlük görevler (EXP-010, Aşama 56), pasif XP/rozet/seri
ödüllerinin üzerine aktif, isteğe bağlı motivasyon ekler.
Her iki depolama modunda da çalışır ve tam olarak bir takip
tablosu ekler.

## Parçalar

| Modül | Rol |
|---|---|
| `plugins/.../missions/templates.yaml` | Statik görev kataloğu (22 şablon, 5 kategori), `make sync-missions` tarafından frontend'e senkronize edilir. |
| `MissionTemplate` (Pydantic) | Katalog giriş şekli (yapılandırma, tablo DEĞİL). |
| `UserMission` (model) | Tek yeni tablo: kullanıcı/gün başına atama + ilerleme + `xp_awarded` guard. Alembic `0021`, Dexie v20, senkronizasyon yüzeyi (MUTABLE). |
| `lib/missions/generator.ts` + `generator.py` | Deterministik (tohumlanmış PRNG) uyarlamalı seçim: zorluk yuvası başına bir seçim, geçmişe göre uygunluk (yeni/aktif/gazilik), arka arkaya tekrar yok. |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | Yalnızca mevcut verilerden hesaplanabilir kontroller atanabilir (diğer 5 katalog girişi, takip mevcut olana kadar atanmamış kalır). |
| `lib/missions/progress.ts` | Saf `check_function` + istatistik anlık görüntüsü → {current, target, completed}. |
| `lib/missions/schedule.ts` | Yerel gece yarısı `today` (dil → saat dilimi) + seri joker'i. |
| `storage/missions-dexie.ts` | Dexie: "bugün" istatistik anlık görüntüsü topla, idempotent olarak ata, değerlendir, tamamlamada XP ödülle. |
| missions eklentisi `service.py` | API modu için SQLAlchemy'ye karşı aynı akış (`GET /today`, `POST /regenerate`). |

## Akış

1. Gösterge Tablosu widget'ı (veya ders tamamlama)
   `getStorage().missions.getDaily(userId, {todayIso})` çağırır.
2. O yerel gün için hiçbir satır yoksa, oluşturucu taze bir set
   atar (`userId + date` ile tohumlanmış, dünküler hariç).
3. İlerleme mevcut verilere karşı yeniden değerlendirilir
   (LessonProgress / ElementError / seri). Yeni tamamlanan bir görev
   `completed`'ı çevirir ve bir kez `xp_reward`'ını ödüller
   (`xp_awarded` aracılığıyla idempotent).
4. `celebrateMissions` (kutlama bus'ı) görev sesini çalar +
   bir övgü cümlesi gösterir; tüm temizleme daha büyük sesi +
   bir konfeti patlamasını çalar.

## Kurallar

- (userId, tarih) başına deterministik; bir kullanıcı bir depolama
  arka ucu kullanır, bu nedenle çapraz arka uç tam eşitliği gerekli
  değildir.
- `UserMission`'ın ötesinde takip yok; izlenemeyen kontroller
  atanmaz.
- Görevler tamamlayıcıdır — bir başarısızlık asla ders akışını
  kırmaz (tüm okumalar savunmacıdır). Kaçırılan günler için ceza yok.
