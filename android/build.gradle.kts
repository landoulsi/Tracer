plugins {
    id("com.android.application") version "8.13.0" apply false
    id("com.android.library") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
    id("org.jetbrains.kotlin.jvm") version "1.9.24" apply false
}

allprojects {
    group = "com.landoulsi.tracer"
    version = "1.0.0"

    repositories {
        google()
        mavenCentral()
    }
}
