const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ====== 核心配置 ======
const FRONTEND_DIR = path.join(__dirname);
const INDEX_PATH = path.join(FRONTEND_DIR, 'index.html');

// ====== WebSocket 服务 ======
const wss = new WebSocket.Server({ server });

// 用户状态管理
const connectedUsers = new Map();

wss.on('connection', (ws) => {
  // 为每个用户创建唯一ID
  const userId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  let username = "未知用户";
  
  console.log(`[WS] 新用户连接: ${userId}`);
  
  // 发送初始联系人列表
  sendContactList(ws);
  
  // 消息处理
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        // 用户注册处理
        username = data.username;
        connectedUsers.set(userId, {
          username,
          ip: ws._socket.remoteAddress,
          ws
        });
        console.log(`[系统] 用户注册: ${username} (${userId})`);
        
        // 广播所有在线的联系人列表更新
        broadcast({
          type: 'contact-list',
          contacts: getContactList()
        });
        
        return;
      }
      
      if (data.type === 'message') {
        // 消息处理逻辑
        console.log(`[消息] ${username} 发送消息: ${data.content}`);
        
        if (data.to === 'all') {
          // 群发消息
          broadcast({
            type: 'message',
            from: userId,
            fromName: username,
            content: data.content,
            timestamp: Date.now()
          });
        } else {
          // 私聊消息
          const targetUser = connectedUsers.get(data.to);
          if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
            targetUser.ws.send(JSON.stringify({
              type: 'message',
              from: userId,
              fromName: username,
              content: data.content,
              timestamp: Date.now()
            }));
          }
        }
        
        return;
      }
      
    } catch (e) {
      console.error('消息处理错误:', e);
    }
  });
  
  // 连接关闭处理
  ws.on('close', () => {
    console.log(`[WS] 用户断开: ${username} (${userId})`);
    connectedUsers.delete(userId);
    broadcast({
      type: 'contact-list',
      contacts: getContactList()
    });
  });
});

// 获取当前联系人列表
function getContactList() {
  return Array.from(connectedUsers.values()).map(user => ({
    id: Array.from(connectedUsers.entries()).find(([_, u]) => u.username === user.username)?.[0] || "",
    username: user.username,
    ip: user.ip
  }));
}

// 发送联系人列表给指定用户
function sendContactList(ws) {
  ws.send(JSON.stringify({
    type: 'contact-list',
    contacts: getContactList()
  }));
}

// 广播消息给所有用户
function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// ====== HTTP 服务 ======

// 确保前端目录存在
if (!fs.existsSync(FRONTEND_DIR)) {
  console.warn(`⚠️ 警告: 前端目录不存在 (${FRONTEND_DIR})`);
  fs.mkdirSync(FRONTEND_DIR);
}

// 提供静态文件服务
app.use(express.static(FRONTEND_DIR));

// 主路由处理
app.get('/', (req, res) => {
  if (fs.existsSync(INDEX_PATH)) {
    res.sendFile(INDEX_PATH);
  } else {
    res.status(404).send(`
      <h2>前端文件未找到</h2>
      <p>请检查目录: ${FRONTEND_DIR}</p>
      <p>如为首次运行，请在项目中创建 frontend/index.html 文件</p>
    `);
  }
});

// 启动服务器
server.listen(PORT, () => {
  const networkInterfaces = os.networkInterfaces();
  let localIP = '127.0.0.1';
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (!iface.internal && iface.family === 'IPv4') {
        localIP = iface.address;
      }
    });
  });
  
  console.log('✅ 服务器已成功启动');
  console.log('➤ HTTP服务地址:');
  console.log(`  本地: http://localhost:${PORT}`);
  console.log(`  局域网: http://${localIP}:${PORT}`);
  console.log('➤ WebSocket服务地址:');
  console.log(`  本地: ws://localhost:${PORT}`);
  console.log(`  局域网: ws://${localIP}:${PORT}`);
});

// 关闭服务器处理
process.on('SIGINT', () => {
  console.log('\n🛑 关闭服务器...');
  wss.clients.forEach(client => client.close());
  server.close(() => {
    console.log('✅ 服务器已安全退出');
    process.exit(0);
  });
});