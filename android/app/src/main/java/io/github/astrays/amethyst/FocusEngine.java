package io.github.astrays.amethyst;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class FocusEngine {
    static final String KEY_RULES = "engineRules";
    static final String KEY_SESSION = "engineSession";
    static final String KEY_UNBLOCK_USAGE = "engineUnblockUsage";
    static final String KEY_ACTIVE_PAUSE = "engineActivePause";
    static final String KEY_EMERGENCY_ENDS_AT = "engineEmergencyEndsAt";
    static final String KEY_SESSION_SOUNDS = "engineSessionSounds";
    static final String KEY_GENTLE_REMINDERS = "engineGentleReminders";
    static final String KEY_LAST_BROWSER_URLS = "engineLastBrowserUrls";
    static final String KEY_LAST_NUDGE_AT = "engineLastNudgeAt";
    static final String KEY_LAST_BROWSER_WARNING_AT = "engineLastBrowserWarningAt";
    static final String ALLOWLIST_SENTINEL = "*";
    static final long PAUSE_MS = 5L * 60L * 1000L;
    static final long EMERGENCY_MS = 15L * 60L * 1000L;

    private static final int REFRESH_REQUEST_CODE = 992_301;
    private static final int REMINDER_REQUEST_CODE = 992_302;
    private static final int NOTIFICATION_REMINDER = 2_101;
    private static final int NOTIFICATION_COMPLETE = 2_102;
    private static final int NOTIFICATION_UNSUPPORTED_BROWSER = 2_103;
    private static final long BROWSER_WARNING_COOLDOWN_MS = 24L * 60L * 60L * 1000L;
    private static final String REMINDER_CHANNEL = "amethyst_reminders";
    private static final long ENFORCEMENT_RECONCILE_INTERVAL_MS = 30_000L;
    private static volatile long lastEnforcementReconcileAt;

    private FocusEngine() {}

    static void syncRules(Context context, JSONArray rules, long nowMs) {
        prefs(context).edit()
            .putString(KEY_RULES, rules == null ? "[]" : rules.toString())
            .apply();
        reconcile(context, nowMs);
    }

    static void startTimer(
        Context context,
        int durationMinutes,
        boolean blockApps,
        JSONObject rule,
        long nowMs
    ) {
        JSONObject session = new JSONObject();
        try {
            long endsAt = nowMs + durationMinutes * 60_000L;
            session.put("id", "session-" + nowMs);
            session.put("kind", "timer");
            session.put("startedAt", nowMs);
            session.put("endsAt", endsAt);
            session.put("ruleIds", new JSONArray());
            session.put("blockedPackages", new JSONArray());
            session.put("blockedDomains", new JSONArray());
            session.put("mode", "blocklist");
            if (blockApps && rule != null) {
                session.put("mode", rule.optString("mode", "blocklist"));
                session.put("blockedPackages", copyArray(rule.optJSONArray("packageNames")));
                session.put("blockedDomains", copyArray(rule.optJSONArray("domains")));
                JSONArray ruleIds = new JSONArray();
                String ruleId = rule.optString("id", "");
                if (!ruleId.isEmpty()) {
                    ruleIds.put(ruleId);
                }
                session.put("ruleIds", ruleIds);
            }
        } catch (Exception ignored) {
            // The fields above use primitive JSON values and should not fail.
        }
        prefs(context).edit().putString(KEY_SESSION, session.toString()).apply();
        if (prefs(context).getBoolean(KEY_SESSION_SOUNDS, true)) {
            playTone(ToneGenerator.TONE_PROP_ACK);
        }
        reconcile(context, nowMs);
    }

    static void stopTimer(Context context, String endState, long nowMs) {
        SharedPreferences preferences = prefs(context);
        JSONObject session = readObject(preferences.getString(KEY_SESSION, ""));
        if (session != null) {
            try {
                session.put("endState", endState);
                session.put("endedAt", nowMs);
            } catch (Exception ignored) {
                // Best-effort diagnostic fields.
            }
        }
        preferences.edit().remove(KEY_SESSION).apply();
        if (session != null && "completed".equals(endState)) {
            if (preferences.getBoolean(KEY_SESSION_SOUNDS, true)) {
                playTone(ToneGenerator.TONE_PROP_ACK);
            }
            if (preferences.getBoolean(KEY_GENTLE_REMINDERS, true)) {
                notify(context, NOTIFICATION_COMPLETE, "Focus session complete", "Your Amethyst session has ended.");
            }
        }
        reconcile(context, nowMs);
    }

    static void reconcile(Context context, long nowMs) {
        SharedPreferences preferences = prefs(context);
        JSONObject session = readObject(preferences.getString(KEY_SESSION, ""));
        if (session != null && session.optLong("endsAt", 0) <= nowMs) {
            preferences.edit().remove(KEY_SESSION).apply();
            if (preferences.getBoolean(KEY_SESSION_SOUNDS, true)) {
                playTone(ToneGenerator.TONE_PROP_ACK);
            }
            if (preferences.getBoolean(KEY_GENTLE_REMINDERS, true)) {
                notify(context, NOTIFICATION_COMPLETE, "Focus session complete", "Your Amethyst session has ended.");
            }
            session = null;
        }

        JSONObject pause = readObject(preferences.getString(KEY_ACTIVE_PAUSE, ""));
        if (pause != null && pause.optLong("expiresAt", 0) <= nowMs) {
            preferences.edit().remove(KEY_ACTIVE_PAUSE).apply();
        }

        long emergencyEndsAt = preferences.getLong(KEY_EMERGENCY_ENDS_AT, 0);
        if (emergencyEndsAt > 0 && emergencyEndsAt <= nowMs) {
            preferences.edit().remove(KEY_EMERGENCY_ENDS_AT).apply();
        }

        Policy policy = evaluate(context, nowMs);
        long nextBoundary = nextBoundary(context, nowMs, policy);
        mirrorLegacyState(context, policy, nextBoundary);
        scheduleNext(context, nowMs, nextBoundary, policy);
    }

    static JSObject getStatus(Context context, long nowMs) {
        reconcile(context, nowMs);
        Policy policy = evaluate(context, nowMs);
        long nextBoundary = nextBoundary(context, nowMs, policy);

        JSObject result = new JSObject();
        result.put("active", policy.active);
        result.put("emergencySuspended", policy.emergencySuspended);
        result.put("emergencyEndsAt", policy.emergencyEndsAt > nowMs ? policy.emergencyEndsAt : null);
        result.put("blockedPackages", new JSArray(policy.blockedPackages));
        result.put("blockedDomains", new JSArray(policy.blockedDomains));
        result.put("activeRuleIds", new JSArray(policy.activeRuleIds));
        result.put("session", policy.session);
        result.put("nextBoundaryAt", nextBoundary > 0 ? nextBoundary : null);
        result.put("schedulePrecision", exactAlarmAvailable(context) ? "exact" : "inexact");
        result.put("allowlistApplied", policy.allowlistApplied);
        result.put("allowlistedPackages", new JSArray(policy.allowlistedPackages));
        result.put("allowlistedDomains", new JSArray(policy.allowlistedDomains));
        result.put("strictActive", policy.strictActive);
        result.put("unblockUsage", readArray(prefs(context).getString(KEY_UNBLOCK_USAGE, "[]")));
        result.put("updatedAt", nowMs);
        return result;
    }

    static JSObject requestUnblock(
        Context context,
        String targetPackage,
        String targetDomain,
        long nowMs
    ) {
        reconcile(context, nowMs);
        Policy policy = evaluate(context, nowMs);
        TargetDecision target = targetDecision(context, policy, targetPackage, targetDomain);
        if (!target.blocked) {
            return unblockResult(false, "no-active-block", new JSONArray(), new JSONObject(), 0);
        }

        JSONArray rules = readRules(context);
        List<JSONObject> applicable = applicableRules(policy, rules, targetPackage, targetDomain);
        if (containsStrict(applicable)) {
            return unblockResult(
                false,
                "strict-rule",
                new JSONArray(),
                remainingQuota(context, applicable, nowMs),
                0
            );
        }

        List<JSONObject> withQuota = new ArrayList<>();
        for (JSONObject rule : applicable) {
            if ("easy".equals(rule.optString("difficulty", "easy"))
                && quotaRemaining(context, rule, nowMs) > 0) {
                withQuota.add(rule);
            }
        }
        if (applicable.isEmpty() || withQuota.size() != applicable.size()) {
            return unblockResult(
                false,
                "quota-exhausted",
                new JSONArray(),
                remainingQuota(context, applicable, nowMs),
                0
            );
        }

        JSONArray affected = new JSONArray();
        for (JSONObject rule : withQuota) {
            String ruleId = rule.optString("id", "");
            affected.put(ruleId);
            incrementUsage(context, ruleId, nowMs);
        }

        long expiresAt = nowMs + PAUSE_MS;
        JSONObject pause = new JSONObject();
        try {
            pause.put("targetPackage", emptyToNull(targetPackage));
            pause.put("targetDomain", emptyToNull(targetDomain));
            pause.put("expiresAt", expiresAt);
            pause.put("ruleIds", affected);
        } catch (Exception ignored) {
            // Primitive writes only.
        }
        prefs(context).edit().putString(KEY_ACTIVE_PAUSE, pause.toString()).apply();
        reconcile(context, nowMs);
        return unblockResult(
            true,
            "gentle-quota-available",
            affected,
            remainingQuota(context, applicable, nowMs),
            expiresAt
        );
    }

    static JSObject updateSettings(Context context, JSObject options, long nowMs) {
        SharedPreferences.Editor editor = prefs(context).edit();
        if (options.has("sessionSounds")) {
            editor.putBoolean(KEY_SESSION_SOUNDS, options.optBoolean("sessionSounds", true));
        }
        if (options.has("gentleReminders")) {
            editor.putBoolean(KEY_GENTLE_REMINDERS, options.optBoolean("gentleReminders", true));
        }

        JSONObject emergencyEvent = null;
        if (options.optBoolean("emergencyStop", false)) {
            long endsAt = nowMs + EMERGENCY_MS;
            editor.putLong(KEY_EMERGENCY_ENDS_AT, endsAt);
            editor.remove(KEY_SESSION);
            emergencyEvent = new JSONObject();
            try {
                emergencyEvent.put("at", nowMs);
                emergencyEvent.put("endsAt", endsAt);
            } catch (Exception ignored) {
                // Primitive writes only.
            }
        }
        editor.apply();
        reconcile(context, nowMs);

        JSObject result = new JSObject();
        result.put("applied", true);
        result.put("emergencyEvent", emergencyEvent);
        return result;
    }

    static JSObject browserCompatibility(Context context, boolean accessibilityEnabled) {
        JSONObject urls = readObject(prefs(context).getString(KEY_LAST_BROWSER_URLS, "{}"));
        JSObject result = new JSObject();
        result.put(
            "browsers",
            BrowserUrlAdapter.compatibility(
                context,
                accessibilityEnabled,
                urls == null ? new JSONObject() : urls
            )
        );
        return result;
    }

    static JSObject resetAllData(Context context) {
        cancelAlarm(context, REFRESH_REQUEST_CODE, ScheduledBlockReceiver.ACTION_REFRESH);
        cancelAlarm(context, REMINDER_REQUEST_CODE, ScheduledBlockReceiver.ACTION_REMINDER);
        NotificationManagerCompat.from(context).cancelAll();
        prefs(context).edit().clear().apply();
        JSObject result = new JSObject();
        result.put("reset", true);
        return result;
    }

    static TargetDecision decisionFor(
        Context context,
        String packageName,
        String browserHost,
        long nowMs
    ) {
        if (nowMs - lastEnforcementReconcileAt >= ENFORCEMENT_RECONCILE_INTERVAL_MS) {
            reconcile(context, nowMs);
            lastEnforcementReconcileAt = nowMs;
        }
        Policy policy = evaluate(context, nowMs);
        return targetDecision(context, policy, packageName, browserHost);
    }

    static void recordBrowserHost(Context context, String packageName, String host) {
        if (TextUtils.isEmpty(packageName) || TextUtils.isEmpty(host)) {
            return;
        }
        SharedPreferences preferences = prefs(context);
        JSONObject urls = readObject(preferences.getString(KEY_LAST_BROWSER_URLS, "{}"));
        if (urls == null) {
            urls = new JSONObject();
        }
        try {
            urls.put(packageName, host);
            preferences.edit().putString(KEY_LAST_BROWSER_URLS, urls.toString()).apply();
        } catch (Exception ignored) {
            // Diagnostics must not interrupt enforcement.
        }
    }

    static void maybeSendBlockNudge(Context context, int attemptsInWindow, long nowMs) {
        SharedPreferences preferences = prefs(context);
        if (!preferences.getBoolean(KEY_GENTLE_REMINDERS, true) || attemptsInWindow < 3) {
            return;
        }
        long lastNudgeAt = preferences.getLong(KEY_LAST_NUDGE_AT, 0);
        if (nowMs - lastNudgeAt < 60L * 60L * 1000L) {
            return;
        }
        preferences.edit().putLong(KEY_LAST_NUDGE_AT, nowMs).apply();
        notify(context, NOTIFICATION_REMINDER, "Stay with your intention", "You have reached for a blocked app several times.");
    }

    static void maybeWarnUnsupportedBrowser(Context context, String packageName, String appLabel, long nowMs) {
        SharedPreferences preferences = prefs(context);
        JSONObject warnedAt = readObject(preferences.getString(KEY_LAST_BROWSER_WARNING_AT, "{}"));
        if (warnedAt == null) {
            warnedAt = new JSONObject();
        }
        if (nowMs - warnedAt.optLong(packageName, 0) < BROWSER_WARNING_COOLDOWN_MS) {
            return;
        }
        Policy policy = evaluate(context, nowMs);
        if (!policy.active || (policy.blockedDomains.isEmpty() && policy.allowlistedDomains.isEmpty())) {
            return;
        }
        try {
            warnedAt.put(packageName, nowMs);
            preferences.edit().putString(KEY_LAST_BROWSER_WARNING_AT, warnedAt.toString()).apply();
        } catch (Exception ignored) {
            // Diagnostics must not interrupt enforcement.
        }
        notify(
            context,
            NOTIFICATION_UNSUPPORTED_BROWSER,
            "Website blocking isn't supported here",
            appLabel + " isn't one of the browsers Amethyst can read web addresses from, so your "
                + "website rules won't apply in it. Use Chrome, Samsung Internet, Edge, or Brave instead."
        );
    }

    static void handleScheduleReminder(Context context) {
        if (!prefs(context).getBoolean(KEY_GENTLE_REMINDERS, true)) {
            return;
        }
        notify(
            context,
            NOTIFICATION_REMINDER,
            "Focus starts in 5 minutes",
            "Your next Amethyst rule is about to begin."
        );
    }

    static final class TargetDecision {
        final boolean blocked;
        final String domain;
        final boolean strict;
        final JSONArray activeRuleIds;

        TargetDecision(
            boolean blocked,
            String domain,
            boolean strict,
            JSONArray activeRuleIds
        ) {
            this.blocked = blocked;
            this.domain = domain;
            this.strict = strict;
            this.activeRuleIds = activeRuleIds;
        }
    }

    private static final class Policy {
        boolean active;
        boolean emergencySuspended;
        long emergencyEndsAt;
        boolean allowlistApplied;
        boolean strictActive;
        final Set<String> blockedPackages = new LinkedHashSet<>();
        final Set<String> blockedDomains = new LinkedHashSet<>();
        final Set<String> allowlistedPackages = new LinkedHashSet<>();
        final Set<String> allowlistedDomains = new LinkedHashSet<>();
        final List<String> activeRuleIds = new ArrayList<>();
        JSONObject session;
    }

    private static Policy evaluate(Context context, long nowMs) {
        Policy policy = new Policy();
        SharedPreferences preferences = prefs(context);
        policy.emergencyEndsAt = preferences.getLong(KEY_EMERGENCY_ENDS_AT, 0);
        policy.emergencySuspended = policy.emergencyEndsAt > nowMs;

        JSONArray rules = readRules(context);
        int allowlistCount = 0;
        for (int i = 0; i < rules.length(); i++) {
            JSONObject rule = rules.optJSONObject(i);
            if (rule == null || !isRuleActive(rule, nowMs)) {
                continue;
            }
            String id = rule.optString("id", "");
            if (!id.isEmpty()) {
                policy.activeRuleIds.add(id);
            }
            if ("hard".equals(rule.optString("difficulty", "easy"))) {
                policy.strictActive = true;
            }
            String mode = rule.optString("mode", "blocklist");
            if ("allowlist".equals(mode)) {
                policy.allowlistApplied = true;
                Set<String> packages = arrayToSet(rule.optJSONArray("packageNames"));
                Set<String> domains = arrayToSet(rule.optJSONArray("domains"));
                if (allowlistCount == 0) {
                    policy.allowlistedPackages.addAll(packages);
                    policy.allowlistedDomains.addAll(domains);
                } else {
                    policy.allowlistedPackages.retainAll(packages);
                    policy.allowlistedDomains.retainAll(domains);
                }
                allowlistCount++;
            } else {
                addAll(policy.blockedPackages, rule.optJSONArray("packageNames"));
                addAll(policy.blockedDomains, rule.optJSONArray("domains"));
            }
        }

        JSONObject session = readObject(preferences.getString(KEY_SESSION, ""));
        if (session != null && session.optLong("endsAt", 0) > nowMs) {
            policy.session = session;
            addAllIds(policy.activeRuleIds, session.optJSONArray("ruleIds"));
            if ("allowlist".equals(session.optString("mode", "blocklist"))) {
                policy.allowlistApplied = true;
                addAll(policy.allowlistedPackages, session.optJSONArray("blockedPackages"));
                addAll(policy.allowlistedDomains, session.optJSONArray("blockedDomains"));
            } else {
                addAll(policy.blockedPackages, session.optJSONArray("blockedPackages"));
                addAll(policy.blockedDomains, session.optJSONArray("blockedDomains"));
            }
        }

        if (policy.allowlistApplied) {
            policy.blockedPackages.add(ALLOWLIST_SENTINEL);
            policy.blockedDomains.add(ALLOWLIST_SENTINEL);
        }

        JSONObject pause = readObject(preferences.getString(KEY_ACTIVE_PAUSE, ""));
        if (pause != null && pause.optLong("expiresAt", 0) > nowMs) {
            String pausePackage = pause.optString("targetPackage", "");
            String pauseDomain = pause.optString("targetDomain", "");
            if (!pausePackage.isEmpty()) {
                policy.blockedPackages.remove(pausePackage);
                policy.allowlistedPackages.add(pausePackage);
            }
            if (!pauseDomain.isEmpty()) {
                removeMatching(policy.blockedDomains, pauseDomain);
                policy.allowlistedDomains.add(pauseDomain);
            }
        }

        policy.blockedPackages.removeIf(
            packageName -> ProtectedPackages.isProtected(context, packageName)
        );
        policy.active = !policy.emergencySuspended
            && (!policy.blockedPackages.isEmpty() || !policy.blockedDomains.isEmpty());
        return policy;
    }

    private static TargetDecision targetDecision(
        Context context,
        Policy policy,
        String packageName,
        String domain
    ) {
        if (!policy.active || ProtectedPackages.isProtected(context, packageName)) {
            return new TargetDecision(false, domain, policy.strictActive, toArray(policy.activeRuleIds));
        }

        boolean packageBlocked = policy.blockedPackages.contains(packageName)
            || (policy.allowlistApplied
                && !policy.allowlistedPackages.contains(packageName)
                && !BrowserUrlAdapter.supports(packageName));
        boolean domainBlocked = !TextUtils.isEmpty(domain)
            && (matchesAny(domain, policy.blockedDomains)
                || (policy.allowlistApplied && !matchesAny(domain, policy.allowlistedDomains)));
        boolean strictForTarget = containsStrict(
            applicableRules(policy, readRules(context), packageName, domain)
        );

        return new TargetDecision(
            packageBlocked || domainBlocked,
            domain,
            strictForTarget,
            toArray(policy.activeRuleIds)
        );
    }

    private static List<JSONObject> applicableRules(
        Policy policy,
        JSONArray rules,
        String targetPackage,
        String targetDomain
    ) {
        List<JSONObject> result = new ArrayList<>();
        Set<String> activeIds = new LinkedHashSet<>(policy.activeRuleIds);
        for (int i = 0; i < rules.length(); i++) {
            JSONObject rule = rules.optJSONObject(i);
            if (rule == null || !activeIds.contains(rule.optString("id", ""))) {
                continue;
            }
            boolean covers;
            if ("allowlist".equals(rule.optString("mode", "blocklist"))) {
                covers = (!TextUtils.isEmpty(targetPackage)
                    && !arrayContains(rule.optJSONArray("packageNames"), targetPackage))
                    || (!TextUtils.isEmpty(targetDomain)
                    && !matchesAny(targetDomain, arrayToSet(rule.optJSONArray("domains"))));
            } else {
                covers = (!TextUtils.isEmpty(targetPackage)
                    && arrayContains(rule.optJSONArray("packageNames"), targetPackage))
                    || (!TextUtils.isEmpty(targetDomain)
                    && matchesAny(targetDomain, arrayToSet(rule.optJSONArray("domains"))));
            }
            if (covers) {
                result.add(rule);
            }
        }
        return result;
    }

    private static boolean isRuleActive(JSONObject rule, long nowMs) {
        if (!rule.optBoolean("enabled", true)) {
            return false;
        }
        JSONObject recurrence = rule.optJSONObject("recurrence");
        if (recurrence == null) {
            return false;
        }
        String kind = recurrence.optString("kind", "always");
        if ("always".equals(kind)) {
            return true;
        }
        if ("oneOff".equals(kind)) {
            return nowMs >= recurrence.optLong("startEpoch", 0)
                && nowMs < recurrence.optLong("endEpoch", 0);
        }
        if (!"weekly".equals(kind)) {
            return false;
        }

        int start = recurrence.optInt("startMinutes", -1);
        int end = recurrence.optInt("endMinutes", -1);
        if (start < 0 || end < 0 || start == end) {
            return false;
        }
        Calendar now = Calendar.getInstance();
        now.setTimeInMillis(nowMs);
        int day = now.get(Calendar.DAY_OF_WEEK) - 1;
        int minutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        JSONArray days = recurrence.optJSONArray("days");
        if (start < end) {
            return runsOn(days, day) && minutes >= start && minutes < end;
        }
        if (minutes >= start) {
            return runsOn(days, day);
        }
        int previousDay = day == 0 ? 6 : day - 1;
        return minutes < end && runsOn(days, previousDay);
    }

    private static long nextBoundary(Context context, long nowMs, Policy current) {
        JSONArray rules = readRules(context);
        long earliest = 0;
        for (int i = 0; i < rules.length(); i++) {
            JSONObject rule = rules.optJSONObject(i);
            if (rule == null || !rule.optBoolean("enabled", true)) {
                continue;
            }
            long candidate = nextBoundaryForRule(rule, nowMs);
            if (candidate > nowMs && (earliest == 0 || candidate < earliest)) {
                earliest = candidate;
            }
        }
        if (current.session != null) {
            long sessionEnd = current.session.optLong("endsAt", 0);
            if (sessionEnd > nowMs && (earliest == 0 || sessionEnd < earliest)) {
                earliest = sessionEnd;
            }
        }
        if (current.emergencyEndsAt > nowMs && (earliest == 0 || current.emergencyEndsAt < earliest)) {
            earliest = current.emergencyEndsAt;
        }
        JSONObject pause = readObject(prefs(context).getString(KEY_ACTIVE_PAUSE, ""));
        if (pause != null) {
            long pauseEnd = pause.optLong("expiresAt", 0);
            if (pauseEnd > nowMs && (earliest == 0 || pauseEnd < earliest)) {
                earliest = pauseEnd;
            }
        }
        return earliest;
    }

    private static long nextBoundaryForRule(JSONObject rule, long nowMs) {
        JSONObject recurrence = rule.optJSONObject("recurrence");
        if (recurrence == null) {
            return 0;
        }
        String kind = recurrence.optString("kind", "always");
        if ("always".equals(kind)) {
            return 0;
        }
        if ("oneOff".equals(kind)) {
            long start = recurrence.optLong("startEpoch", 0);
            long end = recurrence.optLong("endEpoch", 0);
            if (nowMs < start) {
                return start;
            }
            return nowMs < end ? end : 0;
        }

        boolean previous = isRuleActive(rule, nowMs);
        long cursor = truncateToMinute(nowMs) + 60_000L;
        long horizon = nowMs + 8L * 24L * 60L * 60L * 1000L;
        while (cursor <= horizon) {
            boolean active = isRuleActive(rule, cursor);
            if (active != previous) {
                return cursor;
            }
            previous = active;
            cursor += 60_000L;
        }
        return 0;
    }

    private static void scheduleNext(Context context, long nowMs, long nextBoundary, Policy current) {
        cancelAlarm(context, REFRESH_REQUEST_CODE, ScheduledBlockReceiver.ACTION_REFRESH);
        cancelAlarm(context, REMINDER_REQUEST_CODE, ScheduledBlockReceiver.ACTION_REMINDER);
        if (nextBoundary <= nowMs) {
            return;
        }

        scheduleAlarm(
            context,
            REFRESH_REQUEST_CODE,
            ScheduledBlockReceiver.ACTION_REFRESH,
            nextBoundary
        );

        if (!prefs(context).getBoolean(KEY_GENTLE_REMINDERS, true)
            || nextBoundary - nowMs <= 5L * 60L * 1000L) {
            return;
        }
        Policy after = evaluate(context, nextBoundary + 1_000L);
        boolean ruleStarts = false;
        for (String ruleId : after.activeRuleIds) {
            if (!current.activeRuleIds.contains(ruleId)) {
                ruleStarts = true;
                break;
            }
        }
        if (ruleStarts) {
            scheduleAlarm(
                context,
                REMINDER_REQUEST_CODE,
                ScheduledBlockReceiver.ACTION_REMINDER,
                nextBoundary - 5L * 60L * 1000L
            );
        }
    }

    private static void scheduleAlarm(Context context, int requestCode, String action, long when) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) {
            return;
        }
        PendingIntent pending = pendingIntent(context, requestCode, action);
        if (exactAlarmAvailable(context)) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
        }
    }

    private static void cancelAlarm(Context context, int requestCode, String action) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager != null) {
            manager.cancel(pendingIntent(context, requestCode, action));
        }
    }

    private static PendingIntent pendingIntent(Context context, int requestCode, String action) {
        Intent intent = new Intent(context, ScheduledBlockReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static boolean exactAlarmAvailable(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return manager != null && manager.canScheduleExactAlarms();
    }

    private static void mirrorLegacyState(Context context, Policy policy, long nextBoundary) {
        prefs(context).edit()
            .putBoolean(AmethystBlockerPlugin.KEY_BLOCKING_ACTIVE, policy.active)
            .putString(
                AmethystBlockerPlugin.KEY_BLOCKED_PACKAGES,
                TextUtils.join(",", withoutSentinel(policy.blockedPackages))
            )
            .putLong(AmethystBlockerPlugin.KEY_BLOCKING_ENDS_AT, nextBoundary)
            .putBoolean(
                AmethystBlockerPlugin.KEY_BLOCKING_FROM_SCHEDULE,
                !policy.activeRuleIds.isEmpty()
            )
            .apply();
    }

    private static JSONArray readRules(Context context) {
        return readArray(prefs(context).getString(KEY_RULES, "[]"));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(AmethystBlockerPlugin.PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static int quotaRemaining(Context context, JSONObject rule, long nowMs) {
        int limit = Math.max(0, rule.optInt("unblocksPerDay", 0));
        return Math.max(0, limit - usageForRule(context, rule.optString("id", ""), dateKey(nowMs)));
    }

    private static JSONObject remainingQuota(Context context, List<JSONObject> rules, long nowMs) {
        JSONObject result = new JSONObject();
        for (JSONObject rule : rules) {
            try {
                result.put(rule.optString("id", ""), quotaRemaining(context, rule, nowMs));
            } catch (Exception ignored) {
                // Primitive writes only.
            }
        }
        return result;
    }

    private static int usageForRule(Context context, String ruleId, String date) {
        JSONArray usage = readArray(prefs(context).getString(KEY_UNBLOCK_USAGE, "[]"));
        for (int i = 0; i < usage.length(); i++) {
            JSONObject record = usage.optJSONObject(i);
            if (record != null
                && date.equals(record.optString("date", ""))
                && ruleId.equals(record.optString("ruleId", ""))) {
                return Math.max(0, record.optInt("used", 0));
            }
        }
        return 0;
    }

    private static void incrementUsage(Context context, String ruleId, long nowMs) {
        SharedPreferences preferences = prefs(context);
        JSONArray usage = readArray(preferences.getString(KEY_UNBLOCK_USAGE, "[]"));
        String date = dateKey(nowMs);
        JSONObject match = null;
        for (int i = 0; i < usage.length(); i++) {
            JSONObject record = usage.optJSONObject(i);
            if (record != null
                && date.equals(record.optString("date", ""))
                && ruleId.equals(record.optString("ruleId", ""))) {
                match = record;
                break;
            }
        }
        try {
            if (match == null) {
                match = new JSONObject();
                match.put("date", date);
                match.put("ruleId", ruleId);
                match.put("used", 1);
                JSONArray timestamps = new JSONArray();
                timestamps.put(nowMs);
                match.put("timestamps", timestamps);
                usage.put(match);
            } else {
                match.put("used", match.optInt("used", 0) + 1);
                JSONArray timestamps = match.optJSONArray("timestamps");
                if (timestamps == null) {
                    timestamps = new JSONArray();
                    match.put("timestamps", timestamps);
                }
                timestamps.put(nowMs);
            }
        } catch (Exception ignored) {
            return;
        }
        preferences.edit().putString(KEY_UNBLOCK_USAGE, usage.toString()).apply();
    }

    private static JSObject unblockResult(
        boolean allowed,
        String reason,
        JSONArray affected,
        JSONObject remaining,
        long expiresAt
    ) {
        JSObject result = new JSObject();
        result.put("allowed", allowed);
        result.put("reason", reason);
        result.put("affectedRuleIds", affected);
        result.put("remainingQuotaByRule", remaining);
        result.put("expiresAt", expiresAt > 0 ? expiresAt : null);
        return result;
    }

    private static void notify(Context context, int id, String title, String body) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(new NotificationChannel(
                    REMINDER_CHANNEL,
                    "Amethyst reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
                ));
            }
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, REMINDER_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
        } catch (SecurityException ignored) {
            // Notification permission is optional.
        }
    }

    private static void playTone(int tone) {
        ToneGenerator generator;
        try {
            generator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 55);
        } catch (RuntimeException ignored) {
            // ToneGenerator throws when audio focus or the audio session is unavailable.
            return;
        }
        try {
            generator.startTone(tone, 180);
        } catch (Exception ignored) {
            generator.release();
            return;
        }
        final ToneGenerator gen = generator;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try { gen.release(); } catch (Exception ignored) {}
        }, 250);
    }

    private static boolean containsStrict(List<JSONObject> rules) {
        for (JSONObject rule : rules) {
            if ("hard".equals(rule.optString("difficulty", "easy"))) {
                return true;
            }
        }
        return false;
    }

    private static boolean runsOn(JSONArray days, int day) {
        if (days == null || days.length() == 0) {
            return true;
        }
        for (int i = 0; i < days.length(); i++) {
            if (days.optInt(i, -1) == day) {
                return true;
            }
        }
        return false;
    }

    private static boolean arrayContains(JSONArray array, String value) {
        if (array == null || TextUtils.isEmpty(value)) {
            return false;
        }
        for (int i = 0; i < array.length(); i++) {
            if (value.equals(array.optString(i, ""))) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesAny(String host, Set<String> domains) {
        if (TextUtils.isEmpty(host)) {
            return false;
        }
        for (String domain : domains) {
            if (!ALLOWLIST_SENTINEL.equals(domain)
                && BrowserUrlAdapter.matchesHost(host, domain)) {
                return true;
            }
        }
        return false;
    }

    private static void removeMatching(Set<String> domains, String host) {
        List<String> matches = new ArrayList<>();
        for (String domain : domains) {
            if (BrowserUrlAdapter.matchesHost(host, domain)) {
                matches.add(domain);
            }
        }
        domains.removeAll(matches);
    }

    private static void addAll(Set<String> target, JSONArray values) {
        if (values == null) {
            return;
        }
        for (int i = 0; i < values.length(); i++) {
            String value = values.optString(i, "").trim().toLowerCase();
            if (!value.isEmpty()) {
                target.add(value);
            }
        }
    }

    private static void addAllIds(List<String> target, JSONArray values) {
        if (values == null) {
            return;
        }
        for (int i = 0; i < values.length(); i++) {
            String value = values.optString(i, "");
            if (!value.isEmpty() && !target.contains(value)) {
                target.add(value);
            }
        }
    }

    private static Set<String> arrayToSet(JSONArray values) {
        Set<String> result = new LinkedHashSet<>();
        addAll(result, values);
        return result;
    }

    private static JSONArray toArray(Iterable<String> values) {
        JSONArray result = new JSONArray();
        for (String value : values) {
            result.put(value);
        }
        return result;
    }

    private static JSONArray copyArray(JSONArray values) {
        JSONArray copy = new JSONArray();
        if (values != null) {
            for (int i = 0; i < values.length(); i++) {
                copy.put(values.opt(i));
            }
        }
        return copy;
    }

    private static JSONArray readArray(String raw) {
        try {
            return new JSONArray(TextUtils.isEmpty(raw) ? "[]" : raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static JSONObject readObject(String raw) {
        if (TextUtils.isEmpty(raw)) {
            return null;
        }
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String dateKey(long epochMs) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(epochMs));
    }

    private static long truncateToMinute(long epochMs) {
        return epochMs - Math.floorMod(epochMs, 60_000L);
    }

    private static String emptyToNull(String value) {
        return TextUtils.isEmpty(value) ? null : value;
    }

    private static List<String> withoutSentinel(Set<String> values) {
        List<String> result = new ArrayList<>();
        for (String value : values) {
            if (!ALLOWLIST_SENTINEL.equals(value)) {
                result.add(value);
            }
        }
        return result;
    }
}
