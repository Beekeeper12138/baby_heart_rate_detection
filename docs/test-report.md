## 测试报告

### 1. 测试范围
- 后端单元/集成测试：认证、JWT 会话、历史记录访问与用户隔离
- 基础安全测试：登录接口 SQL 注入样式输入（应拒绝）、注册输入约束（减少 XSS/注入风险）
- 前端构建验证：确保新增登录页面与鉴权逻辑可编译

### 2. 执行结果（本地）
- 后端：`pytest -q` 通过（4 passed）
  - 测试文件：[test_api.py](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend/tests/test_api.py)
- 前端：`npm run build` 通过（Vite build 成功）

### 3. 覆盖点说明
- 用户注册/登录：`/api/auth/register`、`/api/auth/token`
- 会话校验：`/api/auth/me`（前端启动时用于判断是否已登录）
- 数据隔离：`/api/history/` 按 `user_id` 过滤，确保用户只能读写自己的记录
- 安全约束：
  - 注册输入约束（用户名仅允许字母/数字/下划线，密码最少 8 位）：见 [schemas.py](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend/app/schemas.py)
  - 登录 SQL 注入样式输入测试：见 [test_api.py](file:///e:/heart_rate_detection/workflow_heart_rate_detection/backend/tests/test_api.py)

