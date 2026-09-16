package io.github.astrays.amethyst;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootCompletedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!shouldReschedule(intent)) {
            return;
        }
        ScheduledBlockReceiver.rescheduleAll(context);
    }

    static boolean shouldReschedule(Intent intent) {
        if (intent == null) {
            return false;
        }
        String action = intent.getAction();
        return Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
    }
}
