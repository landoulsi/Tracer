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
        val name = classData.className
        return !name.startsWith("android.") &&
                !name.startsWith("androidx.") &&
                !name.startsWith("kotlin.") &&
                !name.startsWith("com.google.") &&
                !name.contains(".R$") &&
                !name.endsWith(".R") &&
                name != "BuildConfig"
    }
}
