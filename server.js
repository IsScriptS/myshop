const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ========== БАЗА ДАННЫХ (в памяти) ==========
const db = {
    users: [
        { id: 1, name: 'Продавец Roblox' },
        { id: 2, name: 'Покупатель' }
    ],
    products: [
        {
            id: 1,
            name: 'Админка в Blox Fruits',
            description: 'Полный доступ к админ-панели, все фрукты, деньги и титулы.',
            game: 'Blox Fruits',
            price: 2500,
            image: 'https://tr.rbxcdn.com/30DAY-Avatar-1D108468C9B8B231FF09F9D9F80CBF1B-Png/420/420/Avatar/Png/',
            sellerId: 1,
            createdAt: Date.now()
        },
        {
            id: 2,
            name: 'Легендарный меч в King Legacy',
            description: 'Самый мощный меч в игре. Полный набор скиллов.',
            game: 'King Legacy',
            price: 1800,
            image: 'https://tr.rbxcdn.com/30DAY-Avatar-8A1D17B9C2D8E3F4A5B6C7D8E9F0A1B2-Png/420/420/Avatar/Png/',
            sellerId: 1,
            createdAt: Date.now()
        },
        {
            id: 3,
            name: 'Фрукт Дракона в Anime Adventures',
            description: 'Редчайший фрукт для прокачки. Даёт +1000 к силе.',
            game: 'Anime Adventures',
            price: 3200,
            image: 'https://tr.rbxcdn.com/30DAY-Avatar-2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F-Png/420/420/Avatar/Png/',
            sellerId: 1,
            createdAt: Date.now()
        }
    ],
    balances: {
        '1': 5000,
        '2': 1000
    },
    chats: [],
    reviews: [
        {
            id: 1,
            productId: 1,
            author: 'Игрок_228',
            rating: 5,
            text: 'Отличный товар! Всё работает!'
        },
        {
            id: 2,
            productId: 1,
            author: 'ProGamer',
            rating: 4,
            text: 'Хорошо, но немного дорого.'
        }
    ]
};

// ========== API ЭНДПОИНТЫ ==========

// 1. Получить все товары
app.get('/api/products', (req, res) => {
    res.json(db.products);
});

// 2. Получить товар по ID
app.get('/api/products/:id', (req, res) => {
    const product = db.products.find(p => p.id == req.params.id);
    if (!product) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    
    const seller = db.users.find(u => u.id === product.sellerId);
    const reviews = db.reviews.filter(r => r.productId == product.id);
    
    res.json({ ...product, seller, reviews });
});

// 3. Создать товар
app.post('/api/products', (req, res) => {
    const { name, description, game, price, image, sellerId } = req.body;
    
    const newProduct = {
        id: Date.now(),
        name,
        description: description || 'Описание отсутствует',
        game: game || 'Roblox',
        price: parseFloat(price),
        image: image || 'https://via.placeholder.com/300x200?text=Roblox+Item',
        sellerId: parseInt(sellerId),
        createdAt: Date.now()
    };
    
    db.products.push(newProduct);
    res.json(newProduct);
});

// 4. Редактировать товар
app.put('/api/products/:id', (req, res) => {
    const { name, description, game, price, image } = req.body;
    const index = db.products.findIndex(p => p.id == req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    
    db.products[index] = {
        ...db.products[index],
        name: name || db.products[index].name,
        description: description || db.products[index].description,
        game: game || db.products[index].game,
        price: parseFloat(price) || db.products[index].price,
        image: image || db.products[index].image
    };
    
    res.json(db.products[index]);
});

// 5. Удалить товар
app.delete('/api/products/:id', (req, res) => {
    const index = db.products.findIndex(p => p.id == req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    
    db.products.splice(index, 1);
    res.json({ success: true });
});

// 6. Получить баланс
app.get('/api/balance/:userId', (req, res) => {
    const userId = req.params.userId;
    const balance = db.balances[userId] || 0;
    res.json({ balance });
});

// 7. Пополнить баланс
app.post('/api/balance', (req, res) => {
    const { userId, amount } = req.body;
    if (!db.balances[userId]) db.balances[userId] = 0;
    db.balances[userId] += parseFloat(amount);
    res.json({ balance: db.balances[userId] });
});

// 8. Купить товар
app.post('/api/buy', (req, res) => {
    const { productId, buyerId } = req.body;
    
    const product = db.products.find(p => p.id == productId);
    if (!product) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    
    const sellerId = product.sellerId;
    const price = product.price;
    
    // Проверяем баланс
    const buyerBalance = db.balances[buyerId] || 0;
    if (buyerBalance < price) {
        return res.status(400).json({ error: 'Недостаточно средств' });
    }
    
    // Списываем и начисляем
    db.balances[buyerId] = buyerBalance - price;
    db.balances[sellerId] = (db.balances[sellerId] || 0) + price;
    
    // Создаём чат
    const existingChat = db.chats.find(c => 
        (c.buyerId == buyerId && c.sellerId == sellerId) ||
        (c.buyerId == sellerId && c.sellerId == buyerId)
    );
    
    let chatId;
    if (!existingChat) {
        const newChat = {
            id: Date.now(),
            buyerId: parseInt(buyerId),
            sellerId: parseInt(sellerId),
            productId: productId,
            messages: []
        };
        db.chats.push(newChat);
        chatId = newChat.id;
    } else {
        chatId = existingChat.id;
    }
    
    // Отправляем уведомление через Socket
    io.emit('new_purchase', { 
        productId, 
        buyerId, 
        sellerId, 
        chatId,
        productName: product.name
    });
    
    res.json({ 
        success: true, 
        chatId, 
        newBalance: db.balances[buyerId] 
    });
});

// 9. Получить чаты пользователя
app.get('/api/chats/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userChats = db.chats.filter(c => 
        c.buyerId === userId || c.sellerId === userId
    );
    
    const enriched = userChats.map(chat => {
        const isBuyer = chat.buyerId === userId;
        const otherId = isBuyer ? chat.sellerId : chat.buyerId;
        const otherUser = db.users.find(u => u.id === otherId);
        const product = db.products.find(p => p.id === chat.productId);
        return { 
            ...chat, 
            otherUser: otherUser || { id: otherId, name: 'Пользователь' },
            product: product || { name: 'Товар удалён' }
        };
    });
    
    res.json(enriched);
});

// 10. Получить сообщения чата
app.get('/api/chats/:chatId/messages', (req, res) => {
    const chat = db.chats.find(c => c.id == req.params.chatId);
    if (!chat) {
        return res.status(404).json({ error: 'Чат не найден' });
    }
    res.json(chat.messages || []);
});

// ========== WEBSOCKET (ЧАТ В РЕАЛЬНОМ ВРЕМЕНИ) ==========
io.on('connection', (socket) => {
    console.log('🔌 Клиент подключился:', socket.id);
    
    socket.on('join_chat', (chatId) => {
        socket.join(`chat_${chatId}`);
        console.log(`📩 Присоединился к чату ${chatId}`);
    });
    
    socket.on('send_message', async (data) => {
        const { chatId, userId, text, image } = data;
        
        const chat = db.chats.find(c => c.id == chatId);
        if (!chat) return;
        
        const newMessage = {
            id: Date.now(),
            userId: parseInt(userId),
            text: text || '',
            image: image || null,
            time: new Date().toISOString()
        };
        
        chat.messages.push(newMessage);
        
        io.to(`chat_${chatId}`).emit('new_message', {
            chatId,
            message: newMessage
        });
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Клиент отключился:', socket.id);
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========
const PORT = 3000;
server.listen(PORT, () => {
    console.log('\n=================================');
    console.log('🎮 Roblox Market запущен!');
    console.log(`📡 Сервер: http://localhost:${PORT}`);
    console.log(`👤 Тестовые пользователи:`);
    console.log(`   - Продавец (ID: 1) - баланс: ${db.balances['1']} R$`);
    console.log(`   - Покупатель (ID: 2) - баланс: ${db.balances['2']} R$`);
    console.log('=================================\n');
});
