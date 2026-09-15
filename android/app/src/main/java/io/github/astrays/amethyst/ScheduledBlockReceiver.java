package io.github.astrays.amethyst;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ScheduledBlockReceiver extends BroadcastReceiver {
    static final String ACTION_REFRESH = "io.github.astrays.amethyst.REFRESH_SCHEDULED_BLOCKS";
    static final String ACTION_REMINDER = "io.github.astrays.amethyst.SCHEDULE_REMINDER";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACTION_REMINDER.equals(intent.getAction())) {
            FocusEngine.handleScheduleReminder(context);
            return;
        }
        rescheduleAll(context);
    }

    static void rescheduleAll(Context context) {
        FocusEngine.reconcile(context, System.currentTimeMillis());
    }
}
