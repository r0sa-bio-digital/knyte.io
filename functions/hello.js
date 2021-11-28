const a = {b: 'c'};

exports.handler = async (event, context) => {
  setTimeout(() => eval('"use strict";\nconsole.log(a);'), 10);
  return {
    statusCode: 200,
    body: 'hello from netlify functions'
  };
};