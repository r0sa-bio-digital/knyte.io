/* global visualThemeColors */

let svgNameSpace;
let spaceRootElement;
let spaceBackElement;
const knytesCloud = {}; // core knyte id --> initial knyte id, terminal knyte id
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}}
const knoxels = {}; // knoxel id --> knyte id
const spaceBackStack = []; // [previous space root knoxel id]
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

function setSpaceRootKnoxel(desc)
{
  // desc: {knoxelId}
  const newKnoxelId = desc.knoxelId;
  const newKnyteId = knoxels[newKnoxelId];
  const priorKnoxelId = spaceRootElement.id;
  // clear children rects
  const spaceRootKnoxels = document.getElementById('knoxels');
  while (spaceRootKnoxels.firstChild)
    spaceRootKnoxels.firstChild.remove();
  if (newKnoxelId !== priorKnoxelId)
      mouseoverGhostKnoxelId = null;
  // set space color
  spaceRootElement.style.backgroundColor = informationMap[newKnyteId].color;
  // set actual knoxel id
  spaceRootElement.id = newKnoxelId;
  // restore all nested rects
  const nestedKnoxels = informationMap[newKnyteId].space;
  for (let knoxelId in nestedKnoxels)
  {
    if (knoxelId === newKnoxelId) // don't view knoxel inside itself
      continue;
    addRect(
      {
        id: knoxelId, position: nestedKnoxels[knoxelId],
        color: informationMap[knoxels[knoxelId]].color
      }
    );
    if (knoxelId === activeGhostKnoxelId)
    {
      const rect2 = document.getElementById(activeGhostKnoxelId);
      rect2.setAttribute('stroke-dasharray', '0 16');
      rect2.setAttribute('stroke-linecap', 'square');
    }
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

function addKnoxelRect(knyteId, e)
{
  let position = {x: e.offsetX, y: e.offsetY};
  if (activeGhostKnoxelId)
  {
    const rect = document.getElementById(activeGhostKnoxelId + '.ghost');
    position = {
      x: position.x + parseFloat(rect.dataset.offsetX),
      y: position.y + parseFloat(rect.dataset.offsetY)
    };
  }
  const hostKnyteId = knoxels[spaceRootElement.id];
  const knoxelId = knit.new();
  const color = informationMap[knyteId].color;
  addKnoxel({hostKnyteId, knyteId, knoxelId, position});
  addRect({id: knoxelId, position, color});  
}

function onClickRect(e)
{
  if (!e.shiftKey && !e.altKey && !e.metaKey)
  {
    if (e.target.id !== spaceRootElement.id)
    {
      spaceBackStack.push(spaceRootElement.id);
      setSpaceBackState(spaceRootElement.id);
      setSpaceRootKnoxel({knoxelId: e.target.id});
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
  mouseoverGhostKnoxelId = null;
}

function onClickSpaceRoot(e)
{
  if (!e.shiftKey && !e.altKey && e.metaKey)
  {
    const knyteId = knit.new();
    const color = visualTheme.rect.fillColor.getRandom();
    addKnyte({knyteId, initialId: knit.empty, terminalId: knit.empty, color});
    addKnoxelRect(knyteId, e);
  }
  else if (!e.shiftKey && e.altKey && !e.metaKey)
  {
    if (activeGhostKnoxelId)
      addKnoxelRect(knoxels[activeGhostKnoxelId], e);
  }
}

function onClickSpaceBack(e)
{
  const backKnoxelId = spaceBackStack.pop();
  if (backKnoxelId)
  {
    setSpaceRootKnoxel({knoxelId: backKnoxelId});
    setSpaceBackState(spaceBackStack[spaceBackStack.length - 1]);
  }
}

function onResizeWindow(e)
{
  spaceRootElement.setAttribute('width', window.innerWidth);
  spaceRootElement.setAttribute('height', window.innerHeight);
}
function setSpaceBackState(backKnoxelId)
{
  const backKnyteId = knoxels[backKnoxelId];
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
}

let activeGhostKnoxelId = null;
let activeGhostHostKnyteId = null;

function spawnGhostRect(desc)
{
  // desc: {ghostKnoxelId, ghostHostKnyteId, position}
  activeGhostKnoxelId = desc.ghostKnoxelId;
  activeGhostHostKnyteId = desc.ghostHostKnyteId;
  const knyteId = knoxels[desc.ghostKnoxelId];
  const knoxelId = knit.new();
  const color = informationMap[knyteId].color;
  const id = desc.ghostKnoxelId + '.ghost';
  addRect({id, position: desc.position, color, ghost: true});
  const rect = document.getElementById(id);
  const knoxelPosition = informationMap[desc.ghostHostKnyteId].space[desc.ghostKnoxelId] || desc.position;
  const offset = {
    x: knoxelPosition.x - desc.position.x, 
    y: knoxelPosition.y - desc.position.y
  };
  rect.dataset.offsetX = offset.x;
  rect.dataset.offsetY = offset.y;
  rect.setAttribute(
    'transform', 
    'translate(' + offset.x + ' ' + offset.y + ')'
  );
  const rect2 = document.getElementById(activeGhostKnoxelId);
  rect2.setAttribute('stroke-dasharray', '0 16');
  rect2.setAttribute('stroke-linecap', 'square');
}

function terminateGhostRect()
{
  const ghostElement = document.getElementById(activeGhostKnoxelId + '.ghost');
  ghostElement.remove();
  const rect2 = document.getElementById(activeGhostKnoxelId);
  rect2.removeAttribute('stroke-dasharray');
  rect2.removeAttribute('stroke-linecap');
  activeGhostKnoxelId = null;
  activeGhostHostKnyteId = null;
}

function onMouseDownSpaceRoot(e)
{
}

function onMouseMoveSpaceRoot(e)
{
  mouseMovePosition = {x: e.offsetX, y: e.offsetY};
  if (!activeGhostKnoxelId)
    return;
  const ghostElement = document.getElementById(activeGhostKnoxelId + '.ghost');
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = mouseMovePosition.x - w/2;
  const y = mouseMovePosition.y - h/2;
  ghostElement.setAttribute('x', x);
  ghostElement.setAttribute('y', y);
}

function onMouseUpSpaceRoot(e)
{
}

function onGhostRectMoved(desc)
{
  // desc: {droppedKnoxelId, droppedHostKnyteId, landingKnoxelId, position}
  if (desc.droppedKnoxelId === desc.landingKnoxelId)
    return;
  const landingKnyteId = knoxels[desc.landingKnoxelId];
  delete informationMap[desc.droppedHostKnyteId].space[desc.droppedKnoxelId];
  const rect = document.getElementById(activeGhostKnoxelId + '.ghost');
  const landingPosition = {
    x: desc.position.x + parseFloat(rect.dataset.offsetX),
    y: desc.position.y + parseFloat(rect.dataset.offsetY)
  };
  informationMap[landingKnyteId].space[desc.droppedKnoxelId] = landingPosition;
  setSpaceRootKnoxel({knoxelId: spaceRootElement.id}); // TODO: optimise space refresh
}

function onKeyDownWindow(e)
{
  if (e.code === 'Escape' && activeGhostKnoxelId)
  {
    terminateGhostRect();
  }
  else if (e.code === 'Space')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      if (!activeGhostKnoxelId)
        spawnGhostRect(
          {
            ghostKnoxelId: mouseoverGhostKnoxelId || spaceRootElement.id,
            ghostHostKnyteId: knoxels[spaceRootElement.id],
            position: mouseMovePosition
          }
        );
      else
      {
        onGhostRectMoved(
          {
            droppedKnoxelId: activeGhostKnoxelId, droppedHostKnyteId: activeGhostHostKnyteId,
            landingKnoxelId: spaceRootElement.id, 
            position: mouseMovePosition
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
  svgNameSpace = spaceRootElement.getAttribute('xmlns');
  // create root knyte
  const masterKnyteId = knit.new();
  const masterKnoxelId = knit.new();
  const masterColor = visualTheme.rect.fillColor.getRandom();
  spaceRootElement.id = masterKnoxelId;
  addKnyte({knyteId: masterKnyteId, initialId: knit.empty, terminalId: knit.empty, color: masterColor});
  addKnoxel({hostKnyteId: null, knyteId: masterKnyteId, knoxelId: spaceRootElement.id, position: null});
  // create mirror knyte
  const mirrorKnyteId = knit.new();
  const mirrorKnoxelId = knit.new();
  const mirrorColor = visualTheme.rect.fillColor.getRandom();
  addKnyte({knyteId: mirrorKnyteId, initialId: knit.empty, terminalId: knit.empty, color: mirrorColor});
  const position = {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  addKnoxel({hostKnyteId: masterKnyteId, knyteId: mirrorKnyteId, knoxelId: mirrorKnoxelId, position});
  addKnoxel({hostKnyteId: mirrorKnyteId, knyteId: masterKnyteId, knoxelId: masterKnoxelId, position});
  // setup event handlers
  spaceRootElement.addEventListener('click', onClickSpaceRoot, false);
  spaceRootElement.addEventListener('mousedown', onMouseDownSpaceRoot, false);
  spaceRootElement.addEventListener('mousemove', onMouseMoveSpaceRoot, false);
  spaceRootElement.addEventListener('mouseup', onMouseUpSpaceRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  window.addEventListener('keydown', onKeyDownWindow, false);
  document.getElementById('backArrowShape').addEventListener('click', onClickSpaceBack, false);
  // setup space root view
  setSpaceRootKnoxel({knoxelId: spaceRootElement.id});
  setSpaceBackState();
  onResizeWindow();
  
  console.log('ready');
}