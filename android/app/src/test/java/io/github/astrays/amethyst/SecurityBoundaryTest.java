package io.github.astrays.amethyst;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;

import java.util.Collections;

@RunWith(RobolectricTestRunner.class)
public class SecurityBoundaryTest {
    private Context context;
    private long nowMs;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        nowMs = System.currentTimeMillis();
        FocusEngine.resetAllData(context);
    }

    @After
    public void tearDown() {
        FocusEngine.resetAllData(context);
    }

    @Test
    public void criticalAndroidPackagesAreNeverBlockedByStrictAllowlist() throws Exception {
        FocusEngine.syncRules(context, strictAlwaysAllowlist(), nowMs);

        String[] protectedPackages = {
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
            "com.google.android.dialer",
            "com.samsung.android.dialer",
            "com.samsung.android.incallui"
        };

        for (String packageName : protectedPackages) {
            assertFalse(
                packageName + " must remain available",
                FocusEngine.decisionFor(context, packageName, "", nowMs).blocked
            );
        }
    }

    @Test
    public void settingsCannotBeBlockedEvenWhenExplicitlyNamedInBlocklist() throws Exception {
        JSONObject rule = baseRule("blocklist");
        rule.put("packageNames", new JSONArray().put("com.android.settings"));
        FocusEngine.syncRules(context, new JSONArray().put(rule), nowMs);

        assertFalse(
            FocusEngine.decisionFor(context, "com.android.settings", "", nowMs).blocked
        );
    }

    @Test
    public void accessibilityServiceNeverLaunchesOverlayForSettings() throws Exception {
        FocusEngine.syncRules(context, strictAlwaysAllowlist(), nowMs);
        AmethystBlockAccessibilityService service = Robolectric
            .buildService(AmethystBlockAccessibilityService.class)
            .create()
            .get();

        AccessibilityEvent event = AccessibilityEvent.obtain(
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        );
        event.setPackageName("com.android.settings");
        service.onAccessibilityEvent(event);
        event.recycle();

        assertNull(
            Shadows.shadowOf((Application) context).getNextStartedActivity()
        );
    }

    @Test
    public void accessibilityServiceStillLaunchesOverlayForBlockedUserApp() throws Exception {
        FocusEngine.syncRules(context, strictAlwaysAllowlist(), nowMs);
        AmethystBlockAccessibilityService service = Robolectric
            .buildService(AmethystBlockAccessibilityService.class)
            .create()
            .get();

        AccessibilityEvent event = AccessibilityEvent.obtain(
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        );
        event.setPackageName("com.example.social");
        service.onAccessibilityEvent(event);
        event.recycle();

        Intent started = Shadows.shadowOf((Application) context).getNextStartedActivity();
        assertEquals(
            BlockedOverlayActivity.class.getName(),
            started.getComponent().getClassName()
        );
    }

    @Test
    public void ordinaryUserAppsRemainBlockable() throws Exception {
        FocusEngine.syncRules(context, strictAlwaysAllowlist(), nowMs);

        assertTrue(
            FocusEngine.decisionFor(context, "com.example.social", "", nowMs).blocked
        );
    }

    @Test
    public void timersMustBeShorterThanTwentyFourHours() {
        assertNull(
            AmethystBlockerPlugin.validateStartRequest(
                1_439,
                false,
                Collections.emptyList()
            )
        );
        assertEquals(
            AmethystBlockerPlugin.ERROR_INVALID_DURATION,
            AmethystBlockerPlugin.validateStartRequest(
                1_440,
                false,
                Collections.emptyList()
            )
        );
        assertEquals(
            AmethystBlockerPlugin.ERROR_INVALID_DURATION,
            AmethystBlockerPlugin.validateStartRequest(
                Integer.MAX_VALUE,
                false,
                Collections.emptyList()
            )
        );
    }

    @Test
    public void bootReceiverAcceptsOnlyExpectedSystemActions() {
        assertFalse(BootCompletedReceiver.shouldReschedule(null));
        assertFalse(
            BootCompletedReceiver.shouldReschedule(
                new Intent("io.github.astrays.amethyst.UNTRUSTED")
            )
        );
        assertTrue(
            BootCompletedReceiver.shouldReschedule(
                new Intent(Intent.ACTION_BOOT_COMPLETED)
            )
        );
        assertTrue(
            BootCompletedReceiver.shouldReschedule(
                new Intent(Intent.ACTION_MY_PACKAGE_REPLACED)
            )
        );
    }

    private static JSONArray strictAlwaysAllowlist() throws Exception {
        return new JSONArray().put(baseRule("allowlist"));
    }

    private static JSONObject baseRule(String mode) throws Exception {
        JSONObject rule = new JSONObject();
        rule.put("id", "security-test");
        rule.put("name", "Security test");
        rule.put("enabled", true);
        rule.put("mode", mode);
        rule.put("packageNames", new JSONArray());
        rule.put("domains", new JSONArray());
        rule.put("difficulty", "hard");
        rule.put("unblocksPerDay", 0);
        rule.put("recurrence", new JSONObject().put("kind", "always"));
        return rule;
    }
}
