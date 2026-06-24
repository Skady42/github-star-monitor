# 更新日志

## v1.5.3 (2026-06-24)

### 修复
- **pending_updates 被清空** — `mergeNewReleases` 在无新 Release 时不再覆盖清空旧 pending 条目，同步清理已取消标星的仓库
- **新旧更新合并去重** — 有新 Release 时合并到旧 pending 中，按 repo+tag 去重，同仓库只保留最新版本

---

## v1.5.2 (2026-06-24)

### 修复
- **performCheck 并发竞争 (Critical)** — `_isChecking` 内存锁防止两个检查同时运行互相覆盖结果
- **浏览器启动双触发** — alarm handler 加 30 秒防护，onStartup 加 60 秒防护，挡住 onStartup + 错过的 alarm 双触发
- 替换所有 `console.log` 为结构化日志调用

---

## v1.5.1 (2026-06-24)

### 修复
- **pending_updates 只增不减** — `mergeNewReleases` 改为每次扫描替换旧列表，不再累积合并
- **重装时自动去重** — 更新到 v1.5.1 时自动清理被旧版本污染的重复数据
- **首次安装跳过检查** — 避免全部标星仓库瞬间变成新 Release 轰炸

### 其他
- 移除设置面板中的「清空所有更新」按钮
- 版本号 1.5.0 → 1.5.1

---

## v1.5.0 (2026-06-23)

### 新增
- **日志系统** — 24 小时滚动日志，4 级日志级别 (DEBUG/INFO/WARN/ERROR)
- **日志埋点** — background.js 15 处关键事件全程记录（OAuth 授权、检查、Alarm 等）
- **设置面板日志管理** — 查看日志条数、导出日志为 .txt、清空日志
- **多语言支持** — 日志管理区域中英文翻译

### 技术
- 新建 `utils/logger.js` 日志模块
- 零依赖，纯原生 ES Module
- 版本号 1.4.1 → 1.5.0

---

## v1.4.1

### 修复
- **ETag 顺序 Bug (Critical)** — 修复 `setReleaseEtags` 在 `mergeNewReleases` 之前执行的问题，防止 SW 被杀后新 Release 被 304 永久跳过
- **并发 5→3** — 降低 Service Worker 被浏览器杀死的风险
- **Rate Limit 等待 60s→30s** — 缩短限流等待时间
- **扫描通知** — 修复 `notifyScanComplete` + `requireInteraction` + 错误处理

---

## v1.4.0

### 新增
- **扫描提速** — ETag 条件请求（304 不计入 Rate Limit）
- **并发扫描** — 5 个仓库并发请求
- **Rate Limit 感知** — 检测剩余配额，自动等待 60s

---

## v1.3.2

### 修复
- **取消标星仓库不消失** — `mergeNewReleases` 清理 `known_releases` 和 `pending_updates` 中已取消标星的条目

---

## v1.3.1

### 新增
- **工业暗色主题** — 全新 Console 风格 UI
- **中/英语言切换** — 设置面板可选语言
- **设置面板** — 自定义扫描间隔、语言选择

---

## v1.2.0

### 新增
- **搜索与排序** — 按仓库名搜索、按时间/名称/Star 数排序
- **重复条目去重** — 每个仓库只保留最新一条更新
- **启动补检** — 浏览器打开时如果距上次检查超过 1 小时则立即检查
- **自定义扫描间隔** — 设置面板可调整检查频率 (1~1440 分钟)

---

## v1.1.0

### 新增
- 搜索与排序功能 (A-Z/时间/Star 数)
- 改进 README 文档

---

## v1.0.0

### 初始版本
- 监控 GitHub Star 仓库的新 Release
- 每小时整点自动检查
- 侧边栏展示更新列表
- 系统通知推送
- OAuth 可视化配置
- 网络容错机制
