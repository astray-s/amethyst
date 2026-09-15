package io.github.astrays.amethyst;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class BlockedOverlayActivity extends Activity {
    private TextView nudge;
    private Button unblockButton;
    private String targetPackage;
    private String targetDomain;
    private boolean strict;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        readTarget(getIntent());

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        int padding = Math.round(28 * getResources().getDisplayMetrics().density);
        root.setPadding(padding, padding, padding, padding);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        ));

        TextView title = new TextView(this);
        title.setText("Blocked by Amethyst");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);

        nudge = new TextView(this);
        nudge.setText(
            strict
                ? "Strict mode is active. You can only pause blocking with Emergency Stop in Settings."
                : "Stay with the intention you set, or use one conscious 5-minute pause."
        );
        nudge.setTextColor(Color.LTGRAY);
        nudge.setTextSize(16);
        nudge.setGravity(Gravity.CENTER);
        nudge.setPadding(0, padding, 0, padding);

        unblockButton = new Button(this);
        unblockButton.setText("Unblock for 5 minutes");
        unblockButton.setVisibility(strict ? View.GONE : View.VISIBLE);
        unblockButton.setOnClickListener(v -> requestPause());

        Button homeButton = new Button(this);
        homeButton.setText("Go home");
        homeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent homeIntent = new Intent(Intent.ACTION_MAIN);
                homeIntent.addCategory(Intent.CATEGORY_HOME);
                homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(homeIntent);
                finish();
            }
        });

        root.addView(title);
        root.addView(nudge);
        root.addView(unblockButton);
        root.addView(homeButton);
        setContentView(root);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readTarget(intent);
        if (nudge != null) {
            nudge.setText(
                strict
                    ? "Strict mode is active. You can only pause blocking with Emergency Stop in Settings."
                    : "Stay with the intention you set, or use one conscious 5-minute pause."
            );
        }
        if (unblockButton != null) {
            unblockButton.setVisibility(strict ? View.GONE : View.VISIBLE);
        }
    }

    private void readTarget(Intent intent) {
        targetPackage = intent == null ? "" : intent.getStringExtra("targetPackage");
        targetDomain = intent == null ? "" : intent.getStringExtra("targetDomain");
        strict = intent != null && intent.getBooleanExtra("strict", false);
    }

    private void requestPause() {
        FocusEngine.TargetDecision current = FocusEngine.decisionFor(
            this,
            targetPackage,
            targetDomain,
            System.currentTimeMillis()
        );
        if (!current.blocked) {
            finish();
            return;
        }

        com.getcapacitor.JSObject result = FocusEngine.requestUnblock(
            this,
            targetPackage,
            targetDomain,
            System.currentTimeMillis()
        );
        if (result.optBoolean("allowed", false)) {
            finish();
            return;
        }

        String reason = result.optString("reason", "quota-exhausted");
        if ("strict-rule".equals(reason)) {
            nudge.setText("Strict mode is active. This block cannot be paused.");
            unblockButton.setVisibility(View.GONE);
        } else {
            nudge.setText("You have used today’s available 5-minute pauses.");
            unblockButton.setEnabled(false);
        }
    }
}
