const WebSocket = require('ws');
const express = require('express');
const http = require('http');

// 创建Express应用和HTTP服务器
const app = express();
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
  server,
  path: '/chat-ws'
});

// 存储频道和用户信息
const channels = new Map(); // channel -> Set of users
const userSessions = new Map(); // ws -> {nick, channel}
const channelOwners = new Map(); // channel -> owner nick

// 存储帖子信息
const posts = []; // 存储所有帖子
const MAX_POSTS = 100; // 最大帖子数量

// 静态文件服务（可选，用于测试页面）
app.use(express.static('.'));

// 添加JSON解析中间件
app.use(express.json());

// 帖子管理函数
function addPost(post) {
  // 添加时间戳和ID
  post.id = Date.now() + Math.random();
  post.timestamp = Date.now();
  
  // 添加到帖子列表开头
  posts.unshift(post);
  
  // 限制帖子数量
  if (posts.length > MAX_POSTS) {
    posts.splice(MAX_POSTS);
  }
  
  return post;
}

function getPosts(limit = 20) {
  return posts.slice(0, limit);
}

// HTTP API路由
// 获取帖子列表
app.get('/api/posts', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({
    success: true,
    posts: getPosts(limit)
  });
});

// 发布新帖子
app.post('/api/posts', (req, res) => {
  const { channel, nick, content, image, isChannelCreation } = req.body;
  
  if (!channel || !nick || !content) {
    return res.status(400).json({
      success: false,
      error: '频道名、昵称和内容不能为空'
    });
  }
  
  const post = addPost({
    channel,
    nick,
    content,
    image: image || null,
    isChannelCreation: isChannelCreation || false
  });
  
  // 如果是频道创建帖子，记录频道创建者
  if (isChannelCreation) {
    channelOwners.set(channel, nick);
    console.log(`频道 ${channel} 由 ${nick} 创建`);
  }
  
  // 广播新帖子给所有连接的客户端
  broadcastToAll({
    cmd: 'newPost',
    post: post
  });
  
  res.json({
    success: true,
    post: post
  });
});

// 获取活跃频道列表
app.get('/api/channels', (req, res) => {
  // 从帖子中获取所有有描述帖子的频道
  const channelsWithPosts = new Set();
  posts.forEach(post => {
    if (post.isChannelCreation) {
      channelsWithPosts.add(post.channel);
    }
  });
  
  // 合并在线频道和有描述帖子的频道
  const allChannels = new Set();
  channels.forEach((_, channelName) => allChannels.add(channelName));
  channelsWithPosts.forEach(channelName => allChannels.add(channelName));
  
  const channelList = Array.from(allChannels).map(channelName => {
    const onlineUsers = channels.get(channelName);
    return {
      name: channelName,
      userCount: onlineUsers ? onlineUsers.size : 0,
      owner: channelOwners.get(channelName) || null
    };
  });
  
  res.json({
    success: true,
    channels: channelList
  });
});

// 删除频道
app.delete('/api/channels/:channelName', (req, res) => {
  const { channelName } = req.params;
  const { nick } = req.body;
  
  if (!channelName || !nick) {
    return res.status(400).json({
      success: false,
      error: '频道名和昵称不能为空'
    });
  }
  
  // 检查是否是频道创建者
  const owner = channelOwners.get(channelName);
  if (owner !== nick) {
    return res.status(403).json({
      success: false,
      error: '只有频道创建者可以删除频道'
    });
  }
  
  // 删除频道
  channels.delete(channelName);
  channelOwners.delete(channelName);
  
  // 删除相关帖子（包括描述帖子和聊天帖子）
  const channelPosts = posts.filter(post => post.channel === channelName);
  channelPosts.forEach(() => {
    const index = posts.findIndex(post => post.channel === channelName);
    if (index !== -1) posts.splice(index, 1);
  });
  
  // 广播频道删除消息
  broadcastToAll({
    cmd: 'channelDeleted',
    channel: channelName
  });
  
  res.json({
    success: true,
    message: `频道 #${channelName} 已删除`
  });
});

// 广播消息到频道
function broadcastToChannel(channel, message, excludeWs = null) {
  const channelUsers = channels.get(channel);
  if (!channelUsers) return;

  const messageStr = JSON.stringify(message);
  channelUsers.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('发送消息失败:', error);
      }
    }
  });
}

// 广播消息到所有连接的客户端
function broadcastToAll(message, excludeWs = null) {
  const messageStr = JSON.stringify(message);
  wss.clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('发送消息失败:', error);
      }
    }
  });
}

// 获取频道在线用户列表
function getChannelUsers(channel) {
  const channelUsers = channels.get(channel);
  if (!channelUsers) return [];
  
  return Array.from(channelUsers)
    .filter(ws => ws.readyState === WebSocket.OPEN)
    .map(ws => userSessions.get(ws)?.nick)
    .filter(nick => nick);
}

// 处理用户加入频道
function handleJoin(ws, data) {
  const { channel, nick } = data;
  
  if (!channel || !nick) {
    ws.send(JSON.stringify({ 
      cmd: 'warn', 
      text: '频道名和昵称不能为空' 
    }));
    return;
  }

  // 检查昵称是否已存在
  const channelUsers = channels.get(channel);
  if (channelUsers) {
    const existingNicks = getChannelUsers(channel);
    if (existingNicks.includes(nick)) {
      ws.send(JSON.stringify({ 
        cmd: 'warn', 
        text: `昵称 "${nick}" 已被使用，请选择其他昵称` 
      }));
      return;
    }
  }

  // 清理旧连接
  const oldSession = userSessions.get(ws);
  if (oldSession) {
    const oldChannel = oldSession.channel;
    const oldNick = oldSession.nick;
    
    // 从旧频道移除
    const oldChannelUsers = channels.get(oldChannel);
    if (oldChannelUsers) {
      oldChannelUsers.delete(ws);
      if (oldChannelUsers.size === 0) {
        channels.delete(oldChannel);
      } else {
        // 通知其他用户该用户离开
        broadcastToChannel(oldChannel, {
          cmd: 'onlineRemove',
          nick: oldNick
        }, ws);
      }
    }
  }

  // 加入新频道
  if (!channels.has(channel)) {
    channels.set(channel, new Set());
    // 记录频道创建者
    channelOwners.set(channel, nick);
  }
  channels.get(channel).add(ws);
  userSessions.set(ws, { nick, channel });

  // 获取当前频道用户列表
  const users = getChannelUsers(channel);
  
  // 发送加入成功消息
  ws.send(JSON.stringify({
    cmd: 'onlineSet',
    users: users
  }));

  // 通知其他用户新用户加入
  broadcastToChannel(channel, {
    cmd: 'onlineAdd',
    nick: nick
  }, ws);

  // 发送欢迎消息
  ws.send(JSON.stringify({
    cmd: 'info',
    text: `欢迎加入频道 #${channel}！`
  }));

  console.log(`用户 ${nick} 加入频道 ${channel}`);
}

// 处理聊天消息
function handleChat(ws, data) {
  const session = userSessions.get(ws);
  if (!session) {
    ws.send(JSON.stringify({ 
      cmd: 'warn', 
      text: '请先加入频道' 
    }));
    return;
  }

  const { text, image } = data;
  
  // 检查是否有内容（文本或图片）
  if ((!text || text.trim() === '') && !image) {
    return;
  }

  // 构建消息对象
  const message = {
    cmd: 'chat',
    nick: session.nick,
    text: text ? text.trim() : '[图片]'
  };

  // 如果有图片，添加到消息中
  if (image) {
    message.image = image;
  }

  // 广播消息到频道
  broadcastToChannel(session.channel, message);

  if (image) {
    console.log(`[${session.channel}] ${session.nick}: [发送了图片]`);
  } else {
    console.log(`[${session.channel}] ${session.nick}: ${text}`);
  }
}

// 处理心跳
function handlePing(ws) {
  ws.send(JSON.stringify({ cmd: 'ping' }));
}

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('新的WebSocket连接:', req.socket.remoteAddress);
  
  // 发送最新的帖子列表给新连接的客户端
  ws.send(JSON.stringify({
    cmd: 'postsList',
    posts: getPosts(50) // 增加数量以包含更多频道描述帖子
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.cmd) {
        case 'join':
          handleJoin(ws, message);
          break;
        case 'chat':
          handleChat(ws, message);
          break;
        case 'ping':
          handlePing(ws);
          break;
        default:
          console.log('未知命令:', message.cmd);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
      ws.send(JSON.stringify({ 
        cmd: 'warn', 
        text: '消息格式错误' 
      }));
    }
  });

  ws.on('close', () => {
    const session = userSessions.get(ws);
    if (session) {
      const { nick, channel } = session;
      
      // 从频道移除用户
      const channelUsers = channels.get(channel);
      if (channelUsers) {
        channelUsers.delete(ws);
        if (channelUsers.size === 0) {
          // 频道无人时自动删除
          channels.delete(channel);
          channelOwners.delete(channel);
          
          // 删除相关帖子（包括描述帖子和聊天帖子）
          const channelPosts = posts.filter(post => post.channel === channel);
          channelPosts.forEach(() => {
            const index = posts.findIndex(post => post.channel === channel);
            if (index !== -1) posts.splice(index, 1);
          });
          
          // 广播频道自动删除消息
          broadcastToAll({
            cmd: 'channelAutoDeleted',
            channel: channel
          });
          
          console.log(`频道 ${channel} 无人，已自动删除`);
        } else {
          // 通知其他用户该用户离开
          broadcastToChannel(channel, {
            cmd: 'onlineRemove',
            nick: nick
          });
        }
      }
      
      userSessions.delete(ws);
      console.log(`用户 ${nick} 离开频道 ${channel}`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 启动服务器
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Secret Chat 服务器启动成功！`);
  console.log(`WebSocket地址: ws://localhost:${PORT}/chat-ws`);
  console.log(`HTTP地址: http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
