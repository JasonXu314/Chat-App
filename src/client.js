import * as IO from 'console-read-write';

const ws = new WebSocket('wss://localhost:3000');

ws.addEventListener('open', () => {
  const data = { message: 'Hello from the client!' }
  const json = JSON.stringify(data);
  ws.send(json);
});



ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  console.log(data);
});