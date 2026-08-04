// ============================================================
// GENERIERT aus design/tokens.json — NICHT von Hand editieren.
// Neu bauen:  npm run gen:kotlin-theme   (in packages/tokens)
// Design-System „Heimspiel“ · 1.0.0 · Stand 2026-07-18
// ============================================================
@file:Suppress("MagicNumber", "unused")

package de.rollsportmanager.v2.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Alle Farb-Tokens einer Erscheinung (Light „Vormittag in der Halle“ /
 * Dark „Vereinsheim am Abend“). Zwei statische Instanzen, Material You AUS.
 */
@Immutable
class RsmColors(
    /** App-Hintergrund — warmes Papier */
    val bgCanvas: Color,
    /** Karten, Topbar, Sidebar; Pflicht-Fläche in der Seriositätszone (Finanzen) */
    val bgSurface: Color,
    /** Mulden: Suchfeld, Segmente, Zitat-Blasen */
    val bgSunken: Color,
    /** Text, Espresso statt Schwarz — ~13:1 auf Surface */
    val inkPrimary: Color,
    /** Sekundärtext — ~6,6:1 */
    val inkSoft: Color,
    /** Tertiär/Captions — ~4,8:1, nie unter 12,5 px einsetzen */
    val inkFaint: Color,
    val line: Color,
    val lineStrong: Color,
    /** Beere — genau eine Primäraktion pro Sichtbereich */
    val brand: Color,
    /** Hover/Pressed */
    val brandStrong: Color,
    val brandSoft: Color,
    /** Text auf brand.soft */
    val brandInk: Color,
    /** Text auf brand — ~5,8:1 */
    val brandContrast: Color,
    /** EXKLUSIV Musik/Küren: Waveform (gespielt), Loop, Zeitmarken, Kür-Chips. Nie im Mahnwesen. */
    val honey: Color,
    /** Honig als Text/Icon — ~5,7:1 */
    val honeyDeep: Color,
    val honeySoft: Color,
    /** NEU (Jury-Fix): Stufe „Erinnerung“ im Mahnwesen + neutrale Hinweise — ersetzt den Honig-Regelbruch */
    val info: Color,
    val infoSoft: Color,
    /** Zusagen, bezahlt, im Limit — ~4,9:1 */
    val success: Color,
    val successSoft: Color,
    /** Fristen, 1. Mahnung */
    val warn: Color,
    val warnSoft: Color,
    /** Absagen, überfällig, 2. Mahnung — ~5,5:1 */
    val danger: Color,
    val dangerSoft: Color,
    val avatarBerry: Color,
    val avatarCoral: Color,
    /** Initialen hier in ink.onAvatarDark (Jury-Fix: Weiß unterschritt AA) */
    val avatarHoney: Color,
    /** Initialen hier in ink.onAvatarDark (Jury-Fix) */
    val avatarMoss: Color,
    val avatarPlum: Color,
    val avatarPetrol: Color,
    /** Initialen auf berry/coral/plum/petrol */
    val avatarOnDefault: Color,
    /** Initialen auf honey/moss (Light) und auf ALLEN Tönen im Dark Mode */
    val avatarOnAvatarDark: Color,
    /** ungespielter Teil der Waveform */
    val waveOff: Color,
    /** 3-px-Fokusring, Offset 2 px */
    val focus: Color,
)

val RsmColorsLight = RsmColors(
    bgCanvas = Color(0xFFFBF4EC),
    bgSurface = Color(0xFFFFFFFF),
    bgSunken = Color(0xFFF4E9DD),
    inkPrimary = Color(0xFF35251C),
    inkSoft = Color(0xFF6B5648),
    inkFaint = Color(0xFF8A7365),
    line = Color(0xFFEBDCCE),
    lineStrong = Color(0xFFDCC9B8),
    brand = Color(0xFFB23A5C),
    brandStrong = Color(0xFF9C2F4E),
    brandSoft = Color(0xFFF7E3E9),
    brandInk = Color(0xFF8E2946),
    brandContrast = Color(0xFFFFFFFF),
    honey = Color(0xFFE8A94A),
    honeyDeep = Color(0xFF97570E),
    honeySoft = Color(0xFFF9EDD8),
    info = Color(0xFF2F6B72),
    infoSoft = Color(0xFFE2EFEF),
    success = Color(0xFF3F7D4E),
    successSoft = Color(0xFFE4F0E3),
    warn = Color(0xFF97570E),
    warnSoft = Color(0xFFF9EDD8),
    danger = Color(0xFFBC3D30),
    dangerSoft = Color(0xFFF9E4E0),
    avatarBerry = Color(0xFFB23A5C),
    avatarCoral = Color(0xFFC25B3F),
    avatarHoney = Color(0xFFB4741C),
    avatarMoss = Color(0xFF4C8555),
    avatarPlum = Color(0xFF8A4E9C),
    avatarPetrol = Color(0xFF3E7D83),
    avatarOnDefault = Color(0xFFFFFFFF),
    avatarOnAvatarDark = Color(0xEB1A0D08),
    waveOff = Color(0xFFE9D6C2),
    focus = Color(0xFFB23A5C),
)

val RsmColorsDark = RsmColors(
    bgCanvas = Color(0xFF241A14),
    bgSurface = Color(0xFF2C211A),
    bgSunken = Color(0xFF1C130E),
    inkPrimary = Color(0xFFF5EAE0),
    inkSoft = Color(0xFFC9B3A4),
    inkFaint = Color(0xFFA18C7D),
    line = Color(0xFF3E3129),
    lineStrong = Color(0xFF4E3E33),
    brand = Color(0xFFE0698A),
    brandStrong = Color(0xFFEB7F9D),
    brandSoft = Color(0xFF46232E),
    brandInk = Color(0xFFF2A9BD),
    brandContrast = Color(0xFF2B0E17),
    honey = Color(0xFFE8A94A),
    honeyDeep = Color(0xFFEFB55E),
    honeySoft = Color(0xFF3D2C15),
    info = Color(0xFF7FBFC6),
    infoSoft = Color(0xFF1E3538),
    success = Color(0xFF85C492),
    successSoft = Color(0xFF24382A),
    warn = Color(0xFFEFB55E),
    warnSoft = Color(0xFF3D2C15),
    danger = Color(0xFFE88374),
    dangerSoft = Color(0xFF43211B),
    avatarBerry = Color(0xFFC1516F),
    avatarCoral = Color(0xFFC96A4E),
    avatarHoney = Color(0xFFBB8028),
    avatarMoss = Color(0xFF5C9465),
    avatarPlum = Color(0xFF9A61AC),
    avatarPetrol = Color(0xFF4E8D93),
    avatarOnDefault = Color(0xEB1A0D08),
    avatarOnAvatarDark = Color(0xEB1A0D08),
    waveOff = Color(0xFF4A382C),
    focus = Color(0xFFE0698A),
)

/** Spacing (4-dp-Basis, dp = px 1:1). */
object RsmSpacing {
    val s1 = 4.dp
    val s2 = 8.dp
    val s3 = 12.dp
    val s4 = 16.dp
    val s5 = 20.dp
    val s6 = 24.dp
    val s7 = 32.dp
    val s8 = 40.dp
    val s9 = 48.dp
    val s10 = 64.dp
    val cardGap = 22.dp
}

/** Radius. */
object RsmRadius {
    val s = 8.dp // Checkboxen, kbd, kleine Tags
    val m = 12.dp // Inputs, Nav-Items, Zitat-Blasen
    val l = 16.dp // Kacheln, KPI-Karten, Banner
    val xl = 20.dp // Karten (Standard)
    val full = 999.dp // Buttons, Chips, Suchfeld, Segmente, Personen-Avatare
    val org = 9.dp // Icon-Kacheln für Organisationen/Sammelbuchungen (KEINE Pseudo-Monogramme, Jury-Fix)
}

/** Größen. */
object RsmSize {
    val touchTarget = 44.dp // Minimum, auch am Desktop
    val listRow = 56.dp // Minimum Listenzeilen
    val playButton = 68.dp // großes Play im Kür-Player
}

/** OpenType-Feature für Tabellenziffern — Pflicht für Beträge/Quoten/Zeiten. */
const val TABULAR_NUMS = "tnum"

/**
 * Typografie „Heimspiel“:
 *  - Display/h2/h3 = Default-FontFamily (Roboto) extrabold — nur Begrüßung,
 *    Karten-/Kür-Titel, große Kennzahlen; nie Fließtext.
 *  - body/bodyStrong/caption/eyebrow = Default-FontFamily.
 *  - monoTable = FontFamily.Monospace — ALLE Geldbeträge, Rechnungsnummern,
 *    Kürzeiten (Seriositätszone), tabular-nums eingebaut.
 */
object RsmTypography {
    /** 27/32 · Gewicht 800 */
    val display = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 27.sp,
        lineHeight = 32.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = -0.02.em,
    )
    /** 20/26 · Gewicht 800 */
    val h2 = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        fontWeight = FontWeight.ExtraBold,
    )
    /** 17/23 · Gewicht 800 */
    val h3 = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 17.sp,
        lineHeight = 23.sp,
        fontWeight = FontWeight.ExtraBold,
    )
    /** 17/23 · Gewicht 800 — Zeilentitel in Listen (Mitglieder, Küren, Termine) — optisch wie h3, eigene Rolle für spätere Feinsteuerung */
    val listTitle = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 17.sp,
        lineHeight = 23.sp,
        fontWeight = FontWeight.ExtraBold,
    )
    /** 14.5/21 · Gewicht 700 */
    val bodyStrong = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 14.5.sp,
        lineHeight = 21.sp,
        fontWeight = FontWeight.Bold,
    )
    /** 14.5/22 · Gewicht 400 */
    val body = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 14.5.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.Normal,
    )
    /** 12.5/17 · Gewicht 400 */
    val caption = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 12.5.sp,
        lineHeight = 17.sp,
        fontWeight = FontWeight.Normal,
    )
    /** 11/14 · Gewicht 800 · VERSALIEN (im Composable per uppercase()) */
    val eyebrow = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 0.09.em,
    )
    /** 13/18 · Gewicht 600 — Beträge/Rechnungsnummern in Tabellen (JetBrains Mono, tabular) */
    val monoTable = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        fontWeight = FontWeight.SemiBold,
        fontFeatureSettings = TABULAR_NUMS,
    )
    /** 12/16 · Gewicht 500 — Kleine Mono-Angaben: Zeitmarken, Kürzeiten im Chip, Codes, Restlaufzeiten */
    val monoCaption = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.Medium,
    )
    /** 22/28 · Gewicht 700 — Große Mono-Zahl: Rechnungssumme im Detail, Medaillenspiegel, Score-Pad */
    val monoHero = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        fontWeight = FontWeight.Bold,
    )
}

/** Motion-Tokens (ms). prefers-reduced-motion respektieren! */
object RsmMotion {
    const val fastMs = 150
    const val standardMs = 250
    /** Button-Druck: scale(0.98) */
    const val pressScale = 0.98f
}

/**
 * Material3-Mapping: primary=brand, background/surface aus den bg-Tokens,
 * error=danger. surfaceTint transparent → keine M3-Elevation-Tönung
 * (der Heimspiel-Look nutzt Hairlines + warme Schatten statt Tonal-Tint).
 */
private fun rsmColorScheme(c: RsmColors, dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = c.brand,
        onPrimary = c.brandContrast,
        primaryContainer = c.brandSoft,
        onPrimaryContainer = c.brandInk,
        secondary = c.info,
        onSecondary = if (dark) c.bgSunken else c.bgSurface,
        secondaryContainer = c.infoSoft,
        onSecondaryContainer = c.info,
        tertiary = c.honeyDeep,
        onTertiary = if (dark) c.bgSunken else c.bgSurface,
        tertiaryContainer = c.honeySoft,
        onTertiaryContainer = c.honeyDeep,
        background = c.bgCanvas,
        onBackground = c.inkPrimary,
        surface = c.bgSurface,
        onSurface = c.inkPrimary,
        surfaceVariant = c.bgSunken,
        onSurfaceVariant = c.inkSoft,
        surfaceContainerLowest = c.bgSurface,
        surfaceContainerLow = c.bgSurface,
        surfaceContainer = c.bgSurface,
        surfaceContainerHigh = c.bgSurface,
        surfaceContainerHighest = c.bgSunken,
        surfaceTint = Color.Transparent,
        error = c.danger,
        onError = if (dark) c.bgSunken else c.bgSurface,
        errorContainer = c.dangerSoft,
        onErrorContainer = c.danger,
        outline = c.lineStrong,
        outlineVariant = c.line,
    )
}

/** Material-Rollen aus den Heimspiel-TextStyles (für M3-Komponenten-Defaults). */
private val rsmMaterialTypography = Typography(
    headlineMedium = RsmTypography.display,
    titleLarge = RsmTypography.h2,
    titleMedium = RsmTypography.h3,
    bodyLarge = RsmTypography.body,
    bodyMedium = RsmTypography.body,
    bodySmall = RsmTypography.caption,
    labelLarge = RsmTypography.bodyStrong,
    labelMedium = RsmTypography.caption,
    labelSmall = RsmTypography.eyebrow,
)

val LocalRsmColors = staticCompositionLocalOf { RsmColorsLight }

/**
 * Heimspiel-Theme: stellt MaterialTheme (M3-Mapping) UND die rohen Tokens
 * (RsmTheme.colors) bereit. Dark Mode folgt dem System.
 */
@Composable
fun RsmTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) RsmColorsDark else RsmColorsLight
    CompositionLocalProvider(LocalRsmColors provides colors) {
        MaterialTheme(
            colorScheme = rsmColorScheme(colors, darkTheme),
            typography = rsmMaterialTypography,
            content = content,
        )
    }
}

/** Token-Zugriff im Composable-Baum: `RsmTheme.colors.bgCanvas`. */
object RsmTheme {
    val colors: RsmColors
        @Composable @ReadOnlyComposable get() = LocalRsmColors.current
}
