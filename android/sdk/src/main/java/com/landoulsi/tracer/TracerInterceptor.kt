package com.landoulsi.tracer

import okhttp3.Interceptor
import okhttp3.Response
import okio.Buffer
import java.nio.charset.Charset
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class TracerInterceptor : Interceptor {

    private val dateFormat = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val startNs = System.nanoTime()

        val requestBodyString = try {
            val copy = request.newBuilder().build()
            val buffer = Buffer()
            copy.body?.writeTo(buffer)
            buffer.readString(Charset.forName("UTF-8"))
        } catch (e: Exception) {
            ""
        }

        val requestHeaders = request.headers.toMap()

        val response: Response
        try {
            response = chain.proceed(request)
        } catch (e: Exception) {
            // Report failed request? For now just rethrow
            throw e
        }

        val tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs)

        val responseBodyString = try {
            val source = response.body?.source()
            source?.request(Long.MAX_VALUE) // Buffer the entire body.
            val buffer = source?.buffer
            buffer?.clone()?.readString(Charset.forName("UTF-8")) ?: ""
        } catch (e: Exception) {
            ""
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
