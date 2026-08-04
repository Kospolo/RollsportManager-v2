package de.rollsportmanager.v2.ui.features.events

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.contracts.RsvpStatus
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Eigene Rückmeldung im Termin-Detail: Zusagen · Vielleicht · Absagen als
 * Tint-Segmente; „Absagen“ klappt den Kommentar-Bereich auf (optimistisches
 * PUT rsvp macht das ViewModel). (Spiegel des rsvpCard-Teils von iOS
 * EventDetailSheet.swift.)
 */
@Composable
internal fun EventRsvpCard(model: EventDetailViewModel) {
    val event by model.event.collectAsStateWithLifecycle()
    val isSaving by model.isSavingRsvp.collectAsStateWithLifecycle()
    val isDeclineExpanded by model.isDeclineExpanded.collectAsStateWithLifecycle()
    val declineComment by model.declineComment.collectAsStateWithLifecycle()
    val myStatus = event.rsvps.firstOrNull { it.memberId == model.myMemberId }?.status

    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.events_rsvp_eyebrow),
                title = stringResource(R.string.events_rsvp_title),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
                RsvpChoice(
                    status = RsvpStatus.GOING,
                    selected = myStatus == RsvpStatus.GOING,
                    enabled = !isSaving,
                    onClick = { model.selectStatus(RsvpStatus.GOING) },
                    modifier = Modifier.weight(1f),
                )
                RsvpChoice(
                    status = RsvpStatus.MAYBE,
                    selected = myStatus == RsvpStatus.MAYBE,
                    enabled = !isSaving,
                    onClick = { model.selectStatus(RsvpStatus.MAYBE) },
                    modifier = Modifier.weight(1f),
                )
                RsvpChoice(
                    status = RsvpStatus.DECLINED,
                    // „Krank“ zählt in der Auswahl als Absage (wie iOS).
                    selected = myStatus == RsvpStatus.DECLINED || myStatus == RsvpStatus.SICK,
                    enabled = !isSaving,
                    onClick = { model.selectStatus(RsvpStatus.DECLINED) },
                    modifier = Modifier.weight(1f),
                )
            }
            if (isDeclineExpanded) {
                DeclineArea(
                    comment = declineComment,
                    onCommentChange = model::setDeclineComment,
                    isSaving = isSaving,
                    onSend = model::sendDecline,
                )
            }
        }
    }
}

@Composable
private fun RsvpChoice(
    status: RsvpStatus,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = RsmTheme.colors
    val labelRes: Int
    val a11yRes: Int
    val icon: ImageVector
    when (status) {
        RsvpStatus.GOING -> {
            labelRes = R.string.events_rsvp_going
            a11yRes = R.string.events_rsvp_a11y_going
            icon = Icons.Filled.Check
        }
        RsvpStatus.MAYBE -> {
            labelRes = R.string.events_rsvp_maybe
            a11yRes = R.string.events_rsvp_a11y_maybe
            icon = Icons.Filled.QuestionMark
        }
        else -> {
            labelRes = R.string.events_rsvp_declined
            a11yRes = R.string.events_rsvp_a11y_declined
            icon = Icons.Filled.Close
        }
    }
    val foreground = when {
        !selected -> colors.inkSoft
        status == RsvpStatus.GOING -> colors.success
        status == RsvpStatus.MAYBE -> colors.info
        else -> colors.danger
    }
    val background = when {
        !selected -> colors.bgSunken
        status == RsvpStatus.GOING -> colors.successSoft
        status == RsvpStatus.MAYBE -> colors.infoSoft
        else -> colors.dangerSoft
    }
    val a11yLabel = stringResource(a11yRes)
    val interactionSource = remember { MutableInteractionSource() }
    Row(
        modifier = modifier
            .rsmPressable(interactionSource)
            .clip(CircleShape)
            .background(background)
            .selectable(
                selected = selected,
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            )
            .heightIn(min = RsmSize.touchTarget)
            .semantics { contentDescription = a11yLabel },
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = foreground,
            modifier = Modifier.size(RsmSpacing.s3),
        )
        Text(
            text = stringResource(labelRes),
            style = RsmTypography.bodyStrong,
            color = foreground,
            maxLines = 1,
        )
    }
}

@Composable
private fun DeclineArea(
    comment: String,
    onCommentChange: (String) -> Unit,
    isSaving: Boolean,
    onSend: () -> Unit,
) {
    val colors = RsmTheme.colors
    val a11yComment = stringResource(R.string.events_rsvp_comment_a11y)
    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
        TextField(
            value = comment,
            onValueChange = onCommentChange,
            placeholder = {
                Text(
                    text = stringResource(R.string.events_rsvp_comment_placeholder),
                    style = RsmTypography.body,
                    color = colors.inkFaint,
                )
            },
            textStyle = RsmTypography.body,
            minLines = 2,
            maxLines = 4,
            shape = RoundedCornerShape(RsmRadius.m),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = colors.bgSunken,
                unfocusedContainerColor = colors.bgSunken,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                disabledIndicatorColor = Color.Transparent,
                cursorColor = colors.brand,
                focusedTextColor = colors.inkPrimary,
                unfocusedTextColor = colors.inkPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = a11yComment },
        )

        // Bewusst KEINE Beere: Absage ist die „destruktive“ Nebenaktion (danger-Tint).
        val interactionSource = remember { MutableInteractionSource() }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .rsmPressable(interactionSource)
                .clip(CircleShape)
                .background(colors.dangerSoft)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    enabled = !isSaving,
                    onClick = onSend,
                )
                .heightIn(min = RsmSize.touchTarget),
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isSaving) {
                CircularProgressIndicator(
                    modifier = Modifier.size(RsmSpacing.s4),
                    color = colors.danger,
                    strokeWidth = 2.dp,
                )
            }
            Text(
                text = stringResource(R.string.events_rsvp_comment_send),
                style = RsmTypography.bodyStrong,
                color = colors.danger,
            )
        }
    }
}
