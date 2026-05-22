export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Only rewrite for society.psots.in
    if (url.hostname === 'society.psots.in') {
      const path = url.pathname;
      
      // Map clean URLs to society/ folder
      const routes = {
        '/': '/society/index.html',
        '/login': '/society/login.html',
        '/register': '/society/register.html',
        '/dashboard': '/society/index.html',
        '/profile': '/society/profile.html',
        '/marketplace': '/society/marketplace.html',
        '/guide': '/society/guide.html',
        '/lostandfound': '/society/lostandfound.html',
        '/carpooling': '/society/carpooling.html',
        '/admin': '/society/admin.html',
      };
      
      const mapped = routes[path] || (path.startsWith('/society/') ? path : null);
      
      if (mapped) {
        const newUrl = new URL(mapped, url.origin);
        return env.ASSETS.fetch(new Request(newUrl, request));
      }
    }
    
    // All other requests — serve normally
    return env.ASSETS.fetch(request);
  }
}
