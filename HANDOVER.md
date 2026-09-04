# Handover

現在の状態のスナップショット。`dwg7/height-coverage`のHANDOVER.mdと同じ位置づけ——履歴は[DECISIONS.md](DECISIONS.md)に、現在地はここに。このファイルは上書きしていく（古い内容は消える前提）。

## 現在の状態（2026-09-05時点）

- サイトは公開・動作中：https://dwg7.github.io/vientiane-planning-map/
- データパイプライン（Virgo WFS→EPSG:4326再投影→PMTiles化→`hfu/stars`でのホスティング）完了。[hfu/stars#7](https://github.com/hfu/stars/pull/7)（データソース登録）・[#8](https://github.com/hfu/stars/pull/8)（ゾーニング用style.json）ともマージ・本番反映済み
- 背景線画＋ゾーニング半透明塗りの2層構造、ホバー/クリックでのゾーン情報表示、実装済み
- ユーザーからの一連のUI改修（ホバーパネル再設計、建物線のトーンマネジメント、ラベルの最前面化、ゾーニング塗りの不透明度のズーム対応、`h`/`e`/`cos`未設定値の`-`表示）を反映済み。詳細は[DECISIONS.md](DECISIONS.md)
- ゾーニング塗り（`zoning-fill`）のクリックポップアップにGoogle Street Viewへのリンクを追加済み（`dwg7/height-coverage`の実装[e76ea1c](https://github.com/dwg7/height-coverage/commit/e76ea1c)を移植。APIキー不要のプレーンURLスキーム、編集系リンクと視覚的に分離。詳細はDECISIONS.md）
- `CASE_STUDIES.md`に世界の先行事例（ZoLa、バルセロナ、北欧、北米②、シンガポール、メデジン、GeoNodeファミリー、JICA都市・地域開発グループ）を記録済み
- dwg7横断の知見集約リポジトリ`cafebabe`へ、先行事例研究パターン・データ出自調査パターン・スタイル設計のカートグラフィー原則の3件を提供済み

## 保留中の作業

現時点でなし。

## 既知の制限（非目標、CLAUDE.md参照）

- ゾーニング・基本図データの編集機能なし（見せるだけ）
- 政治的・行政的な分析・提言はしない
- `h`/`e`/`cos`が`0`の場合は`-`表示しているが、この「未設定」判断はVirgoの正式規定文書を確認して確定したものではない（DECISIONS.md #8参照。将来疑義が生じたら再検証）
- 自動テストは未整備、手動QA中心（height-coverageと同じ状況）
