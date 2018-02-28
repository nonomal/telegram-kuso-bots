'use strict';

module.exports = (bot, event, playerEvent, env) => {
    bot.onText(/^\/info(@\w+)?$/, event((msg, match) => {
        return bot.sendMessage(
            msg.chat.id,
            JSON.stringify(msg),
            {
                reply_to_message_id: msg.message_id,
            }
        );
    }, 1));
};
