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
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const message = change.doc.data();
                
                // Показываем уведомление для НОВЫХ сообщений
                if (message.timestamp > Date.now() - 5000) { // Только свежие
                    showMessageNotification(message);
                }
                
                displayMessage(message);
            }
        });
        
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
              showMessageNotification(messageText);

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

// Функция показа уведомления
function showMessageNotification(message) {

  if (!isWindowFocused()) {
        playNotificationSound(); // Звук только если страница неактивна
    }

if (!("Notification" in window)) {
        console.error("❌ Notification API не поддерживается");
        return;
    }
    
    if (Notification.permission !== "granted") {
        console.log("❌ Нет разрешения на уведомления");
        return;
    }
    
    // Проверяем активен ли чат с этим пользователем
    if (selectedChatUser && selectedChatUser.id === message.senderId) {
        console.log("✅ Чат активен - уведомление не показываем");
        return;
    }
    
    // Проверяем активно ли окно
    if (document.hasFocus()) {
        console.log("✅ Окно активно - уведомление не показываем");
        return;
    }
    
    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }
    
    // Проверяем активен ли чат с этим пользователем
    if (selectedChatUser && selectedChatUser.id === message.senderId) {
        return; // Не показываем если чат открыт
    }
    
    // Проверяем активно ли окно
    if (document.hasFocus()) {
        return; // Не показываем если пользователь на сайте
    }
    
    
    const notification = new Notification(`💬 ${message.senderName}`, {
        body: message.text.length > 50 ? message.text.substring(0, 50) + "..." : message.text,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: message.id, // Для группировки уведомлений
        requireInteraction: false,
        silent: false
    });
    
    // При клике на уведомление открываем чат
    notification.onclick = () => {
        window.focus();
        // Находим пользователя в списке и открываем чат
        const userItem = document.querySelector(`[data-user-id="${message.senderId}"]`);
        if (userItem) {
            userItem.click();
        }
        notification.close();
    };
    
    // Автоматическое закрытие через 5 секунд
    setTimeout(() => {
        notification.close();
    }, 5000);

    
}


// Проверяем нужно ли показывать кнопку
function checkMobileNotifications() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i.test(navigator.userAgent);
    
    if (isMobile) {
        console.log("📱 Обнаружено мобильное устройство");
        
        if (Notification.permission === "default") {
            // Показываем кнопку только если еще не запрашивали
            const alreadyAsked = localStorage.getItem('notificationsAsked');
            if (!alreadyAsked) {
                document.getElementById('mobile-notification-request').style.display = 'block';
                localStorage.setItem('notificationsAsked', 'true');
            }
        } else if (Notification.permission === "granted") {
            // Уже разрешено - скрываем кнопку
            document.getElementById('mobile-notification-request').style.display = 'none';
        }
    }
}

// Функция специально для мобильных
function requestMobileNotificationPermission() {
    console.log("📱 Запрос разрешения для мобильного");
    
    if (!("Notification" in window)) {
        alert("Ваш браузер не поддерживает уведомления");
        return;
    }
    
    // Этот вызов ДОЛЖЕН быть по клику пользователя на мобильных
    Notification.requestPermission().then(permission => {
        console.log("Мобильное разрешение:", permission);
        
        if (permission === "granted") {
            // Скрываем кнопку
            document.getElementById('mobile-notification-request').style.display = 'none';
            
            // Показываем тестовое уведомление
            showTestNotification();
            
            // Сохраняем в localStorage что разрешили
            localStorage.setItem('notificationsGranted', 'true');
        } else {
            alert("Разрешите уведомления в настройках браузера");
        }
    });
}

// Показать тестовое уведомление
function showTestNotification() {
    if (Notification.permission === "granted") {
        new Notification("SAS Messenger", {
            body: "Уведомления включены! Вы будете получать сообщения",
            icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💬</text></svg>",
            tag: "welcome"
        });
    }
}

// Проверяем активно ли окно
function isWindowFocused() {
    return document.hasFocus();
}

// Функция воспроизведения звука
function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// Слушатель изменения видимости
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log("Страница неактивна - уведомления будут показаны");
    } else {
        console.log("Страница активна - уведомления скрыты");
    }
});


function onFirstMessageReceived() {
    if (Notification.permission === "default") {
        // Вежливый запрос при первом сообщении
        setTimeout(() => {
            if (confirm("Хотите получать уведомления о новых сообщениях?")) {
                requestNotificationPermission();
            }
        }, 1000);
    }
}

// Проверка возможностей
function checkNotificationSupport() {
    const support = {
        notifications: "Notification" in window,
        serviceWorker: "serviceWorker" in navigator,
        pushManager: "PushManager" in window
    };
    
    console.log("Поддержка уведомлений:", support);
    
    if (!support.notifications) {
        console.warn("Браузер не поддерживает уведомления");
    }
    
    return support;
}



// Функция запроса разрешения
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("Браузер не поддерживает уведомления");
        return;
    }
    
    if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Разрешение на уведомления получено!");
                showWelcomeNotification();
            }
        });
    }
}

// Приветственное уведомление
function showWelcomeNotification() {
    if (Notification.permission === "granted") {
        new Notification("SAS Messenger", {
            body: "Теперь вы будете получать уведомления о новых сообщениях",
            icon: "/favicon.ico"
        });
    }
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


 // Запрашиваем уведомления
        setTimeout(() => {
            requestNotificationPermission();
        }, 2000);

                     // Проверяем мобильные уведомления
        setTimeout(() => {
            checkMobileNotifications();
        }, 2000);
     
                    
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
        // Получаем все чаты пользователя
        const chatsSnapshot = await db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .get();
        
        const batch = db.batch();
        
        for (const chatDoc of chatsSnapshot.docs) {
            // Обновляем имя в сообщениях
            const messagesSnapshot = await db.collection('chats')
                .doc(chatDoc.id)
                .collection('messages')
                .where('senderId', '==', currentUser.uid)
                .get();
            
            for (const messageDoc of messagesSnapshot.docs) {
                const messageRef = db.collection('chats')
                    .doc(chatDoc.id)
                    .collection('messages')
                    .doc(messageDoc.id);
                batch.update(messageRef, { senderName: newName });
            }
        }
        
        await batch.commit();
        console.log('Имя обновлено во всех чатах');
        
    } catch (error) {
        console.error('Ошибка обновления имени в чатах:', error);
    }
}
