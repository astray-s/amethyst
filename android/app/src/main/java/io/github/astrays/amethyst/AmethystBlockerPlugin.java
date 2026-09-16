package io.github.astrays.amethyst;

import android.app.AppOpsManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;
import android.graphics.drawable.Drawable;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "AmethystBlocker")
public class AmethystBlockerPlugin extends Plugin {

    static final String PREFS_NAME = "AmethystPrefs";
    static final String KEY_BLOCKING_ACTIVE = "blockingActive";
    static final String KEY_BLOCKED_PACKAGES = "blockedPackages";
    static final String KEY_BLOCKING_ENDS_AT = "blockingEndsAt";
    static final String KEY_BLOCKING_FROM_SCHEDULE = "blockingFromSchedule";
    static final String KEY_RECENT_BLOCK_ATTEMPTS = "recentBlockAttempts";
    static final String ERROR_INVALID_DURATION = "INVALID_DURATION";
    static final String ERROR_EMPTY_BLOCK_TARGETS = "EMPTY_BLOCK_TARGETS";
    static final String ERROR_CONTRACT_MISMATCH = "ENGINE_CONTRACT_MISMATCH";
    static final int MAX_FOCUS_DURATION_MINUTES = 24 * 60 - 1;
    /**
     * Must match ENGINE_CONTRACT_VERSION in src/engine/contracts.ts. Bump both sides
     * together whenever the rule/status payload shape changes incompatibly.
     */
    static final int ENGINE_CONTRACT_VERSION = 3;
    private static final int MAX_BLOCK_ATTEMPTS = 500;
    private static final long MAX_USAGE_RANGE_MS = 31L * 24L * 60L * 60L * 1000L;
    private static final String NOTIFICATION_CHANNEL_ID = "amethyst_nudges";
    private static final int NOTIFICATION_ID = 1001;

    @PluginMethod
    public void requestUsagePermission(PluginCall call) {
        boolean granted = hasUsageAccess();
        if (!granted) {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        boolean granted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (!granted) {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        boolean granted = FocusEngine.exactAlarmAvailable(getContext());
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAccessibilityPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        JSObject ret = new JSObject();
        ret.put("granted", isAccessibilityServiceEnabled());
        call.resolve(ret);
    }

    /**
     * Read-only snapshot of the app permissions used by Amethyst. Unlike the request methods
     * above, this never opens Android Settings or changes the enabled service list.
     */
    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("usageAccess", hasUsageAccess());
        ret.put("accessibility", isAccessibilityServiceEnabled());
        ret.put("notificationsEnabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        ret.put("notificationRuntimeGranted", hasNotificationRuntimePermission());
        ret.put("exactAlarms", FocusEngine.exactAlarmAvailable(getContext()));
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);

        List<ResolveInfo> resolveInfos = pm.queryIntentActivities(launcherIntent, 0);
        JSArray apps = new JSArray();
        for (ResolveInfo info : resolveInfos) {
            JSObject app = new JSObject();
            app.put("packageName", info.activityInfo.packageName);
            app.put("label", info.loadLabel(pm).toString());
            app.put("iconDataUrl", drawableToDataUrl(info.loadIcon(pm)));
            apps.put(app);
        }

        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }

    @PluginMethod
    public void startFocusSession(PluginCall call) {
        Integer durationMinutes = call.getInt("durationMinutes");
        Boolean blockApps = call.getBoolean("blockApps", false);
        JSObject rule = call.getObject("rule");

        Set<String> blockedPackageSet = new LinkedHashSet<>();
        if (rule != null) {
            JSONArray packageNames = rule.optJSONArray("packageNames");
            if (packageNames != null) {
                for (int i = 0; i < packageNames.length(); i++) {
                    String packageName = packageNames.optString(i, "").trim();
                    if (!packageName.isEmpty()) {
                        blockedPackageSet.add(packageName);
                    }
                }
            }
            if ("allowlist".equals(rule.optString("mode", "blocklist"))) {
                Set<String> allowedPackages = new LinkedHashSet<>(blockedPackageSet);
                blockedPackageSet.clear();
                blockedPackageSet.addAll(getLaunchablePackageNames(getContext()));
                blockedPackageSet.removeAll(allowedPackages);
                blockedPackageSet.remove(getContext().getPackageName());
            } else {
                blockedPackageSet.removeIf(
                    packageName -> ProtectedPackages.isProtected(getContext(), packageName)
                );
            }
        }

        List<String> blockedPackages = new ArrayList<>(blockedPackageSet);
        boolean shouldBlockApps = Boolean.TRUE.equals(blockApps);
        String validationError = validateStartRequest(durationMinutes, shouldBlockApps, blockedPackages);
        if (ERROR_INVALID_DURATION.equals(validationError)) {
            JSObject data = new JSObject();
            data.put("field", "durationMinutes");
            data.put("maximum", MAX_FOCUS_DURATION_MINUTES);
            call.reject(
                "durationMinutes must be between 1 and "
                    + MAX_FOCUS_DURATION_MINUTES
                    + ".",
                ERROR_INVALID_DURATION,
                data
            );
            return;
        }
        if (ERROR_EMPTY_BLOCK_TARGETS.equals(validationError)) {
            JSObject data = new JSObject();
            data.put("field", "rule.packageNames");
            call.reject(
                "A blocking session requires at least one target package.",
                ERROR_EMPTY_BLOCK_TARGETS,
                data
            );
            return;
        }

        FocusEngine.startTimer(
            getContext(),
            durationMinutes,
            shouldBlockApps,
            rule,
            System.currentTimeMillis()
        );

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    static String validateStartRequest(Integer durationMinutes, boolean blockApps, List<String> blockedPackages) {
        if (durationMinutes == null
            || durationMinutes <= 0
            || durationMinutes > MAX_FOCUS_DURATION_MINUTES) {
            return ERROR_INVALID_DURATION;
        }
        if (blockApps && (blockedPackages == null || blockedPackages.isEmpty())) {
            return ERROR_EMPTY_BLOCK_TARGETS;
        }
        return null;
    }

    /**
     * Returns null when the web contract version is compatible, otherwise a human-readable
     * reason. A missing version is treated as incompatible: every supported web build sends
     * one, so its absence means the caller predates the gate or is not the bundled web app.
     */
    static String validateContractVersion(Integer webContractVersion) {
        if (webContractVersion == null) {
            return "Engine contract version missing; expected " + ENGINE_CONTRACT_VERSION + ".";
        }
        if (webContractVersion != ENGINE_CONTRACT_VERSION) {
            return "Engine contract mismatch: web sent "
                + webContractVersion
                + ", native expects "
                + ENGINE_CONTRACT_VERSION
                + ".";
        }
        return null;
    }

    static boolean isTrackableUsagePackage(String packageName, String amethystPackageName) {
        return packageName != null
            && !packageName.isEmpty()
            && !packageName.equals(amethystPackageName);
    }

    @PluginMethod
    public void stopFocusSession(PluginCall call) {
        FocusEngine.stopTimer(
            getContext(),
            call.getString("endState", "manually-ended"),
            System.currentTimeMillis()
        );

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncRules(PluginCall call) {
        // Fail loudly on a contract mismatch rather than parsing an unknown payload shape
        // defensively and silently applying a half-understood policy.
        String contractError = validateContractVersion(call.getInt("contractVersion"));
        if (contractError != null) {
            call.reject(contractError, ERROR_CONTRACT_MISMATCH);
            return;
        }

        JSArray rules = call.getArray("rules", new JSArray());
        Long requestedNow = call.getLong("nowMs");
        FocusEngine.syncRules(
            getContext(),
            rules,
            requestedNow == null ? System.currentTimeMillis() : requestedNow
        );

        JSObject ret = new JSObject();
        ret.put("synced", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getEngineStatus(PluginCall call) {
        call.resolve(FocusEngine.getStatus(getContext(), System.currentTimeMillis()));
    }

    @PluginMethod
    public void requestUnblock(PluginCall call) {
        call.resolve(FocusEngine.requestUnblock(
            getContext(),
            call.getString("targetPackage", ""),
            call.getString("targetDomain", ""),
            System.currentTimeMillis()
        ));
    }

    @PluginMethod
    public void updateSettings(PluginCall call) {
        JSObject options = new JSObject();
        Boolean sessionSounds = call.getBoolean("sessionSounds");
        Boolean gentleReminders = call.getBoolean("gentleReminders");
        Boolean emergencyStop = call.getBoolean("emergencyStop");
        if (sessionSounds != null) {
            options.put("sessionSounds", sessionSounds);
        }
        if (gentleReminders != null) {
            options.put("gentleReminders", gentleReminders);
        }
        if (emergencyStop != null) {
            options.put("emergencyStop", emergencyStop);
        }
        call.resolve(FocusEngine.updateSettings(
            getContext(),
            options,
            System.currentTimeMillis()
        ));
    }

    @PluginMethod
    public void getBrowserCompatibility(PluginCall call) {
        call.resolve(FocusEngine.browserCompatibility(
            getContext(),
            isAccessibilityServiceEnabled()
        ));
    }

    @PluginMethod
    public void resetAllData(PluginCall call) {
        call.resolve(FocusEngine.resetAllData(getContext()));
    }

    @PluginMethod
    public void getUsageStats(PluginCall call) {
        UsageStatsManager usageStatsManager =
            (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);

        long now = System.currentTimeMillis();
        Calendar startOfToday = Calendar.getInstance();
        startOfToday.set(Calendar.HOUR_OF_DAY, 0);
        startOfToday.set(Calendar.MINUTE, 0);
        startOfToday.set(Calendar.SECOND, 0);
        startOfToday.set(Calendar.MILLISECOND, 0);

        Long requestedStart = call.getLong("startEpoch");
        Long requestedEnd = call.getLong("endEpoch");
        long endTime = requestedEnd == null ? now : Math.min(requestedEnd, now);
        long startTime = requestedStart == null ? startOfToday.getTimeInMillis() : requestedStart;
        if (endTime < 0) {
            endTime = now;
        }
        if (startTime < 0 || startTime > endTime) {
            startTime = startOfToday.getTimeInMillis();
        }
        boolean wasRangeClamped = false;
        if (endTime - startTime > MAX_USAGE_RANGE_MS) {
            startTime = endTime - MAX_USAGE_RANGE_MS;
            wasRangeClamped = true;
        }

        Map<String, Long> foregroundTimeByPackage = new HashMap<>();
        if (usageStatsManager != null) {
            // queryAndAggregateUsageStats returns one entry per package for the exact range
            // INTERVAL_DAILY would return multiple daily buckets and cause double-counting
            Map<String, android.app.usage.UsageStats> aggregated =
                usageStatsManager.queryAndAggregateUsageStats(startTime, endTime);
            if (aggregated != null) {
                for (Map.Entry<String, android.app.usage.UsageStats> entry : aggregated.entrySet()) {
                    long time = entry.getValue().getTotalTimeInForeground();
                    if (time <= 0) {
                        continue;
                    }
                    String pkg = entry.getKey();
                    if (!isTrackableUsagePackage(pkg, getContext().getPackageName())) {
                        continue;
                    }
                    foregroundTimeByPackage.put(pkg, time);
                }
            }
        }

        long totalTimeMs = 0;
        for (Long time : foregroundTimeByPackage.values()) {
            totalTimeMs += time;
        }

        List<Map.Entry<String, Long>> sorted = new ArrayList<>(foregroundTimeByPackage.entrySet());
        Collections.sort(sorted, new Comparator<Map.Entry<String, Long>>() {
            @Override
            public int compare(Map.Entry<String, Long> a, Map.Entry<String, Long> b) {
                return Long.compare(b.getValue(), a.getValue());
            }
        });

        PackageManager pm = getContext().getPackageManager();
        JSArray mostUsedApps = new JSArray();
        JSArray usageByApp = new JSArray();
        for (int i = 0; i < Math.min(3, sorted.size()); i++) {
            Map.Entry<String, Long> entry = sorted.get(i);
            mostUsedApps.put(usageAppToJsObject(pm, entry.getKey(), entry.getValue()));
        }
        for (Map.Entry<String, Long> entry : sorted) {
            usageByApp.put(usageAppToJsObject(pm, entry.getKey(), entry.getValue()));
        }

        // "pickups" is approximated from screen-interactive transitions. This avoids
        // counting every foreground app switch as a separate pickup.
        int pickups = 0;
        Long firstPickupEpoch = null;
        Long lastPickupEpoch = null;
        Long firstActivityEpoch = null;
        Long lastActivityEpoch = null;
        Map<Long, Long> screenTimeByHour = new HashMap<>();
        Map<Long, Integer> pickupsByHour = new HashMap<>();
        Map<String, Long> foregroundStarts = new HashMap<>();
        if (usageStatsManager != null) {
            UsageEvents usageEvents = usageStatsManager.queryEvents(startTime, endTime);
            UsageEvents.Event event = new UsageEvents.Event();
            while (usageEvents.hasNextEvent()) {
                usageEvents.getNextEvent(event);
                int eventType = event.getEventType();
                String packageName = event.getPackageName();
                long eventTime = event.getTimeStamp();
                if (eventType == UsageEvents.Event.SCREEN_INTERACTIVE) {
                    pickups++;
                    if (firstPickupEpoch == null) {
                        firstPickupEpoch = eventTime;
                    }
                    lastPickupEpoch = eventTime;
                    addPickupToHour(pickupsByHour, eventTime, startTime, endTime);
                }
                if (eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
                    && isTrackableUsagePackage(packageName, getContext().getPackageName())) {
                    if (firstActivityEpoch == null) {
                        firstActivityEpoch = eventTime;
                    }
                    lastActivityEpoch = eventTime;
                    foregroundStarts.put(packageName, eventTime);
                } else if (eventType == UsageEvents.Event.MOVE_TO_BACKGROUND
                    && isTrackableUsagePackage(packageName, getContext().getPackageName())) {
                    Long foregroundStart = foregroundStarts.remove(packageName);
                    if (foregroundStart != null) {
                        addSegmentToHours(screenTimeByHour, foregroundStart, eventTime, startTime, endTime);
                    }
                }
            }
            for (Long foregroundStart : foregroundStarts.values()) {
                addSegmentToHours(screenTimeByHour, foregroundStart, endTime, startTime, endTime);
            }
        }

        JSArray hourlyBuckets = hourlyBucketsToJsArray(startTime, endTime, screenTimeByHour, pickupsByHour);
        JSObject ret = new JSObject();
        ret.put("startEpoch", startTime);
        ret.put("endEpoch", endTime);
        ret.put("wasRangeClamped", wasRangeClamped);
        ret.put("usageAccessGranted", hasUsageAccess());
        ret.put("pickups", pickups);
        ret.put("screenTimeMs", totalTimeMs);
        ret.put("screenTimeMinutes", totalTimeMs / 60000);
        ret.put("mostUsedApps", mostUsedApps);
        ret.put("usageByApp", usageByApp);
        ret.put("hourlyBuckets", hourlyBuckets);
        if (firstPickupEpoch != null) {
            ret.put("firstPickupEpoch", firstPickupEpoch);
            ret.put("lastPickupEpoch", lastPickupEpoch);
        }
        if (firstActivityEpoch != null) {
            ret.put("firstActivityEpoch", firstActivityEpoch);
            ret.put("lastActivityEpoch", lastActivityEpoch);
        }
        call.resolve(ret);
    }

    /**
     * Read-only status for the active manual or scheduled block. Expired state is reported as
     * inactive but is not changed here; cleanup remains in the accessibility/schedule paths.
     */
    @PluginMethod
    public void getActiveBlockingStatus(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long endsAt = prefs.getLong(KEY_BLOCKING_ENDS_AT, 0);
        boolean storedActive = prefs.getBoolean(KEY_BLOCKING_ACTIVE, false);
        boolean expired = endsAt > 0 && now >= endsAt;
        boolean active = storedActive && !expired;

        JSArray blockedPackages = new JSArray();
        String rawPackages = prefs.getString(KEY_BLOCKED_PACKAGES, "");
        if (!TextUtils.isEmpty(rawPackages)) {
            for (String packageName : rawPackages.split(",")) {
                if (!TextUtils.isEmpty(packageName)) {
                    blockedPackages.put(packageName);
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("active", active);
        ret.put("storedActive", storedActive);
        ret.put("expired", expired);
        ret.put("endsAt", endsAt);
        ret.put("remainingMs", active && endsAt > 0 ? Math.max(0, endsAt - now) : 0);
        ret.put("fromSchedule", prefs.getBoolean(KEY_BLOCKING_FROM_SCHEDULE, false));
        ret.put("blockedPackages", blockedPackages);
        call.resolve(ret);
    }

    @PluginMethod
    public void getRecentBlockAttempts(PluginCall call) {
        Integer requestedLimit = call.getInt("limit", MAX_BLOCK_ATTEMPTS);
        int limit = Math.max(1, Math.min(MAX_BLOCK_ATTEMPTS, requestedLimit == null ? MAX_BLOCK_ATTEMPTS : requestedLimit));
        Long requestedStart = call.getLong("startEpoch");
        Long requestedEnd = call.getLong("endEpoch");
        long startEpoch = requestedStart == null ? Long.MIN_VALUE : requestedStart;
        long endEpoch = requestedEnd == null ? Long.MAX_VALUE : requestedEnd;
        JSArray events = new JSArray();
        int matchingEvents = 0;
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawAttempts = prefs.getString(KEY_RECENT_BLOCK_ATTEMPTS, "[]");
        try {
            JSONArray attempts = new JSONArray(rawAttempts);
            for (int i = attempts.length() - 1; i >= 0; i--) {
                JSONObject event = attempts.optJSONObject(i);
                if (event == null) {
                    continue;
                }
                long timestamp = event.optLong("timestamp", 0);
                if (timestamp >= startEpoch && timestamp <= endEpoch) {
                    matchingEvents++;
                }
                if (timestamp >= startEpoch && timestamp <= endEpoch && events.length() < limit) {
                    events.put(event);
                }
            }
        } catch (Exception ignored) {
            // Return an empty bounded list if a stale stored value is malformed.
        }

        JSObject ret = new JSObject();
        ret.put("events", events);
        ret.put("maxStored", MAX_BLOCK_ATTEMPTS);
        ret.put("truncated", matchingEvents > events.length());
        call.resolve(ret);
    }

    @PluginMethod
    public void sendNudge(PluginCall call) {
        String title = call.getString("title", "Amethyst");
        String body = call.getString("body", "");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Amethyst Nudges",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true);

        boolean sent = true;
        try {
            NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted on API 33+; best-effort, don't crash the call
            sent = false;
        }

        JSObject ret = new JSObject();
        ret.put("sent", sent);
        call.resolve(ret);
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        String title = call.getString("title", "Share Amethyst");
        String text = call.getString("text", "");
        if (TextUtils.isEmpty(text)) {
            call.reject("Share text is required", "EMPTY_SHARE_TEXT");
            return;
        }

        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.setType("text/plain");
        sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
        sendIntent.putExtra(Intent.EXTRA_TEXT, text);
        Intent chooser = Intent.createChooser(sendIntent, title);

        if (getActivity() != null) {
            getActivity().startActivity(chooser);
        } else {
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
        }

        JSObject ret = new JSObject();
        ret.put("shared", true);
        call.resolve(ret);
    }

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) {
            return false;
        }
        int mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            getContext().getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private boolean isAccessibilityServiceEnabled() {
        String enabledServices = Settings.Secure.getString(
            getContext().getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        return isServiceEnabled(
            enabledServices,
            getContext().getPackageName(),
            AmethystBlockAccessibilityService.class.getName()
        );
    }

    static boolean isServiceEnabled(
        String enabledServices,
        String expectedPackageName,
        String expectedClassName
    ) {
        if (enabledServices == null || enabledServices.isBlank()) {
            return false;
        }
        for (String flattenedComponent : enabledServices.split(":")) {
            String[] parts = flattenedComponent.split("/", 2);
            if (parts.length != 2) {
                continue;
            }
            String className = parts[1].startsWith(".")
                ? parts[0] + parts[1]
                : parts[1];
            if (expectedPackageName.equals(parts[0]) && expectedClassName.equals(className)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasNotificationRuntimePermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getContext().checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private static JSObject usageAppToJsObject(PackageManager pm, String packageName, long timeMs) {
        String label = packageName;
        try {
            ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
            label = pm.getApplicationLabel(appInfo).toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            // Fall back to the package name if a historical app is no longer installed.
        }

        JSObject app = new JSObject();
        app.put("packageName", packageName);
        app.put("label", label);
        app.put("minutes", timeMs / 60000);
        app.put("screenTimeMs", timeMs);
        return app;
    }

    private static void addPickupToHour(
        Map<Long, Integer> pickupsByHour,
        long eventTime,
        long startTime,
        long endTime
    ) {
        if (eventTime < startTime || eventTime > endTime) {
            return;
        }
        long hourStart = truncateToHour(eventTime);
        Integer current = pickupsByHour.get(hourStart);
        pickupsByHour.put(hourStart, (current == null ? 0 : current) + 1);
    }

    private static void addSegmentToHours(
        Map<Long, Long> screenTimeByHour,
        long rawStart,
        long rawEnd,
        long startTime,
        long endTime
    ) {
        long segmentStart = Math.max(rawStart, startTime);
        long segmentEnd = Math.min(rawEnd, endTime);
        if (segmentEnd <= segmentStart) {
            return;
        }
        while (segmentStart < segmentEnd) {
            long hourStart = truncateToHour(segmentStart);
            long nextHour = hourStart + 60L * 60L * 1000L;
            long portionEnd = Math.min(segmentEnd, nextHour);
            Long current = screenTimeByHour.get(hourStart);
            screenTimeByHour.put(hourStart, (current == null ? 0L : current) + portionEnd - segmentStart);
            segmentStart = portionEnd;
        }
    }

    private static JSArray hourlyBucketsToJsArray(
        long startTime,
        long endTime,
        Map<Long, Long> screenTimeByHour,
        Map<Long, Integer> pickupsByHour
    ) {
        JSArray buckets = new JSArray();
        long hour = truncateToHour(startTime);
        long lastHour = truncateToHour(endTime);
        while (hour <= lastHour) {
            long screenTimeMs = screenTimeByHour.containsKey(hour) ? screenTimeByHour.get(hour) : 0L;
            int pickups = pickupsByHour.containsKey(hour) ? pickupsByHour.get(hour) : 0;
            JSObject bucket = new JSObject();
            bucket.put("hourStartEpoch", hour);
            bucket.put("screenTimeMs", screenTimeMs);
            bucket.put("minutes", screenTimeMs / 60000);
            bucket.put("pickups", pickups);
            buckets.put(bucket);
            hour += 60L * 60L * 1000L;
        }
        return buckets;
    }

    private static long truncateToHour(long epochMs) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(epochMs);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        return calendar.getTimeInMillis();
    }

    private static String drawableToDataUrl(Drawable drawable) {
        if (drawable == null) {
            return null;
        }
        final int size = 64;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(canvas);

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output);
        return "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
    }

    static void recordBlockAttempt(Context context, String packageName) {
        if (TextUtils.isEmpty(packageName)) {
            return;
        }
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSONArray attempts;
        try {
            attempts = new JSONArray(prefs.getString(KEY_RECENT_BLOCK_ATTEMPTS, "[]"));
        } catch (Exception ignored) {
            attempts = new JSONArray();
        }

        long now = System.currentTimeMillis();
        JSONObject event = new JSONObject();
        try {
            event.put("packageName", packageName);
            event.put("timestamp", now);
            PackageManager pm = context.getPackageManager();
            ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
            event.put("label", pm.getApplicationLabel(appInfo).toString());
        } catch (Exception ignored) {
            // Package labels are best effort; the package name and timestamp remain useful.
        }
        attempts.put(event);

        JSONArray bounded = new JSONArray();
        int firstIndex = Math.max(0, attempts.length() - MAX_BLOCK_ATTEMPTS);
        for (int i = firstIndex; i < attempts.length(); i++) {
            JSONObject attempt = attempts.optJSONObject(i);
            if (attempt != null) {
                bounded.put(attempt);
            }
        }
        prefs.edit().putString(KEY_RECENT_BLOCK_ATTEMPTS, bounded.toString()).apply();

        int attemptsInWindow = 0;
        long windowStart = now - 30L * 60L * 1000L;
        for (int i = bounded.length() - 1; i >= 0; i--) {
            JSONObject attempt = bounded.optJSONObject(i);
            if (attempt == null) {
                continue;
            }
            long timestamp = attempt.optLong("timestamp", 0);
            if (timestamp < windowStart) {
                break;
            }
            attemptsInWindow++;
        }
        FocusEngine.maybeSendBlockNudge(context, attemptsInWindow, now);
    }

    static List<String> getLaunchablePackageNames(Context context) {
        PackageManager pm = context.getPackageManager();
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> resolveInfos = pm.queryIntentActivities(launcherIntent, 0);
        List<String> packages = new ArrayList<>();
        for (ResolveInfo info : resolveInfos) {
            String packageName = info.activityInfo.packageName;
            if (!ProtectedPackages.isProtected(context, packageName)) {
                packages.add(packageName);
            }
        }
        return packages;
    }
}
