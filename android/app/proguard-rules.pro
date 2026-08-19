# The app intentionally uses a JavaScript bridge from the bundled local website.
-keepclassmembers class com.kongkong.englishcards.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
