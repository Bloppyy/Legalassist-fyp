# Flutter default
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# ML Kit — optional language models (Chinese, Devanagari, Japanese, Korean) are
# not bundled; suppress R8 warnings about their missing classes.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**

# Flutter Play Store deferred components — not used in sideloaded APK builds.
-dontwarn com.google.android.play.core.splitcompat.**
-dontwarn com.google.android.play.core.splitinstall.**
-dontwarn com.google.android.play.core.tasks.**
