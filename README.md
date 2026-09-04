# Vientiane Planning Map

ヴィエンチャンの都市計画基本図（相当データ）とゾーニングを重ねた2次元ウェブ地図。[さっぽろ都市計画情報提供サービス](https://www.sonicweb-asp.jp/sapporo/)をデザインコンセプトの範とし、[dwg7/height-coverage](https://github.com/dwg7/height-coverage) の姉妹プロジェクトとして作られています。詳しい背景・非目標は [CLAUDE.md](CLAUDE.md)、技術判断の経緯は [DECISIONS.md](DECISIONS.md)、現在の状態・保留中の作業は [HANDOVER.md](HANDOVER.md) を参照してください。

## サイト

https://dwg7.github.io/vientiane-planning-map/

## 2層構造

1. **背景（都市計画基本図相当、線画）** — `stars.optgeo.org` の OSM planet タイル（Positronスタイルをベースに全レイヤーを塗りから線画へ変換）＋ Overture buildings タイル。建物の輪郭線は、`sources` に OSM が含まれるかどうかを実線/破線と線幅で区別しています（明度差にしなかった理由は[DECISIONS.md](DECISIONS.md)#4。高さは見ません — その判定は height-coverage の役割）。
2. **ゾーニング（前面、半透明の塗り）** — ラオス公共事業運輸省のデータ共有基盤 **Virgo** の GLUP2030（ヴィエンチャン総合都市計画2030）データ。実際のVirgo配色をそのまま使用し、不透明度はズームに応じてフェードします（[DECISIONS.md](DECISIONS.md)#7）。クリック/ホバーでゾーン名・高さ制限・建蔽率・容積率を表示（値が`0`＝未設定の場合は`-`表示）。

## データパイプライン

1. **Virgo WFSから取得**（認証不要、GeoJSON直接出力）：
   ```
   curl "https://virgo.mpwt.gov.la/geoserver/geonode/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geonode:glup2030_cdudcp_v1&outputFormat=application/json"
   ```
   63フィーチャー、CRS: EPSG:32648。内部データストアの形式（Shapefile等）に関わらず、`outputFormat=application/json` 指定によりサーバー側で直接GeoJSONへ変換されるため、追加の形式変換は不要でした。

2. **配色の検証**（GeoServerのSLDから直接JSON抽出）：
   ```
   curl "https://virgo.mpwt.gov.la/geoserver/geonode/wms?service=WMS&version=1.1.1&request=GetLegendGraphic&layer=geonode:glup2030_cdudcp_v1&format=application/json"
   ```
   19ゾーン種別すべての `fill`/`stroke` 色を実測し、CLAUDE.md記載の配色表と完全一致することを2026-09-02に確認済み。

3. **再投影**：`ogr2ogr -f GeoJSON -t_srs EPSG:4326`
4. **PMTiles化**：`tippecanoe -o glup2030.pmtiles -l zoning -zg -n "GLUP2030 Vientiane Zoning" data/glup2030_4326.geojson`（63件・76KB、z0–11）
5. **ホスティング**：[hfu/stars#7](https://github.com/hfu/stars/pull/7) で `config/martin.yaml` に登録。`https://stars.optgeo.org/glup2030_zoning/{z}/{x}/{y}` として配信。実ファイルはPRに含めず（`*.pmtiles`はgitignore対象）、Git外の転送＋ローカルパス登録という方式（`overture_buildings`のリモートURL方式とは別パターン、[DECISIONS.md](DECISIONS.md)#2）。

## 技術構成

- 静的サイト（`docs/`配下、ビルド工程なし）、MapLibre GL JS 6.6.0（ESモジュール、`hash: "map"`）
- Mercator投影固定（globe不使用 — 単一都市が対象で、fill-extrusionレイヤーも使わないため）
- `docs/app.js` はheight-coverageと同じ手法（Positronスタイルをfetch→加工→Map生成）を採用
- ホバーパネル・ゾーニングラベルのUIは、独自性より先行者の知恵を優先する方針のもと、さっぽろのサービスとNYC Planning LabsのZoLaのパターンを取り込んでいる（ゾーンコードを地図上に太字で直接ラベル表示、ホバー時にゾーン名を大きく・規制値をビビッドに表示、等）

## 謝辞

- **Virgo**（Vientiane Integrated Urban Information GIS-based Opendata Platform）: https://virgo.mpwt.gov.la/ — データセット `glup2030_cdudcp_v1`。ヴィエンチャン都DHUP/PTI/DPWT運営、JICA支援、2023-09-26ローンチ、GeoNode基盤（[CASE_STUDIES.md](CASE_STUDIES.md)参照）
- **さっぽろ都市計画情報提供サービス**: https://www.sonicweb-asp.jp/sapporo/ — デザインコンセプトの参照元
- **ZoLa**（NYC Planning Labs / NYC Department of City Planning）: https://zola.planning.nyc.gov/ — ゾーンコードの地図上ラベル表示など、UIパターンの参照元
- 建物データ: [Overture Maps](https://docs.overturemaps.org/) / [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- タイル配信: [stars.optgeo.org](https://github.com/hfu/stars)

## 非目標

- ゾーニング・基本図データそのものの編集機能（見せるだけ。データ更新はVirgo側の役割）
- 政治的・行政的な分析や提言（技術的な可視化ツールに徹する）
