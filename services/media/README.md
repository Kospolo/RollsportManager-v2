# services/media

Später: der Medien-Service.

- Uploads via TUS (resumable)
- Waveform-Peaks-Erzeugung (ffmpeg/audiowaveform) für den Küren-Player
- Signierte URLs für Storage-Zugriffe

Regel aus dem Blueprint: In der Datenbank liegen nur Metadaten (`storage_path`, `sha256`, `size_bytes`, `mime_type`, `duration_ms`, `waveform_peaks`) — Binärdaten ausschließlich in Storage, nie Base64-Spalten.
