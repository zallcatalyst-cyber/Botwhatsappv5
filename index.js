const { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fetch = require('node-fetch');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function downloadMedia(message, messageType) {
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    // LOGO 3D VERSI MINI (PAS UNTUK LAYAR HP / TERMUX)
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log("\x1b[36m%s\x1b[0m", " ______  __  __ __  __       ______ __  __ ____  ______ ____  ");
        console.log("\x1b[36m%s\x1b[0m", "╚═  ══╝ ╚████╔╝╚████╔╝      ██╔════╝╚████╔╝██╔═██╗██╔═══╝██╔═██╗");
        console.log("\x1b[34m%s\x1b[0m", "  ██╔══╝  ╚██╔╝  ╚██╔╝ ████╗██║      ╚██╔╝ ██████╔╝█████╗ ██████╔╝");
        console.log("\x1b[34m%s\x1b[0m", " ██║████╗  ██║    ██║  ╚═══╝██║       ██║  ██╔══██╗██╔══╝ ██╔══██╗");
        console.log("\x1b[35m%s\x1b[0m", " ██████╔╝  ██║    ██║       ╚██████╗  ██║  ██████╔╝█████████║  ██║");
        console.log("\x1b[35m%s\x1b[0m", " ╚═════╝   ╚═╝    ╚═╝        ╚═════╝  ╚═╝  ╚═════╝ ╚══════╚═╝  ╚═╝");
        console.log("\x1b[33m%s\x1b[0m", "===============================================================");
        console.log("\x1b[32m%s\x1b[0m", " 🌐 TikTok    : @zyyzall");
        console.log("\x1b[32m%s\x1b[0m", " 📸 Instagram : @abcdeezall");
        console.log("\x1b[33m%s\x1b[0m", "===============================================================");
        console.log("");
        
        const phoneNumber = await question('\x1b[37m[?] Masukkan Nomor WhatsApp Bot Anda (Contoh: 62812345678): \x1b[0m');
        const code = await sock.requestPairingCode(phoneNumber.trim());
        
        console.log("\x1b[33m%s\x1b[0m", "\n---------------------------------------------------------");
        console.log(` \x1b[42m\x1b[30m KODE PAIRING ANDA :  ${code}  \x1b[0m`);
        console.log("\x1b[33m%s\x1b[0m", "---------------------------------------------------------");
        console.log("\x1b[36m%s\x1b[0m", "[i] Buka WhatsApp -> Perangkat Tertaut -> Tautkan dengan Kode Telepon.\n");
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[-] Koneksi terputus. Menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.clear();
            console.log("\x1b[32m%s\x1b[0m", "===============================================");
            console.log("\x1b[32m%s\x1b[0m", "   ⚡ BOT ZYY-CYBER BERHASIL TERHUBUNG! ⚡     ");
            console.log("\x1b[32m%s\x1b[0m", "===============================================");
            console.log("[i] Ketik .menu di WhatsApp untuk melihat daftar fitur.");
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;

        const from = m.key.remoteJid;
        const msgType = Object.keys(m.message)[0];
        const msgContent = m.message[msgType];

        let body = '';
        if (msgType === 'conversation') {
            body = m.message.conversation;
        } else if (msgType === 'extendedTextMessage') {
            body = m.message.extendedTextMessage.text;
        } else if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            body = msgContent.caption;
        } else if (m.message.buttonsResponseMessage) {
            body = m.message.buttonsResponseMessage.selectedButtonId;
        } else if (m.message.templateButtonReplyMessage) {
            body = m.message.templateButtonReplyMessage.selectedId;
        } else if (m.message.listResponseMessage) {
            body = m.message.listResponseMessage.singleSelectReply.selectedRowId;
        }

        if (!body) return;

        const prefix = /^[./!#]/gi.test(body) ? body.match(/^[./!#]/gi)[0] : '#';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(' ');

        const quoted = msgType === 'extendedTextMessage' && m.message.extendedTextMessage.contextInfo ? m.message.extendedTextMessage.contextInfo : null;
        const quotedText = quoted && quoted.quotedMessage ? (quoted.quotedMessage.conversation || quoted.quotedMessage.extendedTextMessage?.text) : null;

        const react = async (emoji) => {
            await sock.sendMessage(from, { react: { text: emoji, key: m.key } });
        };

        // --- TAMBAHAN LOG PESAN DENGAN EMOJI BIAR KEREN ---
        const sender = from.split('@')[0];
        if (isCmd) {
            console.log(`\x1b[35m🔥 [COMMAND]\x1b[0m User: \x1b[33m${sender}\x1b[0m | Executed: \x1b[36m${prefix}${command}\x1b[0m`);
        } else {
            console.log(`\x1b[32m💬 [INCOMING]\x1b[0m User: \x1b[33m${sender}\x1b[0m | Message: ${body}`);
        }

        switch (command) {
            case 'menu':
            case 'help': {
                await react('👋');
                
                const hari = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
                const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                let menuText = `*⚡ ZYY-CYBER MULTI-DEVICE BOT ⚡*\n\n`
                menuText += `┌ 📅 *INFO SYSTEM*\n`
                menuText += `│ • *Owner:* ZYY-CYBER\n`
                menuText += `│ • *Hari:* ${hari}\n`
                menuText += `│ • *Tanggal:* ${tanggal}\n`
                menuText += `│ • *Waktu:* ${waktu}\n`
                menuText += `└ • *Prefix:* [ ${prefix} ]\n\n`
                
                menuText += `┌ 🎨 *STICKER MENU*\n`
                menuText += `│ • *${prefix}s* / *${prefix}sticker*\n`
                menuText += `│   _(Reply foto/video untuk jadi stiker)_\n`
                menuText += `│ • *${prefix}brat <teks>*\n`
                menuText += `│   _(Stiker teks ala brat web)_\n`
                menuText += `│ • *${prefix}brathd <teks>*\n`
                menuText += `│   _(Stiker teks brat versi HD)_\n`
                menuText += `└─────────────────────\n\n`
                
                menuText += `┌ 📱 *SOSIAL MEDIA*\n`
                menuText += `│ • *TikTok:* @zyyzall\n`
                menuText += `│ • *Instagram:* @abcdeezall\n`
                menuText += `└─────────────────────\n\n`
                
                menuText += `_💡 Petunjuk: Balas media dengan mengetik *.s* untuk konversi stiker secara instan._`

                await sock.sendMessage(from, { text: menuText }, { quoted: m });
                break;
            }

            case 'brat': {
                let shortcut = quotedText ? quotedText : text;
                if (!shortcut) return sock.sendMessage(from, { text: `Penggunaan salah! Contoh: ${prefix}brat halo` }, { quoted: m });

                try {
                    await react('🕒');
                    const responseUrl = `https://aqul-brat.hf.space?text=${encodeURIComponent(shortcut)}`;
                    const res = await fetch(responseUrl);
                    const buffer = await res.buffer();
                    
                    await sock.sendMessage(from, { sticker: buffer }, { quoted: m });
                    await react('✅');
                } catch (e) {
                    await react('❌');
                    console.error(e);
                }
                break;
            }

            case 'brathd': {
                let shortcut = quotedText ? quotedText : text;
                if (!shortcut) return sock.sendMessage(from, { text: `Penggunaan salah! Contoh: ${prefix}brathd halo` }, { quoted: m });

                try {
                    await react('🕒');
                    const responseUrl = `https://api-faa.my.id/faa/brathd?text=${encodeURIComponent(shortcut)}`;
                    const res = await fetch(responseUrl);
                    const buffer = await res.buffer();
                    
                    await sock.sendMessage(from, { sticker: buffer }, { quoted: m });
                    await react('✅');
                } catch (e) {
                    await react('❌');
                    console.error(e);
                }
                break;
            }

            case 's':
            case 'stiker':
            case 'sticker': {
                let isMedia = /image|video|webp/.test(msgType);
                let isQuotedMedia = quoted && quoted.quotedMessage && /imageMessage|videoMessage|webpMessage/.test(Object.keys(quoted.quotedMessage)[0]);

                if (isMedia || isQuotedMedia) {
                    try {
                        await react('🕒');
                        let targetMessage = isMedia ? m.message : quoted.quotedMessage;
                        let targetType = isMedia ? msgType : Object.keys(quoted.quotedMessage)[0];
                        let mediaMessage = targetMessage[targetType];

                        if (targetType === 'videoMessage' && (mediaMessage.seconds > 10)) {
                            return sock.sendMessage(from, { text: 'Durasi video terlalu panjang! Maksimal 10 detik.' }, { quoted: m });
                        }

                        let mediaBuffer = await downloadMedia(mediaMessage, targetType.replace('Message', ''));
                        
                        await sock.sendMessage(from, { sticker: mediaBuffer }, { quoted: m });
                        await react('✅');
                    } catch (e) {
                        await react('❌');
                        console.error(e);
                    }
                } else {
                    sock.sendMessage(from, { text: `Kirim atau reply foto/video dengan ketik *${prefix}s*` }, { quoted: m });
                }
                break;
            }
        }
    });
}

startBot();
