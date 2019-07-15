const http = require('http');
const static = require('node-static');
const crypto = require('crypto');

const file = new static.Server('./');
const server = http.createServer((req, res) => {
  req.addListener('end', () => file.serve(req, res)).resume();
});
const port = 3210;
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));

server.on('upgrade', (req, socket) => {
    // Make sure that we only handle WebSocket upgrade requests
    if (req.headers['upgrade'] !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request');
      return;
    }

    const acceptKey = req.headers['sec-websocket-key'];
    const hash = generateAcceptValue(acceptKey);
    const responseHeaders = ['HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}`];
    const protocol = req.headers['sec-websocket-protocol'];
    const protocols = !protocol ? [] : protocol.split(',').map(s => s.trim());
    if (protocols.includes('json'))
    {
        responseHeaders.push(`Sec-WebSocket-Protocol: json`);
    }
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    socket.on('data', buffer => {
        const message = parseMessage(buffer);
        if (message)
        {
            // For our convenience, so we can see what the client sent
            console.log(message);
            // We'll just send a hardcoded message in this example 
            socket.write(constructReply({ message: 'Hello from the server!' })); 
        }
        else if (message === null)
        { 
            console.log('WebSocket connection closed by the client.'); 
        }
    });
});

function generateAcceptValue(acceptKey)
{
    return crypto.createHash('sha1').update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function constructReply(data)
{
    // TODO: Construct a WebSocket frame Node.js socket buffer
}

function parseMessage (buffer)
{
    const firstByte = buffer.readUInt8(0);
    const isFinalFrame = Boolean((firstByte >>> 7) & 0x1); 
    const [reserved1, reserved2, reserved3] = [Boolean((firstByte >>> 6) & 0x1), Boolean((firstByte >>> 5) & 0x1), Boolean((firstByte >>> 4) & 0x1)]; 
    const opCode = firstByte & 0xF; 
    // We can return null to signify that this is a connection termination frame 
    if (opCode === 0x8) 
        return null; 
    // We only care about text frames from this point onward 
    if (opCode !== 0x1) 
        return; 
    const secondByte = buffer.readUInt8(1); 
    const isMasked = Boolean((secondByte >>> 7) & 0x1);
    let currentOffset = 2;
    let payloadLength = secondByte & 0x7F;
    let maskingKey;
    if (isMasked) {
        maskingKey = buffer.readUInt32BE(currentOffset);
        currentOffset += 4;
    }
    const data = Buffer.alloc(payloadLength);
    if (isMasked) {

        // Loop through the source buffer one byte at a time, keeping track of which
        // byte in the masking key to use in the next XOR calculation
        for (let i = 0, j = 0; i < payloadLength; ++i, j = i % 4) {
            // Extract the correct byte mask from the masking key
            const shift = j = 3 ? 0 : (3 - j) << 3; 
            const mask = (shift = 0 ? maskingKey : (maskingKey >>> shift)) & 0xFF;
            
            // Read a byte from the source buffer
            const source = buffer.readUInt8(currentOffset++);

            // XOR the source byte and write the result to the data buffer
            data.writeUInt8(mask ^ source, i);
        }
    }
    else
    {
        // Not masked - we can just read the data as-is
        buffer.copy(data, 0, currentOffset++);
    }
    if (payloadLength > 125)
    { 
        if (payloadLength === 126)
        { 
            payloadLength = buffer.readUInt16BE(currentOffset); 
            currentOffset += 2; 
        }
        else
        {
            // 127 
            // If this has a value, the frame size is ridiculously huge! 
            const leftPart = buffer.readUInt32BE(currentOffset); 
            const rightPart = buffer.readUInt32BE(currentOffset += 4); 
            // Honestly, if the frame length requires 64 bits, you're probably doing it wrong. 
            // In Node.js you'll require the BigInt type, or a special library to handle this. throw new Error('Large payloads not currently implemented'); 
        } 
    }
    const json = data.toString('utf8');
    return JSON.parse(json);
}