package com.landoulsi.tracer.plugin

import com.android.build.api.instrumentation.FramesComputationMode
import com.android.build.api.instrumentation.InstrumentationScope
import com.android.build.api.variant.AndroidComponentsExtension
import com.android.build.api.variant.ApplicationVariant
import org.gradle.api.Plugin
import org.gradle.api.Project

class TracerPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.logger.lifecycle("TracerPlugin: Applied to project ${project.name}")
        
        val androidComponents = project.extensions.getByType(AndroidComponentsExtension::class.java)

        androidComponents.onVariants { variant ->
            project.logger.lifecycle("TracerPlugin: Saw variant '${variant.name}' of type ${variant::class.java.simpleName}")
            // Only instrument Application variants
            if (variant is ApplicationVariant) {
                project.logger.lifecycle("TracerPlugin: Configuring ApplicationVariant ${variant.name}")
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
