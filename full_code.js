// Reading Functions ------------------------
/**
 * Check if is playing, win of lose.
 * @returns {string}
 */
function checkGameStatus() {
  return Array.from(document.getElementById('top_area_face').classList)[2].replace(
    'hd_top-area-face-',
    ''
  );
}

/**
 * Read the grid cells.
 * Return the grid and a boolean that represents if all grid cells are hidden.
 *
 * @typedef {boolean} gridClosed
 *
 * @typedef {string[][]} table
 *
 * @returns {[table, gridClosed]}
 */
function readGrid() {
  let pageGrid = document.getElementById('A43');

  let pageNodes = pageGrid.childNodes;

  let table = [];
  let row = [];
  let gridClosed = true; // Check all grid cells are closed
  for (node of pageNodes) {
    const classes = Array.from(node.classList).splice(2);
    if (classes.length == 0) {
      table.push(row);
      row = [];
    } else {
      const status = classes.shift();
      if (status == 'hd_closed') {
        row.push('?');
      } else {
        gridClosed = false; // Some cell is not closed
        const number_class = classes.shift();
        let number = number_class.replace('hd_type', '');
        row.push(number);
      }
    }
  }

  return [table, gridClosed];
}

/**
 * Return table heigth and width.
 * @returns {[int,int]}
 */
function getTableSize() {
  const [grid, isGridClosed] = readGrid();
  return [grid.length, grid[0].length];
}

/**
 * Returns total of bombs in grid.
 * @returns {int}
 */
function readNumberOfBombs() {
  const digits_classes = [
    Array.from(document.getElementById('top_area_mines_100').classList),
    Array.from(document.getElementById('top_area_mines_10').classList),
    Array.from(document.getElementById('top_area_mines_1').classList)
  ];

  const digits = [];

  for (d of digits_classes) {
    let string = d.find((e) => e.includes('hd_top-area-num'));
    let digit = string.split('').pop();
    digits.push(digit);
  }

  return parseInt(digits.join(''));
}

// Interact with cells ----------------------

/**
 * Flag all bomb cells.
 */
function flagCells() {
  for ([y, x] of sureBombCells) {
    const id = `cell_${x}_${y}`;
    document.getElementById(id).classList.add('hd_flag');
  }
}

/**
 * @param {int} x coordinate
 * @param {int} y coordinate
 */
function clickCell(x, y) {
  function simulateMouseEvent(el, eventName) {
    let event;
    if (window.MouseEvent && typeof window.MouseEvent === 'function') {
      event = new MouseEvent(eventName);
    } else {
      event = document.createEvent('MouseEvent');
      event.initMouseEvent(eventName);
    }

    el.dispatchEvent(event);
  }

  const id = `cell_${x}_${y}`;
  console.log('Clicking at ' + id);

  const cell = document.getElementById(id);

  cell.addEventListener('click', () => {
    simulateMouseEvent(document.getElementById(id), 'mousedown');
    setTimeout(() => {
      simulateMouseEvent(document.getElementById(id), 'mouseup');
    }, 100);
  });

  cell.click();
}

// Minesweeper Solver Functions --------------

/**
 *
 * Do the basic evaluation from cells.
 *
 * If the number of bombs around is equal to the provided value, consider all hidden cells around as safe.
 *
 * Otherwise, if the number of bombs plus the number of unrevealed cells around is equal to the provided value,
 * consider all hidden cells around as bombs.
 *
 * Else, add to maybe bomb list.
 *
 * @param {int} i coordinate
 * @param {int} j coordinate
 * @param {string} value from table[i][j]
 */
function basicEvaluation(i, j, value) {
  if (value === '0') {
    // '0' means no mines nearby
    // so, ignore this type of cell
    return;
  }

  if (value === '?') {
    allHiddenCells.push([i, j]);
    return;
  }

  const cellsAround = [];
  let bombs = 0;

  for (let a = Math.max(i - 1, 0); a <= Math.min(i + 1, tableHeight - 1); a++) {
    for (let b = Math.max(j - 1, 0); b <= Math.min(j + 1, tableWidth - 1); b++) {
      if (sureBombCells.some(([x, y]) => x === a && y === b)) {
        bombs++;
      } else if (table[a][b] === '?') {
        cellsAround.push([a, b]);
      }
    }
  }

  // If the number of bombs around is equal to the provided value,
  // consider all hidden cells around as safe.
  if (parseInt(value) === bombs) {
    sureSafeCells.push(...cellsAround);
  }
  // Otherwise, if the number of bombs plus the number of unrevealed cells around
  // is equal to the provided value, consider all hidden cells around as bombs.
  else if (parseInt(value) === bombs + cellsAround.length) {
    sureBombCells.push(...cellsAround);
  } else {
    // Else, add it to maybe bomb list
    let remaining_bombs = value - bombs;
    maybeBombCells.push(`${cellsAround.join('+')}=${remaining_bombs}`);
  }
}

/**
   * Generate all possibilites from given scenario.
   * 
   * Split cells into groups of areas. Those areas possibilites dont affect other areas.
   * 
   * Evaluate each area individually 
   * (this reduces the average time of function, optimizing the permutations).
   * 
   * @param {string[]} maybeBombCells list of evaluations
   * @param {[int,int][]} sureBombCells list of discovered bombs
   * 
   * @typedef {Object} obj - A { key : value } structure. 
   * 
   * key: 0 means cell is safe.
   * 
   * key: 1 means bomb.
   * @property {string} key
   * @property {0|1} value
   * 
   * @returns {obj[][]}
  
  */
function evaluatePossibilities(maybeBombCells, sureBombCells) {
  /**
   * Split cells into groups of areas. Those areas possibilites dont affect other areas.
   *
   * @param {string[]} equations
   * @returns {[string[],string[]]}
   *
   *
   * @example
   * let equations = ['0,1+1,1=1','0,1+1,1+2,1=2','0,1+2,2=1']
   * groupLetiables()
   * return  [
   *   ['0,1+1,1=1','0,1+1,1+2,1=2','0,1+2,2=1'], ['0,1','1,1','2,1','2,2']
   * ];
   */
  function groupLetiables(equations) {
    const groups = [];
    const letiables = new Set();

    for (const equation of equations) {
      const matches = equation.matchAll(/(\d+,\d+)/g);
      const group = new Set();

      for (const match of matches) {
        const letiable = match[1];
        group.add(letiable);
        letiables.add(letiable);
      }

      groups.push([equation, group]);
    }

    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const intersection = new Set([...groups[i][1]].filter((x) => groups[j][1].has(x)));

          if (intersection.size > 0) {
            groups[i][0] += '; ' + groups[j][0];
            groups[i][1] = new Set([...groups[i][1], ...groups[j][1]]);
            groups.splice(j, 1);
            merged = true;
            break;
          }
        }

        if (merged) break;
      }
    }

    return groups.map(([equation, group]) => [equation.split('; '), Array.from(group)]);
  }

  let evaluationGroups = groupLetiables(maybeBombCells);

  // ---------------------------------------------------------------------------
  /**
   * For each group, generate its combinations. Then, return all the combinations for each group.
   * @param {[string[],string[]]} evaluationGroups
   *
   * @typedef {Object} obj - A { key : value } structure.
   *
   * key: 0 means cell is safe.
   *
   * key: 1 means bomb.
   * @property {string} key
   * @property {0|1} value
   *
   * @returns {obj[][]}
   */
  function generateGroupCombinations(evaluationGroups) {
    const allCombinations = [];
    for (const [actualEvaluations, uniqueCells] of evaluationGroups) {
      const actualCombinations = generateCombinationsIterative(uniqueCells, actualEvaluations);
      allCombinations.push(actualCombinations);
    }
    return allCombinations;
  }

  /**
   *
   * @param {string[]} uniqueCells - All evaluated cells
   * @param {string[]} actualEvaluations - All evaluations
   *
   * @typedef {Object} obj - A { key : value } structure.
   *
   * key: 0 means cell is safe.
   *
   * key: 1 means bomb.
   *
   * @property {string} key
   * @property {0|1} value
   * @returns {obj[]}
   *
   * @example
   * {
   *  '0,1': 0,
   *  '1,1': 1
   * }
   */
  function generateCombinationsIterative(uniqueCells, actualEvaluations) {
    const result = [];

    const stack = [{ index: 0, combination: {} }];

    while (stack.length > 0) {
      const { index, combination } = stack.pop();

      if (index === uniqueCells.length) {
        if (validateCombination(combination, actualEvaluations)) {
          result.push(combination);
        }
      } else {
        const cellKey = uniqueCells[index];

        const combinationWithBomb = { ...combination, [cellKey]: 1 };
        const combinationWithSafe = { ...combination, [cellKey]: 0 };

        [combinationWithBomb, combinationWithSafe].forEach((comb) => {
          if (validateCombination(comb, actualEvaluations)) {
            stack.push({ index: index + 1, combination: comb });
          }
        });
      }
    }

    return result;
  }

  /**
   *
   * @param {Object} combination
   * @param {string[]} actualEvaluations
   * @returns {true|false}
   */
  function validateCombination(combination, actualEvaluations) {
    for (const evaluation of actualEvaluations) {
      const [cells, result] = evaluation.split('=');
      const cellList = cells.split('+');

      let sum = 0;
      for (const cell of cellList) {
        if (combination[cell] === undefined) {
          // Ignore if cell is missing (Partial Validations)
          return true;
        } else {
          for (elem of sureBombCells) {
            if (elem.join(',') == cell && combination[cell] != 1) {
              // If i already know is a bomb, it needs to be a bomb here too
              return false;
            }
          }
          sum += combination[cell];
        }
      }

      if (sum !== parseInt(result)) {
        return false;
      }
    }

    return true;
  }

  return generateGroupCombinations(evaluationGroups);
}
// -------------

/**
 * Get common itens from all possible scenarios.
 * If a cell is safe/bomb in all possible scenarios, it should be on this scenario as well.
 *
 * @param {obj[][]} optionsList
 * @typedef {Object} obj - A { key : value } structure.
 *
 * key: 0 means cell is safe.
 *
 * key: 1 means bomb.
 *
 * @returns {obj}
 */
function commonItems(optionsList) {
  let allCommonItems = [];

  function elementCount(arr, element) {
    return arr.filter((currentElement) => currentElement == element).length;
  }

  for (const group of optionsList) {
    let commonItems = [];

    for (elem of group) {
      for (const key in elem) {
        commonItems.push(`${key}:${elem[key]}`);
      }
    }

    commonItems = commonItems.filter((elem) => elementCount(commonItems, elem) == group.length);
    allCommonItems.push(...commonItems);
  }

  allCommonItems = [...new Set(allCommonItems)];

  let map = {};
  for (i of allCommonItems) {
    const [key, value] = i.split(':');
    map[key] = parseInt(value);
  }

  return map;
}

/**
 * If 'commonItens()' function don't return any value, guess based on most frequent safe cell in all cases.
 * @param {obj[][]} optionsList
 * @returns {string}
 */
function guessSafeCell(optionsList) {
  function countOccurrences(list) {
    const countMap = list.reduce((map, str) => {
      map[str] = (map[str] || 0) + 1;
      return map;
    }, {});

    const result = {};

    for (const key in countMap) {
      result[key] = countMap[key] / list.length;
    }

    return result;
  }

  const bestSafeCells = [];

  for (const group of optionsList) {
    let probabilities = [];

    for (elem of group) {
      for (const key in elem) {
        probabilities.push(`${key}:${elem[key]}`);
      }
    }

    // Evaluate only safe cells
    probabilities = probabilities.filter((elem) => elem.charAt(elem.length - 1) == '0');

    const countMap = countOccurrences(probabilities);
    const mostCommonCase = Object.keys(countMap).reduce((a, b) =>
      countMap[a] > countMap[b] ? a : b
    );

    bestSafeCells.push(`${mostCommonCase}=${countMap[mostCommonCase]}`);
  }

  const bestElement = bestSafeCells.reduce((a, b) =>
    parseFloat(a.split('=')[1]) > parseFloat(b.split('=')[1]) ? a : b
  );
  return bestElement.split(':')[0];
}

// Main ----------------------------------------
var sureBombCells = [];
var sureSafeCells = [];
var allHiddenCells = [];
var maybeBombCells = [];
var totalBombs = readNumberOfBombs();
var [table, gridClosed] = readGrid();
var [tableHeight, tableWidth] = getTableSize();

function restartVariables() {
  sureBombCells = [];
  sureSafeCells = [];
  allHiddenCells = [];
  maybeBombCells = [];
  totalBombs = readNumberOfBombs();
  [table, gridClosed] = readGrid();
  [tableHeight, tableWidth] = getTableSize();
  alert('Variables restarted!');
}

/**
 * @returns {true|false}
 */
function solveWithoutGuessing() {
  [table, gridClosed] = readGrid();
  // Dont solve if game dont start yet
  if (gridClosed) {
    alert('All cells are hidden. You need to make the first play.');
    return false;
  }

  // Dont solve if game already ended
  if (checkGameStatus() == 'lose' || checkGameStatus() == 'win') {
    alert('Game already ended.');
    return false;
  }

  // Remove duplicates into lists
  sureBombCells = [...new Set(sureBombCells.map((e) => e.toString()))].map((e) =>
    e.split(',').map((x) => parseInt(x))
  );
  sureSafeCells = [...new Set(sureSafeCells.map((e) => e.toString()))].map((e) =>
    e.split(',').map((x) => parseInt(x))
  );

  maybeBombCells = [];
  allHiddenCells = [];

  // Cell Guide: '?' if unknown, '0' if no mines nearby, '1'-'8' otherwise

  // If we already know a safe cell, don't process the table
  if (sureSafeCells.length > 0) {
    let [x, y] = sureSafeCells.pop().reverse();
    console.log('Already knew a safe cell!');
    clickCell(x, y);
    return true;
  } else {
    // Else, let's process the data
    for (let i = 0; i < tableHeight; i++) {
      for (let j = 0; j < tableWidth; j++) {
        basicEvaluation(i, j, table[i][j]);
      }
    }
  }

  if (sureSafeCells.length > 0) {
    let [x, y] = sureSafeCells.pop().reverse();
    console.log('Safe cell found with basic evaluation!');
    clickCell(x, y);
    return true;
  }

  // Remove bombs from hidden cells
  allHiddenCells = allHiddenCells.filter(
    (element) => !sureBombCells.some((el) => el.join(',') == element.join(','))
  );

  let remainingBombsinGrid = totalBombs - sureBombCells.length;

  if (remainingBombsinGrid == 0) {
    sureSafeCells.push(...allHiddenCells);
    console.log('Safe cells found with bomb count!');
    let [x, y] = sureSafeCells.pop().reverse();
    clickCell(x, y);
    return true;
  } else if (remainingBombsinGrid == allHiddenCells.length) {
    console.log('Bomb cells found with bomb count!');
    sureBombCells.push(...allHiddenCells);
  }

  // Make an evaluation using all cells in entire grid (endgame optimization)
  if (allHiddenCells.length < 20) {
    let allGridEvaluation = `${allHiddenCells.join('+')}=${remainingBombsinGrid}`;
    maybeBombCells.push(allGridEvaluation);
  }

  let optionsList = evaluatePossibilities(maybeBombCells, sureBombCells);

  console.log('Guide: (0 = Safe, 1 = Bomb)');
  console.log('All possibilities of safe/bomb cells:\n', optionsList);

  const items = commonItems(optionsList);
  console.log('Common items between those possibilities:\n', items);

  for (key in items) {
    const cell = key.split(',').map((n) => Number(n));
    const value = items[key];

    switch (value) {
      case 0:
        sureSafeCells.push(cell);
        break;

      case 1:
        sureBombCells.push(cell);
        break;

      default:
        break;
    }
  }

  if (sureSafeCells.length > 0) {
    let [x, y] = sureSafeCells.pop().reverse();
    clickCell(x, y);
    return true;
  } else {
    alert("Can't find any safe play. Need to Guess.");
  }
  return false;
}

function solveWithGuessing() {
  if (solveWithoutGuessing()) {
    return;
  } else {
    // Remove duplicates into lists
    sureBombCells = [...new Set(sureBombCells.map((e) => e.toString()))].map((e) =>
      e.split(',').map((x) => parseInt(x))
    );

    let optionsList = evaluatePossibilities(maybeBombCells, sureBombCells);

    if (optionsList.length == 0) {
      return;
    }

    let bestSafeCell = guessSafeCell(optionsList);
    console.log('Next click is a guess.');
    let [x, y] = bestSafeCell.split(',').reverse();
    clickCell(x, y);
  }
}

// Modal ---------------------

/**
 * Function to move modal on page.
 * @param {modal} elmnt
 */
function dragElement(elmnt) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (document.getElementById(elmnt.id + 'header')) {
    // if present, the header is where you move the DIV from:
    document.getElementById(elmnt.id + 'header').onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = elmnt.offsetTop - pos2 + 'px';
    elmnt.style.left = elmnt.offsetLeft - pos1 + 'px';
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function create_modal() {
  const style_code = `  
    #minesweeper_solver_modal {
      background: #f2f4f3;
    }
    #modal_header {
      background: #235789;
      color: white;
    }
    #minesweeper_solver_modal p,
    button {
      margin: 10px;
    }
    #minesweeper_solver_modal a {
      color: #235789;
      text-decoration: none;
    }
    #minesweeper_solver_modal #warning {
      color: #f0a000;
    }
    #minesweeper_solver_modal button {
      font-size: 16px;
      font-weight: 400;
      padding: 10px 10px;
      border: 1px solid;
      border-radius: 4px;
      color: white;
      cursor: pointer;
    }
    #minesweeper_solver_modal button {
      font-size: 16px;
      font-weight: 400;
      padding: 10px 10px;
      border: 1px solid;
      border-radius: 4px;
      color: white;
    }
    #minesweeper_solver_modal #modal_button1 {
      background-color: #610f68;
      border-color: #610f68;
    }
    #minesweeper_solver_modal #modal_button2 {
      background-color: #09bc8a;
      border-color: #09bc8a;
    }
    #minesweeper_solver_modal #modal_button3 {
      background-color: #ba1200;
      border-color: #ba1200;
    }`;

  const modal = `
     <div id ='modal_header' style='display:flex; justify-content:space-between; cursor: move;z-index: 10;'>
       <p> Minesweeper Solver</p>  <p style='cursor: pointer' onclick='close_modal()'>X</p>
     </div>
     
     <div id ='modal_content'>
      
     <p>Made to be used on <a href='https://minesweeper.online'>Minesweeper.online</a>. Works on all modes.</p>
      
      <p>Remember to always 'Restart Variables' after each game.</br>
        'No guessing' button will surely click on safe cell.</br>
        'Guessing' button has a chance to miss.<br>
        If you miss, and undo the action, you can restart the variables and keep playing.
      </p>
      
      <p id='warning'>WARNING: Avoid fast clicks on buttons.</p>
      <p>Some cases may require a few seconds to process.</p>
      
      <div id='modal_buttons'>
        <button id="modal_button1" onclick="restartVariables()" >Restart Variables</button>
        <button id="modal_button2" onclick="solve1()">Next Move (no guessing)</button>
        <button id="modal_button3" onclick="solve2()">Next Move (guessing)</button>
      </div>
     
      </div>`;

  // Modal HTML

  const div = document.createElement('div');
  div.innerHTML = modal;
  div.id = 'minesweeper_solver_modal';
  div.style.position = 'absolute';
  div.style.top = '100px';
  div.style.left = '30px';
  document.querySelector('body').appendChild(div);
  dragElement(document.getElementById('minesweeper_solver_modal'));

  // Modal CSS

  let head = document.head || document.getElementsByTagName('head')[0];
  let style = document.createElement('style');

  // IE8 and below.
  if (style.styleSheet) {
    style.styleSheet.cssText = style_code;
  } else {
    style.appendChild(document.createTextNode(style_code));
  }

  // add it to the head
  head.appendChild(style);
}

function close_modal() {
  document.getElementById('minesweeper_solver_modal').remove();
}

/**
 * Call 'no guessing' related functions.
 */
function solve1() {
  let objects = [
    document.querySelector('#modal_button1'),
    document.querySelector('#modal_button2'),
    document.querySelector('#modal_button3')
  ];

  document.querySelector('body').style.cursor = 'wait';
  for (o of objects) {
    o.style.cursor = 'wait';
    o.disabled = true;
  }

  solveWithoutGuessing();
  flagCells();

  document.querySelector('body').style.cursor = 'auto';
  for (o of objects) {
    o.style.cursor = 'auto';
    o.disabled = false;
  }
}

/**
 * Call 'guessing' related functions.
 */
function solve2() {
  document.querySelector('body').style.cursor = 'wait';

  solveWithGuessing();
  flagCells();

  document.querySelector('body').style.cursor = 'auto';
}

create_modal();
