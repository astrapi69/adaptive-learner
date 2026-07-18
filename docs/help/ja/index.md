<!-- Translation: AI-generated, pending native review -->

# Adaptive Learner へようこそ

Adaptive Learner は、6 つの学習メソッドと 7 ステップの学習サイクルに基づいた
適応型学習プラットフォームです。あなたが ChatGPT で学習してきたことを続けながら、
より体系的かつ効果的に進めることができます。

## 最初に読む

- 初めての方: [はじめに](user-guide/getting-started.md) から始めてください。
- アプリの仕組みを理解したい方: [哲学と設計](concept/philosophy.md) を参照してください。
- セッションをすぐ開始したい方: [学習セッション](user-guide/learning-session.md) をご覧ください。

---

## ユーザーガイド

| ドキュメント | 内容 |
|---|---|
| [はじめに](user-guide/getting-started.md) | インストール、前提条件、最初の 5 分間 |
| [アセスメント](user-guide/assessment.md) | 12 の質問、レーダーチャート、学習プロフィール |
| [オンボーディング](user-guide/onboarding.md) | プロジェクト作成、目標設定 |
| [ダッシュボード](user-guide/dashboard.md) | XP・ストリーク・バッジ、進捗タイムライン |
| [学習セッション](user-guide/learning-session.md) | 7 ステップサイクル、AI ガイダンス、評価 |
| [カリキュラム](user-guide/curriculum.md) | トピックツリー、レッスン、リッチテキスト編集 |
| [進捗](user-guide/progress.md) | トレンド洞察、コミット履歴、エクスポート |
| [レッスン](user-guide/lessons.md) | コンテンツレッスン、SRS、レビューキュー |
| [ミッション](user-guide/missions.md) | 毎日のミッション、設定 |
| [マイレッスン](user-guide/my-lessons.md) | レッスンの作成・保存・共有 |
| [お祝い](user-guide/celebrations.md) | フィードバック強度、称賛フレーズ、サウンド |
| [設定](user-guide/settings.md) | AI プロバイダー、ストレージ、音声、外観 |
| [FAQ](user-guide/faq.md) | よくある質問と回答 |

---

## コアコンセプト

| ドキュメント | 内容 |
|---|---|
| [哲学と設計](concept/philosophy.md) | なぜこのアプローチか |
| [7 ステップサイクル](concept/seven-steps.md) | 各ステップの詳細 |
| [6 つの学習メソッド](concept/six-methods.md) | メソッドの比較 |
| [ツールとテクニック](concept/tools.md) | 間隔反復、能動的想起、AI プロンプト |
| [進捗トラッキング](concept/tracking.md) | git に着想を得たモデル、ゲーミフィケーション |

---

## 開発者向け

| ドキュメント | 内容 |
|---|---|
| [セットアップ](developer/setup.md) | 前提条件、インストール、実行 |
| [アーキテクチャ](developer/architecture.md) | 4 層構造、デュアルストレージ |
| [プラグインガイド](developer/plugin-guide.md) | プラグインの作成 |
| [ストレージ層](developer/storage-layer.md) | IStorageService、ApiStorage、DexieStorage |
| [AI 統合](developer/ai-integration.md) | フック、プロバイダー追加 |
| [デプロイメント](developer/deployment.md) | ローカル・Docker・GH Pages |
| [テスト](developer/testing.md) | テストピラミッド、Vitest、Playwright |
| [i18n](developer/i18n.md) | 8 言語、YAML カタログ |
| [テーマ](developer/themes.md) | 6 テーマシステム、CSS トークン |
| [リリース](developer/release.md) | バージョニング、リリースフロー |
| [コンテンツ作成](developer/authoring-content.md) | レッスンセット、スキーマ、バリデーション |
| [お祝い層](developer/celebrations.md) | EXP-008 実装詳細 |
| [レッスンと SRS](developer/lessons-and-srs.md) | ElementError、SRS スケジューリング |
| [ミッション](developer/missions.md) | EXP-010 実装詳細 |

---

## API リファレンス

| ドキュメント | 内容 |
|---|---|
| [概要](api/overview.md) | ベース URL、認証、レスポンス形式 |
| [コアエンドポイント](api/core-endpoints.md) | ユーザー、プロジェクト、設定 |
| [プラグインエンドポイント](api/plugin-endpoints.md) | アセスメント、セッション、ゲーミフィケーション |
| [フック](api/hooks.md) | 全 10 のフックスペック |
| [データモデル](api/models.md) | SQLAlchemy モデル、Pydantic スキーマ |

---

## 現在の状態

最新バージョンとその変更点は
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases)
を参照してください。履歴の詳細は
[CHANGELOG](https://github.com/astrapi69/adaptive-learner/blob/main/docs/CHANGELOG.md) を参照してください。

[GitHub でフィードバックを送る](https://github.com/astrapi69/adaptive-learner/issues){ .md-button }
