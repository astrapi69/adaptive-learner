<!-- Translation: AI-generated, pending native review -->

# リリースワークフロー

リリースは手作業ではなく、2つのワークフローで行います。`release.yml` はリリースブランチを切り、バージョンを設定し、何かをプッシュする前に完全なゲートを実行します。`release-finish.yml` は `main` にマージし、タグを付け、リリースを下書きとして作成します。拘束力のある手順は `.claude/rules/release-workflow.md` にあり、このページはその概要です。

## バージョニング規則

Adaptive LearnerはSemantic Versioning 2.0.0に従います。

- **メジャー (X.0.0)** - APIやアーキテクチャにおける破壊的変更。将来の大きな変更のために予約されています。
- **マイナー (X.Y.0)** - 下位互換性のある新機能。各フェーズ完了時のデフォルト（現在v1.20.0 / 34フェーズ出荷済み）。
- **パッチ (X.Y.Z)** - 下位互換性のあるバグ修正。ホットフィックスチェーン。

プレリリースタグ（`-alpha`、`-beta`、`-rc`）は使用しません。リリースは常に安定版です。

## 手順の流れ

1. **develop 上で、プルリクエストによって**: リリースノート `changelog/releases/vX.Y.Z.md`、ヘルプページの「新機能」セクション、依存関係の更新。ノートのファイルがなければワークフローは開始しません。
2. **リハーサル**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` はブランチを切り、バージョンを設定し、ランナー上でゲートを実行しますが、何もプッシュしません。
3. **カット**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`。ゲートが緑であれば `release/X.Y.Z` ブランチがプッシュされ、それ以降 develop は凍結されます。
4. **ブランチの確認**: イメージのビルド、セキュリティスキャン、WebKit ゲート、画像比較、3つのランチャービルドをリリースブランチ上で手動起動します。ワークフローがプッシュしたブランチは、これらを自動では開始しません。
5. **フィニッシュ**: `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` は fast-forward なしで `main` にマージし、マージコミットにタグを付け、リリースを develop に戻すプルリクエストを開き、GitHub リリースを下書きとして作成します。
6. **公開**: `publish-image.yml` がイメージを公開して検証し、緑の `main` ビルドのランチャーバイナリを添付し、その後に初めて下書きを公開します。

### バージョンは1か所で設定する

`backend/pyproject.toml` が唯一の情報源です。カットがそれを設定し、`make sync-versions` がバージョンを持つ他のすべてのファイルを書き換えます（全体の集合は `scripts/sync_versions.py` の `collect_targets()`）。バージョンのフィールドを手で編集する人はいません。`release-gate.yml` がタグでもう一度確認します。

### 何が何を起動するか

- `main` へのプッシュ: `ci.yml`、`deploy-gh-pages.yml`、ランチャービルド
- タグ: `release-gate.yml`
- 下書きのリリース: 何も起動しない。イメージとバイナリは公開の手順で付く

`coverage.yml` はプッシュでは実行されず、毎晩および必要に応じて実行されます（`gh workflow run coverage.yml --ref main`）。

## プラグインバージョン

プラグインはカノニカルなアプリバージョンとロックステップします。すべてのプラグインの`pyproject.toml`と、プラグインの`__init__.py`の`__version__`リテラルで同じ番号を使用します。将来の「コア vs サードパーティプラグイン」の決定でリンクが解除される可能性がありますが、現在のセットアップは伝播されるすべてのファイルで統一されています。

## ホットフィックスフロー

ホットフィックスは手作業で行う唯一のリリースです。2つのワークフローはどちらも `main` から切ることができません。`main` から `hotfix/vX.Y.Z` ブランチを作り、修正し、バージョンを設定してノートを書き、`release-prepare.yml` でブランチを検証し、その後 `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` と `make release-publish VERSION=X.Y.Z` を実行します。

プッシュ済みのタグは決して削除も移動もしません。誤ったリリースは次のバージョンで訂正します。

## 離散的なプレリリース依存関係スイープコミット

リリースサイクルで依存関係（Vite、Reactなど）をバンプする場合、各バンプを独自のコミットとして保持します。理由は次の通りです。

- **bisect粒度** - リグレッションが1つのバンプに特定できます。
- **CHANGELOG可読性** - 読者が各バンプの実際の動機を把握できます。
- **ロールバック** - 問題のあるバンプを独立してリバートできます。

完全なパターンは`.claude/rules/release-workflow.md`に記載されています。rules-as-docsの規律により、人間が読めるドキュメント（このページ）と機械が読めるルールが同期を保ちます。
