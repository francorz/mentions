const config = require('./config.js');
const { ChatClient } = require("dank-twitch-irc");
const got = require('got');
const triggersLength = config.regexTriggers.length
const cooldown = new Set();

const client = new ChatClient();

async function send(embeds) {
    try {
        await got.post(config.discordWebhookURL, {
            json: { embeds }
        });
    } catch (err) {
        console.error(`couldn't send message to the Discord Webhook: ${err.message}`)
    }
}

client.on("ready", () => {
    console.log('Chat connected')
    client.joinAll(config.channels)
});

client.on("JOIN", ({ channelName }) => {
    console.log(`Joined ${channelName}`)
});

client.on("PART", ({ channelName }) => {
    console.log(`Parted ${channelName}`)
});

client.on("PRIVMSG", async (msg) => {
    if (cooldown.has(msg.senderUserID)) return

    for (let i = 0; i < triggersLength; i++) {
        if (config.regexTriggers[i].test(msg.messageText)) {
            cooldown.add(msg.senderUserID);
            setTimeout(() => {
                cooldown.delete(msg.senderUserID);
            }, 1500);

            await send([{
                "color": 16776960,
                "fields": [
                    {
                        "name": "User",
                        "value": msg.senderUsername,
                        "inline": true
                    },
                    {
                        "name": "Channel",
                        "value": msg.channelName,
                        "inline": true
                    },
                    {
                        "name": "Time",
                        "value": `<t:${Math.floor(msg.serverTimestampRaw / 1000)}:R>`,
                        "inline": true
                    },
                    {
                        "name": "Message",
                        "value": msg.messageText.replace(/([*_`~\|])/g, '\\$1')
                    }
                ]
            }])
        }
    }
});

client.connect()
