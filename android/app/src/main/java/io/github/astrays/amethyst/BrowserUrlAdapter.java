package io.github.astrays.amethyst;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class BrowserUrlAdapter {
    static final class BrowserDefinition {
        final String id;
        final String packageName;
        final List<String> addressBarIds;

        BrowserDefinition(String id, String packageName, String... addressBarIds) {
            this.id = id;
            this.packageName = packageName;
            this.addressBarIds = Arrays.asList(addressBarIds);
        }
    }

    private static final Map<String, BrowserDefinition> BY_PACKAGE = new LinkedHashMap<>();
    // AccessibilityService fires TYPE_WINDOW_CONTENT_CHANGED continuously for whatever app is in
    // the foreground, so isLikelyBrowser() is called far more often than once per app-switch;
    // cache the PackageManager query result per package instead of re-querying every event.
    private static final Map<String, Boolean> LIKELY_BROWSER_CACHE = new ConcurrentHashMap<>();

    static {
        add(new BrowserDefinition(
            "chrome",
            "com.android.chrome",
            "com.android.chrome:id/url_bar"
        ));
        add(new BrowserDefinition(
            "samsung-internet",
            "com.sec.android.app.sbrowser",
            "com.sec.android.app.sbrowser:id/location_bar_edit_text",
            "com.sec.android.app.sbrowser:id/location_bar"
        ));
        add(new BrowserDefinition(
            "edge",
            "com.microsoft.emmx",
            "com.microsoft.emmx:id/url_bar"
        ));
        add(new BrowserDefinition(
            "brave",
            "com.brave.browser",
            "com.brave.browser:id/url_bar"
        ));
    }

    private BrowserUrlAdapter() {}

    private static void add(BrowserDefinition definition) {
        BY_PACKAGE.put(definition.packageName, definition);
    }

    static boolean supports(String packageName) {
        return BY_PACKAGE.containsKey(packageName);
    }

    /**
     * True if {@code packageName} registers itself as a generic web-page handler (the standard
     * signal for "this is a browser"), so callers can tell "this is a browser we don't have a URL
     * adapter for" apart from "this is just some other app in the foreground". Requires the
     * ACTION_VIEW/BROWSABLE/https {@code <queries>} entry in the manifest to resolve under Android
     * 11+ package-visibility rules.
     */
    static boolean isLikelyBrowser(Context context, String packageName) {
        if (TextUtils.isEmpty(packageName) || supports(packageName)) {
            return false;
        }
        Boolean cached = LIKELY_BROWSER_CACHE.get(packageName);
        if (cached != null) {
            return cached;
        }
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"));
        probe.addCategory(Intent.CATEGORY_BROWSABLE);
        List<ResolveInfo> resolves = context.getPackageManager().queryIntentActivities(probe, 0);
        boolean isBrowser = false;
        for (ResolveInfo info : resolves) {
            if (info.activityInfo != null && packageName.equals(info.activityInfo.packageName)) {
                isBrowser = true;
                break;
            }
        }
        LIKELY_BROWSER_CACHE.put(packageName, isBrowser);
        return isBrowser;
    }

    static String readHost(String packageName, AccessibilityNodeInfo root) {
        BrowserDefinition definition = BY_PACKAGE.get(packageName);
        if (definition == null || root == null) {
            return null;
        }

        for (String viewId : definition.addressBarIds) {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(viewId);
            if (nodes == null) {
                continue;
            }
            for (AccessibilityNodeInfo node : nodes) {
                CharSequence value = node.getText();
                if (TextUtils.isEmpty(value)) {
                    value = node.getContentDescription();
                }
                String host = normalizeHost(value == null ? null : value.toString());
                if (!TextUtils.isEmpty(host)) {
                    return host;
                }
            }
        }
        return null;
    }

    static JSONArray compatibility(Context context, boolean accessibilityEnabled, JSONObject lastUrls) {
        JSONArray result = new JSONArray();
        PackageManager packageManager = context.getPackageManager();
        for (BrowserDefinition definition : BY_PACKAGE.values()) {
            boolean installed;
            try {
                packageManager.getApplicationInfo(definition.packageName, 0);
                installed = true;
            } catch (PackageManager.NameNotFoundException ignored) {
                installed = false;
            }

            JSONObject browser = new JSONObject();
            try {
                browser.put("browser", definition.id);
                browser.put("packageName", definition.packageName);
                browser.put("installed", installed);
                browser.put(
                    "adapterStatus",
                    !installed
                        ? "not-installed"
                        : !accessibilityEnabled
                            ? "accessibility-disabled"
                            : lastUrls.optString(definition.packageName, "").isEmpty()
                                ? "unverified"
                                : "ok"
                );
                String lastUrl = lastUrls.optString(definition.packageName, "");
                if (!lastUrl.isEmpty()) {
                    browser.put("detectedUrl", lastUrl);
                }
            } catch (Exception ignored) {
                // JSONObject writes are best effort for a diagnostic-only response.
            }
            result.put(browser);
        }
        return result;
    }

    static String normalizeHost(String input) {
        if (input == null) {
            return null;
        }
        String host = input.trim().toLowerCase();
        int scheme = host.indexOf("://");
        if (scheme >= 0) {
            host = host.substring(scheme + 3);
        }
        int cut = firstIndex(host, '/', '?', '#');
        if (cut >= 0) {
            host = host.substring(0, cut);
        }
        int at = host.lastIndexOf('@');
        if (at >= 0) {
            host = host.substring(at + 1);
        }
        int colon = host.indexOf(':');
        if (colon >= 0 && !host.contains("]")) {
            host = host.substring(0, colon);
        }
        if (host.startsWith("www.") && host.length() > 4) {
            host = host.substring(4);
        }
        if (!host.contains(".") || host.contains(" ")) {
            return null;
        }
        return host;
    }

    static boolean matchesHost(String host, String ruleDomain) {
        String normalizedHost = normalizeHost(host);
        String normalizedRule = normalizeHost(ruleDomain);
        if (normalizedHost == null || normalizedRule == null) {
            return false;
        }
        return normalizedHost.equals(normalizedRule)
            || normalizedHost.endsWith("." + normalizedRule);
    }

    private static int firstIndex(String value, char... needles) {
        int found = -1;
        for (char needle : needles) {
            int candidate = value.indexOf(needle);
            if (candidate >= 0 && (found < 0 || candidate < found)) {
                found = candidate;
            }
        }
        return found;
    }
}
