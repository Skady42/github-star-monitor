# GitHub Star Release Monitor - Design Spec

## Overview

Chrome 浏览器扩展（CRX），监控用户 GitHub Star 仓库的新 Release，每小时整点自动检查，通过系统通知推送汇总更新。

## Tech Stack

- **Manifest V3** — Chrome 现行标准
- **Service Worker** — 后台逻辑，Alarm 唤醒执行
- **chrome.alarms** — 整点定时调度
- **chrome.storage.local** — 持久化状态
- **chrome.identity.launchWebAuthFlow** — GitHub OAuth 授权
- **chrome.notifications** — 系统级通知
- **GitHub REST API** — 获取 Star 列表和 Release
- **原生 HTML/CSS/JS** — 弹窗 UI，零依赖

## File Structure

```
github-star-monitor/
├── manifest.json
├── background.js           # Service Worker
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── utils/
    ├── github-api.js       # GitHub API 封装
    ├── storage.js          # chrome.storage 封装
    └── notifications.js    # 通知生成
```

## Architecture

```
Popup UI  ←→  Service Worker  ←→  chrome.storage.local
                ↕                      
           chrome.alarms          GitHub API
                ↕                      
           chrome.notifications   chrome.identity (OAuth)
```

## Core Flows

### 1. 自动检查（每小时整点）

```
Alarm触发 → SW唤醒
  → 检查token（无token跳过）
  → 连通性探测: GET https://api.github.com（5s超时）
    → 超时/不可达: 记录失败，结束（不更新时间）
  → 获取Star列表 GET /user/starred（15s超时，per_page=100）
  → 逐个查最新Release GET /repos/{owner}/{repo}/releases（10s超时，per_page=3）
  → 对比 storage.known_releases，收集新 Release
  → 有新Release → 存入 pending_updates → 汇总通知 → 更新时间
  → 无新Release → 更新时间
```

### 2. 启动补检

```
浏览器启动 → SW注册(install/startup事件)
  → 读取 last_check_time
  → 距上次 ≥ 1小时 → 立即执行检查
  → 计算下一个整点 → 创建 Alarm（periodInMinutes=60）
```

### 3. 网络超时处理

- 前置连通性探测：一次 `GET /` 决定是否继续，不通则全部跳过
- 单仓库Release请求 10s 超时，单个失败不影响其他
- 全部失败不更新检查时间，下次启动补检
- 弹窗显示失败状态 + 手动重试建议

## Data Model (chrome.storage.local)

```js
{
  "github_token": "gho_xxx",
  "github_user": "RayHuey",
  "last_check_time": "2026-06-23T10:00:00Z",
  "known_releases": {
    "facebook/react": "v19.1.0",
    "torvalds/linux": "v6.12"
  },
  "pending_updates": [
    {
      "repo": "facebook/react",
      "tag": "v19.2.0",
      "name": "React 19.2",
      "url": "https://github.com/facebook/react/releases/tag/v19.2.0",
      "published_at": "2026-06-23T09:30:00Z",
      "detected_at": "2026-06-23T10:00:00Z"
    }
  ],
  "last_check_status": "success"
}
```

## Popup UI

**尺寸**: 380×480px

**结构**:
- 标题栏: 插件名 + 设置入口
- OAuth 状态: 已连接(绿点+用户名) / 未连接(授权按钮)
- 手动检查按钮 + 上次检查状态
- 更新列表: 仓库名 + tag + 发布时间 + 相对时间，点击跳转
- 空状态: "暂无更新"
- 错误状态: "网络连接失败"

**三态**:
- 已连接 → 显示全功能
- 未连接 → 仅授权按钮
- 网络错误 → 警告 + 手动重试

## Permissions Required

```json
{
  "permissions": ["storage", "alarms", "notifications", "identity"],
  "host_permissions": ["https://api.github.com/*", "https://github.com/*"]
}
```

## OAuth Setup

需在 GitHub 创建 OAuth App，配置 redirect_uri 为 Chrome 扩展专用格式:
`https://<extension-id>.chromiumapp.org/`

用户首次使用点击"授权 GitHub"，弹出浏览器窗口完成 OAuth，token 自动存入 storage。
