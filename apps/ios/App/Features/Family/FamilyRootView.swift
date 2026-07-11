import SwiftUI

/// Registry-Einhängepunkt des Familie-Moduls (Web-Referenz: /(portal)/familie).
/// `MehrCatalog` (READ-ONLY) verweist auf `FamilyRootView()` — der Typname
/// bleibt daher stabil. Die native Umsetzung liegt in der öffentlichen
/// `FamilyView`; dieser Root ist nur der dünne Einhängepunkt.
struct FamilyRootView: View {
    var body: some View {
        FamilyView()
    }
}
