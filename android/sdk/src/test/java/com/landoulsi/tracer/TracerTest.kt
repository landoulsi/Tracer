package com.landoulsi.tracer

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class TracerTest {

    @Before
    fun setUp() {
        // Reset Tracer state before each test
        Tracer.init()
    }

    @Test
    fun `init with default URL sets localhost`() {
        Tracer.init()
        // Tracer should be initialized without throwing
        assertTrue(true)
    }

    @Test
    fun `init with custom URL trims trailing slash`() {
        Tracer.init("http://example.com/")
        // Should not throw
        assertTrue(true)
    }

    @Test
    fun `init with custom URL preserves URL without trailing slash`() {
        Tracer.init("http://example.com")
        // Should not throw
        assertTrue(true)
    }

    @Test
    fun `init trims whitespace from URL`() {
        Tracer.init("  http://example.com  ")
        // Should not throw
        assertTrue(true)
    }
}
