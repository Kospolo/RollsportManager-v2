import SwiftUI

/// Registry-Einhängepunkt des Übungen-Moduls (Web-Referenz: /(portal)/uebungen).
/// `MehrCatalog` (READ-ONLY, `Features/Mehr/MehrModel.swift`) verweist auf
/// `ExercisesRootView()` — dieser Typ bleibt der stabile Aufrufpunkt und
/// delegiert an die öffentliche Root-View `ExercisesView`, in der die native
/// Umsetzung liegt (analog `NewsRootView` → `NewsView`).
struct ExercisesRootView: View {
    var body: some View {
        ExercisesView()
    }
}
