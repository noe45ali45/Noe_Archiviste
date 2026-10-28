const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const pino = require('pino');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { exec } = require('child_process');
const logger = require('./utils/console');

const question = text => new Promise(resolve => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(text, answer => {
        rl.close();
        resolve(answer);
    });
});

// 🎵 ASCII Art بعد التعديل
const asciiArt = `
${chalk.blue.bold('ᦷִ᳝݁֔ ֶָ֢֪⏤͟͟͞͞𝐈 𝐊𝐄𝐏𝐓 𝐄𝐕𝐄𝐑𝐘𝐓𝐇𝐈𝐍 𝐈𝐍𝐒𝐈𝐃𝐄, 𝐔𝐍𝐓𝐈𝐋 𝐈𝐓 𝐒𝐓𝐀𝐑𝐓𝐄𝐃 𝐁𝐑𝐄𝐀𝐊𝐈𝐍𝐆 𝐌𝐄..⊹˚｡⋆')}
${chalk.hex('#8A2BE2').bold(`
 █████╗ ███╗   ██╗ ██████╗ ███████╗██╗     
██╔══██╗████╗  ██║██╔════╝ ██╔════╝██║     
███████║██╔██╗ ██║██║  ███╗█████╗  ██║     
██╔══██║██║╚██╗██║██║   ██║██╔══╝  ██║     
██║  ██║██║ ╚████║╚██████╔╝███████╗███████╗
╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝

ᝰᐟּ𝐀𝐍𝐆𝐄𝐋|🪶|𝐁𝐎𝐓⊹˚｡⋆ִׄ  ֶָ֢֪
`)}
`;

function playSound(name) {
    const controlPath = path.join(__dirname, 'sounds', 'sound.txt');
    const status = fs.existsSync(controlPath) ? fs.readFileSync(controlPath, 'utf-8').trim() : 'off';
    if (status !== '{on}') return;
    const filePath = path.join(__dirname, 'sounds', name);
    if (fs.existsSync(filePath)) exec(`mpv --no-terminal --really-quiet "${filePath}"`);
}

async function startBot() {
    try {
        console.clear();
        console.log(asciiArt);
        console.log(chalk.hex('#8A2BE2').bold('\nᝰᐟּ𝐀𝐍𝐆𝐄𝐋 𝐁𝐎𝐓 𝐈𝐒 𝐍𝐎𝐖 𝐑𝐔𝐍𝐍𝐈𝐍𝐆..!\n'));

        playSound('𝓐𝓻𝓬𝓱𝓲𝓿𝓲𝓼𝓽𝓑𝓸𝓽.mp3');

        const sessionDir = path.join(__dirname, 'ملف_الاتصال');
        await fs.ensureDir(sessionDir);

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['MacOs', 'Chrome', '1.0.0'],
            logger: pino({ level: 'silent' }),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true
        });

        // --- ⛈️ نظام رصد التفاعلات المدمج (ANGEL BOT EDITION) ---
        sock.ev.on('messages.reaction', async (reactions) => {
            try {
                for (const event of reactions) {
                    const chatId = event.key.remoteJid;
                    const reactionData = event.reaction;

                    if (!reactionData || !reactionData.text) continue;

                    const emojiReceived = reactionData.text;
                    const reactor = reactionData.key?.participant || reactionData.key?.remoteJid || chatId;

                    const deqPath = path.join(__dirname, 'plugins', 'deq_emoji.js');
                    if (fs.existsSync(deqPath)) {
                        const deq = require(deqPath);
                        if (deq.activeGames && deq.activeGames.has(chatId)) {
                            const game = deq.activeGames.get(chatId);

                            if (emojiReceived === game.emoji) {
                                const botId = sock.user.id.split(':')[0];
                                if (reactor.includes(botId)) continue;

                                await sock.sendMessage(chatId, { 
                                    text: `✅ كفو والله! @${reactor.split('@')[0]} هو الأسرع وفاز بالنقطة! ⛈️`,
                                    mentions: [reactor]
                                });
                                
                                deq.activeGames.delete(chatId);
                                console.log(chalk.green(`[ WIN ] فاز ${reactor} بالنقطة!`));
                            }
                        }
                    }

                    const { handleMessages } = require('./handlers/handler');
                    await handleMessages(sock, { reaction: event, isReaction: true });
                }
            } catch (err) {
                // خطأ صامت لمنع توقف البوت
            }
        });

        sock.ev.on('groups.upsert', async (groups) => {
            for (const group of groups) {
                try {
                    await sock.groupMetadata(group.id);
                    console.log(`[+] تم تحميل بيانات مجموعة: ${group.subject}`);
                } catch (err) {
                    console.warn(`[-] فشل في تحميل بيانات مجموعة: ${group.id}`);
                }
            }
        });

        // إعداد الربط
        if (!sock.authState.creds.registered) {
            console.log(chalk.bold('\n[ SETUP ] Please enter your phone number to receive the pairing code:'));
            console.log(chalk.dim('          (Type "#" to cancel)\n'));

            let phoneNumber = await question(chalk.bgHex('#FFD700').black(' Phone Number : '));
            if (phoneNumber.trim() === '#') process.exit();

            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!phoneNumber.match(/^\d{10,15}$/)) {
                console.log("\n[ ERROR ] Invalid phone number.\n");
                process.exit(1);
            }

            try {
                console.log(chalk.yellow('\n🔁 Fetching latest WhatsApp version...'));
                sock.version = version;
                const code = await sock.requestPairingCode(phoneNumber);
                console.log('\n────────── Pairing Information ──────────');
                console.log(chalk.greenBright(`Pairing Code: ${code}`));
                console.log(chalk.cyanBright(`Phone Number: ${phoneNumber}`));
                console.log('─────────────────────────────────────────\n');
            } catch (error) {
                console.log("\n[ ERROR ] Failed to get pairing code.\n");
                console.error(error);
                console.log(chalk.yellow('\n🧩 Trying QR method as backup...\n'));
                sock.printQRInTerminal = true;
            }
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'connecting') {
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'open') {
                logger.success(chalk.hex('#8A2BE2').bold(`CONNECTED! USER ID: ${sock.user.id}`));

                try {
                    const { addEliteNumber } = require('./haykala/elite');
                    const botNumber = sock.user.id.split(':')[0].replace(/[^0-9]/g, '');
                    const jid = `${botNumber}@s.whatsapp.net`;

                    const [info] = await sock.onWhatsApp(jid);
                    if (!info?.jid || !info?.lid) {
                        logger.error('تعذر الحصول على معلومات الجلسة من onWhatsApp');
                        return;
                    }

                    const lidNumber = info.lid.replace(/[^0-9]/g, '');

                    await addEliteNumber(botNumber);
                    await addEliteNumber(lidNumber);

                    logger.info(chalk.hex('#8A2BE2').bold(`ADDED ${botNumber} AND ${lidNumber} TO ELITE!`));
                } catch (e) {
                    logger.error('فشل في إضافة رقم الجلسة إلى النخبة:', e.message);
                }

                require('./handlers/handler').handleMessagesLoader();
                listenToConsole(sock);
            }

            if (connection === 'close') {
                const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
                logger.warn(`Disconnected: ${lastDisconnect?.error?.message || 'Unknown reason'}`);

                if (isLoggedOut) {
                    playSound('LOGGOUT.mp3');
                    logger.error(chalk.red.bold('You have been logged out.'));
                    process.exit(1);
                } else {
                    logger.info('Reconnecting...');
                    setTimeout(startBot, 3000);
                }
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const { handleMessages } = require('./handlers/handler');
                await handleMessages(sock, m);
            } catch (err) {
                logger.error('Error while handling message:', err);
                playSound('ERROR.mp3');
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        logger.error('Startup error:', err);
        playSound('ERROR.mp3');
        setTimeout(startBot, 3000);
    }
}

function listenToConsole(sock) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (line) => {
        console.log('[ CMD ] Unknown command.');
    });
}

startBot();
