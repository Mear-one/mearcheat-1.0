let channel = "";
let nick = "";
let socket = null;
let joined = false;
let reconnectDelay = 2000;
let heartbeatTimer = null;
let currentPage = "homepage"; // "homepage" 或 "chat"
let posts = []; // 存储帖子数据

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
const postsList = document.getElementById("posts-list");
const newPostBtn = document.getElementById("new-post-btn");
const postModal = document.getElementById("post-modal");
const postChannel = document.getElementById("post-channel");
const postNick = document.getElementById("post-nick");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");
const uploadImageBtn = document.getElementById("upload-image-btn");
const imagePreview = document.getElementById("image-preview");
const postCancel = document.getElementById("post-cancel");
const postSubmit = document.getElementById("post-submit");
const imageBtn = document.getElementById("image-btn");
const imageInput = document.getElementById("image-input");
const backHome = document.getElementById("back-home");

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
    loadPosts();
  } else if (page === "chat") {
    homepage.style.display = "none";
    chatPage.style.display = "flex";
  }
}

// 加载帖子列表
function loadPosts() {
  // 从本地存储加载帖子，实际应用中应该从服务器获取
  const savedPosts = localStorage.getItem('sc_posts');
  if (savedPosts) {
    posts = JSON.parse(savedPosts);
  }
  renderPosts();
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
  
  div.innerHTML = `
    <div class="post-header">
      <span class="post-channel">#${post.channel}</span>
      <span class="post-time">${time}</span>
    </div>
    <div class="post-content">${post.content}</div>
    ${post.image ? `<img src="${post.image}" class="post-image" onclick="viewImage('${post.image}')">` : ''}
    <div class="post-actions">
      <button class="join-channel-btn" onclick="joinChannelFromPost('${post.channel}', '${post.nick}')">加入频道</button>
    </div>
  `;
  
  return div;
}

// 从帖子加入频道
function joinChannelFromPost(channelName, postNick) {
  const userNick = prompt(`请输入您的昵称（发帖人：${postNick}）:`);
  if (!userNick) return;
  
  channel = channelName;
  nick = userNick;
  localStorage.setItem('sc_last_channel', channel);
  localStorage.setItem('sc_last_nick', nick);
  
  showPage("chat");
  messagesDiv.innerHTML = "";
  connect();
}

// 查看图片
function viewImage(imageSrc) {
  const viewer = document.createElement("div");
  viewer.className = "image-viewer";
  viewer.innerHTML = `<img src="${imageSrc}">`;
  viewer.onclick = () => document.body.removeChild(viewer);
  document.body.appendChild(viewer);
}

// 显示发帖模态框
function showPostModal() {
  const lastChannel = localStorage.getItem('sc_last_channel') || '';
  const lastNick = localStorage.getItem('sc_last_nick') || '';
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
function handleImageUpload(file, isPost = false) {
  if (!file || !file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const imageData = e.target.result;
    if (isPost) {
      imagePreview.innerHTML = `<img src="${imageData}">`;
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
    logImage(nick, imageData);
  } catch (e) {
    log("发送图片失败: " + e.message);
  }
}

// 显示图片消息
function logImage(sender, imageData) {
  const div = document.createElement("div");
  div.innerHTML = `
    <div>${sender}: [图片]</div>
    <img src="${imageData}" class="message-image" onclick="viewImage('${imageData}')">
  `;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 发布帖子
function publishPost() {
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
    timestamp: Date.now(),
    image: null
  };
  
  if (imageFile) {
    const reader = new FileReader();
    reader.onload = (e) => {
      post.image = e.target.result;
      savePost(post);
    };
    reader.readAsDataURL(imageFile);
  } else {
    savePost(post);
  }
}

// 保存帖子
function savePost(post) {
  posts.unshift(post); // 添加到开头
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
  const wsUrl = isLocal ? "ws://localhost:8080/chat-ws" : "wss://your-domain.com/chat-ws";
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
  showModal();
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
newPostBtn.onclick = showPostModal;
postCancel.onclick = hidePostModal;
postSubmit.onclick = publishPost;
uploadImageBtn.onclick = () => postImage.click();
postImage.addEventListener('change', (e) => {
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

// 启动时显示主页
showPage("homepage");

// 关闭面板时清理连接
window.addEventListener("beforeunload", () => {
  try {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  } catch (_) {}
});
