const githubOwnerKey = 'knoxelSpaceGithubOwner';
const githubRepoKey = 'knoxelSpaceGithubRepo';
const githubPATKey = 'knoxelSpaceGithubPAT';
const knyteAppstateFilename = 'knyte-appstate.json';

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

function getConnectionDesc()
{
  const ownerLocal = localStorage.getItem(githubOwnerKey);
  const repoLocal = localStorage.getItem(githubRepoKey);
  const patLocal = localStorage.getItem(githubPATKey);

  return {owner: ownerLocal, repo: repoLocal, pat: patLocal};
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