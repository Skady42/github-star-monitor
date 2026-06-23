GitHub Star Release Monitor
监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知

功能
每小时整点自动检查 Star 仓库的新 Release
浏览器启动时如距上次检查超 1 小时立即补检
系统通知汇总推送
Edge/Chrome Side Panel 侧边栏展示，点击跳转仓库
侧边栏内直接配置 OAuth 凭证，无需改代码
支持仓库名搜索、A-Z / 时间 / Star 数排序
前置连通性检测 + 超时容错，不误报
安装
bash
git clone https://github.com/Skady42/github-star-monitor.git
打开 edge://extensions/ 或 chrome://extensions/
开启「开发人员模式」→「加载解压缩的扩展」
选择 github-star-monitor/ 目录
打开侧边栏，按提示配置 GitHub OAuth 凭证
详细配置步骤见 github-star-monitor/README.md

项目结构
github-star-monitor/
├── manifest.json          # MV3 配置 (ES Module + Side Panel)
├── background.js          # Service Worker（定时、OAuth、检查）
├── sidepanel/
│   ├── sidepanel.html     # 侧边栏界面
│   ├── sidepanel.css      # 样式
│   └── sidepanel.js       # 交互逻辑
├── utils/
│   ├── storage.js         # chrome.storage.local 封装
│   ├── github-api.js      # GitHub API（含超时）
│   └── notifications.js   # 系统通知
└── icons/                 # 16/48/128 图标
技术栈
Manifest V3 · ES Module Service Worker · chrome.sidePanel · chrome.alarms · chrome.identity · chrome.notifications · 零依赖纯原生 JS
