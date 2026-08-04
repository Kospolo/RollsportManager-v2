package de.rollsportmanager.v2.ui.features.events

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.contracts.Attendance
import de.rollsportmanager.contracts.AttendanceStatus
import de.rollsportmanager.contracts.RsvpStatus
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmResponseBar
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Teilnehmer-Karte im Termin-Detail: Antwort-Balken mit Klartext-Zählung,
 * pro Person Avatar · Name · Status-Pill · Absagegrund-Zitat — und in der
 * Trainer-Sicht ein Anwesenheits-Menü (PUT attendance, optimistisch).
 * (Spiegel von iOS EventParticipantsList.swift.)
 */
@Composable
internal fun EventParticipantsCard(model: EventDetailViewModel) {
    val event by model.event.collectAsStateWithLifecycle()
    val attendanceByMember by model.attendanceByMember.collectAsStateWithLifecycle()
    val colors = RsmTheme.colors

    val counts = remember(event) {
        EventsLogic.counts(event, model.teamsById, model.membersById)
    }
    val participants = remember(event) {
        EventsLogic.participants(event, model.teamsById, model.membersById)
    }

    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.events_participants_eyebrow),
                title = stringResource(R.string.events_participants_title),
            )

            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                RsmResponseBar(
                    going = counts.going,
                    declined = counts.declined,
                    open = counts.open + counts.maybe,
                )
                Text(
                    text = eventCountsText(counts),
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }

            if (participants.isEmpty()) {
                Text(
                    text = stringResource(R.string.events_participants_empty),
                    style = RsmTypography.body,
                    color = colors.inkFaint,
                )
            } else {
                Column {
                    participants.forEachIndexed { index, participant ->
                        ParticipantRow(
                            participant = participant,
                            attendance = attendanceByMember[participant.memberId],
                            canMarkAttendance = model.canMarkAttendance,
                            onSetAttendance = { status ->
                                model.setAttendance(participant.memberId, status)
                            },
                        )
                        if (index < participants.lastIndex) {
                            HorizontalDivider(color = colors.line)
                        }
                    }
                }
            }
        }
    }
}

// --- Zeile ---------------------------------------------------------------------

@Composable
private fun ParticipantRow(
    participant: EventParticipant,
    attendance: Attendance?,
    canMarkAttendance: Boolean,
    onSetAttendance: (AttendanceStatus) -> Unit,
) {
    val colors = RsmTheme.colors
    val name = participant.displayName
        ?: stringResource(R.string.events_participant_unknown)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = RsmSize.touchTarget)
            .padding(vertical = RsmSpacing.s3),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        RsmAvatar(name = name, personId = participant.memberId)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(text = name, style = RsmTypography.body, color = colors.inkPrimary)
            declineComment(participant)?.let { QuoteBubble(it) }
        }
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            RsmStatusPill(
                text = stringResource(EventsDisplay.rsvpLabelRes(participant.rsvp?.status)),
                kind = EventsDisplay.rsvpPillKind(participant.rsvp?.status),
            )
            if (canMarkAttendance) {
                AttendanceMenu(
                    participantName = name,
                    attendance = attendance,
                    onSetAttendance = onSetAttendance,
                )
            }
        }
    }
}

/** Absagegrund nur bei Absage/Krank mit Kommentar (wie iOS). */
private fun declineComment(participant: EventParticipant): String? {
    val rsvp = participant.rsvp ?: return null
    if (rsvp.status != RsvpStatus.DECLINED && rsvp.status != RsvpStatus.SICK) return null
    return rsvp.comment?.takeIf { it.isNotEmpty() }
}

/** Absagegrund als Zitat-Blase (Mulden-Fläche, Radius M). */
@Composable
private fun QuoteBubble(comment: String) {
    val colors = RsmTheme.colors
    Text(
        text = "„$comment“",
        style = RsmTypography.caption.copy(fontStyle = FontStyle.Italic),
        color = colors.inkSoft,
        modifier = Modifier
            .clip(RoundedCornerShape(RsmRadius.m))
            .background(colors.bgSunken)
            .padding(horizontal = RsmSpacing.s3, vertical = RsmSpacing.s2),
    )
}

// --- Anwesenheit (Trainer-Sicht) --------------------------------------------------

@Composable
private fun AttendanceMenu(
    participantName: String,
    attendance: Attendance?,
    onSetAttendance: (AttendanceStatus) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val colors = RsmTheme.colors
    val a11yLabel = stringResource(R.string.events_attendance_menu_a11y, participantName)

    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(RsmRadius.s))
                .clickable { expanded = true }
                .heightIn(min = RsmSize.touchTarget)
                .padding(RsmSpacing.s1)
                .semantics { contentDescription = a11yLabel },
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (attendance != null) {
                RsmStatusPill(
                    text = stringResource(EventsDisplay.attendanceLabelRes(attendance.status)),
                    kind = EventsDisplay.attendancePillKind(attendance.status),
                )
            } else {
                RsmStatusPill(text = stringResource(R.string.events_attendance_none))
            }
            Icon(
                imageVector = Icons.Filled.UnfoldMore,
                contentDescription = null,
                tint = colors.inkFaint,
                modifier = Modifier.size(RsmSpacing.s3),
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            AttendanceStatus.entries.forEach { status ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = stringResource(EventsDisplay.attendanceLabelRes(status)),
                            style = RsmTypography.body,
                            color = colors.inkPrimary,
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = EventsDisplay.attendanceIcon(status),
                            contentDescription = null,
                            tint = EventsDisplay.attendancePillKind(status).foreground(colors),
                        )
                    },
                    onClick = {
                        expanded = false
                        onSetAttendance(status)
                    },
                )
            }
        }
    }
}
