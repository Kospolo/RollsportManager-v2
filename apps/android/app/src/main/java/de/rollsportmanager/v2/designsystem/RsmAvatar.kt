package de.rollsportmanager.v2.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.rollsportmanager.v2.ui.theme.RsmColors
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Die sechs warmen Avatar-Töne (Signatur des Design-Systems).
 *
 * Der Ton wird deterministisch aus der `personId` gehasht — auf jeder
 * Plattform identisch („Lina ist plum — überall“). Initialen-Farbe:
 * Weiß auf berry/coral/plum/petrol (Light), dunkle Initialen auf honey/moss
 * (Jury-Fix: Weiß unterschritt AA) und im Dark Mode überall (die
 * Token-Farben regeln das dynamisch).
 */
enum class RsmAvatarTone {
    BERRY, CORAL, HONEY, MOSS, PLUM, PETROL;

    fun fill(colors: RsmColors): Color = when (this) {
        BERRY -> colors.avatarBerry
        CORAL -> colors.avatarCoral
        HONEY -> colors.avatarHoney
        MOSS -> colors.avatarMoss
        PLUM -> colors.avatarPlum
        PETROL -> colors.avatarPetrol
    }

    fun initialsColor(colors: RsmColors): Color = when (this) {
        HONEY, MOSS -> colors.avatarOnAvatarDark
        else -> colors.avatarOnDefault
    }

    companion object {
        /**
         * Deterministischer Ton aus einer stabilen ID (z. B. `member_id`).
         * FNV-1a — identisch zu iOS (RSMAvatarView.swift) und Web, damit
         * dieselbe Person überall denselben Ton trägt.
         */
        fun forId(id: String): RsmAvatarTone {
            var hash = 0xcbf29ce484222325UL
            for (byte in id.encodeToByteArray()) {
                hash = hash xor byte.toUByte().toULong()
                hash *= 0x100000001b3UL
            }
            return entries[(hash % 6UL).toInt()]
        }
    }
}

/**
 * Runder Personen-Avatar mit Initialen (Personen = Kreis; Organisationen
 * bekommen stattdessen Icon-Kacheln mit `RsmRadius.org` — kein Monogramm).
 */
@Composable
fun RsmAvatar(
    name: String,
    modifier: Modifier = Modifier,
    /** Stabile ID für den Farbton (z. B. `member_id`); Fallback: Name. */
    personId: String? = null,
    size: Dp = 36.dp,
) {
    val colors = RsmTheme.colors
    val tone = RsmAvatarTone.forId(personId ?: name)
    val initials = name.split(" ")
        .filter { it.isNotBlank() }
        .let { parts ->
            val first = parts.firstOrNull()?.first()?.toString().orEmpty()
            val last = if (parts.size > 1) parts.last().first().toString() else ""
            (first + last).uppercase()
        }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(tone.fill(colors))
            // Der Name steht immer als Text daneben — Avatar ist rein visuell.
            .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials,
            style = RsmTypography.body.copy(
                fontSize = (size.value * 0.38f).sp,
                fontWeight = FontWeight.Bold,
            ),
            color = tone.initialsColor(colors),
        )
    }
}
