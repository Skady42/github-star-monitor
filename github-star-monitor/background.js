import {
  getToken, setToken, getUser, setUser,
  getLastCheckTime, setLastCheckTime,
  getKnownReleases, getPendingUpdates, mergeNewReleases,
  getLastCheckStatus, setLastCheckStatus,
  getOAuthClientId, setOAuthClientId,
  getOAuthClientSecret, setOAuthClientSecret
} from './utils/storage.js';

import {
  checkConnectivity, getStarredRepos, getLatestRelease
} from './utils/github-api.js';

import { notifyUpdates } from './utils/notifications.js';

const ALARM_NAME = 'check-releases';
const ONE_HOUR_MS = 60 * 60 * 1000;

const GITHUB_OAUTH = {
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token'
};

function setupAlarm() {
  chrome.alarms.clear(ALARM_NAME, () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const delayMinutes = (nextHour - now) / 60000;

    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: 60,
      delayInMinutes: delayMinutes
    });
    console.log(`[Monitor] Alarm set for ${nextHour.toISOString()} (in ${Math.round(delayMinutes)}min)`);
  });
}

async function performCheck() {
  console.log('[Monitor] Starting release check...');

  const token = await getToken();
  if (!token) {
    await setLastCheckStatus('no_token');
    console.log('[Monitor] No token, skipping check');
    return;
  }

  const connected = await checkConnectivity();
  if (!connected) {
    await setLastCheckStatus('network_error');
    console.log('[Monitor] GitHub unreachable, skipping check');
    return;
  }

  try {
    const repos = await getStarredRepos(token);
    console.log(`[Monitor] Found ${repos.length} starred repos`);

    const newReleases = [];
    for (const repo of repos) {
      try {
        const release = await getLatestRelease(token, repo.owner, repo.name);
        if (release) {
          release.stars = repo.stargazers_count || 0;
          newReleases.push(release);
        }
      } catch (err) {
        console.warn(`[Monitor] Failed for ${repo.full_name}:`, err.message);
      }
    }

    const genuinelyNew = await mergeNewReleases(
      repos.map(r => r.full_name),
      newReleases
    );

    if (genuinelyNew.length > 0) {
      console.log(`[Monitor] Found ${genuinelyNew.length} new release(s)`);
      notifyUpdates(genuinelyNew);
    } else {
      console.log('[Monitor] No new releases');
    }

    await setLastCheckTime(new Date().toISOString());
    await setLastCheckStatus('success');
  } catch (err) {
    console.error('[Monitor] Check failed:', err);
    await setLastCheckStatus('error');
  }
}

async function startOAuth() {
  const clientId = await getOAuthClientId();
  const clientSecret = await getOAuthClientSecret();

  if (!clientId || !clientSecret) {
    return { success: false, error: '请先配置 GitHub OAuth 凭证' };
  }

  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const authUrl = new URL(GITHUB_OAUTH.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user');
  authUrl.searchParams.set('state', Math.random().toString(36).substring(2));

  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('No authorization code received');
    }

    const tokenResponse = await fetch(GITHUB_OAUTH.tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.access_token) {
      await setToken(tokenData.access_token);

      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      const userData = await userResponse.json();
      await setUser(userData.login);

      await performCheck();
      return { success: true, user: userData.login };
    }
    throw new Error('Failed to get access token');
  } catch (err) {
    console.error('[Monitor] OAuth failed:', err);
    return { success: false, error: err.message };
  }
}

// Click action icon -> open side panel (setPanelBehavior handles this)
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    performCheck();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'saveCredentials':
        await setOAuthClientId(message.clientId);
        await setOAuthClientSecret(message.clientSecret);
        sendResponse({ success: true });
        break;

      case 'startOAuth':
        const result = await startOAuth();
        sendResponse(result);
        break;

      case 'checkNow':
        await performCheck();
        const updates = await getPendingUpdates();
        const status = await getLastCheckStatus();
        const time = await getLastCheckTime();
        sendResponse({ updates, status, lastCheckTime: time });
        break;

      case 'getStatus':
        const s = await getLastCheckStatus();
        const t = await getLastCheckTime();
        const u = await getPendingUpdates();
        const user = await getUser();
        const token = await getToken();
        const hasCreds = !!(await getOAuthClientId() && await getOAuthClientSecret());
        const redirUri = chrome.identity.getRedirectURL('oauth2');
        sendResponse({ status: s, lastCheckTime: t, updates: u, user, hasToken: !!token, hasCredentials: hasCreds, redirectUri: redirUri });
        break;

      case 'logout':
        await chrome.storage.local.clear();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Monitor] Extension installed/updated:', details.reason);
  setupAlarm();

  const lastCheckTime = await getLastCheckTime();
  if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > ONE_HOUR_MS) {
    await performCheck();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Monitor] Browser started');
  setupAlarm();

  const lastCheckTime = await getLastCheckTime();
  if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > ONE_HOUR_MS) {
    await performCheck();
  }
});
