/**
 * scripts/configure-android.js
 * Configures the Android project for Discipline:
 * 1. Copies google-services.json from android-config/ to android/app/
 * 2. Copies fixed debug.keystore from android-config/ to android/app/ and configures build.gradle signing
 * 3. Injects server_client_id into strings.xml for native Google Auth
 * 4. Configures MainActivity.java with GoogleAuth plugin registration and WebSettings
 * Run with: node scripts/configure-android.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const APP_DIR = path.join(ANDROID_DIR, 'app');

if (!fs.existsSync(ANDROID_DIR)) {
  console.log('[NOTICE] Android directory not found yet. Skipping configure-android.js.');
  process.exit(0);
}

// 1. Copy google-services.json
const srcGoogleServices = path.join(ROOT, 'android-config', 'google-services.json');
const destGoogleServices = path.join(APP_DIR, 'google-services.json');

if (fs.existsSync(srcGoogleServices)) {
  fs.copyFileSync(srcGoogleServices, destGoogleServices);
  console.log('[SUCCESS] Copied google-services.json -> android/app/google-services.json');
} else {
  console.warn('[WARNING] android-config/google-services.json not found!');
}

// 2. Copy debug.keystore & configure signing in android/app/build.gradle
const srcKeystore = path.join(ROOT, 'android-config', 'debug.keystore');
const destKeystore = path.join(APP_DIR, 'debug.keystore');

if (fs.existsSync(srcKeystore)) {
  fs.copyFileSync(srcKeystore, destKeystore);
  console.log('[SUCCESS] Copied fixed debug.keystore -> android/app/debug.keystore');

  const BUILD_GRADLE = path.join(APP_DIR, 'build.gradle');
  if (fs.existsSync(BUILD_GRADLE)) {
    let gradleContent = fs.readFileSync(BUILD_GRADLE, 'utf8');
    if (!gradleContent.includes('signingConfigs {')) {
      const targetBlock = 'buildTypes {';
      const replacementBlock = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }`;
      gradleContent = gradleContent.replace(targetBlock, replacementBlock);
      fs.writeFileSync(BUILD_GRADLE, gradleContent, 'utf8');
      console.log('[SUCCESS] Configured fixed debug signingConfig in android/app/build.gradle');
    } else {
      console.log('[INFO] signingConfigs already present in android/app/build.gradle');
    }
  }
} else {
  console.warn('[WARNING] android-config/debug.keystore not found!');
}

// 3. Configure strings.xml (add server_client_id)
const STRINGS_XML = path.join(APP_DIR, 'src', 'main', 'res', 'values', 'strings.xml');
const SERVER_CLIENT_ID = '356781067799-5su4b6r7tfgpgpm590cd4b0f1853jeu5.apps.googleusercontent.com';

if (fs.existsSync(STRINGS_XML)) {
  let stringsContent = fs.readFileSync(STRINGS_XML, 'utf8');
  if (!stringsContent.includes('server_client_id')) {
    stringsContent = stringsContent.replace(
      '</resources>',
      `    <string name="server_client_id">${SERVER_CLIENT_ID}</string>\n</resources>`
    );
    fs.writeFileSync(STRINGS_XML, stringsContent, 'utf8');
    console.log('[SUCCESS] Added server_client_id to strings.xml');
  } else {
    console.log('[INFO] server_client_id already in strings.xml');
  }
}

// 4. Configure MainActivity.java
const MAIN_ACTIVITY = path.join(APP_DIR, 'src', 'main', 'java', 'com', 'discipline', 'habittracker', 'MainActivity.java');
const MAIN_ACTIVITY_CONTENT = `package com.discipline.habittracker;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuth.class);
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

if (fs.existsSync(path.dirname(MAIN_ACTIVITY))) {
  fs.writeFileSync(MAIN_ACTIVITY, MAIN_ACTIVITY_CONTENT, 'utf8');
  console.log('[SUCCESS] MainActivity.java configured with GoogleAuth and WebView settings');
}
