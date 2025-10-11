#!/bin/bash

# Secret Chat npm部署脚本

echo "开始部署 Secret Chat 服务器..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "npm 未安装，请检查Node.js安装"
    exit 1
fi

echo "Node.js版本: $(node --version)"
echo "npm版本: $(npm --version)"

# 安装项目依赖
echo "安装项目依赖..."
npm install

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

# 停止现有进程
echo "停止现有进程..."
pm2 stop secret-chat 2>/dev/null || true
pm2 delete secret-chat 2>/dev/null || true

# 启动应用
echo "启动应用..."
pm2 start server.js --name "secret-chat"

# 设置开机自启
pm2 startup
pm2 save

echo "部署完成！"
echo "应用状态:"
pm2 status

echo ""
echo "查看日志: pm2 logs secret-chat"
echo "重启应用: pm2 restart secret-chat"
echo "停止应用: pm2 stop secret-chat"
