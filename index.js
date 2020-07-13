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
  const success = await loadAppState(body.appstateGistId);
  return success;
}

function runBlockAsync(body)
{
  body = body ? body : {};
  return new Promise(
    (resolve) => {runBlockHandleClick(body.rootRunBlockKnyteId, body, null, resolve);}
  );
}

app.post('/', async(request, response) => {
  let result;
  console.log('knyte boot loading...');
  const success = await fetchKnyteAppstate(request.body);
  if (success)
  {
    console.log('run block starting...');
    result = await runBlockAsync(request.body);
  }
  else
    result = JSON.stringify({success: false, result: 'knyte boot loading failed.'});    
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