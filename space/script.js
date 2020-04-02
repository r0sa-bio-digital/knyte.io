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
    addRect(
      {
        id: knoxelId, position: nestedKnoxels[knoxelId],
        color: informationMap[knoxels[knoxelId]].color
      }
  );
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
  const hostKnyteId = knoxels[spaceRootElement.id];
  const knoxelId = knit.new();
  const position = {x: e.offsetX, y: e.offsetY};
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
  }
  else if (!e.shiftKey && e.altKey && !e.metaKey)
  {
    const knyteId = knoxels[e.target.id];
    addKnoxelRect(knyteId, e);
  }
  e.stopPropagation(); // to prevent onClickSpaceRoot call
}

let mouseoverGhostKnoxelId = null;

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
    const knyteId = knoxels[spaceRootElement.id];
    addKnoxelRect(knyteId, e);
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
let ghostRectIsFixed = false;

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
}

function terminateGhostRect()
{
  const ghostElement = document.getElementById(activeGhostKnoxelId + '.ghost');
  ghostElement.remove();
  activeGhostKnoxelId = null;
  activeGhostHostKnyteId = null;
}

function onMouseDownSpaceRoot(e)
{
  if (!mouseoverGhostKnoxelId || ghostRectIsFixed)
    return;
  spawnGhostRect(
    {
      ghostKnoxelId: mouseoverGhostKnoxelId, ghostHostKnyteId: knoxels[spaceRootElement.id],
      position: {x: e.offsetX, y: e.offsetY}
    }
  );
}

function onMouseMoveSpaceRoot(e)
{
  if (!activeGhostKnoxelId || ghostRectIsFixed)
    return;
  const ghostElement = document.getElementById(activeGhostKnoxelId + '.ghost');
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = e.offsetX - w/2;
  const y = e.offsetY - h/2;
  ghostElement.setAttribute('x', x);
  ghostElement.setAttribute('y', y);
}

function onMouseUpSpaceRoot(e)
{
  if (!activeGhostKnoxelId || ghostRectIsFixed)
    return;
  onGhostRectMoved(
    {
      droppedKnoxelId: activeGhostKnoxelId, droppedHostKnyteId: activeGhostHostKnyteId,
      landingKnoxelId: mouseoverGhostKnoxelId, position: {x: e.offsetX, y: e.offsetY}
    }
  );
  terminateGhostRect();
}

function onGhostRectMoved(desc)
{
  // desc: {droppedKnoxelId, droppedHostKnyteId, landingKnoxelId, position}
  const droppedElement = document.getElementById(desc.droppedKnoxelId);
  if (!droppedElement && !desc.landingKnoxelId)
    desc.landingKnoxelId = spaceRootElement.id;
  else if (desc.landingKnoxelId)
    desc.position = {x: 0, y: 0};
  if (!desc.landingKnoxelId)
  {
    // move knoxel inside the space
    const w = visualTheme.rect.defaultWidth;
    const h = visualTheme.rect.defaultHeight;
    const x = desc.position.x - w/2;
    const y = desc.position.y - h/2;
    droppedElement.setAttribute('x', x);
    droppedElement.setAttribute('y', y);
    informationMap[desc.droppedHostKnyteId].space[desc.droppedKnoxelId] = desc.position;
  }
  else if (desc.droppedKnoxelId !== desc.landingKnoxelId)
  {
    const landingKnyteId = knoxels[desc.landingKnoxelId];
    delete informationMap[desc.droppedHostKnyteId].space[desc.droppedKnoxelId];
    informationMap[landingKnyteId].space[desc.droppedKnoxelId] = desc.position;
    setSpaceRootKnoxel({knoxelId: spaceRootElement.id}); // TODO: optimise space refresh
  }
}

function onKeyDownWindow(e)
{
  if (e.code === 'Escape' && activeGhostKnoxelId)
  {
    terminateGhostRect();
    ghostRectIsFixed = false;
  }
  else if (e.code === 'Space' && activeGhostKnoxelId)
  {
    if (!ghostRectIsFixed)
      ghostRectIsFixed = true;
    else
    {
      const ghostElement = document.getElementById(activeGhostKnoxelId + '.ghost');
      const w = visualTheme.rect.defaultWidth;
      const h = visualTheme.rect.defaultHeight;
      const x = parseInt(ghostElement.getAttribute('x')) + w/2;
      const y = parseInt(ghostElement.getAttribute('y')) + h/2;
      onGhostRectMoved(
        {
          droppedKnoxelId: activeGhostKnoxelId, droppedHostKnyteId: activeGhostHostKnyteId,
          landingKnoxelId: null, position: {x, y}
        }
      );
      terminateGhostRect();
      ghostRectIsFixed = false;
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