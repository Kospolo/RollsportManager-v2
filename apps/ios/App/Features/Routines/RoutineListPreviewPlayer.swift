import Combine
import Foundation
#if DEBUG
import os
#endif

/// Vorschau-Wiedergabe DIREKT auf der Kür-Kachel der Liste.
///
/// Warum eine eigene kleine Klasse und nicht einfach je Kachel eine
/// `RoutinePlaybackEngine`? Weil in der Liste genau EINE Regel gilt, die eine
/// Engine pro Kachel nicht halten könnte: **es klingt immer nur eine Kür**.
/// Dieser Koordinator hält deshalb höchstens eine Engine gleichzeitig; ein
/// Antippen auf einer anderen Kachel beendet die vorherige hart.
///
/// EHRLICH BLEIBEN (dieselbe Linie wie im Detail-Player):
/// * Küren OHNE hinterlegte Datei bekommen gar keinen Knopf — `hasAudio`
///   entscheidet das in der View, es gibt also keinen toten Knopf.
/// * Solange die Datei lädt, zeigt der Knopf einen Spinner und ist aus.
/// * Schlägt das Laden fehl, wird das gezeigt statt Wiedergabe vorzutäuschen.
///
/// Die eigentliche Tonarbeit macht unverändert `RoutinePlaybackEngine`
/// (AVAudioPlayer, echte Datei über `GET /media/{key}`).
@MainActor
final class RoutineListPreviewPlayer: ObservableObject {

    /// Zustand der EINEN aktiven Kachel (alle anderen sind `.idle`).
    enum State: Equatable {
        case idle
        case loading
        case playing
        case paused
        case failed
    }

    @Published private(set) var activeRoutineId: String?
    @Published private(set) var state: State = .idle

    private var engine: RoutinePlaybackEngine?
    private var observation: AnyCancellable?

    /// Nur Küren mit hinterlegter Datei bekommen überhaupt eine Play-Affordanz.
    static func hasAudio(_ routine: Routine) -> Bool {
        RoutinePlaybackEngine.mediaKey(from: routine.audioUrl) != nil
    }

    /// Zustand einer bestimmten Kachel — nicht-aktive Kacheln sind immer `.idle`.
    func state(for routineId: String) -> State {
        activeRoutineId == routineId ? state : .idle
    }

    /// Antippen: startet die Kür, pausiert die laufende, setzt eine pausierte
    /// fort — und stoppt dabei jede andere Kür.
    func toggle(routine: Routine, api: APIClient) {
        guard Self.hasAudio(routine) else { return }

        if activeRoutineId == routine.id, let engine {
            engine.togglePlay()
            sync()
            return
        }

        stop() // andere Kür verstummt, bevor die neue anfängt
        let newEngine = RoutinePlaybackEngine(durationMs: Double(routine.musicDurationMs ?? 0))
        engine = newEngine
        activeRoutineId = routine.id
        state = .loading
        // objectWillChange feuert VOR der Änderung — der Hop auf den nächsten
        // Main-Turn liest deshalb die schon aktualisierten Werte.
        observation = newEngine.objectWillChange.sink { [weak self] _ in
            _Concurrency.Task { @MainActor in self?.sync() }
        }
        newEngine.load(audioUrl: routine.audioUrl, api: api)
    }

    /// Alles anhalten (Tab-/View-Wechsel, andere Kür, Sprung ins Detail).
    func stop() {
        engine?.stop()
        observation = nil
        engine = nil
        activeRoutineId = nil
        state = .idle
    }

    /// Spiegelt den Engine-Zustand auf die Kachel — und startet die Wiedergabe,
    /// sobald die angetippte Datei spielbereit ist (Autostart nach dem Laden).
    private func sync() {
        guard let engine else { return }
        switch engine.loadState {
        case .loading:
            state = .loading
        case .idle, .failed:
            // `.idle` kann hier nur heißen: kein Key — den filtert `hasAudio`
            // vorher weg. Bleibt der Fehlerfall.
            state = .failed
        case .ready:
            if state == .loading, !engine.isActive { engine.togglePlay() }
            state = engine.isActive ? .playing : .paused
        }
    }

#if DEBUG
    /// NUR DEBUG-Beweis (`-devListAudioProbe YES`): tippt die erste Kür mit
    /// Musik an wie eine Person am Gerät und protokolliert danach den ECHTEN
    /// Zustand — `posMs` kommt aus `AVAudioPlayer.currentTime`, läuft sie mit
    /// der Wanduhr mit, ist es Wiedergabe und keine Behauptung. Danach das
    /// zweite Antippen: die Position muss stehen bleiben.
    /// Abgreifen mit
    /// `xcrun simctl spawn <sim> log stream --predicate 'subsystem == "de.rollsportmanager.v2"'`
    private static let probeLog = Logger(
        subsystem: "de.rollsportmanager.v2",
        category: "list-audio-probe"
    )

    func devProbe(routine: Routine, api: APIClient) async {
        Self.probeLog.notice("KACHEL-PROBE Kür=\(routine.title, privacy: .public) hatAudio=\(Self.hasAudio(routine), privacy: .public)")
        toggle(routine: routine, api: api) // = erstes Antippen auf der Kachel
        for _ in 0..<50 where state == .loading {
            try? await _Concurrency.Task.sleep(nanoseconds: 100_000_000)
        }
        guard let engine else {
            Self.probeLog.error("KACHEL-PROBE: keine Engine — Zustand=\(String(describing: self.state), privacy: .public)")
            return
        }
        let wallStart = Date()
        for _ in 0..<3 {
            try? await _Concurrency.Task.sleep(nanoseconds: 1_000_000_000)
            Self.probeLog.notice("KACHEL-PROBE nach \(String(format: "%.2f", Date().timeIntervalSince(wallStart)), privacy: .public) s: Kachel-Zustand=\(String(describing: self.state), privacy: .public) engine.isPlaying=\(engine.isPlaying, privacy: .public) Ton-Position=\(String(format: "%.2f", engine.posMs / 1000), privacy: .public) s")
        }
        let beforePause = engine.posMs
        toggle(routine: routine, api: api) // = zweites Antippen -> Pause
        try? await _Concurrency.Task.sleep(nanoseconds: 1_000_000_000)
        Self.probeLog.notice("KACHEL-PROBE PAUSE: Zustand=\(String(describing: self.state), privacy: .public) engine.isPlaying=\(engine.isPlaying, privacy: .public) Position vor Pause=\(String(format: "%.2f", beforePause / 1000), privacy: .public) s, 1 s später=\(String(format: "%.2f", engine.posMs / 1000), privacy: .public) s (muss stehen)")
    }

    /// Zweiter Beweis: es klingt IMMER nur eine Kür. Erst A antippen, dann B —
    /// A muss danach still sein, nicht nur optisch, sondern im Player.
    func devProbeExclusive(first: Routine, second: Routine, api: APIClient) async {
        toggle(routine: first, api: api)
        for _ in 0..<50 where state == .loading {
            try? await _Concurrency.Task.sleep(nanoseconds: 100_000_000)
        }
        guard let engineA = engine else {
            Self.probeLog.error("EXKLUSIV-PROBE: Kür A startete nicht")
            return
        }
        try? await _Concurrency.Task.sleep(nanoseconds: 700_000_000)
        Self.probeLog.notice("EXKLUSIV-PROBE A=\(first.title, privacy: .public) spielt=\(engineA.isPlaying, privacy: .public) aktiveKachel=\(self.activeRoutineId ?? "-", privacy: .public)")

        toggle(routine: second, api: api) // Antippen auf der ANDEREN Kachel
        for _ in 0..<50 where state == .loading {
            try? await _Concurrency.Task.sleep(nanoseconds: 100_000_000)
        }
        try? await _Concurrency.Task.sleep(nanoseconds: 700_000_000)
        let engineB = engine
        Self.probeLog.notice("EXKLUSIV-PROBE nach Antippen von B=\(second.title, privacy: .public): A.isPlaying=\(engineA.isPlaying, privacy: .public) (muss false sein) · B.isPlaying=\(engineB?.isPlaying ?? false, privacy: .public) · aktiveKachel=\(self.activeRoutineId ?? "-", privacy: .public) · Zustand=\(String(describing: self.state), privacy: .public)")
        stop()
    }
#endif
}
