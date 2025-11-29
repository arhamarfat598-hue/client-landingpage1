// ======================
// CONFIG – RAPIDAPI (AeroDataBox)
// ======================

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";

// ⚠️ YAHAN APNI REAL RAPIDAPI KEY DAALO (double quotes ke andar)
const RAPIDAPI_KEY = "05120d0619mshbf8a5b27be89422p1f835bjsn00ec12905763";

// Aviation average cost per km in USD
const USD_PER_KM = 0.11;

// ======================
// DOM ELEMENTS
// ======================

const form = document.getElementById("searchForm");
const statusEl = document.getElementById("searchStatus");
const resultsEl = document.getElementById("apiResults");
const fromInput = document.getElementById("from");
const toInput = document.getElementById("to");
const dateInput = document.getElementById("date");
const passengersInput = document.getElementById("passengers");
const classInput = document.getElementById("cls");

// Default date = today
(function setToday() {
  if (!dateInput) return;
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
})();

// ======================
// STATUS UI
// ======================

function setStatus(type, text) {
  if (!statusEl) return;
  if (!text) {
    statusEl.innerHTML = "";
    return;
  }

  const cls =
    type === "error" ? "error" : type === "success" ? "success" : "";

  statusEl.innerHTML = `
    <div class="pill ${cls}">
      <span class="dot"></span>
      <span>${text}</span>
    </div>
  `;
}

// ======================
// GENERIC API FETCH
// ======================

async function aeroFetch(path, params = null) {
  let url = `https://${RAPIDAPI_HOST}${path}`;

  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} – ${text}`);
  }

  return res.json();
}

// ======================
// AIRPORT SEARCH (BY NAME / CITY / CODE)
// GET /airports/search/term?q={term}&limit=5
// ======================

async function findAirport(term) {
  const data = await aeroFetch("/airports/search/term", {
    q: term,
    limit: 5
  });

  const items = Array.isArray(data) ? data : data.items;

  if (!items || items.length === 0) return null;

  const a = items.find((x) => x.iata && x.iata.length > 0) || items[0];

  return {
    name: a.name || a.shortName || "",
    iata: a.iata || "",
    icao: a.icao || "",
    city: a.municipalityName || a.city || "",
    country: a.countryCode || ""
  };
}

// ======================
// DISTANCE + FLIGHT TIME
// GET /airports/iata/{from}/distance-time/{to}
// ======================

async function getDistanceTime(fromIata, toIata) {
  const data = await aeroFetch(
    `/airports/iata/${encodeURIComponent(
      fromIata
    )}/distance-time/${encodeURIComponent(toIata)}`,
    { flightTimeModel: "ML01" }
  );

  console.log("DistanceTime response:", data); // debugging ke liye

  return data;
}

// ======================
// SIMPLE HELPERS – distance & duration nikalne ke liye
// ======================

function getDistanceKm(obj) {
  if (!obj || typeof obj !== "object") return null;

  if (typeof obj.distanceKm === "number") return obj.distanceKm;

  if (obj.greatCircleDistance && typeof obj.greatCircleDistance.km === "number") {
    return obj.greatCircleDistance.km;
  }

  if (typeof obj.km === "number") return obj.km;

  return null;
}

function formatIsoDuration(iso) {
  if (!iso || typeof iso !== "string") return null;
  if (!iso.startsWith("PT")) return iso;

  let hours = 0;
  let minutes = 0;

  const hMatch = iso.match(/(\d+)H/);
  const mMatch = iso.match(/(\d+)M/);

  if (hMatch) hours = parseInt(hMatch[1], 10);
  if (mMatch) minutes = parseInt(mMatch[1], 10);

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  if (minutes) return `${minutes}m`;
  return iso;
}

function getDurationText(obj) {
  if (!obj || typeof obj !== "object") return null;

  if (obj.flightTimeFormatted) return obj.flightTimeFormatted;

  if (obj.flightTime) {
    const f = formatIsoDuration(obj.flightTime);
    if (f) return f;
  }

  const mins =
    obj.flightTimeMinutes ||
    obj.flightDurationMinutes ||
    obj.durationMinutes;

  if (typeof mins === "number") {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    if (m) return `${m}m`;
  }

  return null;
}

// ======================
// RESULT CARD RENDER
// ======================

function renderResultCard({ from, to, date, passengers, travelClass, distance }) {
  let distanceText = "N/A";
  let timeText = "N/A";
  let priceText = "$--";

  const km = getDistanceKm(distance);
  if (km != null) {
    distanceText = `${km.toLocaleString("en-US")} km`;
    const usd = km * USD_PER_KM;
    priceText = `$${usd.toFixed(2)} USD`;
  }

  const duration = getDurationText(distance);
  if (duration) {
    timeText = duration;
  }

  const html = `
    <article class="result-card">
      <div class="result-route">
        ${from.city || from.name || from.iata} → ${to.city || to.name || to.iata}
        <span class="result-codes">(${from.iata || from.icao} → ${to.iata || to.icao})</span>
      </div>

      <div class="result-sub">
        ${from.name || "Unknown origin"} • ${to.name || "Unknown destination"}
      </div>

      <div class="result-main-row">
        <div>
          <div class="result-label">Estimated one-way fare (USD, based on AeroDataBox distance)</div>
          <div class="result-price">${priceText}</div>
        </div>
      </div>

      <div class="result-meta">
        <div><strong>Distance:</strong> ${distanceText}</div>
        <div><strong>Duration:</strong> ${timeText}</div>
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Passengers:</strong> ${passengers}</div>
        <div><strong>Class:</strong> ${travelClass}</div>
      </div>
    </article>
  `;

  resultsEl.insertAdjacentHTML("beforeend", html);
}

// ======================
// FORM SUBMIT
// ======================

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fromText = fromInput.value.trim();
    const toText = toInput.value.trim();
    const date = dateInput.value;
    const passengers = passengersInput.value;
    const travelClass = classInput.value;

    if (!fromText || !toText || !date) {
      alert("Please fill From, To & Date.");
      return;
    }

    resultsEl.innerHTML = "";
    setStatus("loading", "Searching airports & fetching distance / time...");

    try {
      const [fromAirport, toAirport] = await Promise.all([
        findAirport(fromText),
        findAirport(toText)
      ]);

      if (!fromAirport || !toAirport) {
        setStatus(
          "error",
          "Airport not found. Try 'Delhi DEL', 'Dubai DXB', etc."
        );
        return;
      }

      if (!fromAirport.iata || !toAirport.iata) {
        setStatus(
          "error",
          "One airport is missing an IATA code. Try another airport/city."
        );
        return;
      }

      const distance = await getDistanceTime(fromAirport.iata, toAirport.iata);

      renderResultCard({
        from: fromAirport,
        to: toAirport,
        date,
        passengers,
        travelClass,
        distance
      });

      setStatus("success", "Result loaded successfully.");

      try {
        localStorage.setItem(
          "flysmartLastSearch",
          JSON.stringify({ from: fromText, to: toText, date })
        );
      } catch (_) {}

      document
        .getElementById("results")
        .scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        "API error: " +
          (err && err.message
            ? err.message
            : "Please check RapidAPI key / network.")
      );
    }
  });
}

// ======================
// PREFILL LAST SEARCH
// ======================

(function prefillLastSearch() {
  try {
    const raw = localStorage.getItem("flysmartLastSearch");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.from) fromInput.value = data.from;
    if (data.to) toInput.value = data.to;
    if (data.date) dateInput.value = data.date;
  } catch (_) {}
})();
