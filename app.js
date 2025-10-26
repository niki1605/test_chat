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
    loginForm.classList.remove('active');
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
                online: true
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

// Загрузка списка пользователей
function loadUsers() {
    db.collection('users')
        .where('email', '!=', currentUser.email)
        .onSnapshot((snapshot) => {
            usersList.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const user = doc.data();
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.dataset.userId = doc.id;
                
                userItem.innerHTML = `
                    <span class="status ${user.online ? 'online' : 'offline'}"></span>
                    ${user.name}
                    ${user.online ? '' : '<small style="float:right;color:#6c757d;">не в сети</small>'}
                `;
                
                userItem.addEventListener('click', () => {
                    selectUserForChat(doc.id, user);
                });
                
                usersList.appendChild(userItem);
            });
        });
}

// Выбор пользователя для чата
function selectUserForChat(userId, userData) {
    // Сброс предыдущего выбора
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Установка нового выбора
    document.querySelector(`.user-item[data-user-id="${userId}"]`).classList.add('active');
    
    selectedChatUser = { id: userId, ...userData };
    chatWithUser.textContent = `Чат с ${userData.name}`;
    
    // Активация поля ввода сообщения
    messageInput.disabled = false;
    sendMessageBtn.disabled = false;
    messageInput.focus();
    
    // Загрузка сообщений
    loadMessages(userId);
}

// Загрузка сообщений
function loadMessages(otherUserId) {
    // Остановка предыдущего слушателя
    if (messagesListener) {
        messagesListener();
    }
    
    messagesContainer.innerHTML = '<div class="no-messages">Загрузка сообщений...</div>';
    
    // Получение ID чата (сортированный объединенный ID пользователей)
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
            
            // Прокрутка к последнему сообщению
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
    
    messageElement.innerHTML = `
        ${message.senderId !== currentUser.uid ? `<div class="message-sender">${message.senderName}</div>` : ''}
        <div class="message-text">${message.text}</div>
        <div class="message-time">${time}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Отправка сообщения
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    if (!selectedChatUser || !messageInput.value.trim()) return;
    
    const messageText = messageInput.value.trim();
    const chatId = [currentUser.uid, selectedChatUser.id].sort().join('_');
    
    const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.name,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Сохранение сообщения
    db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .add(messageData)
        .then(() => {
            messageInput.value = '';
        })
        .catch((error) => {
            console.error('Ошибка отправки сообщения:', error);
        });
}

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

// Обновление времени последней активности при закрытии страницы
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
});