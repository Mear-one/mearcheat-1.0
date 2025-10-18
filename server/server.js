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
const channelTimeouts = new Map(); // channel -> timeout ID

// 存储帖子信息
const posts = []; // 存储所有帖子
const MAX_POSTS = 100; // 最大帖子数量

// 频道配置
const CHANNEL_IDLE_TIMEOUT = 6 * 60 * 60 * 1000; // 6小时（毫秒）
const PERIODIC_CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6小时定期清理（毫秒）

// 添加CORS支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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
  const { channel, nick, content, image, isChannelCreation, password } = req.body;
  
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
    isChannelCreation: isChannelCreation || false,
    password: password || null
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
    // 查找频道创建帖子以获取密码信息
    const channelPost = posts.find(post => 
      post.channel === channelName && post.isChannelCreation
    );
    
    return {
      name: channelName,
      userCount: onlineUsers ? onlineUsers.size : 0,
      owner: channelOwners.get(channelName) || null,
      hasPassword: !!channelPost?.password,
      password: channelPost?.password || null
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
  deleteChannel(channelName);
  
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

// 删除频道的辅助函数
function deleteChannel(channelName) {
  console.log(`[DEBUG] 删除频道: ${channelName}`);
  
  // 清除定时器
  const timeoutId = channelTimeouts.get(channelName);
  if (timeoutId) {
    clearTimeout(timeoutId);
    channelTimeouts.delete(channelName);
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
  
  // 广播频道自动删除消息
  broadcastToAll({
    cmd: 'channelAutoDeleted',
    channel: channelName
  });
  
  console.log(`频道 ${channelName} 已删除`);
}

// 设置频道空闲定时器
function setChannelIdleTimer(channelName) {
  // 清除现有定时器
  const existingTimeout = channelTimeouts.get(channelName);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    console.log(`[DEBUG] 清除频道 ${channelName} 的现有定时器`);
  }
  
  // 设置新的定时器
  const timeoutId = setTimeout(() => {
    console.log(`[TIMEOUT] 频道 ${channelName} 空闲超时，开始删除...`);
    deleteChannel(channelName);
  }, CHANNEL_IDLE_TIMEOUT);
  
  channelTimeouts.set(channelName, timeoutId);
  const hours = CHANNEL_IDLE_TIMEOUT / 1000 / 60 / 60;
  console.log(`[DEBUG] 设置频道 ${channelName} 空闲定时器，${hours}小时后删除 (定时器ID: ${timeoutId})`);
}

// 清除频道空闲定时器
function clearChannelIdleTimer(channelName) {
  const timeoutId = channelTimeouts.get(channelName);
  if (timeoutId) {
    clearTimeout(timeoutId);
    channelTimeouts.delete(channelName);
    console.log(`[DEBUG] 清除频道 ${channelName} 的空闲定时器 (定时器ID: ${timeoutId})`);
  } else {
    console.log(`[DEBUG] 频道 ${channelName} 没有活跃的定时器需要清除`);
  }
}

// 处理用户加入频道
function handleJoin(ws, data) {
  const { channel, nick, password } = data;
  
  console.log(`[DEBUG] 用户尝试加入频道:`, { channel, nick, hasPassword: !!password });
  
  if (!channel || !nick) {
    console.log(`[DEBUG] 频道名或昵称为空:`, { channel, nick });
    ws.send(JSON.stringify({ 
      cmd: 'warn', 
      text: '频道名和昵称不能为空' 
    }));
    return;
  }

  // 检查频道是否需要密码验证
  const channelPost = posts.find(post => 
    post.channel === channel && post.isChannelCreation
  );
  
  console.log(`[DEBUG] 查找频道创建帖子:`, { 
    channel, 
    foundPost: !!channelPost, 
    hasPassword: !!channelPost?.password,
    postsCount: posts.length 
  });
  
  if (channelPost && channelPost.password) {
    // 频道有密码，需要验证
    console.log(`[DEBUG] 频道需要密码验证:`, { 
      channel, 
      providedPassword: !!password,
      expectedPassword: channelPost.password 
    });
    
    if (!password) {
      console.log(`[DEBUG] 用户未提供密码`);
      ws.send(JSON.stringify({ 
        cmd: 'warn', 
        text: '该频道需要密码，请输入密码' 
      }));
      return;
    }
    
    if (password !== channelPost.password) {
      console.log(`[DEBUG] 密码验证失败:`, { 
        provided: password, 
        expected: channelPost.password 
      });
      ws.send(JSON.stringify({ 
        cmd: 'warn', 
        text: '密码错误' 
      }));
      return;
    }
    
    console.log(`[DEBUG] 密码验证成功`);
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
        // 频道无人时，设置空闲定时器而不是立即删除
        setChannelIdleTimer(oldChannel);
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
  } else {
    // 如果频道存在，清除空闲定时器（因为有人加入了）
    clearChannelIdleTimer(channel);
  }
  channels.get(channel).add(ws);
  userSessions.set(ws, { nick, channel });

  // 获取当前频道用户列表
  const users = getChannelUsers(channel);
  
  // 发送加入成功消息
  console.log(`[DEBUG] 发送 onlineSet 消息:`, { channel, nick, usersCount: users.length });
  const onlineSetMessage = JSON.stringify({
    cmd: 'onlineSet',
    users: users
  });
  console.log(`[DEBUG] onlineSet 消息内容:`, onlineSetMessage);
  ws.send(onlineSetMessage);

  // 通知其他用户新用户加入
  broadcastToChannel(channel, {
    cmd: 'onlineAdd',
    nick: nick
  }, ws);

  // 发送欢迎消息
  const welcomeMessage = JSON.stringify({
    cmd: 'info',
    text: `欢迎加入频道 #${channel}！`
  });
  console.log(`[DEBUG] 发送欢迎消息:`, welcomeMessage);
  ws.send(welcomeMessage);

  console.log(`[DEBUG] 用户 ${nick} 成功加入频道 ${channel}，当前在线 ${users.length} 人`);
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
          // 频道无人时，设置空闲定时器而不是立即删除
          setChannelIdleTimer(channel);
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
  console.log(`频道空闲超时设置: ${CHANNEL_IDLE_TIMEOUT / 1000 / 60 / 60}小时`);
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
