package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.math.max
import kotlin.math.round

/**
 * Simulierte Wiedergabe für den Trainings-Player — es gibt KEINE echte
 * Audiodatei (Hinweis „Demo ohne Audiodatei" im UI). Spiegel von
 * RoutinePlaybackEngine.swift (iOS) bzw. usePlayback.ts (Web).
 *
 * BEWUSST kein Media3: der v1-Playback-Service wird NICHT portiert, er kommt
 * später als eigenes Modul. Der Frame-Loop lebt in der UI (withFrameNanos in
 * RoutinePlayerCard) und ruft [tick] auf; der Countdown tickt über [countdownTick].
 *
 * Reduce Motion (Animator-Skala 0) drosselt NUR die sichtbaren Playhead-Updates
 * (~2,5 Hz), die interne Position bleibt exakt (DESIGN-SYSTEM §2.8-Killswitch).
 */
@Stable
internal class RoutinePlaybackEngine(
    durationMs: Double,
    private val reduceMotion: Boolean = false,
) {
    val durationMs: Double = max(0.0, durationMs)

    var posMs: Double by mutableDoubleStateOf(0.0)
        private set
    var isPlaying: Boolean by mutableStateOf(false)
        private set

    /** Sekunden bis zum Start (3-2-1) oder null, wenn kein Countdown läuft. */
    var countdownLeft: Int? by mutableStateOf(null)
        private set

    /** Gewählte Countdown-Länge in Sekunden (0 = aus). */
    var countdownSetting: Int by mutableIntStateOf(0)

    /** Tempo in Prozent, 50–200 (Pills und Slider teilen sich diesen Wert). */
    var tempoPercent: Double by mutableDoubleStateOf(100.0)
        private set

    var loopOn: Boolean by mutableStateOf(false)
        private set

    /** Startwerte wie Web/iOS: A bei 25 %, B bei 48 % der Kür. */
    var loopAMs: Double by mutableDoubleStateOf(round(this.durationMs * 0.25))
        private set
    var loopBMs: Double by mutableDoubleStateOf(round(this.durationMs * 0.48))
        private set

    /** Exakte Position — `posMs` wird bei Reduce Motion seltener nachgezogen. */
    private var internalPos: Double = 0.0
    private var lastPaintMs: Long = 0L

    /** Spielt ODER zählt gerade herunter — das große Play zeigt dann Pause. */
    val isActive: Boolean get() = isPlaying || countdownLeft != null

    // --- Transport ------------------------------------------------------------

    fun togglePlay() {
        when {
            isActive -> stop()
            countdownSetting > 0 -> countdownLeft = countdownSetting
            else -> start()
        }
    }

    /** Springen UND (falls pausiert) sofort abspielen — für Marker-Zeilen. */
    fun playFrom(ms: Double) {
        seek(ms)
        if (!isActive) start()
    }

    fun seek(ms: Double) {
        internalPos = ms.coerceIn(0.0, durationMs)
        posMs = internalPos
    }

    fun skip(deltaMs: Double) = seek(internalPos + deltaMs)

    /** Pausiert die Wiedergabe UND bricht einen laufenden Countdown ab. */
    fun stop() {
        countdownLeft = null
        isPlaying = false
        posMs = internalPos
    }

    // --- Tempo & Loop -----------------------------------------------------------

    fun setTempo(percent: Double) {
        tempoPercent = round(percent).coerceIn(50.0, 200.0)
    }

    fun toggleLoop() {
        loopOn = !loopOn
    }

    /** A auf aktuelle Position; B rückt nach, wenn die Reihenfolge kippen würde. */
    fun setLoopAAtPlayhead() {
        if (durationMs <= MIN_LOOP_GAP_MS) return
        val a = round(internalPos).coerceIn(0.0, durationMs - MIN_LOOP_GAP_MS)
        loopAMs = a
        if (loopBMs < a + MIN_LOOP_GAP_MS) {
            loopBMs = (a + DEFAULT_LOOP_JUMP_MS).coerceAtMost(durationMs)
        }
    }

    /** B auf aktuelle Position; A rückt nach, wenn die Reihenfolge kippen würde. */
    fun setLoopBAtPlayhead() {
        if (durationMs <= MIN_LOOP_GAP_MS) return
        val b = round(internalPos).coerceIn(MIN_LOOP_GAP_MS, durationMs)
        loopBMs = b
        if (loopAMs > b - MIN_LOOP_GAP_MS) {
            loopAMs = (b - DEFAULT_LOOP_JUMP_MS).coerceAtLeast(0.0)
        }
    }

    // --- Ticks (aufgerufen vom UI-Frame-Loop bzw. 1-s-Countdown-Effekt) ---------

    /** Ein Wiedergabe-Frame: Position fortschreiben, Loop/Ende behandeln. */
    fun tick(deltaMs: Double, frameTimeMs: Long) {
        if (!isPlaying) return
        var next = internalPos + deltaMs * tempoPercent / 100.0
        if (loopOn && loopBMs > loopAMs && next >= loopBMs) {
            next = loopAMs // A–B-Schleife: zurückspringen
        }
        if (next >= durationMs) { // Ende erreicht: anhalten
            internalPos = durationMs
            posMs = durationMs
            stop()
            return
        }
        internalPos = next
        if (!reduceMotion || frameTimeMs - lastPaintMs > REDUCED_PAINT_INTERVAL_MS) {
            lastPaintMs = frameTimeMs
            posMs = next
        }
    }

    /** Eine Countdown-Sekunde ist um: runterzählen oder starten. */
    fun countdownTick() {
        val left = countdownLeft ?: return
        if (left <= 1) {
            countdownLeft = null
            start()
        } else {
            countdownLeft = left - 1
        }
    }

    // --- Intern -----------------------------------------------------------------

    private fun start() {
        if (durationMs <= 0) return
        if (internalPos >= durationMs) { // vom Ende neu starten
            internalPos = 0.0
            posMs = 0.0
        }
        isPlaying = true
    }

    companion object {
        const val MIN_LOOP_GAP_MS: Double = 1_000.0
        const val DEFAULT_LOOP_JUMP_MS: Double = 10_000.0
        const val SKIP_MS: Double = 5_000.0
        const val REDUCED_PAINT_INTERVAL_MS: Long = 400L
    }
}
