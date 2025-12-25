package com.landoulsi.tracer

import okhttp3.Interceptor
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.*

class TracerInterceptorTest {

    private lateinit var interceptor: TracerInterceptor

    @Before
    fun setUp() {
        Tracer.init("http://localhost:3000")
        interceptor = TracerInterceptor()
    }

    @Test
    fun `interceptor is created successfully`() {
        assertNotNull(interceptor)
    }

    @Test
    fun `interceptor implements OkHttp Interceptor interface`() {
        assertTrue(interceptor is Interceptor)
    }
}
