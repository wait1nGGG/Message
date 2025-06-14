const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 当前连接的用户
let users = [];

// 提供静态文件
app.use(express.static(path.join(__dirname, '../frontend')));

// 处理根路径重定向
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// WebSocket处理
wss.on('connection', (ws) => {
    console.log('新客户端已连接');
    
    // 消息处理
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (e) {
            console.error('消息解析错误:', e);
        }
    });
    
    // 连接关闭
    ws.on('close', () => {
        console.log('客户端断开连接');
        // 从用户列表中移除
        users = users.filter(user => user.ws !== ws);
        broadcastUserList();
    });
});

// 处理不同类型的消息
function handleMessage(ws, data) {
    switch (data.type) {
        case 'register':
            handleRegistration(ws, data);
            break;
        case 'message':
            handleTextMessage(data);
            break;
        case 'image':
            handleImageMessage(data);
            break;
        default:
            console.log('未知消息类型:', data.type);
    }
}

// 处理用户注册
function handleRegistration(ws, data) {
    const existingUser = users.find(user => user.username === data.username);
    
    if (existingUser) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '该用户名已被使用'
        }));
        return;
    }
    
    const user = {
        id: `user_${Date.now()}`,
        username: data.username,
        ws: ws,
        ip: getIpAddress(ws)
    };
    
    users.push(user);
    
    // 发送注册成功消息
    ws.send(JSON.stringify({
        type: 'registered',
        id: user.id
    }));
    
    // 广播更新后的用户列表
    broadcastUserList();
}

// 处理文本消息
function handleTextMessage(data) {
    const recipient = data.recipient;
    
    // 广播给所有用户
    if (recipient === 'all') {
        broadcastMessage(data);
    } 
    // 只发给特定用户
    else {
        const user = users.find(u => u.id === recipient);
        if (user) {
            sendMessageToUser(user, {
                type: 'text',
                sender: data.sender,
                content: data.content,
                timestamp: data.timestamp
            });
        }
    }
}

// 处理图片消息
function handleImageMessage(data) {
    const recipient = data.recipient;
    
    // 广播给所有用户
    if (recipient === 'all') {
        broadcastImage(data);
    } 
    // 只发给特定用户
    else {
        const user = users.find(u => u.id === recipient);
        if (user) {
            sendMessageToUser(user, {
                type: 'image',
                sender: data.sender,
                imageData: data.imageData,
                timestamp: data.timestamp
            });
        }
    }
}

// 广播消息到所有用户
function broadcastMessage(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'text',
                sender: data.sender,
                content: data.content,
                timestamp: data.timestamp
            }));
        }
    });
}

// 广播图片到所有用户
function broadcastImage(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'image',
                sender: data.sender,
                imageData: data.imageData,
                timestamp: data.timestamp
            }));
        }
    });
}

// 发送消息给特定用户
function sendMessageToUser(user, message) {
    if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(message));
    }
}

// 广播用户列表
function broadcastUserList() {
    const contactList = users.map(user => ({
        id: user.id,
        name: user.username,
        ip: user.ip
    }));
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'contact_list',
                contacts: contactList
            }));
        }
    });
}

// 获取客户端IP
function getIpAddress(ws) {
    // 如果通过代理，可能需要从headers中获取
    return ws._socket.remoteAddress;
}

// 获取本机IP地址
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
        for (let i = 0; i < interfaces[iface].length; i++) {
            const info = interfaces[iface][i];
            if (info.family === 'IPv4' && !info.internal) {
                return info.address;
            }
        }
    }
    return '127.0.0.1';
}

// 启动服务器
const PORT = 3000;
server.listen(PORT, () => {
    const ip = getLocalIpAddress();
    console.log(`服务器已启动`);
    console.log(`前端访问地址: http://127.0.0.1:3000`);
    console.log(`本机局域网IP: ${ip}:3000`);
});