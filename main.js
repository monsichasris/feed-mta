
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

// Load stations from JSON file and populate dropdown menu
async function loadStations() {
    try {
        const response = await fetch('./assets/stations.json');
        const stations = await response.json();
        stationsData = stations; // Store stations data
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

    // Add event listener to update station name
    dropdown.addEventListener('change', function() {
        const selectedStation = stations[this.value];
        document.getElementById('station-name').innerText = selectedStation.name;
        STATION_STOP_ID = this.value;
        fetchGTFS(); // Fetch data for the selected station
    });
}


async function fetchGTFS() {
    try {
        console.log(`Fetching GTFS data for station: ${STATION_STOP_ID}, direction: ${DIRECTION}`);
        
        // Fetch GTFS-RT feed from all URLs
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

        // Update the table
        updateTable(combinedArrivals);

        // Update train positions
        combinedArrivals.forEach(train => {
            updateTrain(train.id, train.route, train.arrival.getTime() / 1000, combinedArrivals);  
        });

        return combinedArrivals;
        
    } catch (error) {
        console.error("Error fetching GTFS data:", error);
    }    

    // document.getElementById("status").innerText = `Last updated: ${new Date().toLocaleTimeString()}`;
}

function extractStationArrivals(message, stopId) {
    let arrivals = [];
    const selectedStationStops = Object.keys(stationsData[STATION_STOP_ID].stops);
    console.log("Selected stations " + selectedStationStops);
    // console.log(message.entity);
    if (message.entity) {
        message.entity.forEach(entity => {
            if (entity.tripUpdate) {
                entity.tripUpdate.stopTimeUpdate.forEach(update => {
                    if (selectedStationStops.some(stop => update.stopId.includes(stop)) && new Date().toLocaleTimeString() < new Date(update.arrival.time * 1000).toLocaleTimeString()) {
                        let arrivalTime = new Date(update.arrival.time * 1000); // Convert Unix timestamp
                        if (selectedStationStops.some(stop => update.stopId === stop + DIRECTION)) { // Check direction
                            arrivals.push({
                                id: entity.tripUpdate.trip.tripId.replace(/\./g, "-"),
                                route: entity.tripUpdate.trip.routeId || "Unknown",
                                stop: update.stopId,
                                arrival: arrivalTime
                            });
                        }
                    }
                });
            }
        });
    }
    console.log(arrivals);
    
    // Sort by soonest arrival
    return arrivals.sort((a, b) => a.arrival.toLocaleTimeString() - b.arrival.toLocaleTimeString());
}

function updateTable(arrivals) {
    let tableBody = document.getElementById("train-arrivals");
    tableBody.innerHTML = ""; // Clear old rows

    if (arrivals.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="2">No upcoming trains.</td></tr>`;
        return;
    }

    arrivals.forEach(train => {
        let row = `<tr>
            <td>${train.route}</td>
            <td>${train.arrival.toLocaleTimeString()}</td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

let trainPositions = {};  // Store the positions of the trains

function updateTrain(id, route, arrivalTime, arrivals) {

    // Remove old lines
    d3.selectAll('line').remove();

    const svg = d3.select('svg');
    const routes = [...new Set(arrivals.map(train => train.route))];

    routes.forEach((route, index) => {
        // console.log(`Creating new line for route: ${route}, index: ${index}`);
        svg.append('line')
            .attr('id', `route-${route}`)
            .attr('x1', 0)
            .attr('y1', 50 + index * 50)
            .attr('x2', window.innerWidth)
            .attr('y2', 50 + index * 50)
            .attr('stroke', '#000')
            .attr('stroke-width', 2)
            .lower();
    });

    const activeTrainIds = new Set(arrivals.map(train => train.id));

    // Hide or remove circles and text not in the current arrivals
    d3.selectAll('circle').each(function() {
        const circle = d3.select(this);
        const id = circle.attr('id').replace('train-', '');
        if (!activeTrainIds.has(id)) {
            circle.remove();
        }
    });

    d3.selectAll('text').each(function() {
        const text = d3.select(this);
        const id = text.attr('id').replace('text-', '');
        if (!activeTrainIds.has(id)) {
            text.remove();
        }
    });
    
    let circle = d3.select(`#train-${id}`);
    let text = d3.select(`#text-${id}`);
    if (circle.empty()) {
        // console.log(`Creating new circle for trainId: ${id}`);
        circle = d3.select('svg').append('circle')
                    .attr('id', `train-${id}`)
                    .attr('r', 20) 
                    .attr('cy', 50 + routes.indexOf(route) * 50)
                    .attr('fill', () => {
                        switch (route) {
                            case '4':
                            case '5':
                            case '6':
                                return '#00933C'; // green for 456 lines
                            case '1':
                            case '2':
                            case '3':
                                return '#EE352E'; // red for 123 lines
                            case '7':
                                return '#B933AD'; // purple for 7 line
                            case 'N':
                            case 'W':
                            case 'Q':
                            case 'R':
                                return '#FCCC0A'; // yellow for NWQR lines
                            case 'B':
                            case 'D':
                            case 'F':
                            case 'M':
                                return '#FF6319'; // orange for BDFM lines
                            case 'A':
                            case 'C':
                            case 'E':
                                return '#0039A6'; // blue for ACE lines
                            case 'J':
                            case 'Z':
                                return '#996633'; // brown for JZ lines
                            case 'L':
                                return '#A7A9AC'; // gray for L line
                            case 'G':
                                return '#6CBE45'; // light green for G line
                            default:
                                return '#808183'; // default color
                        }
                    });
        text = d3.select('svg').append('text')
                        .attr('id', `text-${id}`)
                        .attr('y', circle.attr('cy'))
                        .attr('dy', '.35em')
                        .attr('text-anchor', 'middle')
                        .attr('fill', 'white')
                        .style('font-family', 'Helvetica')
                        .style('font-weight', 'bold')
                        .style('font-size', '20px')
                        .text(route);
        trainPositions[id] = 0;
    }

    const currentTime = new Date().getTime() / 1000;
    const timeRemaining = arrivalTime - currentTime;  // Calculate time remaining for train arrival

    const maxTravelTime = 100; // 3 minutes max travel time
    const maxWidth = window.innerWidth;

    // D3 scale: Map time remaining to position along the route
    const xScale = d3.scaleLinear()
        .domain([0, maxTravelTime])  // Time range (0 = arrival, maxTravelTime = farthest away)
        .range([0,maxWidth]);

    // Compute new position
    const position = xScale(Math.max(0, timeRemaining));
    
    circle.attr('cx', timeRemaining).attr('visibility', 'visible'); // Update the x position of the circle
    text.attr('x', `${timeRemaining}`).attr('visibility', 'visible'); // Update the x position

    // console.log(timeRemaining)
    // Play sound if the position is 0
    if (timeRemaining < 1 && trainPositions[id] > 1) {
        playSound();
    }

    trainPositions[id] = position;
    
    // console.log(`Route: ${route}, Id: ${id}, Time Remaining: ${timeRemaining.toFixed(2)}, Position: ${position.toFixed(2)}`);
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
    const message = await fetchGTFS();  // Fetch GTFS data
    if (message) {  // Ensure data is valid
        const arrivals = extractStationArrivals(message, STATION_STOP_ID + DIRECTION);
        arrivals.forEach(train => {
            updateTrain(train.id, train.route, train.arrival.getTime() / 1000, arrivals);  // Convert arrival time to Unix timestamp (seconds)
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
        fetchGTFS(); // Fetch data for the selected station
    });

    document.querySelectorAll('input[name="direction"]').forEach((elem) => {
        elem.addEventListener('change', function() {
            DIRECTION = this.value;
            console.log(`Selected Direction: ${STATION_STOP_ID + DIRECTION}`); 
            fetchGTFS();
        });
    });
}