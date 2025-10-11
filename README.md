# Secret Chat 项目

这是一个为 Adobe Photoshop/Illustrator 设计的聊天室扩展插件，包含客户端和服务器端完整解决方案。

## 项目结构

```
SecretChat beta/
├── client/                 # Adobe CEP 扩展客户端
│   ├── CSXS/              # Adobe 扩展配置文件
│   │   └── manifest.xml   # 扩展清单文件
│   ├── index.html         # 主界面
│   ├── index.css          # 样式文件
│   └── main.js            # 客户端逻辑
├── server/                # WebSocket 聊天服务器
│   ├── server.js          # 服务器主文件
│   ├── package.json       # Node.js 依赖配置
│   ├── Dockerfile         # Docker 镜像配置
│   ├── docker-compose.yml # Docker Compose 配置
│   ├── nginx.conf         # Nginx 反向代理配置
│   ├── ssl-setup.sh       # SSL 证书设置脚本
│   ├── deploy.sh          # 云服务器部署脚本
│   ├── start.bat          # Windows 启动脚本
│   └── .dockerignore      # Docker 忽略文件
├── CLOUD-DEPLOYMENT.md    # 云服务器部署详细指南
└── README.md              # 项目说明文档
```

## 快速开始

### 客户端（Adobe 扩展）

1. **安装到 Adobe 软件**
   - 将 `client` 文件夹复制到 Adobe CEP 扩展目录
   - 重启 Adobe 软件
   - 在菜单中找到 "Secret Chat" 面板

2. **配置服务器地址**
   - 编辑 `client/main.js` 文件
   - 将 `your-domain.com` 替换为您的服务器域名

### 服务器端

#### 本地开发

1. **进入服务器目录**
   ```bash
   cd server
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动服务器**
   ```bash
   npm start
   ```

#### 云服务器部署

1. **使用 Docker 部署（推荐）**
   ```bash
   cd server
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. **配置域名和 SSL**
   ```bash
   chmod +x ssl-setup.sh
   ./ssl-setup.sh
   ```

详细部署说明请参考 [CLOUD-DEPLOYMENT.md](CLOUD-DEPLOYMENT.md)

## 功能特性

### 客户端功能
- ✅ Adobe Photoshop/Illustrator 内置面板
- ✅ 多频道聊天支持
- ✅ 实时消息收发
- ✅ 用户进出通知
- ✅ 自动记忆频道和昵称
- ✅ 键盘快捷键支持
- ✅ 深色主题界面

### 服务器功能
- ✅ WebSocket 实时通信
- ✅ 多频道管理
- ✅ 用户会话管理
- ✅ 心跳保持连接
- ✅ 昵称冲突检测
- ✅ Docker 容器化部署
- ✅ Nginx 反向代理
- ✅ SSL/HTTPS 支持
- ✅ 自动证书续期

## 技术栈

### 客户端
- HTML5 + CSS3 + JavaScript
- Adobe CEP (Common Extensibility Platform)
- WebSocket API
- LocalStorage

### 服务器端
- Node.js + Express
- WebSocket (ws 库)
- Docker + Docker Compose
- Nginx
- Let's Encrypt SSL

## 消息协议

### 客户端发送
```javascript
// 加入频道
{ cmd: "join", channel: "频道名", nick: "昵称" }

// 发送消息
{ cmd: "chat", text: "消息内容" }

// 心跳包
{ cmd: "ping" }
```

### 服务器响应
```javascript
// 聊天消息
{ cmd: "chat", nick: "发送者", text: "消息内容" }

// 系统信息
{ cmd: "info", text: "信息内容" }

// 警告消息
{ cmd: "warn", text: "警告内容" }

// 在线用户列表
{ cmd: "onlineSet", users: ["用户1", "用户2"] }

// 用户加入/离开
{ cmd: "onlineAdd", nick: "用户名" }
{ cmd: "onlineRemove", nick: "用户名" }
```

## 部署选项

### 1. 本地开发
- 适合开发和测试
- 客户端连接 `ws://localhost:8080/chat-ws`

### 2. 云服务器部署
- 适合生产环境
- 支持 HTTPS/WSS 连接
- 自动 SSL 证书管理
- Docker 容器化部署

### 3. 阿里云部署
- 详细的阿里云部署指南
- 包含安全配置和监控
- 成本优化建议

## 开发指南

### 修改客户端
1. 编辑 `client/` 目录下的文件
2. 重新打包为 `.zxp` 文件
3. 在 Adobe 软件中重新安装

### 修改服务器
1. 编辑 `server/server.js` 文件
2. 重启服务器或使用 `npm run dev` 开发模式

### 添加新功能
1. 客户端和服务器端需要同步修改消息协议
2. 确保向后兼容性
3. 更新文档说明

## 故障排除

### 常见问题

1. **客户端无法连接服务器**
   - 检查服务器是否运行
   - 确认连接地址是否正确
   - 检查防火墙设置

2. **SSL 证书问题**
   - 确认域名解析正确
   - 检查证书文件是否存在
   - 查看 Nginx 配置

3. **Docker 部署失败**
   - 检查 Docker 和 Docker Compose 版本
   - 查看容器日志
   - 确认端口未被占用

### 日志查看
```bash
# 查看服务器日志
cd server
docker-compose logs -f

# 查看特定服务日志
docker-compose logs secret-chat
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者

---

**注意：** 请将配置中的 `your-domain.com` 替换为您的实际域名。