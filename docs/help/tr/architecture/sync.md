# Sync mimarisi

Adaptive Learner yerel-öncelikidir: sunucu modu (API) verileri dosya
sisteminde, yalnızca tarayıcı modu (Dexie) IndexedDB'de tutar.
**Senkronizasyon**, bu cihazları yerel ağ üzerinden bağlamayı
amaçlar. Eksiksiz referans
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
içinde bulunur.

---

## Üç cihaz rolü

Sync arayüzü, cihazın rolüne göre farklı görünür — ve yalnızca
kullanılabilir olduğu yerde gösterilir:

| Rol | Depolama modu | Sync arayüzü |
|---|---|---|
| Masaüstü (Sunucu) | API | QR üret, durum, "Şimdi senkronize et" |
| Mobil (İstemci) | Dexie | QR tara / bağlantı yapıştır, eşleştirme sonrası durum |
| Yalnızca-PWA | Dexie | yok |

---

## SYNC-UI-GATE: yalnızca çalışanı göster

Kullanılamayan bir işlev **sunulmaz** — ölü düğmeler yok, devre dışı
bırakılmış yer tutucular yok. Şu anda (LAN eşleştirme aşaması henüz
uygulanmadı) Sync bölümü bu nedenle **yalnızca-API** olarak
görünür; çalışan bir eşleştirme akışı olmadan mobil-istemci arayüzü
boşa çıkardı.

LAN modu geldiğinde, ikili gate (API'ye karşı Dexie) yukarıdaki
tablodaki üç değerli gate'e dönüştürülecektir. Yalnızca-PWA
dağıtımında ölü bir kontrol öğesi oluşmaması için eşleştirme arayüzü
Dexie modunda **önceden** yeniden etkinleştirilmez.

---

## İlgili sayfalar

- [Storage katmanı](../developer/storage-layer.md) — ikili depolama soyutlaması
- [Yedekleme ve geri yükleme](../features/backup.md) — Sync olmadan manuel veri aktarımı
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
