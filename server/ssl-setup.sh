#!/bin/bash

# SSL 证书设置脚本
# 使用 Let's Encrypt 免费 SSL 证书

set -e

# 配置变量
DOMAIN="your-domain.com"
EMAIL="your-email@example.com"

echo "开始设置 SSL 证书..."

# 检查是否安装了 certbot
if ! command -v certbot &> /dev/null; then
    echo "安装 certbot..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Debian
        sudo apt update
        sudo apt install -y certbot
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install certbot
    else
        echo "请手动安装 certbot"
        exit 1
    fi
fi

# 创建证书目录
mkdir -p ssl

# 获取 SSL 证书
echo "获取 SSL 证书..."
sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# 复制证书到项目目录
echo "复制证书文件..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*.pem

echo "SSL 证书设置完成！"
echo "证书文件已保存到 ssl/ 目录"

# 设置自动续期
echo "设置自动续期..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'docker-compose restart nginx'") | crontab -

echo "自动续期已设置完成！"
