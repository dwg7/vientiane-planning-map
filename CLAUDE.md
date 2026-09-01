# CLAUDE.md

**Repository:** `dwg7/vientiane-planning-map`
**Title:** Vientiane Planning Map — ヴィエンチャンの都市計画基本図＋ゾーニング統合ビューア
**Description:** さっぽろ都市計画情報提供サービス（https://www.sonicweb-asp.jp/sapporo/ ）を範とした、ヴィエンチャン市のゾーニングデータ（Virgo/GLUP2030）と都市計画基本図相当のデータ（OSM/Overture建物データ）を統合した2次元ウェブ地図。

## このプロジェクトの立ち位置（必読）

これは**姉妹プロジェクト`dwg7/height-coverage`（https://github.com/dwg7/height-coverage ）と対になる企画**であり、そのセッションでの設計検討の結果として作られた。両者の違いを正確に理解すること：

|  | `height-coverage` | `vientiane-planning-map`（このリポジトリ） |
|---|---|---|
| 主張 | 建物の**高さ属性**の入力を促す | **基本図データそのもの**の充実を促す |
| 対象範囲 | 世界中どこでも使える汎用ツール（地名をコードに固定しない） | **ヴィエンチャン固有**（Virgoのゾーニングデータに本質的に紐づく。地域非依存にする必要はない） |
| 建物の色分け基準 | 高さ・階数データの有無（OSM由来かどうか） | OSM由来かどうかのみ（高さは見ない）。**塗りではなく線画** |
| メッセージ | 「これだけの建物が高さ入力を待っている」 | 「基本図データが充実している地区ではこのレベルの都市計画行政ができる。充実していない地区では、充実させることでそれが可能になる」 |

**このリポジトリは`height-coverage`のために構築されたコードベース・データソース・dwg7の運用ノウハウを積極的に再利用する。** ゼロから再発見する必要はない。詳細は下記「height-coverageから引き継ぐ知見」を参照。

`hfu/vientiane-basemap-baseline`（プライベートリポジトリ、JICAラオス案件の予備調査本体）とは別物。政治的機微を含む分析はhfu側に留め、こちらは技術的な可視化ツールに徹する（`height-coverage`と同じ方針）。

## 背景

`height-coverage`と同じJICAラオス案件（ヴィエンチャン・チャンタブリー郡）が出発点。「地図を作ることが目的ではなく、計画を進めることが目的」という原則のもと、「高さ入力を促す」`height-coverage`に続き、**「基本図データの充実そのものを促す」**ための訴求ツールとして企画された。

さっぽろ都市計画情報提供サービスのような、ゾーニング（用途地域・容積率・建蔽率等）と都市計画基本図が統合されたウェブ地図を、基本図データが必ずしも充実していないヴィエンチャンに適用したらどう見えるか、を実際に作って見せることが目的。基本図データが充実している地区では実際にこのレベルの行政ができるイメージを、そうでない地区では基本図データを充実させることの重要性を、視覚的に伝える。

## コンセプト（2層構造）

1. **背景（都市計画基本図相当）**：`height-coverage`と同じデータソース（`stars.optgeo.org`のOSM planetタイル＋Overture buildingsタイル）を再利用するが、スタイルは全く別物。**塗りは一切使わず線画中心**（塗りはゾーニング層の専有物とする。合成後のスタイルに残る`fill`タイプのレイヤーは`zoning-fill`と、非常に淡い`background`色だけであること — 新しいレイヤーを足すときもこの不変条件を破らない）。
   - 建物：`type: "line"`の輪郭線のみ、無彩色。`sources`フィールドに`provider:"osm"`を含むかどうかで判定（`height-coverage`の`HAS_OSM_SOURCE`フィルタ式をそのまま再利用可能、高さの判定は不要）。**ただし色分けは明度差ではなくダッシュパターン・線幅で行う**（実装時の実地の指摘で修正 — 経緯は[DECISIONS.md](DECISIONS.md)参照。ゾーニングの塗りの上に乗る線なので、明度差は「意図しない別の意味」を持つように見えてしまう）。
   - 水域・土地利用・土地被覆・公園：`fill`ではなく境界線のみ。線の色調はPositron本来の淡いトーンを踏襲し、建物線とも統一する（道路の白いケーシングが視覚的な主役であり続けるように、背景線画は全体的に淡く静かに）。
   - 道路・地名ラベル：Positronスタイルをベースに、線画としての硬質さを保つ。
2. **ゾーニング（前面、半透明の塗り）**：Virgo（ラオス公共事業運輸省のデータ共有基盤）のゾーニングデータをPMTiles化して重ねる。色相はVirgoの実際の配色をそのまま使用し、不透明度を50〜60%程度に落として下の基本図が透けるようにする。クリック/ホバーでゾーン名・高さ制限・建蔽率・容積率を表示。

## Virgoデータ（調査済み・そのまま使える）

**Virgoとは：** 正式名称 "Vientiane Integrated Urban Information GIS-based Opendata Platform"。ヴィエンチャン都のDHUP（住宅都市計画局）・PTI（公共事業交通研究所）・DPWT（公共事業交通局）が共同運営し、**JICA（国際協力機構）の支援**で構築、2023年9月26日ローンチ（[About](https://virgo.mpwt.gov.la/about/)）。基盤技術は**GeoNode**（オープンソースの空間データ基盤ソフトウェア）— World Bank GFDRR/OpenDRIプログラムがハイチ・ベリーズ・モザンビーク等25カ国以上で導入してきたのと同じ系譜の技術（ドナーはWorld BankではなくJICA）。詳細は[CASE_STUDIES.md](CASE_STUDIES.md)参照。

**データセット：** `glup2030_cdudcp_v1`（ヴィエンチャン総合都市計画2030 / GLUP2030）。**"2030"の由来：** JICAが2010年1月〜2011年3月に実施した「ヴィエンチャン都市圏開発マスタープラン策定調査」の成果物 "Vientiane Master Plan 2030" (VMP2030) がこのデータの源流（[CASE_STUDIES.md](CASE_STUDIES.md)参照）。
**カタログページ：** https://virgo.mpwt.gov.la/catalogue/#/dataset/252 （SPAなので直接fetchでは中身が見えない。以下のAPI/OWSエンドポイントを使うこと）

**REST APIでのメタデータ取得：**
```
GET https://virgo.mpwt.gov.la/api/v2/datasets/252/
```
認証不要、JSON。`title`はラオス語（"ແຜນຜັງລວມຕົວເມືອງນະຄອນຫລວງວຽງຈັນ ຮອດປີ2030" = ヴィエンチャン都市圏マスタープラン2030）。

**WFSでのフィーチャー取得（認証不要、GeoJSON）：**
```
GET https://virgo.mpwt.gov.la/geoserver/geonode/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geonode:glup2030_cdudcp_v1&outputFormat=application/json
```
- 63フィーチャー、CRS: **EPSG:32648**（UTM zone 48N。EPSG:4326へ再投影が必要）
- 属性：
  - `zoning`：ゾーンコード（例：`UDb`, `UAa`, `Zpp-Ua` 等、19種類）
  - `zone_name`：英語のゾーン名（一部切り詰められている個体あり）
  - `h`：高さ制限（メートル、整数）
  - `e`：建蔽率（0〜1の小数、例 0.5 = 50%）
  - `cos`：容積率（Coefficient d'Occupation des Sols、小数、例 2 = 200%）

**ゾーン別配色（GeoServerのSLD/GetLegendGraphicから抽出済み。Virgo公式の配色そのもの）：**

```
GET https://virgo.mpwt.gov.la/geoserver/geonode/wms?service=WMS&version=1.1.1&request=GetLegendGraphic&layer=geonode:glup2030_cdudcp_v1&format=application/json
```
で再取得・検証可能。2026年時点で確認した値：

| zoning | zone_name（ラオス語ラベルより） | fill |
|---|---|---|
| Zpp-Ua | ເຂດປົກປັກຮັກສາເມືອງເກົ່າ（旧市街保護区） | `#7030A0` |
| Zpp-Ub | ເຂດສະຖານບູຮານ（史跡区） | `#5A2A82` |
| UAa | ເຂດສູນການຄ້າ ແລະ ປົກຄອງ（商業・行政中心区） | `#FF0101` |
| UBa | ເຂດອ້ອມໃຈກາງເມືອງທີ່ນອນໃນແລວການບິນ（都心周辺・航空制限区） | `#D60093` |
| UBb | ເຂດອ້ອມໃຈກາງເມືອງ（都心周辺区） | `#FF66CC` |
| UCa | ເຂດລຽບແມ່ນໍ້າທີ່ນອນໃນແລວການບິນ（河岸・航空制限区） | `#FFC002` |
| UCb | ເຂດລຽບແມ່ນໍ້າຂອງ（メコン河岸区） | `#FFD966` |
| UDa | ເຂດອ້ອມຮອບຕົວເມືອງທີ່ນອນໃນແລວການບິນ（市街周辺・航空制限区） | `#FFF2CC` |
| UDb | ເຂດອ້ອມຮອບຕົວເມືອງທີ່ຕິດພັນກັບກະສິກໍາ（市街周辺・農地隣接区） | `#F5EC3D` |
| UF | ເຂດບ້ານທີອ້ອມຮອບດ້ວຍທົ່ງນາ（水田に囲まれた集落区） | `#7F6000` |
| UEa | ເຂດຂະຫຍາຍຕົວເມືອງ（市街拡張区） | `#9DC3E6` |
| UEb | ເຂດສົ່ງເສີມການພັດທະນາຕົວເມືອງ（市街開発促進区） | `#2E75B6` |
| UEi | ເຂດອຸສາຫະກຳ（工業区） | `#C9C9C9` |
| T | ເຂດຂົນສົ່ງ（交通区） | `#8BE1E5` |
| Ta | ເຂດຂົນສົ່ງທາງອາກາດ（航空交通区） | `#8BE1E5` |
| Ef | ເຂດການສຶກສາ（教育区） | `#8BE1E5` |
| Em | ເຂດທະຫານ ແລະ ເຂດປ້ອງກັນຊາດ（軍事・国防区） | `#8E7536` |
| N | ເຂດກະສິກຳ（農業区） | `#A6D86E` |
| NE | ເຂດສະຫງວນເພື່ອນໍາໃຊ້ສາທາລະນະ（公共利用保全区） | `#278A22` |

ストローク色は個体差があるが概ね`#777777`〜`#9b9b9b`のグレー。実装前にGetLegendGraphicで再取得して検証すること（データが更新されている可能性があるため）。

## データパイプライン（このリポジトリで実施すること）

1. 上記WFSでGeoJSON取得
2. EPSG:32648 → EPSG:4326へ再投影（`ogr2ogr`等）
3. `tippecanoe`でPMTiles化（63件と小規模。過度な簡略化は不要、広いズーム帯でそのまま出せる）
4. 生成したPMTilesをこのリポジトリ（または適切な場所）に置き、`stars`エージェントに依頼して`config/martin.yaml`にリモートソースとして登録してもらう（`height-coverage`の`overture_buildings`と同じ、ローカルコピー不要の`pmtiles.sources`パターン）
5. ゾーニング用の新規`style.json`（上記配色を反映、半透明、ラベルつき）を作成し、`hfu/stars`リポジトリへPRする（`CONTRIBUTING.md`のゲートキーパーフローに従う。`height-coverage`が`styles/positron.json`を追加した[PR #5](https://github.com/hfu/stars/pull/5)が実例）
6. マージ・本番反映後、`stars.optgeo.org/style/<名前>`として利用可能になる

## height-coverageから引き継ぐ知見（再発見しないこと）

### 技術スタック・dwg7の慣習
- MapLibre GL JS **6.x系はESモジュールのみ**（UMDバンドル廃止）。`<script type="module" src="app.js">`＋`import * as maplibregl from "https://unpkg.com/maplibre-gl@6.x.x/dist/maplibre-gl.mjs"`で読み込む。`window.maplibregl`グローバルは存在しない。
- `hash: true`ではなく**`hash: "map"`**を使う（URLハッシュを`#map=z/lat/lng/bearing/pitch`として名前空間化）。
- **globe投影とfill-extrusionレイヤーの組み合わせは`queryRenderedFeatures()`のビューポート全体クエリを壊す**（詳細：`height-coverage`のDECISIONS.md項目9追記）。このプロジェクトはヴィエンチャン単独都市が対象でglobeにする必然性が薄く、かつ建物はどのみち塗りでなく線画なので実害は出にくいはずだが、**fill-extrusionを使う予定がない限りglobeは避けるかmercator固定を推奨**。
- ホスティングはGitHub Pages（`docs/`フォルダ、ビルド工程なし）。`main`ブランチの`docs/`をソースに設定。
- 左上パネル（凡例・統計等）はヘッダークリックで折りたたみ可能にする。
- ホバー時に、分類ロジックが実際に読んでいる属性だけに絞った小さなパネルを出す（`height-coverage`のパターン。全属性ダンプはノイズになるので避ける）。

### stars.optgeo.orgとの連携
- `stars.optgeo.org`は別セッション（`stars-21`という名前で本環境からアクセス可能）が運用。`hfu/stars`リポジトリの`CONTRIBUTING.md`にPRベースの貢献フローが明文化されている。
- 新規スタイルファイル追加時は**Martinの再起動が必要**（既存ファイル更新と違い、新規ファイルは起動時のディレクトリスキャンでしか認識されないため）。
- PRを出す前に、diffが「意図した変更だけか」を自分でも整形済みupstreamとdiffして検証してからPR説明に書くこと（レビュー側も同様に検証するので、事前確認が手戻りを減らす）。

### 建物データ
- 建物レイヤーは`stars.optgeo.org/overture_buildings`（Overture Maps buildingsスキーマ、smellman/Taro Matsuzawa氏のPMTilesをstarsがプロキシ）。`building`ソースレイヤーのフィールドは`sources`（JSON配列文字列、各要素`{"provider": "osm"|"microsoft"|"google", ...}`）。
- OSM由来かどうかの判定は`height-coverage`の`HAS_OSM_SOURCE`フィルタ式をそのまま流用可能：
  ```js
  const HAS_OSM_SOURCE = [
    "case",
    ["has", "sources"],
    ["in", "\"provider\":\"osm\"", ["get", "sources"]],
    false,
  ];
  ```
  （高さ判定用の`@height_source`はこのプロジェクトでは不要）

## 引用・謝辞（必須、.mdファイルに明記）

- **Virgo**（ラオス公共事業運輸省データ共有基盤）：https://virgo.mpwt.gov.la/ 、データセット`glup2030_cdudcp_v1`
- **さっぽろ都市計画情報提供サービス**：https://www.sonicweb-asp.jp/sapporo/ — このプロジェクトのデザインコンセプトの参照元
- **ZoLa**（NYC Planning Labs / NYC Department of City Planning）：https://zola.planning.nyc.gov/ — ゾーンコードを地図上に太字ラベル表示する等、UIパターンの参照元。沿革・現状の調査は[DECISIONS.md](DECISIONS.md)#5参照

`README.md`または`CREDITS.md`に必ず記載すること。UIは独自性より、さっぽろ・ZoLaのような先行事例のパターンを踏まえることを優先する（ユーザー方針、2026-09-02）。

## やらないこと（非目標）

- ゾーニング・基本図データそのものをこのサイトから編集する機能（見せるだけ。データ更新はVirgo側の役割）。
- 政治的・行政的な分析や提言（技術的な可視化ツールに徹する。分析は`hfu/vientiane-basemap-baseline`側の役割）。
- globe投影・fill-extrusionの無理な使用（上記「引き継ぐ知見」参照）。

## 参考リンク

- 姉妹プロジェクト：https://github.com/dwg7/height-coverage （このプロジェクトの設計はここでの会話から生まれた。特にCLAUDE.md/DECISIONS.mdを参照）
- Virgoカタログ：https://virgo.mpwt.gov.la/catalogue/#/dataset/252
- さっぽろ都市計画情報提供サービス：https://www.sonicweb-asp.jp/sapporo/
- stars運用リポジトリ：https://github.com/hfu/stars （CONTRIBUTING.mdに貢献フロー）
- Positronスタイル（背景の出発点）：https://stars.optgeo.org/style/positron
- ZoLa（NYC's Zoning & Land Use Map）：https://zola.planning.nyc.gov/ 、開発元リポジトリ：https://github.com/NYCPlanning/labs-zola
- このプロジェクト自身の技術判断の経緯ログ：[DECISIONS.md](DECISIONS.md)
- 世界の先行事例調査（バルセロナ・北欧・北米②・シンガポール・メデジン・GeoNodeファミリー）：[CASE_STUDIES.md](CASE_STUDIES.md)
- 関連リポジトリ（同じJICAラオス案件、プライベート）：`hfu/vientiane-basemap-baseline`
