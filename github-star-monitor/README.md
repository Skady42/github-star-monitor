# GitHub Star Release Monitor

Chrome/Edge 扩展，监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知。

## 功能

- 每小时整点检查 Star 仓库的新 Release
- 浏览器启动时如距上次检查超 1 小时则立即补检
- 系统通知推送汇总更新
- 侧边栏 (Side Panel) 展示更新列表，点击跳转仓库
- 手动检查按钮
- 网络超时自动跳过，不误报

## 安装步骤

### 1. 创建 GitHub OAuth App

1. 打开 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息:
   - Application name: GitHub Star Monitor
   - Homepage URL: (任意)
   - Authorization callback URL: 暂时填 `https://github.com/`，加载扩展后从控制台获取真实 redirectUri
4. 创建后获取 Client ID 和 Client Secret

### 2. 获取 Redirect URI

加载扩展后（见步骤 3），在 Service Worker 控制台执行:
```js
chrome.identity.getRedirectURL('oauth2')
```
将输出的 URL 填入 GitHub OAuth App 的 Authorization callback URL。

### 3. 配置扩展

打开 `background.js`，替换以下值:
- `YOUR_GITHUB_CLIENT_ID` 替换为你的 Client ID
- `YOUR_GITHUB_CLIENT_SECRET` 替换为你的 Client Secret

### 4. 加载扩展

Chrome/Edge:
1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 开启 "开发者模式"
3. 点击 "加载已解压的扩展程序"
4. 选择 `github-star-monitor/` 目录

### 5. 首次使用

1. 点击工具栏扩展图标，打开侧边栏
2. 点击 "连接 GitHub 账号" 进行 OAuth 授权
3. 授权后自动检查一次，之后每小时整点自动检查

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

## 技术细节

- **Manifest V3** + ES Module Service Worker
- **chrome.alarms** 整点调度，浏览器启动补检
- **chrome.sidePanel** 侧边栏 UI
- **chrome.identity.launchWebAuthFlow** GitHub OAuth
- **chrome.notifications** 系统通知
- 前置连通性检测 (5s 超时)，不通则跳过整轮检查
- 单仓库 Release 请求 10s 超时，单个失败不中断整体
- 零依赖，纯原生 JS
