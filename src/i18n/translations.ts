// Copyright (C) 2026 Zichao Zeng
//
// This file is part of ChartExtractor.
// ChartExtractor is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// ChartExtractor is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
// (see <https://www.gnu.org/licenses/>)
/**
 * 国际化翻译表（中/英双语）
 * 默认中文；用户可在菜单栏切换语言，选择持久化到 localStorage。
 */
export type Lang = "zh" | "en";
export const translations = {
  zh: {
    // 菜单栏
    "menu.file": "文件",
    "menu.edit": "编辑",
    "menu.view": "视图",
    "menu.theme": "主题",
    "menu.tools": "工具",
    "menu.help": "帮助",
    "menu.file.import": "导入图片/PDF…",
    "menu.file.openProject": "打开工程…",
    "menu.file.openSample": "打开示例工程…",
    "menu.file.saveProject": "保存工程…",
    "menu.file.recentFiles": "最近文件",
    "menu.file.noRecent": "无最近文件",
    "menu.edit.undo": "撤销",
    "menu.edit.redo": "重做",
    "menu.edit.deleteLastPoint": "删除最后一个点",
    "menu.edit.clearDataset": "清空当前数据集",
    "menu.view.zoomFit": "缩放适应",
    "menu.view.showMask": "显示掩码",
    "menu.tools.colorPick": "拾色模式",
    "menu.tools.gridDetect": "识别网格线（辅助预览）",
    "menu.help.shortcuts": "快捷键说明",
    // Ribbon
    "ribbon.import": "导入",
    "ribbon.calibrate": "标定",
    "ribbon.extract": "取点",
    "ribbon.export": "导出",
    "ribbon.undo": "撤销",
    "ribbon.redo": "重做",
    "ribbon.save": "保存",
    "ribbon.colorPick": "拾色",
    "ribbon.mask": "掩码",
    // 主题
    "theme.light": "浅",
    "theme.dark": "深",
    "theme.system": "系统",
    // 语言
    "lang.label": "中/EN",
    // 向导导航
    "wizard.import": "导入",
    "wizard.import.desc": "拖拽/打开/粘贴",
    "wizard.calibrate": "标定",
    "wizard.calibrate.desc": "坐标标定",
    "wizard.extract": "取点",
    "wizard.extract.desc": "手动/自动",
    "wizard.export": "导出",
    "wizard.export.desc": "xlsx/CSV/JSON",
    "wizard.recentFiles": "最近文件",
    // 提示条
    "hint.empty":
      "从空白开始：拖入图片/PDF，或点击「导入」。支持 {formats}，PDF 可导入。",
    "hint.imageReady":
      "图像已就绪：点击「标定」或左侧「标定」步骤，开始坐标标定。",
    "hint.calibrating": "点击图上 P{n}（{label}）的实际位置",
    "hint.calibrating.done":
      "4 个位置已标记 ✓ 请在右侧填入真实坐标值，然后点击「完成标定」。",
    "hint.calibrated":
      "标定完成（残差 {residual}px）✓ 点击「取点」开始手动或自动取点。",
    "hint.extracting":
      "取点中：左键加点 / 右键删点或编辑 / 表格可直接改值；右侧可自动追踪曲线与散点。",
    "hint.exporting":
      "导出预览：确认数据无误后，选择数据集与格式，点击「导出」。",
    // 大字号操作引导
    "guide.calibrate.title": "请在图表中点击 P{n} 的位置（{label}）",
    "guide.calibrate.done":
      "所有标定点已放置，请在下方填写真实坐标值后点击「完成标定」",
    "guide.calibrate.sub": "已放置 {placed}/4 · 已填值 {values}/4",
    "guide.extract.title": "左键点击图表添加数据点",
    "guide.extract.sub":
      "右键命中点可删除/编辑 · 拖拽已有点可改位 · Delete 删除末点",
    // 导入面板
    "panel.import.title": "导入图表",
    "panel.import.help.withImage":
      "图像已导入，点击下方按钮开始标定，或从顶部「导入」更换图像。",
    "panel.import.help.noImage": "支持以下导入方式：",
    "panel.import.openFile": "打开文件",
    "panel.import.changeImage": "更换图像",
    "panel.import.openSample": "打开示例工程",
    "panel.import.startCalibrate": "开始标定",
    "panel.import.help.drag": "• 拖拽图片/PDF 到窗口",
    "panel.import.help.paste": "• Ctrl+V 粘贴截图",
    "panel.import.help.formats": "• 支持 {formats}，PDF 可导入",
    "panel.import.help.pdfPages": "• 多页 PDF 可在导入后切换页面",
    "panel.import.help.sample": "• 没有图表？先「打开示例工程」体验完整流程",
    "panel.import.pdfPages": "多页 PDF：选择页面",
    "panel.import.pdfPage": "第 {n} 页",
    // 标定面板
    "panel.calibrate.title": "坐标标定",
    "panel.calibrate.xScaleType": "X轴类型",
    "panel.calibrate.yScaleType": "Y轴类型",
    "panel.calibrate.linear": "线性",
    "panel.calibrate.log": "对数",
    "panel.calibrate.snap": "吸附水平/垂直",
    "panel.calibrate.help":
      "点击图上 P1→P4 的位置（顺序即 Xmin / Xmax / Ymin / Ymax），再在下方填写真实坐标值。已放置的点可直接点击重新定位。",
    "panel.calibrate.pointsTitle": "标定点与数值",
    "panel.calibrate.placeholder": "输入真实值",
    "panel.calibrate.axisMeta": "轴名称与单位",
    "panel.calibrate.xLabel": "X 名称",
    "panel.calibrate.xUnit": "X 单位",
    "panel.calibrate.yLabel": "Y 名称",
    "panel.calibrate.yUnit": "Y 单位",
    "panel.calibrate.axisHelp":
      "导出时作为表头/列名，如「时间(s)」；留空则使用 X / Y。",
    "panel.calibrate.commit": "完成标定",
    "panel.calibrate.calibrating": "标定位置 {n}/4",
    "panel.calibrate.cancel": "取消标定",
    "panel.calibrate.reset": "重置标定点",
    // 取点面板
    "panel.extract.calibInfo": "标定信息",
    "panel.extract.recalibrate": "重新标定",
    "panel.extract.residual.good": "良好",
    "panel.extract.residual.bad": "偏大，建议复核",
    "panel.extract.datasets": "数据集",
    "panel.extract.addDataset": "+ 新增数据集",
    "panel.extract.manualPick": "手动取点",
    "panel.extract.manualHelp":
      "左键点击添加数据点；拖拽已有点可改位\n右键命中点可删除/编辑\nDelete 删除最后一个点",
    "panel.extract.tableHint":
      "黄色行 = 疑似异常点（越界/重复/非数值）。可直接改值（失焦提交，可撤销），📋 复制，🗑 删除。",
    "panel.extract.deleteLast": "删除末点",
    "panel.extract.clear": "清空",
    "panel.extract.autoDetect": "自动检测",
    "panel.extract.dataTable": "数据表 ({n} 点)",
    // 自动检测
    "detect.intro":
      "自动检测 = 让软件按颜色自动找出图里的数据点，适合规整的折线图与散点图。推荐流程：先用下方「颜色分割」把目标线/点从背景中抠准（建议勾选实时预览、边调边看），再点「追踪曲线」或「检测散点」。结果会在画布上以半透明点预览，确认后再「追加 / 替换」到当前数据集。",
    "detect.flow.pickColor": "① 选颜色",
    "detect.flow.pickColor.desc": "挑出要提取的线/点颜色",
    "detect.flow.genMask": "② 生成掩码",
    "detect.flow.genMask.desc": "软件据此生成黑白区域图",
    "detect.flow.track": "③ 追踪",
    "detect.flow.track.desc": "按掩码自动连曲线/找散点",
    "detect.colorSeg": "颜色分割",
    "detect.colorSeg.sub": "· 决定哪些像素算「目标」",
    "detect.colorSeg.tip":
      "颜色分割把图像按颜色二值化：与你选定颜色相近的像素标为「目标」（白色），其余为「背景」（黑色）。生成的黑白图（掩码）是后续曲线 / 散点检测的唯一依据——掩码抠得准，结果才准。",
    "detect.fgColor": "前景色",
    "detect.pick": "拾取",
    "detect.cancelPick": "取消拾取",
    "detect.pickTip":
      "点「拾取」后，在画布上点一下即可吸管取色（建议点在目标线 / 点上）。",
    "detect.mode": "模式",
    "detect.mode.fg": "前景匹配",
    "detect.mode.bg": "背景排除",
    "detect.mode.fg.desc":
      "只保留接近前景色的像素，适合在浅色 / 杂乱背景上提取一种彩色曲线或散点。",
    "detect.mode.bg.desc":
      "保留所有「不像背景色」的像素，适合白底图，可一键剔除坐标轴线、网格、文字。",
    "detect.tolerance": "颜色容差",
    "detect.tolerance.tip":
      "0–255。越大允许的颜色偏差越大、抓得越宽（但易带入噪点 / 网格线）；越小越严格（可能漏掉浅色区域）。先用 100–150 试，再微调。",
    "detect.livePreview": "实时预览掩码（调参即见）",
    "detect.livePreview.tip":
      "勾选后，调颜色 / 容差时画布立即显示掩码，方便边调边看。建议常开。",
    "detect.curveTrack": "曲线自动追踪",
    "detect.curveTrack.sub": "· 适合折线图 / 平滑曲线",
    "detect.curveTrack.tip":
      "沿水平方向逐列扫描掩码，取每列目标区域的中心，连成曲线。每列只取一个代表点，因此适合「一个 X 对应一个 Y」的折线图。",
    "detect.xStep": "X步长(px)",
    "detect.xStep.tip":
      "相邻取样列的间距。越小点越密、越贴合细节（也越慢）；曲线平缓时可设大些（如 10–20）提速。",
    "detect.yStep": "Y步长(px)",
    "detect.yStep.tip":
      "每列内纵向搜索的精细度。一般与 X 步长一致即可；曲线很陡时可适当减小以提高精度。",
    "detect.smoothing": "三次样条平滑",
    "detect.smoothing.tip":
      "勾选后对追踪点做平滑插值，曲线更顺滑自然；取消则保留原始采样点。",
    "detect.trackCurve": "追踪曲线",
    "detect.blobDetect": "散点自动检测",
    "detect.blobDetect.sub": "· 适合散点图",
    "detect.blobDetect.tip":
      "在掩码里寻找一个个彼此独立的小色块（连通域），取其中心作为数据点。因此适合一个个分离的圆点，不适合连成线的折线。",
    "detect.minDiameter": "最小直径",
    "detect.minDiameter.tip":
      "只保留直径不小于此值的色块，用来过滤掉细网格线、文字笔画等噪点。",
    "detect.maxDiameter": "最大直径",
    "detect.maxDiameter.tip":
      "只保留直径不大于此值的色块，用来排除大面积色块（如图例底色）。典型散点设 2–20。",
    "detect.detectBlob": "检测散点",
    "detect.gridDetect": "网格线识别",
    "detect.gridDetect.sub": "· 仅辅助预览",
    "detect.gridDetect.tip":
      "把坐标网格线以掩码高亮显示，帮助你判断刻度位置；仅预览、不产生数据点（完整去网格 / 按网格读数留作后续增强）。",
    "detect.detectGrid": "识别网格线",
    "detect.gridThreshold": "网格检测阈值",
    // 导出面板
    "panel.export.preview": "导出预览",
    "panel.export.summary":
      "共 {datasets} 个数据集，{points} 个数据点。每个数据集将导出为 Excel 的一个 Sheet / CSV 的一段 / JSON 的一个数组项。",
    "panel.export.openDialog": "打开导出对话框",
    "panel.export.back": "返回取点",
    // 导出弹窗
    "export.title": "数据导出",
    "export.summary":
      "共 {datasets} 个数据集，{points} 个数据点。每个数据集导出为 Excel 的一个 Sheet / CSV 的一段 / JSON 的一个数组项。",
    "export.selectDatasets": "选择数据集",
    "export.noDatasets": "暂无数据集",
    "export.xColumn": "X列名",
    "export.yColumn": "Y列名",
    "export.mergeMode": "多集合并",
    "export.merge.long": "长表（dataset,X,Y，pandas 可直读）",
    "export.merge.wide": "宽表（按 X 对齐）",
    "export.encoding": "编码",
    "export.encoding.utf8": "UTF-8（推荐）",
    "export.encoding.gbk": "GBK（老版WPS兼容）",
    "export.precision": "小数精度",
    "export.includeHeader": "包含表头行",
    "export.includeMetadata": "写入元信息注释行（pandas 需 comment='#' 解析）",
    "export.includeMetadata.tip": "默认关：保持 pandas.read_csv 可直接解析",
    "export.jsonNote": "JSON 始终包含数据集元信息，「包含表头」不适用。",
    "export.previewTitle": "全量预览（每集前 5 行）",
    "export.noDataSelected": "未选择任何含数据的数据集",
    "export.cancel": "取消",
    "export.confirm": "导出",
    // 状态栏
    "status.state": "状态",
    "status.unsaved": "● 未保存",
    "status.calibrated": "✓ 已标定",
    "status.notCalibrated": "○ 未标定",
    "status.residual": "· 残差 {val}px",
    "status.calibPoints": "标定点",
    "status.dataPoints": "数据点",
    "status.issues": "⚠ {n} 个点疑似异常（越界/重复/非数值）",
    "status.colorPick": "🎨 拾色模式",
    "status.canUndo": "可撤销",
    "status.canRedo": "可重做",
    "status.version": "v{version} | 纯本地离线",
    // 画布
    "canvas.empty.icon": "📊",
    "canvas.empty.title": "尚未导入图表",
    "canvas.empty.hint":
      "拖拽图片或 PDF 到此窗口，或点击顶部「导入」按钮选择文件。",
    "canvas.empty.steps": "四步提取数据",
    "canvas.empty.step1": "导入：拖入 / 打开 / Ctrl+V 粘贴图表图片或 PDF",
    "canvas.empty.step2": "标定：在图上点 4 个位置并填写其真实坐标值",
    "canvas.empty.step3": "取点：左键手动加点，或用颜色/曲线/散点自动追踪",
    "canvas.empty.step4": "导出：一键导出 xlsx / CSV / JSON",
    "canvas.zoom": "缩放",
    "canvas.coord": "坐标",
    "canvas.data": "数据",
    "canvas.calibrateGuide": "请点击 P{n}（{label}）的位置",
    "canvas.hint": "滚轮缩放 · 按住空格拖拽平移（点击关闭）",
    "canvas.ctrl.zoomOut": "缩小",
    "canvas.ctrl.zoomIn": "放大",
    "canvas.ctrl.zoomFit": "缩放适应",
    // Toast 消息
    "toast.imported": "已导入: {name}",
    "toast.imageLoadFail": "图片加载失败，可能是不支持的格式",
    "toast.confirmClear":
      "导入新图表将清空当前已标定的坐标和已提取的数据（可用 Ctrl+Z 撤销本次导入），确定继续？",
    "toast.confirmClearShort": "导入新图表将清空当前数据，确定继续？",
    "toast.calibStart": "请在图上依次点击 4 个标定点的位置",
    "toast.calibPointSet": "已标记 P{n}，请点击 P{next}（{label}）的位置",
    "toast.calibAllPlaced":
      "4 个位置已标记 ✓ 请在右侧填写真实坐标值，然后点击「完成标定」",
    "toast.calibRelocated": "已重新定位 P{n}（{label}），可继续点击微调",
    "toast.calibDone": "标定完成（残差 {residual}px{warn}）",
    "toast.calibResidualWarn": "，偏大建议复核",
    "toast.calibFail": "标定失败：标定点可能共线或数值无效，请检查",
    "toast.calibCancel": "重新标定：点击图上标定点位置（已有数值已保留）",
    "toast.pointAdded": "添加点 ({x}, {y})",
    "toast.pointMoved": "已移动点 {n} 至 ({x}, {y})",
    "toast.pointDeleted": "删除点 {n}",
    "toast.pointEdited": "编辑点 {n}",
    "toast.pointUpdated": "已更新该点",
    "toast.copied": "已复制 x,y 到剪贴板",
    "toast.copyFail": "复制失败",
    "toast.colorPicked": "已拾取颜色 RGB({r}, {g}, {b})",
    "toast.noColorPicked": "当前状态不可执行此操作",
    "toast.noCalib": "请先完成标定",
    "toast.curveStart": "曲线追踪",
    "toast.curveCancelled": "已取消曲线追踪",
    "toast.curveEmpty": "未追踪到曲线，请检查颜色选择和阈值设置",
    "toast.curveFound": "追踪到 {n} 个候选点，请在预览中确认应用方式",
    "toast.curveFail": "曲线追踪失败",
    "toast.blobCancelled": "已取消散点检测",
    "toast.blobEmpty": "未检测到散点，请调整颜色阈值或直径范围",
    "toast.blobFound": "检测到 {n} 个散点，请在预览中确认应用方式",
    "toast.blobFail": "散点检测失败",
    "toast.gridCancelled": "已取消网格识别",
    "toast.gridDone":
      "网格识别完成：垂直 {v} 条，水平 {h} 条（仅预览，不产生数据）",
    "toast.gridFail": "网格识别失败",
    "toast.detectDiscard": "已丢弃检测结果",
    "toast.detectAppend": "已追加 {n} 个点",
    "toast.detectReplace": "已替换为 {n} 个点",
    "toast.noExportData": "没有可导出的数据",
    "toast.selectDataset": "请至少选择一个含数据的数据集",
    "toast.exported": "已导出到: {path}",
    "toast.exportFail": "导出失败",
    "toast.projectSaved": "工程已保存",
    "toast.projectSaveFail": "工程保存失败",
    "toast.projectLoadFail": "工程文件加载失败",
    "toast.projectLoadFail.missingManifest": "工程文件缺少 manifest.json",
    "toast.projectLoadFail.missingProjectJson": "工程文件缺少 project.json",
    "toast.projectLoadFail.noImage": "工程文件中未找到图片",
    "toast.projectLoadFail.imageReadFail": "无法读取工程图片文件",
    "toast.projectLoadFail.corrupt": "工程文件损坏: {msg}",
    "toast.projectLoadFail.readFail": "文件读取失败: {msg}",
    "toast.projectLoaded": "工程已加载",
    "toast.imageLoadFail2": "工程图像加载失败",
    "toast.sampleLoaded": "已载入示例工程（含已标定数据与两个数据集）",
    "toast.sampleFail": "打开示例工程失败",
    "toast.noSaveData": "没有可保存的工程",
    "toast.pdfPages": "PDF 共 {n} 页，可在导入面板切换页面",
    "toast.pdfParseFail": "PDF 解析失败",
    "toast.pdfPageImported":
      "已导入第 {n} 页（标定已保留），请在新增数据集中取点",
    "toast.pdfPageFail": "PDF 第 {n} 页解析失败",
    "toast.pdfPageImgFail": "页面图像加载失败",
    "pdf.pageSuffix": "（第{n}页）",
    "toast.unsupportedFormat":
      "不支持的文件格式「.{ext}」，请用 {formats}，或将图表另存为这些格式后再导入",
    "toast.noExtension":
      "文件缺少扩展名，无法判断格式。请用 {formats}，或将图表另存为这些格式后再导入",
    "toast.fileReadFail": "文件读取失败",
    "toast.importFail": "导入失败",
    "toast.confirmDeleteDataset": "删除数据集「{name}」（含 {n} 个点）？",
    "toast.confirmLargeImage":
      "图片尺寸 {w}×{h}px 较大，处理可能较慢。是否自动降采样到 ≤4000px 以提升流畅度？",
    "toast.confirmRecoverSession": "检测到上次未保存的会话，是否恢复？",
    "toast.confirmTitle": "确认",
    "toast.confirmOK": "确定",
    "toast.confirmCancel": "取消",
    "toast.autosaveCorrupt": "上次会话文件已损坏，已保留在应用数据目录，未清除",
    "toast.confirmCloseTab": "该标签页有未保存的修改，关闭后将丢失，确定关闭？",
    "toast.confirmSwitchPage.keep":
      "切换页面：将保留当前标定与已有数据点，并把该页作为新数据集导入。确定继续？",
    "toast.confirmSwitchPage.reset":
      "切换页面将重置当前标定与已取数据点，是否继续？",
    "toast.invalidValue": "请输入有效数值",
    "toast.shortcuts":
      "快捷键: ⌘O 导入 | ⌘S 保存 | ⌘Z 撤销 | ⇧⌘Z 重做 | Del 删除末点 | 空格、拖拽平移 | 滚轮缩放 | F1 帮助",
    "toast.removeIssues": "移除 {n} 个可疑点",
    "toast.confirmSampleReplace":
      "打开示例工程将替换当前已标定的坐标和已提取的数据，确定继续？",
    "toast.tab.new": "新标签页",
    "toast.tab.close": "关闭标签页",
    // 上下文菜单
    "ctx.editPoint": "编辑此点数值",
    "table.colAction": "操作",
    "table.cellX": "第 {n} 个点 X 值",
    "table.cellY": "第 {n} 个点 Y 值",
    "table.copyPoint": "复制第 {n} 个点坐标",
    "table.deletePoint": "删除第 {n} 个点",
    "table.copyTip": "复制 x,y",
    "ctx.deletePoint": "删除此点",
    "ctx.deleteLastPoint": "删除最后一个点",
    "ctx.clearAll": "清空所有点",
    "ctx.pickColor": "拾取此处颜色",
    // 检测确认弹窗
    "detect.confirm.title": "检测结果确认",
    "detect.confirm.body":
      "共检测到 {n} 个候选点（画布上以彩色半透明点预览，掩码可同时显示）。",
    "detect.confirm.help":
      "「追加到现有点」保留当前数据点并把结果追加到当前数据集（推荐）；「替换数据集」用结果覆盖当前数据集；操作均可撤销。",
    "detect.confirm.discard": "丢弃",
    "detect.confirm.append": "追加到现有点",
    "detect.confirm.replace": "替换数据集",
    // 校验弹窗
    "validate.title": "导出前数据校验",
    "validate.body":
      "检测到 {n} 个可疑数据点（数据表中已标黄），可能为误点或重复：",
    "validate.nan": "{n} 个非数值",
    "validate.out": "{n} 个超出标定范围",
    "validate.dup": "{n} 个重复坐标",
    "validate.help": "请选择如何处理：",
    "validate.cancel": "取消导出",
    "validate.remove": "移除可疑点后导出",
    "validate.force": "仍然导出",
    // 编辑点弹窗
    "editPoint.title": "编辑点 #{n}",
    "editPoint.cancel": "取消",
    "editPoint.save": "保存",
    // 标定角色标签
    "calib.xmin": "X轴最小值",
    "calib.xmax": "X轴最大值",
    "calib.ymin": "Y轴最小值",
    "calib.ymax": "Y轴最大值",
    "calib.xmin.short": "Xmin",
    "calib.xmax.short": "Xmax",
    "calib.ymin.short": "Ymin",
    "calib.ymax.short": "Ymax",
    // 数据集
    "dataset.default": "数据集{n}",
    "dataset.cluster": "分拣{n}",
    "dataset.count": "{name}（{n} 点）",
    "dataset.delete": "删除数据集「{name}」",
    // 标签页
    "tab.new": "新标签页",
    "tab.close": "关闭",
    "tab.untitled": "未命名",
    // 无障碍
    "a11y.notifications": "通知",
    "a11y.close": "关闭",
    "a11y.resizeLeft": "调整左侧面板宽度",
    "a11y.resizeRight": "调整右侧面板宽度",
    // UX 状态
    "uxstate.EMPTY": "未开始",
    "uxstate.IMAGE_READY": "图像就绪",
    "uxstate.CALIBRATING": "标定中",
    "uxstate.CALIBRATED": "已标定",
    "uxstate.EXTRACTING": "取点中",
    "uxstate.EXPORTING": "导出中",
    // UX 状态机拦截原因（App 层 trReason 翻译；hook 内部保持中文桩以便单测）
    "ux.reason.importFirst": "请先导入图像",
    "ux.reason.notAllowed": "当前不可执行",
    "ux.reason.needCalib": "还需标定 {n} 个位置",
    "ux.reason.needValues": "还有 {n} 个数值未填写",
    "ux.reason.noData": "尚未取点，无数据可导出",
    // -伪点清理
    "detect.removeGridNoise": "去除网格伪点",
    "detect.noGridResult": "未检测到网格线，请先识别网格",
    "detect.noGridNoise": "未发现网格伪点",
    "detect.clusterSuffix": "，已分拣到 {datasets} 个数据集",
    "detect.clusterFail": "无法分拣散点",
    "detect.cancel": "取消检测",
    "detect.progressLabel": "自动检测进度",
    "detect.removeGridNoise.tip":
      "从当前检测结果中删除落在网格线上的伪数据点（需先识别网格）",
    "detect.gridNoiseRemoved": "已移除 {n} 个网格伪点",
    "detect.gridNoiseNone": "未检测到网格线，请先识别网格",
    // -多曲线分离
    "detect.multiCurve": "多曲线分离提取",
    "detect.multiCurve.tip":
      "对同图中多条颜色不同的曲线，可逐条按颜色提取到不同数据集。为每条曲线选前景色后追踪，结果自动加入新数据集。",
    "detect.multiCurve.extract": "提取为新数据集",
    "detect.multiCurve.added": "已提取 {n} 个点到新数据集「{name}」",
    // -散点按颜色分拣
    "detect.blobColorCluster": "按颜色分拣散点",
    "detect.blobColorCluster.tip":
      "将检测到的散点按颜色自动聚类，每组分到独立数据集",
    "detect.clusterCount": "识别到 {n} 个颜色组",
    "detect.clusterToDatasets": "分拣到数据集",
    // -批量处理
    "batch.title": "批量提取",
    "batch.intro":
      "选择一个文件夹，软件会自动逐张导入图片并尝试用当前标定参数提取曲线、导出 CSV。纯本地运行，不上传任何数据。",
    "batch.selectDir": "选择文件夹",
    "batch.outputDir": "输出目录",
    "batch.selectOutputDir": "选择输出目录",
    "batch.start": "开始批量",
    "batch.stop": "停止",
    "batch.progress": "进度: {done}/{total}",
    "batch.current": "正在处理: {name}",
    "batch.done": "批量完成: 成功 {ok}/{total}",
    "batch.skipped": "（跳过 {n} 张尺寸不一致的图片）",
    "batch.noFiles": "未找到图片文件",
    "batch.fileDone": "已导出: {name}",
    "batch.fileFail": "失败: {name}",
    "batch.needCalib": "请先完成标定再使用批量提取",
    // -新手引导
    "guide.welcome.title": "欢迎使用 ChartExtractor",
    "guide.welcome.desc":
      "纯本地离线的图表数据提取工具。数据不出本机，隐私安全有保障。",
    "guide.quickstart": "快速入门",
    "guide.step1": "① 导入图片 — 拖拽或点击「导入」",
    "guide.step2": "② 标定坐标 — 在图上点4个已知坐标的位置",
    "guide.step3": "③ 提取数据 — 手动点击或自动追踪曲线/散点",
    "guide.step4": "④ 导出结果 — 一键导出 xlsx/CSV/JSON",
    // -精度反馈
    "detect.overlayVerify": "叠加校验",
    "detect.overlayVerify.tip":
      "将提取的数据点以半透明叠加在原图上，直观判断精度",
    "detect.overlayOn": "叠加: 开",
    "detect.overlayOff": "叠加: 关",
    // -隐私强化
    "about.title": "关于 ChartExtractor",
    "about.version": "版本",
    "about.privacy": "隐私声明",
    "about.privacy.body":
      "ChartExtractor 是纯本地离线软件，所有图像处理与数据提取均在本机完成，不会向任何服务器上传、发送或存储您的数据。",
    "about.offline": "100% 离线 · 0 网络请求 · 数据不出本机",
    "about.close": "关闭",
    "menu.help.about": "关于…",
    "status.offline": "🔒 纯本地离线",
  },
  en: {
    // Menu bar
    "menu.file": "File",
    "menu.edit": "Edit",
    "menu.view": "View",
    "menu.theme": "Theme",
    "menu.tools": "Tools",
    "menu.help": "Help",
    "menu.file.import": "Import Image/PDF…",
    "menu.file.openProject": "Open Project…",
    "menu.file.openSample": "Open Sample Project…",
    "menu.file.saveProject": "Save Project…",
    "menu.file.recentFiles": "Recent Files",
    "menu.file.noRecent": "No recent files",
    "menu.edit.undo": "Undo",
    "menu.edit.redo": "Redo",
    "menu.edit.deleteLastPoint": "Delete Last Point",
    "menu.edit.clearDataset": "Clear Current Dataset",
    "menu.view.zoomFit": "Zoom to Fit",
    "menu.view.showMask": "Show Mask",
    "menu.tools.colorPick": "Color Pick Mode",
    "menu.tools.gridDetect": "Detect Grid Lines (Preview)",
    "menu.help.shortcuts": "Keyboard Shortcuts",
    // Ribbon
    "ribbon.import": "Import",
    "ribbon.calibrate": "Calibrate",
    "ribbon.extract": "Extract",
    "ribbon.export": "Export",
    "ribbon.undo": "Undo",
    "ribbon.redo": "Redo",
    "ribbon.save": "Save",
    "ribbon.colorPick": "Pick",
    "ribbon.mask": "Mask",
    // Theme
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    // Language
    "lang.label": "中/EN",
    // Wizard nav
    "wizard.import": "Import",
    "wizard.import.desc": "Drag/Open/Paste",
    "wizard.calibrate": "Calibrate",
    "wizard.calibrate.desc": "Coord Setup",
    "wizard.extract": "Extract",
    "wizard.extract.desc": "Manual/Auto",
    "wizard.export": "Export",
    "wizard.export.desc": "xlsx/CSV/JSON",
    "wizard.recentFiles": "Recent Files",
    // Hint bar
    "hint.empty":
      'Start from scratch: drag an image/PDF, or click "Import". Supports {formats}; PDF supported.',
    "hint.imageReady":
      'Image ready: click "Calibrate" or the left "Calibrate" step to begin coordinate setup.',
    "hint.calibrating": "Click the position of P{n} ({label}) on the chart",
    "hint.calibrating.done":
      'All 4 positions marked ✓ Enter real coordinate values on the right, then click "Complete Calibration".',
    "hint.calibrated":
      'Calibration complete (residual {residual}px) ✓ Click "Extract" to start manual or automatic point picking.',
    "hint.extracting":
      "Extracting: left-click to add points / right-click to delete or edit / edit values directly in the table; use auto curve/blob tracking on the right.",
    "hint.exporting":
      'Export preview: verify data, select datasets and format, then click "Export".',
    // Step guide
    "guide.calibrate.title": "Click P{n} position ({label}) on the chart",
    "guide.calibrate.done":
      'All points placed. Enter real values below, then click "Complete Calibration"',
    "guide.calibrate.sub": "Placed {placed}/4 · Values {values}/4",
    "guide.extract.title": "Left-click on the chart to add data points",
    "guide.extract.sub":
      "Right-click to delete/edit · Drag to move · Delete key removes last point",
    // Import panel
    "panel.import.title": "Import Chart",
    "panel.import.help.withImage":
      'Image imported. Click below to start calibration, or use "Import" at top to change image.',
    "panel.import.help.noImage": "Supported import methods:",
    "panel.import.openFile": "Open File",
    "panel.import.changeImage": "Change Image",
    "panel.import.openSample": "Open Sample Project",
    "panel.import.startCalibrate": "Start Calibration",
    "panel.import.help.drag": "• Drag image/PDF into window",
    "panel.import.help.paste": "• Ctrl+V paste screenshot",
    "panel.import.help.formats": "• Supports {formats}; PDF supported",
    "panel.import.help.pdfPages": "• Multi-page PDF: switch pages after import",
    "panel.import.help.sample":
      '• No chart? Try "Open Sample Project" for a full walkthrough',
    "panel.import.pdfPages": "Multi-page PDF: select page",
    "panel.import.pdfPage": "Page {n}",
    // Calibrate panel
    "panel.calibrate.title": "Coordinate Calibration",
    "panel.calibrate.xScaleType": "X Scale",
    "panel.calibrate.yScaleType": "Y Scale",
    "panel.calibrate.linear": "Linear",
    "panel.calibrate.log": "Log",
    "panel.calibrate.snap": "Snap H/V",
    "panel.calibrate.help":
      "Click P1→P4 positions on the chart (order: Xmin / Xmax / Ymin / Ymax), then enter real coordinate values below. Placed points can be repositioned by clicking again.",
    "panel.calibrate.pointsTitle": "Calibration Points & Values",
    "panel.calibrate.placeholder": "Enter real value",
    "panel.calibrate.axisMeta": "Axis Name & Unit",
    "panel.calibrate.xLabel": "X Name",
    "panel.calibrate.xUnit": "X Unit",
    "panel.calibrate.yLabel": "Y Name",
    "panel.calibrate.yUnit": "Y Unit",
    "panel.calibrate.axisHelp":
      'Used as header/column name on export, e.g. "Time(s)"; leave empty to use X / Y.',
    "panel.calibrate.commit": "Complete Calibration",
    "panel.calibrate.calibrating": "Placing {n}/4",
    "panel.calibrate.cancel": "Cancel Calibration",
    "panel.calibrate.reset": "Reset Points",
    // Extract panel
    "panel.extract.calibInfo": "Calibration Info",
    "panel.extract.recalibrate": "Recalibrate",
    "panel.extract.residual.good": "good",
    "panel.extract.residual.bad": "high, please review",
    "panel.extract.datasets": "Datasets",
    "panel.extract.addDataset": "+ Add Dataset",
    "panel.extract.manualPick": "Manual Picking",
    "panel.extract.manualHelp":
      "Left-click to add data points; drag existing points to move\nRight-click on a point to delete/edit\nDelete key removes the last point",
    "panel.extract.tableHint":
      "Yellow rows = suspicious points (out-of-range/duplicate/NaN). Edit values directly (blur to commit, undoable), 📋 copy, 🗑 delete.",
    "panel.extract.deleteLast": "Delete Last",
    "panel.extract.clear": "Clear",
    "panel.extract.autoDetect": "Auto Detection",
    "panel.extract.dataTable": "Data Table ({n} pts)",
    // Auto detection
    "detect.intro":
      'Auto detection lets the software find data points by color automatically—best for tidy line charts and scatter plots. Recommended flow: use "Color Segmentation" below to isolate the target line/points (enable live preview and adjust while watching), then click "Track Curve" or "Detect Blobs". Results appear as translucent preview dots; confirm before "Append / Replace" into the current dataset.',
    "detect.flow.pickColor": "① Pick Color",
    "detect.flow.pickColor.desc": "Select target line/point color",
    "detect.flow.genMask": "② Generate Mask",
    "detect.flow.genMask.desc": "Software creates a binary image",
    "detect.flow.track": "③ Track",
    "detect.flow.track.desc": "Auto-trace curve / find blobs from mask",
    "detect.colorSeg": "Color Segmentation",
    "detect.colorSeg.sub": '· determines "target" pixels',
    "detect.colorSeg.tip":
      'Color segmentation binarizes the image: pixels close to your chosen color become "target" (white), the rest become "background" (black). The resulting binary mask is the sole basis for curve/blob detection—an accurate mask is essential.',
    "detect.fgColor": "Foreground",
    "detect.pick": "Pick",
    "detect.cancelPick": "Cancel Pick",
    "detect.pickTip":
      'Click "Pick", then click on the canvas to sample color (click on the target line/point).',
    "detect.mode": "Mode",
    "detect.mode.fg": "Foreground Match",
    "detect.mode.bg": "Background Exclude",
    "detect.mode.fg.desc":
      "Keep only pixels close to the foreground color—good for extracting one colored curve or scatter on a light/cluttered background.",
    "detect.mode.bg.desc":
      "Keep all pixels unlike the background color—good for white-bg charts; removes axes, gridlines, and text.",
    "detect.tolerance": "Color Tolerance",
    "detect.tolerance.tip":
      "0–255. Larger = wider color range (may include noise/gridlines); smaller = stricter (may miss faint areas). Start at 100–150, then fine-tune.",
    "detect.livePreview": "Live Mask Preview (see while adjusting)",
    "detect.livePreview.tip":
      "When checked, the mask updates instantly as you adjust color/tolerance. Recommended to keep on.",
    "detect.curveTrack": "Curve Auto-Tracking",
    "detect.curveTrack.sub": "· for line charts / smooth curves",
    "detect.curveTrack.tip":
      'Scans the mask column-by-column, taking the center of each column\'s target region to form a curve. One point per X, suitable for "one Y per X" line charts.',
    "detect.xStep": "X Step (px)",
    "detect.xStep.tip":
      "Spacing between sampled columns. Smaller = denser, more detailed (but slower); for gentle curves, use 10–20 for speed.",
    "detect.yStep": "Y Step (px)",
    "detect.yStep.tip":
      "Vertical search granularity within each column. Usually same as X step; reduce for steep curves.",
    "detect.smoothing": "Cubic Spline Smoothing",
    "detect.smoothing.tip":
      "Smooths tracked points via spline interpolation for a natural curve; uncheck to keep raw samples.",
    "detect.trackCurve": "Track Curve",
    "detect.blobDetect": "Blob Auto-Detection",
    "detect.blobDetect.sub": "· for scatter plots",
    "detect.blobDetect.tip":
      "Finds independent small blobs (connected components) in the mask and takes their centers as data points. Suitable for separated dots, not for connected lines.",
    "detect.minDiameter": "Min Diameter",
    "detect.minDiameter.tip":
      "Only keep blobs with diameter ≥ this value; filters out gridlines, text strokes, and noise.",
    "detect.maxDiameter": "Max Diameter",
    "detect.maxDiameter.tip":
      "Only keep blobs with diameter ≤ this value; excludes large areas (e.g. legend backgrounds). Typical: 2–20.",
    "detect.detectBlob": "Detect Blobs",
    "detect.gridDetect": "Grid Line Detection",
    "detect.gridDetect.sub": "· preview only",
    "detect.gridDetect.tip":
      "Highlights coordinate gridlines as a mask overlay to help you identify tick positions. Preview only—no data generated.",
    "detect.detectGrid": "Detect Grid",
    "detect.gridThreshold": "Grid Detection Threshold",
    // Export panel
    "panel.export.preview": "Export Preview",
    "panel.export.summary":
      "{datasets} datasets, {points} data points. Each dataset exports as an Excel sheet / CSV section / JSON array item.",
    "panel.export.openDialog": "Open Export Dialog",
    "panel.export.back": "Back to Extract",
    // Export dialog
    "export.title": "Data Export",
    "export.summary":
      "{datasets} datasets, {points} data points. Each dataset exports as an Excel sheet / CSV section / JSON array item.",
    "export.selectDatasets": "Select Datasets",
    "export.noDatasets": "No datasets",
    "export.xColumn": "X Column",
    "export.yColumn": "Y Column",
    "export.mergeMode": "Merge Mode",
    "export.merge.long": "Long (dataset,X,Y — pandas-ready)",
    "export.merge.wide": "Wide (aligned by X)",
    "export.encoding": "Encoding",
    "export.encoding.utf8": "UTF-8 (recommended)",
    "export.encoding.gbk": "GBK (legacy WPS)",
    "export.precision": "Decimal Precision",
    "export.includeHeader": "Include header row",
    "export.includeMetadata":
      "Write metadata comment lines (pandas needs comment='#')",
    "export.includeMetadata.tip":
      "Default off: keeps pandas.read_csv directly parseable",
    "export.jsonNote":
      'JSON always includes dataset metadata; "header" does not apply.',
    "export.previewTitle": "Full Preview (first 5 rows per dataset)",
    "export.noDataSelected": "No datasets with data selected",
    "export.cancel": "Cancel",
    "export.confirm": "Export",
    // Status bar
    "status.state": "State",
    "status.unsaved": "● Unsaved",
    "status.calibrated": "✓ Calibrated",
    "status.notCalibrated": "○ Not calibrated",
    "status.residual": "· residual {val}px",
    "status.calibPoints": "Calib pts",
    "status.dataPoints": "Data pts",
    "status.issues": "⚠ {n} suspicious points (out-of-range/duplicate/NaN)",
    "status.colorPick": "🎨 Color pick mode",
    "status.canUndo": "Undo",
    "status.canRedo": "Redo",
    "status.version": "v{version} | Offline",
    // Canvas
    "canvas.empty.icon": "📊",
    "canvas.empty.title": "No chart imported",
    "canvas.empty.hint":
      'Drag an image or PDF into this window, or click the "Import" button at the top.',
    "canvas.empty.steps": "Extract Data in 4 Steps",
    "canvas.empty.step1":
      "Import: drag / open / Ctrl+V paste chart image or PDF",
    "canvas.empty.step2":
      "Calibrate: click 4 positions on the chart and enter their real coordinate values",
    "canvas.empty.step3":
      "Extract: left-click to add points manually, or use color/curve/blob auto-tracking",
    "canvas.empty.step4": "Export: one-click export to xlsx / CSV / JSON",
    "canvas.zoom": "Zoom",
    "canvas.coord": "Coord",
    "canvas.data": "Data",
    "canvas.hint": "Scroll to zoom · Hold Space + drag to pan (click to close)",
    "canvas.calibrateGuide": "Click P{n} ({label})",
    "canvas.ctrl.zoomOut": "Zoom out",
    "canvas.ctrl.zoomIn": "Zoom in",
    "canvas.ctrl.zoomFit": "Zoom to fit",
    // Toast messages
    "toast.imported": "Imported: {name}",
    "toast.imageLoadFail": "Image load failed—unsupported format?",
    "toast.confirmClear":
      "Importing a new chart will clear all current calibration and extracted data (use Ctrl+Z to undo). Continue?",
    "toast.confirmClearShort":
      "Importing a new chart will clear current data. Continue?",
    "toast.calibStart": "Click 4 calibration point positions on the chart",
    "toast.calibPointSet": "Marked P{n}. Click P{next} ({label})",
    "toast.calibAllPlaced":
      'All 4 positions marked ✓ Enter real values on the right, then click "Complete Calibration"',
    "toast.calibRelocated": "Repositioned P{n} ({label})—continue adjusting",
    "toast.calibDone": "Calibration complete (residual {residual}px{warn})",
    "toast.calibResidualWarn": ", high—please review",
    "toast.calibFail":
      "Calibration failed: points may be collinear or values invalid. Please check.",
    "toast.calibCancel":
      "Recalibrate: click calibration point positions (existing values preserved)",
    "toast.pointAdded": "Added point ({x}, {y})",
    "toast.pointMoved": "Moved point {n} to ({x}, {y})",
    "toast.pointDeleted": "Deleted point {n}",
    "toast.pointEdited": "Edited point {n}",
    "toast.pointUpdated": "Point updated",
    "toast.copied": "Copied x,y to clipboard",
    "toast.copyFail": "Copy failed",
    "toast.colorPicked": "Picked color RGB({r}, {g}, {b})",
    "toast.noColorPicked": "Cannot perform this action in current state",
    "toast.noCalib": "Please complete calibration first",
    "toast.curveStart": "Curve tracking",
    "toast.curveCancelled": "Curve tracking cancelled",
    "toast.curveEmpty": "No curve found—check color selection and threshold",
    "toast.curveFound": "Found {n} candidate points—confirm in preview",
    "toast.curveFail": "Curve tracking failed",
    "toast.blobCancelled": "Blob detection cancelled",
    "toast.blobEmpty":
      "No blobs found—adjust color threshold or diameter range",
    "toast.blobFound": "Found {n} blobs—confirm in preview",
    "toast.blobFail": "Blob detection failed",
    "toast.gridCancelled": "Grid detection cancelled",
    "toast.gridDone":
      "Grid detection done: {v} vertical, {h} horizontal lines (preview only)",
    "toast.gridFail": "Grid detection failed",
    "toast.detectDiscard": "Detection result discarded",
    "toast.detectAppend": "Appended {n} points",
    "toast.detectReplace": "Replaced with {n} points",
    "toast.noExportData": "No data to export",
    "toast.selectDataset": "Please select at least one dataset with data",
    "toast.exported": "Exported to: {path}",
    "toast.exportFail": "Export failed",
    "toast.projectSaved": "Project saved",
    "toast.projectSaveFail": "Project save failed",
    "toast.projectLoadFail": "Project file load failed",
    "toast.projectLoadFail.missingManifest": "Project file is missing manifest.json",
    "toast.projectLoadFail.missingProjectJson": "Project file is missing project.json",
    "toast.projectLoadFail.noImage": "No image found in project file",
    "toast.projectLoadFail.imageReadFail": "Failed to read project image file",
    "toast.projectLoadFail.corrupt": "Project file is corrupt: {msg}",
    "toast.projectLoadFail.readFail": "File read failed: {msg}",
    "toast.projectLoaded": "Project loaded",
    "toast.imageLoadFail2": "Project image load failed",
    "toast.sampleLoaded": "Sample project loaded (calibrated data, 2 datasets)",
    "toast.sampleFail": "Failed to open sample project",
    "toast.noSaveData": "No project to save",
    "toast.pdfPages": "PDF has {n} pages—switch in import panel",
    "toast.pdfParseFail": "PDF parse failed",
    "toast.pdfPageImported":
      "Imported page {n} (calibration preserved)—pick points in the new dataset",
    "toast.pdfPageFail": "PDF page {n} parse failed",
    "toast.pdfPageImgFail": "Page image load failed",
    "pdf.pageSuffix": " (page {n})",
    "toast.unsupportedFormat":
      'Unsupported format ".{ext}". Please use {formats}, or convert the chart.',
    "toast.noExtension":
      "File has no extension. Please use {formats}, or convert the chart.",
    "toast.fileReadFail": "File read failed",
    "toast.importFail": "Import failed",
    "toast.confirmDeleteDataset": 'Delete dataset "{name}" ({n} points)?',
    "toast.confirmLargeImage":
      "Image size {w}×{h}px is large and may be slow. Auto-downsample to ≤4000px for smoother performance?",
    "toast.confirmRecoverSession": "An unsaved session was found. Restore it?",
    "toast.confirmTitle": "Confirm",
    "toast.confirmOK": "OK",
    "toast.confirmCancel": "Cancel",
    "toast.autosaveCorrupt":
      "The last session file is corrupted. It was kept in the app data directory (not cleared).",
    "toast.confirmCloseTab":
      "This tab has unsaved changes. Closing will lose them. Close anyway?",
    "toast.confirmSwitchPage.keep":
      "Switching pages: current calibration and data will be preserved; the page will be imported as a new dataset. Continue?",
    "toast.confirmSwitchPage.reset":
      "Switching pages will reset current calibration and extracted data. Continue?",
    "toast.invalidValue": "Please enter a valid number",
    "toast.shortcuts":
      "Shortcuts: ⌘O Import | ⌘S Save | ⌘Z Undo | ⇧⌘Z Redo | Del Delete last | Space+drag Pan | Scroll Zoom | F1 Help",
    "toast.removeIssues": "Removed {n} suspicious points",
    "toast.confirmSampleReplace":
      "Opening the sample project will replace current calibration and extracted data. Continue?",
    "toast.tab.new": "New Tab",
    "toast.tab.close": "Close Tab",
    // Context menu
    "ctx.editPoint": "Edit point value",
    "table.colAction": "Actions",
    "table.cellX": "Point {n} X value",
    "table.cellY": "Point {n} Y value",
    "table.copyPoint": "Copy point {n} coordinates",
    "table.deletePoint": "Delete point {n}",
    "table.copyTip": "Copy x,y",
    "ctx.deletePoint": "Delete this point",
    "ctx.deleteLastPoint": "Delete last point",
    "ctx.clearAll": "Clear all points",
    "ctx.pickColor": "Pick color here",
    // Detection confirm
    "detect.confirm.title": "Confirm Detection Results",
    "detect.confirm.body":
      "Found {n} candidate points (shown as translucent colored dots on the canvas; mask may also be visible).",
    "detect.confirm.help":
      '"Append" keeps existing points and adds results to the current dataset (recommended); "Replace" overwrites the current dataset. Both are undoable.',
    "detect.confirm.discard": "Discard",
    "detect.confirm.append": "Append to existing",
    "detect.confirm.replace": "Replace dataset",
    // Validation dialog
    "validate.title": "Pre-export Validation",
    "validate.body":
      "Found {n} suspicious data points (highlighted in table). These may be mis-clicks or duplicates:",
    "validate.nan": "{n} NaN values",
    "validate.out": "{n} out of calibration range",
    "validate.dup": "{n} duplicate coordinates",
    "validate.help": "Choose how to handle:",
    "validate.cancel": "Cancel export",
    "validate.remove": "Remove suspicious & export",
    "validate.force": "Export anyway",
    // Edit point
    "editPoint.title": "Edit Point #{n}",
    "editPoint.cancel": "Cancel",
    "editPoint.save": "Save",
    // Calibration role labels
    "calib.xmin": "X-axis Min",
    "calib.xmax": "X-axis Max",
    "calib.ymin": "Y-axis Min",
    "calib.ymax": "Y-axis Max",
    "calib.xmin.short": "Xmin",
    "calib.xmax.short": "Xmax",
    "calib.ymin.short": "Ymin",
    "calib.ymax.short": "Ymax",
    // Dataset
    "dataset.default": "Dataset {n}",
    "dataset.cluster": "Cluster {n}",
    "dataset.count": "{name} ({n} pts)",
    "dataset.delete": 'Delete dataset "{name}"',
    // Tabs
    "tab.new": "New Tab",
    "tab.close": "Close",
    "tab.untitled": "Untitled",
    // Accessibility (P1-4/P1-5/P1-6)
    "a11y.notifications": "Notifications",
    "a11y.close": "Close",
    "a11y.resizeLeft": "Resize left panel",
    "a11y.resizeRight": "Resize right panel",
    // UX states
    "uxstate.EMPTY": "Empty",
    "uxstate.IMAGE_READY": "Image Ready",
    "uxstate.CALIBRATING": "Calibrating",
    "uxstate.CALIBRATED": "Calibrated",
    "uxstate.EXTRACTING": "Extracting",
    "uxstate.EXPORTING": "Exporting",
    // UX state machine block reasons (translated at App boundary; hook keeps Chinese stubs for unit tests)
    "ux.reason.importFirst": "Import an image first",
    "ux.reason.notAllowed": "Not allowed in the current state",
    "ux.reason.needCalib": "Calibrate {n} more position(s)",
    "ux.reason.needValues": "{n} value(s) still missing",
    "ux.reason.noData": "No points extracted yet—nothing to export",
    // Theme A - Grid noise removal
    "detect.removeGridNoise": "Remove Grid Noise",
    "detect.noGridResult": "No grid lines detected. Run grid detection first.",
    "detect.noGridNoise": "No grid noise points found",
    "detect.clusterSuffix": ", sorted into {datasets} datasets",
    "detect.clusterFail": "Cannot cluster blobs",
    "detect.cancel": "Cancel detection",
    "detect.progressLabel": "Auto-detection progress",
    "detect.removeGridNoise.tip":
      "Remove false data points lying on detected grid lines (run grid detection first)",
    "detect.gridNoiseRemoved": "Removed {n} grid noise points",
    "detect.gridNoiseNone":
      "No grid lines detected, please run grid detection first",
    // Theme B - Multi-curve separation
    "detect.multiCurve": "Multi-Curve Separation",
    "detect.multiCurve.tip":
      "For charts with multiple curves of different colors, extract each curve by color into separate datasets. Pick foreground color for each curve then track.",
    "detect.multiCurve.extract": "Extract as New Dataset",
    "detect.multiCurve.added": 'Extracted {n} points to new dataset "{name}"',
    // Theme E - Blob color clustering
    "detect.blobColorCluster": "Cluster Blobs by Color",
    "detect.blobColorCluster.tip":
      "Automatically cluster detected blobs by color, each group to a separate dataset",
    "detect.clusterCount": "Found {n} color groups",
    "detect.clusterToDatasets": "Sort to Datasets",
    // Theme D - Batch processing
    "batch.title": "Batch Extraction",
    "batch.intro":
      "Select a folder; the app will auto-import each image, extract curves using current calibration, and export CSV. Fully offline, no data uploaded.",
    "batch.selectDir": "Select Folder",
    "batch.outputDir": "Output Folder",
    "batch.selectOutputDir": "Select Output Folder",
    "batch.start": "Start Batch",
    "batch.stop": "Stop",
    "batch.progress": "Progress: {done}/{total}",
    "batch.current": "Processing: {name}",
    "batch.done": "Batch done: {ok}/{total} succeeded",
    "batch.skipped": " (skipped {n} with mismatched size)",
    "batch.noFiles": "No image files found",
    "batch.fileDone": "Exported: {name}",
    "batch.fileFail": "Failed: {name}",
    "batch.needCalib": "Please complete calibration before batch extraction",
    // Theme F - Onboarding guide
    "guide.welcome.title": "Welcome to ChartExtractor",
    "guide.welcome.desc":
      "Fully offline chart data extraction tool. Your data never leaves your device.",
    "guide.quickstart": "Quick Start",
    "guide.step1": '① Import — drag or click "Import"',
    "guide.step2": "② Calibrate — click 4 known coordinate positions",
    "guide.step3": "③ Extract — manual click or auto-track curves/scatter",
    "guide.step4": "④ Export — one-click xlsx/CSV/JSON",
    // Theme H - Overlay verification
    "detect.overlayVerify": "Overlay Verification",
    "detect.overlayVerify.tip":
      "Overlay extracted data points on the original image to visually verify accuracy",
    "detect.overlayOn": "Overlay: On",
    "detect.overlayOff": "Overlay: Off",
    // Theme C - Privacy reinforcement
    "about.title": "About ChartExtractor",
    "about.version": "Version",
    "about.privacy": "Privacy Statement",
    "about.privacy.body":
      "ChartExtractor is a fully offline desktop application. All image processing and data extraction happen on your device. No data is ever uploaded, transmitted, or stored on any server.",
    "about.offline":
      "100% Offline · 0 Network Requests · Data Never Leaves Your Device",
    "about.close": "Close",
    "menu.help.about": "About…",
    "status.offline": "🔒 Fully Offline",
  },
} as const;
export type TranslationKey = keyof (typeof translations)["zh"];
