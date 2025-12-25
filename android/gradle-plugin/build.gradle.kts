plugins {
    `kotlin-dsl`
}

group = "com.landoulsi.tracer"
version = "1.0.0"

repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
}

dependencies {
    implementation(gradleApi())
    compileOnly("com.android.tools.build:gradle:8.13.0")
    implementation("org.ow2.asm:asm:9.5")
    implementation("org.ow2.asm:asm-commons:9.5")
}

gradlePlugin {
    plugins {
        create("tracer") {
            id = "com.landoulsi.tracer.plugin"
            implementationClass = "com.landoulsi.tracer.plugin.TracerPlugin"
        }
    }
}
