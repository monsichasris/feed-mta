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