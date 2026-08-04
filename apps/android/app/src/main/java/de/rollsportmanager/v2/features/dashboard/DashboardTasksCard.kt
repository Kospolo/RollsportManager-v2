package de.rollsportmanager.v2.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.Task
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.time.LocalDate

/**
 * Aufgaben-Karte: abhakbar per Tap auf die ganze Zeile (44-dp-Ziel).
 * Der Haken wird optimistisch gesetzt — schlägt PATCH /tasks fehl,
 * springt er zurück und die Karte zeigt den Fehler in Klartext.
 * Spiegel von iOS DashboardTasksCard.swift.
 */
@Composable
fun DashboardTasksCard(
    tasks: List<Task>,
    pendingTaskIds: Set<String>,
    errorMessage: String?,
    onToggle: (Task) -> Unit,
) {
    val colors = RsmTheme.colors
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.dashboard_tasks_eyebrow),
                title = stringResource(R.string.dashboard_tasks_title),
            )
            errorMessage?.let { TaskErrorBanner(it) }
            if (tasks.isEmpty()) {
                RsmEmptyState(
                    icon = Icons.Outlined.CheckCircle,
                    title = stringResource(R.string.dashboard_tasks_empty_title),
                    message = stringResource(R.string.dashboard_tasks_empty_message),
                )
            } else {
                Column {
                    tasks.forEachIndexed { index, task ->
                        if (index > 0) {
                            HorizontalDivider(thickness = 1.dp, color = colors.line)
                        }
                        TaskRow(
                            task = task,
                            isPending = task.id in pendingTaskIds,
                            onToggle = onToggle,
                        )
                    }
                }
            }
        }
    }
}

// --- Zeile ---------------------------------------------------------------------

@Composable
private fun TaskRow(
    task: Task,
    isPending: Boolean,
    onToggle: (Task) -> Unit,
) {
    val colors = RsmTheme.colors
    val a11yLabel = stringResource(R.string.dashboard_tasks_a11y_toggle, task.title)
    val a11yState = stringResource(
        if (task.done) R.string.dashboard_tasks_a11y_done else R.string.dashboard_tasks_a11y_open,
    )
    val a11yHint = stringResource(R.string.dashboard_tasks_a11y_hint)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = RsmSize.touchTarget)
            .clickable(enabled = !isPending, onClickLabel = a11yHint) { onToggle(task) }
            .semantics(mergeDescendants = true) {
                contentDescription = a11yLabel
                stateDescription = a11yState
            }
            .padding(vertical = RsmSpacing.s2),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (task.done) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
            contentDescription = null,
            tint = if (task.done) colors.success else colors.inkFaint,
            modifier = Modifier.size(24.dp),
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = task.title,
                style = RsmTypography.body.copy(
                    textDecoration = if (task.done) {
                        TextDecoration.LineThrough
                    } else {
                        TextDecoration.None
                    },
                ),
                color = if (task.done) colors.inkFaint else colors.inkPrimary,
            )
            DueLabel(task)
        }
        if (isPending) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = colors.brand,
                strokeWidth = 2.dp,
            )
        }
    }
}

/** „fällig Sa. 12.7." — überfällig und noch offen wird danger. */
@Composable
private fun DueLabel(task: Task) {
    val colors = RsmTheme.colors
    val dueDate = task.dueOn?.let { DashboardFormat.parseDay(it) } ?: return
    val formatted =
        "${DashboardFormat.weekdayShortText(dueDate)} ${DashboardFormat.dayMonthText(dueDate)}"
    val isOverdue = !task.done && dueDate.isBefore(LocalDate.now())
    if (isOverdue) {
        Text(
            text = stringResource(R.string.dashboard_tasks_overdue, formatted),
            style = RsmTypography.caption,
            color = colors.danger,
        )
    } else {
        Text(
            text = stringResource(R.string.dashboard_tasks_due, formatted),
            style = RsmTypography.caption,
            color = colors.inkSoft,
        )
    }
}

@Composable
private fun TaskErrorBanner(message: String) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(RsmRadius.m))
            .background(colors.dangerSoft)
            .padding(RsmSpacing.s3)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            imageVector = Icons.Filled.Warning,
            contentDescription = null,
            tint = colors.danger,
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = stringResource(R.string.dashboard_tasks_error_title),
                style = RsmTypography.bodyStrong,
                color = colors.danger,
            )
            Text(
                text = message,
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}
