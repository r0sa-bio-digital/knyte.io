const a = {b: 'c'};

exports.handler = async (event, context) => {
  console.log(a);
  return {
    statusCode: 200,
    body: 'hello from netlify functions'
  };
};