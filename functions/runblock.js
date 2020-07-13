import querystring from 'querystring';
import server from '../server'

exports.handler = async (event, context) => {
{
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      body: 'Welcome to knyte lambda functions.',
    };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: 'Method ' + event.httpMethod + ' not allowed',
    };
  }

  const body = querystring.parse(event.body);
  const serverKeys = Object.keys(server);
  return {
    statusCode: 200,
    body: JSON.stringify({body, serverKeys}),
  };
}