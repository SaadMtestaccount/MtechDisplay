import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// android/keystore.properties (created by the build setup) holds the release signing secrets.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.mtech.msign"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mtech.msign"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            if (keystoreProps.containsKey("storeFile")) {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Local testing: the Android emulator reaches the dev PC at 10.0.2.2.
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:3000\"")
        }
        release {
            // Production MSIGN deployment. Rebuild after changing.
            buildConfigField("String", "BASE_URL", "\"https://msign-iota.vercel.app\"")
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
