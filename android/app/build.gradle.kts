plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.nploetz.seraph"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.nploetz.seraph"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        // Where crash reports go (owner/repo); same default as the web build's SERAPH_REPO.
        buildConfigField("String", "REPORT_REPO", "\"${project.findProperty("seraphRepo") ?: "Anti049/seraph"}\"")
    }

    buildFeatures { buildConfig = true }

    // Sideload builds: release is signed with the debug key unless you pass your own keystore:
    //   ./gradlew assembleRelease -Pkeystore=/path/ks.jks -PkeystorePassword=… -PkeyAlias=… -PkeyPassword=…
    val keystorePath = project.findProperty("keystore") as String?
    signingConfigs {
        if (keystorePath != null) {
            create("sideload") {
                storeFile = file(keystorePath)
                storePassword = project.findProperty("keystorePassword") as String?
                keyAlias = project.findProperty("keyAlias") as String?
                keyPassword = project.findProperty("keyPassword") as String?
            }
        }
    }

    buildTypes {
        release {
            // No shrinking: the app has no dependencies, and keeping names intact makes crash reports readable.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName(if (keystorePath != null) "sideload" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

// Bundle the TV web app (web/build) into the APK as assets/app/.
// Build it first:  (cd ../web && bun install && bun run build)
val webDist = rootProject.file("../web/build")
val copyWebApp by tasks.registering(Sync::class) {
    doFirst {
        if (!webDist.resolve("index.html").exists()) {
            throw GradleException("web/build is missing — run `bun run build` in ../web first")
        }
    }
    from(webDist)
    into(layout.buildDirectory.dir("generated/webapp/app"))
}
android.sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webapp"))
tasks.named("preBuild") { dependsOn(copyWebApp) }
