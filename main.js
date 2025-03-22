
let STATION_STOP_ID = "635"; // Default stop ID (14 St-Union Sq: downtown)
let DIRECTION = "S"; // Default direction (downtown)
const MTA_GTFS_URLS = [
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
];

let stationsData = {}; // Store stations data
let trainPositions = {};  // Store the positions of the trains

// Load stations from JSON file and populate dropdown menu
async function loadStations() {
    try {
        const response = await fetch('./assets/stations.json');
        const stations = await response.json();
        stationsData = stations;
        populateDropdown(stations);
    } catch (error) {
        console.error("Error loading stations:", error);
    }
}

// Populate dropdown menu with stations
function populateDropdown(stations) {
    const dropdown = document.getElementById('station-select');
    const stationArray = Object.entries(stations).sort((a, b) => a[1].name.localeCompare(b[1].name));
    for (const [id, station] of stationArray) {
        const option = document.createElement('option');
        option.value = id;
        option.text = station.name;
        if (id === STATION_STOP_ID) {
            option.selected = true; // Set the default selection
        }
        dropdown.add(option);
    }
    updateStationName();
}

function updateStationName() {
    const stationNameElement = document.getElementById('station-name');
    const selectedStation = stationsData[STATION_STOP_ID];
    if (selectedStation) {
        stationNameElement.innerText = selectedStation.name;
    }
}


async function fetchGTFS() {
    try {
        const responses = await Promise.all(MTA_GTFS_URLS.map(url => fetch(url)));
        const dataArrays = await Promise.all(responses.map(response => response.arrayBuffer()));
      
        // Load protobuf schema
        const root = await protobuf.load("https://raw.githubusercontent.com/google/transit/master/gtfs-realtime/proto/gtfs-realtime.proto");
        const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

        // Decode GTFS-RT data and combine arrivals
        let combinedArrivals = [];
        dataArrays.forEach(data => {
            const message = FeedMessage.decode(new Uint8Array(data));
            const arrivals = extractStationArrivals(message, STATION_STOP_ID + DIRECTION);
            combinedArrivals = combinedArrivals.concat(arrivals);
        });

        // Update train positions
        combinedArrivals.forEach(train => {
            updateTrain(train.id, train.route, train.arrival.getTime() / 1000, train.direction, combinedArrivals);  
        });

        return combinedArrivals;
        
    } catch (error) {
        console.error("Error fetching GTFS data:", error);
    }    
}

function extractStationArrivals(message, stopId) {
    let arrivals = [];
    const selectedStationStops = Object.keys(stationsData[STATION_STOP_ID].stops);
    if (message.entity) {
        message.entity.forEach(entity => {
            if (entity.tripUpdate) {
                entity.tripUpdate.stopTimeUpdate.forEach(update => {
                    if (selectedStationStops.some(stop => update.stopId.includes(stop)) && new Date().toLocaleTimeString() < new Date(update.arrival.time * 1000).toLocaleTimeString()) {
                        let arrivalTime = new Date(update.arrival.time * 1000); // Convert Unix timestamp
                            arrivals.push({
                                id: entity.tripUpdate.trip.tripId.replace(/\./g, "-"),
                                route: entity.tripUpdate.trip.routeId || "Unknown",
                                stop: update.stopId,
                                direction: update.stopId.slice(-1),
                                arrival: arrivalTime
                            });
                        } else {
                            console.warn(`Skipping update for stopId ${update.stopId} due to missing or invalid arrival time.`);
                        }
                    
                });
            }
        });
    }
    console.log(arrivals);
    
    // Sort by soonest arrival
    return arrivals.sort((a, b) => a.arrival.toLocaleTimeString() - b.arrival.toLocaleTimeString());
}


function updateTrain(id, route, arrivalTime, direction, arrivals) {

    const svg = d3.select('svg');
    const routes = [...new Set(arrivals.map(train => train.route))];

    const activeTrainIds = new Set(arrivals.map(train => train.id));

    const currentTime = new Date().getTime() / 1000;
    const timeRemaining = arrivalTime - currentTime;  // Calculate time remaining for train arrival

    const maxTravelTime = 300; // adjust max travel time
    const maxHeight = window.innerHeight;
    const maxWidth = window.innerWidth;

    // Hide or remove SVGs and text not in the current arrivals
    d3.selectAll('g.train-svg').each(function() {
        const trainSvg = d3.select(this);
        const id = trainSvg.attr('id').replace('train-', '');
        if (!activeTrainIds.has(id)) {
        trainSvg.remove();
        }
    });

    // Create a new SVG element
    let trainSvg = d3.select(`#train-${id}`);
    if (trainSvg.empty()) {
        const svgFile = `./assets/svg-routes/${route}.svg`;
        d3.xml(svgFile).then(data => {
            const importedNode = document.importNode(data.documentElement, true);
            const trainGroup = d3.select('svg').append('g')
                .attr('id', `train-${id}`)
                .attr('class', 'train-svg')
                .attr('margin', 0);

                for (let i = 0; i < maxWidth / 80; i++) {
                    const transform = i % 2 === 0 
                        ? `translate(${i * 80}, 0)` 
                        : `translate(${78+i * 80}, 0) scale(-1, 1)`;
                    trainGroup.append('g')
                        .attr('transform', transform)
                        .node().appendChild(importedNode.cloneNode(true));
                }
            trainPositions[id] = 0;
        });
    }

    // D3 scale: Map time remaining to position along the route
    const yScale = d3.scaleLinear()
        .domain([0, maxTravelTime])  // Time range (0 = arrival, maxTravelTime = farthest away)
        .range(direction === "S" ? [maxHeight, 0]: [0, maxHeight]);


    let position = yScale(Math.max(0, timeRemaining));
    position = Math.round(position / 10) * 10; // Move the position by 8px+2px gap and round the decimal

    d3.select(`#train-${id}`).attr('transform', `translate(0, ${position})`).attr('visibility', 'visible'); // Update the position of the SVG

    // Play sound if the position is at the top or bottom
    if ((direction === "S" && position === maxHeight) || (direction === "N" && position === 0)) {
        playSound();
    }

    trainPositions[id] = position;
}


function playSound() {
    var audio = new Audio('./assets/pew.mp3');
    audio.play();
}

function updateCurrentTime() {
    const currentTimeElement = document.getElementById('current-time');
    const now = new Date();
    currentTimeElement.innerText = `${now.toLocaleTimeString()}`;
}


// Start the real-time updates using the feed data
setInterval(async () => {
    const message = await fetchGTFS();
    if (message) {
        const arrivals = extractStationArrivals(message, STATION_STOP_ID + DIRECTION);
        arrivals.forEach(train => {
            updateTrain(train.id, train.route, train.arrival.getTime() / 1000, train.direction, arrivals);
        });
    }
}, 1000);   // Update every second


window.onload = async function () {
    await loadStations(); 
    fetchGTFS(); // Initial fetch
    setInterval(fetchGTFS, 10000); // Refresh every 10 sec
    setInterval(updateCurrentTime, 1000);

    document.getElementById('station-select').addEventListener('change', function() {
        STATION_STOP_ID = this.value;
        updateStationName();
        fetchGTFS();
    });
}
