/*
exports.handler = async (event, context) => {
{
  return {
    statusCode: 200,
    body: 'hello from netlify functions',
  };
};
*/
/*
exports.handler = function(event, context, callback) {
  callback(null, {
    statusCode: 200,
    body: 'hello from netlify functions',
  });
};
*/
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: 'hello from netlify functions'
  };
};