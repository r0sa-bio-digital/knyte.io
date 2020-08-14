const gistIdKey = 'knoxelSpaceGistId';
const githubOwnerKey = 'knoxelSpaceGithubOwner';
const githubRepoKey = 'knoxelSpaceGithubRepo';
const githubPATKey = 'knoxelSpaceGithubPAT';
const knyteAppstateFilename = 'knyte-appstate.json';

async function fetchGistStatus()
{
  const gistId = localStorage.getItem(gistIdKey);
  const githubPAT = localStorage.getItem(githubPATKey);
  let readRawUrl, authDone, writeAccess;
  if (gistId)
  {
    const response = await fetch('https://api.github.com/gists/' + gistId);
    const json = await response.json();
    const file = json.files ? json.files[knyteAppstateFilename] : undefined;
    readRawUrl = file ? file.raw_url : undefined;
  }
  if (githubPAT)
  {
    const response = await fetch('https://api.github.com/gists/starred',
      {headers: {authorization: 'token ' + githubPAT}});
    const json = await response.json();
    authDone = json ? json.length !== undefined : false;
    if (authDone)
    {
      const response = await fetch('https://api.github.com/gists',
        {headers: {authorization: 'token ' + githubPAT}});
      const json = await response.json();
      for (let i = 0; i < json.length; ++i)
      {
        const id = json[i].id;
        if (id === gistId)
        {
          writeAccess = true;
          break;
        }
      }
    }
  }
  return {gistId, githubPAT, readRawUrl, authDone, writeAccess};
}

async function fetchRepoStatus_Less1Mb()
{
  const owner = localStorage.getItem(githubOwnerKey);
  const repo = localStorage.getItem(githubRepoKey);
  const pat = localStorage.getItem(githubPATKey);
  let readRawUrl;
  if (owner && repo && pat)
  {
    const response = await fetch(
      'https://api.github.com/repos/' +
      owner + '/' + repo + '/contents/' + knyteAppstateFilename,
      {headers: {authorization: 'token ' + pat}}
    );
    if (response.status === 200)
    {
      const json = await response.json();
      readRawUrl = json.download_url;
    }
  }
  return {owner, repo, pat, readRawUrl};
}

async function fetchRepoStatus()
{
  const owner = localStorage.getItem(githubOwnerKey);
  const repo = localStorage.getItem(githubRepoKey);
  const pat = localStorage.getItem(githubPATKey);
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

async function fetchRepoFile(fileSHA)
{
  const owner = localStorage.getItem(githubOwnerKey);
  const repo = localStorage.getItem(githubRepoKey);
  const pat = localStorage.getItem(githubPATKey);
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