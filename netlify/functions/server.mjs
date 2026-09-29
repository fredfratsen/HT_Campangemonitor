// Netlify Function: the Campagnemonitor server (see server/netlify.js). Data is kept in Netlify Blobs in
// Frankfurt (eu-central-1). Requires the environment variable SECRETS_KEY.
import { getStore } from '@netlify/blobs';
import { createNetlifyHandler } from '../../server/netlify.js';

export default createNetlifyHandler({
  store: () => getStore({ name: 'campagnemonitor', region: 'eu-central-1', consistency: 'strong' }),
});

// Netlify reads this at build time, so it has to be a literal. Keep it the same as FUNCTION_PATHS in
// server/netlify.js (test/netlify.test.js checks this).
export const config = {
  path: ['/api/*', '/login', '/login/*', '/logout', '/setup', '/setup/*', '/invite/*', '/reset/*', '/privacy', '/healthz'],
};
