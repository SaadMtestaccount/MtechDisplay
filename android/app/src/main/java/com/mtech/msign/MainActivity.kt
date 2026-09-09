package com.mtech.msign

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView

/**
 * MSIGN TV shell: a fullscreen kiosk WebView pointed at the MSIGN player.
 * Everything (pairing, playback, realtime updates, media caching) is the web app; this activity
 * provides the always-on fullscreen surface, media autoplay, and the resilience a cheap TV box
 * needs: it keeps retrying when the box boots before Wi-Fi is up (with a readable notice instead
 * of the WebView's "webpage not available"), reloads the moment a network appears, pins the text
 * scale so the box's accessibility font size can't distort the UI, and identifies itself to the
 * site through the user agent ("MSIGN-Android/x.y") so the player can adapt.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var notice: TextView
    private val handler = Handler(Looper.getMainLooper())
    private val baseHost: String? = Uri.parse(BuildConfig.BASE_URL).host
    private val playerUrl = BuildConfig.BASE_URL + "/player"
    private var mainFrameFailed = false
    private var retryDelayMs = RETRY_MIN_MS
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val retry = Runnable { loadPlayer() }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }

        webView = WebView(this)
        webView.setBackgroundColor(Color.BLACK)
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            // Cheap boxes often ship with a large accessibility font scale; the player sizes itself.
            textZoom = 100
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString MSIGN-Android/${BuildConfig.VERSION_NAME}"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                // Kiosk: stay on the MSIGN origin; swallow anything external.
                val host = request.url.host ?: return true
                return host != baseHost
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                mainFrameFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (!mainFrameFailed) {
                    retryDelayMs = RETRY_MIN_MS
                    hideNotice()
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                failMainFrame("Can't reach MSIGN (${error.description}).\nChecking the connection…")
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (!request.isForMainFrame || errorResponse.statusCode < 500) return
                failMainFrame("MSIGN is temporarily unavailable (${errorResponse.statusCode}).")
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                // Never bypass TLS. The usual cause on a TV box is a wrong clock.
                handler.cancel()
                failMainFrame("Secure connection failed.\nCheck this box's date and time.")
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // Renderer crashed or was reclaimed: rebuild the whole activity.
                recreate()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.d(TAG, "${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                return true
            }
        }

        notice = TextView(this).apply {
            setBackgroundColor(Color.BLACK)
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            val pad = (48 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
            visibility = View.GONE
        }

        val match = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        root.addView(webView, match)
        root.addView(notice, match)
        setContentView(root)

        Log.i(TAG, "WebView ${webViewVersion()} on Android ${Build.VERSION.RELEASE} (${Build.MODEL})")
        if (savedInstanceState == null) loadPlayer() else webView.restoreState(savedInstanceState)
    }

    private fun loadPlayer() {
        handler.removeCallbacks(retry)
        webView.loadUrl(playerUrl)
    }

    /** Main-frame failure: show why, retry with backoff (5 s → 60 s); a network appearing retries at once. */
    private fun failMainFrame(message: String) {
        mainFrameFailed = true
        showNotice("$message\n\nRetrying in ${retryDelayMs / 1000}s…\n\nMSIGN ${BuildConfig.VERSION_NAME} · WebView ${webViewVersion()}")
        handler.removeCallbacks(retry)
        handler.postDelayed(retry, retryDelayMs)
        retryDelayMs = (retryDelayMs * 2).coerceAtMost(RETRY_MAX_MS)
    }

    private fun showNotice(text: String) = runOnUiThread {
        notice.text = text
        notice.visibility = View.VISIBLE
    }

    private fun hideNotice() = runOnUiThread { notice.visibility = View.GONE }

    private fun webViewVersion(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pkg = WebView.getCurrentWebViewPackage()
            if (pkg != null) return pkg.versionName ?: "?"
        }
        return "?"
    }

    override fun onStart() {
        super.onStart()
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                // Wi-Fi came up after boot (or came back): don't wait out the backoff.
                if (mainFrameFailed) runOnUiThread { loadPlayer() }
            }
        }
        networkCallback = callback
        runCatching { cm.registerDefaultNetworkCallback(callback) }
    }

    override fun onStop() {
        networkCallback?.let { cb ->
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            runCatching { cm?.unregisterNetworkCallback(cb) }
        }
        networkCallback = null
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(android.view.WindowInsets.Type.systemBars())
                it.systemBarsBehavior =
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
        }
    }

    @Suppress("DEPRECATION", "MissingSuperCall")
    override fun onBackPressed() {
        // Kiosk: back never exits signage. Leave via the home button.
    }

    override fun onDestroy() {
        handler.removeCallbacks(retry)
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val TAG = "MSIGN"
        const val RETRY_MIN_MS = 5_000L
        const val RETRY_MAX_MS = 60_000L
    }
}
