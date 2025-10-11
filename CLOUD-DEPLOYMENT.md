# 阿里云服务器部署指南

本指南将帮助您在阿里云服务器上部署 Secret Chat 聊天服务器。

## 准备工作

### 1. 购买阿里云服务器
- 推荐配置：2核4GB内存，40GB硬盘
- 操作系统：Ubuntu 20.04 LTS 或 CentOS 7
- 安全组：开放 80、443、22 端口

### 2. 域名准备（可选但推荐）
- 购买域名并解析到服务器IP
- 推荐使用阿里云域名服务

## 部署步骤

### 第一步：连接服务器
```bash
ssh root@your-server-ip
```

### 第二步：更新系统
```bash
# Ubuntu
apt update && apt upgrade -y

# CentOS
yum update -y
```

### 第三步：上传项目文件
将项目文件上传到服务器，可以使用以下方法：

#### 方法1：使用 Git（推荐）
```bash
# 安装 Git
apt install git -y  # Ubuntu
# 或
yum install git -y  # CentOS

# 克隆项目
git clone your-repository-url
cd secret-chat-server
```

#### 方法2：使用 SCP
```bash
# 在本地执行
scp -r ./secret-chat-server root@your-server-ip:/root/
```

#### 方法3：使用 FTP/SFTP
使用 FileZilla 等工具上传文件

### 第四步：配置域名（如果有域名）
编辑 `nginx.conf` 文件：
```bash
nano nginx.conf
```

将 `your-domain.com` 替换为您的实际域名：
```nginx
server_name your-domain.com www.your-domain.com;
```

### 第五步：设置 SSL 证书（如果有域名）
```bash
# 给脚本执行权限
chmod +x ssl-setup.sh

# 编辑脚本，设置您的域名和邮箱
nano ssl-setup.sh

# 运行 SSL 设置脚本
./ssl-setup.sh
```

### 第六步：部署服务
```bash
# 给部署脚本执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

### 第七步：配置防火墙
```bash
# Ubuntu (ufw)
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable

# CentOS (firewalld)
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

## 配置客户端

### 修改客户端连接地址
编辑 `main.js` 文件，将 `your-domain.com` 替换为您的实际域名：

```javascript
const wsUrl = isLocal ? "ws://localhost:8080/chat-ws" : "wss://your-domain.com/chat-ws";
```

### 重新打包 Adobe 扩展
1. 修改 `CSXS/manifest.xml` 中的配置（如需要）
2. 将整个项目文件夹打包为 `.zxp` 文件
3. 在 Adobe 软件中安装扩展

## 管理服务

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs

# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs secret-chat
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart secret-chat
```

### 停止服务
```bash
docker-compose down
```

### 更新服务
```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 监控和维护

### 设置系统监控
```bash
# 安装 htop 监控系统资源
apt install htop -y

# 查看系统资源使用情况
htop
```

### 设置日志轮转
```bash
# 创建日志轮转配置
cat > /etc/logrotate.d/secret-chat << EOF
/root/secret-chat-server/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
```

### 设置自动备份
```bash
# 创建备份脚本
cat > /root/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /root/backup_$DATE.tar.gz /root/secret-chat-server
find /root -name "backup_*.tar.gz" -mtime +7 -delete
EOF

chmod +x /root/backup.sh

# 设置定时备份（每天凌晨2点）
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup.sh") | crontab -
```

## 故障排除

### 常见问题

1. **服务无法启动**
   ```bash
   # 检查 Docker 状态
   systemctl status docker
   
   # 检查端口占用
   netstat -tlnp | grep :8080
   ```

2. **SSL 证书问题**
   ```bash
   # 检查证书文件
   ls -la ssl/
   
   # 测试证书
   openssl x509 -in ssl/cert.pem -text -noout
   ```

3. **WebSocket 连接失败**
   ```bash
   # 检查 Nginx 配置
   nginx -t
   
   # 重启 Nginx
   docker-compose restart nginx
   ```

4. **内存不足**
   ```bash
   # 查看内存使用
   free -h
   
   # 清理 Docker 缓存
   docker system prune -a
   ```

### 性能优化

1. **增加服务器资源**
   - 升级到更高配置的服务器
   - 增加内存和CPU

2. **优化 Docker 配置**
   ```bash
   # 限制容器资源使用
   # 在 docker-compose.yml 中添加：
   deploy:
     resources:
       limits:
         memory: 512M
         cpus: '0.5'
   ```

3. **启用 Nginx 缓存**
   ```nginx
   # 在 nginx.conf 中添加缓存配置
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

## 安全建议

1. **定期更新系统**
   ```bash
   apt update && apt upgrade -y
   ```

2. **使用强密码**
   ```bash
   passwd root
   ```

3. **配置 SSH 密钥认证**
   ```bash
   # 禁用密码登录，只允许密钥登录
   nano /etc/ssh/sshd_config
   # 设置 PasswordAuthentication no
   systemctl restart sshd
   ```

4. **定期备份数据**
   - 设置自动备份脚本
   - 将备份文件存储到阿里云OSS

5. **监控异常访问**
   ```bash
   # 查看访问日志
   tail -f /var/log/nginx/access.log
   ```

## 成本优化

1. **选择合适的服务器配置**
   - 根据实际用户量选择配置
   - 使用按量付费节省成本

2. **使用阿里云优惠**
   - 新用户优惠
   - 长期包年包月优惠

3. **监控资源使用**
   - 定期检查CPU和内存使用率
   - 及时调整配置

## 联系支持

如果遇到问题，可以：
1. 查看本文档的故障排除部分
2. 检查服务器日志
3. 联系阿里云技术支持
4. 在项目仓库提交 Issue

---

**注意：** 请将文档中的 `your-domain.com` 替换为您的实际域名，`your-server-ip` 替换为您的服务器IP地址。
