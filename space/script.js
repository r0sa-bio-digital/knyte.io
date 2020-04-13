/* global visualThemeColors */

let svgNameSpace;
let spaceRootElement;
let spaceBackElement;
let spaceForwardElement;
let spaceMapElement;
let masterKnoxelId;
let spacemapKnoxelId;
const knytesCloud = {}; // core knyte id --> initial knyte id, terminal knyte id
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}}
const knoxels = {}; // knoxel id --> knyte id
const spaceBackStack = []; // [previous space root knoxel id]
const spaceForwardStack = []; // [next space root knoxel id]
const visualTheme = {
  rect: {
    strokeColor: visualThemeColors.outline,
    strokeWidth: 4,
    fillColor: {
      getRandom: function() {
        const colors = visualThemeColors.elements;
        const randomIndex = Math.floor(Math.random() * colors.length);
        return colors[randomIndex];
      }
    },
    defaultWidth: 32,
    defaultHeight: 32,
  }
};

const knit = new function()
{
  // Pre-calculate toString(16) for speed
  const hexBytes = [];
  for (let i = 0; i < 256; i++)
    hexBytes[i] = (i + 0x100).toString(16).substr(1);

  function binUuidV4(empty) {
    const b = new Uint8Array(16);
    if (!empty)
      crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return b;
  }

  function textUuidV4(empty) {
    const b = binUuidV4(empty);
    return hexBytes[b[0]] + hexBytes[b[1]] +
      hexBytes[b[2]] + hexBytes[b[3]] + '-' +
      hexBytes[b[4]] + hexBytes[b[5]] + '-' +
      hexBytes[b[6]] + hexBytes[b[7]] + '-' +
      hexBytes[b[8]] + hexBytes[b[9]] + '-' +
      hexBytes[b[10]] + hexBytes[b[11]] +
      hexBytes[b[12]] + hexBytes[b[13]] +
      hexBytes[b[14]] + hexBytes[b[15]];
  }
  // singleton properties
  this.empty = textUuidV4(true);
  this.new = function() {return textUuidV4();};
}

function addKnyte(desc)
{
  // desc: {knyteId, initialId, terminalId, color}
  knytesCloud[desc.knyteId] = {
    initialId: desc.initialId,
    terminalId: desc.terminalId
  };
  informationMap[desc.knyteId] = {color: desc.color, space: {}};
}

function addKnoxel(desc)
{
  // desc: {hostKnyteId, knyteId, knoxelId, position}
  knoxels[desc.knoxelId] = desc.knyteId;
  if (desc.hostKnyteId)
    informationMap[desc.hostKnyteId].space[desc.knoxelId] = desc.position;
}

function buildSpaceMap()
{
  // detect islands
  const maxIterations = 4096;
  let islands = [];
  let processingKnoxels = {};
  for (let knoxelId in knoxels)
  {
    if (knoxelId === spacemapKnoxelId || knoxelId === masterKnoxelId)
      continue;
    processingKnoxels[knoxelId] = true;
  }
  let island = {};
  island[masterKnoxelId] = true;
  for (let i = 0; i < maxIterations; ++i)
  {
    let islandSize = Object.keys(island).length;
    for (let j = 0; j < maxIterations; ++j)
    {
      for (let knoxelId in island)
      {
        const knyteId = knoxels[knoxelId];
        const space = informationMap[knyteId].space;
        for (let newKnoxelId in space)
          island[newKnoxelId] = true;
        for (let checkKnoxelId in processingKnoxels)
        {
          const checkKnyteId = knoxels[checkKnoxelId];
          const checkSpace = informationMap[checkKnyteId].space;
          if (knoxelId in checkSpace)
            island[checkKnoxelId] = true;
        }
      }
      let newIslandSize = Object.keys(island).length;
      if (islandSize < newIslandSize)
        islandSize = newIslandSize;
      else
        break;
    }
    islands.push(island);
    for (let knoxelId in island)
      delete processingKnoxels[knoxelId];
    const processingKnoxelsKeys = Object.keys(processingKnoxels);
    if (processingKnoxelsKeys.length === 0)
      break;
    island = {};
    island[processingKnoxelsKeys[0]] = true;
  }
  // construct space
  const space = {};
  const spacemapKnyteId = knoxels[spacemapKnoxelId];
  let position = {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  for (let i = 0; i < islands.length; ++i)
  {
    const island = islands[i];
    for (let knoxelId in island)
    {
      space[knoxelId] = {x: position.x, y: position.y};
      position.y += 1.5 * visualTheme.rect.defaultHeight;
    }
    position.x += 2.0 * visualTheme.rect.defaultWidth;
    position.y = visualTheme.rect.defaultHeight;
  }
  informationMap[spacemapKnyteId].space = space;
}

function setGhostedMode(desc)
{
  // desc: {knoxelId, isGhosted}
  const knoxelElement = document.getElementById(desc.knoxelId);
  if (desc.isGhosted)
  {
    knoxelElement.setAttribute('stroke-dasharray', '0 16');
    knoxelElement.setAttribute('stroke-linecap', 'square');
  }
  else
  {
    knoxelElement.removeAttribute('stroke-dasharray');
    knoxelElement.removeAttribute('stroke-linecap');
  }
}

function setSpaceRootKnoxel(desc)
{
  // desc: {knoxelId}
  const priorKnoxelId = spaceRootElement.dataset.knoxelId;
  const newKnoxelId = desc.knoxelId;
  const newKnyteId = knoxels[newKnoxelId];
  // clear children rects
  const spaceRootKnoxels = document.getElementById('knoxels');
  while (spaceRootKnoxels.firstChild)
    spaceRootKnoxels.firstChild.remove();
  // reset mouseover knoxel cause of changing space
  if (newKnoxelId !== priorKnoxelId)
      mouseoverGhostKnoxelId = null;
  // build space map if needed
  if (newKnoxelId === spacemapKnoxelId)
    buildSpaceMap();
  // set actual knoxel id and space color
  spaceRootElement.dataset.knoxelId = newKnoxelId;
  spaceRootElement.style.backgroundColor = informationMap[newKnyteId].color;
  // restore all nested rects
  const nestedKnoxels = informationMap[newKnyteId].space;
  for (let knoxelId in nestedKnoxels)
  {
    addRect(
      {
        id: knoxelId, position: nestedKnoxels[knoxelId],
        color: informationMap[knoxels[knoxelId]].color
      }
    );
    if (knoxelId === activeGhost.knoxelId)
      setGhostedMode({knoxelId, isGhosted: true});
  }
}

function addRect(desc)
{
  // desc: {id, position, color, ghost}
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = desc.position.x - w/2;
  const y = desc.position.y - h/2;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.id = desc.id;
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', desc.color);
  rect.setAttribute('stroke', visualTheme.rect.strokeColor);
  rect.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
  if (desc.ghost)
  {
    rect.setAttribute('opacity', 0.5);
    rect.style.pointerEvents = 'none';
    document.getElementById('ghosts').appendChild(rect);
  }
  else
  {
    rect.addEventListener('click', onClickRect, false);
    rect.addEventListener('mouseover', onMouseOverRect, false);
    rect.addEventListener('mouseout', onMouseOutRect, false);
    document.getElementById('knoxels').appendChild(rect);
  }
}

function addKnoxelRect(desc)
{
  // desc: {knyteId, position}
  const position = activeGhost.knoxelId
    ? {x: desc.position.x + activeGhost.offset.x, y: desc.position.y + activeGhost.offset.y}
    : desc.position;
  const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
  const knoxelId = knit.new();
  const color = informationMap[desc.knyteId].color;
  addKnoxel({hostKnyteId, knyteId: desc.knyteId, knoxelId, position});
  addRect({id: knoxelId, position, color});  
}

function onClickRect(e)
{
  if (!e.shiftKey && !e.altKey && !e.metaKey)
  {
    if (e.target.id !== spaceRootElement.dataset.knoxelId)
    {
      spaceBackStack.push(spaceRootElement.dataset.knoxelId);
      spaceForwardStack.length = 0;
      setSpaceRootKnoxel({knoxelId: e.target.id});
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
      });
    }
    e.stopPropagation(); // to prevent onClickSpaceRoot call
  }
}

let mouseoverGhostKnoxelId = null;
let mouseMovePosition = {x: 0, y: 0};

function onMouseOverRect(e)
{
  mouseoverGhostKnoxelId = e.target.id;
}

function onMouseOutRect(e)
{
  if (e.target.id === mouseoverGhostKnoxelId)
    mouseoverGhostKnoxelId = null;
}

function onClickSpaceRoot(e)
{
  const position = {x: e.offsetX, y: e.offsetY};
  if (!e.shiftKey && !e.altKey && e.metaKey)
  {
    const knyteId = knit.new();
    const color = visualTheme.rect.fillColor.getRandom();
    addKnyte({knyteId, initialId: knit.empty, terminalId: knit.empty, color});
    addKnoxelRect({knyteId, position});
  }
  else if (!e.shiftKey && e.altKey && !e.metaKey)
  {
    if (activeGhost.knoxelId)
    {
      const knyteId = knoxels[activeGhost.knoxelId];
      addKnoxelRect({knyteId, position});
    }
  }
}

function onClickSpaceMap(e)
{
  if (spaceRootElement.dataset.knoxelId === spacemapKnoxelId)
    return;
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  spaceForwardStack.length = 0;
  setSpaceRootKnoxel({knoxelId: spacemapKnoxelId});
  setNavigationControlState({
    backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
  });
}

function onClickSpaceBack(e)
{
  spaceForwardStack.push(spaceRootElement.dataset.knoxelId);
  const backKnoxelId = spaceBackStack.pop();
  if (backKnoxelId)
  {
    setSpaceRootKnoxel({knoxelId: backKnoxelId});
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
}

function onClickSpaceForward(e)
{
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  const forwardKnoxelId = spaceForwardStack.pop();
  if (forwardKnoxelId)
  {
    setSpaceRootKnoxel({knoxelId: forwardKnoxelId});
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
}

function onResizeWindow(e)
{
  spaceRootElement.setAttribute('width', window.innerWidth);
  spaceRootElement.setAttribute('height', window.innerHeight);
}
function setNavigationControlState(desc)
{
  // desc: {backKnoxelId, forwardKnoxelId}
  const backKnyteId = knoxels[desc.backKnoxelId];
  if (!backKnyteId)
  {
    spaceBackElement.style.display = 'none';
  }
  else
  {
    const color = informationMap[backKnyteId].color;
    spaceBackElement.style.display = 'block';
    const backArrowShape = document.getElementById('backArrowShape');
    backArrowShape.setAttribute('stroke', visualThemeColors.navigation);
    backArrowShape.setAttribute('fill', color);
  }
  const forwardKnyteId = knoxels[desc.forwardKnoxelId];
  if (!forwardKnyteId)
  {
    spaceForwardElement.style.display = 'none';
  }
  else
  {
    const color = informationMap[forwardKnyteId].color;
    spaceForwardElement.style.display = 'block';
    const forwardArrowShape = document.getElementById('forwardArrowShape');
    forwardArrowShape.setAttribute('stroke', visualThemeColors.navigation);
    forwardArrowShape.setAttribute('fill', color);
  }
  spaceMapElement.style.display = spaceRootElement.dataset.knoxelId !== spacemapKnoxelId
    ? 'block'
    : 'none';
}

const activeGhost = {
  knoxelId: null,
  hostKnyteId: null,
  offset: {x: 0, y: 0},
  element: null
};

function spawnGhostRect(desc)
{
  // desc: {ghostKnoxelId, ghostHostKnyteId, position}
  activeGhost.knoxelId = desc.ghostKnoxelId;
  activeGhost.hostKnyteId = desc.ghostHostKnyteId;
  const knyteId = knoxels[desc.ghostKnoxelId];
  const color = informationMap[knyteId].color;
  const id = desc.ghostKnoxelId + '.ghost';
  addRect({id, position: desc.position, color, ghost: true});
  activeGhost.element = document.getElementById(id);
  const knoxelPosition = informationMap[desc.ghostHostKnyteId].space[desc.ghostKnoxelId];
  if (!knoxelPosition)
  {
    activeGhost.offset = {x: 0, y: 0};
    return;
  }
  activeGhost.offset = {
    x: knoxelPosition.x - desc.position.x, 
    y: knoxelPosition.y - desc.position.y
  };
  activeGhost.element.setAttribute(
    'transform', 
    'translate(' + activeGhost.offset.x + ' ' + activeGhost.offset.y + ')'
  );
  setGhostedMode({knoxelId: desc.ghostKnoxelId, isGhosted: true});
}

function terminateGhostRect()
{
  activeGhost.element.remove();
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  if (activeGhost.knoxelId in informationMap[knyteId].space)
    setGhostedMode({knoxelId: activeGhost.knoxelId, isGhosted: false});
  activeGhost.knoxelId = null;
  activeGhost.hostKnyteId = null;
  activeGhost.offset = {x: 0, y: 0};
  activeGhost.element = null;
}

function onMouseDownSpaceRoot(e)
{
}

function onMouseMoveSpaceRoot(e)
{
  mouseMovePosition = {x: e.offsetX, y: e.offsetY};
  if (!activeGhost.knoxelId)
    return;
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = mouseMovePosition.x - w/2;
  const y = mouseMovePosition.y - h/2;
  activeGhost.element.setAttribute('x', x);
  activeGhost.element.setAttribute('y', y);
}

function onMouseUpSpaceRoot(e)
{
}

function dropGhostRect(desc)
{
  // desc: {droppedKnoxelId, droppedHostKnyteId, landingKnoxelId, position}
  if (desc.droppedKnoxelId === desc.landingKnoxelId)
    return;
  const landingKnyteId = knoxels[desc.landingKnoxelId];
  delete informationMap[desc.droppedHostKnyteId].space[desc.droppedKnoxelId];
  const landingPosition = {
    x: desc.position.x + activeGhost.offset.x,
    y: desc.position.y + activeGhost.offset.y
  };
  informationMap[landingKnyteId].space[desc.droppedKnoxelId] = landingPosition;
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
}

function onKeyDownWindow(e)
{
  if (e.code === 'Escape')
  {
    if (activeGhost.knoxelId)
      terminateGhostRect();
  }
  else if (e.code === 'Space')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      if (!activeGhost.knoxelId)
        spawnGhostRect(
          {
            ghostKnoxelId: mouseoverGhostKnoxelId || spaceRootElement.dataset.knoxelId,
            ghostHostKnyteId: knoxels[spaceRootElement.dataset.knoxelId],
            position: mouseMovePosition,
          }
        );
      else
      {
        dropGhostRect(
          {
            droppedKnoxelId: activeGhost.knoxelId,
            droppedHostKnyteId: activeGhost.hostKnyteId,
            landingKnoxelId: spaceRootElement.dataset.knoxelId,
            position: mouseMovePosition,
          }
        );
        terminateGhostRect();
      }
    }
  }
}

function onLoadBody(e)
{
  // init space root element
  spaceRootElement = document.getElementsByClassName('spaceRoot')[0];
  spaceBackElement = document.getElementsByClassName('spaceBack')[0];
  spaceForwardElement = document.getElementsByClassName('spaceForward')[0];
  spaceMapElement = document.getElementsByClassName('spaceMap')[0];
  svgNameSpace = spaceRootElement.getAttribute('xmlns');
  // create master knyte
  const masterKnyteId = knit.new();
  masterKnoxelId = knit.new();
  const masterColor = visualTheme.rect.fillColor.getRandom();
  addKnyte({knyteId: masterKnyteId, initialId: knit.empty, terminalId: knit.empty, color: masterColor});
  addKnoxel({hostKnyteId: null, knyteId: masterKnyteId, knoxelId: masterKnoxelId, position: null});
  // create mirror knyte
  const mirrorKnyteId = knit.new();
  const mirrorKnoxelId = knit.new();
  const mirrorColor = visualTheme.rect.fillColor.getRandom();
  addKnyte({knyteId: mirrorKnyteId, initialId: knit.empty, terminalId: knit.empty, color: mirrorColor});
  const position = {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  addKnoxel({hostKnyteId: masterKnyteId, knyteId: mirrorKnyteId, knoxelId: mirrorKnoxelId, position});
  addKnoxel({hostKnyteId: mirrorKnyteId, knyteId: masterKnyteId, knoxelId: masterKnoxelId, position});
  // create spacemap knyte
  const spacemapKnyteId = knit.new();
  spacemapKnoxelId = knit.new();
  const spacemapColor = visualThemeColors.navigation;
  addKnyte({knyteId: spacemapKnyteId, initialId: knit.empty, terminalId: knit.empty, color: spacemapColor});
  addKnoxel({hostKnyteId: null, knyteId: spacemapKnyteId, knoxelId: spacemapKnoxelId, position: null});
  // setup event handlers
  spaceRootElement.addEventListener('click', onClickSpaceRoot, false);
  spaceRootElement.addEventListener('mousedown', onMouseDownSpaceRoot, false);
  spaceRootElement.addEventListener('mousemove', onMouseMoveSpaceRoot, false);
  spaceRootElement.addEventListener('mouseup', onMouseUpSpaceRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  window.addEventListener('keydown', onKeyDownWindow, false);
  document.getElementById('backArrowShape').addEventListener('click', onClickSpaceBack, false);
  document.getElementById('forwardArrowShape').addEventListener('click', onClickSpaceForward, false);
  document.getElementById('spaceMapButton').addEventListener('click', onClickSpaceMap, false);
  // setup space root view
  setSpaceRootKnoxel({knoxelId: masterKnoxelId});
  setNavigationControlState({});
  onResizeWindow();
  
  console.log('ready');
}