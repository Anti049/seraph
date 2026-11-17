package dev.nploetz.seraph

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.net.ConnectivityManager
import java.io.File
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONArray
import org.json.JSONObject as Json
import java.io.PrintWriter
import java.io.StringWriter
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * Android TV shell for SERAPH (Plex + Ganymede). The UI is bundled in the APK (assets/app/)
 * and served by intercepting requests, never from the network:
 *
 *  - by default from a private origin, https://appassets.androidplatform.net/
 *  - once Ganymede is connected, from https://<ganymede-host>/tv/, so Ganymede's
 *    SameSite=Lax login cookie is first-party. Plex uses a token, so it works either way.
 *
 * App storage lives in SharedPreferences (exposed to JS as SeraphTV.getItem/setItem), so the
 * Plex token and settings survive moving between those origins. The Activity also turns BACK
 * and media keys into `tvkey` DOM events.
 */
class MainActivity : Activity() {

    private var web: WebView? = null
    private val store by lazy { getSharedPreferences("seraph-store", MODE_PRIVATE) }
    private val shell by lazy { getSharedPreferences("seraph-shell", MODE_PRIVATE) }

    /** Ganymede origin the UI is hosted on, or "" for the private default origin. */
    private val ganymedeOrigin: String
        get() = shell.getString("origin", "") ?: ""

    private val startUrl: String
        get() = if (ganymedeOrigin.isNotEmpty()) "$ganymedeOrigin/tv/index.html" else "$ORIGIN/index.html"

    private val crashFile by lazy { File(filesDir, "last-crash.txt") }
    private var scanCancelled: AtomicBoolean? = null
    /** Last launch's crash, handed to the web app's error reporter once (SeraphTV.takeCrash()). */
    @Volatile private var pendingCrash: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installCrashRecorder()

        // A crash on the previous launch: normally the web app shows it (with a QR code to report it
        // on GitHub). If the app keeps crashing right after starting, fall back to the native screen
        // so it can't get stuck in a loop.
        if (crashFile.exists()) {
            val text = crashFile.readText()
            val loops = shell.getInt("quickCrashes", 0)
            if (loops >= 2) {
                showReport("SERAPH closed unexpectedly last time", text)
                return
            }
            pendingCrash = text
            crashFile.delete()
        }
        try {
            startWeb(savedInstanceState)
            // Survived 20 s: no longer a crash loop.
            Handler(Looper.getMainLooper()).postDelayed({ shell.edit().putInt("quickCrashes", 0).apply() }, 20_000)
        } catch (t: Throwable) {
            showReport("SERAPH couldn't start its web view", describe(t))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun startWeb(savedInstanceState: Bundle?) {
        val web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#1E1E2E"))
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
                // Some Plex servers are only reachable on plain http inside the LAN.
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                userAgentString = "$userAgentString SeraphTV-Android/${BuildConfig.VERSION_NAME}"
            }
            webChromeClient = WebChromeClient()
            webViewClient = ShellClient()
            addJavascriptInterface(Bridge(), "SeraphTV")
        }
        this.web = web
        setContentView(web)
        goImmersive()
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(startUrl)
        web.requestFocus()
    }

    // ---------- crash reporting (shown on the TV, no adb needed) ----------

    private fun installCrashRecorder() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                crashFile.writeText(describe(error))
                shell.edit().putInt("quickCrashes", shell.getInt("quickCrashes", 0) + 1).commit()
            } catch (_: Throwable) {
            }
            previous?.uncaughtException(thread, error)
        }
    }

    private fun describe(t: Throwable): String {
        val sw = StringWriter()
        t.printStackTrace(PrintWriter(sw))
        return deviceInfo() + "\n\n" + sw.toString()
    }

    private fun deviceInfo(): String {
        val webview = try {
            if (Build.VERSION.SDK_INT >= 26) WebView.getCurrentWebViewPackage()?.let { "${it.packageName} ${it.versionName}" } ?: "none"
            else "unknown"
        } catch (_: Throwable) {
            "unavailable"
        }
        return "SERAPH ${BuildConfig.VERSION_NAME} · ${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) · WebView: $webview"
    }

    /** Plain native screen (no WebView) with the error and Try again / Close buttons. */
    private fun showReport(title: String, details: String) {
        web?.let {
            (it.parent as? ViewGroup)?.removeView(it)
            it.destroy()
        }
        web = null
        val pad = (resources.displayMetrics.density * 32).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#1E1E2E"))
            setPadding(pad * 2, pad, pad * 2, pad)
        }
        root.addView(TextView(this).apply {
            text = title
            textSize = 26f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "Report it at github.com/${BuildConfig.REPORT_REPO}/issues/new with a photo of this screen."
            textSize = 15f
            setTextColor(Color.parseColor("#9AA6B0"))
            setPadding(0, pad / 3, 0, pad / 2)
        })
        root.addView(ScrollView(this).apply {
            isFocusable = true
            addView(TextView(this@MainActivity).apply {
                text = details
                textSize = 12f
                typeface = Typeface.MONOSPACE
                setTextColor(Color.parseColor("#DDE3E7"))
                setTextIsSelectable(false)
            })
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.START
            setPadding(0, pad / 2, 0, 0)
        }
        val retry = Button(this).apply {
            text = "Try again"
            setOnClickListener {
                crashFile.delete()
                shell.edit().putInt("quickCrashes", 0).apply()
                recreate()
            }
        }
        row.addView(retry)
        row.addView(Button(this).apply {
            text = "Close"
            setOnClickListener {
                crashFile.delete()
                finish()
            }
        })
        root.addView(row)
        setContentView(root)
        retry.requestFocus()
    }

    // ---------- bundled assets ----------

    private fun bundled(url: Uri): WebResourceResponse? {
        val origin = "${url.scheme}://${url.authority}"
        val path = url.path ?: "/"
        var rel = when {
            origin == ORIGIN -> path.trimStart('/')
            ganymedeOrigin.isNotEmpty() && origin == ganymedeOrigin && (path == "/tv" || path.startsWith("/tv/")) ->
                path.removePrefix("/tv").trimStart('/')
            else -> return null // everything else (Plex, Ganymede API/media) goes to the network
        }
        if (rel.isEmpty() || !rel.contains('.')) rel = "index.html"
        return try {
            val mime = mimeFor(rel)
            WebResourceResponse(mime, if (mime.startsWith("text/") || mime.endsWith("javascript")) "utf-8" else null, assets.open("app/$rel"))
        } catch (e: java.io.IOException) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), "".byteInputStream())
        }
    }

    private fun mimeFor(name: String) = when (name.substringAfterLast('.').lowercase()) {
        "html" -> "text/html"
        "js" -> "application/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "woff2" -> "font/woff2"
        else -> "application/octet-stream"
    }

    // ---------- keys ----------

    private fun keyAction(code: Int): String? = when (code) {
        KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> "back"
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> "playpause"
        KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
        KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
        KeyEvent.KEYCODE_MEDIA_STOP -> "stop"
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "ff"
        KeyEvent.KEYCODE_MEDIA_REWIND -> "rw"
        KeyEvent.KEYCODE_MEDIA_NEXT -> "next"
        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> "prev"
        KeyEvent.KEYCODE_PROG_RED -> "red"
        KeyEvent.KEYCODE_PROG_GREEN -> "green"
        KeyEvent.KEYCODE_PROG_YELLOW -> "yellow"
        KeyEvent.KEYCODE_PROG_BLUE -> "blue"
        KeyEvent.KEYCODE_INFO, KeyEvent.KEYCODE_GUIDE -> "info"
        KeyEvent.KEYCODE_CAPTIONS -> "red" // CC opens audio & subtitles
        else -> null
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val web = this.web ?: return super.dispatchKeyEvent(event) // report screen: native handling
        val action = keyAction(event.keyCode) ?: return super.dispatchKeyEvent(event)
        if (event.action == KeyEvent.ACTION_DOWN) {
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tvkey',{detail:${JSONObject.quote(action)}}))", null)
        }
        return true
    }

    // ---------- lifecycle ----------

    override fun onResume() {
        super.onResume()
        web?.let {
            goImmersive()
            it.onResume()
        }
    }

    override fun onPause() {
        web?.evaluateJavascript("document.querySelectorAll('video').forEach(v=>v.pause())", null)
        web?.onPause()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web?.saveState(outState)
    }

    override fun onDestroy() {
        web?.destroy()
        web = null
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun goImmersive() = try {
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
    } catch (_: Throwable) {
        // Cosmetic only; never let fullscreen setup take the app down.
    }

    private inner class ShellClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            bundled(request.url)

        /** Without this, a crashed WebView renderer takes the whole app down. */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            val why = if (detail.didCrash()) "The web view's renderer crashed." else "The system stopped the web view's renderer (low memory)."
            runOnUiThread { showReport("SERAPH's display engine stopped", "${deviceInfo()}\n\n$why") }
            return true
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val u = request.url.toString()
            return !(u.startsWith(ORIGIN) || (ganymedeOrigin.isNotEmpty() && u.startsWith("$ganymedeOrigin/tv")))
        }
    }

    /** Exposed to JavaScript as `window.SeraphTV`. */
    inner class Bridge {
        @JavascriptInterface
        fun exit() = runOnUiThread { finish() }

        @JavascriptInterface
        fun platform(): String = "androidtv"

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME

        /** The previous launch's native crash report, once (then null). */
        @JavascriptInterface
        fun takeCrash(): String? {
            val c = pendingCrash
            pendingCrash = null
            return c
        }

        // Origin-independent storage for the web app.
        @JavascriptInterface
        fun getItem(key: String): String? = store.getString(key, null)

        @JavascriptInterface
        fun setItem(key: String, value: String) = store.edit().putString(key, value).apply()

        @JavascriptInterface
        fun removeItem(key: String) = store.edit().remove(key).apply()

        /** Host the UI on the Ganymede origin ("" = private default) and reload there. */
        @JavascriptInterface
        fun setOrigin(url: String) = runOnUiThread {
            val clean = url.trim().trimEnd('/')
            val valid = clean.isEmpty() || clean.startsWith("https://") || clean.startsWith("http://")
            if (valid && clean != ganymedeOrigin) {
                shell.edit().putString("origin", clean).commit()
                web?.loadUrl(startUrl)
            }
        }

        /** {"ip":"192.168.1.37","prefix":24} for the active network, or "" if unknown. */
        @JavascriptInterface
        fun localNetwork(): String {
            val addr = ipv4() ?: return ""
            return Json().put("ip", addr.first).put("prefix", addr.second).toString()
        }

        /**
         * Probe every host of the /24 we're on, on the given ports, for Ganymede's API.
         * Progress arrives in JS as `ganymede-scan` events: {done,total,found:[{url,channels}],finished}.
         */
        @JavascriptInterface
        fun scanGanymede(portsCsv: String) {
            scanCancelled?.set(true)
            val cancelled = AtomicBoolean(false)
            scanCancelled = cancelled
            val ports = portsCsv.split(",").mapNotNull { it.trim().toIntOrNull() }.ifEmpty { listOf(4800) }
            val ip = ipv4()?.first
            if (ip == null) {
                emitScan(0, 0, JSONArray(), true)
                return
            }
            val base = ip.substringBeforeLast('.')
            val targets = (1..254).flatMap { h -> ports.map { p -> "http://$base.$h" + if (p == 80) "" else ":$p" } }
            val found = JSONArray()
            val done = AtomicInteger(0)
            val pool = Executors.newFixedThreadPool(64)
            for (url in targets) {
                pool.execute {
                    if (cancelled.get()) return@execute
                    val channels = probe(url)
                    if (channels != null) synchronized(found) { found.put(Json().put("url", url).put("channels", channels)) }
                    val n = done.incrementAndGet()
                    if (!cancelled.get() && (n % 32 == 0 || channels != null)) synchronized(found) { emitScan(n, targets.size, JSONArray(found.toString()), false) }
                }
            }
            pool.shutdown()
            Thread {
                pool.awaitTermination(2, TimeUnit.MINUTES)
                if (!cancelled.get()) synchronized(found) { emitScan(targets.size, targets.size, JSONArray(found.toString()), true) }
            }.start()
        }

        @JavascriptInterface
        fun cancelScan() {
            scanCancelled?.set(true)
        }

        @JavascriptInterface
        fun keepScreenOn(on: Boolean) = runOnUiThread {
            if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    // ---------- LAN discovery helpers ----------

    private fun ipv4(): Pair<String, Int>? = try {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val props = cm.getLinkProperties(cm.activeNetwork)
        props?.linkAddresses?.firstOrNull { it.address is Inet4Address && !it.address.isLoopbackAddress }
            ?.let { (it.address.hostAddress ?: "") to it.prefixLength }
    } catch (_: Throwable) {
        null
    }

    /** Channel count if `base` answers like Ganymede (`{"success":…,"data":[…]}`), else null. */
    private fun probe(base: String): Int? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL("$base/api/v1/channel").openConnection() as HttpURLConnection).apply {
                connectTimeout = 700
                readTimeout = 2000
                instanceFollowRedirects = false
            }
            if (conn.responseCode != 200) return null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = Json(body)
            if (!json.has("success") || !json.has("data")) null else json.optJSONArray("data")?.length() ?: 0
        } catch (_: Throwable) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun emitScan(done: Int, total: Int, found: JSONArray, finished: Boolean) {
        val detail = Json().put("done", done).put("total", total).put("found", found).put("finished", finished)
        runOnUiThread {
            web?.evaluateJavascript("window.dispatchEvent(new CustomEvent('ganymede-scan',{detail:$detail}))", null)
        }
    }

    companion object {
        const val ORIGIN = "https://appassets.androidplatform.net"
    }
}
