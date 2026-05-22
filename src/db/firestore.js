/**
 * src/db/firestore.js — Low-level Firestore REST API wrapper
 * Used only by Worker. Handles token generation and REST calls.
 */

export async function getServiceAccountToken(env) {
  try {
    const email = env.FIREBASE_SA_EMAIL;
    const key = env.FIREBASE_SA_KEY.replace(/\\n/g, '\n').replace(/\r/g, '');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: email, sub: email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore'
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const encode = obj => btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const pemKey = key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', binaryKey.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('getServiceAccountToken error:', e);
    return null;
  }
}

export async function firestoreGet(path, env) {
  try {
    const token = await getServiceAccountToken(env);
    if (!token) return null;
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const res = await fetch(`${base}/${path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('firestoreGet error:', e);
    return null;
  }
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  }
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) {
      fields[k] = toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

export async function firestoreSet(path, data, env, updateMask = null) {
  try {
    const token = await getServiceAccountToken(env);
    if (!token) return false;
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      fields[k] = toFirestoreValue(v);
    }

    // Build URL with updateMask if provided (only update specified fields)
    let url = `${base}/${path}`;
    if (updateMask && updateMask.length > 0) {
      const maskParams = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
      url += `?${maskParams}`;
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    console.error('firestoreSet error:', e);
    return false;
  }
}

export async function firestoreQuery(collection, filters, env) {
  try {
    const token = await getServiceAccountToken(env);
    if (!token) return [];
    const base = 'https://firestore.googleapis.com/v1/projects/psots-society-25899/databases/(default)/documents';
    const whereClause = filters.map(([field, value]) => ({
      fieldFilter: {
        field: { fieldPath: field },
        op: 'EQUAL',
        value: { stringValue: value }
      }
    }));
    const where = whereClause.length === 1
      ? whereClause[0]
      : { compositeFilter: { op: 'AND', filters: whereClause } };
    const body = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where
      }
    };
    const res = await fetch(`${base}:runQuery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.filter(r => r.document).map(r => {
      const parsed = parseFirestoreDoc(r.document);
      if (parsed && r.document.name) {
        const parts = r.document.name.split('/');
        parsed._id = parts[parts.length - 1];
      }
      return parsed;
    }).filter(Boolean);
  } catch (e) {
    console.error('firestoreQuery error:', e);
    return [];
  }
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const result = { id: doc.name.split('/').pop() };
  for (const [key, value] of Object.entries(doc.fields)) {
    if (value.stringValue !== undefined) result[key] = value.stringValue;
    else if (value.integerValue !== undefined) result[key] = parseInt(value.integerValue, 10);
    else if (value.booleanValue !== undefined) result[key] = value.booleanValue;
    else if (value.nullValue !== undefined) result[key] = null;  // Fix: Handle null values properly
    else if (value.arrayValue !== undefined) result[key] = value.arrayValue.values?.map(v => v.stringValue) || [];
    else if (value.mapValue !== undefined) result[key] = value.mapValue.fields;
    else result[key] = value;
  }
  return result;
}
