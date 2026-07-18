<!-- Translation: AI-generated, pending native review -->

# リリースワークフロー

AdaptiveLearnerは主要なサブフェーズの完了ごとにリリースを行います。プロセス全体は`make sync-versions`とリリースゲートCIジョブによって自動化されており、人間が行う手順はバージョンの選択、CHANGELOG、タグの付与のみです。

## バージョニング規則

Adaptive LearnerはSemantic Versioning 2.0.0に従います。

- **メジャー (X.0.0)** — APIやアーキテクチャにおける破壊的変更。将来の大きな変更のために予約されています。
- **マイナー (X.Y.0)** — 下位互換性のある新機能。各フェーズ完了時のデフォルト（現在v1.20.0 / 34フェーズ出荷済み）。
- **パッチ (X.Y.Z)** — 下位互換性のあるバグ修正。ホットフィックスチェーン。

プレリリースタグ（`-alpha`、`-beta`、`-rc`）は使用しません。リリースは常に安定版です。

## 8ステップのリリース

### 1. 状態の確認

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

最後のタグ以降にマージされた内容を確認し、バンプの種類を決定します。

### 2. リリースノートの作成

最新のリリースの形式（Added / Fixed / Tests / Closed backlog items / Commits / Upgrade notes）に従って`changelog/releases/vX.Y.Z.md`ファイルを追加します。リリースゲートCIは、プッシュされるタグに対してこのファイルが存在することを確認します。

### 3. カノニカルバージョンの手動編集

リポジトリ全体で手動編集が必要なバージョンフィールドはここだけです。

```toml
# backend/pyproject.toml
[tool.poetry]
version = "X.Y.Z"
```

### 4. 伝播

```bash
make sync-versions
```

**18個のファイル**を自動的に更新します。

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec`（CFBundle plist + CFBundleShortVersionString）
- 10× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- 3× プラグインの`__init__.py`の`__version__`リテラル
- `install.sh`（`install.sh.template`から再生成）
- `install.ps1`（`install.ps1.template`から再生成）

### 5. 検証

```bash
make sync-versions-check     # ドリフトがあると非ゼロで終了
make test                    # 2634テストがパスする必要があります
cd frontend && bun run build # 成功する必要があります
```

リリースゲートCIワークフロー（`.github/workflows/release-gate.yml`）は、すべてのタグプッシュ時に同じ`sync-versions-check`を実行します。ローカルでは一致するがCIで失敗する場合、ローカルの確認とプッシュの間にドリフトが発生しています。

### 6. コミット + タグ

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — phase headline + summary"
```

タグメッセージはアノテーション付きで複数行とし、リリースの概要を記載します。次のステップでGitHub Releasesのノートになります。

### 7. プッシュ

```bash
git push origin main --tags
```

以下がトリガーされます。

- 新しいコミットに対して`ci.yml`（テスト）
- 新しいタグに対して`release-gate.yml`（バージョンピンドリフトチェック）
- 新しいコミットに対して`coverage.yml`（カバレッジHTML）
- 新しいコミットに対して`deploy-gh-pages.yml`（公開サイトの公開）
- GitHubがタグからReleaseを作成した際に`launcher-{linux,macos,windows}.yml`

### 8. GitHub Releaseの作成

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file`により、GitHub Releaseページがステップ2でコミットされたリリースノートと一致することを保証します。

## プラグインバージョン

プラグインはカノニカルなアプリバージョンとロックステップします。10個のプラグイン`pyproject.toml`ファイルと3つのプラグイン`__init__.py`の`__version__`リテラルすべてで同じ番号を使用します。将来の「コア vs サードパーティプラグイン」の決定でリンクが解除される可能性がありますが、v1.20.0のセットアップは18個の伝播ファイル全体で統一されています。

## ホットフィックスフロー

パッチレベルのリリース（0.X.1、0.X.2）は同じ8ステップに従います。複数のホットフィックスが連続してリリースされる場合、リリースCHANGELOGの「Hotfix history」セクションにそのチェーンを記録します。

## 離散的なプレリリース依存関係スイープコミット

リリースサイクルで依存関係（Vite、Reactなど）をバンプする場合、各バンプを独自のコミットとして保持します。理由は次の通りです。

- **bisect粒度** — リグレッションが1つのバンプに特定できます。
- **CHANGELOG可読性** — 読者が各バンプの実際の動機を把握できます。
- **ロールバック** — 問題のあるバンプを独立してリバートできます。

完全なパターンは`.claude/rules/release-workflow.md`に記載されています。rules-as-docsの規律により、人間が読めるドキュメント（このページ）と機械が読めるルールが同期を保ちます。
