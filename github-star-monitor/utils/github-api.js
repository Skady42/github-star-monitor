const GITHUB_API = 'https://api.github.com';
const CONNECTIVITY_TIMEOUT = 8000;
const REQUEST_TIMEOUT = 10000;

async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkConnectivity() {
  const urls = [GITHUB_API, 'https://github.com'];
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, { headers: {} }, CONNECTIVITY_TIMEOUT);
      if (response.ok || response.status === 401 || response.status === 403) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function getStarredRepos(token) {
  const repos = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchWithTimeout(
      `${GITHUB_API}/user/starred?per_page=${perPage}&page=${page}&sort=updated`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch starred repos: ${response.status}`);
    }

    const data = await response.json();
    repos.push(...data.map(r => ({
      full_name: r.full_name,
      owner: r.owner.login,
      name: r.name,
      html_url: r.html_url,
      stargazers_count: r.stargazers_count || 0
    })));

    hasMore = data.length === perPage;
    page++;
  }

  return repos;
}

export async function getLatestRelease(token, owner, repo) {
  const response = await fetchWithTimeout(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=3`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch releases for ${owner}/${repo}: ${response.status}`);
  }

  const releases = await response.json();
  if (releases.length === 0) return null;

  const latest = releases[0];
  return {
    repo: `${owner}/${repo}`,
    tag: latest.tag_name,
    name: latest.name || latest.tag_name,
    url: latest.html_url,
    published_at: latest.published_at
  };
}
