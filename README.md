# GitHub Star Release Monitor

> 监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](manifest.json)

## 功能

- 每小时整点自动检查 Star 仓库的新 Release
- 浏览器启动时如距上次检查超 1 小时立即补检
- 系统通知汇总推送
- Edge/Chrome Side Panel 侧边栏展示，点击跳转仓库
- 侧边栏内直接配置 OAuth 凭证，无需改代码
- 支持仓库名搜索、A-Z / 时间 / Star 数排序
- 手动检查按钮 + 网络超时容错

## 安装

```bash
git clone https://github.com/Skady42/github-star-monitor.git
```

1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 开启「开发人员模式」→「加载解压缩的扩展」
3. 选择 `github-star-monitor/` 目录

详细配置步骤见 [github-star-monitor/README.md](github-star-monitor/README.md)

## 项目结构

```
github-star-monitor/
├── manifest.json          # MV3 配置 (ES Module + Side Panel)
├── background.js          # Service Worker
├── sidepanel/             # 侧边栏 UI
├── utils/                 # 工具模块
└── icons/                 # 图标
```

## 技术栈

Manifest V3 · ES Module SW · chrome.sidePanel · chrome.alarms · chrome.identity (OAuth) · chrome.notifications · 零依赖纯原生 JS
