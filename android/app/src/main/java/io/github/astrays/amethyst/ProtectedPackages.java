package io.github.astrays.amethyst;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;
import android.text.TextUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Packages that must remain reachable while Amethyst is enforcing a rule.
 *
 * This intentionally protects critical operating-system escape and safety surfaces rather
 * than every preinstalled application. Protecting every FLAG_SYSTEM app would also exempt
 * apps such as preinstalled browsers and YouTube from intentional blocking.
 */
final class ProtectedPackages {
    private static final Set<String> ALWAYS_PROTECTED = Collections.unmodifiableSet(
        new LinkedHashSet<>(Arrays.asList(
            "android",
            "com.android.settings",
            "com.android.systemui",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.android.packageinstaller",
            "com.google.android.packageinstaller",
            "com.samsung.android.packageinstaller",
            "com.android.launcher3",
            "com.google.android.apps.nexuslauncher",
            "com.sec.android.app.launcher",
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.incallui",
            "com.google.android.dialer",
            "com.samsung.android.dialer",
            "com.samsung.android.incallui"
        ))
    );

    private ProtectedPackages() {}

    static boolean isProtected(Context context, String packageName) {
        if (context == null || TextUtils.isEmpty(packageName)) {
            return false;
        }
        if (context.getPackageName().equals(packageName) || ALWAYS_PROTECTED.contains(packageName)) {
            return true;
        }

        PackageManager packageManager = context.getPackageManager();
        return handles(packageManager, packageName, homeIntent())
            || handles(packageManager, packageName, new Intent(Settings.ACTION_SETTINGS))
            || handles(packageManager, packageName, new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            || handles(packageManager, packageName, appDetailsIntent(context))
            || handles(packageManager, packageName, new Intent(Intent.ACTION_DIAL));
    }

    private static Intent homeIntent() {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);
        return intent;
    }

    private static Intent appDetailsIntent(Context context) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + context.getPackageName()));
        return intent;
    }

    private static boolean handles(
        PackageManager packageManager,
        String packageName,
        Intent intent
    ) {
        ResolveInfo resolved = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
        return resolved != null
            && resolved.activityInfo != null
            && packageName.equals(resolved.activityInfo.packageName);
    }
}
