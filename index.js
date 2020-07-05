const express = require('express');
const {loadAppState, runBlockHandleClick} = require('./server');

const app = express();

app.get('/sum/:a/:b', (request, response) => {
  const {a, b} = request.params;
  const sum = parseFloat(a) + parseFloat(b);
  response.send('a + b = ' + a + ' + ' + b + ' = ' + sum);
});

app.get('/:runKnyteId/:resultKnyteId', (request, response) => {
  const {runKnyteId, resultKnyteId} = request.params;
  loadAppState('./space/knoxelSpace.json');
  runBlockHandleClick(runKnyteId, resultKnyteId);
  response.send('run block ' + runKnyteId + ' started');
});

app.get('/', (request, response) => {
  response.send(
    'Welcome to knyte.io project.<br>' +
    'Use /a/b numeric parameters to get sum of given numbers.'
  );
});

app.get('*', (request, response) => {
  response.send('Uknown command.');
});

app.listen(process.env.PORT, () => {
  console.log('server started at ' + process.env.PORT);
});