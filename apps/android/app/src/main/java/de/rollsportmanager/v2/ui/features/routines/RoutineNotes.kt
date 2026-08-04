package de.rollsportmanager.v2.ui.features.routines

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSecondaryButton
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Trainingsnotizen zur Kür — rein lokal (SharedPreferences), keine API.
 * Speichern nur bei Änderung; Zeitstempel des letzten Stands darunter.
 * Sekundär-Button: die Beere des Screens gehört dem Play im Player.
 * Spiegel von RoutineNotesView.swift (dort UserDefaults).
 */
@Composable
internal fun RoutineNotesCard(routineId: String) {
    val colors = RsmTheme.colors
    val context = LocalContext.current
    val prefs = remember {
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    var text by remember(routineId) {
        mutableStateOf(prefs.getString(textKey(routineId), "") ?: "")
    }
    var savedText by remember(routineId) { mutableStateOf(text) }
    var savedAt by remember(routineId) {
        mutableStateOf(prefs.getLong(savedAtKey(routineId), 0L).takeIf { it > 0L })
    }
    val isDirty = text != savedText

    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.routines_notes_eyebrow),
                title = stringResource(R.string.routines_notes_title),
            )

            // Editor in Mulden-Optik, Platzhalter solange leer.
            val editorA11y = stringResource(R.string.routines_notes_a11y_editor)
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                textStyle = RsmTypography.body.copy(color = colors.inkPrimary),
                cursorBrush = SolidColor(colors.brand),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(RsmRadius.m))
                    .background(colors.bgSunken)
                    .padding(RsmSpacing.s3)
                    .heightIn(min = 110.dp)
                    .semantics { contentDescription = editorA11y },
                decorationBox = { innerTextField ->
                    Box {
                        if (text.isEmpty()) {
                            Text(
                                text = stringResource(R.string.routines_notes_placeholder),
                                style = RsmTypography.body,
                                color = colors.inkFaint,
                            )
                        }
                        innerTextField()
                    }
                },
            )

            Text(
                text = stringResource(R.string.routines_notes_hint),
                style = RsmTypography.caption,
                color = colors.inkFaint,
            )

            Box(modifier = Modifier.alpha(if (isDirty) 1f else 0.5f)) {
                RsmSecondaryButton(
                    text = stringResource(R.string.routines_notes_save),
                    fillWidth = false,
                    onClick = {
                        if (!isDirty) return@RsmSecondaryButton
                        val now = System.currentTimeMillis()
                        prefs.edit()
                            .putString(textKey(routineId), text)
                            .putLong(savedAtKey(routineId), now)
                            .apply()
                        savedText = text
                        savedAt = now
                    },
                )
            }

            savedAt?.let { timestamp ->
                Text(
                    text = stringResource(
                        R.string.routines_notes_saved,
                        RoutineFormat.savedAt(timestamp),
                    ),
                    style = RsmTypography.caption,
                    color = colors.inkFaint,
                )
            }
        }
    }
}

private const val PREFS_NAME = "rsm.routines.notes"
private fun textKey(routineId: String) = "note.$routineId"
private fun savedAtKey(routineId: String) = "savedAt.$routineId"
