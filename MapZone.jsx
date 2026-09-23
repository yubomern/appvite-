import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buzz } from "./lib";

const TUNIS = [36.8065, 10.1815];
const SPOTS = [["rubik", "Rubik cube", -0.6, 0.8], ["runner", "Infinite runner", 0.7, 0.5], ["flyer", "Coin flyer", 0.1, -0.9]];

export default function MapZone({ go }) {
  const el = useRef(), circle = useRef(), [radius, setRadius] = useState(500), [info, setInfo] = useState("Locating you…");
  useEffect(() => {
    const map = L.map(el.current).setView(TUNIS, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
    const place = ([lat, lng], msg) => {
      map.setView([lat, lng], 15);
      L.circleMarker([lat, lng], { radius: 9, color: "#2a6fdb", fillOpacity: 1 }).addTo(map).bindTooltip("You");
      circle.current = L.circle([lat, lng], { radius: 500, color: "#e4372c", fillOpacity: 0.08 }).addTo(map);
      SPOTS.forEach(([id, name, dy, dx]) =>
        L.circleMarker([lat + dy * 0.003, lng + dx * 0.003], { radius: 11, color: "#1b2340", fillColor: "#f6c90e", fillOpacity: 1 })
          .addTo(map).bindTooltip(name, { permanent: true, direction: "top" }).on("click", () => { buzz(30); go(id); }));
      setInfo(msg);
    };
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition((p) => place([p.coords.latitude, p.coords.longitude], "Your zone, centred on your position."),
          () => place(TUNIS, "Location blocked — showing Tunis. Allow location in your browser to centre the map on you."))
      : place(TUNIS, "Geolocation is not available — showing Tunis.");
    return () => map.remove();
  }, []);
  useEffect(() => { circle.current?.setRadius(radius); }, [radius]);
  return (
    <section className="panel">
      <header><h2>My zone</h2><b>{radius} m</b></header>
      <div ref={el} className="map" />
      <label className="row">Zone radius <input type="range" min="200" max="3000" step="100" value={radius} onChange={(e) => setRadius(+e.target.value)} /></label>
      <p className="muted">{info} Tap a yellow marker to open its game.</p>
    </section>
  );
}
