// Dev-only live-reload client for Alto Translate extension pages.
// Connects to the local dev watcher (scripts/dev-watch.mjs) over Server-Sent
// Events and reloads the page when a watched file changes.
//
// In production there is no watcher running on localhost, so the EventSource
// connection simply fails and this script is a silent no-op. Safe to ship.
(function () {
  if (typeof EventSource === 'undefined') return;

  var URL = 'http://localhost:8890/stream';
  var RECONNECT_MS = 1500;
  var es = null;

  function pageName() {
    var file = location.pathname.split('/').pop() || '';
    return file.replace(/\.[^.]+$/, '');
  }

  function handleReload(ev) {
    var data = {};
    try { data = JSON.parse(ev.data || '{}'); } catch (e) { return; }
    var scope = data.scope || 'all';
    if (scope === 'all' || scope === pageName()) {
      location.reload();
    }
  }

  function connect() {
    try {
      es = new EventSource(URL);
    } catch (e) {
      setTimeout(connect, RECONNECT_MS);
      return;
    }
    es.addEventListener('reload', handleReload);
    es.onerror = function () {
      try { es.close(); } catch (e) {}
      es = null;
      setTimeout(connect, RECONNECT_MS);
    };
  }

  connect();
})();
