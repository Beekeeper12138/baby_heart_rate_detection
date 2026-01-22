## 部署文档（开发/测试环境）

### 1. 依赖与环境
- Python 3.10+
- Node.js 18+

### 2. 后端（FastAPI）
#### 安装依赖
在 [backend](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend) 目录执行：
- `pip install -r requirements.txt`

#### 环境变量（推荐）
后端支持通过 `.env` 或环境变量配置关键参数（读取逻辑见 [config.py](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend/app/core/config.py)）：
- `SECRET_KEY`：JWT 签名密钥（生产环境必须修改）
- `ACCESS_TOKEN_EXPIRE_MINUTES`：访问令牌有效期（默认 30）
- `CORS_ALLOW_ORIGINS`：允许的前端 Origin（默认 localhost:3000/5173）
- `CREATE_DEFAULT_ADMIN`：是否创建默认管理员（默认 false）
- `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD`：默认管理员账号密码（仅当 CREATE_DEFAULT_ADMIN=true 时生效）

#### 数据库初始化/迁移
当前数据库为 SQLite。新环境可使用 SQL 脚本初始化：
- 脚本路径：[001_init.sql](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend/migrations/001_init.sql)
- 执行方式（示例）：使用 sqlite3 打开目标 db 文件后执行脚本内容

#### 启动
在 [backend](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend) 目录执行：
- `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### 3. 前端（Vite + React）
#### 安装依赖
在 [frontend](file:///e:/heart_rate_detection/workflow_heart_rate_detection/frontend) 目录执行：
- `npm install`

#### 启动
- `npm run dev`
- 默认访问：http://localhost:3000/

### 4. 首次使用（创建账号）
- 打开前端后进入登录页
- 选择“注册”创建账号
- 注册成功后会自动登录并进入系统

