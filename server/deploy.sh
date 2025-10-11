#!/bin/bash

# Secret Chat 云服务器部署脚本

set -e

echo "开始部署 Secret Chat 服务器..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Docker 安装完成，请重新登录后再次运行此脚本"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose 未安装，正在安装..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 创建必要的目录
mkdir -p logs ssl

# 停止现有容器
echo "停止现有容器..."
docker-compose down || true

# 构建并启动服务
echo "构建并启动服务..."
docker-compose up -d --build

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 显示日志
echo "显示服务日志..."
docker-compose logs --tail=50

echo "部署完成！"
echo "服务地址: http://your-domain.com"
echo "WebSocket地址: wss://your-domain.com/chat-ws"
echo ""
echo "查看实时日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo "重启服务: docker-compose restart"
