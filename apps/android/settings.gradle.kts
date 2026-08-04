// RollsportManager v2 — Android (Jetpack Compose, ein Modul :app).
// Blueprint ADR-E1: Native+ mit Shared Contract; generierte Kotlin-Contracts
// werden als zusätzliches Source-Dir des :app-Moduls eingebunden (keine Kopie).
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "RollsportManagerV2"
include(":app")
