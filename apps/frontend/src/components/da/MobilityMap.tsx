import { useEffect, useRef, useState } from "react";
import "../../styles/mobility-map.css";

/*
 * Vraie carte de la zone de mobilité : fond « Plan IGN » + cercle du rayon
 * à l'échelle réelle. Aucune dépendance ajoutée (pas de Leaflet) : la carte
 * est statique, on n'a besoin que de poser quelques tuiles et un cercle.
 *
 * Services publics français, les mêmes que ceux déjà déclarés dans la
 * politique de confidentialité pour le géocodage :
 * - tuiles : Géoplateforme IGN (WMTS, projection Web Mercator « PM ») ;
 * - géocodage : data.geopf.fr/geocodage (commune + code postal uniquement).
 *
 * Coordonnées : on part de celles déjà géocodées par le serveur. Si la ville
 * ou le code postal changent pendant la saisie (pas encore enregistrés), on
 * géocode côté navigateur pour que la carte suive en direct.
 *
 * Maths de la carte (tuiles « slippy map ») :
 * - à un niveau de zoom z, le monde fait 256 × 2^z pixels ;
 * - un pixel vaut 156 543,03 × cos(latitude) / 2^z mètres ;
 * - on prend le zoom le PLUS PROCHE possible où le cercle tient encore
 *   dans la carte (≈ 90 % de la hauteur) : lecture plus précise ;
 * - les boutons + / − permettent ensuite de zoomer plus (jusqu'aux rues).
 */

const TILE = 256;
const DEFAULT_HEIGHT = 340;
const MIN_ZOOM = 5;
const MAX_ZOOM = 16; // niveau « rue » du Plan IGN
const EARTH_M_PER_PX_Z0 = 156543.03392;

type Coords = { lat: number; lon: number };

const tileUrl = (z: number, x: number, y: number) =>
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM" +
  `&FORMAT=image/png&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;

/** Longitude/latitude → pixel absolu dans le monde au zoom z. */
function project({ lat, lon }: Coords, z: number) {
  const scale = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Zoom entier le plus proche où le cercle tient (rayon ≤ 45 % de la hauteur). */
function zoomFor(radiusKm: number, lat: number, height: number) {
  if (radiusKm <= 0) return 13;
  const metersPerPx = (radiusKm * 1000) / (height * 0.45);
  const z = Math.floor(
    Math.log2(
      (EARTH_M_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180)) / metersPerPx,
    ),
  );
  return Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);
}

/** Géocode « ville + code postal » en direct, avec un petit délai de frappe. */
function useLiveCoords(city: string, postalCode: string, saved: Coords | null) {
  const [coords, setCoords] = useState<Coords | null>(saved);
  const first = useRef(true);
  useEffect(() => {
    // Premier affichage : les coordonnées du serveur suffisent.
    if (first.current && saved) {
      first.current = false;
      return;
    }
    first.current = false;
    const q = city.trim();
    const cp = postalCode.trim();
    if (q.length < 2 && !/^\d{5}$/.test(cp)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: q || cp,
        type: "municipality",
        limit: "1",
      });
      if (/^\d{5}$/.test(cp)) params.set("postcode", cp);
      fetch(`https://data.geopf.fr/geocodage/search?${params}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          const point = data?.features?.[0]?.geometry?.coordinates;
          if (Array.isArray(point)) setCoords({ lon: point[0], lat: point[1] });
        })
        .catch(() => {
          /* hors ligne ou service indisponible : on garde la dernière carte */
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `saved` ne sert volontairement qu'au premier affichage : il n'est pas
    // dans les dépendances, sinon chaque rendu relancerait le géocodage.
  }, [city, postalCode]);
  return coords;
}

export function MobilityMap({
  city,
  postalCode,
  radiusKm,
  saved,
  height = DEFAULT_HEIGHT,
  showLabel = true,
}: {
  city: string;
  postalCode: string;
  radiusKm: number | null;
  saved: Coords | null;
  /** Hauteur de la carte en px (340 sur le profil, moins dans un widget). */
  height?: number;
  /** Étiquette « Ville · X km autour » (inutile si la ville est déjà en titre). */
  showLabel?: boolean;
}) {
  const coords = useLiveCoords(city, postalCode, saved);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Zoom manuel (+ / −), en plus du zoom automatique. Remis à zéro quand
  // le rayon change : la carte recadre alors tout le cercle.
  const [zoomOffset, setZoomOffset] = useState(0);
  useEffect(() => setZoomOffset(0), [radiusKm]);

  // Largeur réelle du cadre (la carte se recalcule au redimensionnement).
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const km = Math.max(radiusKm ?? 0, 0);
  const label = city.trim()
    ? `${city.trim()}${km ? ` · ${km} km autour` : ""}`
    : "";

  if (!coords) {
    return (
      <div
        ref={box}
        className="mobility-map mobility-map--empty"
        style={{ height }}
      >
        <p>Renseignez votre ville pour afficher votre zone de mobilité.</p>
      </div>
    );
  }

  const autoZoom = zoomFor(km, coords.lat, height);
  const z = Math.min(Math.max(autoZoom + zoomOffset, MIN_ZOOM), MAX_ZOOM);
  const center = project(coords, z);
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const metersPerPx =
    (EARTH_M_PER_PX_Z0 * Math.cos((coords.lat * Math.PI) / 180)) / 2 ** z;
  const radiusPx = (km * 1000) / metersPerPx;

  // Tuiles qui recouvrent le cadre.
  const tiles: { x: number; y: number }[] = [];
  if (width > 0) {
    const max = 2 ** z;
    for (
      let ty = Math.floor(top / TILE);
      ty <= Math.floor((top + height) / TILE);
      ty++
    )
      for (
        let tx = Math.floor(left / TILE);
        tx <= Math.floor((left + width) / TILE);
        tx++
      )
        if (ty >= 0 && ty < max) tiles.push({ x: tx, y: ty });
  }

  return (
    <div ref={box} className="mobility-map" style={{ height }}>
      {/* L'image de la carte (tuiles + cercle) porte seule role="img" : les
          boutons de zoom restent à côté, sinon un lecteur d'écran ne les
          atteint pas (règle axe « nested-interactive »). */}
      <div
        className="mobility-map__canvas"
        role="img"
        aria-label={
          km
            ? `Carte : zone de mobilité de ${km} km autour de ${city || "votre commune"}`
            : `Carte : ${city || "votre commune"}`
        }
      >
        <div className="mobility-map__tiles" aria-hidden="true">
          {tiles.map(({ x, y }) => (
            <img
              key={`${z}-${x}-${y}`}
              src={tileUrl(z, ((x % 2 ** z) + 2 ** z) % 2 ** z, y)}
              alt=""
              width={TILE}
              height={TILE}
              decoding="async"
              draggable={false}
              style={{ left: x * TILE - left, top: y * TILE - top }}
            />
          ))}
        </div>

        <svg className="mobility-map__overlay" aria-hidden="true">
          {km > 0 && (
            <circle
              cx="50%"
              cy="50%"
              r={radiusPx}
              className="mobility-map__zone"
            />
          )}
          <circle cx="50%" cy="50%" r="6" className="mobility-map__point" />
        </svg>
      </div>

      {showLabel && label && (
        <span className="mobility-map__label">{label}</span>
      )}

      {/* Zoom manuel : vrais boutons, texte « + » / « − », pas d'icône. */}
      <div className="mobility-map__zoom">
        <button
          type="button"
          aria-label="Zoomer sur la carte"
          disabled={z >= MAX_ZOOM}
          onClick={() => setZoomOffset((offset) => offset + 1)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Dézoomer la carte"
          disabled={z <= MIN_ZOOM}
          onClick={() => setZoomOffset((offset) => offset - 1)}
        >
          −
        </button>
      </div>
      <span className="mobility-map__credit">© IGN – Plan IGN</span>
    </div>
  );
}
