const PROJECT_ID = 'psots-society-25899';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getServiceAccountToken(env) {
  try {
    const email = env.FIREBASE_SA_EMAIL;
    const key = env.FIREBASE_SA_KEY.replace(/\\n/g, '\n').replace(/\r/g, '');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: email,
      sub: email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore'
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const encode = obj => btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const pemKey = key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    return null;
  }
}

async function getAuthHeader(env) {
  const token = await getServiceAccountToken(env);
  return token ? { 'Authorization': `Bearer ${token}` } : null;
}

export { getServiceAccountToken, getAuthHeader, PROJECT_ID, BASE_URL };
