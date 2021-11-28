const a = {b: 'c'};

function onComplete(success)
{
  let result = JSON.stringify({success: false, result: 'run block execution failed.'});
  if (success)
  {
    result = JSON.stringify({success: true, result: 'OK'});
  }
  console.log('run block result: ' + result);
  resolve(result);
}

function runBlockHandleClick(codeText, resolve)
{
  let runComplete = false;
  try
  {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const evalText = 'new AsyncFunction(useStrict + codeText)';
    const codeFunction = eval(evalText);
    setTimeout(
      function()
      {
        let promiseComplete = false;
        try
        {
          let codeComplete = false;
          const promiseResults = eval('codeFunction(' + actualParametersList + ')');
          promiseResults.then(
            function(results)
            {
            }
          ).finally(
            function()
            {
              onComplete(codeComplete);
            }
          );
          promiseComplete = true;
        }
        finally
        {
          if (!promiseComplete)
          {
            onComplete(false);
          }
        }
      }, 
      runBlockDelay
    );
    runComplete = true;
  }
  finally
  {
  }
}

function runBlockAsync(codeText)
{
  return new Promise(
    (resolve) => {runBlockHandleClick(codeText, resolve);}
  );
}

exports.handler = async (event, context) => {
  console.log(await runBlockAsync('"use strict";\nconsole.log(a);'));
  return {
    statusCode: 200,
    body: 'hello from netlify functions'
  };
};