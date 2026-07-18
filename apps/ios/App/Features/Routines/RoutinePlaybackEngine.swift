import AVFoundation
import Foundation
import QuartzCore
import UIKit
#if DEBUG
import os
#endif

/// ECHTE Wiedergabe der Kür-Musik über `AVAudioPlayer`.
///
/// Vorher war diese Klasse eine Simulation: ein CADisplayLink zählte eine
/// Zahl hoch, es lief nie Ton. Jetzt lädt sie die Datei über
/// `GET /media/{key}` (Bearer-Auth, `downloadMedia`) in eine temporäre Datei
/// und spielt sie ab. Der CADisplayLink ist NUR noch der UI-Takt, der die
/// echte Position aus `player.currentTime` abholt — er treibt nichts mehr an.
///
/// Tempo läuft über `AVAudioPlayer.rate` (`enableRate`, 50–200 % = 0,5–2,0),
/// der A–B-Loop springt im Takt zurück, Scrubbing setzt `currentTime`.
///
/// EHRLICH BLEIBEN: Ohne abspielbare Datei gibt es KEINEN Fortschritt mehr.
/// `loadState` wird `.failed`, die Transportknöpfe sind aus, und die View
/// zeigt den Fehler — statt wie früher einen Fortschritt vorzutäuschen.
///
/// AVAudioSession `.playback`: die Musik läuft auch, wenn der Stummschalter
/// am Gerät aktiv ist — in der Trainingshalle ist genau das der Normalfall.
/// (KEIN Hintergrund-Audio: das bräuchte UIBackgroundModes in der Info.plist,
/// also Zusatzrechte — bewusst weggelassen.)
///
/// Reduce Motion drosselt NUR die published Playhead-Updates (~2,5 Hz),
/// die Tonwiedergabe selbst bleibt unberührt (DESIGN-SYSTEM §2.8-Killswitch).
@MainActor
final class RoutinePlaybackEngine: NSObject, ObservableObject, AVAudioPlayerDelegate {

    /// Ladezustand der Audiodatei — Grundlage für die ehrliche Fehleranzeige.
    enum LoadState: Equatable {
        case idle          // keine Musik hinterlegt
        case loading
        case ready
        case failed(String)
    }

    static let minLoopGapMs: Double = 1_000
    static let defaultLoopJumpMs: Double = 10_000
    static let skipMs: Double = 5_000
    private static let reducedPaintInterval: CFTimeInterval = 0.4

    /// Laufzeit in ms. Start = Metadaten (`music_duration_ms`); sobald die
    /// Datei geladen ist, gilt die ECHTE Dauer aus dem Decoder.
    @Published private(set) var durationMs: Double

    @Published private(set) var posMs: Double = 0
    @Published private(set) var isPlaying = false
    @Published private(set) var loadState: LoadState = .idle
    /// Sekunden bis zum Start (3-2-1) oder nil, wenn kein Countdown läuft.
    @Published private(set) var countdownLeft: Int?
    /// Gewählte Countdown-Länge in Sekunden (0 = aus).
    @Published var countdownSetting = 0
    /// Tempo in Prozent, 50–200 (Pills und Slider teilen sich diesen Wert).
    @Published private(set) var tempoPercent: Double = 100
    @Published private(set) var loopOn = false
    @Published private(set) var loopAMs: Double
    @Published private(set) var loopBMs: Double

    /// Nur wenn die Datei wirklich spielbereit ist, darf transportiert werden.
    var canPlay: Bool { loadState == .ready && player != nil && durationMs > 0 }

    private var player: AVAudioPlayer?
    private var localFileURL: URL?
    private var loadTask: _Concurrency.Task<Void, Never>?

    // nonisolated(unsafe): nur damit deinit (nonisoliert) aufräumen darf —
    // alle Zugriffe passieren faktisch auf dem MainActor.
    private nonisolated(unsafe) var displayLink: CADisplayLink?
    private nonisolated(unsafe) var countdownTimer: Timer?
    private var lastPaint: CFTimeInterval = 0
    private var reduceMotion = false

    init(durationMs: Double) {
        // Lokale Kopie: `durationMs` ist @Published (var), ein Lesen von
        // `self` vor `super.init()` wäre nicht erlaubt.
        let initial = max(0, durationMs)
        self.durationMs = initial
        // Startwerte wie im Web: A bei 25 %, B bei 48 % der Kür.
        self.loopAMs = (initial * 0.25).rounded()
        self.loopBMs = (initial * 0.48).rounded()
        super.init()
    }

    deinit {
        displayLink?.invalidate()
        countdownTimer?.invalidate()
    }

    /// Spielt ODER zählt gerade herunter — das große Play zeigt dann Pause.
    var isActive: Bool { isPlaying || countdownLeft != nil }

    // MARK: - Laden

    /// Lädt die Kür-Musik über die authentifizierte Media-Route.
    /// `audioUrl` ist der vom Server gelieferte relative Pfad ("/media/<key>").
    /// Mehrfachaufrufe sind harmlos (z. B. View-Rebuild).
    func load(audioUrl: String?, api: APIClient) {
        guard loadState == .idle || isFailed else { return }
        guard let key = Self.mediaKey(from: audioUrl) else {
            loadState = .idle // keine Musik hinterlegt — kein Fehler, nur leer
            return
        }
        loadState = .loading
        loadTask?.cancel()
        loadTask = _Concurrency.Task { [weak self] in
            do {
                let fileURL = try await api.downloadMedia(key: key, suggestedName: key)
                if _Concurrency.Task.isCancelled { return }
                await self?.activate(fileURL: fileURL)
            } catch is CancellationError {
                return
            } catch {
                await self?.fail(with: error)
            }
        }
    }

    private var isFailed: Bool {
        if case .failed = loadState { return true }
        return false
    }

    /// Extrahiert den flachen Storage-Key aus "/media/<key>". Verschachtelte
    /// Pfade gibt es serverseitig nicht (assertValidKey erlaubt kein "/").
    static func mediaKey(from audioUrl: String?) -> String? {
        guard let audioUrl, !audioUrl.isEmpty else { return nil }
        let key = audioUrl.hasPrefix("/media/")
            ? String(audioUrl.dropFirst("/media/".count))
            : audioUrl
        return key.isEmpty || key.contains("/") ? nil : key
    }

    private func activate(fileURL: URL) {
        do {
            // .playback: spielt auch bei aktivem Stummschalter (Trainingshalle).
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .default)
            try audioSession.setActive(true)

            let newPlayer = try AVAudioPlayer(contentsOf: fileURL)
            newPlayer.delegate = self
            newPlayer.enableRate = true          // Voraussetzung für Tempo != 100 %
            newPlayer.rate = Float(tempoPercent / 100)
            guard newPlayer.prepareToPlay(), newPlayer.duration > 0 else {
                fail(with: AudioError.notPlayable)
                return
            }
            player = newPlayer
            localFileURL = fileURL
            // Echte Dauer schlägt die Metadaten (die im Seed auch mal lügen).
            durationMs = newPlayer.duration * 1_000
            if loopBMs <= loopAMs || loopBMs > durationMs {
                loopAMs = (durationMs * 0.25).rounded()
                loopBMs = (durationMs * 0.48).rounded()
            }
            posMs = 0
            loadState = .ready
        } catch {
            fail(with: error)
        }
    }

    private func fail(with error: Error) {
        pause()
        player = nil
        posMs = 0
        loadState = .failed(Self.message(for: error))
    }

    enum AudioError: Error { case notPlayable }

    private static func message(for error: Error) -> String {
        if error is AudioError { return String(localized: "routines.player.error.notPlayable") }
        if let apiError = error as? APIError {
            switch apiError {
            case .transport:
                return String(localized: "routines.player.error.offline")
            default:
                return String(localized: "routines.player.error.unavailable")
            }
        }
        return String(localized: "routines.player.error.unavailable")
    }

    // MARK: - Transport

    func togglePlay() {
        guard canPlay else { return }
        if isActive {
            pause()
        } else if countdownSetting > 0 {
            beginCountdown()
        } else {
            start()
        }
    }

    /// Springen UND (falls pausiert) sofort abspielen — für Marker-Zeilen.
    func playFrom(_ ms: Double) {
        guard canPlay else { return }
        seek(ms)
        if !isActive { start() }
    }

    func seek(_ ms: Double) {
        guard let player else { return }
        let clamped = min(durationMs, max(0, ms))
        player.currentTime = clamped / 1_000
        lastPaint = CACurrentMediaTime()
        posMs = clamped
    }

    func skip(_ deltaMs: Double) {
        seek(posMs + deltaMs)
    }

    /// Pausiert die Wiedergabe UND bricht einen laufenden Countdown ab.
    /// (Heißt weiterhin `stop()`, weil die Views darauf verdrahtet sind.)
    func stop() { pause() }

    private func pause() {
        player?.pause()
        displayLink?.invalidate()
        displayLink = nil
        countdownTimer?.invalidate()
        countdownTimer = nil
        countdownLeft = nil
        isPlaying = false
        if let player { posMs = player.currentTime * 1_000 }
    }

    // MARK: - Tempo & Loop

    func setTempo(_ percent: Double) {
        tempoPercent = min(200, max(50, percent.rounded()))
        player?.rate = Float(tempoPercent / 100)
    }

    func toggleLoop() {
        loopOn.toggle()
    }

    /// A auf aktuelle Position; B rückt nach, wenn die Reihenfolge kippen würde.
    func setLoopAAtPlayhead() {
        guard durationMs > Self.minLoopGapMs else { return }
        let a = min(max(0, posMs.rounded()), durationMs - Self.minLoopGapMs)
        loopAMs = a
        if loopBMs < a + Self.minLoopGapMs {
            loopBMs = min(durationMs, a + Self.defaultLoopJumpMs)
        }
    }

    /// B auf aktuelle Position; A rückt nach, wenn die Reihenfolge kippen würde.
    func setLoopBAtPlayhead() {
        guard durationMs > Self.minLoopGapMs else { return }
        let b = min(durationMs, max(posMs.rounded(), Self.minLoopGapMs))
        loopBMs = b
        if loopAMs > b - Self.minLoopGapMs {
            loopAMs = max(0, b - Self.defaultLoopJumpMs)
        }
    }

    // MARK: - Intern

    private func start() {
        guard let player, displayLink == nil, durationMs > 0 else { return }
        if player.currentTime * 1_000 >= durationMs - 1 { // vom Ende neu starten
            player.currentTime = 0
            posMs = 0
        }
        reduceMotion = UIAccessibility.isReduceMotionEnabled
        player.rate = Float(tempoPercent / 100)
        guard player.play() else {
            fail(with: AudioError.notPlayable)
            return
        }
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

    /// UI-Takt: holt die ECHTE Position aus dem Player (treibt sie nicht an)
    /// und erledigt den A–B-Rücksprung.
    @objc private func tick(_ link: CADisplayLink) {
        guard let player else { return }
        let current = player.currentTime * 1_000

        if loopOn, loopBMs > loopAMs, current >= loopBMs {
            player.currentTime = loopAMs / 1_000
            lastPaint = link.timestamp
            posMs = loopAMs
            return
        }
        if !reduceMotion || link.timestamp - lastPaint > Self.reducedPaintInterval {
            lastPaint = link.timestamp
            posMs = min(current, durationMs)
        }
    }

#if DEBUG
    /// NUR DEBUG-Beweis (`-devAudioProbe YES`): wartet aufs Laden, startet die
    /// Wiedergabe und protokolliert über 3 s die ECHTEN Werte des
    /// AVAudioPlayers — Dauer aus dem Decoder, `isPlaying` und die Position
    /// gegen die Wanduhr. Läuft die Position nicht mit, ist es keine Wiedergabe.
    /// os.Logger statt print: stdout ist an einer Pipe blockgepuffert, die
    /// Zeilen kämen sonst nie an. Abgreifen mit
    /// `xcrun simctl spawn <sim> log stream --predicate 'subsystem == "de.rollsportmanager.v2"'`
    private static let probeLog = Logger(subsystem: "de.rollsportmanager.v2", category: "audio-probe")

    func devProbe(title: String) async {
        for _ in 0..<50 where loadState == .loading {
            try? await _Concurrency.Task.sleep(nanoseconds: 100_000_000)
        }
        guard canPlay, let player else {
            Self.probeLog.error("\(title, privacy: .public): NICHT spielbar — loadState=\(String(describing: self.loadState), privacy: .public)")
            return
        }
        Self.probeLog.notice("\(title, privacy: .public): Datei geladen, Decoder-Dauer=\(String(format: "%.3f", player.duration), privacy: .public) s, Metadaten-Dauer=\(String(format: "%.3f", self.durationMs / 1000), privacy: .public) s")
        togglePlay()
        let wallStart = Date()
        for _ in 0..<3 {
            try? await _Concurrency.Task.sleep(nanoseconds: 1_000_000_000)
            let wall = Date().timeIntervalSince(wallStart)
            Self.probeLog.notice("\(title, privacy: .public): isPlaying=\(player.isPlaying, privacy: .public) Wanduhr=\(String(format: "%.2f", wall), privacy: .public) s Ton-Position=\(String(format: "%.2f", player.currentTime), privacy: .public) s UI-posMs=\(String(format: "%.0f", self.posMs), privacy: .public)")
        }
        Self.probeLog.notice("\(title, privacy: .public): rate=\(player.rate, privacy: .public) tempoPercent=\(String(format: "%.0f", self.tempoPercent), privacy: .public)")

        // Tempo: bei 150 % muss die Ton-Position in 2 s Wanduhr ~3 s zulegen.
        stop()
        seek(0)
        setTempo(150)
        togglePlay()
        let tempoStart = player.currentTime
        let tempoWall = Date()
        try? await _Concurrency.Task.sleep(nanoseconds: 2_000_000_000)
        let advanced = player.currentTime - tempoStart
        let wall2 = Date().timeIntervalSince(tempoWall)
        Self.probeLog.notice("\(title, privacy: .public): TEMPO rate=\(player.rate, privacy: .public) Wanduhr=\(String(format: "%.2f", wall2), privacy: .public) s Ton-Fortschritt=\(String(format: "%.2f", advanced), privacy: .public) s Faktor=\(String(format: "%.2f", advanced / wall2), privacy: .public)")
        stop()
        setTempo(100)

        // A–B-Loop: enge Schleife setzen, Rücksprung muss messbar sein.
        loopAMs = 10_000
        loopBMs = 12_000
        if !loopOn { toggleLoop() }
        seek(11_500)
        togglePlay()
        try? await _Concurrency.Task.sleep(nanoseconds: 1_500_000_000)
        Self.probeLog.notice("\(title, privacy: .public): LOOP an A=\(String(format: "%.0f", self.loopAMs), privacy: .public) B=\(String(format: "%.0f", self.loopBMs), privacy: .public) → Ton-Position nach 1,5 s=\(String(format: "%.2f", player.currentTime), privacy: .public) s (muss zwischen A und B liegen)")
        stop()
        if loopOn { toggleLoop() }
    }
#endif

    // MARK: - AVAudioPlayerDelegate

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        _Concurrency.Task { @MainActor [weak self] in
            guard let self else { return }
            // Am Ende anhalten (Loop hat vorher schon zurückgesprungen).
            self.pause()
            self.posMs = self.durationMs
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        _Concurrency.Task { @MainActor [weak self] in
            self?.fail(with: error ?? AudioError.notPlayable)
        }
    }
}
