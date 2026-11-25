/** The browser talks only to this app. /api/* is forwarded to the backend, so no CORS setup is needed. */
const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';

export default {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};
