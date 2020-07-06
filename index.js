const express = require('express');
const bodyParser = require('body-parser');
const {loadAppState, runBlockHandleClick} = require('./server');

const app = express();
app.use(bodyParser.json())

app.get('/sum/:a/:b', (request, response) => {
  const {a, b} = request.params;
  const sum = parseFloat(a) + parseFloat(b);
  response.send('a + b = ' + a + ' + ' + b + ' = ' + sum);
});

function runBlockAsync(body) {
  body = body ? body : {};
  return new Promise(resolve => {
    runBlockHandleClick(body.rootRunBlockKnyteId, body, null, resolve);
  });
}

app.post('/', (request, response) => {
  //console.log(JSON.stringify(Object.keys(request), null, '\t'));
  //console.log(JSON.stringify(request.body, null, '\t'));
  console.log('knyte loading started...');
  loadAppState('./space/knoxelSpace.json');
  console.log('run block starting...');
  const result = await runBlockAsync(request.body);
  response.send(result);
});

app.get('/', (request, response) => {
  response.send('Welcome to knyte cloud server.');
});

app.get('*', (request, response) => {
  response.send('Uknown command.');
});

app.listen(process.env.PORT, () => {
  console.log('server started at ' + process.env.PORT);
});