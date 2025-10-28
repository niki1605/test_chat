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
let forgotPasswordModal = null;
let changeNameModal = null;
let longPressTimer;
let longPressTarget = null;


let emailTimerPaused = false;
let emailTimerPauseTime = null;
let emailTimerRemaining = null;

// Добавьте в переменные состояния
let isEditingMessage = false;

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
    const searchInput = document.getElementById('user-search');
    const searchResults = document.getElementById('search-results');
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (searchResults) {
        searchResults.innerHTML = '';
    }
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
    
    if (searchResultsListener) {
        searchResultsListener();
        searchResultsListener = null;
    }
    
    console.log('✅ Поиск очищен');
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
            return lastMessage.text.length > 50 ? 
                   lastMessage.text.substring(0, 50) + '...' : 
                   lastMessage.text;
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
    
    const chatId = [currentUser.uid, otherUserId].sort().join('_');
    
    messagesListener = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            messagesContainer.innerHTML = '';
            
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<div class="no-messages">Нет сообщений</div>';
                return;
            }
            
            // 🔥 Просто отображаем все сообщения - удаленных уже нет в базе!
            snapshot.forEach((doc) => {
                const message = doc.data();
                const messageId = doc.id;
                displayMessage(message, messageId);
            });
            
            scrollToBottom();
        }, (error) => {
            console.error('Ошибка загрузки сообщений:', error);
            messagesContainer.innerHTML = '<div class="no-messages">Ошибка загрузки сообщений</div>';
        });
}

// Отображение сообщения
function displayMessage(message, messageId) {
     // 🔥 БЕЗОПАСНАЯ ПРОВЕРКА
    if (typeof messageId === 'undefined') {
        console.warn('⚠️ messageId не передан в displayMessage');
        messageId = 'temp-' + Date.now();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message-item ${message.senderId === currentUser.uid ? 'own' : 'other'}`;
    messageElement.dataset.messageId = messageId;
    
    const time = message.timestamp ? message.timestamp.toDate().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'только что';
    
    // Определяем статус сообщения
    let statusIcon = '⏰';
    let statusText = 'Отправлено';
    
    if (message.delivered) {
        statusIcon = '✓✓';
        statusText = 'Доставлено';
    }
    
    if (message.read) {
        statusIcon = '👁️✓✓';
        statusText = 'Прочитано';
    }
    
    // Добавляем пометку "изменено" если сообщение редактировалось
    const editedBadge = message.edited ? '<span class="edited-badge" style="font-size: 10px; opacity: 0.7; font-style: italic;"> (изменено)</span>' : '';
    
    messageElement.innerHTML = `
        ${message.senderId !== currentUser.uid ? `<div class="message-sender">${message.senderName}</div>` : ''}
        <div class="message-text">${message.text}</div>
        <div class="message-edit-container"></div>
        <div class="message-meta">
            <div class="message-time">${time}${editedBadge}</div>
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
        read: false,
        emailScheduled: true,
        emailSent: false,
        deleted: false,
        edited: false
    };
    
    db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .add(messageData)
        .then((docRef) => {
            messageInput.value = '';
            
            // 🔥 ЗАПУСКАЕМ уведомление с таймером
            showEmailNotification(docRef.id, chatId);
            
            // Обновляем последнее сообщение в чате
            db.collection('chats').doc(chatId).update({
                lastMessage: messageText,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Помечаем как доставленное
            setTimeout(() => {
                db.collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .doc(docRef.id)
                    .update({
                        delivered: true
                    });
            }, 1000);
            
            messageInput.focus();
        })
        .catch((error) => {
            console.error('Ошибка отправки сообщения:', error);
        });
}

function deleteMessage(messageId, chatId) {
    if (!messageId || !chatId) {
        console.error('❌ deleteMessage: messageId или chatId не определены');
        return;
    }

    if (!confirm("Удалить это сообщение навсегда?")) {
        return;
    }

    // 🔥 ПРОВЕРЯЕМ ЧТО ФУНКЦИИ СУЩЕСТВУЮТ
    if (typeof showTempMessage === 'undefined') {
        console.error('❌ showTempMessage не определена');
        alert('Сообщение удалено');
    }

    try {
        // Мгновенно скрываем сообщение из интерфейса
        const messageElement = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.style.opacity = '0.5';
            messageElement.style.textDecoration = 'line-through';
            messageElement.style.background = '#f8f9fa !important';
            
            // Через анимацию полностью скрываем
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }

        // Удаляем из базы данных
        db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .doc(messageId)
            .delete()
            .then(() => {
                console.log("✅ Сообщение удалено из базы данных");
                
                if (typeof showTempMessage !== 'undefined') {
                    showTempMessage("Сообщение удалено навсегда");
                }
                
                // Обновляем последнее сообщение в чате
                updateLastMessageInChat(chatId);
                
                // Отменяем email уведомление если есть
                if (currentEmailMessageId === messageId && currentEmailChatId === chatId) {
                    hideEmailNotification();
                    if (typeof showTempMessage !== 'undefined') {
                        showTempMessage("Сообщение удалено - email отменен", "success");
                    }
                }
            })
            .catch((error) => {
                console.error('❌ Ошибка удаления сообщения:', error);
                if (typeof showTempMessage !== 'undefined') {
                    showTempMessage("Ошибка при удалении", "error");
                }
                
                // Восстанавливаем сообщение в интерфейсе при ошибке
                if (messageElement) {
                    messageElement.style.opacity = '';
                    messageElement.style.textDecoration = '';
                    messageElement.style.background = '';
                }
            });

    } catch (error) {
        console.error('❌ Ошибка в deleteMessage:', error);
        if (typeof showTempMessage !== 'undefined') {
            showTempMessage("Ошибка при удалении", "error");
        }
    }
}



function initLongPressSimple() {
      const contextMenu = document.getElementById('message-context-menu');
    
    // Создаем меню если не существует
    if (!contextMenu) {
        showContextMenu();
        return;
    }

    let pressTimer = null;
    let currentMessageElement = null;

    // Функция показа контекстного меню
    function showContextMenu(messageElement, x, y) {
        // Проверяем что выбран чат
        if (!selectedChatUser || !selectedChatUser.id) {
            showTempMessage("Сначала выберите собеседника", "info");
            return;
        }

        const messageId = messageElement.dataset.messageId;
        const messageText = messageElement.querySelector('.message-text')?.textContent || '';
        
        // Сохраняем данные в меню
        contextMenu.dataset.messageId = messageId;
        contextMenu.dataset.messageText = messageText;
        
        // Позиционируем меню
        positionContextMenu(x, y);
        
        // Показываем меню
        contextMenu.style.display = 'block';
        currentMessageElement = messageElement;
        
        // Подсвечиваем сообщение
        messageElement.style.backgroundColor = 'rgba(255, 235, 59, 0.3)';
    }

    // Функция позиционирования меню
    function positionContextMenu(x, y) {
        const menuWidth = 200;
        const menuHeight = 120;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Корректируем позицию чтобы меню не выходило за границы экрана
        let posX = x;
        let posY = y;

        if (x + menuWidth > viewportWidth) {
            posX = viewportWidth - menuWidth - 10;
        }
        if (y + menuHeight > viewportHeight) {
            posY = viewportHeight - menuHeight - 10;
        }

        contextMenu.style.left = posX + 'px';
        contextMenu.style.top = posY + 'px';
    }

    // Функция скрытия меню
    function hideContextMenu() {
        if (contextMenu.style.display === 'block') {
            contextMenu.style.display = 'none';
            
            // Убираем подсветку с сообщения
            if (currentMessageElement) {
                currentMessageElement.style.backgroundColor = '';
                currentMessageElement = null;
            }
        }
        
        // Очищаем таймер
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }

    // Обработчик начала удержания
    function handlePressStart(e, target) {
        // Ищем элемент сообщения
        const messageElement = target.closest('.message-item.own');
        if (!messageElement) return;

        // Проверяем что сообщение не удалено
        if (messageElement.classList.contains('deleted')) return;

        // Получаем координаты
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Запускаем таймер для показа меню
        pressTimer = setTimeout(() => {
            showContextMenu(messageElement, clientX, clientY);
        }, 500); // 500ms для удержания
    }

    // Обработчик окончания удержания
    function handlePressEnd() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }

    // Обработчики для touch устройств
    document.addEventListener('touchstart', function(e) {
        handlePressStart(e, e.target);
    }, { passive: true });

    document.addEventListener('touchend', handlePressEnd, { passive: true });
    document.addEventListener('touchmove', handlePressEnd, { passive: true });
    document.addEventListener('touchcancel', handlePressEnd, { passive: true });

    // Обработчики для мыши
    document.addEventListener('mousedown', function(e) {
        if (e.button === 0) { // Левая кнопка мыши
            handlePressStart(e, e.target);
        }
    });

    document.addEventListener('mouseup', handlePressEnd);
    document.addEventListener('mousemove', handlePressEnd);

    // Закрытие меню при клике вне его
    document.addEventListener('click', function(e) {
        if (contextMenu.style.display === 'block' && 
            !contextMenu.contains(e.target) &&
            !e.target.closest('.message-item.own')) {
            hideContextMenu();
        }
    });

    // Закрытие меню при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && contextMenu.style.display === 'block') {
            hideContextMenu();
        }
    });

    // Обработчик действий в контекстном меню
    contextMenu.addEventListener('click', function(e) {
        const menuItem = e.target.closest('.context-menu-item');
        if (!menuItem) return;

        const action = menuItem.dataset.action;
        const messageId = contextMenu.dataset.messageId;
        const messageText = contextMenu.dataset.messageText;

        // Создаем chatId для действий
        const chatId = [currentUser.uid, selectedChatUser.id].sort().join('_');

        switch (action) {
            case 'edit':
                editMessage(messageId, chatId, messageText);
                break;
            case 'copy':
                copyMessageText(messageText);
                break;
            case 'delete':
                deleteMessage(messageId, chatId);
                break;
        }

        hideContextMenu();
    });

    console.log("✅ Контекстное меню инициализировано");
}

// Функция для показа временных сообщений
function showTempMessage(text, type = "success") {
    // Создаем элемент сообщения
    const tempMsg = document.createElement('div');
    tempMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "success" ? "#28a745" : type === "error" ? "#dc3545" : "#17a2b8"};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
        word-wrap: break-word;
    `;
    tempMsg.textContent = text;
    document.body.appendChild(tempMsg);
    
    // Автоматическое удаление через 3 секунды
    setTimeout(() => {
        if (document.body.contains(tempMsg)) {
            document.body.removeChild(tempMsg);
        }
    }, 3000);
}

// Показать контекстное меню
function showContextMenu(messageItem, x, y) {
     const contextMenu = document.getElementById('message-context-menu');
    const messageId = messageItem.dataset.messageId;
    const chatId = [currentUser.uid, selectedChatUser.id].sort().join('_');
    const messageText = messageItem.querySelector('.message-text').textContent;
    
    // Сохраняем данные в меню
    contextMenu.dataset.messageId = messageId;
    contextMenu.dataset.chatId = chatId;
    contextMenu.dataset.messageText = messageText;
    
    // Позиционируем меню
    const menuWidth = 200;
    const menuHeight = 120; // Увеличили высоту для третьей кнопки
    
    // Проверяем чтобы меню не выходило за границы экрана
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let posX = x;
    let posY = y;
    
    if (x + menuWidth > viewportWidth) {
        posX = viewportWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > viewportHeight) {
        posY = viewportHeight - menuHeight - 10;
    }
    
    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
    contextMenu.style.display = 'block';
    
    // Добавляем анимацию появления
    contextMenu.style.opacity = '0';
    contextMenu.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        contextMenu.style.transition = 'all 0.2s ease';
        contextMenu.style.opacity = '1';
        contextMenu.style.transform = 'scale(1)';
    }, 10);
    
    // Подсвечиваем ТОЛЬКО выбранное сообщение
    messageItem.style.background = 'rgba(255, 235, 59, 0.2)';
    messageItem.style.border = '2px solid #ffd54f';
    
    // Убедимся что другие сообщения не подсвечены
    document.querySelectorAll('.message-item.own').forEach(item => {
        if (item !== messageItem) {
            item.style.background = '';
            item.style.border = '';
        }
    });
}

// Скрыть контекстное меню
function hideContextMenu() {
      const contextMenu = document.getElementById('message-context-menu');
    contextMenu.style.display = 'none';
    
    // 🔥 ВОССТАНАВЛИВАЕМ исходный цвет сообщения
    document.querySelectorAll('.message-item.own').forEach(item => {
        item.style.background = ''; // Возвращаем исходный фон
        item.style.border = '';     // Убираем границу
        item.style.transform = '';  // Возвращаем исходный размер
    });
}

// Обработчик кликов в контекстном меню
function initContextMenuHandlers() {
    const contextMenu = document.getElementById('message-context-menu');
    
    contextMenu.addEventListener('click', (e) => {
        if (e.target.classList.contains('context-menu-item')) {
            const action = e.target.dataset.action;
            const messageId = contextMenu.dataset.messageId;
            const chatId = contextMenu.dataset.chatId;
            const messageText = contextMenu.dataset.messageText;
            
            if (action === 'edit') {
                editMessage(messageId, chatId, messageText);
            } else if (action === 'copy') {
                copyMessageText(messageText);
            } else if (action === 'delete') {
                //deleteMessage(messageId, chatId);
            }
            
            hideContextMenu();
        }
    });
}

// Функция редактирования сообщения
function editMessage(messageId, chatId, currentText) {
       const messageElement = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    // 🔥 УСТАНАВЛИВАЕМ ФЛАГ РЕДАКТИРОВАНИЯ
    isEditingMessage = true;
    console.log("изменение "+isEditingMessage);
    
    // 🔥 ПРИОСТАНАВЛИВАЕМ таймер email если редактируемое сообщение - это то, для которого запланирован email
    if (currentEmailMessageId === messageId && currentEmailChatId === chatId) {
        pauseEmailTimer();
    }
    
    // Скрываем оригинальный текст
    const messageTextElement = messageElement.querySelector('.message-text');
    messageTextElement.style.display = 'none';
    
    // Создаем контейнер для редактирования
    let editContainer = messageElement.querySelector('.message-edit-container');
    
    if (!editContainer) {
        editContainer = document.createElement('div');
        editContainer.className = 'message-edit-container';
        messageElement.appendChild(editContainer);
    }
    
    editContainer.innerHTML = `
        <input type="text" class="edit-input" value="${currentText}" maxlength="1000">
        <div class="edit-actions">
            <button class="edit-btn edit-cancel">Отмена</button>
            <button class="edit-btn edit-save">Сохранить</button>
        </div>
    `;
    
    editContainer.classList.add('active');
    messageElement.classList.add('editing');
    
    // Фокус на поле ввода
    const editInput = editContainer.querySelector('.edit-input');
    editInput.focus();
    editInput.select();
    
    // Обработчики кнопок
    const cancelBtn = editContainer.querySelector('.edit-cancel');
    const saveBtn = editContainer.querySelector('.edit-save');
    
    cancelBtn.addEventListener('click', () => {
        cancelEdit(messageElement, messageTextElement, messageId, chatId);
    });
    
    saveBtn.addEventListener('click', () => {
        saveMessageEdit(messageId, chatId, editInput.value, messageElement, messageTextElement);
    });
    
    // Сохранение по Enter, отмена по Escape
    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveMessageEdit(messageId, chatId, editInput.value, messageElement, messageTextElement);
        } else if (e.key === 'Escape') {
            cancelEdit(messageElement, messageTextElement, messageId, chatId);
        }
    });
    
    // Закрытие по клику вне области редактирования
    const closeEditHandler = (e) => {
        if (!editContainer.contains(e.target)) {
            cancelEdit(messageElement, messageTextElement, messageId, chatId);
            document.removeEventListener('click', closeEditHandler);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeEditHandler);
    }, 100);
}

// Отмена редактирования
function cancelEdit(messageElement, messageTextElement, messageId, chatId) {
    const editContainer = messageElement.querySelector('.message-edit-container');
    if (editContainer) {
        editContainer.classList.remove('active');
        editContainer.innerHTML = '';
    }
    messageTextElement.style.display = 'block';
    messageElement.classList.remove('editing');
    
    // 🔥 СБРАСЫВАЕМ ФЛАГ РЕДАКТИРОВАНИЯ
    isEditingMessage = false;
    
    // 🔥 УБИРАЕМ ОВЕРЛЕЙ (если используете его)
    const overlay = document.getElementById('edit-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    // 🔥 ВОЗОБНОВЛЯЕМ таймер email если отменили редактирование
    if (currentEmailMessageId === messageId && currentEmailChatId === chatId) {
        resumeEmailTimer();
    }
}

// Сохранение измененного сообщения
async function saveMessageEdit(messageId, chatId, newText, messageElement, messageTextElement) {
    if (!newText.trim()) {
        showTempMessage("Сообщение не может быть пустым", "error");
        if (currentEmailMessageId === messageId && currentEmailChatId === chatId) {
            resumeEmailTimer();
        }
        // 🔥 СБРАСЫВАЕМ ФЛАГ РЕДАКТИРОВАНИЯ ПРИ ОШИБКЕ
        isEditingMessage = false;
        return;
    }
    
    try {
        // Обновляем сообщение в базе данных
        await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .doc(messageId)
            .update({
                text: newText,
                edited: true,
                editedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Обновляем текст в интерфейсе
        messageTextElement.textContent = newText;
        
        // Добавляем пометку "изменено"
        addEditedBadge(messageElement);
        
        // Скрываем редактор
        const editContainer = messageElement.querySelector('.message-edit-container');
        if (editContainer) {
            editContainer.classList.remove('active');
            editContainer.innerHTML = '';
        }
        messageTextElement.style.display = 'block';
        messageElement.classList.remove('editing');
        
        // 🔥 ВОЗОБНОВЛЯЕМ таймер email после успешного сохранения
        if (currentEmailMessageId === messageId && currentEmailChatId === chatId) {
            resumeEmailTimer();
        }
        
        // Обновляем последнее сообщение в чате если это было последнее сообщение
        await updateLastMessageIfNeeded(chatId, newText);
        
        showTempMessage("Сообщение изменено", "success");
        
     // 🔥 СБРАСЫВАЕМ ФЛАГ РЕДАКТИРОВАНИЯ ПОСЛЕ УСПЕШНОГО СОХРАНЕНИЯ
        isEditingMessage = true;
        
    } catch (error) {
        console.error('❌ Ошибка редактирования сообщения:', error);
        showTempMessage("Ошибка при изменении сообщения", "error");
        
        // 🔥 СБРАСЫВАЕМ ФЛАГ РЕДАКТИРОВАНИЯ ПРИ ОШИБКЕ
        isEditingMessage = false;
        
        if (currentEmailMessageId === messageId && currentEmailChatId === chatId) {
            resumeEmailTimer();
        }
    }
}

// Добавление пометки "изменено"
function addEditedBadge(messageElement) {
    let editedBadge = messageElement.querySelector('.edited-badge');
    if (!editedBadge) {
        editedBadge = document.createElement('span');
        editedBadge.className = 'edited-badge';
        editedBadge.textContent = ' (изменено)';
        editedBadge.style.fontSize = '10px';
        editedBadge.style.opacity = '0.7';
        editedBadge.style.fontStyle = 'italic';
        
        const messageMeta = messageElement.querySelector('.message-meta');
        if (messageMeta) {
            messageMeta.appendChild(editedBadge);
        }
    }
}

// Обновление последнего сообщения в чате если нужно
async function updateLastMessageIfNeeded(chatId, newText) {
    try {
        const chatDoc = await db.collection('chats').doc(chatId).get();
        const chatData = chatDoc.data();
        
        if (chatData.lastMessage) {
            // Получаем последнее сообщение чтобы проверить
            const lastMessageSnapshot = await db.collection('chats')
                .doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();
            
            if (!lastMessageSnapshot.empty) {
                const lastMessage = lastMessageSnapshot.docs[0].data();
                if (lastMessage.text === newText) {
                    // Если измененное сообщение было последним - обновляем чат
                    await db.collection('chats').doc(chatId).update({
                        lastMessage: newText
                    });
                }
            }
        }
    } catch (error) {
        console.error('Ошибка обновления последнего сообщения:', error);
    }
}

// Функция копирования текста
function copyMessageText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showTempMessage("Текст скопирован 📋");
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showTempMessage("Текст скопирован 📋");
    });
}

// Очистка таймера удержания
function clearLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    longPressTarget = null;
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
    
    if (!searchContainer) {
        console.error('❌ searchContainer не найден');
        return;
    }

    // 🔥 ПРОВЕРЯЕМ, ЕСТЬ ЛИ УЖЕ КНОПКА
    const existingClearBtn = document.getElementById('clear-search');
    if (existingClearBtn) {
        console.log('✅ Кнопка очистки уже существует');
        return;
    }

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-search';
    clearBtn.textContent = '×';
    clearBtn.title = 'Очистить поиск';
    clearBtn.style.cssText = `
        padding: 10px 12px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        min-height: auto;
        font-size: 16px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Добавляем hover эффекты
    clearBtn.addEventListener('mouseenter', () => {
        clearBtn.style.background = '#5a6268';
    });
    
    clearBtn.addEventListener('mouseleave', () => {
        clearBtn.style.background = '#6c757d';
    });

    clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearSearch();
    });

    searchContainer.appendChild(clearBtn);
    console.log('✅ Кнопка очистки поиска добавлена');
}


function initContextMenu() {
    initContextMenuHandlers();
    initLongPressSimple(); // Ваша существующая функция
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

                    // 🔥 СБРАСЫВАЕМ СОСТОЯНИЕ ЧАТА ПРИ КАЖДОМ ВХОДЕ
                    resetChatState();

                    initContextMenu();
                    initMobileMenu();
                    handleResize();

                    // Слушаем изменения размера окна
                    window.addEventListener('resize', handleResize);

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
        initSimpleModals();
    } else {
        // Пользователь вышел из системы
        currentUser = null;
        
        // 🔥 ПОЛНЫЙ СБРОС СОСТОЯНИЯ ПРИ ВЫХОДЕ
        resetChatState();
        selectedChatUser = null;

        // Остановка слушателей
        if (messagesListener) {
            messagesListener();
            messagesListener = null;
        }
        if (usersListener) {
            usersListener();
            usersListener = null;
        }
        if (searchResultsListener) {
            searchResultsListener();
            searchResultsListener = null;
        }
        if (unreadCountListener) {
            unreadCountListener();
            unreadCountListener = null;
        }

        // Закрываем мобильную панель если открыта
        const usersPanel = document.querySelector('.users-panel');
        const menuToggle = document.querySelector('.menu-toggle');
        if (usersPanel) {
            usersPanel.classList.remove('active');
            usersPanel.style.cssText = '';
        }
        if (menuToggle) {
            menuToggle.classList.remove('active');
            menuToggle.innerHTML = '☰';
            menuToggle.style.cssText = '';
        }

        document.body.style.overflow = '';

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


// Инициализация модальных окон
function initSimpleModals() {
    // Модальное окно восстановления пароля
    forgotPasswordModal = document.getElementById('forgot-password-modal');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const closeForgotPassword = forgotPasswordModal.querySelector('.close');
    
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'block';
    });
    
    closeForgotPassword.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
        document.getElementById('reset-message').style.display = 'none';
    });
    
    // Модальное окно изменения имени
    changeNameModal = document.getElementById('change-name-modal');
    const changeNameBtn = document.getElementById('change-name-btn');
    const closeChangeName = changeNameModal.querySelector('.close');
    
    changeNameBtn.addEventListener('click', () => {
        document.getElementById('new-name').value = currentUser.name || '';
        changeNameModal.style.display = 'block';
    });
    
    closeChangeName.addEventListener('click', () => {
        changeNameModal.style.display = 'none';
        document.getElementById('name-message').style.display = 'none';
    });
    
    // Закрытие модальных окон при клике вне их
    window.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.style.display = 'none';
            document.getElementById('reset-message').style.display = 'none';
        }
        if (e.target === changeNameModal) {
            changeNameModal.style.display = 'none';
            document.getElementById('name-message').style.display = 'none';
        }
    });
}

// Восстановление пароля
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value;
    const messageDiv = document.getElementById('reset-message');
    
    try {
        await auth.sendPasswordResetEmail(email);
        
        messageDiv.textContent = 'Ссылка для сброса пароля отправлена на ваш email!';
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';
        
        // Очистка формы и закрытие модального окна через 3 секунды
        setTimeout(() => {
            forgotPasswordModal.style.display = 'none';
            document.getElementById('forgot-password-form').reset();
            messageDiv.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        let errorMessage = 'Ошибка отправки ссылки для сброса пароля';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'Пользователь с таким email не найден';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Некорректный email';
        }
        
        messageDiv.textContent = errorMessage;
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
    }
});

// Изменение имени
document.getElementById('change-name-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newName = document.getElementById('new-name').value.trim();
    const messageDiv = document.getElementById('name-message');
    
    if (!newName) {
        messageDiv.textContent = 'Имя не может быть пустым';
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
        return;
    }
    
    if (newName === currentUser.name) {
        messageDiv.textContent = 'Это ваше текущее имя';
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
        return;
    }
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            name: newName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Обновляем текущего пользователя
        currentUser.name = newName;
        userNameSpan.textContent = newName;
        
        messageDiv.textContent = 'Имя успешно изменено!';
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';
        
        // Обновляем имя в активных чатах
        await updateUserNameInChats(newName);
        
        setTimeout(() => {
            changeNameModal.style.display = 'none';
            messageDiv.style.display = 'none';
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка изменения имени:', error);
        messageDiv.textContent = 'Ошибка изменения имени';
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
    }
});

// Обновление имени пользователя в чатах
async function updateUserNameInChats(newName) {
     try {
        // Получаем последнее НЕ удаленное сообщение
        const messagesSnapshot = await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        
        if (messagesSnapshot.empty) {
            // Если сообщений нет - очищаем lastMessage
            await db.collection('chats').doc(chatId).update({
                lastMessage: null,
                lastMessageTime: null
            });
            return;
        }
        
        const lastMessageDoc = messagesSnapshot.docs[0];
        const lastMessage = lastMessageDoc.data();
        
        // Обновляем lastMessage в чате
        await db.collection('chats').doc(chatId).update({
            lastMessage: lastMessage.text,
            lastMessageTime: lastMessage.timestamp
        });
        
    } catch (error) {
        console.error('Ошибка обновления последнего сообщения:', error);
    }
}

async function updateLastMessageInChat(chatId) {
    try {
        // Получаем последнее сообщение (теперь удаленных уже нет в базе)
        const messagesSnapshot = await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        
        if (messagesSnapshot.empty) {
            // Если сообщений нет - очищаем lastMessage
            await db.collection('chats').doc(chatId).update({
                lastMessage: null,
                lastMessageTime: null
            });
            return;
        }
        
        const lastMessageDoc = messagesSnapshot.docs[0];
        const lastMessage = lastMessageDoc.data();
        
        // Обновляем lastMessage в чате
        await db.collection('chats').doc(chatId).update({
            lastMessage: lastMessage.text,
            lastMessageTime: lastMessage.timestamp
        });
        
        console.log("✅ Last message updated in chat");
        
    } catch (error) {
        console.error('Ошибка обновления последнего сообщения:', error);
    }
}

let emailNotificationTimer = null;
let currentEmailMessageId = null;
let currentEmailChatId = null;

// Показать уведомление
function showEmailNotification(messageId, chatId) {
     const notification = document.getElementById('email-notification');
    const timerElement = document.getElementById('email-timer');
    
    currentEmailMessageId = messageId;
    currentEmailChatId = chatId;
    emailTimerPaused = false;
    
    // Сбрасываем предыдущий таймер
    if (emailNotificationTimer) {
        clearInterval(emailNotificationTimer);
    }
    
    // Показываем уведомление
    notification.style.display = 'block';
    
    let timeLeft = 40; // 40 секунд
    timerElement.textContent = timeLeft;
    
    emailNotificationTimer = setInterval(() => {
        if (!emailTimerPaused) {
            timeLeft--;
            timerElement.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                hideEmailNotification();
                sendEmailNow(messageId, chatId);
            }
        }
    }, 1000);
}

// Приостановить таймер email
function pauseEmailTimer() {
   if (emailNotificationTimer && !emailTimerPaused) {
        emailTimerPaused = true;
        emailTimerPauseTime = Date.now();
        
        const timerElement = document.getElementById('email-timer');
        if (timerElement) {
            emailTimerRemaining = parseInt(timerElement.textContent);
        }
        
        // Визуальный индикатор паузы
        const notification = document.getElementById('email-notification');
        if (notification) {
            notification.classList.add('paused');
            
            const subtitle = notification.querySelector('.notification-subtitle');
            if (subtitle) {
                subtitle.innerHTML = 'Редактирование сообщения...<div class="pause-indicator">Таймер на паузе</div>';
            }
        }
        
        console.log("⏸️ Таймер email приостановлен");
    }
}

// Возобновить таймер email
function resumeEmailTimer() {
     if (emailNotificationTimer && emailTimerPaused && emailTimerRemaining) {
        emailTimerPaused = false;
        emailTimerPauseTime = null;
        
        // Убираем визуальный индикатор паузы
        const notification = document.getElementById('email-notification');
        if (notification) {
            notification.classList.remove('paused');
            
            const subtitle = notification.querySelector('.notification-subtitle');
            if (subtitle) {
                subtitle.innerHTML = 'Вы можете удалить сообщение в течение 40 секунд чтобы отменить отправку (или изменить(таймер будет на паузе)). Не закрывайте сайт до конца таймера';
            }
        }
        
        console.log("▶️ Таймер email возобновлен");
        
        const timerElement = document.getElementById('email-timer');
        if (timerElement) {
            timerElement.textContent = emailTimerRemaining;
        }
        
        emailTimerRemaining = null;
    }
}

// Полностью отменить таймер email
function cancelEmailTimer() {
    if (emailNotificationTimer) {
        clearInterval(emailNotificationTimer);
        emailNotificationTimer = null;
    }
    
    emailTimerPaused = false;
    emailTimerPauseTime = null;
    emailTimerRemaining = null;
    currentEmailMessageId = null;
    currentEmailChatId = null;
    
    hideEmailNotification();
    console.log("⏹️ Таймер email отменен");
}

// Скрыть уведомление
function hideEmailNotification() {
    const notification = document.getElementById('email-notification');
    
    if (emailNotificationTimer) {
        clearInterval(emailNotificationTimer);
        emailNotificationTimer = null;
    }
    
    notification.classList.add('hiding');
    setTimeout(() => {
        notification.style.display = 'none';
        notification.classList.remove('hiding');
        currentEmailMessageId = null;
        currentEmailChatId = null;
    }, 300);
}

// Немедленная отправка email
async function sendEmailNow(messageId, chatId) {
     try {
        // 🔥 ПРОВЕРЯЕМ что сообщение еще существует
        const messageDoc = await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .doc(messageId)
            .get();
            
        if (!messageDoc.exists) {
            console.log("❌ Сообщение было удалено, email отменен");
            return;
        }
        
        const message = messageDoc.data();
        
        // Получаем данные получателя
        const recipientId = chatId.split('_').find(id => id !== currentUser.uid);
        const recipientDoc = await db.collection('users').doc(recipientId).get();
        
        if (!recipientDoc.exists) {
            console.log("❌ Получатель не найден");
            return;
        }
        
        const recipientData = recipientDoc.data();
        
        /*
        if (!recipientData.emailNotifications) {
            console.log("❌ Email отменен - уведомления отключены");
            return;
        }*/
        
        // Отправляем email
        await sendEmailNotification(recipientData, message.text);
        
        console.log("✅ Email отправлен");
        showTempMessage("Email уведомление отправлено", "success");
        
    } catch (error) {
        console.error("❌ Ошибка отправки email:", error);
        showTempMessage("Ошибка отправки email", "error");
    }
}

function initMobileMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
    const usersPanel = document.querySelector('.users-panel');
    const chatArea = document.querySelector('.chat-area');
    const mainApp = document.getElementById('main-app');

    if (!menuToggle || !usersPanel || !chatArea) {
        console.error('❌ Элементы мобильного меню не найдены');
        return;
    }

    menuToggle.addEventListener('click', () => {
        const isOpening = !usersPanel.classList.contains('active');
        
        if (isOpening) {
            // Открываем панель на весь экран
            openFullscreenPanel();
        } else {
            // Закрываем панель
            closeFullscreenPanel();
        }
    });

    // Функция открытия панели на весь экран
    function openFullscreenPanel() {
         usersPanel.classList.add('active');
    menuToggle.classList.add('active');
    menuToggle.innerHTML = '✕';
    menuToggle.style.position = 'fixed';
    menuToggle.style.top = '15px';
    menuToggle.style.left = '15px';
    menuToggle.style.zIndex = '1002';
    menuToggle.style.background = '#2575fc';
    menuToggle.style.color = 'white';
    
    // Панель на весь экран, но оставляем место для header
    usersPanel.style.cssText = `
        position: fixed;
        top: 60px; /* 🔥 ОСТАВЛЯЕМ МЕСТО ДЛЯ HEADER */
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: calc(100vh - 60px); /* 🔥 ВЫЧИТАЕМ ВЫСОТУ HEADER */
        background: white;
        z-index: 1001;
        display: block !important;
        overflow-y: auto;
        padding: 20px;
    `;
    
    // Header должен быть поверх панели
    const header = document.querySelector('.header');
    if (header) {
        header.style.zIndex = '1003'; /* 🔥 HEADER ПОВЫШЕ */
        header.style.position = 'relative'; /* 🔥 ЧТОБЫ БЫЛ ВИДИМ */
    }
    
    // Скрываем чат
    chatArea.style.display = 'none';
    
    // Блокируем скролл body
    document.body.style.overflow = 'hidden';
    }

    // Функция закрытия панели
    function closeFullscreenPanel() {
        usersPanel.classList.remove('active');
    menuToggle.classList.remove('active');
    menuToggle.innerHTML = '☰';
    menuToggle.style.position = '';
    menuToggle.style.top = '';
    menuToggle.style.left = '';
    menuToggle.style.background = '';
    menuToggle.style.color = '';
    
    // Возвращаем обычные стили
    usersPanel.style.cssText = '';
    
    // Возвращаем header в нормальное состояние
    const header = document.querySelector('.header');
    if (header) {
        header.style.zIndex = '';
        header.style.position = '';
    }
    
    // Показываем чат
    chatArea.style.display = 'flex';
    
    // Разблокируем скролл body
    document.body.style.overflow = '';
    }

    // Закрытие панели при выборе пользователя
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            usersPanel.classList.contains('active') && 
            e.target.closest('.user-item')) {
            closeFullscreenPanel();
        }
    });

    // Закрытие панели при клике вне ее (оверлей)
    usersPanel.addEventListener('click', (e) => {
        if (e.target === usersPanel) {
            closeFullscreenPanel();
        }
    });

    // Закрытие панели при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && usersPanel.classList.contains('active')) {
            closeFullscreenPanel();
        }
    });

    console.log("✅ Мобильное меню инициализировано");
}

// Обновите обработчик изменения размера окна
function handleResize() {
   const menuToggle = document.querySelector('.menu-toggle');
    const usersPanel = document.querySelector('.users-panel');
    const chatArea = document.querySelector('.chat-area');
    const header = document.querySelector('.header');

    if (window.innerWidth > 768) {
        // Десктоп - показываем обе панели
        if (usersPanel) {
            usersPanel.classList.add('active');
            usersPanel.style.cssText = '';
            usersPanel.style.display = 'block';
        }
        if (chatArea) {
            chatArea.style.display = 'flex';
        }
        if (menuToggle) {
            menuToggle.style.display = 'none';
        }
        if (header) {
            header.style.zIndex = '';
            header.style.position = '';
        }
        document.body.style.overflow = '';
    } else {
        // Мобильные - скрываем панель пользователей
        if (menuToggle) {
            menuToggle.style.display = 'block';
            menuToggle.innerHTML = '☰';
            menuToggle.style.position = '';
            menuToggle.style.zIndex = '';
        }
        if (usersPanel) {
            usersPanel.classList.remove('active');
            usersPanel.style.cssText = '';
        }
        if (chatArea) {
            chatArea.style.display = 'flex';
        }
        if (header) {
            header.style.zIndex = '';
            header.style.position = '';
        }
    }
}

function resetChatState() {
    const messagesContainer = document.getElementById('messages-container');
    const chatWithUser = document.getElementById('chat-with-user');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');

    // Сбрасываем заголовок чата
    if (chatWithUser) {
        chatWithUser.innerHTML = 'Выберите пользователя для общения';
    }

    // Очищаем сообщения
    if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="no-messages">Выберите пользователя для начала общения</div>';
    }

    // Блокируем поле ввода
    if (messageInput) {
        messageInput.disabled = true;
        messageInput.placeholder = 'Выберите пользователя для общения...';
        messageInput.value = '';
    }

    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }

    // Сбрасываем выбранного пользователя
    selectedChatUser = null;

    // Снимаем выделение с пользователей
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });

    // Останавливаем слушатели сообщений
    if (messagesListener) {
        messagesListener();
        messagesListener = null;
    }

    console.log("✅ Состояние чата сброшено");
}

const mobileStyles = `
@media (max-width: 768px) {
    .users-panel.active {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: white !important;
        z-index: 1001 !important;
        display: block !important;
        overflow-y: auto !important;
        padding: 60px 20px 20px 20px !important;
        border-radius: 0 !important;
    }
    
    .menu-toggle.active {
        position: fixed !important;
        top: 15px !important;
        left: 15px !important;
        z-index: 1002 !important;
        background: #2575fc !important;
        color: white !important;
    }
    
    .chat-area {
        transition: opacity 0.3s ease;
    }
}
`;

// Добавление стилей в страницу
const styleSheet = document.createElement('style');
styleSheet.textContent = mobileStyles;
document.head.appendChild(styleSheet);