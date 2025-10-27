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
let searchTimeout = null;
let searchResultsListener = null;
// Добавьте в переменные состояния
let emailVerificationCode = null;
let verificationTimer = null;
let resendTimeout = null;
let unreadCountListener = null;

// Переключение между вкладками
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
     // Сброс подтверждения email
    emailVerificationCode = null;
    toggleVerificationSection(false);
    if (verificationTimer) clearInterval(verificationTimer);
    if (resendTimeout) clearTimeout(resendTimeout);
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
});

// Обработка формы регистрации
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const verifyCode = document.getElementById('verify-code').value;
    const messageDiv = document.getElementById('register-message');
    
    // Если код подтверждения еще не отправлен
    if (!emailVerificationCode) {
        // Отправляем код подтверждения
        messageDiv.textContent = 'Отправка кода подтверждения на email...';
        messageDiv.className = 'message';
        messageDiv.style.display = 'block';
        
        const codeSent = await sendVerificationCode(email, name);
        
        if (codeSent) {
            toggleVerificationSection(true);
            messageDiv.textContent = 'Код подтверждения отправлен на ваш email!';
            messageDiv.className = 'message success';
            document.getElementById('verify-code').focus();
        } else {
            messageDiv.textContent = 'Ошибка отправки кода. Попробуйте еще раз.';
            messageDiv.className = 'message error';
        }
        return;
    }
    
    // Проверяем код подтверждения
    if (!verifyCode1(verifyCode)) {
        messageDiv.textContent = 'Неверный код подтверждения';
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
        return;
    }
    
    // Код верный - регистрируем пользователя
    try {
        // Регистрация в Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Отправляем email подтверждения Firebase
        await userCredential.user.sendEmailVerification();
        
        // Сохраняем пользователя в Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            emailVerified: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            online: true,
            emailNotifications: true
        });
        
        messageDiv.textContent = 'Регистрация успешна! Проверьте email для подтверждения.';
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';
        
        // Очистка формы и сброс состояния
        document.getElementById('registerForm').reset();
        emailVerificationCode = null;
        toggleVerificationSection(false);
        
        // Переход к входу через 3 секунды
        setTimeout(() => {
            loginTab.click();
        }, 3000);
        
    } catch (error) {
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
    }
});

// Обработчик повторной отправки кода
document.getElementById('resend-code').addEventListener('click', async () => {
    const email = document.getElementById('register-email').value;
    const name = document.getElementById('register-name').value;
    const messageDiv = document.getElementById('register-message');
    
    if (!email || !name) {
        messageDiv.textContent = 'Заполните email и имя';
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
        return;
    }
    
    messageDiv.textContent = 'Отправка кода...';
    messageDiv.className = 'message';
    
    const codeSent = await sendVerificationCode(email, name);
    
    if (codeSent) {
        messageDiv.textContent = 'Код отправлен повторно!';
        messageDiv.className = 'message success';
    } else {
        messageDiv.textContent = 'Ошибка отправки кода';
        messageDiv.className = 'message error';
    }
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
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Проблема с сетью. Проверьте подключение к интернету';
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

// Поиск пользователей
function searchUsers(searchTerm) {
    const searchResults = document.getElementById('search-results');
    
    // Очищаем предыдущий таймаут
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Останавливаем предыдущий поиск
    if (searchResultsListener) {
        searchResultsListener();
    }
    
    if (searchTerm.length < 2) {
        searchResults.innerHTML = '<div class="no-results">Введите минимум 2 символа</div>';
        return;
    }
    
    searchResults.innerHTML = '<div class="no-results">Поиск...</div>';
    
    // Устанавливаем таймаут 10 секунд
    searchTimeout = setTimeout(() => {
        if (searchResults.innerHTML.includes('Поиск...')) {
            searchResults.innerHTML = '<div class="no-results">Никого не найдено</div>';
        }
    }, 10000);
    
    // Получаем ВСЕХ пользователей и фильтруем на клиенте
    searchResultsListener = db.collection('users')
        .onSnapshot((snapshot) => {
            // Очищаем таймаут при получении результатов
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            searchResults.innerHTML = '';
            
            if (snapshot.empty) {
                searchResults.innerHTML = '<div class="no-results">В системе пока нет других пользователей</div>';
                return;
            }
            
            let foundUsers = [];
            const searchLower = searchTerm.toLowerCase();
            
            // Фильтруем пользователей на клиенте
            snapshot.forEach((doc) => {
                const user = doc.data();
                // Пропускаем текущего пользователя
                if (user.email === currentUser.email) return;
                
                // Ищем по имени (регистронезависимо)
                if (user.name && user.name.toLowerCase().includes(searchLower)) {
                    foundUsers.push({
                        id: doc.id,
                        ...user
                    });
                }
            });
            
            if (foundUsers.length === 0) {
                searchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
                return;
            }
            
            // Отображаем найденных пользователей
            foundUsers.forEach(user => {
                displaySearchResult(user.id, user);
            });
            
        }, (error) => {
            console.error('Ошибка поиска:', error);
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            searchResults.innerHTML = '<div class="no-results">Ошибка поиска</div>';
        });
}

// Отображение результата поиска
function displaySearchResult(userId, userData) {
    const searchResults = document.getElementById('search-results');
    
    const searchItem = document.createElement('div');
    searchItem.className = 'search-result-item';
    
    // Проверяем, есть ли уже чат с этим пользователем
    checkExistingChat(userId).then(hasChat => {
        searchItem.innerHTML = `
            <div class="search-result-content">
                <div class="search-result-name">${userData.name}</div>
                <div class="search-result-info">
                    <span class="status ${userData.online ? 'online' : 'offline'}"></span>
                    ${userData.online ? 'В сети' : 'Не в сети'}
                    ${hasChat ? '<span class="chat-badge">Уже в чате</span>' : ''}
                </div>
            </div>
        `;
        
        searchItem.addEventListener('click', async () => {
            if (!hasChat) {
                // Создаем новый чат
                await createNewChat(userId, userData);
            }
            
            // Выбираем пользователя для чата
            selectUserForChat(userId, userData);
            
            // Очищаем поиск
            clearSearch();
        });
        
        searchResults.appendChild(searchItem);
    });
}

// Проверка существующего чата
async function checkExistingChat(otherUserId) {
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    try {
        const chatDoc = await db.collection('chats').doc(chatId).get();
        return chatDoc.exists;
    } catch (error) {
        console.error('Ошибка проверки чата:', error);
        return false;
    }
}

// Создание нового чата
async function createNewChat(otherUserId, userData) {
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    try {
        await db.collection('chats').doc(chatId).set({
            participants: [currentUser.uid, otherUserId],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: null,
            lastMessageTime: null
        });
        
        // Добавляем пользователя в список активных чатов
        addUserToActiveChats(otherUserId, userData);
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
    }
}

// Добавление пользователя в активные чаты
function addUserToActiveChats(userId, userData) {
    const usersList = document.getElementById('users-list');
    
    // Проверяем, нет ли уже такого пользователя
    const existingItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (existingItem) {
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
                <div class="user-last-message">Новый чат</div>
            </div>
            <div class="unread-count" style="display: none;">0</div>
        </div>
    `;
    
    userItem.addEventListener('click', () => {
        selectUserForChat(userId, userData);
    });
    
    usersList.appendChild(userItem);
}

// Очистка поиска
function clearSearch() {
    document.getElementById('user-search').value = '';
    document.getElementById('search-results').innerHTML = '';
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    if (searchResultsListener) {
        searchResultsListener();
    }
}

// Загрузка пользователей с активными чатами (ИСПРАВЛЕННАЯ ВЕРСИЯ)
function loadActiveChats() {
    if (usersListener) {
        usersListener();
    }
    
    usersListener = db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .onSnapshot(async (snapshot) => {
            const usersList = document.getElementById('users-list');
            
            // Не очищаем список сразу, чтобы не было мигания
            if (snapshot.empty) {
                usersList.innerHTML = '<div class="no-results">Нет активных чатов</div>';
                return;
            }
            
            // Создаем временный контейнер для новых элементов
            const tempContainer = document.createElement('div');
            
            for (const doc of snapshot.docs) {
                const chatData = doc.data();
                const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
                
                if (otherUserId) {
                    try {
                        // Получаем данные пользователя
                        const userDoc = await db.collection('users').doc(otherUserId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            const unreadCount = await getUnreadCount(otherUserId);
                            
                            const userItem = document.createElement('div');
                            userItem.className = 'user-item';
                            userItem.dataset.userId = otherUserId;
                            
                            // Получаем последнее сообщение из подколлекции messages
                            const lastMessage = await getLastMessage(otherUserId);
                            
                            userItem.innerHTML = `
                                <div class="user-info-content">
                                    <span class="status ${userData.online ? 'online' : 'offline'}"></span>
                                    <div>
                                        <div>${userData.name}</div>
                                        <div class="user-last-message">
                                            ${lastMessage || 'Нет сообщений'}
                                        </div>
                                    </div>
                                    ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                                </div>
                            `;
                            
                            userItem.addEventListener('click', () => {
                                selectUserForChat(otherUserId, userData);
                            });
                            
                            tempContainer.appendChild(userItem);
                        }
                    } catch (error) {
                        console.error('Ошибка загрузки пользователя:', error);
                    }
                }
            }
            
            // Заменяем содержимое списка
            usersList.innerHTML = '';
            usersList.appendChild(tempContainer);
        }, (error) => {
            console.error('Ошибка загрузки чатов:', error);
        });
}

// Получение последнего сообщения из чата
async function getLastMessage(otherUserId) {
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    try {
        const messagesSnapshot = await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
            
        if (!messagesSnapshot.empty) {
            const lastMessage = messagesSnapshot.docs[0].data();
            return lastMessage.text;
        }
        
        return 'Нет сообщений';
    } catch (error) {
        console.error('Ошибка получения последнего сообщения:', error);
        return 'Нет сообщений';
    }
}

// Выбор пользователя для чата
async function selectUserForChat(userId, userData) {
    // Сброс предыдущего выбора
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Установка нового выбора
    const selectedItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
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

// Отправка сообщения
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

            // Обновляем последнее сообщение в чате
            db.collection('chats').doc(chatId).update({
                lastMessage: messageText,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
            });
            
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
    
    const emailParams = {
        to_email: recipient.email,
        to_name: recipient.name,
        from_name: currentUser.name,
        message: messageText,
        app_name: "SAS Messenger",
        reply_to: currentUser.email
    };
    
    // Используем EmailJS если доступен
    if (typeof emailjs !== 'undefined') {
        emailjs.send('service_lebtcym', 'template_7ppymg8', emailParams)
            .then(function(response) {
                console.log('Email уведомление отправлено!', response.status);
            }, function(error) {
                console.log('Ошибка отправки email:', error);
                //sendFallbackEmail(recipient, messageText);
            });
    } else {
        // Fallback метод
        console.log('Ошибка инициализации:', error);
        //sendFallbackEmail(recipient, messageText);
    }
}


// Fallback метод отправки email
function sendFallbackEmail(recipient, messageText) {
    const subject = `SAS Messenger: Новое сообщение от ${currentUser.name}`;
    const body = `Здравствуйте, ${recipient.name}!

Вам пришло новое сообщение в SAS Messenger от ${currentUser.name}:

"${messageText.substring(0, 200)}"

Чтобы ответить на сообщение, перейдите в приложение SAS Messenger.

С уважением,
SAS Messenger Team`;
    
    // Открываем почтовый клиент (пользователь должен сам отправить)
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
        
        // ОБНОВЛЯЕМ СЧЕТЧИК НЕПРОЧИТАННЫХ СРАЗУ ПОСЛЕ ПОМЕТКИ
        updateUnreadCount(otherUserId, 0);
        
    } catch (error) {
        console.error('Ошибка пометки сообщений как прочитанных:', error);
    }
}

// Слушатель для обновления счетчиков непрочитанных в реальном времени
function startUnreadCountListener() {
    // Слушаем все чаты текущего пользователя
    return db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .onSnapshot(async (snapshot) => {
            for (const doc of snapshot.docs) {
                const chatData = doc.data();
                const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
                
                if (otherUserId) {
                    const unreadCount = await getUnreadCount(otherUserId);
                    updateUnreadCount(otherUserId, unreadCount);
                }
            }
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
            
            // Добавляем анимацию для новых сообщений
            userItem.style.background = '#e3f2fd';
            setTimeout(() => {
                userItem.style.background = '';
            }, 2000);
        } else if (unreadCountEl) {
            // ПЛАВНО СКРЫВАЕМ СЧЕТЧИК
            unreadCountEl.style.opacity = '0';
            setTimeout(() => {
                unreadCountEl.style.display = 'none';
                unreadCountEl.style.opacity = '1';
            }, 300);
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

// Обработчики поиска
document.getElementById('search-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('user-search').value.trim();
    searchUsers(searchTerm);
});

document.getElementById('user-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    
    // Debounce - ждем 500ms после окончания ввода
    clearTimeout(searchTimeout);
    
    if (searchTerm.length >= 2) {
        searchTimeout = setTimeout(() => {
            searchUsers(searchTerm);
        }, 500);
    } else if (searchTerm.length === 0) {
        clearSearch();
    } else {
        document.getElementById('search-results').innerHTML = '<div class="no-results">Введите минимум 2 символа</div>';
    }
});

// Добавление кнопки очистки поиска
function addClearSearchButton() {
    const searchContainer = document.querySelector('.search-container');
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-search';
    clearBtn.textContent = '×';
    clearBtn.title = 'Очистить поиск';
    clearBtn.style.padding = '10px';
    clearBtn.style.background = '#6c757d';
    
    clearBtn.addEventListener('click', clearSearch);
    searchContainer.appendChild(clearBtn);
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
                    
                    // Загрузка активных чатов
                    loadActiveChats();
                    
                    // Добавление кнопки очистки поиска
                    addClearSearchButton();
                    
                    // Обновление статуса онлайн
                    db.collection('users').doc(user.uid).update({
                        online: true,
                        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    unreadCountListener = startUnreadCountListener();
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
        if (searchResultsListener) {
            searchResultsListener();
        }
        if (unreadCountListener) {
    unreadCountListener(); // Добавьте эту строку
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

// Функция для отладки - посмотреть всех пользователей
function debugAllUsers() {
    db.collection('users').get().then(snapshot => {
        console.log('Все пользователи в базе:');
        snapshot.forEach(doc => {
            console.log('ID:', doc.id, 'Data:', doc.data());
        });
    });
}

// Функция для отладки - посмотреть все чаты
function debugAllChats() {
    db.collection('chats').get().then(snapshot => {
        console.log('Все чаты в базе:');
        snapshot.forEach(doc => {
            console.log('Chat ID:', doc.id, 'Data:', doc.data());
        });
    });
}

// Генерация случайного кода
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Проверка введенного кода (ДОБАВЬТЕ ЭТУ ФУНКЦИЮ ЗДЕСЬ)
function verifyCode1(inputCode) {
    if (!emailVerificationCode || !inputCode) return false;
    return inputCode === emailVerificationCode;
}

// Отправка кода подтверждения на email
async function sendVerificationCode(email, userName) {
    const code = generateVerificationCode();
    emailVerificationCode = code;
    
    const emailParams = {
        to_email: email,
        to_name: userName,
        verification_code: code,
        app_name: "SAS Messenger"
    };
    
    try {
        if (typeof emailjs !== 'undefined') {
            await emailjs.send("service_lebtcym", 'template_bmwpa6f', emailParams);
            console.log('Код подтверждения отправлен');
        } else {
            // Fallback - показываем код в консоли для тестирования
            console.log('Код подтверждения (для тестирования):', code);
            alert(`Для тестирования: код подтверждения - ${code}`);
        }
        
        startVerificationTimer();
        return true;
    } catch (error) {
        console.error('Ошибка отправки кода:', error);
        return false;
    }
}

// Таймер для повторной отправки кода
function startVerificationTimer() {
    let timeLeft = 60;
    const timerElement = document.getElementById('verify-timer');
    const resendBtn = document.getElementById('resend-code');
    
    resendBtn.disabled = true;
    
    verificationTimer = setInterval(() => {
        timerElement.textContent = `Можно отправить снова через ${timeLeft} сек`;
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(verificationTimer);
            timerElement.textContent = '';
            resendBtn.disabled = false;
        }
    }, 1000);
}

// Показать/скрыть секцию подтверждения
function toggleVerificationSection(show) {
    const verifySection = document.getElementById('email-verify-section');
    const registerBtn = document.getElementById('register-btn');
    
    if (show) {
        verifySection.style.display = 'block';
        registerBtn.textContent = 'Подтвердить email';
    } else {
        verifySection.style.display = 'none';
        registerBtn.textContent = 'Зарегистрироваться';
    }
}
