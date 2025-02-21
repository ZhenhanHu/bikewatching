// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoiemhlbmhhbmh1IiwiYSI6ImNtN2VoOG53cTBkbTkya3B3bGVsdjdxMXMifQ.RvTS7N0DZZzMjcNjjoXxgg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/zhenhanhu/cm7ei06j2004j01sg3as0bos6', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

const svg = d3.select('#map').select('svg');
let stations = [];
let circles;
let radiusScale;
let timeFilter = -1;

map.on('load', () => { 
    // bike lane data source: Boston
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    // bike lanes layer: Boston
    map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
        'line-color': '#32D400',
        'line-width': 6,
        'line-opacity': 0.5
        }
    });

    // bike lane data source: Cambridge
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    // bike lanes layer: Cambridge
    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 6,
            'line-opacity': 0.5
            }
    });

    // Load the nested JSON file
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
        stations = jsonData.data.stations;
        console.log('Stations Array:', stations);
        // NOTE: stations data loads before "traffic data"

        const trafficDataURL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        d3.csv(trafficDataURL).then(tripsData => {
            console.log('Loaded Traffic Data:', tripsData); // Verify dataset structure
        
            // Process the traffic data in Step 4.2
            processTrafficData(tripsData);
            // NOW HAVE INFO: departures, arrivals, stations, and radiusScale
    
            // NOTE: Traffic data is processed before appending circles
            // Append circles to the SVG for each station
            circles = svg.selectAll('circle')
                .data(stations)
                .enter()
                .append('circle')
                .attr('r', 5)  // Radius of the circle
                .attr('fill', 'steelblue')  // Circle fill color
                .attr('stroke', 'white')  // Circle border color
                .attr('stroke-width', 1)  // Circle border thickness
                .attr('opacity', 0.8) // Circle opacity
                .each(function(d) {
                    // Add <title> for browser tooltips
                    d3.select(this)
                      .append('title')
                      .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                  });
    
            // Initial position update when map loads
            updatePositions();
        }).catch(error => {
            console.error('Error loading traffic CSV:', error);
        });
    }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });
});

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
  }

// Function to update circle positions when the map moves/zooms
function updatePositions() {
    circles
        .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
        .attr('cy', d => getCoords(d).cy) // Set the y-position using projected coordinates
        .attr('r', d => radiusScale(d.totalTraffic)); // Dynamically scaled radius
    }

// Reposition markers on map interactions
map.on('move', updatePositions);     // Update during map movement
map.on('zoom', updatePositions);     // Update during zooming
map.on('resize', updatePositions);   // Update on window resize
map.on('moveend', updatePositions);  // Final adjustment after movement ends

function processTrafficData(tripsData) {
    // Compute departures: count trips starting at each station
    const departures = d3.rollup(
        tripsData,
        v => v.length,
        d => d.start_station_id
    );

    // Compute arrivals: count trips ending at each station
    const arrivals = d3.rollup(
        tripsData,
        v => v.length,
        d => d.end_station_id
    );

    console.log('Departures:', departures);
    console.log('Arrivals:', arrivals);

    // Add traffic data to each station
    stations = stations.map(station => {
        let id = station.short_name;

        station.arrivals = arrivals.get(id) ?? 0; // Default to 0 if undefined
        station.departures = departures.get(id) ?? 0; // Default to 0 if undefined
        station.totalTraffic = station.arrivals + station.departures;

        return station;
    });

    console.log('Updated Stations with Traffic Data:', stations);

    radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);
}

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);  // Get slider value

    if (timeFilter === -1) {
        selectedTime.textContent = formatTime(1439);  // Clear time display
        anyTimeLabel.style.display = 'block';  // Show "(any time)"
    } else {
        selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
        anyTimeLabel.style.display = 'none';  // Hide "(any time)"
    }

    // Trigger filtering logic which will be implemented in the next step
}

timeSlider.addEventListener('input', updateTimeDisplay);

updateTimeDisplay();
