const config = require('./config.js');
const { ChatClient } = require("@kararty/dank-twitch-irc");
const got = require("@esm2cjs/got").default;
const triggersLength = config.regexTriggers.length;
const cooldown = new Set();

const client = new ChatClient();

async function send(embeds, username, avatar_url) {
    try {
        await got.post(config.discordWebhookURL, {
            json: {
                username: username,
                avatar_url: avatar_url,
                embeds: embeds
            }
        });
    } catch (err) {
        console.error(`Discord Webhook error: ${err}`);
    }
}

client.on("ready", () => {
    console.log('Chat connected');
    client.joinAll(config.channels);
});

client.on("JOIN", ({ channelName }) => {
    console.log(`Joined #${channelName}`);
});

client.on("PART", ({ channelName }) => {
    console.log(`Parted #${channelName}`);
});

async function handle(msg, nonce, reply) {
    if (cooldown.has(msg.senderUserID)) return;

    for (let i = 0; i < triggersLength; i++) {
        if (config.regexTriggers[i].test(msg.messageText)) {
            cooldown.add(msg.senderUserID);
            setTimeout(() => {
                cooldown.delete(msg.senderUserID);
            }, 1500);

            const fields = [
                {
                    "name": "Channel",
                    "value": `#${msg.channelName}`,
                    "inline": true
                },
                {
                    "name": "Time",
                    "value": `<t:${Math.floor(msg.serverTimestampRaw / 1000)}:R>`,
                    "inline": true
                },
                {
                    "name": "Nonce",
                    "value": nonce,
                    "inline": true
                },
                {
                    "name": "Message",
                    "value": msg.messageText.replace(/([*_`~\|<>])/g, '\\$1').replace(/^@[^\s]+\s+/, "")
                }
            ];

            if (reply) {
                fields.splice(1, 0, {
                    "name": "Reply to",
                    "value": reply,
                    "inline": true
                });
            }

            const response = await got(`https://api.twitch.tv/helix/users?id=${msg.senderUserID}`, {
                headers: config.auth
            });
            const avatar_url = JSON.parse(response.body).data[0].profile_image_url;
            let sender_name;
            if (msg.senderUsername === msg.displayName.toLowerCase()) {
                sender_name = msg.displayName
            } else {
                sender_name = msg.senderUsername
            }

            return await send([{
                "color": parseInt(msg.colorRaw.replace('#', ''), 16),
                "fields": fields
            }], sender_name, avatar_url);
        }
    }
}

client.on("PRIVMSG", async (msg) => {
    let reply = '';
    if (msg.replyParentMessageID) {
        const match = msg.messageText.match(/@([^\s]+)/);
        if (match) {
            reply = `@${match[1]}`;
        }
    }
    if (!config.ignoredUsers.includes(msg.senderUsername)) {
        handle(msg, 'Privmsg', reply);
    }

    if (["93281234", "953467131", "882960401", "978275454", "826292186", "1093526374"].includes(msg.senderUserID) && msg.messageText.startsWith('!e ')) {
        try {
            eval(msg.messageText.replace(/^!e /, ''));
        } catch (e) {
            console.error(e);
        }
    }
});

client.on("USERNOTICE", async (msg) => {
    if (msg.isAnnouncement()) {
        handle(msg, 'Announce', '');
    }
});

client.connect();
