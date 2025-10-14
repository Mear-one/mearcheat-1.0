let channel = "";
let nick = "";
let socket = null;
let joined = false;
let reconnectDelay = 2000;
let heartbeatTimer = null;
let currentPage = "homepage"; // "homepage" 或 "chat"
let posts = []; // 存储帖子数据
let channels = []; // 存储频道数据

// DOM 元素 - 安全获取
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const switchBtn = document.getElementById("switch-channel");
const modal = document.getElementById("channel-modal");
const modalChannel = document.getElementById("modal-channel");
const modalPassword = document.getElementById("modal-password");
const modalJoin = document.getElementById("modal-join");
const modalCancel = document.getElementById("modal-cancel");

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
const createChannelPassword = document.getElementById("create-channel-password");
// 图片功能已删除
const createChannelCancel = document.getElementById("create-channel-cancel");
const createChannelSubmit = document.getElementById("create-channel-submit");
const imageBtn = document.getElementById("image-btn");
const imageInput = document.getElementById("image-input");
const backHome = document.getElementById("back-home");
const currentChannel = document.getElementById("current-channel");
const deleteChannelBtn = document.getElementById("delete-channel-btn");

// 检查元素是否存在，避免错误
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
  }
  return element;
}

function showModal() {
  if (!modal || !modalChannel || !modalNick) return;
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
  if (modal) modal.style.display = "none";
}

function log(line) {
  if (!messagesDiv) return;
  const div = document.createElement("div");
  div.textContent = line;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 页面切换功能
async function showPage(page) {
  currentPage = page;
  if (page === "homepage") {
    if (homepage) homepage.style.display = "flex";
    if (chatPage) chatPage.style.display = "none";
    await loadPosts(); // 先加载帖子
    await loadChannels(); // 再加载频道
  } else if (page === "chat") {
    if (homepage) homepage.style.display = "none";
    if (chatPage) chatPage.style.display = "flex";
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
  // 直接连接到远程服务器
  const baseUrl = 'http://47.243.228.16:8080';
  
  try {
    // 从服务器获取帖子
    const response = await fetch(`${baseUrl}/api/posts`);
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
  // 直接连接到远程服务器
  const baseUrl = 'http://47.243.228.16:8080';
  
  try {
    const response = await fetch(`${baseUrl}/api/channels`);
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
  
  // 从帖子数据创建频道列表
  console.log('从帖子数据创建频道列表...');
  const channelMap = new Map();
  
  // 遍历所有帖子，找到频道创建帖子
  posts.forEach(post => {
    if (post.isChannelCreation) {
      if (!channelMap.has(post.channel)) {
        channelMap.set(post.channel, {
          name: post.channel,
          userCount: 0, // 默认在线人数为0
          owner: post.nick,
          hasPassword: !!post.password, // 记录是否有密码
          password: post.password // 保存密码信息
        });
      }
    }
  });
  
  channels = Array.from(channelMap.values());
  console.log('从帖子创建的公开频道:', channels);
  renderChannels();
}

// 渲染频道列表
function renderChannels() {
  if (!channelsList) {
    console.warn('channelsList element not found');
    return;
  }
  
  console.log('渲染频道列表，频道数量:', channels.length);
  console.log('帖子数量:', posts.length);
  
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
  console.log(`频道 ${channel.name} 的帖子:`, channelPost);

  div.innerHTML = `
    <div class="channel-info">
      <div class="channel-header">
        <span class="channel-name">#${channel.name}</span>
        <span class="channel-users">${channel.userCount} 人在线</span>
        ${channel.hasPassword ? '<span class="channel-lock">🔒</span>' : ''}
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
  
  if (!globalNick) {
    alert("请先设置全局昵称");
    showSettingsModal();
    return;
  }
  
  // 查找频道信息
  const channelInfo = channels.find(channel => channel.name === channelName);
  
  if (channelInfo && channelInfo.hasPassword) {
    // 频道有密码，需要输入密码
    const password = prompt(`频道 #${channelName} 需要密码，请输入密码：`);
    if (password === null) {
      // 用户取消
      return;
    }
    
    // 验证密码
    if (password !== channelInfo.password) {
      alert("密码错误");
      return;
    }
  }
  
  channel = channelName;
  nick = globalNick;
  localStorage.setItem('sc_last_channel', channel);
  
  showPage("chat");
  if (messagesDiv) messagesDiv.innerHTML = "";
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
    console.log('删除频道失败，尝试本地删除:', error);
    
    // 本地删除逻辑
    const channelToDelete = channels.find(ch => ch.name === channelName);
    if (!channelToDelete) {
      alert('频道不存在');
      return;
    }
    
    if (channelToDelete.owner !== globalNick) {
      alert('只有频道创建者才能删除频道');
      return;
    }
    
    // 从本地数据中删除相关帖子
    const originalLength = posts.length;
    posts = posts.filter(post => post.channel !== channelName);
    const deletedCount = originalLength - posts.length;
    
    // 保存到本地存储
    localStorage.setItem('sc_posts', JSON.stringify(posts));
    
    // 重新加载频道列表
    await loadChannels();
    
    alert(`频道 #${channelName} 已删除，共删除 ${deletedCount} 个帖子`);
  }
}

// 渲染帖子列表
function renderPosts() {
  // 帖子现在通过频道描述显示，不需要单独的帖子列表
  console.log("帖子数据已加载:", posts.length, "个帖子");
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
      <button class="join-channel-btn" onclick="joinChannelFromPost('${post.channel}', '${post.nick}')">加入</button>
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
  
  if (!globalNick) {
    alert("请先设置全局昵称");
    showSettingsModal();
    return;
  }
  
  // 查找频道创建帖子以获取密码信息
  const channelPost = posts.find(post => 
    post.channel === channelName && post.isChannelCreation
  );
  
  // 查找频道信息
  const channelInfo = channels.find(channel => channel.name === channelName);
  
  // 获取密码信息（优先从帖子获取，其次从频道信息获取）
  const channelPassword = channelPost?.password || channelInfo?.password;
  
  if (channelPassword) {
    // 频道有密码，需要输入密码
    const password = prompt(`频道 #${channelName} 需要密码，请输入密码：`);
    if (password === null) {
      // 用户取消
      return;
    }
    
    // 验证密码
    if (password !== channelPassword) {
      alert("密码错误");
      return;
    }
  }
  
  channel = channelName;
  nick = globalNick;
  localStorage.setItem('sc_last_channel', channel);
  
  showPage("chat");
  if (messagesDiv) messagesDiv.innerHTML = "";
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

// 显示加入频道模态框
function showJoinChannelModal() {
  if (!modal || !modalChannel) return;
  
  // 检查是否有全局昵称
  const globalNick = getGlobalNickname();
  if (!globalNick) {
    alert("请先设置全局昵称");
    showSettingsModal();
    return;
  }
  
  // 自动填充上次输入的频道名
  const lastChannel = localStorage.getItem('sc_last_channel') || '';
  modalChannel.value = lastChannel;
  modalPassword.value = ''; // 清空密码
  modal.style.display = "flex";
  setTimeout(() => {
    modalChannel.focus();
  }, 100);
}

// 显示创建频道模态框
function showCreateChannelModal() {
  if (!createChannelModal || !createChannelName || !createChannelDesc) return;
  const globalNick = getGlobalNickname();
  createChannelName.value = '';
  createChannelDesc.value = '';
  createChannelPassword.value = ''; // 清空密码
  createChannelModal.style.display = "flex";
}

// 隐藏创建频道模态框
function hideCreateChannelModal() {
  if (createChannelModal) createChannelModal.style.display = "none";
}

// 创建频道
async function createChannel() {
  if (!createChannelName || !createChannelDesc) return;
  const channelName = createChannelName.value.trim();
  const description = createChannelDesc.value.trim();
  const password = createChannelPassword.value.trim();

  if (!channelName || !description) {
    alert("请输入频道名和描述");
    return;
  }

  const globalNick = getGlobalNickname();
  if (!globalNick) {
    alert("请先设置全局昵称");
    return;
  }

  // 检查服务器连接
  const serverStatus = await testServerConnection();
  if (!serverStatus) {
    const proceed = confirm('服务器连接失败，频道将只保存在本地。其他设备可能无法看到此频道。是否继续？');
    if (!proceed) {
      return;
    }
  }

  // 创建频道描述帖子
  const post = {
    channel: channelName,
    nick: globalNick,
    content: description,
    image: null,
    password: password || null, // 添加密码字段
    isChannelCreation: true
  };

  await saveChannelPost(post, channelName);
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
  post.timestamp = new Date().toISOString();
  post.id = Date.now();
  posts.unshift(post);
  localStorage.setItem('sc_posts', JSON.stringify(posts));
  
  // 隐藏模态框并进入频道
  hideCreateChannelModal();
  localStorage.setItem('sc_last_channel', channelName);
  channel = channelName;
  nick = getGlobalNickname();
  
  showPage("chat");
  if (messagesDiv) messagesDiv.innerHTML = "";
  connect();
  
  alert('频道已创建（本地模式），其他设备可能无法立即看到');
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
function handleImageUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const imageData = e.target.result;
    sendImage(imageData);
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
  if (!messagesDiv) return;
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

  if (messagesDiv) messagesDiv.innerHTML = "连接中...";
  joined = false;

  // 直接连接到远程服务器
  const wsUrl = "ws://47.243.228.16:8080/chat-ws";
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    if (messagesDiv) messagesDiv.innerHTML = "已连接，正在加入频道...";
    try {
      // 查找频道密码信息
      const channelPost = posts.find(post => 
        post.channel === channel && post.isChannelCreation
      );
      const channelInfo = channels.find(ch => ch.name === channel);
      const channelPassword = channelPost?.password || channelInfo?.password;
      
      socket.send(JSON.stringify({ 
        cmd: "join", 
        channel, 
        nick, 
        password: channelPassword || null 
      }));
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
  if (!input) return;
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

if (sendBtn) sendBtn.onclick = sendText;
if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendText();
    }
  });
}

if (switchBtn) {
  switchBtn.onclick = () => {
    if (socket) {
      try { socket.close(); } catch (_) {}
    }
    showPage("homepage");
  };
}

if (modalJoin) modalJoin.onclick = tryJoin;
if (modalCancel) modalCancel.onclick = hideModal;
if (modalChannel) {
  modalChannel.addEventListener("keydown", (e) => {
    if (e.key === "Enter") modalPassword.focus();
  });
}
if (modalPassword) {
  modalPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryJoin();
  });
}

function tryJoin() {
  if (!modalChannel) return;
  const ch = modalChannel.value.trim();
  const password = modalPassword.value.trim();
  const nk = getGlobalNickname();
  
  if (!ch) {
    alert("请输入频道名");
    return;
  }
  
  if (!nk) {
    alert("请先设置全局昵称");
    showSettingsModal();
    return;
  }
  
  // 查找频道创建帖子
  const channelPost = posts.find(post => 
    post.channel === ch && post.isChannelCreation
  );
  
  // 查找频道信息
  const channelInfo = channels.find(channel => channel.name === ch);
  
  if (channelPost || channelInfo) {
    // 获取密码信息（优先从帖子获取，其次从频道信息获取）
    const channelPassword = channelPost?.password || channelInfo?.password;
    
    console.log('频道信息:', { channelPost, channelInfo, channelPassword });
    
    // 频道存在，检查密码
    if (channelPassword) {
      // 频道有密码，验证密码
      if (!password) {
        alert("该频道需要密码，请输入密码");
        modalPassword.focus();
        return;
      }
      if (password !== channelPassword) {
        alert("密码错误");
        modalPassword.focus();
        return;
      }
    }
    // 密码正确或无密码，加入频道
    console.log(`加入频道: ${ch}`);
    channel = ch;
    nick = nk;
    localStorage.setItem('sc_last_channel', ch);
    
    if (messagesDiv) messagesDiv.innerHTML = "";
    hideModal();
    showPage("chat");
    connect();
  } else {
    // 频道不存在
    alert("频道不存在，请检查频道名或先创建频道");
    modalChannel.focus();
  }
}


// 事件监听器 - 安全绑定
if (settingsBtn) {
  settingsBtn.onclick = showSettingsModal;
  console.log("设置按钮绑定成功");
} else {
  console.log("设置按钮未找到");
}

// 获取加入频道按钮
const joinChannelBtn = document.getElementById("join-channel-btn");

if (joinChannelBtn) {
  joinChannelBtn.onclick = showJoinChannelModal;
  console.log("加入频道按钮绑定成功");
} else {
  console.log("加入频道按钮未找到");
}

if (createChannelBtn) {
  createChannelBtn.onclick = showCreateChannelModal;
  console.log("创建频道按钮绑定成功");
} else {
  console.log("创建频道按钮未找到");
}

if (settingsCancel) settingsCancel.onclick = hideSettingsModal;
if (settingsSave) settingsSave.onclick = saveSettings;
if (createChannelCancel) createChannelCancel.onclick = hideCreateChannelModal;
if (createChannelSubmit) createChannelSubmit.onclick = createChannel;
if (refreshChannelsBtn) refreshChannelsBtn.onclick = loadChannels;
// 图片上传功能已删除
if (imageBtn && imageInput) {
  imageBtn.onclick = () => imageInput.click();
  imageInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  });
}
if (backHome) backHome.onclick = () => showPage("homepage");
if (deleteChannelBtn) deleteChannelBtn.onclick = () => deleteChannel(currentChannelName);

// 强制隐藏模态框
function forceHideModal() {
  if (modal) {
    modal.style.display = "none";
  }
}

// 数据同步功能
let syncTimer = null;

function startDataSync() {
  // 每30秒同步一次数据
  syncTimer = setInterval(async () => {
    await syncData();
  }, 30000);
  
  console.log('数据同步已启动，每30秒同步一次');
}

function stopDataSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('数据同步已停止');
  }
}

async function syncData() {
  try {
    console.log('开始同步数据...');
    
    // 尝试从服务器获取最新数据
    const [postsResponse, channelsResponse] = await Promise.allSettled([
      fetch('http://47.243.228.16:8080/api/posts'),
      fetch('http://47.243.228.16:8080/api/channels')
    ]);
    
    let dataUpdated = false;
    
    // 处理帖子数据
    if (postsResponse.status === 'fulfilled' && postsResponse.value.ok) {
      const postsData = await postsResponse.value.json();
      if (postsData.success && postsData.posts) {
        const newPosts = postsData.posts;
        if (JSON.stringify(posts) !== JSON.stringify(newPosts)) {
          posts = newPosts;
          localStorage.setItem('sc_posts', JSON.stringify(posts));
          dataUpdated = true;
          console.log('帖子数据已同步');
        }
      }
    }
    
    // 处理频道数据
    if (channelsResponse.status === 'fulfilled' && channelsResponse.value.ok) {
      const channelsData = await channelsResponse.value.json();
      if (channelsData.success && channelsData.channels) {
        const newChannels = channelsData.channels;
        if (JSON.stringify(channels) !== JSON.stringify(newChannels)) {
          channels = newChannels;
          dataUpdated = true;
          console.log('频道数据已同步');
        }
      }
    }
    
    // 如果数据有更新，重新渲染
    if (dataUpdated && currentPage === 'homepage') {
      await loadChannels();
      console.log('界面已更新');
    }
    
  } catch (error) {
    console.log('数据同步失败:', error);
  }
}

// 手动同步数据
async function manualSync() {
  console.log('手动同步数据...');
  
  // 先测试服务器连接
  const serverStatus = await testServerConnection();
  if (!serverStatus) {
    alert('服务器连接失败，无法同步数据。请检查网络连接或服务器状态。');
    return;
  }
  
  await syncData();
  alert('数据同步完成');
}

// 测试服务器连接
async function testServerConnection() {
  // 直接连接到远程服务器
  const baseUrl = 'http://47.243.228.16:8080';
  
  try {
    console.log('测试服务器连接...', baseUrl);
    const response = await fetch(`${baseUrl}/api/posts`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('服务器连接正常');
      return true;
    } else {
      console.log('服务器响应异常:', response.status);
      return false;
    }
  } catch (error) {
    console.log('服务器连接失败:', error);
    return false;
  }
}

// 更新服务器状态显示
async function updateServerStatus() {
  const statusElement = document.getElementById('server-status');
  if (!statusElement) return;
  
  const isConnected = await testServerConnection();
  if (isConnected) {
    statusElement.textContent = '🟢';
    statusElement.title = '服务器连接正常 (47.243.228.16:8080)';
  } else {
    statusElement.textContent = '🔴';
    statusElement.title = '服务器连接失败 (47.243.228.16:8080)';
  }
}

// 启动时显示主页并加载数据
// 确保页面显示正确
setTimeout(async () => {
  forceHideModal(); // 强制隐藏模态框
  await showPage("homepage");
  // 确保频道列表正确显示
  if (channelsList) {
    channelsList.innerHTML = '<div class="no-channels">正在加载频道...</div>';
  }
  
  // 启动数据同步
  startDataSync();
  
  // 更新服务器状态
  updateServerStatus();
}, 100);

// 关闭面板时清理连接
window.addEventListener("beforeunload", () => {
  try {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  } catch (_) {}
});
