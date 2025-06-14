class LanChat {
  constructor() {
    this.userId = null;
    this.currentUsername = "未登录用户";
    this.contacts = [];
    this.ws = null;
    
    this.initUI();
    this.initSocket();
    this.setupEventListeners();
  }
  
  initUI() {
    // 登录UI
    this.loginScreen = document.getElementById('login-screen');
    this.chatScreen = document.getElementById('chat-screen');
    this.usernameInput = document.getElementById('username');
    this.startChatBtn = document.getElementById('start-chat');
    
    // 聊天UI
    this.currentUsernameSpan = document.getElementById('current-username');
    this.contactList = document.getElementById('contacts');
    this.messageContainer = document.getElementById('message-container');
    this.messageInput = document.getElementById('message-input');
    this.sendBtn = document.getElementById('send-btn');
    this.statusBar = document.getElementById('connection-status');
  }
  
  initSocket() {
    // 根据当前协议自动选择ws/wss
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket连接已打开');
      this.statusBar.textContent = '🟢 在线';
      this.statusBar.classList.add('online');
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'contact-list':
          this.updateContactList(message.contacts);
          break;
          
        case 'message':
          this.displayMessage(message);
          break;
          
        default:
          console.warn('未知消息类型:', message.type);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      this.statusBar.textContent = '🔴 离线';
      this.statusBar.classList.remove('online');
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      this.statusBar.textContent = '⚠️ 连接错误';
      this.statusBar.classList.remove('online');
    };
  }
  
  setupEventListeners() {
    // 登录按钮事件
    this.startChatBtn.addEventListener('click', () => this.handleStartChat());
    
    // 发送消息按钮
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    
    // 回车发送消息
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
    
    // 添加联系人按钮
    document.getElementById('add-contact').addEventListener('click', () => {
      const ip = prompt('输入对方的IP地址:');
      if (ip) {
        const contactName = prompt('输入联系人名称:');
        if (contactName) {
          this.addContact(ip, contactName);
        }
      }
    });
  }
  
  handleStartChat() {
    const username = this.usernameInput.value.trim();
    if (!username) {
      alert('请输入您的昵称');
      return;
    }
    
    this.currentUsername = username;
    this.currentUsernameSpan.textContent = username;
    
    // 注册用户到服务器
    this.userId = Date.now().toString();
    this.ws.send(JSON.stringify({
      type: 'register',
      id: this.userId,
      username: this.currentUsername
    }));
    
    // 切换到聊天界面
    this.loginScreen.classList.remove('active');
    this.chatScreen.classList.add('active');
    
    // 添加自己到联系人列表
    this.addContact('self', this.currentUsername);
  }
  
  addContact(ip, name) {
    if (!this.contacts.some(c => c.ip === ip)) {
      this.contacts.push({
        id: Date.now().toString(36),
        name: name,
        ip: ip,
        messages: []
      });
      
      this.renderContacts();
    }
  }
  
  updateContactList(serverContacts) {
    serverContacts.forEach(contact => {
      if (!this.contacts.some(c => c.id === contact.id)) {
        this.contacts.push({
          id: contact.id,
          name: contact.username,
          ip: contact.ip,
          messages: []
        });
      }
    });
    
    this.renderContacts();
  }
  
  renderContacts() {
    this.contactList.innerHTML = '';
    
    this.contacts.forEach(contact => {
      const contactItem = document.createElement('li');
      contactItem.classList.add('contact-item');
      
      // 使用名称首字母作为头像
      const firstLetter = contact.name.charAt(0).toUpperCase();
      
      contactItem.innerHTML = `
        <div class="contact-icon">${firstLetter}</div>
        <div class="contact-name">${contact.name}</div>
      `;
      
      contactItem.addEventListener('click', () => {
        this.openChatWith(contact);
      });
      
      this.contactList.appendChild(contactItem);
    });
  }
  
  openChatWith(contact) {
    document.getElementById('chat-title').textContent = contact.name;
    
    // 清空消息区域
    this.messageContainer.innerHTML = '';
    
    // 显示历史消息
    contact.messages.forEach(message => {
      this.addMessageToView(
        message.sender === this.currentUsername, 
        message.sender, 
        message.content
      );
    });
    
    // 设置当前联系人的标识
    this.currentContact = contact;
  }
  
  sendMessage() {
    const content = this.messageInput.value.trim();
    if (!content || !this.currentContact) return;
    
    // 记录消息历史
    this.currentContact.messages.push({
      sender: this.currentUsername,
      content,
      timestamp: Date.now()
    });
    
    // 添加到视图
    this.addMessageToView(true, this.currentUsername, content);
    
    // 通过WebSocket发送
    this.ws.send(JSON.stringify({
      type: 'message',
      to: this.currentContact.id,
      content: content
    }));
    
    this.messageInput.value = '';
  }
  
  displayMessage(message) {
    // 找到对应的联系人
    const contact = this.contacts.find(c => c.id === message.from);
    if (!contact) return;
    
    // 确保消息历史被记录
    if (!contact.messages) contact.messages = [];
    contact.messages.push({
      sender: message.fromName,
      content: message.content,
      timestamp: message.timestamp
    });
    
    // 如果当前打开的是该联系人的聊天，显示消息
    if (this.currentContact && this.currentContact.id === message.from) {
      this.addMessageToView(false, message.fromName, message.content);
    }
  }
  
  addMessageToView(isMe, sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isMe ? 'outgoing' : 'incoming');
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <span>${sender}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-content">${content}</div>
    `;
    
    this.messageContainer.appendChild(messageDiv);
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }
}

// 初始化应用程序
document.addEventListener('DOMContentLoaded', () => {
  window.lanchat = new LanChat();
});