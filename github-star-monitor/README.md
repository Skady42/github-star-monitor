# GitHub Star Release Monitor

监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知。

## 功能

- **自动检查** — 每小时整点检查 Star 仓库的新 Release
- **启动补检** — 浏览器启动时如距上次检查超 1 小时则立即补检
- **系统通知** — 汇总推送新增 Release
- **侧边栏** — 通过 Edge/Chrome Side Panel 展示更新列表，点击跳转仓库
- **可视化配置** — 侧边栏内直接填入 OAuth 凭证，无需编辑代码
- **搜索排序** — 支持按仓库名搜索、A-Z/时间/Star 数排序
- **手动检查** — 一键手动触发检查
- **网络容错** — 前置连通性检测 + 超时自动跳过

## 安装

### 1. 创建 GitHub OAuth App

打开 https://github.com/settings/developers → New OAuth App：

| 字段 | 值 |
|------|-----|
| Application name | GitHub Star Monitor |
| Homepage URL | 任意 |
| Authorization callback URL | 见下一步 |

### 2. 加载扩展

1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 开启「开发人员模式」
3. 点击「加载解压缩的扩展」
4. 选择 `github-star-monitor/` 目录

### 3. 配置回调地址

打开扩展侧边栏（点击工具栏图标），第一行会显示 Redirect URI。把它填到 GitHub OAuth App 的 Authorization callback URL 中。

### 4. 连接 GitHub

在侧边栏填入 GitHub OAuth App 的 Client ID 和 Client Secret → 保存凭证 → 点击「连接 GitHub 账号」完成授权。

## 文件结构

```
github-star-monitor/
├── manifest.json          # MV3 配置 (ES Module + Side Panel)
├── background.js          # Service Worker (定时调度、OAuth、Release检查)
├── sidepanel/
│   ├── sidepanel.html     # 侧边栏界面
│   ├── sidepanel.css      # 样式
│   └── sidepanel.js       # 交互逻辑
├── utils/
│   ├── storage.js         # chrome.storage.local 封装
│   ├── github-api.js      # GitHub API 封装 (含超时处理)
│   └── notifications.js   # 系统通知
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 技术栈

- **Manifest V3** + ES Module Service Worker
- **chrome.alarms** — 整点调度
- **chrome.sidePanel** — 侧边栏 UI
- **chrome.identity.launchWebAuthFlow** — GitHub OAuth
- **chrome.notifications** — 系统通知
- **chrome.storage.local** — 数据持久化
- 零依赖，纯原生 JS
