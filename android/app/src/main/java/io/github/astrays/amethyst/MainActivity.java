package io.github.astrays.amethyst;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean backEvaluationInProgress = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AmethystBlockerPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (backEvaluationInProgress || getBridge() == null) {
                    return;
                }

                backEvaluationInProgress = true;
                String javascript =
                    "(function(){"
                        + "if(document.body.dataset.modalOpen==='true'){"
                        + "window.dispatchEvent(new Event('amethyst-back-button'));"
                        + "return true;"
                        + "}"
                        + "if(location.hash&&location.hash!=='#/home'){"
                        + "history.back();"
                        + "return true;"
                        + "}"
                        + "return false;"
                        + "})()";

                getBridge().getWebView().evaluateJavascript(javascript, value -> {
                    backEvaluationInProgress = false;
                    if (!"true".equals(value)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });
    }
}
