let channel = "";
let nick = "";
let socket = null;
let joined = false;
let reconnectDelay = 2000;
let heartbeatTimer = null;
let currentPage = "homepage"; // "homepage" 或 "chat"
let posts = []; // 存储帖子数据
let channels = []; // 存储频道数据

// DOM 元素
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const switchBtn = document.getElementById("switch-channel");
const modal = document.getElementById("channel-modal");
const modalChannel = document.getElementById("modal-channel");
const modalNick = document.getElementById("modal-nick");
const modalJoin = document.getElementById("modal-join");

// 新功能相关元素
const homepage = document.getElementById("homepage");
const chatPage = document.getElementById("chat-page");
const channelsList = document.getElementById("channels-list");
const refreshChannelsBtn = document.getElementById("refresh-channels-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const globalNickname = document.getElementById("global-nickname");
const settingsCancel = document.getElementById("settings-cancel");
const settingsSave = document.getElementById("settings-save");
const createChannelBtn = document.getElementById("create-channel-btn");
const createChannelModal = document.getElementById("create-channel-modal");
const createChannelName = document.getElementById("create-channel-name");
const createChannelDesc = document.getElementById("create-channel-desc");
const createChannelImage = document.getElementById("create-channel-image");
const uploadChannelImageBtn = document.getElementById("upload-channel-image-btn");
const channelImagePreview = document.getElementById("channel-image-preview");
const createChannelCancel = document.getElementById("create-channel-cancel");
const createChannelSubmit = document.getElementById("create-channel-submit");
const imageBtn = document.getElementById("image-btn");
const imageInput = document.getElementById("image-input");
const backHome = document.getElementById("back-home");
const currentChannel = document.getElementById("current-channel");
const deleteChannelBtn = document.getElementById("delete-channel-btn");

function showModal() {
  // 自动填充上次输入
  const lastChannel = localStorage.getItem('sc_last_channel') || '';
  const lastNick = localStorage.getItem('sc_last_nick') || '';
  modalChannel.value = lastChannel;
  modalNick.value = lastNick;
  modal.style.display = "flex";
  setTimeout(() => {
    if (lastChannel) {
      modalNick.focus();
    } else {
      modalChannel.focus();
    }
  }, 100);
}
function hideModal() {
  modal.style.display = "none";
}

function log(line) {
  const div = document.createElement("div");
  div.textContent = line;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 页面切换功能
function showPage(page) {
  currentPage = page;
  if (page === "homepage") {
    homepage.style.display = "flex";
    chatPage.style.display = "none";
    loadPosts(); // 先加载帖子
    loadChannels(); // 再加载频道
  } else if (page === "chat") {
    homepage.style.display = "none";
    chatPage.style.display = "flex";
    updateChatHeader();
  }
}

// 更新聊天头部
function updateChatHeader() {
  if (currentChannel && channel) {
    currentChannel.textContent = `#${channel}`;
    
    // 检查是否是频道创建者，显示删除按钮
    const globalNick = getGlobalNickname();
    const isOwner = isChannelOwner(channel, globalNick);
    if (deleteChannelBtn) {
      deleteChannelBtn.style.display = isOwner ? 'block' : 'none';
    }
  }
}

// 加载帖子列表
async function loadPosts() {
  try {
    // 从服务器获取帖子
    const response = await fetch('http://47.243.228.16:8080/api/posts');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        posts = data.posts;
        renderPosts();
        return;
      }
    }
  } catch (error) {
    console.log('从服务器获取帖子失败，使用本地存储:', error);
  }
  
  // 降级到本地存储
  const savedPosts = localStorage.getItem('sc_posts');
  if (savedPosts) {
    posts = JSON.parse(savedPosts);
  }
  renderPosts();
}

// 加载频道列表
async function loadChannels() {
  try {
    const response = await fetch('http://47.243.228.16:8080/api/channels');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        channels = data.channels;
        renderChannels();
        return;
      }
    }
  } catch (error) {
    console.log('从服务器获取频道列表失败:', error);
  }
  
  // 如果没有频道，显示空状态
  channels = [];
  renderChannels();
}

// 渲染频道列表
function renderChannels() {
  channelsList.innerHTML = "";
  
  if (channels.length === 0) {
    channelsList.innerHTML = '<div class="no-channels">暂无活跃频道</div>';
    return;
  }
  
  channels.forEach(channel => {
    const channelElement = createChannelElement(channel);
    channelsList.appendChild(channelElement);
  });
}

// 创建频道元素
function createChannelElement(channel) {
  const div = document.createElement("div");
  div.className = "channel-item";
  
  const globalNick = getGlobalNickname();
  const isOwner = channel.owner === globalNick;
  
  // 查找该频道的描述帖子
  const channelPost = posts.find(post => post.channel === channel.name && post.isChannelCreation);
  
  div.innerHTML = `
    <div class="channel-info">
      <div class="channel-header">
        <span class="channel-name">#${channel.name}</span>
        <span class="channel-users">${channel.userCount} 人在线</span>
      </div>
      ${channelPost ? `
        <div class="channel-description">
          <div class="post-content">${channelPost.content}</div>
          ${channelPost.image ? `<img src="${channelPost.image}" class="post-image" onclick="viewImage('${channelPost.image}')">` : ''}
        </div>
      ` : ''}
    </div>
    <div class="channel-actions">
      <button class="channel-action-btn" onclick="joinChannelFromList('${channel.name}')" title="加入频道">加入</button>
      ${isOwner ? `<button class="channel-action-btn delete" onclick="deleteChannel('${channel.name}')" title="删除频道">删除</button>` : ''}
    </div>
  `;
  
  return div;
}

// 从频道列表加入频道
function joinChannelFromList(channelName) {
  const globalNick = getGlobalNickname();
  let userNick;
  
  if (globalNick) {
    userNick = globalNick;
  } else {
    userNick = prompt(`请输入您的昵称:`);
    if (!userNick) return;
  }
  
  channel = channelName;
  nick = userNick;
  localStorage.setItem('sc_last_channel', channel);
  localStorage.setItem('sc_last_nick', nick);
  
  showPage("chat");
  messagesDiv.innerHTML = "";
  connect();
}

// 删除频道
async function deleteChannel(channelName) {
  const globalNick = getGlobalNickname();
  
  if (!globalNick) {
    alert("请先设置全局昵称");
    return;
  }
  
  if (!confirm(`确定要删除频道 #${channelName} 吗？这将删除该频道的所有帖子。`)) {
    return;
  }
  
  try {
    const response = await fetch(`http://47.243.228.16:8080/api/channels/${channelName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nick: globalNick })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadChannels(); // 重新加载频道列表
        loadPosts(); // 重新加载帖子列表
      }
    } else {
      const error = await response.json();
      alert(error.error || '删除频道失败');
    }
  } catch (error) {
    console.log('删除频道失败:', error);
    alert('删除频道失败，请检查网络连接');
  }
}

// 渲染帖子列表
function renderPosts() {
  postsList.innerHTML = "";
  if (posts.length === 0) {
    postsList.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">暂无帖子，快来发第一个帖子吧！</div>';
    return;
  }
  
  posts.forEach((post, index) => {
    const postElement = createPostElement(post, index);
    postsList.appendChild(postElement);
  });
}

// 创建帖子元素
function createPostElement(post, index) {
  const div = document.createElement("div");
  div.className = "post-item";
  
  const time = new Date(post.timestamp).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // 检查是否有删除权限
  const globalNick = getGlobalNickname();
  const canDelete = globalNick && (post.nick === globalNick || isChannelOwner(post.channel, globalNick));
  
  div.innerHTML = `
    <div class="post-header">
      <span class="post-channel">#${post.channel}</span>
      <span class="post-author">${post.nick}</span>
      <span class="post-time">${time}</span>
    </div>
    <div class="post-content">${post.content}</div>
    ${post.image ? `<img src="${post.image}" class="post-image" onclick="viewImage('${post.image}')">` : ''}
    <div class="post-actions">
      <button class="join-channel-btn" onclick="joinChannelFromPost('${post.channel}', '${post.nick}')">加入频道</button>
      ${canDelete ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')" title="删除帖子">删除</button>` : ''}
    </div>
  `;
  
  return div;
}

// 获取全局昵称
function getGlobalNickname() {
  return localStorage.getItem('sc_global_nickname') || '';
}

// 检查是否是频道创建者
function isChannelOwner(channelName, nick) {
  const channel = channels.find(ch => ch.name === channelName);
  return channel && channel.owner === nick;
}

// 删除帖子
async function deletePost(postId) {
  const globalNick = getGlobalNickname();
  
  if (!globalNick) {
    alert("请先设置全局昵称");
    return;
  }
  
  if (!confirm("确定要删除这个帖子吗？")) {
    return;
  }
  
  try {
    const response = await fetch(`http://47.243.228.16:8080/api/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nick: globalNick })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // 从本地帖子列表中移除
        posts = posts.filter(post => post.id != postId);
        renderPosts();
        alert(data.message);
      }
    } else {
      const error = await response.json();
      alert(error.error || '删除帖子失败');
    }
  } catch (error) {
    console.log('删除帖子失败:', error);
    alert('删除帖子失败，请检查网络连接');
  }
}

// 从帖子加入频道
function joinChannelFromPost(channelName, postNick) {
  const globalNick = getGlobalNickname();
  let userNick;
  
  if (globalNick) {
    // 如果有全局昵称，直接使用
    userNick = globalNick;
  } else {
    // 如果没有全局昵称，提示输入
    userNick = prompt(`请输入您的昵称（发帖人：${postNick}）:`);
    if (!userNick) return;
  }
  
  channel = channelName;
  nick = userNick;
  localStorage.setItem('sc_last_channel', channel);
  localStorage.setItem('sc_last_nick', nick);
  
  showPage("chat");
  messagesDiv.innerHTML = "";
  connect();
}

// 显示设置模态框
function showSettingsModal() {
  const currentNick = getGlobalNickname();
  globalNickname.value = currentNick;
  settingsModal.style.display = "flex";
}

// 隐藏设置模态框
function hideSettingsModal() {
  settingsModal.style.display = "none";
}

// 保存设置
function saveSettings() {
  const newNickname = globalNickname.value.trim();
  
  if (!newNickname) {
    alert("请输入昵称");
    return;
  }
  
  // 保存全局昵称
  localStorage.setItem('sc_global_nickname', newNickname);
  
  // 同时更新上次使用的昵称
  localStorage.setItem('sc_last_nick', newNickname);
  
  hideSettingsModal();
  
  // 显示保存成功提示
  alert(`昵称已保存为：${newNickname}`);
}

// 显示创建频道模态框
function showCreateChannelModal() {
  const globalNick = getGlobalNickname();
  const lastNick = globalNick || localStorage.getItem('sc_last_nick') || '';
  createChannelNick.value = lastNick;
  createChannelName.value = '';
  createChannelDesc.value = '';
  createChannelModal.style.display = "flex";
}

// 隐藏创建频道模态框
function hideCreateChannelModal() {
  createChannelModal.style.display = "none";
}

// 创建频道
async function createChannel() {
  const channelName = createChannelName.value.trim();
  const description = createChannelDesc.value.trim();
  const imageFile = createChannelImage.files[0];
  
  if (!channelName || !description) {
    alert("请输入频道名和描述");
    return;
  }
  
  const globalNick = getGlobalNickname();
  if (!globalNick) {
    alert("请先设置全局昵称");
    return;
  }
  
  // 创建频道描述帖子
  const post = {
    channel: channelName,
    nick: globalNick,
    content: description,
    image: null,
    isChannelCreation: true
  };
  
  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      post.image = e.target.result;
      await saveChannelPost(post, channelName);
    };
    reader.readAsDataURL(imageFile);
  } else {
    await saveChannelPost(post, channelName);
  }
}

// 保存频道帖子
async function saveChannelPost(post, channelName) {
  try {
    // 发送到服务器
    const response = await fetch('http://47.243.228.16:8080/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // 隐藏模态框
        hideCreateChannelModal();
        
        // 记忆用户信息
        localStorage.setItem('sc_last_channel', channelName);
        
        // 直接进入频道
        channel = channelName;
        nick = getGlobalNickname();
        
        showPage("chat");
        messagesDiv.innerHTML = "";
        connect();
        return;
      }
    }
  } catch (error) {
    console.log('发送频道帖子到服务器失败，保存到本地:', error);
  }
  
  // 降级到本地存储
  post.timestamp = Date.now();
  posts.unshift(post);
  localStorage.setItem('sc_posts', JSON.stringify(posts));
  
  // 隐藏模态框并进入频道
  hideCreateChannelModal();
  localStorage.setItem('sc_last_channel', channelName);
  channel = channelName;
  nick = getGlobalNickname();
  
  showPage("chat");
  messagesDiv.innerHTML = "";
  connect();
}

// 查看图片
function viewImage(imageSrc) {
  const viewer = document.createElement("div");
  viewer.className = "image-viewer";
  viewer.innerHTML = `
    <div class="viewer-controls">
      <button onclick="saveImage('${imageSrc}', 'viewer')" title="保存图片">💾</button>
      <button onclick="copyImageToClipboard('${imageSrc}')" title="复制图片">📋</button>
      <button onclick="document.body.removeChild(this.closest('.image-viewer'))" title="关闭">✕</button>
    </div>
    <img src="${imageSrc}">
  `;
  viewer.onclick = (e) => {
    if (e.target === viewer) {
      document.body.removeChild(viewer);
    }
  };
  document.body.appendChild(viewer);
}

// 保存图片
function saveImage(imageSrc, sender) {
  try {
    // 创建下载链接
    const link = document.createElement('a');
    link.href = imageSrc;
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `secret-chat-${sender || 'image'}-${timestamp}.png`;
    link.download = filename;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    log(`[info] 图片已保存为: ${filename}`);
  } catch (e) {
    log(`[error] 保存图片失败: ${e.message}`);
  }
}

// 复制图片到剪贴板
async function copyImageToClipboard(imageSrc) {
  try {
    // 将 base64 转换为 blob
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    
    // 复制到剪贴板
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    
    log("[info] 图片已复制到剪贴板");
  } catch (e) {
    log(`[error] 复制图片失败: ${e.message}`);
    // 降级方案：复制图片链接
    try {
      await navigator.clipboard.writeText(imageSrc);
      log("[info] 图片链接已复制到剪贴板");
    } catch (e2) {
      log(`[error] 复制失败: ${e2.message}`);
    }
  }
}

// 显示拖拽提示
function showDragTip() {
  const tip = document.createElement("div");
  tip.className = "drag-tip";
  tip.innerHTML = `
    <div class="tip-content">
      <h3>🎨 拖拽到 Photoshop</h3>
      <p>1. 直接拖拽图片到 PS 画布中</p>
      <p>2. 或者先保存图片，再在 PS 中打开</p>
      <p>3. 也可以复制图片后粘贴到 PS</p>
      <button onclick="document.body.removeChild(this.closest('.drag-tip'))">知道了</button>
    </div>
  `;
  document.body.appendChild(tip);
  
  // 3秒后自动关闭
  setTimeout(() => {
    if (document.body.contains(tip)) {
      document.body.removeChild(tip);
    }
  }, 5000);
}

// 显示发帖模态框
function showPostModal() {
  const lastChannel = localStorage.getItem('sc_last_channel') || '';
  const globalNick = getGlobalNickname();
  const lastNick = globalNick || localStorage.getItem('sc_last_nick') || '';
  postChannel.value = lastChannel;
  postNick.value = lastNick;
  postContent.value = '';
  imagePreview.innerHTML = '';
  postModal.style.display = "flex";
}

// 隐藏发帖模态框
function hidePostModal() {
  postModal.style.display = "none";
}

// 处理图片上传
function handleImageUpload(file, isChannel = false) {
  if (!file || !file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const imageData = e.target.result;
    if (isChannel) {
      channelImagePreview.innerHTML = `<img src="${imageData}">`;
    } else {
      sendImage(imageData);
    }
  };
  reader.readAsDataURL(file);
}

// 发送图片
function sendImage(imageData) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log("[warn] 尚未连接，正在重试连接...");
    connect();
    return;
  }
  if (!joined) {
    log("[info] 还未完成加入频道，稍后再试...");
    return;
  }
  
  try {
    socket.send(JSON.stringify({ 
      cmd: "chat", 
      text: "[图片]", 
      image: imageData 
    }));
    // 移除这里的 logImage 调用，让 WebSocket 消息处理统一处理
  } catch (e) {
    log("发送图片失败: " + e.message);
  }
}

// 显示图片消息
function logImage(sender, imageData) {
  const div = document.createElement("div");
  div.className = "message-container";
  
  // 创建消息头部
  const header = document.createElement("div");
  header.className = "message-header";
  header.innerHTML = `${sender}: [图片]`;
  
  // 创建图片容器
  const imageContainer = document.createElement("div");
  imageContainer.className = "image-container";
  
  const img = document.createElement("img");
  img.src = imageData;
  img.className = "message-image";
  img.draggable = true;
  img.onclick = () => viewImage(imageData);
  
  // 添加拖拽事件 - 支持拖拽到PS
  img.addEventListener('dragstart', (e) => {
    // 设置多种数据格式以支持不同的拖拽目标
    e.dataTransfer.setData('text/plain', imageData);
    e.dataTransfer.setData('text/html', `<img src="${imageData}">`);
    e.dataTransfer.setData('application/x-moz-file', imageData);
    e.dataTransfer.effectAllowed = 'copy';
    
    // 创建拖拽预览
    const dragPreview = img.cloneNode();
    dragPreview.style.width = '100px';
    dragPreview.style.height = '100px';
    dragPreview.style.opacity = '0.8';
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 50, 50);
    
    // 清理预览
    setTimeout(() => {
      if (document.body.contains(dragPreview)) {
        document.body.removeChild(dragPreview);
      }
    }, 0);
  });
  
  // 创建操作按钮
  const actions = document.createElement("div");
  actions.className = "image-actions";
  actions.innerHTML = `
    <button class="action-btn" onclick="viewImage('${imageData}')" title="查看大图">👁️</button>
    <button class="action-btn" onclick="saveImage('${imageData}', '${sender}')" title="保存图片">💾</button>
    <button class="action-btn" onclick="copyImageToClipboard('${imageData}')" title="复制图片">📋</button>
    <button class="action-btn" onclick="showDragTip()" title="拖拽到PS">🎨</button>
  `;
  
  imageContainer.appendChild(img);
  imageContainer.appendChild(actions);
  
  div.appendChild(header);
  div.appendChild(imageContainer);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 发布帖子
async function publishPost() {
  const channelName = postChannel.value.trim();
  const nickName = postNick.value.trim();
  const content = postContent.value.trim();
  const imageFile = postImage.files[0];
  
  if (!channelName || !nickName || !content) {
    alert("请填写完整信息");
    return;
  }
  
  const post = {
    channel: channelName,
    nick: nickName,
    content: content,
    image: null
  };
  
  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      post.image = e.target.result;
      await savePost(post);
    };
    reader.readAsDataURL(imageFile);
  } else {
    await savePost(post);
  }
}

// 保存帖子
async function savePost(post) {
  try {
    // 发送到服务器
    const response = await fetch('http://47.243.228.16:8080/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // 服务器返回的帖子会通过WebSocket广播，这里不需要手动添加
        hidePostModal();
        
        // 记忆用户信息
        localStorage.setItem('sc_last_channel', post.channel);
        localStorage.setItem('sc_last_nick', post.nick);
        return;
      }
    }
  } catch (error) {
    console.log('发送帖子到服务器失败，保存到本地:', error);
  }
  
  // 降级到本地存储
  post.timestamp = Date.now();
  posts.unshift(post);
  localStorage.setItem('sc_posts', JSON.stringify(posts));
  renderPosts();
  hidePostModal();
  
  // 记忆用户信息
  localStorage.setItem('sc_last_channel', post.channel);
  localStorage.setItem('sc_last_nick', post.nick);
}

function connect() {
  if (!channel || !nick) return;
  if (socket && socket.readyState === WebSocket.OPEN) return;

  messagesDiv.innerHTML = "连接中...";
  joined = false;

  // 支持本地和云服务器连接
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const wsUrl = isLocal ? "ws://localhost:8080/chat-ws" : "ws://47.243.228.16:8080/chat-ws";
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    messagesDiv.innerHTML = "已连接，正在加入频道...";
    try {
      socket.send(JSON.stringify({ cmd: "join", channel, nick }));
    } catch (e) {
      log("发送 join 失败: " + e.message);
    }

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ cmd: "ping" }));
        } catch (e) {
          console.warn("发送心跳失败:", e);
        }
      }
    }, 20000);
  };

  socket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.warn("非 JSON 消息:", event.data);
      return;
    }

    switch (msg.cmd) {
      case "chat": {
        const who = msg.nick || "?";
        if (msg.image) {
          logImage(who, msg.image);
        } else {
          log(`${who}: ${msg.text}`);
        }
        break;
      }
      case "info": {
        log(`[info] ${msg.text || ""}`);
        break;
      }
      case "postsList": {
        // 接收服务器发送的帖子列表
        if (msg.posts) {
          posts = msg.posts;
          renderPosts();
        }
        break;
      }
      case "newPost": {
        // 接收新帖子
        if (msg.post) {
          posts.unshift(msg.post);
          renderPosts();
        }
        break;
      }
      case "channelDeleted": {
        // 频道被删除
        if (msg.channel) {
          // 从频道列表中移除
          channels = channels.filter(ch => ch.name !== msg.channel);
          renderChannels();
          
          // 从帖子列表中移除相关帖子
          posts = posts.filter(post => post.channel !== msg.channel);
          renderPosts();
          
          log(`[info] 频道 #${msg.channel} 已被删除`);
        }
        break;
      }
      case "channelAutoDeleted": {
        // 频道自动删除（无人时）
        if (msg.channel) {
          // 从频道列表中移除
          channels = channels.filter(ch => ch.name !== msg.channel);
          renderChannels();
          
          // 从帖子列表中移除相关帖子
          posts = posts.filter(post => post.channel !== msg.channel);
          renderPosts();
          
          log(`[info] 频道 #${msg.channel} 无人，已自动删除`);
        }
        break;
      }
      case "postDeleted": {
        // 帖子被删除
        if (msg.postId) {
          // 从帖子列表中移除
          posts = posts.filter(post => post.id != msg.postId);
          renderPosts();
          
          log(`[info] 帖子已被删除`);
        }
        break;
      }
      case "warn": {
        log(`[warn] ${msg.text || ""}`);
        break;
      }
      case "onlineSet": {
        joined = true;
        const count = (msg.users && msg.users.length) || 0;
        log(`已加入 #${channel}，当前在线 ${count} 人`);
        break;
      }
      case "onlineAdd": {
        if (msg.nick) log(`➕ ${msg.nick} 加入`);
        break;
      }
      case "onlineRemove": {
        if (msg.nick) log(`➖ ${msg.nick} 离开`);
        break;
      }
      case "ping": {
        try {
          socket.send(JSON.stringify({ cmd: "ping" }));
        } catch (e) {
          console.warn("回复 ping 失败:", e);
        }
        break;
      }
      default: {
        console.debug("未处理消息:", msg);
      }
    }
  };

  socket.onerror = (err) => {
    console.error("WebSocket 错误:", err);
    log("[error] 连接出错，请检查网络或证书设置");
  };

  socket.onclose = (ev) => {
    const code = ev && ev.code != null ? ev.code : "";
    const reason = ev && ev.reason ? `，原因：${ev.reason}` : "";
    log(`连接已关闭${code ? `（代码 ${code}）` : ""}${reason}`);
    joined = false;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    // 不自动重连，需手动切换频道或刷新
  };
}

function sendText() {
  const text = input.value.trim();
  if (!text) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log("[warn] 尚未连接，正在重试连接...");
    connect();
    return;
  }
  if (!joined) {
    log("[info] 还未完成加入频道，稍后再试...");
    return;
  }
  try {
    socket.send(JSON.stringify({ cmd: "chat", text }));
    input.value = "";
  } catch (e) {
    log("发送失败: " + e.message);
  }
}

sendBtn.onclick = sendText;
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendText();
  }
});

switchBtn.onclick = () => {
  if (socket) {
    try { socket.close(); } catch (_) {}
  }
  showPage("homepage");
};

modalJoin.onclick = tryJoin;
modalChannel.addEventListener("keydown", (e) => {
  if (e.key === "Enter") modalNick.focus();
});
modalNick.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryJoin();
});

function tryJoin() {
  const ch = modalChannel.value.trim();
  const nk = modalNick.value.trim();
  if (!ch || !nk) {
    alert("请输入频道名和昵称");
    return;
  }
  channel = ch;
  nick = nk;
  // 记忆本次输入
  localStorage.setItem('sc_last_channel', ch);
  localStorage.setItem('sc_last_nick', nk);
  messagesDiv.innerHTML = "";
  hideModal();
  connect();
}


// 事件监听器
settingsBtn.onclick = showSettingsModal;
settingsCancel.onclick = hideSettingsModal;
settingsSave.onclick = saveSettings;
createChannelBtn.onclick = showCreateChannelModal;
createChannelCancel.onclick = hideCreateChannelModal;
createChannelSubmit.onclick = createChannel;
refreshChannelsBtn.onclick = loadChannels;
uploadChannelImageBtn.onclick = () => createChannelImage.click();
createChannelImage.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleImageUpload(e.target.files[0], true);
  }
});
imageBtn.onclick = () => imageInput.click();
imageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleImageUpload(e.target.files[0], false);
  }
});
backHome.onclick = () => showPage("homepage");
deleteChannelBtn.onclick = () => deleteChannel(channel);

// 强制隐藏模态框
function forceHideModal() {
  if (modal) {
    modal.style.display = "none";
  }
}

// 启动时显示主页并加载数据
// 确保页面显示正确
setTimeout(() => {
  forceHideModal(); // 强制隐藏模态框
  showPage("homepage");
}, 100);

// 关闭面板时清理连接
window.addEventListener("beforeunload", () => {
  try {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  } catch (_) {}
});
