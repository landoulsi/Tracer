package com.landoulsi.tracer.plugin

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassContext
import com.android.build.api.instrumentation.ClassData
import com.android.build.api.instrumentation.InstrumentationParameters
import org.objectweb.asm.ClassVisitor

interface TracerParams : InstrumentationParameters {}

abstract class TracerClassVisitorFactory : AsmClassVisitorFactory<TracerParams> {

    override fun createClassVisitor(
        classContext: ClassContext,
        nextClassVisitor: ClassVisitor
    ): ClassVisitor {
        return OkHttpBuilderVisitor(nextClassVisitor)
    }

    override fun isInstrumentable(classData: ClassData): Boolean {
        // We only care about OkHttpClient.Builder
        return classData.className == "okhttp3.OkHttpClient\$Builder"
    }
}
