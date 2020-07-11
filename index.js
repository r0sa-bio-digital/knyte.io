const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const {loadAppState, runBlockHandleClick} = require('./server');

const app = express();
app.use(bodyParser.json());
app.use(cors({methods: ['GET','HEAD','POST','OPTIONS'], allowedHeaders: ['Content-Type']}));

async function fetchKnyteAppstate(body)
{
  body = body ? body : {};
  await loadAppState(body.appstateGistId);
}

function runBlockAsync(body)
{
  body = body ? body : {};
  return new Promise(
    (resolve) => {runBlockHandleClick(body.rootRunBlockKnyteId, body, null, resolve);}
  );
}

app.post('/', async(request, response) => {
  console.log('knyte boot loading...');
  await fetchKnyteAppstate(request.body);
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