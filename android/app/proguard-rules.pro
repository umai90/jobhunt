# ── Capacitor core ──────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep class com.bula.cyberhunt.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin { *; }

# ── Background Runner ────────────────────────────────────────────
-keep class io.ionic.backgroundrunner.** { *; }

# ── Local Notifications ──────────────────────────────────────────
-keep class com.capacitorjs.plugins.localnotifications.** { *; }

# ── WebView JS bridge — must survive obfuscation ─────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Strip all logging in release ─────────────────────────────────
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# ── Remove source file names and line numbers from stack traces ───
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
