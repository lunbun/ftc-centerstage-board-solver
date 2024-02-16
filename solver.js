const MAX_WHITE = 30;
const MAX_YELLOW = 5;
const MAX_GREEN = 5;
const MAX_PURPLE = 5;
const MAX_PIXEL_COUNTS = new Uint32Array([ 0, MAX_WHITE, MAX_YELLOW, MAX_GREEN, MAX_PURPLE ]);

const NO_PIXEL = 0;
const WHITE_PIXEL = 1;
const YELLOW_PIXEL = 2;
const GREEN_PIXEL = 3;
const PURPLE_PIXEL = 4;
const PIXEL_TYPE_COUNT = 5;

// There are 6 possible combinations for mixed mosaics.
const MOSAIC_MIXED_A = 0;
const MOSAIC_MIXED_B = 1;
const MOSAIC_MIXED_C = 2;
const MOSAIC_MIXED_D = 3;
const MOSAIC_MIXED_E = 4;
const MOSAIC_MIXED_F = 5; 
const MOSAIC_YELLOW = 6;
const MOSAIC_GREEN = 7;
const MOSAIC_PURPLE = 8;
const MOSAIC_TYPE_COUNT = 9;

const OPTIMAL_HEIGHT_PENALTY = 0;
const REALISTIC_HEIGHT_PENALTY = 0.7;

class Board {
    static HEIGHT = 11;
    static MIN_WIDTH = 6;
    static MAX_WIDTH = 7;

    static isWideRow(row) {
        return row % 2 === 1;
    }

    static getWidth(row) {
        return Board.isWideRow(row) ? Board.MAX_WIDTH : Board.MIN_WIDTH;
    }

    static isInBounds(x, y) {
        return x >= 0 && y >= 0 && x < Board.getWidth(y) && y < Board.HEIGHT;
    }

    constructor() {
        this.pixelCounts = new Uint32Array(PIXEL_TYPE_COUNT);
        this.pixels = new Uint8Array(Board.HEIGHT * Board.MAX_WIDTH);
        this.clear();
    }

    get whiteCount() {
        return this.pixelCounts[WHITE_PIXEL];
    }

    get yellowCount() {
        return this.pixelCounts[YELLOW_PIXEL];
    }

    get greenCount() {
        return this.pixelCounts[GREEN_PIXEL];
    }

    get purpleCount() {
        return this.pixelCounts[PURPLE_PIXEL];
    }

    isMaxPixelCountHit(pixel) {
        return pixel !== NO_PIXEL && this.pixelCounts[pixel] >= MAX_PIXEL_COUNTS[pixel];
    }

    get(x, y) {
        return this.pixels[y * Board.MAX_WIDTH + x];
    }

    set(x, y, value) {
        this.pixelCounts[this.get(x, y)]--;
        this.pixelCounts[value]++;
        if (value !== NO_PIXEL && this.pixelCounts[value] > MAX_PIXEL_COUNTS[value]) throw new Error(`Exceeded maximum number of pixels of type ${value}`);

        this.pixels[y * Board.MAX_WIDTH + x] = value;
    }

    clone() {
        const board = new Board();
        board.pixelCounts.set(this.pixelCounts);
        board.pixels.set(this.pixels);
        return board;
    }

    clear() {
        this.pixelCounts.fill(0);
        this.pixels.fill(NO_PIXEL);
    }
}

let canvas, ctx;
let pointsDisplay, pixelCountDisplay;
let mainBoard = new Board();

let highlightedHexagon = null;
let selectedHeightPenalty = 0.7
let selectedPixelColor = null;

function clearBoard() {
    mainBoard.clear();
    updateBoardInfo();
}

function isColorPixel(pixel) {
    return pixel === YELLOW_PIXEL || pixel === GREEN_PIXEL || pixel === PURPLE_PIXEL;
}

// Returns the colors of the pixels in the given mosaic.
function getMosaicColors(color) {
    switch (color) {
        case MOSAIC_MIXED_A: return [ YELLOW_PIXEL, GREEN_PIXEL, PURPLE_PIXEL ];
        case MOSAIC_MIXED_B: return [ YELLOW_PIXEL, PURPLE_PIXEL, GREEN_PIXEL ];
        case MOSAIC_MIXED_C: return [ GREEN_PIXEL, YELLOW_PIXEL, PURPLE_PIXEL ];
        case MOSAIC_MIXED_D: return [ GREEN_PIXEL, PURPLE_PIXEL, YELLOW_PIXEL ];
        case MOSAIC_MIXED_E: return [ PURPLE_PIXEL, YELLOW_PIXEL, GREEN_PIXEL ];
        case MOSAIC_MIXED_F: return [ PURPLE_PIXEL, GREEN_PIXEL, YELLOW_PIXEL ];
        case MOSAIC_YELLOW: return [ YELLOW_PIXEL, YELLOW_PIXEL, YELLOW_PIXEL ];
        case MOSAIC_GREEN: return [ GREEN_PIXEL, GREEN_PIXEL, GREEN_PIXEL ];
        case MOSAIC_PURPLE: return [ PURPLE_PIXEL, PURPLE_PIXEL, PURPLE_PIXEL ];
        default: throw new Error(`Invalid mosaic color: ${color}`);
    }
}

class Mosaic {
    // If the mosaic is up, the side with the two pixels is on the bottom and the single pixel is on the top. (x, y) is the bottom left pixel.
    // If the mosaic is down, the side with the two pixels is on the top and the single pixel is on the bottom. (x, y) is the bottom pixel.
    constructor(x, y, isUp, color) {
        this.x = x;
        this.y = y;
        this.isUp = isUp;
        this.color = color;
    }

    key() {
        return `${this.x},${this.y},${this.isUp}`;
    }

    // Returns an array of all the points in the given mosaic.
    getPixels() {
        const wide = Board.isWideRow(this.y);
        if (this.isUp) {
            return [ { x: this.x, y: this.y }, { x: this.x + 1, y: this.y }, { x: this.x + 1 - wide, y: this.y + 1 } ];
        } else {
            return [ { x: this.x, y: this.y }, { x: this.x - wide, y: this.y + 1 }, { x: this.x + 1 - wide, y: this.y + 1 } ];
        }
    }

    // Returns an array of all the points adjacent to the given mosaic.
    getAdjacent() {
        const wide = Board.isWideRow(this.y);
        if (this.isUp) {
            return [
                { x: this.x - 1, y: this.y },
                { x: this.x - wide, y:this. y + 1 },
                { x: this.x, y: this.y + 2 },
                { x: this.x + 1, y: this.y + 2 },
                { x: this.x + 2 - wide, y: this.y + 1 },
                { x: this.x + 2, y: this.y },
                { x: this.x - wide, y: this.y - 1 },
                { x: this.x + 1 - wide, y: this.y - 1 },
                { x: this.x + 2 - wide, y: this.y - 1 }
            ]
        } else {
            return [
                { x: this.x - 1, y: this.y },
                { x: this.x - 1 - wide, y: this.y + 1 },
                { x: this.x - wide, y: this.y - 1 },
                { x: this.x + 1 - wide, y: this.y - 1 },
                { x: this.x + 1, y: this.y },
                { x: this.x + 2 - wide, y: this.y + 1 },
                { x: this.x - 1, y: this.y + 2 },
                { x: this.x, y: this.y + 2 },
                { x: this.x + 1, y: this.y + 2 }
            ]
        }
    }

    // Places the mosaic on the board, along with all surrounding white pixels that are forced to be placed.
    place(board) {
        const colors = getMosaicColors(this.color);
        this.getPixels().forEach((p, i) => board.set(p.x, p.y, colors[i]));
        for (const p of this.getAdjacent()) {
            if (Board.isInBounds(p.x, p.y) && !board.isMaxPixelCountHit(WHITE_PIXEL)) board.set(p.x, p.y, WHITE_PIXEL);
        }
    }
    
    // Returns true if the board contains a valid mosaic at the given position.
    isValid(board) {
        // Ensure the mosaic is within the bounds of the board.
        const pixels = this.getPixels();
        if (pixels.some(p => !Board.isInBounds(p.x, p.y))) return false;

        // Ensure no color pixels are adjacent to the mosaic.
        if (this.getAdjacent().some(p => Board.isInBounds(p.x, p.y) && isColorPixel(board.get(p.x, p.y)))) return false;

        // Ensure the mosaic is filled in with the correct colors.
        const colors = getMosaicColors(this.color);
        if (pixels.some((p, i) => board.get(p.x, p.y) !== colors[i])) return false;

        return true;
    }

    // Returns true if the mosaic can be placed on the board.
    isValidPlacement(board) {
        // Ensure the mosaic is within the bounds of the board.
        const pixels = this.getPixels();
        if (pixels.some(p => !Board.isInBounds(p.x, p.y))) return false;

        // Ensure no white pixels are already in the mosaic.
        if (pixels.some(p => board.get(p.x, p.y) === WHITE_PIXEL)) return false;

        // Ensure mosaic is not already filled in.
        if (pixels.every(p => isColorPixel(board.get(p.x, p.y)))) return false;

        // Ensure no color pixels are adjacent to the mosaic.
        const adjacent = this.getAdjacent();
        if (adjacent.some(p => Board.isInBounds(p.x, p.y) && isColorPixel(board.get(p.x, p.y)))) return false;

        // Ensure existing color pixels are the correct color.
        const colors = getMosaicColors(this.color);
        const colorCounts = [0, 0, 0];
        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            if (board.get(p.x, p.y) === NO_PIXEL) {
                colorCounts[colors[i] - 2]++;
            } else if (board.get(p.x, p.y) !== colors[i]) {
                return false;
            }
        }

        // Ensure we do not exceed the maximum number of pixels of each color.
        for (let i = 0; i < 3; i++) {
            if (board.pixelCounts[2 + i] + colorCounts[i] > MAX_PIXEL_COUNTS[2 + i]) return false;
        }

        return true;
    }
}

function* getAllMosaicsAt(x, y) {
    for (let color = MOSAIC_MIXED_A; color < MOSAIC_TYPE_COUNT; color++) {
        yield new Mosaic(x, y, true, color);
        yield new Mosaic(x, y, false, color);
    }
}

// Finds all possible valid mosaics that can be placed on the board.
function* findAllMosaicPlacements(board) {
    for (let y = 0; y < Board.HEIGHT - 1; y++) {
        const width = Board.getWidth(y);
        for (let x = 0; x < width; x++) {
            yield* Array.from(getAllMosaicsAt(x, y)).filter(m => m.isValidPlacement(board));
        }
    }
}

// Returns true if the given pixel placement is valid (i.e. the pixel has sufficient supporting pixels).
function isValidPixelPlacement(board, x, y) {
    const wide = Board.isWideRow(y);
    if (Board.isInBounds(x - wide, y - 1) && board.get(x - wide, y - 1) === NO_PIXEL) return false;
    if (Board.isInBounds(x + 1 - wide, y - 1) && board.get(x + 1 - wide, y - 1) === NO_PIXEL) return false;
    return true;
}

// Completes a single step of the solver. Returns true if there are more steps to be completed.
function solveStep(board, heightPenalty) {
    const possibleMosaics = Array.from(findAllMosaicPlacements(board));

    // Find the mosaic that has the smallest score (number of adjacent white pixels + height penalty).
    let bestMosaic = null;
    let bestScore = Infinity;
    for (const mosaic of possibleMosaics) {
        const adjacent = mosaic.getAdjacent();
        let score = adjacent.filter(p => Board.isInBounds(p.x, p.y) && board.get(p.x, p.y) === NO_PIXEL).length;
        score += heightPenalty * mosaic.y;
        if (score < bestScore) {
            bestMosaic = mosaic;
            bestScore = score;
        }
    }

    if (bestMosaic) {
        bestMosaic.place(board);
        return true;
    } else {
        // No more mosaics can be placed, the board is solved.
        // Fill in remaining empty pixels with white pixels.
        for (let y = 0; y < Board.HEIGHT; y++) {
            const width = Board.getWidth(y);
            for (let x = 0; x < width; x++) {
                if (board.get(x, y) === NO_PIXEL && !board.isMaxPixelCountHit(WHITE_PIXEL)) {
                    board.set(x, y, WHITE_PIXEL);
                }
            }
        }
        return false;
    }
}

// Fully solves the board.
function solveBoard(board, heightPenalty) {
    // Hard limit to prevent infinite loops in case of bugs.
    for (let i = 0; i < 50; i++) {
        if (!solveStep(board, heightPenalty)) return;
    }
    console.warn('Solver hard limit reached.');
}

// Solves the best next pixel to place on the board.
function solveNextBestPixel(board, heightPenalty, colorRequirement) {
    let bestPixel = null;
    let bestScore = -Infinity;
    const points = calculatePoints(board);
    const boardCopy = board.clone();
    const solved = board.clone();
    solveBoard(solved, heightPenalty);

    for (let y = 0; y < Board.HEIGHT; y++) {
        const width = Board.getWidth(y);
        for (let x = 0; x < width; x++) {
            // Ensure this pixel is a viable candidate.
            if (board.get(x, y) !== NO_PIXEL) continue;
            if (solved.get(x, y) === NO_PIXEL) continue;
            
            if (!isValidPixelPlacement(board, x, y)) continue;
            if (board.isMaxPixelCountHit(solved.get(x, y))) continue;

            let score = 0;
            // Massive penalty for placing incorrect color pixels.
            if (colorRequirement !== null && solved.get(x, y) !== colorRequirement) score -= 5000;
            // TODO: Penalize placing pixels that complete mosaics, but are the wrong color so they don't actually count as a mosaic.
            // Incentivize starting new mosaics.
            if (isColorPixel(solved.get(x, y))) score += 1;

            boardCopy.set(x, y, solved.get(x, y));
            const newPoints = calculatePoints(boardCopy);
            boardCopy.set(x, y, NO_PIXEL);

            // Incentivize completing mosaics.
            if (newPoints.mosaics.size > points.mosaics.size) score += 10;
            // Incentivize completing sets bonuses.
            if (newPoints.setBonus > points.setBonus) score += 10;

            if (score > bestScore) {
                bestPixel = { x, y, color: colorRequirement ?? solved.get(x, y) };
                bestScore = score;
            }
        }
    }

    return bestPixel;
}

// Calculates the points for the given board.
function calculatePoints(board) {
    let pixelCount = 0;
    let mosaics = new Set();
    let setBonuses = [false, false, false];
    for (let y = 0; y < Board.HEIGHT; y++) {
        const width = Board.getWidth(y);
        for (let x = 0; x < width; x++) {
            if (board.get(x, y) === NO_PIXEL) continue;

            pixelCount++;
            if (y >= 9) setBonuses[2] = true;
            if (y >= 6) setBonuses[1] = true;
            if (y >= 3) setBonuses[0] = true;

            Array.from(getAllMosaicsAt(x, y)).filter(m => m.isValid(board)).forEach(m => mosaics.add(m.key()));
        }
    }

    return {
        pixelCount, mosaics, setBonuses,
        pixelScore: pixelCount * 3,
        artistBonus: mosaics.size * 10,
        setBonus: setBonuses.filter(b => b).length * 10
    };
}

function stepSolve() {
    solveStep(mainBoard, selectedHeightPenalty);
    updateBoardInfo();
}

function fullSolve() {
    solveBoard(mainBoard, selectedHeightPenalty);
    updateBoardInfo();
}

function placeNextBestPixel() {
    const pixel = solveNextBestPixel(mainBoard, selectedHeightPenalty, selectedPixelColor);
    if (pixel !== null && !mainBoard.isMaxPixelCountHit(pixel.color)) {
        mainBoard.set(pixel.x, pixel.y, pixel.color);
        updateBoardInfo();
    }
}

function changeSolveType(type) {
    if (type === 'realistic') {
        selectedHeightPenalty = REALISTIC_HEIGHT_PENALTY;
    } else {
        selectedHeightPenalty = OPTIMAL_HEIGHT_PENALTY;
    }
}

function changePixelType(type) {
    if (type === 'white') {
        selectedPixelColor = WHITE_PIXEL;
    } else if (type === 'yellow') {
        selectedPixelColor = YELLOW_PIXEL;
    } else if (type === 'green') {
        selectedPixelColor = GREEN_PIXEL;
    } else if (type === 'purple') {
        selectedPixelColor = PURPLE_PIXEL;
    } else {
        selectedPixelColor = null;
    }
}

function updateBoardInfo() {
    pixelCountDisplay.innerHTML = `White: ${mainBoard.whiteCount}/${MAX_WHITE}<br>Yellow: ${mainBoard.yellowCount}/${MAX_YELLOW}<br>Green: ${mainBoard.greenCount}/${MAX_GREEN}<br>Purple: ${mainBoard.purpleCount}/${MAX_PURPLE}`;

    const points = calculatePoints(mainBoard);
    const totalScore = points.pixelScore + points.artistBonus + points.setBonus;
    pointsDisplay.innerHTML = `<b>Total Score: ${totalScore}</b><br>Pixel Score: ${points.pixelScore}<br>Artist Bonus: ${points.artistBonus}<br>Set Bonus: ${points.setBonus}`;
}

function drawPixel(x, y, color, strokeWidth = 0) {
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.lineTo(x + 22, y + 13);
    ctx.lineTo(x + 22, y - 13);
    ctx.lineTo(x, y - 25);
    ctx.lineTo(x - 22, y - 13);
    ctx.lineTo(x - 22, y + 13);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = 'white';
        ctx.stroke();
    }
}

function pixelTypeToColor(pixelType) {
    switch (pixelType) {
        case NO_PIXEL: return '#888';
        case WHITE_PIXEL: return 'white';
        case YELLOW_PIXEL: return '#f7d474';
        case GREEN_PIXEL: return '#56a36b';
        case PURPLE_PIXEL: return '#bf95f0'
    }
}

function drawBoard() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < Board.HEIGHT; y++) {
        const width = Board.getWidth(y);

        let offsetX = 200;
        let offsetY = 150;
        offsetX += (Board.isWideRow(y) ? 0 : 25);
        for (let x = 0; x < width; x++) {
            let strokeWidth = 0;
            if (highlightedHexagon && highlightedHexagon.x === x && highlightedHexagon.y === y) {
                strokeWidth = 3;
            }

            const pixelType = mainBoard.get(x, y);
            drawPixel(x * 50 + offsetX, (Board.HEIGHT - 1 - y) * 44 + offsetY, pixelTypeToColor(pixelType), strokeWidth);
        }
    }
}

function calculateBoardPositionFromMouse(x, y) {
    let offsetX = 208;
    let offsetY = 163;

    y = Board.HEIGHT - 1 - Math.round((y - offsetY) / 44);
    offsetX += (Board.isWideRow(y) ? 0 : 25);
    x = Math.round((x - offsetX) / 50);
    return { x, y };
}

function frame() {
    drawBoard();
    window.requestAnimationFrame(frame);
}

function mouseDown(e) {
    e.preventDefault();

    // Cycle through the colors
    const { x, y } = calculateBoardPositionFromMouse(e.clientX, e.clientY);
    if (x < 0 || y < 0 || x >= Board.getWidth(y) || y >= Board.HEIGHT) {
        return;
    }

    // Find next color that has not hit the maximum pixel count.
    let nextColor = mainBoard.get(x, y);
    for (let i = 0; i < PIXEL_TYPE_COUNT; i++) {
        nextColor = (nextColor + 1) % PIXEL_TYPE_COUNT;
        if (!mainBoard.isMaxPixelCountHit(nextColor)) break;
    }
    mainBoard.set(x, y, nextColor);

    updateBoardInfo();
}

function mouseMove(e) {
    const { x, y } = calculateBoardPositionFromMouse(e.clientX, e.clientY);
    if (x < 0 || y < 0 || x >= Board.getWidth(y) || y >= Board.HEIGHT) {
        highlightedHexagon = null;
    } else {
        highlightedHexagon = { x, y };
    }
}

function load() {
    canvas = document.getElementById('board');
    ctx = canvas.getContext('2d');
    pixelCountDisplay = document.getElementById('pixel-count');
    pointsDisplay = document.getElementById('points');

    canvas.addEventListener('mousemove', mouseMove);
    canvas.addEventListener('mousedown', mouseDown);

    updateBoardInfo();

    window.requestAnimationFrame(frame);
}

window.addEventListener('load', load);
