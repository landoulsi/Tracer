package com.landoulsi.tracer.plugin

import com.android.build.api.instrumentation.FramesComputationMode
import com.android.build.api.instrumentation.InstrumentationScope
import com.android.build.api.variant.AndroidComponentsExtension
import com.android.build.api.variant.ApplicationVariant
import org.gradle.api.Plugin
import org.gradle.api.Project

class TracerPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val androidComponents = project.extensions.getByType(AndroidComponentsExtension::class.java)

        androidComponents.onVariants { variant ->
            // Only instrument debug builds and only Application variants (to support Scope.ALL)
            if (variant is ApplicationVariant && variant.buildType == "debug") {
                variant.instrumentation.transformClassesWith(
                    TracerClassVisitorFactory::class.java,
                    InstrumentationScope.ALL
                ) {
                    // Configuration if needed
                }
                variant.instrumentation.setAsmFramesComputationMode(
                    FramesComputationMode.COPY_FRAMES
                )
            }
        }
    }
}
