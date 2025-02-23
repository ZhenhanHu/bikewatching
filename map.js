// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoiemhlbmhhbmh1IiwiYSI6ImNtN2VoOG53cTBkbTkya3B3bGVsdjdxMXMifQ.RvTS7N0DZZzMjcNjjoXxgg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/zhenhanhu/cm7ei06j2004j01sg3as0bos6',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
});

const svg = d3.select('#map').select('svg');
let stations = [];
let trips = [];
let circles;
let radiusScale;
let timeFilter = -1;
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
    const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

    return stations.map(station => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

function updatePositions() {
    if (!circles) return;
    circles
        .attr('cx', d => getCoords(d).cx)
        .attr('cy', d => getCoords(d).cy)
        .attr('r', d => radiusScale(d.totalTraffic));
}

map.on('load', async () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: { 'line-color': '#32D400', 'line-width': 6, 'line-opacity': 0.5 }
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: { 'line-color': '#32D400', 'line-width': 6, 'line-opacity': 0.5 }
    });

    // Load bike station data
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    let jsonData = await d3.json(jsonurl);
    console.log('Loaded JSON Data:', jsonData);

    // Load and parse trip data
    const trafficDataURL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    trips = await d3.csv(trafficDataURL, trip => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        return trip;
    });

    stations = computeStationTraffic(jsonData.data.stations, trips);

    radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(stations, d => d.totalTraffic)])
        .range([0, 25]);

    circles = svg.selectAll('circle')
        .data(stations, d => d.short_name)
        .enter()
        .append('circle')
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .each(function(d) {
            d3.select(this).append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });

    updatePositions();
    updateTimeDisplay();
});

map.on('move', updatePositions);
map.on('zoom', updatePositions);
map.on('resize', updatePositions);
map.on('moveend', updatePositions);

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time-label');

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
    return timeFilter === -1 ? trips : trips.filter(trip => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return Math.abs(startedMinutes - timeFilter) <= 60 || Math.abs(endedMinutes - timeFilter) <= 60;
    });
}

function updateScatterPlot(timeFilter) {
    if (!radiusScale) {
        console.error("radiusScale is not defined yet."); //Debugging part
        return;
    }
    const filteredTrips = filterTripsByTime(trips, timeFilter);
    const filteredStations = computeStationTraffic(stations, filteredTrips);

    radiusScale.range(timeFilter === -1 ? [0, 25] : [3, 50]);

    circles.data(filteredStations, d => d.short_name)
        .join('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic));
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
        selectedTime.style.display = 'none';
        anyTimeLabel.style.display = 'block';
    } else {
        selectedTime.textContent = formatTime(timeFilter);
        selectedTime.style.display = 'block';
        anyTimeLabel.style.display = 'none';
    }

    updateScatterPlot(timeFilter);
}

timeSlider.addEventListener('input', () => {
    if (radiusScale) updateTimeDisplay();
});