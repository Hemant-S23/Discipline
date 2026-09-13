/**
 * scripts/configure-android.js
 * Configures MainActivity.java in the Android project to:
 * 1. Enable third-party cookies on CookieManager (essential for Google OAuth session cookies)
 * 2. Configure WebSettings: DOM storage, database, and disable multiple windows (so OAuth popups stay in WebView)
 * Run with: node scripts/configure-android.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_ACTIVITY = path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'discipline', 'habittracker', 'MainActivity.java');

const MAIN_ACTIVITY_CONTENT = `package com.discipline.habittracker;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setSupportMultipleWindows(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
`;

if (!fs.existsSync(path.dirname(MAIN_ACTIVITY))) {
  console.log(`[NOTICE] Android directory not found yet at ${path.dirname(MAIN_ACTIVITY)}. Skipping.`);
  process.exit(0);
}

fs.writeFileSync(MAIN_ACTIVITY, MAIN_ACTIVITY_CONTENT, 'utf8');
console.log(`[SUCCESS] MainActivity.java configured with third-party cookie support and single-window WebView!`);
