// Глобальный кэш аватарок пользователей (объявляем глобально)
window.userAvatars = {};

document.addEventListener('DOMContentLoaded', () => {
    const authDiv = document.getElementById('auth');
    const chatDiv = document.getElementById('chat');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const fileInput = document.getElementById('fileInput');
    const fileButton = document.getElementById('fileButton');
    const profileButton = document.getElementById('profileButton');
    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.querySelectorAll('#closeProfileModal');
    const saveProfileButton = document.getElementById('saveProfileButton');
    const newUsernameInput = document.getElementById('newUsername');
    const avatarInput = document.getElementById('avatarInput');
    const logoutButton = document.getElementById('logoutButton');

    const callButton = document.getElementById('callButton'); // Получаем кнопку звонка
    
    let callInProgress = false; // Флаг, чтобы предотвратить несколько звонков одновременно


    // Проверяем наличие элементов для предпросмотра файлов
    const filePreview = document.getElementById('filePreview');
    const fileName = filePreview ? document.getElementById('fileName') : null;
    const removeFile = filePreview ? document.getElementById('removeFile') : null;

    let token = localStorage.getItem('token');
    let socket;
    let selectedFile = null;

    // Функция для получения иконки по типу файла
    const getFileIcon = (fileUrl, fileType) => {
        const extension = fileUrl.split('.').pop().toLowerCase();
        if (fileType.startsWith('image/')) {
            return ''; // Для изображений иконка не нужна, показываем само изображение
        }
        switch (extension) {
            case 'pdf':
                return '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m-9-3h12a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"></path></svg>';
            case 'doc':
            case 'docx':
                return '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
            case 'zip':
            case 'rar':
                return '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>';
            default:
                return '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>';
        }
    };


    // Получение аватарки пользователя (с кэшированием)
    async function getUserAvatar(username) {
        if (window.userAvatars[username]) {
            return window.userAvatars[username];
        }

        try {
            const response = await fetch(`/user/${username}`);
            if (response.ok) {
                const userData = await response.json();
                if (userData.avatar) {
                    window.userAvatars[username] = userData.avatar;
                    return userData.avatar;
                }
            }
        } catch (error) {
            console.error('Ошибка при получении аватарки:', error);
        }

        // Если аватарка не найдена, устанавливаем значение по умолчанию
        window.userAvatars[username] = '/uploads/default-avatar.png';
        return '/uploads/default-avatar.png';
    }

    // Отображение сообщений с улучшенным форматированием
    async function displayMessage(msg) {
        if (!window.socket || !window.socket.user) return; // Если соединение ещё не установлено, пропускаем

        const messageElement = document.createElement('div');
        const isSentByMe = msg.username === window.socket.user.username;
        messageElement.classList.add('message', isSentByMe ? 'sent' : 'received');

        // Сохраняем ID сообщения для возможности редактирования/удаления
        if (msg._id) {
            messageElement.setAttribute('data-message-id', msg._id);
        }

        // Получаем аватарку из сообщения или запрашиваем её, если не указана
        const avatarUrl = msg.avatar || await getUserAvatar(msg.username);

        // Форматирование даты
        const messageDate = new Date(msg.timestamp || Date.now());
        const timeString = messageDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Форматирование имени файла для отображения
        const getFormattedFilename = (url) => {
            const filename = url.split('/').pop();
            // Ограничиваем длину имени файла
            return filename.length > 20 ? filename.substring(0, 17) + '...' + filename.substring(filename.lastIndexOf('.')) : filename;
        };

        // Создаем кнопки редактирования/удаления только для своих сообщений
        const actionButtons = isSentByMe ? `
            <div class="message-actions">
                <button class="edit-message-btn" title="Редактировать">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
                <button class="delete-message-btn" title="Удалить">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        ` : '';

        // Отметка о редактировании
        const editedMark = msg.edited ? '<span class="message-edited">(ред.)</span>' : '';

        let content = `
            <div class="message-wrapper">
                <div class="flex items-center">
                    <img src="${avatarUrl}" alt="${msg.username}" class="avatar">
                    <span class="username">${msg.username}</span>
                </div>
                <div class="content">
                    ${msg.text ? `<p class="message-text">${msg.text} ${editedMark}</p>` : ''}
                    ${msg.fileUrl ? (
                        msg.fileType && msg.fileType.startsWith('image/') 
                        ? `<img src="${msg.fileUrl}" alt="Image" class="message-image" loading="lazy">` 
                        : `<a href="${msg.fileUrl}" target="_blank" download class="file-link">
                            ${getFileIcon(msg.fileUrl, msg.fileType || '')}
                            <span>${getFormattedFilename(msg.fileUrl)}</span>
                          </a>`
                    ) : ''}
                    <div class="text-right flex items-center justify-end">
                        ${actionButtons}
                        <span class="text-xs text-opacity-70 ml-2">${timeString}</span>
                    </div>
                </div>
            </div>
        `;

        messageElement.innerHTML = content;
        messagesDiv.appendChild(messageElement);

        // Добавляем обработчики событий для кнопок редактирования и удаления
        if (isSentByMe) {
            const editBtn = messageElement.querySelector('.edit-message-btn');
            const deleteBtn = messageElement.querySelector('.delete-message-btn');

            if (editBtn) {
                editBtn.addEventListener('click', () => handleEditMessage(messageElement, msg));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => handleDeleteMessage(messageElement, msg));
            }
        }

        // При загрузке одиночных сообщений будем использовать плавный скролл
        if (messagesDiv.classList.contains('loaded')) {
            setTimeout(() => {
                messagesDiv.scrollTo({
                    top: messagesDiv.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }

    // Обработчик редактирования сообщения
    function handleEditMessage(messageElement, msg) {
        // Находим текст сообщения
        const textElement = messageElement.querySelector('.message-text');
        if (!textElement) return;

        // Получаем текущий текст без отметки о редактировании
        const currentText = textElement.textContent.replace('(ред.)', '').trim();

        // Создаем поле для редактирования
        const editContainer = document.createElement('div');
        editContainer.className = 'edit-message-container';
        editContainer.innerHTML = `
            <textarea class="edit-textarea">${currentText}</textarea>
            <div class="edit-buttons">
                <button class="save-edit-btn">Сохранить</button>
                <button class="cancel-edit-btn">Отмена</button>
            </div>
        `;

        // Заменяем текст на форму редактирования
        textElement.style.display = 'none';
        textElement.parentNode.insertBefore(editContainer, textElement);

        // Фокус на текстовом поле
        const textarea = editContainer.querySelector('.edit-textarea');
        textarea.focus();

        // Обработчик для сохранения изменений
        editContainer.querySelector('.save-edit-btn').addEventListener('click', () => {
            const newText = textarea.value.trim();
            if (newText && newText !== currentText) {
                // Отправляем новый текст на сервер
                window.socket.emit('edit message', {
                    id: messageElement.getAttribute('data-message-id'),
                    text: newText
                });

                // Обновляем текст локально (сервер подтвердит изменение)
                textElement.innerHTML = `${newText} <span class="message-edited">(ред.)</span>`;
            }

            // Возвращаем отображение текста
            textElement.style.display = 'block';
            editContainer.remove();
        });

        // Обработчик для отмены редактирования
        editContainer.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            textElement.style.display = 'block';
            editContainer.remove();
        });
    }

    // Обработчик удаления сообщения
    function handleDeleteMessage(messageElement, msg) {
        // Запрашиваем подтверждение
        if (confirm('Удалить это сообщение?')) {
            const messageId = messageElement.getAttribute('data-message-id');

            if (!messageId) {
                console.error('Не удалось найти ID сообщения');
                return;
            }

            // Отправляем запрос на удаление
            window.socket.emit('delete message', { id: messageId });

            // Визуально показываем, что идет процесс удаления
            messageElement.classList.add('deleting');

            console.log(`Отправлен запрос на удаление сообщения с ID: ${messageId}`);
        }
    }

    // Регистрация
    registerButton.addEventListener('click', async () => {
        const username = usernameInput.value;
        const password = passwordInput.value;
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (response.ok) {
            alert('Регистрация успешна. Теперь войдите.');
        } else {
            alert('Ошибка регистрации');
        }
    });

    // Вход
    loginButton.addEventListener('click', async () => {
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username || !password) {
            alert('Введите имя пользователя и пароль');
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                token = data.token;
                localStorage.setItem('token', token);
                authDiv.classList.add('hidden');
                chatDiv.classList.remove('hidden');
                connectSocket();
            } else {
                const errorMsg = await response.text();
                alert(`Ошибка входа: ${errorMsg || 'Неверные учетные данные'}`);
            }
        } catch (error) {
            console.error('Ошибка при отправке запроса:', error);
            alert('Произошла ошибка при входе. Пожалуйста, попробуйте снова.');
        }
    });

    // Выход
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        authDiv.classList.remove('hidden');
        chatDiv.classList.add('hidden');
        window.socket.disconnect();
    });

    // Подключение к Socket.IO
    const connectSocket = () => {
        if (!token) return;

        window.socket = io({ auth: { token } });

        window.socket.on('connect', () => {
            try {
                window.socket.user = { username: jwt_decode(token).username };
                console.log('Подключение к сокету установлено');
                // После успешного подключения загружаем сообщения
                loadMessages();
            } catch (err) {
                console.error('Ошибка при декодировании токена:', err);
                handleSessionExpired();
            }
        });

        window.socket.on('connect_error', (err) => {
            console.error('Ошибка подключения к сокету:', err);
            if (err.message.includes('token')) {
                handleSessionExpired();
            }
        });

        window.socket.on('chat message', displayMessage);

        // Обработка удаления сообщений
        window.socket.on('message deleted', (data) => {
            const messageElement = document.querySelector(`[data-message-id="${data.id}"]`);
            if (messageElement) {
                // Анимация удаления
                messageElement.classList.add('deleting');
                setTimeout(() => {
                    messageElement.remove();
                }, 300);
            }
        });

        // Обработка редактирования сообщений
        window.socket.on('message edited', (data) => {
            const messageElement = document.querySelector(`[data-message-id="${data.id}"]`);
            if (messageElement) {
                const textElement = messageElement.querySelector('.message-text');
                if (textElement) {
                    textElement.innerHTML = `${data.text} <span class="message-edited">(ред.)</span>`;
                }
            }
        });

        // Обработка ошибок
        window.socket.on('error', (error) => {
            console.error('Ошибка:', error.message);
            alert(error.message);
        });

        // Обработка событий обновления профиля пользователя
        window.socket.on('user profile updated', (data) => {
            console.log('Пользователь обновил профиль:', data);

            // Обновляем кэш аватарок
            if (data.newUsername && data.avatar) {
                userAvatars[data.newUsername] = data.avatar;

                // Удаляем старую запись из кэша если имя пользователя изменилось
                if (data.oldUsername && data.oldUsername !== data.newUsername) {
                    delete userAvatars[data.oldUsername];
                }
            }

            // Обновляем имя отправителя и аватарки во всех сообщениях в DOM
            const messages = document.querySelectorAll('.message');
            messages.forEach(message => {
                const usernameEl = message.querySelector('.font-semibold');
                if (usernameEl && usernameEl.textContent === data.oldUsername) {
                    usernameEl.textContent = data.newUsername;

                    // Обновляем класс сообщения, если это наши сообщения
                    if (window.socket.user.username === data.newUsername) {
                        message.classList.add('sent');
                        message.classList.remove('received');
                    } else if (window.socket.user.username === data.oldUsername) {
                        message.classList.add('received');
                        message.classList.remove('sent');
                    }

                    // Обновляем аватарку во всех сообщениях этого пользователя
                    const avatarImgs = message.querySelectorAll('.avatar');
                    avatarImgs.forEach(img => {
                        img.src = data.avatar || '/uploads/default-avatar.png';
                        img.alt = data.newUsername;
                    });
                }
            });
        });

        // Обработка событий подключения/отключения пользователей
        window.socket.on('user connected', (data) => {
            console.log(`Пользователь ${data.username} подключился`);
            // Здесь можно добавить уведомление о подключении
        });

        window.socket.on('user disconnected', (data) => {
            console.log(`Пользователь ${data.username} отключился`);
            // Здесь можно добавить уведомление об отключении
        });
    };

    // Обработка истечения срока сессии
    const handleSessionExpired = () => {
        localStorage.removeItem('token');
        token = null;
        authDiv.classList.remove('hidden');
        chatDiv.classList.add('hidden');
        alert('Сессия истекла. Пожалуйста, войдите снова.');
    };

    // Загрузка сообщений
    const loadMessages = async () => {
        try {
            // Показываем индикатор загрузки
            const loadingSpinner = document.getElementById('loadingSpinner');
            if (loadingSpinner) loadingSpinner.style.display = 'flex';

            const response = await fetch('/messages', {
                headers: { 'Authorization': token },
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    handleSessionExpired();
                    return;
                }
                throw new Error(`Ошибка загрузки сообщений: ${response.status}`);
            }

            const messages = await response.json();

            // Временно отключаем анимацию для быстрой загрузки
            document.documentElement.style.setProperty('--message-animation', 'none');

            // Добавляем все сообщения сразу
            for (const msg of messages) {
                await displayMessage(msg);
            }

            // Моментальный скролл к последнему сообщению
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // Скрываем индикатор загрузки после загрузки всех сообщений
            if (loadingSpinner) loadingSpinner.style.display = 'none';

            // Возвращаем анимацию через небольшую задержку
            setTimeout(() => {
                document.documentElement.style.setProperty('--message-animation', 'slideIn 0.3s ease-out');
                // Помечаем, что сообщения загружены
                messagesDiv.classList.add('loaded');
            }, 100);
        } catch (error) {
            console.error('Ошибка при загрузке сообщений:', error);

            // Скрываем индикатор загрузки в случае ошибки
            const loadingSpinner = document.getElementById('loadingSpinner');
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    };

    // Отправка сообщения
    sendButton.addEventListener('click', async () => {
        const text = messageInput.value.trim();
        if (text || selectedFile) {
            let fileUrl, fileType;
            if (selectedFile) {
                const formData = new FormData();
                if (selectedFile.type.startsWith('image/')) {
                    await new Promise((resolve) => {
                        new Compressor(selectedFile, {
                            quality: 0.6,
                            maxWidth: 800,
                            maxHeight: 800,
                            success(result) {
                                formData.append('file', result, result.name);
                                resolve();
                            },
                            error(err) {
                                console.error('Ошибка сжатия:', err);
                                resolve();
                            },
                        });
                    });
                } else {
                    formData.append('file', selectedFile);
                }
                try {
                    const response = await fetch('/upload', {
                        method: 'POST',
                        headers: { 'Authorization': token },
                        body: formData,
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            handleSessionExpired();
                            return;
                        }
                        throw new Error(`Ошибка загрузки файла: ${response.status}`);
                    }

                    const data = await response.json();
                    fileUrl = data.fileUrl;
                    fileType = data.fileType;
                    if (clearFilePreview) clearFilePreview();
                } catch (error) {
                    console.error('Ошибка при загрузке файла:', error);
                    return;
                }
            }
            window.socket.emit('chat message', { text, fileUrl, fileType });
            messageInput.value = '';
        }
    });

    // Выбор файла
    fileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        selectedFile = fileInput.files[0];
        if (selectedFile && filePreview && fileName) {
            // Если имя файла слишком длинное, обрезаем
            const displayName = selectedFile.name.length > 25 
                ? selectedFile.name.substring(0, 22) + '...' 
                : selectedFile.name;
            fileName.textContent = displayName;
            filePreview.classList.remove('hidden');
            filePreview.classList.add('flex');

            // Фокус на поле ввода для удобства пользователя
            setTimeout(() => {
                messageInput.focus();
            }, 100);
        }
    });

    // Функция очистки предпросмотра файла
    const clearFilePreview = () => {
        selectedFile = null;
        fileInput.value = '';
        if (filePreview) {
            filePreview.classList.add('hidden');
            filePreview.classList.remove('flex');
            if (fileName) fileName.textContent = '';

            // Возвращаем фокус на поле ввода
            setTimeout(() => {
                messageInput.focus();
            }, 100);
        }
    };

    // Удаление файла (проверяем, что элементы существуют)
    if (removeFile) {
        removeFile.addEventListener('click', () => clearFilePreview());
    }

    if (messageInput) {
        // Автоматическое изменение высоты поля ввода при вводе текста
        const autoResize = () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
        };

        messageInput.addEventListener('input', autoResize);
        messageInput.addEventListener('focus', autoResize);

        // Отправка по Enter (без Shift)
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendButton.click();
                // Сброс высоты поля ввода после отправки
                setTimeout(() => {
                    messageInput.style.height = '40px';
                }, 10);
            }
        });
    }

    // Проверка и автоматический вход при загрузке страницы
    if (token) {
        // Проверка валидности токена
        fetch('/validate-token', {
            headers: { 'Authorization': token }
        })
        .then(response => {
            if (response.ok) {
                // Если токен валиден, автоматически входим
                authDiv.classList.add('hidden');
                chatDiv.classList.remove('hidden');
                connectSocket();
            } else {
                // Если токен невалиден, удаляем его
                localStorage.removeItem('token');
                token = null;
            }
        })
        .catch(err => {
            console.error('Ошибка при проверке токена:', err);
        });
    }
});

// Временная заглушка для jwt_decode
function jwt_decode(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}


// Инициализируем обработчики модального окна профиля после полной загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const profileModal = document.getElementById('profileModal');
    const profileButton = document.getElementById('profileButton');
    const closeProfileModalButtons = document.querySelectorAll('#closeProfileModal');
    const saveProfileButton = document.getElementById('saveProfileButton');
    const newUsernameInput = document.getElementById('newUsername');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');

    // Открытие модального окна
    if (profileButton && profileModal) {
        profileButton.addEventListener('click', async () => {
            try {
                // Получаем актуальный токен из localStorage
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('Вы не авторизованы');
                    return;
                }

                // Проверяем, что сокет инициализирован и имеет данные пользователя
                if (window.socket && window.socket.user && window.socket.user.username) {
                    const response = await fetch(`/user/${window.socket.user.username}`, {
                        headers: { 'Authorization': token }
                    });

                    if (response.ok) {
                        const userData = await response.json();

                        // Заполняем поле никнейма
                        if (newUsernameInput) {
                            newUsernameInput.value = userData.username || '';
                        }

                        // Устанавливаем текущую аватарку
                        if (avatarPreview) {
                            avatarPreview.src = userData.avatar || '/uploads/default-avatar.png';
                        }
                    }
                }
            } catch (error) {
                console.error('Ошибка при получении данных пользователя:', error);
            }

            profileModal.classList.remove('hidden');
        });
    }

    // Закрытие модального окна
    if (closeProfileModalButtons) {
        closeProfileModalButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (profileModal) profileModal.classList.add('hidden');
            });
        });
    }

    // Предпросмотр аватарки с компрессией
    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', () => {
            const file = avatarInput.files[0];
            if (file && file.type.startsWith('image/')) {
                // Используем компрессор для уменьшения размера аватарки
                new Compressor(file, {
                    quality: 0.8, // Качество изображения (0-1)
                    maxWidth: 200, // Максимальная ширина
                    maxHeight: 200, // Максимальная высота
                    success(result) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            avatarPreview.src = e.target.result;
                        };
                        reader.readAsDataURL(result);
                    },
                    error(err) {
                        console.error('Ошибка при сжатии аватарки:', err);
                        // Если ошибка сжатия, просто показываем без сжатия
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            avatarPreview.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        });
    }

    // Сохранение профиля
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', async () => {
            // Получаем актуальный токен из localStorage
            const token = localStorage.getItem('token');

            if (!token) {
                alert('Вы не авторизованы');
                return;
            }

            const newUsername = newUsernameInput ? newUsernameInput.value.trim() : '';
            const avatarFile = avatarInput && avatarInput.files && avatarInput.files.length > 0 ? avatarInput.files[0] : null;

            if (!newUsername && !avatarFile) {
                alert('Введите новый никнейм или выберите аватарку');
                return;
            }

            const formData = new FormData();
            if (newUsername) formData.append('username', newUsername);
            if (avatarFile) formData.append('avatar', avatarFile);

            try {
                const oldUsername = window.socket && window.socket.user ? window.socket.user.username : '';

                const response = await fetch('/profile', {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();

                    // Обновляем токен и информацию о пользователе
                    if (data.token) {
                        localStorage.setItem('token', data.token);
                    }

                    // Обновляем кэш аватарок если он существует в глобальной области
                    if (data.user && window.userAvatars) {
                        // Сохраняем новую аватарку в кэше
                        window.userAvatars[data.user.username] = data.user.avatar;

                        // Если был изменен username, удаляем старую запись из кэша
                        if (oldUsername && oldUsername !== data.user.username) {
                            delete window.userAvatars[oldUsername];
                        }
                    }

                    // Обновляем данные в сокете
                    if (window.socket && window.socket.user) {
                        window.socket.user.username = data.user.username;

                        // Оповещаем сервер об обновлении профиля
                        window.socket.emit('profile updated', {
                            oldUsername: oldUsername,
                            newUsername: data.user.username
                        });
                    }

                    alert('Профиль обновлён');
                    location.reload();
                    if (profileModal) profileModal.classList.add('hidden');
                } else {
                    const errorMsg = await response.text();
                    alert(`Ошибка обновления профиля: ${errorMsg || 'Не удалось обновить профиль'}`);
                }
            } catch (error) {
                console.error('Ошибка при отправке запроса:', error);
                alert('Произошла ошибка при обновлении профиля');
            }
        });
    }
});