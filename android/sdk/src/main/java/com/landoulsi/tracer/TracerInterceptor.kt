package com.landoulsi.tracer

import okhttp3.Interceptor
import okhttp3.Response
import okio.Buffer
import okio.GzipSource
import java.nio.charset.Charset
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class TracerInterceptor : Interceptor {

    private val dateFormat = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        // 1. Guard: Prevent infinite loops by ignoring our own reporting traffic
        if (request.header("X-Tracer-Internal") != null) {
            return chain.proceed(request)
        }

        android.util.Log.d("Tracer", "Intercepting request: ${request.url}")
        val startNs = System.nanoTime()

        val requestBodyString = try {
            val copy = request.newBuilder().build()
            val buffer = Buffer()
            copy.body?.writeTo(buffer)
            // Limit request logging too (optional but good practice)
            val byteCount = buffer.size.coerceAtMost(65536)
            buffer.readString(byteCount, Charset.forName("UTF-8"))
        } catch (e: Exception) {
            ""
        }

        val requestHeaders = request.headers.toMap()

        val response: Response
        try {
            // Force Gzip to ensure we can decode the response (we don't support Brotli yet)
            val newRequest = request.newBuilder()
                .header("Accept-Encoding", "gzip")
                .build()
            response = chain.proceed(newRequest)
        } catch (e: Exception) {
            throw e
        }

        val tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs)

        val responseBodyString = try {
            val source = response.body?.source()
            // 2. Guard: Prevent OOM but allow larger responses (Limit: 2MB)
            // If the response is larger than 2MB, we only read the first 2MB.
            source?.request(2097152) 
            val buffer = source?.buffer?.clone()

            if (buffer != null) {
                if ("gzip".equals(response.header("Content-Encoding"), ignoreCase = true)) {
                    val gzipSource = GzipSource(buffer)
                    val decompressed = Buffer()
                    gzipSource.read(decompressed, Long.MAX_VALUE)
                    gzipSource.close()
                    decompressed.readString(Charset.forName("UTF-8"))
                } else {
                    buffer.readString(Charset.forName("UTF-8"))
                }
            } else {
                ""
            }
        } catch (e: OutOfMemoryError) {
            "(Response too large to display - OOM avoided)"
        } catch (e: Exception) {
            "(Body omitted: ${e.message})"
        }

        val responseHeaders = response.headers.toMap()

        val transaction = ApiTransaction(
            id = System.currentTimeMillis() + (Math.random() * 1000).toLong(),
            timestamp = dateFormat.format(Date()),
            method = request.method,
            url = request.url.toString(),
            requestHeaders = requestHeaders,
            requestBody = requestBodyString,
            responseStatus = response.code,
            responseTime = "${tookMs}ms",
            responseHeaders = responseHeaders,
            responseBody = responseBodyString
        )

        Tracer.report(transaction)

        return response
    }
}
