package de.rollsportmanager.v2.features.login

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.network.DevPersona
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import kotlinx.coroutines.launch

/**
 * Anzeige-Metadaten der Persona-Karten — Spiegel der Web-Login-Karten.
 * Quelle der Wahrheit für sub/member_id ist services/api/src/routes/
 * dev-login.ts; hier stehen nur UI-Texte.
 */
private data class LoginPersonaCard(
    val persona: DevPersona,
    val displayName: String,
    /** app.club_members.id aus dem Seed — für den deterministischen Avatar-Ton. */
    val memberId: String,
    @StringRes val roleRes: Int,
    @StringRes val descriptionRes: Int,
)

private val personaCards = listOf(
    LoginPersonaCard(
        DevPersona.COACH, "Sandra Vogel",
        "a0000000-0000-4000-8000-000000000001",
        R.string.login_persona_coach_role, R.string.login_persona_coach_description,
    ),
    LoginPersonaCard(
        DevPersona.ADMIN, "Thomas Krüger",
        "a0000000-0000-4000-8000-000000000004",
        R.string.login_persona_admin_role, R.string.login_persona_admin_description,
    ),
    LoginPersonaCard(
        DevPersona.TREASURER, "Beate Schäfer",
        "a0000000-0000-4000-8000-000000000003",
        R.string.login_persona_treasurer_role, R.string.login_persona_treasurer_description,
    ),
    LoginPersonaCard(
        DevPersona.MEMBER, "Katrin Grünewald",
        "a0000000-0000-4000-8000-000000000009",
        R.string.login_persona_member_role, R.string.login_persona_member_description,
    ),
    LoginPersonaCard(
        DevPersona.GUEST, "Milena Öztürk",
        "a0000000-0000-4000-8000-000000000006",
        R.string.login_persona_guest_role, R.string.login_persona_guest_description,
    ),
)

/** Persona-Login gegen den lokalen Dev-Stack — wie die Web-/iOS-Login-Karten. */
@Composable
fun LoginScreen(session: SessionStore) {
    val scope = rememberCoroutineScope()
    val isLoggingIn by session.isLoggingIn.collectAsStateWithLifecycle()
    val loginError by session.loginError.collectAsStateWithLifecycle()
    var pendingPersona by remember { mutableStateOf<DevPersona?>(null) }
    val colors = RsmTheme.colors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bgCanvas)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s5),
    ) {
        Header()
        DevBanner()
        personaCards.forEach { card ->
            PersonaCard(
                card = card,
                isLoading = isLoggingIn && pendingPersona == card.persona,
                enabled = !isLoggingIn,
                onClick = {
                    pendingPersona = card.persona
                    scope.launch {
                        session.login(card.persona)
                        pendingPersona = null
                    }
                },
            )
        }
        loginError?.let { ErrorCard(it) }
    }
}

@Composable
private fun Header() {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier.padding(top = RsmSpacing.s6),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
    ) {
        Text(
            text = stringResource(R.string.login_eyebrow).uppercase(),
            style = RsmTypography.eyebrow,
            color = colors.brandInk,
        )
        Text(
            text = stringResource(R.string.login_title),
            style = RsmTypography.display,
            color = colors.inkPrimary,
        )
        Text(
            text = stringResource(R.string.login_subtitle),
            style = RsmTypography.body,
            color = colors.inkSoft,
        )
    }
}

/** Dev-Hinweis-Banner: nichts hier ist Produktion. */
@Composable
private fun DevBanner() {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(colors.infoSoft)
            .padding(RsmSpacing.s4),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
    ) {
        Icon(
            imageVector = Icons.Filled.Build,
            contentDescription = null,
            tint = colors.info,
            modifier = Modifier.size(20.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = stringResource(R.string.login_dev_banner_title),
                style = RsmTypography.bodyStrong,
                color = colors.info,
            )
            Text(
                text = stringResource(R.string.login_dev_banner_message),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}

@Composable
private fun PersonaCard(
    card: LoginPersonaCard,
    isLoading: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    RsmCard(
        padding = RsmSpacing.s4,
        modifier = Modifier
            .rsmPressable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                onClickLabel = stringResource(R.string.login_a11y_persona, card.displayName),
                onClick = onClick,
            ),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RsmAvatar(name = card.displayName, personId = card.memberId, size = 44.dp)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = card.displayName,
                        style = RsmTypography.bodyStrong,
                        color = colors.inkPrimary,
                    )
                    RsmStatusPill(
                        text = stringResource(card.roleRes),
                        kind = RsmStatusKind.BRAND,
                    )
                }
                Text(
                    text = stringResource(card.descriptionRes),
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = colors.brand,
                    strokeWidth = 2.dp,
                )
            } else {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = colors.inkFaint,
                )
            }
        }
    }
}

@Composable
private fun ErrorCard(message: String) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(colors.dangerSoft)
            .padding(RsmSpacing.s4),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
    ) {
        Icon(
            imageVector = Icons.Filled.Warning,
            contentDescription = null,
            tint = colors.danger,
            modifier = Modifier.size(20.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = stringResource(R.string.login_error_title),
                style = RsmTypography.bodyStrong,
                color = colors.danger,
            )
            Text(text = message, style = RsmTypography.caption, color = colors.inkSoft)
            Text(
                text = stringResource(R.string.login_error_hint),
                style = RsmTypography.caption,
                color = colors.inkFaint,
            )
        }
    }
}
