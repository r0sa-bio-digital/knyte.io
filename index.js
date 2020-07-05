const express = require('express');
const {loadAppState, runBlockHandleClick} = require('./server');

const app = express();

app.get('/sum/:a/:b', (request, response) => {
  const {a, b} = request.params;
  const sum = parseFloat(a) + parseFloat(b);
  response.send('a + b = ' + a + ' + ' + b + ' = ' + sum);
});

function delay(t, val) {
   return new Promise(function(resolve) {
       setTimeout(function() {
           resolve(val);
       }, t);
   });
}

function runBlockAsync(headers, runKnyteId, resultKnyteId) {
  return new Promise(resolve => {
  	runBlockHandleClick(headers, runKnyteId, resultKnyteId, resolve);
  });
}

app.get('/:runKnyteId/:resultKnyteId', async(request, response) => {
  console.log(JSON.stringify(Object.keys(request), null, '\t'));
  console.log(JSON.stringify(request.headers, null, '\t'));
  const {runKnyteId, resultKnyteId} = request.params;
  console.log('knyte loading started...');
  loadAppState('./space/knoxelSpace.json');
  console.log('run block ' + runKnyteId + ' started...');
  const result = await runBlockAsync(request.headers, runKnyteId, resultKnyteId);
  response.send(result);
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