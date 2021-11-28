exports.aa = {bb: 'cc'};
const a = {b: 'c'};
let runBlockDelay = 0;

function runBlockHandleClick(codeText, resolve)
{

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

  try
  {
    const useStrict = '"use strict";\n';
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
          const promiseResults = eval('codeFunction()');
          promiseResults.then(
            function(results)
            {
              codeComplete = true;
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
  console.log(await runBlockAsync('console.log(aa);'));
  console.log(await runBlockAsync('console.log(a);'));
  return {
    statusCode: 200,
    body: 'hello from netlify functions'
  };
};