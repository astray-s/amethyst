package io.github.astrays.amethyst;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;

public class AmethystBlockAccessibilityService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            && type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            return;
        }

        CharSequence rawPackageName = event.getPackageName();
        if (rawPackageName == null) {
            return;
        }
        String packageName = rawPackageName.toString();
        if (getPackageName().equals(packageName)) {
            return;
        }

        String browserHost = "";
        if (BrowserUrlAdapter.supports(packageName)) {
            browserHost = BrowserUrlAdapter.readHost(packageName, getRootInActiveWindow());
            if (!TextUtils.isEmpty(browserHost)) {
                FocusEngine.recordBrowserHost(this, packageName, browserHost);
            }
        } else if (BrowserUrlAdapter.isLikelyBrowser(this, packageName)) {
            FocusEngine.maybeWarnUnsupportedBrowser(this, packageName, resolveAppLabel(packageName), System.currentTimeMillis());
        }

        FocusEngine.TargetDecision decision = FocusEngine.decisionFor(
            this,
            packageName,
            browserHost,
            System.currentTimeMillis()
        );
        if (!decision.blocked) {
            return;
        }

        AmethystBlockerPlugin.recordBlockAttempt(this, packageName);
        Intent intent = new Intent(this, BlockedOverlayActivity.class);
        intent.putExtra("targetPackage", packageName);
        intent.putExtra("targetDomain", decision.domain);
        intent.putExtra("strict", decision.strict);
        intent.putExtra("activeRuleIds", decision.activeRuleIds.toString());
        intent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {
        // required override, no cleanup needed
    }

    private String resolveAppLabel(String packageName) {
        PackageManager packageManager = getPackageManager();
        try {
            return packageManager.getApplicationInfo(packageName, 0).loadLabel(packageManager).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return packageName;
        }
    }
}
