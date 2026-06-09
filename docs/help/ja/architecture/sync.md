# 同期アーキテクチャ

Adaptive Learner はローカルファーストです。サーバーモード（API）は
データをファイルシステムに保持し、ブラウザのみのモード（Dexie）は
IndexedDB に保持します。**同期**は、これらのデバイスをローカル
ネットワーク経由で接続することを目的としています。完全な
リファレンスは
[`docs/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/SYNC-ARCHITECTURE.md)
にあります。

---

## 3 つのデバイスの役割

同期の UI は、デバイスの役割に応じて異なって見えます。そして、
それが使える場所でのみ表示されます。

| 役割 | ストレージモード | 同期 UI |
|---|---|---|
| デスクトップ（サーバー） | API | QR を生成、ステータス、「今すぐ同期」 |
| モバイル（クライアント） | Dexie | QR をスキャン／リンクを貼り付け、ペアリング後のステータス |
| PWA のみ | Dexie | なし |

---

## SYNC-UI-GATE：動作するものだけを表示する

利用できない機能は**提供されません** — 機能しないボタンも、
グレーアウトされたプレースホルダーもありません。現在
（LAN ペアリングフェーズはまだ実装されていません）、同期セクションは
そのため**API のみ**で表示されます。ペアリングのフローが機能しなければ、
モバイルクライアントの UI は行き場を失ってしまうからです。

LAN モードが実装されると、バイナリのゲート（API か Dexie か）は、
上の表にある 3 値のゲートに作り直されます。ペアリング UI は、
PWA のみのデプロイで機能しない操作要素が生まれないよう、それ
**以前に** Dexie モードで再有効化されることはありません。

---

## 関連ページ

- [ストレージレイヤー](../developer/storage-layer.md) — デュアルストレージの抽象化
- [バックアップと復元](../features/backup.md) — 同期なしの手動データ転送
- [`docs/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/SYNC-ARCHITECTURE.md)
