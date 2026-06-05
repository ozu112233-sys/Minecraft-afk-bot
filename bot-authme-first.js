const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const http = require('http'); // RENDER KAPANMASIN DIYE EKLENDI

// Configuration - Edit these values for your server
const config = {
  server: {
    host: 'Patatees.aternos.me', // Sunucu IP adresin
    port: 61243,                // Güncel Aternos Portun
    version: '1.20.1'           // Sunucu sürümün
  },
  bot: {
    username: 'ilk_bot15',        // Botunun adı
    auth: 'offline', 
    password: '', 
    authmePassword: 'SifreniziBurayaYazin' // Sunucuda kayıt/giriş yaparken kullanılacak şifre
  },
  serverCommands: {
    enabled: true,
    joinServer: '/server survival', // AuthMe sonrası lobi varsa survival'a geçiş komutu
    delay: 3000 
  },
  features: {
    autoReconnect: {
      enabled: true,
      delay: 5000
    },
    movement: {
      enabled: false, // Eğer botun doğduğu yerde kalmasını istiyorsan false yap, belirli koordinata gitsin dersen true yapıp altı doldur
      coordinates: {
        x: 0, 
        y: 64,
        z: 0
      }
    },
    antiAFK: {
      enabled: true,
      jump: true,      // Zıplama aktif
      sneak: true,     // Eğilip kalkma aktif (daha gerçekçi durur)
      look: true,      // Etrafa bakınma aktif
      interval: 4000   // 4 saniyede bir bu hareketleri tekrarlar (AFK kalmaz)
    },
    chatMessages: {
      enabled: false,
      interval: 300000, 
      messages: [
        'Still here!',
        'AFK farming...',
        'Bot is active'
      ]
    },
    chatLog: {
      enabled: true
    }
  }
};

// -------------------------------------------------------------
// RENDER PORT KİLİDİNİ ÇÖZEN WEB SERVER (Kritik Alan)
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot 7/24 Aktif Durumda!\n');
});
const WEB_PORT = process.env.PORT || 3000;
server.listen(WEB_PORT, () => {
    console.log(`📡 Web sunucusu ${WEB_PORT} portunda baslatildi. Render artik botu durdurmayacak.`);
});
// -------------------------------------------------------------

let bot;
let isAuthenticated = false;
let loginAttempts = 0;
let serverJoined = false;
let authmeCompleted = false;
const maxLoginAttempts = 3;

function createBot() {
  console.log('🤖 Creating bot...');
  
  const botOptions = {
    host: config.server.host,
    port: config.server.port,
    username: config.bot.username,
    version: config.server.version,
    hideErrors: false
  };

  if (config.bot.auth === 'microsoft') {
    botOptions.auth = 'microsoft';
  } else if (config.bot.auth === 'mojang' && config.bot.password) {
    botOptions.password = config.bot.password;
    botOptions.auth = 'mojang';
  } else {
    botOptions.auth = 'offline';
  }

  bot = mineflayer.createBot(botOptions);

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`✅ Bot ${bot.username} successfully joined the server!`);
    
    isAuthenticated = false;
    loginAttempts = 0;
    serverJoined = false;
    authmeCompleted = false;
    
    try {
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);
    } catch (e) {
      console.log('🗺️ Sürüm verisi yüklenirken küçük bir uyarı alındı, devam ediliyor...');
    }

    console.log('📋 Step 1: Starting AuthMe authentication...');
    setTimeout(() => {
      attemptAuthMeLogin();
    }, 3000);
  });

  bot.on('chat', (username, message, translate, jsonMsg, matches) => {
    if (config.features.chatLog.enabled && username !== bot.username) {
      console.log(`💬 [${username}] ${message}`);
    }

    if (username === bot.username) return;

    const lowerMessage = message.toLowerCase();
    
    if (serverJoined && lowerMessage.includes('survival') && 
        (lowerMessage.includes('joined') || lowerMessage.includes('connected') || lowerMessage.includes('welcome'))) {
      console.log('🌍 Successfully joined survival server!');
      console.log('📋 Step 3: Starting bot activities...');
      setTimeout(startBotActivities, 2000);
    }
    
    if ((lowerMessage.includes('register') || lowerMessage.includes('registration')) && 
        (lowerMessage.includes('password') || lowerMessage.includes('/register') || lowerMessage.includes('command'))) {
      console.log('🔐 Registration required detected');
      setTimeout(() => {
        const password = config.bot.authmePassword;
        bot.chat(`/register ${password} ${password}`);
        console.log('📝 Sent registration command');
      }, 1500);
    }
    
    else if ((lowerMessage.includes('login') || lowerMessage.includes('log in')) && 
             (lowerMessage.includes('password') || lowerMessage.includes('/login') || lowerMessage.includes('command'))) {
      console.log('🔑 Login required detected');
      setTimeout(() => {
        bot.chat(`/login ${config.bot.authmePassword}`);
        console.log('🔓 Sent login command');
        loginAttempts++;
      }, 1500);
    }
    
    else if ((lowerMessage.includes('successfully') || lowerMessage.includes('welcome') || lowerMessage.includes('logged')) && 
             (lowerMessage.includes('logged') || lowerMessage.includes('registered') || lowerMessage.includes('authenticated'))) {
      console.log('✅ AuthMe authentication successful!');
      isAuthenticated = true;
      authmeCompleted = true;
      
      if (config.serverCommands.enabled && config.serverCommands.joinServer) {
        console.log('📋 Step 2: AuthMe completed, now joining survival server...');
        setTimeout(() => {
          joinSpecificServer();
        }, config.serverCommands.delay);
      } else {
        setTimeout(startBotActivities, 2000);
      }
    }
    
    else if (lowerMessage.includes('wrong password') || 
             lowerMessage.includes('incorrect password') || 
             lowerMessage.includes('invalid password')) {
      console.log('❌ AuthMe login failed - wrong password');
      if (loginAttempts < maxLoginAttempts) {
        console.log(`🔄 Retrying login (${loginAttempts}/${maxLoginAttempts})...`);
        setTimeout(() => {
          bot.chat(`/login ${config.bot.authmePassword}`);
          loginAttempts++;
        }, 3000);
      } else {
        console.log('🚫 Max login attempts reached');
      }
    }
    
    else if (lowerMessage.includes('timeout') || 
             (lowerMessage.includes('time') && lowerMessage.includes('up')) ||
             lowerMessage.includes('too slow')) {
      console.log('⏰ AuthMe timeout detected');
      if (!authmeCompleted) {
        setTimeout(attemptAuthMeLogin, 2000);
      }
    }

    else if (lowerMessage.includes('already') && lowerMessage.includes('registered')) {
      console.log('ℹ️ Already registered, attempting login...');
      setTimeout(() => {
        bot.chat(`/login ${config.bot.authmePassword}`);
        console.log('🔓 Sent login command after registration notice');
      }, 1500);
    }

    else if (lowerMessage.includes('not authenticated') || lowerMessage.includes('please login')) {
      console.log('⚠️ Authentication required message detected');
      if (!authmeCompleted) {
        setTimeout(attemptAuthMeLogin, 1000);
      }
    }
  });

  bot.on('error', (err) => {
    console.error('❌ Bot error:', err.message);
  });

  bot.on('kicked', (reason) => {
    console.log('⚠️ Bot was kicked:', reason);
    if (config.features.autoReconnect.enabled) {
      console.log(`🔄 Reconnecting in ${config.features.autoReconnect.delay / 1000} seconds...`);
      setTimeout(createBot, config.features.autoReconnect.delay);
    }
  });

  bot.on('end', () => {
    console.log('🔌 Bot disconnected from server');
    if (config.features.autoReconnect.enabled) {
      console.log(`🔄 Reconnecting in ${config.features.autoReconnect.delay / 1000} seconds...`);
      setTimeout(createBot, config.features.autoReconnect.delay);
    }
  });

  bot.on('death', () => {
    console.log('💀 Bot died and respawned');
    setTimeout(() => {
      if (authmeCompleted && serverJoined) {
        startBotActivities();
      } else if (authmeCompleted && !serverJoined) {
        joinSpecificServer();
      } else {
        attemptAuthMeLogin();
      }
    }, 3000);
  });

  bot.on('goal_reached', () => {
    console.log('🎯 Reached target location!');
  });

  bot.on('path_update', (r) => {
    if (r && r.visitedNodes && r.time) {
      const nodesPerTick = (r.visitedNodes * 50 / r.time).toFixed(2);
      console.log(`🗺️ Pathfinding: ${r.visitedNodes} nodes, ${nodesPerTick} nodes/s, ${r.time.toFixed(2)} ms`);
    }
  });

  return bot;
}

function joinSpecificServer() {
  console.log(`🌍 Now joining survival server with: ${config.serverCommands.joinServer}`);
  bot.chat(config.serverCommands.joinServer);
  serverJoined = true;

  setTimeout(() => {
    if (authmeCompleted && !serverJoined) {
      console.log('⚠️ No server join confirmation, starting activities anyway...');
      startBotActivities();
    }
  }, 10000);
}

function attemptAuthMeLogin() {
  if (authmeCompleted) return;

  console.log('🔐 Attempting AuthMe authentication...');
  
  setTimeout(() => {
    const password = config.bot.authmePassword;
    bot.chat(`/register ${password} ${password}`);
  }, 2000);
  
  setTimeout(() => {
    bot.chat(`/login ${config.bot.authmePassword}`);
    loginAttempts++;
  }, 4000);
  
  setTimeout(() => {
    if (!authmeCompleted) {
      console.log('⚠️ No AuthMe response, proceeding to activities...');
      isAuthenticated = true;
      authmeCompleted = true;
      
      if (config.serverCommands.enabled && config.serverCommands.joinServer) {
        setTimeout(() => { joinSpecificServer(); }, config.serverCommands.delay);
      } else {
        startBotActivities();
      }
    }
  }, 15000);
}

function startBotActivities() {
  if (!authmeCompleted) return;
  
  console.log('🎮 Starting bot activities on survival server...');
  
  if (config.features.movement.enabled) {
    const { x, y, z } = config.features.movement.coordinates;
    console.log(`🚶 Moving to coordinates: ${x}, ${y}, ${z}`);
    try {
      const goal = new goals.GoalBlock(x, y, z);
      bot.pathfinder.setGoal(goal);
    } catch (error) {
      console.log('⚠️ Pathfinding error:', error.message);
    }
  }

  if (config.features.antiAFK.enabled) {
    console.log('🎯 Starting anti-AFK activities');
    startAntiAFK();
  }

  if (config.features.chatMessages.enabled) {
    startChatMessages();
  }
}

function startAntiAFK() {
  const antiAfkConfig = config.features.antiAFK;
  
  setInterval(() => {
    if (!bot || !bot._client || bot._client.state !== 'play') return;
    
    try {
      if (antiAfkConfig.jump) {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot && bot.setControlState) bot.setControlState('jump', false);
        }, 300);
      }
      
      if (antiAfkConfig.sneak) {
        bot.setControlState('sneak', true);
        setTimeout(() => {
          if (bot && bot.setControlState) bot.setControlState('sneak', false);
        }, 300);
      }
      
      if (antiAfkConfig.look) {
        const yaw = (Math.random() - 0.5) * Math.PI;
        const pitch = (Math.random() - 0.5) * Math.PI / 2;
        bot.look(yaw, pitch);
      }
      
      console.log('🔄 Anti-AFK actions performed (Jump/Sneak/Look)');
    } catch (error) {
      console.log('⚠️ Anti-AFK error:', error.message);
    }
  // Süreyi config'den (yani 4 saniyeden) alıyor
  }, antiAfkConfig.interval);
}

function startChatMessages() {
  const chatConfig = config.features.chatMessages;
  let messageIndex = 0;
  
  setInterval(() => {
    if (!bot || !bot._client || bot._client.state !== 'play') return;
    try {
      if (chatConfig.messages.length > 0 && authmeCompleted) {
        bot.chat(chatConfig.messages[messageIndex]);
        messageIndex = (messageIndex + 1) % chatConfig.messages.length;
      }
    } catch (error) {
      console.log('⚠️ Chat error:', error.message);
    }
  }, chatConfig.interval);
}

createBot();

// Kapatma sinyalleri yönetimi
process.on('SIGINT', () => { if (bot) bot.quit(); process.exit(0); });
process.on('SIGTERM', () => { if (bot) bot.quit(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message);
  setTimeout(createBot, 5000);
});
