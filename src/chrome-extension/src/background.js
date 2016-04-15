chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('html/index.html', {
    'width': 500,
    'height': 400
  });
});
