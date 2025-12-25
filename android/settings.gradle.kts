pluginManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://artifactory-pro.careem-internal.com/artifactory/mobile-libs-release") {
           credentials {
               username = providers.gradleProperty("careem_artifactory_username").orNull ?: System.getenv("careem_artifactory_username")
               password = providers.gradleProperty("careem_artifactory_api_key").orNull ?: System.getenv("careem_artifactory_api_key")
           }
        }
        gradlePluginPortal()
    }
}

include(":sdk")
include(":sample")
include(":gradle-plugin")
rootProject.name = "TracerAndroid"
