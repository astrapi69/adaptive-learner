# Αρχιτεκτονική Sync

Ο Adaptive Learner είναι local-first: ο τρόπος Server (API) κρατά τα
δεδομένα στο σύστημα αρχείων, ο αμιγής τρόπος Browser (Dexie) στο
IndexedDB. Ο **συγχρονισμός** προορίζεται να συνδέει αυτές τις
συσκευές μέσω του τοπικού δικτύου. Η πλήρης αναφορά βρίσκεται στο
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Τρεις ρόλοι συσκευών

Η διεπαφή συγχρονισμού φαίνεται διαφορετική ανάλογα με τον ρόλο της
συσκευής — και εμφανίζεται μόνο εκεί όπου είναι αξιοποιήσιμη:

| Ρόλος | Τρόπος αποθήκευσης | Sync-UI |
|---|---|---|
| Desktop (Server) | API | δημιουργία QR, κατάσταση, «Συγχρονισμός τώρα» |
| Κινητό (Client) | Dexie | σάρωση QR / επικόλληση συνδέσμου, κατάσταση μετά το pairing |
| Μόνο-PWA | Dexie | καμία |

---

## SYNC-UI-GATE: εμφάνισε μόνο ό,τι λειτουργεί

Μια μη διαθέσιμη λειτουργία **δεν προσφέρεται** — κανένα νεκρό
κουμπί, κανένα αχνό placeholder. Επί του παρόντος (η φάση
LAN-Pairing δεν έχει υλοποιηθεί ακόμη) η περιοχή συγχρονισμού είναι
συνεπώς ορατή **μόνο σε API· χωρίς λειτουργική ροή pairing η
διεπαφή Mobile-Client θα οδηγούσε στο κενό.

Όταν φτάσει ο τρόπος LAN, το δυαδικό gate (API έναντι Dexie)
μετατρέπεται στο τριμερές gate του πίνακα παραπάνω. Η διεπαφή
pairing **δεν** επανενεργοποιείται από πριν στον τρόπο Dexie, ώστε
στο deployment Μόνο-PWA να μη δημιουργηθεί νεκρό στοιχείο
ελέγχου.

---

## Σχετικές σελίδες

- [Storage-Layer](../developer/storage-layer.md) — η διπλή αφαίρεση αποθήκευσης
- [Backup και επαναφορά](../features/backup.md) — χειροκίνητη μεταφορά δεδομένων χωρίς Sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
