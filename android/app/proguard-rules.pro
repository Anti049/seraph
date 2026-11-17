# Keep the JavaScript bridge methods callable from the WebView.
-keepclassmembers class dev.nploetz.seraph.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
