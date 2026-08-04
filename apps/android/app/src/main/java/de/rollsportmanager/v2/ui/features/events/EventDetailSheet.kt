package de.rollsportmanager.v2.ui.features.events

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.RsvpStatus
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import de.rollsportmanager.v2.ui.theme.TABULAR_NUMS
import java.util.Locale

/**
 * Detail-BottomSheet eines Termins: Meta-Karte, eigene Rückmeldung
 * (optimistisch, Kommentar bei Absage) und Teilnehmerliste mit
 * Trainer-Anwesenheit. (Spiegel von iOS EventDetailSheet.swift.)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun EventDetailSheet(
    event: Event,
    api: ApiClient,
    clubId: String,
    myMemberId: String,
    clubRole: ClubRole?,
    teamsById: Map<String, Team>,
    membersById: Map<String, ClubMember>,
    onEventUpdated: (Event) -> Unit,
    onDismiss: () -> Unit,
) {
    val model: EventDetailViewModel = viewModel(
        key = "event_detail_${event.id}",
        factory = EventDetailViewModel.factory(
            event = event,
            api = api,
            clubId = clubId,
            myMemberId = myMemberId,
            clubRole = clubRole,
            teamsById = teamsById,
            membersById = membersById,
            onEventUpdated = onEventUpdated,
        ),
    )
    LaunchedEffect(event) { model.syncFromList(event) }
    LaunchedEffect(Unit) { model.loadAttendanceIfNeeded() }

    val colors = RsmTheme.colors
    val snackbarHostState = remember { SnackbarHostState() }
    val errorMessage by model.errorMessage.collectAsStateWithLifecycle()
    LaunchedEffect(errorMessage) {
        val message = errorMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        model.consumeError()
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.bgCanvas,
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = RsmSpacing.s5, end = RsmSpacing.s5, bottom = RsmSpacing.s7),
                verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
            ) {
                SheetHeader(onDismiss = onDismiss)
                EventMetaCard(model)
                EventRsvpCard(model)
                EventParticipantsCard(model)
            }
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

// --- Kopfzeile ------------------------------------------------------------------

@Composable
private fun SheetHeader(onDismiss: () -> Unit) {
    val colors = RsmTheme.colors
    val a11yClose = stringResource(R.string.events_detail_a11y_close)
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.events_detail_title),
            style = RsmTypography.h3,
            color = colors.inkPrimary,
            modifier = Modifier.weight(1f),
        )
        TextButton(
            onClick = onDismiss,
            modifier = Modifier.semantics { contentDescription = a11yClose },
        ) {
            Text(
                text = stringResource(R.string.events_detail_close),
                style = RsmTypography.bodyStrong,
                color = colors.brandInk,
            )
        }
    }
}

// --- Meta -------------------------------------------------------------------------

@Composable
private fun EventMetaCard(model: EventDetailViewModel) {
    val event by model.event.collectAsStateWithLifecycle()
    val colors = RsmTheme.colors
    val locale = Locale.getDefault()
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            Row {
                RsmStatusPill(
                    text = stringResource(EventsDisplay.typeLabelRes(event.type)),
                    kind = EventsDisplay.typePillKind(event.type),
                )
            }
            Text(text = event.title, style = RsmTypography.h2, color = colors.inkPrimary)

            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
                EventsDisplay.fullDate(event.startsAt, locale)?.let { date ->
                    MetaLine(icon = Icons.Filled.CalendarMonth, text = date)
                }
                MetaLine(
                    icon = Icons.Filled.Schedule,
                    text = "${EventsDisplay.time(event.startsAt, locale)} – " +
                        EventsDisplay.time(event.endsAt, locale),
                )
                val location = event.location
                if (!location.isNullOrEmpty()) {
                    MetaLine(icon = Icons.Filled.Place, text = location)
                }
            }

            val teams = event.teamIds.mapNotNull { model.teamsById[it] }
            if (teams.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                    teams.forEach { team ->
                        RsmStatusPill(text = team.name)
                    }
                }
            }

            val note = event.note
            if (!note.isNullOrEmpty()) {
                NoteBubble(note)
            }
        }
    }
}

@Composable
private fun MetaLine(icon: ImageVector, text: String) {
    val colors = RsmTheme.colors
    Row(
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = colors.inkFaint,
            modifier = Modifier.size(RsmSpacing.s4),
        )
        Text(
            text = text,
            style = RsmTypography.body.copy(fontFeatureSettings = TABULAR_NUMS),
            color = colors.inkSoft,
        )
    }
}

/** Hinweis als Mulden-Blase (bg.sunken, Radius M) — wie das iOS-noteBubble. */
@Composable
private fun NoteBubble(note: String) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(RsmRadius.m))
            .background(colors.bgSunken)
            .padding(RsmSpacing.s3),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
    ) {
        Text(
            text = stringResource(R.string.events_detail_note_title),
            style = RsmTypography.caption.copy(fontWeight = FontWeight.SemiBold),
            color = colors.inkFaint,
        )
        Text(text = note, style = RsmTypography.body, color = colors.inkSoft)
    }
}
