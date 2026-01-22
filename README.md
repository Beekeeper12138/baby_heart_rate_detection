<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 婴儿心率监测系统（rPPG）

基于 rPPG（remote Photoplethysmography，远程光电容积描记）的视频心率估计 Demo：前端采集摄像头/ESP32-CAM 画面并通过 WebSocket 发送到后端，后端进行人脸 ROI 提取与信号处理，实时返回心率、SNR、光照一致性等指标，并提供历史记录与数据报告导出。

## 功能概览

- 实时监测（摄像头视频 → rPPG 心率估计）
- 支持视频源
  - 本机摄像头（浏览器 getUserMedia）
  - ESP32-CAM（常见 MJPEG 流地址）
- 信号质量指标与分析
  - SNR（信号质量）、光照一致性（lighting）
  - 前端可调算法参数：rPPG 灵敏度 / 运动抑制（已真实影响后端算法）
  - 推荐默认值（当前效果最佳）：灵敏度 75、运动抑制 40
- 历史记录
  - 保存监测摘要到 SQLite
  - 列表查看与隔离（按用户）
- 数据报告导出
  - 生成报告页并一键导出 PDF（无需弹窗/无需浏览器打印）
- 个人设置
  - 修改账号、昵称、头像（支持粘贴链接或选择图片生成内嵌 DataURL）
  - 修改密码（校验旧密码）

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：FastAPI + SQLAlchemy + SQLite + JWT
- 实时通信：WebSocket（浏览器 → FastAPI）
- 信号处理：NumPy + SciPy（频域分析、滤波等）

## 目录结构

```text
workflow_heart_rate_detection/
  frontend/                # React 前端（Vite）
    pages/                 # Dashboard/History/Settings/Report 等页面
    services/api.ts        # 后端 API 封装（登录/注册/历史/个人设置）
  backend/                 # FastAPI 后端
    app/api/               # HTTP + WebSocket 路由
    app/services/rppg.py   # rPPG 核心处理逻辑
    sql_app.db             # SQLite 数据库（运行后生成/更新）
```

## 环境要求

- Node.js：建议 18+
- Python：建议 3.10+
- 摄像头权限：浏览器需要允许访问摄像头（本机摄像头模式）

说明：后端 rPPG 代码使用了 `dlib` 做人脸检测（安装在 Windows 上可能需要编译环境/预编译轮子）。如果你启动时报 `No module named dlib`，请先安装 dlib 或按需替换人脸检测实现。

## 快速开始（开发模式）

### 1) 启动后端

在 `backend/` 目录创建虚拟环境并安装依赖：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

启动：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端默认地址：`http://localhost:8000`

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

## 配置说明（后端 .env）

后端支持在 `backend/.env` 配置（可选，未配置会使用开发默认值）：

```ini
secret_key=dev-secret-change-me
algorithm=HS256
access_token_expire_minutes=30
create_default_admin=false
default_admin_username=admin
default_admin_password=admin
```

生产环境务必替换 `secret_key`，并考虑使用更严格的 CORS / HTTPS / 安全存储令牌策略。

## 使用说明

### 摄像头与预览

- 本机摄像头：在“设置 → 摄像头设置”选择“本机摄像头”，侧边栏“实时预览”会显示真实画面和 FPS。
- ESP32-CAM：选择“ESP32 芯片摄像头”，在“网络流地址”填入 MJPEG 流地址（示例：`http://192.168.1.10:81/stream`），侧边栏将直接加载该图像流。

### 算法参数（信号处理）

“设置 → 信号处理”中的两个滑块会通过 WebSocket 下发到后端并影响算法：

- rPPG 灵敏度（推荐：75）
  - 越高：更积极出值（对噪声更宽容）
  - 越低：更保守（更稳但更慢）
- 运动抑制等级（推荐：40）
  - 越高：更强滤波/平滑（抗运动干扰更强，但可能更难出值）

### 历史记录与数据报告

- “监测页”可保存摘要记录到数据库
- “生成数据报告”会进入报告页，可直接导出 PDF（文件会自动下载到本地）

### 个人设置

“设置 → 个人设置”提供：

- 账号信息：账号（username）、昵称（full_name）、头像（avatar_url）
  - 头像支持链接或选择图片（会生成 DataURL 并保存到数据库）
  - 注意：内嵌头像会把图片内容存入数据库，涉及隐私与体积，请优先使用链接或小图片
- 修改密码：输入当前密码 + 新密码 + 确认新密码

## API / WebSocket 参考

### HTTP

- `POST /api/auth/register`：注册
- `POST /api/auth/token`：登录（OAuth2 Password Flow）
- `GET /api/auth/me`：获取当前用户
- `PUT /api/auth/me`：更新当前用户资料（username/full_name/avatar_url）
- `PUT /api/auth/password`：修改密码（current_password/new_password）
- `GET /api/history/`：获取历史记录
- `POST /api/history/`：保存历史记录

### WebSocket

- `ws://localhost:8000/ws/video`
  - 建连后可先发一条 text 消息配置算法参数：
    - `{"type":"config","rPPGSensitivity":75,"motionRejection":40}`
  - 随后持续发送二进制帧（JPEG Blob），后端返回 JSON 文本：
    - `{"bpm":123.4,"snr":55.0,"lighting":80.0,"resp_rate":16.0,"spo2":98.0,"quality":"Good", ...}`

## 数据库

- 默认 SQLite：`backend/sql_app.db`
- 表：
  - `users`：用户信息（username/hashed_password/full_name/avatar_url/created_at）
  - `history_records`：历史记录（按 user_id 隔离）

说明：`avatar_url` 字段在启动时会自动补列（SQLite 简易迁移）。

## 测试与构建

后端：

```bash
cd backend
pytest -q
```

前端：

```bash
cd frontend
npm run build
```

## 常见问题

### 1) 摄像头无画面

- 检查浏览器地址栏是否已允许摄像头权限
- 关闭占用摄像头的软件（如会议软件）

### 2) ESP32 预览加载失败

- 确认 `esp32Address` 是可直接访问的 MJPEG 直链
- 确认前端机器与 ESP32 在同一局域网

### 3) 后端提示缺少 dlib

- 需要安装 dlib（Windows 上可能需要 VS C++ Build Tools 或使用预编译轮子）

### 4) 更新头像失败 / 提示过长

- 选择图片会生成 DataURL，长度较长；建议选小图或使用链接形式

## 安全建议（生产）

- 替换 `secret_key`，不要使用默认值
- 使用 HTTPS
- 避免长期把 JWT 存在 localStorage（可考虑 HttpOnly Cookie）
- 头像建议使用“上传 + 静态文件 URL”方案，避免把图片内容直接写入数据库
