const WebSocket = require('ws');

const server = new WebSocket.Server({
    port: 3000
});

/**
 * @type {Map<WebSocket, String>}
 */
let sockets = new Map();

/**
 * @type {Map<String, Array<String>>}
 */
let edits = new Map();

/**
 * @type {Array}
 */
let history = [{
    type: 'message',
    sender: 'Server',
    message: 'Welcome to the new chatroom!'
}];

function ensureNickAvailable(/** @type {String} */ nick)
{
    for (let nickname of sockets.values())
    {
        if (nickname === nick)
        {
            return false;
        }
    }
    return true;
}

server.on('connection', (ws) => {
    ws.on('message', (msg) => {
        if (JSON.parse(msg).type === 'registration')
        {
            if (!ensureNickAvailable(JSON.parse(msg).name))
            {
                ws.send(JSON.stringify({
                    type: 'rejection',
                    reason: 'Nickname already taken'
                }));
                ws.close();
                return;
            }
            console.log(`New connection: ${JSON.parse(msg).name}`);
            sockets.set(ws, `${JSON.parse(msg).name}`);
            history.forEach((obj) => ws.send(JSON.stringify(obj)));
            edits.forEach((editList, id) => {
                editList.forEach((edit) => {
                    ws.send(JSON.stringify({
                        type: 'edit',
                        id: id,
                        newMsg: edit.newMsg,
                        oldMsg: edit.oldMsg
                    }));
                });
            });
            sockets.forEach((name, socket) => socket.send(JSON.stringify({
                type: 'join',
                user: `${JSON.parse(msg).name}`
            })));
            history.push({
                type: 'join',
                user: `${JSON.parse(msg).name}`
            });
        }
        else if (JSON.parse(msg).type === 'message')
        {
            console.log(`Server: recieved '${JSON.parse(msg).message}'`);
            sockets.forEach((name, socket) => socket.send(JSON.stringify({
                type: 'message',
                sender: `${JSON.parse(msg).name}`,
                message: `${JSON.parse(msg).message}`,
                id: JSON.parse(msg).id
            })));
            history.push({
                type: 'message',
                sender: `${JSON.parse(msg).name}`,
                message: `${JSON.parse(msg).message}`,
                id: JSON.parse(msg).id
            });
        }
        else if (JSON.parse(msg).type === 'delete')
        {
            let messageObj = history.find((value) => value.type === 'message' && value.sender === JSON.parse(msg).user && value.id === JSON.parse(msg).id);
            if (messageObj !== undefined)
            {
                history.splice(history.indexOf(messageObj), 1);
                sockets.forEach((name, socket) => socket.send(JSON.stringify({
                    type: 'delete',
                    id: JSON.parse(msg).id
                })));
            }
            else
            {
                ws.send(JSON.stringify({
                    type: 'error',
                    errormsg: `Please do not try to delete other peoples' messages!`
                }));
            }
        }
        else if (JSON.parse(msg).type === 'edit')
        {
            if (edits.has(JSON.parse(msg).id))
            {
                edits.get(JSON.parse(msg).id).push({
                    oldMsg: JSON.parse(msg).oldMsg,
                    newMsg: JSON.parse(msg).newMsg
                });
            }
            else
            {
                edits.set(JSON.parse(msg).id, [{
                    oldMsg: JSON.parse(msg).oldMsg,
                    newMsg: JSON.parse(msg).newMsg
                }]);
            }
            sockets.forEach((name, socket) => {
                if (socket !== ws)
                {
                    socket.send(JSON.stringify({
                        type: 'edit',
                        id: JSON.parse(msg).id,
                        newMsg: JSON.parse(msg).newMsg,
                        oldMsg: JSON.parse(msg).oldMsg
                    }));
                }
            });
        }
        else
        {
            ws.close();
            if (sockets.size === 0)
            {
                history = [{
                    type: 'message',
                    sender: 'Server',
                    message: 'Welcome to the new chatroom!'
                }];

                edits = new Map();
            }
        }
    });

    ws.on('close', () => {
        if (sockets.get(ws) === undefined) return;
        console.log(`${sockets.get(ws)} disconnected`);
        sockets.forEach((name, socket) => socket.send(JSON.stringify({
            type: 'disconnect',
            user: `${sockets.get(ws)}`
        })));
        history.push({
            type: 'disconnect',
            user: `${sockets.get(ws)}`
        });
        sockets.delete(ws);
        if (sockets.size === 0)
        {
            history = [{
                type: 'message',
                sender: 'Server',
                message: 'Welcome to the new chatroom!'
            }];
            edits = new Map();
        }
    });
});

console.log('Server Started');