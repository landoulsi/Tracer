package com.landoulsi.tracer

import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import android.util.Log

object Tracer {
    private const val TAG = "Tracer"
    private var serverUrl: String = "http://localhost:3000"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val client = OkHttpClient()
    private val gson = Gson()

    fun init(url: String = "http://localhost:3000") {
        Log.d(TAG, "Initialized with url: $url")
        serverUrl = url.trim().removeSuffix("/")
    }

    fun report(payload: ApiTransaction) {
        Log.d(TAG, "Reporting transaction: ${payload.method} ${payload.url}")
        scope.launch {
            try {
                val json = gson.toJson(payload)
                val body = json.toRequestBody("application/json".toMediaTypeOrNull())
                val request = Request.Builder()
                    .url("$serverUrl/api/report")
                    .header("X-Tracer-Internal", "true")
                    .post(body)
                    .build()

                Log.d(TAG, "Sending report to $serverUrl/api/report")
                client.newCall(request).execute().close()
                Log.d(TAG, "Report successful")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to report transaction", e)
            }
        }
    }
}

data class ApiTransaction(
    val id: Long,
    val timestamp: String,
    val method: String,
    val url: String,
    val requestHeaders: Map<String, String>,
    val requestBody: String,
    val responseStatus: Int,
    val responseTime: String,
    val responseHeaders: Map<String, String>,
    val responseBody: String
)
