import type { StarredRepo, LatestReleaseResult } from './types';

const GITHUB_API = 'https://api.github.com';
const CONNECTIVITY_TIMEOUT = 8000;
const REQUEST_TIMEOUT = 10000;

import { warn as logWarn } from './logger';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
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
    await maybeWaitForRateLimit(response);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function maybeWaitForRateLimit(response: Response): Promise<void> {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  if (!remaining || !reset) return;

  const remainingNum = parseInt(remaining, 10);
  const resetTime = parseInt(reset, 10) * 1000;
  if (isNaN(remainingNum) || isNaN(resetTime)) return;

  if (remainingNum < 10 && resetTime > Date.now()) {
    const waitMs = Math.min(resetTime - Date.now(), 30000);
    logWarn('rate_limit_wait', `Rate limit low (${remainingNum} remaining), waiting ${waitMs}ms`);
    await new Promise<void>(r => setTimeout(r, waitMs));
  }
}

export async function checkConnectivity(): Promise<boolean> {
  const urls = [GITHUB_API, 'https://github.com'];
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, { headers: {} }, CONNECTIVITY_TIMEOUT);
      if (response.ok || response.status === 401 || response.status === 403) {
        return true;
      }
    } catch {
      logWarn('connectivity_failed', `连通性检查失败: ${url}`);
      continue;
    }
  }
  return false;
}

export async function getStarredRepos(token: string): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];
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

    const data: Array<{
      full_name: string;
      owner: { login: string };
      name: string;
      html_url: string;
      stargazers_count: number;
    }> = await response.json();
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

export async function getLatestRelease(
  token: string,
  owner: string,
  repo: string,
  etag: string | null = null,
  releaseType: 'stable' | 'pre-release' = 'stable'
): Promise<LatestReleaseResult> {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await fetchWithTimeout(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`,
    { headers }
  );

  const newEtag = response.headers.get('ETag') || etag;

  if (response.status === 304) {
    return { etag: newEtag, release: null };
  }

  if (response.status === 404) {
    return { etag: newEtag, release: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch releases for ${owner}/${repo}: ${response.status}`);
  }

  const releases: Array<{
    prerelease: boolean;
    tag_name: string;
    name: string;
    html_url: string;
    published_at: string;
  }> = await response.json();
  if (releases.length === 0) {
    return { etag: newEtag, release: null };
  }

  let target = releases[0];
  if (releaseType === 'stable') {
    target = releases.find(r => !r.prerelease) || releases[0];
  } else if (releaseType === 'pre-release') {
    target = releases.find(r => r.prerelease) || releases[0];
  }

  if (!target) {
    return { etag: newEtag, release: null };
  }

  return {
    etag: newEtag,
    release: {
      repo: `${owner}/${repo}`,
      tag: target.tag_name,
      name: target.name || target.tag_name,
      url: target.html_url,
      published_at: target.published_at,
      prerelease: target.prerelease
    }
  };
}
