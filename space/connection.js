const githubOwnerKey = 'owner';
const githubRepoKey = 'repo';
const githubPATKey = 'pat';
const knyteAppstateFilename = 'knyte-appstate.json';

function getConnectionDesc()
{
  const searchParams = new URLSearchParams(location.search);
  return {
    owner: searchParams.get(githubOwnerKey),
    repo: searchParams.get(githubRepoKey),
    pat: searchParams.get(githubPATKey)
  };
}

async function fetchRepoStatus()
{
  const {owner, repo, pat} = getConnectionDesc();
  let readRawUrl, fileSHA;
  if (owner && repo && pat)
  {
    const response = await fetch(
      'https://api.github.com/repos/' +
      owner + '/' + repo + '/commits/master',
      {headers: {authorization: 'token ' + pat}}
    );
    if (response.status === 200)
    {
      const json = await response.json();
      for (let i = 0; i < json.files.length; ++i)
      {
        const filename = json.files[i].filename;
        if (filename === knyteAppstateFilename)
        {
          readRawUrl = json.files[i].raw_url;
          fileSHA = json.files[i].sha;
          break;
        }
      }
    }
  }
  return {owner, repo, pat, readRawUrl, fileSHA};
}

function atou(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function utoa(data) {
  return btoa(unescape(encodeURIComponent(data)));
}

async function fetchRepoFile(owner, repo, pat, fileSHA)
{
  let fileContent;
  if (owner && repo && pat)
  {
    const response = await fetch(
      'https://api.github.com/repos/' +
      owner + '/' + repo + '/git/blobs/' + fileSHA,
      {headers: {authorization: 'token ' + pat}}
    );
    if (response.status === 200)
    {
      const json = await response.json();
      fileContent = atou(json.content);
    }
  }
  return fileContent;
}

async function putRepoFile(owner, repo, pat, message, textContent, sha)
{
  const method = 'PUT';
  const headers = {
    authorization: 'token ' + pat,
    'Content-Type': 'application/json'
  };
  const content = utoa(textContent);
  const body = JSON.stringify({message, content, sha});
  const response = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + knyteAppstateFilename, {method, headers, body});
  const json = await response.json();
  if (response.status !== 200 || json.content.name !== knyteAppstateFilename)
  {
    console.warn(response);
    console.warn(json);
    return false;
  }
  return true;
}