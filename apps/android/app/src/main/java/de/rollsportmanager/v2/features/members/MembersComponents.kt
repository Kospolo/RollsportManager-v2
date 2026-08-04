package de.rollsportmanager.v2.features.members

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.AssignableClubRole
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.contracts.MemberStatus
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmDunningPill
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

// ============================================================================
// Kleine Bausteine des Mitglieder-Features: Label-/Format-Helfer, Suchfeld,
// Filter-Chip, Listenzeile, Beitragsampel, Detail-Zeile.
// Alle Symbole „Members…“/„members…“ präfixiert (Kollisionsschutz Teams).
// ============================================================================

// --- Label-Helfer -------------------------------------------------------------

@StringRes
internal fun membersRoleLabelRes(role: ClubRole): Int = when (role) {
    ClubRole.OWNER -> R.string.members_role_owner
    ClubRole.ADMIN -> R.string.members_role_admin
    ClubRole.MODERATOR -> R.string.members_role_moderator
    ClubRole.TREASURER -> R.string.members_role_treasurer
    ClubRole.COACH -> R.string.members_role_coach
    ClubRole.MEMBER -> R.string.members_role_member
    ClubRole.GUEST_COACH -> R.string.members_role_guest_coach
}

@Composable
internal fun membersRoleLabel(role: ClubRole): String =
    stringResource(membersRoleLabelRes(role))

@Composable
internal fun membersRoleLabel(role: AssignableClubRole): String =
    stringResource(membersRoleLabelRes(role.asClubRole()))

/** Staff-Rollen tragen den Brand-Chip, einfache Mitglieder bleiben neutral. */
internal fun membersRoleKind(role: ClubRole): RsmStatusKind =
    if (role == ClubRole.MEMBER) RsmStatusKind.NEUTRAL else RsmStatusKind.BRAND

@StringRes
internal fun membersStatusLabelRes(status: MemberStatus): Int = when (status) {
    MemberStatus.PENDING -> R.string.members_status_pending
    MemberStatus.REJECTED -> R.string.members_status_rejected
    MemberStatus.ACTIVE -> R.string.members_status_active
    MemberStatus.INACTIVE -> R.string.members_status_inactive
    MemberStatus.LEFT -> R.string.members_status_left
}

internal fun membersStatusKind(status: MemberStatus): RsmStatusKind = when (status) {
    MemberStatus.ACTIVE -> RsmStatusKind.SUCCESS
    MemberStatus.PENDING -> RsmStatusKind.INFO
    // Abgelehnt ist ein Verwaltungs-Endzustand, kein Alarm: bewusst NEUTRAL
    // und nicht DANGER — die Liste soll niemanden an den Pranger stellen.
    MemberStatus.REJECTED, MemberStatus.INACTIVE, MemberStatus.LEFT -> RsmStatusKind.NEUTRAL
}

/** Leitungsformat `yyyy-MM-dd(T…)` → lokalisiertes Datum; Unparsebares roh. */
internal fun membersFormatDay(wire: String): String = runCatching {
    LocalDate.parse(wire.take(10))
        .format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
}.getOrDefault(wire)

// --- Beitragsampel --------------------------------------------------------------

/** Beitragsampel: Mahnstufen-Treppe aus dem Design-System bzw. „Beitrag bezahlt“. */
@Composable
internal fun MembersFeePill(
    status: MembersViewModel.FeeStatus,
    modifier: Modifier = Modifier,
) {
    when (status) {
        is MembersViewModel.FeeStatus.Dunning ->
            RsmDunningPill(level = status.level, modifier = modifier)

        MembersViewModel.FeeStatus.Paid -> RsmStatusPill(
            text = stringResource(R.string.members_fee_paid),
            kind = RsmStatusKind.SUCCESS,
            modifier = modifier,
        )
    }
}

// --- Suchfeld -------------------------------------------------------------------

/** Suchfeld als Mulde (bg.sunken, Pill) — Design-System „Suchfeld/Segmente“. */
@Composable
internal fun MembersSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = RsmTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = RsmSize.touchTarget)
            .clip(CircleShape)
            .background(colors.bgSunken)
            .padding(horizontal = RsmSpacing.s4),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Filled.Search,
            contentDescription = null,
            tint = colors.inkFaint,
            modifier = Modifier.size(20.dp),
        )
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(
                    text = stringResource(R.string.members_search_placeholder),
                    style = RsmTypography.body,
                    color = colors.inkFaint,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = RsmTypography.body.copy(color = colors.inkPrimary),
                cursorBrush = SolidColor(colors.brand),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) {
            IconButton(onClick = { onValueChange("") }) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = stringResource(R.string.members_search_clear),
                    tint = colors.inkFaint,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

// --- Rollen-Filter-Chip -----------------------------------------------------------

/**
 * Filter-Chip in Pill-Form — ausgewählt = brand-soft-Tint (die volle Beere
 * bleibt der einen Primäraktion pro Sichtbereich vorbehalten).
 */
@Composable
internal fun MembersFilterChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .rsmPressable(interactionSource)
            .clip(CircleShape)
            .background(if (selected) colors.brandSoft else colors.bgSurface)
            .border(
                width = 1.dp,
                color = if (selected) colors.brandInk else colors.line,
                shape = CircleShape,
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .heightIn(min = RsmSize.touchTarget)
            .padding(horizontal = RsmSpacing.s4),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = RsmTypography.caption.copy(fontWeight = FontWeight.SemiBold),
            color = if (selected) colors.brandInk else colors.inkSoft,
        )
    }
}

// --- Listenzeile -------------------------------------------------------------------

/**
 * Zeile der Mitgliederliste: Avatar · Name + Team · Rollen-Pill ·
 * Beitragsampel (nur wo Rechnungen sichtbar sind).
 */
@Composable
internal fun MembersRow(
    member: ClubMember,
    teamNames: String?,
    feeStatus: MembersViewModel.FeeStatus?,
    onClick: () -> Unit,
) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .rsmPressable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClickLabel = stringResource(R.string.members_row_a11y, member.membersFullName),
                onClick = onClick,
            )
            .heightIn(min = RsmSize.listRow)
            .padding(vertical = RsmSpacing.s2),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RsmAvatar(name = member.membersFullName, personId = member.id, size = 40.dp)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = member.membersFullName,
                style = RsmTypography.bodyStrong,
                color = colors.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = teamNames ?: stringResource(R.string.members_row_no_team),
                style = RsmTypography.caption,
                color = if (teamNames != null) colors.inkSoft else colors.inkFaint,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            RsmStatusPill(
                text = membersRoleLabel(member.role),
                kind = membersRoleKind(member.role),
            )
            feeStatus?.let { MembersFeePill(status = it) }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = colors.inkFaint,
            modifier = Modifier.size(20.dp),
        )
    }
}

// --- Detail-Zeile ---------------------------------------------------------------

/** Schlüssel-Wert-Zeile im Stammdaten-Block (Label-Breite = iOS-Parität, 116). */
@Composable
internal fun MembersDetailRow(
    label: String,
    value: String?,
    emptyText: String = stringResource(R.string.members_detail_none),
) {
    val colors = RsmTheme.colors
    Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
        Text(
            text = label,
            style = RsmTypography.caption,
            color = colors.inkFaint,
            modifier = Modifier
                .width(116.dp)
                .alignByBaseline(),
        )
        Text(
            text = value ?: emptyText,
            style = RsmTypography.body,
            color = if (value != null) colors.inkPrimary else colors.inkFaint,
            modifier = Modifier
                .weight(1f)
                .alignByBaseline(),
        )
    }
}
