'use strict';

const fs = require('fs');

const config = require('./config');
const bot = require('./bot.' + config.bot)(config.hangmanToken);

const dictionary = require('./hangman.dictionary');
const gameplay = require('./hangman.gameplay');

const fd = fs.openSync('log_hangman', 'a');

const log = (head, body) => {
    fs.write(fd, '[' + Date() + '] ' + head + ' ' + body + '\n', () => {
        // nothing
    });
};

const event = (handler) => {
    return (msg, match) => {
        log(
            msg.chat.id + ':' + msg.from.id + '@' + (msg.from.username || ''),
            match[0]
        );

        if (!config.ban[msg.from.id]) {
            handler(msg, match);
        }
    };
};

const messageUpdate = (msg, game) => {
    const matrix = [];

    for (let i = 0; i < game.keyboard.length / 8; i += 1) {
        matrix.push([]);

        for (let j = i * 8; j < i * 8 + 8 && j < game.keyboard.length; j += 1) {
            matrix[i].push({
                text: game.keyboard[j] || '⨯',
                callback_data: JSON.stringify(['guess', j]),
            });
        }
    }

    let text = '( *・ω・)✄╰ひ╯';

    bot.editMessageText(
        '<pre>\n'
            + '[ ' + game.hint.toLocaleUpperCase() + ' ]\n'
            + '[ 剩余生命：' + (9 - game.error) + ' ]\n'
            + '</pre>',
        {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            parse_mode: 'HTML',
            reply_to_message_id: msg.reply_to_message.message_id,
            reply_markup: {
                inline_keyboard: matrix,
            },
        }
    );
};

// const gameStat = (msg, game, title, last) => {
//     const stat = {};

//     for (const i in game.history) {
//         stat[game.history[i][0]] = stat[game.history[i][0]] + 1 || 1;
//     }

//     let text = title + '\n\n统计：\n';

//     for (const i in stat) {
//         text += game.nameMap()[i] + ' - ' + stat[i] + '项操作\n';
//     }

//     text += '\n' + game.nameMap()[game.history[game.history.length - 1][0]] + ' ' + last;

//     bot.sendMessage(
//         msg.chat.id,
//         text,
//         {
//             reply_to_message_id: msg.message_id,
//         }
//     );
// };

bot.onText(/^\/hang(@\w+)?(?: (\d+))?$/, event((msg, match) => {
    const lines = [];

    const keyboardSize = parseInt(match[2], 10) || 32;

    for (const i in config.hangmanDict) {
        const dictInfo = config.hangmanDict[i];

        // note: default dict size limit is 1m
        lines.push([{
            text: dictInfo.title,
            callback_data: JSON.stringify(['dict', dictInfo.id, 1000000, keyboardSize]),
        }]);

        if (dictInfo.limits.length) {
            const line = [];

            for (const j in dictInfo.limits) {
                line.push({
                    text: dictInfo.limits[j],
                    callback_data: JSON.stringify(['dict', dictInfo.id, dictInfo.limits[j], keyboardSize]),
                });
            }

            lines.push(line);
        }
    }

    bot.sendMessage(
        msg.chat.id,
        '请选择词典\n\n数字表示的是缩减版哦',
        {
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: lines,
            },
        }
    );
}));

bot.on('callback_query', (query) => {
    const msg = query.message;
    const info = JSON.parse(query.data);

    if (info[0] === 'dict') {
        if (typeof info[2] !== 'number' || typeof info[3] !== 'number') {
            throw Error(JSON.stringify(query));
        }

        log(
            msg.chat.id + '_' + msg.message_id + ':callback:' + query.from.id + '@' + (query.from.username || ''),
            'dict ' + info[1] + ' ' + info[2] + ' ' + info[3]
        );

        dictionary.load(
            info[1],
            info[2],
            (dict) => {
                // loaded

                gameplay.init(
                    msg.chat.id + '_' + msg.message_id,
                    query.from.id,
                    dict,
                    info[3],
                    (game) => {
                        // game init

                        messageUpdate(
                            msg,
                            game
                        );

                        bot.answerCallbackQuery(query.id);
                    },
                    () => {
                        // game exist

                        // never reach
                        throw Error(JSON.stringify(query));
                    }
                );
            },
            () => {
                // not valid

                // never reach
                throw Error(JSON.stringify(query));
            }
        );
    } else if (info[0] === 'guess') {
        if (typeof info[1] !== 'number') {
            throw Error(JSON.stringify(query));
        }

        log(
            msg.chat.id + '_' + msg.message_id + ':callback:' + query.from.id + '@' + (query.from.username || ''),
            'guess ' + info[1]
        );

        gameplay.click(
            msg.chat.id + '_' + msg.message_id,
            query.from.id,
            info[1],
            (game) => {
                // game continue

                messageUpdate(
                    msg,
                    game
                );

                bot.answerCallbackQuery(query.id);
            },
            (game) => {
                // game win

                messageUpdate(
                    msg,
                    game
                );

                bot.answerCallbackQuery(query.id);
            },
            () => {
                // not valid

                bot.answerCallbackQuery(query.id);
            },
            () => {
                // game not exist

                bot.answerCallbackQuery(query.id);
            }
        );
    }
});
