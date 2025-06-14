// 主状态对象
const appState = {
    username: '',
    contacts: [],
    currentChat: null,
    ws: null
};

// DOM元素引用
const elements = {
    loginScreen: document.getElementById('login-screen'),
    chatScreen: document.getElementById('chat-screen'),
    usernameInput: document.getElementById('username'),
    startChatBtn: document.getElementById('start-chat'),
    currentUsername: document.getElementById('current-username'),
    userIcon: document.getElementById('user-icon'),
    contactsList: document.getElementById('contacts'),
    chatTitle: document.getElementById('chat-title'),
    connectionStatus: document.getElementById('connection-status'),
    messageContainer: document.getElementById('message-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    fileInput: document.getElementById('file-input'),
    addContactModal: document.getElementById('add-contact-modal'),
    contactIpInput: document.getElementById('contact-ip'),
    contactNameInput: document.getElementById('contact-name'),
    addContactCancel: document.getElementById('add-contact-cancel'),
    addContactConfirm: document.getElementById('add-contact-confirm')
};

// 初始化应用
function initApp() {
    // 加载保存的联系人
    loadContacts();
    
    // 设置事件监听
    elements.startChatBtn.addEventListener('click', handleStartChat);
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    elements.addContactConfirm.addEventListener('click', addContact);
    elements.addContactCancel.addEventListener('click', closeAddContactModal);
    
    document.getElementById('add-contact').addEventListener('click', openAddContactModal);
    elements.fileInput.addEventListener('change', handleFileUpload);
}

// 开始聊天
function handleStartChat() {
    const username = elements.usernameInput.value.trim();
    if (!username) {
        alert('请输入您的昵称');
        return;
    }
    
    appState.username = username;
    elements.currentUsername.textContent = username;
    
    // 显示用户名字的第一个字母作为图标
    const firstLetter = username.charAt(0).toUpperCase();
    elements.userIcon.textContent = firstLetter;
    
    // 切换到聊天界面
    elements.loginScreen.classList.remove('active');
    elements.chatScreen.classList.add('active');
    
    // 初始化WebSocket连接
    initWebSocket();
}

// 初始化WebSocket
function initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:3001'; // 本地后端服务
    
    appState.ws = new WebSocket(`${protocol}//${host}`);
    
    appState.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        
        // 连接后发送用户信息
        appState.ws.send(JSON.stringify({
            type: 'register',
            username: appState.username
        }));
        
        elements.connectionStatus.textContent = '在线';
        elements.connectionStatus.classList.add('online');
    };
    
    appState.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleIncomingMessage(message);
    };
    
    appState.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        elements.connectionStatus.textContent = '连接错误';
        elements.connectionStatus.classList.remove('online');
    };
    
    appState.ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        elements.connectionStatus.textContent = '离线';
        elements.connectionStatus.classList.remove('online');
    };
}

// 处理收到的消息
function handleIncomingMessage(message) {
    if (message.type === 'text') {
        addMessageToChat(message.sender, message.content, message.timestamp, false);
    }
    else if (message.type === 'image') {
        addImageMessage(message.sender, message.imageData, message.timestamp, false);
    }
    else if (message.type === 'contact_list') {
        updateContactList(message.contacts);
    }
}

// 发送消息
function sendMessage() {
    const messageContent = elements.messageInput.value.trim();
    if (!messageContent) return;
    
    const timestamp = new Date().getTime();
    
    // 添加到当前聊天
    addMessageToChat(appState.username, messageContent, timestamp, true);
    
    // 通过WebSocket发送
    appState.ws.send(JSON.stringify({
        type: 'message',
        content: messageContent,
        timestamp: timestamp,
        recipient: appState.currentChat ? appState.currentChat.id : 'all'
    }));
    
    // 清空输入框
    elements.messageInput.value = '';
}

// 处理文件上传
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 只允许图片文件
    if (!file.type.match('image.*')) {
        alert('请选择图片文件（JPG, PNG, GIF）');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        
        // 添加到聊天
        const timestamp = new Date().getTime();
        addImageMessage(appState.username, imageData, timestamp, true);
        
        // 通过WebSocket发送
        appState.ws.send(JSON.stringify({
            type: 'image',
            imageData: imageData,
            timestamp: timestamp,
            recipient: appState.currentChat ? appState.currentChat.id : 'all'
        }));
    };
    reader.readAsDataURL(file);
    
    // 重置文件输入
    event.target.value = '';
}

// 添加文本消息到聊天
function addMessageToChat(sender, content, timestamp, isOutgoing) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');
    
    const time = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span>${sender}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${content}</div>
    `;
    
    elements.messageContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 添加图片消息到聊天
function addImageMessage(sender, imageData, timestamp, isOutgoing) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');
    
    const time = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span>${sender}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">
            <img src="${imageData}" class="message-image" alt="发送的图片">
        </div>
    `;
    
    elements.messageContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 滚动到最新消息
function scrollToBottom() {
    elements.messageContainer.scrollTop = elements.messageContainer.scrollHeight;
}

// 联系人管理
function loadContacts() {
    const savedContacts = localStorage.getItem('contacts');
    if (savedContacts) {
        appState.contacts = JSON.parse(savedContacts);
        renderContacts();
    }
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(appState.contacts));
}

function renderContacts() {
    elements.contactsList.innerHTML = '';
    
    appState.contacts.forEach(contact => {
        const contactItem = document.createElement('li');
        contactItem.classList.add('contact-item');
        if (appState.currentChat && appState.currentChat.id === contact.id) {
            contactItem.classList.add('active');
        }
        
        const firstLetter = contact.name.charAt(0).toUpperCase();
        
        contactItem.innerHTML = `
            <div class="contact-icon">${firstLetter}</div>
            <div class="contact-name">${contact.name}</div>
        `;
        
        contactItem.addEventListener('click', () => {
            setCurrentChat(contact);
        });
        
        elements.contactsList.appendChild(contactItem);
    });
}

// 设置当前聊天
function setCurrentChat(contact) {
    appState.currentChat = contact;
    renderContacts();
    elements.chatTitle.textContent = contact.name;
    elements.messageContainer.innerHTML = `<p class="no-messages">开始与 ${contact.name} 聊天</p>`;
}

// 打开添加联系人对话框
function openAddContactModal() {
    elements.addContactModal.classList.add('active');
    elements.contactIpInput.focus();
}

// 关闭添加联系人对话框
function closeAddContactModal() {
    elements.addContactModal.classList.remove('active');
    elements.contactIpInput.value = '';
    elements.contactNameInput.value = '';
}

// 添加联系人
function addContact() {
    const ip = elements.contactIpInput.value.trim();
    const name = elements.contactNameInput.value.trim();
    
    if (!ip) {
        alert('请输入IP地址');
        return;
    }
    
    if (!name) {
        alert('请输入联系人昵称');
        return;
    }
    
    // 检查IP地址格式
    if (!validateIP(ip)) {
        alert('请输入有效的IPv4地址（例如 192.168.1.100）');
        return;
    }
    
    // 避免重复添加
    if (appState.contacts.some(c => c.ip === ip)) {
        alert('该IP的联系人已存在');
        return;
    }
    
    // 创建新的联系人
    const newContact = {
        id: `contact_${Date.now()}`,
        ip: ip,
        name: name,
        status: 'offline'
    };
    
    appState.contacts.push(newContact);
    saveContacts();
    renderContacts();
    
    // 关闭对话框
    closeAddContactModal();
}

// 简单IP地址验证
function validateIP(ip) {
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
}

// 在页面加载后初始化应用
document.addEventListener('DOMContentLoaded', initApp);