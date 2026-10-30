# 自来水厂净水过程 · Lagoon 三维交互可视化

郊区净水厂工艺孪生，开敞水面与陆地改用 **[Humpalumps Ultra-Water](https://gelatin.games/ultrawater)**（MIT）的 **Lagoon** 海洋 + 岛屿地形；厂区建筑仍为原有 8 段工艺模型，置于海岸陆地平台上。中文 HUD（顶栏 / 侧栏）保留。

## 如何运行

```bash
cd /workspace/water-plant-3d
python3 -m http.server 5179
# 或
npx --yes serve -l 5179
```

浏览器打开：`http://127.0.0.1:5179/`（需 WebGL2；Three.js 经 CDN `three@0.186.1`）。

## Lagoon 默认参数

| 项 | 值 |
|----|----|
| 太阳 elevation / azimuth | **52° / 205°**（Ultra-Water `views.Lagoon`） |
| 水色 preset | **tropical**（absorption / scatter / foam / turbidity） |
| 海浪 | `windSpeed` 4.5、`waveScale` 0.45、`swellScale` 0.35（偏静潟湖） |

## Ultra-Water 厂商模块

见 `vendor/ultra-water/`（`ATTRIBUTION.md` + MIT `LICENSE`）：

- `water/` — OceanSim、OceanSurface、shoreMap、bakeTextures、Caustics、UnderwaterPass、Spray、MarineSnow、WaterQuery  
- `scene/` — sky、atmosphere、islandHeight、terrain、terrainGeometry、noise、floaterShadow  
- `engine/` — PlanarReflection、PostFX、fullscreen、gpuTimer  

渲染路径对齐 Ultra-Water：不透明 HDR MSAA → 水面 pass → underwater → PostFX。

## 操作

| 操作 | 说明 |
|------|------|
| 拖拽 / 滚轮 | 轨道旋转与缩放 |
| 点击厂区 / 左侧工艺列表 | 飞向阶段并显示中文说明 |
| 自动巡游 | 依次飞过 8 个工艺段 |
| 右下角 lil-gui | 流速、曝光、自动巡游 |

## 已知限制

- 需网络加载 CDN Three / lil-gui；GPU 需 WebGL2（GLSL3 raw passes）。  
- 原工业园大面积地坪 / 仓库背景已去掉，由 Ultra-Water 岛屿陆地替代；工艺池内仍用轻量 `createWaterSurface`。  
- 未引入 Ultra-Water 漂浮物（Floaters）；浪花粒子数量略减以照顾页面性能。  
- 厂区置于海岸平台（扫描 `islandHeight` 找较平陆地）；局部混凝土垫板保证工艺段水平。  
