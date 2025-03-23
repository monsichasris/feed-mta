// add 8px sq tiles background with 2px gap
var tileSize = 8;
var gapSize = 2;
var totalSize = tileSize + gapSize;
var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;

// Create a container for the tiles
var container = document.createElement('div');
container.style.position = 'absolute';
container.style.top = '0';
container.style.left = '0';
container.style.width = '100%';
container.style.height = '100%';
container.style.zIndex = '-100';
document.body.appendChild(container);

for (var y = 0; y < screenHeight; y += totalSize) {
    for (var x = 0; x < screenWidth; x += totalSize) {
        var tile = document.createElement('div');
        tile.style.width = tileSize + 'px';
        tile.style.height = tileSize + 'px';
        tile.style.position = 'absolute';
        tile.style.left = x + 'px';
        tile.style.top = y + 'px';
        tile.style.backgroundColor = 'white';
        container.appendChild(tile);
    }
}

// create modal when click button in html
document.addEventListener('DOMContentLoaded', (event) => {
    // Get the modal
    var modal = document.getElementById("about-modal");

    // Get the button that opens the modal
    var btn = document.getElementById("about");

    // Get the <span> element that closes the modal
    var span = document.getElementsByClassName("close")[0];

    // When the user clicks the button, open the modal 
    btn.onclick = function() {
        modal.style.display = "block";
    }

    // When the user clicks on <span> (x), close the modal
    span.onclick = function() {
        modal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});