# GitHub Star Release Monitor

监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知。

## 功能

- **自动检查** — 每小时整点检查 Star 仓库的新 Release
- **启动补检** — 浏览器启动时如距上次检查超 1 小时则立即补检
- **系统通知** — 汇总推送新增 Release（5 秒自动关闭）
- **侧边栏** — 通过 Edge/Chrome Side Panel 展示更新列表，点击跳转仓库
- **可视化配置** — 侧边栏内直接填入 OAuth 凭证，无需编辑代码
- **搜索排序** — 支持按仓库名搜索、A-Z/时间/Star 数排序
- **手动检查** — 一键手动触发检查
- **网络容错** — 前置连通性检测 + 超时自动跳过
- **Badge 未读计数** — 扩展图标显示未读更新数
- **批量标记已读** — 一键标记所有更新为已读
- **Release 类型过滤** — 每个仓库可选正式版/预发行版
- **仓库禁用检查** — 禁用后该仓库不再扫描（保留标星）
- **已读/未读标记** — 点击更新项自动标记为已读
- **多语言支持** — 中/英切换

## 安装

### 方式一：直接安装（推荐）

从 Release 页面下载 `github-star-monitor-v2.0.crx`，拖入浏览器扩展页面安装。

### 方式二：源码构建

```bash
git clone https://github.com/Skady42/github-star-monitor.git
cd github-star-monitor/github-star-monitor
npm install
npm run build
```

构建产物在 `dist/` 目录，加载为解压缩的扩展。

## 配置 OAuth

### 1. 创建 GitHub OAuth App

打开 https://github.com/settings/developers → New OAuth App：

| 字段 | 值 |
|------|-----|
| Application name | GitHub Star Monitor |
| Homepage URL | 任意 |
| Authorization callback URL | 见下一步 |

### 2. 配置回调地址

打开扩展侧边栏（点击工具栏图标），第一行会显示 Redirect URI。把它填到 GitHub OAuth App 的 Authorization callback URL 中。

### 3. 连接 GitHub

在侧边栏填入 GitHub OAuth App 的 Client ID 和 Client Secret → 保存凭证 → 点击「连接 GitHub 账号」完成授权。

## 仓库设置

点击更新项右上角的 ⋮ 图标，可设置：

- **正式版 / 预发行版** — 选择查看哪种类型的 Release
- **禁用检查** — 禁用后该仓库不再被扫描（保留标星）

## 文件结构

```
github-star-monitor/
├── public/
│   ├── manifest.json          # MV3 配置
│   └── icons/                 # 16/48/128 图标
├── src/
│   ├── background/
│   │   └── index.ts           # Service Worker（定时、OAuth、检查）
│   ├── lib/
│   │   ├── types.ts           # TypeScript 类型定义
│   │   ├── storage.ts         # chrome.storage.local 封装
│   │   ├── github-api.ts      # GitHub API（含超时、ETag）
│   │   ├── notifications.ts   # 系统通知
│   │   ├── logger.ts          # 结构化日志
│   │   └── i18n.ts            # 国际化
│   └── sidepanel/
│       ├── App.tsx            # React 根组件
│       ├── components/        # UI 组件
│       ├── hooks/             # 自定义 Hooks
│       └── styles/            # 样式
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 技术栈

- **语言**：TypeScript 5
- **UI**：React 18
- **构建**：Vite + crxjs
- **API**：Manifest V3 · chrome.sidePanel · chrome.alarms · chrome.identity · chrome.notifications
- **样式**：Newsprint 报纸风格主题

## 开发

```bash
npm install
npm run dev    # 开发模式（HMR）
npm run build  # 生产构建
```
