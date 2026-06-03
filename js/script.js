// ============================================================
//  Fischerguide – Datenabruf & Darstellung
//  Datenquellen: existenz.ch (Hydro + SMN)
// ============================================================

// ── KONFIGURATION ────────────────────────────────────────────

/** Seen mit zugehörigen API-Standortcodes */
const LAKES = {
    bielersee: { label: "Bielersee", hydroLocation: "2085", smnLocation: "CRM" },
    brienzersee: { label: "Brienzersee", hydroLocation: "2457", smnLocation: "INT" },
    thunersee: { label: "Thunersee", hydroLocation: "2030", smnLocation: "THU" },
};

const HYDRO_BASE = "https://api.existenz.ch/apiv1/hydro/latest";
const SMN_BASE = "https://api.existenz.ch/apiv1/smn/latest";

/** Aktuell ausgewählter See */
let activeLake = "bielersee";

// ── KÖDER-DEFINITIONEN ───────────────────────────────────────

const LURES = {
    gummi: { name: "Gummi", image: "./images/gummi.png" },
    topwater: { name: "Topwater / Wobbler", image: "./images/topwater.png" },
    nymphe: { name: "Nymphe", image: "./images/nymphe.png" },
};

// ── FISCHREGELN ──────────────────────────────────────────────

/**
 * Jede Regel enthält:
 *   name    – Anzeigename
 *   image   – Pfad zur Illustration
 *   lures   – passende Köder
 *   matches – Funktion(windKmh, airTemp) → boolean
 */
const FISH_RULES = [
    {
        name: "Felchen",
        image: "./images/felche.png",
        lures: [LURES.nymphe],
        matches(windKmh, airTemp) {
            const { month, day } = today();
            return inDateRange(month, day, 1, 1, 8, 30) && windKmh <= 10 && airTemp > 5;
        },
    },
    {
        name: "Hecht",
        image: "./images/hecht.png",
        lures: [LURES.gummi],
        matches(windKmh, airTemp) {
            const { month, day } = today();
            return inDateRange(month, day, 5, 1, 2, 29) && windKmh <= 20 && airTemp > 10;
        },
    },
    {
        name: "Egli",
        image: "./images/egli.png",
        lures: [LURES.gummi, LURES.topwater],
        matches(windKmh, airTemp) {
            return windKmh <= 15 && airTemp > 18;
        },
    },
];

// ── DATUM-HILFSFUNKTIONEN ────────────────────────────────────

/** Gibt aktuellen Monat und Tag zurück */
function today() {
    const now = new Date();
    return { month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Prüft ob ein Datum (month/day) in einem Bereich liegt.
 * Unterstützt Jahreswechsel (z. B. Dez–Feb).
 */
function inDateRange(month, day, startM, startD, endM, endD) {
    const cur = month * 100 + day;
    const start = startM * 100 + startD;
    const end = endM * 100 + endD;
    return start <= end
        ? cur >= start && cur <= end
        : cur >= start || cur <= end;
}

/** Gibt alle Fische zurück, deren Bedingungen erfüllt sind */
function getMatchingFish(windKmh, airTemp) {
    return FISH_RULES.filter(f => f.matches(windKmh, airTemp));
}

// ── ALET BEDINGUNGEN ─────────────────────────────────────────

/** Liefert eine Schweizerdeutsche Bewertung der Angelbedingungen basierend auf Windstärke */
function getFishingMessage(windKmh) {
    if (windKmh <= 10) return "Jetzt ischs perle!";
    if (windKmh <= 14) return "Jetzt ischs gäbig";
    if (windKmh <= 20) return "Jetzt ischs ganz okay";
    return "Blib dihei, jetzt fangsch nur Alet!";
}

// ── API-HILFSFUNKTIONEN ──────────────────────────────────────

/**
 * Sucht einen Eintrag im API-Payload nach Standort und Parameter.
 * @param {Array}  payload   - API-Rohdaten
 * @param {string} location  - Standortcode (z. B. "CRM")
 * @param {string} parameter - Parametername (z. B. "ff")
 * @returns {Object|null}
 */
function getLatestValue(payload, location, parameter) {
    if (!Array.isArray(payload)) return null;
    return payload.find(
        d => String(d.loc).toUpperCase() === String(location).toUpperCase() &&
            String(d.par).toLowerCase() === String(parameter).toLowerCase()
    ) ?? null;
}

/**
 * Formatiert einen API-Eintrag als lesbaren String.
 * Gibt "–" zurück, wenn kein Wert vorhanden.
 */
function fmt(entry, decimals = 1) {
    if (!entry || entry.val == null) return "–";
    const unit = entry.unit ? ` ${entry.unit}` : "";
    return `${Number(entry.val).toFixed(decimals)}${unit}`;
}

/** Konvertiert Windrichtung in Grad zu Himmelsrichtung */
function degToCompass(deg) {
    if (deg == null) return "–";
    const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

// ── API-ABRUF ─────────────────────────────────────────────────

/** Ruft Hydro-Daten (Wassertemperatur, Trübheit) ab */
async function fetchHydro(hydroLocation) {
    const res = await fetch(`${HYDRO_BASE}?parameters=turbidity,temperature&locations=${hydroLocation}`);
    if (!res.ok) throw new Error(`Hydro-API Fehler: ${res.status}`);
    return (await res.json()).payload ?? [];
}

/** Ruft SMN-Wetterdaten (Wind, Temperatur) ab */
async function fetchSMN(smnLocation) {
    const res = await fetch(`${SMN_BASE}?parameters=dd,ff,tt&locations=${smnLocation}`);
    if (!res.ok) throw new Error(`SMN-API Fehler: ${res.status}`);
    return (await res.json()).payload ?? [];
}

// ── DOM-UPDATE: ICONS ─────────────────────────────────────────

/**
 * Setzt den angezeigten Wert auf der Rückseite eines Icon-Elements.
 * @param {Element} item       - .icon-item Element
 * @param {string}  label      - Beschriftung unter dem Icon
 * @param {string}  valueText  - Anzeigewert auf der Rückseite
 */
function setIconValue(item, label, valueText) {
    if (!item) return;
    const valueEl = item.querySelector(".icon-value");
    if (valueEl) valueEl.textContent = valueText;
    const labelEl = item.querySelector(".icon-label");
    if (labelEl) labelEl.textContent = label;
}

// ── DOM-UPDATE: FISCHE & KÖDER ────────────────────────────────

/**
 * Rendert den Fisch- und Köder-Bereich neu basierend auf
 * den aktuell passenden Fischen.
 * @param {Array} matches - Gefilterte FISH_RULES-Einträge
 */
function updateFishAndLures(matches) {
    const columns = document.querySelector(".columns");
    if (!columns) return;
    columns.innerHTML = "";

    // Hilfsfunktion: Köder-HTML für einen Fisch erzeugen
    const lureHTML = lure => `
        <div class="lure-item">
            <div class="lure-img"><img src="${lure.image}" alt="${lure.name}"/></div>
            <span class="lure-name">${lure.name}</span>
        </div>`;

    if (!matches || matches.length === 0) {
        // Keine passenden Bedingungen → Fallback-Anzeige
        columns.innerHTML = `
            <div class="fish-section">
                <span class="column-label">Am beste fangsch jetzt:</span>
                <div class="fish-illustration">
                    <img src="./images/alet.png" alt="Alet"/>
                </div>
                <span class="fish-name">Kei Fisch jetzt</span>
            </div>
            <div class="lures-section">
                <span class="column-label">Dezue bruchsch:</span>
                <p style="opacity:0.5;font-size:0.85rem;">–</p>
            </div>`;

    } else if (matches.length === 1) {
        // Einzelner Fisch → klassisches Zwei-Spalten-Layout
        const fish = matches[0];
        columns.innerHTML = `
            <div class="fish-section">
                <span class="column-label">Am beste fangsch jetzt:</span>
                <div class="fish-illustration">
                    <img src="${fish.image}" alt="${fish.name}"/>
                </div>
                <span class="fish-name">${fish.name}</span>
            </div>
            <div class="lures-section">
                <span class="column-label">Dezue bruchsch:</span>
                <div class="lures-grid">${fish.lures.map(lureHTML).join("")}</div>
            </div>`;

    } else {
        // Mehrere Fische → jeder in eigener Zeile
        const rowsHTML = matches.map(fish => `
            <div class="fish-lure-row">
                <div class="fish-col">
                    <div class="fish-illustration">
                        <img src="${fish.image}" alt="${fish.name}"/>
                    </div>
                    <span class="fish-name">${fish.name}</span>
                </div>
                <div class="lures-col">
                    <div class="lures-grid">${fish.lures.map(lureHTML).join("")}</div>
                </div>
            </div>`).join("");

        columns.innerHTML = `
            <div class="multi-fish-section">
                <div class="multi-labels">
                    <span class="column-label">Am beste fangsch jetzt:</span>
                    <span class="column-label">Dezue bruchsch:</span>
                </div>
                ${rowsHTML}
            </div>`;
    }
}

// ── GESAMT-UPDATE ─────────────────────────────────────────────

/**
 * Verarbeitet API-Payloads und aktualisiert alle UI-Elemente.
 * @param {Array}  hydroPayload - Hydro-API-Daten
 * @param {Array}  smnPayload   - SMN-API-Daten
 * @param {Object} cfg          - See-Konfiguration aus LAKES
 */
function updateAll(hydroPayload, smnPayload, cfg) {
    // Rohdaten extrahieren
    const wind = getLatestValue(smnPayload, cfg.smnLocation, "ff");
    const airTemp = getLatestValue(smnPayload, cfg.smnLocation, "tt");
    const windDir = getLatestValue(smnPayload, cfg.smnLocation, "dd");
    const waterTemp = getLatestValue(hydroPayload, cfg.hydroLocation, "temperature");
    const turbidity = getLatestValue(hydroPayload, cfg.hydroLocation, "turbidity");

    // Icons mit Messwerten befüllen
    const iconItems = document.querySelectorAll(".icon-item");
    setIconValue(iconItems[0], "Windgeschwindigkeit", fmt(wind));
    setIconValue(iconItems[1], "Lufttemperatur", fmt(airTemp));
    setIconValue(iconItems[2], "Windrichtung", windDir?.val != null ? degToCompass(windDir.val) : "–");
    setIconValue(iconItems[3], "Wassertemperatur", fmt(waterTemp));
    setIconValue(iconItems[4], "Wassertrübheit", fmt(turbidity));

    const windKmh = wind?.val != null ? Number(wind.val) : null;
    const airTempVal = airTemp?.val != null ? Number(airTemp.val) : null;

    // Wettermeldung setzen
    const msg = document.querySelector(".main-message");
    if (msg) msg.textContent = windKmh != null ? getFishingMessage(windKmh) : "Jetzt ischs gäbig";

    // Passende Fische ermitteln und anzeigen
    const matches = (windKmh != null && airTempVal != null)
        ? getMatchingFish(windKmh, airTempVal)
        : [];
    updateFishAndLures(matches);
}

// ── LADEINDIKATOR & FEHLERBEHANDLUNG ─────────────────────────

/** Zeigt/versteckt den Ladezustand in der Hauptnachricht */
function setLoadingState(loading) {
    const msg = document.querySelector(".main-message");
    if (!msg) return;
    msg.textContent = loading ? "Lade Daten…" : msg.textContent;
    msg.style.opacity = loading ? "0.5" : "";
}

/** Zeigt eine Fehlermeldung im UI und loggt in die Konsole */
function showError(err) {
    const msg = document.querySelector(".main-message");
    if (msg) {
        msg.textContent = "⚠ Fehler beim Laden";
        msg.style.opacity = "0.7";
    }
    console.error("[Fischerguide]", err);
}

// ── HAUPT-LADEFUNKTION ────────────────────────────────────────

/**
 * Ruft Hydro- und SMN-Daten parallel ab und aktualisiert das UI.
 * @param {string} lakeKey - Schlüssel aus LAKES (z. B. "bielersee")
 */
async function loadData(lakeKey) {
    const cfg = LAKES[lakeKey];
    if (!cfg) return;

    setLoadingState(true);
    try {
        const [hydroPayload, smnPayload] = await Promise.all([
            fetchHydro(cfg.hydroLocation),
            fetchSMN(cfg.smnLocation),
        ]);
        updateAll(hydroPayload, smnPayload, cfg);
    } catch (err) {
        showError(err);
    } finally {
        setLoadingState(false);
    }
}

// ── SEE-AUSWAHL (DESKTOP) ─────────────────────────────────────

/** Initialisiert die klickbare See-Liste im Desktop-Header */
function initLakeSelector() {
    const lakeKeys = Object.keys(LAKES);
    document.querySelectorAll(".lake-selector .lake-option").forEach((opt, i) => {
        opt.addEventListener("click", () => {
            document.querySelectorAll(".lake-dot").forEach(d => d.classList.remove("active"));
            opt.querySelector(".lake-dot").classList.add("active");
            activeLake = lakeKeys[i];
            loadData(activeLake);
        });
    });
    // Ersten See als aktiv markieren
    document.querySelector(".lake-selector .lake-dot")?.classList.add("active");
}

// ── DROPDOWN-MENÜ (MOBILE) ────────────────────────────────────

/** Initialisiert den mobilen Dropdown für die See-Auswahl */
function initMobileDropdown() {
    const trigger = document.getElementById("lakeTrigger");
    const dropdown = document.getElementById("lakeDropdown");
    const label = document.getElementById("triggerLabel");
    if (!trigger || !dropdown) return;

    const lakeKeys = Object.keys(LAKES);
    const lakeLabels = Object.values(LAKES).map(l => l.label);

    // Öffnen/Schliessen via Trigger-Button
    trigger.addEventListener("click", e => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
        trigger.classList.toggle("open");
    });

    // Klick ausserhalb schliesst das Menü
    document.addEventListener("click", () => {
        dropdown.classList.remove("open");
        trigger.classList.remove("open");
    });

    // See-Optionen im Dropdown
    dropdown.querySelectorAll(".lake-option").forEach((opt, i) => {
        opt.addEventListener("click", e => {
            e.stopPropagation();

            // Aktive Option hervorheben
            dropdown.querySelectorAll(".lake-option").forEach(o => o.classList.remove("active-option"));
            opt.classList.add("active-option");

            // Desktop-Dots synchronisieren
            document.querySelectorAll(".lake-selector .lake-dot").forEach(d => d.classList.remove("active"));
            document.querySelectorAll(".lake-selector .lake-dot")[i]?.classList.add("active");

            // Trigger-Label & Daten aktualisieren
            if (label) label.textContent = lakeLabels[i];
            activeLake = lakeKeys[i];
            loadData(activeLake);
            dropdown.classList.remove("open");
            trigger.classList.remove("open");
        });
    });

    // Erste Option als aktiv markieren
    dropdown.querySelector(".lake-option")?.classList.add("active-option");
}

// ── FLIP-ANIMATION ────────────────────────────────────────────

/** Lässt die Icons nach dem Laden der Seite zur Wertseite umklappen */
function flipAllIcons() {
    document.querySelectorAll(".icon-flip").forEach((flip, i) => {
        setTimeout(() => flip.classList.add("flipped"), 1200 + i * 80);
    });
}

// ── INITIALISIERUNG ───────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    initLakeSelector();
    initMobileDropdown();
    loadData(activeLake);
    flipAllIcons();
    // Daten alle 5 Minuten aktualisieren
    setInterval(() => loadData(activeLake), 5 * 60 * 1000);
});