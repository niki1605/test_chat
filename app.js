// Элементы DOM
const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const usersList = document.getElementById('users-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatWithUser = document.getElementById('chat-with-user');

// Переменные состояния
let currentUser = null;
let selectedChatUser = null;
let messagesListener = null;
let usersListener = null;
let lastMessageQuery = null;

// Переключение между вкладками
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    registerForm.classList.remove('active');
});

// Обработка формы регистрации
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const messageDiv = document.getElementById('register-message');
    
    // Регистрация пользователя
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Сохранение имени пользователя в Firestore
            return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true,
                emailNotifications: true // Включение уведомлений по умолчанию
            });
        })
        .then(() => {
            messageDiv.textContent = 'Зарегистрировано!';
            messageDiv.className = 'message success';
            messageDiv.style.display = 'block';
            
            // Очистка формы
            document.getElementById('registerForm').reset();
            
            // Переключение на вкладку входа
            setTimeout(() => {
                loginTab.click();
            }, 1500);
        })
        .catch((error) => {
            let errorMessage = 'Ошибка регистрации';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Этот email уже используется';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Пароль должен содержать не менее 6 символов';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Некорректный email';
            }
            
            messageDiv.textContent = errorMessage;
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
        });
});

// Обработка формы входа
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const messageDiv = document.getElementById('login-message');
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Обновление статуса онлайн
            return db.collection('users').doc(userCredential.user.uid).update({
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Успешный вход обрабатывается в onAuthStateChanged
        })
        .catch((error) => {
            let errorMessage = 'Ошибка входа';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Пользователь не найден';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Неверный пароль';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Некорректный email';
            }
            
            messageDiv.textContent = errorMessage;
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
        });
});

// Выход из системы
logoutBtn.addEventListener('click', () => {
    if (currentUser) {
        // Обновление статуса оффлайн
        db.collection('users').doc(currentUser.uid).update({
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    
    auth.signOut();
});

// Загрузка списка пользователей с подсчетом непрочитанных
function loadUsers() {
    if (usersListener) {
        usersListener();
    }
    
    usersListener = db.collection('users')
        .where('email', '!=', currentUser.email)
        .onSnapshot((snapshot) => {
            usersList.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const user = doc.data();
                const userId = doc.id;
                
                // Загружаем количество непрочитанных сообщений
                getUnreadCount(userId).then(unreadCount => {
                    displayUserItem(userId, user, unreadCount);
                });
            });
        });
}

// Получение количества непрочитанных сообщений
async function getUnreadCount(otherUserId) {
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    try {
        const snapshot = await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .where('read', '==', false)
            .where('senderId', '==', otherUserId)
            .get();
            
        return snapshot.size;
    } catch (error) {
        console.error('Ошибка получения непрочитанных сообщений:', error);
        return 0;
    }
}

// Отображение пользователя в списке
function displayUserItem(userId, userData, unreadCount) {
    const existingItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    
    if (existingItem) {
        // Обновляем существующий элемент
        const unreadCountEl = existingItem.querySelector('.unread-count');
        if (unreadCountEl) {
            unreadCountEl.textContent = unreadCount;
            unreadCountEl.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
        return;
    }
    
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = userId;
    
    userItem.innerHTML = `
        <div class="user-info-content">
            <span class="status ${userData.online ? 'online' : 'offline'}"></span>
            <div>
                <div>${userData.name}</div>
                <div class="user-last-message">${userData.online ? 'В сети' : 'Не в сети'}</div>
            </div>
            ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
        </div>
    `;
    
    userItem.addEventListener('click', () => {
        selectUserForChat(userId, userData);
    });
    
    usersList.appendChild(userItem);
}

// Выбор пользователя для чата
async function selectUserForChat(userId, userData) {
    // Сброс предыдущего выбора
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Установка нового выбора
    document.querySelector(`.user-item[data-user-id="${userId}"]`).classList.add('active');
    
    selectedChatUser = { id: userId, ...userData };
    
    // Обновление заголовка чата
    chatWithUser.innerHTML = `
        <div class="chat-header-info">
            <div>Чат с ${userData.name}</div>
            <div class="chat-header-status ${userData.online ? 'online' : ''}">
                ${userData.online ? 'В сети' : 'Не в сети'}
            </div>
        </div>
    `;
    
    // Активация поля ввода сообщения
    messageInput.disabled = false;
    sendMessageBtn.disabled = false;
    messageInput.focus();
    
    // Загрузка сообщений
    await loadMessages(userId);
    
    // Помечаем сообщения как прочитанные
    await markMessagesAsRead(userId);
    
    // Обновляем счетчик непрочитанных
    updateUnreadCount(userId, 0);
}

// Загрузка сообщений
function loadMessages(otherUserId) {
    // Остановка предыдущего слушателя
    if (messagesListener) {
        messagesListener();
    }
    
    messagesContainer.innerHTML = '<div class="no-messages">Загрузка сообщений...</div>';
    
    // Получение ID чата
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    messagesListener = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            messagesContainer.innerHTML = '';
            
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<div class="no-messages">Нет сообщений. Начните общение!</div>';
                return;
            }
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                displayMessage(message);
            });
            
            // Автоматическая прокрутка к последнему сообщению
            scrollToBottom();
            
            // Сохраняем последний запрос для пометки как прочитанное
            lastMessageQuery = snapshot;
        });
}

// Отображение сообщения
function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message-item ${message.senderId === currentUser.uid ? 'own' : 'other'}`;
    
    const time = message.timestamp ? message.timestamp.toDate().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'только что';
    
    // Определяем статус сообщения с белыми иконками
    let statusIcon = '⏰'; // отправлено
    let statusText = 'Отправлено';
    
    if (message.delivered) {
        statusIcon = '✓✓';
        statusText = 'Доставлено';
    }
    
    if (message.read) {
        statusIcon = '👁️✓✓';
        statusText = 'Прочитано';
    }
    
    messageElement.innerHTML = `
        ${message.senderId !== currentUser.uid ? `<div class="message-sender">${message.senderName}</div>` : ''}
        <div class="message-text">${message.text}</div>
        <div class="message-meta">
            <div class="message-time">${time}</div>
            ${message.senderId === currentUser.uid ? `
                <div class="message-status">
                    <span class="status-icon ${message.read ? 'read' : message.delivered ? 'delivered' : 'sent'}" 
                          title="${statusText}">${statusIcon}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Отправка сообщения с уведомлением на email
function sendMessage() {
    if (!selectedChatUser || !messageInput.value.trim()) return;
    
    const messageText = messageInput.value.trim();
    const chatId = [currentUser.uid, selectedChatUser.id].sort().join('_');
    
    const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.name,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        delivered: false,
        read: false
    };
    
    // Сохранение сообщения
    db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .add(messageData)
        .then((docRef) => {
            messageInput.value = '';
            
            // Отправка email уведомления
            sendEmailNotification(selectedChatUser, messageText);
            
            // Помечаем сообщение как доставленное
            setTimeout(() => {
                db.collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .doc(docRef.id)
                    .update({
                        delivered: true
                    });
            }, 1000);
            
            // Фокус остается на поле ввода
            messageInput.focus();
        })
        .catch((error) => {
            console.error('Ошибка отправки сообщения:', error);
        });
}

// Отправка уведомления на email
function sendEmailNotification(recipient, messageText) {
    // Здесь используется EmailJS - бесплатный сервис для отправки email
    // Зарегистрируйтесь на https://www.emailjs.com/ и получите свои ключи
    
    const emailParams = {
        to_email: recipient.email,
        to_name: recipient.name,
        from_name: currentUser.name,
        message: messageText,
        app_name: "SAS Messenger",
        reply_to: currentUser.email
    };
    
    // Используем EmailJS для отправки email
    if (typeof emailjs !== 'undefined') {
        emailjs.send('service_lebtcym', 'template_7ppymg8', emailParams)
            .then(function(response) {
                console.log('Email уведомление отправлено!', response.status, response.text);
            }, function(error) {
                console.log('Ошибка отправки email:', error);
                // Fallback: используем простой mailto ссылку
                //sendFallbackEmail(recipient, messageText);
            });
    } else {
        // Fallback метод
        sendFallbackEmail(recipient, messageText);
    }
}

// Fallback метод отправки email (открывает почтовый клиент)
function sendFallbackEmail(recipient, messageText) {
    const subject = `SAS Messenger: Новое сообщение от ${currentUser.name}`;
    const body = `Здравствуйте, ${recipient.name}!

Вам пришло новое сообщение в SAS Messenger от ${currentUser.name}:

"${messageText}"

Чтобы ответить на сообщение, перейдите в приложение SAS Messenger.

С уважением,
SAS Messenger Team`;
    
    const mailtoLink = `mailto:${recipient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
}

// Пометить сообщения как прочитанные
async function markMessagesAsRead(otherUserId) {
    if (!selectedChatUser) return;
    
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    try {
        const snapshot = await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .where('read', '==', false)
            .where('senderId', '==', otherUserId)
            .get();
        
        const batch = db.batch();
        
        snapshot.forEach((doc) => {
            const messageRef = db.collection('chats')
                .doc(chatId)
                .collection('messages')
                .doc(doc.id);
            batch.update(messageRef, { read: true });
        });
        
        await batch.commit();
        
        // Обновляем статусы в реальном времени
        if (lastMessageQuery) {
            lastMessageQuery.forEach((doc) => {
                if (doc.data().senderId === otherUserId && !doc.data().read) {
                    db.collection('chats')
                        .doc(chatId)
                        .collection('messages')
                        .doc(doc.id)
                        .update({ read: true });
                }
            });
        }
    } catch (error) {
        console.error('Ошибка пометки сообщений как прочитанных:', error);
    }
}

// Обновление счетчика непрочитанных
function updateUnreadCount(userId, count) {
    const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (userItem) {
        let unreadCountEl = userItem.querySelector('.unread-count');
        
        if (count > 0) {
            if (!unreadCountEl) {
                unreadCountEl = document.createElement('div');
                unreadCountEl.className = 'unread-count';
                userItem.querySelector('.user-info-content').appendChild(unreadCountEl);
            }
            unreadCountEl.textContent = count;
            unreadCountEl.style.display = 'flex';
        } else if (unreadCountEl) {
            unreadCountEl.style.display = 'none';
        }
    }
}

// Автоматическая прокрутка к последнему сообщению
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Обработчики событий
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Отслеживание состояния аутентификации
auth.onAuthStateChanged((user) => {
    if (user) {
        // Пользователь вошел в систему
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        ...userData
                    };
                    
                    userNameSpan.textContent = userData.name;
                    
                    // Переключение на основной интерфейс
                    authSection.style.display = 'none';
                    mainApp.style.display = 'grid';
                    
                    // Загрузка пользователей
                    loadUsers();
                    
                    // Обновление статуса онлайн
                    db.collection('users').doc(user.uid).update({
                        online: true,
                        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Слушатель для обновления счетчиков непрочитанных
                    setInterval(() => {
                        if (usersList.children.length > 0) {
                            document.querySelectorAll('.user-item').forEach(async (item) => {
                                const userId = item.dataset.userId;
                                if (userId && userId !== currentUser.uid) {
                                    const unreadCount = await getUnreadCount(userId);
                                    updateUnreadCount(userId, unreadCount);
                                }
                            });
                        }
                    }, 5000);
                }
            });
    } else {
        // Пользователь вышел из системы
        currentUser = null;
        selectedChatUser = null;
        
        // Остановка слушателей
        if (messagesListener) {
            messagesListener();
        }
        if (usersListener) {
            usersListener();
        }
        
        // Переключение на формы авторизации
        mainApp.style.display = 'none';
        authSection.style.display = 'block';
        
        // Очистка форм
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('register-message').style.display = 'none';
    }
});

// Обновление времени последней активности
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
});