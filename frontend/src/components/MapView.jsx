// frontend/src/components/MapView.jsx
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Navigation, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({ schedule, currentLocation, onRouteUpdate }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [trafficLevel, setTrafficLevel] = useState('moderate');
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);

  // Initialize map
  useEffect(() => {
    if (map.current || !schedule?.route?.stops) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1', // Navigation style with traffic
      center: [36.8219, -1.2921], // Nairobi default
      zoom: 12
    });

    map.current.on('load', () => {
      // Add traffic layer
      map.current.addLayer({
        id: 'traffic',
        type: 'line',
        source: {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1'
        },
        'source-layer': 'traffic',
        paint: {
          'line-width': 4,
          'line-color': [
            'case',
            ['==', ['get', 'congestion'], 'low'], '#4CAF50',
            ['==', ['get', 'congestion'], 'moderate'], '#FFC107',
            ['==', ['get', 'congestion'], 'heavy'], '#FF5722',
            ['==', ['get', 'congestion'], 'severe'], '#B71C1C',
            '#9E9E9E'
          ]
        }
      });

      setMapLoaded(true);
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) map.current.remove();
    };
  }, [schedule]);

  // Update route when schedule changes
  useEffect(() => {
    if (!mapLoaded || !schedule?.route?.stops || schedule.route.stops.length < 2) return;

    const stops = schedule.route.stops;
    const coordinates = stops.map(stop => [
      stop.longitude || 36.8219, // Default to Nairobi if no coords
      stop.latitude || -1.2921
    ]);

    // Get route with traffic from Mapbox Directions API
    fetchRoute(coordinates);
  }, [mapLoaded, schedule]);

  // Track driver's current location
  useEffect(() => {
    if (!mapLoaded || !currentLocation) return;

    // Add or update driver marker
    const el = document.createElement('div');
    el.className = 'driver-marker';
    el.style.cssText = `
      width: 30px;
      height: 30px;
      background-color: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;

    new mapboxgl.Marker(el)
      .setLngLat([currentLocation.longitude, currentLocation.latitude])
      .addTo(map.current);

    // Center map on driver
    map.current.flyTo({
      center: [currentLocation.longitude, currentLocation.latitude],
      zoom: 14
    });
  }, [mapLoaded, currentLocation]);

  // Fetch route from Mapbox Directions API
  const fetchRoute = async (coordinates) => {
    try {
      const coordString = coordinates.map(c => c.join(',')).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordString}?geometries=geojson&steps=true&overview=full&annotations=congestion,duration&access_token=${mapboxgl.accessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Add route to map
        if (map.current.getSource('route')) {
          map.current.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          });
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 6,
              'line-opacity': 0.8
            }
          });
        }

        // Add stop markers
        coordinates.forEach((coord, i) => {
          const isFirst = i === 0;
          const isLast = i === coordinates.length - 1;
          
          const el = document.createElement('div');
          el.className = 'stop-marker';
          el.innerHTML = `<div style="
            width: 24px;
            height: 24px;
            background-color: ${isFirst ? '#10B981' : isLast ? '#EF4444' : '#F59E0B'};
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          ">${i + 1}</div>`;

          new mapboxgl.Marker(el)
            .setLngLat(coord)
            .addTo(map.current);
        });

        // Fit map to route bounds
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, { padding: 50 });

        // Calculate traffic level and ETA
        const congestion = route.legs[0].annotation?.congestion || [];
        const heavyCount = congestion.filter(c => c === 'heavy' || c === 'severe').length;
        const trafficPercent = (heavyCount / congestion.length) * 100;

        setTrafficLevel(
          trafficPercent > 50 ? 'heavy' :
          trafficPercent > 25 ? 'moderate' : 'light'
        );

        setEta(Math.round(route.duration / 60)); // minutes
        setDistance((route.distance / 1000).toFixed(1)); // km

        if (onRouteUpdate) {
          onRouteUpdate({
            duration: route.duration,
            distance: route.distance,
            trafficLevel: trafficPercent > 50 ? 'heavy' : trafficPercent > 25 ? 'moderate' : 'light'
          });
        }
      }
    } catch (error) {
      console.error('Route fetch error:', error);
    }
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Traffic Info Overlay */}
      {eta && (
        <div className="absolute top-4 left-4 right-4 flex gap-3">
          {/* ETA Card */}
          <div className="flex-1 backdrop-blur-xl bg-white/90 rounded-xl shadow-lg p-4 border border-white/30">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-medium text-gray-600">ETA</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{eta} min</p>
          </div>

          {/* Distance Card */}
          <div className="flex-1 backdrop-blur-xl bg-white/90 rounded-xl shadow-lg p-4 border border-white/30">
            <div className="flex items-center gap-2 mb-1">
              <Navigation className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-medium text-gray-600">Distance</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{distance} km</p>
          </div>

          {/* Traffic Card */}
          <div className={`flex-1 backdrop-blur-xl rounded-xl shadow-lg p-4 border ${
            trafficLevel === 'heavy' ? 'bg-red-500/90 border-red-600' :
            trafficLevel === 'moderate' ? 'bg-yellow-500/90 border-yellow-600' :
            'bg-green-500/90 border-green-600'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {trafficLevel === 'heavy' ? (
                <AlertTriangle className="h-4 w-4 text-white" />
              ) : (
                <TrendingUp className="h-4 w-4 text-white" />
              )}
              <span className="text-xs font-medium text-white">Traffic</span>
            </div>
            <p className="text-2xl font-bold text-white capitalize">{trafficLevel}</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 backdrop-blur-xl bg-white/90 rounded-xl shadow-lg p-3 border border-white/30">
        <p className="text-xs font-bold text-gray-700 mb-2">Traffic Level</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-green-500 rounded"></div>
            <span className="text-gray-600">Light</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-yellow-500 rounded"></div>
            <span className="text-gray-600">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-orange-500 rounded"></div>
            <span className="text-gray-600">Heavy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-600 rounded"></div>
            <span className="text-gray-600">Severe</span>
          </div>
        </div>
      </div>
    </div>
  );
}