/**
 * Inline-Script gegen den Theme-Flash: läuft synchron im <head>,
 * bevor der Browser das erste Mal malt. Setzt data-theme am <html>
 * aus localStorage (Fallback: "auto" — tokens.css folgt dann dem
 * System via prefers-color-scheme).
 *
 * Wird im Root-Layout per dangerouslySetInnerHTML eingebettet —
 * bewusst ohne Abhängigkeiten und in einer Zeile ES5-kompatibel.
 */
export const themeInitScript = `(function(){try{var m=localStorage.getItem("rsm.theme");if(m!=="light"&&m!=="dark"&&m!=="auto"){m="auto"}document.documentElement.setAttribute("data-theme",m)}catch(e){document.documentElement.setAttribute("data-theme","auto")}})();`;
