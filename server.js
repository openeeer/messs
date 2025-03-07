const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Настройка middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads")); // Доступ к загруженным файлам

// Настройка Multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Подключение к MongoDB Atlas
const mongoURI =
    "mongodb+srv://dfxminecraft:OnCi1PzemxZCR91d@cluster0.yh1gz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Замените cluster0.zyxwv
mongoose
    .connect(mongoURI)
    .then(() => console.log("Подключено к MongoDB Atlas"))
    .catch((err) => console.error("Ошибка подключения к MongoDB:", err));

// Модель пользователя
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    avatar: { type: String, default: '/uploads/default-avatar.png' }, // URL аватарки пользователя
});
const User = mongoose.model("User", userSchema);

// Модель сообщения
const messageSchema = new mongoose.Schema({
    username: String,
    text: String,
    fileUrl: String,
    fileType: String,
    timestamp: { type: Date, default: Date.now },
    avatar: String, // URL аватарки пользователя
    edited: { type: Boolean, default: false } // Флаг, был ли отредактирован
});
const Message = mongoose.model("Message", messageSchema);

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send("Токен не предоставлен");
    jwt.verify(token, "your_secret_key", (err, user) => {
        if (err) return res.status(403).send("Неверный токен");
        req.user = user;
        next();
    });
};

// Регистрация пользователя

// Проверка токена
app.get("/validate-token", authenticateToken, (req, res) => {
    // Если мы дошли до этой точки, значит токен валидный
    res.status(200).send({ valid: true, username: req.user.username });
});

app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).send("Имя пользователя и пароль обязательны");
        }
        
        // Проверяем, существует ли пользователь
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).send("Пользователь с таким именем уже существует");
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        // Создаем пользователя с аватаркой по умолчанию
        const user = new User({ 
            username, 
            password: hashedPassword,
            avatar: '/uploads/default-avatar.png'
        });
        await user.save();
        res.status(201).send("Пользователь зарегистрирован");
    } catch (error) {
        console.error("Ошибка при регистрации:", error);
        res.status(500).send("Ошибка сервера при регистрации");
    }
});

// Вход пользователя
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).send("Имя пользователя и пароль обязательны");
        }
        
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).send("Пользователь не найден");
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).send("Неверный пароль");
        }
        
        const token = jwt.sign({ username: user.username }, "your_secret_key", { expiresIn: '7d' });
        res.json({ 
            token,
            user: {
                username: user.username,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error("Ошибка при входе:", error);
        res.status(500).send("Ошибка сервера при входе");
    }
});

// Получение всех сообщений
app.get("/messages", authenticateToken, async (req, res) => {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
});

// Удаление сообщения
app.delete("/messages/:id", authenticateToken, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).send("Сообщение не найдено");
        }
        if (message.username !== req.user.username) { // **Важная проверка авторства**
            return res.status(403).send("Нет прав для удаления этого сообщения");
        }
        await Message.findByIdAndDelete(req.params.id);
        res.json({ success: true, id: req.params.id });
    } catch (error) {
        console.error("Ошибка при удалении сообщения:", error);
        res.status(500).send("Ошибка сервера при удалении сообщения");
    }
});

// Редактирование сообщения
app.put("/messages/:id", authenticateToken, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).send("Сообщение не найдено");
        }
        if (message.username !== req.user.username) { // **Важная проверка авторства**
            return res.status(403).send("Нет прав для редактирования этого сообщения");
        }
        const { text } = req.body;
        message.text = text;
        message.edited = true;
        await message.save();
        res.json({
            success: true,
            id: req.params.id,
            text,
            edited: true
        });
    } catch (error) {
        console.error("Ошибка при редактировании сообщения:", error);
        res.status(500).send("Ошибка сервера при редактировании сообщения");
    }
});

// Загрузка файла
app.post(
    "/upload",
    authenticateToken,
    upload.single("file"),
    async (req, res) => {
        const fileUrl = `/uploads/${req.file.filename}`;
        const fileType = req.file.mimetype;
        res.json({ fileUrl, fileType });
    },
);

// Обновление профиля пользователя
app.post(
    "/profile",
    authenticateToken,
    upload.single("avatar"),
    async (req, res) => {
        try {
            const user = await User.findOne({ username: req.user.username });
            if (!user) {
                return res.status(404).send("Пользователь не найден");
            }

            // Обновление имени пользователя, если оно было предоставлено
            const newUsername = req.body.username;
            if (newUsername && newUsername !== user.username) {
                // Проверка, существует ли пользователь с таким именем
                const existingUser = await User.findOne({
                    username: newUsername,
                });
                if (existingUser) {
                    return res
                        .status(400)
                        .send("Пользователь с таким именем уже существует");
                }

                // Обновляем имя во всех сообщениях
                await Message.updateMany(
                    { username: user.username },
                    { $set: { username: newUsername } },
                );

                user.username = newUsername;
            }

            // Обновление аватарки, если она была предоставлена
            if (req.file) {
                try {
                    const avatarUrl = `/uploads/${req.file.filename}`;
                    user.avatar = avatarUrl;
                    
                    // Обновляем аватарку во всех сообщениях пользователя
                    await Message.updateMany(
                        { username: user.username },
                        { $set: { avatar: avatarUrl } }
                    );
                } catch (avatarError) {
                    console.error("Ошибка при обновлении аватарки:", avatarError);
                    return res.status(500).send("Ошибка обработки аватарки");
                }
            }

            await user.save();

            // Обновляем токен с новым именем пользователя
            const token = jwt.sign(
                { username: user.username },
                "your_secret_key",
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                token,
                user: {
                    username: user.username,
                    avatar: user.avatar,
                },
            });
        } catch (error) {
            console.error("Ошибка при обновлении профиля:", error);
            res.status(500).send("Ошибка сервера при обновлении профиля");
        }
    },
);

// Получение информации о пользователе
app.get("/user/:username", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).send("Пользователь не найден");
        }

        res.json({
            username: user.username,
            avatar: user.avatar,
        });
    } catch (error) {
        res.status(500).send("Ошибка сервера");
    }
});

// Socket.IO с аутентификацией
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Токен не предоставлен"));
    jwt.verify(token, "your_secret_key", (err, user) => {
        if (err) return next(new Error("Неверный токен"));
        socket.user = user;
        next();
    });
});

// Обработка событий Socket.IO
io.on("connection", async (socket) => {
    console.log(`Пользователь ${socket.user.username} подключился`);

    // Получаем информацию о пользователе при подключении
    const user = await User.findOne({ username: socket.user.username });
    const avatar = user ? user.avatar : null;

    // Уведомляем других пользователей о подключении
    socket.broadcast.emit("user connected", { username: socket.user.username });

    socket.on("chat message", async (data) => {
        const { text, fileUrl, fileType } = data;
        // Сохраняем сообщение с аватаркой
        const message = new Message({
            username: socket.user.username,
            text,
            fileUrl,
            fileType,
            avatar,
        });
        await message.save();

        // Отправляем сообщение всем пользователям с аватаркой
        io.emit("chat message", {
            _id: message._id, // Добавляем ID сообщения
            username: socket.user.username,
            text,
            fileUrl,
            fileType,
            avatar,
            timestamp: message.timestamp,
        });
    });
    
    // Обработка удаления сообщения
    socket.on("delete message", async (data) => {
        try {
            const message = await Message.findById(data.id);
            
            if (!message) {
                socket.emit("error", { message: "Сообщение не найдено" });
                return;
            }
            
            // Проверяем, что пользователь является автором сообщения
            if (message.username !== socket.user.username) {
                socket.emit("error", { message: "Нет прав для удаления этого сообщения" });
                return;
            }
            
            // Удаляем сообщение из базы данных
            const deleteResult = await Message.findByIdAndDelete(data.id);
            
            if (!deleteResult) {
                socket.emit("error", { message: "Ошибка при удалении сообщения из базы данных" });
                return;
            }
            
            console.log(`Сообщение ${data.id} успешно удалено из базы данных`);
            
            // Уведомляем всех пользователей об удалении сообщения
            io.emit("message deleted", { id: data.id });
        } catch (error) {
            console.error("Ошибка при удалении сообщения:", error);
            socket.emit("error", { message: "Ошибка при удалении сообщения" });
        }
    });
    
    // Обработка редактирования сообщения
    socket.on("edit message", async (data) => {
        try {
            const message = await Message.findById(data.id);
            
            if (!message) {
                socket.emit("error", { message: "Сообщение не найдено" });
                return;
            }
            
            // Проверяем, что пользователь является автором сообщения
            if (message.username !== socket.user.username) {
                socket.emit("error", { message: "Нет прав для редактирования этого сообщения" });
                return;
            }
            
            // Обновляем текст сообщения и устанавливаем флаг редактирования
            message.text = data.text;
            message.edited = true;
            
            // Сохраняем изменения в базе данных
            const updatedMessage = await message.save();
            
            if (!updatedMessage) {
                socket.emit("error", { message: "Ошибка при сохранении изменений в базе данных" });
                return;
            }
            
            console.log(`Сообщение ${data.id} успешно отредактировано в базе данных`);
            
            // Уведомляем всех пользователей о редактировании сообщения
            io.emit("message edited", { 
                id: data.id, 
                text: data.text, 
                edited: true 
            });
        } catch (error) {
            console.error("Ошибка при редактировании сообщения:", error);
            socket.emit("error", { message: "Ошибка при редактировании сообщения" });
        }
    });

    socket.on("profile updated", async (data) => {
        // Получаем обновленные данные пользователя
        const user = await User.findOne({ username: socket.user.username });
        if (user) {
            // Оповещаем всех об обновлении профиля
            io.emit("user profile updated", {
                oldUsername: data.oldUsername,
                newUsername: user.username,
                avatar: user.avatar || '/uploads/default-avatar.png',
            });
            
            // Обновляем аватарку в сокете пользователя
            socket.avatar = user.avatar || '/uploads/default-avatar.png';
        }
    });

    socket.on("disconnect", () => {
        console.log(`Пользователь ${socket.user.username} отключился`);
        socket.broadcast.emit("user disconnected", {
            username: socket.user.username,
        });
    });
});

// Создание папки uploads, если её нет
const fs = require("fs");
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
