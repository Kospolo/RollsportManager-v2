// :app — RollsportManager v2 Android-Shell.
// Schlank per Blueprint: KEIN Hilt, KEIN Room. Netz = OkHttp + kotlinx.serialization.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "de.rollsportmanager.v2"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.rollsportmanager.v2"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    sourceSets {
        getByName("main") {
            // Generierte Contracts (@Serializable data classes) direkt aus dem
            // Monorepo einbinden — NIE kopieren, NIE von Hand ändern.
            // Quelle: packages/contracts/generated/kotlin (Codegen-Output).
            java.srcDirs("../../../packages/contracts/generated/kotlin")
        }
    }

    buildTypes {
        debug {
            // Debug-Build spricht Cleartext-HTTP NUR mit 10.0.2.2 (Host-Loopback
            // des Emulators) — geregelt über src/debug network_security_config.
        }
        release {
            isMinifyEnabled = false
            // Bewusst KEIN Release-Signing hier — Debug-Build ist der Dev-Weg.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
