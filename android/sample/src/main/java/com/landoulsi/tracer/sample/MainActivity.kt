package com.landoulsi.tracer.sample

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.landoulsi.tracer.Tracer
import com.landoulsi.tracer.TracerInterceptor
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var client: OkHttpClient
    private lateinit var tvLog: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val etUrl = findViewById<EditText>(R.id.etUrl)
        val btnSave = findViewById<Button>(R.id.btnSave)
        val btnGet = findViewById<Button>(R.id.btnGet)
        val btnPost = findViewById<Button>(R.id.btnPost)
        val btnError = findViewById<Button>(R.id.btnError)
        tvLog = findViewById(R.id.tvLog)

        // Initialize Tracer with default
        Tracer.init(etUrl.text.toString())
        setupClient()

        btnSave.setOnClickListener {
            Tracer.init(etUrl.text.toString())
            Toast.makeText(this, "Tracer updated", Toast.LENGTH_SHORT).show()
        }

        btnGet.setOnClickListener {
            executeRequest(
                Request.Builder()
                    .url("https://jsonplaceholder.typicode.com/todos/1")
                    .get()
                    .build()
            )
        }

        btnPost.setOnClickListener {
            val json = """{"title":"foo","body":"bar","userId":1}"""
            val body = json.toRequestBody("application/json; charset=utf-8".toMediaType())
            executeRequest(
                Request.Builder()
                    .url("https://jsonplaceholder.typicode.com/posts")
                    .post(body)
                    .build()
            )
        }

        btnError.setOnClickListener {
            executeRequest(
                Request.Builder()
                    .url("https://jsonplaceholder.typicode.com/posts/invalid-endpoint-404")
                    .get()
                    .build()
            )
        }
    }

    private fun setupClient() {
        client = OkHttpClient.Builder()
            .addInterceptor(TracerInterceptor())
            // Add other interceptors if needed
            .build()
    }

    private fun executeRequest(request: Request) {
        val start = System.currentTimeMillis()
        log("Sending ${request.method} to ${request.url}")
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    log("Failed: ${e.message}")
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val took = System.currentTimeMillis() - start
                val body = response.body?.string() ?: ""
                runOnUiThread {
                    log("Success: ${response.code} (${took}ms)")
                }
            }
        })
    }

    private fun log(msg: String) {
        val current = tvLog.text.toString()
        tvLog.text = "$msg\n\n$current"
    }
}
