# GitHub Star Release Monitor

> 监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知

## 功能

- 自动检查：每小时整点检查 Star 仓库是否发布了新 Release
- 启动补检：浏览器打开时，如果距上次检查超过 1 小时则立即检查
- 侧边栏展示：点击工具栏图标打开 Side Panel，显示所有更新列表
- 系统通知：发现新 Release 时，Windows/Mac 弹出汇总通知
- 搜索排序：支持按仓库名搜索、按 A-Z / 时间 / Star 数排序
- OAuth 可视化配置：侧边栏直接填入凭证，不用改代码
- 网络容错：前置检测 GitHub 连通性，不通则跳过避免误报

---

## 快速开始

### 1. 创建 GitHub OAuth App

打开 https://github.com/settings/developers → **New OAuth App**，填写：

| 字段 | 值 |
|------|-----|
| Application name | `GitHub Star Monitor` |
| Homepage URL | 随意填（如 `https://github.com`） |
| Authorization callback URL | **先填 `https://github.com`**，后面再改 |

创建后拿到 **Client ID** 和 **Client Secret**（点 Generate a new client secret）。

### 2. 安装扩展

```bash
git clone https://github.com/Skady42/github-star-monitor.git
```

1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 开启「开发人员模式」
3. 点击「加载解压缩的扩展」
4. 选择刚才 clone 下来的 `github-star-monitor/` 目录

### 3. 配置回调地址

安装后点击浏览器工具栏的扩展图标，打开侧边栏。侧边栏顶部会显示一行 **回调地址**（类似 `https://xxxx.chromiumapp.org/oauth2`）。

**把这个地址完整复制**，回到 GitHub OAuth App 设置页，把 Authorization callback URL 改成它。

### 4. 连接 GitHub 账号

在侧边栏中：

1. 把 **Client ID** 和 **Client Secret** 粘贴到输入框
2. 点击 **保存凭证**
3. 点击下方出现的绿色按钮 **连接 GitHub 账号**
4. 浏览器会弹出 GitHub 授权页面 → 点 **Authorize**
5. 授权成功后自动执行第一次检查

### 5. 日常使用

- 授权后每小时整点自动检查，无需任何操作
- 有更新时系统弹出通知，点击侧边栏查看详情
- 侧边栏里每个更新项点击即可跳转到对应 Release 页面
- 随时点 **手动检查更新** 按钮立即检查

---

## 搜索与排序

侧边栏更新列表上方有两个控件：

- **搜索框**：输入关键字实时过滤，支持仓库名模糊匹配
- **排序下拉**：6 种排序方式

| 排序方式 | 说明 |
|----------|------|
| 更新: 新→旧 | 最近查到的 Release 排前面（默认） |
| 更新: 旧→新 | 最早发现的排前面 |
| 名称: A→Z | 按仓库名字母升序 |
| 名称: Z→A | 按仓库名字母降序 |
| 标星: 多→少 | 热门仓库排前面 |
| 标星: 少→多 | 小众仓库排前面 |

---

## 项目结构

```
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
```

## 技术栈

Manifest V3 · ES Module Service Worker · chrome.sidePanel · chrome.alarms · chrome.identity · chrome.notifications · 零依赖纯原生 JS
