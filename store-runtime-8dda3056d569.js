/* Source: telegram-web-app.js */
// WebView
(function () {
  var eventHandlers = {};

  var locationHash = '';
  try {
    locationHash = location.hash.toString();
  } catch (e) {}

  var initParams = urlParseHashParams(locationHash);
  var storedParams = sessionStorageGet('initParams');
  if (storedParams) {
    for (var key in storedParams) {
      if (typeof initParams[key] === 'undefined') {
        initParams[key] = storedParams[key];
      }
    }
  }
  sessionStorageSet('initParams', initParams);

  var isIframe = false, iFrameStyle;
  try {
    isIframe = (window.parent != null && window != window.parent);
    if (isIframe) {
      window.addEventListener('message', function (event) {
        if (event.source !== window.parent) return;
        try {
          var dataParsed = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (!dataParsed || !dataParsed.eventType) {
          return;
        }
        if (dataParsed.eventType == 'set_custom_style') {
          if (event.origin === 'https://web.telegram.org') {
            iFrameStyle.innerHTML = dataParsed.eventData;
          }
        } else if (dataParsed.eventType == 'reload_iframe') {
          try {
            window.parent.postMessage(JSON.stringify({eventType: 'iframe_will_reload'}), '*');
          } catch (e) {}
          location.reload();
        } else {
          receiveEvent(dataParsed.eventType, dataParsed.eventData);
        }
      });
      iFrameStyle = document.createElement('style');
      document.head.appendChild(iFrameStyle);
      try {
        window.parent.postMessage(JSON.stringify({eventType: 'iframe_ready', eventData: {reload_supported: true}}), '*');
      } catch (e) {}
    }
  } catch (e) {}

  function urlSafeDecode(urlencoded) {
    try {
      urlencoded = urlencoded.replace(/\+/g, '%20');
      return decodeURIComponent(urlencoded);
    } catch (e) {
      return urlencoded;
    }
  }

  function urlParseHashParams(locationHash) {
    locationHash = locationHash.replace(/^#/, '');
    var params = {};
    if (!locationHash.length) {
      return params;
    }
    if (locationHash.indexOf('=') < 0 && locationHash.indexOf('?') < 0) {
      params._path = urlSafeDecode(locationHash);
      return params;
    }
    var qIndex = locationHash.indexOf('?');
    if (qIndex >= 0) {
      var pathParam = locationHash.substr(0, qIndex);
      params._path = urlSafeDecode(pathParam);
      locationHash = locationHash.substr(qIndex + 1);
    }
    var query_params = urlParseQueryString(locationHash);
    for (var k in query_params) {
      params[k] = query_params[k];
    }
    return params;
  }

  function urlParseQueryString(queryString) {
    var params = {};
    if (!queryString.length) {
      return params;
    }
    var queryStringParams = queryString.split('&');
    var i, param, paramName, paramValue;
    for (i = 0; i < queryStringParams.length; i++) {
      param = queryStringParams[i].split('=');
      paramName = urlSafeDecode(param[0]);
      paramValue = param[1] == null ? null : urlSafeDecode(param[1]);
      params[paramName] = paramValue;
    }
    return params;
  }

  // Telegram apps will implement this logic to add service params (e.g. tgShareScoreUrl) to game URL
  function urlAppendHashParams(url, addHash) {
    // url looks like 'https://game.com/path?query=1#hash'
    // addHash looks like 'tgShareScoreUrl=' + encodeURIComponent('tgb://share_game_score?hash=very_long_hash123')

    var ind = url.indexOf('#');
    if (ind < 0) {
      // https://game.com/path -> https://game.com/path#tgShareScoreUrl=etc
      return url + '#' + addHash;
    }
    var curHash = url.substr(ind + 1);
    if (curHash.indexOf('=') >= 0 || curHash.indexOf('?') >= 0) {
      // https://game.com/#hash=1 -> https://game.com/#hash=1&tgShareScoreUrl=etc
      // https://game.com/#path?query -> https://game.com/#path?query&tgShareScoreUrl=etc
      return url + '&' + addHash;
    }
    // https://game.com/#hash -> https://game.com/#hash?tgShareScoreUrl=etc
    if (curHash.length > 0) {
      return url + '?' + addHash;
    }
    // https://game.com/# -> https://game.com/#tgShareScoreUrl=etc
    return url + addHash;
  }

  function postEvent(eventType, callback, eventData) {
    if (!callback) {
      callback = function () {};
    }
    if (eventData === undefined) {
      eventData = '';
    }
    console.log('[Telegram.WebView] > postEvent', eventType, eventData);

    if (window.TelegramWebviewProxy !== undefined) {
      TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
      callback();
    }
    else if (window.external && 'notify' in window.external) {
      window.external.notify(JSON.stringify({eventType: eventType, eventData: eventData}));
      callback();
    }
    else if (isIframe) {
      try {
        var trustedTarget = 'https://web.telegram.org';
        // For now we don't restrict target, for testing purposes
        trustedTarget = '*';
        window.parent.postMessage(JSON.stringify({eventType: eventType, eventData: eventData}), trustedTarget);
        callback();
      } catch (e) {
        callback(e);
      }
    }
    else {
      callback({notAvailable: true});
    }
  };

  function receiveEvent(eventType, eventData) {
    console.log('[Telegram.WebView] < receiveEvent', eventType, eventData);
    callEventCallbacks(eventType, function(callback) {
      callback(eventType, eventData);
    });
  }

  function callEventCallbacks(eventType, func) {
    var curEventHandlers = eventHandlers[eventType];
    if (curEventHandlers === undefined ||
        !curEventHandlers.length) {
      return;
    }
    for (var i = 0; i < curEventHandlers.length; i++) {
      try {
        func(curEventHandlers[i]);
      } catch (e) {}
    }
  }

  function onEvent(eventType, callback) {
    if (eventHandlers[eventType] === undefined) {
      eventHandlers[eventType] = [];
    }
    var index = eventHandlers[eventType].indexOf(callback);
    if (index === -1) {
      eventHandlers[eventType].push(callback);
    }
  };

  function offEvent(eventType, callback) {
    if (eventHandlers[eventType] === undefined) {
      return;
    }
    var index = eventHandlers[eventType].indexOf(callback);
    if (index === -1) {
      return;
    }
    eventHandlers[eventType].splice(index, 1);
  };

  function openProtoUrl(url) {
    if (!url.match(/^(web\+)?tgb?:\/\/./)) {
      return false;
    }
    var useIframe = navigator.userAgent.match(/iOS|iPhone OS|iPhone|iPod|iPad/i) ? true : false;
    if (useIframe) {
      var iframeContEl = document.getElementById('tgme_frame_cont') || document.body;
      var iframeEl = document.createElement('iframe');
      iframeContEl.appendChild(iframeEl);
      var pageHidden = false;
      var enableHidden = function () {
        pageHidden = true;
      };
      window.addEventListener('pagehide', enableHidden, false);
      window.addEventListener('blur', enableHidden, false);
      if (iframeEl !== null) {
        iframeEl.src = url;
      }
      setTimeout(function() {
        if (!pageHidden) {
          window.location = url;
        }
        window.removeEventListener('pagehide', enableHidden, false);
        window.removeEventListener('blur', enableHidden, false);
      }, 2000);
    }
    else {
      window.location = url;
    }
    return true;
  }

  function sessionStorageSet(key, value) {
    try {
      window.sessionStorage.setItem('__telegram__' + key, JSON.stringify(value));
      return true;
    } catch(e) {}
    return false;
  }
  function sessionStorageGet(key) {
    try {
      return JSON.parse(window.sessionStorage.getItem('__telegram__' + key));
    } catch(e) {}
    return null;
  }

  if (!window.Telegram) {
    window.Telegram = {};
  }
  window.Telegram.WebView = {
    initParams: initParams,
    isIframe: isIframe,
    onEvent: onEvent,
    offEvent: offEvent,
    postEvent: postEvent,
    receiveEvent: receiveEvent,
    callEventCallbacks: callEventCallbacks
  };

  window.Telegram.Utils = {
    urlSafeDecode: urlSafeDecode,
    urlParseQueryString: urlParseQueryString,
    urlParseHashParams: urlParseHashParams,
    urlAppendHashParams: urlAppendHashParams,
    sessionStorageSet: sessionStorageSet,
    sessionStorageGet: sessionStorageGet
  };

  // For Windows Phone app
  window.TelegramGameProxy_receiveEvent = receiveEvent;

  // App backward compatibility
  window.TelegramGameProxy = {
    receiveEvent: receiveEvent
  };
})();

// WebApp
(function () {
  var Utils = window.Telegram.Utils;
  var WebView = window.Telegram.WebView;
  var initParams = WebView.initParams;
  var isIframe = WebView.isIframe;

  var WebApp = {};
  var webAppInitData = '', webAppInitDataUnsafe = {};
  var themeParams = {}, colorScheme = 'light';
  var webAppVersion = '6.0';
  var webAppPlatform = 'unknown';
  var webAppIsActive = true;
  var webAppIsFullscreen = false;
  var webAppIsOrientationLocked = false;
  var webAppBackgroundColor = 'bg_color';
  var webAppHeaderColorKey = 'bg_color';
  var webAppHeaderColor = null;

  if (initParams.tgWebAppData && initParams.tgWebAppData.length) {
    webAppInitData = initParams.tgWebAppData;
    webAppInitDataUnsafe = Utils.urlParseQueryString(webAppInitData);
    for (var key in webAppInitDataUnsafe) {
      var val = webAppInitDataUnsafe[key];
      try {
        if (val.substr(0, 1) == '{' && val.substr(-1) == '}' ||
            val.substr(0, 1) == '[' && val.substr(-1) == ']') {
          webAppInitDataUnsafe[key] = JSON.parse(val);
        }
      } catch (e) {}
    }
  }
  var stored_theme_params = Utils.sessionStorageGet('themeParams');
  if (initParams.tgWebAppThemeParams && initParams.tgWebAppThemeParams.length) {
    var themeParamsRaw = initParams.tgWebAppThemeParams;
    try {
      var theme_params = JSON.parse(themeParamsRaw);
      if (theme_params) {
        setThemeParams(theme_params);
      }
    } catch (e) {}
  }
  if (stored_theme_params) {
    setThemeParams(stored_theme_params);
  }
  var stored_def_colors = Utils.sessionStorageGet('defaultColors');
  if (initParams.tgWebAppDefaultColors && initParams.tgWebAppDefaultColors.length) {
    var defColorsRaw = initParams.tgWebAppDefaultColors;
    try {
      var def_colors = JSON.parse(defColorsRaw);
      if (def_colors) {
        setDefaultColors(def_colors);
      }
    } catch (e) {}
  }
  if (stored_def_colors) {
    setDefaultColors(stored_def_colors);
  }
  if (initParams.tgWebAppVersion) {
    webAppVersion = initParams.tgWebAppVersion;
  }
  if (initParams.tgWebAppPlatform) {
    webAppPlatform = initParams.tgWebAppPlatform;
  }

  var stored_fullscreen = Utils.sessionStorageGet('isFullscreen');
  if (initParams.tgWebAppFullscreen) {
    setFullscreen(true);
  }
  if (stored_fullscreen) {
    setFullscreen(stored_fullscreen == 'yes');
  }

  var stored_orientation_lock = Utils.sessionStorageGet('isOrientationLocked');
  if (stored_orientation_lock) {
    setOrientationLock(stored_orientation_lock == 'yes');
  }

  function onThemeChanged(eventType, eventData) {
    if (eventData.theme_params) {
      setThemeParams(eventData.theme_params);
      window.Telegram.WebApp.MainButton.setParams({});
      window.Telegram.WebApp.SecondaryButton.setParams({});
      updateHeaderColor();
      updateBackgroundColor();
      updateBottomBarColor();
      receiveWebViewEvent('themeChanged');
    }
  }

  var lastWindowHeight = window.innerHeight;
  function onViewportChanged(eventType, eventData) {
    if (eventData.height) {
      window.removeEventListener('resize', onWindowResize);
      setViewportHeight(eventData);
    }
  }

  function onWindowResize(e) {
    if (lastWindowHeight != window.innerHeight) {
      lastWindowHeight = window.innerHeight;
      receiveWebViewEvent('viewportChanged', {
        isStateStable: true
      });
    }
  }

  function onSafeAreaChanged(eventType, eventData) {
    if (eventData) {
      setSafeAreaInset(eventData);
    }
  }
  function onContentSafeAreaChanged(eventType, eventData) {
    if (eventData) {
      setContentSafeAreaInset(eventData);
    }
  }

  function onVisibilityChanged(eventType, eventData) {
    if (eventData.is_visible) {
      webAppIsActive = true;
      receiveWebViewEvent('activated');
    } else {
      webAppIsActive = false;
      receiveWebViewEvent('deactivated');
    }
  }

  function linkHandler(e) {
    if (e.metaKey || e.ctrlKey) return;
    var el = e.target;
    while (el.tagName != 'A' && el.parentNode) {
      el = el.parentNode;
    }
    if (el.tagName == 'A' &&
        el.target != '_blank' &&
        (el.protocol == 'http:' || el.protocol == 'https:') &&
        isTmeHostname(el.hostname)) {
      WebApp.openTelegramLink(el.href);
      e.preventDefault();
    }
  }

  function strTrim(str) {
    return str.toString().replace(/^\s+|\s+$/g, '');
  }

  function isTmeHostname(hostname) {
    hostname = hostname.toString().toLowerCase();
    return hostname == 't.me' || hostname == 'telegram.me';
  }

  function receiveWebViewEvent(eventType) {
    var args = Array.prototype.slice.call(arguments);
    eventType = args.shift();
    WebView.callEventCallbacks('webview:' + eventType, function(callback) {
      callback.apply(WebApp, args);
    });
  }

  function onWebViewEvent(eventType, callback) {
    WebView.onEvent('webview:' + eventType, callback);
  };

  function offWebViewEvent(eventType, callback) {
    WebView.offEvent('webview:' + eventType, callback);
  };

  function setCssProperty(name, value) {
    var root = document.documentElement;
    if (root && root.style && root.style.setProperty) {
      root.style.setProperty('--tg-' + name, value);
    }
  }

  function setFullscreen(is_fullscreen) {
    webAppIsFullscreen = !!is_fullscreen;
    Utils.sessionStorageSet('isFullscreen', webAppIsFullscreen ? 'yes' : 'no');
  }

  function setOrientationLock(is_locked) {
    webAppIsOrientationLocked = !!is_locked;
    Utils.sessionStorageSet('isOrientationLocked', webAppIsOrientationLocked ? 'yes' : 'no');
  }

  function setThemeParams(theme_params) {
    // temp iOS fix
    if (theme_params.bg_color == '#1c1c1d' &&
        theme_params.bg_color == theme_params.secondary_bg_color) {
      theme_params.secondary_bg_color = '#2c2c2e';
    }
    var color;
    for (var key in theme_params) {
      if (color = parseColorToHex(theme_params[key])) {
        themeParams[key] = color;
        if (key == 'bg_color') {
          colorScheme = isColorDark(color) ? 'dark' : 'light'
          setCssProperty('color-scheme', colorScheme);
        }
        key = 'theme-' + key.split('_').join('-');
        setCssProperty(key, color);
      }
    }
    Utils.sessionStorageSet('themeParams', themeParams);
  }

  function setDefaultColors(def_colors) {
    if (colorScheme == 'dark') {
      if (def_colors.bg_dark_color) {
        webAppBackgroundColor = def_colors.bg_dark_color;
      }
      if (def_colors.header_dark_color) {
        webAppHeaderColorKey = null;
        webAppHeaderColor = def_colors.header_dark_color;
      }
    } else {
      if (def_colors.bg_color) {
        webAppBackgroundColor = def_colors.bg_color;
      }
      if (def_colors.header_color) {
        webAppHeaderColorKey = null;
        webAppHeaderColor = def_colors.header_color;
      }
    }
    Utils.sessionStorageSet('defaultColors', def_colors);
  }

  var webAppCallbacks = {};
  function generateCallbackId(len) {
    var tries = 100;
    while (--tries) {
      var id = '', chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', chars_len = chars.length;
      for (var i = 0; i < len; i++) {
        id += chars[Math.floor(Math.random() * chars_len)];
      }
      if (!webAppCallbacks[id]) {
        webAppCallbacks[id] = {};
        return id;
      }
    }
    throw Error('WebAppCallbackIdGenerateFailed');
  }

  var viewportHeight = false, viewportStableHeight = false, isExpanded = true;
  function setViewportHeight(data) {
    if (typeof data !== 'undefined') {
      isExpanded = !!data.is_expanded;
      viewportHeight = data.height;
      if (data.is_state_stable) {
        viewportStableHeight = data.height;
      }
      receiveWebViewEvent('viewportChanged', {
        isStateStable: !!data.is_state_stable
      });
    }
    var height, stable_height;
    if (viewportHeight !== false) {
      height = (viewportHeight - bottomBarHeight) + 'px';
    } else {
      height = bottomBarHeight ? 'calc(100vh - ' + bottomBarHeight + 'px)' : '100vh';
    }
    if (viewportStableHeight !== false) {
      stable_height = (viewportStableHeight - bottomBarHeight) + 'px';
    } else {
      stable_height = bottomBarHeight ? 'calc(100vh - ' + bottomBarHeight + 'px)' : '100vh';
    }
    setCssProperty('viewport-height', height);
    setCssProperty('viewport-stable-height', stable_height);
  }

  var safeAreaInset = {top: 0, bottom: 0, left: 0, right: 0};
  function setSafeAreaInset(data) {
    if (typeof data !== 'undefined') {
      if (typeof data.top !== 'undefined') {
        safeAreaInset.top = data.top;
      }
      if (typeof data.bottom !== 'undefined') {
        safeAreaInset.bottom = data.bottom;
      }
      if (typeof data.left !== 'undefined') {
        safeAreaInset.left = data.left;
      }
      if (typeof data.right !== 'undefined') {
        safeAreaInset.right = data.right;
      }
      receiveWebViewEvent('safeAreaChanged');
    }
    setCssProperty('safe-area-inset-top', safeAreaInset.top + 'px');
    setCssProperty('safe-area-inset-bottom', safeAreaInset.bottom + 'px');
    setCssProperty('safe-area-inset-left', safeAreaInset.left + 'px');
    setCssProperty('safe-area-inset-right', safeAreaInset.right + 'px');
  }

  var contentSafeAreaInset = {top: 0, bottom: 0, left: 0, right: 0};
  function setContentSafeAreaInset(data) {
    if (typeof data !== 'undefined') {
      if (typeof data.top !== 'undefined') {
        contentSafeAreaInset.top = data.top;
      }
      if (typeof data.bottom !== 'undefined') {
        contentSafeAreaInset.bottom = data.bottom;
      }
      if (typeof data.left !== 'undefined') {
        contentSafeAreaInset.left = data.left;
      }
      if (typeof data.right !== 'undefined') {
        contentSafeAreaInset.right = data.right;
      }
      receiveWebViewEvent('contentSafeAreaChanged');
    }
    setCssProperty('content-safe-area-inset-top', contentSafeAreaInset.top + 'px');
    setCssProperty('content-safe-area-inset-bottom', contentSafeAreaInset.bottom + 'px');
    setCssProperty('content-safe-area-inset-left', contentSafeAreaInset.left + 'px');
    setCssProperty('content-safe-area-inset-right', contentSafeAreaInset.right + 'px');
  }

  var isClosingConfirmationEnabled = false;
  function setClosingConfirmation(need_confirmation) {
    if (!versionAtLeast('6.2')) {
      console.warn('[Telegram.WebApp] Closing confirmation is not supported in version ' + webAppVersion);
      return;
    }
    isClosingConfirmationEnabled = !!need_confirmation;
    WebView.postEvent('web_app_setup_closing_behavior', false, {need_confirmation: isClosingConfirmationEnabled});
  }

  var isVerticalSwipesEnabled = true;
  function toggleVerticalSwipes(enable_swipes) {
    if (!versionAtLeast('7.7')) {
      console.warn('[Telegram.WebApp] Changing swipes behavior is not supported in version ' + webAppVersion);
      return;
    }
    isVerticalSwipesEnabled = !!enable_swipes;
    WebView.postEvent('web_app_setup_swipe_behavior', false, {allow_vertical_swipe: isVerticalSwipesEnabled});
  }

  function onFullscreenChanged(eventType, eventData) {
    setFullscreen(eventData.is_fullscreen);
    receiveWebViewEvent('fullscreenChanged');
  }
  function onFullscreenFailed(eventType, eventData) {
    if (eventData.error == 'ALREADY_FULLSCREEN' && !webAppIsFullscreen) {
      setFullscreen(true);
    }
    receiveWebViewEvent('fullscreenFailed', {
      error: eventData.error
    });
  }

  function toggleOrientationLock(locked) {
    if (!versionAtLeast('8.0')) {
      console.warn('[Telegram.WebApp] Orientation locking is not supported in version ' + webAppVersion);
      return;
    }
    setOrientationLock(locked);
    WebView.postEvent('web_app_toggle_orientation_lock', false, {locked: webAppIsOrientationLocked});
  }

  var homeScreenCallbacks = [];
  function onHomeScreenAdded(eventType, eventData) {
    receiveWebViewEvent('homeScreenAdded');
  }
  function onHomeScreenChecked(eventType, eventData) {
    var status = eventData.status || 'unknown';
    if (homeScreenCallbacks.length > 0) {
      for (var i = 0; i < homeScreenCallbacks.length; i++) {
        var callback = homeScreenCallbacks[i];
        callback(status);
      }
      homeScreenCallbacks = [];
    }
    receiveWebViewEvent('homeScreenChecked', {
      status: status
    });
  }

  var WebAppShareMessageOpened = false;
  function onPreparedMessageSent(eventType, eventData) {
    if (WebAppShareMessageOpened) {
      var requestData = WebAppShareMessageOpened;
      WebAppShareMessageOpened = false;
      if (requestData.callback) {
        requestData.callback(true);
      }
      receiveWebViewEvent('shareMessageSent');
    }
  }
  function onPreparedMessageFailed(eventType, eventData) {
    if (WebAppShareMessageOpened) {
      var requestData = WebAppShareMessageOpened;
      WebAppShareMessageOpened = false;
      if (requestData.callback) {
        requestData.callback(false);
      }
      receiveWebViewEvent('shareMessageFailed', {
        error: eventData.error
      });
    }
  }

  var WebAppRequestChatOpened = false;
  function onRequestedChatSent(eventType, eventData) {
    if (WebAppRequestChatOpened) {
      var requestData = WebAppRequestChatOpened;
      WebAppRequestChatOpened = false;
      if (requestData.callback) {
        requestData.callback(true);
      }
      receiveWebViewEvent('requestedChatSent');
    }
  }
  function onRequestedChatFailed(eventType, eventData) {
    if (WebAppRequestChatOpened) {
      var requestData = WebAppRequestChatOpened;
      WebAppRequestChatOpened = false;
      if (requestData.callback) {
        requestData.callback(false);
      }
      receiveWebViewEvent('requestedChatFailed', {
        error: eventData.error
      });
    }
  }

  var WebAppEmojiStatusRequested = false;
  function onEmojiStatusSet(eventType, eventData) {
    if (WebAppEmojiStatusRequested) {
      var requestData = WebAppEmojiStatusRequested;
      WebAppEmojiStatusRequested = false;
      if (requestData.callback) {
        requestData.callback(true);
      }
      receiveWebViewEvent('emojiStatusSet');
    }
  }
  function onEmojiStatusFailed(eventType, eventData) {
    if (WebAppEmojiStatusRequested) {
      var requestData = WebAppEmojiStatusRequested;
      WebAppEmojiStatusRequested = false;
      if (requestData.callback) {
        requestData.callback(false);
      }
      receiveWebViewEvent('emojiStatusFailed', {
        error: eventData.error
      });
    }
  }
  var WebAppEmojiStatusAccessRequested = false;
  function onEmojiStatusAccessRequested(eventType, eventData) {
    if (WebAppEmojiStatusAccessRequested) {
      var requestData = WebAppEmojiStatusAccessRequested;
      WebAppEmojiStatusAccessRequested = false;
      if (requestData.callback) {
        requestData.callback(eventData.status == 'allowed');
      }
      receiveWebViewEvent('emojiStatusAccessRequested', {
        status: eventData.status
      });
    }
  }

  var webAppPopupOpened = false;
  function onPopupClosed(eventType, eventData) {
    if (webAppPopupOpened) {
      var popupData = webAppPopupOpened;
      webAppPopupOpened = false;
      var button_id = null;
      if (typeof eventData.button_id !== 'undefined') {
        button_id = eventData.button_id;
      }
      if (popupData.callback) {
        popupData.callback(button_id);
      }
      receiveWebViewEvent('popupClosed', {
        button_id: button_id
      });
    }
  }


  function getHeaderColor() {
    if (webAppHeaderColorKey == 'secondary_bg_color') {
      return themeParams.secondary_bg_color;
    } else if (webAppHeaderColorKey == 'bg_color') {
      return themeParams.bg_color;
    }
    return webAppHeaderColor;
  }
  function setHeaderColor(color) {
    if (!versionAtLeast('6.1')) {
      console.warn('[Telegram.WebApp] Header color is not supported in version ' + webAppVersion);
      return;
    }
    if (!versionAtLeast('6.9')) {
      if (themeParams.bg_color &&
          themeParams.bg_color == color) {
        color = 'bg_color';
      } else if (themeParams.secondary_bg_color &&
                 themeParams.secondary_bg_color == color) {
        color = 'secondary_bg_color';
      }
    }
    var head_color = null, color_key = null;
    if (color == 'bg_color' || color == 'secondary_bg_color') {
      color_key = color;
    } else if (versionAtLeast('6.9')) {
      head_color = parseColorToHex(color);
      if (!head_color) {
        console.error('[Telegram.WebApp] Header color format is invalid', color);
        throw Error('WebAppHeaderColorInvalid');
      }
    }
    if (!versionAtLeast('6.9') &&
        color_key != 'bg_color' &&
        color_key != 'secondary_bg_color') {
      console.error('[Telegram.WebApp] Header color key should be one of Telegram.WebApp.themeParams.bg_color, Telegram.WebApp.themeParams.secondary_bg_color, \'bg_color\', \'secondary_bg_color\'', color);
      throw Error('WebAppHeaderColorKeyInvalid');
    }
    webAppHeaderColorKey = color_key;
    webAppHeaderColor = head_color;
    updateHeaderColor();
  }
  var appHeaderColorKey = null, appHeaderColor = null;
  function updateHeaderColor() {
    if (appHeaderColorKey != webAppHeaderColorKey ||
        appHeaderColor != webAppHeaderColor) {
      appHeaderColorKey = webAppHeaderColorKey;
      appHeaderColor = webAppHeaderColor;
      if (appHeaderColor) {
        WebView.postEvent('web_app_set_header_color', false, {color: webAppHeaderColor});
      } else {
        WebView.postEvent('web_app_set_header_color', false, {color_key: webAppHeaderColorKey});
      }
    }
  }

  function getBackgroundColor() {
    if (webAppBackgroundColor == 'secondary_bg_color') {
      return themeParams.secondary_bg_color;
    } else if (webAppBackgroundColor == 'bg_color') {
      return themeParams.bg_color;
    }
    return webAppBackgroundColor;
  }
  function setBackgroundColor(color) {
    if (!versionAtLeast('6.1')) {
      console.warn('[Telegram.WebApp] Background color is not supported in version ' + webAppVersion);
      return;
    }
    var bg_color;
    if (color == 'bg_color' || color == 'secondary_bg_color') {
      bg_color = color;
    } else {
      bg_color = parseColorToHex(color);
      if (!bg_color) {
        console.error('[Telegram.WebApp] Background color format is invalid', color);
        throw Error('WebAppBackgroundColorInvalid');
      }
    }
    webAppBackgroundColor = bg_color;
    updateBackgroundColor();
  }
  var appBackgroundColor = null;
  function updateBackgroundColor() {
    var color = getBackgroundColor();
    if (appBackgroundColor != color) {
      appBackgroundColor = color;
      WebView.postEvent('web_app_set_background_color', false, {color: color});
    }
  }

  var bottomBarColor = 'bottom_bar_bg_color';
  function getBottomBarColor() {
    if (bottomBarColor == 'bottom_bar_bg_color') {
      return themeParams.bottom_bar_bg_color || themeParams.secondary_bg_color || '#ffffff';
    } else if (bottomBarColor == 'secondary_bg_color') {
      return themeParams.secondary_bg_color;
    } else if (bottomBarColor == 'bg_color') {
      return themeParams.bg_color;
    }
    return bottomBarColor;
  }
  function setBottomBarColor(color) {
    if (!versionAtLeast('7.10')) {
      console.warn('[Telegram.WebApp] Bottom bar color is not supported in version ' + webAppVersion);
      return;
    }
    var bg_color;
    if (color == 'bg_color' || color == 'secondary_bg_color' || color == 'bottom_bar_bg_color') {
      bg_color = color;
    } else {
      bg_color = parseColorToHex(color);
      if (!bg_color) {
        console.error('[Telegram.WebApp] Bottom bar color format is invalid', color);
        throw Error('WebAppBottomBarColorInvalid');
      }
    }
    bottomBarColor = bg_color;
    updateBottomBarColor();
    window.Telegram.WebApp.SecondaryButton.setParams({});
  }
  var appBottomBarColor = null;
  function updateBottomBarColor() {
    var color = getBottomBarColor();
    if (appBottomBarColor != color) {
      appBottomBarColor = color;
      WebView.postEvent('web_app_set_bottom_bar_color', false, {color: color});
    }
    if (initParams.tgWebAppDebug) {
      updateDebugBottomBar();
    }
  }


  function parseColorToHex(color) {
    color += '';
    var match;
    if (match = /^\s*#([0-9a-f]{6})\s*$/i.exec(color)) {
      return '#' + match[1].toLowerCase();
    }
    else if (match = /^\s*#([0-9a-f])([0-9a-f])([0-9a-f])\s*$/i.exec(color)) {
      return ('#' + match[1] + match[1] + match[2] + match[2] + match[3] + match[3]).toLowerCase();
    }
    else if (match = /^\s*rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)\s*$/.exec(color)) {
      var r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
      r = (r < 16 ? '0' : '') + r.toString(16);
      g = (g < 16 ? '0' : '') + g.toString(16);
      b = (b < 16 ? '0' : '') + b.toString(16);
      return '#' + r + g + b;
    }
    return false;
  }

  function isColorDark(rgb) {
    rgb = rgb.replace(/[\s#]/g, '');
    if (rgb.length == 3) {
      rgb = rgb[0] + rgb[0] + rgb[1] + rgb[1] + rgb[2] + rgb[2];
    }
    var r = parseInt(rgb.substr(0, 2), 16);
    var g = parseInt(rgb.substr(2, 2), 16);
    var b = parseInt(rgb.substr(4, 2), 16);
    var hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    return hsp < 120;
  }

  function versionCompare(v1, v2) {
    if (typeof v1 !== 'string') v1 = '';
    if (typeof v2 !== 'string') v2 = '';
    v1 = v1.replace(/^\s+|\s+$/g, '').split('.');
    v2 = v2.replace(/^\s+|\s+$/g, '').split('.');
    var a = Math.max(v1.length, v2.length), i, p1, p2;
    for (i = 0; i < a; i++) {
      p1 = parseInt(v1[i]) || 0;
      p2 = parseInt(v2[i]) || 0;
      if (p1 == p2) continue;
      if (p1 > p2) return 1;
      return -1;
    }
    return 0;
  }

  function versionAtLeast(ver) {
    return versionCompare(webAppVersion, ver) >= 0;
  }

  function byteLength(str) {
    if (window.Blob) {
      try { return new Blob([str]).size; } catch (e) {}
    }
    var s = str.length;
    for (var i=str.length-1; i>=0; i--) {
      var code = str.charCodeAt(i);
      if (code > 0x7f && code <= 0x7ff) s++;
      else if (code > 0x7ff && code <= 0xffff) s+=2;
      if (code >= 0xdc00 && code <= 0xdfff) i--;
    }
    return s;
  }

  var BackButton = (function() {
    var isVisible = false;

    var backButton = {};
    Object.defineProperty(backButton, 'isVisible', {
      set: function(val){ setParams({is_visible: val}); },
      get: function(){ return isVisible; },
      enumerable: true
    });

    var curButtonState = null;

    WebView.onEvent('back_button_pressed', onBackButtonPressed);

    function onBackButtonPressed() {
      receiveWebViewEvent('backButtonClicked');
    }

    function buttonParams() {
      return {is_visible: isVisible};
    }

    function buttonState(btn_params) {
      if (typeof btn_params === 'undefined') {
        btn_params = buttonParams();
      }
      return JSON.stringify(btn_params);
    }

    function buttonCheckVersion() {
      if (!versionAtLeast('6.1')) {
        console.warn('[Telegram.WebApp] BackButton is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    function updateButton() {
      var btn_params = buttonParams();
      var btn_state = buttonState(btn_params);
      if (curButtonState === btn_state) {
        return;
      }
      curButtonState = btn_state;
      WebView.postEvent('web_app_setup_back_button', false, btn_params);
    }

    function setParams(params) {
      if (!buttonCheckVersion()) {
        return backButton;
      }
      if (typeof params.is_visible !== 'undefined') {
        isVisible = !!params.is_visible;
      }
      updateButton();
      return backButton;
    }

    backButton.onClick = function(callback) {
      if (buttonCheckVersion()) {
        onWebViewEvent('backButtonClicked', callback);
      }
      return backButton;
    };
    backButton.offClick = function(callback) {
      if (buttonCheckVersion()) {
        offWebViewEvent('backButtonClicked', callback);
      }
      return backButton;
    };
    backButton.show = function() {
      return setParams({is_visible: true});
    };
    backButton.hide = function() {
      return setParams({is_visible: false});
    };
    return backButton;
  })();

  var debugBottomBar = null, debugBottomBarBtns = {}, bottomBarHeight = 0;
  if (initParams.tgWebAppDebug) {
    debugBottomBar = document.createElement('tg-bottom-bar');
    var debugBottomBarStyle = {
      display: 'flex',
      gap: '7px',
      font: '600 14px/18px sans-serif',
      width: '100%',
      background: getBottomBarColor(),
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      margin: '0',
      padding: '7px',
      textAlign: 'center',
      boxSizing: 'border-box',
      zIndex: '10000'
    };
    for (var k in debugBottomBarStyle) {
      debugBottomBar.style[k] = debugBottomBarStyle[k];
    }
    document.addEventListener('DOMContentLoaded', function onDomLoaded(event) {
      document.removeEventListener('DOMContentLoaded', onDomLoaded);
      document.body.appendChild(debugBottomBar);
    });
    var animStyle = document.createElement('style');
    animStyle.innerHTML = 'tg-bottom-button.shine { position: relative; overflow: hidden; } tg-bottom-button.shine:before { content:""; position: absolute; top: 0; width: 100%; height: 100%; background: linear-gradient(120deg, transparent, rgba(255, 255, 255, .2), transparent); animation: tg-bottom-button-shine 5s ease-in-out infinite; } @-webkit-keyframes tg-bottom-button-shine { 0% {left: -100%;} 12%,100% {left: 100%}} @keyframes tg-bottom-button-shine { 0% {left: -100%;} 12%,100% {left: 100%}}';
    debugBottomBar.appendChild(animStyle);
  }
  function updateDebugBottomBar() {
    var mainBtn = debugBottomBarBtns.main._bottomButton;
    var secondaryBtn = debugBottomBarBtns.secondary._bottomButton;
    if (mainBtn.isVisible || secondaryBtn.isVisible) {
      debugBottomBar.style.display = 'flex';
      bottomBarHeight = 58;
      if (mainBtn.isVisible && secondaryBtn.isVisible) {
        if (secondaryBtn.position == 'top') {
          debugBottomBar.style.flexDirection = 'column-reverse';
          bottomBarHeight += 51;
        } else if (secondaryBtn.position == 'bottom') {
          debugBottomBar.style.flexDirection = 'column';
          bottomBarHeight += 51;
        } else if (secondaryBtn.position == 'left') {
          debugBottomBar.style.flexDirection = 'row-reverse';
        } else if (secondaryBtn.position == 'right') {
          debugBottomBar.style.flexDirection = 'row';
        }
      }
    } else {
      debugBottomBar.style.display = 'none';
      bottomBarHeight = 0;
    }
    debugBottomBar.style.background = getBottomBarColor();
    if (document.documentElement) {
      document.documentElement.style.boxSizing = 'border-box';
      document.documentElement.style.paddingBottom = bottomBarHeight + 'px';
    }
    setViewportHeight();
  }


  var BottomButtonConstructor = function(type) {
    var isMainButton = (type == 'main');
    if (isMainButton) {
      var setupFnName = 'web_app_setup_main_button';
      var tgEventName = 'main_button_pressed';
      var webViewEventName = 'mainButtonClicked';
      var buttonTextDefault = 'Continue';
      var buttonColorDefault = function(){ return themeParams.button_color || '#2481cc'; };
      var buttonTextColorDefault = function(){ return themeParams.button_text_color || '#ffffff'; };
    } else {
      var setupFnName = 'web_app_setup_secondary_button';
      var tgEventName = 'secondary_button_pressed';
      var webViewEventName = 'secondaryButtonClicked';
      var buttonTextDefault = 'Cancel';
      var buttonColorDefault = function(){ return getBottomBarColor(); };
      var buttonTextColorDefault = function(){ return themeParams.button_color || '#2481cc'; };
    }

    var isVisible = false;
    var isActive = true;
    var hasShineEffect = false;
    var isProgressVisible = false;
    var iconCustomEmojiId = false;
    var buttonType = type;
    var buttonText = buttonTextDefault;
    var buttonColor = false;
    var buttonTextColor = false;
    var buttonPosition = 'left';

    var bottomButton = {};
    Object.defineProperty(bottomButton, 'type', {
      get: function(){ return buttonType; },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'iconCustomEmojiId', {
      set: function(val){ bottomButton.setParams({icon_custom_emoji_id: val}); },
      get: function(){ return iconCustomEmojiId; },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'text', {
      set: function(val){ bottomButton.setParams({text: val}); },
      get: function(){ return buttonText; },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'color', {
      set: function(val){ bottomButton.setParams({color: val}); },
      get: function(){ return buttonColor || buttonColorDefault(); },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'textColor', {
      set: function(val){ bottomButton.setParams({text_color: val}); },
      get: function(){ return buttonTextColor || buttonTextColorDefault(); },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'isVisible', {
      set: function(val){ bottomButton.setParams({is_visible: val}); },
      get: function(){ return isVisible; },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'isProgressVisible', {
      get: function(){ return isProgressVisible; },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'isActive', {
      set: function(val){ bottomButton.setParams({is_active: val}); },
      get: function(){ return isActive; },
      enumerable: true
    });
    Object.defineProperty(bottomButton, 'hasShineEffect', {
      set: function(val){ bottomButton.setParams({has_shine_effect: val}); },
      get: function(){ return hasShineEffect; },
      enumerable: true
    });
    if (!isMainButton) {
      Object.defineProperty(bottomButton, 'position', {
        set: function(val){ bottomButton.setParams({position: val}); },
        get: function(){ return buttonPosition; },
        enumerable: true
      });
    }

    var curButtonState = null;

    WebView.onEvent(tgEventName, onBottomButtonPressed);

    var debugBtn = null;
    if (initParams.tgWebAppDebug) {
      debugBtn = document.createElement('tg-bottom-button');
      var debugBtnStyle = {
        display: 'none',
        width: '100%',
        height: '44px',
        borderRadius: '0',
        background: 'no-repeat right center',
        padding: '13px 15px',
        textAlign: 'center',
        boxSizing: 'border-box'
      };
      for (var k in debugBtnStyle) {
        debugBtn.style[k] = debugBtnStyle[k];
      }
      debugBottomBar.appendChild(debugBtn);
      debugBtn.addEventListener('click', onBottomButtonPressed, false);
      debugBtn._bottomButton = bottomButton;
      debugBottomBarBtns[type] = debugBtn;
    }

    function onBottomButtonPressed() {
      if (isActive) {
        receiveWebViewEvent(webViewEventName);
      }
    }

    function buttonParams() {
      var color = bottomButton.color;
      var text_color = bottomButton.textColor;
      if (isVisible) {
        var params = {
          is_visible: true,
          is_active: isActive,
          is_progress_visible: isProgressVisible,
          icon_custom_emoji_id: iconCustomEmojiId,
          text: buttonText,
          color: color,
          text_color: text_color,
          has_shine_effect: hasShineEffect && isActive && !isProgressVisible
        };
        if (!isMainButton) {
          params.position = buttonPosition;
        }
      } else {
        var params = {
          is_visible: false
        };
      }
      return params;
    }

    function buttonState(btn_params) {
      if (typeof btn_params === 'undefined') {
        btn_params = buttonParams();
      }
      return JSON.stringify(btn_params);
    }

    function updateButton() {
      var btn_params = buttonParams();
      var btn_state = buttonState(btn_params);
      if (curButtonState === btn_state) {
        return;
      }
      curButtonState = btn_state;
      WebView.postEvent(setupFnName, false, btn_params);
      if (initParams.tgWebAppDebug) {
        updateDebugButton(btn_params);
      }
    }

    function updateDebugButton(btn_params) {
      if (btn_params.is_visible) {
        debugBtn.style.display = 'block';

        debugBtn.style.opacity = btn_params.is_active ? '1' : '0.8';
        debugBtn.style.cursor = btn_params.is_active ? 'pointer' : 'auto';
        debugBtn.disabled = !btn_params.is_active;
        debugBtn.innerText = btn_params.text;
        debugBtn.className = btn_params.has_shine_effect ? 'shine' : '';
        debugBtn.style.backgroundImage = btn_params.is_progress_visible ? "url('data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewport="0 0 48 48" width="48px" height="48px"><circle cx="50%" cy="50%" stroke="' + btn_params.text_color + '" stroke-width="2.25" stroke-linecap="round" fill="none" stroke-dashoffset="106" r="9" stroke-dasharray="56.52" rotate="-90"><animate attributeName="stroke-dashoffset" attributeType="XML" dur="360s" from="0" to="12500" repeatCount="indefinite"></animate><animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="-90 24 24" to="630 24 24" repeatCount="indefinite"></animateTransform></circle></svg>') + "')" : 'none';
        debugBtn.style.backgroundColor = btn_params.color;
        debugBtn.style.color = btn_params.text_color;
      } else {
        debugBtn.style.display = 'none';
      }
      updateDebugBottomBar();
    }

    function setParams(params) {
      if (typeof params.icon_custom_emoji_id !== 'undefined') {
        var emoji_id = params.icon_custom_emoji_id;
        if (emoji_id === false || emoji_id === null) {
          emoji_id = '';
        }
        if (emoji_id !== '' && !/^[0-9]{10,20}$/.test(emoji_id)) {
          console.error('[Telegram.WebApp] Bottom button icon custom emoji is invalid', params.icon_custom_emoji_id);
          throw Error('WebAppBottomButtonParamInvalid');
        }
        iconCustomEmojiId = emoji_id;
      }
      if (typeof params.text !== 'undefined') {
        var text = strTrim(params.text);
        if (!text.length && !iconCustomEmojiId) {
          console.error('[Telegram.WebApp] Bottom button text is required', params.text);
          throw Error('WebAppBottomButtonParamInvalid');
        }
        if (text.length > 64) {
          console.error('[Telegram.WebApp] Bottom button text is too long', text);
          throw Error('WebAppBottomButtonParamInvalid');
        }
        buttonText = text;
      }
      if (typeof params.color !== 'undefined') {
        if (params.color === false ||
            params.color === null) {
          buttonColor = false;
        } else {
          var color = parseColorToHex(params.color);
          if (!color) {
            console.error('[Telegram.WebApp] Bottom button color format is invalid', params.color);
            throw Error('WebAppBottomButtonParamInvalid');
          }
          buttonColor = color;
        }
      }
      if (typeof params.text_color !== 'undefined') {
        if (params.text_color === false ||
            params.text_color === null) {
          buttonTextColor = false;
        } else {
          var text_color = parseColorToHex(params.text_color);
          if (!text_color) {
            console.error('[Telegram.WebApp] Bottom button text color format is invalid', params.text_color);
            throw Error('WebAppBottomButtonParamInvalid');
          }
          buttonTextColor = text_color;
        }
      }
      if (typeof params.is_visible !== 'undefined') {
        if (params.is_visible &&
            !bottomButton.text.length) {
          console.error('[Telegram.WebApp] Bottom button text is required');
          throw Error('WebAppBottomButtonParamInvalid');
        }
        isVisible = !!params.is_visible;
      }
      if (typeof params.has_shine_effect !== 'undefined') {
        hasShineEffect = !!params.has_shine_effect;
      }
      if (!isMainButton && typeof params.position !== 'undefined') {
        if (params.position != 'left' && params.position != 'right' &&
            params.position != 'top' && params.position != 'bottom') {
          console.error('[Telegram.WebApp] Bottom button posiition is invalid', params.position);
          throw Error('WebAppBottomButtonParamInvalid');
        }
        buttonPosition = params.position;
      }
      if (typeof params.is_active !== 'undefined') {
        isActive = !!params.is_active;
      }
      updateButton();
      return bottomButton;
    }

    bottomButton.setText = function(text) {
      return bottomButton.setParams({text: text});
    };
    bottomButton.onClick = function(callback) {
      onWebViewEvent(webViewEventName, callback);
      return bottomButton;
    };
    bottomButton.offClick = function(callback) {
      offWebViewEvent(webViewEventName, callback);
      return bottomButton;
    };
    bottomButton.show = function() {
      return bottomButton.setParams({is_visible: true});
    };
    bottomButton.hide = function() {
      return bottomButton.setParams({is_visible: false});
    };
    bottomButton.enable = function() {
      return bottomButton.setParams({is_active: true});
    };
    bottomButton.disable = function() {
      return bottomButton.setParams({is_active: false});
    };
    bottomButton.showProgress = function(leaveActive) {
      isActive = !!leaveActive;
      isProgressVisible = true;
      updateButton();
      return bottomButton;
    };
    bottomButton.hideProgress = function() {
      if (!bottomButton.isActive) {
        isActive = true;
      }
      isProgressVisible = false;
      updateButton();
      return bottomButton;
    }
    bottomButton.setParams = setParams;
    return bottomButton;
  };
  var MainButton = BottomButtonConstructor('main');
  var SecondaryButton = BottomButtonConstructor('secondary');

  var SettingsButton = (function() {
    var isVisible = false;

    var settingsButton = {};
    Object.defineProperty(settingsButton, 'isVisible', {
      set: function(val){ setParams({is_visible: val}); },
      get: function(){ return isVisible; },
      enumerable: true
    });

    var curButtonState = null;

    WebView.onEvent('settings_button_pressed', onSettingsButtonPressed);

    function onSettingsButtonPressed() {
      receiveWebViewEvent('settingsButtonClicked');
    }

    function buttonParams() {
      return {is_visible: isVisible};
    }

    function buttonState(btn_params) {
      if (typeof btn_params === 'undefined') {
        btn_params = buttonParams();
      }
      return JSON.stringify(btn_params);
    }

    function buttonCheckVersion() {
      if (!versionAtLeast('6.10')) {
        console.warn('[Telegram.WebApp] SettingsButton is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    function updateButton() {
      var btn_params = buttonParams();
      var btn_state = buttonState(btn_params);
      if (curButtonState === btn_state) {
        return;
      }
      curButtonState = btn_state;
      WebView.postEvent('web_app_setup_settings_button', false, btn_params);
    }

    function setParams(params) {
      if (!buttonCheckVersion()) {
        return settingsButton;
      }
      if (typeof params.is_visible !== 'undefined') {
        isVisible = !!params.is_visible;
      }
      updateButton();
      return settingsButton;
    }

    settingsButton.onClick = function(callback) {
      if (buttonCheckVersion()) {
        onWebViewEvent('settingsButtonClicked', callback);
      }
      return settingsButton;
    };
    settingsButton.offClick = function(callback) {
      if (buttonCheckVersion()) {
        offWebViewEvent('settingsButtonClicked', callback);
      }
      return settingsButton;
    };
    settingsButton.show = function() {
      return setParams({is_visible: true});
    };
    settingsButton.hide = function() {
      return setParams({is_visible: false});
    };
    return settingsButton;
  })();

  var HapticFeedback = (function() {
    var hapticFeedback = {};

    function triggerFeedback(params) {
      if (!versionAtLeast('6.1')) {
        console.warn('[Telegram.WebApp] HapticFeedback is not supported in version ' + webAppVersion);
        return hapticFeedback;
      }
      if (params.type == 'impact') {
        if (params.impact_style != 'light' &&
            params.impact_style != 'medium' &&
            params.impact_style != 'heavy' &&
            params.impact_style != 'rigid' &&
            params.impact_style != 'soft') {
          console.error('[Telegram.WebApp] Haptic impact style is invalid', params.impact_style);
          throw Error('WebAppHapticImpactStyleInvalid');
        }
      } else if (params.type == 'notification') {
        if (params.notification_type != 'error' &&
            params.notification_type != 'success' &&
            params.notification_type != 'warning') {
          console.error('[Telegram.WebApp] Haptic notification type is invalid', params.notification_type);
          throw Error('WebAppHapticNotificationTypeInvalid');
        }
      } else if (params.type == 'selection_change') {
        // no params needed
      } else {
        console.error('[Telegram.WebApp] Haptic feedback type is invalid', params.type);
        throw Error('WebAppHapticFeedbackTypeInvalid');
      }
      WebView.postEvent('web_app_trigger_haptic_feedback', false, params);
      return hapticFeedback;
    }

    hapticFeedback.impactOccurred = function(style) {
      return triggerFeedback({type: 'impact', impact_style: style});
    };
    hapticFeedback.notificationOccurred = function(type) {
      return triggerFeedback({type: 'notification', notification_type: type});
    };
    hapticFeedback.selectionChanged = function() {
      return triggerFeedback({type: 'selection_change'});
    };
    return hapticFeedback;
  })();

  var CloudStorage = (function() {
    var cloudStorage = {};

    function invokeStorageMethod(method, params, callback) {
      if (!versionAtLeast('6.9')) {
        console.error('[Telegram.WebApp] CloudStorage is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      invokeCustomMethod(method, params, callback);
      return cloudStorage;
    }

    cloudStorage.setItem = function(key, value, callback) {
      return invokeStorageMethod('saveStorageValue', {key: key, value: value}, callback);
    };
    cloudStorage.getItem = function(key, callback) {
      return cloudStorage.getItems([key], callback ? function(err, res) {
        if (err) callback(err);
        else callback(null, res[key]);
      } : null);
    };
    cloudStorage.getItems = function(keys, callback) {
      return invokeStorageMethod('getStorageValues', {keys: keys}, callback);
    };
    cloudStorage.removeItem = function(key, callback) {
      return cloudStorage.removeItems([key], callback);
    };
    cloudStorage.removeItems = function(keys, callback) {
      return invokeStorageMethod('deleteStorageValues', {keys: keys}, callback);
    };
    cloudStorage.getKeys = function(callback) {
      return invokeStorageMethod('getStorageKeys', {}, callback);
    };
    return cloudStorage;
  })();

  var DeviceStorage = (function() {
    var deviceStorage = {};

    WebView.onEvent('device_storage_key_saved',  onDeviceStorageEvent);
    WebView.onEvent('device_storage_key_received', onDeviceStorageEvent);
    WebView.onEvent('device_storage_cleared',  onDeviceStorageEvent);
    WebView.onEvent('device_storage_failed',  onDeviceStorageEvent);

    function onDeviceStorageEvent(eventType, eventData) {
      if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
        var requestData = webAppCallbacks[eventData.req_id];
        delete webAppCallbacks[eventData.req_id];
        var res = null, err = null;
        if (eventType == 'device_storage_failed') {
          err = eventData.error || 'UNKNOWN_ERROR';
        } else if (eventType == 'device_storage_key_received') {
          res = eventData.value;
        } else {
          res = true;
        }
        if (requestData.callback) {
          requestData.callback(err, res);
        }
      }
    }

    function invokeStorageMethod(method, params, callback) {
      if (!versionAtLeast('9.0')) {
        console.error('[Telegram.WebApp] DeviceStorage is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      var req_id = generateCallbackId(16);
      var req_params = {req_id: req_id};
      for (var k in params) {
        req_params[k] = params[k];
      }
      webAppCallbacks[req_id] = {
        callback: callback
      };
      WebView.postEvent(method, false, req_params);
      return deviceStorage;
    }

    deviceStorage.setItem = function(key, value, callback) {
      return invokeStorageMethod('web_app_device_storage_save_key', {key: key, value: value}, callback);
    };
    deviceStorage.getItem = function(key, callback) {
      return invokeStorageMethod('web_app_device_storage_get_key', {key: key}, callback);
    };
    deviceStorage.removeItem = function(key, callback) {
      return invokeStorageMethod('web_app_device_storage_save_key', {key: key, value: null}, callback);
    };
    deviceStorage.clear = function(callback) {
      return invokeStorageMethod('web_app_device_storage_clear', {}, callback);
    };
    return deviceStorage;
  })();

  var SecureStorage = (function() {
    var secureStorage = {};

    WebView.onEvent('secure_storage_key_saved',  onSecureStorageEvent);
    WebView.onEvent('secure_storage_key_received', onSecureStorageEvent);
    WebView.onEvent('secure_storage_key_restored', onSecureStorageEvent);
    WebView.onEvent('secure_storage_cleared',  onSecureStorageEvent);
    WebView.onEvent('secure_storage_failed',  onSecureStorageEvent);

    function onSecureStorageEvent(eventType, eventData) {
      if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
        var requestData = webAppCallbacks[eventData.req_id];
        delete webAppCallbacks[eventData.req_id];
        var res = null, err = null, can_restore = null;
        if (eventType == 'secure_storage_failed') {
          err = eventData.error || 'UNKNOWN_ERROR';
        } else if (eventType == 'secure_storage_key_received') {
          res = eventData.value;
          if (eventData.can_restore) {
            can_restore = true;
          }
        } else if (eventType == 'secure_storage_key_restored') {
          res = eventData.value;
        } else {
          res = true;
        }
        if (requestData.callback) {
          requestData.callback(err, res, can_restore);
        }
      }
    }

    function invokeStorageMethod(method, params, callback) {
      if (!versionAtLeast('9.0')) {
        console.error('[Telegram.WebApp] SecureStorage is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      var req_id = generateCallbackId(16);
      var req_params = {req_id: req_id};
      for (var k in params) {
        req_params[k] = params[k];
      }
      webAppCallbacks[req_id] = {
        callback: callback
      };
      WebView.postEvent(method, false, req_params);
      return secureStorage;
    }

    secureStorage.setItem = function(key, value, callback) {
      return invokeStorageMethod('web_app_secure_storage_save_key', {key: key, value: value}, callback);
    };
    secureStorage.getItem = function(key, callback) {
      return invokeStorageMethod('web_app_secure_storage_get_key', {key: key}, callback);
    };
    secureStorage.restoreItem = function(key, callback) {
      return invokeStorageMethod('web_app_secure_storage_restore_key', {key: key}, callback);
    };
    secureStorage.removeItem = function(key, callback) {
      return invokeStorageMethod('web_app_secure_storage_save_key', {key: key, value: null}, callback);
    };
    secureStorage.clear = function(callback) {
      return invokeStorageMethod('web_app_secure_storage_clear', {}, callback);
    };
    return secureStorage;
  })();

  var BiometricManager = (function() {
    var isInited = false;
    var isBiometricAvailable = false;
    var biometricType = 'unknown';
    var isAccessRequested = false;
    var isAccessGranted = false;
    var isBiometricTokenSaved = false;
    var deviceId = '';

    var biometricManager = {};
    Object.defineProperty(biometricManager, 'isInited', {
      get: function(){ return isInited; },
      enumerable: true
    });
    Object.defineProperty(biometricManager, 'isBiometricAvailable', {
      get: function(){ return isInited && isBiometricAvailable; },
      enumerable: true
    });
    Object.defineProperty(biometricManager, 'biometricType', {
      get: function(){ return biometricType || 'unknown'; },
      enumerable: true
    });
    Object.defineProperty(biometricManager, 'isAccessRequested', {
      get: function(){ return isAccessRequested; },
      enumerable: true
    });
    Object.defineProperty(biometricManager, 'isAccessGranted', {
      get: function(){ return isAccessRequested && isAccessGranted; },
      enumerable: true
    });
    Object.defineProperty(biometricManager, 'isBiometricTokenSaved', {
      get: function(){ return isBiometricTokenSaved; },
      enumerable: true
    });
    Object.defineProperty(biometricManager, 'deviceId', {
      get: function(){ return deviceId || ''; },
      enumerable: true
    });

    var initRequestState = {callbacks: []};
    var accessRequestState = false;
    var authRequestState = false;
    var tokenRequestState = false;

    WebView.onEvent('biometry_info_received',  onBiometryInfoReceived);
    WebView.onEvent('biometry_auth_requested', onBiometryAuthRequested);
    WebView.onEvent('biometry_token_updated',  onBiometryTokenUpdated);

    function onBiometryInfoReceived(eventType, eventData) {
      isInited = true;
      if (eventData.available) {
        isBiometricAvailable = true;
        biometricType = eventData.type || 'unknown';
        if (eventData.access_requested) {
          isAccessRequested = true;
          isAccessGranted = !!eventData.access_granted;
          isBiometricTokenSaved = !!eventData.token_saved;
        } else {
          isAccessRequested = false;
          isAccessGranted = false;
          isBiometricTokenSaved = false;
        }
      } else {
        isBiometricAvailable = false;
        biometricType = 'unknown';
        isAccessRequested = false;
        isAccessGranted = false;
        isBiometricTokenSaved = false;
      }
      deviceId = eventData.device_id || '';

      if (initRequestState.callbacks.length > 0) {
        for (var i = 0; i < initRequestState.callbacks.length; i++) {
          var callback = initRequestState.callbacks[i];
          callback();
        }
        initRequestState.callbacks = [];
      }
      if (accessRequestState) {
        var state = accessRequestState;
        accessRequestState = false;
        if (state.callback) {
          state.callback(isAccessGranted);
        }
      }
      receiveWebViewEvent('biometricManagerUpdated');
    }
    function onBiometryAuthRequested(eventType, eventData) {
      var isAuthenticated = (eventData.status == 'authorized'),
          biometricToken = eventData.token || '';
      if (authRequestState) {
        var state = authRequestState;
        authRequestState = false;
        if (state.callback) {
          state.callback(isAuthenticated, isAuthenticated ? biometricToken : null);
        }
      }
      receiveWebViewEvent('biometricAuthRequested', isAuthenticated ? {
        isAuthenticated: true,
        biometricToken: biometricToken
      } : {
        isAuthenticated: false
      });
    }
    function onBiometryTokenUpdated(eventType, eventData) {
      var applied = false;
      if (isBiometricAvailable &&
          isAccessRequested) {
        if (eventData.status == 'updated') {
          isBiometricTokenSaved = true;
          applied = true;
        }
        else if (eventData.status == 'removed') {
          isBiometricTokenSaved = false;
          applied = true;
        }
      }
      if (tokenRequestState) {
        var state = tokenRequestState;
        tokenRequestState = false;
        if (state.callback) {
          state.callback(applied);
        }
      }
      receiveWebViewEvent('biometricTokenUpdated', {
        isUpdated: applied
      });
    }

    function checkVersion() {
      if (!versionAtLeast('7.2')) {
        console.warn('[Telegram.WebApp] BiometricManager is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    function checkInit() {
      if (!isInited) {
        console.error('[Telegram.WebApp] BiometricManager should be inited before using.');
        throw Error('WebAppBiometricManagerNotInited');
      }
      return true;
    }

    biometricManager.init = function(callback) {
      if (!checkVersion()) {
        return biometricManager;
      }
      if (isInited) {
        return biometricManager;
      }
      if (callback) {
        initRequestState.callbacks.push(callback);
      }
      WebView.postEvent('web_app_biometry_get_info', false);
      return biometricManager;
    };
    biometricManager.requestAccess = function(params, callback) {
      if (!checkVersion()) {
        return biometricManager;
      }
      checkInit();
      if (!isBiometricAvailable) {
        console.error('[Telegram.WebApp] Biometrics is not available on this device.');
        throw Error('WebAppBiometricManagerBiometricsNotAvailable');
      }
      if (accessRequestState) {
        console.error('[Telegram.WebApp] Access is already requested');
        throw Error('WebAppBiometricManagerAccessRequested');
      }
      var popup_params = {};
      if (typeof params.reason !== 'undefined') {
        var reason = strTrim(params.reason);
        if (reason.length > 128) {
          console.error('[Telegram.WebApp] Biometric reason is too long', reason);
          throw Error('WebAppBiometricRequestAccessParamInvalid');
        }
        if (reason.length > 0) {
          popup_params.reason = reason;
        }
      }

      accessRequestState = {
        callback: callback
      };
      WebView.postEvent('web_app_biometry_request_access', false, popup_params);
      return biometricManager;
    };
    biometricManager.authenticate = function(params, callback) {
      if (!checkVersion()) {
        return biometricManager;
      }
      checkInit();
      if (!isBiometricAvailable) {
        console.error('[Telegram.WebApp] Biometrics is not available on this device.');
        throw Error('WebAppBiometricManagerBiometricsNotAvailable');
      }
      if (!isAccessGranted) {
        console.error('[Telegram.WebApp] Biometric access was not granted by the user.');
        throw Error('WebAppBiometricManagerBiometricAccessNotGranted');
      }
      if (authRequestState) {
        console.error('[Telegram.WebApp] Authentication request is already in progress.');
        throw Error('WebAppBiometricManagerAuthenticationRequested');
      }
      var popup_params = {};
      if (typeof params.reason !== 'undefined') {
        var reason = strTrim(params.reason);
        if (reason.length > 128) {
          console.error('[Telegram.WebApp] Biometric reason is too long', reason);
          throw Error('WebAppBiometricRequestAccessParamInvalid');
        }
        if (reason.length > 0) {
          popup_params.reason = reason;
        }
      }

      authRequestState = {
        callback: callback
      };
      WebView.postEvent('web_app_biometry_request_auth', false, popup_params);
      return biometricManager;
    };
    biometricManager.updateBiometricToken = function(token, callback) {
      if (!checkVersion()) {
        return biometricManager;
      }
      token = token || '';
      if (token.length > 1024) {
        console.error('[Telegram.WebApp] Token is too long', token);
        throw Error('WebAppBiometricManagerTokenInvalid');
      }
      checkInit();
      if (!isBiometricAvailable) {
        console.error('[Telegram.WebApp] Biometrics is not available on this device.');
        throw Error('WebAppBiometricManagerBiometricsNotAvailable');
      }
      if (!isAccessGranted) {
        console.error('[Telegram.WebApp] Biometric access was not granted by the user.');
        throw Error('WebAppBiometricManagerBiometricAccessNotGranted');
      }
      if (tokenRequestState) {
        console.error('[Telegram.WebApp] Token request is already in progress.');
        throw Error('WebAppBiometricManagerTokenUpdateRequested');
      }
      tokenRequestState = {
        callback: callback
      };
      WebView.postEvent('web_app_biometry_update_token', false, {token: token});
      return biometricManager;
    };
    biometricManager.openSettings = function() {
      if (!checkVersion()) {
        return biometricManager;
      }
      checkInit();
      if (!isBiometricAvailable) {
        console.error('[Telegram.WebApp] Biometrics is not available on this device.');
        throw Error('WebAppBiometricManagerBiometricsNotAvailable');
      }
      if (!isAccessRequested) {
        console.error('[Telegram.WebApp] Biometric access was not requested yet.');
        throw Error('WebAppBiometricManagerBiometricsAccessNotRequested');
      }
      if (isAccessGranted) {
        console.warn('[Telegram.WebApp] Biometric access was granted by the user, no need to go to settings.');
        return biometricManager;
      }
      WebView.postEvent('web_app_biometry_open_settings', false);
      return biometricManager;
    };
    return biometricManager;
  })();

  var LocationManager = (function() {
    var isInited = false;
    var isLocationAvailable = false;
    var isAccessRequested = false;
    var isAccessGranted = false;

    var locationManager = {};
    Object.defineProperty(locationManager, 'isInited', {
      get: function(){ return isInited; },
      enumerable: true
    });
    Object.defineProperty(locationManager, 'isLocationAvailable', {
      get: function(){ return isInited && isLocationAvailable; },
      enumerable: true
    });
    Object.defineProperty(locationManager, 'isAccessRequested', {
      get: function(){ return isAccessRequested; },
      enumerable: true
    });
    Object.defineProperty(locationManager, 'isAccessGranted', {
      get: function(){ return isAccessRequested && isAccessGranted; },
      enumerable: true
    });

    var initRequestState = {callbacks: []};
    var getRequestState = {callbacks: []};

    WebView.onEvent('location_checked',  onLocationChecked);
    WebView.onEvent('location_requested', onLocationRequested);

    function onLocationChecked(eventType, eventData) {
      isInited = true;
      if (eventData.available) {
        isLocationAvailable = true;
        if (eventData.access_requested) {
          isAccessRequested = true;
          isAccessGranted = !!eventData.access_granted;
        } else {
          isAccessRequested = false;
          isAccessGranted = false;
        }
      } else {
        isLocationAvailable = false;
        isAccessRequested = false;
        isAccessGranted = false;
      }

      if (initRequestState.callbacks.length > 0) {
        for (var i = 0; i < initRequestState.callbacks.length; i++) {
          var callback = initRequestState.callbacks[i];
          callback();
        }
        initRequestState.callbacks = [];
      }
      receiveWebViewEvent('locationManagerUpdated');
    }
    function onLocationRequested(eventType, eventData) {
      if (!eventData.available) {
        locationData = null;
      } else {
        var locationData = {
          latitude: eventData.latitude,
          longitude: eventData.longitude,
          altitude: null,
          course: null,
          speed: null,
          horizontal_accuracy: null,
          vertical_accuracy: null,
          course_accuracy: null,
          speed_accuracy: null,
        };
        if (typeof eventData.altitude !== 'undefined' && eventData.altitude !== null) {
          locationData.altitude = eventData.altitude;
        }
        if (typeof eventData.course !== 'undefined' && eventData.course !== null) {
          locationData.course = eventData.course % 360;
        }
        if (typeof eventData.speed !== 'undefined' && eventData.speed !== null) {
          locationData.speed = eventData.speed;
        }
        if (typeof eventData.horizontal_accuracy !== 'undefined' && eventData.horizontal_accuracy !== null) {
          locationData.horizontal_accuracy = eventData.horizontal_accuracy;
        }
        if (typeof eventData.vertical_accuracy !== 'undefined' && eventData.vertical_accuracy !== null) {
          locationData.vertical_accuracy = eventData.vertical_accuracy;
        }
        if (typeof eventData.course_accuracy !== 'undefined' && eventData.course_accuracy !== null) {
          locationData.course_accuracy = eventData.course_accuracy;
        }
        if (typeof eventData.speed_accuracy !== 'undefined' && eventData.speed_accuracy !== null) {
          locationData.speed_accuracy = eventData.speed_accuracy;
        }
      }
      if (!eventData.available ||
          !isLocationAvailable ||
          !isAccessRequested ||
          !isAccessGranted) {
        initRequestState.callbacks.push(function() {
          locationResponse(locationData);
        });
        WebView.postEvent('web_app_check_location', false);
      } else {
        locationResponse(locationData);
      }
    }
    function locationResponse(response) {
      if (getRequestState.callbacks.length > 0) {
        for (var i = 0; i < getRequestState.callbacks.length; i++) {
          var callback = getRequestState.callbacks[i];
          callback(response);
        }
        getRequestState.callbacks = [];
      }
      if (response !== null) {
        receiveWebViewEvent('locationRequested', {
          locationData: response
        });
      }
    }

    function checkVersion() {
      if (!versionAtLeast('8.0')) {
        console.warn('[Telegram.WebApp] LocationManager is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    function checkInit() {
      if (!isInited) {
        console.error('[Telegram.WebApp] LocationManager should be inited before using.');
        throw Error('WebAppLocationManagerNotInited');
      }
      return true;
    }

    locationManager.init = function(callback) {
      if (!checkVersion()) {
        return locationManager;
      }
      if (isInited) {
        return locationManager;
      }
      if (callback) {
        initRequestState.callbacks.push(callback);
      }
      WebView.postEvent('web_app_check_location', false);
      return locationManager;
    };
    locationManager.getLocation = function(callback) {
      if (!checkVersion()) {
        return locationManager;
      }
      checkInit();
      if (!isLocationAvailable) {
        console.error('[Telegram.WebApp] Location is not available on this device.');
        throw Error('WebAppLocationManagerLocationNotAvailable');
      }

      getRequestState.callbacks.push(callback);
      WebView.postEvent('web_app_request_location');
      return locationManager;
    };
    locationManager.openSettings = function() {
      if (!checkVersion()) {
        return locationManager;
      }
      checkInit();
      if (!isLocationAvailable) {
        console.error('[Telegram.WebApp] Location is not available on this device.');
        throw Error('WebAppLocationManagerLocationNotAvailable');
      }
      if (!isAccessRequested) {
        console.error('[Telegram.WebApp] Location access was not requested yet.');
        throw Error('WebAppLocationManagerLocationAccessNotRequested');
      }
      if (isAccessGranted) {
        console.warn('[Telegram.WebApp] Location access was granted by the user, no need to go to settings.');
        return locationManager;
      }
      WebView.postEvent('web_app_open_location_settings', false);
      return locationManager;
    };
    return locationManager;
  })();

  var Accelerometer = (function() {
    var isStarted = false;
    var valueX = null, valueY = null, valueZ = null;
    var startCallbacks = [], stopCallbacks = [];

    var accelerometer = {};
    Object.defineProperty(accelerometer, 'isStarted', {
      get: function(){ return isStarted; },
      enumerable: true
    });
    Object.defineProperty(accelerometer, 'x', {
      get: function(){ return valueX; },
      enumerable: true
    });
    Object.defineProperty(accelerometer, 'y', {
      get: function(){ return valueY; },
      enumerable: true
    });
    Object.defineProperty(accelerometer, 'z', {
      get: function(){ return valueZ; },
      enumerable: true
    });

    WebView.onEvent('accelerometer_started', onAccelerometerStarted);
    WebView.onEvent('accelerometer_stopped', onAccelerometerStopped);
    WebView.onEvent('accelerometer_changed', onAccelerometerChanged);
    WebView.onEvent('accelerometer_failed',  onAccelerometerFailed);

    function onAccelerometerStarted(eventType, eventData) {
      isStarted = true;
      if (startCallbacks.length > 0) {
        for (var i = 0; i < startCallbacks.length; i++) {
          var callback = startCallbacks[i];
          callback(true);
        }
        startCallbacks = [];
      }
      receiveWebViewEvent('accelerometerStarted');
    }
    function onAccelerometerStopped(eventType, eventData) {
      isStarted = false;
      if (stopCallbacks.length > 0) {
        for (var i = 0; i < stopCallbacks.length; i++) {
          var callback = stopCallbacks[i];
          callback(true);
        }
        stopCallbacks = [];
      }
      receiveWebViewEvent('accelerometerStopped');
    }
    function onAccelerometerChanged(eventType, eventData) {
      valueX = eventData.x;
      valueY = eventData.y;
      valueZ = eventData.z;
      receiveWebViewEvent('accelerometerChanged');
    }
    function onAccelerometerFailed(eventType, eventData) {
      if (startCallbacks.length > 0) {
        for (var i = 0; i < startCallbacks.length; i++) {
          var callback = startCallbacks[i];
          callback(false);
        }
        startCallbacks = [];
      }
      receiveWebViewEvent('accelerometerFailed', {
        error: eventData.error
      });
    }

    function checkVersion() {
      if (!versionAtLeast('8.0')) {
        console.warn('[Telegram.WebApp] Accelerometer is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    accelerometer.start = function(params, callback) {
      params = params || {};
      if (!checkVersion()) {
        return accelerometer;
      }
      var req_params = {};
      var refresh_rate = parseInt(params.refresh_rate || 1000);
      if (isNaN(refresh_rate) || refresh_rate < 20 || refresh_rate > 1000) {
        console.warn('[Telegram.WebApp] Accelerometer refresh_rate is invalid', refresh_rate);
      } else {
        req_params.refresh_rate = refresh_rate;
      }

      if (callback) {
        startCallbacks.push(callback);
      }
      WebView.postEvent('web_app_start_accelerometer', false, req_params);
      return accelerometer;
    };
    accelerometer.stop = function(callback) {
      if (!checkVersion()) {
        return accelerometer;
      }
      if (callback) {
        stopCallbacks.push(callback);
      }
      WebView.postEvent('web_app_stop_accelerometer');
      return accelerometer;
    };
    return accelerometer;
  })();

  var DeviceOrientation = (function() {
    var isStarted = false;
    var valueAlpha = null, valueBeta = null, valueGamma = null, valueAbsolute = false;
    var startCallbacks = [], stopCallbacks = [];

    var deviceOrientation = {};
    Object.defineProperty(deviceOrientation, 'isStarted', {
      get: function(){ return isStarted; },
      enumerable: true
    });
    Object.defineProperty(deviceOrientation, 'absolute', {
      get: function(){ return valueAbsolute; },
      enumerable: true
    });
    Object.defineProperty(deviceOrientation, 'alpha', {
      get: function(){ return valueAlpha; },
      enumerable: true
    });
    Object.defineProperty(deviceOrientation, 'beta', {
      get: function(){ return valueBeta; },
      enumerable: true
    });
    Object.defineProperty(deviceOrientation, 'gamma', {
      get: function(){ return valueGamma; },
      enumerable: true
    });

    WebView.onEvent('device_orientation_started',  onDeviceOrientationStarted);
    WebView.onEvent('device_orientation_stopped',  onDeviceOrientationStopped);
    WebView.onEvent('device_orientation_changed', onDeviceOrientationChanged);
    WebView.onEvent('device_orientation_failed',  onDeviceOrientationFailed);

    function onDeviceOrientationStarted(eventType, eventData) {
      isStarted = true;
      if (startCallbacks.length > 0) {
        for (var i = 0; i < startCallbacks.length; i++) {
          var callback = startCallbacks[i];
          callback(true);
        }
        startCallbacks = [];
      }
      receiveWebViewEvent('deviceOrientationStarted');
    }
    function onDeviceOrientationStopped(eventType, eventData) {
      isStarted = false;
      if (stopCallbacks.length > 0) {
        for (var i = 0; i < stopCallbacks.length; i++) {
          var callback = stopCallbacks[i];
          callback(true);
        }
        stopCallbacks = [];
      }
      receiveWebViewEvent('deviceOrientationStopped');
    }
    function onDeviceOrientationChanged(eventType, eventData) {
      valueAbsolute = !!eventData.absolute;
      valueAlpha = eventData.alpha;
      valueBeta  = eventData.beta;
      valueGamma = eventData.gamma;
      receiveWebViewEvent('deviceOrientationChanged');
    }
    function onDeviceOrientationFailed(eventType, eventData) {
      if (startCallbacks.length > 0) {
        for (var i = 0; i < startCallbacks.length; i++) {
          var callback = startCallbacks[i];
          callback(false);
        }
        startCallbacks = [];
      }
      receiveWebViewEvent('deviceOrientationFailed', {
        error: eventData.error
      });
    }

    function checkVersion() {
      if (!versionAtLeast('8.0')) {
        console.warn('[Telegram.WebApp] DeviceOrientation is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    deviceOrientation.start = function(params, callback) {
      params = params || {};
      if (!checkVersion()) {
        return deviceOrientation;
      }
      var req_params = {};
      var refresh_rate = parseInt(params.refresh_rate || 1000);
      if (isNaN(refresh_rate) || refresh_rate < 20 || refresh_rate > 1000) {
        console.warn('[Telegram.WebApp] DeviceOrientation refresh_rate is invalid', refresh_rate);
      } else {
        req_params.refresh_rate = refresh_rate;
      }
      req_params.need_absolute = !!params.need_absolute;

      if (callback) {
        startCallbacks.push(callback);
      }
      WebView.postEvent('web_app_start_device_orientation', false, req_params);
      return deviceOrientation;
    };
    deviceOrientation.stop = function(callback) {
      if (!checkVersion()) {
        return deviceOrientation;
      }
      if (callback) {
        stopCallbacks.push(callback);
      }
      WebView.postEvent('web_app_stop_device_orientation');
      return deviceOrientation;
    };
    return deviceOrientation;
  })();

  var Gyroscope = (function() {
    var isStarted = false;
    var valueX = null, valueY = null, valueZ = null;
    var startCallbacks = [], stopCallbacks = [];

    var gyroscope = {};
    Object.defineProperty(gyroscope, 'isStarted', {
      get: function(){ return isStarted; },
      enumerable: true
    });
    Object.defineProperty(gyroscope, 'x', {
      get: function(){ return valueX; },
      enumerable: true
    });
    Object.defineProperty(gyroscope, 'y', {
      get: function(){ return valueY; },
      enumerable: true
    });
    Object.defineProperty(gyroscope, 'z', {
      get: function(){ return valueZ; },
      enumerable: true
    });

    WebView.onEvent('gyroscope_started',  onGyroscopeStarted);
    WebView.onEvent('gyroscope_stopped',  onGyroscopeStopped);
    WebView.onEvent('gyroscope_changed', onGyroscopeChanged);
    WebView.onEvent('gyroscope_failed',  onGyroscopeFailed);

    function onGyroscopeStarted(eventType, eventData) {
      isStarted = true;
      if (startCallbacks.length > 0) {
        for (var i = 0; i < startCallbacks.length; i++) {
          var callback = startCallbacks[i];
          callback(true);
        }
        startCallbacks = [];
      }
      receiveWebViewEvent('gyroscopeStarted');
    }
    function onGyroscopeStopped(eventType, eventData) {
      isStarted = false;
      if (stopCallbacks.length > 0) {
        for (var i = 0; i < stopCallbacks.length; i++) {
          var callback = stopCallbacks[i];
          callback(true);
        }
        stopCallbacks = [];
      }
      receiveWebViewEvent('gyroscopeStopped');
    }
    function onGyroscopeChanged(eventType, eventData) {
      valueX = eventData.x;
      valueY = eventData.y;
      valueZ = eventData.z;
      receiveWebViewEvent('gyroscopeChanged');
    }
    function onGyroscopeFailed(eventType, eventData) {
      if (startCallbacks.length > 0) {
        for (var i = 0; i < startCallbacks.length; i++) {
          var callback = startCallbacks[i];
          callback(false);
        }
        startCallbacks = [];
      }
      receiveWebViewEvent('gyroscopeFailed', {
        error: eventData.error
      });
    }

    function checkVersion() {
      if (!versionAtLeast('8.0')) {
        console.warn('[Telegram.WebApp] Gyroscope is not supported in version ' + webAppVersion);
        return false;
      }
      return true;
    }

    gyroscope.start = function(params, callback) {
      params = params || {};
      if (!checkVersion()) {
        return gyroscope;
      }
      var req_params = {};
      var refresh_rate = parseInt(params.refresh_rate || 1000);
      if (isNaN(refresh_rate) || refresh_rate < 20 || refresh_rate > 1000) {
        console.warn('[Telegram.WebApp] Gyroscope refresh_rate is invalid', refresh_rate);
      } else {
        req_params.refresh_rate = refresh_rate;
      }

      if (callback) {
        startCallbacks.push(callback);
      }
      WebView.postEvent('web_app_start_gyroscope', false, req_params);
      return gyroscope;
    };
    gyroscope.stop = function(callback) {
      if (!checkVersion()) {
        return gyroscope;
      }
      if (callback) {
        stopCallbacks.push(callback);
      }
      WebView.postEvent('web_app_stop_gyroscope');
      return gyroscope;
    };
    return gyroscope;
  })();

  var Serverless = (function() {
    var serverless = {};

    function serverlessError(message, status, parameters) {
      var err = new Error(message);
      err.name = 'ServerlessError';
      err.status = status;
      if (parameters) {
        err.parameters = parameters;
      }
      return err;
    }

    function parseEnvelope(name, response) {
      return response.text().then(function(text) {
        var data = null;
        try {
          data = JSON.parse(text);
        } catch (e) {}
        if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean') {
          throw serverlessError('Unexpected response from endpoint ' + name + ' (HTTP ' + response.status + ')', response.status);
        }
        if (!data.ok) {
          var err = serverlessError(
            data.description || 'Endpoint ' + name + ' failed (HTTP ' + response.status + ')',
            data.error_code || response.status,
            data.parameters);
          err.type = data.error_type || '';
          throw err;
        }
        return data.result;
      });
    }

    serverless.call = function(name, input, callback) {
      if (typeof input === 'function' && typeof callback === 'undefined') {
        callback = input;
        input = undefined;
      }
      if (typeof name !== 'string') {
        console.error('[Telegram.WebApp] Serverless endpoint name is invalid', name);
        throw Error('WebAppServerlessEndpointInvalid');
      }
      if (typeof input === 'undefined') {
        input = {};
      }
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        console.error('[Telegram.WebApp] Serverless endpoint input must be an object', input);
        throw Error('WebAppServerlessInputInvalid');
      }
      if (typeof callback !== 'undefined' && typeof callback !== 'function') {
        console.error('[Telegram.WebApp] Serverless callback must be a function', callback);
        throw Error('WebAppServerlessCallbackInvalid');
      }
      if (!webAppInitData.length) {
        console.error('[Telegram.WebApp] Serverless endpoints need initData; open the app from Telegram');
        throw Error('WebAppServerlessInitDataUnavailable');
      }
      if (typeof fetch !== 'function') {
        console.error('[Telegram.WebApp] Serverless endpoints need fetch()');
        throw Error('WebAppServerlessFetchUnsupported');
      }
      fetch('/api/' + name, {
        method: 'POST',
        headers: {
          'Authorization': 'TMA ' + window.btoa(webAppInitData),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input),
        credentials: 'omit'
      }).then(function(response) {
        return parseEnvelope(name, response);
      }, function(e) {
        throw serverlessError('Network error calling endpoint ' + name + (e && e.message ? ': ' + e.message : ''), 0);
      }).then(function(result) {
        if (callback) {
          callback(null, result);
        }
      }, function(err) {
        if (callback) {
          callback(err, null);
        }
      });
    };

    return serverless;
  })();

  var webAppInvoices = {};
  function onInvoiceClosed(eventType, eventData) {
    if (eventData.slug && webAppInvoices[eventData.slug]) {
      var invoiceData = webAppInvoices[eventData.slug];
      delete webAppInvoices[eventData.slug];
      if (invoiceData.callback) {
        invoiceData.callback(eventData.status);
      }
      receiveWebViewEvent('invoiceClosed', {
        url: invoiceData.url,
        status: eventData.status
      });
    }
  }

  var webAppPopupOpened = false;
  function onPopupClosed(eventType, eventData) {
    if (webAppPopupOpened) {
      var popupData = webAppPopupOpened;
      webAppPopupOpened = false;
      var button_id = null;
      if (typeof eventData.button_id !== 'undefined') {
        button_id = eventData.button_id;
      }
      if (popupData.callback) {
        popupData.callback(button_id);
      }
      receiveWebViewEvent('popupClosed', {
        button_id: button_id
      });
    }
  }

  var webAppScanQrPopupOpened = false;
  function onQrTextReceived(eventType, eventData) {
    if (webAppScanQrPopupOpened) {
      var popupData = webAppScanQrPopupOpened;
      var data = null;
      if (typeof eventData.data !== 'undefined') {
        data = eventData.data;
      }
      if (popupData.callback) {
        if (popupData.callback(data)) {
          webAppScanQrPopupOpened = false;
          WebView.postEvent('web_app_close_scan_qr_popup', false);
        }
      }
      receiveWebViewEvent('qrTextReceived', {
        data: data
      });
    }
  }
  function onScanQrPopupClosed(eventType, eventData) {
    webAppScanQrPopupOpened = false;
    receiveWebViewEvent('scanQrPopupClosed');
  }

  function onClipboardTextReceived(eventType, eventData) {
    if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
      var requestData = webAppCallbacks[eventData.req_id];
      delete webAppCallbacks[eventData.req_id];
      var data = null;
      if (typeof eventData.data !== 'undefined') {
        data = eventData.data;
      }
      if (requestData.callback) {
        requestData.callback(data);
      }
      receiveWebViewEvent('clipboardTextReceived', {
        data: data
      });
    }
  }

  var WebAppWriteAccessRequested = false;
  function onWriteAccessRequested(eventType, eventData) {
    if (WebAppWriteAccessRequested) {
      var requestData = WebAppWriteAccessRequested;
      WebAppWriteAccessRequested = false;
      if (requestData.callback) {
        requestData.callback(eventData.status == 'allowed');
      }
      receiveWebViewEvent('writeAccessRequested', {
        status: eventData.status
      });
    }
  }

  function getRequestedContact(callback, timeout) {
    var reqTo, fallbackTo, reqDelay = 0;
    var reqInvoke = function() {
      invokeCustomMethod('getRequestedContact', {}, function(err, res) {
        if (res.substr(0, 1) == '"' && res.substr(-1) == '"') { // macos fix
          res = JSON.parse(res);
        }
        if (res && res.length) {
          clearTimeout(fallbackTo);
          callback(res);
        } else {
          reqDelay += 50;
          reqTo = setTimeout(reqInvoke, reqDelay);
        }
      });
    };
    var fallbackInvoke = function() {
      clearTimeout(reqTo);
      callback('');
    };
    fallbackTo = setTimeout(fallbackInvoke, timeout);
    reqInvoke();
  }

  var WebAppContactRequested = false;
  function onPhoneRequested(eventType, eventData) {
    if (WebAppContactRequested) {
      var requestData = WebAppContactRequested;
      WebAppContactRequested = false;
      var requestSent = eventData.status == 'sent';
      var webViewEvent = {
        status: eventData.status
      };
      if (requestSent) {
        getRequestedContact(function(res) {
          if (res && res.length) {
            webViewEvent.response = res;
            webViewEvent.responseUnsafe = Utils.urlParseQueryString(res);
            for (var key in webViewEvent.responseUnsafe) {
              var val = webViewEvent.responseUnsafe[key];
              try {
                if (val.substr(0, 1) == '{' && val.substr(-1) == '}' ||
                    val.substr(0, 1) == '[' && val.substr(-1) == ']') {
                  webViewEvent.responseUnsafe[key] = JSON.parse(val);
                }
              } catch (e) {}
            }
          }
          if (requestData.callback) {
            requestData.callback(requestSent, webViewEvent);
          }
          receiveWebViewEvent('contactRequested', webViewEvent);
        }, 3000);
      } else {
        if (requestData.callback) {
          requestData.callback(requestSent, webViewEvent);
        }
        receiveWebViewEvent('contactRequested', webViewEvent);
      }
    }
  }

  var webAppDownloadFileRequested = false;
  function onFileDownloadRequested(eventType, eventData) {
    if (webAppDownloadFileRequested) {
      var requestData = webAppDownloadFileRequested;
      webAppDownloadFileRequested = false;
      var isDownloading = eventData.status == 'downloading';
      if (requestData.callback) {
        requestData.callback(isDownloading);
      }
      receiveWebViewEvent('fileDownloadRequested', {
        status: isDownloading ? 'downloading' : 'cancelled'
      });
    }
  }

  function onCustomMethodInvoked(eventType, eventData) {
    if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
      var requestData = webAppCallbacks[eventData.req_id];
      delete webAppCallbacks[eventData.req_id];
      var res = null, err = null;
      if (typeof eventData.result !== 'undefined') {
        res = eventData.result;
      }
      if (typeof eventData.error !== 'undefined') {
        err = eventData.error;
      }
      if (requestData.callback) {
        requestData.callback(err, res);
      }
    }
  }

  function invokeCustomMethod(method, params, callback) {
    if (!versionAtLeast('6.9')) {
      console.error('[Telegram.WebApp] Method invokeCustomMethod is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    var req_id = generateCallbackId(16);
    var req_params = {req_id: req_id, method: method, params: params || {}};
    webAppCallbacks[req_id] = {
      callback: callback
    };
    WebView.postEvent('web_app_invoke_custom_method', false, req_params);
  };

  if (!window.Telegram) {
    window.Telegram = {};
  }

  Object.defineProperty(WebApp, 'initData', {
    get: function(){ return webAppInitData; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'initDataUnsafe', {
    get: function(){ return webAppInitDataUnsafe; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'version', {
    get: function(){ return webAppVersion; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'platform', {
    get: function(){ return webAppPlatform; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'colorScheme', {
    get: function(){ return colorScheme; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'themeParams', {
    get: function(){ return themeParams; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'isExpanded', {
    get: function(){ return isExpanded; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'viewportHeight', {
    get: function(){ return (viewportHeight === false ? window.innerHeight : viewportHeight) - bottomBarHeight; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'viewportStableHeight', {
    get: function(){ return (viewportStableHeight === false ? window.innerHeight : viewportStableHeight) - bottomBarHeight; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'safeAreaInset', {
    get: function(){ return safeAreaInset; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'contentSafeAreaInset', {
    get: function(){ return contentSafeAreaInset; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'isClosingConfirmationEnabled', {
    set: function(val){ setClosingConfirmation(val); },
    get: function(){ return isClosingConfirmationEnabled; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'isVerticalSwipesEnabled', {
    set: function(val){ toggleVerticalSwipes(val); },
    get: function(){ return isVerticalSwipesEnabled; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'isFullscreen', {
    get: function(){ return webAppIsFullscreen; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'isOrientationLocked', {
    set: function(val){ toggleOrientationLock(val); },
    get: function(){ return webAppIsOrientationLocked; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'isActive', {
    get: function(){ return webAppIsActive; },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'headerColor', {
    set: function(val){ setHeaderColor(val); },
    get: function(){ return getHeaderColor(); },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'backgroundColor', {
    set: function(val){ setBackgroundColor(val); },
    get: function(){ return getBackgroundColor(); },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'bottomBarColor', {
    set: function(val){ setBottomBarColor(val); },
    get: function(){ return getBottomBarColor(); },
    enumerable: true
  });
  Object.defineProperty(WebApp, 'BackButton', {
    value: BackButton,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'MainButton', {
    value: MainButton,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'SecondaryButton', {
    value: SecondaryButton,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'SettingsButton', {
    value: SettingsButton,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'HapticFeedback', {
    value: HapticFeedback,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'CloudStorage', {
    value: CloudStorage,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'DeviceStorage', {
    value: DeviceStorage,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'SecureStorage', {
    value: SecureStorage,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'BiometricManager', {
    value: BiometricManager,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'Accelerometer', {
    value: Accelerometer,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'DeviceOrientation', {
    value: DeviceOrientation,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'Gyroscope', {
    value: Gyroscope,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'LocationManager', {
    value: LocationManager,
    enumerable: true
  });
  Object.defineProperty(WebApp, 'Serverless', {
    value: Serverless,
    enumerable: true
  });
  WebApp.isVersionAtLeast = function(ver) {
    return versionAtLeast(ver);
  };
  WebApp.setHeaderColor = function(color_key) {
    WebApp.headerColor = color_key;
  };
  WebApp.setBackgroundColor = function(color) {
    WebApp.backgroundColor = color;
  };
  WebApp.setBottomBarColor = function(color) {
    WebApp.bottomBarColor = color;
  };
  WebApp.enableClosingConfirmation = function() {
    WebApp.isClosingConfirmationEnabled = true;
  };
  WebApp.disableClosingConfirmation = function() {
    WebApp.isClosingConfirmationEnabled = false;
  };
  WebApp.enableVerticalSwipes = function() {
    WebApp.isVerticalSwipesEnabled = true;
  };
  WebApp.disableVerticalSwipes = function() {
    WebApp.isVerticalSwipesEnabled = false;
  };
  WebApp.lockOrientation = function() {
    WebApp.isOrientationLocked = true;
  };
  WebApp.unlockOrientation = function() {
    WebApp.isOrientationLocked = false;
  };
  WebApp.requestFullscreen = function() {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method requestFullscreen is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    WebView.postEvent('web_app_request_fullscreen');
  };
  WebApp.exitFullscreen = function() {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method exitFullscreen is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    WebView.postEvent('web_app_exit_fullscreen');
  };
  WebApp.addToHomeScreen = function() {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method addToHomeScreen is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    WebView.postEvent('web_app_add_to_home_screen');
  };
  WebApp.checkHomeScreenStatus = function(callback) {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method checkHomeScreenStatus is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (callback) {
      homeScreenCallbacks.push(callback);
    }
    WebView.postEvent('web_app_check_home_screen');
  };
  WebApp.onEvent = function(eventType, callback) {
    onWebViewEvent(eventType, callback);
  };
  WebApp.offEvent = function(eventType, callback) {offWebViewEvent(eventType, callback);
  };
  WebApp.sendData = function (data) {
    if (!data || !data.length) {
      console.error('[Telegram.WebApp] Data is required', data);
      throw Error('WebAppDataInvalid');
    }
    if (byteLength(data) > 4096) {
      console.error('[Telegram.WebApp] Data is too long', data);
      throw Error('WebAppDataInvalid');
    }
    WebView.postEvent('web_app_data_send', false, {data: data});
  };
  WebApp.switchInlineQuery = function (query, choose_chat_types) {
    if (!versionAtLeast('6.6')) {
      console.error('[Telegram.WebApp] Method switchInlineQuery is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (!initParams.tgWebAppBotInline) {
      console.error('[Telegram.WebApp] Inline mode is disabled for this bot. Read more about inline mode: https://core.telegram.org/bots/inline');
      throw Error('WebAppInlineModeDisabled');
    }
    query = query || '';
    if (query.length > 256) {
      console.error('[Telegram.WebApp] Inline query is too long', query);
      throw Error('WebAppInlineQueryInvalid');
    }
    var chat_types = [];
    if (choose_chat_types) {
      if (!Array.isArray(choose_chat_types)) {
        console.error('[Telegram.WebApp] Choose chat types should be an array', choose_chat_types);
        throw Error('WebAppInlineChooseChatTypesInvalid');
      }
      var good_types = {users: 1, bots: 1, groups: 1, channels: 1};
      for (var i = 0; i < choose_chat_types.length; i++) {
        var chat_type = choose_chat_types[i];
        if (!good_types[chat_type]) {
          console.error('[Telegram.WebApp] Choose chat type is invalid', chat_type);
          throw Error('WebAppInlineChooseChatTypeInvalid');
        }
        if (good_types[chat_type] != 2) {
          good_types[chat_type] = 2;
          chat_types.push(chat_type);
        }
      }
    }
    WebView.postEvent('web_app_switch_inline_query', false, {query: query, chat_types: chat_types});
  };
  WebApp.openLink = function (url, options) {
    var a = document.createElement('A');
    a.href = url;
    if (a.protocol != 'http:' &&
        a.protocol != 'https:') {
      console.error('[Telegram.WebApp] Url protocol is not supported', url);
      throw Error('WebAppTgUrlInvalid');
    }
    var url = a.href;
    options = options || {};
    if (versionAtLeast('6.1')) {
      var req_params = {url: url};
      if (versionAtLeast('6.4') && options.try_instant_view) {
        req_params.try_instant_view = true;
      }
      if (versionAtLeast('7.6') && options.try_browser) {
        req_params.try_browser = options.try_browser;
      }
      WebView.postEvent('web_app_open_link', false, req_params);
    } else {
      window.open(url, '_blank');
    }
  };
  WebApp.openTelegramLink = function (url, options) {
    var a = document.createElement('A');
    a.href = url;
    if (a.protocol != 'http:' &&
        a.protocol != 'https:') {
      console.error('[Telegram.WebApp] Url protocol is not supported', url);
      throw Error('WebAppTgUrlInvalid');
    }
    if (!isTmeHostname(a.hostname)) {
      console.error('[Telegram.WebApp] Url host is not supported', url);
      throw Error('WebAppTgUrlInvalid');
    }
    var path_full = a.pathname + a.search;
    options = options || {};
    if (isIframe || versionAtLeast('6.1')) {
      var req_params = {path_full: path_full};
      if (options.force_request) {
        req_params.force_request = true;
      }
      WebView.postEvent('web_app_open_tg_link', false, req_params);
    } else {
      location.href = 'https://t.me' + path_full;
    }
  };
  WebApp.openInvoice = function (url, callback) {
    var a = document.createElement('A'), match, slug;
    a.href = url;
    if (a.protocol != 'http:' &&
        a.protocol != 'https:' ||
        !isTmeHostname(a.hostname) ||
        !(match = a.pathname.match(/^\/(\$|invoice\/)([A-Za-z0-9\-_=]+)$/)) ||
        !(slug = match[2])) {
      console.error('[Telegram.WebApp] Invoice url is invalid', url);
      throw Error('WebAppInvoiceUrlInvalid');
    }
    if (!versionAtLeast('6.1')) {
      console.error('[Telegram.WebApp] Method openInvoice is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (webAppInvoices[slug]) {
      console.error('[Telegram.WebApp] Invoice is already opened');
      throw Error('WebAppInvoiceOpened');
    }
    webAppInvoices[slug] = {
      url: url,
      callback: callback
    };
    WebView.postEvent('web_app_open_invoice', false, {slug: slug});
  };
  WebApp.showPopup = function (params, callback) {
    if (!versionAtLeast('6.2')) {
      console.error('[Telegram.WebApp] Method showPopup is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (webAppPopupOpened) {
      console.error('[Telegram.WebApp] Popup is already opened');
      throw Error('WebAppPopupOpened');
    }
    var title = '';
    var message = '';
    var buttons = [];
    var popup_buttons = {};
    var popup_params = {};
    if (typeof params.title !== 'undefined') {
      title = strTrim(params.title);
      if (title.length > 64) {
        console.error('[Telegram.WebApp] Popup title is too long', title);
        throw Error('WebAppPopupParamInvalid');
      }
      if (title.length > 0) {
        popup_params.title = title;
      }
    }
    if (typeof params.message !== 'undefined') {
      message = strTrim(params.message);
    }
    if (!message.length) {
      console.error('[Telegram.WebApp] Popup message is required', params.message);
      throw Error('WebAppPopupParamInvalid');
    }
    if (message.length > 256) {
      console.error('[Telegram.WebApp] Popup message is too long', message);
      throw Error('WebAppPopupParamInvalid');
    }
    popup_params.message = message;
    if (typeof params.buttons !== 'undefined') {
      if (!Array.isArray(params.buttons)) {
        console.error('[Telegram.WebApp] Popup buttons should be an array', params.buttons);
        throw Error('WebAppPopupParamInvalid');
      }
      for (var i = 0; i < params.buttons.length; i++) {
        var button = params.buttons[i];
        var btn = {};
        var id = '';
        if (typeof button.id !== 'undefined') {
          id = button.id.toString();
          if (id.length > 64) {
            console.error('[Telegram.WebApp] Popup button id is too long', id);
            throw Error('WebAppPopupParamInvalid');
          }
        }
        btn.id = id;
        var button_type = button.type;
        if (typeof button_type === 'undefined') {
          button_type = 'default';
        }
        btn.type = button_type;
        if (button_type == 'ok' ||
            button_type == 'close' ||
            button_type == 'cancel') {
          // no params needed
        } else if (button_type == 'default' ||
                   button_type == 'destructive') {
          var text = '';
          if (typeof button.text !== 'undefined') {
            text = strTrim(button.text);
          }
          if (!text.length) {
            console.error('[Telegram.WebApp] Popup button text is required for type ' + button_type, button.text);
            throw Error('WebAppPopupParamInvalid');
          }
          if (text.length > 64) {
            console.error('[Telegram.WebApp] Popup button text is too long', text);
            throw Error('WebAppPopupParamInvalid');
          }
          btn.text = text;
        } else {
          console.error('[Telegram.WebApp] Popup button type is invalid', button_type);
          throw Error('WebAppPopupParamInvalid');
        }
        buttons.push(btn);
      }
    } else {
      buttons.push({id: '', type: 'close'});
    }
    if (buttons.length < 1) {
      console.error('[Telegram.WebApp] Popup should have at least one button');
      throw Error('WebAppPopupParamInvalid');
    }
    if (buttons.length > 3) {
      console.error('[Telegram.WebApp] Popup should not have more than 3 buttons');
      throw Error('WebAppPopupParamInvalid');
    }
    popup_params.buttons = buttons;

    webAppPopupOpened = {
      callback: callback
    };
    WebView.postEvent('web_app_open_popup', false, popup_params);
  };
  WebApp.showAlert = function (message, callback) {
    WebApp.showPopup({
      message: message
    }, callback ? function(){ callback(); } : null);
  };
  WebApp.showConfirm = function (message, callback) {
    WebApp.showPopup({
      message: message,
      buttons: [
        {type: 'ok', id: 'ok'},
        {type: 'cancel'}
      ]
    }, callback ? function (button_id) {
      callback(button_id == 'ok');
    } : null);
  };
  WebApp.showScanQrPopup = function (params, callback) {
    if (!versionAtLeast('6.4')) {
      console.error('[Telegram.WebApp] Method showScanQrPopup is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (webAppScanQrPopupOpened) {
      console.error('[Telegram.WebApp] Popup is already opened');
      throw Error('WebAppScanQrPopupOpened');
    }
    var text = '';
    var popup_params = {};
    if (typeof params.text !== 'undefined') {
      text = strTrim(params.text);
      if (text.length > 64) {
        console.error('[Telegram.WebApp] Scan QR popup text is too long', text);
        throw Error('WebAppScanQrPopupParamInvalid');
      }
      if (text.length > 0) {
        popup_params.text = text;
      }
    }

    webAppScanQrPopupOpened = {
      callback: callback
    };
    WebView.postEvent('web_app_open_scan_qr_popup', false, popup_params);
  };
  WebApp.closeScanQrPopup = function () {
    if (!versionAtLeast('6.4')) {
      console.error('[Telegram.WebApp] Method closeScanQrPopup is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }

    webAppScanQrPopupOpened = false;
    WebView.postEvent('web_app_close_scan_qr_popup', false);
  };
  WebApp.readTextFromClipboard = function (callback) {
    if (!versionAtLeast('6.4')) {
      console.error('[Telegram.WebApp] Method readTextFromClipboard is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    var req_id = generateCallbackId(16);
    var req_params = {req_id: req_id};
    webAppCallbacks[req_id] = {
      callback: callback
    };
    WebView.postEvent('web_app_read_text_from_clipboard', false, req_params);
  };
  WebApp.requestWriteAccess = function (callback) {
    if (!versionAtLeast('6.9')) {
      console.error('[Telegram.WebApp] Method requestWriteAccess is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (WebAppWriteAccessRequested) {
      console.error('[Telegram.WebApp] Write access is already requested');
      throw Error('WebAppWriteAccessRequested');
    }
    WebAppWriteAccessRequested = {
      callback: callback
    };
    WebView.postEvent('web_app_request_write_access');
  };
  WebApp.requestContact = function (callback) {
    if (!versionAtLeast('6.9')) {
      console.error('[Telegram.WebApp] Method requestContact is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (WebAppContactRequested) {
      console.error('[Telegram.WebApp] Contact is already requested');
      throw Error('WebAppContactRequested');
    }
    WebAppContactRequested = {
      callback: callback
    };
    WebView.postEvent('web_app_request_phone');
  };
  WebApp.downloadFile = function (params, callback) {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method downloadFile is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (webAppDownloadFileRequested) {
      console.error('[Telegram.WebApp] Popup is already opened');
      throw Error('WebAppDownloadFilePopupOpened');
    }
    var a = document.createElement('A');

    var dl_params = {};
    if (!params || !params.url || !params.url.length) {
      console.error('[Telegram.WebApp] Url is required');
      throw Error('WebAppDownloadFileParamInvalid');
    }
    a.href = params.url;
    if (a.protocol != 'https:') {
      console.error('[Telegram.WebApp] Url protocol is not supported', url);
      throw Error('WebAppDownloadFileParamInvalid');
    }
    dl_params.url = a.href;

    if (!params || !params.file_name || !params.file_name.length) {
      console.error('[Telegram.WebApp] File name is required');
      throw Error('WebAppDownloadFileParamInvalid');
    }
    dl_params.file_name = params.file_name;

    webAppDownloadFileRequested = {
      callback: callback
    };
    WebView.postEvent('web_app_request_file_download', false, dl_params);
  };
  WebApp.shareToStory = function (media_url, params) {
    params = params || {};
    if (!versionAtLeast('7.8')) {
      console.error('[Telegram.WebApp] Method shareToStory is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    var a = document.createElement('A');
    a.href = media_url;
    if (a.protocol != 'http:' &&
        a.protocol != 'https:') {
      console.error('[Telegram.WebApp] Media url protocol is not supported', url);
      throw Error('WebAppMediaUrlInvalid');
    }
    var share_params = {};
    share_params.media_url = a.href;
    if (typeof params.text !== 'undefined') {
      var text = strTrim(params.text);
      if (text.length > 2048) {
        console.error('[Telegram.WebApp] Text is too long', text);
        throw Error('WebAppShareToStoryParamInvalid');
      }
      if (text.length > 0) {
        share_params.text = text;
      }
    }
    if (typeof params.widget_link !== 'undefined') {
      params.widget_link = params.widget_link || {};
      a.href = params.widget_link.url;
      if (a.protocol != 'http:' &&
          a.protocol != 'https:') {
        console.error('[Telegram.WebApp] Link protocol is not supported', url);
        throw Error('WebAppShareToStoryParamInvalid');
      }
      var widget_link = {
        url: a.href
      };
      if (typeof params.widget_link.name !== 'undefined') {
        var link_name = strTrim(params.widget_link.name);
        if (link_name.length > 48) {
          console.error('[Telegram.WebApp] Link name is too long', link_name);
          throw Error('WebAppShareToStoryParamInvalid');
        }
        if (link_name.length > 0) {
          widget_link.name = link_name;
        }
      }
      share_params.widget_link = widget_link;
    }

    WebView.postEvent('web_app_share_to_story', false, share_params);
  };
  WebApp.shareMessage = function (msg_id, callback) {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method shareMessage is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (WebAppShareMessageOpened) {
      console.error('[Telegram.WebApp] Share message is already opened');
      throw Error('WebAppShareMessageOpened');
    }
    WebAppShareMessageOpened = {
      callback: callback
    };
    WebView.postEvent('web_app_send_prepared_message', false, {id: msg_id});
  };
  WebApp.requestChat = function (req_id, callback) {
    if (!versionAtLeast('9.6')) {
      console.error('[Telegram.WebApp] Method requestChat is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (WebAppRequestChatOpened) {
      console.error('[Telegram.WebApp] Request chat is already opened');
      throw Error('WebAppRequestChatOpened');
    }
    WebAppRequestChatOpened = {
      callback: callback
    };
    WebView.postEvent('web_app_request_chat', false, {req_id: req_id});
  };
  WebApp.setEmojiStatus = function (custom_emoji_id, params, callback) {
    params = params || {};
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method setEmojiStatus is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    var status_params = {};
    status_params.custom_emoji_id = custom_emoji_id;
    if (typeof params.duration !== 'undefined') {
      status_params.duration = params.duration;
    }
    if (WebAppEmojiStatusRequested) {
      console.error('[Telegram.WebApp] Emoji status is already requested');
      throw Error('WebAppEmojiStatusRequested');
    }
    WebAppEmojiStatusRequested = {
      callback: callback
    };
    WebView.postEvent('web_app_set_emoji_status', false, status_params);
  };
  WebApp.requestEmojiStatusAccess = function (callback) {
    if (!versionAtLeast('8.0')) {
      console.error('[Telegram.WebApp] Method requestEmojiStatusAccess is not supported in version ' + webAppVersion);
      throw Error('WebAppMethodUnsupported');
    }
    if (WebAppEmojiStatusAccessRequested) {
      console.error('[Telegram.WebApp] Emoji status permission is already requested');
      throw Error('WebAppEmojiStatusAccessRequested');
    }
    WebAppEmojiStatusAccessRequested = {
      callback: callback
    };
    WebView.postEvent('web_app_request_emoji_status_access');
  };
  WebApp.invokeCustomMethod = function (method, params, callback) {
    invokeCustomMethod(method, params, callback);
  };
  WebApp.hideKeyboard = function () {
    WebView.postEvent('web_app_hide_keyboard');
  };
  WebApp.ready = function () {
    WebView.postEvent('web_app_ready');
  };
  WebApp.expand = function () {
    WebView.postEvent('web_app_expand');
  };
  WebApp.close = function (options) {
    options = options || {};
    var req_params = {};
    if (versionAtLeast('7.6') && options.return_back) {
      req_params.return_back = true;
    }
    WebView.postEvent('web_app_close', false, req_params);
  };

  window.Telegram.WebApp = WebApp;

  updateHeaderColor();
  updateBackgroundColor();
  updateBottomBarColor();
  setViewportHeight();
  if (initParams.tgWebAppShowSettings) {
    SettingsButton.show();
  }

  window.addEventListener('resize', onWindowResize);
  if (isIframe) {
    document.addEventListener('click', linkHandler);
  }

  WebView.onEvent('theme_changed', onThemeChanged);
  WebView.onEvent('viewport_changed', onViewportChanged);
  WebView.onEvent('safe_area_changed', onSafeAreaChanged);
  WebView.onEvent('content_safe_area_changed', onContentSafeAreaChanged);
  WebView.onEvent('visibility_changed', onVisibilityChanged);
  WebView.onEvent('invoice_closed', onInvoiceClosed);
  WebView.onEvent('popup_closed', onPopupClosed);
  WebView.onEvent('qr_text_received', onQrTextReceived);
  WebView.onEvent('scan_qr_popup_closed', onScanQrPopupClosed);
  WebView.onEvent('clipboard_text_received', onClipboardTextReceived);
  WebView.onEvent('write_access_requested', onWriteAccessRequested);
  WebView.onEvent('phone_requested', onPhoneRequested);
  WebView.onEvent('file_download_requested', onFileDownloadRequested);
  WebView.onEvent('custom_method_invoked', onCustomMethodInvoked);
  WebView.onEvent('fullscreen_changed', onFullscreenChanged);
  WebView.onEvent('fullscreen_failed', onFullscreenFailed);
  WebView.onEvent('home_screen_added', onHomeScreenAdded);
  WebView.onEvent('home_screen_checked', onHomeScreenChecked);
  WebView.onEvent('prepared_message_sent', onPreparedMessageSent);
  WebView.onEvent('prepared_message_failed', onPreparedMessageFailed);
  WebView.onEvent('requested_chat_sent', onRequestedChatSent);
  WebView.onEvent('requested_chat_failed', onRequestedChatFailed);
  WebView.onEvent('emoji_status_set', onEmojiStatusSet);
  WebView.onEvent('emoji_status_failed', onEmojiStatusFailed);
  WebView.onEvent('emoji_status_access_requested', onEmojiStatusAccessRequested);
  WebView.postEvent('web_app_request_theme');
  WebView.postEvent('web_app_request_viewport');
  WebView.postEvent('web_app_request_safe_area');
  WebView.postEvent('web_app_request_content_safe_area');

})();
;
/* Source: stock-config.js */
window.ACEFORM_STOCK_URL = 'https://script.google.com/macros/s/AKfycbxJdmib0JC672Qx8iprM6hqegJxBPrMmYN-7OXSH8FtEkwMKl2yAja6ip_6LEdj37KZ/exec';
;
/* Source: media.js */
/* Display copies; approved source images remain unchanged. */
(()=>{const known=new Set(["bueno-fuchsia-pink-catalog-v31.jpg","bueno-fuchsia-pink-catalog-v31.webp","dress-black-back-original-seam-v31.webp","dress-black-back-original.jpg","dress-black-catalog.jpg","dress-black-fit-v14.webp","dress-black-worn.jpg","dress-black.jpg","dress-red-back-original-seam-v31.webp","dress-red-back-original.jpg","dress-red-catalog.jpg","dress-red-fit-v14.webp","dress-red-side-original-seam-v31.webp","dress-red-side-original.jpg","dress-red-worn.jpg","dress-red.jpg","dress-white-back-original-seam-v31.webp","dress-white-back-original.jpg","dress-white-catalog.jpg","dress-white-fit-v14.webp","dress-white-worn.jpg","dress-white.jpg","monogram.jpg","outfit-graf-0-bueno-0.webp","outfit-graf-0-bueno-1.webp","outfit-graf-0-bueno-2.webp","outfit-graf-0-bueno-3.webp","outfit-graf-0-bueno-4.webp","outfit-graf-0-bueno-5.webp","outfit-graf-1-bueno-0.webp","outfit-graf-1-bueno-1.webp","outfit-graf-1-bueno-2.webp","outfit-graf-1-bueno-3.webp","outfit-graf-1-bueno-4.webp","outfit-graf-1-bueno-5.webp","outfit-graf-2-bueno-0.webp","outfit-graf-2-bueno-1.webp","outfit-graf-2-bueno-2.webp","outfit-graf-2-bueno-3.webp","outfit-graf-2-bueno-4.webp","outfit-graf-2-bueno-5.webp","outfit-graf-3-bueno-0.webp","outfit-graf-3-bueno-1.webp","outfit-graf-3-bueno-2.webp","outfit-graf-3-bueno-3.webp","outfit-graf-3-bueno-4.webp","outfit-graf-3-bueno-5.webp","rococo-black-pink-catalog.jpg","rococo-black-pink-fit-v14.webp","rococo-blue-catalog.jpg","rococo-blue-fit-v14.webp","rococo-fuchsia-worn.jpg","rococo-pink-fit-v14.webp","rococo-pink-worn.jpg","rococo-pink.jpg","rococo-white-catalog.jpg","rococo-white-fit-v14.webp","rococo-white-pink-catalog.jpg","rococo-white-pink-main-catalog.jpg","rococo-yellow-catalog.jpg","rococo-yellow-fit-v14.webp","rococo-yellow-worn.jpg","rococo-yellow.jpg","shorts-black-black-dress-angle-seam-v31.webp","shorts-black-black-dress-angle.jpg","shorts-black-red-dress-angle-seam-v31.webp","shorts-black-red-dress-angle.jpg","shorts-black-side-red-catalog-v15.webp","shorts-black-side-red-soft-v16.webp","shorts-black-side-red.jpg","shorts-black-side-white-catalog-v15.webp","shorts-black-side-white-soft-v16.webp","shorts-black-side-white.jpg","shorts-pair.png","shorts-white-black-dress-angle-seam-v31.webp","shorts-white-black-dress-angle.jpg","shorts-white-side-catalog-v15.webp","shorts-white-side-soft-v16.webp","shorts-white-side.jpg","shorts-white-white-dress-angle-seam-v31.webp","shorts-white-white-dress-angle.jpg","top-black-catalog.jpg","top-fuchsia-catalog.jpg","top-fuchsia-fit-v14.webp","top-milk.jpg","top-white-catalog.jpg","top-yellow-catalog.jpg"]);const jpeg=new Set(["april-evert-navy.jpg", "april-graf-bueno.jpg", "april-evert-orange.jpg", "aperol-graf-orange-bueno-navy-preview.jpg", "aperol-coast-v1.jpg", "aperol-studio-dress-navy-v1.jpg", "aperol-studio-dress-orange-v1.jpg", "aperol-studio-suit-navy-orange-v2.jpg", "aperol-studio-suit-orange-navy-v2.jpg"]);window.ACEFORM_MEDIA={src(value){if(typeof value!=='string')return value;const parts=value.match(/^([^?#]+)([?#].*)?$/);if(!parts)return value;const path=parts[1],suffix=parts[2]||'',m=path.match(/(^|\/)([^/]+)\.(jpg|jpeg|png|webp)$/i);if(!m)return value;const name=m[2]+'.'+m[3],ext=jpeg.has(name)?'.jpg':known.has(name)?'.webp':'';return ext?path.slice(0,m.index)+m[1]+'fast-'+m[2]+ext+suffix:value;}};})();
;
/* Source: catalog.js */
window.ACEFORM_CATALOG = [
 {id:'dress',name:'Платье EVERT · Эверт',stockName:'Платье',subtitle:'Точность в каждой линии',colors:[['Чёрный','#252827','assets/dress-black-catalog.jpg'],['Белый','#f7f3e8','assets/dress-white-catalog.jpg'],['Красный','#bd2438','assets/dress-red-catalog.jpg']]},
 {id:'skirt',name:'Юбка BUENO · Буэно',stockName:'Юбка Рококо',subtitle:'Красота в движении',colors:[['Розовый','#e9b1c5','assets/rococo-white-pink-catalog.jpg'],['Жёлтый','#f5d325','assets/rococo-yellow-catalog.jpg'],['Чёрный пояс / розовые воланы','#252827','assets/rococo-black-pink-catalog.jpg'],['Белый','#ffffff','assets/rococo-white-catalog.jpg'],['Голубой / белый пояс','#a7cfff','assets/rococo-blue-catalog.jpg'],['Фуксия / нежно-розовые воланы','#f512a4','assets/bueno-fuchsia-pink-catalog-v31.webp']]},
 {id:'top',name:'Топ GRAF · Граф',stockName:'Топ',subtitle:'Собранность перед ударом',colors:[['Молочный','#f7f5ef','assets/top-white-catalog.jpg'],['Фуксия','#f512a4','assets/top-fuchsia-catalog.jpg'],['Жёлтый','#f5d325','assets/top-yellow-catalog.jpg'],['Чёрный','#252827','assets/top-black-catalog.jpg']]},
 {id:'shorts',name:'Шорты MARBLE · Марбл',stockName:'Шорты',subtitle:'Своя форма игры',colors:[['Белый','#f7f3e8','assets/dress-white-catalog.jpg'],['Чёрный','#252827',null]]}
];

window.ACEFORM_APEROL_CATALOG = [
 {id:'aperol-dress',name:'Комплект EVERT + MARBLE · Апероль',price:9000,colors:[['Тёмно-синий','#15325c','assets/april-evert-navy.jpg'],['Оранжевый','#e76123','assets/april-evert-orange.jpg']]},
 {id:'aperol-suit',name:'Костюм GRAF + BUENO · Апероль',price:11900,colors:[['Тёмно-синий топ / оранжевая юбка','#e76123','assets/april-graf-bueno.jpg'],['Оранжевый топ / тёмно-синяя юбка','#15325c','assets/aperol-graf-orange-bueno-navy-preview.jpg']]}
];
;
/* Source: descriptions.js */
window.ACEFORM_DESCRIPTIONS = {
 aperolDress:{text:'Яркий цвет сразу меняет настроение. Ты собираешь волосы, надеваешь кроссовки и ещё раз смотришь на себя перед выходом. Сегодня хочется быть заметной — и тебе нравится, как это выглядит.'},
 aperolSuit:{text:'Застегнула топ, поправила юбку, повернулась к зеркалу. Всё совпало: цвет, силуэт, твоё настроение. Хочется выйти в этом образе сегодня — играть, двигаться и ловить удовольствие от себя.'},
 dress: {
  title:'Точность в каждой линии.',
  text:'Посмотрела в зеркало — и захотелось выйти на корт именно так. Открытые плечи, чёткий силуэт, короткая длина. Ты нравишься себе и чувствуешь, как меняется осанка.',
  benefits:[
   'Выразительная талия, открытые плечи и длина мини.',
   'Классический теннисный образ, который притягивает взгляды.',
   'Белый, красный или чёрный — выбирай свой характер игры.'
  ],
  history:'Муза модели — Крис Эверт. Точность её ударов, выдержка и спокойная решимость вдохновили нас на EVERT. В прочтении ACEFORM точность становится линией силуэта, а классическая элегантность — образом девушки, которая выходит на корт на своих условиях.',
  source:'https://www.tennisfame.com/hall-of-famers/inductees/chris-evert/',
  sourceLabel:'О Крис Эверт · International Tennis Hall of Fame',
  note:'EVERT с одной парой шорт MARBLE — 8 000 ₽, с двумя парами — 9 500 ₽. Цвет шорт на выбор.'
 },
 skirt: {
  title:'Красота в движении.',
  text:'Юбка движется вслед за тобой, открывая ноги при каждом повороте. Ты замечаешь это в отражении — и больше не стараешься стоять неподвижно. Хочется двигаться, попадать в кадр, быть заметной.',
  benefits:[
   'Воздушные многослойные воланы красиво раскрываются в движении.',
   'Гладкий пояс выделяет талию и уравновешивает летящий объём.',
   'Нежные оттенки и контрастные сочетания под твоё настроение.'
  ],
  history:'Муза модели — Мария Буэно. Её грацию на корте сравнивали с балетом, а элегантность была частью её выразительной игры. Мы посвятили BUENO красоте движения: мягкому повороту, лёгкому шагу и ткани, которая следует за тобой.',
  source:'https://www.tennisfame.com/hall-of-famers/inductees/maria-bueno',
  sourceLabel:'О Марии Буэно · International Tennis Hall of Fame',
  note:'Изготавливается по предзаказу. Топ заказывается отдельно.'
 },
 top: {
  title:'Собранность перед ударом.',
  text:'Провела пальцами по воротнику, чуть опустила молнию. Ещё на сантиметр — и вырез такой, как хочется тебе. Приятно чувствовать своё тело и самой решать, насколько открытым будет образ.',
  benefits:[
   'Укороченный силуэт красиво подчёркивает талию.',
   'Молния позволяет менять глубину выреза.',
   'Один топ — разные образы с юбкой BUENO и шортами MARBLE.'
  ],
  history:'Муза модели — Штеффи Граф. Её мощный удар справа стал для нас образом силы и концентрации. В GRAF мы передали это настроение через собранный силуэт и выразительные линии — для секунды перед подачей, когда всё внимание принадлежит твоей игре.',
  source:'https://www.tennisfame.com/hall-of-famers/inductees/stefanie-graf/',
  sourceLabel:'О Штеффи Граф · International Tennis Hall of Fame',
  note:'Изготавливается по предзаказу. Юбка и шорты заказываются отдельно.'
 },
 shorts: {
  title:'Своя форма игры.',
  text:'Надела с коротким топом, оценила силуэт — и оставила длинную футболку в шкафу. Сегодня тебе хочется видеть свои ноги, чувствовать свободу движений и носить то, что нравится.',
  benefits:[
   'Прилегающий силуэт без лишнего объёма под платьем.',
   'Короткая длина для сочетаний с мини и укороченным топом.',
   'Два базовых цвета для твоих комплектов ACEFORM.'
  ],
  history:'Муза модели — Элис Марбл, одна из теннисисток, выбравших шорты вместо привычной юбки. В 1939 году она выиграла в шортах три уимблдонских титула: в одиночном, парном и смешанном парном разрядах. Для ACEFORM эта история — о свободе выбирать собственную форму игры. Так появились MARBLE.',
  source:'https://www.usopen.org/en_US/news/articles/2023-05-24/milestones_in_equality_the_evolution_of_the_tennis_fashion_statement.html',
  sourceLabel:'Элис Марбл и теннисная мода · US Open',
  note:'MARBLE можно заказать отдельно. Белые и чёрные шорты в наличии.'
 }
};
;
/* Source: sizing.js */
window.ACEFORM_SIZING = {
 rows: [
  {size:'S',bust:[87,90],waist:[67,70],hips:[93,96]},
  {size:'M',bust:[91,94],waist:[71,74],hips:[97,100]},
  {size:'L',bust:[95,98],waist:[75,78],hips:[101,104]}
 ],
 fields(product) {return product==='top'?['bust','waist']:product==='dress'?['bust','waist','hips']:['waist','hips'];},
 recommend(product,measurements) {
  const fields=this.fields(product);
  if(fields.some(k=>!Number.isFinite(measurements[k])||measurements[k]<=0))return {kind:'missing'};
  const matches=fields.map(k=>this.rows.find(r=>measurements[k]>=r[k][0]&&measurements[k]<=r[k][1])?.size);
  if(matches.some(s=>!s))return {kind:'outside'};
  return new Set(matches).size===1?{kind:'match',size:matches[0]}:{kind:'mixed'};
 }
};
;
/* Source: models.js */
window.ACEFORM_MODELS = {
 dress:[['assets/dress-black-fit-v14.webp','assets/shorts-white-side-soft-v16.webp','assets/dress-black-back-original-seam-v31.webp'],['assets/dress-white-fit-v14.webp','assets/shorts-black-side-white-soft-v16.webp','assets/dress-white-back-original-seam-v31.webp'],['assets/dress-red-fit-v14.webp','assets/dress-red-side-original-seam-v31.webp','assets/dress-red-back-original-seam-v31.webp','assets/shorts-black-side-red-soft-v16.webp']],
 skirt:[['assets/rococo-pink-fit-v14.webp'],['assets/rococo-yellow-fit-v14.webp'],['assets/rococo-black-pink-fit-v14.webp'],['assets/rococo-white-fit-v14.webp'],['assets/rococo-blue-fit-v14.webp'],['assets/top-fuchsia-fit-v14.webp']],
 top:[['assets/rococo-pink-fit-v14.webp'],['assets/top-fuchsia-fit-v14.webp'],['assets/rococo-yellow-fit-v14.webp'],['assets/rococo-black-pink-fit-v14.webp']],
 shorts:[['assets/shorts-white-side-soft-v16.webp','assets/shorts-white-black-dress-angle-seam-v31.webp','assets/shorts-white-white-dress-angle-seam-v31.webp'],['assets/shorts-black-side-red-soft-v16.webp','assets/shorts-black-side-white-soft-v16.webp','assets/shorts-black-black-dress-angle-seam-v31.webp','assets/shorts-black-red-dress-angle-seam-v31.webp']]
};

window.ACEFORM_MODEL_VIEWS = {
 'assets/dress-black-fit-v14.webp':'Вид спереди',
 'assets/dress-white-fit-v14.webp':'Вид спереди',
 'assets/dress-red-fit-v14.webp':'Вид спереди',
 'assets/dress-red-side-original-seam-v31.webp':'Вид сбоку',
 'assets/dress-black-back-original-seam-v31.webp':'Вид со спины',
 'assets/dress-white-back-original-seam-v31.webp':'Вид со спины',
 'assets/dress-red-back-original-seam-v31.webp':'Вид со спины',
 'assets/shorts-white-side-soft-v16.webp':'Вид сбоку · белые шорты',
 'assets/shorts-black-side-red-soft-v16.webp':'Вид сбоку · чёрные шорты',
 'assets/shorts-black-side-white-soft-v16.webp':'Вид сбоку · чёрные шорты с белым платьем',
 'assets/shorts-white-black-dress-angle-seam-v31.webp':'В движении · белые шорты',
 'assets/shorts-white-white-dress-angle-seam-v31.webp':'Другой ракурс · белые шорты с белым платьем',
 'assets/shorts-black-black-dress-angle-seam-v31.webp':'В движении · чёрные шорты',
 'assets/shorts-black-red-dress-angle-seam-v31.webp':'Другой ракурс · чёрные шорты с красным платьем'
};
;
/* Source: media-priority.js */
/* Decode images before swapping; warm only the colors of the open product. */
(()=>{
 'use strict';
 const media=window.ACEFORM_MEDIA,cache=new Map(),tokens=new WeakMap();
 let queue=[],active=0,prepared='';
 function load(value,priority='low'){
  const src=media.src(value);if(!src)return Promise.reject(Error('Missing image'));
  const existing=cache.get(src);if(existing){if(priority==='high')existing.image.fetchPriority='high';return existing.promise;}
  const image=new Image();image.decoding='async';image.fetchPriority=priority;
  const promise=new Promise((resolve,reject)=>{image.onload=async()=>{try{await image.decode();}catch{}const entry=cache.get(src);if(entry)entry.decoded=true;resolve(image);};image.onerror=()=>{cache.delete(src);reject(Error('Image unavailable'));};image.src=src;});
  cache.set(src,{image,promise,decoded:false});return promise;
 }
 function pump(){while(active<2&&queue.length){const src=queue.shift();active++;load(src).catch(()=>{}).finally(()=>{active--;pump();});}}
 function prepareProduct(id){
  if(document.readyState!=='complete'){addEventListener('load',()=>prepareProduct(id),{once:true});return;}
  if(document.body.dataset.shopScreen!=='product'||prepared===id||navigator.connection?.saveData)return;
  prepared=id;queue=[];
  const model=window.ACEFORM_MODELS[id]||[],sources=model.map(views=>views[0]);
  if(id==='dress')sources.push('assets/fast-aperol-studio-dress-navy-v1.jpg','assets/fast-aperol-studio-dress-orange-v1.jpg');
  if(id==='top'||id==='skirt')sources.push('assets/fast-aperol-studio-suit-navy-orange-v2.jpg','assets/fast-aperol-studio-suit-orange-navy-v2.jpg');
  const start=()=>{if(prepared!==id||document.body.dataset.shopScreen!=='product')return;queue=[...new Set(sources.map(media.src))].filter(src=>!cache.has(src));pump();};
  if('requestIdleCallback' in window)requestIdleCallback(start,{timeout:800});else setTimeout(start,100);
 }
 function show(container,value,attributes={}){
  const src=media.src(value),token={};tokens.set(container,token);
  const apply=image=>{if(tokens.get(container)!==token)return false;for(const [key,value] of Object.entries(attributes))image.setAttribute(key,value);if(container.firstElementChild!==image)container.replaceChildren(image);return true;};
  const ready=cache.get(src);if(ready?.decoded&&ready.image.naturalWidth){apply(ready.image);return Promise.resolve(true);}
  return load(src,'high').then(apply).catch(()=>{if(tokens.get(container)!==token)return false;const image=new Image();image.alt=attributes.alt||'';for(const [key,value] of Object.entries(attributes))image.setAttribute(key,value);image.src=src;container.replaceChildren(image);return false;});
 }
 media.load=load;media.show=show;media.prepareProduct=prepareProduct;
})();
;
/* Source: commerce.js */
window.ACEFORM_COMMERCE = {
 aperolShorts(s) {return 'MARBLE: '+(s.color===0?'оранжевые':'тёмно-синие')+(s.extraShorts?(s.color===0?' + тёмно-синие':' + оранжевые')+' · 2 пары':' · 1 пара');},
 basketPrice(items) {
  if(!items.length||items.every(s=>s.product==='dress')||items.some(s=>!['dress','top','skirt','aperol-dress','aperol-suit'].includes(s.product)))return null;
  const price=s=>s.product==='dress'?(s.bundle==='both'?9500:8000):s.product==='aperol-dress'?(s.extraShorts?10500:9000):({'top':2900,'skirt':8900,'aperol-dress':9000,'aperol-suit':11900})[s.product];
  let pairs=items.filter(s=>s.product==='skirt').reduce((n,s)=>n+s.quantity,0),discount=0;
  const lines=items.map(s=>{const unit=price(s),paired=s.product==='top'?Math.min(pairs,s.quantity):0;pairs-=paired;discount+=paired*900;return {selection:s,unit,total:unit*s.quantity-paired*900,paired};});
  const subtotal=items.reduce((n,s)=>n+price(s)*s.quantity,0);
  return {lines,subtotal,discount,total:subtotal-discount};
 },
 bundleLimit(bundle,size,inventory,included,dressQuantity) {
  if(!['white','black','either'].includes(included))return 0;
  if(bundle!=='both')return included==='either'||included===bundle?dressQuantity:0;
  const colors=included==='white'?['Чёрный']:included==='black'?['Белый']:['Белый','Чёрный'];
  const extra=inventory.filter(v=>v.product==='Шорты'&&v.size===size&&colors.includes(v.color)).reduce((n,v)=>n+(Number.isSafeInteger(v.quantity)?v.quantity:0),0);
  return Math.min(dressQuantity,extra);
 },
 preorderOnly(p) {return p.id==='top'||p.id==='skirt';},
 inStock(p,variant,fresh) {return p.id==='shorts'||(!this.preorderOnly(p)&&fresh&&variant?.quantity>0);},
 orderLimit(p,variant) {return p.id==='shorts'?99:variant?.quantity??99;},
 unitPrice(p,bundle,variant) {
  if(p.id==='dress')return bundle==='both'?9500:8000;
  if(p.id==='top')return 2900;
  if(p.id==='skirt')return 8900;
  return variant?.price??null;
 },
 stockRows(p,inventory,fresh) {
  // Owner-confirmed availability is boolean: no stock quantity is invented.
  if(p.id==='shorts')return p.colors.flatMap(c=>['S','M','L'].map(size=>({product:p.name,color:c[0],size,quantity:null,inStock:true})));
  if(!fresh||this.preorderOnly(p))return [];
  return inventory.filter(v=>v.product===(p.stockName||p.name)&&p.colors.some(c=>c[0]===v.color)&&['S','M','L'].includes(v.size)&&v.quantity>0);
 },
 matchesFilter(p,filter,inventory,fresh) {
  if(filter==='stock')return this.stockRows(p,inventory,fresh).length>0;
  if(filter==='preorder')return this.preorderOnly(p)||(fresh&&inventory.some(v=>v.product===(p.stockName||p.name)&&p.colors.some(c=>c[0]===v.color)&&v.preorder===true));
  return true;
 }
};
;
/* Source: payment.js */
// Public receiving wallet. No wallet access tokens or notification secrets belong here.
window.ACEFORM_PAYMENT = {
 receiver:'4100116872093109',
 fields(id,amount,method='AC') {
  if(!/^ACEFORM-[A-Za-z0-9-]{8,56}$/.test(id)||!Number.isSafeInteger(amount)||amount<=0||!['AC','PC'].includes(method))throw Error('Invalid payment');
  return {receiver:this.receiver,'quickpay-form':'button',sum:amount.toFixed(2),label:id,paymentType:method};
 }
};
;
/* Source: analytics.js */
(()=>{
 const STORE='aceform.analytics.queue',EXCLUDE='aceform.analytics.exclude';let queue=[],busy=false,enabled=true,opened=new Set(),selection=null,visible=false;
 try{const p=new URLSearchParams(location.search);if(p.get('analytics_test')==='1')localStorage.setItem(EXCLUDE,'1');if(p.get('analytics_test')==='0')localStorage.removeItem(EXCLUDE);}catch{}
 let test=0,visitor,session;
 try{
  test=localStorage.getItem(EXCLUDE)==='1'?1:0;const suffix=test?'.test':'';
  let v=JSON.parse(localStorage.getItem('aceform.analytics.browser'+suffix)||'null');if(!v||Date.now()-v.at>30*86400000)v={id:crypto.randomUUID(),at:Date.now()};localStorage.setItem('aceform.analytics.browser'+suffix,JSON.stringify(v));visitor=v.id;
  let s=JSON.parse(sessionStorage.getItem('aceform.analytics.visit'+suffix)||'null');if(!s||Date.now()-s.at>30*60000)s={id:crypto.randomUUID()};s.at=Date.now();sessionStorage.setItem('aceform.analytics.visit'+suffix,JSON.stringify(s));session=s.id;
  queue=JSON.parse(localStorage.getItem(STORE)||'[]');if(!Array.isArray(queue))queue=[];queue=queue.filter(x=>x&&Date.now()-x.at<7*86400000&&x.event&&x.id).slice(-120);
 }catch{enabled=false;}
 function save(){try{localStorage.setItem(STORE,JSON.stringify(queue.slice(-120)));}catch{}}
 function track(event,detail={}){
  if(!enabled)return;const e={id:crypto.randomUUID(),visitor,session,event,product:detail.product||'',color:Number.isInteger(detail.color)?detail.color:-1,size:['S','M','L'].includes(detail.size)?detail.size:'',bundle:['white','black','both'].includes(detail.bundle)?detail.bundle:'',test};
  queue.push({...e,at:Date.now()});queue=queue.slice(-120);save();if(queue.length>=4)flush();
 }
 function batch(){if(!queue.length)return [];const first=queue[0];return queue.filter(e=>e.visitor===first.visitor&&e.session===first.session).slice(0,6).map(({at,...e})=>e);}
 async function flush(){
  if(document.readyState!=='complete'||busy||!enabled||!queue.length||!window.ACEFORM_PAYMENT_BRIDGE)return;busy=true;
  try{const data=await window.ACEFORM_PAYMENT_BRIDGE.request('recordAnalytics',{events:JSON.stringify(batch())});if(Array.isArray(data.accepted)){const ids=new Set(data.accepted);queue=queue.filter(e=>!ids.has(e.id));save();}}
  catch{}finally{busy=false;}
 }
 function sendOnExit(){if(!enabled||!queue.length||!navigator.sendBeacon)return;try{navigator.sendBeacon(window.ACEFORM_STOCK_URL,new URLSearchParams({action:'recordAnalytics',events:JSON.stringify(batch())}));}catch{}}
 function maybeView(){if(visible&&selection&&!opened.has(selection.product)){opened.add(selection.product);track('product_open',selection);}}
 function view(s){selection=s;maybeView();}
 function start(){
  if(test){const note=document.createElement('p');note.className='hint';note.textContent='Тестовый режим: ваши действия исключены из статистики клиентов.';document.querySelector('header')?.after(note);}
  const target=document.querySelector('#preview');if(target&&'IntersectionObserver' in window){new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);maybeView();},{threshold:0.25}).observe(target);}
  track('app_open');flush();
 }
 window.ACEFORM_ANALYTICS={track,view,flush,sendOnExit,get test(){return test===1;}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)sendOnExit();else flush();});window.addEventListener('pagehide',sendOnExit);setInterval(flush,8000);if(document.readyState==='complete')setTimeout(start,0);else addEventListener('load',()=>setTimeout(start,0),{once:true});
})();
;
/* Source: tree/api-config.js */
// Public endpoint only. No bot token, sessions or spreadsheet ID.
window.ACEFORM_TREE_API='https://script.google.com/macros/s/AKfycbxcj04TcxSnvAXWFCR_CmgbGWYMtgqIUmie-wx-440XLrQIiwfAvFIUAqjQKe4w73qX/exec';
;
/* Source: tree/transport.js */
/* Cross-origin RPC: private request bodies never enter URLs or JSONP. */
(()=>{
 const ORIGIN='https://karinapolovina.github.io';
 let peer=null,peerOrigin=null,ready=null;
 const pending=new Map();
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 let nonce=random(),disconnect=()=>{};
 function connect(){
  if(ready)return ready;
  nonce=random();
  ready=new Promise((resolve,reject)=>{
   if(location.origin!==ORIGIN){reject(Error('Этот сервис подключается только с официальной страницы ACEFORM.'));return;}
   const endpoint=window.ACEFORM_TREE_API;if(!endpoint||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){reject(Error('Хранилище ещё подключается.'));return;}
   const frame=document.createElement('iframe');frame.hidden=true;frame.title='Защищённое соединение с хранилищем ACEFORM';
   const url=new URL(endpoint);url.searchParams.set('nonce',nonce);frame.src=url.href;
   const timer=setTimeout(()=>{disconnect();reject(Error('Не удалось подключиться к хранилищу Google. Попробуй ещё раз.'));},25000);
   function receive(event){
    const msg=event.data;
    if(!msg||msg.nonce!==nonce||!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;
    if(msg.kind==='aceform-tree-ready'&&!peer){peer=event.source;peerOrigin=event.origin;clearTimeout(timer);resolve();return;}
    if(event.source!==peer||event.origin!==peerOrigin||msg.kind!=='aceform-tree-response')return;
    const item=pending.get(msg.id);if(item){pending.delete(msg.id);clearTimeout(item.timer);msg.result?.ok?item.resolve(msg.result.data):item.reject(Error(msg.result?.error||'Сервис недоступен.'));}
   }
   disconnect=()=>{clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();peer=null;peerOrigin=null;ready=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Соединение прервалось. Проверь результат перед повторной отправкой.'));}pending.clear();};
   window.addEventListener('message',receive);
   document.body.append(frame);
  });
  return ready.catch(error=>{ready=null;throw error;});
 }
 window.ACEFORM_TREE_TRANSPORT={warm:connect,async request(path,method='GET',data,token){await connect();return new Promise((resolve,reject)=>{const id=random(),timer=setTimeout(()=>{pending.delete(id);disconnect();reject(Error('Ответ задерживается. Проверь «Моё желание» перед повторной отправкой.'));},30000);pending.set(id,{resolve,reject,timer});peer.postMessage({kind:'aceform-tree-request',nonce,id,request:{path,method,data:data||{},token:token||'',nonce:id}},peerOrigin);});}};
})();
;
/* Source: request-cart.js */
(()=>{
 'use strict';
 const catalog=[...window.ACEFORM_CATALOG,...(window.ACEFORM_APEROL_CATALOG||[])],$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key='aceform.basket.v1';let items=[],busy=false;const imageCache=new Map(),previewCache=new Map();const fast=src=>window.ACEFORM_MEDIA?.src(src)||src;
 function clean(s){const p=catalog.find(p=>p.id===s?.product);if(!p||!p.colors[Number(s.color)]||!['S','M','L'].includes(s.size)||!Number.isInteger(Number(s.quantity))||Number(s.quantity)<1||Number(s.quantity)>99)throw Error('Проверь выбранные вещи.');if(p.id.startsWith('aperol-')&&!['S','M','L'].includes(s[p.id==='aperol-suit'?'skirtSize':'shortsSize']))throw Error('Выбери размеры обеих частей комплекта.');return {product:p.id,color:Number(s.color),size:s.size,quantity:Number(s.quantity),mode:p.id.startsWith('aperol-')?'preorder':s.mode==='stock'?'stock':'query',...(p.id==='aperol-suit'?{skirtSize:s.skirtSize}:p.id==='aperol-dress'?{shortsSize:s.shortsSize,...(s.extraShorts===true?{extraShorts:true}:{})}:{}),...(p.id==='dress'?{bundle:['white','black','both'].includes(s.bundle)?s.bundle:'white',shortsSize:['S','M','L'].includes(s.shortsSize)?s.shortsSize:s.size}:{})};}
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved)&&saved.length<=4)items=saved.map(clean);}catch{}
 const same=(a,b)=>['product','color','size','bundle','shortsSize','skirtSize','extraShorts'].every(k=>a[k]===b[k]);
 function merge(current,more){const next=current.map(clean);for(const raw of more){const s=clean(raw),old=next.find(x=>same(x,s));if(old){if(old.quantity+s.quantity>99)throw Error('Можно добавить до 99 единиц одной вещи.');old.quantity+=s.quantity;}else{if(next.length===4)throw Error('В корзине можно собрать до четырёх разных вещей.');next.push(s);}}return next;}
 function save(){try{localStorage.setItem(key,JSON.stringify(items));}catch{}renderBadge();}
 const model=s=>catalog.find(p=>p.id===s.product),name=s=>s.product.startsWith('aperol-')?model(s).name:model(s).name.split(' · ')[0];
 const sizeText=s=>s.product==='aperol-suit'?'GRAF '+s.size+' / BUENO '+s.skirtSize:s.product==='aperol-dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:s.size;
 const image=s=>fast(s.product==='shorts'?'assets/shorts-pair.png':model(s).colors[s.color][2]);
 const outfit=(t,s)=>fast(`assets/outfit-graf-${t}-bueno-${s}.webp`);
 function node(tag,html){const el=document.createElement(tag);el.innerHTML=html;return el;}
 const toast=node('p','');toast.id='basketStatus';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');$('.sticky').prepend(toast);
 const badge=node('button','Корзина');badge.id='basketOpen';badge.className='basket-open';badge.type='button';document.querySelector('header').append(badge);
 const dock=node('button','');dock.id='basketDock';dock.className='secondary';dock.type='button';$('.sticky').append(dock);
 const cart=node('dialog','<button class="basket-close" aria-label="Закрыть корзину">×</button><small>ТВОЙ ВЫБОР</small><h2>Корзина</h2><div id="basketItems"></div><p id="basketError" role="alert" hidden></p><div id="basketActions"></div><button type="button" class="secondary" id="basketContinue">Продолжить выбор</button>');cart.id='basketDialog';document.body.append(cart);
 const look=node('dialog','<button class="basket-close" aria-label="Закрыть образ">×</button><small>GRAF + BUENO</small><h2>Твой образ</h2><img id="outfitPhoto" alt="Топ GRAF и юбка BUENO вместе на фигуре"><div id="outfitChoices"></div><p id="outfitError" role="alert" hidden></p><button type="button" class="primary" id="outfitAdd">Добавить комплект в корзину</button>');look.id='outfitDialog';document.body.append(look);
 const lookButton=node('button','Посмотреть топ с юбкой');lookButton.type='button';lookButton.className='secondary';lookButton.id='outfitOpen';$('#colors').parentElement.insertBefore(lookButton,$('#colors')); // moved below the colour controls after initialisation
 $('#colors').after(lookButton);
 const summary=node('section','');summary.className='basket-summary';$('#summary').before(summary);
 function renderBadge(){const n=items.reduce((n,s)=>n+s.quantity,0);badge.textContent=n?'Корзина · '+n:'Корзина';dock.hidden=!n;dock.textContent='Корзина · '+n+' '+(n===1?'изделие':n<5?'изделия':'изделий');}
 function say(message){toast.textContent=message;}
 function add(more){items=merge(items,more);save();say('Добавлено в корзину. Можно продолжить выбор.');window.ACEFORM_ANALYTICS?.track('basket_add',{count:items.length});document.dispatchEvent(new CustomEvent('aceform:basket-added',{detail:more.map(clean)}));}
 function openCart(){window.ACEFORM_TREE_TRANSPORT?.warm?.().catch(()=>{});renderCart();if(!cart.open)cart.showModal();}
 function renderCart(){
  $('#basketError').hidden=true;const box=$('#basketItems');box.innerHTML=items.length?items.map((s,i)=>`<article class="basket-row"><div class="basket-thumb ${s.product==='shorts'?'basket-shorts':''}" ${s.product==='shorts'?`style="--shorts-position:${s.color===0?'left':'right'}"`:''}><img src="${image(s)}" alt="${esc(name(s))}"></div><div><h3>${esc(name(s))}</h3><p>${esc(model(s).colors[s.color][0])} · ${esc(sizeText(s))}</p>${s.product==='aperol-dress'?`<p>${esc(window.ACEFORM_COMMERCE.aperolShorts(s))}</p><label class="aperol-extra"><input type="checkbox" data-extra-shorts="${i}" ${s.extraShorts?'checked':''}><span>Вторая пара MARBLE · +1 500 ₽</span></label>`:''}${s.product==='dress'?`<p>Шорты ${s.bundle==='both'?'белые + чёрные':s.bundle==='black'?'чёрные':'белые'} · ${s.shortsSize}</p>`:''}<div class="basket-sizes">${(s.product==='aperol-suit'?[['size','Топ GRAF'],['skirtSize','Юбка BUENO']]:s.product==='aperol-dress'||s.product==='dress'?[['size',s.product==='dress'?'Платье':'Платье EVERT'],['shortsSize','Шорты MARBLE']]:[['size','Размер']]).map(([field,label])=>`<label>${label}<select data-size="${i}" data-field="${field}" aria-label="${esc(name(s))}: ${label}">${['S','M','L'].map(v=>`<option ${s[field]===v?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div><label>Количество <input data-qty="${i}" type="number" min="1" max="99" value="${s.quantity}"></label><button class="size-link" data-remove="${i}" type="button">Убрать</button></div></article>`).join(''):'<p>Добавь вещи из коллекции или собери образ из топа и юбки.</p>';
  box.querySelectorAll('[data-extra-shorts]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.extraShorts);items[i]=clean({...items[i],extraShorts:input.checked});save();renderCart();});
  box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{items.splice(Number(b.dataset.remove),1);save();renderCart();});
  box.querySelectorAll('[data-qty]').forEach(input=>input.onchange=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>99){input.value=items[input.dataset.qty].quantity;return;}items[input.dataset.qty].quantity=n;save();renderCart();});
  box.querySelectorAll('[data-size]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.size);items[i]=clean({...items[i],[input.dataset.field]:input.value});save();renderCart();});
  const actions=$('#basketActions');actions.replaceChildren();if(!items.length)return;
  const snapshot=items.map(clean),picture=node('details','<summary>Посмотреть весь набор</summary><p class="hint">Готовим изображение…</p>');picture.className='basket-picture';preview(snapshot).then(p=>{if(!picture.isConnected)return;picture.querySelector('p').remove();const img=document.createElement('img');img.className='basket-look';img.alt='Весь выбранный набор';img.src='data:image/jpeg;base64,'+p.jpeg;picture.append(img);}).catch(()=>{picture.querySelector('p').textContent='Не удалось загрузить изображение. Проверь соединение.';});
  if(items.some(s=>s.product==='dress')&&window.ACEFORM_SHOP?.stockLoading())actions.append(node('p','Проверяем наличие платья. Можно продолжить выбор; оплата появится после подтверждения наличия.'));const pay=items.filter(s=>window.ACEFORM_SHOP?.canPay(s));if(pay.length===1&&items.length===1){const b=node('button','Оплатить платье из наличия');b.type='button';b.className='primary';b.onclick=async()=>{cart.close();await window.ACEFORM_SHOP.pay(pay[0]);};actions.append(b);if(items.length>1)actions.append(node('p','Платье можно оплатить отдельно. Остальные вещи останутся в корзине.'));}
  const pricing=window.ACEFORM_COMMERCE.basketPrice(items),rub=n=>n.toLocaleString('ru-RU')+' ₽';
  if(pricing){const prices=node('section',pricing.lines.map(l=>`<p>${esc(name(l.selection))} · ${l.selection.quantity} шт. — <strong>${rub(l.total)}</strong>${l.paired?'<br><small>Топ к юбке — 2 000 ₽, скидка 900 ₽ за каждый комплект.</small>':''}</p>`).join('')+`<p><strong>Итого за изделия: ${rub(pricing.total)}</strong></p><p class="hint">${pricing.discount?'Выгода за комплект: '+rub(pricing.discount)+'. ':''}Доставка оплачивается отдельно. Предоплата 50% — после подтверждения заказа в Telegram.</p>`);actions.append(prices);}
  const ask=node('button',pricing?'Оформить заказ · '+rub(pricing.total):items.every(s=>s.product==='dress')?'Согласовать весь заказ':'Оформить заказ');ask.type='button';ask.className='secondary';ask.onclick=()=>{cart.close();window.ACEFORM_SHOP.request(items[0]);};actions.append(ask);actions.append(node('p','<span class="hint">Срок и доставку согласуем в Telegram. Если в заказе есть отдельные шорты, их стоимость подтвердим до оплаты.</span>'));actions.append(picture);
 }
 let choice={top:0,skirt:0,topSize:'M',skirtSize:'M'};
 function openLook(){const selected=window.ACEFORM_SHOP?.selection(),t=items.find(s=>s.product==='top'),s=items.find(s=>s.product==='skirt');choice={top:t?.color||0,skirt:s?.color||0,topSize:t?.size||selected?.size||'M',skirtSize:s?.size||selected?.size||'M'};if(selected?.product==='top'){choice.top=selected.color;choice.topSize=selected.size;}if(selected?.product==='skirt'){choice.skirt=selected.color;choice.skirtSize=selected.size;}renderLook();look.showModal();}
 function renderLook(){
  $('#outfitPhoto').src=outfit(choice.top,choice.skirt);$('#outfitAdd').textContent='Добавить комплект · 10 900 ₽';$('#outfitError').hidden=true;$('#outfitChoices').innerHTML=['top','skirt'].map(id=>{const p=catalog.find(p=>p.id===id);return `<fieldset><legend>${esc(p.name.split(' · ')[0])}</legend><label>Цвет<select data-look="${id}">${p.colors.map((c,i)=>`<option value="${i}" ${i===choice[id]?'selected':''}>${esc(c[0])}</option>`).join('')}</select></label><label>Размер<select data-look="${id}Size">${['S','M','L'].map(s=>`<option ${s===choice[id+'Size']?'selected':''}>${s}</option>`).join('')}</select></label></fieldset>`}).join('');$('#outfitChoices').querySelectorAll('[data-look]').forEach(el=>el.onchange=()=>{choice[el.dataset.look]=el.dataset.look.endsWith('Size')?el.value:Number(el.value);renderLook();});
 }
 $('#outfitAdd').onclick=()=>{try{add([{product:'top',color:choice.top,size:choice.topSize,quantity:1},{product:'skirt',color:choice.skirt,size:choice.skirtSize,quantity:1}]);look.close();}catch(e){$('#outfitError').hidden=false;$('#outfitError').textContent=e.message;}};
 badge.onclick=dock.onclick=openCart;lookButton.onclick=openLook;$('#basketContinue').onclick=()=>cart.close();[cart,look].forEach(d=>d.querySelector('.basket-close').onclick=()=>d.close());
 function loadImage(src){if(imageCache.has(src))return imageCache.get(src);const promise=new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось загрузить изображение набора. Повтори отправку.'));i.src=src;});imageCache.set(src,promise);promise.catch(()=>{if(imageCache.get(src)===promise)imageCache.delete(src);});while(imageCache.size>8)imageCache.delete(imageCache.keys().next().value);return promise;}
 async function preview(selections){const snapshot=selections.map(clean),key=JSON.stringify(snapshot);if(previewCache.has(key))return previewCache.get(key);const result=composePreview(snapshot);previewCache.set(key,result);result.catch(()=>previewCache.delete(key));while(previewCache.size>4)previewCache.delete(previewCache.keys().next().value);return result;}
 function contain(ctx,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height),iw=img.width*scale,ih=img.height*scale;ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
 async function composePreview(snapshot){
  const c=document.createElement('canvas');c.width=960;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='#faf9f6';ctx.fillRect(0,0,960,1200);ctx.fillStyle='#203d32';ctx.font='32px Georgia';ctx.fillText('ACEFORM · Твой набор',36,55);
  const t=snapshot.find(s=>s.product==='top'),s=snapshot.find(s=>s.product==='skirt'),pair=t&&s,extra=snapshot.filter(i=>!pair||i!==t&&i!==s);
  const included=snapshot.filter(i=>i.product==='dress').flatMap(i=>(i.bundle==='both'?[0,1]:[i.bundle==='black'?1:0]).map(color=>({product:'shorts',color,size:i.shortsSize,quantity:i.quantity,mode:'stock'})));await Promise.all([...new Set([...(pair?[outfit(t.color,s.color)]:[]),...(pair?extra:snapshot).map(image),...included.map(image)])].map(loadImage));
  if(pair){contain(ctx,await loadImage(outfit(t.color,s.color)),20,80,extra.length?540:920,850);}
  const slots=[...(pair?extra:snapshot),...included],cols=pair?1:slots.length===1?1:2,area=pair?{x:590,y:90,w:330,h:820}:{x:25,y:90,w:910,h:800};
  for(let i=0;i<slots.length;i++){const item=slots[i],rows=Math.ceil(slots.length/cols),w=area.w/cols,h=area.h/rows,x=area.x+(i%cols)*w,y=area.y+Math.floor(i/cols)*h,img=await loadImage(image(item));if(item.product==='shorts'){ctx.drawImage(img,item.color===0?0:img.width/2,0,img.width/2,img.height,x,y,w,h-38);}else contain(ctx,img,x+8,y+8,w-16,h-44);ctx.fillStyle='#203d32';ctx.font='20px Arial';ctx.fillText(name(item),x+10,y+h-15,w-20);}
  ctx.fillStyle='#203d32';ctx.font='21px Arial';let y=950;for(const item of snapshot){ctx.fillText(`${name(item)} · ${sizeText(item)} · ${item.quantity} шт.`,36,y,890);ctx.font='17px Arial';ctx.fillText(model(item).colors[item.color][0]+(item.product==='aperol-dress'?' · '+window.ACEFORM_COMMERCE.aperolShorts(item):'')+(item.product==='dress'?' · шорты '+item.shortsSize+' / '+(item.bundle==='both'?'2 пары':'1 пара'):''),36,y+25,890);ctx.font='21px Arial';y+=58;}
  let jpeg;for(const quality of [.76,.62,.48,.35]){jpeg=c.toDataURL('image/jpeg',quality).split(',')[1];if(jpeg.length<=170000)break;}if(jpeg.length>170000)throw Error('Не удалось подготовить изображение. Повтори отправку.');return {version:1,manifest:snapshot,jpeg};
 }
 window.ACEFORM_REQUEST_CART={open(selection){if(!items.length)add([selection]);$('#summary').hidden=true;summary.innerHTML=items.map(s=>`<p><strong>${esc(name(s))}</strong><br>${esc(model(s).colors[s.color][0])} · ${esc(s.product==='dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:sizeText(s))} · ${s.quantity} шт.${s.product==='aperol-dress'?'<br>'+esc(window.ACEFORM_COMMERCE.aperolShorts(s)):''}</p>`).join('');},add,merge,clean,value(){return items.map(clean);},clear(){items=[];save();summary.replaceChildren();},preview,openCart,stockChanged(){if(cart.open)renderCart();},registerPayment(id,selection){try{const map=JSON.parse(localStorage.getItem('aceform.basketPayments')||'{}');map[id]=clean(selection);localStorage.setItem('aceform.basketPayments',JSON.stringify(map));}catch{}},settlePayment(id){try{const map=JSON.parse(localStorage.getItem('aceform.basketPayments')||'{}'),s=map[id];if(!s)return;const i=items.findIndex(x=>same(x,s));if(i>=0){items[i].quantity-=s.quantity;if(items[i].quantity<=0)items.splice(i,1);}delete map[id];localStorage.setItem('aceform.basketPayments',JSON.stringify(map));save();}catch{}},selectionChanged(s){lookButton.hidden=!['top','skirt'].includes(s.product);lookButton.textContent=s.product==='skirt'?'Добавь топ к юбке за 2 000 ₽':'Собрать комплект с юбкой · 10 900 ₽';},update(){renderBadge();}};
 renderBadge();
})();
;
/* Source: preorder.js */
(()=>{
 'use strict';
 const form=document.querySelector('#orderForm'),button=form.querySelector('button[type="submit"]'),error=document.querySelector('#preorderError');
 let inquiry=false,fixed=false;
 const node=id=>document.querySelector('#'+id);
 const defaultConsent=node('requestConsent').textContent;
 const extras=document.createElement('details');extras.id='requestExtras';const extraSummary=document.createElement('summary');extraSummary.textContent='Добавить имя или пожелания · необязательно';extras.append(extraSummary);node('contactLabel').after(extras);
 const uuid=()=>crypto.randomUUID().replace(/-/g,'');let busy=false,session=uuid();
 try{session=sessionStorage.getItem('aceform.shopSession')||session;sessionStorage.setItem('aceform.shopSession',session);}catch{}
 let memoryDraft=null;
 async function intent(data){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
  const fingerprint=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  let saved=memoryDraft;try{saved=JSON.parse(sessionStorage.getItem('aceform.preorderIntent')||'null')||saved;}catch{}
  if(!saved||saved.fingerprint!==fingerprint)saved={fingerprint,nonce:uuid()};memoryDraft=saved;
  try{sessionStorage.setItem('aceform.preorderIntent',JSON.stringify(saved));}catch{}
  return saved.nonce;
 }
 window.ACEFORM_PREORDER={open(selection){window.ACEFORM_REQUEST_CART?.open(selection);inquiry=window.ACEFORM_REQUEST_CART?.value().some(s=>(['top','skirt'].includes(s.product)||s.product.startsWith('aperol-')))||false;fixed=!!window.ACEFORM_COMMERCE.basketPrice(window.ACEFORM_REQUEST_CART?.value()||[]);error.hidden=true;error.textContent='';button.disabled=busy;button.textContent=inquiry?'Отправить запрос ↗':'Отправить заявку ↗';node('requestEyebrow').textContent=inquiry?'ТВОЙ ЗАПРОС':'ТВОЙ ВЫБОР';node('requestTitle').textContent=inquiry?'Узнать стоимость и срок':'Почти на корте.';node('requestSuccessTitle').textContent=inquiry?'Запрос получен':'Заявка получена';const name=form.querySelector('[name=customer]');name.required=!inquiry;form.querySelector('[name=comment]').maxLength=inquiry?850:1000;if(inquiry){extras.append(node('customerLabel'),node('commentLabel'));}else{node('requestFields').prepend(node('customerLabel'));node('contactLabel').after(node('commentLabel'));}extras.hidden=!inquiry;const telegram=!!window.Telegram?.WebApp?.initData;node('requestFields').hidden=inquiry&&!telegram;button.hidden=inquiry&&!telegram;node('preorderTelegram').hidden=!inquiry||telegram;node('preorderTelegram').textContent=inquiry?'Открыть выбранное изделие в Telegram ↗':'Открыть магазин в Telegram ↗';node('preorderTelegram').href=selection.product.startsWith('aperol-')?'https://t.me/aceform_bot/shop?startapp=aperol_'+selection.product.slice(7)+'_'+selection.color+'_'+selection.size+'_'+(selection.skirtSize||selection.shortsSize)+(selection.extraShorts?'_both':''):inquiry?'https://t.me/aceform_bot/shop?startapp=ask_'+selection.product+'_'+selection.color+'_'+selection.size:'https://t.me/aceform_bot/shop';node('requestConsent').textContent=inquiry?'Передаю ACEFORM выбранные вещи, их общее изображение, контакт, а также имя и пожелания, если указаны, для ответа о стоимости и сроке изготовления.':defaultConsent;node('requestNote').textContent=inquiry?(telegram?'Сообщим стоимость и срок изготовления по указанному контакту. Это запрос информации, без оплаты и обязательства оформить заказ.':'Отправка запроса доступна в Telegram. Открой магазин — выбранные изделие, цвет и размер сохранятся.'):'Отправим заявку в ACEFORM. Стоимость, наличие и срок согласуем с вами.';if(fixed){button.textContent='Оформить заказ ↗';node('requestEyebrow').textContent='ТВОЙ ЗАКАЗ';node('requestTitle').textContent='Оформить заказ';node('requestSuccessTitle').textContent='Заказ получен';node('requestConsent').textContent='Передаю ACEFORM выбранные изделия, контакт и пожелания для оформления заказа.';node('requestNote').textContent=telegram?'Цена изделий зафиксирована. В Telegram выбери доставку, проверь заказ и внеси предоплату 50%. Срок изготовления согласуем отдельно.':'Для оформления открой магазин в Telegram. Выбранные изделия сохранятся.';}},async submit(selection){
  if(busy)return;error.hidden=true;error.textContent='';
  if(!form.reportValidity())return;
  const tg=window.Telegram?.WebApp;if(!tg?.initData){error.hidden=false;error.textContent=inquiry?'Чтобы отправить запрос стоимости и срока, открой магазин в Telegram через @aceform_bot.':'Для итога заказа и предоплаты открой магазин в Telegram через @aceform_bot.';document.querySelector('#preorderTelegram').hidden=false;return;}
  const fields=new FormData(form),data={session,name:String(fields.get('customer')||'').trim()||(inquiry?(tg.initDataUnsafe?.user?.first_name||'Клиент ACEFORM'):''),contact:String(fields.get('contact')||'').trim(),comment:(inquiry&&!fixed?'Запрос стоимости и срока изготовления. Без оформления заказа.\n':'')+String(fields.get('comment')||'').trim(),selection:{...selection},consent:fields.get('consent')==='yes',website:String(fields.get('website')||''),certificate:window.ACEFORM_CERTIFICATE?.requested?'club1000':''};
  const cart=window.ACEFORM_REQUEST_CART?.value();if(cart?.length){data.schemaVersion=3;if(fixed)data.fixedCatalogVersion=1;data.selections=cart;data.selection=cart[0];}
  busy=true;button.disabled=true;button.textContent=inquiry?'Отправляем запрос…':'Отправляем заявку…';
  try{
   data.nonce=await intent(data);data.preview=await window.ACEFORM_REQUEST_CART.preview(data.selections);data.initData=tg.initData;
   if(tg.initDataUnsafe?.user?.allows_write_to_pm!==true&&tg.requestWriteAccess){const allowed=await new Promise(resolve=>tg.requestWriteAccess(resolve));if(!allowed)throw Error('Разреши боту прислать итог заказа, чтобы продолжить.');}
   const result=await window.ACEFORM_TREE_TRANSPORT.request('/api/shop/orders','POST',data);
   if(result?.received!==true||!/^[a-f0-9]{32}$/.test(result.id||''))throw Error('Не удалось подтвердить получение заявки. Повтори отправку.');
   window.ACEFORM_REQUEST_CART?.clear();form.classList.add('hidden');document.querySelector('#result').classList.remove('hidden');
   document.querySelector('#preorderReference').textContent='№ '+result.id.slice(0,8).toUpperCase();
   document.querySelector('#preorderSuccessText').textContent=inquiry?(result.duplicate?'Этот запрос уже получен. Повторно отправлять его не нужно.':'Запрос получен. В @aceform_bot придёт сообщение со всеми выбранными изделиями и вопросом о доставке. Стоимость и срок подтвердим после уточнения деталей.'):result.duplicate?'Эта заявка уже получена. Повторно отправлять её не нужно.':'Заявка получена. Итог заказа придёт в @'+(result.botUsername==='aceform_tree_bot'?'aceform_tree_bot':'aceform_bot')+'. Там можно проверить состав, подтвердить заказ и оплатить 50% предоплаты, когда указана цена.';
   if(fixed){node('preorderSuccessText').textContent='Заказ получен. В @aceform_bot выбери доставку, проверь фиксированную стоимость и подтверди заказ. Предоплата — 50%. Срок изготовления согласуем отдельно.';}const orderLink=document.querySelector('#preorderOrderLink');orderLink.href='https://t.me/aceform_bot/shop?startapp=order_'+result.id;orderLink.hidden=false;orderLink.textContent=fixed?'Проверить заказ и внести предоплату ↗':inquiry?'Проверить выбор и указать доставку ↗':'Посмотреть итог заказа ↗';if(window.ACEFORM_CUSTOMER_ORDERS&&window.Telegram?.WebApp?.initData){window.ACEFORM_CUSTOMER_ORDERS.open(result.id);return;}
   if(data.certificate&&!inquiry)document.querySelector('#preorderSuccessText').textContent+=' Применение сертификата показано в итоговом заказе.';
  }catch(e){error.hidden=false;error.textContent=(e.message||'').replace('Проверь «Моё желание» перед повторной отправкой.','Повтори отправку — дубль заявки не создастся.')||'Не удалось отправить заявку. Проверь соединение и попробуй ещё раз. Данные формы сохранены.';}
  finally{busy=false;button.disabled=false;button.textContent=fixed?'Оформить заказ ↗':inquiry?'Отправить запрос ↗':'Отправить заявку ↗';}
 }};
 document.querySelector('#preorderClose').onclick=()=>document.querySelector('#orderDialog').close();
})();
;
/* Source: app.js */
// Customer order links preserve the signed Telegram launch when opening the receipt.
{const tg=window.Telegram?.WebApp,start=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';if(!['my-orders','shop','cart'].includes(new URLSearchParams(location.search).get('screen'))&&/^(order|manage)_[a-f0-9]{32}$/.test(start)){const target=new URL((start.startsWith('manage_')?'orders.html?order='+start.slice(7):'my-order.html?order='+start.slice(6)),location.href),fragment=new URLSearchParams();fragment.set('tgWebAppData',tg?.initData||'');fragment.set('tgWebAppVersion',tg?.version||'8.0');fragment.set('tgWebAppPlatform',tg?.platform||'unknown');target.hash=fragment.toString();location.replace(target.href);}}
const $ = s => document.querySelector(s);
const products = window.ACEFORM_CATALOG;
const sizes = ['S','M','L'];
const tg = window.Telegram?.WebApp;
if (tg?.initData) {try {tg.ready();tg.expand();tg.setHeaderColor('#f7f7f0');tg.setBackgroundColor('#f7f7f0');}catch {}}
let state = {product:0,color:0,size:'M',quantity:1,mode:'query',filter:'all',bundle:'white',shortsSize:'M',shortsSizeCustomized:false,sizeChosen:false,shortsColor:'white'};
const commerce=window.ACEFORM_COMMERCE;
{const start=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'',m=start.match(/^ask_(top|skirt)_([0-5])_(S|M|L)$/);if(m){const i=products.findIndex(p=>p.id===m[1]);if(i>=0&&products[i].colors[Number(m[2])]){state.product=i;state.color=Number(m[2]);state.size=m[3];state.shortsSize=m[3];}}}
let checkoutSettings={includedShorts:'unknown'};
let inventory = [], receivedAt = 0, feedState = 'loading', pendingStock = null, requestSelection = null;
const fastMedia=src=>window.ACEFORM_MEDIA?.src(src)||src;
let renderedCatalog='',renderedPreview='';
const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
function current() {return products[state.product];}
function trackAction(event){window.ACEFORM_ANALYTICS?.track(event,{product:current().id,color:state.color,size:state.size,bundle:current().id==='dress'?state.bundle:''});}
function variant() {
 if(feedState !== 'ready' || Date.now()-receivedAt>90000)return null;
 const p=current(), matches=inventory.filter(v=>v.product===(p.stockName||p.name)&&v.color===p.colors[state.color][0]&&v.size===state.size);
 return matches.length===1?matches[0]:null;
}
function photo(p,ci,card=false) {
 const c=p.colors[ci];
 if(p.id==='shorts')return `<div class="shorts-pair" style="background-position:${ci===0?'left':'right'} center" role="img" aria-label="${p.name}, ${c[0]}"></div>`;
 if(!c[2])return `<div class="shorts-sketch"><svg viewBox="0 0 200 200" role="img" aria-label="Эскиз чёрных шорт"><path fill="#252827" stroke="#777" d="M53 46h94l12 117h-49l-10-62-10 62H41z"/><path fill="none" stroke="#777" d="M53 58h94M100 59v42"/></svg><small>Эскиз · фото скоро</small></div>`;
 const css=/-catalog(?:-v\d+)?\./.test(c[2])?'catalog-photo':p.id==='dress'&&ci===0?'black-photo':p.id==='top'?'top-photo':p.id==='skirt'?'skirt-photo':p.id==='shorts'?'shorts-photo':'';
 return `<img class="garment-photo ${css}" src="${fastMedia(c[2])}" alt="${p.name}, ${c[0]}" ${card?'loading="lazy"':''}>`;
}
function buttons(el,values,selected,fn,swatches=false) {
 el.replaceChildren();values.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.className=(swatches?'swatch':'option')+(i===selected?' selected':'');const label=Array.isArray(v)?v[0]:v;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',i===selected);if(swatches)b.style.setProperty('--color',v[1]);else b.textContent=label;b.onclick=()=>fn(i);el.append(b)});
}
function preorderOnly(p=current()) {return commerce.preorderOnly(p);}
function stockFresh() {return feedState==='ready'&&Date.now()-receivedAt<=90000;}
// Keep the last confirmed catalog selection while refreshing. Checkout still requires fresh stock.
function stockRows(p) {return commerce.stockRows(p,inventory,receivedAt>0);}
function inStock() {return commerce.inStock(current(),variant(),stockFresh());}
function bundleLimit() {return commerce.bundleLimit(state.bundle,state.shortsSize,inventory,checkoutSettings.includedShorts,variant()?.quantity||0);}
function orderLimit() {return state.mode==='stock'?(current().id==='dress'?bundleLimit():commerce.orderLimit(current(),variant())):99;}
function visibleProducts() {return products.filter(p=>commerce.matchesFilter(p,state.filter,inventory,receivedAt>0));}
function bundleNeedsConfirmation() {return current().id==='dress'&&(state.shortsSize!==state.size||bundleLimit()<1);}
function unitPrice() {return commerce.unitPrice(current(),state.bundle,variant());}
function totalPrice(){const subtotal=unitPrice()*state.quantity;return subtotal-(window.ACEFORM_CERTIFICATE?.discount(subtotal)||0);}
window.ACEFORM_CERTIFICATE_RENDER=()=>render();
function selectProduct(i) {
 state.product=i;state.color=0;state.quantity=1;state.mode='query';
 if(state.filter==='stock'){
  const v=stockRows(current())[0];
  if(v){state.color=current().colors.findIndex(c=>c[0]===v.color);state.size=v.size;state.shortsSize=v.size;state.shortsSizeCustomized=false;}
 }
}
function availability() {
 if(preorderOnly())return {label:'Предзаказ',kind:'preorder'};
 if(current().id==='shorts')return {label:'В наличии',kind:'available'};
 const v=variant();
 if(!v || v.quantity===null)return {label:'Наличие уточняется',kind:'unknown'};
 if(v.quantity>0&&bundleNeedsConfirmation())return {label:'Платье в наличии · комплектация уточняется',kind:'unknown'};
 if(v.quantity>0)return {label:'В наличии',kind:'available'};
 return {label:v.preorder===true?'Предзаказ':v.preorder===false?'Нет в наличии':'Предзаказ уточняется',kind:v.preorder===true?'preorder':'unknown'};
}
function render() {
 const visible=visibleProducts();
 if(visible.length&&!visible.includes(current()))selectProduct(products.indexOf(visible[0]));
 if(state.filter==='stock'&&visible.length&&!stockRows(current()).some(v=>v.color===current().colors[state.color][0]&&v.size===state.size))selectProduct(state.product);
 const p=current(),v=variant(),a=availability(),hasSelection=visible.length>0;const isDress=p.id==='dress',inquiry=preorderOnly(p);$('#inquiryIntro').hidden=!inquiry;$('#inquiryTitle').textContent=p.name;$('#quantityAdvanced').hidden=false;$('#productDetails').classList.toggle('dress-flow',isDress);$('#productDetails').classList.toggle('inquiry-flow',inquiry);$('#dressIntro').hidden=!isDress;$('#dressAnswers').hidden=!isDress;$('#dressCheckoutHint').hidden=!isDress;$('#fitGallery').querySelector('h2').textContent=isDress?'Другие ракурсы и детали':'На фигуре';$('#generalNote').hidden=isDress||inquiry;$('#generalDeliveryNote').hidden=isDress||inquiry;$('#sizeHint').textContent=isDress?(state.sizeChosen?'Размер платья: '+state.size+'. Шорты: '+state.shortsSize+'.':'Выбери свой размер. Шорты будут того же размера.'):inquiry?'Если сомневаешься в размере, поможем подобрать при ответе.':'Размер можно уточнить при согласовании предзаказа.';window.ACEFORM_ANALYTICS?.view({product:p.id,color:state.color,size:state.size,bundle:p.id==='dress'?state.bundle:''});
 if(isDress){$('#dressAnswers').after($('#fitGallery'));$('#fitGallery').after($('#productStory'));}else if(inquiry){$('#purchaseOptions').after($('#fitGallery'));$('#fitGallery').after($('#productStory'));}else{$('#purchaseOptions').before($('#fitGallery'));$('#purchaseOptions').before($('#productStory'));}$('#quantityAdvanced').querySelector('summary').textContent=isDress?'Количество комплектов':'Количество';$('#productDetails').hidden=!hasSelection;$('#review').disabled=!hasSelection;
 $('#filterHint').textContent=state.filter==='stock'?(feedState==='loading'?'Обновляем наличие. Выбранный комплект сохранён.':feedState==='error'?'Не удалось подтвердить наличие. Обновите остатки перед оплатой.':hasSelection?'Показаны изделия в наличии. Выберите цвет и размер.':'Сейчас нет изделий с подтверждённым наличием. Посмотрите предзаказ или все изделия.'):'';
 buttons($('#catalogFilters'),['Все','В наличии','Предзаказ'],['all','stock','preorder'].indexOf(state.filter),i=>{state.filter=['all','stock','preorder'][i];state.quantity=1;render()});

 if(preorderOnly())state.mode='preorder';
 if(p.id==='shorts'||(p.id==='dress'&&inStock()&&!bundleNeedsConfirmation()&&state.mode==='query'))state.mode='stock';
 if(state.mode==='stock'&&(!inStock()||bundleNeedsConfirmation()))state.mode='query';
 if(state.mode==='preorder'&&!preorderOnly()&&v?.preorder!==true)state.mode='query';
 if(isDress)state.mode=inStock()&&!bundleNeedsConfirmation()?'stock':v?.quantity===0&&v.preorder===true?'preorder':'query';
 if(state.mode==='stock')state.quantity=Math.min(state.quantity,orderLimit());
 const catalogKey=JSON.stringify([state.filter,state.product,visible.map(p=>[p.id,state.filter==='stock'?stockRows(p)[0]?.color:''])]);if(renderedCatalog!==catalogKey){renderedCatalog=catalogKey;
 $('#products').replaceChildren();products.forEach((p,i)=>{if(!visible.includes(p))return;const b=document.createElement('button');b.type='button';b.className='product'+(i===state.product?' selected':'');b.setAttribute('aria-pressed',i===state.product);b.innerHTML=`<div class="thumb">${photo(p,state.filter==='stock'?p.colors.findIndex(c=>c[0]===stockRows(p)[0].color):0,true)}<span class="check">✓</span></div><b>${p.name}</b><em>${p.subtitle}</em><span class="card-price">${p.id==='dress'?money(8000)+' · платье + шорты':preorderOnly(p)?money(commerce.unitPrice(p)):'В наличии'}</span>`;b.onclick=()=>{if(window.ACEFORM_STOREFRONT){window.ACEFORM_STOREFRONT.open(p.id);return;}selectProduct(i);render();$('#productDetails').scrollIntoView({behavior:'smooth',block:'start'})};const wrap=document.createElement('div');wrap.className='product-card';const help=document.createElement('button');help.type='button';help.className='size-link card-size';help.textContent='Подобрать размер ↗';help.setAttribute('aria-label','Подобрать размер: '+p.name);help.onclick=()=>{selectProduct(i);render();openSizeGuide()};wrap.append(b,help);$('#products').append(wrap)});}
 const copy=window.ACEFORM_DESCRIPTIONS[p.id];
 $('#productStoryTitle').textContent=copy.title;$('#productStoryText').textContent=copy.text;$('#productStoryNote').textContent=inquiry?'Цена указана за изделие. Срок изготовления и доставку согласуем отдельно.':copy.note;
 $('#modelHistoryText').textContent=copy.history;
 $('#productBenefits').replaceChildren();for(const benefit of copy.benefits){const item=document.createElement('li');item.textContent=benefit;$('#productBenefits').append(item)}
 const modelImages=isDress?[...window.ACEFORM_MODELS[p.id][state.color].slice(1),p.colors[state.color][2]]:window.ACEFORM_MODELS[p.id][state.color];$('#fitGallery').hidden=modelImages.length===0;
 const gallery=$('#modelPhotos'),galleryKey=p.id+':'+state.color,previousIndex=gallery.dataset.selection===galleryKey?Math.round((gallery.scrollLeft||0)/((gallery.clientWidth||1)+12)):0;if(gallery.dataset.selection!==galleryKey){gallery.dataset.selection=galleryKey;
 $('#modelPhotos').replaceChildren();
 for(const src of modelImages){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');const view=src===p.colors[state.color][2]?'Изделие':window.ACEFORM_MODEL_VIEWS?.[src]||'На фигуре';img.src=fastMedia(src);img.alt=p.name+', '+p.colors[state.color][0]+' — '+view;img.loading='lazy';img.decoding='async';caption.textContent=view;figure.append(img,caption);$('#modelPhotos').append(figure)}
 gallery.scrollLeft=((gallery.clientWidth||1)+12)*Math.min(previousIndex,modelImages.length-1);}
 $('#galleryControls').hidden=modelImages.length<2;
 const updateGallery=()=>{const i=Math.max(0,Math.min(modelImages.length-1,Math.round((gallery.scrollLeft||0)/((gallery.clientWidth||1)+12))));$('#galleryCount').textContent=(i+1)+' / '+modelImages.length;$('#galleryPrev').disabled=i<=0;$('#galleryNext').disabled=i>=modelImages.length-1;};
 gallery.onscroll=updateGallery;$('#galleryPrev').onclick=()=>gallery.scrollBy({left:-(gallery.clientWidth+12),behavior:'smooth'});$('#galleryNext').onclick=()=>gallery.scrollBy({left:gallery.clientWidth+12,behavior:'smooth'});updateGallery();
 $('#dressBundle').hidden=p.id!=='dress';
 buttons($('#bundleOptions'),['Белые','Чёрные'],state.shortsColor==='white'?0:1,i=>{state.shortsColor=i===0?'white':'black';if(state.bundle!=='both')state.bundle=state.shortsColor;trackAction('bundle_select');state.quantity=1;state.mode='query';render()});
 $('#addSecondShorts').checked=state.bundle==='both';$('#addSecondShorts').onchange=e=>{state.bundle=e.target.checked?'both':state.shortsColor;trackAction('bundle_select');state.quantity=1;state.mode='query';render()};
 buttons($('#shortsSizes'),sizes,sizes.indexOf(state.shortsSize),i=>{state.shortsSize=sizes[i];trackAction('size_select');state.shortsSizeCustomized=true;state.quantity=1;state.mode='query';render()});
 $('#bundlePriceNote').textContent=state.bundle==='both'?'EVERT + белые и чёрные MARBLE — 9 500 ₽ за комплект.':'EVERT + одна пара MARBLE — 8 000 ₽ за комплект.';
 $('#studioTitle').textContent=p.name;const previewKey=p.id+':'+state.color;if(renderedPreview!==previewKey&&document.body.dataset.shopScreen==='product'){renderedPreview=previewKey;const src=isDress?window.ACEFORM_MODELS.dress[state.color][0]:['top','skirt'].includes(p.id)?window.ACEFORM_MODELS[p.id][state.color][0]:null;if(src){window.ACEFORM_MEDIA.show($('#preview'),src,{class:'fit-main',alt:p.name+', '+p.colors[state.color][0]+' — на фигуре'}).then(shown=>{if(shown)window.ACEFORM_MEDIA.prepareProduct(p.id);});}else{$('#preview').innerHTML=photo(p,state.color);};};$('#dressOffer').textContent=state.quantity>1?state.quantity+' комплекта · '+money(totalPrice()):'Платье + '+(state.bundle==='both'?'2 пары шорт':'шорты')+' · '+money(totalPrice());$('#colorName').textContent=p.colors[state.color][0];
 buttons($('#colors'),p.colors,state.color,i=>{window.ACEFORM_STOREFRONT?.regularColor();renderedPreview='';state.color=i;trackAction('color_select');state.quantity=1;state.mode='query';render()},true);
 window.ACEFORM_STOREFRONT?.colors(p.id);
 buttons($('#sizes'),sizes,isDress&&!state.sizeChosen?-1:sizes.indexOf(state.size),i=>{state.size=sizes[i];state.sizeChosen=true;trackAction('size_select');if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;state.mode='query';render()});
 $('#stockBadge').textContent=inquiry?'Изготовление на заказ':isDress&&!state.sizeChosen?'Выбери размер — проверим наличие':a.label;$('#stockBadge').dataset.kind=a.kind;
 const opts=preorderOnly()?[['preorder','Предзаказ',false]]:p.id==='shorts'?[['stock','В наличии',false]]:[['stock','В наличии',!inStock()||bundleNeedsConfirmation()],['preorder','Предзаказ',v?.preorder!==true],['query','Уточнить',false]];
 $('#orderTypes').replaceChildren();opts.forEach(([mode,label,disabled])=>{const b=document.createElement('button');b.className='option'+(mode===state.mode?' selected':'');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-pressed',mode===state.mode);b.onclick=()=>{state.mode=mode;render()};$('#orderTypes').append(b)});
 const directCheckout=isDress?inStock()&&!bundleNeedsConfirmation()&&state.mode!=='preorder':canPay();$('#orderTypes').hidden=isDress||inquiry||directCheckout;const orderTitle=$('#orderTypes').previousElementSibling;if(orderTitle)orderTitle.hidden=isDress||inquiry||directCheckout;$('#availabilityHint').hidden=inquiry||directCheckout||(isDress&&(!state.sizeChosen||feedState==='loading'));
 $('#availabilityHint').textContent=bundleNeedsConfirmation()?(v?.quantity>0?'Платье в наличии. Выбранные шорты и комплектацию подтвердим при согласовании.':'Наличие выбранной комплектации и размера шорт подтвердим при согласовании.'):state.mode==='stock'?'В наличии. Резерв подтвердит менеджер.':state.mode==='preorder'?'Предзаказ разрешён. Срок изготовления согласуем с вами.':'Отправьте запрос — подтвердим наличие и возможность изготовления.';
 $('#stockStatus').textContent=feedState==='ready'?`Обновлено ${new Date(receivedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:feedState==='loading'?'Проверяем остатки…':feedState==='unconfigured'?'Подключение остатков настраивается':'Не удалось обновить наличие';
 $('#stockRefresh').disabled=feedState==='loading'||feedState==='unconfigured';
 $('#qty').value=state.quantity;$('#minus').disabled=state.quantity<=1;$('#plus').disabled=state.quantity>=orderLimit();
 $('#price').textContent=!hasSelection?'Выберите изделие':unitPrice()!==null?money(totalPrice())+(p.id==='dress'?' за '+(state.quantity===1?'комплект':state.quantity+' компл.'):''):'Стоимость уточняется';
 if(state.filter==='stock') {
  Array.from($('#colors').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[i][0]);});
  Array.from($('#sizes').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[state.color][0]&&v.size===sizes[i]);});
 }

 window.ACEFORM_REQUEST_CART?.selectionChanged(selectedForBasket());
 $('#review').firstChild.textContent=true?(isDress&&!state.sizeChosen?'Выбрать размер ':'Добавить в корзину '):inquiry?'Узнать стоимость и срок ':isDress&&!state.sizeChosen?'Выбрать размер ':isDress&&feedState==='loading'?'Проверяем наличие… ':canPay()?'Купить за '+money(totalPrice())+' ':preorderOnly()||state.mode==='preorder'||a.kind==='preorder'?'Оформить предзаказ ':inStock()?'Собрать комплект ':'Оставить заявку ';
}
window.ACEFORM_receiveStock = payload => {if(pendingStock)pendingStock(payload);};
async function refreshStock() {
 if(feedState==='loading'&&pendingStock)return;
 const url=window.ACEFORM_STOCK_URL;
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'')){feedState='unconfigured';render();return;}
 feedState='loading';render();
 let script,timer;
 try {
  const data=await new Promise((resolve,reject)=>{pendingStock=resolve;timer=setTimeout(()=>reject(Error('timeout')),15000);script=document.createElement('script');script.src=url+'?v='+Date.now();script.onerror=()=>reject(Error('network'));document.head.append(script)});
  if(data?.ok!==true||!Array.isArray(data.items)||data.items.length>1000)throw Error('Invalid feed');
  const seen=new Set();for(const v of data.items){if(!products.some(p=>(p.stockName||p.name)===v.product)||!sizes.includes(v.size)||typeof v.color!=='string'||!(v.quantity===null||Number.isSafeInteger(v.quantity)&&v.quantity>=0)||!(v.price===null||Number.isFinite(v.price)&&v.price>=0)||![true,false,null].includes(v.preorder))throw Error('Invalid variant');const key=[v.product,v.color,v.size].join('|');if(seen.has(key))throw Error('Duplicate variant');seen.add(key);}
  checkoutSettings={includedShorts:['white','black','either'].includes(data.checkout?.includedShorts)?data.checkout.includedShorts:'unknown'};
  inventory=data.items;receivedAt=Date.now();feedState='ready';
 } catch {feedState='error';}
 finally {clearTimeout(timer);script?.remove();pendingStock=null;render();window.ACEFORM_REQUEST_CART?.stockChanged();}
}
function details() {const p=current(),price=unitPrice(),subtotal=price===null?null:price*state.quantity,discount=subtotal===null?0:(window.ACEFORM_CERTIFICATE?.discount(subtotal)||0);return [['Изделие',p.name],['Цвет',p.colors[state.color][0]],['Размер',state.size],...(p.id==='dress'?[['Комплектация',state.bundle==='both'?'EVERT + белые и чёрные MARBLE (2 пары)':'EVERT + '+(state.bundle==='white'?'белые':'чёрные')+' MARBLE (1 пара)'],['Размер шорт',state.shortsSize]]:[]),['Формат',state.mode==='stock'?'Из наличия':state.mode==='preorder'?'Предзаказ':'Уточнить наличие'],['Количество',state.quantity+' шт.'],['Стоимость',subtotal!==null?money(subtotal):'Уточняется'],...(discount?[['Сертификат ACEFORM','−'+money(discount)],['Итого',money(subtotal-discount)]]:[])];}
$('#minus').onclick=()=>{state.quantity=Math.max(1,state.quantity-1);render()};$('#plus').onclick=()=>{const max=orderLimit();state.quantity=Math.min(max,state.quantity+1);render()};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#sizesHelp').onclick=openSizeGuide;$('#dressSizeHelp').onclick=openSizeGuide;$('#stockRefresh').onclick=refreshStock;
function canPay() {return current().id==='dress'&&state.sizeChosen&&inStock()&&!bundleNeedsConfirmation()&&state.mode!=='preorder'&&Number.isSafeInteger(state.quantity)&&state.quantity>0&&state.quantity<=bundleLimit();}
async function submitDirectPayment() {
 if(!canPay())return;trackAction('checkout_attempt');
 const key=[state.color,state.size,state.shortsSize,state.bundle,state.quantity].join('|'),amount=totalPrice();
 let nonce;try{const saved=JSON.parse(sessionStorage.getItem('aceform.checkoutDraft')||'null');nonce=saved?.key===key?saved.nonce:null;}catch{}
 nonce=nonce||window.crypto.randomUUID();try{sessionStorage.setItem('aceform.checkoutDraft',JSON.stringify({key,nonce}));}catch{}
 $('#review').disabled=true;$('#checkoutError').hidden=true;
 try {
  const order=await (window.ACEFORM_CERTIFICATE||window.ACEFORM_PAYMENT_BRIDGE).create({nonce,color:state.color,size:state.size,shortsSize:state.shortsSize,bundle:state.bundle,quantity:state.quantity,analyticsTest:window.ACEFORM_ANALYTICS?.test?'1':'0'});
  if(order.amount!==amount||key!==[state.color,state.size,state.shortsSize,state.bundle,state.quantity].join('|'))throw Error('selection_changed');
  try{sessionStorage.setItem('aceform.pendingPayment',JSON.stringify(order));localStorage.setItem('aceform.latestOrder',JSON.stringify(order));}catch{}
  window.ACEFORM_REQUEST_CART?.registerPayment(order.orderId,selectedForBasket());
  if(order.state!=='pending'){$('#review').disabled=false;window.ACEFORM_PAYMENT_BRIDGE.show(order);return;}
  const fields=window.ACEFORM_PAYMENT.fields(order.orderId,order.amount);
  fields.successURL=window.location.origin+window.location.pathname+'#payment='+order.orderId+'.'+order.token;
  for(const [name,value] of Object.entries(fields))$('#walletCheckout').elements.namedItem(name).value=value;
  trackAction('checkout_redirect');window.ACEFORM_ANALYTICS?.sendOnExit();$('#walletCheckout').submit();
 } catch(error){$('#checkoutError').hidden=false;$('#checkoutError').textContent=window.ACEFORM_CERTIFICATE?.error(error.message)||(error.message==='not_available'?'Выбранный комплект уже недоступен. Обновите наличие.':['extra_shorts_unconfirmed','bundle_needs_confirmation'].includes(error.message)?'Наличие выбранных шорт нужно подтвердить. Оставьте заявку на комплект.':'Не удалось подготовить оплату. Деньги не списаны. Попробуйте ещё раз.');$('#review').disabled=false;}
}
function selectedForBasket(){return {product:current().id,color:state.color,size:state.size,shortsSize:state.shortsSize,bundle:state.bundle,quantity:state.quantity,mode:state.mode};}
function basketCanPay(s){if(s.product!=='dress'||!stockFresh()||s.shortsSize!==s.size)return false;const p=products.find(p=>p.id==='dress'),v=inventory.find(v=>v.product===(p.stockName||p.name)&&v.color===p.colors[s.color]?.[0]&&v.size===s.size);return !!v&&Number.isInteger(v.quantity)&&commerce.bundleLimit(s.bundle,s.shortsSize,inventory,checkoutSettings.includedShorts,v.quantity)>=s.quantity;}
window.ACEFORM_SHOP={openProduct(id){renderedPreview='';const i=products.findIndex(p=>p.id===id);if(i<0)return;state.filter='all';selectProduct(i);render();},selection:selectedForBasket,canPay:basketCanPay,stockLoading:()=>feedState==='loading',async pay(s){if(!basketCanPay(s)){window.ACEFORM_REQUEST_CART.openCart();return;}state={...state,...s,product:products.findIndex(p=>p.id===s.product),sizeChosen:true,shortsSizeCustomized:true,mode:'stock'};render();await submitDirectPayment();},request(selection){requestSelection=selection;window.ACEFORM_PREORDER.open(selection);$('#orderForm').classList.remove('hidden');$('#result').classList.add('hidden');$('#orderDialog').showModal();}};
$('#review').onclick=()=>{render();if(current().id==='dress'&&!state.sizeChosen){$('#sizeChoice').scrollIntoView({behavior:'smooth',block:'start'});return;}try{window.ACEFORM_REQUEST_CART.add([selectedForBasket()]);}catch(e){$('#checkoutError').hidden=false;$('#checkoutError').textContent=e.message;window.ACEFORM_REQUEST_CART.openCart();}};
$('#orderForm').onsubmit=e=>{e.preventDefault();if(requestSelection)window.ACEFORM_PREORDER.submit(requestSelection);};
function openSizeGuide() {
 const p=current(), fields=window.ACEFORM_SIZING.fields(p.id);
 $('#sizeTitle').textContent='Размер: '+p.name;
 $('#sizeResult').textContent='Введите мерки в сантиметрах.';
 $('#applySize').hidden=true;
 for(const key of ['bust','waist','hips']) {
  const input=$('#measure-'+key);input.closest('label').hidden=!fields.includes(key);input.required=fields.includes(key);
 }
 $('#sizeDialog').showModal();
}
let recommendedSize=null;
$('#sizeForm').onsubmit=e=>{
 e.preventDefault();recommendedSize=null;$('#applySize').hidden=true;
 const measurements=Object.fromEntries(['bust','waist','hips'].map(k=>[k,Number($('#measure-'+k).value)]));
 const r=window.ACEFORM_SIZING.recommend(current().id,measurements);
 const messages={missing:'Введите все необходимые мерки.',outside:'Часть мерок вне диапазонов таблицы S–L. Уточните размер при согласовании предзаказа.',mixed:'Мерки соответствуют разным размерам. Уточните посадку при согласовании предзаказа.'};
 $('#sizeResult').textContent=r.kind==='match'?'По вашей таблице подходит размер '+r.size+'.':messages[r.kind];
 if(r.kind==='match'){recommendedSize=r.size;$('#applySize').hidden=false;$('#applySize').textContent='Выбрать '+r.size;}
};
$('#applySize').onclick=()=>{if(recommendedSize){state.size=recommendedSize;state.sizeChosen=true;trackAction('size_select');if(state.filter==='stock'&&!stockRows(current()).some(v=>v.color===current().colors[state.color][0]&&v.size===state.size))state.filter='all';if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;render();$('#sizeDialog').close();}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStock()});setInterval(()=>{if(!document.hidden)refreshStock()},60000);render();const startStock=()=>setTimeout(refreshStock,250);if(document.readyState==='complete')startStock();else addEventListener('load',startStock,{once:true});
;
/* Source: aperol.js */
/* The limited collection uses complete outfits as indivisible basket items. */
(()=>{
 'use strict';
 const catalog=window.ACEFORM_APEROL_CATALOG;
 const sizes=['S','M','L'];
 for(const [index,figure] of [...document.querySelectorAll('#april .april-gallery figure')].entries()){
  const product=(index===1||index===3)?'aperol-suit':'aperol-dress',color=(index===2||index===3)?1:0,p=catalog.find(p=>p.id===product);
  const form=document.createElement('form');form.className='aperol-order';form.dataset.product=product;form.dataset.color=color;
  const field=(name,label)=>`<label><span>${label}</span><select name="${name}" required><option value="">Размер</option>${sizes.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>`;
  form.innerHTML=`<p class="aperol-price">${p.price.toLocaleString('ru-RU')} ₽ <span>${product==='aperol-suit'?'топ + юбка':'платье + шорты'}</span></p><p class="hint">${product==='aperol-suit'?'Топ GRAF + юбка BUENO. Продаются только вместе.':'Платье EVERT + одна пара шорт MARBLE.'}</p><div class="aperol-sizes">${field('size',product==='aperol-suit'?'Размер топа GRAF':'Размер платья EVERT')}${field(product==='aperol-suit'?'skirtSize':'shortsSize',product==='aperol-suit'?'Размер юбки BUENO':'Размер шорт MARBLE')}</div><details><summary>Таблица размеров</summary><table class="size-table"><thead><tr><th>Размер</th><th>Грудь</th><th>Талия</th><th>Бёдра</th></tr></thead><tbody>${window.ACEFORM_SIZING.rows.map(r=>`<tr><th>${r.size}</th><td>${r.bust.join('–')}</td><td>${r.waist.join('–')}</td><td>${r.hips.join('–')}</td></tr>`).join('')}</tbody></table><p class="hint">Обхваты тела в сантиметрах. Если сомневаешься, поможем подобрать размер при согласовании заказа.</p></details><button class="primary" type="submit"><span>Добавить комплект в корзину</span><span class="aperol-arrow" aria-hidden="true">→</span></button><p class="hint">Изготовление на заказ. Срок согласуем отдельно. Доставка оплачивается отдельно.</p><p class="aperol-error" role="status" hidden></p>`;
  if(product==='aperol-dress'){
   const note=document.createElement('p');note.className='aperol-shorts-note';note.textContent=window.ACEFORM_COMMERCE.aperolShorts({color});form.querySelector('.aperol-sizes').before(note);
   const extra=document.createElement('label');extra.className='aperol-extra';extra.innerHTML='<input name="extraShorts" type="checkbox"><span>Добавить '+(color===0?'тёмно-синие':'оранжевые')+' MARBLE <b>+1 500 ₽</b></span>';form.querySelector('.aperol-sizes').after(extra);
   const sync=()=>{const extraShorts=form.elements.extraShorts.checked,total=extraShorts?10500:9000;note.textContent=window.ACEFORM_COMMERCE.aperolShorts({color,extraShorts});form.querySelector('.aperol-price').innerHTML=total.toLocaleString('ru-RU')+' ₽ <span>платье + '+(extraShorts?'2 пары шорт':'шорты')+'</span>';form.querySelector('.primary>span').textContent='Добавить · '+total.toLocaleString('ru-RU')+' ₽';form.elements.shortsSize.parentElement.querySelector('span').textContent=extraShorts?'Размер шорт · обе пары':'Размер шорт MARBLE';document.dispatchEvent(new CustomEvent('aceform:aperol-price'));};form.elements.extraShorts.onchange=sync;sync();
  }
  form.onsubmit=e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const extra=product==='aperol-suit'?'skirtSize':'shortsSize',selection={product,color,size:form.elements.size.value,[extra]:form.elements[extra].value,quantity:1,mode:'preorder'};
   if(product==='aperol-dress'&&form.elements.extraShorts.checked)selection.extraShorts=true;
   const error=form.querySelector('.aperol-error');error.hidden=true;
   try{window.ACEFORM_REQUEST_CART.add([selection]);}catch(e){error.textContent=e.message;error.hidden=false;}
  };
  figure.append(form);
 }
 const section=document.getElementById('april'),dock=document.querySelector('.sticky');
 let queued=false;
 const updateDock=()=>{queued=false;if(!section||!dock)return;const rect=section.getBoundingClientRect(),middle=innerHeight/2;dock.classList.toggle('aperol-context',rect.top<middle&&rect.bottom>middle);};
 const scheduleDock=()=>{if(!queued){queued=true;requestAnimationFrame(updateDock);}};
 addEventListener('scroll',scheduleDock,{passive:true});addEventListener('resize',scheduleDock);updateDock();
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const match=start.match(/^aperol_(dress|suit)_([01])_(S|M|L)_(S|M|L)(?:_(both))?$/);
 if(match){const form=[...document.querySelectorAll('.aperol-order')].find(f=>f.dataset.product==='aperol-'+match[1]&&f.dataset.color===match[2]);if(form){form.elements.size.value=match[3];form.elements[match[1]==='suit'?'skirtSize':'shortsSize'].value=match[4];if(match[5]&&form.elements.extraShorts){form.elements.extraShorts.checked=true;form.elements.extraShorts.onchange();}form.scrollIntoView({block:'center'});}}
})();
;
/* Source: certificate.js */
(()=>{
 'use strict';
 const id='club1000',tg=window.Telegram?.WebApp,params=new URLSearchParams(location.search);
 let requested=params.get('certificate')===id||tg?.initDataUnsafe?.start_param==='cert_club1000'||params.get('tgWebAppStartParam')==='cert_club1000'||new URLSearchParams(location.hash.slice(1)).get('tgWebAppStartParam')==='cert_club1000';
 try{if(requested)localStorage.setItem('aceform.certificate',id);else requested=localStorage.getItem('aceform.certificate')===id;}catch{}
 let token=null,eligible=false,pending=null,frame=null,ready=null,bridgeNonce='',targetOrigin='';
 const waiting=new Map(),hex=()=>crypto.randomUUID().replace(/-/g,'');
 function bridge(){
  if(ready)return ready;
  ready=new Promise((resolve,reject)=>{
   bridgeNonce=hex();frame=document.createElement('iframe');frame.hidden=true;frame.title='Подтверждение сертификата ACEFORM';
   const url=new URL(window.ACEFORM_STOCK_URL);url.searchParams.set('certificateBridge',bridgeNonce);frame.src=url.href;
   const timer=setTimeout(()=>{ready=null;frame?.remove();reject(Error('unavailable'));},25000);
   const onReady=e=>{if(e.data?.kind==='aceform-certificate-ready'&&e.data.nonce===bridgeNonce&&e.source&&/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(e.origin)){
    // Apps Script uses nested frames. Bind both the exact source and origin.
    source=e.source;targetOrigin=e.origin;clearTimeout(timer);window.removeEventListener('message',onReady);resolve();
   }};window.addEventListener('message',onReady);document.body.append(frame);
  });return ready;
 }
 let source=null;
 window.addEventListener('message',e=>{
  const m=e.data;if(e.source!==source||e.origin!==targetOrigin||m?.kind!=='aceform-certificate-response'||m.nonce!==bridgeNonce)return;
  const entry=waiting.get(m.id);if(!entry)return;waiting.delete(m.id);clearTimeout(entry.timer);
  m.result?.ok===true?entry.resolve(m.result):entry.reject(Error(m.result?.error||'unavailable'));
 });
 async function rpc(body){await bridge();return new Promise((resolve,reject)=>{const request=hex(),timer=setTimeout(()=>{waiting.delete(request);reject(Error('unavailable'));},30000);waiting.set(request,{resolve,reject,timer});source.postMessage({kind:'aceform-certificate-request',nonce:bridgeNonce,id:request,body},targetOrigin);});}
 const box=document.createElement('section');box.className='certificate-offer';box.hidden=!requested;box.setAttribute('aria-live','polite');
 box.innerHTML='<small>ПОДАРОК ДЛЯ ТВОЕЙ ИГРЫ</small><h2>1 000 ₽ на первый заказ</h2><p id="certificateMessage"></p><a id="certificateTelegram" href="https://t.me/aceform_bot/shop?startapp=cert_club1000">Подтвердить через Telegram ↗</a><button id="certificateRetry" type="button" hidden>Проверить ещё раз</button><button id="certificatePending" type="button" hidden>Продолжить созданный заказ</button><button id="certificateSkip" type="button">Продолжить без сертификата</button><p class="hint">При заказе от 8 000 ₽. Один раз для подтверждённого Telegram-аккаунта. Не суммируется с другими скидками. Доставка отдельно.</p>';
 document.querySelector('main header').after(box);
 const message=box.querySelector('#certificateMessage'),link=box.querySelector('#certificateTelegram'),retry=box.querySelector('#certificateRetry'),resume=box.querySelector('#certificatePending');
 function update(){if(typeof window.ACEFORM_CERTIFICATE_RENDER==='function')window.ACEFORM_CERTIFICATE_RENDER();}
 async function activate(){
  if(!requested&&!tg?.initData)return;
  if(!tg?.initData){message.textContent='Подтвердите аккаунт в Telegram, чтобы применить подарок. Код вводить не нужно.';return;}
  link.hidden=true;retry.hidden=true;message.textContent='Проверяем сертификат…';
  try{
   const result=await rpc({action:'activate',initData:tg.initData});token=result.token;eligible=result.eligible===true;pending=result.pending;
   message.textContent=eligible?(pending?'Сертификат привязан к созданному заказу. Продолжите его оформление.':'Сертификат активирован. Скидка 1 000 ₽ применится к заказу от 8 000 ₽.'):'Сертификат уже использован для этого Telegram-аккаунта.';
   resume.hidden=!pending;update();
  }catch{token=null;eligible=false;message.textContent='Не удалось подтвердить сертификат. Откройте предложение через Telegram заново или повторите проверку.';link.hidden=false;retry.hidden=false;update();}
 }
 retry.onclick=activate;
 box.querySelector('#certificateSkip').onclick=()=>{requested=false;eligible=false;box.hidden=true;try{localStorage.removeItem('aceform.certificate');}catch{}const url=new URL(location.href);url.searchParams.delete('certificate');history.replaceState(null,'',url);update();};
 resume.onclick=async()=>{if(!pending)return;resume.disabled=true;try{const selection={nonce:crypto.randomUUID(),color:['Чёрный','Белый','Красный'].indexOf(pending.color),size:pending.size,shortsSize:pending.shortsSize,bundle:pending.bundle,quantity:pending.quantity};pending=await window.ACEFORM_CERTIFICATE.create(selection);window.ACEFORM_PAYMENT_BRIDGE?.show(pending);}catch{message.textContent='Не удалось возобновить заказ. Наличие могло измениться — свяжитесь с ACEFORM.';}finally{resume.disabled=false;}};
 window.ACEFORM_CERTIFICATE={get requested(){return requested;},get active(){return requested&&!!token&&eligible;},discount(subtotal){return this.active&&Number.isSafeInteger(subtotal)&&subtotal>=8000?1000:0;},async create(selection){
  if(!requested){if(!token)return window.ACEFORM_PAYMENT_BRIDGE.create(selection);return rpc({action:'createRegular',token,selection});}
  if(!token||!eligible)throw Error('certificate_login_required');
  const order=await rpc({action:'create',certificate:id,token,selection});
  if(!window.ACEFORM_PAYMENT_BRIDGE.validOrder(order)||!/^[a-f0-9]{64}$/i.test(order.token||'')||order.discount!==1000||order.certificate!==id)throw Error('invalid_order');return order;
 },error(code){
  const messages={certificate_login_required:'Для сертификата подтвердите вход через Telegram.',certificate_used:'Сертификат уже использован. Обновите страницу.',certificate_pending:'Сертификат уже привязан к другому заказу. Нажмите «Продолжить созданный заказ» выше.',certificate_unavailable:'Нужна помощь с сертификатом. Свяжитесь с ACEFORM.'};return messages[code];
 }};
 if(requested||tg?.initData){const start=()=>setTimeout(activate,250);if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});}
})();
;
/* Source: delivery.js */
(()=>{
 const $=s=>document.querySelector(s),form=$('#deliveryForm');
 let order=null,auth=null,busy=false,submissionId=null;
 const methods={cdek:'СДЭК — пункт выдачи',avito:'Авито',courier:'Курьер',pickup:'Самовывоз'};
 function reset(){$('#fulfillmentNote').hidden=true;order=null;auth=null;$('#deliverySection').hidden=true;$('#paidOrderSummary').hidden=true;}
 function render(data,credentials){
  if(data.state!=='paid'){reset();return;}
  const unsettled=['review','processing'].includes(data.fulfillment);$('#fulfillmentNote').hidden=!unsettled;$('#fulfillmentNote').textContent=data.fulfillment==='review'?'Оплата получена. Перед отправкой проверим наличие и свяжемся с тобой. Данные доставки можно оставить сейчас.':unsettled?'Оплата получена. Завершаем оформление комплекта.':'';
  if(order?.orderId!==data.orderId){form.reset();form.hidden=true;submissionId=null;methodChanged();}
  order=data;auth={orderId:data.orderId,token:credentials.token};
  $('#deliverySection').hidden=false;$('#paidOrderSummary').hidden=false;
  const shorts={white:'белые шорты MARBLE',black:'чёрные шорты MARBLE',both:'белые и чёрные шорты MARBLE'}[data.bundle]||'шорты';
  $('#paidOrderSummary').textContent=`Твой комплект: платье EVERT, ${data.color}, ${data.size}; ${shorts}, ${data.shortsSize}. Количество: ${data.quantity}.`;
  const saved=!!data.delivery;$('#deliveryStart').hidden=saved||!form.hidden;$('#deliveryReceived').hidden=!saved;
  if(saved){
   form.hidden=true;$('#deliveryError').hidden=true;
   const d=data.delivery,shipped=d.state==='shipped',collected=d.state==='collected';
   $('#deliveryReceivedTitle').textContent=collected?'Комплект у тебя':shipped?'Твой комплект отправлен':'Данные для доставки получены';
   $('#deliveryReceivedText').textContent=collected?'Спасибо, что выбираешь ACEFORM. Красивой игры!':shipped?`Способ получения: ${methods[d.method]||'согласован с тобой'}.`:`Способ получения: ${methods[d.method]||'согласуем'}. Проверим детали и свяжемся по указанным контактам. Доставку СДЭК оплачиваешь отдельно при получении; самовывоз — по согласованию.`;
   $('#deliveryTracking').hidden=!d.tracking;$('#deliveryTracking').textContent=d.tracking?'Трек-номер: '+d.tracking:'';
  }
 }
 function methodChanged(){
  const m=$('#deliveryMethod').value,needsAddress=m==='cdek'||m==='courier';
  $('#deliveryAddressLabel').hidden=!needsAddress;$('#deliveryAddress').required=needsAddress;
  $('#deliveryAddressTitle').textContent=m==='courier'?'Адрес доставки: улица, дом, квартира':'Адрес или код пункта СДЭК';
  $('#deliveryMethodHint').textContent={cdek:'Укажи адрес удобного пункта СДЭК. Доставку оплачиваешь СДЭК при получении. Стоимость уточняется.',avito:'Согласуем оформление через Авито отдельно. Здесь заказ на Авито не создаётся; повторно оплачивать комплект не нужно.',courier:'Проверим возможность доставки по твоему адресу и согласуем стоимость.',pickup:'Место и время самовывоза согласуем по указанным контактам.'}[m];
 }
 $('#deliveryMethod').onchange=methodChanged;
 $('#deliveryOpen').onclick=()=>{if(order?.state!=='paid')return;$('#deliveryStart').hidden=true;form.hidden=false;methodChanged();};
 $('#deliveryRefresh').onclick=async()=>{if(!auth)return;$('#deliveryRefresh').disabled=true;try{render(await window.ACEFORM_PAYMENT_BRIDGE.request('paymentStatus',auth),auth);}catch{$('#deliveryReceivedText').textContent='Не удалось обновить статус. Данные доставки уже получены — попробуй позже.';}finally{$('#deliveryRefresh').disabled=false;}};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||order?.state!=='paid'||!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form));
  const phone=String(fields.phone||'').replace(/\D/g,''),telegram=String(fields.telegram||'').trim();
  if(phone.length<7||phone.length>15||(telegram&&!/^@[a-zA-Z0-9_]{5,32}$/.test(telegram))){$('#deliveryError').hidden=false;$('#deliveryError').textContent='Проверь номер телефона и Telegram в формате @username.';return;}
  busy=true;$('#deliverySubmit').disabled=true;$('#deliveryError').hidden=false;$('#deliveryError').textContent='Сохраняем данные доставки…';
  submissionId=submissionId||window.crypto.randomUUID();
  const currentAuth={...auth},body=new URLSearchParams({...fields,telegram,address:['cdek','courier'].includes(fields.method)?fields.address:'',...currentAuth,action:'saveDelivery',submissionId});
  try{
   // Opaque POST response is not a receipt. Confirm saving through authenticated order status.
   await fetch(window.ACEFORM_STOCK_URL,{method:'POST',mode:'no-cors',credentials:'omit',body});
   let confirmed=false;
   for(let i=0;i<6;i++){
    const data=await window.ACEFORM_PAYMENT_BRIDGE.request('paymentStatus',currentAuth);
    if(data.orderId!==currentAuth.orderId||data.state!=='paid')throw Error('invalid_status');
    if(data.delivery){if(auth?.orderId===currentAuth.orderId)render(data,currentAuth);confirmed=true;break;}
    if(i<5)await new Promise(resolve=>setTimeout(resolve,2000));
   }
   if(!confirmed)throw Error('not_confirmed');
  }catch{if(auth?.orderId===currentAuth.orderId){$('#deliveryError').hidden=false;$('#deliveryError').textContent='Сохранение пока не подтверждено. Данные оставлены в форме — попробуй ещё раз или свяжись с ACEFORM.';}}
  finally{busy=false;$('#deliverySubmit').disabled=false;}
 };
 window.ACEFORM_DELIVERY={render,reset};methodChanged();
})();
;
/* Source: payment-bridge.js */
(()=>{
 const pending=new Map();
 window.ACEFORM_receivePayment=data=>{const item=pending.get(data?.request);if(item){pending.delete(data.request);item.finish(data);}};
 function request(action,params={}) {
  return new Promise((resolve,reject)=>{
   const id='r'+Date.now().toString(36)+Math.random().toString(36).slice(2);
   const script=document.createElement('script');let timer;
   const cleanup=()=>{clearTimeout(timer);script.remove();pending.delete(id);};
   pending.set(id,{finish:data=>{cleanup();data.ok===true?resolve(data):reject(Error(data.error||'unavailable'));}});
   const url=new URL(window.ACEFORM_STOCK_URL);url.searchParams.set('action',action);url.searchParams.set('request',id);url.searchParams.set('v',Date.now());
   Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));script.src=url.href;
   script.onerror=()=>{cleanup();reject(Error('network'));};timer=setTimeout(()=>{cleanup();reject(Error('timeout'));},20000);document.head.append(script);
  });
 }
 let active=null,pollTimer=null,attempts=0;
 const $=s=>document.querySelector(s);
 function validOrder(data){return /^ACEFORM-[a-f0-9]{32}$/i.test(data.orderId||'')&&Number.isSafeInteger(data.amount)&&data.amount>0&&['pending','paid','underpaid'].includes(data.state);}
 function renderStatus(data){
  if(!validOrder(data)||data.orderId!==active?.orderId)throw Error('invalid_status');
  const paid=data.state==='paid',processing=paid&&data.fulfillment==='processing';
  $('#paymentResume').hidden=!(data.state==='pending'&&data.reservationActive);$('#paymentRelease').hidden=$('#paymentResume').hidden;
  $('#paymentReturnTitle').textContent=paid?'Оплата получена':data.state==='underpaid'?'Нужна проверка суммы':attempts>=40?'Оплата пока не подтверждена':'Проверяем оплату';
  $('#paymentReturnText').textContent=paid?'Твой выход на корт стал ближе. Оплата подтверждена ЮMoney.':data.state==='underpaid'?'Перевод найден, но получена не вся сумма заказа. Свяжитесь с ACEFORM для сверки.':attempts>=40?'Подтверждение ещё не пришло. Если деньги списались, не оплачивайте повторно — проверьте статус позже.':'Ждём подтверждение от ЮMoney. Обычно оно приходит вскоре после перевода.';
  $('#paymentReturnAmount').textContent=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(data.amount);
  $('#paymentReturnOrder').textContent=data.orderId;
  if(paid&&data.fulfillment==='review')$('#paymentReturnText').textContent='Оплата подтверждена. Наличие комплекта требует проверки — свяжемся с вами перед отправкой.';
  else if(processing)$('#paymentReturnText').textContent='Оплата подтверждена. Завершаем оформление комплекта…';
  else if(data.state==='pending'&&data.reservationActive)$('#paymentReturnText').textContent='Комплект зарезервирован до '+new Date(data.reserveExpiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'. Если деньги списались, дождитесь подтверждения и не оплачивайте повторно.';
  else if(data.state==='pending'&&data.reserveExpiresAt)$('#paymentReturnText').textContent=(data.reservationReleased?'Резерв отменён.':'Время резерва истекло.')+' Если ещё не оплатили, выберите комплект заново. Если деньги списались — свяжитесь с ACEFORM и не платите повторно.';
  $('#paymentReturnRetry').hidden=paid&&!processing;$('#paymentReturnState').dataset.kind=paid?'available':'unknown';$('#paymentReturnState').textContent=paid?'Подтверждено ЮMoney':data.state==='underpaid'?'Неполная сумма':'Ожидаем подтверждение';
  window.ACEFORM_DELIVERY?.render(data,active);
  if(paid){window.ACEFORM_REQUEST_CART?.settlePayment(data.orderId);clearTimeout(pollTimer);try{sessionStorage.setItem('aceform.pendingPayment',JSON.stringify({...data,token:active.token}));localStorage.setItem('aceform.latestOrder',JSON.stringify({...data,token:active.token}));sessionStorage.removeItem('aceform.checkoutDraft');}catch{}$('#lastPayment').hidden=false;$('#lastPayment').textContent='Мой заказ';$('#lastPayment').onclick=()=>show(active);}
  return paid&&!processing;
 }
 async function poll(){
  clearTimeout(pollTimer);if(!active)return;attempts++;
  const target={...active},stillActive=()=>active?.orderId===target.orderId&&active?.token===target.token;
  try{const data=await request('paymentStatus',target);if(!stillActive())return;const paid=renderStatus(data);if(!paid&&attempts<40&&$('#paymentReturnDialog').open)pollTimer=setTimeout(poll,3000);}
  catch{if(!stillActive())return;$('#paymentResume').hidden=true;$('#paymentRelease').hidden=true;window.ACEFORM_DELIVERY?.reset();$('#paymentReturnState').textContent='Статус не подтверждён';$('#paymentReturnState').dataset.kind='unknown';$('#paymentReturnAmount').textContent='';$('#paymentReturnTitle').textContent='Не удалось проверить оплату';$('#paymentReturnText').textContent='Статус временно недоступен. Если деньги списались, не оплачивайте повторно. Нажмите «Проверить ещё раз».';$('#paymentReturnRetry').hidden=false; }
 }
 function show(order){$('#paymentResume').hidden=true;$('#paymentRelease').hidden=true;window.ACEFORM_DELIVERY?.reset();$('#paymentReturnState').textContent='Ожидаем подтверждение';$('#paymentReturnState').dataset.kind='unknown';$('#paymentReturnRetry').hidden=false;active={orderId:order.orderId,token:order.token};attempts=0;$('#paymentReturnTitle').textContent='Проверяем оплату';$('#paymentReturnText').textContent='Запрашиваем подтверждение ЮMoney…';$('#paymentReturnOrder').textContent=order.orderId;$('#paymentReturnAmount').textContent='';$('#paymentReturnDialog').showModal();poll();}
 window.ACEFORM_PAYMENT_BRIDGE={request,validOrder,async create(selection){const data=await request('createPayment',selection);if(!validOrder(data)||!/^[a-f0-9]{64}$/i.test(data.token||''))throw Error('invalid_order');return data;},show};
 async function reservationAction(action){
  if(!active)return;const target={...active};$('#paymentResume').disabled=true;$('#paymentRelease').disabled=true;
  try{const data=await request(action,target);if(active?.orderId!==target.orderId||active?.token!==target.token)return;renderStatus(data);
   if(action==='resumePayment'&&data.state==='pending'&&data.reservationActive){
    const fields=window.ACEFORM_PAYMENT.fields(data.orderId,data.amount);fields.successURL=window.location.origin+window.location.pathname+'#payment='+data.orderId+'.'+target.token;
    for(const [name,value] of Object.entries(fields))$('#walletCheckout').elements.namedItem(name).value=value;$('#walletCheckout').submit();
   }
  }catch{if(active?.orderId===target.orderId)poll();}
  finally{$('#paymentResume').disabled=false;$('#paymentRelease').disabled=false;}
 }
 $('#paymentResume').onclick=()=>reservationAction('resumePayment');$('#paymentRelease').onclick=()=>reservationAction('releaseReservation');
 $('#paymentReturnRetry').onclick=()=>{attempts=0;poll();};
 $('#paymentReturnDialog').addEventListener('close',()=>clearTimeout(pollTimer));
 const match=window.location.hash.match(/^#payment=(ACEFORM-[a-f0-9]{32})\.([a-f0-9]{64})$/i);
 if(match)show({orderId:match[1],token:match[2]});
 else {try{const stored=JSON.parse(sessionStorage.getItem('aceform.pendingPayment')||localStorage.getItem('aceform.latestOrder')||'null');if(stored&&/^ACEFORM-[a-f0-9]{32}$/i.test(stored.orderId||'')&&/^[a-f0-9]{64}$/i.test(stored.token||'')){$('#lastPayment').hidden=false;$('#lastPayment').textContent=stored.state==='paid'?'Мой заказ':'Проверить последнюю оплату';$('#lastPayment').onclick=()=>show(stored);}}catch{}}
})();
;
/* Source: shop-shell.js */
/* Shop screens reuse the existing catalog, size selection and checkout. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),main=$('main'),section=$('#april'),gallery=section.querySelector('.april-gallery');
 const figures=[...gallery.children],rub=n=>n.toLocaleString('ru-RU')+' ₽';
 const outfits=[{title:'EVERT + MARBLE',color:'Тёмно-синий',price:9000},{title:'GRAF + BUENO',color:'Тёмно-синий / оранжевый',price:11900},{title:'EVERT + MARBLE',color:'Оранжевый',price:9000},{title:'GRAF + BUENO',color:'Оранжевый / тёмно-синий',price:11900}];
 const make=(tag,cls,html)=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;};
 const home=$('#shopHome')||make('section','shop-home','<p class="shop-kicker">ТВОЯ ФОРМА ИГРЫ</p><h1>На корте.<br>В своём стиле.</h1>');home.id='shopHome';
 const hero=section.querySelector('.aperol-cover').cloneNode(true);hero.querySelector('h2').removeAttribute('id');hero.querySelector('a').href='#april';hero.querySelector('a').textContent='Смотреть коллекцию →';if(!home.querySelector('.aperol-cover'))home.append(hero);$('header').after(home);
 const collectionIntro=make('div','shop-collection-heading','<p class="shop-kicker">ЛИМИТИРОВАННАЯ КОЛЛЕКЦИЯ</p><h1>Апероль</h1><p>Твой оттенок побережья.</p>');section.replaceChildren(collectionIntro);
 const cards=make('div','shop-outfits','');section.append(cards);
 const detail=make('section','shop-outfit-detail','');detail.id='outfitDetail';section.after(detail);
 figures.forEach((figure,i)=>{const o=outfits[i],img=figure.querySelector('img'),card=make('a','shop-outfit-card',`<img src="${img.getAttribute('src')}" alt="${o.title} · ${o.color}" width="800" height="1000" loading="lazy" fetchpriority="low" decoding="async"><div><h2>${o.title}</h2><p>${o.color}</p><strong>${rub(o.price)}</strong><span aria-hidden="true">↗</span></div>`);card.href='#outfit/'+i;cards.append(card);figure.classList.add('shop-full-outfit');figure.querySelector('figcaption').textContent=o.title;figure.querySelector('.aperol-order .primary>span').textContent='Добавить · '+rub(o.price);const buy=make('div','shop-buy-bar','');const buyButton=figure.querySelector('.aperol-order .primary');buyButton.before(buy);buy.append(buyButton);figure.querySelector('.aperol-order details summary').textContent='Помочь с размером';const info=make('div','shop-info',`<details><summary>О комплекте</summary><p>${window.ACEFORM_DESCRIPTIONS[(i===1||i===3)?'aperolSuit':'aperolDress'].text}</p></details><details><summary>Доставка и срок</summary><p>Срок подтвердим до оплаты. СДЭК, курьер или самовывоз. Доставка оплачивается отдельно.</p></details>`);figure.append(info);const palette=make('div','shop-outfit-palette',(i===1||i===3)?'<p>Цвет комплекта · Апероль</p><div class="swatches"><a class="swatch" style="--color:linear-gradient(135deg,#15325c 60%,#e76123 60%)" href="#outfit/1" aria-label="Синий GRAF + оранжевая BUENO"></a><a class="swatch" style="--color:linear-gradient(135deg,#e76123 60%,#15325c 60%)" href="#outfit/3" aria-label="Оранжевый GRAF + синяя BUENO"></a></div><a href="#product/top">Другие цвета GRAF</a><a href="#product/skirt">Другие цвета BUENO</a>':`<p>Цвет комплекта</p><div class="swatches"><a class="swatch ${i===0?'selected':''}" style="--color:linear-gradient(135deg,%2315325c 60%,%23e76123 60%)" href="#outfit/0" aria-label="Тёмно-синий / оранжевый · Апероль" ${i===0?'aria-current="true"':''}></a><a class="swatch ${i===2?'selected':''}" style="--color:linear-gradient(135deg,%23e76123 60%,%2315325c 60%)" href="#outfit/2" aria-label="Оранжевый / тёмно-синий · Апероль" ${i===2?'aria-current="true"':''}></a></div><a href="#product/dress">Основные цвета EVERT</a>`);palette.innerHTML=palette.innerHTML.replaceAll('%23','#');figure.querySelector('.aperol-order .aperol-sizes').before(palette);});
 const baseInfo=make('div','shop-info shop-base-info','<details><summary>Об изделии</summary><p id="shopProductDescription"></p></details><details><summary>Доставка и срок</summary><p>СДЭК, курьер или самовывоз. Срок и стоимость согласуем при оформлении.</p></details>');$('#productDetails').after(baseInfo);
 const added=make('aside','shop-added','<div role="status"><strong>Добавлено в корзину</strong><p></p></div><div class="shop-added-actions"><button type="button" class="secondary">Продолжить выбор</button><button type="button" class="primary">В корзину →</button></div>');added.hidden=true;document.body.append(added);
 added.querySelector('.secondary').onclick=()=>{added.hidden=true;};added.querySelector('.primary').onclick=()=>{added.hidden=true;window.ACEFORM_REQUEST_CART.openCart();};
 document.addEventListener('aceform:basket-added',e=>{const all=[...window.ACEFORM_CATALOG,...window.ACEFORM_APEROL_CATALOG];added.querySelector('p').textContent=e.detail.map(s=>{const p=all.find(p=>p.id===s.product);return p.name.split(' · ')[0]+' · '+(s.product==='aperol-suit'?'GRAF '+s.size+' / BUENO '+s.skirtSize:s.product==='aperol-dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:s.size);}).join(' + ');added.hidden=false;tidyBasket();});
 const back=make('button' ,'shop-back','← Назад');back.type='button';home.before(back);
 const nav=$('.shop-nav')||make('nav','shop-nav','<a href="#shop">Магазин</a><button type="button" id="shopCart">Корзина <span></span></button><a href="#my-orders">Мои заказы</a>');nav.setAttribute('aria-label','Навигация магазина');document.body.append(nav);
 const orders=make('section','shop-orders','');orders.id='shopOrders';detail.after(orders);
 let previous='shop',active='shop';
 function route(){
  const hash=location.hash.slice(1),match=hash.match(/^outfit\/([0-3])$/),base=hash.match(/^product\/(dress|top|skirt|shorts)$/);
  active=match?'outfit':base?'product':hash==='april'||hash==='aperolLooks'?'collection':hash==='my-orders'?'orders':'shop';
  resetLimited();document.body.dataset.shopScreen=active;added.hidden=true;
  if(active==='collection')cards.querySelectorAll('img').forEach((img,i)=>{if(i<2){img.fetchPriority='high';img.loading='eager';}});
  if(match){const figure=figures[Number(match[1])],img=figure.querySelector('img');img.fetchPriority='high';img.loading='eager';detail.replaceChildren(figure);previous='april';}
  if(base){window.ACEFORM_SHOP.openProduct(base[1]);window.ACEFORM_MEDIA.prepareProduct(base[1]);syncPrice();$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[base[1]]?.text||'';previous='shop';}
  back.hidden=active==='shop';back.textContent=active==='outfit'?'← Коллекция «Апероль»':'← В магазин';
  nav.querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',(a.hash==='#my-orders'?active==='orders':['shop','collection','outfit','product'].includes(active))?'page':'false'));
  window.scrollTo({top:0,behavior:'instant'});
 }
 back.onclick=()=>{location.hash=active==='outfit'?'april':'shop';};
 $('#shopCart').onclick=()=>window.ACEFORM_REQUEST_CART.openCart();
 let limited=null;
 const inlineLimited=make('div','shop-inline-limited','');inlineLimited.hidden=true;$('#purchaseOptions').append(inlineLimited);
 function restoreForms(){for(const figure of figures){const form=inlineLimited.querySelector('form');if(form&&figure.querySelector('figcaption').textContent===(form.dataset.product==='aperol-suit'?'GRAF + BUENO':'EVERT + MARBLE')&&figure===figures[limited?.index])figure.insertBefore(form,figure.querySelector('.shop-info'));}inlineLimited.replaceChildren();}
 function resetLimited(){restoreForms();limited=null;inlineLimited.hidden=true;$('#productDetails').classList.remove('limited-selection');const id=window.ACEFORM_SHOP.selection().product;$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[id]?.text||'';}
 function applyLimited(){
  if(!limited||active!=='product')return;
  const c=limited,preview=c.index===3,model=window.ACEFORM_APEROL_CATALOG.find(p=>p.id===(c.product==='dress'?'aperol-dress':'aperol-suit'));
  const src=['assets/fast-aperol-studio-dress-navy-v1.jpg','assets/fast-aperol-studio-suit-navy-orange-v2.jpg','assets/fast-aperol-studio-dress-orange-v1.jpg','assets/fast-aperol-studio-suit-orange-navy-v2.jpg'][c.index];
  $('#productDetails').classList.add('limited-selection');inlineLimited.hidden=false;$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[c.product==='dress'?'aperolDress':'aperolSuit'].text;
  window.ACEFORM_MEDIA.show($('#preview'),src,{class:'fit-main',alt:model.name+' · '+c.label}).then(shown=>{if(shown)window.ACEFORM_MEDIA.prepareProduct(c.product);});
  $('#colorName').textContent=c.label+' · Апероль';inlinePrice.textContent=rub(model.price)+(c.product==='dress'?' · платье + шорты':' · топ + юбка');
  $('#colors').querySelectorAll('button').forEach(b=>{const selected=b.dataset.aperolIndex===String(c.index);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(!inlineLimited.querySelector('form')){const note=make('p','shop-inline-note',c.product==='dress'?'Платье + шорты':'Топ + юбка · только комплектом');inlineLimited.append(note,figures[c.index].querySelector('form'));}
  syncPrice();
 }
 function chooseLimited(c,id){restoreForms();limited={...c,product:id};applyLimited();}
 function collectionColors(id){
  const colors=id==='dress'?[{label:'Тёмно-синий / оранжевый',color:'#15325c',accent:'#e76123',index:0},{label:'Оранжевый / тёмно-синий',color:'#e76123',accent:'#15325c',index:2}]:id==='top'?[{label:'Тёмно-синий',color:'#15325c',index:1},{label:'Оранжевый',color:'#e76123',index:3}]:id==='skirt'?[{label:'Оранжевый',color:'#e76123',index:1},{label:'Тёмно-синий',color:'#15325c',index:3}]:[];
  for(const c of colors){const button=make('button','swatch shop-limited-swatch','<span class="shop-limited-mark" aria-hidden="true">🍹</span>');button.type='button';button.style.setProperty('--color',c.accent?`linear-gradient(135deg,${c.color} 60%,${c.accent} 60%)`:c.color);const label=c.label+(id==='dress'?' · Апероль · комплект 9 000 ₽':' · костюм GRAF + BUENO 11 900 ₽');button.setAttribute('aria-label',label);button.title=label;button.dataset.aperolIndex=String(c.index);button.onclick=()=>chooseLimited(c,id);$('#colors').append(button);}
  if(limited)queueMicrotask(applyLimited);

 }
 window.ACEFORM_STOREFRONT={open(id){location.hash='product/'+id;},colors:collectionColors,regularColor:resetLimited};

 const inlinePrice=make('p','shop-product-price','');
 const syncPrice=()=>{inlinePrice.textContent=limited?rub(limited.product==='dress'?(inlineLimited.querySelector('[name=extraShorts]')?.checked?10500:9000):11900)+(limited.product==='dress'?' · платье + шорты':' · топ + юбка'):$('#price').textContent;$('#purchaseOptions').prepend(inlinePrice);};
 document.addEventListener('aceform:aperol-price',syncPrice);
 new MutationObserver(syncPrice).observe($('#price'),{childList:true,characterData:true,subtree:true});
 const measureNav=()=>document.documentElement.style.setProperty('--shop-nav-height',nav.getBoundingClientRect().height+'px');
 new ResizeObserver(measureNav).observe(nav);measureNav();
 const basket=$('#basketDialog');
 function tidyBasket(){const gift=$('.certificate-offer');if(gift&&gift.parentElement!==basket){$('#basketActions').after(gift);}const n=window.ACEFORM_REQUEST_CART.value().reduce((s,x)=>s+x.quantity,0);$('#shopCart span').textContent=n?'· '+n:'';}
 basket.addEventListener('close',tidyBasket);$('#shopCart').addEventListener('click',tidyBasket);$('#basketOpen').addEventListener('click',tidyBasket);
 new MutationObserver(tidyBasket).observe($('#basketItems'),{childList:true});tidyBasket();
 addEventListener('hashchange',route);
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const launch=start.match(/^aperol_(dress|suit)_([01])_/),ask=start.match(/^ask_(top|skirt)_/);
 if(new URLSearchParams(location.search).get('screen')==='cart')setTimeout(()=>$('#shopCart').click(),0);
 if(start==='my_orders'||new URLSearchParams(location.search).get('screen')==='my-orders')location.hash='my-orders';
 else if(launch)location.hash='outfit/'+(launch[1]==='suit'?(launch[2]==='1'?3:1):launch[2]==='1'?2:0);else if(ask)location.hash='product/'+ask[1];
 route();
})();
;
/* Source: order-accounting.js */
/* Shared read-only customer display; only the owner endpoint can record a payment. */
(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
 const methods={cdek:'СДЭК',courier:'Курьер',pickup:'Самовывоз',avito:'Авито'};
 function funds(o){return o.funds||{goodsTotal:o.quote?.totalCents??null,goodsPaid:o.paidAt?(o.quote?.depositCents||0):0,goodsBalance:o.quote?Math.max(0,o.quote.totalCents-(o.paidAt?o.quote.depositCents:0)):null,goodsCredit:0,shippingTotal:o.delivery?.costCents===undefined?(o.quote?.shippingCents??null):o.delivery.costCents,shippingPaid:0,shippingBalance:o.delivery?.costCents===undefined?(o.quote?.shippingCents??null):o.delivery.costCents,shippingPaymentMode:o.delivery?.paymentMode||'unknown',history:[],version:0};}
 function status(o){const f=funds(o);return f.goodsTotal===null?'Стоимость согласуем':f.goodsCredit?'Переплата за изделия':f.goodsPaid===0?'Не оплачено':f.goodsBalance===0?'Изделия оплачены полностью':'Частично оплачено';}
 function payment(o){const f=funds(o);if(f.goodsTotal===null)return '<p>Стоимость изделий ещё согласуется. Оплата пока не требуется.</p>';const row=(a,b)=>`<div><dt>${a}</dt><dd>${money(b)}</dd></div>`;return `<section class="order-payment" aria-label="Оплата"><h2>Оплата изделий</h2><p class="muted">Один заказ · два платежа</p><p>${status(o)}</p><dl>${row('Стоимость изделий',f.goodsTotal)}${row('Внесено',f.goodsPaid)}${row('Осталось за изделия',f.goodsBalance)}${f.goodsCredit?row('Переплата',f.goodsCredit):''}</dl>${f.goodsPaid===0&&o.quote?`<p class="muted">Предоплата к внесению: ${money(o.quote.depositCents)}</p>`:''}<div class="payment-stages"><span>1 · Предоплата ${money(o.quote.depositCents)}<small>${f.goodsPaid>=o.quote.depositCents?'Получена':'Ожидает оплаты'}</small></span><span>2 · Остаток ${money(o.quote.totalCents-o.quote.depositCents)}<small>${f.goodsBalance===0?'Оплачен':f.goodsPaid>o.quote.depositCents?'Частично оплачен':'Ожидает оплаты'}</small></span></div>${o.balancePayment?.canPay?`<button id="payBalance" class="primary" type="button">Оплатить остаток · ${money(f.goodsBalance)}</button><p class="muted">Оплата через ЮMoney. Доставка отдельно.</p>`:''}${o.balancePayment?.pending?'<p class="muted">Оплата второго платежа ожидает подтверждения. Если деньги уже списались, не плати повторно.</p>':''}${f.history?.length?`<details class="payment-history"><summary>История оплат и возвратов</summary>${f.history.map(e=>`<p>${esc(new Date(e.at).toLocaleDateString('ru-RU'))} · ${e.kind==='refund'?'Возврат':'Получено'} ${money(e.amountCents)} · ${e.target==='shipping'?'доставка':'изделия'}</p>`).join('')}</details>`:''}</section>`;}
 function delivery(o){const f=funds(o),d=o.delivery||o.intake?.value||{},tracking=o.progress?.tracking;return `<section class="order-receiving"><h2>Доставка и получение</h2><p>${esc([methods[d.method]||'Способ получения пока не выбран',d.city].filter(Boolean).join(' · '))}</p>${d.carrier&&d.carrier!==methods[d.method]?`<p>${esc(d.carrier)}</p>`:''}${d.recipient?`<p>${esc(d.recipient)}${d.phone?' · '+esc(d.phone):''}</p>`:''}${d.address?`<p>${esc(d.address)}</p>`:''}${d.method==='pickup'?'<p class="muted">Самовывоз по согласованию.</p>':''}<p>${f.shippingTotal===null?'Стоимость доставки уточняется':f.shippingTotal===0?'Доставка бесплатно':'Стоимость доставки: '+money(f.shippingTotal)}</p>${f.shippingTotal===0?'':f.shippingPaymentMode==='store'?`<p>Оплата доставки — ACEFORM.${f.shippingPaid?' Получено: '+money(f.shippingPaid)+'.':''}${f.shippingBalance!==null?' Осталось: '+money(f.shippingBalance)+'.':''}${f.shippingCredit?' Переплата: '+money(f.shippingCredit)+'.':''}</p>`:f.shippingPaymentMode==='carrier'?'<p class="muted">Доставка оплачивается перевозчику отдельно. В остаток за изделия не входит.</p>':'<p class="muted">Условия оплаты доставки уточняются.</p>'}${tracking?`<p><strong>Трек-номер:</strong> ${esc(tracking)}</p>`:''}${d.note||o.progress?.deliveryNote?`<p class="muted">${esc(d.note||o.progress.deliveryNote)}</p>`:''}</section>`;}
 window.ACEFORM_ACCOUNTING={funds,status,payment,delivery,money};
})();
;
/* Source: customer-orders.js */
/* Account-scoped order history. No customer records or auth tokens in storage. */
(()=>{
 'use strict';
 const root=document.querySelector('#shopOrders');if(!root)return;
 const tg=window.Telegram?.WebApp,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rub=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
 let token=null,busy=false,offset=0,orders=[];
 root.innerHTML='<p class="shop-kicker">ACEFORM · ТВОИ ПОКУПКИ</p><h1>Мои заказы</h1><div class="order-list-toolbar"><p id="customerOrdersStatus" role="status"></p><button class="size-link" id="customerOrdersRefresh" type="button">Обновить ↻</button></div><p id="customerOrdersError" role="alert" hidden></p><div id="customerOrdersList"></div><button class="secondary" id="customerOrdersMore" hidden>Показать ещё</button>';
 const $=s=>root.querySelector(s),request=(path,method='GET',data)=>window.ACEFORM_TREE_TRANSPORT.request(path,method,data,token);
 function open(id){if(!/^[a-f0-9]{32}$/.test(id))return;const url=new URL('my-order.html?order='+id,location.href);const fragment=new URLSearchParams();fragment.set('tgWebAppData',tg?.initData||'');fragment.set('tgWebAppVersion',tg?.version||'8.0');fragment.set('tgWebAppPlatform',tg?.platform||'unknown');url.hash=fragment.toString();location.assign(url.href);}
 window.ACEFORM_CUSTOMER_ORDERS={open};
 const titles={closed:'Отменён',delivered:'Выполнен',production:'В работе',accepted:'Заказ принят',offer_ready:'Ожидает подтверждения',awaiting_payment:'Ожидает предоплаты',received:'Заказ получен',preparing_offer:'Уточняем стоимость',clarifying:'Уточняем детали',ready:'Готов к отправке',pickup:'Готов к самовывозу',shipped:'Отправлен'};
 const next={closed:'Посмотреть заказ',delivered:'Посмотреть заказ',production:'Открыть заказ',accepted:'Открыть заказ',offer_ready:'Проверить заказ',awaiting_payment:'Внести предоплату',received:'Выбрать получение',preparing_offer:'Открыть заказ',clarifying:'Посмотреть детали',ready:'Проверить получение',pickup:'Посмотреть получение',shipped:'Посмотреть отправление'};
 function card(o){const code=o.progress?.code||'received',q=o.quote,pics=o.previews||[],funds=window.ACEFORM_ACCOUNTING.funds(o),paid=funds.goodsPaid;return `<article class="customer-order-card"><div class="customer-order-meta"><span>№ ${esc(o.id.slice(0,8).toUpperCase())}</span><time>${o.created?new Date(o.created).toLocaleDateString('ru-RU'):''}</time></div><span class="customer-order-status" data-status="${esc(code)}">${esc(titles[code]||o.progress?.title||'Заказ получен')}</span>${pics.length?`<div class="customer-order-pictures">${pics.slice(0,3).map(p=>`<img src="${esc(window.ACEFORM_MEDIA?.src(p.photo)||p.photo)}" alt="${esc(p.name)}" loading="lazy">`).join('')}</div>`:''}<p class="customer-order-names">${esc([...new Set(pics.map(p=>p.name))].join(' + ')||'Твой заказ ACEFORM')}</p><p class="customer-order-total">${q?rub(q.totalCents):'Стоимость согласуем'}</p>${q?`<p class="customer-order-payment">${esc(window.ACEFORM_ACCOUNTING.status(o))}${paid?' · '+rub(paid):''}<br>Осталось за изделия · ${rub(funds.goodsBalance)}</p>`:''}<p class="customer-order-next">${esc(code==='production'?'Готовим твой заказ.':o.progress?.note||'Открой заказ, чтобы посмотреть подробности.')}</p>${o.progress?.tracking?`<p class="customer-order-tracking">Трек: ${esc(o.progress.tracking)}</p>`:''}<button type="button" class="primary" data-customer-order="${esc(o.id)}">${esc(code==='awaiting_payment'&&paid>0?'Открыть заказ':next[code]||'Открыть заказ')} <span aria-hidden="true">→</span></button></article>`;}
 function render(){const ended=o=>['closed','delivered'].includes(o.progress?.code);const active=orders.filter(o=>!ended(o)),past=orders.filter(ended);$('#customerOrdersList').innerHTML=active.map(card).join('')+(past.length?'<h2 class="customer-order-history">История</h2>'+past.map(card).join(''):'');$('#customerOrdersList').querySelectorAll('[data-customer-order]').forEach(b=>b.onclick=()=>open(b.dataset.customerOrder));}
 async function load(more=false){if(busy)return;busy=true;$('#customerOrdersRefresh').disabled=true;$('#customerOrdersMore').disabled=true;$('#customerOrdersError').hidden=true;
  if(!tg?.initData){$('#customerOrdersStatus').textContent='Открой магазин в Telegram — здесь появятся твои заказы.';$('#customerOrdersList').innerHTML='<a class="primary" href="https://t.me/aceform_bot/shop?startapp=my_orders">Открыть магазин в Telegram ↗</a>';busy=false;$('#customerOrdersRefresh').disabled=false;return;}
  if(!more)$('#customerOrdersStatus').textContent='Загружаем заказы…';
  try{if(!token)token=(await request('/api/shop/customer-session','POST',{initData:tg.initData})).token;const page=await request('/api/shop/my','GET',{offset:more?offset:0});orders=more?[...new Map([...orders,...page.orders].map(o=>[o.id,o])).values()]:page.orders;offset=page.nextOffset;$('#customerOrdersMore').hidden=!page.hasMore;render();$('#customerOrdersStatus').textContent=orders.length?'Статусы обновлены':'Здесь пока нет заказов.';if(!orders.length)$('#customerOrdersList').innerHTML='<p class="customer-orders-empty">Выбери свой первый образ — после оформления его статус появится здесь.</p><a class="primary" href="#shop">В магазин →</a>';
  }catch(e){if(/вход|войти|Telegram/i.test(e.message))token=null;$('#customerOrdersError').hidden=false;$('#customerOrdersError').textContent=e.message||'Не удалось загрузить заказы. Попробуй ещё раз.';$('#customerOrdersStatus').textContent=orders.length?'Показаны ранее загруженные данные':'';}
  finally{busy=false;$('#customerOrdersRefresh').disabled=false;$('#customerOrdersMore').disabled=false;}}
 $('#customerOrdersRefresh').onclick=()=>load();$('#customerOrdersMore').onclick=()=>load(true);
 const visible=()=>document.body.dataset.shopScreen==='orders';addEventListener('hashchange',()=>{if(visible())load();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible())load();});setInterval(()=>{if(!document.hidden&&visible())load();},30000);if(visible())load();
})();
;
