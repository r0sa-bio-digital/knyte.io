const a = {b: 'c'};
const aa = {bb: 'cc'};
const aaa = {bbb: 'ccc'};

exports.handler = async (event, context) => {
  console.log(a);
  eval('console.log(aa);');
  eval('"use strict";\nconsole.log(aaa);');
  return {
    statusCode: 200,
    body: 'hello from netlify functions'
  };
};