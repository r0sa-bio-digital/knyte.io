const githubOwnerParamName = 'owner';
const githubRepoParamName = 'repo';
const githubPATKeyPrefix = 'knoxelSpaceGithubPAT';
const knyteAppstateFilename = 'knyte-appstate.json';

function askItem(keyName, message)
{
  const value = prompt(message);
  if (value)
    localStorage.setItem(keyName, value);
  return value;
}

function getConnectionDesc()
{
  const searchParams = new URLSearchParams(location.search);
  const owner = searchParams.get(githubOwnerParamName);
  const repo = searchParams.get(githubRepoParamName);
  const githubPATKeyName = githubPATKeyPrefix + '.' + owner + '.' + repo;
  const pat = localStorage.getItem(githubPATKeyName) ||
    askItem(githubPATKeyName, 'Enter personal access token (PAT) for the repo:');
  const reset = function() { localStorage.setItem(githubPATKeyName, '') };
  return {owner, repo, pat, reset};
}

async function fetchRepoStatus()
{
  const {owner, repo, pat, reset} = getConnectionDesc();
  let readRawUrl, fileSHA;
  if (owner && repo && pat)
  {
    const response = await fetch(
      'https://api.github.com/repos/' +
      owner + '/' + repo + '/commits/main',
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
    else if (confirm('Failed to connect to repo by given PAT. Do you want to reset it?'))
      reset();
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
  if (owner && repo && pat)
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
  return false;
}