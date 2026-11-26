# TerraCast-3D
an interactive 3D Procedural Terrain &amp; Weather Sandbox

## Waymark map providers

- **Imagery:** Esri World Imagery.
- **Street labels:** MapTiler Streets v2, layered over Esri imagery.
- **Address search and reverse geocoding:** Nominatim.
- **Nearby quick-search categories:** Overpass API.
- **Walking routes:** Valhalla pedestrian routing with a living-streets preference.

To enable MapTiler street labels, create a MapTiler API key and set
`NEXT_PUBLIC_MAPTILER_KEY` in `.env.local`, then restart the development server.
This key is sent to browsers, so restrict it to your app's allowed domains in
MapTiler. Do not commit `.env.local`.

The public Nominatim, Overpass, and Valhalla endpoints are community services
with their own usage limits; use providers or hosted instances appropriate to
your expected production traffic.
