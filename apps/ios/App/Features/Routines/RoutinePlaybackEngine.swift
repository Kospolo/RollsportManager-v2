import Foundation
import QuartzCore
import UIKit

/// Simulierte Wiedergabe für den Trainings-Player — es gibt KEINE echte
/// Audiodatei (Hinweis „Demo ohne Audiodatei“ im UI). Ein CADisplayLink
/// bewegt die Position, Tempo skaliert die Laufgeschwindigkeit, der
/// A–B-Loop springt zurück. Spiegel von `usePlayback.ts` im Web.
///
/// Reduce Motion drosselt NUR die published Playhead-Updates (~2,5 Hz),
/// die interne Position bleibt exakt (DESIGN-SYSTEM §2.8-Killswitch).
@MainActor
final class RoutinePlaybackEngine: NSObject, ObservableObject {

    static let minLoopGapMs: Double = 1_000
    static let defaultLoopJumpMs: Double = 10_000
    static let skipMs: Double = 5_000
    private static let reducedPaintInterval: CFTimeInterval = 0.4

    let durationMs: Double

    @Published private(set) var posMs: Double = 0
    @Published private(set) var isPlaying = false
    /// Sekunden bis zum Start (3-2-1) oder nil, wenn kein Countdown läuft.
    @Published private(set) var countdownLeft: Int?
    /// Gewählte Countdown-Länge in Sekunden (0 = aus).
    @Published var countdownSetting = 0
    /// Tempo in Prozent, 50–200 (Pills und Slider teilen sich diesen Wert).
    @Published private(set) var tempoPercent: Double = 100
    @Published private(set) var loopOn = false
    @Published private(set) var loopAMs: Double
    @Published private(set) var loopBMs: Double

    // nonisolated(unsafe): nur damit deinit (nonisoliert) aufräumen darf —
    // alle Zugriffe passieren faktisch auf dem MainActor.
    private nonisolated(unsafe) var displayLink: CADisplayLink?
    private nonisolated(unsafe) var countdownTimer: Timer?
    private var lastTimestamp: CFTimeInterval?
    private var lastPaint: CFTimeInterval = 0
    /// Exakte Position — `posMs` wird bei Reduce Motion seltener nachgezogen.
    private var internalPos: Double = 0
    private var reduceMotion = false

    init(durationMs: Double) {
        self.durationMs = max(0, durationMs)
        // Startwerte wie im Web: A bei 25 %, B bei 48 % der Kür.
        self.loopAMs = (self.durationMs * 0.25).rounded()
        self.loopBMs = (self.durationMs * 0.48).rounded()
        super.init()
    }

    deinit {
        displayLink?.invalidate()
        countdownTimer?.invalidate()
    }

    /// Spielt ODER zählt gerade herunter — das große Play zeigt dann Pause.
    var isActive: Bool { isPlaying || countdownLeft != nil }

    // MARK: - Transport

    func togglePlay() {
        if isActive {
            stop()
        } else if countdownSetting > 0 {
            beginCountdown()
        } else {
            start()
        }
    }

    /// Springen UND (falls pausiert) sofort abspielen — für Marker-Zeilen.
    func playFrom(_ ms: Double) {
        seek(ms)
        if !isActive { start() }
    }

    func seek(_ ms: Double) {
        internalPos = min(durationMs, max(0, ms))
        lastPaint = CACurrentMediaTime()
        posMs = internalPos
    }

    func skip(_ deltaMs: Double) {
        seek(internalPos + deltaMs)
    }

    /// Pausiert die Wiedergabe UND bricht einen laufenden Countdown ab.
    func stop() {
        displayLink?.invalidate()
        displayLink = nil
        countdownTimer?.invalidate()
        countdownTimer = nil
        lastTimestamp = nil
        countdownLeft = nil
        isPlaying = false
        posMs = internalPos
    }

    // MARK: - Tempo & Loop

    func setTempo(_ percent: Double) {
        tempoPercent = min(200, max(50, percent.rounded()))
    }

    func toggleLoop() {
        loopOn.toggle()
    }

    /// A auf aktuelle Position; B rückt nach, wenn die Reihenfolge kippen würde.
    func setLoopAAtPlayhead() {
        guard durationMs > Self.minLoopGapMs else { return }
        let a = min(max(0, internalPos.rounded()), durationMs - Self.minLoopGapMs)
        loopAMs = a
        if loopBMs < a + Self.minLoopGapMs {
            loopBMs = min(durationMs, a + Self.defaultLoopJumpMs)
        }
    }

    /// B auf aktuelle Position; A rückt nach, wenn die Reihenfolge kippen würde.
    func setLoopBAtPlayhead() {
        guard durationMs > Self.minLoopGapMs else { return }
        let b = min(durationMs, max(internalPos.rounded(), Self.minLoopGapMs))
        loopBMs = b
        if loopAMs > b - Self.minLoopGapMs {
            loopAMs = max(0, b - Self.defaultLoopJumpMs)
        }
    }

    // MARK: - Intern

    private func start() {
        guard displayLink == nil, durationMs > 0 else { return }
        if internalPos >= durationMs { // vom Ende neu starten
            internalPos = 0
            posMs = 0
        }
        reduceMotion = UIAccessibility.isReduceMotionEnabled
        lastTimestamp = nil
        isPlaying = true
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func beginCountdown() {
        countdownLeft = countdownSetting
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            // Timer feuert auf dem Main-RunLoop — sauber zurück auf den MainActor.
            _Concurrency.Task { @MainActor in self?.countdownTick() }
        }
    }

    private func countdownTick() {
        guard let left = countdownLeft else { return }
        if left <= 1 {
            countdownTimer?.invalidate()
            countdownTimer = nil
            countdownLeft = nil
            start()
        } else {
            countdownLeft = left - 1
        }
    }

    @objc private func tick(_ link: CADisplayLink) {
        guard let last = lastTimestamp else {
            lastTimestamp = link.timestamp
            return
        }
        let deltaMs = (link.timestamp - last) * 1_000
        lastTimestamp = link.timestamp

        var next = internalPos + deltaMs * tempoPercent / 100
        if loopOn, loopBMs > loopAMs, next >= loopBMs {
            next = loopAMs // A–B-Schleife: zurückspringen
        }
        if next >= durationMs { // Ende erreicht: anhalten
            internalPos = durationMs
            posMs = durationMs
            stop()
            return
        }
        internalPos = next
        if !reduceMotion || link.timestamp - lastPaint > Self.reducedPaintInterval {
            lastPaint = link.timestamp
            posMs = next
        }
    }
}
