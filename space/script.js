/* global visualThemeColors */

let svgNameSpace;
const knytesCloud = {}; // core knyte id --> initial knyte id, terminal knyte id
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}}
const knoxels = {}; // knoxel id --> knyte id
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
  // desc: {rootKnyteId, knyteId, knoxelId, position}
  knoxels[desc.knoxelId] = desc.knyteId;
  if (desc.rootKnyteId)
    informationMap[desc.rootKnyteId].space[desc.knoxelId] = desc.position;
}

function setRectAsRoot(newSpaceRootId)
{
  const spaceRoot = document.getElementsByClassName('spaceRoot')[0];
  // check for return knoxel
  const newKnyteId = knoxels[newSpaceRootId];
  const priorSpaceRootId = spaceRoot.id;
  const priorKnyteId = knoxels[priorSpaceRootId];
  if (!Object.keys(informationMap[newKnyteId].space).length)
    addKnoxel(
      {
        rootKnyteId: newKnyteId, knyteId: priorKnyteId, knoxelId: priorSpaceRootId, 
        position: {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight}
      }
    )
  // clear children rects
  while (spaceRoot.firstChild)
    spaceRoot.firstChild.remove();
  // set space color
  spaceRoot.style.backgroundColor = informationMap[newKnyteId].color;
  // set actual knoxel id
  spaceRoot.id = newSpaceRootId;
  // restore all nested rects
  const nestedKnoxels = informationMap[newKnyteId].space;
  for (let knoxelId in nestedKnoxels)
    addRect(
      {
        canvasElement: spaceRoot, id: knoxelId,
        position: nestedKnoxels[knoxelId],
        color: informationMap[knoxels[knoxelId]].color
      }
  );
}

function addRect(desc)
{
  // desc: {canvasElement, id, position, color}
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
  rect.addEventListener('click', onClickRect, false);
  desc.canvasElement.appendChild(rect);
}

function addKnoxelRect(knyteId, e)
{
  const canvasElement = document.getElementsByClassName('spaceRoot')[0];
  const rootKnyteId = knoxels[canvasElement.id];
  const knoxelId = knit.new();
  const position = {x: e.offsetX, y: e.offsetY};
  const color = informationMap[knyteId].color;
  addKnoxel({rootKnyteId, knyteId, knoxelId, position});
  addRect({canvasElement, id: knoxelId, position, color});  
}

function onClickRect(e)
{
  if (!e.shiftKey && !e.altKey && !e.metaKey)
  {
    setRectAsRoot(e.target.id);
  }
  else if (!e.shiftKey && e.altKey && !e.metaKey)
  {
    const knyteId = knoxels[e.target.id];
    addKnoxelRect(knyteId, e);
  }
  e.stopPropagation(); // to prevent onClickSpaceRoot call
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
    const canvasElement = document.getElementsByClassName('spaceRoot')[0];
    const knyteId = knoxels[canvasElement.id];
    addKnoxelRect(knyteId, e);
  }
}

function onResizeWindow(e)
{
  const spaceRoot = document.getElementsByClassName('spaceRoot')[0];
  spaceRoot.setAttribute('width', window.innerWidth);
  spaceRoot.setAttribute('height', window.innerHeight);
}

function onLoadBody(e)
{
  // init space root element
  const spaceRoot = document.getElementsByClassName('spaceRoot')[0];
  svgNameSpace = spaceRoot.getAttribute('xmlns');
  // create root knyte
  const rootKnyteId = knit.new();
  const rootKnoxelId = knit.new();
  const rootColor = visualTheme.rect.fillColor.getRandom();
  spaceRoot.id = rootKnoxelId;
  addKnyte({knyteId: rootKnyteId, initialId: knit.empty, terminalId: knit.empty, color: rootColor});
  addKnoxel({rootKnoxelId: null, knyteId: rootKnyteId, knoxelId: spaceRoot.id, position: null});
  // create mirror knyte
  const mirrorKnyteId = knit.new();
  const mirrorKnoxelId = knit.new();
  const mirrorColor = visualTheme.rect.fillColor.getRandom();
  addKnyte({knyteId: mirrorKnyteId, initialId: knit.empty, terminalId: knit.empty, color: mirrorColor});
  const position = {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  addKnoxel({rootKnyteId: rootKnyteId, knyteId: mirrorKnyteId, knoxelId: mirrorKnoxelId, position});
  addKnoxel({rootKnyteId: mirrorKnyteId, knyteId: rootKnyteId, knoxelId: rootKnoxelId, position});
  // setup event handlers
  spaceRoot.addEventListener('click', onClickSpaceRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  // setup space root view
  setRectAsRoot(spaceRoot.id);
  onResizeWindow();
  
  console.log('ready');
}